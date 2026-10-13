import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatasetService } from './dataset/dataset.service';
import { ComponentService } from './component/component.service';
import { TemplateService } from './template/template.service';
import { TemplateController } from './template/template.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { ResponseStatus } from './common/enum/response-status.enum';

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
    const datasets = repository();
    const widgets = repository();
    datasets.findOne.mockResolvedValue(null);
    const service = new DatasetService(datasets as any, widgets as any, {} as any);
    expect(await service.remove(99)).toEqual({
      status: ResponseStatus.ERROR,
      message: 'No exist dataset',
    });
    expect(datasets.delete).not.toHaveBeenCalled();
    expect(widgets.delete).not.toHaveBeenCalled();
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
  let dashboards: ReturnType<typeof repository>;
  let shares: ReturnType<typeof repository>;
  let users: ReturnType<typeof repository>;
  let mappings: ReturnType<typeof repository>;
  let widgets: ReturnType<typeof repository>;
  let membership: any;
  let service: DashboardService;
  beforeEach(() => {
    dashboards = repository();
    shares = repository();
    users = repository();
    mappings = repository();
    widgets = repository();
    dashboards.findOne.mockImplementation(async () => ({
      id: 17,
      shareId: 9,
      title: 'old',
      layout: JSON.stringify([layoutItem]),
      delYn: 'N',
    }));
    users.findOne.mockResolvedValue({ id: 7 });
    mappings.findOne.mockResolvedValue({ dashboardId: 17, userInfoId: 7 });
    widgets.find.mockResolvedValue([{ id: 1 }]);
    membership = {
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findWidgets: jest.fn().mockResolvedValue([]),
    };
    service = new DashboardService(
      dashboards as any,
      users as any,
      shares as any,
      mappings as any,
      membership,
      { findDashboardId: jest.fn().mockResolvedValue([{ dashboardId: 17 }]) } as any,
      {} as any,
      widgets as any,
    );
  });

  it('preserves membership and layout on title-only updates', async () => {
    const result: any = await service.update(17, { dashboardId: 17, title: 'new' });
    expect(result.status).toBe(ResponseStatus.SUCCESS);
    expect(result.data.layout).toEqual([layoutItem]);
    expect(membership.update).not.toHaveBeenCalled();
  });

  it('updates membership only when layout is provided and canonicalizes widget ids', async () => {
    await service.update(17, { layout: [{ ...layoutItem, i: '1' }] } as any);
    expect(membership.update).toHaveBeenCalledWith(17, { dashboardId: 17, widgetIds: [1] });
    membership.update.mockClear();
    await service.update(17, { dashboardId: 17, layout: [] });
    expect(membership.update).toHaveBeenCalledWith(17, { dashboardId: 17, widgetIds: [] });
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
    const controller = new DashboardController(service, {} as any, {} as any);
    const req = { user: { accessKeyData: { id: 8 } } };
    mappings.findOne.mockResolvedValue(null);
    await expect(controller.findOne('17', req)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.update('17', { dashboardId: 17, title: 'evil' }, req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.remove('17', req)).rejects.toBeInstanceOf(ForbiddenException);
    expect(dashboards.save).not.toHaveBeenCalled();
    expect(dashboards.delete).not.toHaveBeenCalled();
    expect(membership.update).not.toHaveBeenCalled();
    expect(membership.remove).not.toHaveBeenCalled();
  });
});
