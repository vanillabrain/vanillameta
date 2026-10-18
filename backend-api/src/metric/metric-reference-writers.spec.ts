import { ExportJob, ExportPart } from '../bi/entities/export-job.entity';
import { ExportJobsService } from '../bi/export-jobs.service';
import { BiService } from '../bi/bi.service';
import { BiExploreService } from '../bi/bi-explore.service';
import { ConnectionService } from '../connection/connection.service';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, EntityManager } from 'typeorm';
import { MetricDeletionService } from './metric-deletion.service';
import { MetricDeleteReceipt } from './entities/metric-delete-receipt.entity';
import { Metric } from './entities/metric.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { ExploreView } from '../bi/entities/explore-view.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { ExploreViewService } from '../bi/explore-view.service';
import { DashboardPivotService } from '../bi/dashboard-pivot.service';
import { exploreViewRevision } from '../bi/explore-view-state';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { SourceAccessService } from '../ownership/source-access.service';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
describe('UC055 real reference writers versus MetricDeletionService', () => {
  const previousUploadRoot = process.env.FILE_UPLOAD_DIR;
  let db: DataSource,
    core: MetricDeletionService,
    root: string,
    worker: DuckDBService,
    file: string;
  const definition = {
    schemaVersion: 1,
    sourceId: 1,
    definitionVersion: 1,
    label: 'Amount',
    aggregation: 'SUM',
    column: 'amount',
  };
  const entities = [
    User,
    UserMapping,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    Database,
    Dashboard,
    DashboardShare,
    DashboardWidget,
    Dataset,
    TableQuery,
    Widget,
    Component,
    StudioState,
    ExploreView,
    PersonalView,
    Metric,
    MetricDeleteReceipt,
    ExportJob,
    ExportPart,
  ];
  const state = {
    version: 1,
    mode: 'pivot',
    pivot: { rowDimensions: ['device'], columnDimensions: [] },
    measureIds: [1],
    dimensionColumns: ['device'],
    rankingMeasureId: 1,
    leaderboardSort: { by: 'value', direction: 'desc' },
    filters: [],
    dateRange: null,
    relativePeriod: null,
    trendGrain: 'day',
    comparePrevious: false,
    includeRows: false,
  };
  const catalog: any = {
    sourceId: 1,
    sourceRevision: 'fixed',
    measures: [{ id: 1, definitionVersion: 1, label: 'Amount', definition }],
    dimensions: [{ column: 'device', type: 'VARCHAR' }],
    temporalColumns: [],
  };
  catalog.viewRevision = exploreViewRevision(catalog);
  const intent = async () => {
    const impact = (await core.impact(1, 7)).data;
    return {
      requestId: randomUUID(),
      expectedRevision: impact.revision,
      expectedActorId: 7,
      expectedOrganizationId: impact.organizationId,
    };
  };
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'metric-writers-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const imported = await worker.importFile({
      originalname: 'metric-writer.csv',
      buffer: Buffer.from('device,amount\nA,10\nB,20\n'),
    });
    file = imported.filename;
  });
  afterAll(async () => {
    await worker.onModuleDestroy();
    if (previousUploadRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousUploadRoot;
    fs.rmSync(root, { recursive: true, force: true });
  });
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: path.join(root, randomUUID() + '.sqlite'),
      synchronize: true,
      entities,
    }).initialize();
    core = new MetricDeletionService(db);
    await db.manager.insert(User, {
      id: 7,
      userId: 'writer',
      email: 'writer@example.invalid',
      password: 'unused',
    });
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 7,
      name: 'Synthetic',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.manager.insert(Metric, {
      id: 1,
      name: 'amount',
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
      useYn: 'Y',
    });
    await db.manager.insert(Dashboard, {
      id: 1,
      title: 'Existing',
      analysisDefinition: JSON.stringify({ databaseId: 1 }),
      layout: '[]',
    });
    await db.manager.insert(UserMapping, { userInfoId: 7, dashboardId: 1 });
    await db.manager.insert(Component, {
      type: 'BOARD_NUMERIC',
      title: 'Value',
      option: '{}',
      useYn: 'Y',
    });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await db.destroy();
  });
  function writer(kind: string, beforeSQL?: () => Promise<void>) {
    const access = new SourceAccessService(db);
    const explorer: any = {
      catalog: async () => {
        if (beforeSQL) await beforeSQL();
        return catalog;
      },
    };
    if (kind === 'personal') {
      const views = new ExploreViewService(
        db.getRepository(PersonalView),
        access,
        explorer,
        undefined,
      );
      return () => views.create(1, 7, { name: 'Saved', state, revision: catalog.viewRevision });
    }
    if (kind === 'pivot') {
      const pivot = new DashboardPivotService(
        db.getRepository(Dashboard),
        access,
        {
          load: async () => ({ data: { name: 'Saved', state, revision: catalog.viewRevision } }),
        } as any,
        explorer,
      );
      return () => pivot.add(1, 7, { sourceId: 1, viewId: 1 });
    }
    const connection: any = {
      isDuckDB: async () => true,
      withDuckDBSnapshot: async (_id, callback) => callback(),
      duckDBVersion: async () => file,
      queryDuckDB: async (_id, sql, bindings) => {
        expect(db.createQueryRunner().isTransactionActive).toBe(false);
        if (beforeSQL) await beforeSQL();
        return worker.query(file, sql, bindings);
      },
    };
    const ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard), access);
    return () =>
      ai.save(
        {
          draft: {
            databaseId: 1,
            title: 'New',
            explanation: '',
            widgets: [
              {
                title: 'Amount',
                description: '',
                type: 'BOARD_NUMERIC',
                sql: 'SELECT SUM(amount) AS value FROM source',
                valueField: 'value',
              },
            ],
          },
        },
        7,
        {
          schemaVersion: 1,
          kind: 'structured-bi',
          sourceId: 1,
          metricId: 1,
          definitionVersion: 1,
          definition,
        },
      );
  }
  it.each(['personal', 'pivot', 'dashboard'])(
    'delete commits during %s preparation, so stale reference persistence fails with zero new assets',
    async kind => {
      const body = await intent(),
        entered = deferred(),
        release = deferred();
      let once = false;
      const save = writer(kind, async () => {
        if (!once) {
          once = true;
          entered.resolve();
          await release.promise;
        }
      });
      const pending = save();
      await entered.promise;
      await core.remove(1, 7, body);
      const rejected = expect(pending).rejects.toThrow('Metric unavailable');
      release.resolve();
      await rejected;
      expect(await db.manager.count(Dashboard)).toBe(1);
      expect(await db.manager.count(PersonalView)).toBe(0);
      expect((await db.manager.findOneBy(Dashboard, { id: 1 })).pivotDefinitions).toBeNull();
      expect(await db.manager.count(Dataset)).toBe(0);
      expect(await db.manager.count(MetricDeleteReceipt)).toBe(1);
    },
  );
  it.each(['personal', 'pivot', 'dashboard'])(
    '%s writer commits first; queued deletion sees current refs and makes zero deletion writes',
    async kind => {
      const body = await intent(),
        entered = deferred(),
        release = deferred();
      let paused = false;
      const original = EntityManager.prototype.save;
      jest
        .spyOn(EntityManager.prototype, 'save')
        .mockImplementation(async function (...args: any[]) {
          if (
            !paused &&
            this.queryRunner?.isTransactionActive &&
            (args[0] === Dashboard || args[0] === PersonalView)
          ) {
            paused = true;
            entered.resolve();
            await release.promise;
          }
          return original.apply(this, args);
        });
      const pending = writer(kind)();
      await entered.promise;
      const denied = expect(core.remove(1, 7, body)).rejects.toMatchObject({ status: 409 });
      release.resolve();
      await pending;
      await denied;
      expect((await db.manager.findOneBy(Metric, { id: 1 })).useYn).toBe('Y');
      expect(await db.manager.count(MetricDeleteReceipt)).toBe(0);
      const impact = (await core.impact(1, 7)).data;
      expect(impact.canDelete).toBe(false);
      expect(
        impact.dependencies.find(
          dep => dep.kind === (kind === 'personal' ? 'exploreViews' : 'dashboardDefinitions'),
        ).count,
      ).toBe(1);
    },
  );
  it('actual export create fences refs before job/audit; failed retry after Main deletion denies before any mutation or SQL', async () => {
    await db.manager.insert(EnterpriseMembership, {
      userId: 7,
      organizationId: 1,
      role: 'admin',
      team: '',
    });
    await db.manager.update(Database, 1, {
      connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename: file } }),
    });
    const access = new SourceAccessService(db);
    const connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
    const ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard), access);
    const bi = new BiService(db, access, connection, ai);
    // Existing SourceAccess fallback only exposes owners; actual export policy is owner-authorized.
    const explore = new BiExploreService(bi, ai, connection);
    const jobs = new ExportJobsService(db, bi, explore, connection);
    const payload = {
      mode: 'explore',
      query: {
        sourceId: 1,
        sourceRevision: await connection.duckDBVersion(1),
        measureIds: [1],
        dimensionColumns: ['device'],
        rankingMeasureId: 1,
        includeRows: false,
      },
    };
    const input = { requestId: randomUUID(), payload, measureVersions: { '1': 1 } };
    const csv = jest.spyOn(explore, 'exportCsv');
    const job = await jobs.create(input, 7, 0);
    expect(csv).not.toHaveBeenCalled();
    expect(
      (await core.impact(1, 7)).data.dependencies.find(dep => dep.kind === 'exportJobs').count,
    ).toBe(1);
    await db.manager.update(ExportJob, job.id, { status: 'failed' });
    const body = await intent();
    await core.remove(1, 7, body, 0);
    const before = await db.manager.findOneBy(ExportJob, { id: job.id });
    const auditCount = await db.manager.count(EnterpriseAuditEvent);
    await expect(jobs.run(job.id, { expectedVersion: 1 }, 7, false, 0)).rejects.toMatchObject({
      status: 403,
    });
    expect(await db.manager.findOneBy(ExportJob, { id: job.id })).toEqual(before);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(auditCount);
    expect(await db.manager.count(ExportPart)).toBe(0);
    expect(csv).not.toHaveBeenCalled();
    await expect(jobs.create({ ...input, requestId: randomUUID() }, 7, 0)).rejects.toMatchObject({
      status: 403,
    });
    expect(await db.manager.count(ExportJob)).toBe(1);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(auditCount);
  });
});
