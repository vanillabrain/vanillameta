import { BadRequestException } from '@nestjs/common';
import { dateRangeBounds, isoSecond, validateDateRange } from './dashboard-date-range';

export const DASHBOARD_TYPES = ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'];
export interface DashboardDraft {
  databaseId: number;
  title: string;
  explanation: string;
  layoutSizes?: Array<{ width: 6 | 12; height: 3 | 5 | 7 }>;
  widgets: Array<{
    title: string;
    description: string;
    type: string;
    sql: string;
    valueField: string;
    categoryField?: string;
    decimalPlaces?: number;
    prefix?: string;
    suffix?: string;
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
    const groupingKeyword = /^(select|where|and|or|not|when|then|else|having|by)$/;
    if (
      words[i + 1] === '(' &&
      /^[a-z_"']/i.test(words[i]) &&
      !functions.has(normalized[i]) &&
      !groupingKeyword.test(normalized[i])
    ) {
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
  if (
    input.layoutSizes !== undefined &&
    (!Array.isArray(input.layoutSizes) ||
      input.layoutSizes.length !== input.widgets.length ||
      input.layoutSizes.some(
        s => !s || ![6, 12].includes(s.width) || ![3, 5, 7].includes(s.height),
      ))
  )
    throw new BadRequestException('invalid layout sizes');
  return {
    databaseId: positiveId(input.databaseId),
    title: text(input.title, 300),
    explanation: text(input.explanation, 4000, true),
    ...(input.layoutSizes !== undefined
      ? { layoutSizes: input.layoutSizes.map(s => ({ width: s.width, height: s.height })) }
      : {}),
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
        ...(w.suffix !== undefined ? { suffix: text(w.suffix, 100, true) } : {}),
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
  // A filter is either a member list or one inclusive raw-value range; both are the request contract.
  const rangeCondition = (column: string, range: any) => {
    if (!range || typeof range !== 'object' || Array.isArray(range))
      throw new BadRequestException('invalid filter range');
    const keys = Object.keys(range);
    if (!keys.length || keys.some(key => key !== 'min' && key !== 'max'))
      throw new BadRequestException('invalid filter range');
    const { min, max } = range;
    if (
      (min !== undefined && !Number.isFinite(min)) ||
      (max !== undefined && !Number.isFinite(max)) ||
      (min === undefined && max === undefined) ||
      (min !== undefined && max !== undefined && min > max)
    )
      throw new BadRequestException('invalid filter range');
    const clauses: string[] = [];
    if (min !== undefined) {
      clauses.push(`${quoteColumn(column)} >= ?`);
      bindings.push(min);
    }
    if (max !== undefined) {
      clauses.push(`${quoteColumn(column)} <= ?`);
      bindings.push(max);
    }
    return `(${clauses.join(' AND ')})`;
  };
  const conditions = filters.map(f => {
    if (!f || typeof f !== 'object' || Array.isArray(f))
      throw new BadRequestException('invalid filter');
    if (!columns.includes(f.column) || seen.has(f.column))
      throw new BadRequestException('invalid filter column');
    seen.add(f.column);
    if (Object.keys(f).some(key => !['column', 'values', 'value', 'range'].includes(key)))
      throw new BadRequestException('unsupported filter field');
    if (['values', 'value', 'range'].filter(key => key in f).length !== 1)
      throw new BadRequestException('ambiguous filter');
    if ('range' in f) return rangeCondition(f.column, f.range);
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
    const range = validateDateRange(dateRange);
    const { column } = range;
    if (!columns.includes(column) || !temporalColumns.includes(column))
      throw new BadRequestException('invalid UTC date range');
    const { start, end } = dateRangeBounds(range);
    const instantCondition = `CAST(${quoteColumn(
      column,
    )} AS TIMESTAMPTZ) >= CAST(? AS TIMESTAMPTZ) AND CAST(${quoteColumn(
      column,
    )} AS TIMESTAMPTZ) < CAST(? AS TIMESTAMPTZ)`;
    if (range.timeZone && range.timeZone !== 'UTC' && !range.precision) {
      // DATE is already a civil date; TIMESTAMP without zone keeps the source's UTC convention.
      conditions.push(`CASE WHEN typeof(${quoteColumn(column)}) = 'DATE' THEN
        CAST(${quoteColumn(column)} AS DATE) >= CAST(? AS DATE) AND
        CAST(${quoteColumn(column)} AS DATE) <= CAST(? AS DATE)
        ELSE ${instantCondition} END`);
      bindings.push(range.start, range.end);
    } else conditions.push(instantCondition);
    bindings.push(isoSecond(start), isoSecond(end));
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
        suffix: w.suffix || '',
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
