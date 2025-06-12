import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from '../database/entities/database.entity';
import { ConnectionService } from './connection.service';
import { DatabaseService } from '../database/database.service';
import { Dataset } from '../dataset/entities/dataset.entity';
import { SqlValidationModule } from '../common/security/sql-validation.module';

@Module({
  imports: [TypeOrmModule.forFeature([Database, Dataset]), SqlValidationModule],
  providers: [ConnectionService],
  exports: [ConnectionService],
})
export class ConnectionModule {}
