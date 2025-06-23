import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsIn, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAuditLogDto {
  @ApiProperty({ description: '수행된 작업' })
  @IsString()
  action: string;

  @ApiProperty({ description: '대상 엔티티 타입', required: false })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiProperty({ description: '대상 엔티티 ID', required: false })
  @IsOptional()
  @IsString()
  entityId?: string;

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

  @ApiProperty({ description: 'HTTP 메소드', required: false })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiProperty({ description: '요청 URL', required: false })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ description: '상세 설명', required: false })
  @IsOptional()
  details?: any;

  @ApiProperty({ description: '메타데이터', required: false })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'IP 주소', required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ description: 'User Agent', required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ description: '상태', required: false, default: 'success' })
  @IsOptional()
  @IsIn(['success', 'error', 'warning'])
  status?: string;
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

  @ApiProperty({ description: '엔티티 타입 필터', required: false })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiProperty({ description: '사용자 ID 필터', required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: '상태 필터', required: false })
  @IsOptional()
  @IsIn(['success', 'error', 'warning'])
  status?: string;

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
  id: number;

  @ApiProperty({ description: '수행된 작업' })
  action: string;

  @ApiProperty({ description: '대상 엔티티 타입' })
  entityType: string;

  @ApiProperty({ description: '대상 엔티티 ID' })
  entityId: string;

  @ApiProperty({ description: '사용자 ID' })
  userId: string;

  @ApiProperty({ description: '사용자 이메일' })
  userEmail: string;

  @ApiProperty({ description: '상세 설명' })
  details: string;

  @ApiProperty({ description: '메타데이터' })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'IP 주소' })
  ipAddress: string;

  @ApiProperty({ description: 'User Agent' })
  userAgent: string;

  @ApiProperty({ description: '상태' })
  status: string;

  @ApiProperty({ description: '생성일' })
  createdAt: Date;
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
  // 사용자 관리
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_APPROVE: 'user_approve',
  USER_REJECT: 'user_reject',
  
  // 역할 관리
  ROLE_CREATE: 'role_create',
  ROLE_UPDATE: 'role_update',
  ROLE_DELETE: 'role_delete',
  
  // 대시보드 관리
  DASHBOARD_CREATE: 'dashboard_create',
  DASHBOARD_UPDATE: 'dashboard_update',
  DASHBOARD_DELETE: 'dashboard_delete',
  DASHBOARD_SHARE: 'dashboard_share',
  
  // 위젯 관리
  WIDGET_CREATE: 'widget_create',
  WIDGET_UPDATE: 'widget_update',
  WIDGET_DELETE: 'widget_delete',
  
  // 시스템 관리
  SYSTEM_CONFIG_UPDATE: 'system_config_update',
  SYSTEM_BACKUP: 'system_backup',
  
  // 관리자 작업
  ADMIN_ACCESS: 'admin_access',
  ADMIN_USER_VIEW: 'admin_user_view',
  ADMIN_ROLE_VIEW: 'admin_role_view',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];