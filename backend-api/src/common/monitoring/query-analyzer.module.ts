import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryAnalyzerService } from './query-analyzer.service';
import { Database } from '../../database/entities/database.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Database])],
  providers: [QueryAnalyzerService],
  exports: [QueryAnalyzerService],
})
export class QueryAnalyzerModule {}
