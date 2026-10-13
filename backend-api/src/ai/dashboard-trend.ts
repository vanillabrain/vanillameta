import { quoteColumn, validateSourceSql } from './dashboard-draft';

export type TrendGrain = 'hour' | 'day' | 'week' | 'month';

export interface TimeBucket {
  column: string;
  grain: TrendGrain;
  format: 'day' | 'month' | 'hour' | 'timestamp' | 'duckdb';
}

/** Exact supported expressions only; an unbucketed timestamp has no proven grain. */
function temporalProjection(expression: string, column: string, type = 'TIMESTAMP') {
  const normalized = (value: string) =>
    (value.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|[^\s]/g) || [])
      .map(token => (token.startsWith("'") || token.startsWith('"') ? token : token.toLowerCase()))
      .join(' ');
  const direct = (value: string) => {
    const name = normalized(quoteColumn(column));
    const bare = /^[A-Za-z_][A-Za-z_0-9]*$/.test(column) ? column.toLowerCase() : undefined;
    return [name, bare, `source . ${name}`, bare && `source . ${bare}`].includes(value);
  };
  const value = normalized(expression);
  const base = (expr: string): { grain?: TrendGrain; format: TimeBucket['format'] } | undefined => {
    if (direct(expr)) return { grain: type === 'DATE' ? 'day' : undefined, format: 'day' };
    const trunc = /^date_trunc \( '(hour|day|week|month)' , (.+) \)$/.exec(expr);
    if (trunc && direct(trunc[2])) return { grain: trunc[1] as TrendGrain, format: 'duckdb' };
    return undefined;
  };
  const plain = base(value);
  if (plain) return plain;
  const formats = '%Y-%m-%d|%Y-%m|%Y-%m-%dT%H:%M:%SZ|%Y-%m-%dT%H:00:00Z';
  const formatted = new RegExp(`^strftime \\( (.+) , '(${formats})' \\)$`).exec(value);
  const first = new RegExp(`^strftime \\( '(${formats})' , (.+) \\)$`).exec(value);
  const expr = formatted?.[1] || first?.[2];
  const format = formatted?.[2] || first?.[1];
  if (!expr) return undefined;
  const inner = base(expr);
  if (!inner) return undefined;
  if (format === '%Y-%m') {
    if (!direct(expr) && inner.grain !== 'month') return undefined;
    return { grain: 'month' as const, format: 'month' as const };
  }
  if (format === '%Y-%m-%d') {
    if (inner.grain === 'hour') return undefined;
    return { grain: direct(expr) ? ('day' as const) : inner.grain, format: 'day' as const };
  }
  if (format === '%Y-%m-%dT%H:00:00Z') {
    if (!direct(expr) && inner.grain !== 'hour') return undefined;
    return { grain: 'hour' as const, format: 'hour' as const };
  }
  return { grain: inner.grain, format: 'timestamp' as const };
}

function timeQuery(
  expression: string,
  where: string,
  dateColumn: string,
  grain: TrendGrain,
  timeField: string,
  valueAlias: string,
) {
  const bucket = `date_trunc('${grain}', ${quoteColumn(dateColumn)})`;
  return {
    sql: `SELECT strftime(${bucket}, '%Y-%m-%dT%H:%M:%SZ') AS ${quoteColumn(
      timeField,
    )}, ${expression} AS ${quoteColumn(valueAlias)} FROM source${
      where ? ` ${where}` : ''
    } GROUP BY ${bucket} ORDER BY ${bucket} LIMIT 241`,
    timeField,
    valueAlias,
  };
}

