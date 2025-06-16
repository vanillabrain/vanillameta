import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { CloudWatchMetricsService } from '../common/monitoring/cloudwatch-metrics.service';
import { CustomLoggerService } from '../common/logger/logger.service';
import { CommonModule } from '../common/common.module';
import { BusinessMetricsModule } from '../common/monitoring/business-metrics.module';

@Module({
  imports: [CommonModule, BusinessMetricsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, CloudWatchMetricsService, CustomLoggerService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
