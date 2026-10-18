jest.mock('./ai.service', () => ({ AiService: class {} }));
import { AiDashboardService } from './ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { DuckDBService } from '../analysis/duckdb.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const draft = () => ({
  databaseId: 1,
  title: 'Revenue',
  explanation: '',
  widgets: [
    {
      title: 'Revenue',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
    },
    {
      title: 'Devices',
      description: '',
      type: 'CHART_COLUMN',
      sql: 'SELECT device, sum(amount) AS value FROM source GROUP BY device',
      valueField: 'value',
      categoryField: 'device',
    },
  ],
});

describe('AI dashboard preview file snapshots', () => {
  let root: string;
  let worker: DuckDBService;
  let files: string[];
  const uploadRoot = process.env.FILE_UPLOAD_DIR;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-snapshot-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    files = [];
    for (const rows of [
      'phone,10,2026-01-01T00:00:00Z\nphone,20,2026-01-02T00:00:00Z\n',
      'tablet,300,2026-02-01T00:00:00Z\ntablet,400,2026-02-02T00:00:00Z\n',
    ]) {
      const file = await worker.importFile({
        originalname: 'metrics.csv',
        buffer: Buffer.from(`device,amount,event_time\n${rows}`),
      });
      files.push(file.filename);
    }
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (uploadRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = uploadRoot;
  });

  it('pins schema, widgets, dimensions and trends; refreshes cached options for a new file with the same schema', async () => {
    let current = files[0];
    const repository = {
      findOne: jest.fn(async () => ({
        connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename: current } }),
      })),
    };
    const connection = new ConnectionService(repository as any, {} as any, worker);
    const service = new AiDashboardService({} as any, connection, {
      manager: { findOne: jest.fn(async () => null) },
    } as any);
    const oldRevision = await connection.duckDBVersion(1);
    const query = worker.query.bind(worker);
    let replaced = false;
    const calls = jest
      .spyOn(worker, 'query')
      .mockImplementation(async (filename, sql, bindings) => {
        const result = await query(filename, sql, bindings);
        // Replace after the first widget, leaving dimensions and trend queries pending.
        if (!replaced && sql.includes('SELECT sum(amount) AS value FROM source')) {
          current = files[1];
          replaced = true;
        }
        return result;
      });
    try {
      const body = { draft: draft(), includeTrends: true };
      const first = (await service.preview(body, 7)).data;
      expect(replaced).toBe(true);
      expect(first.sourceRevision).toBe(oldRevision);
      expect(first.widgets[0].datas).toEqual([{ value: 30 }]);
      expect(first.widgets[1].datas).toEqual([{ device: 'phone', value: 30 }]);
      expect(first.dimensions).toEqual([{ column: 'device', values: ['phone'] }]);
      expect(first.temporalColumns).toEqual([
        { column: 'event_time', min: '2026-01-01', max: '2026-01-02' },
      ]);
      expect(first.widgets[0].trend.points).toEqual([
        { time: '2026-01-01T00:00:00Z', value: 10 },
        { time: '2026-01-02T00:00:00Z', value: 20 },
      ]);
      expect(calls.mock.calls[0][1]).toBe('DESCRIBE uploaded_data');
      expect(calls.mock.calls.every(call => call[0] === files[0])).toBe(true);

      calls.mockClear();
      const second = (await service.preview(body, 7)).data;
      expect(second.sourceRevision).toBe(await connection.duckDBVersion(1));
      expect(second.sourceRevision).not.toBe(oldRevision);
      expect(second.widgets[0].datas).toEqual([{ value: 700 }]);
      expect(second.widgets[1].datas).toEqual([{ device: 'tablet', value: 700 }]);
      expect(second.dimensions).toEqual([{ column: 'device', values: ['tablet'] }]);
      expect(second.temporalColumns).toEqual([
        { column: 'event_time', min: '2026-02-01', max: '2026-02-02' },
      ]);
      expect(second.widgets[0].trend.points).toEqual([
        { time: '2026-02-01T00:00:00Z', value: 300 },
        { time: '2026-02-02T00:00:00Z', value: 400 },
      ]);
      expect(calls.mock.calls.every(call => call[0] === files[1])).toBe(true);
      expect(calls.mock.calls.filter(call => call[1].startsWith('SELECT DISTINCT'))).toHaveLength(
        1,
      );
      calls.mockClear();
      expect((await service.preview(body, 7)).data.dimensions).toEqual(second.dimensions);
      expect(calls.mock.calls.some(call => call[1].startsWith('SELECT DISTINCT'))).toBe(false);
      expect(calls.mock.calls.some(call => call[1].startsWith('SELECT CAST'))).toBe(false);
    } finally {
      calls.mockRestore();
    }
  });

  it('validates the draft before acquiring a snapshot', async () => {
    const connection = { withDuckDBSnapshot: jest.fn() };
    const service = new AiDashboardService({} as any, connection as any, {} as any);
    await expect(service.preview({ draft: { databaseId: 1 } }, 7)).rejects.toThrow();
    expect(connection.withDuckDBSnapshot).not.toHaveBeenCalled();
  });
});
