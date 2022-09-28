import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryExecuteDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({
    example: '1',
    description: 'database id',
  })
  id: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'select * from sample_table1',
    description: '실행 쿼리',
  })
  query: string;
}
