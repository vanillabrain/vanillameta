import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ description: '전체 아이템 수' })
  total: number;

  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지당 아이템 수' })
  limit: number;

  @ApiProperty({ description: '전체 페이지 수' })
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: '데이터 목록' })
  data: T[];

  @ApiProperty({ description: '페이지네이션 메타 정보' })
  meta: PaginationMetaDto;
}