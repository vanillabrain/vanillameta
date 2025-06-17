import { IsString, IsNumber, IsOptional, IsObject, IsUUID, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EventPropertiesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timestamp?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  correlationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  screenResolution?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  viewportSize?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  platform?: string;

  [key: string]: any;
}

export class UserPropertiesDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  registrationDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastLoginDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  dashboardCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  widgetCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  databaseCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  plan?: string;
}

export class AnalyticsEventDto {
  @ApiProperty()
  @IsString()
  action: string;

  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  properties?: EventPropertiesDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  userProperties?: UserPropertiesDto;
}

export class SessionInfoDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty()
  @IsNumber()
  startTime: number;

  @ApiProperty()
  @IsNumber()
  lastActivityTime: number;

  @ApiProperty()
  @IsNumber()
  pageViews: number;

  @ApiProperty()
  @IsNumber()
  eventCount: number;
}

export class TrackEventDto {
  @ApiProperty({ type: [AnalyticsEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventDto)
  events: AnalyticsEventDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => SessionInfoDto)
  sessionInfo?: SessionInfoDto;
}