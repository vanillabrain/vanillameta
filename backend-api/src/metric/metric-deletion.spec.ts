import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { ExploreView } from '../bi/entities/explore-view.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { Metric, MetricAggregation } from './entities/metric.entity';
import { MetricDeleteReceipt } from './entities/metric-delete-receipt.entity';
import { MetricDeletionService, METRIC_DELETE_DEPENDENCY_KINDS } from './metric-deletion.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { ConnectionService } from '../connection/connection.service';
import { MetricService } from './metric.service';
import { MetricController } from './metric.controller';
import { MetricDeletionController } from './metric-deletion.controller';
import { AddMetricDeleteReceipts1792540000000 } from '../migrations/1792540000000-add-metric-delete-receipts';

describe('UC055 current metric references and protected logical deletion', () => {
  let db: DataSource, service: MetricDeletionService, root: string;
  const entities = [
    User,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    Database,
    Dataset,
    TableQuery,
    Widget,
    Dashboard,
    DashboardWidget,
    StudioState,
    ExploreView,
    Metric,
    MetricDeleteReceipt,
    PersonalView,
    ExportJob,
  ];
  const open = () =>
    new DataSource({
      type: 'sqlite',
      database: path.join(root, 'metadata.db'),
      entities,
      synchronize: true,
    }).initialize();
  const input = async () => {
    const impact = (await service.impact(1, 1)).data;
    return {
      requestId: randomUUID(),
      expectedRevision: impact.revision,
      expectedActorId: impact.actorId,
      expectedOrganizationId: impact.organizationId,
    };
  };
  const counts = async () => [
    await db.manager.count(MetricDeleteReceipt),
    await db.manager.count(EnterpriseAuditEvent, {
      where: { action: 'metric-deletion.completed' },
    }),
  ];
  const board = async (id = 1, sourceId = 1, definition?: any) =>
    db.manager.insert(Dashboard, {
      id,
      title: 'private title never returned',
      delYn: 'N',
      layout: '[]',
      analysisDefinition: JSON.stringify({ databaseId: sourceId }),
      structuredDefinition: definition === undefined ? null : JSON.stringify(definition),
    });
  const linked = (kind = 'structured-bi-dashboard', id = 1, sourceId = 1) => ({
    schemaVersion: kind === 'structured-bi-dashboard' ? 2 : 1,
    kind,
    sourceId,
    ...(kind === 'structured-bi'
      ? { metricId: id }
      : { items: [{ metricId: id }, { metricId: id }] }),
  });
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-metric-delete-'));
    db = await open();
    service = new MetricDeletionService(db);
  });
  afterAll(async () => {
    if (db.isInitialized) await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const entity of [...entities].reverse()) await db.getRepository(entity).clear();
    await db.manager.insert(
      User,
      [1, 2, 3].map(id => ({
        id,
        userId: 'metric-delete-' + id,
        email: `metric-delete-${id}@example.invalid`,
        password: 'unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(
      EnterpriseMembership,
      [1, 2].map(userId => ({ userId, organizationId: userId, role: 'admin', team: '' })),
    );
    await db.manager.insert(
      Database,
      [1, 2].map(id => ({
        id,
        ownerId: id,
        catalogActive: true,
        name: 'synthetic source',
        engine: 'duckdb',
        type: 'file',
        connectionConfig: '{}',
      })),
    );
    await db.manager.insert(
      Metric,
      [1, 2, 3].map(id => ({
        id,
        databaseId: id === 2 ? 2 : 1,
        name: 'synthetic-metric-' + id,
        tableName: 'data',
        aggregation: MetricAggregation.SUM,
        expression: 'amount',
        definition: JSON.stringify({
          schemaVersion: 1,
          sourceId: id === 2 ? 2 : 1,
          definitionVersion: 1,
        }),
        useYn: 'Y',
      })),
    );
  });
  it('projects only fixed safe reference counts and does no writes', async () => {
    const result = await service.impact(1, 1);
    expect(Object.keys(result.data).sort()).toEqual(
      ['metricId', 'actorId', 'organizationId', 'revision', 'canDelete', 'dependencies'].sort(),
    );
    expect(result.data.dependencies).toEqual(
      METRIC_DELETE_DEPENDENCY_KINDS.map(kind => ({ kind, count: 0 })),
    );
    expect(result.data.canDelete).toBe(true);
    expect(await counts()).toEqual([0, 0]);
  });
  it.each(['structured-bi', 'metric-linked-analysis', 'structured-bi-dashboard'])(
    'blocks explicit %s references once per Dashboard',
    async kind => {
      await board(1, 1, linked(kind));
      const body = await input();
      const result = (await service.impact(1, 1)).data;
      expect(result.dependencies[0]).toEqual({ kind: 'dashboardDefinitions', count: 1 });
      expect(result.canDelete).toBe(false);
      await expect(service.remove(1, 1, body)).rejects.toMatchObject({ status: 409 });
      expect((await db.manager.findOneBy(Metric, { id: 1 })).useYn).toBe('Y');
      expect(await counts()).toEqual([0, 0]);
    },
  );
  it('blocks Studio and saved Explore references but never returns their private text', async () => {
    await board();
    await db.manager.insert(StudioState, {
      dashboardId: 1,
      legacyRevision: 'a'.repeat(64),
      document: JSON.stringify({
        document: {
          schemaVersion: 1,
          sourceId: 1,
          blocks: [{ measureRefs: [{ id: 1 }, { id: 1 }] }],
        },
        sourceRevision: 'fixed',
      }),
    });
    await db.manager.insert(ExploreView, {
      sourceId: 1,
      userId: 2,
      name: 'private recipient',
      sourceRevision: 'fixed',
      state: JSON.stringify({ measureIds: [1] }),
      measureVersions: JSON.stringify({ 1: 1 }),
    });
    const result = (await service.impact(1, 1)).data;
    expect(result.dependencies).toEqual([
      { kind: 'dashboardDefinitions', count: 0 },
      { kind: 'studioDocuments', count: 1 },
      { kind: 'exploreViews', count: 1 },
      { kind: 'exportJobs', count: 0 },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/private|measureRefs|sourceRevision|SQL|token/);
    await expect(service.remove(1, 1, await input())).rejects.toMatchObject({ status: 409 });
  });
  it('protects source PersonalView and Dashboard Pivot references without double-counting the Dashboard', async () => {
    await board(1, 1, linked());
    await db.manager.update(Dashboard, 1, {
      pivotDefinitions: JSON.stringify([{ sourceId: 1, state: { measureIds: [1] } }]),
    });
    await db.manager.insert(PersonalView, {
      sourceId: 1,
      dashboardId: null,
      userId: 2,
      name: 'private personal view',
      revision: 'x',
      state: JSON.stringify({ measureIds: [1] }),
    });
    const result = (await service.impact(1, 1)).data;
    expect(result.dependencies).toEqual([
      { kind: 'dashboardDefinitions', count: 1 },
      { kind: 'studioDocuments', count: 0 },
      { kind: 'exploreViews', count: 1 },
      { kind: 'exportJobs', count: 0 },
    ]);
    await expect(service.remove(1, 1, await input())).rejects.toMatchObject({ status: 409 });
    await db.manager.update(Dashboard, 1, { structuredDefinition: null });
    expect((await service.impact(1, 1)).data.dependencies[0].count).toBe(1);
  });
  it.each(['queued', 'running', 'ready', 'failed', 'cancelled'] as const)(
    'protects only the live dependency of a %s export job',
    async status => {
      await db.manager.insert(ExportJob, {
        ownerId: 1,
        organizationId: 1,
        sourceId: 1,
        sourceOwnerId: 1,
        requestId: randomUUID(),
        digest: 'a'.repeat(64),
        status,
        version: 1,
        expiresAt: new Date('2020-01-01'),
        requestJson: JSON.stringify({ payload: { query: { sourceId: 1, measureIds: [1] } } }),
        basisJson: JSON.stringify({ metrics: [{ id: 1, version: 1, digest: 'fixed' }] }),
      });
      const impact = (await service.impact(1, 1)).data;
      expect(impact.dependencies[3]).toEqual({
        kind: 'exportJobs',
        count: ['queued', 'running'].includes(status) ? 1 : 0,
      });
      if (['queued', 'running'].includes(status))
        await expect(service.remove(1, 1, await input())).rejects.toMatchObject({ status: 409 });
      else await service.remove(1, 1, await input());
      expect(await db.manager.count(ExportJob)).toBe(1);
    },
  );
  it('scans past the first keyset page and counts all current references', async () => {
    await db.manager.insert(
      Dashboard,
      Array.from({ length: 205 }, (_, index) => ({
        id: index + 1,
        title: 'synthetic',
        layout: '[]',
        delYn: 'N',
        analysisDefinition: JSON.stringify({ databaseId: 1 }),
      })),
    );
    await db.manager.update(Dashboard, 205, { structuredDefinition: JSON.stringify(linked()) });
    expect((await service.impact(1, 1)).data.dependencies[0].count).toBe(1);
  });
  it('preserves independent other-source metrics, definitions and orphan historical Studio state', async () => {
    await board(2, 2, linked('structured-bi-dashboard', 2, 2));
    await db.manager.insert(StudioState, {
      dashboardId: 99,
      legacyRevision: 'x',
      document: 'historical invalid text',
    });
    const before = JSON.stringify(await db.manager.find(Dashboard));
    const result = await service.remove(1, 1, await input());
    expect(result.data).toMatchObject({ metricId: 1, deleted: true, replayed: false });
    expect((await db.manager.findOneBy(Metric, { id: 1 })).useYn).toBe('N');
    expect((await db.manager.findOneBy(Metric, { id: 2 })).useYn).toBe('Y');
    expect(await db.manager.count(Metric)).toBe(3);
    expect(await db.manager.count(Database)).toBe(2);
    expect(JSON.stringify(await db.manager.find(Dashboard))).toBe(before);
    expect(await db.manager.count(StudioState)).toBe(1);
    const receipt = await db.manager.findOneByOrFail(MetricDeleteReceipt, {
      id: result.data.receiptId,
    });
    expect(
      await db.manager.findOneByOrFail(EnterpriseAuditEvent, { resourceId: receipt.id }),
    ).toMatchObject({ action: 'metric-deletion.completed', actorId: 1, organizationId: 1 });
  });
  it.each(['dashboard', 'studio', 'explore'])(
    'fails closed on same-source malformed %s reference metadata',
    async kind => {
      if (kind !== 'explore') await board();
      if (kind === 'dashboard')
        await db.manager.update(Dashboard, 1, { structuredDefinition: '{invalid' });
      if (kind === 'studio')
        await db.manager.insert(StudioState, {
          dashboardId: 1,
          legacyRevision: 'x',
          document: '{invalid',
        });
      if (kind === 'explore')
        await db.manager.insert(ExploreView, {
          sourceId: 1,
          userId: 1,
          name: 'broken',
          sourceRevision: 'x',
          state: '{}',
          measureVersions: '{}',
        });
      await expect(service.impact(1, 1)).rejects.toMatchObject({ status: 409 });
      expect(await counts()).toEqual([0, 0]);
    },
  );
  it('reads the actual Studio envelope and ignores confirmed other-source documents', async () => {
    await board(2, 2);
    await db.manager.insert(StudioState, {
      dashboardId: 2,
      legacyRevision: 'x',
      document: JSON.stringify({
        document: {
          schemaVersion: 1,
          sourceId: 2,
          blocks: [{ measureRefs: [{ id: 2, definitionVersion: '1' }] }],
        },
        sourceRevision: 'fixed',
      }),
    });
    expect((await service.impact(1, 1)).data.canDelete).toBe(true);
    await board();
    await db.manager.insert(StudioState, {
      dashboardId: 1,
      legacyRevision: 'x',
      document: JSON.stringify({
        document: {
          schemaVersion: 1,
          sourceId: 1,
          blocks: [{ measureRefs: [{ id: 1, definitionVersion: '1' }] }],
        },
        sourceRevision: 'fixed',
      }),
    });
    expect((await service.impact(1, 1)).data.dependencies[1].count).toBe(1);
  });
  it.each([null, false, []])(
    'rejects malformed structured item %j while allowing empty placeholders',
    async entry => {
      await board(1, 1, { ...linked(), items: [{}] });
      expect((await service.impact(1, 1)).data.canDelete).toBe(true);
      await db.manager.update(Dashboard, 1, {
        structuredDefinition: JSON.stringify({ ...linked(), items: [entry] }),
      });
      await expect(service.impact(1, 1)).rejects.toMatchObject({ status: 409 });
    },
  );
  it('rejects malformed entries even when source metadata is missing', async () => {
    await board();
    await db.manager.update(Dashboard, 1, {
      analysisDefinition: null,
      structuredDefinition: JSON.stringify({
        schemaVersion: 2,
        kind: 'structured-bi-dashboard',
        items: [null],
      }),
    });
    await expect(service.impact(1, 1)).rejects.toMatchObject({ status: 409 });
  });
  it('does not treat partially broken widget links as proof of a different source', async () => {
    await board(1, 2);
    await db.manager.update(Dashboard, 1, {
      analysisDefinition: null,
      structuredDefinition: '{invalid',
    });
    await db.manager.insert(Dataset, {
      id: 1,
      databaseId: 2,
      title: 'synthetic',
      query: 'SELECT 1',
    });
    await db.manager.insert(Widget, {
      id: 1,
      title: 'synthetic',
      componentId: 1,
      datasetType: 'DATASET' as any,
      datasetId: 1,
      option: '{}',
      delYn: 'N',
    });
    await db.manager.insert(DashboardWidget, [
      { dashboardId: 1, widgetId: 1 },
      { dashboardId: 1, widgetId: 99 },
    ]);
    await expect(service.impact(1, 1)).rejects.toMatchObject({ status: 409 });
  });
  it('does not block this source for a broken document explicitly bound to another source', async () => {
    await board(2, 2);
    await db.manager.update(Dashboard, 2, { structuredDefinition: '{invalid' });
    expect((await service.impact(1, 1)).data.canDelete).toBe(true);
  });
  it('rejects malformed metadata with no provable source rather than assuming no reference', async () => {
    await board();
    await db.manager.update(Dashboard, 1, {
      analysisDefinition: null,
      structuredDefinition: '{invalid',
    });
    await expect(service.impact(1, 1)).rejects.toMatchObject({ status: 409 });
  });
  it('rechecks a newly saved reference after an earlier clear impact', async () => {
    const body = await input();
    await board(1, 1, linked());
    await expect(service.remove(1, 1, body)).rejects.toMatchObject({ status: 409 });
    expect(await counts()).toEqual([0, 0]);
  });
  it.each(['expression', 'definition', 'databaseId'])(
    'rejects a changed %s basis before writes',
    async field => {
      const body = await input();
      await db.manager.update(Metric, 1, { [field]: field === 'databaseId' ? 2 : 'changed' });
      await expect(service.remove(1, 1, body)).rejects.toMatchObject({
        status: field === 'databaseId' ? 403 : 409,
      });
      expect(await counts()).toEqual([0, 0]);
    },
  );
  it.each(['foreign', 'inactive', 'epoch', 'actor', 'organization'])(
    'rejects current %s boundary',
    async kind => {
      const body = await input();
      if (kind === 'inactive') await db.manager.update(User, 1, { active: false });
      if (kind === 'epoch') await db.manager.update(User, 1, { authVersion: 1 });
      if (kind === 'actor') body.expectedActorId = 2;
      if (kind === 'organization')
        await db.manager.update(EnterpriseMembership, { userId: 1 }, { organizationId: 2 });
      await expect(service.remove(1, kind === 'foreign' ? 2 : 1, body)).rejects.toMatchObject({
        status: kind === 'inactive' ? 403 : kind === 'epoch' ? 401 : 409,
      });
      expect(await counts()).toEqual([0, 0]);
    },
  );
  it('allows owner metadata cleanup on an inactive source and a legacy no-organization account', async () => {
    await db.manager.delete(EnterpriseMembership, { userId: 1 });
    await db.manager.update(Database, 1, { catalogActive: false });
    const body = await input();
    expect(body.expectedOrganizationId).toBeNull();
    await service.remove(1, 1, body);
    expect(await counts()).toEqual([1, 0]);
  });
  it('persists receipts across SQLite close/reopen and never re-deletes a reactivated metric', async () => {
    const body = await input();
    const first = await service.remove(1, 1, body);
    await db.destroy();
    db = await open();
    service = new MetricDeletionService(db);
    await db.manager.update(Metric, 1, { useYn: 'Y' });
    expect((await service.remove(1, 1, body)).data).toMatchObject({
      receiptId: first.data.receiptId,
      replayed: true,
    });
    expect((await db.manager.findOneBy(Metric, { id: 1 })).useYn).toBe('Y');
    expect(await counts()).toEqual([1, 1]);
    await expect(
      service.remove(1, 1, { ...body, expectedRevision: 'b'.repeat(64) }),
    ).rejects.toMatchObject({ status: 409 });
    await db.manager.update(User, 1, { authVersion: 1 });
    await expect(service.remove(1, 1, body)).rejects.toMatchObject({ status: 401 });
  });
  it.each(['metric', 'metric_delete_receipt', 'enterprise_audit_event'])(
    'rolls back all writes if %s fails',
    async table => {
      const body = await input();
      await db.query(
        `CREATE TRIGGER fail_metric_delete BEFORE ${
          table === 'metric' ? 'UPDATE' : 'INSERT'
        } ON ${table} BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END`,
      );
      try {
        await expect(service.remove(1, 1, body)).rejects.toThrow();
        expect((await db.manager.findOneBy(Metric, { id: 1 })).useYn).toBe('Y');
        expect(await counts()).toEqual([0, 0]);
      } finally {
        await db.query('DROP TRIGGER fail_metric_delete');
      }
      await service.remove(1, 1, body);
      expect(await counts()).toEqual([1, 1]);
    },
  );
  it('serializes concurrent identical requests into one confirmation and audit', async () => {
    const body = await input();
    const results = await Promise.all([service.remove(1, 1, body), service.remove(1, 1, body)]);
    expect(results.map(r => r.data.replayed).sort()).toEqual([false, true]);
    expect(await counts()).toEqual([1, 1]);
  });
  it.each([undefined, {}, { requestId: 'wrong' }, { expectedActorId: 0 }])(
    'rejects incomplete review intent %j',
    async body => {
      await expect(service.remove(1, 1, body)).rejects.toMatchObject({ status: 400 });
      expect(await counts()).toEqual([0, 0]);
    },
  );
  it('adds receipt migration idempotently and retains historical request uniqueness', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddMetricDeleteReceipts1792540000000();
    try {
      await runner.dropTable('metric_delete_receipt');
      await migration.up(runner);
      await migration.up(runner);
      await service.remove(1, 1, await input());
      const receipt: Partial<MetricDeleteReceipt> = {
        ...(await db.manager.findOneByOrFail(MetricDeleteReceipt, { metricId: 1 })),
      };
      delete receipt.id;
      await expect(db.manager.insert(MetricDeleteReceipt, receipt)).rejects.toThrow();
      await expect(migration.down()).rejects.toThrow('backup');
    } finally {
      await runner.release();
    }
  });
  it('protects actual JWT HTTP impact, reviewed deletion and result replay; bare delete is denied', async () => {
    const previous = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = 'synthetic-metric-delete-http';
    const jwt = new JwtService();
    const module = await Test.createTestingModule({
      controllers: [MetricDeletionController, MetricController],
      providers: [
        { provide: MetricDeletionService, useValue: service },
        {
          provide: MetricService,
          useValue: new MetricService(db.getRepository(Metric), {} as ConnectionService),
        },
        { provide: SourceAccessService, useValue: new SourceAccessService(db) },
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    const token = (id: number) =>
      'Bearer ' +
      jwt.sign(
        { accessKeyData: { id, userId: 'metric-delete-' + id, authVersion: 0 } },
        { secret: process.env.ACCESS_SECRET },
      );
    try {
      const server = app.getHttpServer();
      await request(server).get('/metric/1/delete-impact').expect(401);
      await request(server)
        .get('/metric/1/delete-impact')
        .set('Authorization', token(2))
        .expect(403);
      // The legacy edit path must not bypass the reviewed deletion protocol.
      await db.manager.update(Metric, 1, { definition: null });
      for (const field of [
        { useYn: 'N' },
        { id: 2 },
        { createdAt: '2000-01-01' },
        { updatedAt: '2000-01-01' },
        { unknown: true },
      ]) {
        await request(server)
          .put('/metric/1')
          .set('Authorization', token(1))
          .send(field)
          .expect(400);
        await request(server)
          .post('/metric')
          .set('Authorization', token(1))
          .send({
            name: 'attempt-bypass',
            databaseId: 1,
            tableName: 'data',
            aggregation: 'SUM',
            expression: 'amount',
            ...field,
          })
          .expect(Object.prototype.hasOwnProperty.call(field, 'id') ? 403 : 400);
      }
      expect((await db.manager.findOneBy(Metric, { id: 1 })).useYn).toBe('Y');
      expect(await db.manager.count(Metric)).toBe(3);
      expect(await counts()).toEqual([0, 0]);
      const impact = await request(server)
        .get('/metric/1/delete-impact')
        .set('Authorization', token(1))
        .expect('Cache-Control', 'no-store')
        .expect(200);
      const body = {
        requestId: randomUUID(),
        expectedRevision: impact.body.data.revision,
        expectedActorId: 1,
        expectedOrganizationId: 1,
      };
      await request(server).delete('/metric/1').set('Authorization', token(1)).expect(400);
      const deleted = await request(server)
        .delete('/metric/1')
        .set('Authorization', token(1))
        .send(body)
        .expect(200);
      const replay = await request(server)
        .delete('/metric/1')
        .set('Authorization', token(1))
        .send(body)
        .expect(200);
      expect(replay.body.data).toMatchObject({
        receiptId: deleted.body.data.receiptId,
        replayed: true,
      });
      expect(await counts()).toEqual([1, 1]);
    } finally {
      await app.close();
      if (previous === undefined) delete process.env.ACCESS_SECRET;
      else process.env.ACCESS_SECRET = previous;
    }
  });
});
