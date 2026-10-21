import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from '../../nest-utils/request-logging.interceptor';
import { CustomLoggerService } from '../logger/logger.service';
import { ResponseTimeInterceptor } from '../interceptors/response-time.interceptor';
import { MetricsInterceptor } from '../interceptors/metrics.interceptor';
import { SlowQueryInterceptor } from '../interceptors/slow-query.interceptor';
import { QueryPerformanceInterceptor } from '../interceptors/query-performance.interceptor';
import { MemoryMonitorMiddleware } from '../monitoring/memory-monitor.middleware';
import { UNMATCHED_ROUTE } from './safe-route-template';
import { TypeOrmSlowQueryLogger } from '../monitoring/typeorm-slow-query-logger';

const secret = 'private-capability-value';
function request(matched = true): any {
  return {
    method: 'GET',
    path: `/share/${secret}`,
    url: `/share/${secret}?token=${secret}`,
    originalUrl: `/tenant/${secret}/share/${secret}?token=${secret}`,
    baseUrl: `/tenant/${secret}`,
    route: matched ? { path: '/share/:shareId' } : undefined,
    get: jest.fn().mockReturnValue('test'),
    socket: {},
    body: {},
  };
}
function context(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ statusCode: 200 }) }),
  } as any;
}
function expectSafe(value: any, route = '/share/:shareId') {
  const encoded = JSON.stringify(value);
  expect(encoded).toContain(route);
  expect(encoded).not.toContain(secret);
  expect(encoded).not.toContain('?token=');
}

describe('Observability route safety', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ignores raw query-runner requestPath metadata without framework route context', () => {
    const logger = new TypeOrmSlowQueryLogger({} as any, {} as any);
    expect(
      (logger as any).getCurrentRequestPath({ data: { requestPath: `/share/${secret}` } }),
    ).toBe(UNMATCHED_ROUTE);
    expect((logger as any).getCurrentRequestPath({ data: { request: request() } })).toBe(
      '/share/:shareId',
    );
  });

  it.each([true, false])(
    'request logs on success and error use only template labels (matched=%s)',
    async matched => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const interceptor = new RequestLoggingInterceptor();
      const ctx = context(request(matched));
      await lastValueFrom(interceptor.intercept(ctx, { handle: () => of({}) }));
      await expect(
        lastValueFrom(
          interceptor.intercept(ctx, { handle: () => throwError(() => new Error('failure')) }),
        ),
      ).rejects.toThrow('failure');
      expect(log).toHaveBeenCalledTimes(2);
      for (const call of log.mock.calls)
        expectSafe(call, matched ? '/share/:shareId' : UNMATCHED_ROUTE);
    },
  );

  it('structured logger uses the template in both message and metadata', () => {
    const logger = new CustomLoggerService();
    const log = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    logger.logRequest(request());
    expect(log.mock.calls[0][2].requestPath).toBe('/share/:shareId');
    expectSafe(log.mock.calls);
  });

  it.each([true, false])(
    'response timing logs and metric dimensions do not use raw paths (matched=%s)',
    async matched => {
      const metrics = { recordApiUsage: jest.fn().mockResolvedValue(undefined) };
      const interceptor = new ResponseTimeInterceptor(metrics as any);
      const debug = jest
        .spyOn((interceptor as any).logger, 'debug')
        .mockImplementation(() => undefined);
      const error = jest
        .spyOn((interceptor as any).logger, 'error')
        .mockImplementation(() => undefined);
      const ctx = context(request(matched));
      await lastValueFrom(interceptor.intercept(ctx, { handle: () => of({}) }));
      await expect(
        lastValueFrom(
          interceptor.intercept(ctx, { handle: () => throwError(() => new Error('failure')) }),
        ),
      ).rejects.toThrow('failure');
      const label = matched ? '/share/:shareId' : UNMATCHED_ROUTE;
      expect(metrics.recordApiUsage).toHaveBeenCalledWith(label, 'GET', 200, expect.any(Number));
      expect(metrics.recordApiUsage).toHaveBeenCalledWith(label, 'GET', 500, expect.any(Number));
      expectSafe([debug.mock.calls, error.mock.calls, metrics.recordApiUsage.mock.calls], label);
    },
  );

  it('integrated metrics and slow-query metadata share the template contract', async () => {
    const metrics = { recordApiRequest: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new MetricsInterceptor(metrics as any);
    await lastValueFrom(interceptor.intercept(context(request()), { handle: () => of({}) }));
    expectSafe(metrics.recordApiRequest.mock.calls);
    const slowQuery = new SlowQueryInterceptor({} as any, {} as any);
    expectSafe((slowQuery as any).extractRequestMetadata(request()));
  });

  it('query performance error logs use a template source dimension', async () => {
    const interceptor = new QueryPerformanceInterceptor(
      {} as any,
      {} as any,
      { get: (_key: string, fallback: any) => fallback } as any,
    );
    const log = jest
      .spyOn((interceptor as any).logger, 'error')
      .mockImplementation(() => undefined);
    await expect(
      lastValueFrom(
        interceptor.intercept(context(request()), {
          handle: () => throwError(() => new Error('failure')),
        }),
      ),
    ).rejects.toThrow('failure');
    expectSafe(log.mock.calls);
  });

  it('memory monitoring resolves the route at response completion, excluding resolved mounts', () => {
    jest
      .spyOn(MemoryMonitorMiddleware.prototype as any, 'startPeriodicMonitoring')
      .mockImplementation(() => undefined);
    const logger: any = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const middleware = new MemoryMonitorMiddleware(logger, {} as any);
    jest
      .spyOn(middleware as any, 'getMemoryMetrics')
      .mockReturnValueOnce({ heapUsed: 1000, percentUsed: 1 })
      .mockReturnValueOnce({ heapUsed: 60 * 1024 * 1024, percentUsed: 2 });
    const metrics = jest
      .spyOn(middleware as any, 'sendMetricsToCloudWatch')
      .mockResolvedValue(undefined);
    const req = request(false);
    let finish: () => void;
    const res = {
      on: jest.fn((_event, callback) => {
        finish = callback;
      }),
    };
    middleware.use(req, res as any, jest.fn());
    req.route = { path: '/share/:shareId' };
    finish!();
    expectSafe([logger.debug.mock.calls, logger.warn.mock.calls, metrics.mock.calls]);
    expect(metrics.mock.calls[0][1]).toBe('/share/:shareId');
  });
});
