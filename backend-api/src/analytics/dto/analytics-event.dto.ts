import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum EventCategory {
  DASHBOARD = 'Dashboard',
  WIDGET = 'Widget',
  DATA = 'Data',
  USER = 'User',
  PERFORMANCE = 'Performance',
  ERROR = 'Error',
}

export enum EventAction {
  // Dashboard Actions
  DASHBOARD_CREATED = 'dashboard_created',
  DASHBOARD_VIEWED = 'dashboard_viewed',
  DASHBOARD_EDITED = 'dashboard_edited',
  DASHBOARD_DELETED = 'dashboard_deleted',
  DASHBOARD_SHARED = 'dashboard_shared',
  DASHBOARD_DUPLICATED = 'dashboard_duplicated',

  // Widget Actions
  WIDGET_CREATED = 'widget_created',
  WIDGET_EDITED = 'widget_edited',
  WIDGET_DELETED = 'widget_deleted',
  WIDGET_RESIZED = 'widget_resized',
  WIDGET_MOVED = 'widget_moved',
  WIDGET_INTERACTED = 'widget_interacted',

  // Data Actions
  DATABASE_CONNECTED = 'database_connected',
  DATABASE_DISCONNECTED = 'database_disconnected',
  DATASET_CREATED = 'dataset_created',
  DATASET_EDITED = 'dataset_edited',
  QUERY_EXECUTED = 'query_executed',
  QUERY_FAILED = 'query_failed',
  DATA_EXPORTED = 'data_exported',

  // User Actions
  USER_REGISTERED = 'user_registered',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  ONBOARDING_STARTED = 'onboarding_started',
  ONBOARDING_COMPLETED = 'onboarding_completed',
  ONBOARDING_SKIPPED = 'onboarding_skipped',
  PROFILE_UPDATED = 'profile_updated',

  // Performance Actions
  PAGE_LOAD_TIME = 'page_load_time',
  API_RESPONSE_TIME = 'api_response_time',
  CHART_RENDER_TIME = 'chart_render_time',

  // Error Actions
  ERROR_OCCURRED = 'error_occurred',
  ERROR_BOUNDARY_TRIGGERED = 'error_boundary_triggered',
}

export class EventDataDto {
  @ApiProperty({ description: '이벤트 발생 시간' })
  @IsString()
  timestamp: string;

  @ApiProperty({ description: '세션 ID' })
  @IsString()
  sessionId: string;

  @ApiProperty({ description: '사용자 ID', required: false })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ description: '상관관계 ID', required: false })
  @IsString()
  @IsOptional()
  correlationId?: string;

  @ApiProperty({ description: '추가 이벤트 데이터', required: false })
  @IsObject()
  @IsOptional()
  properties?: Record<string, any>;
}

export class AnalyticsEventDto {
  @ApiProperty({
    description: '이벤트 액션',
    enum: EventAction,
  })
  @IsEnum(EventAction)
  action: EventAction;

  @ApiProperty({
    description: '이벤트 카테고리',
    enum: EventCategory,
  })
  @IsEnum(EventCategory)
  category: EventCategory;

  @ApiProperty({ description: '이벤트 데이터' })
  @ValidateNested()
  @Type(() => EventDataDto)
  data: EventDataDto;
}

export class EventMetadataDto {
  @ApiProperty({ description: '사용자 에이전트' })
  @IsString()
  userAgent: string;

  @ApiProperty({ description: '화면 해상도' })
  @IsString()
  screenResolution: string;

  @ApiProperty({ description: '뷰포트 크기' })
  @IsString()
  viewport: string;

  @ApiProperty({ description: '언어 설정' })
  @IsString()
  language: string;
}

export class CollectEventsDto {
  @ApiProperty({
    description: '이벤트 목록',
    type: [AnalyticsEventDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventDto)
  events: AnalyticsEventDto[];

  @ApiProperty({ description: '메타데이터' })
  @ValidateNested()
  @Type(() => EventMetadataDto)
  metadata: EventMetadataDto;
}

export class PageViewDto {
  @ApiProperty({ description: '페이지 경로' })
  @IsString()
  path: string;

  @ApiProperty({ description: '페이지 제목', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ description: '참조 페이지', required: false })
  @IsString()
  @IsOptional()
  referrer?: string;
}

export class PerformanceMetricDto {
  @ApiProperty({ description: '메트릭 이름' })
  @IsString()
  name: string;

  @ApiProperty({ description: '메트릭 값' })
  @IsNumber()
  value: number;

  @ApiProperty({ description: '단위' })
  @IsString()
  unit: string;

  @ApiProperty({ description: '태그', required: false })
  @IsObject()
  @IsOptional()
  tags?: Record<string, string>;
}
