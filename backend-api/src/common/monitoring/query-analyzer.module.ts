import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryAnalyzerService } from './query-analyzer.service';
import { Database } from '../../database/entities/database.entity';
import { SqlValidationModule } from '../security/sql-validation.module';

@Module({
  imports: [TypeOrmModule.forFeature([Database]), SqlValidationModule],
  providers: [QueryAnalyzerService],
  exports: [QueryAnalyzerService],
})
export class QueryAnalyzerModule {}
