import { IsEnum, IsOptional, IsString, IsInt, IsDateString, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { JobType, JobStatus, JobPriority } from '../entities/queue-job.entity';

export class JobQueryDto {
  @ApiPropertyOptional({
    enum: JobStatus,
    description: '작업 상태 필터',
    example: JobStatus.RUNNING,
  })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiPropertyOptional({
    enum: JobType,
    description: '작업 유형 필터',
    example: JobType.QUERY_EXECUTION,
  })
  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @ApiPropertyOptional({
    enum: JobPriority,
    description: '우선순위 필터',
    example: JobPriority.HIGH,
  })
  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority;

  @ApiPropertyOptional({
    description: '사용자 ID 필터',
    example: 'user123',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: '상관관계 ID 필터',
    example: 'dashboard-refresh-2024-01',
  })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional({
    description: '작업자 ID 필터',
    example: 'lambda-instance-001',
  })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({
    description: '생성일 시작 범위 (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: '생성일 종료 범위 (ISO 8601)',
    example: '2024-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: '페이지 번호 (1부터 시작)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '페이지당 항목 수',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: '정렬 기준 (createdAt, updatedAt, priority)',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: '정렬 순서 (ASC, DESC)',
    example: 'DESC',
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class JobListResponseDto {
  @ApiPropertyOptional({
    description: '작업 목록',
    type: 'array',
  })
  jobs: any[];

  @ApiPropertyOptional({
    description: '전체 항목 수',
    example: 150,
  })
  total: number;

  @ApiPropertyOptional({
    description: '현재 페이지',
    example: 1,
  })
  page: number;

  @ApiPropertyOptional({
    description: '페이지당 항목 수',
    example: 20,
  })
  limit: number;

  @ApiPropertyOptional({
    description: '전체 페이지 수',
    example: 8,
  })
  totalPages: number;

  @ApiPropertyOptional({
    description: '이전 페이지 존재 여부',
    example: false,
  })
  hasPrevious: boolean;

  @ApiPropertyOptional({
    description: '다음 페이지 존재 여부',
    example: true,
  })
  hasNext: boolean;
}