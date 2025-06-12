import {
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Matches,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsSafeQuery } from '../../common/decorators/sql-validation.decorator';

export class QueryParameterDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'user_id',
    description: '매개변수 이름',
  })
  name: string;

  @IsString()
  @ApiProperty({
    example: '123',
    description: '매개변수 값',
  })
  value: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: 'number',
    description: '매개변수 타입 (string, number, date)',
  })
  type?: string;
}

export class QueryExecuteDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    example: 1,
    description: 'database id',
  })
  id: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000, { message: '쿼리는 10,000자를 초과할 수 없습니다' })
  @Matches(/^\s*SELECT\b/i, { message: 'SELECT 쿼리만 허용됩니다' })
  @IsSafeQuery({ message: '위험한 SQL 패턴이 감지되었습니다' })
  @ApiProperty({
    example: 'SELECT * FROM sample_table1 WHERE id = ?',
    description: '실행할 SQL 쿼리 (SELECT문만 허용)',
    maxLength: 10000,
  })
  query: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QueryParameterDto)
  @ApiPropertyOptional({
    type: [QueryParameterDto],
    description: '쿼리 매개변수 (prepared statement용)',
  })
  parameters?: QueryParameterDto[];

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({
    example: 1000,
    description: '최대 결과 행 수 (기본값: 1000)',
    default: 1000,
  })
  limit?: number;
}
