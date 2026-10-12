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
      return {
        title: text(w.title, 300),
        description: text(w.description, 1000, true),
        type: w.type,
        sql: validateSourceSql(w.sql),
        valueField: text(w.valueField, 255),
        ...(w.categoryField !== undefined ? { categoryField: text(w.categoryField, 255) } : {}),
        ...(w.decimalPlaces !== undefined ? { decimalPlaces: w.decimalPlaces } : {}),
        ...(w.prefix !== undefined ? { prefix: text(w.prefix, 100, true) } : {}),
      };
    }),
  };
}
export const quoteColumn = (column: string) => `"${column.replace(/"/g, '""')}"`;
export function sourceQuery(sql: string, columns: string[], filters: any[] = []) {
  validateSourceSql(sql);
  if (!Array.isArray(filters) || filters.length > 5)
    throw new BadRequestException('maximum 5 filters');
  const bindings: any[] = [];
  const conditions = filters.map(f => {
    if (
      !f ||
      !columns.includes(f.column) ||
      !(['string', 'number', 'boolean'].includes(typeof f.value) || f.value === null) ||
      (typeof f.value === 'number' && !Number.isFinite(f.value)) ||
      (typeof f.value === 'string' && f.value.length > 2000)
    ) {
      throw new BadRequestException('invalid filter');
    }
    if (f.value === null) return `${quoteColumn(f.column)} IS NULL`;
    bindings.push(f.value);
    return `${quoteColumn(f.column)} = ?`;
  });
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
      },
    };
  return {
    [w.type === 'CHART_COLUMN' ? 'yField' : 'xField']: w.categoryField,
    series: [
      { field: w.valueField, fieldLabel: w.valueField, aggregation: 'sum', color: '#2563eb' },
    ],
    label: false,
    mark: false,
    legendPosition: 'none',
  };
}
