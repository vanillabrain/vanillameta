import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CacheMonitoringService } from './cache-monitoring.service';

/**
 * 캐시 모니터링 API
 * 실시간 캐시 성능 메트릭 및 상태 조회
 */
@ApiTags('캐시 모니터링')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('cache/monitoring')
export class CacheMonitoringController {
  constructor(private readonly cacheMonitoringService: CacheMonitoringService) {}

  /**
   * 현재 캐시 메트릭 조회
   */
  @Get('metrics/current')
  @ApiOperation({
    summary: '현재 캐시 메트릭 조회',
    description: '모든 엔진 또는 특정 엔진의 현재 캐시 성능 메트릭을 조회합니다.',
  })
  @ApiQuery({
    name: 'engine',
    required: false,
    description: '엔진 타입 (dashboard, dataset, widget)',
    enum: ['dashboard', 'dataset', 'widget'],
  })
  @ApiResponse({
    status: 200,
    description: '캐시 메트릭이 반환되었습니다.',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'number' },
        engine: { type: 'string' },
        l1: {
          type: 'object',
          properties: {
            hitRate: { type: 'number', example: 0.85 },
            missRate: { type: 'number', example: 0.15 },
            totalHits: { type: 'number' },
            totalMisses: { type: 'number' },
            size: { type: 'number' },
            maxSize: { type: 'number' },
            memoryUsage: { type: 'number' },
            evictions: { type: 'number' },
          },
        },
        l2: {
          type: 'object',
          properties: {
            hitRate: { type: 'number' },
            missRate: { type: 'number' },
            totalHits: { type: 'number' },
            totalMisses: { type: 'number' },
            keyCount: { type: 'number' },
            memoryUsage: { type: 'number' },
            evictions: { type: 'number' },
            connectionStatus: { type: 'string', enum: ['connected', 'disconnected', 'error'] },
            latency: {
              type: 'object',
              properties: {
                avg: { type: 'number' },
                p50: { type: 'number' },
                p95: { type: 'number' },
                p99: { type: 'number' },
              },
            },
          },
        },
        overall: {
          type: 'object',
          properties: {
            hitRate: { type: 'number' },
            missRate: { type: 'number' },
            totalRequests: { type: 'number' },
            cacheEfficiency: { type: 'number' },
            avgResponseTime: { type: 'number' },
          },
        },
      },
    },
  })
  async getCurrentMetrics(@Query('engine') engine?: string) {
    try {
      const metrics = await this.cacheMonitoringService.getCurrentMetrics(engine);
      return {
        status: 'success',
        data: metrics,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '메트릭 조회 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 캐시 메트릭 히스토리 조회
   */
  @Get('metrics/history/:engine')
  @ApiOperation({
    summary: '캐시 메트릭 히스토리 조회',
    description: '특정 엔진의 캐시 성능 메트릭 히스토리를 조회합니다.',
  })
  @ApiParam({
    name: 'engine',
    description: '엔진 타입',
    enum: ['dashboard', 'dataset', 'widget'],
  })
  @ApiQuery({
    name: 'duration',
    required: false,
    description: '조회 기간 (밀리초 단위, 기본값: 24시간)',
    type: Number,
    example: 86400000,
  })
  @ApiResponse({
    status: 200,
    description: '메트릭 히스토리가 반환되었습니다.',
  })
  async getMetricsHistory(@Param('engine') engine: string, @Query('duration') duration?: string) {
    try {
      const durationMs = duration ? parseInt(duration, 10) : 86400000; // 기본 24시간
      const history = this.cacheMonitoringService.getMetricsHistory(engine, durationMs);

      return {
        status: 'success',
        data: {
          engine,
          duration: durationMs,
          count: history.length,
          metrics: history,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '히스토리 조회 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 캐시 상태 요약 조회
   */
  @Get('summary')
  @ApiOperation({
    summary: '캐시 상태 요약',
    description: '모든 캐시 엔진의 현재 상태와 건강도를 요약하여 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '캐시 상태 요약이 반환되었습니다.',
    schema: {
      type: 'object',
      properties: {
        engines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: { type: 'string', enum: ['healthy', 'warning', 'critical'] },
              hitRate: { type: 'number' },
              efficiency: { type: 'number' },
              issues: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        overall: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'warning', 'critical'] },
            avgHitRate: { type: 'number' },
            avgEfficiency: { type: 'number' },
            totalRequests: { type: 'number' },
          },
        },
      },
    },
  })
  async getCacheSummary() {
    try {
      const summary = await this.cacheMonitoringService.getCacheSummary();
      return {
        status: 'success',
        data: summary,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '상태 요약 조회 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 캐시 성능 리포트 생성
   */
  @Get('report')
  @ApiOperation({
    summary: '캐시 성능 리포트',
    description: '지정된 기간 동안의 캐시 성능 분석 리포트를 생성합니다.',
  })
  @ApiQuery({
    name: 'duration',
    required: false,
    description: '분석 기간 (밀리초 단위, 기본값: 24시간)',
    type: Number,
    example: 86400000,
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: '리포트 형식',
    enum: ['json', 'summary'],
    default: 'json',
  })
  @ApiResponse({
    status: 200,
    description: '성능 리포트가 생성되었습니다.',
    schema: {
      type: 'object',
      properties: {
        period: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
          },
        },
        summary: {
          type: 'object',
          properties: {
            avgHitRate: { type: 'number' },
            totalRequests: { type: 'number' },
            totalHits: { type: 'number' },
            totalMisses: { type: 'number' },
            avgResponseTime: { type: 'number' },
            peakUsageTime: { type: 'string', format: 'date-time' },
          },
        },
        engines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              performance: {
                type: 'object',
                properties: {
                  hitRate: { type: 'number' },
                  avgLatency: { type: 'number' },
                  peakLatency: { type: 'number' },
                },
              },
              recommendations: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  async generateReport(@Query('duration') duration?: string, @Query('format') format = 'json') {
    try {
      const durationMs = duration ? parseInt(duration, 10) : 86400000;
      const report = await this.cacheMonitoringService.generatePerformanceReport(durationMs);

      if (format === 'summary') {
        // 요약 형식으로 변환
        return {
          status: 'success',
          data: {
            period: `${report.period.start.toISOString()} ~ ${report.period.end.toISOString()}`,
            hitRate: `${(report.summary.avgHitRate * 100).toFixed(1)}%`,
            totalRequests: report.summary.totalRequests.toLocaleString(),
            avgResponseTime: `${report.summary.avgResponseTime.toFixed(2)}ms`,
            engineStatus: report.engines.map(e => ({
              name: e.name,
              hitRate: `${(e.performance.hitRate * 100).toFixed(1)}%`,
              status: e.performance.hitRate >= 0.7 ? '양호' : '개선 필요',
            })),
          },
        };
      }

      return {
        status: 'success',
        data: report,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '리포트 생성 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 캐시 설정 권장사항 조회
   */
  @Get('recommendations')
  @ApiOperation({
    summary: '캐시 설정 권장사항',
    description: '현재 성능 데이터를 기반으로 캐시 설정 최적화 권장사항을 제공합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '권장사항이 생성되었습니다.',
    schema: {
      type: 'object',
      properties: {
        ttl: {
          type: 'object',
          additionalProperties: { type: 'number' },
          example: { dashboard: 3600, dataset: 1800, widget: 900 },
        },
        memoryAllocation: {
          type: 'object',
          additionalProperties: { type: 'number' },
          example: { dashboard: 1000, dataset: 2000, widget: 500 },
        },
        warmupStrategy: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  async getRecommendations() {
    try {
      const recommendations = await this.cacheMonitoringService.generateRecommendations();
      return {
        status: 'success',
        data: recommendations,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '권장사항 생성 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 실시간 캐시 이벤트 스트림
   */
  @Get('events/stream')
  @ApiOperation({
    summary: '실시간 캐시 이벤트 스트림',
    description: 'Server-Sent Events를 통해 실시간 캐시 모니터링 이벤트를 수신합니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE 스트림이 시작되었습니다.',
  })
  async streamEvents() {
    // TODO: SSE 구현
    return {
      status: 'success',
      message: 'SSE endpoint - implementation pending',
    };
  }

  /**
   * 캐시 건강도 체크
   */
  @Get('health')
  @ApiOperation({
    summary: '캐시 건강도 체크',
    description: '캐시 시스템의 전반적인 건강 상태를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '건강도 체크 결과',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        checks: {
          type: 'object',
          properties: {
            l1Cache: { type: 'boolean' },
            l2Cache: { type: 'boolean' },
            redisConnection: { type: 'boolean' },
            performanceThresholds: { type: 'boolean' },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async checkHealth() {
    try {
      const summary = await this.cacheMonitoringService.getCacheSummary();

      const checks = {
        l1Cache: true, // L1 캐시는 항상 사용 가능
        l2Cache: summary.engines.every(e => e.status !== 'critical'),
        redisConnection: !summary.engines.some(e => e.issues.includes('Redis 연결 문제')),
        performanceThresholds: summary.overall.avgHitRate >= 0.7,
      };

      const allHealthy = Object.values(checks).every(check => check);
      const anyUnhealthy = Object.values(checks).some(check => !check);

      return {
        status: allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded',
        checks,
        message: allHealthy
          ? '모든 캐시 시스템이 정상 작동 중입니다.'
          : anyUnhealthy
          ? '일부 캐시 시스템에 문제가 있습니다.'
          : '캐시 성능이 저하되었습니다.',
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '건강도 체크 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
