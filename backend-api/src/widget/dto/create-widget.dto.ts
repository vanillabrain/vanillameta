import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum, IsJSON } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DatasetType } from '../../common/enum/dataset-type.enum';
import { YesNo } from '../../common/enum/yn.enum';

export class CreateWidgetDto {
  @ApiPropertyOptional({
    description: '위젯 제목',
    example: '월별 매출 추이 차트',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  title: string;

  @ApiPropertyOptional({
    description: '위젯 설명',
    example: '2024년 월별 매출 현황을 보여주는 라인 차트',
  })
  @IsString()
  @IsOptional()
  description: string;

  @ApiPropertyOptional({
    description: '데이터베이스 ID',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  databaseId: number;

  @ApiProperty({
    description: '차트 컴포넌트 ID',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  componentId: number;

  @ApiProperty({
    description: '데이터셋 타입',
    enum: DatasetType,
    example: DatasetType.DATASET,
  })
  @IsEnum(DatasetType)
  @IsNotEmpty()
  datasetType: DatasetType;

  @ApiProperty({
    description: '데이터셋 ID',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  datasetId: number;

  @ApiPropertyOptional({
    description: '테이블 이름 (데이터셋 타입이 TABLE인 경우)',
    example: 'sales_monthly',
  })
  @IsString()
  @IsOptional()
  tableName: string;

  @ApiProperty({
    description: '차트 옵션 (ECharts 설정 JSON)',
    example: JSON.stringify({
      xAxis: { type: 'category', data: ['Jan', 'Feb', 'Mar'] },
      yAxis: { type: 'value' },
      series: [{ type: 'line', data: [820, 932, 901] }],
    }),
    type: 'string',
    format: 'json',
  })
  @IsString()
  @IsNotEmpty()
  option: string;

  @ApiPropertyOptional({
    description: '삭제 여부',
    enum: YesNo,
    default: YesNo.NO,
  })
  @IsEnum(YesNo)
  @IsOptional()
  delYn: string;
}
