import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus, JobType } from '../entities/background-job.entity';

export class BackgroundJobResponseDto {
  @ApiProperty({ description: '작업 ID' })
  id: string;

  @ApiProperty({ description: '작업 유형', enum: JobType })
  jobType: JobType;

  @ApiProperty({ description: '작업 상태', enum: JobStatus })
  status: JobStatus;

  @ApiProperty({ description: '작업 제목' })
  title: string;

  @ApiPropertyOptional({ description: '작업 설명' })
  description?: string;

  @ApiProperty({ description: '진행률 (0-100)', example: 50 })
  progress: number;

  @ApiPropertyOptional({ description: '에러 메시지' })
  errorMessage?: string;

  @ApiProperty({ description: '시도 횟수', example: 1 })
  attemptCount: number;

  @ApiPropertyOptional({ description: '시작 시간' })
  startedAt?: Date;

  @ApiPropertyOptional({ description: '완료 시간' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: '처리 시간 (ms)' })
  processingTimeMs?: number;

  @ApiProperty({ description: '생성 시간' })
  createdAt: Date;

  @ApiProperty({ description: '수정 시간' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: '결과 데이터 가용 여부' })
  hasResult?: boolean;

  @ApiPropertyOptional({ description: '결과 크기 (bytes)' })
  resultSizeBytes?: number;

  @ApiPropertyOptional({ description: '결과 행 수' })
  rowCount?: number;
}

export class BackgroundJobListResponseDto {
  @ApiProperty({ description: '작업 목록', type: [BackgroundJobResponseDto] })
  items: BackgroundJobResponseDto[];

  @ApiProperty({ description: '전체 개수' })
  total: number;

  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지 크기' })
  pageSize: number;
}
