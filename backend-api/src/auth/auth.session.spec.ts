import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entites/refresh_token.entity';
import { LoginController } from '../login/login.controller';

const unitActor = { id: 7, userId: 'unitactor', email: 'unit@example.invalid', jwtId: 31 };

describe('persisted refresh sessions and cookie extraction', () => {
  let users: Pick<jest.Mocked<Repository<User>>, 'findOne' | 'update'> & {
    manager: { connection: unknown };
  };
  let refresh: Pick<jest.Mocked<Repository<RefreshToken>>, 'findOne' | 'save'> & {
    manager: { connection: unknown };
  };
  let service: AuthService;
  let raw: string;
  const environment = { ...process.env };

  beforeEach(async () => {
    process.env.REFRESH_SECRET = 'unit-only-session-key';
    const metadataConnection = { options: { type: 'mysql' } };
    users = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: { connection: metadataConnection },
    };
    refresh = {
      findOne: jest.fn(),
      save: jest.fn(),
      manager: { connection: metadataConnection },
    };
    service = new AuthService(
      new JwtService(),
      users as unknown as Repository<User>,
      refresh as unknown as Repository<RefreshToken>,
    );
    raw = await service.generateRefreshToken(unitActor);
    users.findOne.mockResolvedValue({ ...unitActor } as User);
    refresh.findOne.mockResolvedValue({ id: 31, refreshToken: raw } as RefreshToken);
    refresh.save.mockImplementation(async row => ({ id: 31, ...row } as RefreshToken));
  });

  afterEach(() => {
    process.env = { ...environment };
  });

  it('accepts a raw signed JWT without splitting equals and derives the stored row id', async () => {
    const verified = await service.verifyRefreshToken(raw);
    expect(verified.refreshKeyData).toMatchObject({ id: 7, userId: 'unitactor', jwtId: 31 });
    expect(users.findOne).toHaveBeenCalledWith({ where: { id: 7, userId: 'unitactor' } });
    expect(refresh.findOne).toHaveBeenCalledWith({ where: { id: 31 } });
  });

  it.each([null, 0, undefined, -1, NaN])(
    'first login with prior jwtId %p cannot look up another users row',
    async prior => {
      const saved = await service.setRefreshKey.call(service, raw, prior, 7);
      expect(refresh.findOne).not.toHaveBeenCalled();
      expect(saved?.id).toBe(31);
      expect(users.update).toHaveBeenCalledWith(7, { jwtId: 31 });
    },
  );

  it('updates only the supplied existing refresh row and returns its linked id', async () => {
    const saved = await service.setRefreshKey.call(service, raw, 31, 7);
    expect(refresh.findOne).toHaveBeenCalledWith({ where: { id: 31 } });
    expect(saved?.id).toBe(31);
    expect(users.update).toHaveBeenCalledWith(7, { jwtId: 31 });
  });

  it('rejects an invalid login owner id before any refresh row lookup/save', async () => {
    await expect(service.setRefreshKey.call(service, raw, null, 0)).rejects.toMatchObject({
      status: 401,
    });
    expect(refresh.findOne).not.toHaveBeenCalled();
    expect(refresh.save).not.toHaveBeenCalled();
    expect(users.update).not.toHaveBeenCalled();
  });

  it('rejects a signed but revoked stored token', async () => {
    refresh.findOne.mockResolvedValue({ id: 31, refreshToken: '' } as RefreshToken);
    await expect(service.verifyRefreshToken(raw)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a previous credential after a new same-second login', async () => {
    const replacement = await service.generateRefreshToken(unitActor);
    expect(raw === replacement).toBe(false);
    refresh.findOne.mockResolvedValue({ id: 31, refreshToken: replacement } as RefreshToken);
    await expect(service.verifyRefreshToken(raw)).rejects.toMatchObject({ status: 401 });
    expect((await service.verifyRefreshToken(replacement)).refreshKeyData.jwtId).toBe(31);
  });

  it('rejects deleted actors, missing linked rows and invalid stored references', async () => {
    users.findOne.mockResolvedValueOnce(null);
    await expect(service.verifyRefreshToken(raw)).rejects.toMatchObject({ status: 401 });
    refresh.findOne.mockResolvedValueOnce(null);
    await expect(service.verifyRefreshToken(raw)).rejects.toMatchObject({ status: 401 });
    users.findOne.mockResolvedValueOnce({ ...unitActor, jwtId: null } as User);
    await expect(service.verifyRefreshToken(raw)).rejects.toMatchObject({ status: 401 });
  });

  it('cookie-parser jwt_re takes precedence over unrelated cookies and header fallback', async () => {
    const guard = new LocalAuthGuard(service as any);
    const request: any = {
      cookies: { jwt_re: raw },
      headers: { cookie: 'other=x; jwt_re=invalid-unit-token' },
    };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
    expect(await guard.canActivate(context)).toBe(true);
    expect(request.user.refreshKeyData.jwtId).toBe(31);
  });

  it('header fallback finds jwt_re behind another cookie and preserves its entire value', async () => {
    const guard = new LocalAuthGuard(service as any);
    const request: any = { headers: { cookie: `other=x; jwt_re=${raw}; trailing=y` } };
    expect(
      await guard.canActivate({
        switchToHttp: () => ({ getRequest: () => request }),
      } as ExecutionContext),
    ).toBe(true);
    expect(request.user.refreshKeyData.jwtId).toBe(31);
  });

  it.each([{}, { cookie: 'other=x' }, { cookie: 'jwt_re=invalid-unit-token' }])(
    'does not set a user for missing or invalid refresh cookies %p',
    async headers => {
      const guard = new LocalAuthGuard(service as any);
      const request: any = { headers };
      await expect(
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => request }),
        } as ExecutionContext),
      ).rejects.toMatchObject({ status: 401 });
      expect(request.user).toBeUndefined();
    },
  );

  it('logout revokes only the derived linked refresh row', async () => {
    const verified = await service.verifyRefreshToken(raw);
    const controller = new LoginController({} as any, service);
    const res: any = {
      status: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    await controller.signOut(res, { user: verified });
    expect(refresh.findOne.mock.calls.every(([options]) => (options as any).where.id === 31)).toBe(
      true,
    );
    expect(refresh.save).toHaveBeenCalledTimes(1);
    expect(refresh.save.mock.calls[0][0].id).toBe(31);
    expect(refresh.save.mock.calls[0][0].refreshToken).toBe('');
  });

  it('invalid or missing logout references return 401 instead of querying undefined ids', async () => {
    await expect(service.deleteRefreshToken(undefined)).rejects.toMatchObject({ status: 401 });
    expect(refresh.findOne).not.toHaveBeenCalled();
    refresh.findOne.mockResolvedValueOnce(null);
    await expect(service.deleteRefreshToken(31)).rejects.toMatchObject({ status: 401 });
  });
});

