/* eslint-disable @typescript-eslint/no-var-requires */
type Canonical = (
  value: unknown,
  dataType: string,
  context?: { table?: string; column?: string },
) => unknown;
type Column = { column_name: string; data_type: string };
type RowHash = (columns: Column[], rows: Array<Record<string, unknown>>, table?: string) => string;
type DependencyOrder = (
  tables: string[],
  edges: Array<{ child: string; parent: string }>,
) => string[];

const cutover = require('../../scripts/migrate-mysql-to-postgres.cjs') as {
  canonical: Canonical;
  rowHash: RowHash;
  dependencyOrder: DependencyOrder;
};

describe('MySQL to PostgreSQL cutover value canonicalisation', () => {
  it('folds MySQL microsecond padding and PostgreSQL trimming into one timestamp', () => {
    expect(cutover.canonical('2026-01-02 03:04:05.123000', 'timestamp without time zone')).toBe(
      '2026-01-02T03:04:05.123',
    );
    expect(cutover.canonical('2026-01-02 03:04:05.123', 'timestamp without time zone')).toBe(
      '2026-01-02T03:04:05.123',
    );
    expect(cutover.canonical('2026-01-02 03:04:05.000000', 'timestamp without time zone')).toBe(
      '2026-01-02T03:04:05',
    );
  });

  it('stops on a MySQL zero date instead of inventing a value', () => {
    expect(() =>
      cutover.canonical('0000-00-00 00:00:00', 'timestamp without time zone', {
        table: 'event',
        column: 'occurredAt',
      }),
    ).toThrow(/event\.occurredAt holds a MySQL zero date/);
  });

  it('reads bytea from a MySQL buffer and a PostgreSQL text form as the same hex', () => {
    expect(cutover.canonical(Buffer.from([0xde, 0xad, 0xbe, 0xef]), 'bytea')).toBe('deadbeef');
    expect(cutover.canonical('\\xDEADBEEF', 'bytea')).toBe('deadbeef');
  });

  it('treats tinyint(1) and booleans from either driver as one value', () => {
    expect(cutover.canonical(1, 'boolean')).toBe(true);
    expect(cutover.canonical('0', 'boolean')).toBe(false);
    expect(cutover.canonical(true, 'boolean')).toBe(true);
  });

  it('keeps integers beyond the JavaScript safe range as exact strings', () => {
    expect(cutover.canonical('9007199254740993', 'bigint')).toBe('9007199254740993');
    expect(cutover.canonical('1234567890.123456', 'numeric')).toBe('1234567890.123456');
  });

  it('ignores JSON key order so MySQL text and PostgreSQL objects hash alike', () => {
    expect(cutover.canonical('{"b":1,"a":2}', 'jsonb')).toEqual({ a: 2, b: 1 });
    expect(cutover.canonical({ a: 2, b: 1 }, 'jsonb')).toEqual({ a: 2, b: 1 });
  });
});

describe('MySQL to PostgreSQL cutover row hashing', () => {
  const columns: Column[] = [
    { column_name: 'id', data_type: 'integer' },
    { column_name: 'active', data_type: 'boolean' },
    { column_name: 'createdAt', data_type: 'timestamp without time zone' },
    { column_name: 'payload', data_type: 'bytea' },
  ];

  it('hashes the same logical row identically across driver shapes', () => {
    const fromMysql = cutover.rowHash(
      columns,
      [{ id: 1, active: 1, createdAt: '2026-01-02 03:04:05.123000', payload: Buffer.from('hi') }],
      'sample',
    );
    const fromPostgres = cutover.rowHash(
      columns,
      [{ id: 1, active: true, createdAt: '2026-01-02 03:04:05.123', payload: '\\x6869' }],
      'sample',
    );
    expect(fromPostgres).toBe(fromMysql);
  });

  it('ignores row order but notices a changed value', () => {
    const rows: Array<Record<string, unknown>> = [
      { id: 1, active: true, createdAt: '2026-01-02T03:04:05', payload: 'aa' },
      { id: 2, active: false, createdAt: '2026-01-03T03:04:05', payload: 'bb' },
    ];
    const reversed = [...rows].reverse();
    expect(cutover.rowHash(columns, reversed, 'sample')).toBe(
      cutover.rowHash(columns, rows, 'sample'),
    );
    expect(cutover.rowHash(columns, [{ ...rows[0], payload: 'cc' }], 'sample')).not.toBe(
      cutover.rowHash(columns, [rows[0]], 'sample'),
    );
  });
});

describe('MySQL to PostgreSQL cutover dependency order', () => {
  it('places parents before children and breaks ties alphabetically', () => {
    expect(
      cutover.dependencyOrder(
        ['template_item', 'component', 'template'],
        [{ child: 'template_item', parent: 'template' }],
      ),
    ).toEqual(['component', 'template', 'template_item']);
  });

  it('refuses a foreign-key cycle instead of guessing an order', () => {
    expect(() =>
      cutover.dependencyOrder(
        ['a', 'b'],
        [
          { child: 'a', parent: 'b' },
          { child: 'b', parent: 'a' },
        ],
      ),
    ).toThrow(/Foreign-key cycle/);
  });

  it('treats a parent outside the transfer set as satisfied', () => {
    expect(cutover.dependencyOrder(['child'], [{ child: 'child', parent: 'missing' }])).toEqual([
      'child',
    ]);
  });
});
