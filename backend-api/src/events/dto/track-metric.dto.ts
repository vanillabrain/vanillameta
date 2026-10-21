import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsUUID,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PerformanceMetricDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  value: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  tags?: Record<string, string>;
}

export class TrackMetricDto {
  @ApiProperty({ type: [PerformanceMetricDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PerformanceMetricDto)
  metrics: PerformanceMetricDto[];
}
