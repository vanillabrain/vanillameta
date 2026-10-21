import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardLayout {
  @ApiProperty({
    description: 'X 좌표 (Grid 위치)',
    example: 0,
    minimum: 0,
  })
  @IsNumber()
  x: number;

  @ApiProperty({
    description: 'Y 좌표 (Grid 위치)',
    example: 0,
    minimum: 0,
  })
  @IsNumber()
  y: number;

  @ApiProperty({
    description: '너비 (Grid 크기)',
    example: 6,
    minimum: 1,
    maximum: 12,
  })
  @IsNumber()
  w: number;

  @ApiProperty({
    description: '높이 (Grid 크기)',
    example: 4,
    minimum: 1,
  })
  @IsNumber()
  h: number;

  @ApiProperty({
    description: '위젯 식별자',
    example: 'widget-1',
    oneOf: [{ type: 'string' }, { type: 'number' }],
  })
  i: string | number;
}

export class CreateDashboardDto {
  @ApiPropertyOptional({
    description: '대시보드 제목',
    example: '매출 분석 대시보드',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  title: string;

  @ApiProperty({
    description: '대시보드 레이아웃 설정',
    type: [DashboardLayout],
    example: [
      { x: 0, y: 0, w: 6, h: 4, i: 'widget-1' },
      { x: 6, y: 0, w: 6, h: 4, i: 'widget-2' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardLayout)
  @IsNotEmpty()
  layout: DashboardLayout[];
}
