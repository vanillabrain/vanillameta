import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PerformanceMetricsService, PerformanceStats } from '../../common/services/performance-metrics.service';
import { CloudWatchIntegrationService } from '../../common/services/cloudwatch-integration.service';

export interface MetricsSummary {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  activeRequests: number;
  topSlowEndpoints: Array<{
    endpoint: string;
    avgResponseTime: number;
    p95ResponseTime: number;
  }>;
  topErrorEndpoints: Array<{
    endpoint: string;
    errorRate: number;
    errorCount: number;
  }>;
  systemMetrics: {
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    cpuUsage: number;
    uptime: number;
  };
}

export interface HistoricalMetrics {
  timeRange: {
    start: Date;
    end: Date;
  };
  dataPoints: Array<{
    timestamp: Date;
    responseTime: number;
    errorRate: number;
    requestCount: number;
    memoryUsage: number;
    cpuUsage: number;
  }>;
}

/**
 * 모니터링 컨트롤러
 * 
 * API 성능 모니터링 데이터를 조회하는 엔드포인트를 제공합니다.
 */
@ApiTags('monitoring')
@Controller('monitoring')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class MonitoringController {
  constructor(
    private readonly metricsService: PerformanceMetricsService,
    private readonly cloudWatchService: CloudWatchIntegrationService,
  ) {}

  /**
   * 성능 메트릭 요약 조회
   */
  @Get('metrics/summary')
  @ApiOperation({ summary: '성능 메트릭 요약 조회' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '성능 메트릭 요약',
    type: Object,
  })
  async getMetricsSummary(): Promise<MetricsSummary> {
    const stats = await this.metricsService.getOverallStats();
    
    // 전체 통계 계산
    let totalRequests = 0;
    let totalResponseTime = 0;
    let totalErrors = 0;
    const endpoints = Object.values(stats);
    
    endpoints.forEach(stat => {
      totalRequests += stat.count;
      totalResponseTime += stat.avgResponseTime * stat.count;
      totalErrors += stat.errorRate * stat.count;
    });
    
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    
    // 느린 엔드포인트 Top 5
    const topSlowEndpoints = endpoints
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 5)
      .map(stat => ({
        endpoint: stat.endpoint,
        avgResponseTime: stat.avgResponseTime,
        p95ResponseTime: stat.p95ResponseTime,
      }));
    
    // 에러가 많은 엔드포인트 Top 5
    const topErrorEndpoints = endpoints
      .filter(stat => stat.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5)
      .map(stat => ({
        endpoint: stat.endpoint,
        errorRate: stat.errorRate,
        errorCount: Math.round(stat.errorRate * stat.count),
      }));
    
    // 시스템 메트릭
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const cpuPercentage = (cpuUsage.user + cpuUsage.system) / 1000000 * 100;
    
    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      activeRequests: 0, // Redis에서 조회 필요
      topSlowEndpoints,
      topErrorEndpoints,
      systemMetrics: {
        memoryUsage: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
        },
        cpuUsage: Math.min(cpuPercentage, 100),
        uptime: process.uptime(),
      },
    };
  }

  /**
   * 엔드포인트별 상세 통계 조회
   */
  @Get('metrics/endpoint/:endpoint(*)')
  @ApiOperation({ summary: '엔드포인트별 상세 통계 조회' })
  @ApiParam({
    name: 'endpoint',
    description: '엔드포인트 경로',
    example: '/api/dashboards/:id',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '엔드포인트 상세 통계',
    type: Object,
  })
  async getEndpointMetrics(
    @Param('endpoint') endpoint: string,
  ): Promise<PerformanceStats | null> {
    // URL 디코딩
    const decodedEndpoint = decodeURIComponent(endpoint);
    return await this.metricsService.getEndpointStats(decodedEndpoint);
  }

  /**
   * 전체 엔드포인트 통계 조회
   */
  @Get('metrics/endpoints')
  @ApiOperation({ summary: '전체 엔드포인트 통계 조회' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '전체 엔드포인트 통계',
    type: Object,
  })
  async getAllEndpointMetrics(): Promise<Record<string, PerformanceStats>> {
    return await this.metricsService.getOverallStats();
  }

  /**
   * CloudWatch 메트릭 정의 조회
   */
  @Get('cloudwatch/definitions')
  @ApiOperation({ summary: 'CloudWatch 메트릭 정의 조회' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'CloudWatch 메트릭 정의',
    type: Object,
  })
  getCloudWatchDefinitions(): Record<string, any> {
    return this.cloudWatchService.getMetricDefinitions();
  }

  /**
   * 실시간 시스템 메트릭 조회
   */
  @Get('metrics/system')
  @ApiOperation({ summary: '실시간 시스템 메트릭 조회' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '시스템 메트릭',
    type: Object,
  })
  getSystemMetrics(): Record<string, any> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const cpuPercentage = (cpuUsage.user + cpuUsage.system) / 1000000 * 100;
    
    return {
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsedPercentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
      cpu: {
        usage: Math.min(Math.round(cpuPercentage), 100),
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 성능 리포트 생성
   */
  @Get('report')
  @ApiOperation({ summary: '성능 리포트 생성' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: '시작 날짜 (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: '종료 날짜 (ISO 8601)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '성능 리포트',
    type: Object,
  })
  async generateReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<Record<string, any>> {
    const stats = await this.metricsService.getOverallStats();
    const summary = await this.getMetricsSummary();
    
    return {
      report: {
        generatedAt: new Date(),
        period: {
          start: startDate || 'N/A',
          end: endDate || 'N/A',
        },
        summary: {
          totalRequests: summary.totalRequests,
          averageResponseTime: `${Math.round(summary.averageResponseTime)}ms`,
          errorRate: `${(summary.errorRate * 100).toFixed(2)}%`,
          availability: `${((1 - summary.errorRate) * 100).toFixed(2)}%`,
        },
        performance: {
          topSlowEndpoints: summary.topSlowEndpoints,
          topErrorEndpoints: summary.topErrorEndpoints,
        },
        recommendations: this.generateRecommendations(summary, stats),
      },
    };
  }

  /**
   * 성능 개선 추천 생성
   */
  private generateRecommendations(
    summary: MetricsSummary,
    stats: Record<string, PerformanceStats>,
  ): string[] {
    const recommendations: string[] = [];
    
    // 느린 응답 시간 체크
    if (summary.averageResponseTime > 500) {
      recommendations.push(
        '평균 응답 시간이 500ms를 초과합니다. 캐싱 전략을 검토하거나 데이터베이스 쿼리를 최적화하세요.',
      );
    }
    
    // 높은 에러율 체크
    if (summary.errorRate > 0.05) {
      recommendations.push(
        '에러율이 5%를 초과합니다. 에러 로그를 검토하고 문제가 되는 엔드포인트를 수정하세요.',
      );
    }
    
    // 특정 엔드포인트의 성능 문제
    Object.values(stats).forEach(stat => {
      if (stat.p95ResponseTime > 2000) {
        recommendations.push(
          `${stat.endpoint} 엔드포인트의 P95 응답 시간이 2초를 초과합니다. 성능 최적화가 필요합니다.`,
        );
      }
    });
    
    // 메모리 사용량 체크
    const memoryUsagePercent = (summary.systemMetrics.memoryUsage.heapUsed / summary.systemMetrics.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      recommendations.push(
        '메모리 사용량이 80%를 초과합니다. 메모리 누수를 확인하거나 메모리 할당량을 늘리세요.',
      );
    }
    
    // CPU 사용률 체크
    if (summary.systemMetrics.cpuUsage > 70) {
      recommendations.push(
        'CPU 사용률이 높습니다. CPU 집약적인 작업을 백그라운드 작업으로 이동하거나 인스턴스를 확장하세요.',
      );
    }
    
    if (recommendations.length === 0) {
      recommendations.push('현재 성능 지표가 양호합니다. 지속적인 모니터링을 유지하세요.');
    }
    
    return recommendations;
  }
}