import { Controller, Get, Query, UseGuards, Param, Put, Body, Post, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUsersQueryDto, UserResponseDto, UpdateUserStatusDto, ApproveUserDto, RejectUserDto } from './dto/admin-users.dto';

@ApiTags('Admin Users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get all users',
    description: '모든 사용자 목록을 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 목록 조회 성공',
    type: [UserResponseDto]
  })
  async getUsers(@Query() query: GetUsersQueryDto) {
    return await this.adminUsersService.getUsers(query);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get user by ID',
    description: '특정 사용자의 상세 정보를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 정보 조회 성공',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '사용자를 찾을 수 없음'
  })
  async getUserById(@Param('id') id: string) {
    return await this.adminUsersService.getUserById(id);
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

  @Get('stats/summary')
  @ApiOperation({ 
    summary: 'Get user statistics',
    description: '사용자 통계 정보를 조회합니다.'
  })
  async getUserStats() {
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
    type: [UserResponseDto]
  })
  async getPendingUsers(@Query() query: GetUsersQueryDto) {
    return await this.adminUsersService.getPendingUsers(query);
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
  ) {
    return await this.adminUsersService.rejectUser(id, rejectDto);
  }
}