import { Controller, Get, Post, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermissions } from './decorators/permissions.decorator';
import { 
  CreateAuditLogDto, 
  GetAuditLogsQueryDto,
  GetAuditStatsQueryDto,
  ExportAuditLogsDto,
  AuditLogResponseDto,
  AuditLogDetailDto,
  AuditLogStatsDto,
  PaginatedAuditLogsResponseDto 
} from './dto/audit-log.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@ApiTags('Admin - Audit Logs')
@Controller('admin/audit')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('logs')
  @RequirePermissions('admin.audit.view')
  @ApiOperation({ 
    summary: '감사 로그 목록 조회',
    description: '필터링 및 페이지네이션이 적용된 감사 로그 목록을 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '감사 로그 목록 조회 성공',
    type: PaginatedAuditLogsResponseDto
  })
  async getLogs(
    @Query() query: GetAuditLogsQueryDto,
  ): Promise<PaginatedResponseDto<AuditLogResponseDto>> {
    return this.auditLogService.getLogs(query);
  }

  @Get('logs/:id')
  @RequirePermissions('admin.audit.view')
  @ApiOperation({ 
    summary: '특정 감사 로그 상세 조회',
    description: 'ID를 통해 특정 감사 로그의 상세 정보를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '감사 로그 상세 정보 조회 성공',
    type: AuditLogDetailDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '감사 로그를 찾을 수 없음'
  })
  async getLogById(@Param('id') id: string): Promise<AuditLogDetailDto> {
    return this.auditLogService.getLogById(id);
  }

  @Get('statistics')
  @RequirePermissions('admin.audit.view')
  @ApiOperation({ 
    summary: '감사 로그 통계 조회',
    description: '지정된 기간 동안의 감사 로그 통계 정보를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '감사 로그 통계 조회 성공',
    type: AuditLogStatsDto
  })
  async getStatistics(
    @Query() query: GetAuditStatsQueryDto,
  ): Promise<AuditLogStatsDto> {
    const dateRange = {
      from: query.dateFrom ? new Date(query.dateFrom) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 기본 7일
      to: query.dateTo ? new Date(query.dateTo) : new Date(),
    };
    
    return this.auditLogService.getLogStatistics(dateRange);
  }

  @Get('export')
  @RequirePermissions('admin.audit.export')
  @ApiOperation({ 
    summary: '감사 로그 내보내기',
    description: '감사 로그를 CSV 또는 JSON 형식으로 내보냅니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '감사 로그 내보내기 성공'
  })
  async exportLogs(
    @Query() query: ExportAuditLogsDto,
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.auditLogService.exportLogs(query);
    
    const contentType = query.format === 'json' ? 'application/json' : 'text/csv';
    const fileExtension = query.format === 'json' ? 'json' : 'csv';
    
    response.setHeader('Content-Type', contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.${fileExtension}`,
    );
    
    response.send(buffer);
  }

  @Get('actions')
  @RequirePermissions('admin.audit.view')
  @ApiOperation({ 
    summary: '사용 가능한 액션 목록 조회',
    description: '감사 로그에서 사용 가능한 모든 액션 목록을 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '액션 목록 조회 성공',
    type: [String]
  })
  async getAvailableActions(): Promise<string[]> {
    return this.auditLogService.getAvailableActions();
  }

  @Get('resource-types')
  @RequirePermissions('admin.audit.view')
  @ApiOperation({ 
    summary: '사용 가능한 리소스 타입 목록 조회',
    description: '감사 로그에서 사용 가능한 모든 리소스 타입 목록을 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '리소스 타입 목록 조회 성공',
    type: [String]
  })
  async getAvailableResourceTypes(): Promise<string[]> {
    return this.auditLogService.getAvailableResourceTypes();
  }
}