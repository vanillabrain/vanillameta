jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DataSource, EntityManager } from 'typeorm';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { StudioExecutionService } from './studio-execution.service';
import { StudioExecutionController } from './studio-execution.controller';
import { StudioExecution } from './entities/studio-execution.entity';
import { StudioRun } from './entities/studio-run.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Database } from '../database/entities/database.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { lockSourceActor, sourceWriteTransaction } from '../database/source-write-lock';

/** Actual admission and grant policy; execution launch is held at the external-work boundary. */
describe('UC051 Studio execution admission departure fence', () => {
  let db: DataSource,
    service: StudioExecutionService,
    studio: any,
    body: any,
    launch: jest.SpyInstance;
  const entities = [
    User,
    UserMapping,
    Dashboard,
    DashboardWidget,
    Database,
    StudioExecution,
    StudioRun,
    EnterpriseMembership,
    EnterpriseResourceGrant,
    EnterpriseGroup,
    EnterpriseGroupMember,
    EnterpriseGroupGrant,
  ];
  beforeAll(async () => {
    db = await semanticMetadata('departure', {
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    });
  });
  beforeEach(async () => {
    for (const entity of [...entities].reverse())
      await db.getRepository(entity).createQueryBuilder().delete().execute();
    for (const id of [1, 7]) {
      await db.manager.insert(User, {
        id,
        userId: `admit-${id}`,
        email: `admit-${id}@example.invalid`,
        password: 'synthetic',
      });
      await db.manager.insert(EnterpriseMembership, {
        userId: id,
        organizationId: 1,
        role: id === 1 ? 'admin' : 'member',
      });
    }
    await db.manager.insert(Database, {
      id: 7,
      ownerId: 1,
      name: 'Other owner source',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.manager.insert(Dashboard, {
      id: 1,
      title: 'Other owner dashboard',
      analysisDefinition: JSON.stringify({ databaseId: 7 }),
    });
    await db.manager.insert(UserMapping, { dashboardId: 1, userInfoId: 1 });
    for (const [resourceKind, resourceId] of [
      ['source', 7],
      ['dashboard', 1],
    ] as const)
      await db.manager.insert(EnterpriseResourceGrant, {
        resourceKind,
        resourceId,
        ownerId: 1,
        recipientId: 7,
        organizationId: 1,
        version: 1,
        read: true,
        edit: resourceKind === 'dashboard',
      });
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    studio = {
      assertExecutionAccess: jest.fn(
        async (id, sourceId, actor, action = 'read', manager = db.manager) => {
          await access.dashboard(id, actor, action, manager);
          await access.assert('database', sourceId, actor, 'read', manager);
        },
      ),
    };
    service = new StudioExecutionService(db, studio, {} as any);
    launch = jest
      .spyOn(service as any, 'launch')
      .mockImplementation(async (row: StudioExecution) => ({
        runId: row.runId,
        status: row.status,
      }));
    const document = JSON.parse(
      readFileSync(resolve(__dirname, '../../../fixtures/studio/document-v1.json'), 'utf8'),
    );
    document.dashboardId = 1;
    body = {
      requestId: 'departure-admission',
      dashboardId: 1,
      expectedRevision: document.revision,
      expectedSourceRevision: 'b'.repeat(64),
      clientEditVersion: 0,
      document,
      prompt: 'Change title',
    };
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  const admit = (epoch?: number, signal?: AbortSignal) => service.create(body, 7, signal, epoch);
  const owns = async (manager = db.manager) =>
    (await manager.countBy(Database, { ownerId: 7 })) +
    (await manager.countBy(UserMapping, { userInfoId: 7 }));

  it('admits a real granted editor with zero owned assets and default epoch zero', async () => {
    expect(await owns()).toBe(0);
    expect(await admit()).toMatchObject({ status: 'pending' });
    expect(await db.manager.count(StudioExecution)).toBe(1);
    expect(launch).toHaveBeenCalledTimes(1);
  });
  it.each(['stale', 'inactive'])(
    'rejects %s actor after the preliminary access check with no journal or launch',
    async kind => {
      await db.manager.update(User, 7, kind === 'stale' ? { authVersion: 1 } : { active: false });
      if (kind === 'inactive') studio.assertExecutionAccess.mockResolvedValue(undefined);
      await expect(admit(0)).rejects.toMatchObject({ status: 403 });
      expect(await db.manager.count(StudioExecution)).toBe(0);
      expect(launch).not.toHaveBeenCalled();
    },
  );
  it('accepts the current nonzero epoch and locks User before Dashboard and Source', async () => {
    await db.manager.update(User, 7, { authVersion: 2 });
    const observed: string[] = [];
    const original = EntityManager.prototype.findOne;
    jest
      .spyOn(EntityManager.prototype, 'findOne')
      .mockImplementation(function (entity: any, options: any) {
        if (this.queryRunner?.isTransactionActive && [User, Dashboard, Database].includes(entity))
          observed.push(entity.name);
        return original.call(this, entity, options);
      });
    await admit(2);
    expect(observed.slice(0, 3)).toEqual(['User', 'Dashboard', 'Database']);
  });
  it('does not admit a disconnected request', async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(admit(0, abort.signal)).rejects.toBeDefined();
    expect(await db.manager.count(StudioExecution)).toBe(0);
    expect(launch).not.toHaveBeenCalled();
  });
  it.each([3, undefined])(
    'controller forwards epoch %s after the existing AbortSignal argument',
    async epoch => {
      const create = jest.fn().mockResolvedValue('admitted');
      const controller = new StudioExecutionController({ create } as any);
      const req = Object.assign(new EventEmitter(), {
        user: { accessKeyData: { id: 7, authVersion: epoch } },
      });
      const res = Object.assign(new EventEmitter(), { writableFinished: true });
      expect(await controller.create(body, req, res)).toBe('admitted');
      expect(create).toHaveBeenCalledWith(body, 7, expect.any(AbortSignal), epoch ?? 0);
      expect(req.listenerCount('aborted')).toBe(0);
      expect(res.listenerCount('close')).toBe(0);
    },
  );
  const mysql = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
  const waitForLock = async () => {
    for (let i = 0; i < 100; i++) {
      const [row] = await db.query('SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits');
      if (Number(row.n) > 0) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Expected an actual InnoDB lock wait');
  };
  mysql(
    'departure first: pre-authorized editor waits User then gets 403 with no StudioExecution row',
    async () => {
      expect(await owns()).toBe(0);
      await studio.assertExecutionAccess(1, 7, 7, 'edit');
      const departure = db.createQueryRunner();
      await departure.connect();
      await departure.startTransaction('READ COMMITTED');
      await lockSourceActor(departure.manager, 7, 0);
      expect(
        await departure.manager.countBy(StudioExecution, { actorId: 7, status: 'pending' }),
      ).toBe(0);
      await departure.manager.update(User, 7, { authVersion: 1, jwtId: null });
      await departure.manager.delete(EnterpriseMembership, { userId: 7 });
      const admitting = admit(0).then(
        value => ({ value }),
        error => ({ error }),
      );
      try {
        await waitForLock();
        await departure.commitTransaction();
        expect(((await admitting) as any).error).toMatchObject({ status: 403 });
        expect(await db.manager.count(StudioExecution)).toBe(0);
        expect(launch).not.toHaveBeenCalled();
      } finally {
        if (departure.isTransactionActive) await departure.rollbackTransaction();
        await admitting;
        await departure.release();
      }
    },
  );
  mysql(
    'admission first: zero-owner editor admission blocks departure via the committed pending execution',
    async () => {
      let entered: () => void, release: () => void;
      const held = new Promise<void>(r => {
        entered = r;
      });
      const gate = new Promise<void>(r => {
        release = r;
      });
      const original = EntityManager.prototype.save;
      jest
        .spyOn(EntityManager.prototype, 'save')
        .mockImplementation(async function (entity: any, ...args: any[]) {
          const result = await original.call(this, entity, ...args);
          if (entity === StudioExecution) {
            entered();
            await gate;
          }
          return result;
        } as any);
      const admitting = admit(0);
      await held;
      const departing = sourceWriteTransaction(db.manager, async manager => {
        await lockSourceActor(manager, 7, 0);
        const owned = await owns(manager);
        const open = await manager.countBy(StudioExecution, { actorId: 7, status: 'pending' });
        if (owned || open) return { blocked: true, owned, open };
        await manager.update(User, 7, { authVersion: 1 });
        return { blocked: false, owned, open };
      });
      try {
        await waitForLock();
        release();
        await admitting;
        expect(await departing).toEqual({ blocked: true, owned: 0, open: 1 });
        expect(await db.manager.findOneBy(User, { id: 7 })).toMatchObject({ authVersion: 0 });
      } finally {
        release();
        await admitting;
        await departing;
      }
    },
  );
  mysql(
    'execution launch does not retain the admission User lock during external work',
    async () => {
      let entered: () => void, release: () => void;
      const held = new Promise<void>(r => {
        entered = r;
      });
      const gate = new Promise<void>(r => {
        release = r;
      });
      launch.mockImplementation(async row => {
        entered();
        await gate;
        return { runId: row.runId };
      });
      const admitting = admit(0);
      await held;
      try {
        await sourceWriteTransaction(db.manager, async manager => {
          await manager.query('SET innodb_lock_wait_timeout = 1');
          await lockSourceActor(manager, 7, 0);
          expect(await manager.countBy(StudioExecution, { actorId: 7 })).toBe(1);
        });
      } finally {
        release();
        await admitting;
      }
    },
  );
});
