import { sourceQuery } from './dashboard-draft';
import { DuckDBService } from '../analysis/duckdb.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const sql = 'SELECT sum(amount) AS total FROM source';
const columns = ['device', 'event_time', 'amount'];
describe('common UTC date and multiple selection filters', () => {
  let worker: DuckDBService;
  let directory: string;
  let filename: string;
  const uploadRoot = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-filters-'));
    process.env.FILE_UPLOAD_DIR = directory;
    worker = new DuckDBService();
    filename = (
      await worker.importFile({
        originalname: 'events.csv',
        buffer: Buffer.from(
          'device,event_time,amount\nphone,2026-10-01 00:00:00,10\ndesktop,2026-10-01 23:59:59.999,20\nphone,2026-10-02 00:00:00,100\ntv,2026-10-01 12:00:00,1000\n',
        ),
      })
    ).filename;
  });
  afterAll(async () => {
    await worker.onModuleDestroy();
    fs.rmSync(directory, { recursive: true, force: true });
    if (uploadRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = uploadRoot;
  });
  it('ORs selected values and ANDs UTC inclusive days before aggregation', async () => {
    const query = sourceQuery(
      sql,
      columns,
      [{ column: 'device', values: ['phone', 'desktop'] }],
      { column: 'event_time', start: '2026-10-01', end: '2026-10-01' },
      ['event_time'],
    );
    expect(query.bindings).toEqual([
      'phone',
      'desktop',
      '2026-10-01T00:00:00Z',
      '2026-10-02T00:00:00Z',
    ]);
    expect((await worker.query(filename, query.sql, query.bindings)).datas).toEqual([
      { total: 30 },
    ]);
  });
  it('binds injection strings and supports null and legacy single values', async () => {
    const value = "phone') OR true --";
    const query = sourceQuery(sql, columns, [
      { column: 'device', values: [value, 'desktop', null] },
    ]);
    expect(query.sql).not.toContain(value);
    expect(query.sql).toContain('IS NULL');
    expect((await worker.query(filename, query.sql, query.bindings)).datas).toEqual([
      { total: 20 },
    ]);
    const legacy = sourceQuery(sql, columns, [{ column: 'device', value: 'tv' }]);
    expect((await worker.query(filename, legacy.sql, legacy.bindings)).datas).toEqual([
      { total: 1000 },
    ]);
  });
  it.each([
    [{ column: 'device', values: [] }],
    [{ column: 'device', values: Array(51).fill('phone') }],
    [{ column: 'device', values: ['phone'], value: 'tv' }],
    [
      { column: 'device', values: ['phone'] },
      { column: 'device', values: ['tv'] },
    ],
    [{ column: 'unknown', values: ['phone'] }],
    [{ column: 'device', values: [NaN] }],
  ])('rejects invalid selections %j', (...filters) => {
    expect(() => sourceQuery(sql, columns, filters)).toThrow();
  });
  it.each([
    { column: 'event_time', start: '2026-02-30', end: '2026-03-01' },
    { column: 'event_time', start: '2026-10-02', end: '2026-10-01' },
    { column: 'event_time', start: '2026-10-01' },
    { column: 'device', start: '2026-10-01', end: '2026-10-02' },
    { column: 'event_time', start: "2026-10-01' OR true", end: '2026-10-02' },
  ])('rejects invalid dates %j', range => {
    expect(() => sourceQuery(sql, columns, [], range, ['event_time'])).toThrow();
  });

  describe('inclusive numeric range filters', () => {
    it('binds both endpoints inclusively and executes them as bound parameters', async () => {
      const query = sourceQuery(sql, columns, [{ column: 'amount', range: { min: 20, max: 100 } }]);
      expect(query.sql).toContain('"amount" >= ?');
      expect(query.sql).toContain('"amount" <= ?');
      expect(query.bindings).toEqual([20, 100]);
      expect((await worker.query(filename, query.sql, query.bindings)).datas).toEqual([
        { total: 120 },
      ]);
    });
    it('supports either bound on its own', async () => {
      const lower = sourceQuery(sql, columns, [{ column: 'amount', range: { min: 100 } }]);
      expect(lower.sql).not.toContain('<= ?');
      expect((await worker.query(filename, lower.sql, lower.bindings)).datas).toEqual([
        { total: 1100 },
      ]);
      const upper = sourceQuery(sql, columns, [{ column: 'amount', range: { max: 20 } }]);
      expect(upper.sql).not.toContain('>= ?');
      expect((await worker.query(filename, upper.sql, upper.bindings)).datas).toEqual([
        { total: 30 },
      ]);
      const single = sourceQuery(sql, columns, [
        { column: 'amount', range: { min: 100, max: 100 } },
      ]);
      expect((await worker.query(filename, single.sql, single.bindings)).datas).toEqual([
        { total: 100 },
      ]);
    });
    it.each([
      [{ column: 'amount', range: {} }],
      [{ column: 'amount', range: { min: 100, max: 20 } }],
      [{ column: 'amount', range: { min: '20' } }],
      [{ column: 'amount', range: { min: Number.NaN } }],
      [{ column: 'amount', range: { min: Number.POSITIVE_INFINITY } }],
      [{ column: 'amount', range: { min: null } }],
      [{ column: 'amount', range: { min: 1, extra: 2 } }],
      [{ column: 'amount', range: null }],
      [{ column: 'amount', range: [1, 2] }],
      [{ column: 'amount', values: [10], range: { min: 1 } }],
      [{ column: 'amount', value: 10, range: { min: 1 } }],
      [{ column: 'amount', range: { min: 1 }, extra: 1 }],
      [{ column: 'unknown', range: { min: 1 } }],
    ])('rejects invalid ranges %j', (...filters) => {
      expect(() => sourceQuery(sql, columns, filters)).toThrow();
    });
  });
});
