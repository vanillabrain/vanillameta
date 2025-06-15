import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DatasetType } from '../../common/enum/dataset-type.enum';
import { YesNo } from '../../common/enum/yn.enum';

export class CreateWidgetDto {
  @ApiProperty({
    description: '위젯 제목',
    example: '월별 매출 추이',
    required: false
  })
  @IsString()
  @IsOptional()
  title: string;

  @ApiProperty({
    description: '위젯 설명',
    example: '2024년 월별 매출 추이를 보여주는 차트',
    required: false
  })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({
    description: '데이터베이스 ID (직접 연결 시 사용)',
    example: 1,
    type: Number,
    required: false
  })
  @IsNumber()
  @IsOptional()
  databaseId: number;

  @ApiProperty({
    description: '컴포넌트 ID (차트 타입)',
    example: 1,
    type: Number,
    required: true
  })
  @IsNumber()
  @IsNotEmpty()
  componentId: number;

  @ApiProperty({
    description: '데이터셋 타입',
    enum: DatasetType,
    example: DatasetType.DATASET,
    required: true
  })
  @IsString()
  @IsNotEmpty()
  datasetType: DatasetType;

  @ApiProperty({
    description: '데이터셋 ID',
    example: 1,
    type: Number,
    required: true
  })
  @IsNumber()
  @IsNotEmpty()
  datasetId: number;

  @ApiProperty({
    description: '테이블 이름 (직접 연결 시 사용)',
    example: 'sales_data',
    required: false
  })
  @IsString()
  @IsOptional()
  tableName: string;

  @ApiProperty({
    description: '차트 옵션 (ECharts 옵션 JSON 문자열)',
    example: '{"xAxis": {"type": "category"}, "yAxis": {"type": "value"}}',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  option: string;

  @ApiProperty({
    description: '삭제 여부',
    enum: ['Y', 'N'],
    default: 'N',
    required: false
  })
  @IsString()
  @IsOptional()
  delYn: string;
}
