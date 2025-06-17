import { Module } from '@nestjs/common';
import { BusinessMetricsService } from './business-metrics.service';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';

@Module({
  providers: [BusinessMetricsService, CloudWatchMetricsService],
  exports: [BusinessMetricsService],
})
export class BusinessMetricsModule {}