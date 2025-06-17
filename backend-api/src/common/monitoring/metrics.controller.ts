import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BusinessMetricsService } from './business-metrics.service';
import { MemoryMonitorService } from './memory-monitor.service';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';

@ApiTags('monitoring')
@Controller('monitoring/metrics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MetricsController {
  constructor(
    private readonly businessMetrics: BusinessMetricsService,
    private readonly memoryMonitor: MemoryMonitorService,
    private readonly cloudWatchMetrics: CloudWatchMetricsService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: '시스템 헬스 체크' })
  @ApiResponse({ status: 200, description: '시스템 상태' })
  async getHealth() {
    const memoryStats = this.memoryMonitor.getCurrentMemoryStats();
    const memoryThreshold = this.memoryMonitor.checkMemoryThreshold();
    
    return {
      status: memoryThreshold.isCritical ? 'critical' : memoryThreshold.isWarning ? 'warning' : 'healthy',
      timestamp: new Date().toISOString(),
      memory: {
        utilizationPercent: memoryStats.utilizationPercent.toFixed(2),
        heapUsed: memoryStats.heapUsed,
        heapTotal: memoryStats.heapTotal,
        rss: memoryStats.rss,
      },
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    };
  }

  @Get('memory')
  @ApiOperation({ summary: '메모리 사용 현황 조회' })
  @ApiResponse({ status: 200, description: '메모리 통계' })
  async getMemoryStats() {
    const currentStats = this.memoryMonitor.getCurrentMemoryStats();
    const history = this.memoryMonitor.getMemoryHistory();
    const leakDetection = this.memoryMonitor.detectMemoryLeak();

    return {
      current: currentStats,
      history: history.slice(-10), // 최근 10개만
      leakDetection,
      recommendations: this.generateMemoryRecommendations(currentStats, leakDetection),
    };
  }

  @Get('dashboard')
  @ApiOperation({ summary: '대시보드 메트릭 조회' })
  @ApiResponse({ status: 200, description: '대시보드 관련 메트릭' })
  @ApiQuery({ name: 'period', required: false, description: '조회 기간 (초)', example: 300 })
  async getDashboardMetrics(@Query('period') period?: string) {
    const periodSeconds = period ? parseInt(period, 10) : 300; // 기본 5분

    try {
      // CloudWatch에서 메트릭 조회
      const metrics = await Promise.all([
        this.cloudWatchMetrics.getMetricStatistics(
          'VanillaMeta/Business',
          'DASHBOARD_LOAD_TIME',
          periodSeconds,
        ),
        this.cloudWatchMetrics.getMetricStatistics(
          'VanillaMeta/Business',
          'WIDGET_RENDER_TIME',
          periodSeconds,
        ),
        this.cloudWatchMetrics.getMetricStatistics(
          'VanillaMeta/Business',
          'QUERY_CACHE_HIT_RATE',
          periodSeconds,
        ),
      ]);

      return {
        period: periodSeconds,
        metrics: {
          dashboardLoadTime: metrics[0],
          widgetRenderTime: metrics[1],
          queryCacheHitRate: metrics[2],
        },
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard metrics', error);
      return {
        period: periodSeconds,
        error: 'Failed to retrieve metrics',
      };
    }
  }

  @Get('api')
  @ApiOperation({ summary: 'API 성능 메트릭 조회' })
  @ApiResponse({ status: 200, description: 'API 관련 메트릭' })
  @ApiQuery({ name: 'period', required: false, description: '조회 기간 (초)', example: 300 })
  async getApiMetrics(@Query('period') period?: string) {
    const periodSeconds = period ? parseInt(period, 10) : 300;

    try {
      const metrics = await Promise.all([
        this.cloudWatchMetrics.getMetricStatistics(
          'VanillaMeta/Business',
          'API_RESPONSE_TIME',
          periodSeconds,
        ),
        this.cloudWatchMetrics.getMetricStatistics(
          'VanillaMeta/Business',
          'API_ERROR_RATE',
          periodSeconds,
        ),
        this.cloudWatchMetrics.getMetricStatistics(
          'VanillaMeta/Business',
          'API_REQUEST_COUNT',
          periodSeconds,
        ),
      ]);

      return {
        period: periodSeconds,
        metrics: {
          responseTime: metrics[0],
          errorRate: metrics[1],
          requestCount: metrics[2],
        },
      };
    } catch (error) {
      this.logger.error('Failed to get API metrics', error);
      return {
        period: periodSeconds,
        error: 'Failed to retrieve metrics',
      };
    }
  }

  @Get('query')
  @ApiOperation({ summary: '쿼리 성능 메트릭 조회' })
  @ApiResponse({ status: 200, description: '쿼리 관련 메트릭' })
  @ApiQuery({ name: 'period', required: false, description: '조회 기간 (초)', example: 300 })
  async getQueryMetrics(@Query('period') period?: string) {
    const periodSeconds = period ? parseInt(period, 10) : 300;

    try {
      const metrics = await Promise.all([
        this.cloudWatchMetrics.getMetricStatistics(
          'VanillaMeta/Business',
          'QUERY_EXECUTION_TIME',
          periodSeconds,
        ),
        this.cloudWatchMetrics.getMetricStatistics(
          'VanillaMeta/Business',
          'QUERY_ERROR_RATE',
          periodSeconds,
        ),
        this.cloudWatchMetrics.getMetricStatistics(
          'VanillaMeta/Business',
          'QUERY_CACHE_HIT_RATE',
          periodSeconds,
        ),
      ]);

      return {
        period: periodSeconds,
        metrics: {
          executionTime: metrics[0],
          errorRate: metrics[1],
          cacheHitRate: metrics[2],
        },
      };
    } catch (error) {
      this.logger.error('Failed to get query metrics', error);
      return {
        period: periodSeconds,
        error: 'Failed to retrieve metrics',
      };
    }
  }

  @Get('summary')
  @ApiOperation({ summary: '전체 메트릭 요약' })
  @ApiResponse({ status: 200, description: '시스템 전체 메트릭 요약' })
  async getMetricsSummary() {
    const [health, apiMetrics, queryMetrics, dashboardMetrics] = await Promise.all([
      this.getHealth(),
      this.getApiMetrics(),
      this.getQueryMetrics(),
      this.getDashboardMetrics(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      health,
      api: apiMetrics.metrics,
      query: queryMetrics.metrics,
      dashboard: dashboardMetrics.metrics,
      sli: this.calculateSLI(apiMetrics, queryMetrics, dashboardMetrics),
    };
  }

  private generateMemoryRecommendations(
    stats: any,
    leakDetection: any,
  ): string[] {
    const recommendations: string[] = [];

    if (stats.utilizationPercent > 85) {
      recommendations.push('메모리 사용률이 매우 높습니다. Lambda 메모리 크기 증가를 고려하세요.');
    }

    if (stats.utilizationPercent > 75) {
      recommendations.push('메모리 사용률이 높습니다. 불필요한 캐시 정리를 고려하세요.');
    }

    if (leakDetection.isLeaking) {
      recommendations.push(
        `메모리 누수가 의심됩니다. 최근 10분간 ${leakDetection.trend.toFixed(2)}% 증가했습니다.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('메모리 사용률이 정상 범위 내에 있습니다.');
    }

    return recommendations;
  }

  private calculateSLI(apiMetrics: any, queryMetrics: any, dashboardMetrics: any): any {
    // SLI 계산 로직 (예시)
    return {
      availability: '99.9%', // 실제 계산 필요
      latency: {
        p50: '200ms',
        p90: '500ms',
        p99: '1000ms',
      },
      errorRate: '0.1%',
      satisfaction: 'Good', // Apdex 점수 기반
    };
  }

  private readonly logger = new Logger(MetricsController.name);
}