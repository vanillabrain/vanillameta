import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { 
  CreateRoleDto, 
  UpdateRoleDto, 
  GetRolesQueryDto, 
  RoleResponseDto,
  PaginatedRolesResponseDto 
} from './dto/role.dto';

@ApiTags('Admin Roles')
@Controller('admin/roles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
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
  async createRole(@Body() createRoleDto: CreateRoleDto) {
    return await this.roleService.createRole(createRoleDto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all roles',
    description: '모든 역할 목록을 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '역할 목록 조회 성공',
    type: PaginatedRolesResponseDto
  })
  async getRoles(@Query() query: GetRolesQueryDto) {
    return await this.roleService.getRoles(query);
  }

  @Get('permissions')
  @ApiOperation({ 
    summary: 'Get available permissions',
    description: '사용 가능한 모든 권한 목록을 조회합니다.'
  })
  async getAvailablePermissions() {
    return await this.roleService.getAvailablePermissions();
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get role by ID',
    description: '특정 역할의 상세 정보를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '역할 정보 조회 성공',
    type: RoleResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '역할을 찾을 수 없음'
  })
  async getRoleById(@Param('id') id: string) {
    return await this.roleService.getRoleById(parseInt(id, 10));
  }

  @Put(':id')
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
    @Body() updateRoleDto: UpdateRoleDto
  ) {
    return await this.roleService.updateRole(parseInt(id, 10), updateRoleDto);
  }

  @Delete(':id')
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
  async deleteRole(@Param('id') id: string) {
    return await this.roleService.deleteRole(parseInt(id, 10));
  }

  @Post('initialize-defaults')
  @ApiOperation({ 
    summary: 'Initialize default roles',
    description: '기본 역할들을 생성합니다.'
  })
  async initializeDefaultRoles() {
    await this.roleService.initializeDefaultRoles();
    return { message: '기본 역할 생성이 완료되었습니다.' };
  }
}