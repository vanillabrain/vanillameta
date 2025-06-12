import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SlowQueryMonitorService, SlowQueryMonitorConfig } from './slow-query-monitor.service';

class SlowQueryFiltersDto {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  databaseId?: number;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  minExecutionTime?: number;
  maxExecutionTime?: number;
  resolved?: boolean;
}

class ResolveSlowQueryDto {
  resolutionNotes?: string;
}

class UpdateConfigDto {
  enabled?: boolean;
  threshold?: number;
  maxLogEntries?: number;
  cleanupIntervalDays?: number;
  alertThresholds?: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

@ApiTags('슬로우 쿼리 모니터링')
@Controller('monitoring/slow-queries')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SlowQueryMonitorController {
  constructor(private readonly slowQueryMonitorService: SlowQueryMonitorService) {}

  @Get('stats')
  @ApiOperation({ summary: '슬로우 쿼리 통계 조회' })
  @ApiQuery({ name: 'periodHours', description: '조회 기간 (시간)', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: '슬로우 쿼리 통계',
    schema: {
      example: {
        totalSlowQueries: 150,
        avgExecutionTime: 2500.5,
        maxExecutionTime: 15000,
        mostFrequentQueries: [
          {
            queryHash: 'abc123',
            query: 'SELECT * FROM users WHERE...',
            count: 25,
            avgExecutionTime: 3200,
          },
        ],
        performanceByDatabase: [
          {
            databaseId: 1,
            databaseEngine: 'mysql2',
            count: 80,
            avgExecutionTime: 2100,
          },
        ],
        severityDistribution: {
          low: 100,
          medium: 35,
          high: 12,
          critical: 3,
        },
        trendsLast24Hours: [
          {
            hour: '2024-01-01 10:00:00',
            count: 8,
            avgExecutionTime: 2300,
          },
        ],
      },
    },
  })
  async getSlowQueryStats(@Query('periodHours') periodHours?: number) {
    return this.slowQueryMonitorService.getSlowQueryStats(periodHours);
  }

  @Get()
  @ApiOperation({ summary: '슬로우 쿼리 목록 조회' })
  @ApiQuery({ name: 'page', description: '페이지 번호', required: false, type: Number })
  @ApiQuery({ name: 'limit', description: '페이지 크기', required: false, type: Number })
  @ApiQuery({ name: 'startDate', description: '시작 날짜', required: false, type: Date })
  @ApiQuery({ name: 'endDate', description: '종료 날짜', required: false, type: Date })
  @ApiQuery({ name: 'databaseId', description: '데이터베이스 ID', required: false, type: Number })
  @ApiQuery({
    name: 'severity',
    description: '심각도',
    required: false,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  })
  @ApiQuery({
    name: 'minExecutionTime',
    description: '최소 실행 시간 (ms)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'maxExecutionTime',
    description: '최대 실행 시간 (ms)',
    required: false,
    type: Number,
  })
  @ApiQuery({ name: 'resolved', description: '해결 여부', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: '슬로우 쿼리 목록',
    schema: {
      example: {
        data: [
          {
            id: 1,
            queryHash: 'abc123',
            query: 'SELECT * FROM users WHERE email = ?',
            executionTime: 2500,
            databaseEngine: 'mysql2',
            severity: 'MEDIUM',
            detectedAt: '2024-01-01T10:30:00.000Z',
            resolved: false,
          },
        ],
        total: 150,
        page: 1,
        limit: 50,
      },
    },
  })
  async getSlowQueries(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query() filters?: SlowQueryFiltersDto,
  ) {
    const { page: pageParam, limit: limitParam, ...filterParams } = filters || {};

    return this.slowQueryMonitorService.getSlowQueries(
      page || pageParam || 1,
      limit || limitParam || 50,
      filterParams,
    );
  }

  @Put(':id/resolve')
  @ApiOperation({ summary: '슬로우 쿼리 해결 처리' })
  @ApiParam({ name: 'id', description: '슬로우 쿼리 로그 ID', type: Number })
  @ApiResponse({
    status: 200,
    description: '해결 처리 완료',
  })
  @HttpCode(HttpStatus.OK)
  async resolveSlowQuery(@Param('id') id: number, @Body() body: ResolveSlowQueryDto) {
    await this.slowQueryMonitorService.resolveSlowQuery(id, body.resolutionNotes);
    return { message: '슬로우 쿼리가 해결 처리되었습니다.' };
  }

  @Get('config')
  @ApiOperation({ summary: '슬로우 쿼리 모니터링 설정 조회' })
  @ApiResponse({
    status: 200,
    description: '현재 설정',
    schema: {
      example: {
        enabled: true,
        threshold: 1000,
        maxLogEntries: 10000,
        cleanupIntervalDays: 30,
        alertThresholds: {
          low: 1000,
          medium: 3000,
          high: 10000,
          critical: 30000,
        },
      },
    },
  })
  async getConfig(): Promise<SlowQueryMonitorConfig> {
    return this.slowQueryMonitorService.getConfig();
  }

  @Put('config')
  @ApiOperation({ summary: '슬로우 쿼리 모니터링 설정 업데이트' })
  @ApiResponse({
    status: 200,
    description: '설정 업데이트 완료',
  })
  @HttpCode(HttpStatus.OK)
  async updateConfig(@Body() configUpdate: UpdateConfigDto) {
    this.slowQueryMonitorService.updateConfig(configUpdate);
    return { message: '설정이 업데이트되었습니다.' };
  }

  @Post('cleanup')
  @ApiOperation({ summary: '오래된 슬로우 쿼리 로그 정리' })
  @ApiResponse({
    status: 200,
    description: '정리 작업 완료',
  })
  @HttpCode(HttpStatus.OK)
  async cleanupOldLogs() {
    await this.slowQueryMonitorService.cleanupOldLogs();
    return { message: '오래된 로그 정리가 완료되었습니다.' };
  }

  @Get('export')
  @ApiOperation({ summary: '슬로우 쿼리 데이터 내보내기' })
  @ApiQuery({
    name: 'format',
    description: '내보내기 형식',
    required: false,
    enum: ['json', 'csv'],
  })
  @ApiQuery({ name: 'startDate', description: '시작 날짜', required: false, type: Date })
  @ApiQuery({ name: 'endDate', description: '종료 날짜', required: false, type: Date })
  @ApiResponse({
    status: 200,
    description: '내보내기 데이터',
  })
  async exportSlowQueries(
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query() filters?: SlowQueryFiltersDto,
  ) {
    const { data } = await this.slowQueryMonitorService.getSlowQueries(
      1,
      10000, // 대량 내보내기
      filters,
    );

    if (format === 'csv') {
      // CSV 형식으로 변환
      const headers = [
        'ID',
        'Query Hash',
        'Execution Time (ms)',
        'Database Engine',
        'Severity',
        'Detected At',
        'Resolved',
      ];

      const csvRows = data.map(log => [
        log.id,
        log.queryHash,
        log.executionTime,
        log.databaseEngine || 'N/A',
        log.severity,
        log.detectedAt.toISOString(),
        log.resolved ? 'Yes' : 'No',
      ]);

      const csvContent = [headers, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return {
        format: 'csv',
        data: csvContent,
        filename: `slow_queries_${new Date().toISOString().split('T')[0]}.csv`,
      };
    }

    return {
      format: 'json',
      data,
      filename: `slow_queries_${new Date().toISOString().split('T')[0]}.json`,
    };
  }
}
