import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LegacyOperationsGuard } from './legacy-operations.guard';

describe('legacy server operation boundary', () => {
  afterEach(() => jest.restoreAllMocks());
  const context = (id: number): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: { accessKeyData: { id }, role: 'admin' } }),
      }),
    } as unknown as ExecutionContext);
  const guard = (ids?: unknown) =>
    new LegacyOperationsGuard(
      {} as any,
      {} as any,
      new ConfigService({ LEGACY_OPERATIONS_USER_IDS: ids }),
    );
  it('does not turn an organization admin into a global diagnostic operator', async () => {
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
    await expect(guard().canActivate(context(1))).rejects.toThrow('운영 관리 권한');
    await expect(guard('2').canActivate(context(1))).rejects.toThrow('운영 관리 권한');
  });
  it('permits only an explicit exact current actor id, preserving the JWT fence first', async () => {
    const jwt = jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
    await expect(guard('2, 10').canActivate(context(10))).resolves.toBe(true);
    expect(jwt).toHaveBeenCalledTimes(1);
    await expect(guard('10').canActivate(context(1))).rejects.toThrow('운영 관리 권한');
  });
  it.each(['01', '1x', '*', '0', '-1', ['1']])(
    'rejects malformed or broad operator configuration %p',
    async ids => {
      jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
      await expect(guard(ids).canActivate(context(1))).rejects.toThrow('운영 관리 권한');
    },
  );
  it('never permits an invalidated JWT even when the actor is configured', async () => {
    jest
      .spyOn(JwtAuthGuard.prototype, 'canActivate')
      .mockRejectedValue(new UnauthorizedException());
    await expect(guard('1').canActivate(context(1))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
