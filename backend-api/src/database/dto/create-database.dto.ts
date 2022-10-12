import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDatabaseDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'mysql 데이터베이스',
    description: '데이터베이스 이름',
  })
  name: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: '상세 내용',
    description: '데이터베이스 상세 내용',
  })
  description: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: '{}',
    description: '설정 JSON 상세',
  })
  sequelizeConfig: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'mysql',
    description: '데이터베이스 엔진',
  })
  engine: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'Asia/Seoul',
    description: '서비스 타임존',
  })
  timezone: string;
}
