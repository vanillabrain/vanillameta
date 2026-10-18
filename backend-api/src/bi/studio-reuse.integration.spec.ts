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
import { StudioPublicationService } from '../dashboard-studio/studio-publication.service';
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
describe('Studio mixed source replacement on real DuckDB and SQLite', () => {
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
});
