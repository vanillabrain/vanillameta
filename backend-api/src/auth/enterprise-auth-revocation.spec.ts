import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entites/refresh_token.entity';
import { UserService } from '../user/user.service';
import { UserController } from '../user/user.controller';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';

const ACCESS_SECRET = 'unit-only-access-key';
const REFRESH_SECRET = 'unit-only-refresh-key';
const account = { id: 7, userId: 'unitactor', email: 'unit@example.invalid', jwtId: 31 };
const legacyHash = (plain: string) => createHash('sha512').update(plain).digest('hex');

const environmentKeys = ['ACCESS_SECRET', 'REFRESH_SECRET'] as const;
const originalEnvironment = new Map<string, string | undefined>(
  environmentKeys.map(key => [key, process.env[key]]),
);

function restoreEnvironment() {
  for (const key of environmentKeys) {
    const value = originalEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const guardFor = (users: { findOne: jest.Mock }, jwt: JwtService) =>
  new JwtAuthGuard(jwt, {
    options: { type: 'sqlite' },
    getRepository: jest.fn((entity: any) => (entity === User ? users : undefined)),
  } as unknown as DataSource);

describe('enterprise revocation: active flag and auth epoch on the account row', () => {
  let users: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock; manager: unknown };
  let refresh: { findOne: jest.Mock; save: jest.Mock; manager: unknown };
  let jwt: JwtService;
  let service: AuthService;

  beforeEach(() => {
    process.env.ACCESS_SECRET = ACCESS_SECRET;
    process.env.REFRESH_SECRET = REFRESH_SECRET;
    const metadataConnection = { options: { type: 'mysql' } };
    users = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      manager: { connection: metadataConnection },
    };
    refresh = {
      findOne: jest.fn(),
      save: jest.fn(),
      manager: { connection: metadataConnection },
    };
    jwt = new JwtService();
    service = new AuthService(
      jwt,
      users as unknown as Repository<User>,
      refresh as unknown as Repository<RefreshToken>,
    );
  });

  afterEach(() => {
    restoreEnvironment();
  });

  it('rejects a disabled account with the correct password without rewriting its legacy hash', async () => {
    const stored = legacyHash('unit-password');
    const row = { ...account, password: stored, active: false, authVersion: 0 } as User;
    users.findOne.mockResolvedValue(row);

    await expect(service.validateUser('unitactor', 'unit-password')).resolves.toBeNull();
    expect(users.findOne).toHaveBeenCalledWith({ where: { userId: 'unitactor' } });
    expect(users.save).not.toHaveBeenCalled();
    expect(row.password).toBe(stored);
  });

  it('rehashes a legacy hash only for an active login and strips the password from the result', async () => {
    users.findOne.mockResolvedValue({
      ...account,
      password: legacyHash('unit-password'),
      active: true,
      authVersion: 0,
    } as User);
    let persisted: string | undefined;
    users.save.mockImplementation(async (row: User) => {
      persisted = row.password;
      return row;
    });

    const found = await service.validateUser('unitactor', 'unit-password');

    expect(found).toMatchObject({ id: 7, userId: 'unitactor', authVersion: 0 });
    expect(found?.password).toBeUndefined();
    expect(users.save).toHaveBeenCalledTimes(1);
    expect(persisted?.startsWith('s2:')).toBe(true);
  });

  it('signs access and refresh tokens with the epoch of the authenticated account row', async () => {
    const current = { ...account, authVersion: 4 } as User;

    const access = await service.generateAccessToken(current);
    const refreshToken = await service.generateRefreshToken(current);

    expect((await jwt.verify(access, { secret: ACCESS_SECRET })).accessKeyData).toEqual({
      userId: 'unitactor',
      email: 'unit@example.invalid',
      id: 7,
      authVersion: 4,
    });
    expect(
      (await jwt.verify(refreshToken, { secret: REFRESH_SECRET })).refreshKeyData,
    ).toMatchObject({ id: 7, userId: 'unitactor', authVersion: 4 });
  });

  it('defaults a pre-epoch account row to epoch 0 when issuing tokens', async () => {
    const access = await service.generateAccessToken({ ...account });
    const refreshToken = await service.generateRefreshToken({ ...account });

    expect((await jwt.verify(access, { secret: ACCESS_SECRET })).accessKeyData).toMatchObject({
      authVersion: 0,
    });
    expect(
      (await jwt.verify(refreshToken, { secret: REFRESH_SECRET })).refreshKeyData,
    ).toMatchObject({ authVersion: 0 });
  });

  it.each([
    ['a claim-less legacy token', undefined],
    ['an explicit epoch-0 token', 0],
  ])('passes %s while the account stays at epoch 0', async (_label, accountEpoch) => {
    const token =
      accountEpoch === undefined
        ? await jwt.sign(
            { refreshKeyData: { id: 7, userId: 'unitactor', email: 'unit@example.invalid' } },
            { secret: REFRESH_SECRET, expiresIn: '43200s' },
          )
        : await service.generateRefreshToken({ ...account, authVersion: 0 });
    users.findOne.mockResolvedValue({
      ...account,
      active: true,
      authVersion: accountEpoch,
    } as User);
    refresh.findOne.mockResolvedValue({ id: 31, refreshToken: token } as RefreshToken);

    const verified = await service.verifyRefreshToken(token);

    expect(verified.refreshKeyData).toMatchObject({ id: 7, userId: 'unitactor', jwtId: 31 });
    expect(users.findOne).toHaveBeenCalledWith({ where: { id: 7, userId: 'unitactor' } });
    expect(refresh.findOne).toHaveBeenCalledWith({ where: { id: 31 } });
  });

  it('denies a disabled account before the refresh session store is read', async () => {
    const token = await service.generateRefreshToken({ ...account, authVersion: 0 });
    users.findOne.mockResolvedValue({ ...account, active: false, authVersion: 0 } as User);
    refresh.findOne.mockResolvedValue({ id: 31, refreshToken: token } as RefreshToken);

    await expect(service.verifyRefreshToken(token)).rejects.toMatchObject({ status: 401 });
    expect(refresh.findOne).not.toHaveBeenCalled();
  });

  it('denies the token hard-coded to the previous epoch even when its session row is still current', async () => {
    const staleToken = await service.generateRefreshToken({ ...account, authVersion: 0 });
    users.findOne.mockResolvedValue({ ...account, active: true, authVersion: 1 } as User);
    refresh.findOne.mockResolvedValue({ id: 31, refreshToken: staleToken } as RefreshToken);

    await expect(service.verifyRefreshToken(staleToken)).rejects.toMatchObject({ status: 401 });
    expect(refresh.findOne).not.toHaveBeenCalled();
  });

  it('denies the previous epoch refresh token after reactivation cleared the linked session', async () => {
    const staleToken = await service.generateRefreshToken({ ...account, authVersion: 0 });
    users.findOne.mockResolvedValue({
      ...account,
      active: true,
      authVersion: 1,
      jwtId: null,
    } as User);

    await expect(service.verifyRefreshToken(staleToken)).rejects.toMatchObject({ status: 401 });
    expect(refresh.findOne).not.toHaveBeenCalled();
  });

  it('accepts the refresh token issued at the current epoch after reactivation', async () => {
    const current = await service.generateRefreshToken({ ...account, authVersion: 1 });
    users.findOne.mockResolvedValue({ ...account, active: true, authVersion: 1 } as User);
    refresh.findOne.mockResolvedValue({ id: 31, refreshToken: current } as RefreshToken);

    const verified = await service.verifyRefreshToken(current);

    expect(verified.refreshKeyData).toMatchObject({
      id: 7,
      userId: 'unitactor',
      authVersion: 1,
      jwtId: 31,
    });
  });
});

