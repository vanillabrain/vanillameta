import { Module, Scope } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from '../database/entities/database.entity';
import { ConnectionService } from './connection.service';
import { DatabaseService } from '../database/database.service';
import { Dataset } from '../dataset/entities/dataset.entity';
import { SqlValidationModule } from '../common/security/sql-validation.module';
import { QueryAnalyzerModule } from '../common/monitoring/query-analyzer.module';
import { MonitoringModule } from '../common/monitoring/monitoring.module';
import { QueryCollector } from '../common/utils/query-collector';
<<<<<<< HEAD
import { DatabaseOptimizersModule } from './database-optimizers';
=======
import { DatabaseOptimizerModule } from './optimizers/database-optimizer.module';
>>>>>>> task/T07_S03

@Module({
  imports: [
    TypeOrmModule.forFeature([Database, Dataset]),
    SqlValidationModule,
    QueryAnalyzerModule,
    MonitoringModule,
<<<<<<< HEAD
    DatabaseOptimizersModule,
=======
    DatabaseOptimizerModule,
>>>>>>> task/T07_S03
  ],
  providers: [
    {
      provide: ConnectionService,
      useClass: ConnectionService,
      scope: Scope.REQUEST,
    },
    QueryCollector,
  ],
  exports: [ConnectionService],
})
export class ConnectionModule {}
