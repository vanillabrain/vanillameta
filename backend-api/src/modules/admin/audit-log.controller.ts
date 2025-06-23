import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { 
  CreateAuditLogDto, 
  GetAuditLogsQueryDto, 
  AuditLogResponseDto,
  PaginatedAuditLogsResponseDto 
} from './dto/audit-log.dto';

@ApiTags('Admin Audit Logs')
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create audit log',
    description: '새로운 감사 로그를 생성합니다.'
  })
  @ApiResponse({ 
    status: 201, 
    description: '감사 로그 생성 성공'
  })
  async createAuditLog(@Body() createAuditLogDto: CreateAuditLogDto) {
    return await this.auditLogService.createAuditLog(createAuditLogDto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all audit logs',
    description: '모든 감사 로그 목록을 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '감사 로그 목록 조회 성공',
    type: PaginatedAuditLogsResponseDto
  })
  async getAuditLogs(@Query() query: GetAuditLogsQueryDto) {
    return await this.auditLogService.getAuditLogs(query);
  }

  @Get('stats')
  @ApiOperation({ 
    summary: 'Get audit log statistics',
    description: '감사 로그 통계 정보를 조회합니다.'
  })
  async getAuditLogStats() {
    return await this.auditLogService.getAuditLogStats();
  }

  @Get('actions')
  @ApiOperation({ 
    summary: 'Get available actions',
    description: '사용 가능한 감사 로그 액션 목록을 조회합니다.'
  })
  async getAvailableActions() {
    return await this.auditLogService.getAvailableActions();
  }

  @Get('user/:userId')
  @ApiOperation({ 
    summary: 'Get user audit logs',
    description: '특정 사용자의 감사 로그를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 감사 로그 조회 성공',
    type: [AuditLogResponseDto]
  })
  async getUserAuditLogs(
    @Param('userId') userId: string,
    @Query('limit') limit?: number
  ) {
    return await this.auditLogService.getUserAuditLogs(userId, limit);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get audit log by ID',
    description: '특정 감사 로그의 상세 정보를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '감사 로그 정보 조회 성공',
    type: AuditLogResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '감사 로그를 찾을 수 없음'
  })
  async getAuditLogById(@Param('id') id: string) {
    return await this.auditLogService.getAuditLogById(parseInt(id, 10));
  }
}