describe('JwtAuthGuard bearer revocation: active flag and auth epoch', () => {
  let users: { findOne: jest.Mock };
  let jwt: JwtService;
  let service: AuthService;
  let guard: JwtAuthGuard;
  let request: any;
  const context = () =>
    ({ switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext);

  beforeEach(() => {
    process.env.ACCESS_SECRET = ACCESS_SECRET;
    process.env.REFRESH_SECRET = REFRESH_SECRET;
    users = { findOne: jest.fn() };
    jwt = new JwtService();
    service = new AuthService(
      jwt,
      users as unknown as Repository<User>,
      {} as unknown as Repository<RefreshToken>,
    );
    guard = guardFor(users, jwt);
    request = { headers: {}, method: 'GET', path: '/v1/dashboard/17' };
  });

  afterEach(() => {
    restoreEnvironment();
  });

  it('accepts the bearer token issued at the current epoch after reactivation', async () => {
    const current = { ...account, authVersion: 1 } as User;
    request.headers = { authorization: `Bearer ${await service.generateAccessToken(current)}` };
    users.findOne.mockResolvedValue(current);

    expect(await guard.canActivate(context())).toBe(true);
    expect(request.user.accessKeyData).toMatchObject({
      id: 7,
      userId: 'unitactor',
      authVersion: 1,
    });
    expect(users.findOne).toHaveBeenCalledWith({ where: { id: 7, userId: 'unitactor' } });
  });

  it('accepts a claim-less epoch-0 bearer token for an account that never moved epochs', async () => {
    const legacy = await jwt.sign(
      { accessKeyData: { userId: 'unitactor', email: 'unit@example.invalid', id: 7 } },
      { secret: ACCESS_SECRET, expiresIn: '21600s' },
    );
    request.headers = { authorization: `Bearer ${legacy}` };
    users.findOne.mockResolvedValue({ ...account, active: true, authVersion: 0 } as User);

    expect(await guard.canActivate(context())).toBe(true);
    expect(request.user.accessKeyData).toMatchObject({ id: 7, userId: 'unitactor' });
    expect(request.user.accessKeyData).not.toHaveProperty('authVersion');
  });

  it('denies the previous epoch bearer token after reactivation', async () => {
    const stale = await service.generateAccessToken({ ...account, authVersion: 0 } as User);
    request.headers = { authorization: `Bearer ${stale}` };
    users.findOne.mockResolvedValue({ ...account, active: true, authVersion: 1 } as User);

    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
    expect(users.findOne).toHaveBeenCalledWith({ where: { id: 7, userId: 'unitactor' } });
  });

  it('denies a disabled account even when its signature and epoch still match', async () => {
    const current = { ...account, authVersion: 1 } as User;
    request.headers = { authorization: `Bearer ${await service.generateAccessToken(current)}` };
    users.findOne.mockResolvedValue({ ...current, active: false } as User);

    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
  });

  it.each([['1'], [1.5]])('denies a non-integer epoch claim %p', async authVersion => {
    const malformed = await jwt.sign(
      { accessKeyData: { userId: 'unitactor', email: 'unit@example.invalid', id: 7, authVersion } },
      { secret: ACCESS_SECRET, expiresIn: '21600s' },
    );
    request.headers = { authorization: `Bearer ${malformed}` };
    users.findOne.mockResolvedValue({ ...account, active: true, authVersion } as User);

    await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 401 });
  });
});

