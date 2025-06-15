import { IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDatasetDto {
  @ApiProperty({
    description: '데이터셋 제목',
    example: '월별 매출 통계',
    required: true
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: '데이터베이스 연결 ID',
    example: 1,
    type: Number,
    required: true
  })
  @IsNumber()
  databaseId: number;

  @ApiProperty({
    description: 'SQL 쿼리문',
    example: 'SELECT date, revenue FROM sales WHERE date >= "2024-01-01" ORDER BY date',
    required: true
  })
  @IsString()
  query: string;
}
