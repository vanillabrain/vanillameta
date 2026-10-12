import { quoteColumn } from './dashboard-draft';

export type TrendGrain = 'hour' | 'day' | 'week' | 'month';

/** Build a trend query only for a single, plain aggregate projection with an optional WHERE. */
export function buildTrendQuery(
  sql: string,
  valueField: string,
  dateColumn: string,
  grain: TrendGrain,
  reservedNames: string[] = [],
): { sql: string; timeField: string; valueAlias: string } | undefined {
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
