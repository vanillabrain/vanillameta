import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryFailedError } from 'typeorm';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request = require('supertest');
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardDeleteReceipt } from '../dashboard/entities/dashboard-delete-receipt.entity';
import { DashboardDeletionService } from '../dashboard/dashboard-deletion.service';
import { DashboardDeletionController } from '../dashboard/dashboard-deletion.controller';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
} from './entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import { DashboardLifecycleService } from './dashboard-lifecycle.service';
import { DashboardLifecycleReceipt } from './entities/dashboard-lifecycle-receipt.entity';
import { DashboardLifecycleController } from './dashboard-lifecycle.controller';
import { AddDashboardLifecycle1792560000000 } from '../migrations/1792560000000-add-dashboard-lifecycle';

const KINDS = [
  'directPermissions',
  'groupPermissions',
  'directDeliveries',
  'groupDeliveries',
  'liveShare',
  'legacyPublications',
  'studioPublications',
  'sharedShareRecords',
];
describe('UC055 actual SQLite/JWT organization dashboard lifecycle', () => {
  const entities = [
    User,
    UserMapping,
    Dashboard,
    Database,
    Dataset,
    Widget,
    DashboardWidget,
    DashboardShare,
    DashboardPublication,
    StudioPublication,
    StudioState,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    EnterpriseResourceGrant,
    EnterpriseGroup,
    EnterpriseGroupGrant,
    EnterpriseGroupMember,
    EnterpriseDashboardDelivery,
    EnterpriseGroupDelivery,
    DashboardLifecycleReceipt,
    DashboardDeleteReceipt,
  ];
  let db: DataSource, service: DashboardLifecycleService, root: string;
  const open = () =>
    new DataSource({
      type: 'sqlite',
      database: path.join(root, 'metadata.db'),
      entities,
      synchronize: false,
    }).initialize();
  const fresh = () => new DashboardLifecycleService(db);
  const input = async (active = false) => {
    const read: any = await service.read(1, 1);
    const current = read.data ?? read;
    return {
      requestId: randomUUID(),
      expectedActorId: 1,
      expectedOrganizationId: 1,
      expectedVersion: current.version,
      expectedRevision: current.revision,
      active,
      acknowledgedImpact: true as const,
    };
  };
  const value = (result: any) => result.data ?? result;
  const counts = async () => [
    await db.manager.count(DashboardLifecycleReceipt),
    await db.manager.count(EnterpriseAuditEvent),
  ];
  const assertNoPrivate = (result: any) =>
    expect(JSON.stringify(result)).not.toMatch(
      /private-secret|SELECT|shareToken|snapshot|connectionConfig|recipientId|groupId|private-url/,
    );
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-dashboard-lifecycle-'));
    db = await open();
    service = fresh();
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    await db.synchronize(true);
    await db.manager.insert(
      User,
      [1, 2, 3, 4].map(id => ({
        id,
        userId: 'synthetic-' + id,
        email: `synthetic-${id}@example.invalid`,
        password: 'unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(EnterpriseMembership, [
      { userId: 1, organizationId: 1, role: 'admin', team: '' },
      { userId: 2, organizationId: 1, role: 'admin', team: '' },
      { userId: 3, organizationId: 2, role: 'admin', team: '' },
    ]);
    await db.manager.insert(
      Database,
      [11, 12].map(id => ({
        id,
        ownerId: id === 11 ? 1 : 2,
        name: 'Synthetic source',
        engine: 'postgres',
        type: 'database',
        catalogActive: true,
        connectionConfig: '{"password":"private-secret"}',
      })),
    );
    await db.manager.insert(Dashboard, [
      {
        id: 1,
        title: 'Synthetic original',
        delYn: 'N',
        layout: '[]',
        analysisDefinition: '{"databaseId":11}',
      },
      {
        id: 3,
        title: 'Independent copy',
        delYn: 'N',
        layout: '[]',
        analysisDefinition: '{"databaseId":12}',
      },
    ]);
    await db.manager.insert(UserMapping, [
      { dashboardId: 1, userInfoId: 1 },
      { dashboardId: 3, userInfoId: 2 },
    ]);
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const dependency = async (kind: string) => {
    if (kind === 'directPermissions')
      await db.manager.insert(EnterpriseResourceGrant, {
        resourceKind: 'dashboard',
        resourceId: 1,
        recipientId: 2,
        organizationId: 1,
        ownerId: 1,
        version: 1,
        read: true,
      });
    if (kind === 'groupPermissions')
      await db.manager.insert(EnterpriseGroupGrant, {
        resourceKind: 'dashboard',
        resourceId: 1,
        groupId: 1,
        organizationId: 1,
        ownerId: 1,
        version: 1,
        read: true,
      });
    if (kind === 'directDeliveries')
      await db.manager.insert(EnterpriseDashboardDelivery, {
        ownerId: 1,
        organizationId: 1,
        dashboardId: 1,
        recipientId: 2,
        version: 1,
        active: true,
      });
    if (kind === 'groupDeliveries')
      await db.manager.insert(EnterpriseGroupDelivery, {
        ownerId: 1,
        organizationId: 1,
        dashboardId: 1,
        groupId: 1,
        version: 1,
        active: true,
      });
    if (kind === 'liveShare' || kind === 'sharedShareRecords') {
      if (!(await db.manager.findOneBy(DashboardShare, { id: 1 })))
        await db.manager.insert(DashboardShare, {
          id: 1,
          uuid: randomUUID(),
          shareYn: 'Y',
          shareToken: 'private-secret',
          endDate: new Date('2099-01-01'),
        });
      await db.manager.update(Dashboard, 1, { shareId: 1 });
      if (kind === 'sharedShareRecords')
        await db.manager.insert(Dashboard, {
          id: 9,
          title: 'Historical shared root',
          shareId: 1,
          delYn: 'Y',
        });
    }
    if (kind === 'legacyPublications')
      await db.manager.insert(DashboardPublication, {
        dashboardId: 1,
        uuid: randomUUID(),
        publisherId: 1,
        sourceId: 11,
        version: 1,
        dashboardRevision: 'fixed',
        snapshot: '{}',
        publishedAt: '2026-01-01',
        expiresAt: '2099-01-01',
        active: true,
        requestId: randomUUID(),
        payloadDigest: 'a'.repeat(64),
      });
    if (kind === 'studioPublications')
      await db.manager.insert(StudioPublication, {
        token: 'a'.repeat(64),
        actorId: 1,
        dashboardId: 1,
        sourceId: 11,
        version: 1,
        visibility: 'private',
        allowRemix: false,
        asOf: 'fixed',
        dataVersion: 'fixed',
        snapshot: '{}',
        revokedAt: null,
      });
  };
  it('returns only the safe fixed eight-impact projection without writes', async () => {
    const result = value(await service.read(1, 1));
    expect(result).toMatchObject({
      dashboardId: 1,
      actorId: 1,
      organizationId: 1,
      active: true,
      version: 0,
    });
    expect(result.dependencies).toEqual(KINDS.map(kind => ({ kind, count: 0 })));
    expect(result.revision).toMatch(/^[a-f0-9]{64}$/);
    assertNoPrivate(result);
    expect(await counts()).toEqual([0, 0]);
  });
  it.each(KINDS)(
    'reports %s impact but permits acknowledged deactivation without touching it',
    async kind => {
      await dependency(kind);
      const before = await Promise.all(
        entities
          .filter(
            e => e !== Dashboard && e !== EnterpriseAuditEvent && e !== DashboardLifecycleReceipt,
          )
          .map(e => db.manager.find(e as any)),
      );
      expect(value(await service.read(1, 1)).dependencies).toContainEqual({ kind, count: 1 });
      const result = value(await service.set(1, 1, await input(false)));
      expect(result).toMatchObject({ active: false, version: 1, replayed: false });
      assertNoPrivate(result);
      expect(
        await Promise.all(
          entities
            .filter(
              e => e !== Dashboard && e !== EnterpriseAuditEvent && e !== DashboardLifecycleReceipt,
            )
            .map(e => db.manager.find(e as any)),
        ),
      ).toEqual(before);
    },
  );
  it('deactivates/restores preserving definitions, sources, widgets, copies and all relationship rows', async () => {
    for (const kind of KINDS) await dependency(kind);
    await db.manager.insert(Dataset, {
      id: 1,
      databaseId: 11,
      title: 'Synthetic',
      query: 'SELECT 1',
    });
    await db.manager.insert(Widget, {
      id: 1,
      title: 'Synthetic',
      componentId: 1,
      datasetType: 'DATASET' as any,
      datasetId: 1,
      option: '{}',
      delYn: 'N',
    });
    await db.manager.insert(DashboardWidget, { dashboardId: 1, widgetId: 1 });
    await db.manager.insert(StudioState, {
      dashboardId: 1,
      legacyRevision: 'fixed',
      document: '{"document":{"schemaVersion":1,"sourceId":11,"blocks":[]}}',
    });
    const graphs = entities.filter(
      e => e !== Dashboard && e !== EnterpriseAuditEvent && e !== DashboardLifecycleReceipt,
    );
    const before = await Promise.all(graphs.map(e => db.manager.find(e as any)));
    const original = await db.manager.findOneByOrFail(Dashboard, { id: 1 });
    const copy = await db.manager.findOneByOrFail(Dashboard, { id: 3 });
    await service.set(1, 1, await input(false));
    expect(await db.manager.findOneByOrFail(Dashboard, { id: 3 })).toEqual(copy);
    await service.set(1, 1, await input(true));
    const restored: any = await db.manager.findOneByOrFail(Dashboard, { id: 1 });
    const definition = (row: any) =>
      Object.fromEntries(
        Object.entries(row).filter(
          ([key]) => !['assetActive', 'assetVersion', 'updatedAt'].includes(key),
        ),
      );
    expect(definition(restored)).toEqual(definition(original));
    expect([restored.assetActive, restored.assetVersion]).toEqual([true, 2]);
    expect(await Promise.all(graphs.map(e => db.manager.find(e as any)))).toEqual(before);
    expect(
      (await db.manager.find(EnterpriseAuditEvent, { order: { id: 'ASC' } })).map(e => [
        e.action,
        e.resourceId,
        e.version,
      ]),
    ).toEqual([
      ['dashboard.deactivate', 1, 1],
      ['dashboard.activate', 1, 2],
    ]);
  });
  it('manages metadata without source read and preserves the inactive source on restoration', async () => {
    await db.manager.update(Database, 11, { ownerId: 2, catalogActive: false });
    await service.set(1, 1, await input(false));
    await service.set(1, 1, await input(true));
    expect((await db.manager.findOneByOrFail(Database, { id: 11 })).catalogActive).toBe(false);
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    await expect(access.dashboard(1, 1, 'read')).rejects.toMatchObject({ status: 403 });
  });
  it.each(['foreignAdmin', 'member', 'legacy', 'inactive', 'epoch', 'duplicateOwner', 'deleted'])(
    'denies %s management without lifecycle writes',
    async boundary => {
      const request = await input();
      let actor = 1;
      if (boundary === 'foreignAdmin') {
        actor = 2;
        request.expectedActorId = 2;
      }
      if (boundary === 'member')
        await db.manager.update(EnterpriseMembership, 1, { role: 'member' });
      if (boundary === 'legacy') await db.manager.delete(EnterpriseMembership, 1);
      if (boundary === 'inactive') await db.manager.update(User, 1, { active: false });
      if (boundary === 'epoch') await db.manager.update(User, 1, { authVersion: 1 });
      if (boundary === 'duplicateOwner')
        await db.manager.insert(UserMapping, { dashboardId: 1, userInfoId: 2 });
      if (boundary === 'deleted') await db.manager.update(Dashboard, 1, { delYn: 'Y' });
      await expect(service.read(1, actor)).rejects.toMatchObject({
        status: boundary === 'epoch' ? 401 : 403,
      });
      await expect(service.set(1, actor, request)).rejects.toMatchObject({
        status: boundary === 'epoch' ? 401 : 403,
      });
      expect(await counts()).toEqual([0, 0]);
    },
  );
  it.each(['actor', 'organization', 'version', 'definition', 'impact'])(
    'rejects changed %s basis before writes',
    async boundary => {
      const request = await input();
      if (boundary === 'actor') request.expectedActorId = 2;
      if (boundary === 'organization')
        await db.manager.update(EnterpriseMembership, 1, { organizationId: 2 });
      if (boundary === 'version') request.expectedVersion++;
      if (boundary === 'definition')
        await db.manager.update(Dashboard, 1, { title: 'Concurrent title' });
      if (boundary === 'impact') await dependency('directPermissions');
      await expect(service.set(1, 1, request)).rejects.toMatchObject({ status: 409 });
      expect(await counts()).toEqual([0, 0]);
    },
  );
  it.each(['dashboard', 'dashboard_lifecycle_receipt', 'enterprise_audit_event'])(
    'rolls back state/version/receipt/audit if %s fails',
    async table => {
      const request = await input();
      await db.query(
        `CREATE TRIGGER lifecycle_failure BEFORE ${
          table === 'dashboard' ? 'UPDATE' : 'INSERT'
        } ON ${table} BEGIN SELECT RAISE(ABORT,'synthetic failure'); END`,
      );
      try {
        await expect(service.set(1, 1, request)).rejects.toThrow();
        expect(await counts()).toEqual([0, 0]);
        expect(await db.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
          assetActive: true,
          assetVersion: 0,
        });
      } finally {
        await db.query('DROP TRIGGER lifecycle_failure');
      }
      await service.set(1, 1, request);
      expect(await counts()).toEqual([1, 1]);
    },
  );
  it('persists exact replay after reconnect and never overwrites a later restoration', async () => {
    const request = await input();
    const first = value(await service.set(1, 1, request));
    await service.set(1, 1, await input(true));
    await db.destroy();
    db = await open();
    service = fresh();
    expect(value(await service.set(1, 1, request))).toMatchObject({
      receiptId: first.receiptId,
      active: false,
      version: 1,
      replayed: true,
    });
    expect(await db.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
      assetActive: true,
      assetVersion: 2,
    });
    expect(await counts()).toEqual([2, 2]);
    await expect(service.set(1, 1, { ...request, active: true })).rejects.toMatchObject({
      status: 409,
    });
    await db.manager.update(EnterpriseMembership, 1, { role: 'member' });
    await expect(service.set(1, 1, request)).rejects.toMatchObject({ status: 403 });
  });
  it('does not reapply historical intent to a newly recreated same-ID dashboard', async () => {
    const request = await input();
    const first = value(await service.set(1, 1, request));
    await db.manager.delete(Dashboard, 1);
    await db.manager.insert(Dashboard, {
      id: 1,
      title: 'Recreated independent state',
      delYn: 'N',
      layout: '[]',
    });
    expect(value(await service.set(1, 1, request))).toMatchObject({
      receiptId: first.receiptId,
      replayed: true,
    });
    expect(await db.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
      title: 'Recreated independent state',
      assetActive: true,
      assetVersion: 0,
    });
    expect(await counts()).toEqual([1, 1]);
  });
  it('rejects exhausted lifecycle version without wrapping or writing', async () => {
    await db.manager.update(Dashboard, 1, { assetVersion: 2147483647 });
    const request = await input();
    await expect(service.set(1, 1, request)).rejects.toMatchObject({ status: 409 });
    expect(await counts()).toEqual([0, 0]);
  });

  it('consumes same-value intent and serializes concurrent exact retries into one receipt', async () => {
    const request = await input(true);
    const results = await Promise.all([service.set(1, 1, request), service.set(1, 1, request)]);
    expect(results.map(r => value(r).replayed).sort()).toEqual([false, true]);
    expect(await counts()).toEqual([1, 1]);
    expect(value(await service.read(1, 1)).version).toBe(1);
  });
  it.each([
    {},
    { active: 'false' },
    { acknowledgedImpact: false },
    { expectedVersion: -1 },
    { extra: true },
  ])('rejects malformed or unacknowledged intent %j', async override => {
    const request = await input();
    await expect(
      service.set(1, 1, Object.keys(override).length ? { ...request, ...override } : {}),
    ).rejects.toMatchObject({ status: 400 });
    expect(await counts()).toEqual([0, 0]);
  });
  it('blocks ordinary owner/grant access and parent writes while inactive but leaves the independent copy usable', async () => {
    await dependency('directPermissions');
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    await access.dashboard(1, 1, 'read');
    await service.set(1, 1, await input(false));
    for (const actor of [1, 2])
      for (const action of ['read', 'edit', 'publish', 'export'] as const)
        await expect(access.dashboard(1, actor, action)).rejects.toMatchObject({ status: 403 });
    await expect(db.transaction(m => lockDashboardWrite(m, 1))).rejects.toMatchObject({
      status: 403,
    });
    await access.dashboard(3, 2, 'read');
    await service.set(1, 1, await input(true));
    await access.dashboard(1, 1, 'read');
  });
  it.each(['ownerAdmin', 'foreignAdmin', 'ownerMember', 'noPolicy'])(
    'limits inactive explicit revocation to current owner admin: %s',
    async kind => {
      await dependency('directPermissions');
      await service.set(1, 1, await input(false));
      await db.manager.update(Database, 11, { ownerId: 2, catalogActive: false });
      if (kind === 'ownerMember')
        await db.manager.update(EnterpriseMembership, 1, { role: 'member' });
      const actor = kind === 'foreignAdmin' ? 2 : 1;
      const access =
        kind === 'noPolicy'
          ? new SourceAccessService(db)
          : new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
      if (kind === 'ownerAdmin')
        await expect(access.dashboardRevocation(1, actor, 'publish')).resolves.toBeUndefined();
      else
        await expect(access.dashboardRevocation(1, actor, 'publish')).rejects.toMatchObject({
          status: 403,
        });
      await expect(access.dashboard(1, actor, 'read')).rejects.toMatchObject({ status: 403 });
      expect(await counts()).toEqual([1, 1]);
    },
  );

  it('migrates legacy rows twice without data loss and enforces durable request uniqueness', async () => {
    const runner = db.createQueryRunner();
    try {
      await runner.dropTable('dashboard_lifecycle_receipt');
      await runner.dropColumn('dashboard', 'assetActive');
      await runner.dropColumn('dashboard', 'assetVersion');
      const before = await db.query(
        'SELECT id,title,layout,analysisDefinition FROM dashboard ORDER BY id',
      );
      const migration = new AddDashboardLifecycle1792560000000();
      await migration.up(runner);
      await migration.up(runner);
      expect(
        await db.query('SELECT id,title,layout,analysisDefinition FROM dashboard ORDER BY id'),
      ).toEqual(before);
      expect(
        (await db.manager.find(Dashboard)).every(
          d => d.assetActive === true && d.assetVersion === 0,
        ),
      ).toBe(true);
      await service.set(1, 1, await input());
      const receipt = {
        ...(await db.manager.findOneByOrFail(DashboardLifecycleReceipt, { dashboardId: 1 })),
      };
      delete receipt.id;
      await expect(db.manager.insert(DashboardLifecycleReceipt, receipt)).rejects.toMatchObject({
        driverError: { code: 'SQLITE_CONSTRAINT' },
      });
      await expect(migration.down()).rejects.toThrow('backup');
    } finally {
      await runner.release();
    }
  });

  it('protects real JWT lifecycle read/set and exact replay with no-store responses', async () => {
    const previous = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = randomUUID();
    const jwt = new JwtService();
    const module = await Test.createTestingModule({
      controllers: [DashboardLifecycleController],
      providers: [
        { provide: DashboardLifecycleService, useValue: service },
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
        { accessKeyData: { id, userId: 'synthetic-' + id, authVersion: 0 } },
        { secret: process.env.ACCESS_SECRET },
      );
    const url = '/enterprise/resources/dashboard/1/lifecycle';
    try {
      const server = app.getHttpServer();
      await request(server).get(url).expect(401);
      await request(server).get(url).set('Authorization', token(2)).expect(403);
      const read = await request(server)
        .get(url)
        .set('Authorization', token(1))
        .expect('Cache-Control', 'no-store')
        .expect(200);
      assertNoPrivate(read.body);
      const payload = await input();
      const first = await request(server)
        .post(url)
        .set('Authorization', token(1))
        .send(payload)
        .expect('Cache-Control', 'no-store')
        .expect(200);
      const replay = await request(server)
        .post(url)
        .set('Authorization', token(1))
        .send(payload)
        .expect(200);
      expect(value(replay.body)).toMatchObject({
        receiptId: value(first.body).receiptId,
        replayed: true,
      });
      await db.manager.update(User, 1, { authVersion: 1 });
      await request(server).get(url).set('Authorization', token(1)).expect(401);
      await request(server).post(url).set('Authorization', token(1)).send(payload).expect(401);
    } finally {
      await app.close();
      if (previous === undefined) delete process.env.ACCESS_SECRET;
      else process.env.ACCESS_SECRET = previous;
    }
  });

  it('JWT distinguishes stale intent from injected transient transaction failure and safely replays the committed receipt', async () => {
    const previous = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = randomUUID();
    const jwt = new JwtService();
    const module = await Test.createTestingModule({
      controllers: [DashboardLifecycleController],
      providers: [
        { provide: DashboardLifecycleService, useValue: service },
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    // Use the same default Nest exception filter as the other JWT unit integration tests.
    const app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    const token =
      'Bearer ' +
      jwt.sign(
        { accessKeyData: { id: 1, userId: 'synthetic-1', authVersion: 0 } },
        { secret: process.env.ACCESS_SECRET },
      );
    const url = '/enterprise/resources/dashboard/1/lifecycle';
    let transaction: jest.SpyInstance | undefined;
    try {
      const server = app.getHttpServer(),
        payload = await input(false);
      const committed = await request(server)
        .post(url)
        .set('Authorization', token)
        .send(payload)
        .expect(200);
      const before = await Promise.all(entities.map(e => db.manager.find(e as any)));
      // A fresh UUID with the consumed basis is a definitive conflict, not an unknown commit result.
      const stale = await request(server)
        .post(url)
        .set('Authorization', token)
        .send({ ...payload, requestId: randomUUID() })
        .expect(409);
      expect(stale.body.code).toBe('DASHBOARD_LIFECYCLE_STALE');
      // Driver-shaped failure is injected at the transaction boundary of the actual SQLite/JWT path.
      // This does not exercise or claim an actual InnoDB deadlock.
      transaction = jest
        .spyOn(db, 'transaction')
        .mockRejectedValueOnce(
          new QueryFailedError(
            'synthetic transaction',
            [],
            Object.assign(new Error('synthetic contention'), { code: 'ER_LOCK_DEADLOCK' }),
          ),
        );
      const uncertain = await request(server)
        .post(url)
        .set('Authorization', token)
        .send(payload)
        .expect(409);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(uncertain.body.code).toBe('DASHBOARD_LIFECYCLE_RETRY_REQUIRED');
      expect(await Promise.all(entities.map(e => db.manager.find(e as any)))).toEqual(before);
      transaction.mockRestore();
      transaction = undefined;
      const replay = await request(server)
        .post(url)
        .set('Authorization', token)
        .send(payload)
        .expect(200);
      expect(value(replay.body)).toMatchObject({
        receiptId: value(committed.body).receiptId,
        requestId: payload.requestId,
        active: false,
        version: 1,
        replayed: true,
      });
      expect(await Promise.all(entities.map(e => db.manager.find(e as any)))).toEqual(before);
      expect(await counts()).toEqual([1, 1]);
    } finally {
      transaction?.mockRestore();
      await app.close();
      if (previous === undefined) delete process.env.ACCESS_SECRET;
      else process.env.ACCESS_SECRET = previous;
    }
  });

  const deletionHttp = async () => {
    const previous = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = randomUUID();
    const jwt = new JwtService(),
      deletion = new DashboardDeletionService(db);
    const module = await Test.createTestingModule({
      controllers: [DashboardDeletionController],
      providers: [
        { provide: DashboardDeletionService, useValue: deletion },
        { provide: DataSource, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    return {
      server: app.getHttpServer(),
      token: (epoch = 0) =>
        'Bearer ' +
        jwt.sign(
          { accessKeyData: { id: 1, userId: 'synthetic-1', authVersion: epoch } },
          { secret: process.env.ACCESS_SECRET },
        ),
      close: async () => {
        await app.close();
        if (previous === undefined) delete process.env.ACCESS_SECRET;
        else process.env.ACCESS_SECRET = previous;
      },
    };
  };
  const deletionBody = (impact: any, organizationId = impact.organizationId) => ({
    requestId: randomUUID(),
    expectedActorId: 1,
    expectedOrganizationId: organizationId,
    expectedRevision: impact.revision,
  });

  it.each(['demotion', 'membershipRemoval'])(
    'JWT inactive deletion impact and NEW DELETE reject %s403 without modifying any rows',
    async boundary => {
      await service.set(1, 1, await input(false));
      const http = await deletionHttp();
      try {
        const prior = await request(http.server)
          .get('/dashboard/1/delete-impact')
          .set('Authorization', http.token())
          .expect('Cache-Control', 'no-store')
          .expect(200);
        if (boundary === 'demotion')
          await db.manager.update(EnterpriseMembership, 1, { role: 'member' });
        else await db.manager.delete(EnterpriseMembership, { userId: 1 });
        await db.manager.update(User, 1, { authVersion: 1 });
        const before = await Promise.all(entities.map(e => db.manager.find(e as any)));
        // Match the new current organization to prove denial is the inactive management guard,
        // rather than a stale organization-body409 or stale JWT401.
        const body = deletionBody(value(prior.body), boundary === 'membershipRemoval' ? null : 1);
        await request(http.server)
          .get('/dashboard/1/delete-impact')
          .set('Authorization', http.token(1))
          .expect(403);
        await request(http.server)
          .delete('/dashboard/1')
          .set('Authorization', http.token(1))
          .send(body)
          .expect(403);
        expect(await Promise.all(entities.map(e => db.manager.find(e as any)))).toEqual(before);
        expect(await db.manager.count(DashboardDeleteReceipt)).toBe(0);
        expect(await counts()).toEqual([1, 1]);
      } finally {
        await http.close();
      }
    },
  );

  it('JWT active dashboard owner-member retains existing impact and reviewed deletion rights', async () => {
    await db.manager.update(EnterpriseMembership, 1, { role: 'member' });
    await db.manager.update(User, 1, { authVersion: 1 });
    const http = await deletionHttp();
    try {
      const impact = await request(http.server)
        .get('/dashboard/1/delete-impact')
        .set('Authorization', http.token(1))
        .expect('Cache-Control', 'no-store')
        .expect(200);
      const result = await request(http.server)
        .delete('/dashboard/1')
        .set('Authorization', http.token(1))
        .send(deletionBody(value(impact.body)))
        .expect('Cache-Control', 'no-store')
        .expect(200);
      expect(value(result.body)).toMatchObject({ dashboardId: 1, deleted: true, replayed: false });
      expect(await db.manager.findOneBy(Dashboard, { id: 1 })).toBeNull();
      expect(await db.manager.findOneByOrFail(Dashboard, { id: 3 })).toMatchObject({
        assetActive: true,
      });
      expect(await db.manager.count(DashboardDeleteReceipt)).toBe(1);
      expect(await db.manager.count(DashboardLifecycleReceipt)).toBe(0);
    } finally {
      await http.close();
    }
  });

  it('JWT historical inactive deletion receipt replays after same-org demotion with a fresh epoch', async () => {
    await service.set(1, 1, await input(false));
    const http = await deletionHttp();
    try {
      const impact = await request(http.server)
        .get('/dashboard/1/delete-impact')
        .set('Authorization', http.token())
        .expect(200);
      const body = deletionBody(value(impact.body));
      const first = await request(http.server)
        .delete('/dashboard/1')
        .set('Authorization', http.token())
        .send(body)
        .expect(200);
      await db.manager.update(EnterpriseMembership, 1, { role: 'member' });
      await db.manager.update(User, 1, { authVersion: 1 });
      const before = await Promise.all(entities.map(e => db.manager.find(e as any)));
      const replay = await request(http.server)
        .delete('/dashboard/1')
        .set('Authorization', http.token(1))
        .send(body)
        .expect(200);
      expect(value(replay.body)).toMatchObject({
        receiptId: value(first.body).receiptId,
        deleted: true,
        replayed: true,
      });
      expect(await Promise.all(entities.map(e => db.manager.find(e as any)))).toEqual(before);
      expect(await db.manager.findOneBy(Dashboard, { id: 1 })).toBeNull();
      expect(await db.manager.count(DashboardDeleteReceipt)).toBe(1);
    } finally {
      await http.close();
    }
  });
});
