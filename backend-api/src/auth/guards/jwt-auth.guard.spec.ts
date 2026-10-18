import { ExecutionContext } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from '../../user/entities/user.entity';
import { DashboardShare } from '../../dashboard/entities/dashboard_share.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Widget } from '../../widget/entities/widget.entity';

describe('JwtAuthGuard persisted actors and dashboard-scoped shared datasets', () => {
  let guard: JwtAuthGuard;
  let jwt: any;
  let user: any;
  let share: any;
  let dashboard: any;
  let mappings: any;
  let widgets: any;
  let request: any;
  const context = () =>
    ({ switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext);

  beforeEach(() => {
    jwt = {
      verify: jest.fn().mockResolvedValue({ shareKeyData: { dashboardId: 17, uuid: 'unit-uuid' } }),
    };
    user = { findOne: jest.fn().mockResolvedValue({ id: 7, userId: 'unitactor' }) };
    share = {
      findOne: jest.fn().mockResolvedValue({
        id: 9,
        uuid: 'unit-uuid',
        shareYn: 'Y',
        endDate: new Date(Date.now() + 60000),
      }),
    };
    dashboard = { findOne: jest.fn().mockResolvedValue({ id: 17, shareId: 9, delYn: 'N' }) };
    mappings = { find: jest.fn().mockResolvedValue([{ dashboardId: 17, widgetId: 2 }]) };
    widgets = {
      find: jest.fn().mockResolvedValue([{ id: 2, datasetType: 'DATASET', datasetId: 10 }]),
    };
    const repositories = new Map<any, any>([
      [User, user],
      [DashboardShare, share],
      [Dashboard, dashboard],
      [DashboardWidget, mappings],
      [Widget, widgets],
    ]);
    const dataSource = {
      options: { type: 'sqlite' },
      getRepository: jest.fn(entity => repositories.get(entity)),
    } as unknown as DataSource;
    guard = new JwtAuthGuard(jwt, dataSource);
    request = {
      headers: { 'authorization-url': 'Bearer unit-share-token' },
      method: 'GET',
      path: '/v1/database/data',
      query: { datasetType: 'DATASET', datasetId: '10' },
    };
  });

  it('allows only a persisted active share and dataset pair of its linked widget', async () => {
    expect(await guard.canActivate(context())).toBe(true);
    expect(share.findOne).toHaveBeenCalledWith({
      where: { uuid: 'unit-uuid', shareToken: 'unit-share-token', shareYn: 'Y' },
    });
    expect(dashboard.findOne).toHaveBeenCalledWith({ where: { id: 17, shareId: 9 } });
    expect(mappings.find).toHaveBeenCalledWith({ where: { dashboardId: 17 } });
    expect(widgets.find).toHaveBeenCalledWith({ where: { id: In([2]) } });
  });

  it('also allows prefix-independent data routes and linked TABLE query ids', async () => {
    request.path = '/database/data';
    request.query.datasetType = 'TABLE';
    widgets.find.mockResolvedValue([{ id: 2, datasetType: 'TABLE', datasetId: 10 }]);
    expect(await guard.canActivate(context())).toBe(true);
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH'])('denies shared %s writes', async method => {
    request.method = method;
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 403 });
    expect(mappings.find).not.toHaveBeenCalled();
  });

  it.each([
    '/v1/dashboard/17',
    '/v1/database',
    '/v1/database/query',
    '/v1/widget',
    '/v1/dataset',
    '/v1/ai/dashboard-insight/17',
    '/v1/login/refresh',
  ])('denies private or raw-query path %s', async path => {
    request.path = path;
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 403 });
    expect(mappings.find).not.toHaveBeenCalled();
  });

  it('denies revoked shares even while a JWT signature remains valid', async () => {
    share.findOne.mockResolvedValue({ id: 9, shareYn: 'N', endDate: new Date(Date.now() + 60000) });
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
  });

  it.each([null, new Date(Date.now() - 1000), new Date(NaN)])(
    'denies expired or invalid share expiry %p',
    async endDate => {
      share.findOne.mockResolvedValue({ id: 9, shareYn: 'Y', endDate });
      await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
    },
  );

  it('denies replaced tokens and deleted/mismatched dashboard scope', async () => {
    share.findOne.mockResolvedValueOnce(null);
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
    dashboard.findOne.mockResolvedValueOnce(null);
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    {},
    { dashboardId: '17', uuid: 'unit-uuid' },
    { dashboardId: 0, uuid: 'unit-uuid' },
    { dashboardId: 17 },
  ])('denies legacy or malformed share claims %p', async shareKeyData => {
    jwt.verify.mockResolvedValue({ shareKeyData });
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    { datasetType: 'DATASET', datasetId: '11' },
    { datasetType: 'TABLE', datasetId: '10' },
    { datasetType: 'DATASET', datasetId: [] },
    { datasetType: 'DATASET', tableName: 'arbitrary_table' },
  ])('denies unlinked or malformed dataset pair %p', async query => {
    request.query = query;
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 403 });
  });

  it('denies a dashboard without any linked widget', async () => {
    mappings.find.mockResolvedValue([]);
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 403 });
    expect(widgets.find).not.toHaveBeenCalled();
  });

  it('allows normal bearer actors only after a matching persisted id/userId lookup', async () => {
    request.headers = { authorization: 'Bearer unit-access-token' };
    request.path = '/v1/dashboard/17';
    jwt.verify.mockResolvedValue({ accessKeyData: { id: 7, userId: 'unitactor' } });
    expect(await guard.canActivate(context())).toBe(true);
    expect(user.findOne).toHaveBeenCalledWith({ where: { id: 7, userId: 'unitactor' } });
  });

  it('denies a deleted normal bearer actor despite a valid JWT', async () => {
    request.headers = { authorization: 'Bearer unit-access-token' };
    jwt.verify.mockResolvedValue({ accessKeyData: { id: 7, userId: 'unitactor' } });
    user.findOne.mockResolvedValue(null);
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    {},
    { id: '7', userId: 'unitactor' },
    { id: -1, userId: 'unitactor' },
    { id: 7, userId: [] },
  ])('denies malformed actor claims %p', async accessKeyData => {
    request.headers = { authorization: 'Bearer unit-access-token' };
    jwt.verify.mockResolvedValue({ accessKeyData });
    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
    expect(user.findOne).not.toHaveBeenCalled();
  });
});
