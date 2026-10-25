jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { DataSource, EntityManager } from 'typeorm';
import { StudioPublicationService } from '../dashboard-studio/studio-publication.service';
import { sourceWriteTransaction } from '../database/source-write-lock';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
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
const suite = process.env.VM_UC055_LIFECYCLE_MYSQL_CONFIG ? describe : describe.skip;
suite('UC055 owned MySQL8.4 organization dashboard lifecycle', () => {
  jest.setTimeout(15000);
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
  ];
  let db: DataSource, peer: DataSource, service: DashboardLifecycleService, config: any;
  const open = () =>
    new DataSource({
      type: 'mysql',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      entities,
      timezone: 'Z',
      logging: false,
      extra: { connectionLimit: 5, connectTimeout: 5000 },
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
    const file = process.env.VM_UC055_LIFECYCLE_MYSQL_CONFIG;
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
      (fs.statSync(file).mode & 0o077) !== 0 ||
      config.gate !== 'owned-uc055-dashboard-lifecycle-v1' ||
      process.env.VM_UC055_LIFECYCLE_MYSQL_OWNER !== config.owner ||
      !/^[a-f0-9]{24}$/.test(config.owner) ||
      config.host !== '127.0.0.1' ||
      !Number.isInteger(config.port) ||
      config.port < 1024 ||
      config.port > 65535 ||
      config.database !== 'vm_uc055_lifecycle_' + config.owner ||
      !config.serverUuid ||
      !config.password ||
      config.username !== 'root'
    )
      throw new Error('Refusing non-owned MySQL lifecycle fixture');
    db = await open();
    peer = await open();
    for (const ds of [db, peer]) {
      const [id] = await ds.query(
        'SELECT VERSION() AS version, @@server_uuid AS uuid, DATABASE() AS db',
      );
      if (!/^8\.4\./.test(id.version) || id.uuid !== config.serverUuid || id.db !== config.database)
        throw new Error('Unexpected MySQL identity');
      const [marker] = await ds.query('SELECT token FROM uc055_fixture_owner');
      if (marker?.token !== config.owner) throw new Error('Unexpected fixture ownership marker');
    }
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
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (peer?.isInitialized) await peer.destroy();
    if (db?.isInitialized) await db.destroy();
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
  const gate = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => {
      resolve = done;
    });
    return { promise, resolve: () => resolve() };
  };
  const settled = (p: Promise<any>) =>
    p.then(
      value => ({ value }),
      error => ({ error }),
    );
  const waitForLock = async (table: 'dashboard' | 'user') => {
    const end = Date.now() + 5000;
    while (Date.now() < end) {
      const waits = await peer.query(
        `SELECT l.OBJECT_NAME FROM performance_schema.data_lock_waits w
      JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID
      WHERE l.OBJECT_SCHEMA=? AND l.OBJECT_NAME=?`,
        [config.database, table],
      );
      if (waits.length) {
        console.info(JSON.stringify({ phase: 'observed-InnoDB-wait', table }));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`No actual InnoDB ${table} lock wait observed`);
  };
  const waitForDashboard = () => waitForLock('dashboard');
  const waitForUser = () => waitForLock('user');
  const lifecycleBarrier = () => {
    const entered = gate(),
      resume = gate(),
      original = db.createQueryRunner.bind(db);
    jest.spyOn(db, 'createQueryRunner').mockImplementation(mode => {
      const runner = original(mode),
        update = runner.manager.update.bind(runner.manager);
      runner.manager.update = (async (entity: any, criteria: any, changes: any) => {
        const result = await update(entity, criteria, changes);
        if (entity === Dashboard && changes.assetActive === false) {
          entered.resolve();
          await resume.promise;
        }
        return result;
      }) as typeof runner.manager.update;
      return runner;
    });
    return { entered, resume };
  };
  const grantBody = () => ({
    recipientId: 2,
    expectedVersion: 0,
    rights: { read: true, edit: true, publish: false, export: false },
  });

  it('deactivates/restores with eight impacts while preserving source and relationship graphs', async () => {
    for (const kind of KINDS) await dependency(kind);
    const graph = entities.filter(
      e => e !== Dashboard && e !== EnterpriseAuditEvent && e !== DashboardLifecycleReceipt,
    );
    const before = await Promise.all(graph.map(e => peer.manager.find(e as any)));
    const copy = await peer.manager.findOneByOrFail(Dashboard, { id: 3 });
    const read = value(await service.read(1, 1));
    expect(read.dependencies).toEqual(KINDS.map(kind => ({ kind, count: 1 })));
    assertNoPrivate(read);
    await service.set(1, 1, await input());
    await service.set(1, 1, await input(true));
    expect(await peer.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
      assetActive: true,
      assetVersion: 2,
    });
    expect(await peer.manager.findOneByOrFail(Dashboard, { id: 3 })).toEqual(copy);
    expect(await Promise.all(graph.map(e => peer.manager.find(e as any)))).toEqual(before);
    expect(await counts()).toEqual([2, 2]);
  });
  it.each(['owner', 'epoch', 'organization'])(
    'rejects current %s mismatch with no writes',
    async kind => {
      const request = await input();
      let actor = 1;
      if (kind === 'owner') {
        actor = 2;
        request.expectedActorId = 2;
      }
      if (kind === 'epoch') await peer.manager.update(User, 1, { authVersion: 1 });
      if (kind === 'organization')
        await peer.manager.update(EnterpriseMembership, 1, { organizationId: 2 });
      await expect(service.set(1, actor, request)).rejects.toMatchObject({
        status: kind === 'owner' ? 403 : kind === 'epoch' ? 401 : 409,
      });
      expect(await counts()).toEqual([0, 0]);
    },
  );
  it.each(['dashboard', 'dashboard_lifecycle_receipt', 'enterprise_audit_event'])(
    'rolls back real MySQL %s failure before commit',
    async table => {
      const request = await input();
      await db.query(`CREATE TRIGGER lifecycle_failure BEFORE ${
        table === 'dashboard' ? 'UPDATE' : 'INSERT'
      }
        ON \`${table}\` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'`);
      try {
        await expect(service.set(1, 1, request)).rejects.toThrow();
        expect(await counts()).toEqual([0, 0]);
        expect(await peer.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
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
  it('migrates legacy MySQL rows twice, preserving definitions and unique requests', async () => {
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
      expect(value(await service.read(1, 1))).toMatchObject({ active: true, version: 0 });
      await service.set(1, 1, await input());
      const receipt = {
        ...(await db.manager.findOneByOrFail(DashboardLifecycleReceipt, { dashboardId: 1 })),
      };
      delete receipt.id;
      await expect(db.manager.insert(DashboardLifecycleReceipt, receipt)).rejects.toMatchObject({
        driverError: { code: 'ER_DUP_ENTRY' },
      });
    } finally {
      await runner.release();
    }
  });
  it('replays durable receipt after reconnect without undoing later restoration', async () => {
    const request = await input();
    const first = value(await service.set(1, 1, request));
    await service.set(1, 1, await input(true));
    await db.destroy();
    db = await open();
    service = fresh();
    expect(value(await service.set(1, 1, request))).toMatchObject({
      receiptId: first.receiptId,
      version: 1,
      active: false,
      replayed: true,
    });
    expect(await peer.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
      assetActive: true,
      assetVersion: 2,
    });
    expect(await counts()).toEqual([2, 2]);
  });
  it('serializes exact concurrent retries across two DataSources into one state change', async () => {
    const request = await input(),
      other = new DashboardLifecycleService(peer);
    const result = await Promise.all([service.set(1, 1, request), other.set(1, 1, request)]);
    expect(result.map(r => value(r).replayed).sort()).toEqual([false, true]);
    expect(await counts()).toEqual([1, 1]);
  });
  it('save-first holds actual Dashboard lock then lifecycle rejects changed definition409', async () => {
    const request = await input(),
      writer = peer.createQueryRunner();
    await writer.connect();
    await writer.startTransaction('READ COMMITTED');
    let changing: Promise<any> | undefined;
    try {
      await lockDashboardWrite(writer.manager, 1);
      await writer.manager.update(Dashboard, 1, { title: 'Concurrent saved title' });
      changing = settled(service.set(1, 1, request));
      await waitForDashboard();
      await writer.commitTransaction();
      expect((await changing).error).toMatchObject({ status: 409 });
      expect(await counts()).toEqual([0, 0]);
      expect(await peer.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
        title: 'Concurrent saved title',
        assetActive: true,
        assetVersion: 0,
      });
    } finally {
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      if (changing) await changing;
      await writer.release();
    }
  });
  it('lifecycle-first makes ordinary save wait then rejects inactive before title write', async () => {
    const request = await input(),
      barrier = lifecycleBarrier();
    const changing = settled(service.set(1, 1, request));
    let saving: Promise<any> | undefined;
    try {
      await Promise.race([
        barrier.entered.promise,
        changing.then(() => {
          throw new Error('Lifecycle ended before barrier');
        }),
      ]);
      saving = settled(
        peer.transaction('READ COMMITTED', async m => {
          await lockDashboardWrite(m, 1);
          await m.update(Dashboard, 1, { title: 'Must not persist' });
        }),
      );
      await waitForDashboard();
      barrier.resume.resolve();
      const changed = await changing;
      if (!('value' in changed)) throw changed.error;
      expect(value(changed.value).active).toBe(false);
      expect((await saving).error).toMatchObject({ status: 403 });
      expect(await peer.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
        title: 'Synthetic original',
        assetActive: false,
        assetVersion: 1,
      });
      expect(await counts()).toEqual([1, 1]);
    } finally {
      barrier.resume.resolve();
      await changing;
      if (saving) await saving;
    }
  });
  it('actual permission writer first commits new impact then waiting lifecycle rejects409', async () => {
    const request = await input(),
      entered = gate(),
      resume = gate(),
      original = peer.createQueryRunner.bind(peer);
    jest.spyOn(peer, 'createQueryRunner').mockImplementation(mode => {
      const runner = original(mode),
        find = runner.manager.findOne.bind(runner.manager);
      runner.manager.findOne = (async (entity: any, options: any) => {
        const row = await find(entity, options);
        if (entity === Dashboard && options?.lock?.mode === 'pessimistic_write') {
          entered.resolve();
          await resume.promise;
        }
        return row;
      }) as typeof runner.manager.findOne;
      return runner;
    });
    const granting = settled(
      new EnterpriseResourcePolicyService(peer).set('dashboard', 1, 1, grantBody()),
    );
    let changing: Promise<any> | undefined;
    try {
      await Promise.race([
        entered.promise,
        granting.then(() => {
          throw new Error('Grant ended before barrier');
        }),
      ]);
      changing = settled(service.set(1, 1, request));
      // Both writers fence User before Dashboard; retain a real observed wait.
      await waitForUser();
      resume.resolve();
      const grant = await granting;
      if (!('value' in grant)) throw grant.error;
      expect((await changing).error).toMatchObject({ status: 409 });
      expect(await peer.manager.count(DashboardLifecycleReceipt)).toBe(0);
      expect(await peer.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
        assetActive: true,
        assetVersion: 0,
      });
      expect(
        await peer.manager.findOneByOrFail(EnterpriseResourceGrant, {
          resourceKind: 'dashboard',
          resourceId: 1,
          recipientId: 2,
        }),
      ).toMatchObject({ read: true, version: 1 });
    } finally {
      resume.resolve();
      await granting;
      if (changing) await changing;
    }
  });
  it('lifecycle-first serializes actual permission management without reopening inactive access', async () => {
    const request = await input(),
      barrier = lifecycleBarrier(),
      changing = settled(service.set(1, 1, request));
    let granting: Promise<any> | undefined;
    try {
      await Promise.race([
        barrier.entered.promise,
        changing.then(() => {
          throw new Error('Lifecycle ended before barrier');
        }),
      ]);
      granting = settled(
        new EnterpriseResourcePolicyService(peer).set('dashboard', 1, 1, grantBody()),
      );
      // Both writers fence User before Dashboard; retain a real observed wait.
      await waitForUser();
      barrier.resume.resolve();
      const changed = await changing;
      if (!('value' in changed)) throw changed.error;
      const grant = await granting;
      if (!('value' in grant)) throw grant.error;
      const access = new SourceAccessService(peer, new EnterpriseResourcePolicyService(peer));
      await expect(access.dashboard(1, 2, 'read')).rejects.toMatchObject({ status: 403 });
      expect(await peer.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
        assetActive: false,
        assetVersion: 1,
      });
      expect(await peer.manager.count(DashboardLifecycleReceipt)).toBe(1);
    } finally {
      barrier.resume.resolve();
      await changing;
      if (granting) await granting;
    }
  });

  it('actual requireRemix refreshes publication after Dashboard wait and blocks the downstream copy insert', async () => {
    const token = 'b'.repeat(64);
    await db.manager.insert(StudioPublication, {
      token,
      actorId: 1,
      dashboardId: 1,
      sourceId: 11,
      version: 1,
      visibility: 'link',
      allowRemix: true,
      expiresAt: null,
      revokedAt: null,
      asOf: 'synthetic',
      dataVersion: 'synthetic',
      snapshot: '{}',
      remixTemplate: '{"synthetic":true}',
    });
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    // No Studio execution/aggregate is run. Its authorization seam delegates to actual DB policy.
    const studio = {
      assertExecutionAccess: async (
        id: number,
        sourceId: number,
        actor: number,
        action: 'publish',
        manager: EntityManager,
      ) => {
        await access.dashboard(id, actor, action, manager);
        await access.assert('database', sourceId, actor, 'read', manager);
      },
    };
    const publications = new StudioPublicationService(db, studio as any, access);
    // Prove the fixture is initially usable through the real critical method.
    expect(await publications.requireRemix(token, 2, 1)).toMatchObject({
      version: 1,
      allowRemix: true,
    });
    const before = await peer.manager.find(Dashboard, { order: { id: 'ASC' } });
    const copyInsert = jest.fn(async (manager: EntityManager) =>
      manager.insert(Dashboard, {
        id: 33,
        title: 'Must not create copy',
        delYn: 'N',
        layout: '[]',
      }),
    );
    const blocker = peer.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction('READ COMMITTED');
    let copying: Promise<any> | undefined;
    try {
      await lockDashboardWrite(blocker.manager, 1);
      // Production helper is real; this bounded wrapper is not full StudioRemixService.save.
      copying = settled(
        sourceWriteTransaction(db, async manager => {
          await publications.requireRemix(token, 2, 1, manager);
          await copyInsert(manager);
        }),
      );
      await waitForDashboard();
      await blocker.manager.update(
        StudioPublication,
        { token },
        {
          revokedAt: new Date().toISOString(),
          allowRemix: false,
          version: 2,
        },
      );
      await blocker.commitTransaction();
      expect((await copying).error).toMatchObject({ status: 410 });
      expect(copyInsert).not.toHaveBeenCalled();
      expect(await peer.manager.findOneBy(Dashboard, { id: 33 })).toBeNull();
      expect(await peer.manager.find(Dashboard, { order: { id: 'ASC' } })).toEqual(before);
      expect(await peer.manager.findOneByOrFail(Dashboard, { id: 1 })).toMatchObject({
        assetActive: true,
        assetVersion: 0,
      });
      expect(await peer.manager.findOneByOrFail(StudioPublication, { token })).toMatchObject({
        version: 2,
        allowRemix: false,
        revokedAt: expect.any(String),
      });
      expect(await counts()).toEqual([0, 0]);
    } finally {
      if (blocker.isTransactionActive) await blocker.rollbackTransaction();
      if (copying) await copying;
      await blocker.release();
    }
  });

  it('actual revoke refreshes publication after Dashboard wait and preserves the committed republish fields', async () => {
    const token = 'c'.repeat(64);
    await db.manager.insert(StudioPublication, {
      token,
      actorId: 1,
      dashboardId: 1,
      sourceId: 11,
      version: 1,
      visibility: 'link',
      allowRemix: true,
      expiresAt: null,
      revokedAt: null,
      asOf: 'generation1',
      dataVersion: 'generation1',
      snapshot: '{"generation":1}',
      remixTemplate: '{"generation":1}',
    });
    const original = await peer.manager.findOneByOrFail(StudioPublication, { token });
    const dashboards = await peer.manager.find(Dashboard, { order: { id: 'ASC' } });
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    // Only Studio's metadata coordinator is a callback seam. revoke/transactions/access are real.
    const studio = { serializeWrite: jest.fn(async (run: () => Promise<unknown>) => run()) };
    const publications = new StudioPublicationService(db, studio as any, access);
    const latest = {
      version: 2,
      snapshot: '{"generation":2,"widgets":[]}',
      allowRemix: false,
      remixTemplate: '{"generation":2}',
      asOf: 'generation2',
      dataVersion: 'generation2',
      visibility: 'private' as const,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const blocker = peer.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction('READ COMMITTED');
    let revoking: Promise<any> | undefined;
    try {
      await lockDashboardWrite(blocker.manager, 1);
      revoking = settled(publications.revoke(token, 1));
      await waitForDashboard();
      await blocker.manager.update(StudioPublication, { token }, latest);
      await blocker.commitTransaction();
      const result = await revoking;
      if (!('value' in result)) throw result.error;
      expect(result.value).toMatchObject({
        token,
        version: 2,
        allowRemix: false,
        visibility: 'private',
        revokedAt: expect.any(String),
      });
      const current = await peer.manager.findOneByOrFail(StudioPublication, { token });
      expect(current).toMatchObject({
        ...latest,
        token,
        actorId: 1,
        sourceId: 11,
        dashboardId: 1,
        revokedAt: expect.any(String),
        createdAt: original.createdAt,
      });
      expect(Number.isFinite(Date.parse(current.revokedAt))).toBe(true);
      expect(await peer.manager.find(Dashboard, { order: { id: 'ASC' } })).toEqual(dashboards);
      expect(studio.serializeWrite).toHaveBeenCalledTimes(1);
      expect(await counts()).toEqual([0, 0]);
    } finally {
      if (blocker.isTransactionActive) await blocker.rollbackTransaction();
      if (revoking) await revoking;
      await blocker.release();
    }
  });
});
