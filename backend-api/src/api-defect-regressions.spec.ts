import { Dataset } from './dataset/entities/dataset.entity';
import { Database } from './database/entities/database.entity';
import { DashboardWidget } from './dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatasetService } from './dataset/dataset.service';
import { ComponentService } from './component/component.service';
import { TemplateService } from './template/template.service';
import { TemplateController } from './template/template.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { ResponseStatus } from './common/enum/response-status.enum';

import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { Dashboard } from './dashboard/entities/dashboard.entity';
import { DashboardShare } from './dashboard/entities/dashboard_share.entity';
import { DashboardDeleteReceipt } from './dashboard/entities/dashboard-delete-receipt.entity';
import { DashboardDeletionService, deletionRevision } from './dashboard/dashboard-deletion.service';
import { DashboardDeletionController } from './dashboard/dashboard-deletion.controller';
import { User } from './user/entities/user.entity';
import { UserMapping } from './user/entities/user-mapping.entity';
import { Widget } from './widget/entities/widget.entity';
import { DatasetType } from './common/enum/dataset-type.enum';
import { EnterpriseMembership } from './enterprise/entities/enterprise-membership.entity';

const repository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  save: jest.fn(async value => ({ id: 1, ...value })),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
});
const layoutItem = { i: 1, x: 0, y: 0, w: 4, h: 3 };

describe('dataset and component persistence regressions', () => {
  it('represents a missing dataset delete as ERROR without writes', async () => {
    const db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, Dataset, Database, Widget],
    }).initialize();
    try {
      await db.manager.insert(User, {
        id: 7,
        userId: 'missing-delete',
        email: 'missing-delete@example.invalid',
        password: 'unused',
        active: true,
        authVersion: 0,
      });
      const datasets = db.getRepository(Dataset),
        widgets = db.getRepository(Widget);
      const removeDataset = jest.spyOn(datasets, 'delete'),
        removeWidget = jest.spyOn(widgets, 'delete');
      const service = new DatasetService(datasets, widgets, {} as any);
      expect(await service.remove(99, 7, 0)).toEqual({
        status: ResponseStatus.ERROR,
        message: 'No exist dataset',
      });
      expect(removeDataset).not.toHaveBeenCalled();
      expect(removeWidget).not.toHaveBeenCalled();
    } finally {
      await db.destroy();
    }
  });

  it('saves the original component id and preserves omitted fields without inserting a DTO', async () => {
    const components = repository();
    components.findOne.mockResolvedValue({
      id: 27,
      type: 'BAR_CHART',
      title: 'old',
      category: 'VERTICAL',
      option: '{"color":"blue"}',
      seq: 3,
    });
    const service = new ComponentService(components as any);
    await service.update(27, { title: 'new' });
    expect(components.save).toHaveBeenCalledTimes(1);
    expect(components.save).toHaveBeenCalledWith({
      id: 27,
      type: 'BAR_CHART',
      title: 'new',
      category: 'VERTICAL',
      option: '{"color":"blue"}',
      seq: 3,
    });
  });

  it('controls missing ids and duplicate existing component types before saving', async () => {
    const components = repository();
    const service = new ComponentService(components as any);
    components.findOne.mockResolvedValueOnce(null);
    await expect(service.update(27, { title: 'new' })).rejects.toBeInstanceOf(NotFoundException);
    components.findOne
      .mockResolvedValueOnce({ id: 27, type: 'BAR_CHART' })
      .mockResolvedValueOnce({ id: 28, type: 'LINE_CHART' });
    await expect(service.update(27, { type: 'LINE_CHART' })).rejects.toMatchObject({ status: 409 });
    expect(components.save).not.toHaveBeenCalled();
  });
});

