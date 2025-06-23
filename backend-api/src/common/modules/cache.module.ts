import { Module, Global } from '@nestjs/common';
import { CacheKeyService } from '../services/cache-key.service';
import { CacheMetricsService } from '../services/cache-metrics.service';
import { CacheInvalidationService } from '../services/cache-invalidation.service';
import { ApiCacheInterceptor } from '../interceptors/api-cache.interceptor';

@Global()
@Module({
  providers: [
    CacheKeyService,
    CacheMetricsService,
    CacheInvalidationService,
    ApiCacheInterceptor,
  ],
  exports: [
    CacheKeyService,
    CacheMetricsService,
    CacheInvalidationService,
    ApiCacheInterceptor,
  ],
})
export class CacheModule {}