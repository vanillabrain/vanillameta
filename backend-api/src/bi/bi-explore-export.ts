import { BadRequestException } from '@nestjs/common';

/** Caps are checked on the finished serialization, so a caller never receives a partial file. */
export const EXPORT_LIMITS = { rows: 10000, bytes: 2097152 };
export const EXPORT_MIME = 'text/csv;charset=utf-8';
/** One tidy shape for every section: an axis cell is a JSON object of the named dimensions. */
export const EXPORT_COLUMNS = [
  'section',
  'row_axis',
  'column_axis',
  'measure_id',
  'measure_label',
  'value',
  'value_type',
  'previous_value',
  'delta',
  'percent_change',
  'unavailable',
];

export type ExportAxis = Record<string, unknown> | null;
export type ExportScalar = number | string | null | undefined;
export type ExportValueType = 'null' | 'number' | 'string';

export type ExportEntry = {
  section: string;
  rowAxis: ExportAxis;
  columnAxis: ExportAxis;
  measureId: number | null;
  measureLabel: string | null;
  value: ExportScalar;
  previousValue?: ExportScalar;
  delta?: ExportScalar;
  percentChange?: ExportScalar;
  unavailable?: string | null;
};

/** Text that opens with a spreadsheet formula trigger after optional padding is neutralized. */
const FORMULA_TRIGGER = /^[\u0000-\u0020]*[=+\-@\t\r]/;
/** Numeric text (integer, decimal or exponent) is a magnitude a consumer reads literally. */
const NUMERIC_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

const guard = (text: string) => (FORMULA_TRIGGER.test(text) ? `'${text}` : text);
/** Quote every field and double embedded quotes; CRLF-delimited rows keep newlines inside quotes. */
const field = (text: string) => `"${text.replace(/"/g, '""')}"`;

/** null stays blank while value_type keeps 0 apart from NULL; large integer text stays exact. */
const scalar = (value: ExportScalar): { text: string; type: ExportValueType } => {
  if (value === null || value === undefined) return { text: '', type: 'null' };
  if (typeof value === 'number')
    return Number.isFinite(value)
      ? { text: String(value), type: 'number' }
      : { text: '', type: 'null' };
  return { text: String(value), type: 'string' };
};

/** Labels, sections, messages and axis JSON are text, so a formula trigger is always neutralized. */
const text = (value: ExportScalar) => {
  const cell = scalar(value);
  return cell.type === 'null' ? '' : field(guard(cell.text));
};

/** Numbers and numeric strings keep their exact magnitude, so a negative sign stays numeric. */
const numeric = (value: ExportScalar) => {
  const cell = scalar(value);
  if (cell.type === 'null') return '';
  if (cell.type === 'number') return field(cell.text);
  return field(NUMERIC_TEXT.test(cell.text) ? cell.text : guard(cell.text));
};

const axis = (value: ExportAxis) => (value === null ? '' : field(guard(JSON.stringify(value))));

/** Canonical JSON of one applied request field, kept as text so a consumer can parse it back. */
const condition = ([key, value]: [string, unknown]): ExportEntry => ({
  section: 'condition',
  rowAxis: { field: key },
  columnAxis: null,
  measureId: null,
  measureLabel: null,
  value: JSON.stringify(value === undefined ? null : value),
});

const line = (entry: ExportEntry) => {
  const value = scalar(entry.value);
  return [
    field(entry.section),
    axis(entry.rowAxis),
    axis(entry.columnAxis),
    entry.measureId === null ? '' : field(String(entry.measureId)),
    text(entry.measureLabel),
    numeric(entry.value),
    value.type,
    numeric(entry.previousValue),
    numeric(entry.delta),
    numeric(entry.percentChange),
    text(entry.unavailable),
  ].join(',');
};

/**
 * Tidy CSV with a UTF-8 BOM and CRLF rows. Applied conditions, when present, are emitted first so
 * the exported numbers always carry the request that produced them; both caps count those rows.
 */
export function toCsv(entries: ExportEntry[], conditions?: Record<string, unknown>) {
  const rows = [
    ...(conditions ? Object.entries(conditions).map(pair => condition(pair)) : []),
    ...entries,
  ];
  if (rows.length > EXPORT_LIMITS.rows)
    throw new BadRequestException(
      `내보낼 행이 ${EXPORT_LIMITS.rows}개를 넘습니다. 필터를 좁히거나 축을 줄여 주세요.`,
    );
  const header = EXPORT_COLUMNS.map(column => field(column)).join(',');
  const csv = '\uFEFF' + [header, ...rows.map(line)].join('\r\n') + '\r\n';
  const bytes = Buffer.byteLength(csv, 'utf8');
  if (bytes > EXPORT_LIMITS.bytes)
    throw new BadRequestException(
      `내보낼 파일이 ${EXPORT_LIMITS.bytes}바이트를 넘습니다. 필터를 좁히거나 기간을 줄여 주세요.`,
    );
  return { csv, rowCount: rows.length, bytes };
}
