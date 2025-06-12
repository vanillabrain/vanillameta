import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConnectionPoolMonitorService } from './connection-pool-monitor.service';
import { MonitoringController } from './monitoring.controller';
import { LoggerModule } from '../logger/logger.module';
import { QueryAnalyzerModule } from './query-analyzer.module';
import { QueryAnalyzerController } from './query-analyzer.controller';
import { QueryOptimizationReportController } from './query-optimization-report.controller';
import { QueryCollector } from '../utils/query-collector';

@Module({
  imports: [ScheduleModule.forRoot(), LoggerModule, QueryAnalyzerModule],
  controllers: [MonitoringController, QueryAnalyzerController, QueryOptimizationReportController],
  providers: [ConnectionPoolMonitorService, QueryCollector],
  exports: [ConnectionPoolMonitorService, QueryAnalyzerModule],
})
export class MonitoringModule {}
