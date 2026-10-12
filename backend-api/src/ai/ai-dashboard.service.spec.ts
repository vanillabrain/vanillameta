import { AiDashboardService } from './ai-dashboard.service';
import { validateDraft, validateSourceSql, sourceQuery } from './dashboard-draft';
import { DuckDBService } from '../analysis/duckdb.service';
import { DataSource } from 'typeorm';
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
    expect(query.sql).toContain('WHERE "device_type" = ?) SELECT sum');
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
      buffer: Buffer.from('device_type,amount\nphone,10\nphone,20\ndesktop,100\n'),
    });
    db = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
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
    connection = {
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
  it('validates LLM JSON using actual fields', async () => {
    const generated = await service.generate({ databaseId: 1, prompt: 'Revenue' }, 7);
    expect('data' in generated && generated.data).toEqual(draft());
    const bad = draft();
    bad.widgets[0].valueField = 'missing';
    ai.callLlm.mockResolvedValueOnce(JSON.stringify(bad));
    const repaired = await service.generate({ databaseId: 1, prompt: 'Revenue' }, 7);
    expect('data' in repaired && repaired.data).toEqual(draft());
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
    expect('data' in repaired && repaired.data).toEqual(draft());
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
      expect('data' in repaired && repaired.data).toEqual(draft());
      expect(ai.callLlm).toHaveBeenCalledTimes(2);
      expect(ai.callLlm.mock.calls[1][1]).toContain('SUM(bid_request_cnt)');
      expect(
        connection.queryDuckDB.mock.calls.some(call => /count\(\*\) AS value/i.test(call[1])),
      ).toBe(false);
    },
  );
  it('saves ordinary query SQL, definition, layout; edits preserve old shared widgets', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    const old = await db.manager.find(Widget);
    const metadata = await db.manager.findOneBy(Dashboard, { id });
    expect(JSON.parse(metadata.layout).map(x => [x.x, x.y, x.w, x.h])).toEqual([
      [0, 0, 6, 2],
      [0, 2, 12, 5],
    ]);
    expect((await service.analysis(id, 7)).data).toEqual(draft());
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
});
