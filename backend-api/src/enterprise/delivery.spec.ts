import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from './entities/enterprise-group.entity';
import { AddDeliveryCopy1792470000000 } from '../migrations/1792470000000-add-delivery-copy';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseNotificationState } from './entities/enterprise-notification-state.entity';
import {
  EnterpriseDashboardDelivery,
  EnterpriseDeliveryReceipt,
} from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { EnterpriseNotificationService } from './notification.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { EnterpriseDeliveryService } from './delivery.service';
import { EnterpriseDeliveryController } from './delivery.controller';
import { AddDashboardDeliveries1792460000000 } from '../migrations/1792460000000-add-dashboard-deliveries';

const entities = [
  User,
  UserMapping,
  Database,
  Dashboard,
  DashboardWidget,
  EnterpriseMembership,
  EnterpriseAuditEvent,
  EnterpriseResourceGrant,
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
  EnterpriseNotificationState,
  EnterpriseDashboardDelivery,
  EnterpriseDeliveryReceipt,
];
const rights = (read = false, edit = false) => ({ read, edit, publish: false, export: false });
const input = (ids = [2], active = true, version = 0) => ({
  requestId: randomUUID(),
  active,
  recipients: ids.map(recipientId => ({ recipientId, expectedVersion: version })),
});
describe('Dashboard recipient delivery independent from direct grants', () => {
  let db: DataSource,
    service: EnterpriseDeliveryService,
    policy: EnterpriseResourcePolicyService,
    access: SourceAccessService;
  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    }).initialize();
    policy = new EnterpriseResourcePolicyService(db);
    access = new SourceAccessService(db, policy);
    service = new EnterpriseDeliveryService(db, policy, access);
  });
  afterAll(async () => db?.destroy());
  beforeEach(async () => {
    for (const entity of [
      EnterpriseDeliveryReceipt,
      EnterpriseDashboardDelivery,
      EnterpriseNotificationState,
      EnterpriseAuditEvent,
      EnterpriseResourceGrant,
      EnterpriseGroup,
      EnterpriseGroupMember,
      EnterpriseGroupGrant,
      DashboardWidget,
      UserMapping,
      Dashboard,
      Database,
      EnterpriseMembership,
      User,
    ])
      await db.getRepository(entity).clear();
    await db.getRepository(User).save(
      [1, 2, 3, 4].map(id => ({
        id,
        userId: `synthetic-${id}`,
        email: `synthetic-${id}@example.invalid`,
        password: 'synthetic-unused',
      })),
    );
    await db.getRepository(EnterpriseMembership).save(
      [1, 2, 3, 4].map(userId => ({
        userId,
        organizationId: userId === 4 ? 2 : 1,
        role: userId === 1 ? ('admin' as const) : ('member' as const),
        team: userId === 2 || userId === 3 ? 'Operations' : '',
      })),
    );
    await db.getRepository(Database).save({
      id: 10,
      ownerId: 1,
      name: 'Synthetic orders',
      engine: 'duckdb',
      type: 'duckdb',
      connectionConfig: '{}',
    });
    await db.getRepository(Dashboard).save({
      id: 20,
      title: 'Synthetic analysis',
      analysisDefinition: JSON.stringify({ databaseId: 10 }),
      delYn: 'N',
    });
    await db.getRepository(UserMapping).save({ dashboardId: 20, userInfoId: 1 });
    for (const recipientId of [2, 3])
      await policy.set('source', 10, 1, { recipientId, expectedVersion: 0, rights: rights(true) });
  });
  it('adds only read, appears in discovery and emits own share/revoke notifications without changing the source grant', async () => {
    const sourceBefore = await db.getRepository(EnterpriseResourceGrant).find();
    const originalBefore = await db.getRepository(Dashboard).find();
    const mappingBefore = await db.getRepository(UserMapping).find();
    const result = await service.set(20, 1, input());
    expect(result.entries).toEqual([{ recipientId: 2, version: 1, active: true }]);
    expect((await policy.capabilities('dashboard', 20, 2)).rights).toEqual(rights(true));
    await access.dashboard(20, 2, 'read');
    for (const action of ['edit', 'publish', 'export'] as const)
      await expect(policy.assert('dashboard', 20, 2, action)).rejects.toMatchObject({
        status: 403,
      });
    expect(await policy.dashboardIds(2)).toEqual([20]);
    expect(await db.getRepository(EnterpriseResourceGrant).find()).toEqual(sourceBefore);
    const inbox = new EnterpriseNotificationService(db);
    expect((await inbox.list(2)).entries[0]).toMatchObject({
      resourceKind: 'dashboard',
      eventType: 'shared',
      resourceId: 20,
    });
    await service.set(20, 1, input([2], false, 1));
    expect(await policy.dashboardIds(2)).toEqual([]);
    await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
    expect((await inbox.list(2)).entries[0]).toMatchObject({ eventType: 'unshared', version: 2 });
    expect(await db.getRepository(Dashboard).find()).toEqual(originalBefore);
    expect(await db.getRepository(UserMapping).find()).toEqual(mappingBefore);
    expect(await db.getRepository(EnterpriseResourceGrant).find()).toEqual(sourceBefore);
  });
  it('does not revoke direct read/edit and direct policy revocation does not delete an active delivery', async () => {
    await service.set(20, 1, input());
    await policy.set('dashboard', 20, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights(true, true),
    });
    await service.set(20, 1, input([2], false, 1));
    await access.dashboard(20, 2, 'edit');
    expect(await policy.dashboardIds(2)).toEqual([20]);
    await service.set(20, 1, input([2], true, 2));
    await policy.set('dashboard', 20, 1, { recipientId: 2, expectedVersion: 1, rights: rights() });
    await access.dashboard(20, 2, 'read');
    await expect(access.dashboard(20, 2, 'edit')).rejects.toMatchObject({ status: 403 });
    await policy.set('source', 10, 1, { recipientId: 2, expectedVersion: 1, rights: rights() });
    await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
  });
  it('rolls back every relation, audit and receipt if one recipient lacks source access', async () => {
    await policy.set('source', 10, 1, { recipientId: 3, expectedVersion: 1, rights: rights() });
    const before = await db.getRepository(EnterpriseAuditEvent).count();
    await expect(service.set(20, 1, input([2, 3]))).rejects.toMatchObject({ status: 403 });
    expect(await db.getRepository(EnterpriseDashboardDelivery).count()).toBe(0);
    expect(await db.getRepository(EnterpriseDeliveryReceipt).count()).toBe(0);
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(before);
  });
  it('replays an identical request after response loss and never resurrects it after later revocation', async () => {
    const body = input([3, 2]);
    const initial = await service.set(20, 1, body);
    expect(
      await service.set(20, 1, { ...body, recipients: [...body.recipients].reverse() }),
    ).toEqual({ ...initial, replayed: true });
    await service.set(20, 1, input([2, 3], false, 1));
    const before = await db.getRepository(EnterpriseAuditEvent).count();
    expect((await service.set(20, 1, body)).replayed).toBe(true);
    await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(before);
    await expect(service.set(20, 1, { ...body, active: false })).rejects.toMatchObject({
      status: 409,
    });
    await db.getRepository(User).update(1, { active: false });
    await expect(service.set(20, 1, body)).rejects.toMatchObject({ status: 403 });
  });
  it('coalesces concurrent identical requests and refuses a receipt from the owner previous organization', async () => {
    const body = input([2, 3]);
    const results = await Promise.all([service.set(20, 1, body), service.set(20, 1, body)]);
    expect(results.map(result => result.replayed)).toEqual([false, true]);
    expect(await db.getRepository(EnterpriseDeliveryReceipt).count()).toBe(1);
    expect(await db.getRepository(EnterpriseDashboardDelivery).count()).toBe(2);
    await db.getRepository(EnterpriseMembership).update(1, { organizationId: 2 });
    await expect(service.set(20, 1, body)).rejects.toMatchObject({ status: 409 });
    expect((await service.list(20, 1)).entries).toEqual([]);
  });
  it('rolls back the first recipient if a later recipient has a version conflict', async () => {
    await service.set(20, 1, input([3]));
    const before = await db.getRepository(EnterpriseAuditEvent).count();
    await expect(service.set(20, 1, input([2, 3]))).rejects.toMatchObject({ status: 409 });
    expect((await service.list(20, 1)).entries).toEqual([
      { recipientId: 3, version: 1, active: true, allowCopy: false },
    ]);
    expect(await db.getRepository(EnterpriseDeliveryReceipt).count()).toBe(1);
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(before);
  });
  it('rejects other organizations/self/non-owner/deactivated recipients but permits revoking departed recipients', async () => {
    for (const id of [1, 4])
      await expect(service.set(20, 1, input([id]))).rejects.toMatchObject({
        status: id === 1 ? 400 : 403,
      });
    await expect(service.set(20, 2, input([3]))).rejects.toMatchObject({ status: 403 });
    await expect(service.list(20, 2)).rejects.toMatchObject({ status: 403 });
    await db.getRepository(User).update(2, { active: false });
    await expect(service.set(20, 1, input())).rejects.toMatchObject({ status: 403 });
    await db.getRepository(User).update(2, { active: true });
    await service.set(20, 1, input());
    await db.getRepository(EnterpriseMembership).update(2, { organizationId: 2 });
    expect(await policy.dashboardIds(2)).toEqual([]);
    await expect(policy.assert('dashboard', 20, 2, 'read')).rejects.toMatchObject({ status: 403 });
    expect((await service.set(20, 1, input([2], false, 1))).entries[0].active).toBe(false);
    await db.getRepository(EnterpriseMembership).update(2, { organizationId: 1 });
    await service.set(20, 1, input([2], true, 2));
    await db.getRepository(User).update(2, { active: false });
    expect(await policy.dashboardIds(2)).toEqual([]);
    expect((await service.set(20, 1, input([2], false, 3))).entries[0].version).toBe(4);
  });
  it('rechecks source availability and rejects stale or ambiguous dashboard ownership bindings', async () => {
    await service.set(20, 1, input([2, 3]));
    await db.getRepository(Database).update(10, { catalogActive: false });
    await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
    expect(await access.filterResults('dashboard', 2, [{ id: 20 }], 'read')).toEqual([]);
    await db.getRepository(Database).update(10, { catalogActive: true });
    await db.getRepository(UserMapping).save({ dashboardId: 20, userInfoId: 3 });
    expect(await policy.dashboardIds(2)).toEqual([]);
    await expect(policy.assert('dashboard', 20, 2, 'read')).rejects.toMatchObject({ status: 403 });
    await db.getRepository(UserMapping).delete({ dashboardId: 20 });
    await db.getRepository(UserMapping).save({ dashboardId: 20, userInfoId: 4 });
    expect(await policy.dashboardIds(2)).toEqual([]);
    await expect(policy.assert('dashboard', 20, 2, 'read')).rejects.toMatchObject({ status: 403 });
  });
  it('no-op does not duplicate audit events and invalid bodies never write', async () => {
    const body = input();
    await service.set(20, 1, body);
    const before = await db.getRepository(EnterpriseAuditEvent).count();
    expect((await service.set(20, 1, input([2], true, 1))).entries[0].version).toBe(1);
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(before);
    for (const invalid of [
      { ...input(), extra: true },
      { ...input(), requestId: 'unsafe' },
      { ...input(), recipients: [] },
      input([2, 2]),
      { ...input(), recipients: [{ recipientId: 2, expectedVersion: -1 }] },
    ])
      await expect(service.set(20, 1, invalid)).rejects.toMatchObject({ status: 400 });
  });
  it('lists only currently readable deliveries and keeps direct grants independent on revoke', async () => {
    const dashboards = db.getRepository(Dashboard);
    const request = input();
    await service.set(20, 1, request);
    const before = {
      audits: await db.getRepository(EnterpriseAuditEvent).count(),
      receipts: await db.getRepository(EnterpriseDeliveryReceipt).count(),
      relations: await db.getRepository(EnterpriseDashboardDelivery).find(),
    };
    expect(await service.received(2)).toEqual({
      entries: [{ dashboardId: 20, title: 'Synthetic analysis', version: 1, allowCopy: false }],
      nextAfterId: null,
    });
    expect(await service.received(3)).toEqual({ entries: [], nextAfterId: null });
    await dashboards.update(20, {
      title: 'Current title',
      structuredDefinition: 'synthetic private recipe',
      layout: 'synthetic private layout',
    });
    const result = await service.received(2);
    expect(result.entries).toEqual([
      { dashboardId: 20, title: 'Current title', version: 1, allowCopy: false },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private|analysisDefinition|source|ownerId|layout|databaseId|token/,
    );
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(before.audits);
    expect(await db.getRepository(EnterpriseDeliveryReceipt).count()).toBe(before.receipts);
    expect(await db.getRepository(EnterpriseDashboardDelivery).find()).toEqual(before.relations);
    await policy.set('dashboard', 20, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights(true),
    });
    await service.set(20, 1, input([2], false, 1));
    expect((await service.received(2)).entries).toEqual([]);
    await access.dashboard(20, 2, 'read');
  });
  it('rechecks both accounts, memberships, all sources and current ownership before projecting titles', async () => {
    await service.set(20, 1, input());
    await db.getRepository(User).update(2, { active: false });
    await expect(service.received(2)).rejects.toMatchObject({ status: 403 });
    await db.getRepository(User).update(2, { active: true });
    await db.getRepository(User).update(1, { active: false });
    expect((await service.received(2)).entries).toEqual([]);
    await db.getRepository(User).update(1, { active: true });
    await db.getRepository(EnterpriseMembership).update(2, { organizationId: 2 });
    expect((await service.received(2)).entries).toEqual([]);
    await db.getRepository(EnterpriseMembership).update(2, { organizationId: 1 });
    await db.getRepository(Database).update(10, { catalogActive: false });
    expect((await service.received(2)).entries).toEqual([]);
    await db.getRepository(Database).update(10, { catalogActive: true });
    await policy.set('source', 10, 1, { recipientId: 2, expectedVersion: 1, rights: rights() });
    expect((await service.received(2)).entries).toEqual([]);
    await policy.set('source', 10, 1, { recipientId: 2, expectedVersion: 2, rights: rights(true) });
    await db.getRepository(UserMapping).save({ dashboardId: 20, userInfoId: 3 });
    expect((await service.received(2)).entries).toEqual([]);
    await db.getRepository(UserMapping).delete({ dashboardId: 20, userInfoId: 3 });
    await db.getRepository(Dashboard).update(20, { delYn: 'Y' });
    expect((await service.received(2)).entries).toEqual([]);
    await db.getRepository(EnterpriseMembership).delete(2);
    await expect(service.received(2)).rejects.toMatchObject({ status: 403 });
  });
  it('advances over a wholly hidden page without exposing titles or stalling', async () => {
    const dashboards = db.getRepository(Dashboard);
    const sources = db.getRepository(Database);
    const deliveries = db.getRepository(EnterpriseDashboardDelivery);
    await sources.save({
      id: 11,
      ownerId: 1,
      name: 'Unshared source',
      engine: 'duckdb',
      type: 'duckdb',
      connectionConfig: '{}',
    });
    for (let id = 100; id <= 120; id += 1) {
      await dashboards.save({
        id,
        title: `Dashboard ${id}`,
        analysisDefinition: JSON.stringify({ databaseId: id === 120 ? 10 : 11 }),
      });
      await db.getRepository(UserMapping).save({ dashboardId: id, userInfoId: 1 });
      await deliveries.save({
        ownerId: 1,
        organizationId: 1,
        dashboardId: id,
        recipientId: 2,
        version: 1,
        active: true,
      });
    }
    expect(await service.received(2)).toEqual({ entries: [], nextAfterId: 119 });
    expect(await service.received(2, 119)).toEqual({
      entries: [{ dashboardId: 120, title: 'Dashboard 120', version: 1, allowCopy: false }],
      nextAfterId: null,
    });
    for (const invalid of [0, -1, 1.5, '119', NaN])
      await expect(service.received(2, invalid)).rejects.toMatchObject({ status: 400 });
  });
  it('bounds legacy titles without splitting surrogate pairs and lets database failures surface', async () => {
    await service.set(20, 1, input());
    await db.getRepository(Dashboard).update(20, { title: 'a'.repeat(298) + '🚀'.repeat(40) });
    const title = (await service.received(2)).entries[0].title;
    expect(title.length).toBeLessThanOrEqual(300);
    expect(title).toBe('a'.repeat(298) + '…');
    const spy = jest
      .spyOn(access, 'dashboard')
      .mockRejectedValueOnce(new Error('synthetic unavailable'));
    await expect(service.received(2)).rejects.toThrow('synthetic unavailable');
    spy.mockRestore();
  });
  it('requires explicit copy consent, preserves omitted consent and clears it on revoke', async () => {
    await service.set(20, 1, input());
    expect((await service.list(20, 1)).entries[0].allowCopy).toBe(false);
    const body = { ...input([2], true, 1), allowCopy: true };
    expect((await service.set(20, 1, body)).entries[0]).toMatchObject({
      version: 2,
      allowCopy: true,
    });
    expect((await service.received(2)).entries[0].allowCopy).toBe(true);
    await service.set(20, 1, input([2], true, 2));
    expect((await service.list(20, 1)).entries[0]).toMatchObject({ version: 2, allowCopy: true });
    await expect(
      service.set(20, 1, { ...input([2], false, 2), allowCopy: true }),
    ).rejects.toMatchObject({ status: 400 });
    await service.set(20, 1, input([2], false, 2));
    expect((await service.list(20, 1)).entries[0]).toMatchObject({
      version: 3,
      active: false,
      allowCopy: false,
    });
    expect((await service.set(20, 1, body)).replayed).toBe(true);
    expect((await service.list(20, 1)).entries[0].allowCopy).toBe(false);
  });
  it('enforces JWT actor and validates route ids over HTTP', async () => {
    const previous = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = 'synthetic-delivery-test-secret';
    const jwt = new JwtService();
    const module = await Test.createTestingModule({
      controllers: [EnterpriseDeliveryController],
      providers: [
        EnterpriseDeliveryService,
        { provide: DataSource, useValue: db },
        { provide: EnterpriseResourcePolicyService, useValue: policy },
        { provide: SourceAccessService, useValue: access },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    const token = (id: number) =>
      jwt.sign(
        { accessKeyData: { id, userId: `synthetic-${id}`, authVersion: 0 } },
        { secret: process.env.ACCESS_SECRET },
      );
    try {
      await request(app.getHttpServer())
        .post('/enterprise/deliveries/dashboard/20')
        .send(input())
        .expect(401);
      await request(app.getHttpServer())
        .post('/enterprise/deliveries/dashboard/20')
        .set('Authorization', `Bearer ${token(2)}`)
        .send(input([3]))
        .expect(403);
      await request(app.getHttpServer())
        .post('/enterprise/deliveries/dashboard/20')
        .set('Authorization', `Bearer ${token(1)}`)
        .send(input())
        .expect(201);
      const received = await request(app.getHttpServer())
        .get('/enterprise/deliveries/dashboard/received')
        .set('Authorization', `Bearer ${token(2)}`)
        .expect(200);
      expect(received.body.entries).toEqual([
        { dashboardId: 20, title: 'Synthetic analysis', version: 1, allowCopy: false },
      ]);
      await request(app.getHttpServer())
        .get('/enterprise/deliveries/dashboard/received')
        .expect(401);
      await request(app.getHttpServer())
        .get('/enterprise/deliveries/dashboard/received?afterId=1.2')
        .set('Authorization', `Bearer ${token(2)}`)
        .expect(400);
      await request(app.getHttpServer())
        .get('/enterprise/deliveries/dashboard/received?afterId=1&afterId=2')
        .set('Authorization', `Bearer ${token(2)}`)
        .expect(400);
      const result = await request(app.getHttpServer())
        .get('/enterprise/deliveries/dashboard/20')
        .set('Authorization', `Bearer ${token(1)}`)
        .expect(200);
      expect(result.body).toEqual({
        dashboardId: 20,
        entries: [{ recipientId: 2, version: 1, active: true, allowCopy: false }],
      });
      await request(app.getHttpServer())
        .get('/enterprise/deliveries/dashboard/1.5')
        .set('Authorization', `Bearer ${token(1)}`)
        .expect(400);
    } finally {
      await app.close();
      if (previous === undefined) delete process.env.ACCESS_SECRET;
      else process.env.ACCESS_SECRET = previous;
    }
  });
  it('migrates additively twice, preserves delivery rows and enforces composite keys', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddDashboardDeliveries1792460000000();
    await runner.dropTable('enterprise_delivery_receipt');
    await runner.dropTable('enterprise_dashboard_delivery');
    await migration.up(runner);
    await runner.query(
      'INSERT INTO enterprise_dashboard_delivery (ownerId,organizationId,dashboardId,recipientId,version,active) VALUES (1,1,20,3,4,0)',
    );
    const copyMigration = new AddDeliveryCopy1792470000000();
    await copyMigration.up(runner);
    await copyMigration.up(runner);
    await service.set(20, 1, input());
    await migration.up(runner);
    expect((await service.list(20, 1)).entries).toEqual([
      { recipientId: 2, version: 1, active: true, allowCopy: false },
      { recipientId: 3, version: 4, active: false, allowCopy: false },
    ]);
    expect(await db.getRepository(EnterpriseDeliveryReceipt).count()).toBe(1);
    await expect(
      db.getRepository(EnterpriseDashboardDelivery).insert({
        ownerId: 1,
        organizationId: 1,
        dashboardId: 20,
        recipientId: 2,
        version: 99,
        active: true,
      }),
    ).rejects.toThrow();
    await expect(migration.down()).rejects.toThrow(/backup plan/);
    await runner.release();
  });
});
