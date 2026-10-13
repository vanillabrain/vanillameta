jest.mock('./ai.service', () => ({ AiService: class {} }));
import { AiDashboardService } from './ai-dashboard.service';
import { DuckDBService } from '../analysis/duckdb.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('period comparison and grain: actual DuckDB preview', () => {
  let worker: DuckDBService;
  let service: AiDashboardService;
  let connection: any;
  let filename: string;
  let root: string;
  const oldRoot = process.env.FILE_UPLOAD_DIR;
  const draft = () => ({
    databaseId: 1,
    title: 'Period metrics',
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
        title: 'Daily sales',
        description: '',
        type: 'CHART_LINE',
        sql: 'SELECT "day" AS dimension, sum(amount) AS value FROM source GROUP BY "day" ORDER BY dimension LIMIT 500',
        valueField: 'value',
        categoryField: 'dimension',
      },
    ],
  });
  const range = { column: 'day', start: '2026-01-11', end: '2026-01-12' };
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'period-preview-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    filename = (
      await worker.importFile({
        originalname: 'sales.csv',
        buffer: Buffer.from(
          'day,channel,amount,numerator,denominator\n2026-01-08,online,0,0,0\n2026-01-10,online,10,100,2\n2026-01-11,retail,20,20,0\n2026-01-12,online,30,100,10\n',
        ),
      })
    ).filename;
    connection = {
      isDuckDB: jest.fn().mockResolvedValue(true),
      duckDBVersion: jest.fn(() => Promise.resolve(filename)),
      withDuckDBSnapshot: jest.fn((_id, callback) => callback()),
      queryDuckDB: jest.fn((_id, sql, bindings) => worker.query(filename, sql, bindings)),
    };
    service = new AiDashboardService({} as any, connection, {} as any);
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (oldRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = oldRoot;
  });
  it('accepts numeric ranges and rejects text/date ranges before dashboard queries', async () => {
    const result = await service.preview(
      { draft: draft(), filters: [{ column: 'amount', range: { min: 20, max: 30 } }] },
      1,
    );
    expect(result.data.widgets[0].datas[0].value).toBe(50);
    for (const column of ['channel', 'day', 'unknown']) {
      const calls = connection.queryDuckDB.mock.calls.length;
      await expect(
        service.preview({ draft: draft(), filters: [{ column, range: { min: 1 } }] }, 1),
      ).rejects.toThrow('숫자 열');
      // Schema discovery may query, but no filtered SQL should run after rejection.
      expect(
        connection.queryDuckDB.mock.calls.slice(calls).some((call: any[]) => call[2]?.includes(1)),
      ).toBe(false);
    }
  });
  it('uses the preceding equal-length UTC interval, identical filters and one pinned snapshot', async () => {
    connection.withDuckDBSnapshot.mockClear();
    const result = await service.preview(
      {
        draft: draft(),
        dateRange: range,
        comparePrevious: true,
        trendGrain: 'day',
        includeTrends: true,
        filters: [{ column: 'channel', values: ['online', 'retail'] }],
      },
      7,
    );
    expect(result.data.comparison).toEqual({
      current: range,
      previous: { column: 'day', start: '2026-01-09', end: '2026-01-10' },
    });
    expect(result.data.widgets[0].datas).toEqual([{ value: 50 }]);
    expect(result.data.widgets[0].comparison).toEqual({
      previousValue: 10,
      delta: 40,
      percentChange: 400,
    });
    expect(result.data.widgets[1].previousDatas).toEqual([
      { dimension: '2026-01-10T00:00:00Z', value: 10 },
    ]);
    expect(
      result.data.queries
        .filter(q => q.kind === 'previous-widget')
        .every(
          q =>
            JSON.stringify(q.bindings) ===
            JSON.stringify(['online', 'retail', '2026-01-09T00:00:00Z', '2026-01-11T00:00:00Z']),
        ),
    ).toBe(true);
    expect(connection.withDuckDBSnapshot).toHaveBeenCalledTimes(1);
  });
  it('recomputes a ratio per week and month from raw rows, with Monday week boundaries', async () => {
    const ratio = draft();
    ratio.widgets.forEach(w => {
      w.sql = w.sql.replace('sum(amount)', 'sum(numerator) / nullif(sum(denominator), 0)');
    });
    const weekly = await service.preview(
      { draft: ratio, includeTrends: true, trendGrain: 'week' },
      7,
    );
    expect(weekly.data.widgets[0].trend.points).toEqual([
      { time: '2026-01-05T00:00:00Z', value: 60 },
      { time: '2026-01-12T00:00:00Z', value: 10 },
    ]);
    expect(weekly.data.widgets[1].datas).toEqual([
      { dimension: '2026-01-05T00:00:00Z', value: 60 },
      { dimension: '2026-01-12T00:00:00Z', value: 10 },
    ]);
    const monthly = await service.preview(
      { draft: ratio, includeTrends: true, trendGrain: 'month' },
      7,
    );
    expect(monthly.data.widgets[0].trend.points[0].value).toBeCloseTo(220 / 12, 12);
    expect(monthly.data.widgets[1].datas[0].value).toBeCloseTo(220 / 12, 12);
  });
  it('keeps zero observations and NULL ratio buckets distinct in daily aggregation', async () => {
    const daily = await service.preview(
      { draft: draft(), includeTrends: true, trendGrain: 'day' },
      7,
    );
    expect(daily.data.widgets[0].trend.points.map(p => p.value)).toEqual([0, 10, 20, 30]);
    const ratio = draft();
    ratio.widgets.forEach(w => {
      w.sql = w.sql.replace('sum(amount)', 'sum(numerator) / nullif(sum(denominator), 0)');
    });
    const result = await service.preview(
      { draft: ratio, includeTrends: true, trendGrain: 'day' },
      7,
    );
    expect(result.data.widgets[1].datas.map(p => p.value)).toEqual([null, 50, null, 10]);
  });
  it('does not invent a percentage on a zero baseline or an empty prior period', async () => {
    const zero = await service.preview(
      {
        draft: draft(),
        comparePrevious: true,
        dateRange: { column: 'day', start: '2026-01-09', end: '2026-01-10' },
      },
      7,
    );
    expect(zero.data.widgets[0].comparison).toEqual({
      previousValue: 0,
      delta: 10,
      percentChange: null,
    });
    const empty = await service.preview(
      {
        draft: draft(),
        comparePrevious: true,
        dateRange: { column: 'day', start: '2026-01-08', end: '2026-01-08' },
      },
      7,
    );
    expect(empty.data.widgets[0].comparison).toEqual({
      previousValue: null,
      delta: null,
      percentChange: null,
    });
  });
  it('passes the displayed period comparison and grain to bounded Assistant context', async () => {
    const context = await (service as any).previewContext(
      {
        dateRange: range,
        trendGrain: 'week',
        comparePrevious: true,
        filters: [{ column: 'channel', values: ['online'] }],
      },
      draft(),
      7,
    );
    expect(context.trendGrain).toBe('week');
    expect(context.comparison.previous).toEqual({
      column: 'day',
      start: '2026-01-09',
      end: '2026-01-10',
    });
    expect(context.widgets[0].comparison).toEqual({
      previousValue: 10,
      delta: 20,
      percentChange: 200,
    });
    expect(context.widgets[1].previousDatas).toEqual([
      { dimension: '2026-01-05T00:00:00Z', value: 10 },
    ]);
    expect(context.widgets[1].coverage).toMatchObject({
      returnedPreviousRows: 1,
      includedPreviousRows: 1,
      previousRowsTruncated: false,
      previousUnavailable: null,
    });
  });
  it('does not silently discard period context during AI generation without a current draft', async () => {
    await expect(
      service.generate(
        { databaseId: 1, prompt: 'Change the chart', trendGrain: 'week', comparePrevious: true },
        7,
      ),
    ).rejects.toThrow('currentDraft required');
  });
  it.each([{ trendGrain: 'hour' }, { comparePrevious: 'false' }, { comparePrevious: true }])(
    'rejects invalid/ambiguous period options before data queries: %p',
    async options => {
      connection.queryDuckDB.mockClear();
      await expect(service.preview({ draft: draft(), ...options }, 7)).rejects.toThrow();
      expect(connection.queryDuckDB).not.toHaveBeenCalled();
    },
  );
  it('explicitly reports unsupported time projection rather than pretending to regroup', async () => {
    const unsupported = draft();
    unsupported.widgets[1].sql =
      'SELECT channel AS dimension, sum(amount) AS value FROM source GROUP BY channel';
    const result = await service.preview({ draft: unsupported, trendGrain: 'month' }, 7);
    expect(result.data.widgets[1].grainUnavailable).toContain('안전');
    expect(result.data.widgets[1].trendGrain).toBeUndefined();
  });
  it('retains a top-N chart selection and reports unsupported reaggregation', async () => {
    const selected = draft();
    selected.widgets[1].sql =
      'SELECT "day" AS dimension, sum(amount) AS value FROM source GROUP BY "day" ORDER BY value DESC LIMIT 1';
    const result = await service.preview({ draft: selected, trendGrain: 'day' }, 7);
    expect(result.data.widgets[1].datas).toEqual([{ dimension: '2026-01-12', value: 30 }]);
    expect(result.data.widgets[1].grainUnavailable).toContain('안전');
    expect(result.data.widgets[1].trendGrain).toBeUndefined();
  });
  it('declines rounded arithmetic on exact DuckDB integers outside the JS safe range', async () => {
    const original = filename;
    filename = (
      await worker.importFile({
        originalname: 'exact.csv',
        buffer: Buffer.from(
          'day,channel,amount\n2026-01-10,online,9007199254740992\n2026-01-11,online,9007199254740993\n',
        ),
      })
    ).filename;
    try {
      const result = await service.preview(
        {
          draft: draft(),
          comparePrevious: true,
          dateRange: { column: 'day', start: '2026-01-11', end: '2026-01-11' },
        },
        7,
      );
      expect(result.data.widgets[0].datas).toEqual([{ value: '9007199254740993' }]);
      expect(result.data.widgets[0].comparison).toMatchObject({ delta: null, percentChange: null });
      expect(result.data.widgets[0].comparison.unavailable).toContain('범위');
    } finally {
      filename = original;
    }
  });
  it('does not expose a silently truncated day series when over 240 buckets', async () => {
    const original = filename;
    const rows = Array.from({ length: 242 }, (_, i) => {
      const day = new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10);
      return `${day},online,1,1,1`;
    });
    filename = (
      await worker.importFile({
        originalname: 'long.csv',
        buffer: Buffer.from(`day,channel,amount,numerator,denominator\n${rows.join('\n')}\n`),
      })
    ).filename;
    try {
      const result = await service.preview(
        { draft: draft(), trendGrain: 'day', includeTrends: true },
        7,
      );
      expect(result.data.widgets[0].datas).toEqual([{ value: 242 }]);
      expect(result.data.widgets[0].trend).toBeUndefined();
      expect(result.data.widgets[0].trendUnavailable).toContain('240');
      expect(result.data.widgets[1].datas).toEqual([]);
      expect(result.data.widgets[1].grainUnavailable).toContain('240');
    } finally {
      filename = original;
    }
  });
});
