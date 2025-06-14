import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConnectionPoolMonitorService } from './connection-pool-monitor.service';
import { MonitoringController } from './monitoring.controller';
import { LoggerModule } from '../logger/logger.module';
import { QueryAnalyzerModule } from './query-analyzer.module';
import { QueryAnalyzerController } from './query-analyzer.controller';
import { QueryOptimizationReportController } from './query-optimization-report.controller';
import { QueryCollector } from '../utils/query-collector';
import { SlowQueryMonitorService } from './slow-query-monitor.service';
import { SlowQueryMonitorController } from './slow-query-monitor.controller';
import { SlowQueryLog } from './entities/slow-query-log.entity';
import { SlowQueryInterceptor } from '../interceptors/slow-query.interceptor';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoggerModule,
    QueryAnalyzerModule,
    TypeOrmModule.forFeature([SlowQueryLog]),
  ],
  controllers: [
    MonitoringController,
    QueryAnalyzerController,
    QueryOptimizationReportController,
    SlowQueryMonitorController,
  ],
  providers: [
    ConnectionPoolMonitorService,
    QueryCollector,
    SlowQueryMonitorService,
    SlowQueryInterceptor,
    CloudWatchMetricsService,
  ],
  exports: [
    ConnectionPoolMonitorService,
    QueryAnalyzerModule,
    SlowQueryMonitorService,
    SlowQueryInterceptor,
    CloudWatchMetricsService,
  ],
})
export class MonitoringModule {}
