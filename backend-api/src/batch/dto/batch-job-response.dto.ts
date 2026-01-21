import { ApiProperty } from '@nestjs/swagger';
import { BatchJobStatus, BatchJobType } from '../entities/batch-job.entity';

export class BatchJobResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ enum: BatchJobType })
  type: BatchJobType;

  @ApiProperty({ enum: BatchJobStatus })
  status: BatchJobStatus;

  @ApiProperty()
  totalRecords: number;

  @ApiProperty()
  processedRecords: number;

  @ApiProperty()
  chunkSize: number;

  @ApiProperty()
  totalChunks: number;

  @ApiProperty()
  completedChunks: number;

  @ApiProperty()
  failedChunks: number;

  @ApiProperty({
    description: '진행률 (0-100)',
    example: 75,
  })
  progress: number;

  @ApiProperty({
    description: '예상 남은 시간 (밀리초)',
    example: 5000,
    nullable: true,
  })
  estimatedTimeRemaining: number | null;

  @ApiProperty({ nullable: true })
  errorMessage: string;

  @ApiProperty({ nullable: true })
  startedAt: Date;

  @ApiProperty({ nullable: true })
  completedAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  metadata: Record<string, any>;

  constructor(partial: Partial<BatchJobResponseDto>) {
    Object.assign(this, partial);
  }
}

export class BatchChunkResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  sequence: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  startOffset: number;

  @ApiProperty()
  endOffset: number;

  @ApiProperty()
  recordCount: number;

  @ApiProperty()
  processedCount: number;

  @ApiProperty({
    description: '진행률 (0-100)',
    example: 50,
  })
  progress: number;

  @ApiProperty()
  retryCount: number;

  @ApiProperty({ nullable: true })
  errorMessage: string;

  @ApiProperty({ nullable: true })
  startedAt: Date;

  @ApiProperty({ nullable: true })
  completedAt: Date;

  @ApiProperty({
    description: '처리 시간 (밀리초)',
    nullable: true,
  })
  processingTime: number | null;

  constructor(partial: Partial<BatchChunkResponseDto>) {
    Object.assign(this, partial);
  }
}
