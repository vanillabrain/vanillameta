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
import { QueryOptimizationService } from './query-optimization.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { Dataset } from '../../dataset/entities/dataset.entity';
import { TableQuery } from '../../widget/table-query/entity/table-query.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoggerModule,
    QueryAnalyzerModule,
    TypeOrmModule.forFeature([SlowQueryLog, Dashboard, Widget, Dataset, TableQuery]),
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
    QueryOptimizationService,
  ],
  exports: [
    ConnectionPoolMonitorService,
    QueryAnalyzerModule,
    SlowQueryMonitorService,
    SlowQueryInterceptor,
    QueryCollector,
  ],
})
export class MonitoringModule {}
