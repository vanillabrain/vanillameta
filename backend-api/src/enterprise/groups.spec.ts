import { EnterpriseNotificationAudience } from './entities/enterprise-notification-audience.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
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
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseNotificationState } from './entities/enterprise-notification-state.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
  EnterpriseGroupRequest,
} from './entities/enterprise-group.entity';
import { EnterpriseGroupService } from './group.service';
import { EnterpriseGroupController } from './group.controller';
import { EnterpriseResourceController } from './resource-policy.controller';
import {
  EnterpriseResourcePolicyService,
  ResourceKind,
  ResourceRights,
} from './resource-policy.service';
import { SourceLifecycleService } from './source-lifecycle.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { EnterpriseNotificationService } from './notification.service';
import { AddEnterpriseGroups1792480000000 } from '../migrations/1792480000000-add-enterprise-groups';
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
  EnterpriseDashboardDelivery,
  EnterpriseGroupDelivery,
  EnterpriseNotificationState,
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
  EnterpriseGroupRequest,
];
const rights = (partial: Partial<ResourceRights> = {}): ResourceRights => ({
  read: false,
  edit: false,
  publish: false,
  export: false,
  ...partial,
});
describe('Dynamic organization groups and additive resource authorization', () => {
  let db: DataSource,
    groups: EnterpriseGroupService,
    policy: EnterpriseResourcePolicyService,
    access: SourceAccessService;
  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    }).initialize();
    groups = new EnterpriseGroupService(db);
    policy = new EnterpriseResourcePolicyService(db);
    access = new SourceAccessService(db, policy);
  });
  afterAll(async () => db?.destroy());
  beforeEach(async () => {
    for (const entity of [
      EnterpriseGroupRequest,
      EnterpriseGroupGrant,
      EnterpriseGroupMember,
      EnterpriseGroup,
      EnterpriseResourceGrant,
      EnterpriseDashboardDelivery,
      EnterpriseGroupDelivery,
      EnterpriseNotificationState,
      EnterpriseAuditEvent,
      EnterpriseNotificationAudience,
      DashboardWidget,
      UserMapping,
      Dashboard,
      Database,
      EnterpriseMembership,
      User,
    ])
      await db.getRepository(entity).clear();
    await db.manager.save(
      User,
      [1, 2, 3, 4, 5].map(id => ({
        id,
        userId: `group-user-${id}`,
        email: `group-${id}@example.invalid`,
        password: 'synthetic-unused',
        active: true,
      })),
    );
    await db.manager.save(
      EnterpriseMembership,
      [1, 2, 3, 4, 5].map(userId => ({
        userId,
        organizationId: userId >= 4 ? 2 : 1,
        role: userId === 1 || userId === 4 ? ('admin' as const) : ('member' as const),
        team: 'Same display team',
      })),
    );
    await db.manager.save(Database, [
      {
        id: 10,
        ownerId: 1,
        name: 'Synthetic source',
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: '{}',
      },
      {
        id: 11,
        ownerId: 4,
        name: 'Other organization source',
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: '{}',
      },
    ]);
    await db.manager.save(Dashboard, {
      id: 20,
      title: 'Original analysis',
      analysisDefinition: JSON.stringify({ databaseId: 10 }),
      delYn: 'N',
    });
    await db.manager.save(UserMapping, { dashboardId: 20, userInfoId: 1 });
  });
  const roster = async (memberIds: number[] = [], name = 'Operations') => {
    const group = await groups.create(1, { requestId: randomUUID(), name });
    return groups.set(group.id, 1, {
      expectedVersion: group.version,
      name,
      active: true,
      memberIds,
    });
  };
  const grant = (
    kind: ResourceKind,
    id: number,
    group: any,
    partial: Partial<ResourceRights>,
    expectedVersion = 0,
    actor = 1,
  ) =>
    policy.setGroupPolicy(kind, id, actor, {
      groupId: group.id,
      expectedGroupVersion: group.version,
      expectedVersion,
      rights: rights(partial),
    });
  it('uses stable group IDs, normalized unique names and strict admin/organization scope', async () => {
    const a = await groups.create(1, { requestId: randomUUID(), name: 'Ops' });
    await expect(
      groups.create(1, { requestId: randomUUID(), name: 'ＯＰＳ' }),
    ).rejects.toMatchObject({ status: 409 });
    const b = await groups.create(4, { requestId: randomUUID(), name: 'Ops' });
    expect(b.id).not.toBe(a.id);
    expect((await groups.list(1)).entries.map(row => row.id)).toEqual([a.id]);
    await expect(groups.detail(a.id, 4)).rejects.toMatchObject({ status: 403 });
    await expect(groups.list(2)).rejects.toMatchObject({ status: 403 });
    await db.manager.update(User, 1, { active: false });
    await expect(
      groups.create(1, { requestId: randomUUID(), name: 'Inactive actor' }),
    ).rejects.toMatchObject({
      status: 403,
    });
  });
  it('applies future additions/removals and activation dynamically without materializing direct grants', async () => {
    const group = await roster([]);
    await grant('source', 10, group, { read: true, edit: true });
    await expect(policy.assert('source', 10, 2, 'read')).rejects.toMatchObject({ status: 403 });
    const added = await groups.set(group.id, 1, {
      expectedVersion: group.version,
      name: 'Renamed group',
      active: true,
      memberIds: [2],
    });
    expect((await policy.capabilities('source', 10, 2)).rights).toEqual(
      rights({ read: true, edit: true }),
    );
    expect(await policy.sourceIds(2)).toEqual([10]);
    expect(await db.manager.count(EnterpriseResourceGrant)).toBe(0);
    const removed = await groups.set(group.id, 1, {
      expectedVersion: added.version,
      name: added.name,
      active: true,
      memberIds: [3],
    });
    await expect(policy.assert('source', 10, 2, 'read')).rejects.toMatchObject({ status: 403 });
    await policy.assert('source', 10, 3, 'edit');
    const inactive = await groups.set(group.id, 1, {
      expectedVersion: removed.version,
      name: removed.name,
      active: false,
      memberIds: [3],
    });
    expect(await policy.sourceIds(3)).toEqual([]);
    await expect(policy.assert('source', 10, 3, 'read')).rejects.toMatchObject({ status: 403 });
    await groups.set(group.id, 1, {
      expectedVersion: inactive.version,
      name: inactive.name,
      active: true,
      memberIds: [3],
    });
    await policy.assert('source', 10, 3, 'read');
  });
  it('unions direct and multiple group rights and keeps each revocation independent', async () => {
    const a = await roster([2], 'Read edit'),
      b = await roster([2], 'Read export');
    await grant('source', 10, a, { read: true, edit: true });
    await grant('source', 10, b, { read: true, export: true });
    await policy.set('source', 10, 1, {
      recipientId: 2,
      expectedVersion: 0,
      rights: rights({ read: true }),
    });
    expect((await policy.capabilities('source', 10, 2)).rights).toEqual(
      rights({ read: true, edit: true, export: true }),
    );
    expect(await policy.sourceIds(2)).toEqual([10]);
    await policy.set('source', 10, 1, { recipientId: 2, expectedVersion: 1, rights: rights() });
    await policy.assert('source', 10, 2, 'edit');
    await grant('source', 10, a, {}, 1);
    await expect(policy.assert('source', 10, 2, 'edit')).rejects.toMatchObject({ status: 403 });
    await policy.assert('source', 10, 2, 'export');
    await policy.set('source', 10, 1, {
      recipientId: 2,
      expectedVersion: 2,
      rights: rights({ read: true, edit: true }),
    });
    await grant('source', 10, b, {}, 1);
    await policy.assert('source', 10, 2, 'edit');
    expect(await policy.sourceIds(2)).toEqual([10]);
  });
  it('requires separate source access for dashboard group permissions and never changes original ownership', async () => {
    const group = await roster([2]);
    const original = await db.manager.findOneBy(Dashboard, { id: 20 }),
      mapping = await db.manager.find(UserMapping);
    await grant('dashboard', 20, group, { read: true, edit: true, publish: true, export: true });
    expect(await policy.dashboardIds(2)).toEqual([20]);
    await expect(access.dashboard(20, 2, 'read')).rejects.toMatchObject({ status: 403 });
    await grant('source', 10, group, { read: true });
    for (const action of ['read', 'edit', 'publish', 'export'] as const)
      await access.dashboard(20, 2, action);
    await grant('source', 10, group, {}, 1);
    await expect(access.dashboard(20, 2, 'publish')).rejects.toMatchObject({ status: 403 });
    expect(await db.manager.findOneBy(Dashboard, { id: 20 })).toEqual(original);
    expect(await db.manager.find(UserMapping)).toEqual(mapping);
  });
  it('checks current owner, account activity, organization and source state for detail and discovery', async () => {
    const group = await roster([2]);
    await grant('source', 10, group, { read: true });
    for (const change of ['recipient', 'owner', 'org', 'source']) {
      if (change === 'recipient') await db.manager.update(User, 2, { active: false });
      if (change === 'owner') await db.manager.update(User, 1, { active: false });
      if (change === 'org') await db.manager.update(EnterpriseMembership, 2, { organizationId: 2 });
      if (change === 'source') await db.manager.update(Database, 10, { catalogActive: false });
      expect(await policy.sourceIds(2)).toEqual([]);
      await expect(policy.assert('source', 10, 2, 'read')).rejects.toMatchObject({ status: 403 });
      await db.manager.update(User, 2, { active: true });
      await db.manager.update(User, 1, { active: true });
      await db.manager.update(EnterpriseMembership, 2, { organizationId: 1 });
      await db.manager.update(Database, 10, { catalogActive: true });
    }
    await db.manager.update(Database, 10, { ownerId: 4 });
    expect(await policy.sourceIds(2)).toEqual([]);
    await expect(policy.assert('source', 10, 2, 'read')).rejects.toMatchObject({ status: 403 });
  });
  it('rejects stale group/policy versions, foreign groups and illegal action combinations atomically', async () => {
    const group = await roster([2]),
      other = await groups.create(4, { requestId: randomUUID(), name: 'Foreign' });
    const latest = await groups.set(group.id, 1, {
      expectedVersion: group.version,
      name: group.name,
      active: true,
      memberIds: [3],
    });
    await expect(grant('source', 10, group, { read: true })).rejects.toMatchObject({ status: 409 });
    await expect(grant('source', 10, other, { read: true })).rejects.toMatchObject({ status: 403 });
    await expect(grant('source', 10, latest, { read: true, publish: true })).rejects.toMatchObject({
      status: 400,
    });
    await expect(grant('source', 10, latest, { edit: true })).rejects.toMatchObject({
      status: 400,
    });
    expect(await db.manager.count(EnterpriseGroupGrant)).toBe(0);
    await grant('source', 10, latest, { read: true });
    await expect(grant('source', 10, latest, {})).rejects.toMatchObject({ status: 409 });
    const disabled = await groups.set(group.id, 1, {
      expectedVersion: latest.version,
      name: latest.name,
      active: false,
      memberIds: [3],
    });
    await expect(grant('source', 10, disabled, { read: true }, 1)).rejects.toMatchObject({
      status: 403,
    });
    await grant('source', 10, disabled, {}, 1);
  });
  it('rolls back an invalid roster or a failed membership insert and recovers with the same version', async () => {
    const group = await roster([2]);
    const before = await groups.detail(group.id, 1),
      audits = await db.manager.count(EnterpriseAuditEvent);
    await expect(
      groups.set(group.id, 1, {
        expectedVersion: group.version,
        name: 'Invalid',
        active: false,
        memberIds: [2, 5],
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await groups.detail(group.id, 1)).toEqual(before);
    await db.query(
      `CREATE TRIGGER fail_group_member BEFORE INSERT ON enterprise_group_member BEGIN SELECT RAISE(ABORT, 'synthetic roster failure'); END`,
    );
    const body = {
      expectedVersion: group.version,
      name: 'Recovered',
      active: false,
      memberIds: [3],
    };
    try {
      await expect(groups.set(group.id, 1, body)).rejects.toThrow(/synthetic roster failure/);
      expect(await groups.detail(group.id, 1)).toEqual(before);
      expect(await db.manager.count(EnterpriseAuditEvent)).toBe(audits);
    } finally {
      await db.query('DROP TRIGGER fail_group_member');
    }
    expect((await groups.set(group.id, 1, body)).members.map(row => row.id)).toEqual([3]);
  });
  it('preserves inactive/departed members but hides their foreign identity and permits explicit removal', async () => {
    const group = await roster([2]);
    await db.manager.update(EnterpriseMembership, 2, { organizationId: 2 });
    expect((await groups.detail(group.id, 1)).members).toEqual([
      { id: 2, current: false, active: false, userId: null },
    ]);
    const kept = await groups.set(group.id, 1, {
      expectedVersion: group.version,
      name: group.name,
      active: true,
      memberIds: [2],
    });
    expect(kept.members[0].current).toBe(false);
    const removed = await groups.set(group.id, 1, {
      expectedVersion: kept.version,
      name: group.name,
      active: true,
      memberIds: [],
    });
    expect(removed.members).toEqual([]);
    await expect(
      groups.set(group.id, 1, {
        expectedVersion: removed.version,
        name: group.name,
        active: true,
        memberIds: [2],
      }),
    ).rejects.toMatchObject({ status: 403 });
    await db.manager.update(User, 3, { active: false });
    await expect(
      groups.set(group.id, 1, {
        expectedVersion: removed.version,
        name: group.name,
        active: true,
        memberIds: [3],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('replays the same creation after response loss and a rename, without duplicate groups or audits', async () => {
    const body = { name: 'Initial name', requestId: randomUUID() };
    const first = await groups.create(1, body);
    await groups.set(first.id, 1, {
      expectedVersion: first.version,
      name: 'Renamed after creation',
      active: true,
      memberIds: [2],
    });
    const count = await db.manager.count(EnterpriseAuditEvent);
    const replay = await groups.create(1, body);
    expect(replay).toMatchObject({ id: first.id, name: 'Renamed after creation', replayed: true });
    expect(await db.manager.count(EnterpriseGroup)).toBe(1);
    expect(await db.manager.count(EnterpriseGroupRequest)).toBe(1);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(count);
    await expect(groups.create(1, { ...body, name: 'Different' })).rejects.toMatchObject({
      status: 409,
    });
    await db.manager.update(EnterpriseMembership, 1, { organizationId: 2 });
    await expect(groups.create(1, body)).rejects.toMatchObject({ status: 409 });
  });
  it('does not mistake group audit subjects for personal notification recipients', async () => {
    const group = await roster([2]);
    await grant('source', 10, group, { read: true });
    const audit = await db.manager.findOne(EnterpriseAuditEvent, {
      where: { action: 'source.group-permissions' },
    });
    expect(audit.subjectId).toBe(group.id);
    expect((await new EnterpriseNotificationService(db).list(2)).entries).toEqual([]);
  });
  it('rejects malformed and excessive rosters and pages groups by stable ID', async () => {
    for (const name of ['', ' '.repeat(2), 'x'.repeat(101)])
      await expect(groups.create(1, { requestId: randomUUID(), name })).rejects.toMatchObject({
        status: 400,
      });
    const group = await roster([]);
    for (const memberIds of [[2, 2], [-1], Array.from({ length: 201 }, (_, i) => i + 1)])
      await expect(
        groups.set(group.id, 1, {
          expectedVersion: group.version,
          name: group.name,
          active: true,
          memberIds,
        }),
      ).rejects.toMatchObject({ status: 400 });
    for (let i = 0; i < 21; i += 1)
      await groups.create(1, { requestId: randomUUID(), name: 'Paged ' + i });
    const page = await groups.list(1);
    expect(page.entries).toHaveLength(20);
    expect(page.nextAfterId).toBe(page.entries[19].id);
    expect(
      (await groups.list(1, page.nextAfterId)).entries.every(row => row.id > page.nextAfterId),
    ).toBe(true);
  });
  it('uses the same JWT after membership removal and protects HTTP admin routes', async () => {
    const previous = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = 'synthetic-dynamic-group-http';
    const jwt = new JwtService();
    const module = await Test.createTestingModule({
      controllers: [EnterpriseGroupController, EnterpriseResourceController],
      providers: [
        EnterpriseGroupService,
        EnterpriseResourcePolicyService,
        SourceAccessService,
        SourceLifecycleService,
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
        { accessKeyData: { id, userId: `group-user-${id}`, authVersion: 0 } },
        { secret: process.env.ACCESS_SECRET },
      );
    try {
      await request(app.getHttpServer()).get('/enterprise/groups').expect(401);
      await request(app.getHttpServer())
        .get('/enterprise/groups')
        .set('Authorization', token(2))
        .expect(403);
      const created = await request(app.getHttpServer())
        .post('/enterprise/groups')
        .set('Authorization', token(1))
        .send({ name: 'HTTP Group', requestId: randomUUID() })
        .expect(201);
      const id = created.body.id;
      const populated = await request(app.getHttpServer())
        .post(`/enterprise/groups/${id}`)
        .set('Authorization', token(1))
        .send({ name: 'HTTP Group', active: true, memberIds: [2], expectedVersion: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .post('/enterprise/resources/source/10/group-policies')
        .set('Authorization', token(1))
        .send({
          groupId: id,
          expectedGroupVersion: populated.body.version,
          expectedVersion: 0,
          rights: rights({ read: true }),
        })
        .expect(201);
      const sameToken = token(2);
      await request(app.getHttpServer())
        .get('/enterprise/resources/source/10/access')
        .set('Authorization', sameToken)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/enterprise/groups/${id}`)
        .set('Authorization', token(1))
        .send({ name: 'HTTP Group', active: true, memberIds: [], expectedVersion: 2 })
        .expect(201);
      await request(app.getHttpServer())
        .get('/enterprise/resources/source/10/access')
        .set('Authorization', sameToken)
        .expect(403);
      await request(app.getHttpServer())
        .get('/enterprise/groups?afterId=1&afterId=2')
        .set('Authorization', token(1))
        .expect(400);
    } finally {
      await app.close();
      if (previous === undefined) delete process.env.ACCESS_SECRET;
      else process.env.ACCESS_SECRET = previous;
    }
  });
  it('creates additive tables idempotently with safe defaults, unique names and composite member/grant keys', async () => {
    const isolated = await new DataSource({
        type: 'sqlite',
        database: ':memory:',
        entities: [],
        synchronize: false,
      }).initialize(),
      runner = isolated.createQueryRunner(),
      migration = new AddEnterpriseGroups1792480000000();
    try {
      await migration.up(runner);
      await runner.query(
        'INSERT INTO enterprise_group (organizationId,name,nameKey,version) VALUES (1,?,?,1)',
        ['Ops', 'ops'],
      );
      await runner.query('INSERT INTO enterprise_group_member (groupId,userId) VALUES (1,2)');
      await runner.query(
        'INSERT INTO enterprise_group_grant (resourceKind,resourceId,groupId,organizationId,ownerId,version) VALUES (?,?,?,?,?,?)',
        ['source', 10, 1, 1, 1, 1],
      );
      await migration.up(runner);
      expect(await runner.query('SELECT active FROM enterprise_group')).toEqual([{ active: 1 }]);
      expect(
        await runner.query('SELECT read,edit,publish,export FROM enterprise_group_grant'),
      ).toEqual([{ read: 0, edit: 0, publish: 0, export: 0 }]);
      await expect(
        runner.query('INSERT INTO enterprise_group_member (groupId,userId) VALUES (1,2)'),
      ).rejects.toThrow();
      await expect(
        runner.query(
          'INSERT INTO enterprise_group (organizationId,name,nameKey,version) VALUES (1,?,?,1)',
          ['OPS', 'ops'],
        ),
      ).rejects.toThrow();
      await expect(migration.down()).rejects.toThrow(/backup plan/);
    } finally {
      await runner.release();
      await isolated.destroy();
    }
  });
});
