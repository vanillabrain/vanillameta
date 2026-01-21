import { Controller, Get, Query, UseGuards, Param, Put, Body, Post, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { 
  GetUsersQueryDto, 
  UserResponseDto, 
  UserDetailDto,
  UpdateUserStatusDto, 
  ApproveUserDto, 
  RejectUserDto,
  CreateUserDto,
  UpdateUserDto,
  BulkActionDto,
  PaginatedUsersResponseDto,
  UserStatsDto
} from './dto/admin-users.dto';

@ApiTags('Admin Users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get all users',
    description: '모든 사용자 목록을 조회합니다. 페이지네이션, 검색, 필터링을 지원합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 목록 조회 성공',
    type: PaginatedUsersResponseDto
  })
  async getUsers(@Query() query: GetUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    return await this.adminUsersService.getUsers(query);
  }

  @Get('stats/summary')
  @ApiOperation({ 
    summary: 'Get user statistics',
    description: '사용자 통계 정보를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 통계 조회 성공',
    type: UserStatsDto
  })
  async getUserStats(): Promise<UserStatsDto> {
    return await this.adminUsersService.getUserStats();
  }

  @Get('pending')
  @ApiOperation({ 
    summary: 'Get pending users',
    description: '승인 대기 중인 사용자 목록을 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '승인 대기 사용자 목록 조회 성공',
    type: PaginatedUsersResponseDto
  })
  async getPendingUsers(@Query() query: GetUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    return await this.adminUsersService.getPendingUsers(query);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get user by ID',
    description: '특정 사용자의 상세 정보를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 정보 조회 성공',
    type: UserDetailDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '사용자를 찾을 수 없음'
  })
  async getUserById(@Param('id') id: string): Promise<UserDetailDto> {
    return await this.adminUsersService.getUserById(id);
  }

  @Post()
  @ApiOperation({ 
    summary: 'Create new user',
    description: '새로운 사용자를 생성합니다. 임시 비밀번호가 발급됩니다.'
  })
  @ApiResponse({ 
    status: 201, 
    description: '사용자 생성 성공',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 409, 
    description: '이미 존재하는 사용자'
  })
  async createUser(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return await this.adminUsersService.createUser(createUserDto);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update user',
    description: '사용자 정보를 수정합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 정보 수정 성공',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '사용자를 찾을 수 없음'
  })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<UserResponseDto> {
    return await this.adminUsersService.updateUser(id, updateUserDto);
  }

  @Put(':id/status')
  @ApiOperation({ 
    summary: 'Update user status',
    description: '사용자의 상태를 변경합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 상태 변경 성공'
  })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateUserStatusDto
  ) {
    return await this.adminUsersService.updateUserStatus(id, updateStatusDto.status);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete user',
    description: '사용자를 삭제합니다. (소프트 삭제)'
  })
  @ApiResponse({ 
    status: 204, 
    description: '사용자 삭제 성공'
  })
  @ApiResponse({ 
    status: 404, 
    description: '사용자를 찾을 수 없음'
  })
  async deleteUser(@Param('id') id: string): Promise<void> {
    return await this.adminUsersService.deleteUser(id);
  }

  @Post('bulk-action')
  @ApiOperation({ 
    summary: 'Bulk user action',
    description: '여러 사용자에 대해 일괄 작업을 수행합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '일괄 작업 성공'
  })
  async bulkAction(@Body() bulkActionDto: BulkActionDto): Promise<void> {
    return await this.adminUsersService.bulkAction(bulkActionDto);
  }

  @Post(':id/approve')
  @ApiOperation({ 
    summary: 'Approve user',
    description: '사용자를 승인합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 승인 성공',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '사용자를 찾을 수 없음'
  })
  async approveUser(
    @Param('id') id: string,
    @Body() approveDto: ApproveUserDto
  ) {
    return await this.adminUsersService.approveUser(id, approveDto);
  }

  @Post(':id/reject')
  @ApiOperation({ 
    summary: 'Reject user',
    description: '사용자를 거부합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 거부 성공',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '사용자를 찾을 수 없음'
  })
  async rejectUser(
    @Param('id') id: string,
    @Body() rejectDto: RejectUserDto
  ): Promise<UserResponseDto> {
    return await this.adminUsersService.rejectUser(id, rejectDto);
  }
}