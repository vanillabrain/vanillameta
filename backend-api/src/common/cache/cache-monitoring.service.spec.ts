import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheMonitoringService } from './cache-monitoring.service';
import { HybridCacheService } from '../optimization/hybrid-cache.service';
import { RedisCacheService } from '../optimization/redis-cache.service';
import { L1CacheService } from '../optimization/l1-cache.service';
import { CustomLoggerService } from '../logger/logger.service';

describe('CacheMonitoringService owned Redis connection', () => {
  it('constructs without an independent Redis module and reports a disconnected client safely', async () => {
    const module = await Test.createTestingModule({
      providers: [
        CacheMonitoringService,
        { provide: HybridCacheService, useValue: {} },
        { provide: RedisCacheService, useValue: { getClient: () => undefined } },
        { provide: L1CacheService, useValue: {} },
        { provide: CustomLoggerService, useValue: {} },
        { provide: EventEmitter2, useValue: {} },
      ],
    }).compile();
    const service = module.get(CacheMonitoringService);
    expect(await (service as any).getRedisInfo()).toEqual({
      connected: false,
      memoryUsage: 0,
      latency: { avg: 0, p50: 0, p95: 0, p99: 0 },
    });
    expect(await (service as any).getRedisStats('dashboard')).toEqual({
      hitRate: 0,
      hits: 0,
      misses: 0,
      keyCount: 0,
      evictions: 0,
    });
    await module.close();
  });
});
