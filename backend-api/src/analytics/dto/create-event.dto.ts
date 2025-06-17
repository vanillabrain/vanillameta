import { IsString, IsOptional, IsNumber, IsObject, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EventDataDto {
  @ApiProperty({ description: '이벤트 카테고리' })
  @IsString()
  category: string;

  @ApiProperty({ description: '이벤트 액션' })
  @IsString()
  action: string;

  @ApiProperty({ description: '이벤트 라벨', required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ description: '이벤트 값', required: false })
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiProperty({ description: '이벤트 메타데이터', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateEventDto {
  @ApiProperty({ 
    description: '이벤트 배열',
    type: [EventDataDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventDataDto)
  events: EventDataDto[];
}