describe('reissued access tokens: reloaded account row versus verified refresh epoch', () => {
  let users: { findOne: jest.Mock; manager: { connection: { options: { type: string } } } };
  let jwt: JwtService;
  let authService: AuthService;
  let service: UserService;

  beforeEach(() => {
    process.env.ACCESS_SECRET = ACCESS_SECRET;
    process.env.REFRESH_SECRET = REFRESH_SECRET;
    users = { findOne: jest.fn(), manager: { connection: { options: { type: 'mysql' } } } };
    jwt = new JwtService();
    authService = new AuthService(
      jwt,
      users as unknown as Repository<User>,
      {} as unknown as Repository<RefreshToken>,
    );
    service = new UserService(
      users as unknown as Repository<User>,
      {} as unknown as Repository<UserMapping>,
      authService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreEnvironment();
  });

  it('signs the reissued token with the epoch of the freshly loaded account row', async () => {
    users.findOne.mockResolvedValue({ ...account, active: true, authVersion: 1 } as User);

    const token = await service.reissuanceAccessToken('unitactor', 1);

    expect(users.findOne).toHaveBeenCalledWith({ where: { userId: 'unitactor' } });
    expect((await jwt.verify(token, { secret: ACCESS_SECRET })).accessKeyData).toEqual({
      userId: 'unitactor',
      email: 'unit@example.invalid',
      id: 7,
      authVersion: 1,
    });
  });

  it('reissues an epoch-0 token when the caller omits the verified epoch of a legacy row', async () => {
    users.findOne.mockResolvedValue({ ...account, active: true } as User);

    const token = await service.reissuanceAccessToken('unitactor');

    expect((await jwt.verify(token, { secret: ACCESS_SECRET })).accessKeyData).toMatchObject({
      authVersion: 0,
    });
  });

  it('denies a deactivated account before signing a replacement token', async () => {
    const sign = jest.spyOn(authService, 'generateAccessToken');
    users.findOne.mockResolvedValue({ ...account, active: false, authVersion: 1 } as User);

    await expect(service.reissuanceAccessToken('unitactor', 1)).rejects.toMatchObject({
      status: 401,
    });
    expect(sign).not.toHaveBeenCalled();
  });

  it('denies the verified epoch when the row moved to a newer epoch before reissuance', async () => {
    const sign = jest.spyOn(authService, 'generateAccessToken');
    users.findOne.mockResolvedValue({
      ...account,
      active: true,
      authVersion: 1,
      jwtId: null,
    } as User);

    await expect(service.reissuanceAccessToken('unitactor', 0)).rejects.toMatchObject({
      status: 401,
    });
    expect(sign).not.toHaveBeenCalled();
  });

  it('denies a moved row when the verified epoch defaulted to 0', async () => {
    const sign = jest.spyOn(authService, 'generateAccessToken');
    users.findOne.mockResolvedValue({ ...account, active: true, authVersion: 1 } as User);

    await expect(service.reissuanceAccessToken('unitactor')).rejects.toMatchObject({ status: 401 });
    expect(sign).not.toHaveBeenCalled();
  });

  it.each([['1'], [1.5]])('denies a non-integer verified epoch %p before signing', async epoch => {
    const sign = jest.spyOn(authService, 'generateAccessToken');
    users.findOne.mockResolvedValue({
      ...account,
      active: true,
      authVersion: epoch,
    } as unknown as User);

    await expect(
      service.reissuanceAccessToken('unitactor', epoch as unknown as number),
    ).rejects.toMatchObject({ status: 401 });
    expect(sign).not.toHaveBeenCalled();
  });

  it('denies a missing account row before signing', async () => {
    const sign = jest.spyOn(authService, 'generateAccessToken');
    users.findOne.mockResolvedValue(null);

    await expect(service.reissuanceAccessToken('unitactor', 1)).rejects.toMatchObject({
      status: 401,
    });
    expect(sign).not.toHaveBeenCalled();
  });

  it('reissues a token that the bearer guard then accepts at the reactivated epoch', async () => {
    users.findOne.mockResolvedValue({ ...account, active: true, authVersion: 1 } as User);
    const guard = guardFor(users, jwt);
    const request: any = { headers: {}, method: 'GET', path: '/v1/dashboard/17' };

    const token = await service.reissuanceAccessToken('unitactor', 1);
    request.headers = { authorization: `Bearer ${token}` };

    expect(
      await guard.canActivate({
        switchToHttp: () => ({ getRequest: () => request }),
      } as ExecutionContext),
    ).toBe(true);
    expect(request.user.accessKeyData).toMatchObject({ id: 7, authVersion: 1 });
  });
});

describe('UserController forwarding of the verified refresh epoch', () => {
  it.each([
    [1, 1],
    [undefined, 0],
    [null, 0],
  ])('forwards refresh claim %p to reissuance as %p', async (claim, expected) => {
    const userService = {
      reissuanceAccessToken: jest.fn().mockResolvedValue('unit-access-fixture'),
    };
    const controller = new UserController(userService as any, {} as any);
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.reissuanceAccessToken(
      { user: { refreshKeyData: { userId: 'unitactor', authVersion: claim } } },
      res,
    );

    expect(userService.reissuanceAccessToken).toHaveBeenCalledWith('unitactor', expected);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      accessToken: 'unit-access-fixture',
      message: 'success',
    });
  });
});

