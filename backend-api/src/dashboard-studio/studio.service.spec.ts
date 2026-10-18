import { BadRequestException } from '@nestjs/common';
import { latestConditionSemantics } from '../bi/business-condition-context';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { serializeMetadataWork } from '../common/metadata-work';
import { SourceLifecycleService } from '../enterprise/source-lifecycle.service';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
import { StudioPublicationService } from './studio-publication.service';
import { User } from '../user/entities/user.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
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
import { StudioRun } from './entities/studio-run.entity';
import { studioDigest } from './studio-legacy';
import { StudioService } from './studio.service';
import { StudioRunService } from './studio-run.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { applyStudioOperation } from './studio-operations';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const draft = () => ({
  databaseId: 1,
  title: 'Studio actual',
  explanation: 'All time',
  widgets: [
    {
      title: 'Revenue',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
      decimalPlaces: 0,
    },
    {
      title: 'Channels',
      description: '',
      type: 'CHART_COLUMN',
      sql: 'SELECT category,sum(amount) AS value FROM source GROUP BY category',
      categoryField: 'category',
      valueField: 'value',
      decimalPlaces: 0,
    },
  ],
});
describe('Studio real DuckDB and transactional metadata', () => {
  let db: DataSource,
    worker: DuckDBService,
    ai: AiDashboardService,
    studio: StudioService,
    root: string,
    id: number,
    connection: any,
    sourceRevision: string;
  const previous = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-t4-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const file = await worker.importFile({
      originalname: 'studio.csv',
      buffer: Buffer.from(
        'category,amount,event_time\nSite,300,2026-01-01T00:00:00Z\nMobile,200,2026-01-02T00:00:00Z\n',
      ),
    });
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
        User,
        EnterpriseOrganization,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseGroupDelivery,
        StudioPublication,
        StudioPublicationRequest,
      ],
    }).initialize();
    sourceRevision = createHash('sha256').update(file.filename).digest('hex');
    await db.manager.save(Database, {
      id: 1,
      ownerId: 7,
      name: 'Source',
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: file.filename },
      }),
      engine: 'duckdb',
      type: 'FILE',
    });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async cb => cb() })),
      duckDBVersion: jest.fn().mockResolvedValue(sourceRevision),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((_id, sql, bindings) => worker.query(file.filename, sql, bindings)),
    };
    ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    studio = new StudioService(db, ai, connection, new SourceAccessService(db));
  });
  beforeEach(async () => {
    id = (await ai.save({ draft: draft() }, 7)).data.id;
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });
  const save = async (doc: any, requestId = 'request1-' + id, expectedRevision = doc.revision) =>
    studio.save(
      id,
      {
        requestId,
        expectedRevision,
        expectedSourceRevision: sourceRevision,
        document: doc,
      },
      7,
    );
  it('UC052 profiles the unsaved Studio condition/date/filter scope read-only with fresh file validation', async () => {
    const initial = await studio.get(id, 7);
    expect(initial.profileColumns.map(c => c.name)).toEqual(['category', 'amount', 'event_time']);
    const document = applyStudioOperation(initial.document, {
      type: 'setConditions',
      conditions: {
        sourceRevision: initial.sourceRevision,
        definition: {
          include: { kind: 'predicate', column: 'amount', operator: 'lt', values: [250] },
          exclude: null,
        },
      },
    });
    document.dateRange = { column: 'event_time', start: '2026-01-02', end: '2026-01-02' };
    const before = await db.manager.count(StudioRun);
    const body = {
      expectedRevision: initial.document.revision,
      expectedSourceRevision: initial.sourceRevision,
      document,
      columns: ['category', 'amount'],
    };
    const profile = await studio.profile(id, body, 7);
    expect(profile.population).toMatchObject({ total: '1', matched: '1', remaining: '1' });
    expect(profile.sample.rows.map(row => row.values)).toEqual([['Mobile', '200']]);
    expect(profile.scope.conditions).toEqual(document.conditions);
    expect((await studio.get(id, 7)).document.conditions).toBeUndefined();
    expect(await db.manager.count(StudioRun)).toBe(before);
    const original = connection.queryDuckDB.getMockImplementation();
    connection.queryDuckDB.mockImplementation(async (id, sql, bindings) => {
      const result = await original(id, sql, bindings);
      if (sql.includes('grouped AS')) connection.duckDBVersion.mockResolvedValue('f'.repeat(64));
      return result;
    });
    try {
      await expect(studio.profile(id, body, 7)).rejects.toMatchObject({ status: 409 });
    } finally {
      connection.queryDuckDB.mockImplementation(original);
      connection.duckDBVersion.mockResolvedValue(sourceRevision);
    }
    connection.queryDuckDB.mockClear();
    await expect(studio.profile(id, body, 8)).rejects.toMatchObject({ status: 403 });
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
  });
  it.each(['semantic', 'sql', 'revoked', 'replaced'])(
    'UC050 profile failure preserves errors after fresh guards: %s',
    async mode => {
      const initial = await studio.get(id, 7);
      const body = {
        expectedRevision: initial.document.revision,
        expectedSourceRevision: initial.sourceRevision,
        document: initial.document,
        columns: ['amount'],
      };
      const original = connection.queryDuckDB.getMockImplementation();
      const failure = new BadRequestException('invalid business date count: 1');
      const semantic =
        mode === 'semantic'
          ? jest.spyOn(ai, 'assertConditionSemantics').mockRejectedValue(failure)
          : undefined;
      if (semantic)
        body.document.conditions = {
          sourceRevision: initial.sourceRevision,
          definition: { include: null, exclude: null },
          semantics: { schemaVersion: 1, catalogVersion: 1, columns: [] },
        };
      if (!semantic)
        connection.queryDuckDB.mockImplementation(async (source, sql, bindings) => {
          if (sql.includes('grouped AS')) {
            if (mode === 'revoked') await db.manager.update(Database, { id: 1 }, { ownerId: 8 });
            if (mode === 'replaced') connection.duckDBVersion.mockResolvedValue('f'.repeat(64));
            throw failure;
          }
          return original(source, sql, bindings);
        });
      try {
        await expect(studio.profile(id, body, 7)).rejects.toMatchObject({
          status: mode === 'revoked' ? 403 : mode === 'replaced' ? 409 : 400,
        });
      } finally {
        semantic?.mockRestore();
        connection.queryDuckDB.mockImplementation(original);
        connection.duckDBVersion.mockResolvedValue(sourceRevision);
        await db.manager.update(Database, { id: 1 }, { ownerId: 7 });
      }
    },
  );
  it('UC052 releases metadata lease during profile aggregates and still returns the pinned result', async () => {
    const initial = await studio.get(id, 7);
    const source = await db.manager.findOneByOrFail(Database, { id: 1 });
    const original = connection.queryDuckDB.getMockImplementation();
    let reached: () => void = () => {
      throw new Error('profile gate not initialized');
    };
    let release: () => void = () => {
      throw new Error('profile gate not initialized');
    };
    const started = new Promise<void>(resolve => {
      reached = resolve;
    });
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let held = false;
    connection.queryDuckDB.mockImplementation(async (source, sql, bindings) => {
      if (!held && sql.includes('grouped AS')) {
        held = true;
        reached();
        await gate;
      }
      return original(source, sql, bindings);
    });
    const pending = studio.profile(
      id,
      {
        expectedRevision: initial.document.revision,
        expectedSourceRevision: initial.sourceRevision,
        document: initial.document,
        columns: ['amount'],
      },
      7,
    );
    let timeout: ReturnType<typeof setTimeout>;
    try {
      await started;
      await Promise.race([
        serializeMetadataWork(db, () =>
          db.manager.update(Database, { id: 1 }, { name: 'Independent committed metadata' }),
        ),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('profile held metadata lease')), 1000);
        }),
      ]);
      clearTimeout(timeout);
      release();
      expect((await pending).population).toMatchObject({ total: '2', remaining: '2' });
    } finally {
      release();
      await pending.catch(() => undefined);
      connection.queryDuckDB.mockImplementation(original);
      await db.manager.update(
        Database,
        { id: 1 },
        { name: source.name, updatedAt: source.updatedAt },
      );
    }
  });
  it('UC052 AI typed proposal previews real aggregate without writing, then explicit application save/reload preserves scope', async () => {
    const oldProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'codex';
    try {
      const initial = await studio.get(id, 7);
      const definition = {
        include: {
          kind: 'group',
          operator: 'or',
          children: [
            { kind: 'predicate', column: 'category', operator: 'eq', values: ['Site'] },
            { kind: 'predicate', column: 'amount', operator: 'lt', values: [250] },
          ],
        },
        exclude: { kind: 'predicate', column: 'amount', operator: 'gte', values: [300] },
      };
      const callLlm = jest.fn();
      callLlm.mockResolvedValue(
        JSON.stringify({
          intent: 'edit',
          answer: '조건을 검토하세요.',
          operations: [{ type: 'setConditions', definition }],
        }),
      );
      const model = { callLlm };
      const runs = new StudioRunService(studio, model as any);
      const before = {
        dashboards: await db.manager.count(Dashboard),
        widgets: await db.manager.count(Widget),
        receipts: await db.manager.count(StudioRun),
      };
      const input = {
        requestId: 'ai-conditions-' + id,
        dashboardId: id,
        document: initial.document,
        expectedRevision: initial.document.revision,
        expectedSourceRevision: initial.sourceRevision,
        clientEditVersion: 1,
        prompt: '금액 300 이상을 제외하는 포함/제외 조건을 제안해 줘',
      };
      const result = await runs.run(input, 7);
      expect(result.preview.widgets[0].datas).toEqual([{ value: 200 }]);
      expect(result.preview.widgets[1].datas).toEqual([{ category: 'Mobile', value: 200 }]);
      expect(initial.document.conditions).toBeUndefined();
      expect((await studio.get(id, 7)).preview.widgets[0].datas).toEqual([{ value: 500 }]);
      expect({
        dashboards: await db.manager.count(Dashboard),
        widgets: await db.manager.count(Widget),
        receipts: await db.manager.count(StudioRun),
      }).toEqual(before);
      const applied = result.proposedOperations.reduce(applyStudioOperation, initial.document);
      expect(applied.blocks).toEqual(initial.document.blocks);
      expect(applied.layouts).toEqual(initial.document.layouts);
      await save(applied, 'ai-conditions-reviewed-' + id);
      const restored = await studio.get(id, 7);
      expect(restored.document.conditions.definition).toEqual(definition);
      expect(restored.preview.widgets[0].datas).toEqual([{ value: 200 }]);
      model.callLlm.mockResolvedValue(
        JSON.stringify({
          intent: 'edit',
          answer: '誤',
          operations: [
            {
              type: 'setConditions',
              definition: {
                include: { kind: 'predicate', column: 'invented', operator: 'eq', values: [1] },
                exclude: null,
              },
            },
          ],
        }),
      );
      await expect(
        runs.run(
          {
            ...input,
            requestId: 'invalid-' + id,
            document: restored.document,
            expectedRevision: restored.document.revision,
          },
          7,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect((await studio.get(id, 7)).document).toEqual(restored.document);
      expect((await ai.analysis(id, 7)).data.widgets.map(w => w.sql)).toEqual(
        draft().widgets.map(w => w.sql),
      );
    } finally {
      if (oldProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = oldProvider;
    }
  });
  it('UC052 preserves nested inclusion/exclusion through preview, save, detached Dataset queries and reload', async () => {
    const initial = await studio.get(id, 7);
    const definition = {
      include: {
        kind: 'group',
        operator: 'or',
        children: [
          { kind: 'predicate', column: 'category', operator: 'eq', values: ['Site'] },
          { kind: 'predicate', column: 'amount', operator: 'lt', values: [250] },
        ],
      },
      exclude: { kind: 'predicate', column: 'amount', operator: 'gte', values: [300] },
    };
    const conditions = { sourceRevision: initial.sourceRevision, definition };
    const document = applyStudioOperation(initial.document, { type: 'setConditions', conditions });
    const beforeLayouts = JSON.parse(JSON.stringify(document.layouts));
    const beforeBlocks = document.blocks.map(block => block.id);
    const prepared = await studio.prepare(
      id,
      {
        document,
        expectedRevision: document.revision,
        expectedSourceRevision: initial.sourceRevision,
      },
      7,
    );
    expect(prepared.preview.widgets[0].datas).toEqual([{ value: 200 }]);
    expect(prepared.preview.widgets[1].datas).toEqual([{ category: 'Mobile', value: 200 }]);
    expect((await studio.get(id, 7)).document.conditions).toBeUndefined();
    await save(document, 'nested-conditions-save-' + id);
    const restored = await studio.get(id, 7);
    expect(restored.document.conditions).toEqual(conditions);
    expect(restored.document.layouts).toEqual(beforeLayouts);
    expect(restored.document.blocks.map(block => block.id)).toEqual(beforeBlocks);
    expect(restored.preview.widgets[0].datas).toEqual([{ value: 200 }]);
    const analysis = (await ai.analysis(id, 7)).data;
    expect(analysis.defaultConditions).toEqual(conditions);
    expect(analysis.widgets.map(w => w.sql)).toEqual(draft().widgets.map(w => w.sql));
    const links = await db
      .getRepository(DashboardWidget)
      .find({ where: { dashboardId: id }, order: { id: 'ASC' } });
    const dataset = await db.getRepository(Dataset).findOneByOrFail({
      id: (await db.getRepository(Widget).findOneByOrFail({ id: links[0].widgetId })).datasetId,
    });
    expect((await connection.queryDuckDB(1, dataset.query)).datas).toEqual([{ value: 200 }]);
    // A legacy content save must preserve server-owned scope, not silently broaden the dataset.
    await ai.save(
      {
        dashboardId: id,
        expectedRevision: analysis.revision,
        draft: { ...draft(), title: 'Content change after conditions' },
      },
      7,
    );
    const legacyRestored = await studio.get(id, 7);
    expect(legacyRestored.document.conditions).toEqual(conditions);
    expect(legacyRestored.preview.widgets[0].datas).toEqual([{ value: 200 }]);
    const latestLinks = await db
      .getRepository(DashboardWidget)
      .find({ where: { dashboardId: id }, order: { id: 'ASC' } });
    const latestWidget = await db
      .getRepository(Widget)
      .findOneByOrFail({ id: latestLinks[0].widgetId });
    const latestDataset = await db
      .getRepository(Dataset)
      .findOneByOrFail({ id: latestWidget.datasetId });
    expect((await connection.queryDuckDB(1, latestDataset.query)).datas).toEqual([{ value: 200 }]);
    const cleared = applyStudioOperation(legacyRestored.document, {
      type: 'setConditions',
      conditions: null,
    });
    await save(cleared, 'nested-conditions-clear-' + id);
    expect((await studio.get(id, 7)).document.conditions).toBeUndefined();
    expect((await ai.analysis(id, 7)).data.defaultConditions).toBeUndefined();
    expect((await studio.get(id, 7)).preview.widgets[0].datas).toEqual([{ value: 500 }]);
  });
  it('UC052 keeps stale saved conditions visible after a real file replacement and permits explicit removal', async () => {
    const initial = await studio.get(id, 7);
    const applied = applyStudioOperation(initial.document, {
      type: 'setConditions',
      conditions: {
        sourceRevision: initial.sourceRevision,
        definition: {
          include: { kind: 'predicate', column: 'category', operator: 'eq', values: ['Site'] },
          exclude: null,
        },
      },
    });
    await save(applied, 'replace-before-' + id);
    const originalQuery = connection.queryDuckDB.getMockImplementation();
    const originalVersion = connection.duckDBVersion.getMockImplementation();
    const sourceRepository = db.getRepository(Database);
    const source = await sourceRepository.findOneByOrFail({ id: 1 });
    const replacement = await worker.importFile({
      originalname: 'replacement.csv',
      buffer: Buffer.from(
        'category,amount,event_time\nSite,900,2026-01-01T00:00:00Z\nMobile,100,2026-01-02T00:00:00Z\n',
      ),
    });
    try {
      connection.queryDuckDB.mockImplementation((_id, sql, bindings) =>
        worker.query(replacement.filename, sql, bindings),
      );
      connection.duckDBVersion.mockResolvedValue(
        createHash('sha256').update(replacement.filename).digest('hex'),
      );
      await sourceRepository.update(1, {
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: replacement.filename },
        }),
      });
      const stale = await studio.get(id, 7);
      expect(stale.document.conditions).toEqual(applied.conditions);
      expect(stale.preview).toBeNull();
      expect(stale.previewError).toBeTruthy();
      const cleared = applyStudioOperation(stale.document, {
        type: 'setConditions',
        conditions: null,
      });
      const body = {
        document: cleared,
        expectedRevision: cleared.revision,
        expectedSourceRevision: stale.sourceRevision,
      };
      expect((await studio.prepare(id, body, 7)).preview.widgets[0].datas).toEqual([
        { value: 1000 },
      ]);
      await studio.save(id, { ...body, requestId: 'replace-clear-' + id }, 7);
      const restored = await studio.get(id, 7);
      expect(restored.document.conditions).toBeUndefined();
      expect(restored.preview.widgets[0].datas).toEqual([{ value: 1000 }]);
    } finally {
      connection.queryDuckDB.mockImplementation(originalQuery);
      connection.duckDBVersion.mockImplementation(originalVersion);
      await db
        .getRepository(Database)
        .update(1, { connectionConfig: source.connectionConfig, updatedAt: source.updatedAt });
    }
  });

  it('UC052 rejects stale file pins and invalid condition types without changing saved state', async () => {
    const initial = await studio.get(id, 7);
    const row = await db.getRepository(Dashboard).findOneByOrFail({ id });
    const definition = {
      include: { kind: 'predicate', column: 'amount', operator: 'gte', values: [200] },
      exclude: null,
    };
    const stale = {
      ...initial.document,
      conditions: { sourceRevision: 'a'.repeat(64), definition },
    };
    await expect(
      studio.prepare(
        id,
        {
          document: stale,
          expectedRevision: stale.revision,
          expectedSourceRevision: initial.sourceRevision,
        },
        7,
      ),
    ).rejects.toMatchObject({ status: 409 });
    const wrong = {
      ...initial.document,
      conditions: {
        sourceRevision: initial.sourceRevision,
        definition: { ...definition, include: { ...definition.include, values: ['200'] } },
      },
    };
    await expect(
      studio.prepare(
        id,
        {
          document: wrong,
          expectedRevision: wrong.revision,
          expectedSourceRevision: initial.sourceRevision,
        },
        7,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.getRepository(Dashboard).findOneByOrFail({ id })).toEqual(row);
  });

  it('filters every block before aggregation, persists scope without changing canonical SQL, clears scope', async () => {
    const initial = await studio.get(id, 7);
    const document = applyStudioOperation(initial.document, {
      type: 'setFilters',
      filters: [{ column: 'category', values: ['Site'] }],
    });
    const body = {
      document,
      expectedRevision: document.revision,
      expectedSourceRevision: initial.sourceRevision,
    };
    const filtered = await studio.prepare(id, body, 7);
    expect(filtered.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    expect(filtered.preview.widgets[1].datas).toEqual([{ category: 'Site', value: 300 }]);
    expect((await studio.get(id, 7)).document.filters).toBeUndefined();
    const saved = await save(document);
    const loaded = await studio.get(id, 7);
    expect(loaded.document.filters).toEqual(document.filters);
    expect(loaded.preview.widgets.map(w => w.datas)).toEqual(
      filtered.preview.widgets.map(w => w.datas),
    );
    expect((await ai.analysis(id, 7)).data.defaultFilters).toEqual(document.filters);
    expect((await ai.analysis(id, 7)).data.widgets.map(w => w.sql)).toEqual(
      draft().widgets.map(w => w.sql),
    );
    const published = await studio.publicationSnapshot(
      id,
      saved.document.revision,
      7,
      async v => v,
    );
    expect(published.document.filters).toEqual(document.filters);
    expect(published.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    // Legacy writes invalidate StudioState; server-owned scope is still reconstructed correctly.
    const row = await db.manager.findOneBy(Dashboard, { id });
    await db.manager.update(Dashboard, { id }, { title: row.title + ' legacy' });
    const imported = await studio.get(id, 7);
    expect(imported.document.filters).toEqual(document.filters);
    const cleared = applyStudioOperation(imported.document, { type: 'setFilters', filters: [] });
    await save(cleared, 'clear-filter-' + id);
    expect((await studio.get(id, 7)).preview.widgets[0].datas).toEqual([{ value: 500 }]);
    expect((await ai.analysis(id, 7)).data.defaultFilters).toBeUndefined();
  });
  it('unknown filter columns fail closed before save or preview and empty results do not use stale totals', async () => {
    const initial = await studio.get(id, 7);
    const invalid = {
      ...initial.document,
      filters: [{ column: 'not_a_column', values: ['Site'] }],
    };
    const count = await db.manager.count(Widget);
    await expect(
      studio.prepare(
        id,
        {
          document: invalid,
          expectedRevision: invalid.revision,
          expectedSourceRevision: initial.sourceRevision,
        },
        7,
      ),
    ).rejects.toThrow();
    await expect(save(invalid)).rejects.toThrow();
    expect(await db.manager.count(Widget)).toBe(count);
    expect((await studio.get(id, 7)).document).toEqual(initial.document);
    const empty = { ...initial.document, filters: [{ column: 'category', values: ['Absent'] }] };
    const result = await studio.prepare(
      id,
      {
        document: empty,
        expectedRevision: empty.revision,
        expectedSourceRevision: initial.sourceRevision,
      },
      7,
    );
    expect(result.preview.widgets[0].datas).toEqual([{ value: null }]);
    expect(result.preview.widgets[1].datas).toEqual([]);
  });
  it('applies a saved date range before aggregation, imports it, and clears the stored range', async () => {
    const range = { column: 'event_time', start: '2026-01-01', end: '2026-01-01' };
    const initial = await studio.get(id, 7);
    const scoped = applyStudioOperation(initial.document, {
      type: 'setDateRange',
      dateRange: range,
    });
    const prepared = await studio.prepare(
      id,
      {
        document: scoped,
        expectedRevision: scoped.revision,
        expectedSourceRevision: initial.sourceRevision,
      },
      7,
    );
    expect(prepared.document.dateRange).toEqual(range);
    expect(prepared.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    expect(prepared.preview.widgets[1].datas).toEqual([{ category: 'Site', value: 300 }]);
    // An unsaved range never becomes part of the server document.
    expect((await studio.get(id, 7)).document.dateRange).toBeUndefined();

    await save(scoped, 'range-save-' + id);
    const loaded = await studio.get(id, 7);
    expect(loaded.document.dateRange).toEqual(range);
    expect(loaded.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    const stored = JSON.parse(
      String((await db.manager.findOneBy(Dashboard, { id }))?.structuredDefinition),
    );
    expect(stored.studioDateRange).toEqual(range);
    expect(stored.studioFilters).toBeUndefined();
    expect((await ai.analysis(id, 7)).data.defaultDateRange).toEqual(range);
    // The stored range and filters compose in one scoped query: Mobile exists only outside it.
    const combined = applyStudioOperation(loaded.document, {
      type: 'setFilters',
      filters: [{ column: 'category', values: ['Mobile'] }],
    });
    const composed = await studio.prepare(
      id,
      {
        document: combined,
        expectedRevision: combined.revision,
        expectedSourceRevision: initial.sourceRevision,
      },
      7,
    );
    expect(composed.preview.widgets[0].datas).toEqual([{ value: null }]);
    expect(composed.preview.widgets[1].datas).toEqual([]);

    // A legacy write invalidates StudioState; the server-owned range is still reconstructed.
    await db.manager.update(Dashboard, { id }, { title: 'range legacy' });
    const imported = await studio.get(id, 7);
    expect(imported.document.dateRange).toEqual(range);
    expect(imported.preview.widgets[0].datas).toEqual([{ value: 300 }]);

    const cleared = applyStudioOperation(imported.document, {
      type: 'setDateRange',
      dateRange: null,
    });
    await save(cleared, 'range-clear-' + id);
    const afterClear = await studio.get(id, 7);
    expect(afterClear.document.dateRange).toBeUndefined();
    expect(afterClear.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const clearedSnapshot = JSON.parse(
      String((await db.manager.findOneBy(Dashboard, { id }))?.structuredDefinition),
    );
    expect(clearedSnapshot.studioDateRange).toBeUndefined();
    expect((await ai.analysis(id, 7)).data.defaultDateRange).toBeUndefined();
  });
  it('fails closed on a malformed saved scope with a distinguishable code', async () => {
    const range = { column: 'event_time', start: '2026-01-01', end: '2026-01-01' };
    const initial = await studio.get(id, 7);
    await save(
      applyStudioOperation(initial.document, { type: 'setDateRange', dateRange: range }),
      'range-invalid-' + id,
    );
    const row = await db.manager.findOneBy(Dashboard, { id });
    if (!row) throw new Error('Expected saved dashboard');
    const stored = JSON.parse(String(row.structuredDefinition));
    stored.studioDateRange = { column: 'event_time', start: '2026-01-01', end: 'not-a-date' };
    await db.manager.update(
      Dashboard,
      { id },
      { structuredDefinition: JSON.stringify(stored), title: 'malformed range' },
    );
    const failure = async (run: () => Promise<unknown>) => {
      try {
        await run();
      } catch (error) {
        return (error as any).getResponse?.();
      }
      return null;
    };
    expect(await failure(() => ai.analysis(id, 7))).toMatchObject({ code: 'INVALID_STUDIO_SCOPE' });
    expect(await failure(() => studio.get(id, 7))).toMatchObject({ code: 'INVALID_STUDIO_SCOPE' });
    // Malformed stored filters use the same distinguishable code.
    stored.studioDateRange = range;
    stored.studioFilters = [{ column: 'category' }];
    await db.manager.update(Dashboard, { id }, { structuredDefinition: JSON.stringify(stored) });
    expect(await failure(() => ai.analysis(id, 7))).toMatchObject({ code: 'INVALID_STUDIO_SCOPE' });
  });
  it('persists exact viewport geometry/title, keeps existing viewer numbers and canonical references', async () => {
    const state = await studio.get(id, 7);
    expect(state.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const doc = state.document;
    doc.title = 'Edited';
    doc.blocks[0].title = 'Total sales';
    doc.layouts.lg[0].y = 10;
    doc.layouts.md[0].y = 20;
    doc.layouts.xs[0].y = 30;
    const result = await save(doc);
    const loaded = await studio.get(id, 7);
    expect(loaded.document).toEqual(result.document);
    expect(loaded.document.layouts).toEqual(doc.layouts);
    expect(loaded.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const analysis = (await ai.analysis(id, 7, true)).data;
    expect(analysis.blockLayouts[doc.blocks[0].id].y).toBe(10);
    expect(analysis.widgets[0].sql).toBe(draft().widgets[0].sql);
  });
  it('remaps duplicates only, replays exactly once, rejects changed payload and stale saves without writes', async () => {
    const original = (await studio.get(id, 7)).document;
    const doc = applyStudioOperation(original, {
      type: 'duplicateBlock',
      blockId: original.blocks[0].id,
      newId: 'new:11111111-1111-4111-8111-111111111111',
    });
    const first = await save(doc);
    const count = await db.manager.count(Widget);
    expect(await save(doc)).toEqual(first);
    expect(await db.manager.count(Widget)).toBe(count);
    expect(Object.keys(first.idMap)).toHaveLength(1);
    await expect(save({ ...doc, title: 'Different' })).rejects.toThrow('같은 저장 요청');
    await expect(save(original, 'stale')).rejects.toThrow('다른 화면');
    expect(await db.manager.count(Widget)).toBe(count);
    const loaded = (await studio.get(id, 7)).document;
    expect(loaded.blocks[0].id).toBe(original.blocks[0].id);
    expect(loaded.blocks[2].id).toBe(first.idMap[doc.blocks[2].id]);
  });
  it('checks dashboard/source ownership and rejects unknown persisted IDs/definition tampering', async () => {
    await expect(studio.get(id, 8)).rejects.toThrow();
    const doc = (await studio.get(id, 7)).document;
    const invalid = JSON.parse(JSON.stringify(doc));
    invalid.blocks[0].definitionKey = 'other';
    await expect(save(invalid)).rejects.toThrow('계산 정의');
    const changed = JSON.parse(JSON.stringify(doc));
    changed.blocks[0].id = 'unknown';
    for (const bp of ['lg', 'md', 'xs']) changed.layouts[bp][0].id = 'unknown';
    await expect(save(changed)).rejects.toThrow('계산 정의');
    await db.manager.update(Database, { id: 1 }, { ownerId: 8 });
    try {
      await expect(save(doc)).rejects.toThrow();
    } finally {
      await db.manager.update(Database, { id: 1 }, { ownerId: 7 });
    }
  });
  it('rolls all writes back if the journal fails after widget creation', async () => {
    const doc = (await studio.get(id, 7)).document;
    const count = await db.manager.count(Widget);
    const original = await db.manager.findOneBy(Dashboard, { id });
    await db.query(
      "CREATE TRIGGER studio_fail BEFORE INSERT ON studio_run BEGIN SELECT RAISE(FAIL, 'journal failure'); END",
    );
    try {
      await expect(save({ ...doc, title: 'Failure' })).rejects.toThrow('journal failure');
      expect(await db.manager.count(Widget)).toBe(count);
      expect(await db.manager.findOneBy(Dashboard, { id })).toEqual(original);
      expect(await db.manager.countBy(StudioState, { dashboardId: id })).toBe(0);
    } finally {
      await db.query('DROP TRIGGER studio_fail');
    }
  });
  it('preserves structured metric snapshots through duplicate/delete and blocks stale metric versions', async () => {
    const definition = {
      schemaVersion: 1,
      sourceId: 1,
      definitionVersion: 1,
      label: 'Sales',
      aggregation: 'sum',
      column: 'amount',
    };
    const metric = await db.manager.save(Metric, {
      name: 'studio_sales_' + id,
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
      useYn: 'Y',
    });
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      dataVersion: 'fixture',
      items: [
        { sourceId: 1, metricId: metric.id, definitionVersion: 1, definition },
        {
          sourceId: 1,
          metricId: metric.id,
          definitionVersion: 1,
          definition,
          dimension: 'category',
          chart: 'bar',
        },
      ],
    };
    await db.manager.update(Dashboard, { id }, { structuredDefinition: JSON.stringify(snapshot) });
    const loaded = await studio.get(id, 7);
    const doc = loaded.document;
    expect(loaded.definitions.entries[doc.blocks[0].definitionKey].metricBasis).toEqual({
      sourceId: 1,
      metricId: metric.id,
      definitionVersion: '1',
      definition: { aggregation: 'sum', column: 'amount' },
    });
    expect(doc.blocks[0].measureRefs).toEqual([{ id: metric.id, definitionVersion: '1' }]);
    const next = applyStudioOperation(doc, {
      type: 'duplicateBlock',
      blockId: doc.blocks[1].id,
      newId: 'new:22222222-2222-4222-8222-222222222222',
    });
    const tampered = JSON.parse(JSON.stringify(next));
    tampered.blocks[0].measureRefs = [];
    await expect(save(tampered, 'drop-ref-' + id)).rejects.toThrow('계산 정의');
    const saved = await save(next);
    const stored = JSON.parse((await db.manager.findOneBy(Dashboard, { id })).structuredDefinition);
    expect(stored.items).toEqual(
      [snapshot.items[0], snapshot.items[1], snapshot.items[1]].map((item, i) => ({
        ...item,
        key: saved.document.blocks[i].id,
      })),
    );
    const latest = (await studio.get(id, 7)).document;
    await db.manager.update(
      Metric,
      { id: metric.id },
      { definition: JSON.stringify({ ...definition, definitionVersion: 2 }) },
    );
    const frozen = await studio.get(id, 7);
    expect(frozen.definitions.entries[frozen.document.blocks[0].definitionKey].metricBasis).toEqual(
      {
        sourceId: 1,
        metricId: metric.id,
        definitionVersion: '1',
        definition: { aggregation: 'sum', column: 'amount' },
      },
    );
    await expect(
      studio.prepare(
        id,
        {
          document: latest,
          expectedRevision: latest.revision,
          expectedSourceRevision: await connection.duckDBVersion(1),
        },
        7,
      ),
    ).rejects.toThrow('지표 정의');
    await expect(save({ ...latest, title: 'Stale metric' }, 'metric-stale')).rejects.toThrow(
      '지표 정의',
    );
  });
  it('rejects schema drift in stored dimension references without any writes', async () => {
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      items: [{}, { sourceId: 1, dimension: 'category', chart: 'bar' }],
    };
    await db.manager.update(Dashboard, { id }, { structuredDefinition: JSON.stringify(snapshot) });
    const doc = (await studio.get(id, 7)).document;
    await save(doc);
    const latest = (await studio.get(id, 7)).document;
    const count = await db.manager.count(Widget);
    const query = connection.queryDuckDB.getMockImplementation();
    connection.queryDuckDB.mockImplementation(async (source, sql, bindings) => {
      const result = await query(source, sql, bindings);
      return sql === 'DESCRIBE uploaded_data'
        ? { ...result, datas: [...result.datas, { column_name: 'extra', column_type: 'VARCHAR' }] }
        : result;
    });
    try {
      await expect(
        save({ ...latest, title: 'Schema changed' }, 'schema-drift-' + id),
      ).rejects.toThrow('소스 열');
      const latestSource = await connection.duckDBVersion(1);
      await expect(
        studio.prepare(
          id,
          {
            document: latest,
            expectedRevision: latest.revision,
            expectedSourceRevision: latestSource,
          },
          7,
        ),
      ).rejects.toThrow('소스 열');
      expect(await db.manager.count(Widget)).toBe(count);
    } finally {
      connection.queryDuckDB.mockImplementation(query);
    }
  });
  it('rejects a replaced source file even when only numeric measures are edited', async () => {
    const doc = (await studio.get(id, 7)).document;
    const before = await db.manager.count(Widget);
    connection.duckDBVersion.mockResolvedValue(studioDigest('new-source'));
    try {
      await expect(save({ ...doc, title: 'Changed source' }, 'file-stale-' + id)).rejects.toThrow(
        '데이터 파일',
      );
      expect(await db.manager.count(Widget)).toBe(before);
      expect((await studio.get(id, 7)).sourceRevision).toBe(studioDigest('new-source'));
    } finally {
      connection.duckDBVersion.mockResolvedValue(sourceRevision);
    }
  });
  it('imports legacy single-block metric links with explicitly unlinked attached widgets', async () => {
    const definition = {
      schemaVersion: 1,
      sourceId: 1,
      definitionVersion: 1,
      label: 'Sales',
      aggregation: 'sum',
      column: 'amount',
    };
    const metric = await db.manager.save(Metric, {
      name: 'single_sales_' + id,
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
      useYn: 'Y',
    });
    const snapshot = {
      schemaVersion: 1,
      kind: 'structured-bi',
      sourceId: 1,
      metricId: metric.id,
      definitionVersion: 1,
      definition,
    };
    await db.manager.update(Dashboard, { id }, { structuredDefinition: JSON.stringify(snapshot) });
    const doc = (await studio.get(id, 7)).document;
    expect(doc.blocks[0].measureRefs).toEqual([{ id: metric.id, definitionVersion: '1' }]);
    expect(doc.blocks[1].measureRefs).toEqual([]);
    const saved = await save({ ...doc, title: 'Legacy linked' });
    const stored = JSON.parse((await db.manager.findOneBy(Dashboard, { id })).structuredDefinition);
    expect(stored.items[0]).toEqual({ ...snapshot, key: saved.document.blocks[0].id });
    expect(stored.items[1]).toEqual({
      kind: 'studio-unlinked-legacy',
      sourceId: 1,
      key: saved.document.blocks[1].id,
    });
  });
  it('rejects malformed structured snapshot alignment rather than inventing unlinked blocks', async () => {
    await db.manager.update(
      Dashboard,
      { id },
      {
        structuredDefinition: JSON.stringify({
          schemaVersion: 1,
          kind: 'structured-bi',
          sourceId: 1,
          metricId: 1,
        }),
      },
    );
    await expect(studio.get(id, 7)).rejects.toThrow('지표 연결');
  });
  it('serializes competing Studio saves and only commits one revision', async () => {
    const doc = (await studio.get(id, 7)).document;
    const before = await db.manager.count(StudioRun);
    const results = await Promise.allSettled([
      save({ ...doc, title: 'First' }, 'race-first-' + id),
      save({ ...doc, title: 'Second' }, 'race-second-' + id),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await db.manager.count(StudioRun)).toBe(before + 1);
  });
  it('detects legacy edits, reimports current definitions, and retains failed preview metadata', async () => {
    const doc = (await studio.get(id, 7)).document;
    await save({ ...doc, title: 'Studio saved' });
    const edited = await db.manager.findOneBy(Dashboard, { id });
    edited.title = 'Legacy edit';
    await db.manager.save(Dashboard, edited);
    await expect(save({ ...doc, title: 'Overwrite' }, 'legacy-stale')).rejects.toThrow('다른 화면');
    const loaded = await studio.get(id, 7);
    expect(loaded.document.title).toBe('Legacy edit');
    const spy = jest.spyOn(ai, 'preview').mockRejectedValueOnce(new Error('offline'));
    try {
      const failed = await studio.get(id, 7);
      expect(failed.preview).toBeNull();
      expect(failed.document.title).toBe('Legacy edit');
      expect(failed.previewError).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  });
  it('previews and persists a selected weekly chart without SQL, other blocks or layout changes', async () => {
    await db.manager.save(Component, {
      type: 'CHART_LINE',
      title: 'Line',
      option: '{}',
      useYn: 'Y',
    });
    const original = draft();
    original.widgets[1] = {
      ...original.widgets[1],
      type: 'CHART_LINE',
      categoryField: 'dimension',
      sql: "SELECT date_trunc('day', event_time) AS dimension, sum(amount) AS value FROM source GROUP BY dimension ORDER BY dimension",
    };
    const lineId = (await ai.save({ draft: original }, 7)).data.id;
    const loaded = await studio.get(lineId, 7);
    const next = applyStudioOperation(loaded.document, {
      type: 'updateBlock',
      blockId: loaded.document.blocks[1].id,
      patch: { display: { timeGrain: 'week' } },
    });
    const body = {
      expectedRevision: loaded.document.revision,
      expectedSourceRevision: loaded.sourceRevision,
      document: next,
    };
    const checked = await studio.prepare(lineId, body, 7);
    expect(checked.preview.widgets[1].datas).toHaveLength(1);
    expect(checked.preview.widgets[1].datas[0].value).toBe(500);
    expect(checked.preview.widgets[0].datas).toEqual(loaded.preview.widgets[0].datas);
    expect(checked.document.layouts).toEqual(loaded.document.layouts);
    expect((await studio.get(lineId, 7)).document).toEqual(loaded.document);
    const saved = await studio.save(lineId, { ...body, requestId: 'weekly' }, 7);
    const after = await studio.get(lineId, 7);
    expect(after.document.blocks[1].display.timeGrain).toBe('week');
    expect(after.document.layouts).toEqual(saved.document.layouts);
    expect(after.preview.widgets[1].datas[0].value).toBe(500);
    const mapped = await db.manager.find(DashboardWidget, {
      where: { dashboardId: lineId },
      order: { id: 'ASC' },
    });
    const savedWidget = await db.manager.findOneBy(Widget, { id: mapped[1].widgetId });
    const dataset = await db.manager.findOneBy(Dataset, { id: savedWidget.datasetId });
    const detailRows = await connection.queryDuckDB(1, dataset.query);
    expect(detailRows.datas).toHaveLength(1);
    expect(detailRows.datas[0].value).toBe(500);
    expect((await ai.analysis(lineId, 7, true)).data.widgets[1].sql).toBe(original.widgets[1].sql);
    const daily = applyStudioOperation(after.document, {
      type: 'updateBlock',
      blockId: after.document.blocks[1].id,
      patch: { display: { timeGrain: 'day' } },
    });
    const undo = await studio.prepare(
      lineId,
      {
        expectedRevision: after.document.revision,
        expectedSourceRevision: after.sourceRevision,
        document: daily,
      },
      7,
    );
    expect(undo.preview.widgets[1].datas).toHaveLength(2);
  });
  it('UC055 completes real Studio save SQL before opening the persistence transaction', async () => {
    const state = await studio.get(id, 7);
    const query = connection.queryDuckDB.getMockImplementation();
    let calls = 0;
    connection.queryDuckDB.mockImplementation(async (...args) => {
      expect(db.createQueryRunner().isTransactionActive).toBe(false);
      calls++;
      return query(...args);
    });
    try {
      await studio.save(
        id,
        {
          requestId: 'sql-outside-' + id,
          expectedRevision: state.document.revision,
          expectedSourceRevision: state.sourceRevision,
          document: { ...state.document, title: 'SQL before lock' },
        },
        7,
      );
      expect(calls).toBeGreaterThan(0);
    } finally {
      connection.queryDuckDB.mockImplementation(query);
    }
  });
  it('T7 rolls back all metadata and save journal when cancellation arrives before commit', async () => {
    const document = (await studio.get(id, 7)).document;
    const before = await db.manager.findOneBy(Dashboard, { id });
    const count = await db.manager.count(Widget);
    const controller = new AbortController();
    const originalSave = ai.prepareSave.bind(ai);
    const hook = jest.spyOn(ai, 'prepareSave').mockImplementation(async (...args) => {
      const prepared = await originalSave(...args);
      return {
        ...prepared,
        persist: async (...values) => {
          const result = await prepared.persist(...values);
          controller.abort();
          return result;
        },
      };
    });
    try {
      await expect(
        studio.save(
          id,
          {
            requestId: 'cancel-' + id,
            expectedRevision: document.revision,
            expectedSourceRevision: sourceRevision,
            document: { ...document, title: 'Cancelled' },
          },
          7,
          controller.signal,
        ),
      ).rejects.toThrow('취소');
      expect(await db.manager.findOneBy(Dashboard, { id })).toEqual(before);
      expect(await db.manager.count(Widget)).toBe(count);
      expect(await db.manager.countBy(StudioRun, { requestId: 'cancel-' + id })).toBe(0);
      expect(await db.manager.countBy(StudioState, { dashboardId: id })).toBe(0);
    } finally {
      hook.mockRestore();
    }
  });
  it('T7 queued cancellation writes zero and aborted replay after commit returns the existing result', async () => {
    const document = (await studio.get(id, 7)).document;
    const request = {
      requestId: 'cancel-queued-' + id,
      expectedRevision: document.revision,
      expectedSourceRevision: sourceRevision,
      document,
    };
    let release: () => void;
    const blocked = studio.serializeWrite(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        }),
    );
    await new Promise(resolve => setImmediate(resolve));
    const controller = new AbortController();
    const pending = studio.save(id, request, 7, controller.signal);
    const check = expect(pending).rejects.toThrow('취소');
    controller.abort();
    release();
    await blocked;
    await check;
    expect(await db.manager.countBy(StudioRun, { requestId: request.requestId })).toBe(0);
    const saved = await studio.save(id, request, 7);
    expect(await studio.save(id, request, 7, controller.signal)).toEqual(saved);
    expect(await db.manager.countBy(StudioRun, { requestId: request.requestId })).toBe(1);
  });
  it('T7 checks original and current source ownership independently on read/replay', async () => {
    await db.manager.save(Database, {
      id: 2,
      ownerId: 8,
      name: 'Other',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    const read = jest.spyOn(ai, 'analysis').mockResolvedValue({ data: { databaseId: 2 } } as any);
    try {
      await expect(studio.assertExecutionAccess(id, 1, 7)).rejects.toMatchObject({ status: 403 });
    } finally {
      read.mockRestore();
    }
    await db.manager.update(Database, { id: 2 }, { ownerId: 7 });
    await db.manager.update(Database, { id: 1 }, { ownerId: 8 });
    try {
      await expect(studio.assertExecutionAccess(id, 1, 7)).rejects.toMatchObject({ status: 403 });
    } finally {
      await db.manager.update(Database, { id: 1 }, { ownerId: 7 });
    }
  });
  it('UC051 saves a granted editor actual DuckDB preview and rechecks edit before receipt replay', async () => {
    await db.manager.save(User, [
      {
        id: 7,
        userId: 'synthetic-owner',
        email: 'owner@example.invalid',
        password: 'synthetic-unused',
      },
      {
        id: 8,
        userId: 'synthetic-editor',
        email: 'editor@example.invalid',
        password: 'synthetic-unused',
      },
    ]);
    await db.manager.save(EnterpriseOrganization, {
      id: 1,
      name: 'Synthetic organization',
      version: 1,
    });
    await db.manager.save(EnterpriseMembership, [
      { userId: 7, organizationId: 1, role: 'admin', team: '' },
      { userId: 8, organizationId: 1, role: 'member', team: '' },
    ]);
    const policy = new EnterpriseResourcePolicyService(db);
    const access = new SourceAccessService(db, policy);
    const delegatedAi = new AiDashboardService(
      {} as any,
      connection,
      db.getRepository(Dashboard),
      access,
    );
    const delegatedStudio = new StudioService(db, delegatedAi, connection, access);
    const rights = (over = {}) => ({
      read: true,
      edit: false,
      publish: false,
      export: false,
      ...over,
    });
    await policy.set('source', 1, 7, { recipientId: 8, expectedVersion: 0, rights: rights() });
    await policy.set('dashboard', id, 7, {
      recipientId: 8,
      expectedVersion: 0,
      rights: rights({ edit: true }),
    });
    const initial = await delegatedStudio.get(id, 8);
    expect(initial.owned).toBe(false);
    expect(initial.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const document = applyStudioOperation(initial.document, {
      type: 'renameDashboard',
      title: 'Granted editor changed title',
    });
    const request = {
      requestId: 'granted-save-' + id,
      expectedRevision: initial.document.revision,
      expectedSourceRevision: initial.sourceRevision,
      document,
    };
    const prepared = await delegatedStudio.prepare(id, request, 8);
    expect(prepared.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const saved = await delegatedStudio.save(id, request, 8);
    const reloaded = await delegatedStudio.get(id, 8);
    expect(reloaded.document).toEqual(saved.document);
    expect(reloaded.document.title).toBe('Granted editor changed title');
    expect(reloaded.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    expect(
      await db.manager.count(StudioRun, { where: { requestId: request.requestId, actorId: 8 } }),
    ).toBe(1);
    expect(await db.manager.find(UserMapping, { where: { dashboardId: id } })).toEqual([
      expect.objectContaining({ userInfoId: 7 }),
    ]);
    await policy.set('dashboard', id, 7, {
      recipientId: 8,
      expectedVersion: 1,
      rights: rights({ edit: true, publish: true }),
    });
    const publications = new StudioPublicationService(db, delegatedStudio, access);
    const published = await publications.publish(
      id,
      {
        requestId: 'granted-publish-' + id,
        expectedRevision: saved.document.revision,
        visibility: 'link',
        allowRemix: false,
      },
      8,
    );
    expect((await publications.read(published.token)).version).toBe(1);
    const lifecycle = new SourceLifecycleService(db, policy);
    await lifecycle.set(1, 7, { expectedVersion: 0, active: false });
    await expect(publications.read(published.token)).rejects.toMatchObject({ status: 403 });
    await expect(delegatedStudio.get(id, 8)).rejects.toMatchObject({ status: 403 });
    await lifecycle.set(1, 7, { expectedVersion: 1, active: true });
    expect((await publications.read(published.token)).version).toBe(1);

    expect(
      await db.manager.findOneByOrFail(StudioPublication, { token: published.token }),
    ).toMatchObject({ actorId: 8, sourceId: 1 });
    await policy.set('dashboard', id, 7, { recipientId: 8, expectedVersion: 2, rights: rights() });
    await expect(publications.read(published.token)).rejects.toMatchObject({ status: 403 });
    await expect(delegatedStudio.save(id, request, 8)).rejects.toMatchObject({ status: 403 });
    expect((await delegatedStudio.get(id, 8)).document).toEqual(saved.document);
    await policy.set('source', 1, 7, {
      recipientId: 8,
      expectedVersion: 1,
      rights: { read: false, edit: false, publish: false, export: false },
    });
    await expect(delegatedStudio.get(id, 8)).rejects.toMatchObject({ status: 403 });
    expect((await db.manager.findOneByOrFail(Database, { id: 1 })).ownerId).toBe(7);
  });
  it('FR015 direct and AI use the same frozen business-date meaning through preview/save/reload after newer catalog semantics', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'codex';
    expect(await db.manager.count(SourceCatalogEntry, { where: { sourceId: 1 } })).toBe(0);
    try {
      const schema = (await connection.queryDuckDB(1, 'DESCRIBE uploaded_data')).datas.map(c => ({
        name: c.column_name,
        type: c.column_type,
      }));
      const columns = schema.map(c => ({
        column: c.name,
        label: c.name,
        description: '',
        unit: '',
        classification: '',
        businessType: c.name === 'event_time' ? 'date' : 'auto',
        dateFormat: c.name === 'event_time' ? 'native' : '',
      }));
      const schemaRevision = createHash('sha256')
        .update(JSON.stringify(schema.map(c => ({ column: c.name, type: c.type }))))
        .digest('hex');
      await db.manager.insert(SourceCatalogEntry, {
        sourceId: 1,
        version: 1,
        actorId: 7,
        schemaRevision,
        sourceRevision: 'test-metadata-revision',
        metadata: JSON.stringify({ label: 'Dates', description: '', columns }),
      });
      const semantics = await latestConditionSemantics(db.manager, 1, schema);
      const initial = await studio.get(id, 7);
      const definition = {
        include: {
          kind: 'predicate',
          column: 'event_time',
          operator: 'eq',
          values: ['2026-01-02'],
        },
        exclude: null,
      };
      const document = {
        ...initial.document,
        conditions: { sourceRevision, definition, semantics },
      };
      const checked = await studio.prepare(
        id,
        {
          expectedRevision: initial.document.revision,
          expectedSourceRevision: sourceRevision,
          document,
        },
        7,
      );
      expect(checked.preview.widgets[0].datas).toEqual([{ value: 200 }]);
      expect(checked.conditionColumns.find(c => c.name === 'event_time').kind).toBe('date');
      await save(document, 'business-direct-' + id);
      let restored = await studio.get(id, 7);
      expect(restored.document.conditions.semantics).toEqual(semantics);
      expect(restored.preview.widgets[0].datas).toEqual([{ value: 200 }]);
      await db.manager.insert(SourceCatalogEntry, {
        sourceId: 1,
        version: 2,
        actorId: 7,
        schemaRevision,
        sourceRevision: 'test-metadata-revision',
        metadata: JSON.stringify({
          label: 'Dates',
          description: '',
          columns: columns.map(c =>
            c.column === 'event_time' ? { ...c, businessType: 'category', dateFormat: '' } : c,
          ),
        }),
      });
      const kept = await studio.get(id, 7);
      expect(kept.profileColumns.find(c => c.name === 'event_time').kind).toBe('date');
      expect(kept.preview.widgets[0].datas).toEqual([{ value: 200 }]);
      const proposed = {
        include: {
          kind: 'predicate',
          column: 'event_time',
          operator: 'between',
          values: ['2026-01-01', '2026-01-01'],
        },
        exclude: null,
      };
      const model = {
        callLlm: jest.fn().mockResolvedValue(
          JSON.stringify({
            intent: 'edit',
            answer: '조건을 검토하세요.',
            operations: [{ type: 'setConditions', definition: proposed }],
          }),
        ),
      };
      const runs = new StudioRunService(studio, model as any);
      const before = await db.manager.count(StudioRun);
      const result = await runs.run(
        {
          requestId: 'business-ai-' + id,
          dashboardId: id,
          document: kept.document,
          expectedRevision: kept.document.revision,
          expectedSourceRevision: sourceRevision,
          clientEditVersion: 1,
          prompt: '2026년 1월 1일의 업무 날짜 조건으로 검토해 줘',
        },
        7,
      );
      const context = JSON.parse(model.callLlm.mock.calls[0][1]);
      expect(context.conditionColumns.find(c => c.name === 'event_time')).toMatchObject({
        kind: 'date',
        businessType: 'date',
        dateFormat: 'native',
      });
      expect(result.proposedOperations[0].conditions.semantics).toEqual(semantics);
      expect(result.preview.widgets[0].datas).toEqual([{ value: 300 }]);
      expect(await db.manager.count(StudioRun)).toBe(before);
      const applied = result.proposedOperations.reduce(applyStudioOperation, kept.document);
      await save(applied, 'business-ai-reviewed-' + id);
      restored = await studio.get(id, 7);
      expect(restored.preview.widgets[0].datas).toEqual([{ value: 300 }]);
      expect(restored.document.conditions.semantics.catalogVersion).toBe(1);
      const dropped = {
        ...restored.document,
        conditions: { sourceRevision, definition: proposed },
      };
      await expect(save(dropped, 'business-meaning-drop-' + id)).rejects.toThrow('업무 의미');
      expect((await studio.get(id, 7)).document.conditions.semantics).toEqual(semantics);
    } finally {
      await db.manager.delete(SourceCatalogEntry, { sourceId: 1, version: 2 });
      await db.manager.delete(SourceCatalogEntry, { sourceId: 1, version: 1 });
      if (previousProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = previousProvider;
    }
  });
});
