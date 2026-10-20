jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
import { DataSource, EntityManager } from 'typeorm';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { DatasetService } from '../dataset/dataset.service';
import { WidgetService } from './widget.service';
import { Widget } from './entities/widget.entity';
import { TableQuery } from './tabel-query/entity/table-query.entity';
import { TableQueryService } from './tabel-query/table-query.service';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { SourceAccessService } from '../ownership/source-access.service';

describe('UC051 Widget/Dataset DELETE fresh authorization', () => {
  let db: DataSource, widget: WidgetService, dataset: DatasetService;
  const entities = [
    User,
    Database,
    Dataset,
    Widget,
    TableQuery,
    Dashboard,
    DashboardWidget,
    UserMapping,
    EnterpriseMembership,
  ];
  beforeEach(async () => {
    db = await semanticMetadata('handover', {
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    });
    for (const entity of [...entities].reverse())
      await db.manager.createQueryBuilder().delete().from(entity).execute();
    for (const id of [1, 2])
      await db.manager.save(User, {
        id,
        userId: `delete${id}`,
        email: `delete${id}@example.invalid`,
        password: 'synthetic',
      });
    await db.manager.save(Database, {
      id: 11,
      ownerId: 1,
      name: 'Source',
      engine: 'pg',
      type: 'postgresql',
      connectionConfig: '{}',
    });
    await db.manager.save(Dataset, { id: 21, databaseId: 11, query: 'SELECT 1' });
    await db.manager.save(TableQuery, { id: 22, databaseId: 11, query: 'SELECT 1' });
    await db.manager.save(Dashboard, { id: 31, title: 'Parent' });
    await db.manager.save(UserMapping, { dashboardId: 31, userInfoId: 1 });
    for (const [id, datasetType, datasetId] of [
      [41, DatasetType.DATASET, 21],
      [42, DatasetType.TABLE, 22],
    ] as const) {
      await db.manager.save(Widget, { id, componentId: 1, datasetType, datasetId, option: '{}' });
      await db.manager.save(DashboardWidget, { dashboardId: 31, widgetId: id });
    }
    widget = new WidgetService(
      db.getRepository(Widget),
      {} as any,
      new TableQueryService(db.getRepository(TableQuery), db.getRepository(Database)),
    );
    dataset = new DatasetService(db.getRepository(Dataset), db.getRepository(Widget), {} as any);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    if (db?.isInitialized) await db.destroy();
  });
  const remove = (kind: string, actor?: number, epoch?: number) =>
    kind === 'dataset'
      ? dataset.remove(21, actor, epoch)
      : widget.remove(kind === 'table' ? 42 : 41, actor, epoch);

  it.each(['dataset', 'widget', 'table'])(
    '%s rejects absent actor and stale epoch without deleting metadata',
    async kind => {
      await expect(remove(kind)).rejects.toMatchObject({ status: 403 });
      await db.manager.update(User, 1, { authVersion: 1 });
      await expect(remove(kind, 1, 0)).rejects.toMatchObject({ status: 403 });
      expect(await db.manager.count(Widget)).toBe(2);
      expect(await db.manager.count(Dataset)).toBe(1);
      expect(await db.manager.count(TableQuery)).toBe(1);
    },
  );
  it.each(['dataset', 'widget', 'table'])(
    '%s preserves legitimate delete behavior and unrelated source metadata',
    async kind => {
      await remove(kind, 1, 0);
      expect(await db.manager.count(Database)).toBe(1);
      expect(await db.manager.count(Widget)).toBe(1);
      expect(await db.manager.count(Dataset)).toBe(kind === 'dataset' ? 0 : 1);
      expect(await db.manager.count(TableQuery)).toBe(kind === 'table' ? 0 : 1);
    },
  );
  it.each(['dataset', 'widget', 'table'])(
    '%s denies old owner after ownership transfer; recipient can delete',
    async kind => {
      await db.manager.update(Database, 11, { ownerId: 2 });
      await db.manager.update(UserMapping, { dashboardId: 31 }, { userInfoId: 2 });
      await expect(remove(kind, 1, 0)).rejects.toMatchObject({ status: 403 });
      expect(await db.manager.count(Widget)).toBe(2);
      await remove(kind, 2, 0);
      expect(await db.manager.count(Widget)).toBe(1);
    },
  );
  it.each(['dataset', 'widget', 'table'])(
    '%s locks User then sorted Dashboards then Source then children',
    async kind => {
      await db.manager.save(Dashboard, { id: 30, title: 'Earlier parent' });
      await db.manager.save(DashboardWidget, {
        dashboardId: 30,
        widgetId: kind === 'table' ? 42 : 41,
      });
      const order: string[] = [];
      const original = EntityManager.prototype.findOne;
      jest
        .spyOn(EntityManager.prototype, 'findOne')
        .mockImplementation(function (entity: any, options: any) {
          order.push(`${entity.name}:${options.where.id}`);
          return original.call(this, entity, options);
        });
      await remove(kind, 1, 0);
      const fences = order.filter(
        value =>
          value.startsWith('User:') ||
          value.startsWith('Dashboard:') ||
          value.startsWith('Database:'),
      );
      expect(fences).toEqual(['User:1', 'Dashboard:30', 'Dashboard:31', 'Database:11']);
      expect(order.slice(order.indexOf('Database:11') + 1)).toContain(
        `Widget:${kind === 'table' ? 42 : 41}`,
      );
    },
  );
  it.each(['dataset', 'table'])(
    '%s rolls back dependent metadata deletion if Widget deletion fails',
    async kind => {
      const original = EntityManager.prototype.delete;
      jest
        .spyOn(EntityManager.prototype, 'delete')
        .mockImplementation(function (entity: any, criteria: any) {
          if (entity === Widget) throw new Error('injected Widget delete failure');
          return original.call(this, entity, criteria);
        });
      await expect(remove(kind, 1, 0)).rejects.toThrow('injected Widget delete failure');
      expect(await db.manager.count(Dataset)).toBe(1);
      expect(await db.manager.count(TableQuery)).toBe(1);
      expect(await db.manager.count(Widget)).toBe(2);
    },
  );
  const mysql = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
  mysql.each(['dataset', 'widget', 'table'])(
    '%s: old-owner guard passes, DELETE waits transfer User fence then returns 403',
    async kind => {
      await new SourceAccessService(db).assert(
        kind === 'dataset' ? 'dataset' : 'widget',
        kind === 'dataset' ? 21 : kind === 'table' ? 42 : 41,
        1,
      );
      const transfer = db.createQueryRunner();
      await transfer.connect();
      await transfer.startTransaction('READ COMMITTED');
      await transfer.manager.findOne(User, {
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });
      await transfer.manager.findOne(Dashboard, {
        where: { id: 31 },
        lock: { mode: 'pessimistic_write' },
      });
      await transfer.manager.findOne(Database, {
        where: { id: 11 },
        lock: { mode: 'pessimistic_write' },
      });
      for (const id of [41, 42])
        await transfer.manager.findOne(Widget, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
      await transfer.manager.findOne(Dataset, {
        where: { id: 21 },
        lock: { mode: 'pessimistic_write' },
      });
      await transfer.manager.update(Database, 11, { ownerId: 2 });
      await transfer.manager.update(UserMapping, { dashboardId: 31 }, { userInfoId: 2 });
      let entered: () => void;
      const starting = new Promise<void>(resolve => {
        entered = resolve;
      });
      const original = EntityManager.prototype.findOne;
      jest
        .spyOn(EntityManager.prototype, 'findOne')
        .mockImplementation(function (entity: any, options: any) {
          if (entity === User && options.lock && this !== transfer.manager) entered();
          return original.call(this, entity, options);
        });
      let settled = false;
      const deleting = remove(kind, 1, 0)
        .then(
          value => ({ value }),
          error => ({ error }),
        )
        .finally(() => {
          settled = true;
        });
      try {
        await starting;
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
        expect(settled).toBe(false);
        await transfer.commitTransaction();
        expect(((await deleting) as any).error).toMatchObject({ status: 403 });
        expect(await db.manager.count(Widget)).toBe(2);
        expect(await db.manager.count(Dataset)).toBe(1);
        expect(await db.manager.count(TableQuery)).toBe(1);
        await remove(kind, 2, 0);
      } finally {
        if (transfer.isTransactionActive) await transfer.rollbackTransaction();
        await deleting;
        await transfer.release();
      }
    },
  );
});
