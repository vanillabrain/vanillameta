import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 400,
  })
  code: number;

  @ApiProperty({
    description: '에러 코드',
    example: 'VALIDATION_ERROR',
  })
  errorCode: string;

  @ApiProperty({
    description: '에러 메시지',
    example: 'Validation failed',
  })
  message: string;

  @ApiProperty({
    description: 'Correlation ID for tracking',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  correlationId: string;

  @ApiProperty({
    description: '에러 발생 시간',
    example: '2025-06-15T12:34:56.789Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/v1/users',
  })
  path: string;

  @ApiProperty({
    description: 'HTTP 메서드',
    example: 'POST',
  })
  method: string;

  @ApiProperty({
    description: '에러 상세 정보 (개발 환경에서만 노출)',
    required: false,
    example: ['email must be an email', 'password must be longer than or equal to 8 characters'],
  })
  details?: any;

  @ApiProperty({
    description: '스택 트레이스 (개발 환경에서만 노출)',
    required: false,
    type: [String],
  })
  stack?: string[];
}

export class SuccessResponseDto<T = any> {
  @ApiProperty({
    description: '성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 200,
  })
  code: number;

  @ApiProperty({
    description: '응답 데이터',
  })
  data: T;

  @ApiProperty({
    description: 'Correlation ID for tracking',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  correlationId?: string;
}
