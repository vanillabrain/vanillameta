import { IsEnum, IsOptional, IsString, IsInt, IsObject, IsBoolean, IsEmail, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType, JobPriority } from '../entities/queue-job.entity';

export class CreateJobDto {
  @ApiProperty({
    enum: JobType,
    description: '작업 유형',
    example: JobType.QUERY_EXECUTION,
  })
  @IsEnum(JobType)
  jobType: JobType;

  @ApiProperty({
    description: '작업 데이터 (JSON 객체)',
    example: {
      query: 'SELECT * FROM users',
      databaseId: 1,
      parameters: [],
    },
  })
  @IsObject()
  jobData: any;

  @ApiPropertyOptional({
    enum: JobPriority,
    description: '작업 우선순위',
    example: JobPriority.NORMAL,
    default: JobPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority;

  @ApiPropertyOptional({
    description: '최대 재시도 횟수',
    example: 3,
    minimum: 0,
    maximum: 10,
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({
    description: '예약 실행 시간 (ISO 8601 형식)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: '예상 실행 시간 (밀리초)',
    example: 30000,
    minimum: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  estimatedTimeMs?: number;

  @ApiPropertyOptional({
    description: '상관관계 ID (관련 작업 그룹핑)',
    example: 'dashboard-refresh-2024-01',
  })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional({
    description: '추가 메타데이터',
    example: {
      dashboardId: 123,
      exportFormat: 'xlsx',
      filters: { dateRange: '2024-01-01,2024-01-31' },
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: any;

  @ApiPropertyOptional({
    description: '완료 시 알림 필요 여부',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresNotification?: boolean;

  @ApiPropertyOptional({
    description: '알림 받을 이메일 주소',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  notificationEmail?: string;
}