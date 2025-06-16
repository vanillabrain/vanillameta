import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BusinessMetricsService } from './business-metrics.service';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';
import { MemoryMonitorService } from './memory-monitor.service';
import * as os from 'os';

interface SystemMetrics {
  timestamp: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    percentUsed: number;
  };
  system: {
    platform: string;
    uptime: number;
    loadAverage: number[];
    cpuCount: number;
  };
  business: {
    dailyActiveUsers: number;
    cachedMetrics: Record<string, number>;
  };
}

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly businessMetrics: BusinessMetricsService,
    private readonly cloudWatchMetrics: CloudWatchMetricsService,
    private readonly memoryMonitor: MemoryMonitorService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: '시스템 헬스 체크' })
  @ApiResponse({ status: 200, description: '시스템 정상' })
  async healthCheck() {
    const memoryStats = this.memoryMonitor.getMemoryStats();
    const isHealthy = memoryStats.percentUsed < 90;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      memory: {
        percentUsed: memoryStats.percentUsed,
        available: memoryStats.available,
      },
      uptime: process.uptime(),
    };
  }

  @Get('system')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '시스템 메트릭 조회' })
  @ApiResponse({ status: 200, description: '시스템 메트릭' })
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryStats = this.memoryMonitor.getMemoryStats();
    const businessStats = await this.businessMetrics.getMetricsSummary();

    return {
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: memoryStats.heapUsed,
        heapTotal: memoryStats.heapTotal,
        rss: memoryStats.rss,
        percentUsed: memoryStats.percentUsed,
      },
      system: {
        platform: os.platform(),
        uptime: process.uptime(),
        loadAverage: os.loadavg(),
        cpuCount: os.cpus().length,
      },
      business: {
        dailyActiveUsers: businessStats.dailyActiveUsers,
        cachedMetrics: businessStats.cachedMetrics,
      },
    };
  }

  @Get('business')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '비즈니스 메트릭 조회' })
  @ApiResponse({ status: 200, description: '비즈니스 메트릭' })
  async getBusinessMetrics() {
    return await this.businessMetrics.getMetricsSummary();
  }

  @Get('sli')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'SLI 지표 조회' })
  @ApiResponse({ status: 200, description: 'SLI 지표' })
  async getSLIMetrics() {
    // SLI는 CloudWatch에서 계산되므로 여기서는 현재 상태만 반환
    return {
      timestamp: new Date().toISOString(),
      sli: {
        availability: {
          description: 'API 가용성 (5분)',
          target: 99.9,
          unit: 'percent',
        },
        latency: {
          description: 'API 응답 시간 P99',
          target: 1000,
          unit: 'milliseconds',
        },
        errorRate: {
          description: '5xx 에러율 (5분)',
          target: 0.1,
          unit: 'percent',
        },
      },
      note: 'Actual values are calculated in CloudWatch dashboard',
    };
  }

  @Get('cold-start')
  @ApiOperation({ summary: 'Lambda Cold Start 메트릭 기록' })
  @ApiResponse({ status: 200, description: 'Cold start 기록 완료' })
  async recordColdStart() {
    // Lambda 초기화 시 호출되는 엔드포인트
    const isColdStart = !global.isWarmStart;
    await this.businessMetrics.recordLambdaColdStart(isColdStart);

    // 웜 스타트 플래그 설정
    global.isWarmStart = true;

    return {
      recorded: true,
      isColdStart,
      timestamp: new Date().toISOString(),
    };
  }
}
