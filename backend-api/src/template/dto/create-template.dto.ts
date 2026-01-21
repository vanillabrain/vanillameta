import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ItemInfoDto } from './item-info.dto';

export class CreateTemplateDto {
  @ApiProperty({
    description: '템플릿 제목',
    example: 'Sales Dashboard Template',
    required: true,
  })
  @IsString()
  readonly title: string;
  @ApiProperty({
    description: '템플릿 설명',
    example: '매출 분석을 위한 기본 템플릿입니다.',
    required: false,
  })
  @IsString()
  @IsOptional()
  readonly description: string;
  @ApiProperty({
    description: '템플릿 레이아웃 정보',
    type: [ItemInfoDto],
    required: true,
  })
  readonly layout: ItemInfoDto[];
}
