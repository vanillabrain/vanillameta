import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchService } from './batch.service';
import { BatchController } from './batch.controller';
import { BatchJob } from './entities/batch-job.entity';
import { BatchChunk } from './entities/batch-chunk.entity';
import { DatasetModule } from '../dataset/dataset.module';
import { WidgetModule } from '../widget/widget.module';
import { ConnectionModule } from '../connection/connection.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BatchJob, BatchChunk]),
    DatasetModule,
    WidgetModule,
    ConnectionModule,
    CommonModule,
  ],
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService],
})
export class BatchModule {}
