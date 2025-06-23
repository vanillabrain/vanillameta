import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRolesService } from './admin-roles.service';
import { RoleService } from './role.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermissions } from './decorators/permissions.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { User } from '../../user/entities/user.entity';
import { 
  CreateRoleDto, 
  UpdateRoleDto, 
  GetRolesQueryDto, 
  RoleResponseDto,
  PaginatedRolesResponseDto 
} from './dto/role.dto';
import {
  RoleWithStatsDto,
  RoleDetailDto,
  PermissionDto,
  UpdateRolePermissionsDto,
  AssignUsersToRoleDto,
  GetRoleUsersQueryDto,
  GroupedPermissionsDto,
  CloneRoleDto,
  RoleDeletionImpactDto,
} from './dto/role-management.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@ApiTags('Admin Roles')
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class RoleController {
  constructor(
    private readonly adminRolesService: AdminRolesService,
    private readonly roleService: RoleService
  ) {}

  @Post()
  @RequirePermissions('admin.roles.create')
  @ApiOperation({ 
    summary: 'Create role',
    description: '새로운 역할을 생성합니다.'
  })
  @ApiResponse({ 
    status: 201, 
    description: '역할 생성 성공',
    type: RoleResponseDto
  })
  @ApiResponse({ 
    status: 409, 
    description: '이미 존재하는 역할 이름'
  })
  async createRole(
    @Body() createRoleDto: CreateRoleDto,
    @GetUser() user: User,
  ): Promise<RoleResponseDto> {
    return await this.adminRolesService.createRole(createRoleDto, user);
  }

  @Get()
  @RequirePermissions('admin.roles.view')
  @ApiOperation({ 
    summary: 'Get all roles with stats',
    description: '모든 역할 목록을 통계 정보와 함께 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '역할 목록 조회 성공',
    type: [RoleWithStatsDto]
  })
  async getRoles(@Query() query: GetRolesQueryDto): Promise<RoleWithStatsDto[]> {
    return await this.adminRolesService.getRolesWithStats(query);
  }

  @Get('permissions/grouped')
  @RequirePermissions('admin.roles.view')
  @ApiOperation({ 
    summary: 'Get grouped permissions',
    description: '모듈별로 그룹화된 권한 목록을 조회합니다.'
  })
  async getGroupedPermissions(): Promise<GroupedPermissionsDto> {
    return await this.adminRolesService.getGroupedPermissions();
  }

  @Get(':id')
  @RequirePermissions('admin.roles.view')
  @ApiOperation({ 
    summary: 'Get role detail by ID',
    description: '특정 역할의 상세 정보를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '역할 정보 조회 성공',
    type: RoleDetailDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '역할을 찾을 수 없음'
  })
  async getRoleById(@Param('id') id: string): Promise<RoleDetailDto> {
    return await this.adminRolesService.getRoleDetail(id);
  }

  @Put(':id')
  @RequirePermissions('admin.roles.edit')
  @ApiOperation({ 
    summary: 'Update role',
    description: '역할 정보를 수정합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '역할 정보 수정 성공',
    type: RoleResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '역할을 찾을 수 없음'
  })
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @GetUser() user: User,
  ): Promise<RoleResponseDto> {
    return await this.adminRolesService.updateRole(id, updateRoleDto, user);
  }

  @Delete(':id')
  @RequirePermissions('admin.roles.delete')
  @ApiOperation({ 
    summary: 'Delete role',
    description: '역할을 삭제합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '역할 삭제 성공'
  })
  @ApiResponse({ 
    status: 404, 
    description: '역할을 찾을 수 없음'
  })
  @ApiResponse({ 
    status: 409, 
    description: '시스템 역할은 삭제할 수 없음'
  })
  async deleteRole(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<void> {
    return await this.adminRolesService.deleteRole(id, user);
  }

  @Get(':id/permissions')
  @RequirePermissions('admin.roles.view')
  @ApiOperation({ 
    summary: 'Get role permissions',
    description: '특정 역할의 권한 목록을 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '권한 목록 조회 성공',
    type: [PermissionDto]
  })
  async getRolePermissions(@Param('id') id: string): Promise<PermissionDto[]> {
    return await this.adminRolesService.getRolePermissions(id);
  }

  @Put(':id/permissions')
  @RequirePermissions('admin.roles.edit')
  @ApiOperation({ 
    summary: 'Update role permissions',
    description: '역할의 권한을 업데이트합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '권한 업데이트 성공'
  })
  async updateRolePermissions(
    @Param('id') id: string,
    @Body() updatePermissionsDto: UpdateRolePermissionsDto,
    @GetUser() user: User,
  ): Promise<void> {
    return await this.adminRolesService.updateRolePermissions(id, updatePermissionsDto, user);
  }

  @Get(':id/users')
  @RequirePermissions('admin.roles.view')
  @ApiOperation({ 
    summary: 'Get role users',
    description: '특정 역할을 가진 사용자 목록을 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 목록 조회 성공'
  })
  async getRoleUsers(
    @Param('id') id: string,
    @Query() query: GetRoleUsersQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    return await this.adminRolesService.getRoleUsers(id, query);
  }

  @Post(':id/assign-users')
  @RequirePermissions('admin.roles.assign')
  @ApiOperation({ 
    summary: 'Assign users to role',
    description: '역할에 사용자를 할당합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 할당 성공'
  })
  async assignUsersToRole(
    @Param('id') id: string,
    @Body() assignUsersDto: AssignUsersToRoleDto,
    @GetUser() user: User,
  ): Promise<void> {
    return await this.adminRolesService.assignUsersToRole(id, assignUsersDto, user);
  }

  @Delete(':id/users/:userId')
  @RequirePermissions('admin.roles.assign')
  @ApiOperation({ 
    summary: 'Remove user from role',
    description: '역할에서 사용자를 제거합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 제거 성공'
  })
  async removeUserFromRole(
    @Param('id') roleId: string,
    @Param('userId') userId: string,
    @GetUser() user: User,
  ): Promise<void> {
    return await this.adminRolesService.removeUserFromRole(roleId, userId, user);
  }

  @Post(':id/clone')
  @RequirePermissions('admin.roles.create')
  @ApiOperation({ 
    summary: 'Clone role',
    description: '기존 역할을 복사하여 새 역할을 생성합니다.'
  })
  @ApiResponse({ 
    status: 201, 
    description: '역할 복사 성공',
    type: RoleResponseDto
  })
  async cloneRole(
    @Param('id') id: string,
    @Body() cloneRoleDto: CloneRoleDto,
    @GetUser() user: User,
  ): Promise<RoleResponseDto> {
    return await this.adminRolesService.cloneRole(id, cloneRoleDto, user);
  }

  @Get(':id/impact-analysis')
  @RequirePermissions('admin.roles.delete')
  @ApiOperation({ 
    summary: 'Get role deletion impact',
    description: '역할 삭제 시 영향도를 분석합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '영향도 분석 성공',
    type: RoleDeletionImpactDto
  })
  async getRoleDeletionImpact(@Param('id') id: string): Promise<RoleDeletionImpactDto> {
    return await this.adminRolesService.getRoleDeletionImpact(id);
  }
}