describe('HTTP-only refresh cookie environments and matching clear options', () => {
  const environment = { ...process.env };
  afterEach(() => {
    process.env = { ...environment };
  });

  it.each(['local', 'dev', 'prod'])('issues and clears matching cookies for %s', async stage => {
    process.env.NODE_ENV = stage;
    const auth = {
      generateAccessToken: jest.fn().mockResolvedValue('unit-access-fixture'),
      generateRefreshToken: jest.fn().mockResolvedValue('unit-refresh-fixture'),
      setRefreshKey: jest.fn(),
      deleteRefreshToken: jest.fn(),
    };
    const controller = new LoginController(
      { signin: jest.fn().mockResolvedValue({ ...unitActor, jwtId: null }) } as any,
      auth as any,
    );
    const res: any = {
      cookie: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      clearCookie: jest.fn().mockReturnThis(),
    };
    await controller.logIn(res, {}, { userId: 'unitactor', password: 'unit-password' });
    expect(auth.setRefreshKey.mock.calls[0].slice(1)).toEqual([null, 7]);
    const options = res.cookie.mock.calls[0][2];
    expect(options).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: stage === 'prod',
      path: '/',
    });
    await controller.signOut(res, { user: { refreshKeyData: { jwtId: 31 } } });
    expect(res.clearCookie).toHaveBeenCalledWith('jwt_re', options);
    expect(auth.deleteRefreshToken).toHaveBeenCalledWith(31);
  });
});
