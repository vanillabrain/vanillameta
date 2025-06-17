import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { YesNo } from '../../common/enum/yn.enum';

export class CreateComponentDto {
  @ApiProperty({
    description: '차트 타입 (예: line, bar, pie, scatter 등)',
    example: 'line',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: '차트 컴포넌트 제목',
    example: '라인 차트',
    required: true,
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: '차트 컴포넌트 설명',
    example: '시계열 데이터를 표시하는 기본 라인 차트입니다.',
    required: false,
  })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({
    description: '차트 카테고리 (예: basic, advanced, special, 3d)',
    example: 'basic',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: '차트 옵션 JSON 문자열',
    example: '{"animation": true, "tooltip": {"trigger": "axis"}}',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  option: string;

  @ApiProperty({
    description: '차트 아이콘 URL 또는 아이콘 클래스명',
    example: 'mdi-chart-line',
    required: false,
  })
  @IsString()
  @IsOptional()
  icon: string;

  @ApiProperty({
    description: '표시 순서',
    example: 1,
    required: false,
    type: Number,
  })
  @IsNumber()
  @IsOptional()
  seq: number;

  @ApiProperty({
    description: '사용 여부 (Y/N)',
    example: 'Y',
    enum: ['Y', 'N'],
    default: 'Y',
    required: false,
  })
  @IsString()
  @IsOptional()
  useYn: string;
}
