import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DashboardLayout {
  @ApiProperty({
    description: 'X 좌표 (0-11)',
    example: 0,
    type: Number,
  })
  x: number;

  @ApiProperty({
    description: 'Y 좌표',
    example: 0,
    type: Number,
  })
  y: number;

  @ApiProperty({
    description: '너비 (1-12)',
    example: 6,
    type: Number,
  })
  w: number;

  @ApiProperty({
    description: '높이',
    example: 4,
    type: Number,
  })
  h: number;

  @ApiProperty({
    description: '위젯 ID 또는 식별자',
    example: '1',
    oneOf: [{ type: 'string' }, { type: 'number' }],
  })
  i: string | number;
}

export class CreateDashboardDto {
  @ApiProperty({
    description: '대시보드 제목',
    example: 'Sales Dashboard 2024',
    required: false,
  })
  @IsString()
  @IsOptional()
  title: string;

  @ApiProperty({
    description: '대시보드 레이아웃 배열',
    type: [DashboardLayout],
    required: true,
  })
  @IsNotEmpty()
  layout: DashboardLayout[];
}
