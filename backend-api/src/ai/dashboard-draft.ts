import {
  BusinessBasis,
  businessDimensionExpression,
  maskBusinessDateExpressions,
  normalizeBusinessBasis,
} from '../bi/semantic-business-basis';
import type { ConditionSemantics } from '../bi/business-condition-semantics';
import { BadRequestException } from '@nestjs/common';
import { compileConditionDefinition, conditionColumns } from '../bi/source-condition-definition';
import { dateRangeBounds, isoSecond, validateDateRange } from './dashboard-date-range';

export const DASHBOARD_TYPES = ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'];
export interface DashboardDraft {
  databaseId: number;
  businessBasis?: BusinessBasis;
  title: string;
  explanation: string;
  layoutSizes?: Array<{ width: 6 | 12; height: 3 | 5 | 7 }>;
  widgets: Array<{
    blockId?: string;
    defaultDateColumn?: string | null;
    businessBasis?: BusinessBasis;
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
    timeGrain?: 'auto' | 'day' | 'week' | 'month';
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
export function validateSourceSql(sql: string, businessBasis?: BusinessBasis): string {
  text(sql, 10000);
  const original = sql;
  sql = maskBusinessDateExpressions(sql, businessBasis);
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
  return original.trim();
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
  const ids = input.widgets.map(w => w?.blockId).filter(id => id !== undefined);
  if (
    ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) ||
    new Set(ids).size !== ids.length
  )
    throw new BadRequestException('invalid block identity');
  if (
    input.layoutSizes !== undefined &&
    (!Array.isArray(input.layoutSizes) ||
      input.layoutSizes.length !== input.widgets.length ||
      input.layoutSizes.some(
        s => !s || ![6, 12].includes(s.width) || ![3, 5, 7].includes(s.height),
      ))
  )
    throw new BadRequestException('invalid layout sizes');
  const businessBasis =
    input.businessBasis === undefined ? undefined : normalizeBusinessBasis(input.businessBasis);
  return {
    ...(businessBasis ? { businessBasis } : {}),
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
      if (
        w.timeGrain !== undefined &&
        (w.type !== 'CHART_LINE' || !['auto', 'day', 'week', 'month'].includes(w.timeGrain))
      )
        throw new BadRequestException('invalid timeGrain');
      if (
        w.defaultDateColumn !== undefined &&
        (w.type !== 'BOARD_NUMERIC' ||
          w.businessBasis === undefined ||
          (w.defaultDateColumn !== null &&
            (typeof w.defaultDateColumn !== 'string' ||
              !w.defaultDateColumn.length ||
              w.defaultDateColumn.length > 255)))
      )
        throw new BadRequestException('invalid frozen default date column');
      return {
        ...(w.defaultDateColumn !== undefined ? { defaultDateColumn: w.defaultDateColumn } : {}),
        ...(w.timeGrain !== undefined ? { timeGrain: w.timeGrain } : {}),
        ...(w.blockId !== undefined ? { blockId: w.blockId } : {}),
        title: text(w.title, 300),
        description: text(w.description, 1000, true),
        type: w.type,
        ...(w.businessBasis !== undefined
          ? { businessBasis: normalizeBusinessBasis(w.businessBasis) }
          : {}),
        sql: validateSourceSql(
          w.sql,
          w.businessBasis === undefined ? businessBasis : normalizeBusinessBasis(w.businessBasis),
        ),
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
export type SourceFilter =
  | { column: string; values: Array<string | number | boolean | null> }
  | { column: string; range: { min?: number; max?: number } };

/** Schema-independent shape validation; sourceQuery separately authorizes columns and types. */
export function normalizeSourceFilters(filters: any[] = [], allowLegacy = true): SourceFilter[] {
  if (!Array.isArray(filters) || filters.length > 5)
    throw new BadRequestException('maximum 5 filters');
  const seen = new Set<string>();
  return filters.map(f => {
    if (
      !f ||
      typeof f !== 'object' ||
      Array.isArray(f) ||
      typeof f.column !== 'string' ||
      !f.column.trim() ||
      f.column.length > 128 ||
      seen.has(f.column)
    )
      throw new BadRequestException('invalid filter column');
    seen.add(f.column);
    const forms = ['values', 'range', ...(allowLegacy ? ['value'] : [])];
    if (
      Object.keys(f).some(key => !['column', ...forms].includes(key)) ||
      forms.filter(key => Object.prototype.hasOwnProperty.call(f, key)).length !== 1
    )
      throw new BadRequestException('ambiguous or unsupported filter');
    if ('range' in f) {
      const range = f.range;
      if (
        !range ||
        typeof range !== 'object' ||
        Array.isArray(range) ||
        !Object.keys(range).length ||
        Object.keys(range).some(key => !['min', 'max'].includes(key)) ||
        Object.values(range).some(
          value =>
            typeof value !== 'number' ||
            !Number.isFinite(value) ||
            Math.abs(value) > Number.MAX_SAFE_INTEGER,
        ) ||
        ('min' in range && 'max' in range && range.min > range.max)
      )
        throw new BadRequestException('invalid filter range');
      return { column: f.column, range: { ...range } };
    }
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
    return { column: f.column, values: [...new Set(values)] };
  });
}

/** Only scalar numeric DESCRIBE types can authorize range predicates. */
export function numericSourceColumns(schema: Array<{ column_name: string; column_type: string }>) {
  return schema
    .filter(c =>
      /^(?:U?(?:BIGINT|INTEGER|SMALLINT|TINYINT|HUGEINT)|FLOAT|DOUBLE|DECIMAL(?:\(\d+,\s*\d+\))?)$/i.test(
        c.column_type,
      ),
    )
    .map(c => c.column_name);
}
export function sourceQuery(
  sql: string,
  columns: string[],
  filters: any[] = [],
  dateRange?: any,
  temporalColumns: string[] = [],
  numericColumns: string[] = [],
  conditionsDefinition?: unknown,
  schema?: Array<{ name: string; type: string }>,
  conditionSemantics?: ConditionSemantics,
  businessBasis?: BusinessBasis,
  rangeBusinessBasis?: BusinessBasis,
) {
  validateSourceSql(sql, businessBasis);
  const rangeBasis = rangeBusinessBasis ?? businessBasis;
  const scopedColumn = (column: string) =>
    rangeBasis?.columns.find(c => c.column === column)?.businessType === 'date'
      ? businessDimensionExpression({ columns: schema ?? [] }, rangeBasis, column)
      : quoteColumn(column);
  const bindings: any[] = [];
  const conditions = normalizeSourceFilters(filters).map(f => {
    if (!columns.includes(f.column)) throw new BadRequestException('invalid filter column');
    if ('range' in f) {
      if (
        !numericColumns.includes(f.column) ||
        ['category', 'date'].includes(
          rangeBasis?.columns.find(c => c.column === f.column)?.businessType,
        )
      )
        throw new BadRequestException(
          '숫자 열에만 범위 필터를 적용할 수 있습니다. (numeric source column required)',
        );
      const clauses = [];
      for (const key of ['min', 'max'] as const) {
        if (f.range[key] !== undefined) {
          bindings.push(f.range[key]);
          clauses.push(`${quoteColumn(f.column)} ${key === 'min' ? '>=' : '<='} ?`);
        }
      }
      // SQL comparisons naturally exclude NULL, including one-sided ranges.
      return `(${clauses.join(' AND ')})`;
    }
    const unique = f.values;
    if (
      rangeBasis?.columns.find(c => c.column === f.column)?.businessType === 'date' &&
      unique.some(
        value =>
          value !== null &&
          (typeof value !== 'string' ||
            !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ||
            value.startsWith('0000') ||
            !Number.isFinite(Date.parse(value + 'T00:00:00Z')) ||
            new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value),
      )
    )
      throw new BadRequestException('업무 날짜 필터는 유효한 ISO 날짜를 사용해 주세요.');
    const nonNull = unique.filter(value => value !== null);
    const clauses = [];
    if (nonNull.length) {
      bindings.push(...nonNull);
      clauses.push(`${scopedColumn(f.column)} IN (${nonNull.map(() => '?').join(', ')})`);
    }
    if (unique.includes(null)) clauses.push(`${scopedColumn(f.column)} IS NULL`);
    return `(${clauses.join(' OR ')})`;
  });
  if (dateRange !== undefined) {
    const range = validateDateRange(dateRange);
    const { column } = range;
    if (
      !columns.includes(column) ||
      rangeBasis?.columns.find(c => c.column === column)?.businessType === 'category' ||
      (!temporalColumns.includes(column) &&
        rangeBasis?.columns.find(c => c.column === column)?.businessType !== 'date')
    )
      throw new BadRequestException('invalid UTC date range');
    const { start, end } = dateRangeBounds(range);
    const instantCondition = `CAST(${scopedColumn(
      column,
    )} AS TIMESTAMPTZ) >= CAST(? AS TIMESTAMPTZ) AND CAST(${scopedColumn(
      column,
    )} AS TIMESTAMPTZ) < CAST(? AS TIMESTAMPTZ)`;
    if (range.timeZone && range.timeZone !== 'UTC' && !range.precision) {
      // DATE is already a civil date; TIMESTAMP without zone keeps the source's UTC convention.
      conditions.push(`CASE WHEN typeof(${scopedColumn(column)}) = 'DATE' THEN
        CAST(${scopedColumn(column)} AS DATE) >= CAST(? AS DATE) AND
        CAST(${scopedColumn(column)} AS DATE) <= CAST(? AS DATE)
        ELSE ${instantCondition} END`);
      bindings.push(range.start, range.end);
    } else conditions.push(instantCondition);
    bindings.push(isoSecond(start), isoSecond(end));
  }
  if (conditionsDefinition !== undefined) {
    if (!schema) throw new BadRequestException('condition schema required');
    const compiled = compileConditionDefinition(
      conditionsDefinition,
      conditionColumns(schema, conditionSemantics),
      conditionSemantics,
    );
    conditions.push(`(${compiled.includeSql}) AND NOT (${compiled.excludeSql})`);
    bindings.push(...compiled.bindings);
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
