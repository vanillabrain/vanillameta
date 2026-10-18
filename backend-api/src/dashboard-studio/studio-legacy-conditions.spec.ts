import { ForbiddenException } from '@nestjs/common';
import { serializeMetadataWork } from '../common/metadata-work';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { PublicationService } from '../bi/publication.service';
import { DashboardReuseService } from '../bi/dashboard-reuse.service';
import { SharedReuseOriginService } from '../bi/shared-reuse-origin.service';
import { buildReuseRecipe, readReuseRecipe } from '../bi/reuse-recipe';
import { remapDashboard, reuseColumns } from '../bi/dashboard-remap';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { AnalysisCreationReceipt } from '../bi/analysis-creation-receipt.entity';
import { randomUUID } from 'crypto';
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
import { StudioService } from './studio.service';
import { StudioCreationService } from './studio-creation.service';
import { BiService } from '../bi/bi.service';
import { SourceAccessService } from '../ownership/source-access.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('UC052 legacy lifecycle propagation with real SQLite/DuckDB', () => {
  let db: DataSource,
    worker: DuckDBService,
    dashboards: AiDashboardService,
    studio: StudioService,
    creation: StudioCreationService,
    root: string,
    connection: any,
    id: number;
  let activeRead = true;
  const previous = process.env.FILE_UPLOAD_DIR;
  const files = new Map<number, string>();
  const filename = (id: number) => 'source-' + id + '.duckdb';
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
    const targetFile = await DuckDBInstance.create(files.get(2));
    const targetConnection = await targetFile.connect();
    try {
      await targetConnection.run(
        "ALTER TABLE uploaded_data ADD COLUMN invoice_day VARCHAR DEFAULT '2026/01/01'",
      );
      await targetConnection.run(
        "UPDATE uploaded_data SET invoice_day = CASE WHEN total = 300 THEN '2026/01/01' ELSE '2026/01/02' END",
      );
    } finally {
      targetConnection.closeSync();
      targetFile.closeSync();
    }
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        SourceCatalogEntry,
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
        DashboardPublication,
        AnalysisCreationReceipt,
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
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async callback => callback() })),
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      duckDBVersion: jest.fn(async id => createHash('sha256').update(filename(id)).digest('hex')),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((id, sql, bindings) => worker.query(files.get(id), sql, bindings)),
    };
    const access = new SourceAccessService(db);
    dashboards = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    studio = new StudioService(db, dashboards, connection, access);
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
    activeRead = true;
    await db.manager.clear(SourceCatalogEntry);
    await db.manager.update(Database, 2, { ownerId: 8 });
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

  const services = () => {
    const access = new SourceAccessService(db, {
      sourceIds: async () => [],
      dashboardIds: async () => [],
      capabilities: async () => ({
        rights: { read: true, edit: true, publish: false, export: true },
      }),
      assert: async () => {
        if (!activeRead) throw new ForbiddenException('inactive account');
      },
    } as any);
    const bi = new BiService(db, access, connection, dashboards);
    const origins = new SharedReuseOriginService(db, dashboards, bi, access, connection);
    return {
      origins,
      bi,
      reuse: new DashboardReuseService(db, bi, dashboards, connection, access, origins),
      publication: new PublicationService(
        db.getRepository(DashboardPublication),
        db.getRepository(Dashboard),
        access,
        dashboards,
        bi,
      ),
    };
  };
  const legacyPublish = async () => {
    const { publication } = services();
    const analysis = (await dashboards.analysis(id, 7, true)).data;
    const p = await publication.preview(id, 7, {
      expectedRevision: analysis.revision,
      allowReuse: true,
    });
    const committed = await publication.publish(id, 7, {
      expectedRevision: analysis.revision,
      expectedVersion: 0,
      ticket: p.ticket,
      requestId: randomUUID(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      visibility: 'link',
    });
    return { publication, p, uuid: committed.publication.uuid };
  };
  it('legacy publication scopes aggregates and keeps predicates/file identity out of public JSON', async () => {
    await applyConditions();
    const { publication, p, uuid } = await legacyPublish();
    expect(p.snapshot.conditionsApplied).toBe(true);
    expect(p.snapshot.widgets[0].datas).toEqual([{ value: 300 }]);
    const result = await publication.publicResult(uuid);
    const json = JSON.stringify(result);
    for (const value of [
      'weight',
      "private;quote'한글",
      'conditionDefinition',
      'sourceRevision',
      'SELECT',
    ])
      expect(json).not.toContain(value);
    const stored = await db.manager.findOne(DashboardPublication, { where: { dashboardId: id } });
    expect(stored.reuseDefinition).not.toContain('sourceRevision');
    expect(readReuseRecipe(stored.reuseDefinition).analysis.conditionDefinition).toEqual(
      (await conditionScope()).definition,
    );
  });
  it.each(['owned', 'share', 'publication'])(
    'propagates %s reuse to a pinned recipient scope and durable SQL',
    async kind => {
      await applyConditions();
      const { reuse } = services();
      let key: number | string = id;
      const actor = kind === 'owned' ? 7 : 8;
      if (kind === 'owned') await db.manager.update(Database, 2, { ownerId: 7 });
      if (kind === 'share') {
        const original = await db.manager.findOne(Dashboard, { where: { id } });
        const share = await db.manager.findOne(DashboardShare, { where: { id: original.shareId } });
        await db.manager.update(DashboardShare, share.id, {
          shareYn: 'Y',
          allowReuse: true,
          endDate: new Date(Date.now() + 3600000),
        });
        key = share.uuid;
      }
      if (kind === 'publication') key = (await legacyPublish()).uuid;
      const req = await reuse.draft(key, actor, kind);
      expect(req.blocks.every(block => block.columns.includes('weight'))).toBe(true);
      const target = await creation.profile(2, actor);
      const columnMap = {
        amount: 'total',
        channel: 'segment',

        weight: 'weight',
      };
      const v = await reuse.preview(
        key,
        {
          expectedRevision: req.expectedRevision,
          sourceId: 2,
          sourceRevision: target.dataVersion,
          title: 'Scoped copy',
          columnMap,
        },
        actor,
        kind,
      );
      expect(v.snapshot.conditionsApplied).toBe(true);
      expect(v.snapshot.widgets[0].datas).toEqual([{ value: 300 }]);
      const saved = await reuse.save(
        key,
        { ticket: v.ticket, requestId: randomUUID() },
        actor,
        kind,
      );
      const clone = (await dashboards.analysis(saved.id, actor, true)).data;
      expect(clone.defaultConditions).toMatchObject({
        sourceRevision: await connection.duckDBVersion(2),
      });
      expect(clone.defaultConditions.sourceRevision).not.toBe(
        (await conditionScope()).sourceRevision,
      );
      expect(clone.defaultConditions.definition.exclude.column).toBe('segment');
      const actual = (
        await dashboards.preview({ draft: clone, conditions: clone.defaultConditions }, actor)
      ).data;
      expect(actual.widgets[0].datas).toEqual([{ value: 300 }]);
      const links = await db.manager.find(DashboardWidget, {
        where: { dashboardId: saved.id },
        order: { id: 'ASC' },
      });
      const widget = await db.manager.findOne(Widget, { where: { id: links[0].widgetId } });
      const dataset = await db.manager.findOne(Dataset, { where: { id: widget.datasetId } });
      expect((await worker.query(files.get(2), dataset.query)).datas).toEqual([{ value: 300 }]);
      expect((await studio.get(id, 7)).document.conditions).toEqual(await conditionScope());
      if (kind === 'owned') await db.manager.update(Database, 2, { ownerId: 8 });
    },
  );
  it('retains condition-only fields after numeric-only selection and rejects missing/type-invalid mappings', async () => {
    await applyConditions();
    const { reuse } = services();
    const { uuid } = await legacyPublish();
    const req = await reuse.draft(uuid, 8, 'publication');
    const target = await creation.profile(2, 8);
    const body = {
      expectedRevision: req.expectedRevision,
      sourceId: 2,
      sourceRevision: target.dataVersion,
      title: 'Copy',
      blockIds: [req.blocks[0].id],
      columnMap: { amount: 'total', channel: 'segment' },
    };
    await expect(reuse.preview(uuid, body, 8, 'publication')).rejects.toThrow(
      'missing column mapping',
    );
    await expect(
      reuse.preview(
        uuid,
        { ...body, columnMap: { ...body.columnMap, weight: 'segment' } },
        8,
        'publication',
      ),
    ).rejects.toThrow('incompatible target');
    const v = await reuse.preview(
      uuid,
      { ...body, columnMap: { ...body.columnMap, weight: 'weight' } },
      8,
      'publication',
    );
    expect(v.snapshot.widgets).toHaveLength(1);
    expect(v.snapshot.widgets[0].datas).toEqual([{ value: 300 }]);
  });
  it('recipe keeps scoped columns, remaps values with target types, and rejects stale live share scope', async () => {
    await applyConditions();
    const analysis = (await dashboards.analysis(id, 7, true)).data;
    const profile = await creation.profile(1, 7);
    const recipe = readReuseRecipe(buildReuseRecipe(analysis, profile));
    expect(JSON.stringify(recipe)).not.toContain((await conditionScope()).sourceRevision);
    expect(reuseColumns(recipe.analysis, recipe.profile).map(c => c.name)).toContain('weight');
    const target = await creation.profile(2, 8);
    const remapped = remapDashboard(recipe.analysis, recipe.profile, target, {
      amount: 'total',
      channel: 'segment',

      weight: 'weight',
    });
    expect(remapped.conditionDefinition.exclude).toMatchObject({ column: 'segment' });
    const original = await db.manager.findOne(Dashboard, { where: { id } });
    const share = await db.manager.findOne(DashboardShare, { where: { id: original.shareId } });
    await db.manager.update(DashboardShare, share.id, {
      shareYn: 'Y',
      allowReuse: true,
      endDate: new Date(Date.now() + 3600000),
    });
    const version = connection.duckDBVersion.getMockImplementation();
    connection.duckDBVersion.mockImplementation(async n => (n === 1 ? 'f'.repeat(64) : version(n)));
    try {
      await expect(services().origins.resolve('share', share.uuid)).rejects.toMatchObject({
        status: 404,
      });
    } finally {
      connection.duckDBVersion.mockImplementation(version);
    }
  });
  it.each([true, false])(
    'preserves legacy filters/date scope with conditions=%s through recipe, numeric-only mapping and save',
    async hasConditions => {
      const state = await studio.get(id, 7);
      await studio.save(
        id,
        {
          requestId: 'combined-' + id,
          expectedRevision: state.document.revision,
          expectedSourceRevision: state.sourceRevision,
          document: {
            ...state.document,
            filters: [{ column: 'channel', values: ['Site'] }],
            dateRange: {
              column: 'event_time',
              start: '2026-01-01',
              end: '2026-01-01',
              timeZone: 'UTC',
            },
            ...(hasConditions ? { conditions: await conditionScope() } : {}),
          },
        },
        7,
      );
      const { uuid } = await legacyPublish();
      const { reuse } = services();
      const req = await reuse.draft(uuid, 8, 'publication');
      expect(req.blocks[0].columns).toEqual(
        expect.arrayContaining([
          'amount',
          ...(hasConditions ? ['weight'] : []),
          'channel',
          'event_time',
        ]),
      );
      const target = await creation.profile(2, 8);
      const v = await reuse.preview(
        uuid,
        {
          expectedRevision: req.expectedRevision,
          sourceId: 2,
          sourceRevision: target.dataVersion,
          title: 'Scoped range copy',
          blockIds: [req.blocks[0].id],
          columnMap: {
            amount: 'total',
            ...(hasConditions ? { weight: 'weight' } : {}),
            channel: 'segment',
            event_time: 'occurred_at',
          },
        },
        8,
        'publication',
      );
      expect(v.snapshot.widgets[0].datas).toEqual([{ value: 300 }]);
      const saved = await reuse.save(
        uuid,
        { ticket: v.ticket, requestId: randomUUID() },
        8,
        'publication',
      );
      const analysis = (await dashboards.analysis(saved.id, 8, true)).data;
      expect(analysis.defaultFilters).toEqual([{ column: 'segment', values: ['Site'] }]);
      expect(analysis.defaultDateRange.column).toBe('occurred_at');
      if (hasConditions)
        expect(analysis.defaultConditions.sourceRevision).toBe(await connection.duckDBVersion(2));
      else expect(analysis.defaultConditions).toBeUndefined();
      const link = await db.manager.findOne(DashboardWidget, { where: { dashboardId: saved.id } });
      const widget = await db.manager.findOne(Widget, { where: { id: link.widgetId } });
      const dataset = await db.manager.findOne(Dataset, { where: { id: widget.datasetId } });
      const oracle = await worker.query(
        files.get(2),
        "SELECT SUM(total) AS value FROM uploaded_data WHERE weight >= 2 AND segment = 'Site' AND occurred_at >= TIMESTAMP '2026-01-01' AND occurred_at < TIMESTAMP '2026-01-02'",
      );
      expect((await worker.query(files.get(2), dataset.query)).datas).toEqual(oracle.datas);
    },
  );
  it('rolls back the entire clone if persistence drops the frozen conditions', async () => {
    await applyConditions();
    const { uuid } = await legacyPublish();
    const { reuse } = services();
    const req = await reuse.draft(uuid, 8, 'publication');
    const target = await creation.profile(2, 8);
    const v = await reuse.preview(
      uuid,
      {
        expectedRevision: req.expectedRevision,
        sourceId: 2,
        sourceRevision: target.dataVersion,
        title: 'Safe rollback copy',
        columnMap: { amount: 'total', channel: 'segment', weight: 'weight' },
      },
      8,
      'publication',
    );
    const before = await Promise.all([
      db.manager.count(Dashboard),
      db.manager.count(Dataset),
      db.manager.count(AnalysisCreationReceipt),
    ]);
    const save = dashboards.save.bind(dashboards);
    const broken = jest.spyOn(dashboards, 'save').mockImplementation(async (...args: any[]) => {
      const result = await (save as any)(...args);
      await args[4].update(Dashboard, result.data.id, { structuredDefinition: null });
      return result;
    });
    try {
      await expect(
        reuse.save(uuid, { ticket: v.ticket, requestId: randomUUID() }, 8, 'publication'),
      ).rejects.toThrow('적용 범위');
      expect(
        await Promise.all([
          db.manager.count(Dashboard),
          db.manager.count(Dataset),
          db.manager.count(AnalysisCreationReceipt),
        ]),
      ).toEqual(before);
    } finally {
      broken.mockRestore();
    }
  });
  const catalog = async (
    sourceId: number,
    owner: number,
    version: number,
    declarations: Record<string, { businessType: string; dateFormat: string }>,
  ) => {
    const profile = await creation.profile(sourceId, owner);
    const columns = profile.columns.map(c => ({
      column: c.name,
      label: c.name,
      description: '',
      unit: '',
      classification: '',
      businessType: declarations[c.name]?.businessType ?? 'auto',
      dateFormat: declarations[c.name]?.dateFormat ?? '',
    }));
    await db.manager.save(SourceCatalogEntry, {
      sourceId,
      version,
      actorId: owner,
      sourceRevision: profile.dataVersion,
      schemaRevision: createHash('sha256')
        .update(JSON.stringify(profile.columns.map(c => ({ column: c.name, type: c.type }))))
        .digest('hex'),
      metadata: JSON.stringify({ label: 'Business fields', description: '', columns }),
    });
    return JSON.parse(
      JSON.stringify({
        schemaVersion: 1,
        catalogVersion: version,
        columns: columns
          .filter(c => c.businessType !== 'auto')
          .map(({ column, businessType, dateFormat }) => ({ column, businessType, dateFormat }))
          .sort((a, b) => (a.column < b.column ? -1 : a.column > b.column ? 1 : 0)),
      }),
    );
  };
  const semanticOriginal = async () => {
    files.set(11, files.get(1));
    await db.manager.save(Database, {
      id: 11,
      ownerId: 7,
      name: 'Private semantic origin',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: filename(11) },
      }),
    });
    const definition = {
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: 11,
      tableName: 'uploaded_data',
      label: 'Revenue',
      aggregation: 'SUM',
      column: 'amount',
      unit: '',
      decimalPlaces: 2,
      numberNotation: 'plain',
    };
    const metric = await db.manager.save(Metric, {
      name: 'semantic-' + randomUUID(),
      databaseId: 11,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
    });
    const profile = await creation.profile(11, 7);
    id = (
      await dashboards.save(
        {
          draft: creation.compile(
            11,
            'Private semantic original',
            [{ title: 'Revenue', kind: 'BOARD_NUMERIC', metric: definition }],
            profile,
          ),
        },
        7,
        {
          schemaVersion: 2,
          kind: 'structured-bi-dashboard',
          sourceId: 11,
          items: [
            {
              sourceId: 11,
              metricId: metric.id,
              definitionVersion: 1,
              definition,
              chart: 'number',
            },
          ],
        },
      )
    ).data.id;
    const meaning = await catalog(11, 7, 1, {
      event_time: { businessType: 'date', dateFormat: 'native' },
      channel: { businessType: 'category', dateFormat: '' },
    });
    // A different real history at the redacted placeholder proves it cannot authorize origin11.
    await catalog(1, 7, 1, { event_time: { businessType: 'category', dateFormat: '' } });
    const current = await studio.get(id, 7);
    await studio.save(
      id,
      {
        requestId: randomUUID(),
        expectedRevision: current.document.revision,
        expectedSourceRevision: current.sourceRevision,
        document: {
          ...current.document,
          conditions: {
            sourceRevision: current.sourceRevision,
            semantics: meaning,
            definition: {
              include: {
                kind: 'predicate',
                column: 'event_time',
                operator: 'eq',
                values: ['2026-01-01'],
              },
              exclude: null,
            },
          },
        },
      },
      7,
    );
    return meaning;
  };
  const legacyOrigin = async (kind: string) => {
    let key: string | number = id;
    if (kind === 'share') {
      const dashboard = await db.manager.findOneByOrFail(Dashboard, { id });
      const share = await db.manager.findOneByOrFail(DashboardShare, { id: dashboard.shareId });
      await db.manager.update(DashboardShare, share.id, {
        shareYn: 'Y',
        allowReuse: true,
        endDate: new Date(Date.now() + 3600000),
      });
      key = share.uuid;
    } else if (kind === 'publication') key = (await legacyPublish()).uuid;
    return key;
  };
  it.each(['owned', 'share', 'publication'])(
    'independently preserves frozen business meaning in actual legacy %s copies without leaking origin identity or unused columns',
    async kind => {
      await semanticOriginal();
      const targetMeaning = await catalog(2, 8, 4, {
        occurred_at: { businessType: 'date', dateFormat: 'native' },
        segment: { businessType: 'category', dateFormat: '' },
        invoice_day: { businessType: 'date', dateFormat: 'YYYY/MM/DD' },
      });
      if (kind === 'owned') await db.manager.update(Database, 2, { ownerId: 7 });
      const actor = kind === 'owned' ? 7 : 8;
      const key = await legacyOrigin(kind);
      const { reuse, origins } = services();
      const req = await reuse.draft(key, actor, kind);
      expect(req.columns.map(c => c.name).sort()).toEqual(['amount', 'event_time']);
      expect(JSON.stringify(req)).not.toContain('conditionSchema');
      expect(JSON.stringify(req)).not.toContain('channel');
      if (kind !== 'owned') {
        expect(req).not.toHaveProperty('originalSourceId');
        const internal = await origins.resolve(kind, String(key));
        expect(internal.profile.sourceId).toBe(1);
        expect(internal.originalSourceId).toBe(11);
      }
      const v = await reuse.preview(
        key,
        {
          expectedRevision: req.expectedRevision,
          sourceId: 2,
          sourceRevision: (await creation.profile(2, actor)).dataVersion,
          title: 'Legacy semantic copy',
          columnMap: { amount: 'total', event_time: 'occurred_at' },
        },
        actor,
        kind,
      );
      const oracle = await worker.query(
        files.get(2),
        "SELECT SUM(total) AS value FROM uploaded_data WHERE CAST(occurred_at AS DATE) = DATE '2026-01-01'",
      );
      expect(v.snapshot.widgets[0].datas).toEqual(oracle.datas);
      expect(oracle.datas).toEqual([{ value: 300 }]);
      const requestId = randomUUID();
      const saved = await reuse.save(key, { ticket: v.ticket, requestId }, actor, kind);
      const clone = (await dashboards.analysis(saved.id, actor, true)).data;
      expect(clone.defaultConditions.semantics).toEqual(targetMeaning);
      expect(clone.defaultConditions.sourceRevision).toBe(await connection.duckDBVersion(2));
      const row = await db.manager.findOneByOrFail(Dashboard, { id: saved.id });
      expect(JSON.parse(row.structuredDefinition).studioConditions.semantics).toEqual(
        targetMeaning,
      );
      await catalog(11, 7, 2, { event_time: { businessType: 'category', dateFormat: '' } });
      if (kind === 'publication')
        expect((await reuse.draft(key, actor, kind)).columns.map(c => c.name)).toEqual(
          req.columns.map(c => c.name),
        );
      await db.manager.clear(SourceCatalogEntry);
      const queries = connection.queryDuckDB.mock.calls.length;
      expect(await reuse.save(key, { ticket: v.ticket, requestId }, actor, kind)).toEqual({
        id: saved.id,
        replayed: true,
      });
      expect(connection.queryDuckDB.mock.calls.length).toBe(queries);
    },
  );
  it('refuses a missing/wrong-source historical semantic recipe and missing private schema before any target copy', async () => {
    await semanticOriginal();
    await catalog(2, 8, 4, { occurred_at: { businessType: 'date', dateFormat: 'native' } });
    const key = await legacyOrigin('publication');
    const { reuse } = services();
    const publication = await db.manager.findOneByOrFail(DashboardPublication, {
      uuid: String(key),
    });
    const original = publication.reuseDefinition;
    const recipe = JSON.parse(original);
    recipe.analysis.conditionSemantics.catalogVersion = 99;
    await db.manager.update(DashboardPublication, publication.dashboardId, {
      reuseDefinition: JSON.stringify(recipe),
    });
    await expect(reuse.draft(key, 8, 'publication')).rejects.toMatchObject({ status: 409 });
    await db.manager.update(DashboardPublication, publication.dashboardId, {
      reuseDefinition: original,
    });
    await db.manager.delete(SourceCatalogEntry, { sourceId: 11, version: 1 });
    await expect(reuse.draft(key, 8, 'publication')).rejects.toMatchObject({ status: 409 });
    delete recipe.conditionSchema;
    await db.manager.update(DashboardPublication, publication.dashboardId, {
      reuseDefinition: JSON.stringify(recipe),
    });
    await expect(reuse.draft(key, 8, 'publication')).rejects.toMatchObject({ status: 400 });
  });
  it('rejects incompatible target meaning and a target catalog change between semantic preview and save without assets', async () => {
    await semanticOriginal();
    const key = await legacyOrigin('publication');
    const { reuse } = services();
    const req = await reuse.draft(key, 8, 'publication');
    const body = {
      expectedRevision: req.expectedRevision,
      sourceId: 2,
      sourceRevision: (await creation.profile(2, 8)).dataVersion,
      title: 'Scoped copy',
      columnMap: { amount: 'total', event_time: 'occurred_at' },
    };
    await catalog(2, 8, 4, { occurred_at: { businessType: 'category', dateFormat: '' } });
    await expect(reuse.preview(key, body, 8, 'publication')).rejects.toMatchObject({ status: 400 });
    await catalog(2, 8, 5, { occurred_at: { businessType: 'date', dateFormat: 'native' } });
    const v = await reuse.preview(key, body, 8, 'publication');
    const before = await db.manager.count(Dashboard);
    await catalog(2, 8, 6, { occurred_at: { businessType: 'category', dateFormat: '' } });
    await expect(
      reuse.save(key, { ticket: v.ticket, requestId: randomUUID() }, 8, 'publication'),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(Dashboard)).toBe(before);
  });
  it('does a cold full-target-date save validation outside the legacy metadata transaction', async () => {
    await semanticOriginal();
    await catalog(2, 8, 19, {
      occurred_at: { businessType: 'date', dateFormat: 'native' },
      invoice_day: { businessType: 'date', dateFormat: 'YYYY/MM/DD' },
    });
    const key = await legacyOrigin('publication');
    const { reuse } = services();
    const req = await reuse.draft(key, 8, 'publication');
    const v = await reuse.preview(
      key,
      {
        expectedRevision: req.expectedRevision,
        sourceId: 2,
        sourceRevision: (await creation.profile(2, 8)).dataVersion,
        title: 'Cold proof',
        columnMap: { amount: 'total', event_time: 'occurred_at' },
      },
      8,
      'publication',
    );
    (dashboards as any).conditionDateProofs.clear();
    let signal: () => void;
    const entered = new Promise<void>(resolve => {
      signal = resolve;
    });
    let metadataRan = false;
    const competitor = entered.then(() =>
      serializeMetadataWork(db, async () => {
        metadataRan = true;
      }),
    );
    const original = connection.queryDuckDB.getMockImplementation();
    let scans = 0;
    connection.queryDuckDB.mockImplementation(async (sourceId, sql, bindings) => {
      if (sourceId === 2 && sql.includes('AS invalid_0')) {
        scans += 1;
        expect(db.manager.queryRunner?.isTransactionActive ?? false).toBe(false);
        signal();
        let timer: ReturnType<typeof setTimeout>;
        try {
          await Promise.race([
            competitor,
            new Promise((_resolve, reject) => {
              timer = setTimeout(
                () => reject(new Error('legacy metadata queue held during date scan')),
                1500,
              );
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      }
      return original(sourceId, sql, bindings);
    });
    try {
      expect(
        (await reuse.save(key, { ticket: v.ticket, requestId: randomUUID() }, 8, 'publication'))
          .replayed,
      ).toBe(false);
      expect(scans).toBe(1);
      expect(metadataRan).toBe(true);
    } finally {
      signal();
      connection.queryDuckDB.mockImplementation(original);
    }
  });
  it.each(['current', 'owner', 'inactive'])(
    'guards invalid target dates against concurrent access loss (%s)',
    async revoked => {
      await semanticOriginal();
      files.set(
        9,
        (
          await worker.importFile({
            originalname: 'invalid-date.csv',
            buffer: Buffer.from(
              'segment,total,occurred_at,invoice_day\nSite,300,2026-01-01T00:00:00Z,2026/01/01\nMobile,200,2026-01-02T00:00:00Z,2026/02/30\n',
            ),
          })
        ).filename,
      );
      await db.manager.save(Database, {
        id: 9,
        ownerId: 8,
        name: 'Invalid declared dates',
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: filename(9) },
        }),
      });
      await catalog(9, 8, 4, {
        occurred_at: { businessType: 'date', dateFormat: 'native' },
        invoice_day: { businessType: 'date', dateFormat: 'YYYY/MM/DD' },
      });
      const key = await legacyOrigin('publication');
      const { reuse } = services();
      const req = await reuse.draft(key, 8, 'publication');
      const before = await db.manager.count(Dashboard);
      const originalQuery = connection.queryDuckDB.getMockImplementation();
      let changed = false;
      if (revoked !== 'current')
        connection.queryDuckDB.mockImplementation(async (sourceId, sql, bindings) => {
          const result = await originalQuery(sourceId, sql, bindings);
          if (!changed && sourceId === 9 && sql.includes('AS invalid_0')) {
            changed = true;
            if (revoked === 'inactive') activeRead = false;
            else
              await serializeMetadataWork(db, () => db.manager.update(Database, 9, { ownerId: 9 }));
          }
          return result;
        });
      try {
        await expect(
          reuse.preview(
            key,
            {
              expectedRevision: req.expectedRevision,
              sourceId: 9,
              sourceRevision: (await creation.profile(9, 8)).dataVersion,
              title: 'Reject invalid dates',
              columnMap: { amount: 'total', event_time: 'occurred_at' },
            },
            8,
            'publication',
          ),
        ).rejects.toMatchObject(
          revoked !== 'current'
            ? { status: revoked === 'inactive' ? 403 : 409 }
            : { status: 400, response: { code: 'INVALID_BUSINESS_DATES' } },
        );
        if (revoked !== 'current') expect(changed).toBe(true);
      } finally {
        activeRead = true;
        connection.queryDuckDB.mockImplementation(originalQuery);
        await db.manager.update(Database, 9, { ownerId: 8 });
      }
      expect(await db.manager.count(Dashboard)).toBe(before);
    },
  );
});
