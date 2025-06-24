import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class RejectUserDto {
  @ApiProperty({ description: '거부 사유' })
  @IsString()
  reason: string;

  @ApiProperty({ description: '검토 메모', required: false })
  @IsString()
  @IsOptional()
  reviewNote?: string;

  @ApiProperty({ description: '계정 삭제 여부', default: false })
  @IsBoolean()
  @IsOptional()
  deleteAccount?: boolean;
}