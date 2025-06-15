import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchProcessingService } from './batch-processing.service';
import { BatchProcessingController } from './batch-processing.controller';
import { ChunkProcessor } from './services/chunk-processor.service';
import { ProgressTracker } from './services/progress-tracker.service';
import { StreamingResponseService } from './services/streaming-response.service';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/table-query/entity/table-query.entity';
import { ConnectionModule } from '../connection/connection.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Database, Dataset, TableQuery]),
    ConnectionModule,
    CommonModule,
  ],
  controllers: [BatchProcessingController],
  providers: [BatchProcessingService, ChunkProcessor, ProgressTracker, StreamingResponseService],
  exports: [BatchProcessingService, ChunkProcessor, ProgressTracker],
})
export class BatchProcessingModule {}