describe('UserService.deleteUser organization departure guard', () => {
  let users: {
    manager: { findOneBy: jest.Mock; connection: { options: { type: string } } };
    delete: jest.Mock;
  };
  let authService: { checkAccess: jest.Mock };
  let service: UserService;

  beforeEach(() => {
    users = {
      manager: { findOneBy: jest.fn(), connection: { options: { type: 'mysql' } } },
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    authService = { checkAccess: jest.fn() };
    service = new UserService(
      users as unknown as Repository<User>,
      {} as unknown as Repository<UserMapping>,
      authService as unknown as AuthService,
    );
  });

  it('blocks deleting an account that is still an organization member', async () => {
    authService.checkAccess.mockResolvedValue({ id: 7, userId: 'unitactor' } as User);
    users.manager.findOneBy.mockResolvedValue({ userId: 7, organizationId: 3, role: 'admin' });

    await expect(service.deleteUser('unitactor', 'unit-password')).rejects.toMatchObject({
      status: 409,
    });
    expect(users.manager.findOneBy).toHaveBeenCalledWith(EnterpriseMembership, { userId: 7 });
    expect(users.delete).not.toHaveBeenCalled();
  });

  it('deletes an account that is no longer an organization member', async () => {
    authService.checkAccess.mockResolvedValue({ id: 7, userId: 'unitactor' } as User);
    users.manager.findOneBy.mockResolvedValue(null);

    await expect(service.deleteUser('unitactor', 'unit-password')).resolves.toBe('success');
    expect(users.manager.findOneBy).toHaveBeenCalledWith(EnterpriseMembership, { userId: 7 });
    expect(users.delete).toHaveBeenCalledWith(7);
  });

  it('returns Unauthorized for a wrong password without any membership lookup or delete', async () => {
    authService.checkAccess.mockResolvedValue(null);

    await expect(service.deleteUser('unitactor', 'unit-wrong-password')).resolves.toBe(
      'Unauthorized',
    );
    expect(users.manager.findOneBy).not.toHaveBeenCalled();
    expect(users.delete).not.toHaveBeenCalled();
  });
});
