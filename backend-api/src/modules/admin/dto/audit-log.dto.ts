import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsIn, IsDateString, IsBoolean, IsEnum, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';
import { AuditLogLevel, AuditLogCategory } from '../entities/audit-log.entity';

export class CreateAuditLogDto {
  @ApiProperty({ description: '수행된 작업' })
  @IsString()
  action: string;

  @ApiProperty({ description: '리소스 타입', required: false })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiProperty({ description: '리소스 ID', required: false })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiProperty({ description: '사용자 ID', required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: '사용자 이메일', required: false })
  @IsOptional()
  @IsString()
  userEmail?: string;

  @ApiProperty({ description: '사용자 이름', required: false })
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiProperty({ description: '상세 정보', required: false })
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;

  @ApiProperty({ description: '변경 전 값', required: false })
  @IsOptional()
  @IsObject()
  oldValues?: Record<string, any>;

  @ApiProperty({ description: '변경 후 값', required: false })
  @IsOptional()
  @IsObject()
  newValues?: Record<string, any>;

  @ApiProperty({ description: 'IP 주소', required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ description: 'User Agent', required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ description: '로그 레벨', required: false, enum: AuditLogLevel })
  @IsOptional()
  @IsEnum(AuditLogLevel)
  level?: AuditLogLevel;

  @ApiProperty({ description: '로그 카테고리', required: false, enum: AuditLogCategory })
  @IsOptional()
  @IsEnum(AuditLogCategory)
  category?: AuditLogCategory;

  @ApiProperty({ description: '시스템 생성 로그 여부', required: false })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @ApiProperty({ description: '민감한 정보 포함 여부', required: false })
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
}

