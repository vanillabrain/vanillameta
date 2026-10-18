jest.mock('./ai.service', () => ({ AiService: class {} }));
import { AiDashboardService } from './ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DuckDBService } from '../analysis/duckdb.service';
import { sourceQuery } from './dashboard-draft';
import { dateRangeBounds, isoSecond, resolveBusinessDateRange } from './dashboard-date-range';
import { previousDateRange } from './dashboard-period';
import { buildTrendQuery } from './dashboard-trend';
import { contributionGroupFingerprint } from './dashboard-contribution';

describe('business-date adapter through real DuckDB filtering', () => {
  let worker: DuckDBService;
  let root: string;
  let filename: string;
  let service: AiDashboardService;
  let connection: ConnectionService;
  const draft = {
    databaseId: 1,
    title: 'Business dates',
    explanation: '',
    widgets: [
      {
        title: 'Sales',
        description: '',
        type: 'BOARD_NUMERIC',
        sql: 'SELECT sum(amount) AS value FROM source',
        valueField: 'value',
      },
    ],
  };
  const previousRoot = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-business-time-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    filename = (
      await worker.importFile({
        originalname: 'times.csv',
        buffer: Buffer.from(
          'event_time,scenario,amount\n' +
            '2025-12-31T14:59:59.999Z,kst,1000\n' +
            '2025-12-31T15:00:00Z,kst,10\n' +
            '2026-01-01T23:59:59.999+09:00,kst,20\n' +
            '2026-01-01T15:00:00Z,kst,1000\n' +
            ',kst,1000\n' +
            '2026-03-07T05:00:00Z,spring,40\n' +
            '2026-03-08T04:59:59.999Z,spring,50\n' +
            '2026-03-08T05:00:00Z,spring,10\n' +
            '2026-03-09T03:59:59.999Z,spring,20\n' +
            '2026-03-09T04:00:00Z,spring,1000\n' +
            '2026-11-01T03:59:59.999Z,fall,1000\n' +
            '2026-11-01T04:00:00Z,fall,10\n' +
            '2026-11-01T01:30:00-04:00,fall,20\n' +
            '2026-11-01T01:30:00-05:00,fall,30\n' +
            '2026-11-02T04:59:59.999Z,fall,40\n' +
            '2026-11-02T05:00:00Z,fall,1000\n',
        ),
      })
    ).filename;
    connection = new ConnectionService(
      {
        manager: { connection: { options: { type: 'mysql' } } },
        findOne: async () => ({
          connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
        }),
      } as any,
      {} as any,
      worker,
    );
    service = new AiDashboardService({} as any, connection, {
      manager: { findOne: jest.fn(async () => null) },
    } as any);
    jest
      .spyOn(service, 'analysis')
      .mockImplementation(async () => ({ status: 'SUCCESS', data: draft } as any));
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });
  const run = (sql: string, scenario: string, start: string, zone: string) => {
    const query = sourceQuery(
      sql,
      ['event_time', 'scenario', 'amount'],
      [{ column: 'scenario', value: scenario }],
      resolveBusinessDateRange({ column: 'event_time', start, end: start }, zone),
      ['event_time'],
    );
    return worker.query(filename, query.sql, query.bindings);
  };
  it.each([
    ['kst', '2026-01-01', 'Asia/Seoul', [10, 20], 30],
    ['spring', '2026-03-08', 'America/New_York', [10, 20], 30],
    ['fall', '2026-11-01', 'America/New_York', [10, 20, 30, 40], 100],
  ])(
    '%s includes start and fractional last instant, excludes end and NULL',
    async (scenario, date, zone, amounts, total) => {
      const aggregate = await run('SELECT sum(amount) AS value FROM source', scenario, date, zone);
      const details = await run('SELECT amount FROM source ORDER BY amount', scenario, date, zone);
      expect(Number(aggregate.datas[0].value)).toBe(total);
      expect(details.datas.map(row => Number(row.amount))).toEqual(amounts);
    },
  );
  it('derives previous civil dates before converting to UTC across DST', async () => {
    const current = { column: 'event_time', start: '2026-03-08', end: '2026-03-08' };
    const prior = previousDateRange(current, 'America/New_York');
    const aggregate = await run(
      'SELECT sum(amount) AS value FROM source',
      'spring',
      prior.start,
      'America/New_York',
    );
    expect(Number(aggregate.datas[0].value)).toBe(90);
  });
  it.each([
    ['kst', '2026-01-01', 'Asia/Seoul', 30, '2'],
    ['spring', '2026-03-08', 'America/New_York', 30, '2'],
    ['fall', '2026-11-01', 'America/New_York', 100, '4'],
  ])(
    'public preview and raw details share %s timezone',
    async (scenario, start, timeZone, expected, rows) => {
      const dateRange = { column: 'event_time', start, end: start, timeZone };
      const filters = [{ column: 'scenario', values: [scenario] }];
      const preview = await service.preview({ draft, filters, dateRange, includeTrends: true }, 7);
      expect(Number(preview.data.widgets[0].datas[0].value)).toBe(expected);
      expect(preview.data.widgets[0].trend).toMatchObject({
        timeZone,
        grain: 'day',
        points: [{ value: expected }],
      });
      expect(preview.data.widgets[0].trend.points[0].time).toBe(
        new Date(dateRangeBounds(dateRange).start).toISOString().replace('.000Z', 'Z'),
      );
      const bounds = dateRangeBounds(dateRange);
      expect(preview.data.widgets[0].trend.timeSelection).toEqual({
        column: 'event_time',
        grain: 'day',
        ranges: [
          {
            column: 'event_time',
            start: isoSecond(bounds.start),
            end: isoSecond(bounds.end),
            precision: 'timestamp',
            timeZone,
          },
        ],
      });
      expect(preview.data.widgets[0].trend.contribution).toEqual({
        supported: true,
        groupFingerprint: contributionGroupFingerprint([isoSecond(bounds.start)]),
      });
      const detail = await service.details(
        { dashboardId: 42, draft, filters, dateRange, sourceRevision: preview.data.sourceRevision },
        7,
      );
      expect(detail.data.totalRows).toBe(rows);
      expect(detail.data.datas.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(expected);
    },
  );
  it('public comparison derives previous civil day before timezone conversion', async () => {
    const result = await service.preview(
      {
        draft,
        filters: [{ column: 'scenario', values: ['spring'] }],
        dateRange: {
          column: 'event_time',
          start: '2026-03-08',
          end: '2026-03-08',
          timeZone: 'America/New_York',
        },
        comparePrevious: true,
      },
      7,
    );
    expect(result.data.widgets[0].comparison).toMatchObject({ previousValue: 90, delta: -60 });
    expect(result.data.comparison.previous).toEqual({
      column: 'event_time',
      start: '2026-03-07',
      end: '2026-03-07',
      timeZone: 'America/New_York',
    });
  });
  it.each([
    ['kst', '2026-01-01', 'Asia/Seoul', 'week', '2025-12-28T15:00:00Z', 30],
    ['kst', '2026-01-01', 'Asia/Seoul', 'month', '2025-12-31T15:00:00Z', 30],
    ['spring', '2026-03-08', 'America/New_York', 'week', '2026-03-02T05:00:00Z', 30],
    ['spring', '2026-03-08', 'America/New_York', 'month', '2026-03-01T05:00:00Z', 30],
    ['fall', '2026-11-01', 'America/New_York', 'week', '2026-10-26T04:00:00Z', 100],
    ['fall', '2026-11-01', 'America/New_York', 'month', '2026-11-01T04:00:00Z', 100],
  ])(
    'regional %s %s %s %s groups only filtered rows',
    async (scenario, day, timeZone, trendGrain, time, value) => {
      const result = await service.preview(
        {
          draft,
          filters: [{ column: 'scenario', values: [scenario] }],
          dateRange: { column: 'event_time', start: day, end: day, timeZone },
          trendGrain,
          includeTrends: true,
        },
        7,
      );
      expect(result.data.widgets[0].trend).toMatchObject({
        timeZone,
        grain: trendGrain,
        points: [{ time, value }],
      });
    },
  );
  it('regional current and previous daily trends keep their original bucket instants', async () => {
    const result = await service.preview(
      {
        draft,
        filters: [{ column: 'scenario', values: ['spring'] }],
        dateRange: {
          column: 'event_time',
          start: '2026-03-08',
          end: '2026-03-08',
          timeZone: 'America/New_York',
        },
        trendGrain: 'day',
        includeTrends: true,
        comparePrevious: true,
      },
      7,
    );
    expect(result.data.widgets[0].trend.points).toEqual([
      { time: '2026-03-08T05:00:00Z', value: 30 },
    ]);
    expect(result.data.widgets[0].previousTrend.points).toEqual([
      { time: '2026-03-07T05:00:00Z', value: 90 },
    ]);
  });
  it.each([
    ['kst', '2026-01-01', 'Asia/Seoul', 'day', 30],
    ['kst', '2026-01-01', 'Asia/Seoul', 'week', 30],
    ['kst', '2026-01-01', 'Asia/Seoul', 'month', 30],
    ['spring', '2026-03-08', 'America/New_York', 'day', 30],
    ['fall', '2026-11-01', 'America/New_York', 'day', 100],
  ])(
    'regional %s %s %s %s point contributors match preview',
    async (scenario, day, timeZone, trendGrain, total) => {
      const revision = 'a'.repeat(64);
      (service.analysis as jest.Mock).mockResolvedValue({
        status: 'SUCCESS',
        data: { ...draft, revision },
      });
      const dateRange = { column: 'event_time', start: day, end: day, timeZone };
      const filters = [{ column: 'scenario', values: [scenario] }];
      const preview = await service.preview(
        { draft, filters, dateRange, trendGrain, includeTrends: true },
        7,
      );
      const trend = preview.data.widgets[0].trend;
      const body = {
        dashboardId: 42,
        draft,
        filters,
        dateRange,
        sourceRevision: preview.data.sourceRevision,
        contribution: {
          widgetIndex: 0,
          expectedRevision: revision,
          trendGrain,
          trendPoint: {
            column: trend.column,
            grain: trend.grain,
            time: trend.points[0].time,
            groupFingerprint: trend.contribution.groupFingerprint,
          },
        },
      };
      const detail = await service.details(body, 7);
      expect(detail.data.datas.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(total);
      await expect(
        service.details(
          {
            ...body,
            contribution: {
              ...body.contribution,
              trendPoint: { ...body.contribution.trendPoint, groupFingerprint: 'b'.repeat(64) },
            },
          },
          7,
        ),
      ).rejects.toThrow('그룹');
    },
  );
  it('regional previous point keeps the prior civil period', async () => {
    const revision = 'a'.repeat(64);
    (service.analysis as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: { ...draft, revision },
    });
    const dateRange = {
      column: 'event_time',
      start: '2026-03-08',
      end: '2026-03-08',
      timeZone: 'America/New_York',
    };
    const filters = [{ column: 'scenario', values: ['spring'] }];
    const preview = await service.preview(
      { draft, filters, dateRange, trendGrain: 'day', includeTrends: true, comparePrevious: true },
      7,
    );
    const trend = preview.data.widgets[0].previousTrend;
    const detail = await service.details(
      {
        comparePrevious: true,
        dashboardId: 42,
        draft,
        filters,
        dateRange,
        sourceRevision: preview.data.sourceRevision,
        contribution: {
          widgetIndex: 0,
          expectedRevision: revision,
          trendGrain: 'day',
          period: 'previous',
          trendPoint: {
            column: trend.column,
            grain: trend.grain,
            time: trend.points[0].time,
            groupFingerprint: trend.contribution.groupFingerprint,
          },
        },
      },
      7,
    );
    expect(detail.data.datas.map(row => Number(row.amount)).sort()).toEqual([40, 50]);
  });
  it('rejects invalid timezone on preview rather than falling back to UTC', async () => {
    await expect(
      service.preview(
        {
          draft,
          dateRange: {
            column: 'event_time',
            start: '2026-01-01',
            end: '2026-01-01',
            timeZone: 'Asia/Unknown',
          },
        },
        7,
      ),
    ).rejects.toThrow('timezone');
  });
  it('treats a DATE column as a civil date without shifting it', async () => {
    const dateFile = (
      await worker.importFile({
        originalname: 'days.csv',
        buffer: Buffer.from('event_date,amount\n2026-01-01,10\n2026-01-02,20\n'),
      })
    ).filename;
    const query = sourceQuery(
      'SELECT sum(amount) AS value FROM source',
      ['event_date', 'amount'],
      [],
      {
        column: 'event_date',
        start: '2026-01-01',
        end: '2026-01-01',
        timeZone: 'America/New_York',
      },
      ['event_date'],
    );
    expect(Number((await worker.query(dateFile, query.sql, query.bindings)).datas[0].value)).toBe(
      10,
    );
    const trend = buildTrendQuery(
      'SELECT sum(amount) AS value FROM source',
      'value',
      'event_date',
      'day',
      [],
      { timeZone: 'America/New_York', columnType: 'DATE' },
    );
    const grouped = await worker.query(
      dateFile,
      `WITH source AS (SELECT * FROM uploaded_data) ${trend.sql}`,
    );
    expect(grouped.datas.map(row => [row[trend.timeField], Number(row[trend.valueAlias])])).toEqual(
      [
        ['2026-01-01', 10],
        ['2026-01-02', 20],
      ],
    );
  });
});
