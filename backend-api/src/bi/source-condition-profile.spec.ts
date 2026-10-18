import { DuckDBService } from '../analysis/duckdb.service';
import { sourceConditionProfile } from './source-condition-profile';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
describe('UC052 actual full value distributions and ordered selected samples', () => {
  let worker: DuckDBService, root: string, filename: string;
  const old = process.env.FILE_UPLOAD_DIR;
  const schema = [
    { name: 'category', type: 'VARCHAR' },
    { name: 'amount', type: 'BIGINT' },
    { name: 'day', type: 'DATE' },
  ];
  const definition = {
    include: {
      kind: 'group',
      operator: 'or',
      children: [
        { kind: 'predicate', column: 'category', operator: 'eq', values: ['A'] },
        { kind: 'predicate', column: 'amount', operator: 'lt', values: [4] },
      ],
    },
    exclude: { kind: 'predicate', column: 'amount', operator: 'gte', values: [5] },
  };
  const run = (over: any = {}) =>
    sourceConditionProfile({
      schema,
      columns: ['category', 'amount'],
      definition,
      query: (sql, bindings) => worker.query(filename, sql, bindings),
      ...over,
    });
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc052-profile-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    filename = (
      await worker.importFile({
        originalname: 'profile.csv',
        buffer: Buffer.from(
          'category,amount,day\nA,1,2026-01-01\nA,2,2026-01-02\nB,3,2026-01-02\nB,4,2026-01-03\nA,5,2026-01-03\n,6,2026-01-04\nA,2,2026-01-02\n',
        ),
      })
    ).filename;
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (old === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = old;
  });
  it('uses the entire source for distributions, preserves duplicates/nulls, and restricts sample projection', async () => {
    const r = await run();
    expect(r.population).toMatchObject({ total: '7', matched: '5', excluded: '1', remaining: '4' });
    expect(r.distributions[0].rows).toEqual([
      {
        value: 'A',
        valueTruncated: false,
        total: '4',
        matched: '4',
        excluded: '1',
        remaining: '3',
      },
      {
        value: 'B',
        valueTruncated: false,
        total: '2',
        matched: '1',
        excluded: '0',
        remaining: '1',
      },
      {
        value: null,
        valueTruncated: false,
        total: '1',
        matched: '0',
        excluded: '0',
        remaining: '0',
      },
    ]);
    expect(r.sample.columns.map(c => c.name)).toEqual(['category', 'amount']);
    expect(r.sample.rows.map(r => r.values)).toEqual([
      ['A', '1'],
      ['A', '2'],
      ['A', '2'],
      ['B', '3'],
    ]);
    expect(r.sample).toMatchObject({
      totalRows: '4',
      hasMore: false,
      selection: 'ordered',
      representative: false,
    });
    expect(r.distributions[1].range).toMatchObject({ minimum: '1', maximum: '6' });
  });
  it('ANDs the base date/filter population with include/exclude, and returns empty scopes honestly', async () => {
    const r = await run({
      filters: [{ column: 'category', values: ['A'] }],
      dateRange: { column: 'day', start: '2026-01-02', end: '2026-01-03' },
    });
    expect(r.population).toMatchObject({ total: '3', matched: '3', excluded: '1', remaining: '2' });
    expect(r.sample.rows.map(r => r.values)).toEqual([
      ['A', '2'],
      ['A', '2'],
    ]);
    const e = await run({ filters: [{ column: 'category', values: ['missing'] }] });
    expect(e.population).toMatchObject({
      total: '0',
      remaining: '0',
      matchedRatio: null,
      remainingRatio: null,
    });
    expect(e.sample.rows).toEqual([]);
    expect(e.distributions[0]).toMatchObject({
      rows: [],
      totalGroups: '0',
      hasMore: false,
      other: { total: '0', matched: '0', excluded: '0', remaining: '0' },
    });
  });
  it.each(
    [[], ['missing'], ['amount', 'amount'], ['amount;DROP TABLE x'], Array(7).fill('amount')].map(
      columns => ({ columns }),
    ),
  )(
    'rejects unknown, injected, duplicate and over-limit fields before any population query %#',
    async ({ columns }) => {
      const query = jest.fn();
      await expect(run({ columns, query })).rejects.toMatchObject({ status: 400 });
      expect(query).not.toHaveBeenCalled();
    },
  );
  it('groups full populations above both display limits with numeric frequency sort and exact remainder', async () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      Array.from(
        { length: i === 24 ? 11 : i === 23 ? 9 : 1 },
        () => `v${String(i).padStart(2, '0')},${i},2026-01-01`,
      ),
    ).flat();
    const large = (
      await worker.importFile({
        originalname: 'large.csv',
        buffer: Buffer.from('category,amount,day\n' + rows.join('\n') + '\n'),
      })
    ).filename;
    const r = await run({
      definition: { include: null, exclude: null },
      query: (sql, bindings) => worker.query(large, sql, bindings),
    });
    expect(r.population.total).toBe('43');
    expect(r.distributions[0].rows[0]).toMatchObject({ value: 'v24', total: '11' });
    expect(r.distributions[0]).toMatchObject({
      totalGroups: '25',
      hasMore: true,
      other: { total: '5', remaining: '5' },
    });
    expect(r.sample).toMatchObject({ limit: 20, totalRows: '43', hasMore: true });
    expect(r.sample.rows).toHaveLength(20);
  });
  it('keeps native huge integer/decimal/date strings, marks long values and never returns unselected secrets', async () => {
    const text = '한'.repeat(230);
    const file = (
      await worker.importFile({
        originalname: 'precise.csv',
        buffer: Buffer.from(
          `big,money,description,secret\n9007199254740993,12345678901234567890.1234,${text},neverreturn\n9007199254740994,1.0001,x,neverreturn\n`,
        ),
      })
    ).filename;
    const native = (await worker.query(file, 'DESCRIBE uploaded_data')).datas.map(c => ({
      name: c.column_name,
      type: c.column_type,
    }));
    const r = await run({
      schema: native,
      columns: ['big', 'description'],
      definition: { include: null, exclude: null },
      query: (sql, b) => worker.query(file, sql, b),
    });
    expect(r.sample.rows[0].values[0]).toBe('9007199254740993');
    expect(r.sample.rows[0].truncated).toEqual([false, true]);
    expect(r.sample.rows[0].values[1]).toBe('한'.repeat(200));
    expect(JSON.stringify(r)).not.toContain('neverreturn');
    expect(JSON.stringify(r)).not.toContain('"secret"');
    const decimal = await run({
      schema: [{ name: 'money', type: 'DECIMAL(30,4)' }],
      columns: ['money'],
      definition: { include: null, exclude: null },
      query: (sql, b) =>
        worker.query(
          file,
          sql.replace(
            /uploaded_data/g,
            "(SELECT CAST('12345678901234567890.1234' AS DECIMAL(30,4)) money UNION ALL SELECT CAST('1.0001' AS DECIMAL(30,4)))",
          ),
          b,
        ),
    });
    expect(decimal.distributions[0].rows.map(row => row.value)).toContain(
      '12345678901234567890.1234',
    );
  });
});
