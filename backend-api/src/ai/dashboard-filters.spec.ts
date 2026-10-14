import { sourceQuery, numericSourceColumns } from './dashboard-draft';
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
  it.each([
    [{ min: 10, max: 20 }, 30],
    [{ min: 100 }, 1100],
    [{ max: 20 }, 30],
    [{ min: 20, max: 20 }, 20],
    [{ min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }, 1130],
  ])('applies inclusive numeric bounds %j using real DuckDB', async (range, total) => {
    const schema = (await worker.query(filename, 'DESCRIBE uploaded_data')).datas as any;
    const query = sourceQuery(
      sql,
      columns,
      [{ column: 'amount', range }],
      undefined,
      [],
      numericSourceColumns(schema),
    );
    expect((await worker.query(filename, query.sql, query.bindings)).datas).toEqual([{ total }]);
  });
  it('requires explicit numeric schema authorization and excludes collection types', () => {
    const filter = [{ column: 'amount', range: { min: 0 } }];
    expect(() => sourceQuery(sql, columns, filter)).toThrow('numeric');
    expect(() => sourceQuery(sql, columns, filter, undefined, [], ['device'])).toThrow('numeric');
    expect(
      numericSourceColumns([
        { column_name: 'money', column_type: 'DECIMAL(18,2)' },
        { column_name: 'huge', column_type: 'UHUGEINT' },
        { column_name: 'list', column_type: 'INTEGER[]' },
        { column_name: 'label', column_type: 'VARCHAR' },
        { column_name: 'time', column_type: 'TIMESTAMP' },
      ]),
    ).toEqual(['money', 'huge']);
  });
  it.each([
    {},
    { min: null },
    { max: '10' },
    { min: NaN },
    { min: Infinity },
    { max: Number.MAX_SAFE_INTEGER + 1 },
    { min: -Number.MAX_SAFE_INTEGER - 1 },
    { min: 2, max: 1 },
    { min: 0, extra: 1 },
    { min: undefined },
    null,
    [],
    { min: '0); DROP TABLE uploaded_data --' },
  ])('rejects malformed range %j', range => {
    expect(() =>
      sourceQuery(sql, columns, [{ column: 'amount', range }], undefined, [], ['amount']),
    ).toThrow();
  });
  it.each([
    [{ column: 'amount', range: { min: 0 }, values: [10] }],
    [{ column: 'amount', range: { min: 0 }, value: 10 }],
    [{ column: 'amount', range: { min: 0 }, extra: true }],
    [{ column: 'device', range: { min: 0 } }],
    [{ column: 'event_time', range: { min: 0 } }],
    [
      { column: 'amount', range: { min: 0 } },
      { column: 'amount', values: [10] },
    ],
    Array.from({ length: 6 }, (_, i) => ({ column: 'c' + i, range: { min: 0 } })),
  ])('rejects ambiguous, duplicate, nonnumeric or oversized range filters %j', (...filters) => {
    expect(() => sourceQuery(sql, columns, filters, undefined, [], ['amount'])).toThrow();
  });
});
