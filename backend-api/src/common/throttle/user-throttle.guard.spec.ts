import { ExecutionContext, ForbiddenException, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { productionConfigProblems } from '../../config/production-guard';
import {
  USER_THROTTLE_KEY,
  UserThrottle,
  UserThrottleGuard,
  userThrottleConfigProblems,
  userThrottleLimit,
} from './user-throttle.guard';

class Controller {
  @UserThrottle('upload')
  upload() {
    return undefined;
  }
  @UserThrottle('ai')
  ask() {
    return undefined;
  }
  plain() {
    return undefined;
  }
}
@UserThrottle('ai')
class WholeClass {
  one() {
    return undefined;
  }
}

const context = (
  type: any,
  handler: string,
  user: unknown,
  response: any = { setHeader: jest.fn() },
) =>
  ({
    getClass: () => type,
    getHandler: () => type.prototype[handler],
    switchToHttp: () => ({ getRequest: () => ({ user }), getResponse: () => response }),
  } as unknown as ExecutionContext);
const as = (id: number) => ({ accessKeyData: { id } });

describe('UserThrottleGuard', () => {
  let guard: UserThrottleGuard;
  let now: number;
  const saved = {
    USER_THROTTLE_UPLOAD_PER_MIN: process.env.USER_THROTTLE_UPLOAD_PER_MIN,
    USER_THROTTLE_AI_PER_MIN: process.env.USER_THROTTLE_AI_PER_MIN,
  };

  beforeEach(() => {
    guard = new UserThrottleGuard(new Reflector());
    now = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    process.env.USER_THROTTLE_UPLOAD_PER_MIN = '3';
    process.env.USER_THROTTLE_AI_PER_MIN = '2';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const refused = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      return error as HttpException;
    }
    throw new Error('expected a refusal');
  };

  it('lets a route without a policy through untouched, even for an anonymous request', () => {
    expect(guard.canActivate(context(Controller, 'plain', undefined))).toBe(true);
    expect(guard.size()).toBe(0);
  });

  it('allows the limit per user and route, then answers 429 with Retry-After', () => {
    const response = { setHeader: jest.fn() };
    for (let i = 0; i < 3; i += 1)
      expect(guard.canActivate(context(Controller, 'upload', as(7), response))).toBe(true);
    const error = refused(() => guard.canActivate(context(Controller, 'upload', as(7), response)));
    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toMatchObject({ error: 'RATE_LIMITED', retryAfterSeconds: 60 });
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('counts each user and each route separately', () => {
    for (let i = 0; i < 3; i += 1) guard.canActivate(context(Controller, 'upload', as(7)));
    expect(guard.canActivate(context(Controller, 'upload', as(8)))).toBe(true);
    expect(guard.canActivate(context(Controller, 'ask', as(7)))).toBe(true);
  });

  it('starts a new window a minute later and reports the time left within one', () => {
    for (let i = 0; i < 3; i += 1) guard.canActivate(context(Controller, 'upload', as(7)));
    now += 25_000;
    expect(
      (refused(() => guard.canActivate(context(Controller, 'upload', as(7)))).getResponse() as any)
        .retryAfterSeconds,
    ).toBe(35);
    now += 35_000;
    expect(guard.canActivate(context(Controller, 'upload', as(7)))).toBe(true);
  });

  it('applies a class-level policy to every handler and reads the limit from the environment', () => {
    guard.canActivate(context(WholeClass, 'one', as(1)));
    guard.canActivate(context(WholeClass, 'one', as(1)));
    expect(refused(() => guard.canActivate(context(WholeClass, 'one', as(1)))).getStatus()).toBe(
      429,
    );
    process.env.USER_THROTTLE_AI_PER_MIN = '5';
    expect(guard.canActivate(context(WholeClass, 'one', as(1)))).toBe(true);
  });

  it('refuses a request with no account behind it instead of counting it under a shared key', () => {
    for (const user of [
      undefined,
      {},
      { accessKeyData: {} },
      { shareKeyData: { uuid: 'x' } },
      as(0),
      as(-1),
      as(1.5),
    ])
      expect(() => guard.canActivate(context(Controller, 'upload', user))).toThrow(
        ForbiddenException,
      );
    expect(guard.size()).toBe(0);
  });

  it('drops expired windows as requests arrive, so the map does not grow', () => {
    for (let id = 1; id <= 50; id += 1) guard.canActivate(context(Controller, 'upload', as(id)));
    expect(guard.size()).toBe(50);
    now += 61_000;
    guard.canActivate(context(Controller, 'upload', as(999)));
    expect(guard.size()).toBe(1);
  });

  it('uses its own metadata key, not the per-IP @Throttle one', () => {
    expect(USER_THROTTLE_KEY).toBe('vanillameta:user-throttle');
    expect(USER_THROTTLE_KEY).not.toMatch(/THROTTLER/);
    expect(Reflect.getMetadata('THROTTLER:LIMIT', Controller.prototype.upload)).toBeUndefined();
  });
});

describe('user throttle settings', () => {
  it('defaults to 20 AI, 5 upload, 30 read, 10 remix a minute and accepts overrides', () => {
    expect(userThrottleLimit('ai', {})).toBe(20);
    expect(userThrottleLimit('upload', {})).toBe(5);
    expect(userThrottleLimit('read', {})).toBe(30);
    expect(userThrottleLimit('remix', {})).toBe(10);
    expect(userThrottleLimit('read', { USER_THROTTLE_READ_PER_MIN: '9' } as any)).toBe(9);
    expect(userThrottleLimit('ai', { USER_THROTTLE_AI_PER_MIN: ' 7 ' } as any)).toBe(7);
    expect(userThrottleLimit('remix', { USER_THROTTLE_REMIX_PER_MIN: '4' } as any)).toBe(4);
  });

  it.each(['0', '-1', '1.5', 'many'])('rejects %s', value => {
    expect(() =>
      userThrottleLimit('upload', { USER_THROTTLE_UPLOAD_PER_MIN: value } as any),
    ).toThrow('USER_THROTTLE_UPLOAD_PER_MIN must be a positive integer');
    expect(userThrottleConfigProblems({ USER_THROTTLE_AI_PER_MIN: value } as any)).toEqual([
      'USER_THROTTLE_AI_PER_MIN must be a positive integer',
    ]);
  });

  it('stops a production boot on a malformed value', () => {
    const base = {
      NODE_ENV: 'prod',
      ACCESS_SECRET: 'a'.repeat(40),
      REFRESH_SECRET: 'b'.repeat(40),
      JWT_ACCESS_SECRET: 'c'.repeat(40),
      URL_ACCESS_SECRET: 'd'.repeat(40),
      CONFIG_SECRET_KEY: 'e'.repeat(40),
      CORS_ORIGIN: 'https://app.example.test',
    } as any;
    expect(productionConfigProblems({ ...base, USER_THROTTLE_AI_PER_MIN: '0' })).toHaveLength(1);
    expect(productionConfigProblems({ ...base, USER_THROTTLE_AI_PER_MIN: '30' })).toEqual([]);
    expect(productionConfigProblems({ ...base, USER_THROTTLE_REMIX_PER_MIN: 'many' })).toEqual([
      'USER_THROTTLE_REMIX_PER_MIN must be a positive integer',
    ]);
  });
});
