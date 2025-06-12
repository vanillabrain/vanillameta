import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from '../database/entities/database.entity';
import { ConnectionService } from './connection.service';
import { DatabaseService } from '../database/database.service';
import { Dataset } from '../dataset/entities/dataset.entity';
import { SqlValidationModule } from '../common/security/sql-validation.module';
import { QueryAnalyzerModule } from '../common/monitoring/query-analyzer.module';
import { QueryCollector } from '../common/utils/query-collector';

@Module({
  imports: [
    TypeOrmModule.forFeature([Database, Dataset]), 
    SqlValidationModule,
    QueryAnalyzerModule,
  ],
  providers: [ConnectionService, QueryCollector],
  exports: [ConnectionService],
})
export class ConnectionModule {}