/** Build a trend query only for a single, plain aggregate projection with an optional WHERE. */
export function buildTrendQuery(
  sql: string,
  valueField: string,
  dateColumn: string,
  grain: TrendGrain,
  reservedNames: string[] = [],
): { sql: string; timeField: string; valueAlias: string } | undefined {
  if (!['hour', 'day', 'week', 'month'].includes(grain)) return undefined;
  const tokens = sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|\s+|./g) || [];
  if (tokens.join('') !== sql) return undefined;
  let offset = 0;
  const words = tokens
    .map(text => {
      const token = { text, index: offset };
      offset += text.length;
      return token;
    })
    .filter(t => !/^\s+$/.test(t.text));
  const lower = words.map(t => t.text.toLowerCase());
  if (lower[0] !== 'select') return undefined;
  const fromIndexes = lower.flatMap((word, i) => (word === 'from' ? [i] : []));
  if (fromIndexes.length !== 1) return undefined;
  const fromIndex = fromIndexes[0];
  const selectStart = words[0].index + words[0].text.length;
  const fromStart = words[fromIndex].index;
  const projection = sql.slice(selectStart, fromStart).trim();
  if (lower.includes('over')) return undefined;
  const aliasMatch = /\s+AS\s+("(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*)\s*$/i.exec(projection);
  if (!aliasMatch) return undefined;
  const alias = aliasMatch[1].replace(/^"|"$/g, '').replace(/""/g, '"');
  if (alias !== valueField) return undefined;
  const expression = projection.slice(0, aliasMatch.index).trim();
  let depth = 0;
  let topLevelComma = false;
  for (const character of expression) {
    if (character === '(') depth++;
    else if (character === ')') depth--;
    else if (character === ',' && depth === 0) topLevelComma = true;
  }
  if (!expression || topLevelComma || /;/.test(expression) || depth !== 0) return undefined;
  const tail = words.slice(fromIndex + 2);
  if (words[fromIndex + 1]?.text.toLowerCase() !== 'source') return undefined;
  if (
    tail.some(t =>
      /^(group|having|order|limit|offset|qualify|window|union|intersect|except)$/i.test(t.text),
    )
  )
    return undefined;
  if (tail.length && tail[0].text.toLowerCase() !== 'where') return undefined;

  const identifiers = new Set(
    [...reservedNames, ...words.map(t => t.text.replace(/^"|"$/g, ''))].map(x => x.toLowerCase()),
  );
  const unique = (base: string) => {
    let name = base;
    let n = 1;
    while (identifiers.has(name.toLowerCase())) name = `${base}_${n++}`;
    identifiers.add(name.toLowerCase());
    return name;
  };
  const timeField = unique('__trend_time');
  const valueAlias = unique('__trend_value');
  const where = tail.length ? sql.slice(tail[0].index).trim() : '';
  return timeQuery(expression, where, dateColumn, grain, timeField, valueAlias);
}

