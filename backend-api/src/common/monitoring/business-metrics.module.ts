import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { BusinessMetricsService } from './business-metrics.service';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';

@Module({
  imports: [ConfigModule],
  providers: [BusinessMetricsService, CloudWatchMetricsService],
  exports: [BusinessMetricsService],
})
export class BusinessMetricsModule {}
