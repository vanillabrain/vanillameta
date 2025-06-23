import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { PerformanceMetricsService } from '../../common/services/performance-metrics.service';
import { CloudWatchIntegrationService } from '../../common/services/cloudwatch-integration.service';
import { RedisModule } from '@liaoliaots/nestjs-redis';

/**
 * 성능 모니터링 모듈
 * 
 * API 성능 모니터링 관련 컨트롤러와 서비스를 제공합니다.
 */
@Module({
  imports: [RedisModule],
  controllers: [MonitoringController],
  providers: [
    PerformanceMetricsService,
    CloudWatchIntegrationService,
  ],
  exports: [
    PerformanceMetricsService,
    CloudWatchIntegrationService,
  ],
})
export class PerformanceMonitoringModule {}