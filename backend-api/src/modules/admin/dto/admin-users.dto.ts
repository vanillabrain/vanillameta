import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsIn, IsEnum, IsEmail, IsArray, IsDateString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetUsersQueryDto {
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

  @ApiProperty({ description: '검색어 (이메일, 사용자ID)', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: '정렬 기준', required: false, default: 'createdAt' })
  @IsOptional()
  @IsIn(['id', 'userId', 'email', 'createdAt', 'updatedAt'])
  sortBy?: string = 'createdAt';

  @ApiProperty({ description: '정렬 순서', required: false, default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiProperty({ description: '사용자 상태 필터', required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ description: '역할 필터', required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ description: '가입일 시작', required: false })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiProperty({ description: '가입일 종료', required: false })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;
}

export class UserResponseDto {
  @ApiProperty({ description: '사용자 ID' })
  id: string;

  @ApiProperty({ description: '사용자 고유 ID' })
  userId: string;

  @ApiProperty({ description: '이메일' })
  email: string;

  @ApiProperty({ description: '이름' })
  name: string;

  @ApiProperty({ description: '상태' })
  status: string;

  @ApiProperty({ description: '역할 목록' })
  roles: string[];

  @ApiProperty({ description: '생성일' })
  createdAt: Date;

  @ApiProperty({ description: '수정일' })
  updatedAt: Date;

  @ApiProperty({ description: '최종 로그인 시간', nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty({ description: '프로필 이미지 URL', nullable: true })
  avatar?: string;

  @ApiProperty({ description: '전화번호', nullable: true })
  phone?: string;

  @ApiProperty({ description: '부서', nullable: true })
  department?: string;

  @ApiProperty({ description: '삭제일', nullable: true })
  deletedAt?: Date;
}

export class UserDetailDto extends UserResponseDto {
  @ApiProperty({ description: '이메일 인증 시간', nullable: true })
  emailVerifiedAt?: Date;

  @ApiProperty({ description: '생성자 ID', nullable: true })
  createdBy?: string;

  @ApiProperty({ description: '수정자 ID', nullable: true })
  updatedBy?: string;
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
  DELETED = 'deleted'
}

export class UpdateUserStatusDto {
  @ApiProperty({ 
    description: '변경할 사용자 상태',
    enum: UserStatus
  })
  @IsEnum(UserStatus)
  status: UserStatus;
}

export class PaginationMetaDto {
  @ApiProperty({ description: '전체 항목 수' })
  total: number;

  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수' })
  limit: number;

  @ApiProperty({ description: '전체 페이지 수' })
  totalPages: number;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ description: '사용자 목록', type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ description: '페이지네이션 정보', type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class UserStatsDto {
  @ApiProperty({ description: '전체 사용자 수' })
  totalUsers: number;

  @ApiProperty({ description: '최근 30일 신규 사용자 수' })
  recentUsers: number;

  @ApiProperty({ description: '활성 사용자 수' })
  activeUsers: number;

  @ApiProperty({ description: '비활성 사용자 수' })
  inactiveUsers: number;

  @ApiProperty({ description: '승인 대기 사용자 수' })
  pendingUsers: number;
}

export class ApproveUserDto {
  @ApiProperty({ description: '승인 사유', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectUserDto {
  @ApiProperty({ description: '거부 사유' })
  @IsString()
  reason: string;
}

export class CreateUserDto {
  @ApiProperty({ description: '사용자 고유 ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: '이메일' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '이름' })
  @IsString()
  name: string;

  @ApiProperty({ description: '역할 ID 리스트', required: false })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  roleIds?: number[];

  @ApiProperty({ description: '부서', required: false })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ description: '전화번호', required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserDto {
  @ApiProperty({ description: '이름', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '이메일', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: '부서', required: false })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ description: '전화번호', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: '역할 ID 리스트', required: false })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  roleIds?: number[];
}

export enum BulkAction {
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
  DELETE = 'delete',
  SUSPEND = 'suspend'
}

export class BulkActionDto {
  @ApiProperty({ description: '일괄 작업 타입', enum: BulkAction })
  @IsEnum(BulkAction)
  action: BulkAction;

  @ApiProperty({ description: '대상 사용자 ID 리스트' })
  @IsArray()
  @Type(() => Number)
  userIds: number[];
}