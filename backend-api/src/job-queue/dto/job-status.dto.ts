import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '../entities/queue-job.entity';

export class UpdateJobStatusDto {
  @ApiProperty({
    enum: JobStatus,
    description: '새로운 작업 상태',
    example: JobStatus.RUNNING,
  })
  @IsEnum(JobStatus)
  status: JobStatus;

  @ApiPropertyOptional({
    description: '상태 변경 이유',
    example: 'Query execution started',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: '진행률 (0-100)',
    example: 45,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional({
    description: '에러 메시지 (실패 시)',
    example: 'Database connection timeout',
  })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({
    description: '작업자 ID',
    example: 'lambda-instance-001',
  })
  @IsOptional()
  @IsString()
  workerId?: string;
}

export class JobStatusResponseDto {
  @ApiProperty({
    description: '작업 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  jobId: string;

  @ApiProperty({
    enum: JobStatus,
    description: '현재 작업 상태',
    example: JobStatus.RUNNING,
  })
  status: JobStatus;

  @ApiProperty({
    description: '진행률 (0-100)',
    example: 45,
  })
  progress: number;

  @ApiPropertyOptional({
    description: '에러 메시지',
    example: 'Database connection timeout',
  })
  errorMessage?: string;

  @ApiPropertyOptional({
    description: '예상 완료 시간 (ISO 8601)',
    example: '2024-01-15T11:30:00Z',
  })
  estimatedCompletionTime?: string;

  @ApiProperty({
    description: '작업 생성 시간',
    example: '2024-01-15T10:00:00Z',
  })
  createdAt: string;

  @ApiPropertyOptional({
    description: '작업 시작 시간',
    example: '2024-01-15T10:05:00Z',
  })
  startedAt?: string;

  @ApiPropertyOptional({
    description: '작업 완료 시간',
    example: '2024-01-15T10:30:00Z',
  })
  completedAt?: string;
}
