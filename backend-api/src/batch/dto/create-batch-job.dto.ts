import { IsEnum, IsNotEmpty, IsNumber, IsOptional, Min, Max, IsObject } from 'class-validator';
import { BatchJobType } from '../entities/batch-job.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBatchJobDto {
  @ApiProperty({
    description: '배치 작업 유형',
    enum: BatchJobType,
    example: BatchJobType.DATASET_QUERY,
  })
  @IsEnum(BatchJobType)
  @IsNotEmpty()
  type: BatchJobType;

  @ApiProperty({
    description: '청크 크기 (100-10000)',
    example: 1000,
    minimum: 100,
    maximum: 10000,
  })
  @IsNumber()
  @Min(100)
  @Max(10000)
  @IsOptional()
  chunkSize?: number = 1000;

  @ApiProperty({
    description: '데이터셋 ID (DATASET_QUERY 타입인 경우)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  datasetId?: number;

  @ApiProperty({
    description: '위젯 ID (WIDGET_DATA 타입인 경우)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  widgetId?: number;

  @ApiProperty({
    description: '작업 설정',
    required: false,
    example: {
      query: 'SELECT * FROM users',
      databaseId: 1,
      filters: {},
    },
  })
  @IsObject()
  @IsOptional()
  config?: {
    query?: string;
    databaseId?: number;
    filters?: any;
    options?: any;
  };

  @ApiProperty({
    description: '작업 메타데이터',
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
