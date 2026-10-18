import { DataSource, EntityManager } from 'typeorm';
import { DashboardService } from './dashboard.service';
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
import { DatasetType } from '../common/enum/dataset-type.enum';
import { SourceAccessService } from '../ownership/source-access.service';

describe('DashboardService actual transaction fixture', () => {
  let db: DataSource, service: DashboardService, links: DashboardWidgetService;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Dashboard,
        DashboardShare,
        DashboardWidget,
        User,
        UserMapping,
        Widget,
        Dataset,
        Database,
        Component,
      ],
    }).initialize();
    await db.manager.insert(User, {
      id: 7,
      userId: 'layout-owner',
      email: 'layout@example.invalid',
      password: 'unused',
    });
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 7,
      name: 'Synthetic',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.manager.insert(Dataset, {
      id: 1,
      databaseId: 1,
      title: 'Synthetic',
      query: 'SELECT 1',
    });
    await db.manager.insert(Component, {
      id: 1,
      title: 'Value',
      type: 'BOARD_NUMERIC',
      option: '{}',
      useYn: 'Y',
    });
    await db.manager.insert(
      Widget,
      [10, 20].map(id => ({
        id,
        title: 'Value',
        componentId: 1,
        datasetType: DatasetType.DATASET,
        datasetId: 1,
        option: '{}',
        delYn: 'N',
      })),
    );
    await db.manager.insert(Dashboard, {
      id: 42,
      title: 'Synthetic',
      analysisDefinition: JSON.stringify({ databaseId: 1 }),
      layout: '[]',
    });
    await db.manager.insert(UserMapping, { dashboardId: 42, userInfoId: 7 });
    await db.manager.insert(
      DashboardWidget,
      [10, 20].map(widgetId => ({ dashboardId: 42, widgetId })),
    );
    links = new DashboardWidgetService(
      db.getRepository(DashboardWidget),
      db.getRepository(Widget),
      db.getRepository(Component),
    );
    service = new DashboardService(
      db.getRepository(Dashboard),
      db.getRepository(User),
      db.getRepository(DashboardShare),
      db.getRepository(UserMapping),
      links,
      undefined,
      undefined,
      db.getRepository(Widget),
      new SourceAccessService(db),
    );
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await db?.destroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each(['assetActive', 'assetVersion'])(
    'rejects raw lifecycle field %s on generic create/update before any writes',
    async field => {
      const before = await db.manager.find(Dashboard);
      await expect(
        service.create(
          { title: 'Injected', layout: [], [field]: field === 'assetActive' ? false : 99 } as any,
          7,
        ),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.update(
          42,
          { title: 'Injected', [field]: field === 'assetActive' ? true : 0 } as any,
          7,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(await db.manager.find(Dashboard)).toEqual(before);
      expect(await db.manager.count(DashboardShare)).toBe(0);
    },
  );
  it('creates only active epoch-zero assets and keeps ordinary legacy fields working', async () => {
    const result = await service.create(
      { title: 'Normal', layout: [], legacyUnused: true } as any,
      7,
    );
    expect(typeof result !== 'string' && result.data).toMatchObject({
      assetActive: true,
      assetVersion: 0,
    });
    await service.update(42, { title: 'Ordinary edit', legacyUnused: true } as any, 7);
    expect(await db.manager.findOneBy(Dashboard, { id: 42 })).toMatchObject({
      title: 'Ordinary edit',
      assetActive: true,
      assetVersion: 0,
    });
    await db.manager.update(Dashboard, 42, { assetActive: false, assetVersion: 1 });
    await expect(service.update(42, { title: 'Must fail' } as any, 7)).rejects.toMatchObject({
      status: 403,
    });
  });
  it('UC-006 keeps analysis mapping order when a grid save reorders presentation entries', async () => {
    const update = links.update.bind(links);
    const spy = jest.spyOn(links, 'update').mockImplementation(async (id, body, manager) => {
      expect(manager.queryRunner.isTransactionActive).toBe(true);
      return update(id, body, manager);
    });
    const layout = [
      { i: '20', x: 0, y: 3, w: 6, h: 2 },
      { i: '10', x: 6, y: 8, w: 6, h: 4 },
    ];
    await service.update(42, { layout } as any);
    expect(spy).toHaveBeenCalledWith(
      42,
      { dashboardId: 42, widgetIds: [10, 20] },
      expect.any(EntityManager),
    );
    const row = await db.manager.findOneBy(Dashboard, { id: 42 });
    expect(JSON.parse(row.layout)).toEqual(layout);
    expect(
      (await db.manager.find(DashboardWidget, { order: { id: 'ASC' } })).map(link => link.widgetId),
    ).toEqual([10, 20]);
  });
  it('keeps a concurrently enabled organization policy when a legacy edit resumes', async () => {
    await db.manager.insert(Dashboard, { id: 43, title: 'Old', layout: '[]', governed: false });
    jest.spyOn(links, 'update').mockImplementationOnce(async (_id, _body, manager) => {
      expect(manager.queryRunner.isTransactionActive).toBe(true);
      await manager.update(Dashboard, 43, { governed: true });
    });
    const result = await service.update(43, { title: 'New', layout: [] } as any);
    expect(await db.manager.findOneBy(Dashboard, { id: 43 })).toMatchObject({
      title: 'New',
      governed: true,
    });
    expect((result as any).data.governed).toBe(true);
  });
});
