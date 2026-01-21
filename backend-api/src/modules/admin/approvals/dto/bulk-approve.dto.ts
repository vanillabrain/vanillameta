import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional } from 'class-validator';

export class BulkApproveDto {
  @ApiProperty({ description: '승인할 승인 요청 ID 목록' })
  @IsArray()
  @IsString({ each: true })
  approvalIds: string[];

  @ApiProperty({ description: '기본 역할', required: false })
  @IsString()
  @IsOptional()
  defaultRole?: string;

  @ApiProperty({ description: '환영 메시지', required: false })
  @IsString()
  @IsOptional()
  welcomeMessage?: string;
}