export class GetAuditLogsQueryDto {
  @ApiProperty({ description: '페이지 번호', required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @ApiProperty({ description: '페이지당 항목 수', required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;

  @ApiProperty({ description: '검색어', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: '작업 필터', required: false })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({ description: '리소스 타입 필터', required: false })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiProperty({ description: '리소스 ID 필터', required: false })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiProperty({ description: '로그 카테고리 필터', required: false, enum: AuditLogCategory })
  @IsOptional()
  @IsEnum(AuditLogCategory)
  category?: AuditLogCategory;

  @ApiProperty({ description: '로그 레벨 필터', required: false, enum: AuditLogLevel })
  @IsOptional()
  @IsEnum(AuditLogLevel)
  level?: AuditLogLevel;

  @ApiProperty({ description: 'IP 주소 필터', required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ description: '사용자 ID 필터', required: false })
  @IsOptional()
  @IsString()
  userId?: string;


  @ApiProperty({ description: '시작 날짜', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: '종료 날짜', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: '정렬 기준', required: false, default: 'createdAt' })
  @IsOptional()
  @IsIn(['id', 'action', 'userId', 'createdAt', 'status'])
  sortBy?: string = 'createdAt';

  @ApiProperty({ description: '정렬 순서', required: false, default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class AuditLogResponseDto {
  @ApiProperty({ description: '로그 ID' })
  id: string;

  @ApiProperty({ description: '수행된 작업' })
  action: string;

  @ApiProperty({ description: '리소스 타입' })
  resourceType: string;

  @ApiProperty({ description: '리소스 ID' })
  resourceId: string;

  @ApiProperty({ description: '사용자 ID' })
  userId: string;

  @ApiProperty({ description: '사용자 이름' })
  userName: string;

  @ApiProperty({ description: '사용자 이메일' })
  userEmail: string;

  @ApiProperty({ description: '상세 정보' })
  details: Record<string, any>;

  @ApiProperty({ description: '변경 전 값', required: false })
  oldValues?: Record<string, any>;

  @ApiProperty({ description: '변경 후 값', required: false })
  newValues?: Record<string, any>;

  @ApiProperty({ description: 'IP 주소' })
  ipAddress: string;

  @ApiProperty({ description: 'User Agent' })
  userAgent: string;

  @ApiProperty({ description: '로그 레벨', enum: AuditLogLevel })
  level: AuditLogLevel;

  @ApiProperty({ description: '로그 카테고리', enum: AuditLogCategory })
  category: AuditLogCategory;

  @ApiProperty({ description: '시스템 로그 여부' })
  isSystem: boolean;

  @ApiProperty({ description: '민감한 정보 포함 여부' })
  isSensitive: boolean;

  @ApiProperty({ description: '생성일' })
  createdAt: Date;
}

export class AuditLogDetailDto extends AuditLogResponseDto {
  @ApiProperty({ description: '사용자 정보', required: false })
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export class AuditLogStatsDto {
  @ApiProperty({ description: '전체 로그 수' })
  totalLogs: number;

  @ApiProperty({ description: '로그인 시도 수' })
  loginAttempts: number;

  @ApiProperty({ description: '실패한 로그인 수' })
  failedLogins: number;

  @ApiProperty({ description: '사용자 액션 수' })
  userActions: number;

  @ApiProperty({ description: '시스템 액션 수' })
  systemActions: number;

  @ApiProperty({ description: '카테고리별 분석' })
  categoryBreakdown: Record<string, number>;

  @ApiProperty({ description: '레벨별 분석' })
  levelBreakdown: Record<string, number>;

  @ApiProperty({ description: '시간대별 활동' })
  hourlyActivity: Array<{ hour: number; count: number }>;
}

export class ExportAuditLogsDto extends GetAuditLogsQueryDto {
  @ApiProperty({ description: '내보내기 형식', required: false, default: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json' = 'csv';

  @ApiProperty({ description: '최대 레코드 수', required: false, default: 10000 })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  maxRecords?: number = 10000;
}

export class GetAuditStatsQueryDto {
  @ApiProperty({ description: '시작 날짜', required: false })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ description: '종료 날짜', required: false })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class PaginatedAuditLogsResponseDto {
  @ApiProperty({ description: '감사 로그 목록', type: [AuditLogResponseDto] })
  data: AuditLogResponseDto[];

  @ApiProperty({ description: '페이지네이션 정보' })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 감사 로그 액션 상수
export const AUDIT_ACTIONS = {
  // 인증 관련
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_BLOCKED: 'LOGIN_BLOCKED',
  LOGIN_ERROR: 'LOGIN_ERROR',
  LOGOUT: 'LOGOUT',
  
  // 사용자 관리
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_APPROVED: 'USER_APPROVED',
  USER_REJECTED: 'USER_REJECTED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  USER_PASSWORD_CHANGED: 'USER_PASSWORD_CHANGED',
  
  // 역할 관리
  ROLE_CREATED: 'ROLE_CREATED',
  ROLE_UPDATED: 'ROLE_UPDATED',
  ROLE_DELETED: 'ROLE_DELETED',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  ROLE_REMOVED: 'ROLE_REMOVED',
  
  // 권한 관리
  PERMISSION_GRANTED: 'PERMISSION_GRANTED',
  PERMISSION_REVOKED: 'PERMISSION_REVOKED',
  
  // 대시보드 관리
  DASHBOARD_CREATED: 'DASHBOARD_CREATED',
  DASHBOARD_UPDATED: 'DASHBOARD_UPDATED',
  DASHBOARD_DELETED: 'DASHBOARD_DELETED',
  DASHBOARD_SHARED: 'DASHBOARD_SHARED',
  DASHBOARD_UNSHARED: 'DASHBOARD_UNSHARED',
  
  // 위젯 관리
  WIDGET_CREATED: 'WIDGET_CREATED',
  WIDGET_UPDATED: 'WIDGET_UPDATED',
  WIDGET_DELETED: 'WIDGET_DELETED',
  
  // 데이터 소스 관리
  DATASOURCE_CREATED: 'DATASOURCE_CREATED',
  DATASOURCE_UPDATED: 'DATASOURCE_UPDATED',
  DATASOURCE_DELETED: 'DATASOURCE_DELETED',
  DATASOURCE_TESTED: 'DATASOURCE_TESTED',
  
  // 리포트 관리
  REPORT_GENERATED: 'REPORT_GENERATED',
  REPORT_EXPORTED: 'REPORT_EXPORTED',
  REPORT_SCHEDULED: 'REPORT_SCHEDULED',
  
  // 시스템 관리
  SYSTEM_CONFIG_UPDATED: 'SYSTEM_CONFIG_UPDATED',
  SYSTEM_BACKUP_CREATED: 'SYSTEM_BACKUP_CREATED',
  SYSTEM_RESTORED: 'SYSTEM_RESTORED',
  SYSTEM_MAINTENANCE_STARTED: 'SYSTEM_MAINTENANCE_STARTED',
  SYSTEM_MAINTENANCE_ENDED: 'SYSTEM_MAINTENANCE_ENDED',
  
  // 관리자 작업
  ADMIN_ACCESS: 'ADMIN_ACCESS',
  ADMIN_USER_VIEW: 'ADMIN_USER_VIEW',
  ADMIN_ROLE_VIEW: 'ADMIN_ROLE_VIEW',
  ADMIN_AUDIT_VIEW: 'ADMIN_AUDIT_VIEW',
  ADMIN_AUDIT_EXPORT: 'ADMIN_AUDIT_EXPORT',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];