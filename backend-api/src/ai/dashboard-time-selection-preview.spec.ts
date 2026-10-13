jest.mock('./ai.service', () => ({ AiService: class {} }));
import { AiDashboardService } from './ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { DuckDBService } from '../analysis/duckdb.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('time selection: actual UTC DuckDB preview and details', () => {
  let worker: DuckDBService;
  let service: AiDashboardService;
  let connection: ConnectionService;
  let filename: string;
  let root: string;
  const oldRoot = process.env.FILE_UPLOAD_DIR;
  const draft = (category = "date_trunc('hour', event_time)") => ({
    databaseId: 1,
    title: 'UTC buckets',
    explanation: '',
    widgets: [
      {
        title: 'Sales',
        description: '',
        type: 'BOARD_NUMERIC',
        sql: 'SELECT sum(amount) AS value FROM source',
        valueField: 'value',
      },
      {
        title: 'Sales by time',
        description: '',
        type: 'CHART_LINE',
        sql: `SELECT ${category} AS dimension, sum(amount) AS value FROM source GROUP BY ${category} ORDER BY dimension LIMIT 500`,
        valueField: 'value',
        categoryField: 'dimension',
      },
    ],
  });
  const selected = {
    column: 'event_time',
    start: '2024-02-29T12:30:00Z',
    end: '2024-02-29T13:00:00Z',
    precision: 'timestamp' as const,
  };
  const stamp = (start: string, end: string) => ({
    column: 'event_time',
    start,
    end,
    precision: 'timestamp',
  });
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'time-selection-preview-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    filename = (
      await worker.importFile({
        originalname: 'events.csv',
        buffer: Buffer.from(
          'event_time,channel,amount\n' +
            '2024-02-29T11:30:00Z,online,5\n' +
            '2024-02-29T12:29:59Z,online,7\n' +
            '2024-02-29T12:30:00Z,online,10\n' +
            '2024-02-29T12:45:00Z,online,20\n' +
            '2024-02-29T12:59:59.999Z,online,30\n' +
            '2024-02-29T21:50:00+09:00,online,4\n' +
            '2024-02-29T13:00:00Z,online,100\n' +
            '2024-03-01T00:00:00Z,online,40\n' +
            '2024-03-04T10:00:00Z,retail,50\n' +
            ',online,99\n',
        ),
      })
    ).filename;
    const repository = {
      findOne: jest.fn(async () => ({
        connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
      })),
    };
    connection = new ConnectionService(repository as any, {} as any, worker);
    service = new AiDashboardService({} as any, connection, {} as any);
    jest
      .spyOn(service, 'analysis')
      .mockImplementation(async () => ({ status: 'SUCCESS', data: draft() } as any));
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (oldRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = oldRoot;
  });
  const preview = (options: any = {}, category?: string) =>
    service.preview({ draft: draft(category), includeTrends: true, ...options }, 7);
  const details = async (dateRange: any, filters: any[] = []) =>
    service.details(
      {
        dashboardId: 42,
        draft: draft(),
        sourceRevision: await connection.duckDBVersion(1),
        dateRange,
        filters,
      },
      7,
    );

  it('offers true hour ranges aligned to both original line rows and KPI auto points, including NULL rows', async () => {
    const { data } = await preview();
    const [kpi, chart] = data.widgets;
    expect(kpi.trend.grain).toBe('hour');
    expect(chart.timeSelection).toMatchObject({ column: 'event_time', grain: 'hour' });
    expect(chart.timeSelection.ranges).toHaveLength(chart.datas.length);
    expect(kpi.trend.timeSelection.ranges).toHaveLength(kpi.trend.points.length);
    const point = kpi.trend.points.findIndex(p => p.time === '2024-02-29T12:00:00Z');
    expect(kpi.trend.points[point].value).toBe(71);
    const selection = kpi.trend.timeSelection.ranges[point];
    expect(selection).toEqual(stamp('2024-02-29T12:00:00Z', '2024-02-29T13:00:00Z'));
    expect(chart.timeSelection.ranges).toContainEqual(selection);
    expect(
      kpi.trend.timeSelection.ranges[kpi.trend.points.findIndex(p => p.time === null)],
    ).toBeNull();
    const raw = await details(selection);
    expect(raw.data.totalRows).toBe('5');
    expect(raw.data.datas.map(row => row.amount).sort((a, b) => a - b)).toEqual([4, 7, 10, 20, 30]);
  });
  it('clips an hour to the applied seconds and compares the immediately preceding equal seconds', async () => {
    const { data } = await preview({ dateRange: selected, comparePrevious: true });
    expect(data.widgets[0].datas).toEqual([{ value: 64 }]);
    expect(data.widgets[0].comparison).toEqual({
      previousValue: 7,
      delta: 57,
      percentChange: (57 / 7) * 100,
    });
    expect(data.comparison).toEqual({
      current: selected,
      previous: stamp('2024-02-29T12:00:00Z', selected.start),
    });
    expect(data.widgets[0].trend.timeSelection.ranges).toEqual([selected]);
    expect(data.widgets[1].timeSelection.ranges).toEqual([selected]);
    expect(
      data.queries
        .filter(q => q.kind === 'widget')
        .every(q => JSON.stringify(q.bindings) === JSON.stringify([selected.start, selected.end])),
    ).toBe(true);
    const raw = await details(selected, [{ column: 'channel', values: ['online'] }]);
    expect(raw.data.totalRows).toBe('4');
    expect(raw.data.datas.reduce((sum, row) => sum + row.amount, 0)).toBe(64);
  });
  it('rebuckets explicit week/month from source rows and clips both chart and KPI to partial calendar buckets', async () => {
    const dateRange = { column: 'event_time', start: '2024-02-29', end: '2024-03-01' };
    const weekly = (await preview({ dateRange, trendGrain: 'week' }, 'event_time')).data;
    expect(weekly.widgets[1].datas).toEqual([{ dimension: '2024-02-26T00:00:00Z', value: 216 }]);
    expect(weekly.widgets[1].timeSelection).toEqual({
      column: 'event_time',
      grain: 'week',
      ranges: [stamp('2024-02-29T00:00:00Z', '2024-03-02T00:00:00Z')],
    });
    expect(weekly.widgets[0].trend.timeSelection).toEqual(weekly.widgets[1].timeSelection);
    const monthly = (await preview({ dateRange, trendGrain: 'month' }, 'event_time')).data;
    expect(monthly.widgets[1].datas.map(row => row.value)).toEqual([176, 40]);
    expect(monthly.widgets[1].timeSelection.ranges).toEqual([
      stamp('2024-02-29T00:00:00Z', '2024-03-01T00:00:00Z'),
      stamp('2024-03-01T00:00:00Z', '2024-03-02T00:00:00Z'),
    ]);
    expect(monthly.widgets[0].trend.timeSelection.ranges).toEqual(
      monthly.widgets[1].timeSelection.ranges,
    );
    expect((await details(monthly.widgets[1].timeSelection.ranges[0])).data.totalRows).toBe('7');
  });
  it('retains old inclusive day filtering without selecting the following midnight', async () => {
    const dateRange = { column: 'event_time', start: '2024-02-29', end: '2024-02-29' };
    expect((await preview({ dateRange })).data.widgets[0].datas).toEqual([{ value: 176 }]);
    expect((await details(dateRange)).data.totalRows).toBe('7');
  });
  it.each(['event_time', "strftime(event_time, '%Y-%m-%dT%H:%M:%SZ')", 'channel'])(
    'does not invent original chart bucket metadata for %s',
    async category => {
      const { data } = await preview({}, category);
      expect(data.widgets[1].datas.length).toBeGreaterThan(0);
      expect(data.widgets[1].timeSelection).toBeUndefined();
    },
  );
  it('proves strftime calendar month and native date_trunc week for original auto charts', async () => {
    const month = (await preview({}, "strftime(event_time, '%Y-%m')")).data.widgets[1];
    expect(month.timeSelection.ranges[0]).toEqual(
      stamp('2024-02-01T00:00:00Z', '2024-03-01T00:00:00Z'),
    );
    const week = (await preview({}, "date_trunc('week', event_time)")).data.widgets[1];
    expect(week.timeSelection.ranges[0]).toEqual(
      stamp('2024-02-26T00:00:00Z', '2024-03-04T00:00:00Z'),
    );
  });
  it('preserves timestamp precision, comparison and aligned metadata in bounded AI context', async () => {
    const context = await (service as any).previewContext(
      { dateRange: selected, comparePrevious: true },
      draft(),
      7,
    );
    expect(context.dateRange).toEqual(selected);
    expect(context.period).toBe('selected UTC timestamps [start, end)');
    expect(context.comparison.previous.precision).toBe('timestamp');
    expect(context.widgets[0].trend.timeSelection.ranges).toEqual([selected]);
    expect(context.widgets[1].timeSelection.ranges).toEqual([selected]);
  });
  it.each([
    { ...selected, precision: 'day' },
    { ...selected, start: '2024-02-30T12:30:00Z' },
    { ...selected, column: 'channel' },
    { ...selected, extra: true },
    { ...selected, end: selected.start },
    { ...selected, start: "2024-02-29T12:30:00Z' OR true" },
  ])(
    'rejects invalid timestamp preview and detail scopes before executing data queries %j',
    async dateRange => {
      const query = jest.spyOn(connection, 'queryDuckDB');
      try {
        await expect(preview({ dateRange })).rejects.toThrow();
        await expect(details(dateRange)).rejects.toThrow();
        expect(query.mock.calls.every(([, sql]) => sql === 'DESCRIBE uploaded_data')).toBe(true);
      } finally {
        query.mockRestore();
      }
    },
  );
  it('declines a chart action that would replace a different temporal column filter', async () => {
    const original = filename;
    filename = (
      await worker.importFile({
        originalname: 'two-dates.csv',
        buffer: Buffer.from(
          'event_time,other_time,channel,amount\n2024-01-01 10:00:00,2024-02-29 12:00:00,online,10\n2024-01-02 10:00:00,2024-03-01 12:00:00,online,100\n',
        ),
      })
    ).filename;
    try {
      const { data } = await preview({
        dateRange: { column: 'other_time', start: '2024-02-29', end: '2024-02-29' },
      });
      expect(data.widgets[1].datas).toEqual([{ dimension: '2024-01-01 10:00:00', value: 10 }]);
      expect(data.widgets[1].timeSelection).toBeUndefined();
      expect(data.widgets[0].trend.timeSelection.column).toBe('other_time');
      const cleared = (await preview()).data.widgets[1];
      expect(cleared.timeSelection.column).toBe('event_time');
      expect(cleared.timeSelection.ranges).toHaveLength(2);
    } finally {
      filename = original;
    }
  });
  it('does not offer original selection metadata or a sliced rebuilt chart at 241 buckets', async () => {
    const original = filename;
    const rows = Array.from(
      { length: 242 },
      (_, i) => `${new Date(Date.UTC(2024, 0, 1) + i * 86400000).toISOString()},online,1`,
    );
    filename = (
      await worker.importFile({
        originalname: 'large.csv',
        buffer: Buffer.from(`event_time,channel,amount\n${rows.join('\n')}\n`),
      })
    ).filename;
    try {
      const auto = (await preview({}, "date_trunc('day', event_time)")).data;
      expect(auto.widgets[1].datas).toHaveLength(242);
      expect(auto.widgets[1].timeSelection).toBeUndefined();
      const day = (await preview({ trendGrain: 'day' })).data;
      expect(day.widgets[1].datas).toEqual([]);
      expect(day.widgets[1].timeSelection).toBeUndefined();
      expect(day.widgets[0].trend).toBeUndefined();
      expect(day.widgets[0].trendUnavailable).toContain('240');
    } finally {
      filename = original;
    }
  });
});
