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
});
