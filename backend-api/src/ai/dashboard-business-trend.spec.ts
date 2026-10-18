import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import {
  BusinessBasis,
  businessDateExpressions,
  businessSchemaRevision,
  normalizeBusinessBasis,
} from '../bi/semantic-business-basis';
import { sourceQuery, validateSourceSql } from './dashboard-draft';
import { buildTimeChartQuery, buildTrendQuery, resolveTimeChartBucket } from './dashboard-trend';

const formats = [
  ['iso_day', 'YYYY-MM-DD'],
  ['slash_day', 'YYYY/MM/DD'],
  ['compact_day', 'YYYYMMDD'],
] as const;
const schema = [
  ...formats.map(([name]) => ({ name, type: 'VARCHAR' })),
  { name: 'native_day', type: 'DATE' },
  { name: 'category_code', type: 'INTEGER' },
  { name: 'amount', type: 'DOUBLE' },
];
const describeSchema = schema.map(({ name, type }) => ({ column_name: name, column_type: type }));
const columns = schema.map(column => column.name);
const basis = normalizeBusinessBasis({
  schemaVersion: 1,
  catalogVersion: 1,
  schemaRevision: businessSchemaRevision({ columns: schema }),
  columns: schema.map(({ name, type }) => ({
    column: name,
    nativeType: type,
    label: `Business ${name}`,
    description: '',
    unit: '',
    businessType: name === 'amount' ? 'number' : name === 'category_code' ? 'category' : 'date',
    dateFormat:
      formats.find(([column]) => column === name)?.[1] ?? (name === 'native_day' ? 'native' : ''),
    classification: '',
  })),
});
const dateExpression = (column: string, snapshot: BusinessBasis = basis) => {
  const result = businessDateExpressions(snapshot).find(item => item.column === column);
  if (!result) throw new Error(`Missing business date expression: ${column}`);
  return result.expression;
};
const businessTime = (snapshot: BusinessBasis = basis, timeZone = 'UTC') => ({
  timeZone,
  columnType: 'DATE',
  basis: snapshot,
});
const kpi = 'SELECT sum(amount) AS total FROM source';
const chart = (expression: string, group = expression, order = 'day') =>
  `SELECT ${expression} AS day, sum(amount) AS total FROM source WHERE amount <= 30 GROUP BY ${group} ORDER BY ${order} LIMIT 500`;
const wrap = (
  sql: string,
  filters: Parameters<typeof sourceQuery>[2] = [],
  range?: Parameters<typeof sourceQuery>[3],
  sqlBasis: BusinessBasis = basis,
  rangeBasis?: BusinessBasis,
) =>
  sourceQuery(
    sql,
    columns,
    filters,
    range,
    ['native_day'],
    ['category_code', 'amount'],
    undefined,
    schema,
    undefined,
    sqlBasis,
    rangeBasis,
  );

