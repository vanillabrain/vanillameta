import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QueryCacheService } from './query-cache.service';
import { RedisCacheService } from './redis-cache.service';
import { HybridCacheService } from './hybrid-cache.service';
import { CacheController } from './cache.controller';
import { DatabaseSpecificOptimizationService } from './database-specific-optimization.service';
import { CustomLoggerService } from '../logger/logger.service';

import { Dataset } from '../../dataset/entities/dataset.entity';
import { Widget } from '../../widget/entities/widget.entity';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Dataset, Widget]),
  ],
  providers: [
    CustomLoggerService,
    DatabaseSpecificOptimizationService,
    QueryCacheService,
    RedisCacheService,
    HybridCacheService,
  ],
  controllers: [CacheController],
  exports: [
    QueryCacheService,
    RedisCacheService,
    HybridCacheService,
  ],
})
export class CacheModule {}