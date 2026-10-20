import { semanticMetadata } from '../../test/util/semantic-mysql';
import { EnterpriseGroupService } from './group.service';
import { EnterpriseNotificationAudience } from './entities/enterprise-notification-audience.entity';
import { EnterpriseGroupDeliveryService } from './group-delivery.service';
import { AddGroupDeliveries1792490000000 } from '../migrations/1792490000000-add-group-deliveries';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
  EnterpriseNotificationAudience,
  EnterpriseResourceGrant,
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
  EnterpriseNotificationState,
  EnterpriseDashboardDelivery,
  EnterpriseGroupDelivery,
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
    db = await semanticMetadata('staff', {
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    });
    policy = new EnterpriseResourcePolicyService(db);
    access = new SourceAccessService(db, policy);
    service = new EnterpriseDeliveryService(db, policy, access);
  });
  afterAll(async () => db?.destroy());
  beforeEach(async () => {
    for (const entity of [
      EnterpriseDeliveryReceipt,
      EnterpriseDashboardDelivery,
      EnterpriseGroupDelivery,
      EnterpriseNotificationState,
      EnterpriseAuditEvent,
      EnterpriseNotificationAudience,
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
      await db.getRepository(entity).createQueryBuilder().delete().execute();
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
  const mysql = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
  const rejectInsert = (name: string, table: string, message: string) =>
    db.query(
      db.options.type === 'mysql'
        ? `CREATE TRIGGER ${name} BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '${message}'`
        : `CREATE TRIGGER ${name} BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'${message}'); END`,
    );
  const groupRecoverySnapshot = () =>
    Promise.all(
      [
        EnterpriseGroupDelivery,
        EnterpriseDashboardDelivery,
        EnterpriseDeliveryReceipt,
        EnterpriseAuditEvent,
        EnterpriseNotificationAudience,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseResourceGrant,
        Dashboard,
        Database,
        UserMapping,
      ].map(entity =>
        db.getRepository(entity).find({
          order: Object.fromEntries(
            db.getMetadata(entity).primaryColumns.map(column => [column.propertyName, 'ASC']),
          ),
        }),
      ),
    );
  const groupShare = (
    groupId = 80,
    expectedVersion = 0,
    active = true,
    allowCopy = false,
    expectedGroupVersion = 1,
  ) => ({
    requestId: randomUUID(),
    groupId,
    expectedVersion,
    active,
    allowCopy,
    expectedGroupVersion,
  });
  async function seedGroup() {
    await db.manager.insert(EnterpriseGroup, {
      id: 80,
      organizationId: 1,
      name: 'Synthetic group',
      nameKey: 'synthetic group',
      active: true,
      version: 1,
    });
    await db.manager.insert(EnterpriseGroupMember, { groupId: 80, userId: 2 });
    return new EnterpriseGroupDeliveryService(db, policy, access);
  }
  it('dynamically delivers to current and future members, deduplicates received rows and preserves independent rights', async () => {
    const grouped = await seedGroup();
    const request = groupShare(80, 0, true, true);
    const before = await db.manager.find(Dashboard);
    await grouped.set(20, 1, request);
    expect((await service.received(2)).entries).toEqual([
      { dashboardId: 20, title: 'Synthetic analysis', version: 1, allowCopy: true },
    ]);
    expect((await service.received(3)).entries).toEqual([]);
    await db.manager.insert(EnterpriseGroupMember, { groupId: 80, userId: 3 });
    await access.dashboard(20, 3, 'read');
    expect(await policy.dashboardIds(3)).toEqual([20]);
    for (const action of ['edit', 'publish', 'export'] as const)
      await expect(access.dashboard(20, 3, action)).rejects.toMatchObject({ status: 403 });
    await service.set(20, 1, input([2]));
    expect((await service.received(2)).entries).toHaveLength(1);
    await db.manager.delete(EnterpriseGroupMember, { groupId: 80, userId: 2 });
    expect((await service.received(2)).entries[0].allowCopy).toBe(false);
    await access.dashboard(20, 2, 'read');
    await grouped.set(20, 1, groupShare(80, 1, false));
    await expect(access.dashboard(20, 3, 'read')).rejects.toMatchObject({ status: 403 });
    await expect(policy.assert('dashboard', 20, 3, 'read')).rejects.toMatchObject({ status: 403 });
    expect(await db.manager.find(Dashboard)).toEqual(before);
    expect((await grouped.set(20, 1, request)).replayed).toBe(true);
    await expect(access.dashboard(20, 3, 'read')).rejects.toMatchObject({ status: 403 });
    expect(
      (await new EnterpriseNotificationService(db).list(3)).entries.filter(e => e.viaGroup),
    ).toEqual([expect.objectContaining({ eventType: 'unshared', viaGroup: true })]);
  });
  it('snapshots group audiences and emits explicit joins/leaves without granting historical access', async () => {
    const grouped = await seedGroup(),
      groups = new EnterpriseGroupService(db),
      inbox = new EnterpriseNotificationService(db);
    const request = groupShare(80, 0, true, true);
    await grouped.set(20, 1, request);
    const shared = (await inbox.list(2)).entries.find(e => e.viaGroup);
    expect(shared).toMatchObject({ eventType: 'shared', viaGroup: true });
    expect((await inbox.list(3)).entries.some(e => e.viaGroup)).toBe(false);
    await inbox.mark(2, shared.id, 'remove');
    const change = (
      expectedVersion: number,
      memberIds: number[],
      active = true,
      name = 'Synthetic group',
    ) => groups.set(80, 1, { expectedVersion, name, active, memberIds });
    await change(1, [2, 3]);
    const joined = (await inbox.list(3)).entries.filter(e => e.viaGroup);
    expect(joined).toHaveLength(1);
    expect(joined[0].eventType).toBe('shared');
    expect(joined[0].id).not.toBe(shared.id);
    const count = await db.manager.count(EnterpriseNotificationAudience);
    await change(2, [2, 3], true, 'Renamed group');
    expect(await db.manager.count(EnterpriseNotificationAudience)).toBe(count);
    await change(3, [3]);
    const left = (await inbox.list(2)).entries.filter(e => e.viaGroup);
    expect(left).toHaveLength(1);
    expect(left[0].eventType).toBe('unshared');
    await inbox.mark(2, left[0].id, 'read');
    await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
    await change(4, [3], false);
    expect((await inbox.list(3)).entries[0]).toMatchObject({
      viaGroup: true,
      eventType: 'unshared',
    });
    await change(5, [3], true);
    expect((await inbox.list(3)).entries[0]).toMatchObject({ viaGroup: true, eventType: 'shared' });
    const audits = await db.manager.count(EnterpriseAuditEvent),
      audience = await db.manager.count(EnterpriseNotificationAudience);
    await grouped.set(20, 1, request);
    await expect(change(5, [2, 3])).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(audits);
    expect(await db.manager.count(EnterpriseNotificationAudience)).toBe(audience);
    const failure = jest.spyOn(db.manager, 'createQueryBuilder').mockImplementationOnce(() => {
      throw new Error('projection failure');
    });
    try {
      await expect(inbox.list(3)).rejects.toThrow('projection failure');
    } finally {
      failure.mockRestore();
    }
    await access.dashboard(20, 3, 'read');
    expect((await service.received(3)).entries).toHaveLength(1);
    await db.manager.update(EnterpriseMembership, { userId: 3 }, { organizationId: 2 });
    expect((await inbox.list(3)).entries).toEqual([]);
    await expect(inbox.mark(3, joined[0].id, 'read')).rejects.toMatchObject({ status: 403 });
  });
  it('rolls back the entire group mutation if immutable audience recording fails', async () => {
    const grouped = await seedGroup(),
      request = groupShare();
    await rejectInsert('reject_audience', 'enterprise_notification_audience', 'audience failure');
    try {
      await expect(grouped.set(20, 1, request)).rejects.toThrow('audience failure');
    } finally {
      await db.query('DROP TRIGGER reject_audience');
    }
    expect(await db.manager.count(EnterpriseGroupDelivery)).toBe(0);
    expect(await db.manager.count(EnterpriseDeliveryReceipt)).toBe(0);
    expect(
      await db.manager.count(EnterpriseAuditEvent, { where: { action: 'dashboard.group-shared' } }),
    ).toBe(0);
    await grouped.set(20, 1, request);
    const count = await db.manager.count(EnterpriseAuditEvent);
    await rejectInsert('reject_audience', 'enterprise_notification_audience', 'audience failure');
    try {
      await expect(
        new EnterpriseGroupService(db).set(80, 1, {
          expectedVersion: 1,
          name: 'Synthetic group',
          active: true,
          memberIds: [2, 3],
        }),
      ).rejects.toThrow('audience failure');
    } finally {
      await db.query('DROP TRIGGER reject_audience');
    }
    expect((await db.manager.findOneBy(EnterpriseGroup, { id: 80 })).version).toBe(1);
    expect(await db.manager.find(EnterpriseGroupMember)).toEqual([{ groupId: 80, userId: 2 }]);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(count);
  });
  it('keeps group sharing independent of source read, current owner/org/active and rolls back stale writes', async () => {
    const grouped = await seedGroup();
    await policy.set('source', 10, 1, {
      recipientId: 2,
      expectedVersion: 1,
      rights: rights(false),
    });
    await grouped.set(20, 1, groupShare());
    expect((await service.received(2)).entries).toEqual([]);
    await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
    await policy.set('source', 10, 1, { recipientId: 2, expectedVersion: 2, rights: rights(true) });
    await access.dashboard(20, 2, 'read');
    const auditCount = await db.manager.count(EnterpriseAuditEvent);
    await expect(grouped.set(20, 1, groupShare(80, 1, false, false, 2))).rejects.toMatchObject({
      status: 409,
    });
    await expect(grouped.set(20, 1, groupShare(80, 0, false))).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(auditCount);
    await db.manager.update(EnterpriseGroup, { id: 80 }, { active: false });
    expect(await policy.dashboardIds(2)).toEqual([]);
    await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
    await grouped.set(20, 1, groupShare(80, 1, false));
    await expect(grouped.set(20, 1, groupShare(80, 2))).rejects.toMatchObject({ status: 403 });
    await db.manager.update(EnterpriseGroup, { id: 80 }, { active: true });
    await grouped.set(20, 1, groupShare(80, 2));
    for (const [entity, where, patch, restore] of [
      [User, { id: 2 }, { active: false }, { active: true }],
      [EnterpriseMembership, { userId: 2 }, { organizationId: 2 }, { organizationId: 1 }],
      [User, { id: 1 }, { active: false }, { active: true }],
      [EnterpriseMembership, { userId: 1 }, { organizationId: 2 }, { organizationId: 1 }],
    ] as any[]) {
      await db.manager.update(entity, where, patch);
      await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
      await db.manager.update(entity, where, restore);
    }
    await db.manager.update(UserMapping, { dashboardId: 20 }, { userInfoId: 3 });
    await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
  });
  it('binds receipt to group domain and rolls back relation/audit on receipt failure', async () => {
    const grouped = await seedGroup(),
      body = groupShare();
    await rejectInsert('reject_group_receipt', 'enterprise_delivery_receipt', 'receipt failure');
    try {
      await expect(grouped.set(20, 1, body)).rejects.toThrow('receipt failure');
    } finally {
      await db.query('DROP TRIGGER reject_group_receipt');
    }
    expect(await db.manager.count(EnterpriseGroupDelivery)).toBe(0);
    expect(
      await db.manager.count(EnterpriseAuditEvent, { where: { action: 'dashboard.group-shared' } }),
    ).toBe(0);
    await grouped.set(20, 1, body);
    await expect(grouped.set(20, 1, { ...body, allowCopy: true })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      service.set(20, 1, { ...input(), requestId: body.requestId }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(grouped.set(20, 2, groupShare())).rejects.toMatchObject({ status: 403 });
    await db.manager.update(EnterpriseGroup, { id: 80 }, { organizationId: 2 });
    await expect(grouped.set(20, 1, groupShare(80, 1, false))).rejects.toMatchObject({
      status: 403,
    });
    expect((await service.received(2)).entries).toEqual([]);
  });
  it('paginates unique group dashboard candidates even when hidden sources and overlapping groups fill a page', async () => {
    await seedGroup();
    await db.manager.insert(EnterpriseGroup, {
      id: 81,
      organizationId: 1,
      name: 'Overlap',
      nameKey: 'overlap',
      active: true,
      version: 1,
    });
    await db.manager.insert(EnterpriseGroupMember, { groupId: 81, userId: 2 });
    await db.manager.save(Database, {
      id: 11,
      ownerId: 1,
      name: 'Other source',
      engine: 'duckdb',
      type: 'duckdb',
      connectionConfig: '{}',
    });
    for (let dashboardId = 30; dashboardId < 52; dashboardId++) {
      await db.manager.save(Dashboard, {
        id: dashboardId,
        title: 'Group analysis ' + dashboardId,
        analysisDefinition: JSON.stringify({ databaseId: dashboardId < 50 ? 11 : 10 }),
        delYn: 'N',
      });
      await db.manager.save(UserMapping, { dashboardId, userInfoId: 1 });
      for (const groupId of [80, 81])
        await db.manager.insert(EnterpriseGroupDelivery, {
          ownerId: 1,
          organizationId: 1,
          dashboardId,
          groupId,
          active: true,
          allowCopy: groupId === 81,
          version: 1,
        });
    }
    const first = await service.received(2);
    expect(first).toEqual({ entries: [], nextAfterId: 49 });
    const next = await service.received(2, first.nextAfterId);
    expect(next.nextAfterId).toBeNull();
    expect(next.entries.map(row => row.dashboardId)).toEqual([50, 51]);
    expect(next.entries.every(row => row.allowCopy)).toBe(true);
  });
  it('creates additive group delivery schema repeatedly without changing direct delivery', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddGroupDeliveries1792490000000();
    await runner.dropTable('enterprise_group_delivery');
    await migration.up(runner);
    await migration.up(runner);
    const table = await runner.getTable('enterprise_group_delivery');
    expect(table.primaryColumns.map(c => c.name)).toEqual([
      'ownerId',
      'organizationId',
      'dashboardId',
      'groupId',
    ]);
    expect(table.findColumnByName('allowCopy').default).toBe('false');
    await expect(migration.down()).rejects.toThrow('backup');
    await runner.release();
  });
  it('replays the exact group receipt after revoke and group version change without reactivation', async () => {
    const grouped = await seedGroup();
    const body = groupShare(80, 0, true, true);
    const initial = await grouped.set(20, 1, body);
    const shared = await groupRecoverySnapshot();
    expect(await grouped.set(20, 1, body)).toEqual({ ...initial, replayed: true });
    expect(await groupRecoverySnapshot()).toEqual(shared);
    await expect(grouped.set(20, 1, { ...body, allowCopy: false })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      service.set(20, 1, { ...input(), requestId: body.requestId }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await groupRecoverySnapshot()).toEqual(shared);
    await grouped.set(20, 1, groupShare(80, 1, false));
    await db.manager.update(EnterpriseGroup, { id: 80 }, { version: 2 });
    const revoked = await groupRecoverySnapshot();
    // Existing receipts are historical: changed group CAS applies only to undelivered requests.
    expect(await grouped.set(20, 1, body)).toEqual({ ...initial, replayed: true });
    await expect(grouped.set(20, 1, groupShare(80, 2, true, true, 1))).rejects.toMatchObject({
      status: 409,
    });
    expect(await groupRecoverySnapshot()).toEqual(revoked);
    expect((await grouped.list(20, 1)).entries).toEqual([
      { groupId: 80, version: 2, active: false, allowCopy: false },
    ]);
    await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
  });
  mysql.each(['fresh request', 'historical receipt replay'])(
    'rejects a group guard-passed old-epoch %s after User wait before write or receipt replay',
    async scenario => {
      const grouped = await seedGroup();
      const body = groupShare(80, 0, true, true);
      if (scenario === 'historical receipt replay') {
        await grouped.set(20, 1, body);
        await grouped.set(20, 1, groupShare(80, 1, false));
        await db.manager.update(EnterpriseGroup, { id: 80 }, { version: 2 });
      }
      const before = await groupRecoverySnapshot();
      const previous = process.env.ACCESS_SECRET;
      process.env.ACCESS_SECRET = 'synthetic-group-delivery-epoch';
      const jwt = new JwtService();
      const request = (epoch: number): any => ({
        headers: {
          authorization: `Bearer ${jwt.sign(
            { accessKeyData: { id: 1, userId: 'synthetic-1', authVersion: epoch } },
            { secret: process.env.ACCESS_SECRET },
          )}`,
        },
      });
      const guard = new JwtAuthGuard(jwt, db);
      const req = request(0);
      const fence = db.createQueryRunner();
      await fence.connect();
      let posting: Promise<any>;
      try {
        expect(
          await guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any),
        ).toBe(true);
        await fence.startTransaction('READ COMMITTED');
        await fence.manager.findOne(User, {
          where: { id: 1 },
          lock: { mode: 'pessimistic_write' },
        });
        await fence.manager.update(User, 1, { authVersion: 1 });
        posting = grouped.set(20, 1, body, 0).then(
          value => ({ value }),
          error => ({ error }),
        );
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const [row] = await db.query(
            'SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits',
          );
          if (Number(row.n) > 0) {
            waiting = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
        await fence.commitTransaction();
        expect((await posting).error).toMatchObject({ status: 403 });
        expect(await groupRecoverySnapshot()).toEqual(before);
        if (scenario === 'fresh request') {
          expect(await db.manager.count(EnterpriseGroupDelivery)).toBe(0);
          expect(await db.manager.count(EnterpriseDeliveryReceipt)).toBe(0);
        } else
          expect((await grouped.list(20, 1)).entries).toEqual([
            { groupId: 80, version: 2, active: false, allowCopy: false },
          ]);
        const current = request(1);
        expect(
          await guard.canActivate({ switchToHttp: () => ({ getRequest: () => current }) } as any),
        ).toBe(true);
        const controller = new EnterpriseDeliveryController(service, grouped);
        expect((await controller.groupSet(current, '20', body)).replayed).toBe(
          scenario === 'historical receipt replay',
        );
        if (scenario === 'historical receipt replay')
          expect(await groupRecoverySnapshot()).toEqual(before);
      } finally {
        if (fence.isTransactionActive) await fence.rollbackTransaction();
        await posting;
        await fence.release();
        if (previous === undefined) delete process.env.ACCESS_SECRET;
        else process.env.ACCESS_SECRET = previous;
      }
    },
  );
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
  mysql.each(['fresh request', 'historical receipt replay'])(
    'rejects a guard-passed old-epoch %s after the User wait without delivery/audit/receipt writes',
    async scenario => {
      const body = input();
      if (scenario === 'historical receipt replay') {
        await service.set(20, 1, body);
        await service.set(20, 1, input([2], false, 1));
      }
      const snapshot = () =>
        Promise.all(
          [
            EnterpriseDashboardDelivery,
            EnterpriseAuditEvent,
            EnterpriseDeliveryReceipt,
            EnterpriseNotificationAudience,
            Dashboard,
            UserMapping,
            EnterpriseResourceGrant,
          ].map(entity => {
            const order = Object.fromEntries(
              db.getMetadata(entity).primaryColumns.map(column => [column.propertyName, 'ASC']),
            );
            return db.getRepository(entity).find({ order });
          }),
        );
      const before = await snapshot();
      const priorSecret = process.env.ACCESS_SECRET;
      process.env.ACCESS_SECRET = 'synthetic-delivery-recovery-epoch';
      const jwt = new JwtService();
      const token = jwt.sign(
        { accessKeyData: { id: 1, userId: 'synthetic-1', authVersion: 0 } },
        { secret: process.env.ACCESS_SECRET },
      );
      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const fence = db.createQueryRunner();
      await fence.connect();
      let posting: Promise<any>;
      try {
        expect(
          await new JwtAuthGuard(jwt, db).canActivate({
            switchToHttp: () => ({ getRequest: () => req }),
          } as any),
        ).toBe(true);
        await fence.startTransaction('READ COMMITTED');
        await fence.manager.findOne(User, {
          where: { id: 1 },
          lock: { mode: 'pessimistic_write' },
        });
        await fence.manager.update(User, 1, { authVersion: 1 });
        const controller = new EnterpriseDeliveryController(service, {} as any);
        posting = service.set(20, 1, body, 0).then(
          value => ({ value }),
          error => ({ error }),
        );
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const [row] = await db.query(
            'SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits',
          );
          if (Number(row.n) > 0) {
            waiting = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
        await fence.commitTransaction();
        expect((await posting).error).toMatchObject({ status: 403 });
        expect(await snapshot()).toEqual(before);
        if (scenario === 'fresh request') {
          expect(await db.manager.count(EnterpriseDashboardDelivery)).toBe(0);
          expect(await db.manager.count(EnterpriseDeliveryReceipt)).toBe(0);
        } else {
          expect((await service.list(20, 1)).entries).toEqual([
            { recipientId: 2, version: 2, active: false, allowCopy: false },
          ]);
        }
        // A fresh current JWT must reach the service as epoch 1, rather than default to 0.
        const currentToken = jwt.sign(
          { accessKeyData: { id: 1, userId: 'synthetic-1', authVersion: 1 } },
          { secret: process.env.ACCESS_SECRET },
        );
        const currentReq: any = { headers: { authorization: `Bearer ${currentToken}` } };
        expect(
          await new JwtAuthGuard(jwt, db).canActivate({
            switchToHttp: () => ({ getRequest: () => currentReq }),
          } as any),
        ).toBe(true);
        expect((await controller.set(currentReq, '20', body)).replayed).toBe(
          scenario === 'historical receipt replay',
        );
        if (scenario === 'historical receipt replay') expect(await snapshot()).toEqual(before);
      } finally {
        if (fence.isTransactionActive) await fence.rollbackTransaction();
        await posting;
        await fence.release();
        if (priorSecret === undefined) delete process.env.ACCESS_SECRET;
        else process.env.ACCESS_SECRET = priorSecret;
      }
    },
  );
  it('coalesces concurrent identical requests and refuses a receipt from the owner previous organization', async () => {
    const body = input([2, 3]);
    const results = await Promise.all([service.set(20, 1, body), service.set(20, 1, body)]);
    // Independent MySQL connections may acquire the User fence in either order.
    expect(results.filter(result => !result.replayed)).toHaveLength(1);
    expect(results.filter(result => result.replayed)).toHaveLength(1);
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
        EnterpriseGroupDeliveryService,
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
      await seedGroup();
      await request(app.getHttpServer())
        .post('/enterprise/deliveries/dashboard/20/groups')
        .send(groupShare())
        .expect(401);
      await request(app.getHttpServer())
        .post('/enterprise/deliveries/dashboard/20/groups')
        .set('Authorization', `Bearer ${token(2)}`)
        .send(groupShare())
        .expect(403);
      await request(app.getHttpServer())
        .post('/enterprise/deliveries/dashboard/20/groups')
        .set('Authorization', `Bearer ${token(1)}`)
        .send(groupShare(80, 0, true, true))
        .expect(201);
      await db.manager.insert(EnterpriseGroupMember, { groupId: 80, userId: 3 });
      const sameToken = token(3);
      const beforeGroupRemoval = await request(app.getHttpServer())
        .get('/enterprise/deliveries/dashboard/received')
        .set('Authorization', `Bearer ${sameToken}`)
        .expect(200);
      expect(beforeGroupRemoval.body.entries[0].allowCopy).toBe(true);
      await db.manager.delete(EnterpriseGroupMember, { groupId: 80, userId: 3 });
      const afterGroupRemoval = await request(app.getHttpServer())
        .get('/enterprise/deliveries/dashboard/received')
        .set('Authorization', `Bearer ${sameToken}`)
        .expect(200);
      expect(afterGroupRemoval.body.entries).toEqual([]);
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
