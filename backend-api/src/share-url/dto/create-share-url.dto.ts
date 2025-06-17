import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
export class ShareUrlOnDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: '사용자 ID',
    example: 'user123',
    required: true,
  })
  userId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: '공유 URL 만료 날짜 (ISO 8601 형식)',
    example: '2024-12-31T23:59:59Z',
    required: true,
  })
  endDate: string;
}
