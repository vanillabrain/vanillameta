import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDatabaseDto {
  @ApiProperty({
    description: '데이터베이스 연결 이름',
    example: '프로덕션 MySQL DB',
    minLength: 1,
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: '데이터베이스 설명',
    example: '메인 서비스용 프로덕션 데이터베이스',
    required: false
  })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({
    description: '데이터베이스 연결 설정 (JSON 형식)',
    example: JSON.stringify({
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'password',
      database: 'mydb'
    }),
    type: 'string',
    format: 'json'
  })
  @IsString()
  @IsOptional()
  connectionConfig: string;

  @ApiProperty({
    description: '데이터베이스 엔진',
    example: 'mysql',
    enum: ['mysql', 'postgresql', 'mariadb', 'oracle', 'mssql', 'sqlite', 'bigquery', 'snowflake', 'redshift'],
    required: false
  })
  @IsString()
  @IsOptional()
  engine: string;

  @ApiProperty({
    description: '데이터베이스 타입',
    example: 'mysql',
    enum: ['mysql', 'postgresql', 'mariadb', 'oracle', 'mssql', 'sqlite', 'bigquery', 'snowflake', 'redshift'],
    required: false
  })
  @IsString()
  @IsOptional()
  type: string;

  @ApiProperty({
    description: '타임존 설정',
    example: 'Asia/Seoul',
    default: 'Asia/Seoul',
    required: false
  })
  @IsString()
  @IsOptional()
  timezone: string;
}
