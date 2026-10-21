jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SemanticCreationService } from './semantic-creation.service';
import { AnalysisCreationReceipt } from './analysis-creation-receipt.entity';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { compileSemanticProposal, semanticCatalog } from './semantic-proposal';
import { sourceRevision } from './source-revision';
import { linkedMetricIndices, refreshMetricLinks } from '../ai/metric-analysis-links';
import { AddAnalysisCreationReceipts1792030000000 } from '../migrations/1792030000000-add-analysis-creation-receipts';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';

const entities = [
  Database,
  Metric,
  Dashboard,
  DashboardShare,
  DashboardWidget,
  UserMapping,
  Dataset,
  Widget,
  Component,
  AnalysisCreationReceipt,
  User,
  EnterpriseMembership,
  SourceCatalogEntry,
];
const def = {
  label: '매출',
  aggregation: 'SUM',
  column: 'amount',
  unit: '',
  decimalPlaces: 0,
  numberNotation: 'compact',
};
describe('UC012 B SQLite atomic creation', () => {
  let db: DataSource,
    second: DataSource,
    dir: string,
    profile: any,
    body: any,
    service: SemanticCreationService,
    dashboards: AiDashboardService;
  const proposal = () => ({
    schemaVersion: 1,
    sourceId: 1,
    sourceRevision: profile.dataVersion,
    title: '검증',
    measures: [{ key: 'sales', definition: { ...def } }],
    dimensions: [{ key: 'os', column: 'os' }],
    blocks: [
      { key: 'total', measureKey: 'sales', chart: 'number', title: '매출' },
      { key: 'os', measureKey: 'sales', dimensionKey: 'os', chart: 'bar', title: 'OS별 매출' },
    ],
  });
  const columns = [
    { name: 'amount', numeric: true, temporal: false, type: 'DOUBLE' },
    { name: 'os', numeric: false, temporal: false, type: 'VARCHAR' },
  ];
  const make = (source: DataSource) => {
    const ai = new AiDashboardService({} as any, {} as any, source.getRepository(Dashboard));
    jest.spyOn(ai, 'preview').mockImplementation(
      async (b: any) =>
        ({
          status: 'SUCCESS',
          data: { draft: b.draft, widgets: b.draft.widgets.map(w => ({ ...w, datas: [] })) },
        } as any),
    );
    const connection = { withDuckDBSnapshot: (_id, fn) => fn() };
    const bi = {
      profile: jest.fn().mockImplementation(async () => profile),
      assertSourceAction: jest.fn(async (id, actor) => {
        const row = await source.manager.findOneBy(Database, { id });
        if (!row || row.ownerId !== actor || row.catalogActive === false)
          throw new ForbiddenException('source ownership required');
      }),
    };
    return {
      service: new SemanticCreationService(source, bi as any, ai, connection as any),
      ai,
      bi,
      connection,
    };
  };
  const counts = async () => Promise.all(entities.map(e => db.getRepository(e).count()));
  const preview = async (p = proposal()) =>
    compileSemanticProposal(
      p,
      profile,
      semanticCatalog(await db.getRepository(Metric).find(), profile),
    );
  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-creation-'));
    db = await new DataSource({
      type: 'sqlite',
      database: path.join(dir, 'metadata.db'),
      entities,
      synchronize: true,
    }).initialize();
    await db.manager.save(
      User,
      [10, 11].map(id => ({
        id,
        active: true,
        authVersion: 0,
        userId: `creator-${id}`,
        email: `creator-${id}@example.invalid`,
        password: 'fixture',
      })),
    );
    const source = await db.getRepository(Database).save({
      id: 1,
      ownerId: 10,
      name: 'fixture',
      type: 'file',
      engine: 'duckdb',
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: '/immutable/v1.duckdb' },
      }),
    });
    profile = {
      sourceId: 1,
      supported: true,
      columns,
      dataVersion: sourceRevision(
        source,
        createHash('sha256').update('/immutable/v1.duckdb').digest('hex'),
      ),
    };
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN'])
      await db.getRepository(Component).save({ type, title: type, option: '{}', useYn: 'Y' });
    const made = make(db);
    service = made.service;
    dashboards = made.ai;
    const compiled = await preview();
    body = {
      proposal: compiled.proposal,
      previewDigest: compiled.previewDigest,
      requestId: randomUUID(),
    };
  });
  afterEach(async () => {
    if (second?.isInitialized) await second.destroy();
    if (db?.isInitialized) await db.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });
  it('stores one metric for KPI and breakdown, real datasets/widgets, UUID links and dimension snapshot', async () => {
    const saved = await service.save(body, 10);
    expect(await db.getRepository(Metric).count()).toBe(1);
    expect(await db.getRepository(Dataset).count()).toBe(2);
    const row = await db.getRepository(Dashboard).findOneBy({ id: saved.id });
    const snapshot = JSON.parse(row.structuredDefinition),
      draft = JSON.parse(row.analysisDefinition);
    expect(snapshot.items.map(i => i.key)).toEqual(draft.widgets.map(w => w.blockId));
    expect(new Set(snapshot.items.map(i => i.metricId)).size).toBe(1);
    expect(snapshot.items[1].dimensionDefinition).not.toHaveProperty('key');
    expect(snapshot.items[1].dimensionDefinition).toMatchObject({
      column: 'os',
      type: 'VARCHAR',
      id: expect.stringMatching(/^dim_/),
    });
    expect(linkedMetricIndices(snapshot, draft, snapshot.items[0].metricId)).toEqual([0, 1]);
    const changed = refreshMetricLinks(snapshot, draft, [0, 1], snapshot.items[0].metricId, {
      ...snapshot.items[0].definition,
      definitionVersion: 2,
    });
    expect(changed.items[1].dimensionDefinition).toEqual(snapshot.items[1].dimensionDefinition);
    const before = await counts();
    expect(await service.save(body, 10)).toEqual({ id: saved.id, replayed: true });
    expect(await counts()).toEqual(before);
    const metric = await db.getRepository(Metric).findOneBy({ id: snapshot.items[0].metricId });
    await db.getRepository(Metric).update(metric.id, {
      definition: JSON.stringify({ ...JSON.parse(metric.definition), definitionVersion: 2 }),
    });
    await db.getRepository(Database).update(1, { connectionConfig: '{}' });
    expect((await service.save(body, 10)).id).toBe(saved.id);
  });
  it('rejects changed request payload and never recreates a deleted receipt result', async () => {
    const saved = await service.save(body, 10);
    const before = await counts();
    await expect(
      service.save({ ...body, proposal: { ...body.proposal, title: '변경' } }, 10),
    ).rejects.toThrow('REQUEST_CHANGED');
    await db.getRepository(Dashboard).update(saved.id, { delYn: 'Y' });
    await expect(service.save(body, 10)).rejects.toThrow('사용할 수 없습니다');
    expect(await counts()).toEqual(before);
  });
  it('handles simultaneous same-key requests through independent SQLite connections', async () => {
    second = await new DataSource({
      type: 'sqlite',
      database: path.join(dir, 'metadata.db'),
      entities,
    }).initialize();
    const other = make(second).service;
    const results = await Promise.all([service.save(body, 10), other.save(body, 10)]);
    expect(results[0].id).toBe(results[1].id);
    expect(await db.getRepository(Dashboard).count()).toBe(1);
    expect(await db.getRepository(AnalysisCreationReceipt).count()).toBe(1);
    expect(await db.getRepository(Metric).count()).toBe(1);
  });
  it('allows an independent source writer during SQL preparation then rejects its changed pointer before persistence', async () => {
    second = await new DataSource({
      type: 'sqlite',
      database: path.join(dir, 'metadata.db'),
      entities,
    }).initialize();
    await second.query('PRAGMA busy_timeout = 10');
    jest.spyOn(dashboards, 'preview').mockImplementation(async (b: any) => {
      await expect(
        second.query("UPDATE database SET connectionConfig = '{}' WHERE id = 1"),
      ).resolves.toBeUndefined();
      return {
        status: 'SUCCESS',
        data: { draft: b.draft, widgets: b.draft.widgets.map(w => ({ ...w, datas: [] })) },
      } as any;
    });
    const before = await counts();
    await expect(service.save(body, 10)).rejects.toThrow('SOURCE_CHANGED');
    expect(await counts()).toEqual(before);
  });
  it('makes different simultaneous request keys re-preview instead of duplicating a new metric', async () => {
    second = await new DataSource({
      type: 'sqlite',
      database: path.join(dir, 'metadata.db'),
      entities,
    }).initialize();
    const other = make(second);
    let ready = 0;
    let release: () => void;
    const prepared = new Promise<void>(resolve => (release = resolve));
    // Both requests must finish preparation before either can commit the same new metric.
    for (const ai of [dashboards, other.ai]) {
      const prepare = ai.prepareSave.bind(ai);
      jest.spyOn(ai, 'prepareSave').mockImplementation(async (...args) => {
        const result = await prepare(...args);
        ready += 1;
        if (ready === 2) release();
        await prepared;
        return result;
      });
    }
    const results = await Promise.allSettled([
      service.save(body, 10),
      other.service.save({ ...body, requestId: randomUUID() }, 10),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const failed: any = results.find(r => r.status === 'rejected');
    expect(failed.reason.message).toBe('PLAN_CHANGED');
    expect(await db.getRepository(Metric).count()).toBe(1);
    expect(await db.getRepository(Dashboard).count()).toBe(1);
  });
  it('requires a fresh preview after a different request creates the planned metric', async () => {
    await service.save(body, 10);
    const before = await counts();
    await expect(service.save({ ...body, requestId: randomUUID() }, 10)).rejects.toThrow(
      'PLAN_CHANGED',
    );
    expect(await counts()).toEqual(before);
    const p = await preview();
    const saved = await service.save(
      { proposal: p.proposal, previewDigest: p.previewDigest, requestId: randomUUID() },
      10,
    );
    expect(saved.id).toBeGreaterThan(1);
    expect(await db.getRepository(Metric).count()).toBe(1);
  });
  it('requires a fresh plan when another writer commits after preparation', async () => {
    second = await new DataSource({
      type: 'sqlite',
      database: path.join(dir, 'metadata.db'),
      entities,
    }).initialize();
    const other = make(second).service;
    const prepare = dashboards.prepareSave.bind(dashboards);
    jest.spyOn(dashboards, 'prepareSave').mockImplementation(async (...args) => {
      const result = await prepare(...args);
      await other.save({ ...body, requestId: randomUUID() }, 10);
      return result;
    });
    await expect(service.save(body, 10)).rejects.toThrow('PLAN_CHANGED');
    expect(await db.getRepository(Metric).count()).toBe(1);
    expect(await db.getRepository(Dashboard).count()).toBe(1);
    expect(await db.getRepository(AnalysisCreationReceipt).count()).toBe(1);
  });
  it('preserves display variants while creating one calculation identity', async () => {
    const p: any = proposal();
    p.measures.push({ key: 'precise', definition: { ...def, decimalPlaces: 2 } });
    p.blocks[1].measureKey = 'precise';
    const compiled = await preview(p);
    const saved = await service.save(
      {
        proposal: compiled.proposal,
        previewDigest: compiled.previewDigest,
        requestId: randomUUID(),
      },
      10,
    );
    expect(await db.getRepository(Metric).count()).toBe(1);
    const d = JSON.parse(
      (await db.getRepository(Dashboard).findOneBy({ id: saved.id })).analysisDefinition,
    );
    expect(d.widgets.map(w => w.decimalPlaces)).toEqual([0, 2]);
  });
  it('rejects an inactive deterministic-name collision without reactivation', async () => {
    const c = await preview();
    await db.getRepository(Metric).save({
      name: 'bi_v2_' + c.plan.measures[0].identity,
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      useYn: 'N',
    });
    const before = await counts();
    await expect(service.save(body, 10)).rejects.toThrow('METRIC_NAME_CONFLICT');
    expect(await counts()).toEqual(before);
  });
  it('detects current pointer replacement even when pinned profile is unchanged', async () => {
    const before = await counts();
    const original = dashboards.prepareSave.bind(dashboards);
    jest.spyOn(dashboards, 'prepareSave').mockImplementation(async (...args) => {
      const prepared = await original(...args);
      return {
        ...prepared,
        persist: async (...values) => {
          const result = await prepared.persist(...values);
          await db.getRepository(Database).update(1, {
            connectionConfig: JSON.stringify({
              client: 'duckdb',
              connection: { filename: '/immutable/v2.duckdb' },
            }),
          });
          return result;
        },
      };
    });
    await expect(service.save(body, 10)).rejects.toThrow('SOURCE_CHANGED');
    expect(await counts()).toEqual(before);
    expect(
      JSON.parse((await db.getRepository(Database).findOneBy({ id: 1 })).connectionConfig)
        .connection.filename,
    ).toBe('/immutable/v1.duckdb');
  });
  it.each(['metric', 'dataset', 'widget', 'dashboard', 'analysis_creation_receipt'])(
    'rolls back actual SQLite writes on %s failure',
    async table => {
      const phase = table === 'analysis_creation_receipt' ? 'UPDATE' : 'INSERT';
      await db.query(
        `CREATE TRIGGER fail_creation BEFORE ${phase} ON "${table}" BEGIN SELECT RAISE(ABORT, 'injected failure'); END`,
      );
      const before = await counts();
      await expect(service.save(body, 10)).rejects.toThrow();
      expect(await counts()).toEqual(before);
      await db.query('DROP TRIGGER fail_creation');
      await expect(service.save(body, 10)).resolves.toMatchObject({ replayed: false });
    },
  );
  it('rejects foreign owner before metric creation', async () => {
    const before = await counts();
    await expect(service.save(body, 11)).rejects.toThrow('ownership');
    expect(await counts()).toEqual(before);
  });
});

it('receipt migration is idempotent, preserves old rows and refuses destructive downgrade', async () => {
  const db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  const runner = db.createQueryRunner();
  try {
    await runner.query('CREATE TABLE dashboard (id integer primary key, title text)');
    await runner.query("INSERT INTO dashboard VALUES (1, 'original')");
    const migration = new AddAnalysisCreationReceipts1792030000000();
    await migration.up(runner);
    await migration.up(runner);
    expect(await runner.query('SELECT * FROM dashboard')).toEqual([{ id: 1, title: 'original' }]);
    await migration.down(runner);
    await migration.up(runner);
    await runner.query(
      "INSERT INTO analysis_creation_receipt(actorId,requestId,payloadDigest,dashboardId) VALUES (10,'key','digest',1)",
    );
    await expect(
      runner.query(
        "INSERT INTO analysis_creation_receipt(actorId,requestId,payloadDigest,dashboardId) VALUES (10,'key','digest',1)",
      ),
    ).rejects.toThrow();
    await expect(migration.down(runner)).rejects.toThrow('Back up');
    expect(await runner.hasTable('analysis_creation_receipt')).toBe(true);
  } finally {
    await runner.release();
    await db.destroy();
  }
});
