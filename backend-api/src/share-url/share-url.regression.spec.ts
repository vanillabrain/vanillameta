import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsNull } from 'typeorm';
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
  let active: any;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['performance'] }).setSystemTime(new Date(2026, 2, 1, 12));
    active = {
      id: 9,
      uuid: unitUuid,
      shareYn: 'Y',
      shareToken: 'unit-legacy-token',
      endDate: new Date(2026, 2, 2, 23, 59, 59, 999),
    };
    users = { findOne: jest.fn().mockResolvedValue({ id: 7, userId: 'unitactor' }) };
    dashboards = { findOne: jest.fn().mockResolvedValue({ id: 17, shareId: 9, delYn: 'N' }) };
    shares = {
      findOne: jest.fn().mockImplementation(async () => ({ ...active })),
      save: jest.fn().mockImplementation(async value => {
        active = { ...value };
        return active;
      }),
      update: jest.fn().mockImplementation(async (_where, fields) => {
        active = { ...active, ...fields };
        return { affected: 1 };
      }),
    };
    auth = {
      generateUrlAccessToken: jest.fn().mockResolvedValue('unit-scoped-token'),
      readUrlAccessToken: jest.fn().mockResolvedValue(null),
    };
    dashboardService = {
      assertOwner: jest.fn().mockResolvedValue(undefined),
      findShared: jest.fn().mockResolvedValue({ status: 'SUCCESS', data: { id: 17 } }),
    };
    service = new ShareUrlService(users, dashboards, shares, auth, dashboardService);
  });

  afterEach(() => jest.useRealTimers());

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
    expect(dashboardService.assertOwner).toHaveBeenCalledWith(17, 7);
    expect(auth.generateUrlAccessToken).toHaveBeenCalledWith({ dashboardId: 17, uuid: unitUuid });
    await controller.checkShareUrlOff(req, { dashboardId: '17' }, {} as any);
    expect(dashboardService.assertOwner).toHaveBeenLastCalledWith(17, 7);
  });

  it('rejects non-owner sharing on and off before state or token changes', async () => {
    dashboardService.assertOwner.mockRejectedValue(new ForbiddenException());
    await expect(
      service.checkShareUrlOn('unitactor', 17, { userId: 'unitactor', endDate: '03/01/2026' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.checkShareUrlOff('unitactor', 17)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(auth.generateUrlAccessToken).not.toHaveBeenCalled();
    expect(shares.save).not.toHaveBeenCalled();
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
  });

  it('keeps today valid through local end of day and expires yesterday', async () => {
    await service.checkShareUrlOn('unitactor', 17, { userId: 'unitactor', endDate: '03/01/2026' });
    expect(active.endDate.getTime()).toBe(new Date(2026, 2, 1, 23, 59, 59, 999).getTime());
    auth.readUrlAccessToken.mockResolvedValue({
      shareKeyData: { dashboardId: 17, uuid: unitUuid },
    });
    await service.shareDashboardInfo(unitUuid);
    expect(dashboardService.findShared).toHaveBeenCalledWith(17);
    await service.checkShareUrlOn('unitactor', 17, { userId: 'unitactor', endDate: '02/28/2026' });
    await expect(service.shareDashboardInfo(unitUuid)).rejects.toMatchObject({ status: 401 });
  });

  it('accepts a valid leap-day calendar date', async () => {
    await service.checkShareUrlOn('unitactor', 17, { userId: 'unitactor', endDate: '02/29/2028' });
    expect(active.endDate.getDate()).toBe(29);
    expect(active.endDate.getMonth()).toBe(1);
  });

  it('denies missing, revoked, invalid-expiry and deleted-dashboard UUID reads', async () => {
    shares.findOne.mockResolvedValueOnce(null);
    await expect(service.shareDashboardInfo(unitUuid)).rejects.toMatchObject({ status: 404 });
    active.shareYn = 'N';
    await expect(service.shareDashboardInfo(unitUuid)).rejects.toMatchObject({ status: 403 });
    active.shareYn = 'Y';
    active.endDate = new Date(NaN);
    await expect(service.shareDashboardInfo(unitUuid)).rejects.toMatchObject({ status: 401 });
    active.endDate = new Date(2026, 2, 2);
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
    active.shareToken = null;
    await service.shareDashboardInfo(unitUuid);
    expect(shares.update).toHaveBeenCalledWith(
      { id: 9, shareToken: IsNull(), shareYn: 'Y' },
      { shareToken: 'unit-scoped-token' },
    );
  });

  it('reloads a winning concurrent rotation instead of invalidating viewers again', async () => {
    shares.update.mockResolvedValue({ affected: 0 });
    shares.findOne
      .mockResolvedValueOnce({ ...active })
      .mockResolvedValueOnce({ ...active, shareToken: 'unit-winning-token' });
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
