import { BadRequestException } from '@nestjs/common';
import { DATE_FORMATS } from './business-variable';

export type ConditionSemantics = {
  schemaVersion: 1;
  catalogVersion: number;
  columns: Array<{
    column: string;
    businessType: 'number' | 'category' | 'date';
    dateFormat: '' | 'native' | keyof typeof DATE_FORMATS;
  }>;
};
export type NativeConditionKind =
  | 'number'
  | 'string'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'unsupported';
export type BusinessConditionColumn = {
  name: string;
  /** Always the actual native type; a business declaration never replaces it. */
  type: string;
  kind: NativeConditionKind;
  businessType?: ConditionSemantics['columns'][number]['businessType'];
  dateFormat?: ConditionSemantics['columns'][number]['dateFormat'];
};
function invalid(): never {
  throw new BadRequestException('Invalid condition semantics');
}
function record(value: unknown, fields: string[]): Record<string, any> {
  if (
    !value ||
    typeof value !== 'object' ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    invalid();
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== fields.length ||
    keys.some(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        typeof key !== 'string' ||
        !fields.includes(key) ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      );
    })
  )
    invalid();
  return value as Record<string, any>;
}
const identity = (name: string) => name.replace(/[A-Z]/g, letter => letter.toLowerCase());

/** Structural only. Source/catalog authority must be verified by the owning resolver. */
export function validateConditionSemantics(input: unknown): ConditionSemantics {
  try {
    const root = record(input, ['schemaVersion', 'catalogVersion', 'columns']);
    if (
      root.schemaVersion !== 1 ||
      !Number.isSafeInteger(root.catalogVersion) ||
      root.catalogVersion <= 0 ||
      !Array.isArray(root.columns) ||
      Object.getPrototypeOf(root.columns) !== Array.prototype ||
      root.columns.length > 128 ||
      Reflect.ownKeys(root.columns).length !== root.columns.length + 1
    )
      invalid();
    const names = new Set<string>();
    const columns: ConditionSemantics['columns'] = [];
    for (let index = 0; index < root.columns.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(root.columns, String(index));
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) invalid();
      const declaration = record(descriptor.value, ['column', 'businessType', 'dateFormat']);
      if (
        typeof declaration.column !== 'string' ||
        !declaration.column ||
        declaration.column.includes('\0') ||
        !['number', 'category', 'date'].includes(declaration.businessType) ||
        typeof declaration.dateFormat !== 'string' ||
        !['', 'native', ...Object.keys(DATE_FORMATS)].includes(declaration.dateFormat) ||
        (declaration.businessType === 'date') !== (declaration.dateFormat !== '')
      )
        invalid();
      const name = identity(declaration.column);
      if (names.has(name)) invalid();
      names.add(name);
      columns.push({
        column: declaration.column,
        businessType: declaration.businessType,
        dateFormat: declaration.dateFormat as ConditionSemantics['columns'][number]['dateFormat'],
      });
    }
    if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 32 * 1024) invalid();
    columns.sort((a, b) => (a.column < b.column ? -1 : a.column > b.column ? 1 : 0));
    return { schemaVersion: 1, catalogVersion: root.catalogVersion, columns };
  } catch {
    return invalid();
  }
}

/** Native classification stays identical for legacy snapshots without semantics. */
export function nativeConditionKind(type: string): NativeConditionKind {
  const native = type.trim().toUpperCase();
  if (
    /^(?:U?(?:TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT)|FLOAT|DOUBLE|REAL|INT|INT[1248]|SIGNED|UNSIGNED|BIGNUM)$/.test(
      native,
    )
  )
    return 'number';
  const decimal = /^(?:DECIMAL|NUMERIC)\((\d{1,2}),\s*(\d{1,2})\)$/.exec(native);
  if (decimal && +decimal[1] >= 1 && +decimal[1] <= 38 && +decimal[2] <= +decimal[1])
    return 'number';
  if (/^(?:VARCHAR|CHAR|TEXT|STRING|BPCHAR)$/.test(native)) return 'string';
  if (native === 'BOOLEAN' || native === 'BOOL') return 'boolean';
  if (native === 'DATE') return 'date';
  if (/^(?:TIMESTAMP(?:_S|_MS|_NS)?|TIMESTAMPTZ|TIMESTAMP WITH TIME ZONE)$/.test(native))
    return 'timestamp';
  return 'unsupported';
}

