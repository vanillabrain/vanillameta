jest.mock('./ai.service', () => ({ AiService: class {} }));
import { AiDashboardService } from './ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { metadataTransaction } from '../common/metadata-work';
import { sourceQuery } from './dashboard-draft';
import * as compiler from '../bi/source-condition-definition';
import { DuckDBService } from '../analysis/duckdb.service';
import { DataSource } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
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
const definition = {
  include: { kind: 'predicate', column: 'device', operator: 'eq', values: ['phone'] },
  exclude: null,
};
const draft = () => ({
  databaseId: 1,
  title: 'Scoped',
  explanation: '',
  widgets: [
    {
      blockId: 'total',
      title: 'Total',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
    },
    {
      blockId: 'groups',
      title: 'Groups',
      description: '',
      type: 'CHART_COLUMN',
      sql: 'SELECT device, sum(amount) AS value FROM source GROUP BY device',
      valueField: 'value',
      categoryField: 'device',
    },
  ],
});
describe('UC052 scoped runtime actual DuckDB and isolated SQLite', () => {
  let root: string;
  let worker: DuckDBService;
  let db: DataSource;
  let service: AiDashboardService;
  let connection: any;
  let file: string;
  let revision: string;
  const conditions = () => ({ sourceRevision: revision, definition });
  const uploadRoot = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc052-runtime-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    file = (
      await worker.importFile({
        originalname: 'runtime.csv',
        buffer: Buffer.from(
          'device,amount,event_time\nphone,10,2026-01-01T00:00:00Z\nphone,20,2026-01-02T00:00:00Z\ndesktop,100,2026-01-02T00:00:00Z\n',
        ),
      })
    ).filename;
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
      connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename: file } }),
      engine: 'duckdb',
      type: 'FILE',
    });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
    revision = await connection.duckDBVersion(1);
    service = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (uploadRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = uploadRoot;
  });
  it('shape-validates without guessing column types and clones the AST', () => {
    const validate = (compiler as any).validateConditionDefinition;
    expect(typeof validate).toBe('function');
    const input = JSON.parse(JSON.stringify(definition));
    const result = validate(input);
    input.include.values[0] = 'changed';
    expect(result.include.values).toEqual(['phone']);
    expect(() => validate({ ...definition, surprise: true })).toThrow();
    expect(() =>
      validate({ include: { ...definition.include, values: [NaN] }, exclude: null }),
    ).toThrow();
  });
  it('requires actual typed schema for scoped sourceQuery and preserves binding order', async () => {
    expect(() =>
      (sourceQuery as any)(draft().widgets[0].sql, ['device'], [], undefined, [], [], definition),
    ).toThrow();
    const query = (sourceQuery as any)(
      draft().widgets[0].sql,
      ['device', 'amount'],
      [{ column: 'amount', range: { min: 15 } }],
      undefined,
      [],
      ['amount'],
      definition,
      [
        { name: 'device', type: 'VARCHAR' },
        { name: 'amount', type: 'BIGINT' },
      ],
    );
    expect(query.bindings).toEqual([15, 'phone']);
    expect((await worker.query(file, query.sql, query.bindings)).datas).toEqual([{ value: 20 }]);
  });
  it('applies conditions to numeric, chart, current/prior trends and comparison', async () => {
    const result = (
      await service.preview(
        {
          draft: draft(),
          conditions: conditions(),
          dateRange: { column: 'event_time', start: '2026-01-02', end: '2026-01-02' },
          comparePrevious: true,
          includeTrends: true,
          includeQueries: true,
        },
        7,
      )
    ).data;
    expect(result.widgets[0].datas).toEqual([{ value: 20 }]);
    expect(result.widgets[1].datas).toEqual([{ device: 'phone', value: 20 }]);
    expect(result.widgets[0].comparison.previousValue).toBe(10);
    expect(result.widgets[0].trend.points.map(p => p.value)).toEqual([20]);
    expect(result.widgets[0].previousTrend.points.map(p => p.value)).toEqual([10]);
  });
  it('rejects stale wrappers, damaged shape and actual schema type mismatch', async () => {
    await expect(
      service.preview(
        { draft: draft(), conditions: { ...conditions(), sourceRevision: 'b'.repeat(64) } },
        7,
      ),
    ).rejects.toThrow();
    await expect(
      service.preview({ draft: draft(), conditions: { ...conditions(), extra: true } }, 7),
    ).rejects.toThrow();
    await expect(
      service.preview(
        {
          draft: draft(),
          conditions: {
            ...conditions(),
            definition: { include: { ...definition.include, column: 'amount' }, exclude: null },
          },
        },
        7,
      ),
    ).rejects.toThrow();
  });
  it('persists scoped Dataset queries and inherits scope on ordinary edits; explicit snapshot removes it', async () => {
    const snapshot = {
      sourceId: 1,
      studioConditions: conditions(),
      studioFilters: [{ column: 'amount', range: { min: 15 } }],
    };
    const id = (await service.save({ draft: draft() }, 7, snapshot)).data.id;
    expect((await service.analysis(id, 7)).data.defaultConditions).toEqual(conditions());
    const assertDatasets = async (total: number) => {
      const mappings = await db.manager.find(DashboardWidget, {
        where: { dashboardId: id },
        order: { id: 'ASC' },
      });
      const widget = await db.manager.findOneBy(Widget, { id: mappings[0].widgetId });
      const dataset = await db.manager.findOneBy(Dataset, { id: widget.datasetId });
      expect((await worker.query(file, dataset.query)).datas).toEqual([{ value: total }]);
    };
    await assertDatasets(20);
    await service.save(
      { dashboardId: id, draft: { ...(await service.analysis(id, 7)).data, title: 'Edited' } },
      7,
    );
    expect((await service.analysis(id, 7)).data.defaultConditions).toEqual(conditions());
    await assertDatasets(20);
    await service.save({ dashboardId: id, draft: (await service.analysis(id, 7)).data }, 7, {
      sourceId: 1,
    });
    expect((await service.analysis(id, 7)).data.defaultConditions).toBeUndefined();
    await assertDatasets(130);
  });
  it('checks source READ before snapshot and rechecks after execution without requiring source EDIT', async () => {
    const access = { assert: jest.fn().mockRejectedValueOnce(new Error('read denied')) };
    const secured = new AiDashboardService(
      {} as any,
      connection,
      db.getRepository(Dashboard),
      access as any,
    );
    const capture = jest.spyOn(connection, 'withDuckDBSnapshot');
    await expect(secured.preview({ draft: draft(), conditions: conditions() }, 7)).rejects.toThrow(
      'read denied',
    );
    expect(capture).not.toHaveBeenCalled();
    access.assert.mockResolvedValue(undefined);
    expect(
      (await secured.preview({ draft: draft(), conditions: conditions() }, 7)).data.widgets[0]
        .datas,
    ).toEqual([{ value: 30 }]);
    expect(access.assert.mock.calls).toEqual([
      ['database', 1, 7, 'read'],
      ['database', 1, 7, 'read'],
      ['database', 1, 7, 'read'],
    ]);
    access.assert.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('revoked'));
    await expect(secured.preview({ draft: draft(), conditions: conditions() }, 7)).rejects.toThrow(
      'revoked',
    );
    capture.mockRestore();
  });
  it('keeps saved scope in raw detail and aggregate contribution rows, with no caller override', async () => {
    const id = (
      await service.save({ draft: draft() }, 7, { sourceId: 1, studioConditions: conditions() })
    ).data.id;
    const saved = (await service.analysis(id, 7, true)).data;
    const body = { dashboardId: id, draft: saved, sourceRevision: revision };
    const details = (await service.details(body, 7)).data;
    expect(details.totalRows).toBe('2');
    expect(details.datas.map(r => r.amount)).toEqual([10, 20]);
    const contribution = (
      await service.details(
        { ...body, contribution: { widgetIndex: 0, expectedRevision: saved.revision } },
        7,
      )
    ).data;
    expect(contribution.totalRows).toBe('2');
    expect(contribution.datas.map(r => r.amount)).toEqual([10, 20]);
    await expect(
      service.details(
        {
          ...body,
          conditions: { ...conditions(), definition: { include: null, exclude: null } },
          contribution: { widgetIndex: 0, expectedRevision: saved.revision },
        },
        7,
      ),
    ).rejects.toThrow();
  });
  it('keeps saved conditions in AI context and generated result verification', async () => {
    const id = (
      await service.save({ draft: draft() }, 7, { sourceId: 1, studioConditions: conditions() })
    ).data.id;
    const ai = {
      callLlm: jest.fn().mockResolvedValue('Scoped evidence'),
      getSchemaContext: jest.fn(),
    };
    const assistant = new AiDashboardService(ai as any, connection, db.getRepository(Dashboard));
    const current = (await service.analysis(id, 7)).data;
    await assistant.assistant({ dashboardId: id, currentDraft: current, prompt: 'Explain' }, 7);
    expect(JSON.parse(ai.callLlm.mock.calls[0][1]).context.widgets[0].datas).toEqual([
      { value: 30 },
    ]);
  });
  it('legacy omitted conditions still scope previews; explicit null fails closed', async () => {
    const id = (
      await service.save({ draft: draft() }, 7, { sourceId: 1, studioConditions: conditions() })
    ).data.id;
    const current = (await service.analysis(id, 7)).data;
    expect(
      (await service.preview({ dashboardId: id, draft: current }, 7)).data.widgets[0].datas,
    ).toEqual([{ value: 30 }]);
    await expect(
      service.preview({ dashboardId: id, draft: current, conditions: null }, 7),
    ).rejects.toThrow();
    await expect(
      service.details(
        { dashboardId: id, draft: current, sourceRevision: revision, conditions: null },
        7,
      ),
    ).rejects.toThrow();
  });
  it('rejects encoded Dataset queries over 60000 UTF8 bytes before any writes', async () => {
    const values = Array.from({ length: 20 }, (_, i) => '한'.repeat(500) + i);
    const scope = {
      sourceRevision: revision,
      definition: {
        include: { kind: 'predicate', column: 'device', operator: 'in', values },
        exclude: null,
      },
    };
    const count = await db.manager.count(Dataset);
    await expect(
      service.save({ draft: draft() }, 7, { sourceId: 1, studioConditions: scope }),
    ).rejects.toThrow();
    expect(await db.manager.count(Dataset)).toBe(count);
  });
  it('persists punctuation and Unicode values through the legacy DuckDB guard without broadening', async () => {
    const scope = {
      sourceRevision: revision,
      definition: { include: { ...definition.include, values: ["한글'; -- ? 😀"] }, exclude: null },
    };
    const id = (await service.save({ draft: draft() }, 7, { sourceId: 1, studioConditions: scope }))
      .data.id;
    const mapping = await db.manager.findOneBy(DashboardWidget, { dashboardId: id });
    const widget = await db.manager.findOneBy(Widget, { id: mapping.widgetId });
    const dataset = await db.manager.findOneBy(Dataset, { id: widget.datasetId });
    expect(dataset.query).not.toContain(';');
    expect((await worker.query(file, dataset.query)).datas).toEqual([{ value: null }]);
    expect((await service.preview({ draft: draft() }, 7)).data.widgets[0].datas).toEqual([
      { value: 130 },
    ]);
  });
  it('allows explicit conditions for a NEW legacy copy and freezes server-owned scope, while refusing existing scope changes', async () => {
    const id = (await service.save({ draft: draft(), conditions: conditions() }, 7)).data.id;
    const saved = (await service.analysis(id, 7)).data;
    expect(saved.defaultConditions).toEqual(conditions());
    expect(
      (await service.preview({ dashboardId: id, draft: saved }, 7)).data.widgets[0].datas,
    ).toEqual([{ value: 30 }]);
    const row = await db.manager.findOneBy(Dashboard, { id });
    expect(JSON.parse(row.structuredDefinition).studioConditions).toEqual(conditions());
    const count = await db.manager.count(Dataset);
    await expect(
      service.save(
        {
          dashboardId: id,
          draft: saved,
          conditions: { ...conditions(), definition: { include: null, exclude: null } },
        },
        7,
      ),
    ).rejects.toThrow();
    expect(await db.manager.count(Dataset)).toBe(count);
    await service.save({ dashboardId: id, draft: saved, conditions: conditions() }, 7);
    expect((await service.analysis(id, 7)).data.defaultConditions).toEqual(conditions());
    await expect(
      service.save(
        { draft: draft(), conditions: { ...conditions(), sourceRevision: 'b'.repeat(64) } },
        7,
      ),
    ).rejects.toThrow();
  });
  it.each([false, true])(
    'rejects source replacement after preview before the first write even under inherited file pin (existing=%s)',
    async existing => {
      const id = existing
        ? (await service.save({ draft: draft(), conditions: conditions() }, 7)).data.id
        : undefined;
      const current = existing ? (await service.analysis(id, 7)).data : draft();
      const requested = { ...current, title: 'Must remain an unsaved draft' };
      const beforeDraft = JSON.stringify(requested);
      const original = existing ? await db.manager.findOneBy(Dashboard, { id }) : undefined;
      const entities = [
        Dashboard,
        DashboardShare,
        DashboardWidget,
        UserMapping,
        Dataset,
        Widget,
        Metric,
      ];
      const counts = await Promise.all(entities.map(entity => db.manager.count(entity)));
      const replacement = await worker.importFile({
        originalname: 'replacement.csv',
        buffer: Buffer.from('device,amount,event_time\nphone,900,2026-01-02T00:00:00Z\n'),
      });
      const source = await db.manager.findOneBy(Database, { id: 1 });
      const statements = jest.spyOn(db.logger, 'logQuery');
      const preview = service.preview.bind(service);
      const injected = jest
        .spyOn(service, 'preview')
        .mockImplementationOnce(async (body, userId, action) => {
          const result = await preview(body, userId, action);
          expect(result.data.sourceRevision).toBe(revision);
          expect(result.data.widgets[0].datas).toEqual([{ value: 30 }]);
          await metadataTransaction(db, manager =>
            manager.update(Database, 1, {
              connectionConfig: JSON.stringify({
                client: 'duckdb',
                connection: { filename: replacement.filename },
              }),
            }),
          );
          return result;
        });
      try {
        // Outer Studio callers can retain A's inherited pin while metadata has moved to B.
        await expect(
          connection.withDuckDBSnapshot(1, () =>
            service.save(
              {
                ...(existing ? { dashboardId: id } : {}),
                draft: requested,
                conditions: conditions(),
              },
              7,
            ),
          ),
        ).rejects.toMatchObject({ status: 409 });
        // The injected source replacement is the only attempted DML, not merely
        // the only committed change after a rollback of later save writes.
        expect(
          statements.mock.calls
            .map(([sql]) => sql)
            .filter(sql => /^(?:INSERT|UPDATE|DELETE)\b/i.test(sql)),
        ).toEqual([expect.stringMatching(/^UPDATE "database" SET "connectionConfig"/)]);
        expect(await Promise.all(entities.map(entity => db.manager.count(entity)))).toEqual(counts);
        expect(JSON.stringify(requested)).toBe(beforeDraft);
        if (existing) expect(await db.manager.findOneBy(Dashboard, { id })).toEqual(original);
        expect(
          (
            await worker.query(
              replacement.filename,
              'SELECT sum(amount) AS value FROM uploaded_data',
            )
          ).datas,
        ).toEqual([{ value: 900 }]);
      } finally {
        statements.mockRestore();
        injected.mockRestore();
        await metadataTransaction(db, manager =>
          manager.update(Database, 1, { connectionConfig: source.connectionConfig }),
        );
      }
    },
  );
  it('fails closed on malformed saved conditions including broken JSON before writing', async () => {
    const id = (await service.save({ draft: draft() }, 7)).data.id;
    for (const structuredDefinition of [
      JSON.stringify({ studioConditions: { ...conditions(), definition: null } }),
      '{"studioConditions":',
    ]) {
      await db.manager.update(Dashboard, id, { structuredDefinition });
      const count = await db.manager.count(Dataset);
      await expect(service.analysis(id, 7)).rejects.toThrow();
      await expect(service.save({ dashboardId: id, draft: draft() }, 7)).rejects.toThrow();
      expect(await db.manager.count(Dataset)).toBe(count);
    }
  });
});
