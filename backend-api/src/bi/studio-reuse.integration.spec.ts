import { MetricDeletionService, metricDeletionRevision } from '../metric/metric-deletion.service';
import { MetricDeleteReceipt } from '../metric/entities/metric-delete-receipt.entity';
import { ExploreView } from './entities/explore-view.entity';
import { ExportJob } from './entities/export-job.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { lockMetricSources } from '../metric/metric-write-lock';
import { randomUUID } from 'crypto';
import { DashboardReuseService } from './dashboard-reuse.service';
import { AnalysisCreationReceipt } from './analysis-creation-receipt.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import {
  StudioPublication,
  StudioPublicationRequest,
} from '../dashboard-studio/entities/studio-publication.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
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
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioRun } from '../dashboard-studio/entities/studio-run.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { BiService } from './bi.service';
import { BiExploreService } from './bi-explore.service';
import { BiSegmentService } from './bi-segment.service';
import { StudioPivotService } from '../dashboard-studio/studio-pivot.service';
import { StudioService } from '../dashboard-studio/studio.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { applyStudioOperation } from '../dashboard-studio/studio-operations';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
let mysqlConfig: any;
function ownedMySqlOptions() {
  const file = process.env.VM_STUDIO_REUSE_MYSQL_CONFIG;
  if (!file) return undefined;
  const stat = fs.lstatSync(file);
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (
    !stat.isFile() ||
    (stat.mode & 0o077) !== 0 ||
    c.gate !== 'owned-studio-reuse-v1' ||
    !/^[a-f0-9]{24}$/.test(c.owner) ||
    process.env.VM_STUDIO_REUSE_MYSQL_OWNER !== c.owner ||
    c.host !== '127.0.0.1' ||
    !Number.isInteger(c.port) ||
    c.port < 1024 ||
    c.port > 65535 ||
    c.database !== 'vm_studio_reuse_' + c.owner ||
    c.username !== 'root' ||
    !c.password ||
    !c.serverUuid
  )
    throw new Error('Refusing non-owned Studio reuse MySQL configuration.');
  mysqlConfig = c;
  return {
    type: 'mysql',
    host: c.host,
    port: c.port,
    username: c.username,
    password: c.password,
    database: c.database,
  };
}
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
describe(`Studio mixed source replacement on real DuckDB and ${
  process.env.VM_STUDIO_REUSE_MYSQL_CONFIG ? 'MySQL' : 'SQLite'
}`, () => {
  let db: DataSource,
    worker: DuckDBService,
    ai: AiDashboardService,
    studio: StudioService,
    root: string,
    id: number,
    connection: any,
    sourceRevision: string;
  let bi: BiService;
  const files = new Map<number, string>();
  const versions = new Map<number, string>();
  const previous = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-t4-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const file = await worker.importFile({
      originalname: 'studio.csv',
      buffer: Buffer.from(
        'category,amount,event_time,pivot_axis\nSite,300,2026-01-01T00:00:00Z,Compute\nMobile,200,2026-01-02T00:00:00Z,Compute\n',
      ),
    });
    const mysql = ownedMySqlOptions();
    db = await new DataSource({
      ...(mysql ?? { type: 'sqlite', database: ':memory:' }),
      synchronize: !mysql,
      entities: [
        AnalysisCreationReceipt,
        MetricDeleteReceipt,
        ExploreView,
        ExportJob,
        TableQuery,
        PersonalView,
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
    } as any).initialize();
    if (mysql) {
      const [identity] = await db.query(
        'SELECT VERSION() AS version, @@server_uuid AS uuid, DATABASE() AS db',
      );
      if (
        !/^8\.4\./.test(identity.version) ||
        identity.uuid !== mysqlConfig.serverUuid ||
        identity.db !== mysqlConfig.database
      )
        throw new Error('Refusing unexpected Studio reuse MySQL server.');
      const [tables] = await db.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()',
      );
      if (Number(tables.n) !== 0)
        throw new Error('Studio reuse MySQL fixture must be a fresh empty owned database.');
      await db.synchronize();
    }
    await db.manager.save(User, {
      id: 7,
      userId: 'pivot-owner',
      email: 'pivot-owner@example.test',
      password: 'test-only',
      active: true,
      authVersion: 0,
    });
    sourceRevision = createHash('sha256').update(file.filename).digest('hex');
    files.set(1, file.filename);
    versions.set(1, sourceRevision);
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
    const target = await worker.importFile({
      originalname: 'target.csv',
      buffer: Buffer.from(
        'category2,amount2,event_time2,pivot_axis2\nSite,600,2026-01-01T00:00:00Z,Compute\nMobile,400,2026-01-02T00:00:00Z,Compute\n',
      ),
    });
    files.set(2, target.filename);
    versions.set(2, createHash('sha256').update(target.filename).digest('hex'));
    await db.manager.save(Database, {
      id: 2,
      ownerId: 7,
      name: 'Target',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: target.filename },
      }),
    });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async cb => cb() })),
      duckDBVersion: jest.fn(async sourceId => versions.get(sourceId)),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((sourceId, sql, bindings) =>
        worker.query(files.get(sourceId), sql, bindings),
      ),
    };
    ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    const access = new SourceAccessService(db);
    bi = new BiService(db, access, connection, ai);
    const pivots = new StudioPivotService(
      db,
      new BiExploreService(bi, ai, connection),
      new BiSegmentService(bi, connection),
      access,
      connection,
    );
    studio = new StudioService(db, ai, connection, access, pivots);
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
  const savedPivot = async () => {
    const initial = await studio.get(id, 7);
    bi = new BiService(db, new SourceAccessService(db), connection, ai);
    const metric = await bi.createMetric(
      {
        sourceId: 1,
        label: 'Pivot revenue',
        aggregation: 'SUM',
        column: 'amount',
        unit: 'USD',
        decimalPlaces: 2,
        numberNotation: 'plain',
      },
      7,
    );
    const catalog = await new BiExploreService(bi, ai, connection).catalog({ sourceId: 1 }, 7);
    const state = {
      version: 1,
      mode: 'segment',
      segment: {
        dimensionColumn: 'category',
        pivotColumn: 'pivot_axis',
        conditions: [{ measureId: metric.id, operator: 'gte', value: 250 }],
      },
      measureIds: [metric.id],
      dimensionColumns: ['category'],
      rankingMeasureId: metric.id,
      leaderboardSort: { by: 'value', direction: 'desc' },
      filters: [],
      dateRange: null,
      relativePeriod: null,
      trendGrain: 'day',
      comparePrevious: false,
      includeRows: false,
    };
    await db.manager.save(PersonalView, {
      sourceId: 1,
      userId: 7,
      dashboardId: null,
      name: 'Qualified pivot',
      revision: catalog.viewRevision,
      state: JSON.stringify(state),
    });
    return { initial, metric };
  };
  const reuse = () =>
    new DashboardReuseService(
      db,
      bi,
      ai,
      connection,
      new SourceAccessService(db),
      undefined,
      new BiExploreService(bi, ai, connection),
    );
  const prepare = async () => {
    const { initial } = await savedPivot();
    const option = (await studio.pivotOptions(id, 7)).options.find(
      o => o.name === 'Qualified pivot',
    );
    const document = applyStudioOperation(initial.document, {
      type: 'addBlock',
      block: option.block,
    });
    const saved = await save(document, randomUUID());
    const target = await bi.profile(2, 7);
    const service = reuse();
    const request = {
      expectedRevision: saved.document.revision,
      sourceId: 2,
      sourceRevision: target.dataVersion,
      title: 'Target copy',
      columnMap: {
        category: 'category2',
        amount: 'amount2',
        event_time: 'event_time2',
        pivot_axis: 'pivot_axis2',
      },
      unitConfirmation: 'same-unit',
    };
    return { service, saved, request };
  };
  const assets = async () =>
    JSON.stringify(
      await Promise.all(
        [
          Metric,
          Dashboard,
          Widget,
          Dataset,
          DashboardWidget,
          StudioState,
          AnalysisCreationReceipt,
          PersonalView,
        ].map(e => db.manager.find(e as any)),
      ),
    );
  it('preview_writes_zero_and_save_adds_graph_once_with_final_catalog', async () => {
    const { service, saved, request } = await prepare();
    const before = await assets();
    const preview: any = await service.preview(id, request, 7, 'owned', 0);
    expect(await assets()).toBe(before);
    expect(
      Number(
        preview.studioPreview.blocks.find(b => b.kind === 'SEGMENT_PIVOT').pivot.kpis[0].value,
      ),
    ).toBe(1000);
    const metricCount = await db.manager.count(Metric),
      viewCount = await db.manager.count(PersonalView);
    const body = { ticket: preview.ticket, requestId: randomUUID() };
    const result = await service.save(id, body, 7, 'owned', 0);
    expect(result.id).not.toBe(id);
    expect(await db.manager.count(Metric)).toBe(metricCount + 1);
    expect(await db.manager.count(PersonalView)).toBe(viewCount);
    const copied = await studio.get(result.id, 7);
    expect(copied.document.sourceId).toBe(2);
    expect(copied.document.blocks).toHaveLength(3);
    expect(copied.document.blocks.every(b => !saved.document.blocks.some(o => o.id === b.id))).toBe(
      true,
    );
    const p = await studio.prepare(
      result.id,
      {
        document: copied.document,
        expectedRevision: copied.document.revision,
        expectedSourceRevision: versions.get(2),
      },
      7,
    );
    expect(
      Number(p.preview.widgets.find(w => w.type === 'SEGMENT_PIVOT').pivot.kpis[0].value),
    ).toBe(1000);
    const after = await assets();
    expect((await reuse().save(id, body, 7, 'owned', 0)).id).toBe(result.id);
    expect(await assets()).toBe(after);
    expect((await studio.get(id, 7)).document).toEqual(saved.document);
    (service as any).tickets.get(preview.ticket).expiresAt = Date.now() - 1;
    expect((await service.save(id, body, 7, 'owned', 0)).id).toBe(result.id);
    await db.manager.update(Database, 2, { catalogActive: false });
    try {
      await expect(reuse().save(id, body, 7, 'owned', 0)).rejects.toThrow();
    } finally {
      await db.manager.update(Database, 2, { catalogActive: true });
    }
  });
  it('failure_after_metric_insert_rolls_back_everything', async () => {
    const { service, request } = await prepare();
    const p: any = await service.preview(id, request, 7, 'owned', 0);
    const before = await assets();
    await db.query(
      mysqlConfig
        ? "CREATE TRIGGER fail_new_studio BEFORE INSERT ON studio_state FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced studio persistence failure'"
        : `CREATE TRIGGER fail_new_studio BEFORE INSERT ON studio_state WHEN NEW.dashboardId != ${id} BEGIN SELECT RAISE(ABORT, 'forced studio persistence failure'); END`,
    );
    try {
      await expect(
        service.save(id, { ticket: p.ticket, requestId: randomUUID() }, 7, 'owned', 0),
      ).rejects.toThrow('forced studio persistence failure');
    } finally {
      await db.query('DROP TRIGGER fail_new_studio');
    }
    expect(await assets()).toBe(before);
  });
  it('changed_target_catalog_rejects_before_insert', async () => {
    const { service, request } = await prepare();
    const p: any = await service.preview(id, request, 7, 'owned', 0);
    await bi.createMetric(
      {
        sourceId: 2,
        label: 'Other',
        aggregation: 'COUNT',
        column: '*',
        unit: '',
        decimalPlaces: 0,
        numberNotation: 'plain',
      },
      7,
    );
    const before = await assets();
    await expect(
      service.save(id, { ticket: p.ticket, requestId: randomUUID() }, 7, 'owned', 0),
    ).rejects.toThrow();
    expect(await assets()).toBe(before);
  });
  it('draft_keeps_common_filter_columns_required_for_each_retained_chart', async () => {
    const { service, saved } = await prepare();
    const doc = JSON.parse(JSON.stringify(saved.document));
    doc.filters = [{ column: 'category', values: ['Site'] }];
    await save(doc, randomUUID());
    const draft = await service.draft(id, 7, 'owned', 0);
    expect(draft.blocks.every(b => b.columns.includes('category'))).toBe(true);
  });
  it('revoked_epoch_rejects_before_insert', async () => {
    const { service, request } = await prepare();
    const p: any = await service.preview(id, request, 7, 'owned', 0);
    const before = await assets();
    await db.manager.update(User, 7, { authVersion: 1 });
    try {
      await expect(
        service.save(id, { ticket: p.ticket, requestId: randomUUID() }, 7, 'owned', 0),
      ).rejects.toThrow();
    } finally {
      await db.manager.update(User, 7, { authVersion: 0 });
    }
    expect(await assets()).toBe(before);
  });
  (process.env.VM_STUDIO_REUSE_MYSQL_CONFIG ? it : it.skip)(
    'MySQL source parent wait rechecks active state before copying',
    async () => {
      const { service, request } = await prepare();
      const p: any = await service.preview(id, request, 7, 'owned', 0);
      const before = await assets();
      const peer = await new DataSource({ ...db.options, synchronize: false } as any).initialize();
      const runner = peer.createQueryRunner();
      await runner.startTransaction();
      let saving: Promise<any>;
      try {
        await lockMetricSources(runner.manager, [2]);
        await runner.manager.update(Database, 2, { catalogActive: false });
        saving = service
          .save(id, { ticket: p.ticket, requestId: randomUUID() }, 7, 'owned', 0)
          .then(
            () => ({ saved: true }),
            error => ({ error }),
          );
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const [row] = await peer.query(
            'SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits',
          );
          if (Number(row.n) > 0) {
            waiting = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        expect(waiting).toBe(true);
        await runner.commitTransaction();
        expect((await saving).error).toBeTruthy();
        await db.manager.update(Database, 2, { catalogActive: true });
        expect(await assets()).toBe(before);
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        if (saving) await saving;
        await runner.release();
        await peer.destroy();
        await db.manager.update(Database, 2, { catalogActive: true });
      }
    },
  );
  (process.env.VM_STUDIO_REUSE_MYSQL_CONFIG ? it : it.skip)(
    'MySQL independent writers replay one receipt after the same actor lock wait',
    async () => {
      const { service, request } = await prepare();
      const preview: any = await service.preview(id, request, 7, 'owned', 0);
      const body = { ticket: preview.ticket, requestId: randomUUID() };
      const before = {
        dashboards: await db.manager.count(Dashboard),
        metrics: await db.manager.count(Metric),
        receipts: await db.manager.count(AnalysisCreationReceipt),
        views: await db.manager.count(PersonalView),
      };
      const peer = await new DataSource({ ...db.options, synchronize: false } as any).initialize();
      const peerAccess = new SourceAccessService(peer);
      const peerAi = new AiDashboardService({} as any, connection, peer.getRepository(Dashboard));
      const peerBi = new BiService(peer, peerAccess, connection, peerAi);
      const other = new DashboardReuseService(
        peer,
        peerBi,
        peerAi,
        connection,
        peerAccess,
        undefined,
        new BiExploreService(peerBi, peerAi, connection),
      );
      // Same captured server plan on two independent DataSources, not a claim of production ticket distribution.
      (other as any).tickets.set(
        body.ticket,
        structuredClone((service as any).tickets.get(body.ticket)),
      );
      const blocker = peer.createQueryRunner();
      await blocker.startTransaction();
      const pending: Promise<any>[] = [];
      try {
        await blocker.manager.findOne(User, {
          where: { id: 7 },
          lock: { mode: 'pessimistic_write' },
        });
        pending.push(
          service.save(id, body, 7, 'owned', 0).then(
            value => ({ value }),
            error => ({ error }),
          ),
        );
        pending.push(
          other.save(id, body, 7, 'owned', 0).then(
            value => ({ value }),
            error => ({ error }),
          ),
        );
        let waiting = 0;
        for (let i = 0; i < 160; i++) {
          const [row] = await peer.query(
            'SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits',
          );
          waiting = Number(row.n);
          if (waiting >= 2) break;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        expect(waiting).toBeGreaterThanOrEqual(2);
        await blocker.commitTransaction();
        const results = await Promise.all(pending);
        expect(results.map(r => r.error?.message)).toEqual([undefined, undefined]);
        expect(new Set(results.map(r => r.value.id)).size).toBe(1);
        expect(results.map(r => r.value.replayed).sort()).toEqual([false, true]);
        expect(await db.manager.count(Dashboard)).toBe(before.dashboards + 1);
        expect(await db.manager.count(Metric)).toBe(before.metrics + 1);
        expect(await db.manager.count(AnalysisCreationReceipt)).toBe(before.receipts + 1);
        expect(await db.manager.count(PersonalView)).toBe(before.views);
        expect((await studio.get(results[0].value.id, 7)).document.blocks).toHaveLength(3);
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await Promise.all(pending);
        await blocker.release();
        await peer.destroy();
      }
    },
  );

  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => {
      resolve = done;
    });
    return { promise, resolve };
  };
  const waitForGate = async (promise: Promise<void>, message: string) => {
    let timer: NodeJS.Timeout;
    try {
      await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const waitForUserFence = async (peer: DataSource) => {
    let names: string[] = [];
    for (let i = 0; i < 160; i++) {
      const rows = await peer.query(
        `SELECT l.OBJECT_NAME AS name FROM performance_schema.data_lock_waits w
         JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID
         WHERE l.OBJECT_SCHEMA=?`,
        [mysqlConfig.database],
      );
      names = rows.map(row => row.name);
      if (names.includes('user')) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    expect(names).toContain('user');
  };
  (process.env.VM_STUDIO_REUSE_MYSQL_CONFIG ? it : it.skip)(
    'MySQL metric deletion first invalidates a waiting mixed copy without partial assets',
    async () => {
      const { service, request, saved } = await prepare();
      const unused = await bi.createMetric(
        {
          sourceId: 2,
          label: 'Unused target metric',
          aggregation: 'SUM',
          column: 'amount2',
          unit: 'USD',
          decimalPlaces: 2,
          numberNotation: 'plain',
        },
        7,
      );
      const preview: any = await service.preview(id, request, 7, 'owned', 0);
      const deletion = new MetricDeletionService(db);
      const impact = (await deletion.impact(unused.id, 7)).data;
      expect(impact.canDelete).toBe(true);
      const before = JSON.parse(await assets());
      const receiptsBefore = await db.manager.count(MetricDeleteReceipt);
      const entered = deferred(),
        release = deferred();
      const original = db.createQueryRunner.bind(db);
      const spy = jest.spyOn(db, 'createQueryRunner').mockImplementation((...args) => {
        const runner = original(...args),
          update = runner.manager.update.bind(runner.manager);
        runner.manager.update = (async (entity, criteria, changes) => {
          const result = await update(entity, criteria, changes);
          if (entity === Metric && changes.useYn === 'N') {
            entered.resolve();
            await release.promise;
          }
          return result;
        }) as any;
        return runner;
      });
      const peer = await new DataSource({ ...db.options, synchronize: false } as any).initialize();
      const pending: Promise<any>[] = [];
      try {
        pending.push(
          deletion
            .remove(unused.id, 7, {
              requestId: randomUUID(),
              expectedRevision: impact.revision,
              expectedActorId: 7,
              expectedOrganizationId: null,
            })
            .then(
              value => ({ value }),
              error => ({ error }),
            ),
        );
        await waitForGate(entered.promise, 'delete gate not entered');
        pending.push(
          service.save(id, { ticket: preview.ticket, requestId: randomUUID() }, 7, 'owned', 0).then(
            value => ({ value }),
            error => ({ error }),
          ),
        );
        await waitForUserFence(peer);
        release.resolve();
        const [removed, copied] = await Promise.all(pending);
        expect(removed.error).toBeUndefined();
        expect(removed.value.data.deleted).toBe(true);
        expect(copied.value).toBeUndefined();
        expect(copied.error?.getStatus()).toBe(409);
        const after = JSON.parse(await assets());
        expect(after.slice(1)).toEqual(before.slice(1));
        expect(after[0]).toHaveLength(before[0].length);
        expect(after[0].filter(row => row.id !== unused.id)).toEqual(
          before[0].filter(row => row.id !== unused.id),
        );
        expect((await db.manager.findOneByOrFail(Metric, { id: unused.id })).useYn).toBe('N');
        expect(await db.manager.count(MetricDeleteReceipt)).toBe(receiptsBefore + 1);
        expect((await studio.get(id, 7)).document).toEqual(saved.document);
        console.info('SPR-DELETE-01', {
          waitingFence: 'user',
          deletion: 'committed',
          copyStatus: copied.error.getStatus(),
          partialCopyAssets: 0,
        });
      } finally {
        release.resolve();
        await Promise.all(pending);
        spy.mockRestore();
        await peer.destroy();
      }
    },
  );
  (process.env.VM_STUDIO_REUSE_MYSQL_CONFIG ? it : it.skip)(
    'MySQL mixed copy first protects its newly committed metric from waiting deletion',
    async () => {
      const { service, request, saved } = await prepare();
      const preview: any = await service.preview(id, request, 7, 'owned', 0);
      const receiptsBefore = await db.manager.count(MetricDeleteReceipt);
      const entered = deferred(),
        release = deferred();
      let copiedMetric: Metric;
      const original = db.createQueryRunner.bind(db);
      const spy = jest.spyOn(db, 'createQueryRunner').mockImplementation((...args) => {
        const runner = original(...args),
          commit = runner.commitTransaction.bind(runner);
        runner.commitTransaction = async () => {
          copiedMetric = await runner.manager.findOneOrFail(Metric, {
            where: { databaseId: 2, useYn: 'Y' },
            order: { id: 'DESC' },
          });
          entered.resolve();
          await release.promise;
          await commit();
        };
        return runner;
      });
      const peer = await new DataSource({ ...db.options, synchronize: false } as any).initialize();
      const deletion = new MetricDeletionService(peer),
        pending: Promise<any>[] = [];
      try {
        pending.push(
          service.save(id, { ticket: preview.ticket, requestId: randomUUID() }, 7, 'owned', 0).then(
            value => ({ value }),
            error => ({ error }),
          ),
        );
        await waitForGate(entered.promise, 'copy gate not entered');
        // Boundary request built from transaction metadata, not a public pre-commit impact response.
        // Real remove(), SQL and authorization/dependency checks remain unchanged.
        pending.push(
          deletion
            .remove(copiedMetric.id, 7, {
              requestId: randomUUID(),
              expectedRevision: metricDeletionRevision(copiedMetric),
              expectedActorId: 7,
              expectedOrganizationId: null,
            })
            .then(
              value => ({ value }),
              error => ({ error }),
            ),
        );
        await waitForUserFence(peer);
        release.resolve();
        const [copied, removed] = await Promise.all(pending);
        spy.mockRestore();
        expect(copied.error).toBeUndefined();
        expect(removed.value).toBeUndefined();
        expect(removed.error?.getStatus()).toBe(409);
        expect(removed.error?.message).toContain('사용처가 남아');
        expect((await db.manager.findOneByOrFail(Metric, { id: copiedMetric.id })).useYn).toBe('Y');
        expect(await db.manager.count(MetricDeleteReceipt)).toBe(receiptsBefore);
        const impact = (await deletion.impact(copiedMetric.id, 7)).data;
        expect(impact.canDelete).toBe(false);
        expect(impact.dependencies.find(d => d.kind === 'studioDocuments').count).toBe(1);
        expect((await studio.get(id, 7)).document).toEqual(saved.document);
        const result = await studio.get(copied.value.id, 7);
        expect(
          result.document.blocks.find(b => b.kind === 'SEGMENT_PIVOT').measureRefs.map(r => r.id),
        ).toContain(copiedMetric.id);
        const prepared = await studio.prepare(
          copied.value.id,
          {
            document: result.document,
            expectedRevision: result.document.revision,
            expectedSourceRevision: versions.get(2),
          },
          7,
        );
        expect(
          Number(
            prepared.preview.widgets.find(w => w.type === 'SEGMENT_PIVOT').pivot.kpis[0].value,
          ),
        ).toBe(1000);
        console.info('SPR-DELETE-02', {
          waitingFence: 'user',
          copy: 'committed',
          deletionStatus: removed.error.getStatus(),
          studioReferences: 1,
          pivot: 1000,
          deletionReceiptsAdded: 0,
        });
      } finally {
        release.resolve();
        await Promise.all(pending);
        spy.mockRestore();
        await peer.destroy();
      }
    },
  );
  (process.env.VM_STUDIO_REUSE_MYSQL_CONFIG ? it : it.skip)(
    'MySQL different request writers reject the stale copy and recover only after a fresh preview',
    async () => {
      const { service, request, saved } = await prepare();
      const preview: any = await service.preview(id, request, 7, 'owned', 0);
      const bodies = [0, 1].map(() => ({ ticket: preview.ticket, requestId: randomUUID() }));
      expect(bodies[0].requestId).not.toBe(bodies[1].requestId);
      const before = JSON.parse(await assets());
      const peer = await new DataSource({ ...db.options, synchronize: false } as any).initialize();
      const access = new SourceAccessService(peer);
      const peerAi = new AiDashboardService({} as any, connection, peer.getRepository(Dashboard));
      const peerBi = new BiService(peer, access, connection, peerAi);
      const other = new DashboardReuseService(
        peer,
        peerBi,
        peerAi,
        connection,
        access,
        undefined,
        new BiExploreService(peerBi, peerAi, connection),
      );
      // Two independent writers receive the same captured plan; ticket distribution is not implemented here.
      (other as any).tickets.set(
        preview.ticket,
        structuredClone((service as any).tickets.get(preview.ticket)),
      );
      const services = [service, other];
      const blocker = peer.createQueryRunner();
      const pending: Promise<any>[] = [];
      await blocker.startTransaction();
      try {
        await blocker.manager.findOne(User, {
          where: { id: 7 },
          lock: { mode: 'pessimistic_write' },
        });
        for (let i = 0; i < 2; i++) {
          pending.push(
            services[i].save(id, bodies[i], 7, 'owned', 0).then(
              value => ({ value }),
              error => ({ error }),
            ),
          );
        }
        let waits = 0;
        for (let i = 0; i < 160; i++) {
          const [row] = await peer.query(
            `SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID) AS n FROM performance_schema.data_lock_waits w
             JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID
             WHERE l.OBJECT_SCHEMA=? AND l.OBJECT_NAME='user'`,
            [mysqlConfig.database],
          );
          waits = Number(row.n);
          if (waits >= 2) break;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        expect(waits).toBeGreaterThanOrEqual(2);
        await blocker.commitTransaction();
        const outcomes = await Promise.all(pending);
        expect(outcomes.filter(o => o.value)).toHaveLength(1);
        expect(outcomes.filter(o => o.error)).toHaveLength(1);
        const winner = outcomes.findIndex(o => o.value),
          loser = 1 - winner;
        expect(outcomes[winner].value.replayed).toBe(false);
        expect(outcomes[loser].error.getStatus()).toBe(409);
        const after = JSON.parse(await assets());
        const expectedAdded = [1, 1, 2, 2, 2, 1, 1, 0];
        expect(after.map((rows, i) => rows.length - before[i].length)).toEqual(expectedAdded);
        for (let i = 0; i < before.length; i++) {
          expect(after[i].slice(0, before[i].length)).toEqual(before[i]);
        }
        const receipt = await db.manager.findOneByOrFail(AnalysisCreationReceipt, {
          actorId: 7,
          requestId: bodies[winner].requestId,
        });
        expect(receipt.dashboardId).toBe(outcomes[winner].value.id);
        expect(
          await db.manager.findOneBy(AnalysisCreationReceipt, {
            actorId: 7,
            requestId: bodies[loser].requestId,
          }),
        ).toBeNull();
        const copied = await studio.get(receipt.dashboardId, 7);
        const prepared = await studio.prepare(
          receipt.dashboardId,
          {
            document: copied.document,
            expectedRevision: copied.document.revision,
            expectedSourceRevision: versions.get(2),
          },
          7,
        );
        expect(
          Number(
            prepared.preview.widgets.find(w => w.type === 'SEGMENT_PIVOT').pivot.kpis[0].value,
          ),
        ).toBe(1000);
        // Retrying the rejected old ticket cannot silently create a second copy.
        const stable = await assets();
        await expect(services[loser].save(id, bodies[loser], 7, 'owned', 0)).rejects.toMatchObject({
          status: 409,
        });
        expect(await assets()).toBe(stable);
        // Explicit read-only re-preview is required; no automatic retry or changed-basis acceptance.
        const fresh: any = await services[loser].preview(id, request, 7, 'owned', 0);
        expect(fresh.ticket).not.toBe(preview.ticket);
        expect(await assets()).toBe(stable);
        const recovered = await services[loser].save(
          id,
          { ticket: fresh.ticket, requestId: bodies[loser].requestId },
          7,
          'owned',
          0,
        );
        expect(recovered.replayed).toBe(false);
        expect(recovered.id).not.toBe(receipt.dashboardId);
        const recoveredReceipt = await db.manager.findOneByOrFail(AnalysisCreationReceipt, {
          actorId: 7,
          requestId: bodies[loser].requestId,
        });
        expect(recoveredReceipt.dashboardId).toBe(recovered.id);
        const final = JSON.parse(await assets());
        expect(final.map((rows, i) => rows.length - before[i].length)).toEqual(
          expectedAdded.map(n => n * 2),
        );
        const second = await studio.get(recovered.id, 7);
        expect(
          second.document.blocks
            .map(b => b.id)
            .every(blockId => !copied.document.blocks.some(b => b.id === blockId)),
        ).toBe(true);
        const firstMetric = copied.document.blocks.find(b => b.kind === 'SEGMENT_PIVOT')
          .measureRefs[0].id;
        const secondMetric = second.document.blocks.find(b => b.kind === 'SEGMENT_PIVOT')
          .measureRefs[0].id;
        expect(secondMetric).not.toBe(firstMetric);
        expect((await studio.get(id, 7)).document).toEqual(saved.document);
        const secondPrepared = await studio.prepare(
          recovered.id,
          {
            document: second.document,
            expectedRevision: second.document.revision,
            expectedSourceRevision: versions.get(2),
          },
          7,
        );
        expect(
          Number(
            secondPrepared.preview.widgets.find(w => w.type === 'SEGMENT_PIVOT').pivot.kpis[0]
              .value,
          ),
        ).toBe(1000);
        console.info('SPR-REQUEST-01', {
          waitingUserTransactions: waits,
          initialSuccesses: 1,
          initialConflicts: 1,
          initialCopyReceipts: 1,
          staleRetryAdditionalAssets: 0,
          explicitPreviewWrites: 0,
          recoveredCopies: 2,
          finalReceipts: 2,
          firstPreparedPivot: 1000,
          recoveredPivot: 1000,
        });
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await Promise.all(pending);
        await blocker.release();
        await peer.destroy();
      }
    },
  );
});
