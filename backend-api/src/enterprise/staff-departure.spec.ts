import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request = require('supertest');
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { HttpExceptionFilter } from '../nest-utils/http-exception.filter';
import { StaffDepartureService } from './staff-departure.service';
import { StaffDepartureController } from './staff-departure.controller';
import { EnterpriseStaffDeparture } from './entities/enterprise-staff-departure.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
} from './entities/enterprise-group.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { EnterpriseStaffTransfer } from './entities/enterprise-staff-transfer.entity';
import { EnterpriseSourceHandover } from './entities/enterprise-source-handover.entity';
import { EnterpriseHandoverTransfer } from './entities/enterprise-handover-transfer.entity';
import { EnterpriseBundleHandover } from './entities/enterprise-bundle-handover.entity';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { EnterpriseNotificationAudience } from './entities/enterprise-notification-audience.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { StudioExecution } from '../dashboard-studio/entities/studio-execution.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { FileRefresh } from '../database/entities/file-refresh.entity';
import { SourceDeleteReceipt } from '../database/entities/source-delete-receipt.entity';
import { RefreshToken } from '../auth/entites/refresh_token.entity';
import { AuthService } from '../auth/auth.service';
import { AddStaffDeparture1792620200000 } from '../migrations/1792620200000-add-staff-departure';
import * as basis from './staff-departure-basis';
import { DashboardService } from '../dashboard/dashboard.service';
import { DashboardWidgetService } from '../dashboard/dashboard-widget/dashboard-widget.service';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Component } from '../component/entities/component.entity';
import { SourceAccessService } from '../ownership/source-access.service';

