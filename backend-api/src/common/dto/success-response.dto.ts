import { ApiProperty } from '@nestjs/swagger';

export class SuccessResponseDto<T = any> {
  @ApiProperty({
    description: '성공 여부',
    example: true
  })
  success: boolean = true;

  @ApiProperty({
    description: '응답 메시지',
    example: '요청이 성공적으로 처리되었습니다.'
  })
  message: string;

  @ApiProperty({
    description: '응답 데이터',
    type: 'object'
  })
  data?: T;

  @ApiProperty({
    description: '응답 시간',
    example: '2024-01-01T00:00:00.000Z',
    format: 'date-time'
  })
  timestamp: string;
}

export class PaginatedResponseDto<T = any> {
  @ApiProperty({
    description: '성공 여부',
    example: true
  })
  success: boolean = true;

  @ApiProperty({
    description: '페이지네이션 데이터',
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: '아이템 목록'
      },
      total: {
        type: 'number',
        example: 100,
        description: '전체 아이템 수'
      },
      page: {
        type: 'number',
        example: 1,
        description: '현재 페이지'
      },
      pageSize: {
        type: 'number',
        example: 20,
        description: '페이지 크기'
      },
      totalPages: {
        type: 'number',
        example: 5,
        description: '전체 페이지 수'
      }
    }
  })
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };

  @ApiProperty({
    description: '응답 시간',
    example: '2024-01-01T00:00:00.000Z',
    format: 'date-time'
  })
  timestamp: string;
}