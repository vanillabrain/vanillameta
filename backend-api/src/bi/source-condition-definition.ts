import { BadRequestException } from '@nestjs/common';
// Keep the compiler independent from dashboard-draft (which consumes it).
const quoteColumn = (column: string) => `"${column.replace(/"/g, '""')}"`;

export type ConditionSchemaColumn = {
  name: string;
  /** Native DuckDB type. Timestamp boundaries are UTC Z: TIMESTAMP_NS supports 9
   * fractional digits, executed as epoch ns in the inclusive supported interval
   * [-9223372036854775806, 9223372036854775806]. Other timestamp types support 6
   * fractional digits after trimming trailing zeros.
   * DECIMAL thresholds require an exact common scale within DuckDB's 38 digits.
   * BIGNUM thresholds must be safe JS integers. */
  type: string;
  kind: 'number' | 'string' | 'boolean' | 'date' | 'timestamp' | 'unsupported';
};
type ConditionOperator =
  | 'eq'
  | 'ne'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'isNull'
  | 'isNotNull';
export type ConditionNode =
  | { kind: 'group'; operator: 'and' | 'or'; children: ConditionNode[] }
  | {
      kind: 'predicate';
      column: string;
      operator: ConditionOperator;
      values?: (string | number | boolean)[];
    };
export type ConditionDefinition = { include: ConditionNode | null; exclude: ConditionNode | null };

function invalid(): never {
  // Never reflect schema, SQL, values, or native parser errors to callers.
  throw new BadRequestException('Invalid condition definition');
}

