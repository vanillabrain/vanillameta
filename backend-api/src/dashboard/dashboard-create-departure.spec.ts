import { DataSource, EntityManager } from 'typeorm';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardShare } from './entities/dashboard_share.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Database } from '../database/entities/database.entity';
import { Component } from '../component/entities/component.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { SourceAccessService } from '../ownership/source-access.service';
import { SourceOwnershipGuard } from '../ownership/source-ownership.guard';
import { lockSourceActor, sourceWriteTransaction } from '../database/source-write-lock';

const empty = { title: 'New personal dashboard', layout: [] };
const populated = { title: 'New linked dashboard', layout: [{ i: 10, x: 0, y: 0, w: 6, h: 3 }] };

describe('UC051 generic Dashboard create departure fence', () => {
  let db: DataSource, service: DashboardService;
  const entities = [
    User,
    Database,
    Dataset,
    Component,
    Widget,
    Dashboard,
    DashboardShare,
    UserMapping,
    DashboardWidget,
    EnterpriseMembership,
  ];
  const counts = () =>
    Promise.all(
      [Dashboard, DashboardShare, UserMapping, DashboardWidget].map(e => db.manager.count(e)),
    );
  beforeAll(async () => {
    db = await semanticMetadata('departure', {
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities,
    });
  });
  beforeEach(async () => {
    for (const entity of [...entities].reverse())
      await db.getRepository(entity).createQueryBuilder().delete().execute();
    await db.manager.insert(User, {
      id: 7,
      userId: 'create-owner',
      email: 'create@example.invalid',
      password: 'synthetic',
      authVersion: 0,
    });
    await db.manager.insert(EnterpriseMembership, { userId: 7, organizationId: 1, role: 'member' });
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 7,
      name: 'Synthetic',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.manager.insert(Dataset, { id: 1, databaseId: 1, query: 'SELECT 1' });
    await db.manager.insert(Component, {
      id: 1,
      title: 'Value',
      type: 'BOARD_NUMERIC',
      option: '{}',
      useYn: 'Y',
    });
    await db.manager.insert(Widget, {
      id: 10,
      componentId: 1,
      datasetType: DatasetType.DATASET,
      datasetId: 1,
      option: '{}',
    });
    service = new DashboardService(
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
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  const create = (body: typeof empty | typeof populated, actor: number, epoch?: number) =>
    service.create(body, actor, epoch);

  it.each([empty, populated])(
    'rejects stale epoch for $title without asset/share/mapping/link writes',
    async body => {
      await db.manager.update(User, 7, { authVersion: 1 });
      await expect(create(body, 7, 0)).rejects.toMatchObject({ status: 403 });
      expect(await counts()).toEqual([0, 0, 0, 0]);
    },
  );
  it.each([undefined, null, 0, -1, '7', 999])(
    'rejects absent/invalid actor %s rather than creating an unowned asset',
    async actor => {
      await expect(create(empty, actor as number, 0)).rejects.toMatchObject({ status: 403 });
      expect(await counts()).toEqual([0, 0, 0, 0]);
    },
  );
  it('rejects an inactive actor before writing an empty dashboard', async () => {
    await db.manager.update(User, 7, { active: false });
    await expect(create(empty, 7, 0)).rejects.toMatchObject({ status: 403 });
    expect(await counts()).toEqual([0, 0, 0, 0]);
  });
  it.each([empty, populated])(
    'preserves default epoch-zero create and current epoch create for $title',
    async body => {
      await create(body, 7);
      await db.manager.update(User, 7, { authVersion: 2 });
      await create(body, 7, 2);
      expect(await counts()).toEqual([2, 2, 2, body.layout.length * 2]);
      expect((await db.manager.find(UserMapping)).every(row => row.userInfoId === 7)).toBe(true);
      expect((await db.manager.find(DashboardShare)).every(row => row.shareYn === 'N')).toBe(true);
    },
  );
  it('acquires User before canonical Dashboard parent locks and preserves existing widget reuse', async () => {
    await db.manager.insert(Dashboard, { id: 42, title: 'Owned parent', layout: '[]' });
    await db.manager.insert(UserMapping, { dashboardId: 42, userInfoId: 7 });
    await db.manager.insert(DashboardWidget, { dashboardId: 42, widgetId: 10 });
    const observed: string[] = [];
    const original = EntityManager.prototype.findOne;
    jest
      .spyOn(EntityManager.prototype, 'findOne')
      .mockImplementation(function (entity: any, options: any) {
        if (this.queryRunner?.isTransactionActive && [User, Dashboard].includes(entity))
          observed.push(entity.name);
        return original.call(this, entity, options);
      });
    await create(populated, 7, 0);
    expect(observed[0]).toBe('User');
    expect(observed).toContain('Dashboard');
    expect(await counts()).toEqual([2, 1, 2, 2]);
  });
  it.each([3, undefined])(
    'controller propagates JWT epoch %s, defaults legacy epoch to zero, and retains both guards',
    async epoch => {
      const save = jest.fn().mockResolvedValue('saved');
      const controller = new DashboardController({ create: save } as any, {} as any, {} as any);
      expect(
        await controller.create(empty, { user: { accessKeyData: { id: 7, authVersion: epoch } } }),
      ).toBe('saved');
      expect(save).toHaveBeenCalledWith(empty, 7, epoch ?? 0);
      expect(
        Reflect.getMetadata('__guards__', DashboardController).map(guard => guard.name),
      ).toEqual(['JwtAuthGuard', 'SourceOwnershipGuard']);
    },
  );

  const mysql = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
  const waitForDatabaseWait = async () => {
    for (let i = 0; i < 100; i++) {
      const [row] = await db.query('SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits');
      if (Number(row.n) > 0) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Expected an actual InnoDB lock wait');
  };
  mysql(
    'departure first: guard-passed empty create waits User, then 403 with no asset/share/mapping/links',
    async () => {
      // A real departure is eligible only after all owned sources/mappings are gone.
      await db.manager.delete(Widget, 10);
      await db.manager.delete(Dataset, 1);
      await db.manager.delete(Database, 1);
      const guard = new SourceOwnershipGuard(new SourceAccessService(db));
      expect(
        await guard.canActivate({
          getClass: () => DashboardController,
          getHandler: () => DashboardController.prototype.create,
          switchToHttp: () => ({
            getRequest: () => ({
              method: 'POST',
              body: empty,
              user: { accessKeyData: { id: 7, authVersion: 0 } },
            }),
          }),
        } as any),
      ).toBe(true);
      const departure = db.createQueryRunner();
      await departure.connect();
      await departure.startTransaction('READ COMMITTED');
      await lockSourceActor(departure.manager, 7, 0);
      expect(await departure.manager.countBy(UserMapping, { userInfoId: 7 })).toBe(0);
      await departure.manager.delete(EnterpriseMembership, { userId: 7 });
      await departure.manager.update(User, 7, { authVersion: 1, jwtId: null });
      const creating = create(empty, 7, 0).then(
        value => ({ value }),
        error => ({ error }),
      );
      try {
        await waitForDatabaseWait();
        await departure.commitTransaction();
        expect(((await creating) as any).error).toMatchObject({ status: 403 });
        expect(await counts()).toEqual([0, 0, 0, 0]);
        expect(await db.manager.findOneBy(User, { id: 7 })).toMatchObject({
          active: true,
          authVersion: 1,
        });
      } finally {
        if (departure.isTransactionActive) await departure.rollbackTransaction();
        await creating;
        await departure.release();
      }
    },
  );
  mysql(
    'create first: departure User fence waits, then owned-asset count blocks departure',
    async () => {
      let entered: () => void, release: () => void;
      const held = new Promise<void>(resolve => {
        entered = resolve;
      });
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const original = EntityManager.prototype.save;
      jest
        .spyOn(EntityManager.prototype, 'save')
        .mockImplementation(async function (entity: any, ...args: any[]) {
          const result = await original.call(this, entity, ...args);
          if (entity === UserMapping) {
            entered();
            await gate;
          }
          return result;
        } as any);
      const creating = create(empty, 7, 0);
      await held;
      // Bounded integration: same departure identity fence and fresh owned-asset check.
      const departing = sourceWriteTransaction(db.manager, async manager => {
        await lockSourceActor(manager, 7, 0);
        const owned = await manager.countBy(UserMapping, { userInfoId: 7 });
        if (owned > 0) return { blocked: true, owned };
        await manager.delete(EnterpriseMembership, { userId: 7 });
        await manager.update(User, 7, { authVersion: 1 });
        return { blocked: false, owned };
      });
      try {
        await waitForDatabaseWait();
        release();
        await creating;
        expect(await departing).toEqual({ blocked: true, owned: 1 });
        expect(await counts()).toEqual([1, 1, 1, 0]);
        expect(await db.manager.countBy(EnterpriseMembership, { userId: 7 })).toBe(1);
        expect(await db.manager.findOneBy(User, { id: 7 })).toMatchObject({ authVersion: 0 });
      } finally {
        release();
        await creating;
        await departing;
      }
    },
  );
});
