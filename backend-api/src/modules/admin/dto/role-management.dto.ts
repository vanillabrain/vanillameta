import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsDateString } from 'class-validator';
import { RoleResponseDto } from './role.dto';

// 역할별 통계 정보를 포함한 DTO
export class RoleWithStatsDto extends RoleResponseDto {
  @ApiProperty({ description: '해당 역할에 할당된 사용자 수' })
  userCount: number;

  @ApiProperty({ description: '해당 역할에 할당된 권한 수' })
  permissionCount: number;
}

// 역할 상세 정보 DTO
export class RoleDetailDto {
  @ApiProperty({ description: '역할 ID' })
  id: string;

  @ApiProperty({ description: '역할 이름' })
  name: string;

  @ApiProperty({ description: '표시 이름' })
  displayName: string;

  @ApiProperty({ description: '역할 설명' })
  description: string;

  @ApiProperty({ description: '권한 레벨' })
  level: number;

  @ApiProperty({ description: '활성 상태' })
  isActive: boolean;

  @ApiProperty({ description: '기본 역할 여부' })
  isDefault: boolean;

  @ApiProperty({ description: '권한 상세 정보 목록' })
  permissions: PermissionDto[];

  @ApiProperty({ description: '해당 역할을 가진 사용자 목록' })
  users: UserBasicDto[];

  @ApiProperty({ description: '생성일' })
  createdAt: Date;

  @ApiProperty({ description: '수정일' })
  updatedAt: Date;
}

// 권한 DTO
export class PermissionDto {
  @ApiProperty({ description: '권한 ID' })
  id: string;

  @ApiProperty({ description: '권한 이름' })
  name: string;

  @ApiProperty({ description: '권한 표시 이름' })
  displayName: string;

  @ApiProperty({ description: '권한 설명' })
  description: string;

  @ApiProperty({ description: '모듈' })
  module: string;

  @ApiProperty({ description: '리소스' })
  resource: string;

  @ApiProperty({ description: '액션' })
  action: string;
}

// 사용자 기본 정보 DTO
export class UserBasicDto {
  @ApiProperty({ description: '사용자 ID' })
  id: string;

  @ApiProperty({ description: '사용자 이름' })
  name: string;

  @ApiProperty({ description: '이메일' })
  email: string;
}

// 역할 권한 업데이트 DTO
export class UpdateRolePermissionsDto {
  @ApiProperty({ description: '할당할 권한 ID 목록' })
  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}

// 역할에 사용자 할당 DTO
export class AssignUsersToRoleDto {
  @ApiProperty({ description: '할당할 사용자 ID 목록' })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({ description: '만료일 (임시 역할의 경우)', required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// 역할별 사용자 조회 쿼리 DTO
export class GetRoleUsersQueryDto {
  @ApiProperty({ description: '페이지 번호', required: false, default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: '페이지당 항목 수', required: false, default: 20 })
  @IsOptional()
  limit?: number = 20;

  @ApiProperty({ description: '검색어', required: false })
  @IsOptional()
  @IsString()
  search?: string;
}

// 그룹화된 권한 DTO
export type GroupedPermissionsDto = Record<string, Record<string, PermissionDto[]>>;

// 역할 복사 DTO
export class CloneRoleDto {
  @ApiProperty({ description: '새 역할 이름' })
  @IsString()
  name: string;

  @ApiProperty({ description: '새 역할 표시 이름' })
  @IsString()
  displayName: string;

  @ApiProperty({ description: '새 역할 설명', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '새 역할 권한 레벨', required: false })
  @IsOptional()
  level?: number;
}

// 역할 삭제 영향도 분석 DTO
export class RoleDeletionImpactDto {
  @ApiProperty({ description: '역할 ID' })
  roleId: string;

  @ApiProperty({ description: '역할 이름' })
  roleName: string;

  @ApiProperty({ description: '영향받는 사용자 수' })
  affectedUserCount: number;

  @ApiProperty({ description: '영향받는 사용자 목록' })
  affectedUsers: Array<{
    id: string;
    name: string;
    email: string;
  }>;

  @ApiProperty({ description: '삭제 가능 여부' })
  canDelete: boolean;

  @ApiProperty({ description: '경고 메시지 목록' })
  warnings: string[];
}