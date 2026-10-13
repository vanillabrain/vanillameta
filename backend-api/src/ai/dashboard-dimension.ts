import { validateSourceSql } from './dashboard-draft';

function identifier(tokens: string[]): string | undefined {
  if (tokens.length === 3 && /^source$/i.test(tokens[0]) && tokens[1] === '.')
    return identifier(tokens.slice(2));
  if (tokens.length !== 1) return undefined;
  const token = tokens[0];
  if (/^"(?:""|[^"])+"$/.test(token)) return token.slice(1, -1).replace(/""/g, '"');
  return /^[A-Za-z_][A-Za-z_0-9]*$/.test(token) ? token : undefined;
}

/** Prove a category is one original, non-temporal source column with one grouping key. */
export function resolveDimensionColumn(
  sql: string,
  categoryField: string | undefined,
  columns: string[],
  temporalColumns: string[],
): string | undefined {
  if (!categoryField) return undefined;
  try {
    validateSourceSql(sql);
  } catch {
    return undefined;
  }
  const words =
    sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|[^\s]/g) || [];
  let depth = 0;
  const top = words.flatMap((word, index) => {
    const entry = depth === 0 ? [{ word, index }] : [];
    if (word === '(') depth++;
    if (word === ')') depth--;
    if (depth < 0) depth = NaN;
    return entry;
  });
  if (depth !== 0 || words.some(word => /^(having|over|offset|qualify|window)$/i.test(word)))
    return undefined;
  const clause = (name: string) => top.findIndex(token => token.word.toLowerCase() === name);
  const from = clause('from');
  const group = clause('group');
  const where = clause('where');
  const order = clause('order');
  const limit = clause('limit');
  if (
    from < 0 ||
    group < from + 2 ||
    top[group + 1]?.word.toLowerCase() !== 'by' ||
    (where >= 0 ? where !== from + 2 || where >= group : group !== from + 2) ||
    (order >= 0 && (order <= group || top[order + 1]?.word.toLowerCase() !== 'by')) ||
    (limit >= 0 &&
      (limit <= (order >= 0 ? order : group) ||
        limit !== top.length - 2 ||
        !/^\d+$/.test(top[limit + 1].word)))
  )
    return undefined;
  const comma = top.filter(token => token.word === ',' && token.index < top[from].index);
  if (comma.length !== 1) return undefined;
  const projections = [
    words.slice(1, comma[0].index),
    words.slice(comma[0].index + 1, top[from].index),
  ];
  const parsed = projections.map(tokens => {
    const hasAlias = tokens[tokens.length - 2]?.toLowerCase() === 'as';
    const expression = hasAlias ? tokens.slice(0, -2) : tokens;
    const column = identifier(expression);
    const alias = hasAlias ? identifier(tokens.slice(-1)) : column;
    return { expression, column, alias };
  });
  if (
    parsed.some(projection => !projection.alias) ||
    new Set(parsed.map(projection => projection.alias.toLowerCase())).size !== parsed.length
  )
    return undefined;
  const matches = parsed.filter(projection => projection.alias === categoryField);
  if (matches.length !== 1 || !matches[0].column) return undefined;
  const category = matches[0];
  const other = parsed.find(projection => projection !== category);
  if (
    !other?.alias ||
    other.column ||
    !other.expression.some(
      (word, index) =>
        /^(sum|count|avg|min|max|count_if)$/i.test(word) && other.expression[index + 1] === '(',
    )
  )
    return undefined;
  const groupEnd = order >= 0 ? top[order].index : limit >= 0 ? top[limit].index : words.length;
  const groupedColumn = identifier(words.slice(top[group + 1].index + 1, groupEnd));
  if (!groupedColumn || groupedColumn.toLowerCase() !== category.column.toLowerCase())
    return undefined;
  if (order >= 0) {
    const orderTokens = words.slice(
      top[order + 1].index + 1,
      limit >= 0 ? top[limit].index : words.length,
    );
    if (/^(asc|desc)$/i.test(orderTokens[orderTokens.length - 1])) orderTokens.pop();
    const orderColumn = identifier(orderTokens);
    if (
      !orderColumn ||
      ![category.alias, other.alias, category.column].some(
        name => name.toLowerCase() === orderColumn.toLowerCase(),
      )
    )
      return undefined;
  }
  const known = columns.filter(column => column.toLowerCase() === category.column.toLowerCase());
  return known.length === 1 &&
    !temporalColumns.some(column => column.toLowerCase() === known[0].toLowerCase())
    ? known[0]
    : undefined;
}
