jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { DashboardShare } from './entities/dashboard_share.entity';
import { DashboardPublication } from './entities/dashboard-publication.entity';
import { PersonalLibraryState } from './entities/personal-library-state.entity';
import { PersonalView } from './entities/personal-view.entity';
import { DashboardDeleteReceipt } from './entities/dashboard-delete-receipt.entity';
import { DashboardDeletionService, DELETE_DEPENDENCY_KINDS } from './dashboard-deletion.service';
import { DashboardDeletionController } from './dashboard-deletion.controller';
import { AddDashboardDeleteReceipts1792530000000 } from '../migrations/1792530000000-add-dashboard-delete-receipts';
import * as locking from './dashboard-write-lock';

const gate = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
};
describe('UC055 protected physical deletion with SQLite/policy/JWT', () => {
  let db: DataSource, service: DashboardDeletionService, root: string;
  const entities = [
    User,
    UserMapping,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    EnterpriseResourceGrant,
    EnterpriseGroup,
    EnterpriseGroupMember,
    EnterpriseGroupGrant,
    EnterpriseDashboardDelivery,
    EnterpriseGroupDelivery,
    StudioPublication,
    Database,
    Dataset,
    Widget,
    Dashboard,
    DashboardWidget,
    DashboardShare,
    DashboardPublication,
    PersonalLibraryState,
    PersonalView,
    DashboardDeleteReceipt,
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
    await db.manager.count(DashboardDeleteReceipt),
    await db.manager.count(EnterpriseAuditEvent, {
      where: { action: 'dashboard-deletion.completed' },
    }),
  ];
  const snapshot = async () =>
    JSON.stringify(await db.manager.find(Dashboard, { order: { id: 'ASC' } }));
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-delete-test-'));
    db = await open();
    service = new DashboardDeletionService(db);
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const entity of [...entities].reverse()) await db.getRepository(entity).clear();
    await db.manager.insert(
      User,
      [1, 2, 3, 4].map(id => ({
        id,
        userId: 'deletion-' + id,
        email: `deletion-${id}@example.invalid`,
        password: 'unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(
      EnterpriseMembership,
      [1, 2, 3].map(userId => ({
        userId,
        organizationId: userId === 3 ? 2 : 1,
        role: userId === 1 ? ('admin' as const) : ('member' as const),
        team: '',
      })),
    );
    await db.manager.insert(Database, {
      id: 1,
      name: 'Synthetic file',
      ownerId: 1,
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.manager.insert(Dataset, {
      id: 1,
      title: 'Synthetic dataset',
      databaseId: 1,
      query: 'SELECT 1',
    });
    await db.manager.insert(Widget, {
      id: 1,
      title: 'Synthetic widget',
      componentId: 1,
      datasetType: DatasetType.DATASET,
      datasetId: 1,
      option: '{}',
    });
    await db.manager.insert(DashboardShare, {
      id: 10,
      uuid: 'synthetic-only',
      shareYn: 'N',
      allowReuse: false,
    });
    await db.manager.insert(
      Dashboard,
      [1, 2].map(id => ({
        id,
        title: 'Synthetic artifact ' + id,
        layout: '[{"i":"1"}]',
        analysisDefinition: '{"databaseId":1}',
        structuredDefinition: '{"independent":true}',
        pivotDefinitions: '[]',
        shareId: id === 1 ? 10 : null,
        delYn: 'N',
      })),
    );
    await db.manager.insert(
      UserMapping,
      [1, 2].map(dashboardId => ({ dashboardId, userInfoId: 1 })),
    );
    await db.manager.insert(
      DashboardWidget,
      [1, 2].map(dashboardId => ({ dashboardId, widgetId: 1 })),
    );
    await db.manager.insert(PersonalLibraryState, {
      userId: 2,
      organizationId: 1,
      dashboardId: 1,
      archived: true,
      version: 1,
      updatedAt: new Date(),
    });
    await db.manager.insert(PersonalView, {
      userId: 2,
      dashboardId: 1,
      sourceId: null,
      name: 'Historical view',
      revision: 'a'.repeat(64),
      state: '{}',
    });
  });
  afterAll(async () => {
    await db?.destroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });
  const dependency = async (kind: string) => {
    const rights = { read: true, edit: false, publish: false, export: false };
    if (kind === 'directPermissions')
      await db.manager.insert(EnterpriseResourceGrant, {
        resourceKind: 'dashboard',
        resourceId: 1,
        recipientId: 2,
        ownerId: 1,
        organizationId: 1,
        version: 1,
        ...rights,
      });
    if (kind === 'groupPermissions')
      await db.manager.insert(EnterpriseGroupGrant, {
        resourceKind: 'dashboard',
        resourceId: 1,
        groupId: 8,
        ownerId: 1,
        organizationId: 1,
        version: 1,
        ...rights,
      });
    if (kind === 'directDeliveries')
      await db.manager.insert(EnterpriseDashboardDelivery, {
        ownerId: 1,
        organizationId: 1,
        dashboardId: 1,
        recipientId: 2,
        version: 1,
        active: true,
        allowCopy: true,
      });
    if (kind === 'groupDeliveries')
      await db.manager.insert(EnterpriseGroupDelivery, {
        ownerId: 1,
        organizationId: 1,
        dashboardId: 1,
        groupId: 8,
        version: 1,
        active: true,
        allowCopy: true,
      });
    if (kind === 'liveShare')
      await db.manager.update(DashboardShare, 10, {
        shareYn: 'Y',
        endDate: new Date('2020-01-01'),
      });
    if (kind === 'legacyPublications')
      await db.manager.insert(DashboardPublication, {
        dashboardId: 1,
        uuid: randomUUID(),
        publisherId: 1,
        sourceId: 1,
        version: 1,
        dashboardRevision: 'a'.repeat(64),
        snapshot: '{"private":"not in impact"}',
        publishedAt: '2020-01-01T00:00:00Z',
        expiresAt: '2020-02-01T00:00:00Z',
        active: true,
        requestId: randomUUID(),
        payloadDigest: 'b'.repeat(64),
      });
    if (kind === 'studioPublications')
      await db.manager.insert(StudioPublication, {
        token: 'private-token',
        actorId: 1,
        dashboardId: 1,
        sourceId: 1,
        version: 1,
        visibility: 'private',
        allowRemix: true,
        revokedAt: null,
        expiresAt: '2020-01-01T00:00:00Z',
        asOf: '2020-01-01',
        dataVersion: 'a'.repeat(64),
        snapshot: '{}',
      });
    if (kind === 'sharedShareRecords') await db.manager.update(Dashboard, 2, { shareId: 10 });
  };
  it.each(DELETE_DEPENDENCY_KINDS)(
    'reports configured %s and blocks deletion without a cascade',
    async kind => {
      const body = await input();
      await dependency(kind);
      const before = await snapshot();
      const impact = (await service.impact(1, 1)).data;
      expect(impact.canDelete).toBe(false);
      expect(impact.dependencies.find(item => item.kind === kind)).toEqual({ kind, count: 1 });
      expect(Object.keys(impact).sort()).toEqual(
        [
          'dashboardId',
          'actorId',
          'organizationId',
          'revision',
          'canDelete',
          'dependencies',
        ].sort(),
      );
      expect(JSON.stringify(impact)).not.toMatch(
        /private-token|SELECT|not in impact|snapshot|recipientId|groupId|shareToken/,
      );
      await expect(service.remove(1, 1, body)).rejects.toMatchObject({ status: 409 });
      expect(await snapshot()).toBe(before);
      expect(await counts()).toEqual([0, 0]);
      expect(await db.manager.count(DashboardWidget)).toBe(2);
    },
  );
  it('deletes only the owned root/links/inactive unique share and keeps independent assets and history', async () => {
    const beforeCopy = JSON.stringify(await db.manager.findOneBy(Dashboard, { id: 2 }));
    const body = await input();
    expect((await service.impact(1, 1)).data.canDelete).toBe(true);
    const result = await service.remove(1, 1, body);
    expect(result.data).toMatchObject({
      dashboardId: 1,
      requestId: body.requestId,
      deleted: true,
      replayed: false,
    });
    expect(await db.manager.findOneBy(Dashboard, { id: 1 })).toBeNull();
    expect(await db.manager.count(UserMapping, { where: { dashboardId: 1 } })).toBe(0);
    expect(await db.manager.count(DashboardWidget, { where: { dashboardId: 1 } })).toBe(0);
    expect(await db.manager.findOneBy(DashboardShare, { id: 10 })).toBeNull();
    expect(JSON.stringify(await db.manager.findOneBy(Dashboard, { id: 2 }))).toBe(beforeCopy);
    for (const entity of [Widget, Dataset, Database, PersonalView, PersonalLibraryState])
      expect(await db.manager.count(entity)).toBe(1);
    expect(await counts()).toEqual([1, 1]);
    const audit = await db.manager.findOneByOrFail(EnterpriseAuditEvent, {
      action: 'dashboard-deletion.completed',
    });
    expect(audit).toMatchObject({ actorId: 1, resourceId: result.data.receiptId, version: 1 });
    expect((await service.remove(1, 1, body)).data).toMatchObject({
      receiptId: result.data.receiptId,
      replayed: true,
    });
    expect(await counts()).toEqual([1, 1]);
  });
  it('uses the durable receipt after closing and reopening the actual SQLite database', async () => {
    const body = await input(),
      first = await service.remove(1, 1, body);
    await db.destroy();
    db = await open();
    service = new DashboardDeletionService(db);
    expect((await service.remove(1, 1, body)).data).toMatchObject({
      receiptId: first.data.receiptId,
      replayed: true,
    });
    expect(await counts()).toEqual([1, 1]);
  });
  it.each(['title', 'pivotDefinitions', 'structuredDefinition'])(
    'rejects changed %s after impact',
    async field => {
      const body = await input();
      await db.manager.update(Dashboard, 1, { [field]: 'changed' });
      await expect(service.remove(1, 1, body)).rejects.toMatchObject({ status: 409 });
      expect(await db.manager.count(Dashboard)).toBe(2);
      expect(await counts()).toEqual([0, 0]);
    },
  );
  it('requires the current single owner, actor/org intent and active authentication for replay too', async () => {
    const body = await input();
    await expect(service.impact(1, 2)).rejects.toMatchObject({ status: 403 });
    await expect(service.remove(1, 2, body)).rejects.toMatchObject({ status: 409 });
    await expect(
      service.remove(1, 1, { ...body, expectedOrganizationId: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await db.manager.insert(UserMapping, { dashboardId: 1, userInfoId: 2 });
    await expect(service.remove(1, 1, body)).rejects.toMatchObject({ status: 403 });
    await db.manager.delete(UserMapping, { dashboardId: 1, userInfoId: 2 });
    await service.remove(1, 1, body);
    await expect(
      service.remove(1, 1, { ...body, expectedRevision: 'f'.repeat(64) }),
    ).rejects.toMatchObject({ status: 409 });
    await db.manager.update(User, 1, { authVersion: 1 });
    await expect(service.remove(1, 1, body)).rejects.toMatchObject({ status: 401 });
    await db.manager.update(User, 1, { active: false });
    await expect(service.remove(1, 1, body, 1)).rejects.toMatchObject({ status: 403 });
  });
  it('allows owner metadata cleanup without source data access, including a legacy account', async () => {
    const body = await input();
    await db.manager.update(Database, 1, { catalogActive: false });
    await db.manager.delete(EnterpriseMembership, { userId: 1 });
    await expect(service.remove(1, 1, body)).rejects.toMatchObject({ status: 409 });
    const legacy = await input();
    expect(legacy.expectedOrganizationId).toBeNull();
    await service.remove(1, 1, legacy);
    expect(await counts()).toEqual([1, 0]);
    expect(await db.manager.count(Database)).toBe(1);
  });
  it.each([
    'DELETE ON dashboard',
    'INSERT ON dashboard_delete_receipt',
    'INSERT ON enterprise_audit_event',
  ])('rolls back all owned deletion state if storage fails at %s', async target => {
    const body = await input(),
      before = await snapshot();
    await db.query(
      `CREATE TRIGGER stop_delete BEFORE ${target} BEGIN SELECT RAISE(ABORT,'synthetic failure'); END`,
    );
    try {
      await expect(service.remove(1, 1, body)).rejects.toThrow();
    } finally {
      await db.query('DROP TRIGGER stop_delete');
    }
    expect(await snapshot()).toBe(before);
    expect(await counts()).toEqual([0, 0]);
    expect(await db.manager.count(DashboardWidget)).toBe(2);
    expect(await db.manager.count(UserMapping)).toBe(2);
    expect(await db.manager.count(DashboardShare)).toBe(1);
    expect((await service.remove(1, 1, body)).data.deleted).toBe(true);
  });
  it('serializes same-request deletion and adds exactly one receipt and audit', async () => {
    const body = await input();
    const results = await Promise.all([service.remove(1, 1, body), service.remove(1, 1, body)]);
    expect(results.map(item => item.data.replayed).sort()).toEqual([false, true]);
    expect(results[0].data.receiptId).toBe(results[1].data.receiptId);
    expect(await counts()).toEqual([1, 1]);
  });
  it.each([
    undefined,
    {},
    { requestId: randomUUID() },
    { expectedRevision: 'sql' },
    { expectedActorId: 0 },
  ])('rejects missing/malformed review body %j before deleting', async body => {
    await expect(service.remove(1, 1, body)).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(Dashboard)).toBe(2);
    expect(await counts()).toEqual([0, 0]);
  });
  it.each(['writer', 'deleter'])(
    'coordinates a real policy writer when %s wins the parent boundary',
    async first => {
      const body = await input(),
        entered = gate(),
        release = gate(),
        original = locking.lockDashboardWrite;
      let firstCall = true;
      jest.spyOn(locking, 'lockDashboardWrite').mockImplementation(async (m, id) => {
        const result = await original(m, id);
        if (firstCall) {
          firstCall = false;
          entered.resolve();
          await release.promise;
        }
        return result;
      });
      const policy = new EnterpriseResourcePolicyService(db);
      const share = () =>
        policy.set('dashboard', 1, 1, {
          recipientId: 2,
          expectedVersion: 0,
          rights: { read: true, edit: false, publish: false, export: false },
        });
      const pending = first === 'writer' ? share() : service.remove(1, 1, body);
      await entered.promise;
      const following = first === 'writer' ? service.remove(1, 1, body) : share();
      const rejected = expect(following).rejects.toMatchObject({
        status: first === 'writer' ? 409 : 403,
      });
      release.resolve();
      await pending;
      await rejected;
      expect(await db.manager.count(Dashboard, { where: { id: 1 } })).toBe(
        first === 'writer' ? 1 : 0,
      );
      expect(await db.manager.count(EnterpriseResourceGrant)).toBe(first === 'writer' ? 1 : 0);
    },
  );
  it('adds receipt schema idempotently and rejects reuse of the actor request key', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddDashboardDeleteReceipts1792530000000();
    try {
      await runner.dropTable('dashboard_delete_receipt');
      await migration.up(runner);
      await migration.up(runner);
      await service.remove(1, 1, await input());
      const saved = await db.manager.findOneByOrFail(DashboardDeleteReceipt, { dashboardId: 1 });
      const duplicate: Partial<DashboardDeleteReceipt> = { ...saved };
      delete duplicate.id;
      await expect(db.manager.insert(DashboardDeleteReceipt, duplicate)).rejects.toThrow();
      await expect(migration.down()).rejects.toThrow('backup');
    } finally {
      await runner.release();
    }
  });
  it('guards actual JWT impact/delete/replay routes and never allows a bare delete bypass', async () => {
    const previous = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = 'synthetic-delete-http';
    const jwt = new JwtService();
    const module = await Test.createTestingModule({
      controllers: [DashboardDeletionController],
      providers: [
        { provide: DashboardDeletionService, useValue: service },
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
        { accessKeyData: { id, userId: 'deletion-' + id, authVersion: 0 } },
        { secret: process.env.ACCESS_SECRET },
      );
    try {
      const server = app.getHttpServer();
      await request(server).get('/dashboard/1/delete-impact').expect(401);
      await request(server)
        .get('/dashboard/1/delete-impact')
        .set('Authorization', token(2))
        .expect(403);
      const impact = await request(server)
        .get('/dashboard/1/delete-impact')
        .set('Authorization', token(1))
        .expect('Cache-Control', 'no-store')
        .expect(200);
      const body = {
        requestId: randomUUID(),
        expectedRevision: impact.body.data.revision,
        expectedActorId: impact.body.data.actorId,
        expectedOrganizationId: impact.body.data.organizationId,
      };
      await request(server).delete('/dashboard/1').set('Authorization', token(1)).expect(400);
      await request(server)
        .delete('/dashboard/1')
        .set('Authorization', token(2))
        .send(body)
        .expect(409);
      const deleted = await request(server)
        .delete('/dashboard/1')
        .set('Authorization', token(1))
        .send(body)
        .expect('Cache-Control', 'no-store')
        .expect(200);
      const replay = await request(server)
        .delete('/dashboard/1')
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
