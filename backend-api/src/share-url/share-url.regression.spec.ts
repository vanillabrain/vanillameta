import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardService } from '../dashboard/dashboard.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { ShareUrlService } from './share-url.service';
import { ShareUrlController } from './share-url.controller';
import { AuthService } from '../auth/auth.service';

const unitUuid = '12345678-1234-4234-8234-123456789012';

describe('share ownership, calendar expiry and legacy token rotation regressions', () => {
  let users: any;
  let dashboards: any;
  let shares: any;
  let auth: any;
  let dashboardService: any;
  let service: ShareUrlService;
  let db: DataSource;
  const active = () => db.manager.findOneBy(DashboardShare, { id: 9 });

  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, UserMapping, Dashboard, DashboardShare],
    }).initialize();
    await db.manager.insert(User, {
      id: 7,
      userId: 'unitactor',
      email: 'share-owner@example.invalid',
      password: 'unused',
    });
    await db.manager.insert(Dashboard, {
      id: 17,
      title: 'Synthetic',
      shareId: 9,
      layout: '[]',
      delYn: 'N',
    });
    await db.manager.insert(UserMapping, { dashboardId: 17, userInfoId: 7 });
    await db.manager.insert(DashboardShare, {
      id: 9,
      uuid: unitUuid,
      shareYn: 'Y',
      shareToken: 'unit-legacy-token',
      endDate: new Date(2099, 11, 31, 23, 59, 59, 999),
    });
    users = db.getRepository(User);
    dashboards = db.getRepository(Dashboard);
    shares = db.getRepository(DashboardShare);
    jest.spyOn(dashboards, 'findOne');
    jest.spyOn(shares, 'findOne');
    jest.spyOn(shares, 'save');
    jest.spyOn(shares, 'update');
    auth = {
      generateUrlAccessToken: jest.fn().mockResolvedValue('unit-scoped-token'),
      readUrlAccessToken: jest.fn().mockResolvedValue(null),
    };
    dashboardService = new DashboardService(
      dashboards,
      users,
      shares,
      db.getRepository(UserMapping),
      undefined,
      undefined,
      undefined,
      undefined,
      new SourceAccessService(db),
    );
    const assertOwner = dashboardService.assertOwner.bind(dashboardService);
    jest
      .spyOn(dashboardService, 'assertOwner')
      .mockImplementation(async (id, actor, manager: EntityManager) => {
        expect(manager.queryRunner.isTransactionActive).toBe(true);
        return assertOwner(id, actor, manager);
      });
    jest
      .spyOn(dashboardService, 'findShared')
      .mockResolvedValue({ status: 'SUCCESS', data: { id: 17 } } as any);
    service = new ShareUrlService(users, dashboards, shares, auth, dashboardService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await db?.destroy();
  });

  it('canonicalizes route dashboard ids before owner checks and signed claims', async () => {
    const controller = new ShareUrlController(service, {
      dashboard: jest.fn().mockResolvedValue(undefined),
    } as any);
    const req = { user: { accessKeyData: { id: 7, userId: 'unitactor' } } };
    await controller.checkShareUrlOn(
      req,
      { dashboardId: '17' },
      { userId: 'unitactor', endDate: '03/01/2026' },
    );
    expect(dashboardService.assertOwner).toHaveBeenCalledWith(17, 7, expect.any(EntityManager));
    expect(auth.generateUrlAccessToken).toHaveBeenCalledWith({ dashboardId: 17, uuid: unitUuid });
    await controller.checkShareUrlOff(req, { dashboardId: '17' }, {} as any);
    expect(dashboardService.assertOwner).toHaveBeenLastCalledWith(17, 7, expect.any(EntityManager));
  });

  it('rejects non-owner sharing on and off before state or token changes', async () => {
    await db.manager.delete(UserMapping, { dashboardId: 17, userInfoId: 7 });
    await expect(
      service.checkShareUrlOn('unitactor', 17, { userId: 'unitactor', endDate: '03/01/2026' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.checkShareUrlOff('unitactor', 17)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(auth.generateUrlAccessToken).not.toHaveBeenCalled();
    expect(shares.save).not.toHaveBeenCalled();
    expect((await active()).reuseVersion).toBe(0);
  });

  it.each([
    '02/30/2026',
    '02/29/2026',
    '13/01/2026',
    '00/01/2026',
    '03/00/2026',
    '3/1/2026',
    '2026-03-01',
    '',
    undefined,
  ])('rejects malformed date %p before token/state changes', async endDate => {
    await expect(
      service.checkShareUrlOn('unitactor', 17, { endDate } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(auth.generateUrlAccessToken).not.toHaveBeenCalled();
    expect(shares.save).not.toHaveBeenCalled();
    expect((await active()).reuseVersion).toBe(0);
  });

  it('keeps today valid through local end of day and expires yesterday', async () => {
    // Keep the native Date constructor: TypeORM uses it to hydrate SQLite datetimes.
    const today = new Date();
    const calendar = (date: Date) =>
      `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(
        2,
        '0',
      )}/${date.getFullYear()}`;
    await service.checkShareUrlOn('unitactor', 17, {
      userId: 'unitactor',
      endDate: calendar(today),
    });
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    expect(new Date((await active()).endDate).getTime()).toBe(end.getTime());
    auth.readUrlAccessToken.mockResolvedValue({
      shareKeyData: { dashboardId: 17, uuid: unitUuid },
    });
    await service.shareDashboardInfo(unitUuid);
    expect(dashboardService.findShared).toHaveBeenCalledWith(17);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    await service.checkShareUrlOn('unitactor', 17, {
      userId: 'unitactor',
      endDate: calendar(yesterday),
    });
    await expect(service.shareDashboardInfo(unitUuid)).rejects.toMatchObject({ status: 401 });
  });

  it('accepts a valid leap-day calendar date', async () => {
    await service.checkShareUrlOn('unitactor', 17, { userId: 'unitactor', endDate: '02/29/2028' });
    expect(new Date((await active()).endDate).getDate()).toBe(29);
    expect(new Date((await active()).endDate).getMonth()).toBe(1);
  });

  it('denies missing, revoked, invalid-expiry and deleted-dashboard UUID reads', async () => {
    shares.findOne.mockResolvedValueOnce(null);
    await expect(service.shareDashboardInfo(unitUuid)).rejects.toMatchObject({ status: 404 });
    await db.manager.update(DashboardShare, 9, { shareYn: 'N' });
    await expect(service.shareDashboardInfo(unitUuid)).rejects.toMatchObject({ status: 403 });
    await db.manager.update(DashboardShare, 9, { shareYn: 'Y' });
    shares.findOne.mockResolvedValueOnce({ ...(await active()), endDate: new Date(NaN) });
    await expect(service.shareDashboardInfo(unitUuid)).rejects.toMatchObject({ status: 401 });

    dashboards.findOne.mockResolvedValueOnce(null);
    await expect(service.shareDashboardInfo(unitUuid)).rejects.toMatchObject({ status: 404 });
    expect(dashboardService.findShared).not.toHaveBeenCalled();
  });

  it('rotates legacy empty-claim tokens using compare-and-set and preserves valid tokens on subsequent reads', async () => {
    await service.shareDashboardInfo(unitUuid);
    expect(shares.update).toHaveBeenCalledWith(
      { id: 9, shareToken: 'unit-legacy-token', shareYn: 'Y' },
      { shareToken: 'unit-scoped-token' },
    );
    auth.readUrlAccessToken.mockResolvedValue({
      shareKeyData: { dashboardId: 17, uuid: unitUuid },
    });
    await service.shareDashboardInfo(unitUuid);
    expect(shares.update).toHaveBeenCalledTimes(1);
    expect(auth.generateUrlAccessToken).toHaveBeenCalledTimes(1);
  });

  it('uses IsNull for a legacy null token compare-and-set', async () => {
    await db.manager.update(DashboardShare, 9, { shareToken: null });
    await service.shareDashboardInfo(unitUuid);
    expect(shares.update).toHaveBeenCalledWith(
      { id: 9, shareToken: IsNull(), shareYn: 'Y' },
      { shareToken: 'unit-scoped-token' },
    );
  });

  it('reloads a winning concurrent rotation instead of invalidating viewers again', async () => {
    shares.update.mockResolvedValue({ affected: 0 });
    shares.findOne
      .mockResolvedValueOnce({ ...(await active()) })
      .mockResolvedValueOnce({ ...(await active()), shareToken: 'unit-winning-token' });
    auth.readUrlAccessToken
      .mockResolvedValueOnce({ accessKeyData: {} })
      .mockResolvedValueOnce({ shareKeyData: { dashboardId: 17, uuid: unitUuid } });
    await service.shareDashboardInfo(unitUuid);
    expect(shares.findOne).toHaveBeenLastCalledWith({ where: { id: 9 } });
    expect(auth.readUrlAccessToken).toHaveBeenLastCalledWith('unit-winning-token');
    expect(shares.update).toHaveBeenCalledTimes(1);
    expect(dashboardService.findShared).toHaveBeenCalledWith(17);
  });
});

describe('scoped URL token claims and column-length regressions', () => {
  const environment = { ...process.env };
  let auth: AuthService;
  beforeEach(() => {
    process.env.URL_ACCESS_SECRET = 'unit-only-url-key';
    process.env.ACCESS_SECRET = 'unit-only-access-key';
    auth = new AuthService(new JwtService(), {} as any, {} as any);
  });
  afterEach(() => {
    process.env = { ...environment };
  });

  it('signs different resource and randomized tokens within the existing 300-character column', async () => {
    const a = await auth.generateUrlAccessToken({ dashboardId: 17, uuid: unitUuid });
    const b = await auth.generateUrlAccessToken({ dashboardId: 18, uuid: unitUuid });
    const c = await auth.generateUrlAccessToken({ dashboardId: 17, uuid: unitUuid });
    expect(a === b).toBe(false);
    expect(a === c).toBe(false);
    expect(a.length).toBeLessThanOrEqual(300);
    const largest = await auth.generateUrlAccessToken({
      dashboardId: Number.MAX_SAFE_INTEGER,
      uuid: unitUuid,
    });
    expect(largest.length).toBeLessThanOrEqual(300);
    expect((await auth.readUrlAccessToken(a)).shareKeyData).toEqual({
      dashboardId: 17,
      uuid: unitUuid,
    });
    expect(await auth.readUrlAccessToken('invalid-unit-token')).toBeNull();
  });
});
