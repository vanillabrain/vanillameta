import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
jest.mock('./ai.service', () => ({ AiService: class {} }));
import { AiDashboardService } from './ai-dashboard.service';
import { buildTrendQuery, chooseTrendGrain } from './dashboard-trend';
import { validateDraft, validateSourceSql, sourceQuery } from './dashboard-draft';
import { DuckDBService } from '../analysis/duckdb.service';
import { DataSource, EntityManager } from 'typeorm';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const draft = () => ({
  databaseId: 1,
  title: 'Metrics',
  explanation: 'All time',
  widgets: [
    {
      title: 'Revenue',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
      decimalPlaces: 2,
    },
    {
      title: 'Devices',
      description: '',
      type: 'CHART_COLUMN',
      sql: 'SELECT device_type, sum(amount) AS value FROM source GROUP BY device_type',
      valueField: 'value',
      categoryField: 'device_type',
    },
  ],
});
describe('dashboard KPI trend query builder', () => {
  it('preserves weighted formulas and widget WHERE literals while avoiding alias collisions', () => {
    const trend = buildTrendQuery(
      `SELECT sum(bid_floor) / sum(has_bid_floor_cnt) AS value FROM source WHERE device_type = 'phone'`,
      'value',
      'event date',
      'day',
      ['__trend_time'],
    );
    expect(trend).toBeDefined();
    expect(trend!.sql).toContain('sum(bid_floor) / sum(has_bid_floor_cnt)');
    expect(trend!.sql).toContain("WHERE device_type = 'phone'");
    expect(trend!.sql).toContain('"event date"');
    expect(trend!.timeField).toBe('__trend_time_1');
  });
  it.each([
    'SELECT sum(amount) AS value FROM source GROUP BY amount',
    'SELECT sum(amount) AS value FROM source HAVING sum(amount) > 0',
    'SELECT sum(amount) OVER () AS value FROM source',
    'SELECT sum(amount) AS value FROM source ORDER BY value',
  ])('rejects unsupported trend shape %s', sql => {
    expect(buildTrendQuery(sql, 'value', 'event_time', 'day')).toBeUndefined();
  });
  it('chooses bounded grains from temporal span', () => {
    expect(chooseTrendGrain('2023-09-09', '2023-09-16')).toBe('hour');
    expect(chooseTrendGrain('2026-01-01', '2026-01-10')).toBe('day');
    expect(chooseTrendGrain('2025-01-01', '2026-01-01')).toBe('week');
    expect(chooseTrendGrain('2020-01-01', '2026-01-01')).toBe('month');
  });
});
describe('AI dashboard SQL boundaries', () => {
  it.each([
    'SELECT * FROM uploaded_data',
    'SELECT * FROM other',
    'SELECT * FROM source, other',
    'SELECT * FROM source JOIN other ON true',
    "SELECT * FROM read_csv('secret')",
    'WITH source AS (SELECT * FROM other) SELECT * FROM source',
    'DELETE FROM source',
    'SELECT * FROM source; DROP TABLE uploaded_data',
    "SELECT query('SELECT * FROM other') FROM source",
    'SELECT * FROM source UNION SELECT * FROM other',
    'SELECT * FROM source -- comment',
    'SELECT (SELECT count(*) FROM other) FROM source',
  ])('rejects %s', sql => {
    expect(() => validateSourceSql(sql)).toThrow();
  });
  it('binds values, whitelists identifiers, and enforces limits', () => {
    const value = "phone' OR 1=1 --";
    const query = sourceQuery(
      draft().widgets[0].sql,
      ['device_type'],
      [{ column: 'device_type', value }],
    );
    expect(query.sql).toContain('WHERE ("device_type" IN (?))) SELECT sum');
    expect(query.sql).not.toContain(value);
    expect(query.bindings).toEqual([value]);
    expect(() =>
      sourceQuery(draft().widgets[0].sql, ['device_type'], [{ column: 'x" OR true', value }]),
    ).toThrow();
    expect(() =>
      sourceQuery(
        draft().widgets[0].sql,
        ['device_type'],
        Array(6).fill({ column: 'device_type', value }),
      ),
    ).toThrow();
    expect(() =>
      validateDraft({ ...draft(), widgets: [{ ...draft().widgets[0], decimalPlaces: 7 }] }),
    ).toThrow();
    expect(() =>
      validateDraft({ ...draft(), widgets: Array(7).fill(draft().widgets[0]) }),
    ).toThrow();
  });
});
describe('AI dashboards: actual DuckDB and transactional metadata', () => {
  let db: DataSource;
  let worker: DuckDBService;
  let service: AiDashboardService;
  let root: string;
  let connection: any;
  let ai: any;
  const uploadRoot = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dashboard-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const file = await worker.importFile({
      originalname: 'metrics.csv',
      buffer: Buffer.from(
        'device_type,amount,event_time,bid_floor,has_bid_floor_cnt\nphone,10,2026-01-01T00:00:00Z,100,2\nphone,20,2026-01-02T00:00:00Z,,0\ndesktop,100,2026-01-03T00:00:00Z,300,3\n',
      ),
    });
    db = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Database,
        Metric,
        Dashboard,
        DashboardShare,
        DashboardWidget,
        UserMapping,
        Dataset,
        Widget,
        Component,
      ],
    });
    await db.initialize();
    await db.manager.save(Database, {
      id: 1,
      ownerId: 7,
      name: 'Fixture',
      connectionConfig: '{}',
      engine: 'duckdb',
      type: 'FILE',
    });
    connection = {
      withDuckDBSnapshot: jest.fn((_id, callback) => callback()),
      duckDBVersion: jest.fn().mockResolvedValue(file.filename),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((id, sql, bindings) => worker.query(file.filename, sql, bindings)),
    };
    ai = {
      callLlm: jest.fn().mockResolvedValue(JSON.stringify(draft())),
      getSchemaContext: jest
        .fn()
        .mockResolvedValue({ schemaText: 'uploaded_data(device_type VARCHAR, amount BIGINT)' }),
    };
    service = new AiDashboardService(ai, connection, db.getRepository(Dashboard));
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (uploadRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = uploadRoot;
  });
  it('filters before aggregation; caches dimensions and does not interpolate injections', async () => {
    const all = await service.preview({ draft: draft() }, 7);
    expect(all.data.widgets[0].datas).toEqual([{ value: 130 }]);
    expect(all.data.dimensions[0]).toEqual({ column: 'device_type', values: ['desktop', 'phone'] });
    const filtered = await service.preview(
      { draft: draft(), filters: [{ column: 'device_type', value: 'phone' }] },
      7,
    );
    expect(filtered.data.widgets[0].datas).toEqual([{ value: 30 }]);
    expect(filtered.data.widgets[1].datas).toEqual([{ device_type: 'phone', value: 30 }]);
    expect(
      connection.queryDuckDB.mock.calls.filter(call => call[1].startsWith('SELECT DISTINCT')),
    ).toHaveLength(1);
    expect(
      (
        await service.preview(
          { draft: draft(), filters: [{ column: 'device_type', value: "phone' OR true --" }] },
          7,
        )
      ).data.widgets[0].datas,
    ).toEqual([{ value: null }]);
  });

  it('direct preview validates numeric ranges from DESCRIBE and applies them to current/prior widgets and trends', async () => {
    const filters = [{ column: 'amount', range: { min: 10, max: 20 } }];
    const result = await service.preview(
      {
        draft: draft(),
        filters,
        dateRange: { column: 'event_time', start: '2026-01-02', end: '2026-01-02' },
        comparePrevious: true,
        includeTrends: true,
      },
      7,
    );
    expect(result.data.widgets[0].datas).toEqual([{ value: 20 }]);
    expect(result.data.widgets[0].comparison).toMatchObject({
      previousValue: 10,
      delta: 10,
      percentChange: 100,
    });
    expect(result.data.widgets[0].trend.points.map(p => p.value)).toEqual([20]);
    expect(result.data.widgets[0].previousTrend.points.map(p => p.value)).toEqual([10]);
    expect(result.data.widgets[1].datas).toEqual([{ device_type: 'phone', value: 20 }]);
    for (const column of ['device_type', 'event_time']) {
      const calls = connection.queryDuckDB.mock.calls.length;
      await expect(
        service.preview({ draft: draft(), filters: [{ column, range: { min: 0 } }] }, 7),
      ).rejects.toThrow('numeric');
      expect(connection.queryDuckDB.mock.calls.slice(calls).map(call => call[1])).toEqual([
        'DESCRIBE uploaded_data',
      ]);
    }
  });

  it('passes range filters exactly in assistant preview context', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    const filters = [{ column: 'amount', range: { min: 10, max: 20 } }];
    ai.callLlm.mockClear();
    ai.callLlm.mockResolvedValueOnce('Range total is 30');
    const response = await service.assistant(
      { dashboardId: id, currentDraft: draft(), prompt: 'Explain range', filters },
      7,
    );
    expect(response.status).toBe('SUCCESS');
    const sent = JSON.parse(ai.callLlm.mock.calls[0][1]);
    expect(sent.context.filters).toEqual(filters);
    expect(sent.context.widgets[0].datas).toEqual([{ value: 30 }]);
  });
  it('adds opt-in trends with identical bound filters and preserves null aggregate values', async () => {
    connection.queryDuckDB.mockClear();
    const noTrend = await service.preview({ draft: draft() }, 7);
    expect(noTrend.data.widgets[0]).not.toHaveProperty('trend');
    expect(noTrend.data.widgets[0]).not.toHaveProperty('trendUnavailable');
    const withTrend = await service.preview(
      {
        draft: {
          ...draft(),
          widgets: [
            {
              ...draft().widgets[0],
              sql: "SELECT sum(bid_floor) / nullif(sum(has_bid_floor_cnt), 0) AS value FROM source WHERE device_type = 'phone'",
            },
          ],
        },
        includeTrends: true,
        filters: [{ column: 'device_type', value: 'phone' }],
      },
      7,
    );
    expect(withTrend.data.widgets[0].trend).toEqual({
      column: 'event_time',
      grain: 'hour',
      contribution: { supported: true, groupFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) },
      timeSelection: {
        column: 'event_time',
        grain: 'hour',
        ranges: ['2026-01-01', '2026-01-02'].map(day => ({
          column: 'event_time',
          start: `${day}T00:00:00Z`,
          end: `${day}T01:00:00Z`,
          precision: 'timestamp',
        })),
      },
      points: [
        { time: '2026-01-01T00:00:00Z', value: 50 },
        { time: '2026-01-02T00:00:00Z', value: null },
      ],
    });
    expect(withTrend.data.widgets[0].datas).toEqual([{ value: 50 }]);
    const trendCall = connection.queryDuckDB.mock.calls.find(call => call[1].includes('strftime('));
    expect(trendCall[2]).toEqual(['phone']);
    expect(trendCall[1]).toContain("device_type = 'phone'");
  });
  it('preserves unsafe integer strings in trend points from DuckDB', async () => {
    const file = await worker.importFile({
      originalname: 'unsafe-trend.csv',
      buffer: Buffer.from(
        'device_type,amount,event_time\nphone,9007199254740992,2026-01-01T00:00:00Z\nphone,9007199254740993,2026-01-01T00:00:00Z\n',
      ),
    });
    const original = connection.queryDuckDB.getMockImplementation();
    connection.queryDuckDB.mockImplementation((_id, sql, bindings) =>
      worker.query(file.filename, sql, bindings),
    );
    try {
      const result = await service.preview({ draft: draft(), includeTrends: true }, 7);
      expect(result.data.widgets[0].trend.points).toEqual([
        { time: '2026-01-01T00:00:00Z', value: '18014398509481985' },
      ]);
    } finally {
      connection.queryDuckDB.mockImplementation(original);
    }
  });
  it('keeps existing numeric results when a query shape cannot be trended', async () => {
    const result = await service.preview(
      {
        draft: {
          ...draft(),
          widgets: [
            {
              ...draft().widgets[0],
              sql: 'SELECT sum(amount) AS value FROM source ORDER BY value',
            },
          ],
        },
        includeTrends: true,
      },
      7,
    );
    expect(result.data.widgets[0].datas).toEqual([{ value: 130 }]);
    expect(result.data.widgets[0].trendUnavailable).toMatch(/safely grouped/);
  });
  it('trends preserve the weighted KPI formula and select the requested temporal column', async () => {
    const body = {
      draft: {
        ...draft(),
        widgets: [
          {
            ...draft().widgets[0],
            sql: 'SELECT sum(bid_floor) / nullif(sum(has_bid_floor_cnt), 0) AS value FROM source',
          },
        ],
      },
      includeTrends: true,
      dateRange: { column: 'event_time', start: '2026-01-01', end: '2026-01-03' },
    };
    const result = await service.preview(body, 7);
    expect(result.data.widgets[0].trend).toEqual({
      column: 'event_time',
      grain: 'hour',
      contribution: { supported: true, groupFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) },
      timeSelection: {
        column: 'event_time',
        grain: 'hour',
        ranges: ['2026-01-01', '2026-01-02', '2026-01-03'].map(day => ({
          column: 'event_time',
          start: `${day}T00:00:00Z`,
          end: `${day}T01:00:00Z`,
          precision: 'timestamp',
        })),
      },
      points: [
        { time: '2026-01-01T00:00:00Z', value: 50 },
        { time: '2026-01-02T00:00:00Z', value: null },
        { time: '2026-01-03T00:00:00Z', value: 100 },
      ],
    });
  });
  it('validates LLM JSON using actual fields', async () => {
    const generated = await service.generate({ databaseId: 1, prompt: 'Revenue' }, 7);
    expect('data' in generated && generated.data).toMatchObject(draft());
    const bad = draft();
    bad.widgets[0].valueField = 'missing';
    ai.callLlm.mockResolvedValueOnce(JSON.stringify(bad));
    const repaired = await service.generate({ databaseId: 1, prompt: 'Revenue' }, 7);
    expect('data' in repaired && repaired.data).toMatchObject(draft());
    expect(ai.callLlm.mock.calls[ai.callLlm.mock.calls.length - 1][1]).toContain(
      'valueField must be numeric',
    );
  });
  it('repairs unsafe SQL once without executing it and returns a friendly error after two failures', async () => {
    const invalid = draft();
    invalid.widgets[0].sql = 'SELECT sum(amount) AS value FROM uploaded_data';
    ai.callLlm.mockClear();
    ai.callLlm.mockResolvedValueOnce(JSON.stringify(invalid));
    const repaired = await service.generate({ databaseId: 1, prompt: 'Revenue' }, 7);
    expect('data' in repaired && repaired.data).toMatchObject(draft());
    expect(ai.callLlm).toHaveBeenCalledTimes(2);
    expect(ai.callLlm.mock.calls[1][1]).toContain('only SELECT from source is allowed');
    ai.callLlm.mockClear();
    ai.callLlm.mockResolvedValueOnce('invalid json').mockResolvedValueOnce(JSON.stringify(invalid));
    const failure = await service.generate({ databaseId: 1, prompt: 'Revenue' }, 7);
    expect(failure.status).toBe('ERROR');
    expect('message' in failure && failure.message).toContain('AI 결과를 검증하지 못했습니다');
    expect(ai.callLlm).toHaveBeenCalledTimes(2);
  });
  it.each(['count(*)', 'sum(has_bid_floor_cnt)'])(
    'repairs %s used as request totals before running SQL',
    async expression => {
      const invalid = draft();
      invalid.widgets[0].title = 'Requests';
      invalid.widgets[0].sql = `SELECT ${expression} AS value FROM source`;
      ai.getSchemaContext.mockResolvedValueOnce({
        schemaText: 'uploaded_data(device_type VARCHAR, amount BIGINT, bid_request_cnt BIGINT)',
      });
      ai.callLlm.mockClear();
      connection.queryDuckDB.mockClear();
      ai.callLlm.mockResolvedValueOnce(JSON.stringify(invalid));
      const repaired = await service.generate({ databaseId: 1, prompt: 'Total requests' }, 7);
      expect('data' in repaired && repaired.data).toMatchObject(draft());
      expect(ai.callLlm).toHaveBeenCalledTimes(2);
      expect(ai.callLlm.mock.calls[1][1]).toContain('SUM(bid_request_cnt)');
      expect(
        connection.queryDuckDB.mock.calls.some(call => /count\(\*\) AS value/i.test(call[1])),
      ).toBe(false);
    },
  );

  it('preserves unit suffix through validation, save, reload and widget options', async () => {
    const input = { ...draft(), widgets: [{ ...draft().widgets[0], suffix: ' kg' }] };
    const id = (await service.save({ draft: input }, 7)).data.id;
    expect((await service.analysis(id, 7)).data.widgets[0].suffix).toBe(' kg');
    const mapping = await db.manager.findOneBy(DashboardWidget, { dashboardId: id });
    const widget = await db.manager.findOneBy(Widget, { id: mapping.widgetId });
    expect(JSON.parse(widget.option).content).toMatchObject({ prefix: '', suffix: ' kg' });
  });

  it('persists a structured snapshot atomically and clears it when raw SQL replaces the definition', async () => {
    const snapshot = {
      schemaVersion: 1,
      kind: 'structured-bi',
      sourceId: 1,
      metricId: 17,
      definitionVersion: 1,
      dataVersion: 'upload-revision',
      definition: {
        schemaVersion: 1,
        sourceId: 1,
        definitionVersion: 1,
        aggregation: 'SUM',
        column: 'amount',
      },
    };
    const initial = { ...draft(), widgets: [draft().widgets[0]] };
    const id = (await service.save({ draft: initial }, 7, snapshot)).data.id;
    expect(
      JSON.parse((await db.manager.findOneBy(Dashboard, { id })).structuredDefinition),
    ).toEqual(snapshot);
    const current = (await service.analysis(id, 7, true)).data;
    await service.save(
      {
        dashboardId: id,
        draft: {
          ...current,
          title: 'Manual SQL',
          widgets: [{ ...current.widgets[0], sql: 'SELECT avg(amount) AS value FROM source' }],
        },
        expectedRevision: current.revision,
      },
      7,
    );
    expect((await db.manager.findOneBy(Dashboard, { id })).structuredDefinition).toBeNull();
    expect((await service.analysis(id, 7)).data.title).toBe('Manual SQL');
  });
  it('saves ordinary query SQL, definition, layout; edits preserve old shared widgets', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    const old = await db.manager.find(Widget);
    const metadata = await db.manager.findOneBy(Dashboard, { id });
    expect(JSON.parse(metadata.layout).map(x => [x.x, x.y, x.w, x.h])).toEqual([
      [0, 0, 6, 2],
      [0, 2, 12, 5],
    ]);
    expect((await service.analysis(id, 7)).data).toMatchObject(draft());
    const dataset = await db.manager.findOneBy(Dataset, { id: old[0].datasetId });
    expect((await connection.queryDuckDB(1, dataset.query)).datas).toEqual([{ value: 130 }]);
    expect((await service.save({ draft: draft(), dashboardId: id }, 7)).data.id).toBe(id);
    expect(await db.manager.findOneBy(Widget, { id: old[0].id })).toEqual(old[0]);
    expect(
      (await db.manager.findBy(DashboardWidget, { dashboardId: id })).every(
        x => !old.some(w => w.id === x.widgetId),
      ),
    ).toBe(true);
  });
  it('protects apply and undo with the server revision, preserving newer content on conflict', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    const baseline = await service.analysis(id, 7, true);
    expect(baseline.data.revision).toMatch(/^[a-f0-9]{64}$/);
    const edited = { ...draft(), title: 'Newer tab edit' };
    const saved = await service.save(
      { dashboardId: id, draft: edited, expectedRevision: baseline.data.revision },
      7,
    );
    expect(saved.data.revision).not.toBe(baseline.data.revision);
    expect((await service.analysis(id, 7, true)).data.revision).toBe(saved.data.revision);
    const entities = [Dataset, Widget, Dashboard, DashboardShare, DashboardWidget, UserMapping];
    const counts = await Promise.all(entities.map(e => db.manager.count(e)));
    await expect(
      service.save(
        { dashboardId: id, draft: draft(), expectedRevision: baseline.data.revision },
        7,
      ),
    ).rejects.toThrow('다른 화면');
    expect(await Promise.all(entities.map(e => db.manager.count(e)))).toEqual(counts);
    expect((await service.analysis(id, 7)).data.title).toBe('Newer tab edit');
    const undo = await service.save(
      { dashboardId: id, draft: draft(), expectedRevision: saved.data.revision },
      7,
    );
    expect(undo.data.revision).not.toBe(saved.data.revision);
    expect((await service.analysis(id, 7)).data).toMatchObject(draft());
  });
  it('persists custom sizes in order, remaps widget ids and packs unequal rows without overlap', async () => {
    const custom = {
      ...draft(),
      widgets: [...draft().widgets, draft().widgets[0]],
      layoutSizes: [
        { width: 6, height: 3 },
        { width: 6, height: 7 },
        { width: 12, height: 5 },
      ],
    };
    const id = (await service.save({ draft: custom }, 7)).data.id;
    const metadata = await db.manager.findOneBy(Dashboard, { id });
    const layout = JSON.parse(metadata.layout);
    expect(layout.map(x => [x.x, x.y, x.w, x.h])).toEqual([
      [0, 0, 6, 3],
      [6, 0, 6, 7],
      [0, 7, 12, 5],
    ]);
    expect(new Set(layout.map(x => x.i)).size).toBe(3);
    expect((await service.analysis(id, 7)).data.layoutSizes).toEqual(custom.layoutSizes);
    const revision = (await service.analysis(id, 7, true)).data.revision;
    await db.manager.update(Dashboard, id, {
      structuredDefinition: JSON.stringify({ changed: true }),
    });
    await expect(
      service.save({ dashboardId: id, draft: custom, expectedRevision: revision }, 7),
    ).rejects.toThrow('대시보드가 다른 화면');
  });
  it('rolls back new widgets and datasets if the final atomic update loses a race', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    const { data } = await service.analysis(id, 7, true);
    const entities = [Dataset, Widget, Dashboard, DashboardShare, DashboardWidget, UserMapping];
    const counts = await Promise.all(entities.map(e => db.manager.count(e)));
    const repo: any = {
      manager: {
        connection: db,
        find: db.manager.find.bind(db.manager),
        findOne: db.manager.findOne.bind(db.manager),
        transaction: run =>
          db.transaction(async manager => {
            const create = manager.createQueryBuilder.bind(manager);
            jest.spyOn(manager, 'createQueryBuilder').mockImplementation((...args: any[]) => {
              const builder = create(...args);
              const update = builder.update.bind(builder);
              jest.spyOn(builder, 'update').mockImplementation((...values: any[]) => {
                const result = update(...values);
                if (values[0] === Dashboard)
                  jest
                    .spyOn(result, 'execute')
                    .mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });
                return result;
              });
              return builder;
            });
            return run(manager);
          }),
      },
    };
    const raced = new AiDashboardService(ai, connection, repo);
    await expect(
      raced.save({ dashboardId: id, draft: draft(), expectedRevision: data.revision }, 7),
    ).rejects.toThrow('다른 화면');
    expect(await Promise.all(entities.map(e => db.manager.count(e)))).toEqual(counts);
    expect((await service.analysis(id, 7, true)).data).toEqual(data);
  });
  it('rolls back a real mid-transaction DashboardWidget failure and keeps the revision', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    const before = (await service.analysis(id, 7, true)).data;
    const entities = [Dataset, Widget, Dashboard, DashboardShare, DashboardWidget, UserMapping];
    const counts = await Promise.all(entities.map(e => db.manager.count(e)));
    const [link] = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND replace(lower(name), '_', '') = 'dashboardwidget'",
    );
    // A real SQLite trigger fails the second link insert, in the middle of the
    // transaction, after the dataset and widget rows were already written.
    const trigger = [
      'CREATE TRIGGER uc016_midwrite BEFORE INSERT ON "' + link.name + '"',
      'WHEN (SELECT COUNT(*) FROM "' + link.name + '" WHERE dashboardId = NEW."dashboardId") >= 1',
      "BEGIN SELECT RAISE(ABORT, 'uc016-midwrite'); END",
    ].join(' ');
    await db.query(trigger);
    try {
      await expect(
        service.save({ dashboardId: id, draft: draft(), expectedRevision: before.revision }, 7),
      ).rejects.toThrow(/uc016-midwrite/);
    } finally {
      await db.query('DROP TRIGGER uc016_midwrite');
    }
    expect(await Promise.all(entities.map(e => db.manager.count(e)))).toEqual(counts);
    expect((await service.analysis(id, 7, true)).data).toEqual(before);
  });
  it('checks owner before generation, load, preview and save', async () => {
    ai.callLlm.mockClear();
    connection.queryDuckDB.mockClear();
    const id = (await db.manager.find(Dashboard))[0].id;
    await expect(
      service.generate({ databaseId: 1, prompt: 'Revenue', dashboardId: id }, 99),
    ).rejects.toThrow('owner');
    await expect(service.preview({ draft: draft(), dashboardId: id }, 99)).rejects.toThrow('owner');
    await expect(service.save({ draft: draft(), dashboardId: id }, 99)).rejects.toThrow('owner');
    await expect(service.analysis(id, 99)).rejects.toThrow('owner');
    expect(ai.callLlm).not.toHaveBeenCalled();
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
  });
  it('rolls back datasets/widgets and other metadata on later component failure', async () => {
    const entities = [Dataset, Widget, Dashboard, DashboardShare, DashboardWidget, UserMapping];
    const counts = await Promise.all(entities.map(e => db.manager.count(e)));
    const invalid = draft();
    invalid.widgets[1].type = 'CHART_BAR';
    await expect(service.save({ draft: invalid }, 7)).rejects.toThrow('component');
    expect(await Promise.all(entities.map(e => db.manager.count(e)))).toEqual(counts);
  });
  it('derives legacy single-source queries preserving AVG and field options', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    await db.manager.update(Dashboard, id, { analysisDefinition: null });
    const mappings = await db.manager.findBy(DashboardWidget, { dashboardId: id });
    for (let i = 0; i < mappings.length; i++) {
      const widget = await db.manager.findOneBy(Widget, { id: mappings[i].widgetId });
      await db.manager.update(Dataset, widget.datasetId, {
        query:
          i === 0
            ? 'SELECT avg(amount) AS value FROM uploaded_data'
            : draft().widgets[1].sql.replace('source', 'uploaded_data'),
      });
    }
    const loaded = await service.analysis(id, 7);
    expect(loaded.data.widgets[0].sql).toContain('avg(amount)');
    expect(
      (
        await service.preview(
          { draft: loaded.data, filters: [{ column: 'device_type', value: 'phone' }] },
          7,
        )
      ).data.widgets[0].datas,
    ).toEqual([{ value: 15 }]);
  });
  it('assistant sends re-queried exact filtered KPI/category/trend values to LLM without writes', async () => {
    const current = {
      ...draft(),
      widgets: draft().widgets.map((widget, index) =>
        index === 0 ? { ...widget, prefix: '', suffix: ' USD', numberNotation: 'full' } : widget,
      ),
    };
    const id = (await service.save({ draft: current }, 7)).data.id;
    const entities = [Dataset, Widget, Dashboard, DashboardShare, DashboardWidget, UserMapping];
    const before = await Promise.all(entities.map(entity => db.manager.count(entity)));
    const provider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'codex';
    ai.callLlm.mockClear();
    ai.callLlm.mockResolvedValueOnce('실제 매출은 30입니다.');
    try {
      const response = await service.assistant(
        {
          dashboardId: id,
          currentDraft: current,
          prompt: '매출 설명',
          filters: [{ column: 'device_type', values: ['phone'] }],
          dateRange: { column: 'event_time', start: '2026-01-01', end: '2026-01-03' },
        },
        7,
      );
      expect(response.status).toBe('SUCCESS');
      const sent = JSON.parse(ai.callLlm.mock.calls[0][1]);
      expect(sent.context.widgets[0]).toMatchObject({
        datas: [{ value: 30 }],
        prefix: '',
        suffix: ' USD',
        decimalPlaces: 2,
        numberNotation: 'full',
      });
      expect(sent.context.widgets[1].datas).toEqual([{ device_type: 'phone', value: 30 }]);
      expect(sent.context.widgets[0].trend.points).toEqual([
        { time: '2026-01-01T00:00:00Z', value: 10 },
        { time: '2026-01-02T00:00:00Z', value: 20 },
      ]);
      expect(await Promise.all(entities.map(entity => db.manager.count(entity)))).toEqual(before);
    } finally {
      if (provider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = provider;
    }
  });
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    'UC022 retries an unchanged selected block, exhausted=%s defaults=%s',
    async (exhausted, defaults) => {
      const id = (await service.save({ draft: draft() }, 7)).data.id;
      const current = (await service.analysis(id, 7)).data;
      const unchanged = {
        ...draft(),
        widgets: [
          {
            ...current.widgets[0],
            ...(defaults ? { prefix: '', suffix: '', numberNotation: 'full' } : {}),
          },
        ],
      };
      const changed = {
        ...unchanged,
        widgets: [{ ...current.widgets[0], sql: 'SELECT sum(amount) * 2 AS value FROM source' }],
      };
      ai.callLlm.mockClear();
      ai.callLlm.mockResolvedValueOnce(JSON.stringify(unchanged));
      ai.callLlm.mockResolvedValueOnce(JSON.stringify(exhausted ? unchanged : changed));
      const result = await service.generate(
        {
          dashboardId: id,
          databaseId: 1,
          currentDraft: current,
          selectedWidget: 0,
          requireSelectedChange: true,
          prompt: '1번 지표를 두 배로 변경',
        },
        7,
      );
      expect(ai.callLlm).toHaveBeenCalledTimes(2);
      expect(ai.callLlm.mock.calls[1][1]).toContain('selected block is unchanged');
      expect(result.status).toBe(exhausted ? 'ERROR' : 'SUCCESS');
      if ('data' in result) {
        expect(result.data.widgets[0].sql).toBe(changed.widgets[0].sql);
        expect(result.data.widgets[1]).toEqual(current.widgets[1]);
      }
      expect((await service.analysis(id, 7)).data).toEqual(current);
    },
  );
  it('UC025 title-only recovery ignores generated calculation and chart drift', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    const current = (await service.analysis(id, 7)).data;
    ai.callLlm.mockResolvedValueOnce(
      JSON.stringify({ ...draft(), widgets: [{ ...current.widgets[1], title: '복구 완료' }] }),
    );
    const result = await service.generate(
      {
        dashboardId: id,
        databaseId: 1,
        currentDraft: current,
        selectedWidget: 0,
        requireSelectedChange: true,
        renameOnly: true,
        prompt: '1번 제목만 복구 완료로 변경',
      },
      7,
    );
    expect(result.status).toBe('SUCCESS');
    if (!('data' in result)) throw new Error('Expected recovery');
    expect(result.data.widgets[0]).toEqual({ ...current.widgets[0], title: '복구 완료' });
    expect(result.data.widgets[1]).toEqual(current.widgets[1]);
    expect((await service.analysis(id, 7)).data).toEqual(current);
  });
  it.each([
    ['제목 유지', 'Revenue'],
    ['제목을 Renamed revenue로 변경', 'Renamed revenue'],
  ])(
    'omits repeated UI bucket ranges while preserving scoped title intent: %s',
    async (prompt, title) => {
      const id = (await service.save({ draft: draft() }, 7)).data.id;
      const current = (await service.analysis(id, 7)).data;
      const context = jest.spyOn(service as any, 'previewContext').mockResolvedValueOnce({
        widgets: [
          {
            index: 0,
            datas: [{ value: 30 }],
            trend: {
              column: 'event_time',
              grain: 'hour',
              points: [{ time: '2026-01-01T00:00:00Z', value: 30 }],
              timeSelection: {
                ranges: Array.from({ length: 120 }, () => ({ marker: 'UI_RANGE'.repeat(200) })),
              },
            },
          },
        ],
      });
      ai.callLlm.mockClear();
      ai.callLlm.mockResolvedValueOnce(
        JSON.stringify({ ...draft(), widgets: [{ ...draft().widgets[0], title }] }),
      );
      const result = await service.generate(
        {
          dashboardId: id,
          databaseId: 1,
          currentDraft: current,
          selectedWidget: 0,
          prompt,
        },
        7,
      );
      expect(result.status).toBe('SUCCESS');
      if (!('data' in result)) throw new Error('Expected generated draft');
      expect(result.data.widgets[0].title).toBe(title);
      expect(result.data.widgets[0].sql).toBe(current.widgets[0].sql);
      expect(result.data.widgets[1]).toEqual(current.widgets[1]);
      expect((await service.analysis(id, 7)).data).toEqual(current);
      const sent = ai.callLlm.mock.calls[0][1];
      expect(Buffer.byteLength(sent)).toBeLessThan(64 * 1024);
      expect(sent).not.toContain('UI_RANGE');
      expect(sent).toContain('2026-01-01T00:00:00Z');
      context.mockRestore();
    },
  );
  it('persists numberNotation in saved definitions and ordinary widget options', async () => {
    const input = draft();
    input.widgets.forEach(widget => Object.assign(widget, { numberNotation: 'compact' }));
    const id = (await service.save({ draft: input }, 7)).data.id;
    expect(
      (await service.analysis(id, 7)).data.widgets.every(
        widget => widget.numberNotation === 'compact',
      ),
    ).toBe(true);
    const mappings = await db.manager.findBy(DashboardWidget, { dashboardId: id });
    for (let index = 0; index < mappings.length; index++) {
      const widget = await db.manager.findOneBy(Widget, { id: mappings[index].widgetId });
      const option = JSON.parse(widget.option);
      expect(index === 0 ? option.content.numberNotation : option.numberNotation).toBe('compact');
    }
  });
  async function metricChangeFixture() {
    const metric = await db.manager.save(Metric, {
      name: 'change-' + Math.random(),
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      useYn: 'Y',
      definition: JSON.stringify({
        schemaVersion: 1,
        definitionVersion: 1,
        sourceId: 1,
        label: 'Revenue',
        aggregation: 'SUM',
        column: 'amount',
        decimalPlaces: 2,
        numberNotation: 'plain',
        unit: '',
      }),
    });
    const saved = await service.save({ draft: draft() }, 7, {
      schemaVersion: 1,
      kind: 'structured-bi',
      sourceId: 1,
      metricId: metric.id,
      definitionVersion: 1,
      definition: JSON.parse(metric.definition),
      chart: 'number',
    });
    return {
      metric,
      body: {
        dashboardId: saved.data.id,
        metricId: metric.id,
        selectedWidget: 0,
        expectedDefinitionVersion: 1,
        expectedRevision: saved.data.revision,
        calculation: { aggregation: 'AVG', column: 'amount' },
      },
    };
  }
  it('UC-003 previews without writes and atomically persists calculation and selected chart', async () => {
    const { metric, body } = await metricChangeFixture();
    const before = (await service.analysis(body.dashboardId, 7)).data;
    const preview = await service.metricChangePreview(
      { ...body, includeTrends: true, filters: [{ column: 'device_type', values: ['phone'] }] },
      7,
    );
    expect(preview.data.widgets[0].datas).toEqual([{ value: 15 }]);
    expect(preview.data.widgets[0].trend.points.map(row => row.value)).toEqual([10, 20]);
    expect((await db.manager.findOne(Metric, { where: { id: metric.id } })).definition).toBe(
      metric.definition,
    );
    const saved = await service.metricChangeSave(body, 7);
    const after = (await service.analysis(saved.data.id, 7)).data;
    expect(after.widgets[0].sql).toContain('AVG("amount")');
    expect(after.widgets[1]).toEqual(before.widgets[1]);
    expect(
      JSON.parse((await db.manager.findOne(Metric, { where: { id: metric.id } })).definition)
        .definitionVersion,
    ).toBe(2);
    expect(
      (await service.metricChoices(1, 7)).data.find(m => m.id === metric.id).definitionVersion,
    ).toBe(2);
    const snapshot = JSON.parse(
      (await db.manager.findOne(Dashboard, { where: { id: saved.data.id } })).structuredDefinition,
    );
    expect(snapshot.metricId).toBe(metric.id);
    expect(snapshot.definitionVersion).toBe(2);
    await expect(service.metricChangeSave(body, 7)).rejects.toThrow('분석이 변경');
  });
  it('UC-003 rejects invalid definitions/foreign owner and stale metric versions without writes', async () => {
    const { metric, body } = await metricChangeFixture();
    await expect(service.metricChangePreview(body, 8)).rejects.toThrow();
    await expect(service.metricChangePreview({ ...body, metricId: 999999 }, 7)).rejects.toThrow(
      '활성 저장 지표',
    );
    await expect(
      service.metricChangePreview(
        { ...body, calculation: { aggregation: 'SUM', column: 'missing' } },
        7,
      ),
    ).rejects.toThrow('숫자 컬럼');
    await expect(
      service.metricChangeSave({ ...body, expectedDefinitionVersion: 0 }, 7),
    ).rejects.toThrow('지표 계산식이 변경');
    expect((await db.manager.findOne(Metric, { where: { id: metric.id } })).definition).toBe(
      metric.definition,
    );
  });
  it('UC-003 rolls the metric back if analysis persistence fails after its CAS update', async () => {
    const { metric, body } = await metricChangeFixture();
    const before = (await service.analysis(body.dashboardId, 7)).data;
    const counts = [await db.manager.count(Dataset), await db.manager.count(Widget)];
    await db.manager.update(Component, { type: 'CHART_COLUMN' }, { useYn: 'N' as any });
    try {
      await expect(service.metricChangeSave(body, 7)).rejects.toThrow('component unavailable');
    } finally {
      await db.manager.update(Component, { type: 'CHART_COLUMN' }, { useYn: 'Y' as any });
    }
    expect((await db.manager.findOne(Metric, { where: { id: metric.id } })).definition).toBe(
      metric.definition,
    );
    expect((await service.analysis(body.dashboardId, 7)).data).toEqual(before);
    expect([await db.manager.count(Dataset), await db.manager.count(Widget)]).toEqual(counts);
    expect((await db.manager.findOne(Metric, { where: { id: metric.id } })).aggregation).toBe(
      'SUM',
    );
    connection.queryDuckDB.mockClear();
  });
  it('UC-003 rejects a metric write racing after compilation before the atomic CAS', async () => {
    const { metric, body } = await metricChangeFixture();
    const before = (await service.analysis(body.dashboardId, 7)).data;
    const newer = JSON.stringify({
      ...JSON.parse(metric.definition),
      definitionVersion: 2,
      aggregation: 'MAX',
    });
    const originalPreview = service.preview.bind(service);
    const spy = jest.spyOn(service, 'preview').mockImplementationOnce(async (input, actor) => {
      await db.manager.update(Metric, { id: metric.id }, { definition: newer });
      return originalPreview(input, actor);
    });
    try {
      await expect(service.metricChangeSave(body, 7)).rejects.toThrow('지표 계산식이 변경');
    } finally {
      spy.mockRestore();
    }
    expect((await db.manager.findOne(Metric, { where: { id: metric.id } })).definition).toBe(newer);
    expect((await service.analysis(body.dashboardId, 7)).data).toEqual(before);
  });
  it('UC-003 refreshes only the selected item of a structured dashboard snapshot', async () => {
    const { metric, body } = await metricChangeFixture();
    const definition = JSON.parse(metric.definition);
    const item = { sourceId: 1, metricId: metric.id, definitionVersion: 1, definition };
    const saved = await service.save({ draft: draft() }, 7, {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      items: [
        { ...item, chart: 'number' },
        { ...item, chart: 'bar', dimension: 'device_type' },
      ],
    });
    body.dashboardId = saved.data.id;
    body.expectedRevision = saved.data.revision;
    const before = (await service.analysis(body.dashboardId, 7, true)).data;
    const keep = JSON.parse(
      (await db.manager.findOneBy(Dashboard, { id: body.dashboardId })).structuredDefinition,
    ).items[1];
    await service.metricChangeSave(body, 7);
    const snapshot = JSON.parse(
      (await db.manager.findOneBy(Dashboard, { id: body.dashboardId })).structuredDefinition,
    );
    expect(snapshot.items[0].definitionVersion).toBe(2);
    expect(snapshot.items[0].key).toBe(before.widgets[0].blockId);
    expect(snapshot.items[1]).toEqual(keep);
    const after = (await service.analysis(body.dashboardId, 7, true)).data;
    expect(after.widgets[0].sql).toContain('AVG("amount")');
    expect(after.widgets[1]).toEqual(before.widgets[1]);
  });
  async function batchFixture() {
    const definition = {
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: 1,
      label: 'Batch revenue',
      aggregation: 'SUM',
      column: 'amount',
      decimalPlaces: 2,
      numberNotation: 'plain',
      unit: '',
    };
    const metric = await db.manager.save(Metric, {
      name: 'batch-' + Math.random(),
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      useYn: 'Y',
      definition: JSON.stringify(definition),
    });
    const snapshot = {
      schemaVersion: 1,
      kind: 'structured-bi',
      sourceId: 1,
      metricId: metric.id,
      definitionVersion: 1,
      definition,
    };
    const primary = await service.save(
      { draft: { ...draft(), title: 'Batch total', widgets: [draft().widgets[0]] } },
      7,
      { ...snapshot, chart: 'number' },
    );
    const other = await service.save(
      { draft: { ...draft(), title: 'Batch devices', widgets: [draft().widgets[1]] } },
      7,
      { ...snapshot, chart: 'bar', dimension: 'device_type' },
    );
    const unlinked = await service.save(
      { draft: { ...draft(), title: 'Same SQL but no link', widgets: [draft().widgets[0]] } },
      7,
    );
    const body = {
      dashboardId: primary.data.id,
      selectedWidget: 0,
      metricId: metric.id,
      expectedDefinitionVersion: 1,
      expectedRevision: primary.data.revision,
      calculation: { aggregation: 'AVG', column: 'amount' },
      targets: [
        { dashboardId: primary.data.id, expectedRevision: primary.data.revision },
        { dashboardId: other.data.id, expectedRevision: other.data.revision },
      ],
    };
    return { body, metric, primary, other, unlinked };
  }
  it('UC-004 discovers owned proven links, previews and atomically updates multiple analyses', async () => {
    const { body, metric, primary, other, unlinked } = await batchFixture();
    const impact = await service.metricImpact(body, 7);
    expect(impact.data.analyses.map(a => a.dashboardId)).toEqual([primary.data.id, other.data.id]);
    const preview = await service.metricBatchPreview(body, 7);
    expect(preview.data.analyses).toHaveLength(2);
    expect(preview.data.analyses[0].preview.widgets[0].datas[0].value).toBeCloseTo(130 / 3);
    expect(preview.data.analyses[1].preview.widgets[0].datas).toEqual(
      expect.arrayContaining([
        { device_type: 'phone', value: 15 },
        { device_type: 'desktop', value: 100 },
      ]),
    );
    expect((await db.manager.findOne(Metric, { where: { id: metric.id } })).definition).toBe(
      metric.definition,
    );
    const result = await service.metricBatchSave(body, 7);
    expect(result.data.updatedAnalyses).toEqual([primary.data.id, other.data.id]);
    expect(
      JSON.parse((await db.manager.findOne(Metric, { where: { id: metric.id } })).definition)
        .definitionVersion,
    ).toBe(2);
    for (const id of result.data.updatedAnalyses)
      expect((await service.analysis(id, 7)).data.widgets[0].sql).toContain('AVG("amount")');
    expect((await service.analysis(unlinked.data.id, 7)).data.widgets[0].sql).toContain(
      'sum(amount)',
    );
  });
  it('UC055 finishes real aggregate queries before sorted parent locks, validates all targets, then writes', async () => {
    const { body, primary, other } = await batchFixture();
    // Primary save order deliberately differs from parent lock order.
    const reversed = { ...body, dashboardId: other.data.id, expectedRevision: other.data.revision };
    const events: string[] = [];
    const query = connection.queryDuckDB.getMockImplementation();
    const find = EntityManager.prototype.findOne;
    const update = EntityManager.prototype.update;
    const save = EntityManager.prototype.save;
    connection.queryDuckDB.mockImplementation(async (...args) => {
      expect(db.createQueryRunner().isTransactionActive).toBe(false);
      expect(events.some(e => e.startsWith('parent:'))).toBe(false);
      const result = await query(...args);
      events.push('sql-done');
      return result;
    });
    const findSpy = jest
      .spyOn(EntityManager.prototype, 'findOne')
      .mockImplementation(function (entity: any, options: any) {
        if (entity === Dashboard && this.queryRunner?.isTransactionActive)
          events.push(`parent:${options.where.id}`);
        return find.call(this, entity, options);
      });
    const updateSpy = jest
      .spyOn(EntityManager.prototype, 'update')
      .mockImplementation(function (entity: any, ...args: any[]) {
        if (entity === Metric) events.push('metric-cas');
        return update.call(this, entity, ...args);
      });
    const saveSpy = jest
      .spyOn(EntityManager.prototype, 'save')
      .mockImplementation(function (...args: any[]) {
        if (this.queryRunner?.isTransactionActive) events.push('persist');
        return save.apply(this, args);
      });
    try {
      const result = await service.metricBatchSave(reversed, 7);
      expect(result.data.updatedAnalyses).toEqual([other.data.id, primary.data.id]);
      expect(events.filter(e => e === 'sql-done').length).toBeGreaterThanOrEqual(2);
      const ids = [primary.data.id, other.data.id].sort((a, b) => a - b);
      expect(events.filter(e => e.startsWith('parent:')).slice(0, 2)).toEqual(
        ids.map(id => `parent:${id}`),
      );
      const cas = events.indexOf('metric-cas');
      expect(cas).toBeGreaterThan(events.lastIndexOf('sql-done'));
      expect(
        events.slice(0, cas).filter(e => e.startsWith('parent:')).length,
      ).toBeGreaterThanOrEqual(4);
      expect(events.indexOf('persist')).toBeGreaterThan(cas);
    } finally {
      connection.queryDuckDB.mockImplementation(query);
      findSpy.mockRestore();
      updateSpy.mockRestore();
      saveSpy.mockRestore();
    }
  });
  it.each(['revision', 'owner', 'deleted'])(
    'UC055 rejects %s changes after real batch preparation before any Metric/child write',
    async race => {
      const { body, metric, other } = await batchFixture();
      const counts = await Promise.all(
        [Dataset, Widget, DashboardWidget].map(entity => db.manager.count(entity)),
      );
      const preview = service.preview.bind(service);
      const update = EntityManager.prototype.update;
      const save = EntityManager.prototype.save;
      let metricWrites = 0,
        childWrites = 0;
      const updateSpy = jest
        .spyOn(EntityManager.prototype, 'update')
        .mockImplementation(function (entity: any, ...args: any[]) {
          if (entity === Metric) metricWrites++;
          return update.call(this, entity, ...args);
        });
      const saveSpy = jest
        .spyOn(EntityManager.prototype, 'save')
        .mockImplementation(function (...args: any[]) {
          if (this.queryRunner?.isTransactionActive) childWrites++;
          return save.apply(this, args);
        });
      let calls = 0;
      const spy = jest.spyOn(service, 'preview').mockImplementation(async (...args) => {
        const result = await preview(...args);
        // prepareSave previews each target. Change the later target after all SQL completes.
        if (++calls === body.targets.length) {
          expect(db.createQueryRunner().isTransactionActive).toBe(false);
          if (race === 'revision')
            await db.manager.update(Dashboard, other.data.id, { title: 'Concurrent title' });
          if (race === 'owner')
            await db.manager.update(UserMapping, { dashboardId: other.data.id }, { userInfoId: 8 });
          if (race === 'deleted') await db.manager.delete(Dashboard, other.data.id);
        }
        return result;
      });
      try {
        await expect(service.metricBatchSave(body, 7)).rejects.toThrow(
          race === 'revision'
            ? '다른 화면'
            : race === 'owner'
            ? 'not dashboard owner'
            : 'Dashboard unavailable',
        );
        expect(calls).toBe(body.targets.length);
        expect(metricWrites).toBe(0);
        expect(childWrites).toBe(0);
        expect((await db.manager.findOneBy(Metric, { id: metric.id })).definition).toBe(
          metric.definition,
        );
        expect(
          await Promise.all(
            [Dataset, Widget, DashboardWidget].map(entity => db.manager.count(entity)),
          ),
        ).toEqual(counts);
      } finally {
        spy.mockRestore();
        updateSpy.mockRestore();
        saveSpy.mockRestore();
      }
    },
  );
  it('UC-004 excludes deleted/foreign/different source links and rejects unlinked target injection', async () => {
    const { body, metric, unlinked } = await batchFixture();
    const original = await db.manager.findOne(Dashboard, { where: { id: body.dashboardId } });
    for (const variant of ['foreign', 'deleted', 'source']) {
      const row = await db.manager.save(Dashboard, {
        title: variant,
        analysisDefinition:
          variant === 'source'
            ? JSON.stringify({ ...JSON.parse(original.analysisDefinition), databaseId: 2 })
            : original.analysisDefinition,
        structuredDefinition: original.structuredDefinition,
        delYn: variant === 'deleted' ? 'Y' : ('N' as any),
      });
      await db.manager.save(UserMapping, {
        dashboardId: row.id,
        userInfoId: variant === 'foreign' ? 8 : 7,
      });
    }
    expect((await service.metricImpact(body, 7)).data.analyses).toHaveLength(2);
    await expect(
      service.metricBatchSave(
        {
          ...body,
          targets: [
            ...body.targets,
            { dashboardId: unlinked.data.id, expectedRevision: unlinked.data.revision },
          ],
        },
        7,
      ),
    ).rejects.toThrow('연결된 소유 분석');
    expect((await db.manager.findOne(Metric, { where: { id: metric.id } })).definition).toBe(
      metric.definition,
    );
  });
  it('UC-004 checks every target revision and the distinct ten-analysis selection bound', async () => {
    const { body, metric } = await batchFixture();
    await expect(
      service.metricBatchSave(
        {
          ...body,
          targets: [body.targets[0], { ...body.targets[1], expectedRevision: '0'.repeat(64) }],
        },
        7,
      ),
    ).rejects.toThrow('분석이 변경');
    for (const targets of [
      [],
      [body.targets[0], body.targets[0]],
      [body.targets[1]],
      Array(11).fill(body.targets[0]),
    ])
      await expect(service.metricBatchSave({ ...body, targets }, 7)).rejects.toThrow('1~10개');
    expect((await db.manager.findOne(Metric, { where: { id: metric.id } })).definition).toBe(
      metric.definition,
    );
  });
  it('UC-004 rolls back the metric and already saved first analysis on later chart failure', async () => {
    const { body, metric } = await batchFixture();
    const before = await Promise.all(body.targets.map(t => service.analysis(t.dashboardId, 7)));
    const counts = [await db.manager.count(Dataset), await db.manager.count(Widget)];
    await db.manager.update(Component, { type: 'CHART_COLUMN' }, { useYn: 'N' as any });
    try {
      await expect(service.metricBatchSave(body, 7)).rejects.toThrow('component unavailable');
    } finally {
      await db.manager.update(Component, { type: 'CHART_COLUMN' }, { useYn: 'Y' as any });
    }
    expect(await Promise.all(body.targets.map(t => service.analysis(t.dashboardId, 7)))).toEqual(
      before,
    );
    expect((await db.manager.findOne(Metric, { where: { id: metric.id } })).definition).toBe(
      metric.definition,
    );
    expect([await db.manager.count(Dataset), await db.manager.count(Widget)]).toEqual(counts);
  });
  it('UC-004 updates every matching chart within a composite analysis and records raw explicit links', async () => {
    const { body, metric } = await batchFixture();
    const definition = JSON.parse(metric.definition);
    const item = { sourceId: 1, metricId: metric.id, definitionVersion: 1, definition };
    const composite = await service.save({ draft: draft() }, 7, {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      items: [item, item],
    });
    const targets = [
      ...body.targets,
      { dashboardId: composite.data.id, expectedRevision: composite.data.revision },
    ];
    const preview = await service.metricBatchPreview({ ...body, targets }, 7);
    expect(
      preview.data.analyses.find(a => a.dashboardId === composite.data.id).widgetIndices,
    ).toEqual([0, 1]);
    await service.metricBatchSave({ ...body, targets }, 7);
    expect(
      (await service.analysis(composite.data.id, 7)).data.widgets.every(w =>
        w.sql.includes('AVG("amount")'),
      ),
    ).toBe(true);
    const raw = await service.save({ draft: draft() }, 7);
    await service.metricChangeSave(
      {
        ...body,
        dashboardId: raw.data.id,
        expectedRevision: raw.data.revision,
        expectedDefinitionVersion: 2,
      },
      7,
    );
    expect(
      (await service.metricImpact({ ...body, dashboardId: raw.data.id }, 7)).data.analyses.some(
        a => a.dashboardId === raw.data.id,
      ),
    ).toBe(true);
    expect(
      JSON.parse(
        (await db.manager.findOne(Dashboard, { where: { id: raw.data.id } })).structuredDefinition,
      ).kind,
    ).toBe('metric-linked-analysis');
  });
  it('never drops an indicated Studio scope when persisted JSON is corrupt', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    await db.manager.update(Dashboard, { id }, { structuredDefinition: '{"studioFilters":[' });
    await expect(service.analysis(id, 7, true)).rejects.toThrow('기간·필터');
    await db.manager.update(Dashboard, { id }, { structuredDefinition: '{"studioDateRange":' });
    await expect(service.analysis(id, 7, true)).rejects.toThrow('기간·필터');
  });
  it('recovers an ordinary save with malformed prior structured metadata without inventing links', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    await db.manager.update(Dashboard, { id }, { structuredDefinition: '{broken' });
    const current = (await service.analysis(id, 7, true)).data;
    await service.save(
      {
        dashboardId: id,
        expectedRevision: current.revision,
        draft: { ...current, title: 'Recovered' },
      },
      7,
    );
    const row = await db.manager.findOneBy(Dashboard, { id });
    expect(row.structuredDefinition).toBeNull();
    expect(row.title).toBe('Recovered');
  });
  it('preserves explicit metric links through title-only saves and block reorder, but detaches changed calculations', async () => {
    const { metric } = await batchFixture();
    const definition = JSON.parse(metric.definition);
    const item = { sourceId: 1, metricId: metric.id, definitionVersion: 1, definition };
    const created = await service.save({ draft: draft() }, 7, {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      items: [
        { ...item, chart: 'number' },
        { ...item, chart: 'bar', dimension: 'device_type' },
      ],
    });
    const id = created.data.id;
    const snapshot = async () =>
      JSON.parse((await db.manager.findOneBy(Dashboard, { id })).structuredDefinition);
    const before = (await service.analysis(id, 7, true)).data;
    const originalLinks = await snapshot();
    await service.save(
      {
        dashboardId: id,
        expectedRevision: before.revision,
        draft: {
          ...before,
          widgets: before.widgets.map((w, i) => (i === 0 ? { ...w, title: 'Title only' } : w)),
        },
      },
      7,
    );
    expect(await snapshot()).toEqual(originalLinks);
    const renamed = (await service.analysis(id, 7, true)).data;
    expect(renamed.widgets.map(w => w.blockId)).toEqual(before.widgets.map(w => w.blockId));
    await service.save(
      {
        dashboardId: id,
        expectedRevision: renamed.revision,
        draft: { ...renamed, widgets: [...renamed.widgets].reverse() },
      },
      7,
    );
    expect((await snapshot()).items).toEqual([...originalLinks.items].reverse());
    const reordered = (await service.analysis(id, 7, true)).data;
    await service.save(
      {
        dashboardId: id,
        expectedRevision: reordered.revision,
        draft: {
          ...reordered,
          widgets: reordered.widgets.map((w, i) =>
            i === 0 ? { ...w, sql: w.sql.replace('sum(amount)', 'avg(amount)') } : w,
          ),
        },
      },
      7,
    );
    const detached = await snapshot();
    expect(detached.items[0].metricId).toBeUndefined();
    expect(detached.items[1]).toEqual(originalLinks.items[0]);
    expect((await service.analysis(id, 7, true)).data.widgets[0].sql).toContain('avg(amount)');
  });
  it('UC-006 preserves stable IDs and custom geometry across reorder, SQL edit and DB widget replacement', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    const before = (await service.analysis(id, 7, true)).data;
    const mappings = await db.manager.find(DashboardWidget, {
      where: { dashboardId: id },
      order: { id: 'ASC' },
    });
    const positions = [
      { i: String(mappings[0].widgetId), x: 6, y: 9, w: 6, h: 3 },
      { i: String(mappings[1].widgetId), x: 0, y: 2, w: 12, h: 5 },
    ];
    await db.manager.update(Dashboard, { id }, { layout: JSON.stringify(positions) });
    const current = (await service.analysis(id, 7, true)).data;
    const changed = {
      ...current,
      widgets: [
        current.widgets[1],
        { ...current.widgets[0], title: 'Changed', sql: 'SELECT AVG(amount) AS value FROM source' },
      ],
    };
    await service.save({ dashboardId: id, draft: changed, expectedRevision: current.revision }, 7);
    const after = (await service.analysis(id, 7, true)).data;
    expect(after.widgets.map(w => w.blockId)).toEqual([
      before.widgets[1].blockId,
      before.widgets[0].blockId,
    ]);
    const layout = JSON.parse((await db.manager.findOneBy(Dashboard, { id })).layout);
    expect(layout.map(({ i, ...g }) => g)).toEqual(positions.reverse().map(({ i, ...g }) => g));
    expect(layout[0].i).not.toBe(positions[0].i);
    const counts = await Promise.all([Widget, Dataset].map(e => db.manager.count(e)));
    await expect(
      service.save({ dashboardId: id, draft: changed, expectedRevision: current.revision }, 7),
    ).rejects.toThrow('다른 화면');
    expect(await Promise.all([Widget, Dataset].map(e => db.manager.count(e)))).toEqual(counts);
  });
  it('UC-004 preserves custom chart geometry while remapping newly stored widget IDs', async () => {
    const { body } = await batchFixture();
    const mapping = await db.manager.findOne(DashboardWidget, {
      where: { dashboardId: body.dashboardId },
    });
    const geometry = { i: String(mapping.widgetId), x: 6, y: 7, w: 6, h: 3, minW: 4 };
    await db.manager.update(
      Dashboard,
      { id: body.dashboardId },
      { layout: JSON.stringify([geometry]) },
    );
    body.expectedRevision = (await service.analysis(body.dashboardId, 7, true)).data.revision;
    body.targets[0].expectedRevision = body.expectedRevision;
    await service.metricBatchSave(body, 7);
    const layout = JSON.parse(
      (await db.manager.findOne(Dashboard, { where: { id: body.dashboardId } })).layout,
    );
    expect(layout[0].i).not.toBe(geometry.i);
    expect({ ...layout[0], i: geometry.i }).toEqual(geometry);
  });
});
