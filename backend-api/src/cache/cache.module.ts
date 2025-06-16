import { Module } from '@nestjs/common';
// import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import { redisStore } from 'cache-manager-redis-yet';
// import { RedisClientOptions } from 'redis';
import { QueryCacheService } from './services/query-cache.service';
import { CacheStatisticsService } from './services/cache-statistics.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { CacheConsistencyService } from './services/cache-consistency.service';
import { CacheController } from './cache.controller';

@Module({
  imports: [
    ConfigModule,
    // TODO: Re-enable cache module after resolving dependency issues
    // NestCacheModule.registerAsync<RedisClientOptions>({...})
  ],
  providers: [
    QueryCacheService,
    CacheStatisticsService,
    CacheInvalidationService,
    CacheConsistencyService,
    // Temporary in-memory cache provider
    {
      provide: 'CACHE_MANAGER',
      useValue: {
        get: async () => null,
        set: async () => {},
        del: async () => {},
        reset: async () => {},
        wrap: async (key, fn) => fn(),
        keys: async () => [],
        ttl: async () => 0,
      },
    },
  ],
  controllers: [CacheController],
  exports: [
    QueryCacheService,
    CacheStatisticsService,
    CacheInvalidationService,
    CacheConsistencyService,
  ],
})
export class CacheModule {}
