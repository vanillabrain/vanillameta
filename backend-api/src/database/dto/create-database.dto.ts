import { IsDefined, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
  @IsOptional()
  @ApiProperty({
    example: '상세 내용',
    description: '데이터베이스 상세 내용',
  })
  description: string;

  // 접속 설정(호스트/포트/사용자 등). 서비스에서 client/connection 구조로 감싸 저장한다.
  @IsDefined()
  @ApiProperty({
    example: '{}',
    description: '설정 JSON 상세',
  })
  connectionConfig: any;

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
    example: 'mysql',
    description: '데이터베이스 구분',
  })
  type: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'Asia/Seoul',
    description: '서비스 타임존',
  })
  timezone: string;
}