/** Rebucket a chart only when its two projections prove one date and one aggregate. */
export function buildTimeChartQuery(
  sql: string,
  valueField: string,
  categoryField: string | undefined,
  dateColumn: string,
  grain: TrendGrain,
  reservedNames: string[] = [],
): { sql: string; timeField: string; valueAlias: string } | undefined {
  if (
    !categoryField ||
    ![categoryField, valueField].every(
      name =>
        /^[A-Za-z_][A-Za-z_0-9]*$/.test(name) &&
        !/^(select|from|source|where|group|by|order|limit|having|offset|as|over)$/i.test(name),
    ) ||
    categoryField.toLowerCase() === valueField.toLowerCase()
  )
    return undefined;
  try {
    validateSourceSql(sql);
  } catch {
    return undefined;
  }
  const tokens =
    sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|\s+|./g) || [];
  let offset = 0;
  let depth = 0;
  const words = tokens
    .map(text => {
      const token = { text, index: offset, depth };
      offset += text.length;
      if (text === '(') depth++;
      if (text === ')') depth--;
      return token;
    })
    .filter(token => !/^\s+$/.test(token.text));
  if (depth !== 0 || words.some(token => token.depth < 0)) return undefined;
  const top = words.filter(token => token.depth === 0);
  const find = (word: string) => top.findIndex(token => token.text.toLowerCase() === word);
  const from = find('from');
  const group = find('group');
  const order = find('order');
  const limit = find('limit');
  const whereIndex = find('where');
  if (
    from < 0 ||
    group < from + 2 ||
    top[group + 1]?.text.toLowerCase() !== 'by' ||
    (whereIndex >= 0 ? whereIndex !== from + 2 || whereIndex >= group : group !== from + 2) ||
    (order >= 0 && (order <= group || top[order + 1]?.text.toLowerCase() !== 'by')) ||
    (limit >= 0 &&
      (limit <= (order >= 0 ? order : group) ||
        limit !== top.length - 2 ||
        !/^\d+$/.test(top[limit + 1].text))) ||
    words.some(token => /^(having|offset|qualify|window|over)$/i.test(token.text))
  )
    return undefined;
  const commas = top.filter(token => token.text === ',' && token.index < top[from].index);
  if (commas.length !== 1) return undefined;
  const selectStart = top[0].index + top[0].text.length;
  const projections = [
    sql.slice(selectStart, commas[0].index),
    sql.slice(commas[0].index + 1, top[from].index),
  ];
  const parsed = projections.map(projection => {
    const match = /\s+AS\s+("[A-Za-z_][A-Za-z_0-9]*"|[A-Za-z_][A-Za-z_0-9]*)\s*$/i.exec(projection);
    return match
      ? { expression: projection.slice(0, match.index).trim(), alias: match[1].replace(/"/g, '') }
      : undefined;
  });
  const category = parsed.find(projection => projection?.alias === categoryField);
  const value = parsed.find(projection => projection?.alias === valueField);
  if (!category || !value) return undefined;
  const normalized = (expression: string) =>
    (
      expression.match(
        /'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|[^\s]/g,
      ) || []
    )
      .map(token => (token.startsWith("'") || token.startsWith('"') ? token : token.toLowerCase()))
      .join(' ');
  const categoryTime = temporalProjection(category.expression, dateColumn);
  if (!categoryTime) return undefined;
  const groupEnd = order >= 0 ? top[order].index : limit >= 0 ? top[limit].index : sql.length;
  const groupExpression = sql.slice(top[group + 1].index + 2, groupEnd).trim();
  if (
    ![
      normalized(category.expression),
      normalized(categoryField),
      normalized(quoteColumn(categoryField)),
    ].includes(normalized(groupExpression)) &&
    !(
      categoryTime.grain &&
      /^date_trunc \(/.test(normalized(groupExpression)) &&
      temporalProjection(groupExpression, dateColumn)?.grain === categoryTime.grain
    )
  )
    return undefined;
  if (limit >= 0) {
    const originalLimit = Number(top[limit + 1].text);
    if (order < 0 || !Number.isSafeInteger(originalLimit) || originalLimit < 241) return undefined;
  }
  if (order >= 0) {
    const orderExpression = sql
      .slice(top[order + 1].index + 2, limit >= 0 ? top[limit].index : sql.length)
      .trim()
      .replace(/\s+ASC$/i, '');
    if (
      ![category.expression, categoryField, quoteColumn(categoryField)]
        .map(normalized)
        .includes(normalized(orderExpression)) &&
      !(
        categoryTime.grain &&
        /^date_trunc \(/.test(normalized(orderExpression)) &&
        temporalProjection(orderExpression, dateColumn)?.grain === categoryTime.grain
      )
    )
      return undefined;
  }
  const expressionTokens =
    value.expression.match(
      /'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|[^\s]/g,
    ) || [];
  const aggregate = /^(sum|count|avg|min|max|count_if)$/i;
  const scalar = /^(round|coalesce|nullif|abs|floor|ceil|cast|try_cast|if)$/i;
  const keywords = /^(case|when|then|else|end|null|true|false|and|or|not|is)$/i;
  const stack: boolean[] = [];
  let hasAggregate = false;
  for (let i = 0; i < expressionTokens.length; i++) {
    const token = expressionTokens[i];
    if (token === '(') {
      const fn = expressionTokens[i - 1];
      if (aggregate.test(fn)) {
        if (stack.includes(true)) return undefined;
        hasAggregate = true;
      }
      stack.push(aggregate.test(fn));
    } else if (token === ')') stack.pop();
    else if (/^[A-Za-z_"]/.test(token)) {
      if (expressionTokens[i + 1] === '(') {
        if (!aggregate.test(token) && !scalar.test(token)) return undefined;
      } else if (!stack.includes(true) && !keywords.test(token)) return undefined;
    }
  }
  if (!hasAggregate) return undefined;
  const where = whereIndex >= 0 ? sql.slice(top[whereIndex].index, top[group].index).trim() : '';
  if (
    where &&
    words.some(
      token =>
        token.index > top[whereIndex].index &&
        token.index < top[group].index &&
        /^(as|over|group|order|limit|having|offset|qualify|window)$/i.test(token.text),
    )
  )
    return undefined;
  // Reuse the numeric trend grammar before retaining the chart's original field names.
  const trend = buildTrendQuery(
    `SELECT ${value.expression} AS ${quoteColumn(valueField)} FROM source${
      where ? ` ${where}` : ''
    }`,
    valueField,
    dateColumn,
    grain,
    reservedNames,
  );
  return trend
    ? timeQuery(value.expression, where, dateColumn, grain, categoryField, valueField)
    : undefined;
}

/** Reuse the reaggregation proof, then recover the original category's actual bucket. */
export function resolveTimeChartBucket(
  sql: string,
  valueField: string,
  categoryField: string | undefined,
  schema: Array<{ column_name: string; column_type: string }>,
): TimeBucket | undefined {
  if (!categoryField) return undefined;
  const tokens = sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|\s+|./g) || [];
  let depth = 0;
  let offset = 0;
  let start = 0;
  const projections: string[] = [];
  for (const token of tokens) {
    if (depth === 0 && token.toLowerCase() === 'select') start = offset + token.length;
    if (depth === 0 && (token === ',' || token.toLowerCase() === 'from')) {
      projections.push(sql.slice(start, offset).trim());
      start = offset + token.length;
      if (token.toLowerCase() === 'from') break;
    }
    if (token === '(') depth++;
    if (token === ')') depth--;
    offset += token.length;
  }
  const expression = projections.flatMap(projection => {
    const match = /\s+AS\s+("[A-Za-z_][A-Za-z_0-9]*"|[A-Za-z_][A-Za-z_0-9]*)\s*$/i.exec(projection);
    return match && match[1].replace(/"/g, '') === categoryField
      ? [projection.slice(0, match.index)]
      : [];
  });
  if (expression.length !== 1) return undefined;
  for (const column of schema.filter(item => /^(DATE|TIMESTAMP)/i.test(item.column_type))) {
    const bucket = temporalProjection(
      expression[0],
      column.column_name,
      column.column_type.toUpperCase(),
    );
    if (
      bucket?.grain &&
      buildTimeChartQuery(
        sql,
        valueField,
        categoryField,
        column.column_name,
        bucket.grain,
        schema.map(item => item.column_name),
      )
    )
      return { column: column.column_name, grain: bucket.grain, format: bucket.format };
  }
  return undefined;
}

export function chooseTrendGrain(
  min: string | null | undefined,
  max: string | null | undefined,
): TrendGrain {
  const start = min ? Date.parse(`${min.slice(0, 10)}T00:00:00Z`) : NaN;
  const end = max ? Date.parse(`${max.slice(0, 10)}T00:00:00Z`) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'day';
  const days = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
  if (days <= 8) return 'hour';
  if (days <= 180) return 'day';
  if (days <= 180 * 7) return 'week';
  return 'month';
}
