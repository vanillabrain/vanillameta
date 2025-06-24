import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export { UserApprovalDto, UserApprovalDetailDto } from './user-approval.dto';

export class GetPendingApprovalsQueryDto {
  @ApiProperty({ description: '페이지 번호', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiProperty({ description: '페이지당 아이템 수', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit: number = 20;

  @ApiProperty({ description: '검색어 (이름, 이메일)', required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ description: '특정 날짜 이후 생성된 요청만 조회', required: false })
  @IsDateString()
  @IsOptional()
  createdAfter?: string;
}

export class ApprovalStatsDto {
  @ApiProperty({ description: '대기중인 승인 요청 수' })
  pending: number;

  @ApiProperty({ description: '승인된 요청 수' })
  approved: number;

  @ApiProperty({ description: '거부된 요청 수' })
  rejected: number;

  @ApiProperty({ description: '전체 요청 수' })
  total: number;

  @ApiProperty({ description: '최근 7일간 승인 동향' })
  recentTrend: Array<{
    date: string;
    count: number;
  }>;
}

export class BulkApprovalResultDto {
  @ApiProperty({ description: '성공한 승인 ID 목록' })
  successful: string[];

  @ApiProperty({ description: '실패한 승인 목록' })
  failed: Array<{
    id: string;
    reason: string;
  }>;
}