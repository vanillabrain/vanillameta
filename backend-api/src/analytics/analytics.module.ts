import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsDashboardController } from './analytics-dashboard.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsHelper } from './analytics.helper';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { CustomLoggerService } from '../common/logger/logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent])],
  controllers: [AnalyticsController, AnalyticsDashboardController],
  providers: [AnalyticsService, AnalyticsHelper, CustomLoggerService],
  exports: [AnalyticsService, AnalyticsHelper],
})
export class AnalyticsModule {}