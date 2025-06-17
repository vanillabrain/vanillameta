import { ApiProperty } from '@nestjs/swagger';

export class JwtPayloadDto {
  @ApiProperty({
    description: '사용자 ID',
    example: 'user123'
  })
  userId: string;

  @ApiProperty({
    description: '사용자 이메일',
    example: 'user@example.com'
  })
  email: string;

  @ApiProperty({
    description: '사용자 고유 ID',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: '토큰 발급 시간',
    example: 1704067200
  })
  iat?: number;

  @ApiProperty({
    description: '토큰 만료 시간',
    example: 1704070800
  })
  exp?: number;
}

export class TokenResponseDto {
  @ApiProperty({
    description: 'JWT 액세스 토큰',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({
    description: '토큰 타입',
    example: 'Bearer',
    default: 'Bearer'
  })
  tokenType: string = 'Bearer';

  @ApiProperty({
    description: '토큰 만료 시간 (초)',
    example: 3600
  })
  expiresIn: number;
}