const entities = [
  Component,
  Dataset,
  Widget,
  DashboardShare,
  DashboardWidget,
  User,
  EnterpriseMembership,
  EnterpriseOrganization,
  EnterpriseStaffDeparture,
  EnterpriseAuditEvent,
  EnterpriseEnrollment,
  EnterpriseResourceGrant,
  EnterpriseDashboardDelivery,
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
  EnterpriseGroupDelivery,
  EnterpriseStaffTransfer,
  EnterpriseSourceHandover,
  EnterpriseHandoverTransfer,
  EnterpriseBundleHandover,
  Database,
  UserMapping,
  StudioPublication,
  DashboardPublication,
  StudioExecution,
  ExportJob,
  FileRefresh,
  SourceDeleteReceipt,
  RefreshToken,
  Dashboard,
  EnterpriseNotificationAudience,
];
const uri = '/enterprise/staff-departure';
const mysql = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
describe('UC051 explicit self request and other-admin organization departure', () => {
  jest.setTimeout(30000);
  let db: DataSource, app: INestApplication, service: StaffDepartureService, root: string;
  const jwt = new JwtService(),
    oldAccess = process.env.ACCESS_SECRET,
    oldRefresh = process.env.REFRESH_SECRET,
    oldRoot = process.env.FILE_UPLOAD_DIR;
  const token = (id: number, epoch = 0) =>
    jwt.sign(
      { accessKeyData: { id, userId: `departure-${id}`, authVersion: epoch } },
      { secret: process.env.ACCESS_SECRET },
    );
  const call = (method: 'get' | 'post', suffix: string, actor = 2, body?: any, epoch = 0) => {
    const r = request(app.getHttpServer())
      [method](uri + suffix)
      .set('Authorization', `Bearer ${token(actor, epoch)}`);
    return body === undefined ? r : r.send(body);
  };
  const input = (id = randomUUID()) => ({
    requestId: id,
    expectedOrganizationVersion: 1,
    acknowledgedDeparture: true,
  });
  const create = async () => {
    const body = input();
    const response = await call('post', '', 2, body).expect(201);
    return { body, row: response.body };
  };
  const prepared = async () => {
    const p = await create();
    const review = (await call('get', `/${p.row.requestId}/review`, 1).expect(200)).body;
    return {
      ...p,
      review,
      terms: { expectedVersion: 1, reviewBasis: review.basis, acknowledgedDeparture: true },
    };
  };
  const snapshot = async () => {
    const result = [];
    for (const entity of entities)
      result.push(
        await db.getRepository(entity).find({
          order: Object.fromEntries(
            db.getMetadata(entity).primaryColumns.map(c => [c.propertyName, 'ASC']),
          ) as any,
        }),
      );
    return JSON.stringify(result);
  };
  beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vm-departure-')));
    process.env.FILE_UPLOAD_DIR = root;
    process.env.ACCESS_SECRET = 'departure-synthetic-only';
    process.env.REFRESH_SECRET = 'departure-synthetic-refresh';
    db = await semanticMetadata('departure', {
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    });
    service = new StaffDepartureService(db);
    const module = await Test.createTestingModule({
      controllers: [StaffDepartureController],
      providers: [
        StaffDepartureService,
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = module.get(StaffDepartureService);
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
  });
  beforeEach(async () => {
    for (const entity of [...entities].reverse())
      await db.getRepository(entity).createQueryBuilder().delete().execute();
    await db.getRepository(User).save(
      [1, 2, 3, 4, 5].map(id => ({
        id,
        userId: `departure-${id}`,
        email: `departure-${id}@example.invalid`,
        password: 'preserve-password',
        active: true,
        authVersion: 0,
      })),
    );
    await db.getRepository(EnterpriseOrganization).save([
      { id: 10, name: 'Synthetic', version: 1 },
      { id: 20, name: 'Other', version: 1 },
    ]);
    await db.getRepository(EnterpriseMembership).save([
      { userId: 1, organizationId: 10, role: 'admin', team: 'Admin' },
      { userId: 2, organizationId: 10, role: 'member', team: '' },
      { userId: 3, organizationId: 20, role: 'admin', team: '' },
      { userId: 4, organizationId: 10, role: 'member', team: '' },
      { userId: 5, organizationId: 10, role: 'admin', team: '' },
    ]);
    await db.getRepository(Database).save({
      id: 90,
      ownerId: 1,
      name: 'private-name-never-returned',
      engine: 'pg',
      type: 'pg',
      connectionConfig: '{"private":"never-returned"}',
    });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
    if (db?.isInitialized) await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    for (const [name, value] of [
      ['ACCESS_SECRET', oldAccess],
      ['REFRESH_SECRET', oldRefresh],
      ['FILE_UPLOAD_DIR', oldRoot],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('protects actual HTTP using JWT guard and actual exception filter', async () => {
    const before = await snapshot();
    await request(app.getHttpServer()).post(uri).send(input()).expect(401);
    await call('post', '', 2, { ...input(), extra: true }).expect(400);
    await call('get', '/invalid', 1).expect(400);
    await call('get', `/${randomUUID()}`, 1).expect(404);
    expect(await snapshot()).toBe(before);
  });
  it('fixes record/review/count keys and leaks no private metadata; reads write zero', async () => {
    const { row } = await create(),
      before = await snapshot();
    const r = (await call('get', `/${row.requestId}/review`, 1).expect(200)).body;
    expect(Object.keys(row).sort()).toEqual(
      [
        'requestId',
        'userId',
        'organizationId',
        'version',
        'status',
        'requestedAt',
        'expiresAt',
        'completedAt',
        'cancelledAt',
        'completedBy',
        'completeOrganizationVersion',
        'replayed',
      ].sort(),
    );
    expect(Object.keys(r).sort()).toEqual(
      [
        'requestId',
        'userId',
        'organizationId',
        'requestVersion',
        'organizationVersion',
        'checkedAt',
        'basis',
        'eligible',
        'blockers',
        'counts',
      ].sort(),
    );
    expect(Object.keys(r.counts).sort()).toEqual(
      [
        'ownedSources',
        'ownedDashboards',
        'activePublications',
        'openExports',
        'openRefreshes',
        'openExecutions',
        'pendingHandovers',
        'pendingTransfer',
        'pendingCleanup',
      ].sort(),
    );
    expect(r.eligible).toBe(true);
    expect(r.blockers).toEqual([]);
    expect(JSON.stringify(r)).not.toMatch(
      /private-name|never-returned|password|authVersion|codeHash/,
    );
    await call('get', `/${row.requestId}`, 2).expect(200);
    expect(await snapshot()).toBe(before);
  });
  it('requires other current same-org admin for review, denies unrelated users', async () => {
    const { row } = await create();
    for (const id of [2, 3, 4]) await call('get', `/${row.requestId}/review`, id).expect(403);
    for (const id of [3, 4]) await call('get', `/${row.requestId}`, id).expect(403);
    await call('get', `/${row.requestId}`, 1).expect(200);
  });
  it('request UUID replay is historical and exact; pending is singular; stale versions reject', async () => {
    const { body, row } = await create(),
      before = await snapshot();
    expect((await call('post', '', 2, body).expect(201)).body.replayed).toBe(true);
    await call('post', '', 2, { ...body, expectedOrganizationVersion: 2 }).expect(409);
    await call('post', '', 2, input()).expect(409);
    await call('post', '', 4, { ...input(), expectedOrganizationVersion: 2 }).expect(409);
    await call('post', '', 4, body).expect(403);
    expect(await snapshot()).toBe(before);
    await call('post', `/${row.requestId}/cancel`, 2, {
      expectedVersion: 1,
      acknowledgedDeparture: true,
    }).expect(201);
    expect((await call('post', '', 2, body).expect(201)).body.status).toBe('cancelled');
    await call('post', '', 2, input()).expect(201);
  });
  it('counts all ownership including other-org, duplicate mappings, and orphan mappings', async () => {
    const { row } = await create();
    await db.manager.update(Database, { id: 90 }, { ownerId: 2 });
    await db.manager.save(UserMapping, [
      { dashboardId: 999, userInfoId: 2 },
      { dashboardId: 999, userInfoId: 2 },
    ]);
    const review = (await call('get', `/${row.requestId}/review`, 1).expect(200)).body;
    expect(review.counts.ownedSources).toBe(1);
    expect(review.counts.ownedDashboards).toBe(2);
    expect(review.blockers).toContain('owned_assets');
    const before = await snapshot();
    await call('post', `/${row.requestId}/complete`, 1, {
      expectedVersion: 1,
      reviewBasis: review.basis,
      acknowledgedDeparture: true,
    }).expect(409);
    expect(await snapshot()).toBe(before);
  });
  const rights = { read: true, edit: true, publish: false, export: true };
  const relations = async () => {
    await db.manager.save(EnterpriseResourceGrant, [
      {
        resourceKind: 'source',
        resourceId: 90,
        recipientId: 2,
        ownerId: 1,
        organizationId: 10,
        version: 3,
        ...rights,
      },
      {
        resourceKind: 'dashboard',
        resourceId: 999,
        recipientId: 4,
        ownerId: 2,
        organizationId: 20,
        version: 4,
        ...rights,
      },
    ]);
    await db.manager.save(EnterpriseDashboardDelivery, {
      ownerId: 2,
      recipientId: 4,
      dashboardId: 999,
      organizationId: 20,
      version: 2,
      active: true,
      allowCopy: true,
    });
    await db.manager.save(EnterpriseGroup, {
      id: 7,
      organizationId: 20,
      name: 'Private',
      nameKey: 'private',
      version: 1,
      active: true,
    });
    await db.manager.save(EnterpriseGroupMember, { groupId: 7, userId: 2 });
    await db.manager.save(EnterpriseGroupGrant, {
      groupId: 7,
      organizationId: 20,
      ownerId: 2,
      resourceKind: 'source',
      resourceId: 999,
      version: 2,
      ...rights,
    });
    await db.manager.save(EnterpriseGroupDelivery, {
      groupId: 7,
      organizationId: 20,
      ownerId: 2,
      dashboardId: 999,
      version: 2,
      active: true,
      allowCopy: true,
    });
    await db.manager.save(EnterpriseEnrollment, {
      userId: 2,
      organizationId: 10,
      codeHash: 'f'.repeat(64),
      expiresAt: new Date(Date.now() + 900000),
    });
  };
  it('atomically leaves, revokes all historical relations, preserves account/assets and refresh history, exact replay writes zero', async () => {
    await relations();
    const auth = new AuthService(jwt, db.getRepository(User), db.getRepository(RefreshToken));
    const refresh = await auth.generateRefreshToken(await db.manager.findOneBy(User, { id: 2 }));
    await auth.setRefreshKey(refresh, 0, 2);
    await expect(auth.verifyRefreshToken(refresh)).resolves.toBeDefined();
    const { row, terms } = await prepared();
    const asset = await db.manager.findOneBy(Database, { id: 90 });
    const done = (await call('post', `/${row.requestId}/complete`, 1, terms).expect(201)).body;
    expect(done).toMatchObject({
      status: 'completed',
      version: 2,
      completedBy: 1,
      completeOrganizationVersion: 2,
    });
    expect(await db.manager.findOneBy(EnterpriseMembership, { userId: 2 })).toBeNull();
    expect(await db.manager.findOneBy(User, { id: 2 })).toMatchObject({
      active: true,
      password: 'preserve-password',
      authVersion: 1,
      jwtId: null,
    });
    expect(await db.manager.findOneBy(Database, { id: 90 })).toEqual(asset);
    expect(await db.manager.count(RefreshToken)).toBe(1);
    await expect(auth.verifyRefreshToken(refresh)).rejects.toMatchObject({ status: 401 });
    for (const grant of await db.manager.find(EnterpriseResourceGrant))
      expect(grant).toMatchObject({ read: false, edit: false, publish: false, export: false });
    expect((await db.manager.find(EnterpriseResourceGrant)).map(r => r.version).sort()).toEqual([
      4, 5,
    ]);
    for (const entity of [EnterpriseDashboardDelivery, EnterpriseGroupDelivery])
      expect((await db.manager.find(entity))[0]).toMatchObject({
        active: false,
        allowCopy: false,
        version: 3,
      });
    expect((await db.manager.find(EnterpriseGroupGrant))[0]).toMatchObject({
      read: false,
      version: 3,
    });
    expect(await db.manager.count(EnterpriseGroupMember)).toBe(0);
    expect(await db.manager.count(EnterpriseEnrollment)).toBe(0);
    expect((await db.manager.find(EnterpriseGroup))[0].version).toBe(2);
    await call('get', `/${row.requestId}`, 2).expect(401);
    await call('get', `/${row.requestId}`, 2, undefined, 1).expect(200);
    const before = await snapshot();
    expect(
      (await call('post', `/${row.requestId}/complete`, 1, terms).expect(201)).body.replayed,
    ).toBe(true);
    await call('post', `/${row.requestId}/complete`, 5, terms).expect(409);
    await call('post', `/${row.requestId}/complete`, 1, {
      ...terms,
      reviewBasis: 'a'.repeat(64),
    }).expect(409);
    expect(await snapshot()).toBe(before);
    const receipt = await db.manager.findOneBy(EnterpriseStaffDeparture, {
      requestId: row.requestId,
    });
    expect(receipt.requestedAuditId).not.toBe(receipt.completedAuditId);
  });
  it('self cancel stays safe after expiration, epoch or organization change, and never undoes completion', async () => {
    const { row } = await create();
    await db.manager.update(User, { id: 2 }, { authVersion: 1 });
    await db.manager.update(EnterpriseMembership, { userId: 2 }, { organizationId: 20 });
    await db.manager.update(
      EnterpriseStaffDeparture,
      { requestId: row.requestId },
      { expiresAt: new Date(0) },
    );
    const body = { expectedVersion: 1, acknowledgedDeparture: true };
    await call('post', `/${row.requestId}/cancel`, 1, body).expect(403);
    expect(
      (await call('post', `/${row.requestId}/cancel`, 2, body, 1).expect(201)).body.status,
    ).toBe('cancelled');
    const before = await snapshot();
    expect(
      (await call('post', `/${row.requestId}/cancel`, 2, body, 1).expect(201)).body.replayed,
    ).toBe(true);
    expect(await snapshot()).toBe(before);
  });
  it.each(['relation', 'epoch', 'organization', 'target-moved', 'deadline'])(
    '%s changes after review reject with no writes',
    async change => {
      const { row, terms } = await prepared();
      if (change === 'relation')
        await db.manager.save(EnterpriseResourceGrant, {
          resourceKind: 'source',
          resourceId: 90,
          recipientId: 2,
          ownerId: 1,
          organizationId: 10,
          version: 1,
          ...rights,
        });
      if (change === 'epoch') await db.manager.update(User, { id: 2 }, { authVersion: 1 });
      if (change === 'organization')
        await db.manager.update(EnterpriseOrganization, { id: 10 }, { version: 2 });
      if (change === 'target-moved')
        await db.manager.update(EnterpriseMembership, { userId: 2 }, { organizationId: 20 });
      if (change === 'deadline')
        await db.manager.update(
          EnterpriseStaffDeparture,
          { requestId: row.requestId },
          { expiresAt: new Date(0) },
        );
      const before = await snapshot();
      await call('post', `/${row.requestId}/complete`, 1, terms).expect(409);
      expect(await snapshot()).toBe(before);
    },
  );
  it('rechecks deadline after awaited work inspection before any mutation', async () => {
    const { row, terms } = await prepared();
    const original = basis.inspectStaffDeparture;
    jest.spyOn(basis, 'inspectStaffDeparture').mockImplementation(async (...args) => {
      const result = await original(...args);
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000000);
      return result;
    });
    const before = await snapshot();
    await call('post', `/${row.requestId}/complete`, 1, terms).expect(409);
    expect(await snapshot()).toBe(before);
  });
  it('late audit failure rolls back membership, epoch, all relations, organization and receipt', async () => {
    await relations();
    const { row, terms } = await prepared(),
      before = await snapshot();
    const original = EntityManager.prototype.save;
    jest
      .spyOn(EntityManager.prototype, 'save')
      .mockImplementation(async function (entity: any, value: any, options: any) {
        if (entity === EnterpriseAuditEvent && value.action === 'member.departure.completed')
          throw new Error('synthetic audit failure');
        return original.call(this, entity, value, options);
      });
    await expect(service.complete(1, 0, row.requestId, terms)).rejects.toThrow(
      'synthetic audit failure',
    );
    expect(await snapshot()).toBe(before);
  });
  it('read outside-snapshot freshness detects current actor revocation and row cancellation', async () => {
    const { row } = await create();
    const original = (service as any).fresh.bind(service);
    let count = 0;
    jest.spyOn(service as any, 'fresh').mockImplementation(async (...args: any[]) => {
      if (++count === 2) await db.manager.update(User, { id: 1 }, { authVersion: 1 });
      return original(...args);
    });
    await call('get', `/${row.requestId}/review`, 1).expect(401);
    jest.restoreAllMocks();
    count = 0;
    jest.spyOn(service as any, 'fresh').mockImplementation(async (...args: any[]) => {
      if (++count === 2)
        await db.manager.update(
          EnterpriseStaffDeparture,
          { requestId: row.requestId },
          { status: 'cancelled', version: 2 },
        );
      return original(...args);
    });
    await call('get', `/${row.requestId}`, 2).expect(409);
  });
  it('migration validates existing schema and refuses incompatible additions', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      const m = new AddStaffDeparture1792620200000();
      await m.up(runner);
      await runner.query('ALTER TABLE enterprise_staff_departure ADD COLUMN unexpected integer');
      await expect(m.up(runner)).rejects.toThrow('preflight');
      await runner.query('ALTER TABLE enterprise_staff_departure DROP COLUMN unexpected');
    } finally {
      await runner.release();
    }
  });
  it.each(['publication', 'export', 'refresh', 'execution', 'handover', 'transfer', 'cleanup'])(
    'blocks %s using private-free fixed count projection',
    async kind => {
      const { row } = await create();
      const future = new Date(Date.now() + 900000);
      if (kind === 'publication')
        await db.manager.save(StudioPublication, {
          token: 'a'.repeat(64),
          actorId: 2,
          dashboardId: 999,
          sourceId: 90,
          version: 1,
          visibility: 'private',
          allowRemix: false,
          expiresAt: null,
          revokedAt: null,
          asOf: '',
          dataVersion: 'b'.repeat(64),
          snapshot: 'private-payload',
          remixTemplate: null,
        });
      if (kind === 'export')
        await db.manager.save(ExportJob, {
          ownerId: 2,
          sourceOwnerId: 1,
          sourceId: 90,
          organizationId: 20,
          requestId: randomUUID(),
          digest: 'a'.repeat(64),
          requestJson: 'private-payload',
          basisJson: '{}',
          status: 'ready',
          version: 1,
          attemptToken: null,
          leaseUntil: null,
          expiresAt: future,
          filename: 'private.csv',
          hash: null,
          errorCode: null,
        });
      if (kind === 'refresh')
        await db.manager.save(FileRefresh, {
          id: randomUUID(),
          actorId: 2,
          sourceId: 90,
          requestId: randomUUID(),
          actorEpoch: 0,
          payloadDigest: 'a'.repeat(64),
          inputDigest: 'b'.repeat(64),
          expectedRevision: 'c'.repeat(64),
          originalname: 'private.csv',
          extension: 'csv',
          status: 'failed',
          leaseToken: null,
          leaseUntil: null,
          storageDigest: 'd'.repeat(64),
          inputRetained: true,
        });
      if (kind === 'execution')
        await db.manager.save(StudioExecution, {
          runId: randomUUID(),
          actorId: 2,
          dashboardId: 999,
          requestId: randomUUID(),
          payloadHash: 'a'.repeat(64),
          status: 'partial',
          state: 'private-payload',
        });
      if (kind === 'handover')
        await db.manager.save(EnterpriseBundleHandover, {
          proposalId: randomUUID(),
          requestId: randomUUID(),
          organizationId: 20,
          ownerId: 1,
          recipientId: 2,
          ownerAuthVersion: 0,
          recipientAuthVersion: 0,
          organizationVersion: 1,
          version: 1,
          status: 'accepted',
          expiresAt: future,
          acceptedAt: null,
          completedAt: null,
          preparedAuditId: 7,
          acceptedAuditId: null,
          completedAuditId: null,
          cancelledAuditId: null,
          manifestJson: 'private-payload',
          basisHash: 'a'.repeat(64),
          custodyHash: 'b'.repeat(64),
          payloadHash: 'c'.repeat(64),
          reviewBasis: 'd'.repeat(64),
        });
      if (kind === 'transfer')
        await db.manager.save(EnterpriseStaffTransfer, {
          userId: 2,
          sourceOrganizationId: 10,
          targetOrganizationId: 20,
          authVersion: 0,
          codeHash: 'a'.repeat(64),
          expiresAt: future,
          acceptedBy: null,
          acceptedEpoch: null,
          targetVersion: null,
          team: '',
          completed: false,
        });
      if (kind === 'cleanup')
        await db.manager.save(SourceDeleteReceipt, {
          actorId: 2,
          organizationId: 20,
          sourceId: 999,
          requestId: randomUUID(),
          expectedRevision: 'a'.repeat(64),
          digest: 'b'.repeat(64),
          filePlan: 'private-payload',
          managedFiles: 1,
          cleanupStatus: 'retry_required',
          cleanupAttempt: null,
          cleanupLeaseUntil: null,
        });
      const before = await snapshot();
      const review = (await call('get', `/${row.requestId}/review`, 1).expect(200)).body;
      expect(review.eligible).toBe(false);
      expect(JSON.stringify(review)).not.toContain('private');
      expect(Object.values(review.counts).filter(n => n === 1)).toHaveLength(1);
      await call('post', `/${row.requestId}/complete`, 1, {
        expectedVersion: 1,
        reviewBasis: review.basis,
        acknowledgedDeparture: true,
      }).expect(409);
      expect(await snapshot()).toBe(before);
    },
  );
  it('blocks last active administrator and unsupported relationship version', async () => {
    const { row } = await create();
    await db.manager.update(User, { id: 1 }, { active: false });
    await db.manager.update(User, { id: 5 }, { active: false });
    await db.manager.update(EnterpriseMembership, { userId: 2 }, { role: 'admin' });
    const state = await basis.inspectStaffDeparture(db.manager, 2, 10);
    expect(state.blockers).toContain('last_admin');
    await db.manager.save(EnterpriseResourceGrant, {
      resourceKind: 'source',
      resourceId: 90,
      ownerId: 1,
      recipientId: 2,
      organizationId: 20,
      version: 2147483647,
      ...rights,
    });
    expect((await basis.inspectStaffDeparture(db.manager, 2, 10)).blockers).toContain(
      'unsupported_state',
    );
    await call('get', `/${row.requestId}/review`, 2).expect(403);
  });
  it('expired intent remains readable, exact creation replay stays historical, and a new UUID requires new consent', async () => {
    const { row, body } = await create();
    await db.manager.update(
      EnterpriseStaffDeparture,
      { requestId: row.requestId },
      { expiresAt: new Date(0) },
    );
    await call('get', `/${row.requestId}`, 2).expect(200);
    await call('get', `/${row.requestId}/review`, 1).expect(409);
    expect((await call('post', '', 2, body).expect(201)).body.replayed).toBe(true);
    await call('post', '', 2, input()).expect(201);
  });
  it('preserves inactive publication history and closed work', async () => {
    await db.manager.save(StudioPublication, {
      token: 'a'.repeat(64),
      actorId: 2,
      dashboardId: 999,
      sourceId: 90,
      version: 1,
      visibility: 'private',
      allowRemix: false,
      expiresAt: null,
      revokedAt: '2020-01-01',
      asOf: '',
      dataVersion: 'b'.repeat(64),
      snapshot: 'private-history',
      remixTemplate: null,
    });
    await db.manager.save(StudioExecution, {
      runId: randomUUID(),
      actorId: 2,
      dashboardId: 999,
      requestId: randomUUID(),
      payloadHash: 'a'.repeat(64),
      status: 'succeeded',
      state: 'private-history',
    });
    const old = await db.manager.find(StudioPublication);
    const { row, terms } = await prepared();
    await call('post', `/${row.requestId}/complete`, 1, terms).expect(201);
    expect(await db.manager.find(StudioPublication)).toEqual(old);
    expect(await db.manager.count(StudioExecution)).toBe(1);
    await call(
      'post',
      `/${row.requestId}/cancel`,
      2,
      { expectedVersion: 1, acknowledgedDeparture: true },
      1,
    ).expect(409);
  });
  mysql(
    'MySQL ownership writer first waits User fence, then stale review cannot leave',
    async () => {
      const { row, terms } = await prepared();
      const writer = db.createQueryRunner();
      await writer.connect();
      await writer.startTransaction('READ COMMITTED');
      await writer.manager.findOne(User, { where: { id: 2 }, lock: { mode: 'pessimistic_write' } });
      await writer.manager.save(UserMapping, { dashboardId: 999, userInfoId: 2 });
      let settled = false;
      const completing = service
        .complete(1, 0, row.requestId, terms)
        .then(
          v => ({ v }),
          e => ({ e }),
        )
        .finally(() => (settled = true));
      try {
        await new Promise(r => setTimeout(r, 100));
        expect(settled).toBe(false);
        await writer.commitTransaction();
        expect(((await completing) as any).e).toMatchObject({ status: 409 });
        expect(await db.manager.findOneBy(EnterpriseMembership, { userId: 2 })).not.toBeNull();
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
        await completing;
      }
    },
  );
  mysql('MySQL grant writer first changes relationship basis after real wait', async () => {
    const { row, terms } = await prepared();
    const writer = db.createQueryRunner();
    await writer.connect();
    await writer.startTransaction('READ COMMITTED');
    await writer.manager.findOne(User, { where: { id: 2 }, lock: { mode: 'pessimistic_write' } });
    await writer.manager.save(EnterpriseResourceGrant, {
      resourceKind: 'source',
      resourceId: 90,
      ownerId: 1,
      recipientId: 2,
      organizationId: 10,
      version: 1,
      ...rights,
    });
    let settled = false;
    const completing = service
      .complete(1, 0, row.requestId, terms)
      .then(
        v => ({ v }),
        e => ({ e }),
      )
      .finally(() => (settled = true));
    try {
      await new Promise(r => setTimeout(r, 100));
      expect(settled).toBe(false);
      await writer.commitTransaction();
      expect(((await completing) as any).e).toMatchObject({ status: 409 });
    } finally {
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      await writer.release();
      await completing;
    }
  });
  mysql(
    'MySQL actual grant service queued behind departure rejects removed member with no resurrection',
    async () => {
      const { row, terms } = await prepared();
      let entered: () => void, release: () => void;
      const held = new Promise<void>(r => (entered = r)),
        gate = new Promise<void>(r => (release = r));
      const original = EntityManager.prototype.delete;
      let paused = false;
      jest
        .spyOn(EntityManager.prototype, 'delete')
        .mockImplementation(async function (entity: any, criteria: any) {
          const result = await original.call(this, entity, criteria);
          if (!paused && entity === EnterpriseMembership && criteria.userId === 2) {
            paused = true;
            entered();
            await gate;
          }
          return result;
        });
      const completing = service.complete(1, 0, row.requestId, terms);
      await held;
      let settled = false;
      const policy = new EnterpriseResourcePolicyService(db);
      const writing = policy
        .set('source', 90, 1, {
          recipientId: 2,
          expectedVersion: 0,
          rights: { read: true, edit: false, publish: false, export: false },
        })
        .then(
          v => ({ v }),
          e => ({ e }),
        )
        .finally(() => (settled = true));
      try {
        await new Promise(r => setTimeout(r, 100));
        expect(settled).toBe(false);
        release();
        await completing;
        expect(((await writing) as any).e).toMatchObject({ status: 403 });
        expect(await db.manager.count(EnterpriseResourceGrant)).toBe(0);
        expect((await db.manager.findOneBy(User, { id: 2 })).authVersion).toBe(1);
      } finally {
        release();
        await writing;
      }
    },
  );
  const dashboards = () =>
    new DashboardService(
      db.getRepository(Dashboard),
      db.getRepository(User),
      db.getRepository(DashboardShare),
      db.getRepository(UserMapping),
      new DashboardWidgetService(
        db.getRepository(DashboardWidget),
        db.getRepository(Widget),
        db.getRepository(Component),
      ),
      undefined,
      undefined,
      db.getRepository(Widget),
      new SourceAccessService(db),
    );
  mysql(
    'MySQL actual empty Dashboard create waits actual departure completion and rejects old epoch',
    async () => {
      const { row, terms } = await prepared();
      let entered: () => void, release: () => void;
      const held = new Promise<void>(r => (entered = r)),
        gate = new Promise<void>(r => (release = r));
      const original = EntityManager.prototype.delete;
      let paused = false;
      jest
        .spyOn(EntityManager.prototype, 'delete')
        .mockImplementation(async function (entity: any, criteria: any) {
          const result = await original.call(this, entity, criteria);
          if (!paused && entity === EnterpriseMembership && criteria.userId === 2) {
            paused = true;
            entered();
            await gate;
          }
          return result;
        });
      const completing = service.complete(1, 0, row.requestId, terms);
      await held;
      let settled = false;
      const creating = dashboards()
        .create({ title: 'After departure', layout: [] }, 2, 0)
        .then(
          v => ({ v }),
          e => ({ e }),
        )
        .finally(() => (settled = true));
      try {
        await new Promise(r => setTimeout(r, 100));
        expect(settled).toBe(false);
        release();
        await completing;
        expect(((await creating) as any).e).toMatchObject({ status: 403 });
        expect(await db.manager.count(UserMapping)).toBe(0);
        expect(await db.manager.count(Dashboard)).toBe(0);
        expect(await db.manager.count(DashboardShare)).toBe(0);
      } finally {
        release();
        await creating;
      }
    },
  );
  mysql(
    'MySQL actual Dashboard create first commits ownership and actual departure rejects stale zero-owned basis',
    async () => {
      const { row, terms } = await prepared();
      let entered: () => void, release: () => void;
      const held = new Promise<void>(r => (entered = r)),
        gate = new Promise<void>(r => (release = r));
      const original = EntityManager.prototype.save;
      let paused = false;
      jest
        .spyOn(EntityManager.prototype, 'save')
        .mockImplementation(async function (entity: any, value: any, options: any) {
          const result = await original.call(this, entity, value, options);
          if (!paused && entity === UserMapping) {
            paused = true;
            entered();
            await gate;
          }
          return result;
        });
      const creating = dashboards().create({ title: 'Before departure', layout: [] }, 2, 0);
      await held;
      let settled = false;
      const completing = service
        .complete(1, 0, row.requestId, terms)
        .then(
          v => ({ v }),
          e => ({ e }),
        )
        .finally(() => (settled = true));
      try {
        await new Promise(r => setTimeout(r, 100));
        expect(settled).toBe(false);
        release();
        await creating;
        expect(((await completing) as any).e).toMatchObject({ status: 409 });
        expect(await db.manager.count(UserMapping)).toBe(1);
        expect((await db.manager.findOneBy(User, { id: 2 })).authVersion).toBe(0);
        expect(await db.manager.findOneBy(EnterpriseMembership, { userId: 2 })).not.toBeNull();
      } finally {
        release();
        await completing;
      }
    },
  );
});
