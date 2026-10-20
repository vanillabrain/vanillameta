import { DuckDBInstance } from '@duckdb/node-api';
import * as path from 'path';
import { executePreparedSegment, PreparedSegmentInput } from './bi-segment-engine';

describe('prepared segment execution without saved candidate metrics', () => {
  let db: Awaited<ReturnType<typeof DuckDBInstance.create>>;
  let session: Awaited<ReturnType<typeof db.connect>>;
  let profile: any;
  let query: jest.Mock;
  let assertCurrent: jest.Mock;
  const input = (): PreparedSegmentInput<'candidate:1' | 'candidate:2'> => ({
    measures: [
      {
        id: 'candidate:1',
        label: 'Revenue',
        unit: 'USD',
        decimalPlaces: 2,
        expression: 'SUM(revenue)',
      },
      {
        id: 'candidate:2',
        label: 'Margin',
        unit: '%',
        decimalPlaces: 2,
        expression: 'SUM(profit) / NULLIF(SUM(revenue), 0) * 100',
      },
    ],
    dimensionColumn: 'company',
    pivotColumn: 'component',
    conditions: [
      { measureId: 'candidate:1', operator: 'gte', value: 1000 },
      { measureId: 'candidate:2', operator: 'lt', value: 20 },
    ],
    filters: [],
    trendGrain: 'day',
    page: 0,
    pageSize: 20,
    aggregateOnly: true,
  });
  const execute = (request = input()) =>
    executePreparedSegment(request, {
      profile,
      sourceRevision: 'file-v1',
      viewRevision: 'view-v1',
      query,
      assertCurrent,
    });
  beforeEach(async () => {
    db = await DuckDBInstance.create(':memory:');
    session = await db.connect();
    const file = path.resolve(__dirname, '../../../samples/rill-scenarios/data/margin.csv');
    await session.run(
      `CREATE TABLE uploaded_data AS SELECT * FROM read_csv_auto('${file.replace(/'/g, "''")}')`,
    );
    const schema = (await session.runAndReadAll('DESCRIBE uploaded_data')).getRowObjects();
    profile = {
      sourceId: 2,
      supported: true,
      columns: schema.map((c: any) => ({
        name: c.column_name,
        type: c.column_type,
        numeric: /INT|DOUBLE|DECIMAL|FLOAT/.test(c.column_type),
        temporal: /DATE|TIME/.test(c.column_type),
      })),
    };
    query = jest.fn(async (sql, bindings) =>
      (await session.runAndReadAll(sql, bindings))
        .getRowObjects()
        .map(row =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? String(v) : v]),
          ),
        ),
    );
    assertCurrent = jest.fn(async () => undefined);
  });
  afterEach(() => {
    session?.closeSync();
    db?.closeSync();
  });
  it('prepared_candidate_matches_saved_aggregate', async () => {
    const result = await execute();
    expect('selection' in result).toBe(false);
    if ('selection' in result) throw new Error('unexpected details');
    expect(Number(result.kpis[0].value)).toBeCloseTo(5431.25, 8);
    expect(Number(result.kpis[1].value)).toBeCloseTo(5.390840046029919, 10);
    expect(result.scope.rows).toBe('8');
    expect(result.groups.map(g => g.category)).toEqual(['Hanul Foods', 'Baro Tech']);
    const baro = result.pivot.rows.find(r => r.category === 'Baro Tech');
    expect(Number(baro.cells.find(c => c.column === 'Compute').values[0].value)).toBeCloseTo(
      640.5,
      8,
    );
    expect(result.kpis[0].id).toBe('candidate:1');
  });
  it('aggregate_only_reads_no_raw_rows', async () => {
    const result = await execute();
    expect(result.details.rows).toEqual([]);
    expect(query.mock.calls.some(([sql]) => sql.includes('__vm_detail_'))).toBe(false);
    expect(assertCurrent).toHaveBeenCalledTimes(1);
  });
  it('candidate_without_a_source_trend_does_not_adopt_a_target_date', async () => {
    const result = await executePreparedSegment(
      { ...input(), trendColumn: null },
      {
        profile,
        sourceRevision: 'v',
        viewRevision: 'v',
        query,
        assertCurrent,
      },
    );
    if ('selection' in result) throw new Error('unexpected details');
    expect(result.time).toBeNull();
    expect(result.trends).toEqual([]);
  });
  it('prepared_result_rechecks_before_return', async () => {
    assertCurrent.mockRejectedValueOnce(new Error('source changed'));
    await expect(execute()).rejects.toThrow('source changed');
  });
  it('null_and_literal_null_and_alias_columns_remain_distinct', async () => {
    await session.run('DROP TABLE uploaded_data');
    await session.run(`CREATE TABLE uploaded_data AS SELECT * FROM (VALUES
      (NULL, 'x', 10), ('null', 'x', 20), (NULL, 'y', 30)) t(__vm_seg_dim, component, __vm_seg_m0)`);
    profile.columns = [
      { name: '__vm_seg_dim', type: 'VARCHAR', numeric: false, temporal: false },
      { name: 'component', type: 'VARCHAR', numeric: false, temporal: false },
      { name: '__vm_seg_m0', type: 'INTEGER', numeric: true, temporal: false },
    ];
    const request = {
      ...input(),
      dimensionColumn: '__vm_seg_dim',
      measures: [{ ...input().measures[0], expression: 'SUM(__vm_seg_m0)' }],
      conditions: [{ measureId: 'candidate:1' as const, operator: 'gte' as const, value: 0 }],
    };
    const result = await execute(request);
    if ('selection' in result) throw new Error('unexpected details');
    expect(result.groups.map(g => [g.category, Number(g.values[0].value)])).toEqual([
      [null, 40],
      ['null', 20],
    ]);
    expect(Number(result.kpis[0].value)).toBe(60);
  });
});
