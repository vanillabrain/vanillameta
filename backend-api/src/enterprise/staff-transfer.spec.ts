import { HttpExceptionFilter } from '../nest-utils/http-exception.filter';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Metric, MetricAggregation } from '../metric/entities/metric.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { StaffTransferService } from './staff-transfer.service';
import { StaffTransferController } from './staff-transfer.controller';
import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { EnterpriseStaffTransfer } from './entities/enterprise-staff-transfer.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
} from './entities/enterprise-group.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { EnterpriseGroupService } from './group.service';
import { EnterpriseNotificationAudience } from './entities/enterprise-notification-audience.entity';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { RefreshToken } from '../auth/entites/refresh_token.entity';
import { AddStaffTransfer1792590000000 } from '../migrations/1792590000000-add-staff-transfer';

const entities = [
  Metric,
  StudioState,
  EnterpriseNotificationAudience,
  User,
  EnterpriseMembership,
  EnterpriseOrganization,
  EnterpriseEnrollment,
  EnterpriseStaffTransfer,
  EnterpriseAuditEvent,
  EnterpriseResourceGrant,
  EnterpriseDashboardDelivery,
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
  EnterpriseGroupDelivery,
  Database,
  Dashboard,
  UserMapping,
  StudioPublication,
  RefreshToken,
];
describe('UC051 staff search and consented organization transfer', () => {
  jest.setTimeout(30000);
  let db: DataSource,
    service: StaffTransferService,
    enterprise: EnterpriseService,
    policy: EnterpriseResourcePolicyService,
    app: INestApplication;
  let fixtureDirectory: string;
  const jwt = new JwtService(),
    oldAccess = process.env.ACCESS_SECRET,
    oldRefresh = process.env.REFRESH_SECRET;
  const uri = '/enterprise/staff-transfer';
  const token = (id: number, epoch = 0) =>
    jwt.sign(
      { accessKeyData: { id, userId: `staff-${id}`, authVersion: epoch } },
      { secret: process.env.ACCESS_SECRET },
    );
  const call = (
    method: 'get' | 'post' | 'delete',
    path: string,
    id: number,
    body?: any,
    epoch = 0,
  ) => {
    const req = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token(id, epoch)}`);
    return body === undefined ? req : req.send(body);
  };
  beforeAll(async () => {
    fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-staff-assets-'));
    process.env.ACCESS_SECRET = 'staff-transfer-synthetic-access';
    process.env.REFRESH_SECRET = 'staff-transfer-synthetic-refresh';
    db = await semanticMetadata('staff', {
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    });
    service = new StaffTransferService(db);
    enterprise = new EnterpriseService(db);
    policy = new EnterpriseResourcePolicyService(db);
    const module = await Test.createTestingModule({
      controllers: [StaffTransferController, EnterpriseController],
      providers: [
        StaffTransferService,
        EnterpriseService,
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
  });
  beforeEach(async () => {
    // Delete fixture rows only; preserve the externally checked owner marker.
    for (const entity of [...entities].reverse())
      await db.getRepository(entity).createQueryBuilder().delete().execute();
    await db.getRepository(User).save(
      [1, 2, 3, 4, 5].map(id => ({
        id,
        userId: `staff-${id}`,
        email: `staff-${id}@example.invalid`,
        password: 'synthetic-unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.getRepository(EnterpriseOrganization).save([
      { id: 10, name: 'Synthetic A', version: 1 },
      { id: 20, name: 'Synthetic B', version: 1 },
    ]);
    await db.getRepository(EnterpriseMembership).save([
      { userId: 1, organizationId: 10, role: 'admin', team: 'Admin' },
      { userId: 2, organizationId: 10, role: 'member', team: 'Sales%_!' },
      { userId: 3, organizationId: 20, role: 'admin', team: 'Admin' },
      { userId: 4, organizationId: 10, role: 'member', team: 'Sales-other' },
      { userId: 5, organizationId: 20, role: 'member', team: 'Sales%_!' },
    ]);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
    if (fixtureDirectory) fs.rmSync(fixtureDirectory, { recursive: true, force: true });
    if (db?.isInitialized) await db.destroy();
    if (oldAccess === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = oldAccess;
    if (oldRefresh === undefined) delete process.env.REFRESH_SECRET;
    else process.env.REFRESH_SECRET = oldRefresh;
  });
  const prepare = async () => {
    const r = await service.request(2, 0, { targetOrganizationId: 20 });
    await service.accept(3, 0, { code: r.code, team: 'New team', expectedVersion: 1 });
    return r.code;
  };
  const complete = async (code: string) =>
    service.complete(1, 0, {
      code,
      expectedVersion: 1,
      targetExpectedVersion: 1,
      reviewBasis: (await service.review(1, 0, { code })).reviewBasis,
    });
  const snapshot = async () => ({
    membership: await db.getRepository(EnterpriseMembership).find({ order: { userId: 'ASC' } }),
    orgs: await db.getRepository(EnterpriseOrganization).find({ order: { id: 'ASC' } }),
    audit: await db.getRepository(EnterpriseAuditEvent).count(),
    user: await db.getRepository(User).findOneByOrFail({ id: 2 }),
    grants: await db.getRepository(EnterpriseResourceGrant).find(),
    groupMembers: await db.getRepository(EnterpriseGroupMember).find(),
    groups: await db.getRepository(EnterpriseGroup).find(),
    deliveries: await db.getRepository(EnterpriseDashboardDelivery).find(),
  });
  it('serializes absent and revoked staff transfer status as explicit JSON null over protected HTTP', async () => {
    const initial = await call('get', uri, 2).expect(200).expect('Content-Type', /json/);
    expect(initial.text).toBe('null');
    expect(initial.body).toBeNull();
    await call('post', uri, 2, { targetOrganizationId: 20 }).expect(201);
    expect((await call('get', uri, 2).expect(200)).body.status).toBe('pending');
    await call('delete', uri, 2).expect(200);
    const revoked = await call('get', uri, 2).expect(200).expect('Content-Type', /json/);
    expect(revoked.text).toBe('null');
  });
  it('searches only own organization by literal login/team/id and rejects malformed queries', async () => {
    expect((await enterprise.members(1, undefined, '%_!')).entries.map(r => r.id)).toEqual([2]);
    expect((await enterprise.members(1, undefined, '2')).entries.map(r => r.id)).toEqual([2]);
    expect((await enterprise.members(1, undefined, 'staff-5')).entries).toEqual([]);
    expect((await enterprise.members(1, 2, 'Sales')).entries.map(r => r.id)).toEqual([4]);
    await expect(enterprise.members(2, undefined, 'staff')).rejects.toMatchObject({ status: 403 });
    for (const q of ['x'.repeat(101), ['staff']])
      await expect(enterprise.members(1, undefined, q)).rejects.toMatchObject({ status: 400 });
    const response = await call('get', '/enterprise/members?q=Sales%25_!', 1).expect(200);
    expect(response.body.entries.map(r => r.id)).toEqual([2]);
    expect(JSON.stringify(response.body)).not.toMatch(/email|password|jwtId|codeHash/);
  });
  it('requires employee consent and both administrators, hides hashes, and changes no access at acceptance', async () => {
    const before = await snapshot();
    await request(app.getHttpServer()).get(uri).expect(401);
    await call('post', uri + '/accept', 3, {
      code: 'a'.repeat(64),
      team: 'x',
      expectedVersion: 1,
    }).expect(409);
    const r = (await call('post', uri, 2, { targetOrganizationId: 20 }).expect(201)).body;
    await call('post', uri + '/accept', 1, { code: r.code, team: 'x', expectedVersion: 1 }).expect(
      403,
    );
    await call('post', uri + '/complete', 1, {
      code: r.code,
      expectedVersion: 1,
      targetExpectedVersion: 1,
      reviewBasis: (await service.review(1, 0, { code: r.code })).reviewBasis,
    }).expect(409);
    await call('post', uri + '/accept', 3, {
      code: r.code,
      team: 'New team',
      expectedVersion: 1,
    }).expect(201);
    const status = (await call('get', uri, 2).expect(200)).body;
    expect(status).toMatchObject({ accepted: true, status: 'pending', team: 'New team' });
    expect(JSON.stringify(status)).not.toMatch(/code|Hash|acceptedBy|authVersion/);
    expect(await snapshot()).toEqual({ ...before, audit: 1 });
    await call('post', uri + '/complete', 3, {
      code: r.code,
      expectedVersion: 1,
      targetExpectedVersion: 1,
      reviewBasis: (await service.review(1, 0, { code: r.code })).reviewBasis,
    }).expect(403);
    await call('post', uri + '/complete', 1, {
      code: r.code,
      expectedVersion: 1,
      targetExpectedVersion: 1,
      reviewBasis: (await service.review(1, 0, { code: r.code })).reviewBasis,
    }).expect(201);
    await call('get', '/enterprise/context', 2).expect(401);
    expect(
      (await call('get', '/enterprise/context', 2, undefined, 1).expect(200)).body.membership,
    ).toMatchObject({ role: 'member', team: 'New team' });
    expect((await call('get', uri, 2, undefined, 1).expect(200)).body.status).toBe('completed');
    await call('post', uri + '/complete', 1, {
      code: r.code,
      expectedVersion: 2,
      targetExpectedVersion: 2,
      reviewBasis: '0'.repeat(64),
    }).expect(409);
    expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(3);
  });
  it.each(['source', 'target', 'epoch', 'approver', 'expired', 'withdrawn', 'replaced'])(
    'preserves state when %s basis changes before final move',
    async mode => {
      const code = await prepare();
      if (mode === 'source' || mode === 'target')
        await db
          .getRepository(EnterpriseOrganization)
          .increment({ id: mode === 'source' ? 10 : 20 }, 'version', 1);
      if (mode === 'epoch') await db.getRepository(User).increment({ id: 2 }, 'authVersion', 1);
      if (mode === 'approver')
        await db.getRepository(EnterpriseMembership).update(3, { role: 'member' });
      if (mode === 'expired')
        await db.getRepository(EnterpriseStaffTransfer).update(2, { expiresAt: new Date(0) });
      if (mode === 'withdrawn') await service.revoke(2, 0);
      if (mode === 'replaced') await service.request(2, 0, { targetOrganizationId: 20 });
      const before = await snapshot();
      await expect(complete(code)).rejects.toHaveProperty('status');
      expect(await snapshot()).toEqual(before);
    },
  );
  it('denies self moves, same organization, unexpected fields and stale actor JWT under the write lock', async () => {
    await expect(service.request(2, 0, { targetOrganizationId: 10 })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.request(2, 0, { targetOrganizationId: 20, role: 'admin' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.request(2, 1, { targetOrganizationId: 20 })).rejects.toMatchObject({
      status: 401,
    });
    const r = await service.request(1, 0, { targetOrganizationId: 20 });
    await service.accept(3, 0, { code: r.code, team: '', expectedVersion: 1 });
    await expect(complete(r.code)).rejects.toMatchObject({ status: 403 });
  });
  it('preserves owned sources, dashboards, copies, mappings, publications and historical audits while revoking direct/group/delivery rights', async () => {
    const sourceFile = path.join(fixtureDirectory, 'synthetic-orders.csv');
    fs.writeFileSync(sourceFile, 'day,amount\n2026-01-01,10\n');
    await db.getRepository(Metric).save({
      id: 51,
      name: 'synthetic_metric',
      databaseId: 12,
      tableName: 'source',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      definition: 'preserved metric definition',
    });
    await db.getRepository(StudioState).save({
      dashboardId: 22,
      document: 'preserved Studio block/layout document',
      legacyRevision: 'synthetic-revision',
    });
    await db.getRepository(Database).save([
      {
        id: 11,
        ownerId: 1,
        name: 'Old shared',
        engine: 'duckdb',
        type: 'file',
        connectionConfig: 'synthetic-original',
      },
      {
        id: 12,
        ownerId: 2,
        name: 'Owned copy',
        engine: 'duckdb',
        type: 'file',
        connectionConfig: JSON.stringify({ filePath: sourceFile }),
      },
    ]);
    await db.getRepository(Dashboard).save([
      { id: 21, title: 'Original', layout: 'original', structuredDefinition: 'synthetic-original' },
      { id: 22, title: 'Independent copy', layout: 'copy', structuredDefinition: 'synthetic-copy' },
    ]);
    await db.getRepository(UserMapping).save([
      { userInfoId: 1, dashboardId: 21 },
      { userInfoId: 2, dashboardId: 22 },
    ]);
    await db.getRepository(StudioPublication).save({
      token: 'synthetic-publication',
      actorId: 2,
      dashboardId: 22,
      sourceId: 12,
      version: 1,
      visibility: 'link',
      allowRemix: false,
      expiresAt: null,
      revokedAt: null,
      asOf: '2026-01-01T00:00:00Z',
      dataVersion: 'synthetic',
      snapshot: 'preserved snapshot',
    });
    await db.getRepository(EnterpriseGroup).save({
      id: 31,
      organizationId: 10,
      name: 'Old group',
      nameKey: 'old',
      active: true,
      version: 1,
    });
    await db.getRepository(EnterpriseGroupMember).save({ groupId: 31, userId: 2 });
    await db.getRepository(EnterpriseResourceGrant).save([
      {
        resourceKind: 'source',
        resourceId: 11,
        ownerId: 1,
        recipientId: 2,
        organizationId: 10,
        version: 1,
        read: true,
        edit: true,
        publish: false,
        export: true,
      },
      {
        resourceKind: 'source',
        resourceId: 12,
        ownerId: 2,
        recipientId: 1,
        organizationId: 10,
        version: 1,
        read: true,
        edit: false,
        publish: false,
        export: false,
      },
    ]);
    // Dormant destination authority must not activate merely because the owner arrives.
    await db.getRepository(EnterpriseResourceGrant).save({
      resourceKind: 'source',
      resourceId: 12,
      ownerId: 2,
      recipientId: 3,
      organizationId: 20,
      version: 5,
      read: true,
      edit: true,
      publish: false,
      export: true,
    });
    await db.getRepository(EnterpriseGroup).save({
      id: 32,
      organizationId: 20,
      name: 'Dormant destination',
      nameKey: 'dormant',
      active: false,
      version: 2,
    });
    await db.getRepository(EnterpriseGroupMember).save([
      { groupId: 32, userId: 2 },
      { groupId: 31, userId: 4 },
    ]);
    await db.getRepository(EnterpriseGroupGrant).save({
      resourceKind: 'source',
      resourceId: 12,
      ownerId: 2,
      organizationId: 10,
      groupId: 31,
      version: 1,
      read: true,
      edit: false,
      publish: false,
      export: false,
    });
    await db.getRepository(EnterpriseGroupGrant).save({
      resourceKind: 'source',
      resourceId: 11,
      ownerId: 1,
      organizationId: 10,
      groupId: 31,
      version: 1,
      read: true,
      edit: false,
      publish: false,
      export: false,
    });
    await db.getRepository(EnterpriseDashboardDelivery).save({
      ownerId: 1,
      organizationId: 10,
      dashboardId: 21,
      recipientId: 2,
      version: 1,
      active: true,
      allowCopy: true,
    });
    await db.getRepository(EnterpriseGroupDelivery).save({
      ownerId: 2,
      organizationId: 10,
      dashboardId: 22,
      groupId: 31,
      version: 1,
      active: true,
      allowCopy: true,
    });
    const preserved = async () => ({
      sources: await db.getRepository(Database).find({ order: { id: 'ASC' } }),
      dashboards: await db.getRepository(Dashboard).find({ order: { id: 'ASC' } }),
      maps: await db.getRepository(UserMapping).find({ order: { id: 'ASC' } }),
      publication: await db.getRepository(StudioPublication).find(),
      metrics: await db.getRepository(Metric).find(),
      studio: await db.getRepository(StudioState).find(),
      file: fs.readFileSync(sourceFile),
    });
    const before = await preserved();
    await policy.assert('source', 11, 2, 'read');
    await policy.assert('source', 12, 1, 'read');
    const code = await prepare();
    await complete(code);
    expect(await preserved()).toEqual(before);
    await expect(policy.assert('source', 11, 2, 'read')).rejects.toMatchObject({ status: 403 });
    await expect(policy.assert('source', 12, 1, 'read')).rejects.toMatchObject({ status: 403 });
    await expect(policy.assert('source', 12, 3, 'read')).rejects.toMatchObject({ status: 403 });
    await policy.assert('source', 12, 2, 'read');
    expect(await db.getRepository(EnterpriseGroupMember).count({ where: { userId: 2 } })).toBe(0);
    expect((await db.getRepository(EnterpriseGroup).findOneByOrFail({ id: 31 })).version).toBe(2);
    expect(
      await db.getRepository(EnterpriseGroupMember).count({ where: { groupId: 31, userId: 4 } }),
    ).toBe(1);
    expect((await db.getRepository(EnterpriseGroup).findOneByOrFail({ id: 32 })).version).toBe(3);
    expect(
      await db.getRepository(EnterpriseGroupGrant).findOneByOrFail({ resourceId: 12 }),
    ).toMatchObject({ read: false, version: 2 });
    expect(
      await db.getRepository(EnterpriseGroupDelivery).findOneByOrFail({ ownerId: 2 }),
    ).toMatchObject({ active: false, allowCopy: false, version: 2 });
    expect(
      await db.getRepository(EnterpriseDashboardDelivery).findOneByOrFail({ recipientId: 2 }),
    ).toMatchObject({ active: false, allowCopy: false, version: 2 });
    const back = await service.request(2, 1, { targetOrganizationId: 10 });
    await service.accept(1, 0, { code: back.code, team: '', expectedVersion: 2 });
    await service.complete(3, 0, {
      code: back.code,
      expectedVersion: 2,
      targetExpectedVersion: 2,
      reviewBasis: (await service.review(3, 0, { code: back.code })).reviewBasis,
    });
    await expect(policy.assert('source', 11, 2, 'read')).rejects.toMatchObject({ status: 403 });
    expect(await preserved()).toEqual(before);
    await expect(
      new EnterpriseGroupService(db).set(31, 1, {
        expectedVersion: 1,
        name: 'Old group',
        active: true,
        memberIds: [2, 4],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('invalidates old access and refresh even though the account remains active', async () => {
    const auth = new AuthService(jwt, db.getRepository(User), db.getRepository(RefreshToken));
    const user = await db.getRepository(User).findOneByOrFail({ id: 2 });
    const refresh = await auth.generateRefreshToken(user);
    await auth.setRefreshKey(refresh, null, 2);
    const access = token(2);
    const code = await prepare();
    await complete(code);
    await expect(new JwtAuthGuard(jwt, db).validate(access, true)).rejects.toMatchObject({
      status: 401,
    });
    await expect(auth.setRefreshKey(refresh, null, 2)).rejects.toMatchObject({ status: 401 });
    expect(await db.getRepository(User).findOneByOrFail({ id: 2 })).toMatchObject({
      active: true,
      authVersion: 1,
      jwtId: null,
    });
  });
  it('rolls back membership, tokens, relationship revocation, versions and audits after a late failure', async () => {
    await db.getRepository(EnterpriseResourceGrant).save({
      resourceKind: 'source',
      resourceId: 999,
      ownerId: 1,
      recipientId: 2,
      organizationId: 10,
      version: 1,
      read: true,
      edit: true,
      publish: false,
      export: true,
    });
    await db.getRepository(EnterpriseGroup).save({
      id: 99,
      organizationId: 10,
      name: 'Rollback group',
      nameKey: 'rollback',
      active: true,
      version: 1,
    });
    await db.getRepository(EnterpriseGroupMember).save({ groupId: 99, userId: 2 });
    await db.getRepository(EnterpriseDashboardDelivery).save({
      ownerId: 1,
      organizationId: 10,
      dashboardId: 999,
      recipientId: 2,
      version: 1,
      active: true,
      allowCopy: true,
    });
    const code = await prepare(),
      before = await snapshot();
    const original = db.transaction.bind(db);
    (jest.spyOn(db, 'transaction') as any).mockImplementation(run =>
      original(async manager => {
        const insert = manager.insert.bind(manager);
        (manager as any).insert = async (entity, values) => {
          if (entity === EnterpriseAuditEvent) throw new Error('synthetic audit failure');
          return insert(entity, values);
        };
        return run(manager);
      }),
    );
    await expect(complete(code)).rejects.toThrow('synthetic audit failure');
    expect(await snapshot()).toEqual(before);
    expect(
      (await db.getRepository(EnterpriseStaffTransfer).findOneByOrFail({ userId: 2 })).completed,
    ).toBe(false);
  });
  (process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip)(
    'serializes two independent MySQL finalizers into one move and one409',
    async () => {
      const code = await prepare(),
        peer = await new DataSource({ ...db.options, extra: { connectionLimit: 4 } }).initialize();
      try {
        const reviewBasis = (await service.review(1, 0, { code })).reviewBasis;
        const results = await Promise.allSettled([
          service.complete(1, 0, {
            code,
            expectedVersion: 1,
            targetExpectedVersion: 1,
            reviewBasis,
          }),
          new StaffTransferService(peer).complete(1, 0, {
            code,
            expectedVersion: 1,
            targetExpectedVersion: 1,
            reviewBasis,
          }),
        ]);
        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        expect(
          (results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.status,
        ).toBe(409);
        expect((await db.getRepository(User).findOneByOrFail({ id: 2 })).authVersion).toBe(1);
        expect(await db.getRepository(EnterpriseAuditEvent).count()).toBe(3);
      } finally {
        await peer.destroy();
      }
    },
  );
  const mysqlIt = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
  const deferred = () => {
    let resolve: () => void;
    const promise = new Promise<void>(done => {
      resolve = done;
    });
    return { promise, resolve: () => resolve() };
  };
  const waitForBlocking = async (blockerId: number) => {
    const end = Date.now() + 6000;
    while (Date.now() < end) {
      const rows = await db.query(
        `SELECT b.PROCESSLIST_ID AS blocker, r.PROCESSLIST_ID AS requester FROM performance_schema.data_lock_waits w JOIN performance_schema.threads b ON b.THREAD_ID=w.BLOCKING_THREAD_ID JOIN performance_schema.threads r ON r.THREAD_ID=w.REQUESTING_THREAD_ID WHERE b.PROCESSLIST_ID=?`,
        [blockerId],
      );
      if (rows.some(r => Number(r.blocker) === blockerId && Number(r.requester) !== blockerId))
        return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Expected actual independent MySQL writer lock wait');
  };
  mysqlIt.each(['grant', 'group'])(
    'rejects a stale %s writer after a transfer holds the target account lock',
    async kind => {
      await db.getRepository(EnterpriseMembership).update(4, { role: 'admin' });
      await db.getRepository(Database).save({
        id: 41,
        ownerId: 4,
        name: 'Writer source',
        engine: 'duckdb',
        type: 'file',
        connectionConfig: 'synthetic',
      });
      await db.getRepository(EnterpriseGroup).save({
        id: 42,
        organizationId: 10,
        name: 'Writer group',
        nameKey: 'writer',
        active: true,
        version: 1,
      });
      const code = await prepare(),
        entered = deferred(),
        resume = deferred(),
        original = db.transaction.bind(db);
      let blocker: number;
      (jest.spyOn(db, 'transaction') as any).mockImplementation(run =>
        original(async manager => {
          const insert = manager.insert.bind(manager);
          (manager as any).insert = async (entity, values) => {
            if (entity === EnterpriseAuditEvent && values.action === 'member.transferred') {
              const [row] = await manager.query('SELECT CONNECTION_ID() AS id');
              blocker = Number(row.id);
              entered.resolve();
              await resume.promise;
            }
            return insert(entity, values);
          };
          return run(manager);
        }),
      );
      const moving = complete(code);
      const settledMove = moving.catch(e => e);
      await entered.promise;
      const peer = await new DataSource({
        ...db.options,
        extra: { connectionLimit: 4 },
      }).initialize();
      let write: Promise<any>;
      try {
        write = (
          kind === 'grant'
            ? new EnterpriseResourcePolicyService(peer).set('source', 41, 4, {
                recipientId: 2,
                expectedVersion: 0,
                rights: { read: true, edit: false, publish: false, export: false },
              })
            : new EnterpriseGroupService(peer).set(42, 4, {
                expectedVersion: 1,
                name: 'Writer group',
                active: true,
                memberIds: [2],
              })
        ).then(
          () => 200,
          e => e.status,
        );
        await waitForBlocking(blocker);
      } finally {
        resume.resolve();
        await settledMove;
      }
      try {
        expect(await write).toBe(403);
        expect(await moving).toMatchObject({ completed: true });
        expect(
          await db
            .getRepository(EnterpriseResourceGrant)
            .count({ where: { resourceId: 41, recipientId: 2, read: true } }),
        ).toBe(0);
        expect(
          await db
            .getRepository(EnterpriseGroupMember)
            .count({ where: { groupId: 42, userId: 2 } }),
        ).toBe(0);
      } finally {
        await peer.destroy();
      }
    },
  );
  it('allows admin transfer only when another current source administrator finalizes and always resets destination role', async () => {
    await db.getRepository(EnterpriseMembership).update(2, { role: 'admin' });
    const code = await prepare();
    await complete(code);
    expect(
      await db.getRepository(EnterpriseMembership).findOneByOrFail({ userId: 2 }),
    ).toMatchObject({ organizationId: 20, role: 'member' });
    expect(
      await db.getRepository(EnterpriseMembership).findOneByOrFail({ userId: 1 }),
    ).toMatchObject({ organizationId: 10, role: 'admin' });
  });
  it('requires a scoped review and exposes only the terms an administrator must confirm', async () => {
    const code = await prepare();
    const reviewed = (await call('post', uri + '/review', 1, { code }).expect(201)).body;
    expect(reviewed).toMatchObject({
      userId: 2,
      sourceVersion: 1,
      targetVersion: 1,
      team: 'New team',
      accepted: true,
      status: 'pending',
    });
    expect(JSON.stringify(reviewed)).not.toMatch(
      /codeHash|password|email|authVersion|acceptedEpoch/,
    );
    await call('post', uri + '/review', 2, { code }).expect(403);
    await db.getRepository(EnterpriseOrganization).save({ id: 30, name: 'Unrelated', version: 1 });
    await db.getRepository(EnterpriseMembership).update(4, { organizationId: 30, role: 'admin' });
    await call('post', uri + '/review', 4, { code }).expect(403);
  });
  it('refuses changed acceptance after source admin review and permits only a newly reviewed basis', async () => {
    const code = await prepare(),
      old = await service.review(1, 0, { code });
    await service.accept(3, 0, { code, team: 'Changed team', expectedVersion: 1 });
    const before = await snapshot();
    await expect(
      service.complete(1, 0, {
        code,
        expectedVersion: 1,
        targetExpectedVersion: 1,
        reviewBasis: old.reviewBasis,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await snapshot()).toEqual(before);
    const latest = await service.review(1, 0, { code });
    expect(latest.reviewBasis).not.toBe(old.reviewBasis);
    await service.accept(3, 0, { code, team: 'Changed team', expectedVersion: 1 });
    expect((await service.review(1, 0, { code })).reviewBasis).toBe(latest.reviewBasis);
    await complete(code);
    expect((await db.getRepository(EnterpriseMembership).findOneByOrFail({ userId: 2 })).team).toBe(
      'Changed team',
    );
  });
  it.each(['nullable', 'length', 'default', 'type'])(
    'refuses incompatible %s migration shape without rewriting stored consent',
    async mode => {
      const runner = db.createQueryRunner(),
        migration = new AddStaffTransfer1792590000000();
      try {
        const requested = await service.request(2, 0, { targetOrganizationId: 20 });
        const old = await runner.getTable('enterprise_staff_transfer');
        const name =
          mode === 'nullable'
            ? 'acceptedBy'
            : mode === 'length'
            ? 'codeHash'
            : mode === 'default'
            ? 'completed'
            : 'targetVersion';
        const column = old.findColumnByName(name),
          replacement = column.clone();
        if (mode === 'nullable') {
          replacement.isNullable = false;
          await db.getRepository(EnterpriseStaffTransfer).update(2, { acceptedBy: 3 });
        }
        if (mode === 'length') replacement.length = '65';
        if (mode === 'default') replacement.default = '1';
        if (mode === 'type') {
          replacement.type = 'varchar';
          replacement.length = '30';
        }
        await runner.changeColumn('enterprise_staff_transfer', column, replacement);
        const before = await runner.query('SELECT * FROM enterprise_staff_transfer');
        await expect(migration.up(runner)).rejects.toThrow('schema preflight stopped');
        expect(await runner.query('SELECT * FROM enterprise_staff_transfer')).toEqual(before);
        expect(requested.code).toHaveLength(64);
        await runner.changeColumn('enterprise_staff_transfer', replacement, column);
      } finally {
        await runner.release();
      }
    },
  );
  it('applies the additive migration twice and preserves a pending request', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddStaffTransfer1792590000000();
    try {
      await runner.dropTable('enterprise_staff_transfer');
      await migration.up(runner);
      await service.request(2, 0, { targetOrganizationId: 20 });
      const before = await service.status(2, 0);
      await migration.up(runner);
      expect(await service.status(2, 0)).toEqual(before);
      expect(await db.getRepository(User).count()).toBe(5);
    } finally {
      await runner.release();
    }
  });
});
