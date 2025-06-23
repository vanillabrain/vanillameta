import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ApproveUserDto {
  @ApiProperty({ description: '기본 역할', required: false })
  @IsString()
  @IsOptional()
  defaultRole?: string;

  @ApiProperty({ description: '환영 메시지', required: false })
  @IsString()
  @IsOptional()
  welcomeMessage?: string;

  @ApiProperty({ description: '검토 메모', required: false })
  @IsString()
  @IsOptional()
  reviewNote?: string;
}