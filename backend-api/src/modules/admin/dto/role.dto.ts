import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsBoolean, IsOptional, IsInt, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRoleDto {
  @ApiProperty({ description: '역할 이름 (고유)' })
  @IsString()
  name: string;

  @ApiProperty({ description: '표시 이름', required: false })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ description: '역할 설명', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '권한 목록', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiProperty({ description: '활성 상태', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRoleDto {
  @ApiProperty({ description: '표시 이름', required: false })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ description: '역할 설명', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '권한 목록', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiProperty({ description: '활성 상태', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GetRolesQueryDto {
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

  @ApiProperty({ description: '정렬 기준', required: false, default: 'createdAt' })
  @IsOptional()
  @IsIn(['id', 'name', 'displayName', 'createdAt', 'updatedAt'])
  sortBy?: string = 'createdAt';

  @ApiProperty({ description: '정렬 순서', required: false, default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiProperty({ description: '활성 상태 필터', required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;
}

export class RoleResponseDto {
  @ApiProperty({ description: '역할 ID' })
  id: number;

  @ApiProperty({ description: '역할 이름' })
  name: string;

  @ApiProperty({ description: '표시 이름' })
  displayName: string;

  @ApiProperty({ description: '역할 설명' })
  description: string;

  @ApiProperty({ description: '권한 목록' })
  permissions: string[];

  @ApiProperty({ description: '활성 상태' })
  isActive: boolean;

  @ApiProperty({ description: '시스템 역할 여부' })
  isSystemRole: boolean;

  @ApiProperty({ description: '생성일' })
  createdAt: Date;

  @ApiProperty({ description: '수정일' })
  updatedAt: Date;
}

export class PaginatedRolesResponseDto {
  @ApiProperty({ description: '역할 목록', type: [RoleResponseDto] })
  data: RoleResponseDto[];

  @ApiProperty({ description: '페이지네이션 정보' })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 기본 권한 정의
export const DEFAULT_PERMISSIONS = {
  // 사용자 관리
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_APPROVE: 'user:approve',
  
  // 대시보드 관리
  DASHBOARD_READ: 'dashboard:read',
  DASHBOARD_CREATE: 'dashboard:create',
  DASHBOARD_UPDATE: 'dashboard:update',
  DASHBOARD_DELETE: 'dashboard:delete',
  DASHBOARD_SHARE: 'dashboard:share',
  
  // 위젯 관리
  WIDGET_READ: 'widget:read',
  WIDGET_CREATE: 'widget:create',
  WIDGET_UPDATE: 'widget:update',
  WIDGET_DELETE: 'widget:delete',
  
  // 관리자 기능
  ADMIN_PANEL: 'admin:panel',
  ADMIN_USERS: 'admin:users',
  ADMIN_ROLES: 'admin:roles',
  ADMIN_SETTINGS: 'admin:settings',
  ADMIN_AUDIT: 'admin:audit',
  
  // 시스템 관리
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_LOGS: 'system:logs',
} as const;

export type Permission = typeof DEFAULT_PERMISSIONS[keyof typeof DEFAULT_PERMISSIONS];