export function projectConditionColumns(
  schema: Array<{ name: string; type: string }>,
  semantics?: ConditionSemantics,
): BusinessConditionColumn[] {
  try {
    const normalized = semantics === undefined ? undefined : validateConditionSemantics(semantics);
    if (!Array.isArray(schema)) invalid();
    const names = new Set<string>();
    const result = schema.map(column => {
      if (
        !column ||
        typeof column.name !== 'string' ||
        !column.name ||
        column.name.includes('\0') ||
        typeof column.type !== 'string'
      )
        invalid();
      const name = identity(column.name);
      if (names.has(name)) invalid();
      names.add(name);
      const nativeKind = nativeConditionKind(column.type);
      const nativeCategoryText = /^(?:UUID|ENUM\s*\()/i.test(column.type.trim());
      const declaration = normalized?.columns.find(item => item.column === column.name);
      if (!declaration) return { name: column.name, type: column.type, kind: nativeKind };
      const kind =
        declaration.businessType === 'category' && nativeCategoryText
          ? ('string' as const)
          : nativeKind;
      if (
        (declaration.businessType === 'number' && kind !== 'number') ||
        (declaration.businessType === 'category' && kind === 'unsupported') ||
        (declaration.businessType === 'date' &&
          !(
            (['date', 'timestamp'].includes(kind) && declaration.dateFormat === 'native') ||
            (/^VARCHAR$/i.test(column.type.trim()) &&
              Object.prototype.hasOwnProperty.call(DATE_FORMATS, declaration.dateFormat))
          ))
      )
        invalid();
      return {
        name: column.name,
        type: column.type,
        kind: declaration.businessType === 'date' ? ('date' as const) : kind,
        businessType: declaration.businessType,
        dateFormat: declaration.dateFormat,
      };
    });
    if (
      normalized?.columns.some(
        declaration => !schema.some(column => column.name === declaration.column),
      )
    )
      invalid();
    return result;
  } catch {
    return invalid();
  }
}

/** Only fixed server formats enter SQL. Invalid/blank values raise; only native NULL stays NULL. */
export function conditionDateExpression(column: BusinessConditionColumn): string {
  const quoted = `"${column.name.replace(/"/g, '""')}"`;
  if (column.businessType === 'category' && /^(?:UUID|ENUM\s*\()/i.test(column.type.trim()))
    return `CAST(${quoted} AS VARCHAR)`;
  if (column.businessType !== 'date') return quoted;
  if (column.dateFormat === 'native') {
    return /^(?:TIMESTAMPTZ|TIMESTAMP WITH TIME ZONE)$/i.test(column.type.trim())
      ? `CAST((${quoted} AT TIME ZONE 'UTC') AS DATE)`
      : `CAST(${quoted} AS DATE)`;
  }
  if (!Object.prototype.hasOwnProperty.call(DATE_FORMATS, column.dateFormat)) invalid();
  const format = DATE_FORMATS[column.dateFormat];
  const pattern =
    column.dateFormat === 'YYYYMMDD'
      ? '[0-9]{8}'
      : column.dateFormat === 'YYYY/MM/DD'
      ? '[0-9]{4}/[0-9]{2}/[0-9]{2}'
      : '[0-9]{4}-[0-9]{2}-[0-9]{2}';
  const parsed = `CAST(try_strptime(${quoted}, '${format}') AS DATE)`;
  return `(CASE WHEN ${quoted} IS NULL THEN NULL WHEN regexp_full_match(${quoted}, '${pattern}') AND substr(${quoted}, 1, 4) <> '0000' AND strftime(${parsed}, '${format}') = ${quoted} THEN ${parsed} ELSE error('Invalid business date') END)`;
}
