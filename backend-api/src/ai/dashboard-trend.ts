import { quoteColumn, validateSourceSql } from './dashboard-draft';

export type TrendGrain = 'hour' | 'day' | 'week' | 'month';

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
  const date = normalized(quoteColumn(dateColumn));
  const bareDate = /^[A-Za-z_][A-Za-z_0-9]*$/.test(dateColumn)
    ? dateColumn.toLowerCase()
    : undefined;
  const isDate = (expression: string): boolean => {
    const normalizedExpression = normalized(expression);
    if (normalizedExpression === date || normalizedExpression === bareDate) return true;
    const trunc = /^date_trunc \( '(hour|day|week|month)' , (.+) \)$/.exec(normalizedExpression);
    if (trunc) return trunc[2] === date || trunc[2] === bareDate;
    const formatted = /^strftime \( (.+) , '(%Y-%m-%d|%Y-%m|%Y-%m-%dT%H:%M:%SZ)' \)$/.exec(
      normalizedExpression,
    );
    const formatFirst = /^strftime \( '(%Y-%m-%d|%Y-%m|%Y-%m-%dT%H:%M:%SZ)' , (.+) \)$/.exec(
      normalizedExpression,
    );
    return (!!formatted && isDate(formatted[1])) || (!!formatFirst && isDate(formatFirst[2]));
  };
  if (!isDate(category.expression)) return undefined;
  const groupEnd = order >= 0 ? top[order].index : limit >= 0 ? top[limit].index : sql.length;
  const groupExpression = sql.slice(top[group + 1].index + 2, groupEnd).trim();
  if (
    ![
      normalized(category.expression),
      normalized(categoryField),
      normalized(quoteColumn(categoryField)),
    ].includes(normalized(groupExpression))
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
        .includes(normalized(orderExpression))
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
