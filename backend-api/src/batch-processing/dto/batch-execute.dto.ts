import { IsNumber, IsString, IsOptional, IsBoolean, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BatchExecuteDto {
  @IsNumber()
  @Type(() => Number)
  databaseId: number;

  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(50000)
  @Type(() => Number)
  chunkSize?: number = 10000; // 기본 청크 크기

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000000)
  @Type(() => Number)
  totalLimit?: number; // 전체 처리할 최대 레코드 수

  @IsOptional()
  @IsBoolean()
  enableStreaming?: boolean = true; // 스트리밍 응답 활성화

  @IsOptional()
  @IsBoolean()
  enableProgressTracking?: boolean = true; // 진행 상황 추적 활성화

  @IsOptional()
  @IsArray()
  parameters?: Array<{
    name: string;
    value: any;
    type: 'string' | 'number' | 'date' | 'boolean';
  }>;

  @IsOptional()
  @IsString()
  batchId?: string; // 배치 작업 식별자 (재시도용)

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(30000)
  @Type(() => Number)
  timeoutMs?: number = 25000; // 개별 청크 타임아웃 (Lambda 30초 제한 고려)
}
