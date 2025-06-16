import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConnectionPoolMonitorService } from './connection-pool-monitor.service';
import { MonitoringController } from './monitoring.controller';
import { LoggerModule } from '../logger/logger.module';
import { QueryAnalyzerModule } from './query-analyzer.module';
import { QueryAnalyzerController } from './query-analyzer.controller';
import { QueryOptimizationReportController } from './query-optimization-report.controller';
import { QueryCollector } from '../utils/query-collector';
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
    TypeOrmModule.forFeature([Dashboard, Widget, Dataset, TableQuery]),
  ],
  controllers: [MonitoringController, QueryAnalyzerController, QueryOptimizationReportController],
  providers: [ConnectionPoolMonitorService, QueryCollector, QueryOptimizationService],
  exports: [ConnectionPoolMonitorService, QueryAnalyzerModule, QueryCollector],
})
export class MonitoringModule {}
