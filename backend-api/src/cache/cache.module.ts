import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { RedisClientOptions } from 'redis';
import { QueryCacheService } from './services/query-cache.service';
import { CacheStatisticsService } from './services/cache-statistics.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { CacheConsistencyService } from './services/cache-consistency.service';
import { CacheController } from './cache.controller';

@Module({
  imports: [
    NestCacheModule.registerAsync<RedisClientOptions>({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const isLocal = configService.get('NODE_ENV') === 'local';

        // 로컬 환경에서는 메모리 캐시 사용, 다른 환경에서는 Redis 사용
        if (isLocal) {
          return {
            isGlobal: true,
            ttl: 300, // 5분 기본 TTL
            max: 1000, // 최대 1000개 항목
          };
        }

        return {
          store: redisStore,
          socket: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
          },
          password: configService.get('REDIS_PASSWORD'),
          database: configService.get('REDIS_DB', 0),
          ttl: 300, // 기본 5분 TTL
          isGlobal: true,
          // Redis 특정 설정
          lazyConnect: true, // Lambda 환경에서 연결 지연
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000, // 10초 연결 타임아웃
          commandTimeout: 5000, // 5초 명령 타임아웃
          // Lambda 환경 최적화
          keepAlive: 30000, // 30초 KeepAlive
          family: 4, // IPv4 사용
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    QueryCacheService,
    CacheStatisticsService,
    CacheInvalidationService,
    CacheConsistencyService,
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
