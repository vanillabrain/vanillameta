jest.mock('./ai.service', () => ({ AiService: class {} }));
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AiDashboardService } from './ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const draft = () => ({
  databaseId: 1,
  title: 'Source details',
  explanation: '',
  widgets: [
    {
      title: 'Restricted metric',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(amount) AS value FROM source WHERE amount > 1000',
      valueField: 'value',
    },
  ],
});
const success = (data: any) => ({ status: ResponseStatus.SUCCESS, data });

describe('dashboard details request and ownership contract', () => {
  let service: AiDashboardService;
  let connection: any;
  let analysis: jest.SpyInstance;
  const body = () => ({
    dashboardId: 42,
    draft: draft(),
    sourceRevision: 'snapshot-1',
    filters: [],
  });
  beforeEach(() => {
    connection = {
      withDuckDBSnapshot: jest.fn((_id, callback) => callback()),
      duckDBVersion: jest.fn().mockResolvedValue('snapshot-1'),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn(async (_id, sql) => {
        if (sql === 'DESCRIBE uploaded_data')
          return {
            datas: [
              { column_name: 'channel', column_type: 'VARCHAR' },
              { column_name: 'event_time', column_type: 'TIMESTAMP' },
              { column_name: 'amount', column_type: 'DOUBLE' },
            ],
          };
        if (/count\(\*\)/i.test(sql)) return { datas: [{ total: '9007199254740993' }] };
        return {
          fields: [
            { columnName: '__vm_detail_0', columnType: 'string' },
            { columnName: '__vm_detail_1', columnType: 'date' },
            { columnName: '__vm_detail_2', columnType: 'number' },
          ],
          datas: [{ __vm_detail_0: 'online', __vm_detail_1: null, __vm_detail_2: 0 }],
        };
      }),
    };
    service = new AiDashboardService({} as any, connection, {} as any);
    analysis = jest.spyOn(service, 'analysis').mockResolvedValue(success(draft()));
  });
  it('checks stored dashboard through analysis with the actor and preserves exact count strings and defaults', async () => {
    const result = await service.details(body(), 7);
    expect(analysis).toHaveBeenCalledWith(42, 7);
    expect(result).toEqual(
      success({
        fields: [
          { columnName: 'channel', columnType: 'string' },
          { columnName: 'event_time', columnType: 'date' },
          { columnName: 'amount', columnType: 'number' },
        ],
        datas: [{ channel: 'online', event_time: null, amount: 0 }],
        totalRows: '9007199254740993',
        page: 0,
        pageSize: 50,
        sourceRevision: 'snapshot-1',
        columnCount: 3,
        scope: 'current common-filter source rows',
      }),
    );
    expect(connection.withDuckDBSnapshot).toHaveBeenCalledTimes(1);
    expect(connection.queryDuckDB.mock.calls[1][1]).toMatch(/CAST\(count\(\*\) AS VARCHAR\)/i);
    expect(connection.queryDuckDB.mock.calls[2][1]).toContain('ORDER BY ALL LIMIT 50 OFFSET 0');
  });
  it('propagates dashboard owner rejection before a source snapshot or queries', async () => {
    analysis.mockRejectedValueOnce(new ForbiddenException('not dashboard owner'));
    await expect(service.details(body(), 8)).rejects.toBeInstanceOf(ForbiddenException);
    expect(analysis).toHaveBeenCalledWith(42, 8);
    expect(connection.withDuckDBSnapshot).not.toHaveBeenCalled();
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
  });
  it('rejects a draft source different from the stored dashboard source before querying', async () => {
    await expect(
      service.details({ ...body(), draft: { ...draft(), databaseId: 2 } }, 7),
    ).rejects.toThrow('source mismatch');
    expect(connection.withDuckDBSnapshot).not.toHaveBeenCalled();
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
  });
  it.each([
    { dashboardId: undefined },
    { dashboardId: 0 },
    { dashboardId: '42' },
    { page: -1 },
    { page: 10001 },
    { page: 0.5 },
    { page: '0' },
    { page: false },
    { page: null },
    { page: '0; DROP TABLE uploaded_data' },
    { pageSize: 0 },
    { pageSize: 49 },
    { pageSize: 1000 },
    { pageSize: '50' },
    { pageSize: false },
    { pageSize: null },
    { sourceRevision: undefined },
    { sourceRevision: null },
    { sourceRevision: false },
    { sourceRevision: '' },
    { sourceRevision: 'x'.repeat(257) },
  ])('rejects invalid identity/pagination/revision before data queries %j', async patch => {
    await expect(service.details({ ...body(), ...patch }, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
  });
  it.each([
    { filters: [{ column: 'channel" OR true --', values: ['online'] }] },
    { filters: [{ column: 'channel', values: [] }] },
    { filters: [{ column: 'channel', values: ['online'], value: 'retail' }] },
    { filters: [{ column: 'channel', values: [{}] }] },
    { filters: null },
    { dateRange: { column: 'event_time', start: "2026-01-01' OR true", end: '2026-01-02' } },
    { dateRange: { column: 'event_time', start: '2026-02-30', end: '2026-03-01' } },
    { dateRange: { column: 'channel', start: '2026-01-01', end: '2026-01-02' } },
  ])(
    'rejects malformed filters/date identifiers and injection before COUNT or rows %j',
    async patch => {
      await expect(service.details({ ...body(), ...patch }, 7)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(
        connection.queryDuckDB.mock.calls.filter(([, sql]) => sql !== 'DESCRIBE uploaded_data'),
      ).toEqual([]);
    },
  );
  it('returns conflict on a stale source revision before schema, COUNT or row queries', async () => {
    await expect(
      service.details({ ...body(), sourceRevision: 'older-snapshot' }, 7),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(connection.withDuckDBSnapshot).toHaveBeenCalledTimes(1);
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
  });
});

describe('dashboard details: actual DuckDB source rows', () => {
  let root: string;
  let worker: DuckDBService;
  let files: string[];
  let current: string;
  let connection: ConnectionService;
  let service: AiDashboardService;
  let query: jest.SpyInstance;
  let snapshot: jest.SpyInstance;
  let stored: ReturnType<typeof draft>;
  let runQuery: DuckDBService['query'];
  const oldRoot = process.env.FILE_UPLOAD_DIR;
  const rows = Array.from({ length: 65 }, (_, index) => {
    const id = 65 - index;
    return {
      id,
      channel: id % 3 === 0 ? null : id % 3 === 1 ? 'online' : 'retail',
      day: id <= 50 ? '2026-01-01' : '2026-01-02',
    };
  });
  const wideColumns = ['row id', ...Array.from({ length: 54 }, (_, index) => `extra_${index + 1}`)];
  wideColumns[2] = 'odd "name';
  const projectedColumns = [...wideColumns];
  projectedColumns[0] = 'row_id';
  projectedColumns[2] = 'odd__name';
  const body = async (patch: any = {}) => ({
    dashboardId: 42,
    draft: draft(),
    sourceRevision: await connection.duckDBVersion(1),
    filters: [],
    ...patch,
  });
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-details-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    runQuery = worker.query.bind(worker);
    const first = await worker.importFile({
      originalname: 'details.csv',
      buffer: Buffer.from(
        `"row id",channel,event_time,amount,"odd ""name"\n${rows
          .map(row => `${row.id},${row.channel ?? ''},${row.day} 12:00:00,${row.id},note-${row.id}`)
          .join('\n')}\n`,
      ),
    });
    const replacement = await worker.importFile({
      originalname: 'replacement.csv',
      buffer: Buffer.from(
        'row id,channel,event_time,amount\n999,replacement,2026-02-01 12:00:00,999\n',
      ),
    });
    const wide = await worker.importFile({
      originalname: 'wide.csv',
      buffer: Buffer.from(
        `${wideColumns.map(column => `"${column.replace(/"/g, '""')}"`).join(',')}\n${Array.from(
          { length: 55 },
          (_, index) => index,
        ).join(',')}\n`,
      ),
    });
    const propertyNames = await worker.importFile({
      originalname: 'property-names.csv',
      buffer: Buffer.from(
        'row_id,__proto__,constructor,amount\n3,,null-proto,30\n2,0,,20\n1,17,first,10\n4,,,40\n',
      ),
    });
    files = [first.filename, replacement.filename, wide.filename, propertyNames.filename];
  });
  beforeEach(() => {
    current = files[0];
    const repository = {
      manager: { connection: { options: { type: 'mysql' } } },
      findOne: jest.fn(async () => ({
        connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename: current } }),
      })),
    };
    connection = new ConnectionService(repository as any, {} as any, worker);
    service = new AiDashboardService({} as any, connection, {} as any);
    stored = draft();
    jest.spyOn(service, 'analysis').mockResolvedValue(success(stored));
    query = jest.spyOn(worker, 'query');
    snapshot = jest.spyOn(connection, 'withDuckDBSnapshot');
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (oldRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = oldRoot;
  });

  it('ANDs date range with NULL/multiple-value common filters and ignores widget WHERE without changing stored definition', async () => {
    const original = JSON.stringify(stored);
    const result = await service.details(
      await body({
        filters: [{ column: 'channel', values: ['online', null] }],
        dateRange: { column: 'event_time', start: '2026-01-01', end: '2026-01-01' },
      }),
      7,
    );
    const expected = rows
      .filter(row => row.day === '2026-01-01' && (row.channel === 'online' || row.channel === null))
      .sort((a, b) => a.id - b.id);
    expect(result.data.totalRows).toBe(String(expected.length));
    expect(result.data.datas.map(row => row.row_id)).toEqual(expected.map(row => row.id));
    expect(result.data.datas.some(row => row.channel === null)).toBe(true);
    expect(result.data.fields.map(field => field.columnName)).toEqual([
      'row_id',
      'channel',
      'event_time',
      'amount',
      'odd__name',
    ]);
    const dataCalls = query.mock.calls.filter(([, sql]) => sql !== 'DESCRIBE uploaded_data');
    expect(dataCalls).toHaveLength(2);
    for (const [filename, sql, bindings] of dataCalls) {
      expect(filename).toBe(files[0]);
      expect(sql).not.toContain('amount > 1000');
      expect(sql).toContain('IS NULL');
      expect(bindings).toEqual(['online', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z']);
    }
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(stored)).toBe(original);
    expect(result.data.scope).toBe('current common-filter source rows');
  });
  it('binds an injection-looking filter value as a literal rather than changing the raw WHERE', async () => {
    const injected = "online') OR true --";
    const result = await service.details(
      await body({ filters: [{ column: 'channel', values: [injected] }] }),
      7,
    );
    expect(result.data.totalRows).toBe('0');
    expect(result.data.datas).toEqual([]);
    for (const [, sql, bindings] of query.mock.calls.filter(
      ([, sql]) => sql !== 'DESCRIBE uploaded_data',
    )) {
      expect(sql).not.toContain(injected);
      expect(bindings).toEqual([injected]);
    }
  });
  it('returns stable non-overlapping pages in schema order, including an empty last page', async () => {
    const request = await body({ pageSize: 25 });
    const pages = [];
    for (let page = 0; page < 4; page++)
      pages.push((await service.details({ ...request, page }, 7)).data);
    expect(pages.map(page => page.datas.length)).toEqual([25, 25, 15, 0]);
    expect(pages.flatMap(page => page.datas.map(row => row.row_id))).toEqual(
      Array.from({ length: 65 }, (_, index) => index + 1),
    );
    expect(pages.every(page => page.totalRows === '65' && page.pageSize === 25)).toBe(true);
    expect((await service.details({ ...request, page: 1 }, 7)).data).toEqual(pages[1]);
    expect((await service.details({ ...request, page: 10000 }, 7)).data.datas).toEqual([]);
    expect(
      query.mock.calls
        .filter(([, sql]) => sql.includes('ORDER BY ALL'))
        .every(([, sql]) => /LIMIT 25 OFFSET \d+$/.test(sql)),
    ).toBe(true);
  });
  it.each([25, 50, 100])('accepts bounded pageSize %i', async pageSize => {
    const result = await service.details(await body({ pageSize }), 7);
    expect(result.data.datas).toHaveLength(Math.min(pageSize, 65));
    expect(result.data).toMatchObject({ page: 0, pageSize, totalRows: '65' });
  });
  it('projects only the first 50 quoted schema columns while filtering a non-projected column', async () => {
    current = files[2];
    const result = await service.details(
      await body({ filters: [{ column: 'extra_54', values: [54] }] }),
      7,
    );
    expect(result.data.columnCount).toBe(55);
    expect(result.data.fields.map(field => field.columnName)).toEqual(
      projectedColumns.slice(0, 50),
    );
    expect(Object.keys(result.data.datas[0])).toEqual(projectedColumns.slice(0, 50));
    expect(result.data.totalRows).toBe('1');
    expect(query.mock.calls.find(([, sql]) => sql.includes('ORDER BY ALL'))[1]).toContain(
      `SELECT ${projectedColumns
        .slice(0, 50)
        .map((column, index) => `"${column}" AS "__vm_detail_${index}"`)
        .join(', ')} FROM source`,
    );
    expect(result.data.datas[0]).not.toHaveProperty('extra_54');
  });
  it('preserves __proto__ and constructor source columns as own typed properties, including NULL and zero', async () => {
    current = files[3];
    const result = await service.details(await body(), 7);
    expect(result.data.fields).toEqual([
      { columnName: 'row_id', columnType: 'number' },
      { columnName: '__proto__', columnType: 'number' },
      { columnName: 'constructor', columnType: 'string' },
      { columnName: 'amount', columnType: 'number' },
    ]);
    expect(result.data.totalRows).toBe('4');
    expect(result.data.datas.map(row => row.__proto__)).toEqual([17, 0, null, null]);
    expect(result.data.datas.map(row => row.constructor)).toEqual([
      'first',
      null,
      'null-proto',
      null,
    ]);
    expect(result.data.datas.map(row => row.row_id)).toEqual([1, 2, 3, 4]);
    for (const row of result.data.datas) {
      expect(Object.keys(row)).toEqual(['row_id', '__proto__', 'constructor', 'amount']);
      expect(Object.prototype.hasOwnProperty.call(row, '__proto__')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(row, 'constructor')).toBe(true);
      expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
    }
    const serialized = JSON.parse(JSON.stringify(result.data.datas));
    // Compare entries so Jest's object-type checks do not treat the source's constructor as a class.
    expect(serialized.map(row => Object.entries(row))).toEqual(
      result.data.datas.map(row => Object.entries(row)),
    );
    const rowQuery = query.mock.calls.find(([, sql]) => sql.includes('ORDER BY ALL'));
    expect(rowQuery[0]).toBe(files[3]);
    expect(rowQuery[1]).toContain('"__proto__" AS "__vm_detail_1"');
    expect(rowQuery[1]).toContain('"constructor" AS "__vm_detail_2"');
    const filtered = await service.details(
      await body({ filters: [{ column: '__proto__', values: [null] }] }),
      7,
    );
    expect(filtered.data.totalRows).toBe('2');
    expect(filtered.data.datas.map(row => row.row_id)).toEqual([3, 4]);
    expect(filtered.data.datas.every(row => row.__proto__ === null)).toBe(true);
  });
  it('pins COUNT and rows to the expected file even when replacement occurs after COUNT; the next open rejects the old revision', async () => {
    const request = await body();
    query.mockImplementation(async (filename, sql, bindings) => {
      const result = await runQuery(filename, sql, bindings);
      if (/count\(\*\)/i.test(sql)) current = files[1];
      return result;
    });
    const first = await service.details(request, 7);
    expect(current).toBe(files[1]);
    expect(first.data).toMatchObject({ totalRows: '65', sourceRevision: request.sourceRevision });
    expect(first.data.datas).toHaveLength(50);
    expect(first.data.datas[0].row_id).toBe(1);
    expect(query.mock.calls.every(([filename]) => filename === files[0])).toBe(true);
    query.mockClear();
    await expect(service.details(request, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(query).not.toHaveBeenCalled();
  });
});
