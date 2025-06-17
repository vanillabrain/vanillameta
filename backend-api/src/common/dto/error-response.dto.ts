import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetailDto {
  @ApiProperty({
    description: '에러 필드 또는 파라미터',
    example: 'email',
    required: false
  })
  field?: string;

  @ApiProperty({
    description: '에러 상세 메시지',
    example: '유효한 이메일 형식이 아닙니다.',
    required: false
  })
  message?: string;

  @ApiProperty({
    description: '에러 값',
    example: 'invalid-email',
    required: false
  })
  value?: any;
}

export class ErrorResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: false
  })
  success: boolean = false;

  @ApiProperty({
    description: '에러 정보',
    type: 'object',
    properties: {
      code: { type: 'string', example: 'VALIDATION_ERROR' },
      message: { type: 'string', example: '유효성 검사 실패' },
      details: { 
        type: 'array',
        items: { $ref: '#/components/schemas/ErrorDetailDto' }
      }
    }
  })
  error: {
    code: string;
    message: string;
    details?: ErrorDetailDto[];
  };

  @ApiProperty({
    description: '에러 발생 시간',
    example: '2024-01-01T00:00:00.000Z',
    format: 'date-time'
  })
  timestamp: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/v1/users/123'
  })
  path: string;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 400
  })
  statusCode: number;
}