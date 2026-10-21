import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResultStorageType } from '../entities/job-result.entity';

export class JobResultResponseDto {
  @ApiProperty({ description: '결과 ID' })
  id: string;

  @ApiProperty({ description: '작업 ID' })
  backgroundJobId: string;

  @ApiProperty({ description: '저장 유형', enum: ResultStorageType })
  storageType: ResultStorageType;

  @ApiPropertyOptional({ description: '결과 데이터 (작은 데이터의 경우)' })
  resultData?: any;

  @ApiPropertyOptional({ description: '저장 위치 (큰 데이터의 경우)' })
  storageLocation?: string;

  @ApiPropertyOptional({ description: '다운로드 URL (S3의 경우)' })
  downloadUrl?: string;

  @ApiProperty({ description: '결과 크기 (bytes)' })
  resultSizeBytes: number;

  @ApiProperty({ description: '행 수' })
  rowCount: number;

  @ApiPropertyOptional({ description: '결과 메타데이터' })
  resultMetadata?: {
    columns?: Array<{
      name: string;
      type: string;
    }>;
    executionTime?: number;
    [key: string]: any;
  };

  @ApiProperty({ description: '만료 시간' })
  expiresAt: Date;

  @ApiProperty({ description: '압축 여부' })
  isCompressed: boolean;

  @ApiPropertyOptional({ description: '압축 타입' })
  compressionType?: string;

  @ApiProperty({ description: '생성 시간' })
  createdAt: Date;
}
