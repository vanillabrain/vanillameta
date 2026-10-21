import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PassThrough, Writable } from 'stream';
import { MemoryMonitorService } from './memory-monitor.service';
import { MemoryMonitorMiddleware } from './memory-monitor.middleware';
import { IntegratedMetricsService } from './integrated-metrics.service';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';
import { QueryPerformanceMetricsInterceptor } from '../interceptors/query-performance-metrics.interceptor';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';

jest.mock('aws-sdk', () => ({
  CloudWatch: jest.fn(() => ({
    putMetricData: jest.fn(() => ({ promise: () => Promise.resolve() })),
  })),
}));

const logger: any = {
  debug: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

function providers() {
  const metrics = new CloudWatchMetricsService(
    new ConfigService({ CLOUDWATCH_METRICS_ENABLED: true }),
  );
  const collector = { getQueries: jest.fn(() => []) };
  const services = [
    metrics,
    new MemoryMonitorService(logger),
    new MemoryMonitorMiddleware(logger, metrics),
    new IntegratedMetricsService(metrics, new ConfigService({ NODE_ENV: 'test' })),
    new QueryPerformanceMetricsInterceptor({} as any, collector as any),
    new CacheInvalidationService(
      {} as any,
      {} as any,
      {} as any,
      logger,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    ),
  ];
  return { services, collector };
}

async function nestModule(services: ReturnType<typeof providers>['services']) {
  return Test.createTestingModule({
    providers: services.map(service => ({ provide: service.constructor, useValue: service })),
  }).compile();
}

describe('observability timer lifecycle', () => {
  beforeEach(() => {
    const usage = process.memoryUsage();
    jest.spyOn(process, 'memoryUsage').mockReturnValue({ ...usage, rss: 256 * 1024 * 1024 });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not retain the Node process for background collection, and supports repeated Nest close', async () => {
    const intervals = jest.spyOn(global, 'setInterval');
    const { services } = providers();
    const handles = intervals.mock.results.map(result => result.value as NodeJS.Timeout);
    const module = await nestModule(services);
    try {
      expect(handles.length).toBeGreaterThanOrEqual(services.length);
      expect(handles.every(handle => !handle.hasRef())).toBe(true);
    } finally {
      await module.close();
      await module.close();
    }
  });

  it('stops periodic work on Nest shutdown and still flushes buffered CloudWatch metrics', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'performance'] });
    const { services, collector } = providers();
    const metrics = services[0] as CloudWatchMetricsService;
    const put = jest.spyOn(metrics, 'putMetric');
    const module = await nestModule(services);
    try {
      jest.advanceTimersByTime(60000);
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(collector.getQueries).toHaveBeenCalledTimes(1);
      expect(put).toHaveBeenCalled();
      await metrics.putMetric('LifecycleTest', 'ShutdownBuffer', 1);
      const cloudWatch = (jest.requireMock('aws-sdk').CloudWatch as jest.Mock).mock.results.slice(
        -1,
      )[0].value;
      cloudWatch.putMetricData.mockClear();
      await module.close();
      expect(cloudWatch.putMetricData).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({ MetricName: 'ShutdownBuffer' }),
          ]),
        }),
      );
      expect(jest.getTimerCount()).toBe(0);
      put.mockClear();
      collector.getQueries.mockClear();
      jest.advanceTimersByTime(600000);
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(put).not.toHaveBeenCalled();
      expect(collector.getQueries).not.toHaveBeenCalled();
    } finally {
      await module.close();
    }
  });

  it('cancels a pending pipeline resume on shutdown without destroying the application stream', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'performance'] });
    const memory = jest.spyOn(process, 'memoryUsage');
    const usage = process.memoryUsage();
    memory.mockReturnValue({ ...usage, rss: 3 * 1024 * 1024 * 1024 });
    const service = new MemoryMonitorService(logger);
    const source = new PassThrough();
    const destination = new Writable({ write: (_chunk, _encoding, callback) => callback() });
    const finished = service.createOptimizedPipeline(source, [], destination);
    const resume = jest.spyOn(source, 'resume');
    resume.mockClear();
    jest.advanceTimersByTime(500);
    expect(source.isPaused()).toBe(true);
    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(2000);
    expect(resume).not.toHaveBeenCalled();
    expect(source.destroyed).toBe(false);
    source.resume();
    source.end();
    await finished;
  });
});
