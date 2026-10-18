jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { createHash } from 'crypto';
import { DuckDBInstance } from '@duckdb/node-api';
import { DataSource } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Metric } from '../metric/entities/metric.entity';
import { StudioState } from './entities/studio-state.entity';
import { StudioRemixRequest } from './entities/studio-remix.entity';
import { StudioRun } from './entities/studio-run.entity';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
import { StudioRemixService } from './studio-remix.service';
import { StudioService } from './studio.service';
import { StudioPublicationService } from './studio-publication.service';
import { StudioCreationService } from './studio-creation.service';
import { BiService } from '../bi/bi.service';
import { SourceAccessService } from '../ownership/source-access.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('UC052 lifecycle conditions: SQLite persistence and real DuckDB oracle', () => {
  let db: DataSource,
    worker: DuckDBService,
    dashboards: AiDashboardService,
    studio: StudioService,
    publications: StudioPublicationService,
    creation: StudioCreationService,
    root: string,
    connection: any,
    id: number;
  const previous = process.env.FILE_UPLOAD_DIR;
  const files = new Map<number, string>();
  const filename = (id: number) => 'source-' + id + '.duckdb';
  const mapping = { amount: 'total', channel: 'segment', event_time: 'occurred_at' };
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-t9-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    for (const [sourceId, csv] of [
      [
        1,
        'channel,amount,weight,event_time\nSite,300,2,2026-01-01T00:00:00Z\nMobile,200,1,2026-01-02T00:00:00Z\n',
      ],
      [
        2,
        'segment,total,weight,occurred_at\nSite,300,2,2026-01-01T00:00:00Z\nMobile,200,1,2026-01-02T00:00:00Z\n',
      ],
      [
        6,
        'created_at,segment,total,occurred_at\n2025-11-01T00:00:00Z,Site,300,2026-01-01T00:00:00Z\n2025-12-01T00:00:00Z,Mobile,200,2026-01-02T00:00:00Z\n',
      ],
      [7, '*\n300\n200\n'],
      [8, '*,total\n900,300\n800,200\n'],
      [3, 'segment,total\nSite,wrong\n'],
      [4, 'total\n300\n200\n'],
      [
        5,
        'channel,amount,weight,event_time\nSite,300,2,2026-01-01T00:00:00Z\nMobile,200,1,2026-01-02T00:00:00Z\n',
      ],
    ] as Array<[number, string]>) {
      files.set(
        sourceId,
        (await worker.importFile({ originalname: 'input.csv', buffer: Buffer.from(csv) })).filename,
      );
    }
    // Managed uploads normalize names. Model a valid existing DuckDB literal-star column directly.
    for (const sourceId of [7, 8]) {
      const instance = await DuckDBInstance.create(files.get(sourceId));
      const conn = await instance.connect();
      try {
        await conn.run('ALTER TABLE uploaded_data RENAME COLUMN "_" TO "*"');
      } finally {
        conn.closeSync();
        instance.closeSync();
      }
    }
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Dashboard,
        DashboardShare,
        DashboardWidget,
        UserMapping,
        Database,
        Dataset,
        Widget,
        Component,
        Metric,
        StudioState,
        StudioRun,
        StudioPublication,
        StudioPublicationRequest,
        StudioRemixRequest,
      ],
    }).initialize();
    for (const sourceId of files.keys())
      await db.manager.save(Database, {
        id: sourceId,
        ownerId: sourceId === 1 || sourceId === 7 ? 7 : 8,
        name: 'Source ' + sourceId,
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: filename(sourceId) },
        }),
      });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      manager: db.manager,
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      duckDBVersion: jest.fn(async id => createHash('sha256').update(filename(id)).digest('hex')),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((id, sql, bindings) => worker.query(files.get(id), sql, bindings)),
    };
    const access = new SourceAccessService(db);
    dashboards = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    studio = new StudioService(db, dashboards, connection, access);
    publications = new StudioPublicationService(db, studio, connection);
    creation = new StudioCreationService(
      db,
      new BiService(db, access, connection, dashboards),
      {} as any,
      dashboards,
      connection,
      access,
      studio,
    );
  });
  beforeEach(async () => {
    const definition = {
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: 1,
      tableName: 'uploaded_data',
      label: 'Revenue',
      aggregation: 'SUM',
      column: 'amount',
      unit: 'USD',
      decimalPlaces: 2,
      numberNotation: 'plain',
    };
    const metric = await db.manager.save(Metric, {
      name: 'original-' + Date.now() + '-' + Math.random(),
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
    });
    const blocks = [
      { title: 'Revenue', kind: 'BOARD_NUMERIC', metric: definition },
      {
        title: 'Channels',
        kind: 'CHART_COLUMN',
        metric: definition,
        dimension: { column: 'channel' },
      },
      {
        title: 'Trend',
        kind: 'CHART_LINE',
        metric: definition,
        dimension: { column: 'event_time' },
      },
    ];
    const profile = await (creation as any).profile(1, 7);
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      items: blocks.map(b => ({
        sourceId: 1,
        metricId: metric.id,
        definitionVersion: 1,
        definition,
        ...(b.dimension ? { dimension: b.dimension.column } : {}),
        chart: b.kind === 'BOARD_NUMERIC' ? 'number' : b.kind === 'CHART_LINE' ? 'line' : 'bar',
      })),
    };
    id = (
      await dashboards.save(
        { draft: (creation as any).compile(1, 'Original', blocks, profile) },
        7,
        snapshot,
      )
    ).data.id;
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });
  const publish = async (patch: any = {}) =>
    publications.publish(
      id,
      {
        requestId: 'publish-' + id,
        expectedRevision: (await studio.get(id, 7)).document.revision,
        visibility: 'link',
        allowRemix: true,
        ...patch,
      },
      7,
    );
  const conditionScope = async () => ({
    sourceRevision: await connection.duckDBVersion(1),
    definition: {
      include: {
        kind: 'group',
        operator: 'or',
        children: [
          { kind: 'predicate', column: 'weight', operator: 'gte', values: [2] },
          { kind: 'predicate', column: 'channel', operator: 'eq', values: ["private;quote'한글"] },
        ],
      },
      exclude: { kind: 'predicate', column: 'channel', operator: 'eq', values: ['Mobile'] },
    },
  });
  const applyConditions = async () => {
    const current = await studio.get(id, 7);
    return studio.save(
      id,
      {
        requestId: 'conditions-' + id,
        expectedRevision: current.document.revision,
        expectedSourceRevision: current.sourceRevision,
        document: { ...current.document, conditions: await conditionScope() },
      },
      7,
    );
  };

  const remixService = () =>
    new StudioRemixService(
      db,
      studio,
      publications,
      creation,
      dashboards,
      connection,
      new SourceAccessService(db),
    );
  const preview = (p: any, extra: any = {}) =>
    remixService().preview(
      p.token,
      {
        targetSourceId: 2,
        mapping,
        expectedVersion: p.version,
        ...extra,
      },
      8,
    );
  const saveRemix = (p: any, v: any, extra: any = {}) =>
    remixService().remix(
      p.token,
      {
        requestId: 'remix-' + id,
        targetSourceId: 2,
        mapping,
        expectedVersion: p.version,
        expectedSourceRevision: v.sourceRevision,
        ...extra,
      },
      8,
    );
  it('freezes nested predicates privately, scopes all aggregates and persists the mapped recipient copy', async () => {
    await applyConditions();
    const original = await studio.get(id, 7);
    expect(original.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    const p = await publish();
    const publicView = await publications.read(p.token);
    expect(publicView.snapshot.conditionsApplied).toBe(true);
    expect(publicView.snapshot.blocks[0].datas).toEqual([{ value: 300 }]);
    const encoded = JSON.stringify(publicView);
    for (const secret of [
      'weight',
      "private;quote'한글",
      'sourceRevision',
      'includeSql',
      'definition',
      'SELECT',
    ])
      expect(encoded).not.toContain(secret);
    const requirements = await remixService().template(p.token, 8);
    expect(requirements.conditions).toEqual(await conditionScope());
    expect(requirements.requiredFields.find(f => f.name === 'weight').blockIds).toEqual([
      'block-1',
      'block-2',
      'block-3',
    ]);
    const v = await preview(p);
    expect(v.unmappedConditions).toEqual([]);
    expect(v.mappedConditions.sourceRevision).toBe(await connection.duckDBVersion(2));
    expect(v.mappedConditions.sourceRevision).not.toBe(requirements.conditions.sourceRevision);
    expect(v.mappedConditions.definition.exclude).toMatchObject({ column: 'segment' });
    expect(v.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    expect(v.preview.widgets[1].datas).toEqual([{ dimension: 'Site', value: 300 }]);
    expect(v.preview.widgets[2].datas).toHaveLength(1);
    const oracle = await worker.query(
      files.get(2),
      'SELECT SUM(total) AS value FROM uploaded_data WHERE (weight >= 2 OR segment = ?) AND segment <> ?',
      ["private;quote'한글", 'Mobile'],
    );
    expect(v.preview.widgets[0].datas).toEqual(oracle.datas);
    const saved = await saveRemix(p, v);
    const clone = await studio.get(saved.dashboardId, 8);
    expect(clone.document.conditions).toEqual(v.mappedConditions);
    expect(clone.preview.widgets[0].datas).toEqual(oracle.datas);
    const row = await db.manager.findOne(Dashboard, { where: { id: saved.dashboardId } });
    expect(JSON.parse(row.structuredDefinition).studioConditions).toEqual(v.mappedConditions);
    const links = await db.manager.find(DashboardWidget, {
      where: { dashboardId: saved.dashboardId },
    });
    for (const link of links) {
      const widget = await db.manager.findOne(Widget, { where: { id: link.widgetId } });
      const dataset = await db.manager.findOne(Dataset, { where: { id: widget.datasetId } });
      const actual = await worker.query(files.get(2), dataset.query);
      expect(actual.datas).toEqual(clone.preview.widgets[links.indexOf(link)].datas);
    }
    expect((await studio.get(id, 7)).document).toEqual(original.document);
    const state = await studio.get(id, 7);
    await studio.save(
      id,
      {
        requestId: 'remove-' + id,
        expectedRevision: state.document.revision,
        expectedSourceRevision: state.sourceRevision,
        document: { ...state.document, conditions: undefined },
      },
      7,
    );
    expect((await remixService().template(p.token, 8)).conditions).toEqual(requirements.conditions);
  });
  it('blocks the entire scope for a missing predicate column, even after excluding chart blocks', async () => {
    await applyConditions();
    const p = await publish();
    const v = await preview(p, {
      targetSourceId: 4,
      mapping: { amount: 'total' },
      excludedBlockIds: ['block-2', 'block-3'],
    });
    expect(v.preview).toBeUndefined();
    expect(v.mappedConditions).toBeUndefined();
    expect(v.unmappedConditions).toEqual(expect.arrayContaining(['weight', 'channel']));
    const count = await db.manager.count(Dashboard);
    await expect(
      saveRemix(p, v, {
        targetSourceId: 4,
        mapping: { amount: 'total' },
        excludedBlockIds: ['block-2', 'block-3'],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(Dashboard)).toBe(count);
  });
  it('rejects type-incompatible condition mapping and stale source versions without writes', async () => {
    await applyConditions();
    const p = await publish();
    const v = await preview(p, { mapping: { ...mapping, weight: 'segment' } });
    expect(v.unmappedConditions).toContain('weight');
    expect(v.preview).toBeUndefined();
    const good = await preview(p);
    const count = await db.manager.count(Dashboard);
    await expect(
      saveRemix(p, good, { expectedSourceRevision: 'f'.repeat(64) }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(Dashboard)).toBe(count);
  });
  it('rejects damaged recipes and condition loss before persistence', async () => {
    await applyConditions();
    const p = await publish();
    const row = await db.manager.findOne(StudioPublication, { where: { token: p.token } });
    const template = JSON.parse(row.remixTemplate);
    const profile = await creation.profile(2, 8);
    await expect(
      creation.persistRemix(2, template, [], profile, 8, db.manager),
    ).rejects.toMatchObject({ status: 400 });
    const conditions = { ...(await conditionScope()), sourceRevision: 'f'.repeat(64) };
    await expect(
      creation.persistRemix(
        2,
        template,
        [],
        profile,
        8,
        db.manager,
        [],
        undefined,
        conditions as any,
      ),
    ).rejects.toMatchObject({ status: 409 });
    template.conditions.definition.include.children[0].column = 'absent';
    row.remixTemplate = JSON.stringify(template);
    await db.manager.save(StudioPublication, row);
    await expect(preview(p)).rejects.toMatchObject({ status: 400 });
  });
  it('never merges distinct predicate columns onto one recipient column', async () => {
    const state = await studio.get(id, 7);
    const scope = await conditionScope();
    scope.definition.include.children.push({
      kind: 'predicate',
      column: 'amount',
      operator: 'gte',
      values: [1],
    } as any);
    await studio.save(
      id,
      {
        requestId: 'alias-' + id,
        expectedRevision: state.document.revision,
        expectedSourceRevision: state.sourceRevision,
        document: { ...state.document, conditions: scope },
      },
      7,
    );
    const p = await publish();
    await expect(preview(p, { mapping: { ...mapping, weight: 'total' } })).rejects.toMatchObject({
      status: 400,
    });
  });
  it('cannot trust forged recipe field types or silently discard an invalid condition', async () => {
    await applyConditions();
    const p = await publish();
    const row = await db.manager.findOne(StudioPublication, { where: { token: p.token } });
    const template = JSON.parse(row.remixTemplate);
    template.requiredFields.find(f => f.name === 'weight').type = 'VARCHAR';
    row.remixTemplate = JSON.stringify(template);
    await db.manager.save(StudioPublication, row);
    await expect(preview(p, { mapping: { ...mapping, weight: 'segment' } })).rejects.toMatchObject({
      status: 400,
    });
    template.conditions = null;
    row.remixTemplate = JSON.stringify(template);
    await db.manager.save(StudioPublication, row);
    await expect(preview(p)).rejects.toThrow();
  });
  it('ANDs conditions with existing filters/date scope across public and remixed previews', async () => {
    const state = await studio.get(id, 7);
    const dateRange = {
      column: 'event_time',
      start: '2026-01-01',
      end: '2026-01-01',
      timeZone: 'UTC',
    };
    await studio.save(
      id,
      {
        requestId: 'combined-' + id,
        expectedRevision: state.document.revision,
        expectedSourceRevision: state.sourceRevision,
        document: {
          ...state.document,
          filters: [{ column: 'channel', values: ['Site'] }],
          dateRange,
          conditions: await conditionScope(),
        },
      },
      7,
    );
    const p = await publish();
    const v = await preview(p);
    expect(v.mappedDateRange.column).toBe('occurred_at');
    expect(v.mappedFilters).toEqual([{ column: 'segment', values: ['Site'] }]);
    expect(v.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    expect(v.preview.widgets[2].datas).toHaveLength(1);
    expect(v.preview.widgets[0].trend.points).toHaveLength(1);
    expect(Number(v.preview.widgets[0].trend.points[0].value)).toBe(300);
    const copy = await saveRemix(p, v);
    const clone = await studio.get(copy.dashboardId, 8);
    expect(clone.document.conditions).toEqual(v.mappedConditions);
    expect(clone.document.dateRange).toEqual(v.mappedDateRange);
    expect(clone.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    const current = await studio.get(id, 7);
    await studio.save(
      id,
      {
        requestId: 'empty-' + id,
        expectedRevision: current.document.revision,
        expectedSourceRevision: current.sourceRevision,
        document: { ...current.document, filters: [{ column: 'channel', values: ['Mobile'] }] },
      },
      7,
    );
    const empty = await studio.get(id, 7);
    expect(empty.preview.widgets[0].datas).toEqual([{ value: null }]);
    expect(empty.preview.widgets[1].datas).toEqual([]);
    expect(empty.preview.widgets[2].datas).toEqual([]);
  });
  it('refuses publication after source file replacement without rebinding conditions', async () => {
    await applyConditions();
    const current = await studio.get(id, 7);
    const version = connection.duckDBVersion.getMockImplementation();
    connection.duckDBVersion.mockImplementation(async sourceId =>
      sourceId === 1 ? 'f'.repeat(64) : version(sourceId),
    );
    try {
      await expect(
        publications.publish(
          id,
          {
            requestId: 'stale-' + id,
            expectedRevision: current.document.revision,
            visibility: 'link',
            allowRemix: true,
          },
          7,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(await db.manager.count(StudioPublication, { where: { dashboardId: id } })).toBe(0);
    } finally {
      connection.duckDBVersion.mockImplementation(version);
    }
  });
});
