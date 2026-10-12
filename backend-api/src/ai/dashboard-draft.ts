import { BadRequestException } from '@nestjs/common';

export const DASHBOARD_TYPES = ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'];
export interface DashboardDraft {
  databaseId: number;
  title: string;
  explanation: string;
  widgets: Array<{
    title: string;
    description: string;
    type: string;
    sql: string;
    valueField: string;
    categoryField?: string;
    decimalPlaces?: number;
    prefix?: string;
    numberNotation?: 'full' | 'compact';
  }>;
}
export function positiveId(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0)
    throw new BadRequestException('invalid id');
  return Number(value);
}
function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) {
    throw new BadRequestException('invalid draft text');
  }
  return value;
}

/** Deliberately small SELECT grammar: one source relation, no CTEs/subqueries or arbitrary functions. */
export function validateSourceSql(sql: string): string {
  text(sql, 10000);
  const tokens =
    sql.match(
      /'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|\s+|[(),.*+\-\/%=<>!:]/g,
    ) || [];
  if (tokens.join('') !== sql || /--|\/\*|\*\//.test(sql))
    throw new BadRequestException('invalid SQL tokens');
  const words = tokens.filter(t => !/^\s+$/.test(t));
  const normalized = words.map(t => (t.startsWith("'") ? "''" : t.toLowerCase()));
  const banned =
    /^(with|insert|update|delete|drop|alter|truncate|create|replace|merge|attach|detach|copy|pragma|call|execute|into|join|union|intersect|except|uploaded_data|pivot|unpivot|sample|tablesample)$/;
  if (
    normalized[0] !== 'select' ||
    normalized.filter(t => t === 'select').length !== 1 ||
    normalized.some(t => banned.test(t))
  ) {
    throw new BadRequestException('only SELECT from source is allowed');
  }
  const from = normalized.indexOf('from');
  if (
    from < 0 ||
    normalized.filter(t => t === 'from').length !== 1 ||
    normalized[from + 1] !== 'source'
  ) {
    throw new BadRequestException('only source relation is allowed');
  }
  // No aliases or additional relations after FROM; qualified source.column remains valid in expressions.
  if (
    from + 2 < words.length &&
    !/^(where|group|having|order|limit|offset)$/.test(normalized[from + 2])
  ) {
    throw new BadRequestException('invalid source relation');
  }
  const functions = new Set([
    'sum',
    'count',
    'avg',
    'min',
    'max',
    'round',
    'coalesce',
    'nullif',
    'cast',
    'try_cast',
    'date_trunc',
    'strftime',
    'extract',
    'abs',
    'floor',
    'ceil',
    'lower',
    'upper',
    'trim',
    'length',
    'count_if',
    'if',
    'in',
    'over',
  ]);
  for (let i = 0; i < normalized.length - 1; i++) {
    if (words[i + 1] === '(' && /^[a-z_"']/i.test(words[i]) && !functions.has(normalized[i])) {
      throw new BadRequestException('unsupported SQL function');
    }
  }
  return sql.trim();
}
export function validateDraft(input: any): DashboardDraft {
  if (
    !input ||
    !Array.isArray(input.widgets) ||
    input.widgets.length < 1 ||
    input.widgets.length > 6
  ) {
    throw new BadRequestException('draft requires 1 to 6 widgets');
  }
  return {
    databaseId: positiveId(input.databaseId),
    title: text(input.title, 300),
    explanation: text(input.explanation, 4000, true),
    widgets: input.widgets.map((w: any) => {
      if (!w || !DASHBOARD_TYPES.includes(w.type))
        throw new BadRequestException('invalid widget type');
      if (
        w.decimalPlaces !== undefined &&
        (!Number.isInteger(w.decimalPlaces) || w.decimalPlaces < 0 || w.decimalPlaces > 6)
      )
        throw new BadRequestException('invalid decimalPlaces');
      if (w.numberNotation !== undefined && !['full', 'compact'].includes(w.numberNotation))
        throw new BadRequestException('invalid numberNotation');
      return {
        title: text(w.title, 300),
        description: text(w.description, 1000, true),
        type: w.type,
        sql: validateSourceSql(w.sql),
        valueField: text(w.valueField, 255),
        ...(w.categoryField !== undefined ? { categoryField: text(w.categoryField, 255) } : {}),
        ...(w.decimalPlaces !== undefined ? { decimalPlaces: w.decimalPlaces } : {}),
        ...(w.numberNotation !== undefined ? { numberNotation: w.numberNotation } : {}),
        ...(w.prefix !== undefined ? { prefix: text(w.prefix, 100, true) } : {}),
      };
    }),
  };
}
export const quoteColumn = (column: string) => `"${column.replace(/"/g, '""')}"`;
export function sourceQuery(
  sql: string,
  columns: string[],
  filters: any[] = [],
  dateRange?: any,
  temporalColumns: string[] = [],
) {
  validateSourceSql(sql);
  if (!Array.isArray(filters) || filters.length > 5)
    throw new BadRequestException('maximum 5 filters');
  const bindings: any[] = [];
  const seen = new Set<string>();
  const conditions = filters.map(f => {
    if (!f || !columns.includes(f.column) || seen.has(f.column))
      throw new BadRequestException('invalid filter column');
    seen.add(f.column);
    if ('values' in f && 'value' in f) throw new BadRequestException('ambiguous filter');
    const values = 'values' in f ? f.values : [f.value];
    if (
      !Array.isArray(values) ||
      !values.length ||
      values.length > 50 ||
      values.some(
        value =>
          !(['string', 'number', 'boolean'].includes(typeof value) || value === null) ||
          (typeof value === 'number' && !Number.isFinite(value)) ||
          (typeof value === 'string' && value.length > 2000),
      )
    )
      throw new BadRequestException('invalid filter values');
    const unique = [...new Set(values)];
    const nonNull = unique.filter(value => value !== null);
    const clauses = [];
    if (nonNull.length) {
      bindings.push(...nonNull);
      clauses.push(`${quoteColumn(f.column)} IN (${nonNull.map(() => '?').join(', ')})`);
    }
    if (unique.includes(null)) clauses.push(`${quoteColumn(f.column)} IS NULL`);
    return `(${clauses.join(' OR ')})`;
  });
  if (dateRange !== undefined) {
    const { column, start, end } = dateRange || {};
    const validDay = value =>
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (
      !columns.includes(column) ||
      !temporalColumns.includes(column) ||
      !validDay(start) ||
      !validDay(end) ||
      start > end ||
      end === '9999-12-31'
    )
      throw new BadRequestException('invalid UTC date range');
    const nextDay = new Date(new Date(`${end}T00:00:00Z`).getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    conditions.push(
      `CAST(${quoteColumn(column)} AS TIMESTAMPTZ) >= CAST(? AS TIMESTAMPTZ) AND CAST(${quoteColumn(
        column,
      )} AS TIMESTAMPTZ) < CAST(? AS TIMESTAMPTZ)`,
    );
    bindings.push(`${start}T00:00:00Z`, `${nextDay}T00:00:00Z`);
  }
  return {
    sql: `WITH source AS (SELECT * FROM uploaded_data${
      conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
    }) ${sql}`,
    bindings,
  };
}
export function widgetOptions(w: DashboardDraft['widgets'][number]) {
  if (w.type === 'BOARD_NUMERIC')
    return {
      header: { title: w.valueField, fontSize: 13, color: '#586579' },
      content: {
        field: w.valueField,
        aggregation: 'sum',
        fontSize: 42,
        color: '#14243c',
        prefix: w.prefix || '',
        suffix: '',
        numForm: true,
        decimalPlaces: w.decimalPlaces ?? 0,
        ...(w.numberNotation !== undefined ? { numberNotation: w.numberNotation } : {}),
      },
    };
  return {
    [w.type === 'CHART_COLUMN' ? 'yField' : 'xField']: w.categoryField,
    series: [
      { field: w.valueField, fieldLabel: w.valueField, aggregation: 'sum', color: '#2563eb' },
    ],
    ...(w.numberNotation !== undefined ? { numberNotation: w.numberNotation } : {}),
    label: false,
    mark: false,
    legendPosition: 'none',
  };
}