// All three parsed columns really are VARCHAR, including ISO dates; no CSV type inference.
// Days total 30/30. The NULL date has a distinct 40, making accidental NULL inclusion observable.
describe('UC050 frozen business dates through dashboard trends and source filters', () => {
  let instance: DuckDBInstance;
  let connection: DuckDBConnection;
  beforeAll(async () => {
    instance = await DuckDBInstance.create(':memory:');
    connection = await instance.connect();
    await connection.run(
      `CREATE TABLE uploaded_data (${schema.map(c => `"${c.name}" ${c.type}`).join(', ')})`,
    );
    for (const [day, code, amount] of [
      ['2024-02-29', 101, 10],
      ['2024-02-29', 102, 20],
      ['2024-03-01', 101, 30],
      [null, null, 40],
    ] as const) {
      await connection.run('INSERT INTO uploaded_data VALUES (?, ?, ?, ?, ?, ?)', [
        day,
        day?.replace(/-/g, '/') ?? null,
        day?.replace(/-/g, '') ?? null,
        day,
        code,
        amount,
      ]);
    }
  });
  afterAll(() => {
    connection?.closeSync();
    instance?.closeSync();
  });
  const execute = async (query: { sql: string; bindings: any[] }) =>
    (await connection.runAndReadAll(query.sql, query.bindings)).getRowObjectsJson();

  it.each(formats)(
    'rebuilds KPI trend with canonical %s (%s) dates and preserves WHERE',
    async column => {
      const trend = buildTrendQuery(
        `${kpi} WHERE amount <= 30`,
        'total',
        column,
        'day',
        [],
        businessTime(),
      );
      expect(trend).toBeDefined();
      expect(trend.sql).toContain(`date_trunc('day', ${dateExpression(column)})`);
      expect(await execute(wrap(trend.sql))).toEqual([
        { [trend.timeField]: '2024-02-29T00:00:00Z', [trend.valueAlias]: 30 },
        { [trend.timeField]: '2024-03-01T00:00:00Z', [trend.valueAlias]: 30 },
      ]);
    },
  );

  describe.each(formats)('%s (%s) date chart proof', column => {
    it.each([
      ['direct', (expression: string) => expression, 'day', 'day'],
      ['day bucket', (expression: string) => `date_trunc('day', ${expression})`, 'day', 'duckdb'],
      ['ISO label', (expression: string) => `strftime(${expression}, '%Y-%m-%d')`, 'day', 'day'],
      [
        'month label',
        (expression: string) => `strftime(date_trunc('month', ${expression}), '%Y-%m')`,
        'month',
        'month',
      ],
    ] as const)(
      'recognizes %s and rebuckets the canonical expression',
      async (_name, project, grain, format) => {
        const sql = chart(project(dateExpression(column)));
        expect(resolveTimeChartBucket(sql, 'total', 'day', describeSchema, basis)).toEqual({
          column,
          grain,
          format,
        });
        const rebuilt = buildTimeChartQuery(
          sql,
          'total',
          'day',
          column,
          'month',
          [],
          businessTime(),
        );
        expect(rebuilt).toBeDefined();
        expect(rebuilt.sql).toContain(`date_trunc('month', ${dateExpression(column)})`);
        expect(await execute(wrap(rebuilt.sql))).toEqual([
          { day: '2024-02-01T00:00:00Z', total: 30 },
          { day: '2024-03-01T00:00:00Z', total: 30 },
        ]);
      },
    );
    it.each(['raw group', 'raw truncated group', 'raw truncated order', 'raw projection'])(
      'rejects %s instead of treating raw VARCHAR as canonical DATE',
      scenario => {
        const parsed = dateExpression(column),
          raw = `"${column}"`;
        const sql =
          scenario === 'raw projection'
            ? chart(raw)
            : chart(
                parsed,
                scenario === 'raw group'
                  ? raw
                  : scenario === 'raw truncated group'
                  ? `date_trunc('day', ${raw})`
                  : parsed,
                scenario === 'raw truncated order' ? `date_trunc('day', ${raw})` : 'day',
              );
        // The ordinary source grammar accepts these; the temporal proof rejects the semantic mismatch.
        expect(() => validateSourceSql(sql, basis)).not.toThrow();
        expect(
          buildTimeChartQuery(sql, 'total', 'day', column, 'day', [], businessTime()),
        ).toBeUndefined();
        expect(resolveTimeChartBucket(sql, 'total', 'day', describeSchema, basis)).toBeUndefined();
      },
    );
    it('rejects an altered parser and canonical parser SQL without its frozen snapshot', () => {
      const expression = dateExpression(column);
      const altered = expression.replace("error('Invalid business date')", 'NULL');
      expect(altered).not.toBe(expression);
      expect(() => validateSourceSql(chart(altered), basis)).toThrow();
      expect(() => validateSourceSql(chart(expression))).toThrow();
      expect(
        buildTimeChartQuery(chart(altered), 'total', 'day', column, 'day', [], businessTime()),
      ).toBeUndefined();
    });
  });

  it.each([...formats.map(([name]) => name), 'native_day'])(
    'keeps %s civil dates unshifted in regional KPI and line trends',
    async column => {
      for (const query of [
        buildTrendQuery(
          `${kpi} WHERE amount <= 30`,
          'total',
          column,
          'day',
          [],
          businessTime(basis, 'America/New_York'),
        ),
        buildTimeChartQuery(
          chart(dateExpression(column)),
          'total',
          'day',
          column,
          'day',
          [],
          businessTime(basis, 'America/New_York'),
        ),
      ]) {
        expect(query).toBeDefined();
        expect(query.sql).not.toContain('AT TIME ZONE');
        expect(await execute(wrap(query.sql))).toEqual([
          { [query.timeField]: '2024-02-29', [query.valueAlias]: 30 },
          { [query.timeField]: '2024-03-01', [query.valueAlias]: 30 },
        ]);
      }
    },
  );
  it.each(formats)(
    'filters %s by inclusive ISO day range with canonical DATE and regional bounds',
    async column => {
      for (const timeZone of ['UTC', 'America/New_York', 'Asia/Seoul']) {
        const query = wrap(kpi, [], { column, start: '2024-02-29', end: '2024-02-29', timeZone });
        expect(query.sql).toContain(dateExpression(column));
        expect(await execute(query)).toEqual([{ total: 30 }]);
      }
    },
  );
  it.each(formats)(
    'filters %s with discrete ISO dates and NULL through the canonical expression',
    async column => {
      const query = wrap(kpi, [{ column, values: ['2024-02-29', null] }]);
      expect(query.sql).toContain(`${dateExpression(column)} IN (?)`);
      expect(query.sql).toContain(`${dateExpression(column)} IS NULL`);
      expect(query.bindings).toEqual(['2024-02-29']);
      expect(await execute(query)).toEqual([{ total: 70 }]);
    },
  );
  it.each(['2024/02/29', '20240229', '2023-02-29', '2024-02-30', '0000-01-01', 20240229])(
    'rejects invalid/non-ISO discrete business date %j',
    value => {
      expect(() => wrap(kpi, [{ column: 'slash_day', values: [value] }])).toThrow('ISO');
    },
  );
  it('allows discrete numeric categories but rejects their numeric ranges', async () => {
    expect(await execute(wrap(kpi, [{ column: 'category_code', values: [101] }]))).toEqual([
      { total: 40 },
    ]);
    expect(() => wrap(kpi, [{ column: 'category_code', range: { min: 101, max: 102 } }])).toThrow(
      'numeric source column required',
    );
    expect(await execute(wrap(kpi, [{ column: 'amount', range: { min: 10, max: 20 } }]))).toEqual([
      { total: 30 },
    ]);
  });
  it.each(['discrete', 'range'])(
    'validates widget SQL against its own basis while root basis controls %s date filtering',
    async mode => {
      const widgetBasis = {
        ...basis,
        columns: basis.columns.filter(c => ['amount', 'slash_day'].includes(c.column)),
      };
      const rootBasis = {
        ...basis,
        catalogVersion: 2,
        columns: basis.columns.filter(c => ['amount', 'compact_day'].includes(c.column)),
      };
      const widgetSql = chart(dateExpression('slash_day', widgetBasis));
      const query = wrap(
        widgetSql,
        mode === 'discrete' ? [{ column: 'compact_day', values: ['2024-02-29'] }] : [],
        mode === 'range'
          ? {
              column: 'compact_day',
              start: '2024-02-29',
              end: '2024-02-29',
              timeZone: 'America/New_York',
            }
          : undefined,
        widgetBasis,
        rootBasis,
      );
      expect(query.sql).toContain(dateExpression('compact_day', rootBasis));
      expect(query.sql).toContain(widgetSql);
      expect(await execute(query)).toEqual([{ day: '2024-02-29', total: 30 }]);
      expect(() => wrap(widgetSql, [], undefined, rootBasis)).toThrow();
    },
  );
  it('uses root category meaning for ranges even if the widget frozen declaration is number', () => {
    const widgetBasis = normalizeBusinessBasis({
      ...basis,
      columns: basis.columns.map(c =>
        c.column === 'category_code' ? { ...c, businessType: 'number' } : c,
      ),
    });
    const filter = [{ column: 'category_code', range: { min: 101 } }];
    expect(() => wrap(kpi, filter, undefined, widgetBasis)).not.toThrow();
    expect(() => wrap(kpi, filter, undefined, widgetBasis, basis)).toThrow(
      'numeric source column required',
    );
  });
  it('preserves legacy native DATE recognition and requires canonical DATE under a declaration', () => {
    const sql = chart('"native_day"');
    expect(resolveTimeChartBucket(sql, 'total', 'day', describeSchema)).toEqual({
      column: 'native_day',
      grain: 'day',
      format: 'day',
    });
    expect(resolveTimeChartBucket(sql, 'total', 'day', describeSchema, basis)).toBeUndefined();
  });
});
