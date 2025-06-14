import { IsEnum, IsNotEmpty, IsOptional, IsString, IsObject, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType } from '../entities/background-job.entity';

export class CreateBackgroundJobDto {
  @ApiProperty({ description: '작업 유형', enum: JobType })
  @IsEnum(JobType)
  @IsNotEmpty()
  jobType: JobType;

  @ApiProperty({ description: '작업 제목' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: '작업 설명' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '데이터셋 ID' })
  @IsUUID()
  @IsOptional()
  datasetId?: string;

  @ApiPropertyOptional({ description: '위젯 ID' })
  @IsUUID()
  @IsOptional()
  widgetId?: string;

  @ApiPropertyOptional({ description: '데이터베이스 ID' })
  @IsUUID()
  @IsOptional()
  databaseId?: string;

  @ApiPropertyOptional({ description: 'SQL 쿼리' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({ description: '추가 메타데이터' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
