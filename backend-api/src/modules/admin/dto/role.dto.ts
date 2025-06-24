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

  @ApiProperty({ description: '권한 ID 목록', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];

  @ApiProperty({ description: '권한 레벨', required: false, default: 0 })
  @IsOptional()
  @IsInt()
  level?: number;

  @ApiProperty({ description: '활성 상태', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: '기본 역할 여부', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateRoleDto {
  @ApiProperty({ description: '역할 이름', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '표시 이름', required: false })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ description: '역할 설명', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '권한 ID 목록', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];

  @ApiProperty({ description: '권한 레벨', required: false })
  @IsOptional()
  @IsInt()
  level?: number;

  @ApiProperty({ description: '활성 상태', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: '기본 역할 여부', required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
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
  id: string;

  @ApiProperty({ description: '역할 이름' })
  name: string;

  @ApiProperty({ description: '표시 이름' })
  displayName: string;

  @ApiProperty({ description: '역할 설명' })
  description: string;

  @ApiProperty({ description: '권한 레벨' })
  level: number;

  @ApiProperty({ description: '권한 목록' })
  permissions: string[];

  @ApiProperty({ description: '활성 상태' })
  isActive: boolean;

  @ApiProperty({ description: '기본 역할 여부' })
  isDefault: boolean;

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