describe('template bounded GET and pre-write validation regressions', () => {
  let templates: ReturnType<typeof repository>;
  let items: ReturnType<typeof repository>;
  let service: TemplateService;
  beforeEach(() => {
    templates = repository();
    items = repository();
    service = new TemplateService(
      templates as any,
      items as any,
      repository() as any,
      repository() as any,
    );
  });
  const noWrites = () => {
    expect(templates.save).not.toHaveBeenCalled();
    expect(templates.update).not.toHaveBeenCalled();
    expect(items.save).not.toHaveBeenCalled();
    expect(items.delete).not.toHaveBeenCalled();
  };

  it('GET returns the service result with a numeric id and no manual response parameter', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ status: ResponseStatus.SUCCESS, data: { id: 1 } });
    const controller = new TemplateController({ findOne } as any);
    expect(await controller.findOne('1')).toEqual({
      status: ResponseStatus.SUCCESS,
      data: { id: 1 },
    });
    expect(findOne).toHaveBeenCalledWith(1);
    const parameters = Reflect.getMetadata('__routeArguments__', TemplateController, 'findOne');
    expect(Object.keys(parameters).some(key => key.startsWith('1:'))).toBe(false);
  });

  it('returns controlled missing/invalid GET ids without accessing missing properties', async () => {
    templates.findOne.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne(NaN)).rejects.toBeInstanceOf(BadRequestException);
    noWrites();
  });

  it.each([
    null,
    {},
    [null],
    [[]],
    [{}],
    [{ ...layoutItem, x: -1 }],
    [{ ...layoutItem, y: NaN }],
    [{ ...layoutItem, w: 0 }],
    [{ ...layoutItem, h: Infinity }],
  ])('rejects layout %p before any create/update write', async layout => {
    await expect(service.create({ title: 'bad', layout } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.update(1, { title: 'bad', layout } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    noWrites();
  });

  it('does not delete existing template items or create orphans for a missing active template', async () => {
    templates.findOne.mockResolvedValue(null);
    await expect(
      service.update(999, { title: 'unknown', layout: [layoutItem] } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(templates.findOne).toHaveBeenCalledWith({ where: { id: 999, useYn: 'Y' } });
    noWrites();
  });

  it('preserves valid layout dimensions and recommendation categories', async () => {
    templates.findOne.mockResolvedValue({ id: 1, useYn: 'Y' });
    const layout = [{ ...layoutItem, category: 'VERTICAL' }];
    expect((await service.create({ title: 'valid', layout } as any)).status).toBe(
      ResponseStatus.SUCCESS,
    );
    expect(items.save).toHaveBeenCalledWith([
      { templateId: 1, x: 0, y: 0, width: 4, height: 3, recommendCategory: 'VERTICAL' },
    ]);
    expect((await service.update(1, { title: 'valid', layout } as any)).status).toBe(
      ResponseStatus.SUCCESS,
    );
  });

  it('returns a legitimate empty recommendation list without querying an empty IN', async () => {
    expect(await service.findRecommendTemplates([])).toEqual({
      status: ResponseStatus.SUCCESS,
      data: [],
    });
  });
});

describe('dashboard layout, membership and private-owner regressions', () => {
  let db: DataSource;
  let dashboards: any, shares: any, users: any, mappings: any, widgets: any;
  let membership: any;
  let service: DashboardService;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Dashboard,
        DashboardShare,
        User,
        UserMapping,
        Widget,
        EnterpriseMembership,
        DashboardDeleteReceipt,
        DashboardWidget,
      ],
    }).initialize();
    await db.manager.insert(
      User,
      [7, 8].map(id => ({
        id,
        userId: `api-owner-${id}`,
        email: `api-owner-${id}@example.invalid`,
        password: 'unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(Dashboard, {
      id: 17,
      shareId: 9,
      title: 'old',
      layout: JSON.stringify([layoutItem]),
      delYn: 'N',
    });
    await db.manager.insert(UserMapping, { dashboardId: 17, userInfoId: 7 });
    await db.manager.insert(DashboardWidget, { dashboardId: 17, widgetId: 1 });
    await db.manager.insert(Widget, {
      id: 1,
      title: 'Value',
      componentId: 1,
      datasetType: DatasetType.DATASET,
      datasetId: 1,
      option: '{}',
      delYn: 'N',
    });
    dashboards = db.getRepository(Dashboard);
    shares = db.getRepository(DashboardShare);
    users = db.getRepository(User);
    mappings = db.getRepository(UserMapping);
    widgets = db.getRepository(Widget);
    for (const [repo, methods] of [
      [dashboards, ['findOne', 'save', 'delete']],
      [shares, ['findOne', 'save']],
      [users, ['findOne']],
      [mappings, ['findOne']],
      [widgets, ['find']],
    ] as Array<[any, string[]]>)
      for (const method of methods) jest.spyOn(repo, method);
    membership = {
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findWidgets: jest.fn().mockResolvedValue([]),
    };
    service = new DashboardService(
      dashboards,
      users,
      shares,
      mappings,
      membership,
      { findDashboardId: jest.fn().mockResolvedValue([{ dashboardId: 17 }]) } as any,
      {} as any,
      widgets,
      { dashboard: jest.fn(async () => undefined) } as any,
    );
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await db?.destroy();
  });

  it('preserves membership and layout on title-only updates', async () => {
    const result: any = await service.update(17, { dashboardId: 17, title: 'new' });
    expect(result.status).toBe(ResponseStatus.SUCCESS);
    expect(result.data.layout).toEqual([layoutItem]);
    expect(membership.update).not.toHaveBeenCalled();
  });

  it('updates membership only when layout is provided and canonicalizes widget ids', async () => {
    await service.update(17, { layout: [{ ...layoutItem, i: '1' }] } as any);
    expect(membership.update).toHaveBeenCalledWith(
      17,
      { dashboardId: 17, widgetIds: [1] },
      expect.any(EntityManager),
    );
    membership.update.mockClear();
    await service.update(17, { dashboardId: 17, layout: [] });
    expect(membership.update).toHaveBeenCalledWith(
      17,
      { dashboardId: 17, widgetIds: [] },
      expect.any(EntityManager),
    );
  });

  it.each([
    null,
    {},
    [null],
    [[]],
    [{}],
    [{ ...layoutItem, i: 1.5 }],
    [{ ...layoutItem, x: -1 }],
    [{ ...layoutItem, w: 0 }],
    [layoutItem, { ...layoutItem, i: '1' }],
  ])('rejects dashboard layout %p before persistence or membership writes', async layout => {
    await expect(service.create({ title: 'bad', layout } as any, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.update(17, { layout } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(dashboards.save).not.toHaveBeenCalled();
    expect(shares.save).not.toHaveBeenCalled();
    expect(membership.update).not.toHaveBeenCalled();
    expect(membership.create).not.toHaveBeenCalled();
  });

  it('rejects missing widgets before any dashboard creation write', async () => {
    widgets.find.mockResolvedValue([]);
    await expect(service.create({ title: 'bad', layout: [layoutItem] }, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dashboards.save).not.toHaveBeenCalled();
    expect(shares.save).not.toHaveBeenCalled();
  });

  it('keeps dashboard id distinct from share id while retaining UUID and share fields', async () => {
    shares.findOne.mockResolvedValue({
      id: 9,
      uuid: 'unit-uuid',
      shareYn: 'Y',
      shareToken: 'unit-share-token',
    });
    const result = await service.findOne(17, 7);
    expect(result.data).toMatchObject({ id: 17, shareId: 9, uuid: 'unit-uuid', shareYn: 'Y' });
    expect(Boolean(result.data.shareToken)).toBe(true);
    expect(mappings.findOne).toHaveBeenCalledWith({ where: { dashboardId: 17, userInfoId: 7 } });
  });

  it('filters dangling mappings instead of dereferencing a missing dashboard layout', async () => {
    dashboards.findOne.mockResolvedValue(null);
    expect(await service.findAll(7)).toEqual({ status: ResponseStatus.SUCCESS, data: [] });
  });

  it('rejects a missing dashboard and a non-owner without assembling private data', async () => {
    dashboards.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne(999, 7)).rejects.toBeInstanceOf(NotFoundException);
    mappings.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne(17, 8)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.findOne(17, undefined)).rejects.toBeInstanceOf(ForbiddenException);
    expect(membership.findWidgets).not.toHaveBeenCalled();
  });

  it('controller private GET carries the requester and writes/deletes reject before mutations', async () => {
    const access = {
      id: (value: unknown) => {
        const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
        if (!Number.isSafeInteger(parsed) || Number(parsed) <= 0)
          throw new BadRequestException('invalid resource id');
        return Number(parsed);
      },
      // Legacy owner-only fallback: no explicit grant exists for this actor.
      dashboard: jest.fn(async (_id: number, actor: number) => {
        if (actor !== 7) throw new ForbiddenException('not dashboard owner');
      }),
    };
    const controller = new DashboardController(service, access as any, {} as any);
    const req = { user: { accessKeyData: { id: 8 } } };
    mappings.findOne.mockResolvedValue(null);
    await expect(controller.findOne('17', req)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.update('17', { dashboardId: 17, title: 'evil' }, req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // DELETE moved to the impact/revision/identity-bound service; there is no legacy bypass.
    expect((controller as any).remove).toBeUndefined();
    const deletion = new DashboardDeletionController(new DashboardDeletionService(db));
    const row = await db.manager.findOneBy(Dashboard, { id: 17 });
    await expect(deletion.impact('17', req)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      deletion.remove(
        '17',
        {
          requestId: randomUUID(),
          expectedRevision: deletionRevision(row),
          expectedActorId: 8,
          expectedOrganizationId: null,
        },
        req,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await db.manager.count(DashboardDeleteReceipt)).toBe(0);
    expect(await db.manager.findOneBy(Dashboard, { id: 17 })).toEqual(row);
    expect(dashboards.save).not.toHaveBeenCalled();
    expect(dashboards.delete).not.toHaveBeenCalled();
    expect(membership.update).not.toHaveBeenCalled();
    expect(membership.remove).not.toHaveBeenCalled();
  });
});
