import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { QueryCacheService } from './query-cache.service';
import { RedisCacheService } from './redis-cache.service';
import { HybridCacheService } from './hybrid-cache.service';
import { L1CacheService } from './l1-cache.service';
import { CompressionService } from './compression.service';
import { CacheController } from './cache.controller';
import { DatabaseSpecificOptimizationService } from './database-specific-optimization.service';
import { CustomLoggerService } from '../logger/logger.service';
import { CacheMetricsController } from '../cache/cache-metrics.controller';
import { CacheWarmupScheduler } from '../scheduler/cache-warmup.scheduler';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { CacheInvalidationController } from '../cache/cache-invalidation.controller';
import { CacheMonitoringService } from '../cache/cache-monitoring.service';
import { CacheMonitoringController } from '../cache/cache-monitoring.controller';
import { CacheAlertService } from '../cache/cache-alert.service';

import { Dataset } from '../../dataset/entities/dataset.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { DatasetModule } from '../../dataset/dataset.module';
import { DashboardModule } from '../../dashboard/dashboard.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([Dataset, Widget, Dashboard]),
    forwardRef(() => DatasetModule),
    forwardRef(() => DashboardModule),
  ],
  providers: [
    CustomLoggerService,
    DatabaseSpecificOptimizationService,
    CompressionService,
    L1CacheService,
    QueryCacheService,
    RedisCacheService,
    HybridCacheService,
    CacheWarmupScheduler,
    CacheInvalidationService,
    CacheMonitoringService,
    CacheAlertService,
  ],
  controllers: [
    CacheController,
    CacheMetricsController,
    CacheInvalidationController,
    CacheMonitoringController,
  ],
  exports: [
    L1CacheService,
    QueryCacheService,
    RedisCacheService,
    HybridCacheService,
    CacheWarmupScheduler,
    CacheInvalidationService,
    CacheMonitoringService,
    CacheAlertService,
  ],
})
export class CacheModule {}
