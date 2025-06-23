import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @ApiOperation({ 
    summary: 'Get admin dashboard statistics',
    description: '관리자 대시보드용 통계 데이터를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '통계 데이터 조회 성공',
    type: DashboardStatsDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: '인증 실패' 
  })
  @ApiResponse({ 
    status: 403, 
    description: '권한 없음' 
  })
  async getDashboardStats(): Promise<DashboardStatsDto> {
    return await this.adminService.getDashboardStats();
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Admin module health check',
    description: 'Admin 모듈의 상태를 확인합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Admin 모듈 정상 동작' 
  })
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}