function nativeKind(type: string): ConditionSchemaColumn['kind'] {
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

export function conditionColumns(
  schema: Array<{ name: string; type: string }>,
): ConditionSchemaColumn[] {
  if (!Array.isArray(schema)) invalid();
  const names = new Set<string>();
  return schema.map(column => {
    if (
      !column ||
      typeof column.name !== 'string' ||
      !column.name ||
      column.name.includes('\0') ||
      typeof column.type !== 'string'
    )
      invalid();
    // DuckDB quoted identifiers are still ASCII case insensitive.
    const identity = column.name.replace(/[A-Z]/g, letter => letter.toLowerCase());
    if (names.has(identity)) invalid();
    names.add(identity);
    return { name: column.name, type: column.type, kind: nativeKind(column.type) };
  });
}

/** Plain JSON data only: no prototypes, symbols, accessors or invisible fields. */
function record(value: unknown): Record<string, any> {
  if (
    !value ||
    typeof value !== 'object' ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    invalid();
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor)) invalid();
  }
  return value as Record<string, any>;
}
function keys(value: Record<string, any>, expected: string[]) {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some(key => !expected.includes(key))) invalid();
}
function array(value: unknown, max: number): any[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length < 1 ||
    value.length > max
  )
    invalid();
  if (Reflect.ownKeys(value).length !== value.length + 1) invalid();
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) invalid();
  }
  return value;
}
function calendar(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = +value.slice(0, 4);
  const month = +value.slice(5, 7);
  const day = +value.slice(8, 10);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  );
}
function instant(value: string, nanoseconds: boolean): string {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,9}))?Z$/.exec(
    value,
  );
  if (!match || !calendar(match[1]) || !Number.isFinite(Date.parse(value))) invalid();
  const fraction = (match[5] || '').replace(/0+$/, '');
  if (fraction.length > (nanoseconds ? 9 : 6)) invalid();
  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}${fraction ? `.${fraction}` : ''}Z`;
}
function epochNanoseconds(value: string): string {
  // Date.parse floors pre-epoch fractional milliseconds; add only the remaining
  // six fractional digits, preserving -1ns and avoiding any native string parser.
  const fraction = (value.split('.')[1]?.slice(0, -1) || '').padEnd(9, '0');
  const nanos = BigInt(Date.parse(value)) * BigInt(1000000) + BigInt(fraction.slice(3));
  // Installed DuckDB 1.5.6 make_timestamp_ns verified at both ends. Exclude both
  // extreme negative points (including the native anomaly) and positive infinity.
  const maximum = BigInt('9223372036854775806');
  if (nanos < -maximum || nanos > maximum) invalid();
  return nanos.toString();
}
function temporalKey(value: string): string {
  // Fixed-width fractions preserve sub-millisecond ordering without JS Date rounding.
  return value.slice(0, 19) + (value.split('.')[1]?.slice(0, -1) || '').padEnd(9, '0');
}

/** A common exact DECIMAL type must retain both source integer digits and all
 * threshold fractional digits. Never round a threshold to the source scale. */
function numericParameter(type: string, values: number[]): { sql: string; bindings: any[] } {
  const decimal = /^(?:DECIMAL|NUMERIC)\((\d{1,2}),\s*(\d{1,2})\)$/.exec(type);
  if (decimal) {
    let scale = +decimal[2];
    let integerDigits = +decimal[1] - scale;
    for (const value of values) {
      const [mantissa, exponent = '0'] = String(value).replace(/^-/, '').toLowerCase().split('e');
      const [whole, fraction = ''] = mantissa.split('.');
      scale = Math.max(scale, fraction.length - +exponent);
      integerDigits = Math.max(integerDigits, whole.replace(/^0+/, '').length + +exponent);
    }
    if (integerDigits + scale > 38) invalid();
    return { sql: `CAST(? AS DECIMAL(38,${scale}))`, bindings: values.map(String) };
  }
  if (type === 'BIGNUM') {
    if (!values.every(Number.isSafeInteger)) invalid();
    return { sql: 'CAST(? AS BIGNUM)', bindings: values.map(String) };
  }
  // Bind integer thresholds as integers, avoiding any common DOUBLE conversion.
  if (!['FLOAT', 'DOUBLE', 'REAL'].includes(type) && values.every(Number.isSafeInteger)) {
    return { sql: 'CAST(? AS BIGINT)', bindings: values.map(String) };
  }
  return { sql: '?', bindings: values };
}

/** Schema-free JSON AST validation for stored/document projections. Execution still
 * requires compileConditionDefinition against the actual native source schema. */
export function validateConditionDefinition(input: unknown): ConditionDefinition {
  try {
    const root = record(input);
    keys(root, ['include', 'exclude']);
    let nodes = 0;
    function visit(value: unknown, depth: number): ConditionNode {
      if (++nodes > 32) invalid();
      const node = record(value);
      if (node.kind === 'group') {
        keys(node, ['kind', 'operator', 'children']);
        if (depth >= 4 || !['and', 'or'].includes(node.operator)) invalid();
        return {
          kind: 'group',
          operator: node.operator,
          children: array(node.children, 8).map(child => visit(child, depth + 1)),
        };
      }
      if (
        node.kind !== 'predicate' ||
        typeof node.column !== 'string' ||
        !node.column ||
        node.column.includes('\0')
      )
        invalid();
      const nullOp = ['isNull', 'isNotNull'].includes(node.operator);
      keys(
        node,
        nullOp ? ['kind', 'column', 'operator'] : ['kind', 'column', 'operator', 'values'],
      );
      if (
        ![
          'eq',
          'ne',
          'in',
          'notIn',
          'contains',
          'gt',
          'gte',
          'lt',
          'lte',
          'between',
          'isNull',
          'isNotNull',
        ].includes(node.operator)
      )
        invalid();
      if (nullOp) return { kind: 'predicate', column: node.column, operator: node.operator };
      const values = array(node.values, 50).map(value => {
        if (typeof value === 'number') {
          if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) invalid();
        } else if (typeof value === 'string') {
          if (value.length > 2000) invalid();
        } else if (typeof value !== 'boolean') invalid();
        return value;
      });
      if (
        node.operator === 'between'
          ? values.length !== 2
          : !['in', 'notIn'].includes(node.operator) && values.length !== 1
      )
        invalid();
      return { kind: 'predicate', column: node.column, operator: node.operator, values };
    }
    const definition = {
      include: root.include === null ? null : visit(root.include, 0),
      exclude: root.exclude === null ? null : visit(root.exclude, 0),
    };
    if (Buffer.byteLength(JSON.stringify(definition), 'utf8') > 32 * 1024) invalid();
    return definition;
  } catch {
    return invalid();
  }
}

export function compileConditionDefinition(
  input: unknown,
  columns: ConditionSchemaColumn[],
): {
  definition: ConditionDefinition;
  includeSql: string;
  excludeSql: string;
  bindings: any[];
} {
  // Catch unexpected object/proxy traps too; validation errors never disclose inputs.
  try {
    const mapped = conditionColumns(columns);
    if (mapped.some((column, index) => column.kind !== columns[index].kind)) invalid();
    const byName = new Map(mapped.map(column => [column.name, column]));
    const root = record(validateConditionDefinition(input));
    keys(root, ['include', 'exclude']);
    let nodes = 0;
    const bindings: any[] = [];
    function visit(inputNode: unknown, groupDepth: number): { node: ConditionNode; sql: string } {
      if (++nodes > 32) invalid();
      const node = record(inputNode);
      if (node.kind === 'group') {
        keys(node, ['kind', 'operator', 'children']);
        if (groupDepth >= 4 || !['and', 'or'].includes(node.operator)) invalid();
        const children = array(node.children, 8).map(child => visit(child, groupDepth + 1));
        return {
          node: {
            kind: 'group',
            operator: node.operator,
            children: children.map(child => child.node),
          },
          sql: `(${children
            .map(child => child.sql)
            .join(node.operator === 'and' ? ' AND ' : ' OR ')})`,
        };
      }
      if (node.kind !== 'predicate') invalid();
      const nullOp = node.operator === 'isNull' || node.operator === 'isNotNull';
      keys(
        node,
        nullOp ? ['kind', 'column', 'operator'] : ['kind', 'column', 'operator', 'values'],
      );
      const column = byName.get(node.column);
      if (!column) invalid();
      const quoted = quoteColumn(column.name);
      const nativeType = column.type.trim().toUpperCase();
      const nanoseconds = nativeType === 'TIMESTAMP_NS';
      if (nullOp)
        return {
          node: { kind: 'predicate', column: column.name, operator: node.operator },
          sql: `COALESCE((${quoted} IS ${node.operator === 'isNull' ? '' : 'NOT '}NULL), FALSE)`,
        };
      const ordered = ['number', 'date', 'timestamp'].includes(column.kind);
      const allowed = [
        'eq',
        'ne',
        'in',
        'notIn',
        ...(ordered ? ['gt', 'gte', 'lt', 'lte', 'between'] : []),
        ...(column.kind === 'string' ? ['contains'] : []),
      ];
      if (column.kind === 'unsupported' || !allowed.includes(node.operator)) invalid();
      const values = array(node.values, 50).map(value => {
        if (column.kind === 'number') {
          if (
            typeof value !== 'number' ||
            !Number.isFinite(value) ||
            Math.abs(value) > Number.MAX_SAFE_INTEGER
          )
            invalid();
        } else if (column.kind === 'boolean') {
          if (typeof value !== 'boolean') invalid();
        } else {
          if (typeof value !== 'string' || value.length > 2000) invalid();
          if (column.kind === 'date' && !calendar(value)) invalid();
          if (column.kind === 'timestamp') return instant(value, nanoseconds);
        }
        return value;
      });
      if (node.operator === 'between') {
        if (values.length !== 2) invalid();
        const comparable = column.kind === 'timestamp' ? values.map(temporalKey) : values;
        if (comparable[0] > comparable[1]) invalid();
      } else if (!['in', 'notIn'].includes(node.operator) && values.length !== 1) invalid();
      const numeric =
        column.kind === 'number' ? numericParameter(nativeType, values as number[]) : null;
      bindings.push(
        ...(nanoseconds
          ? (values as string[]).map(epochNanoseconds)
          : numeric
          ? numeric.bindings
          : values),
      );
      const parameter =
        column.kind === 'date'
          ? 'CAST(? AS DATE)'
          : column.kind === 'timestamp'
          ? nanoseconds
            ? 'make_timestamp_ns(CAST(? AS BIGINT))'
            : 'CAST(? AS TIMESTAMPTZ)'
          : numeric?.sql || '?';
      const zoned = /^(?:TIMESTAMPTZ|TIMESTAMP WITH TIME ZONE)$/.test(nativeType);
      const expression =
        column.kind !== 'timestamp' || nanoseconds
          ? quoted
          : zoned
          ? `CAST(${quoted} AS TIMESTAMPTZ)`
          : `(${quoted} AT TIME ZONE 'UTC')`;
      const operators = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };
      let predicate: string;
      if (node.operator === 'contains') predicate = `strpos(${expression}, ${parameter}) > 0`;
      else if (node.operator === 'between')
        predicate = `${expression} BETWEEN ${parameter} AND ${parameter}`;
      else if (node.operator === 'in' || node.operator === 'notIn')
        predicate = `${expression} ${node.operator === 'in' ? 'IN' : 'NOT IN'} (${values
          .map(() => parameter)
          .join(', ')})`;
      else predicate = `${expression} ${operators[node.operator]} ${parameter}`;
      return {
        node: { kind: 'predicate', column: column.name, operator: node.operator, values },
        sql: `COALESCE((${predicate}), FALSE)`,
      };
    }
    const include = root.include === null ? null : visit(root.include, 0);
    const exclude = root.exclude === null ? null : visit(root.exclude, 0);
    const definition: ConditionDefinition = {
      include: include?.node || null,
      exclude: exclude?.node || null,
    };
    if (Buffer.byteLength(JSON.stringify(root), 'utf8') > 32 * 1024) invalid();
    return {
      definition,
      includeSql: include?.sql || 'TRUE',
      excludeSql: exclude?.sql || 'FALSE',
      bindings,
    };
  } catch {
    return invalid();
  }
}
