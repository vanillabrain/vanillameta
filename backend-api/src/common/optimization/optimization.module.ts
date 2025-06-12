import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseSpecificOptimizationService } from './database-specific-optimization.service';
import { QueryCacheService } from './query-cache.service';
import { IndexRecommendationService } from './index-recommendation.service';
import { EnhancedConnectionPoolService } from './enhanced-connection-pool.service';
import { EnhancedQueryOptimizerService } from './enhanced-query-optimizer.service';
import { OptimizationController } from './optimization.controller';
import { Database } from '../../database/entities/database.entity';
import { CommonModule } from '../common.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

/**
 * 데이터베이스 최적화 모듈
 *
 * 이 모듈은 다음과 같은 최적화 기능을 제공합니다:
 * - 데이터베이스별 특화된 최적화 설정
 * - 지능형 쿼리 캐싱
 * - 인덱스 추천 시스템
 * - 향상된 연결 풀 관리
 * - 통합 쿼리 최적화
 */
@Module({
  imports: [TypeOrmModule.forFeature([Database]), CommonModule, MonitoringModule],
  providers: [
    DatabaseSpecificOptimizationService,
    QueryCacheService,
    IndexRecommendationService,
    EnhancedConnectionPoolService,
    EnhancedQueryOptimizerService,
  ],
  controllers: [OptimizationController],
  exports: [
    DatabaseSpecificOptimizationService,
    QueryCacheService,
    IndexRecommendationService,
    EnhancedConnectionPoolService,
    EnhancedQueryOptimizerService,
  ],
})
export class OptimizationModule {}
