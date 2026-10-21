import { ConfigService } from '@nestjs/config';
import { CacheMonitoringService } from './cache-monitoring.service';
import { CacheAlertService } from './cache-alert.service';
import { RedisCacheService } from '../optimization/redis-cache.service';

describe('Optional Redis observability', () => {
  const logger = () => ({ debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() });

  it('does not enable Redis implicitly in a development environment without an endpoint', () => {
    const service = new RedisCacheService(
      new ConfigService({ NODE_ENV: 'dev' }),
      logger() as any,
      {} as any,
    );
    expect((service as any).config.enabled).toBe(false);
  });

  it.each([
    { REDIS_HOST: '127.0.0.1' },
    { REDIS_URL: 'redis://127.0.0.1:6379' },
    { REDIS_CACHE_ENABLED: 'true' },
  ])('retains explicit Redis opt-in %j', setting => {
    const service = new RedisCacheService(
      new ConfigService({ NODE_ENV: 'dev', ...setting }),
      logger() as any,
      {} as any,
    );
    expect((service as any).config.enabled).toBe(true);
  });

  it('reports disabled Redis and zero traffic without emitting false alerts', async () => {
    const log = logger();
    const emitter = { emit: jest.fn() };
    const monitor = new CacheMonitoringService(
      {} as any,
      { getClient: () => undefined, isEnabled: () => false } as any,
      { getStats: async () => ({}) } as any,
      log as any,
      emitter as any,
    );
    const metrics = await (monitor as any).getEngineMetrics('dashboard');
    expect(metrics.l2.connectionStatus).toBe('disabled');
    expect(metrics.overall.totalRequests).toBe(0);
    await monitor.collectMetrics();
    expect(emitter.emit.mock.calls.filter(([name]) => name === 'cache.alert')).toHaveLength(0);
    const alerts = new CacheAlertService(log as any, new ConfigService());
    await alerts.handleMetricsCollected({ engine: 'dashboard', metrics, timestamp: Date.now() });
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
    const summary = await monitor.getCacheSummary();
    expect(summary.overall.status).toBe('healthy');
  });

  it('continues alerting when a configured Redis connection is actually unavailable', async () => {
    const log = logger();
    const monitor = new CacheMonitoringService(
      {} as any,
      { getClient: () => undefined, isEnabled: () => true } as any,
      { getStats: async () => ({}) } as any,
      log as any,
      { emit: jest.fn() } as any,
    );
    const metrics = await (monitor as any).getEngineMetrics('dashboard');
    const alerts = new CacheAlertService(log as any, new ConfigService());
    await alerts.handleMetricsCollected({ engine: 'dashboard', metrics, timestamp: Date.now() });
    expect(log.error).toHaveBeenCalled();
  });
});
