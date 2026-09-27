import { IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 백업 스냅샷 복구 입력.
 * 사용자(자격증명)는 보안상 복구 대상에서 제외한다.
 */
export class RestoreBackupDto {
  @IsOptional()
  @IsArray()
  @ApiProperty({ required: false, description: '대시보드 목록' })
  dashboards?: any[];

  @IsOptional()
  @IsArray()
  @ApiProperty({ required: false, description: '데이터셋 목록' })
  datasets?: any[];

  @IsOptional()
  @IsArray()
  @ApiProperty({ required: false, description: '위젯 목록' })
  widgets?: any[];
}
