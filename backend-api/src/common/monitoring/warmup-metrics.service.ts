import { Injectable, Logger } from '@nestjs/common';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';
import { ConfigService } from '@nestjs/config';

export interface WarmupMetrics {
  totalWarmupRequests: number;
  successfulWarmups: number;
  failedWarmups: number;
  averageWarmupDuration: number;
  coldStartCount: number;
  warmStartCount: number;
}

@Injectable()
export class WarmupMetricsService {
  private readonly logger = new Logger(WarmupMetricsService.name);
  private readonly enabled: boolean;
  private readonly namespace: string;

  constructor(
    private readonly cloudWatchMetrics: CloudWatchMetricsService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('WARMUP_METRICS_ENABLED', true);
    this.namespace = this.configService.get<string>('METRICS_NAMESPACE', 'VanillaMeta');
  }

  /**
   * 웜업 요청 성공 기록
   */
  async recordWarmupSuccess(requestId: string, duration?: number): Promise<void> {
    if (!this.enabled) return;

    await this.cloudWatchMetrics.putMetric(
      this.namespace,
      'WarmupRequestCount',
      1,
      'Count',
      {
        Status: 'Success',
        RequestId: requestId,
      },
    );

    if (duration) {
      await this.cloudWatchMetrics.putMetric(
        this.namespace,
        'WarmupDuration',
        duration,
        'Milliseconds',
        {
          RequestId: requestId,
        },
      );
    }

    this.logger.debug('웜업 성공 메트릭 기록됨', {
      requestId,
      duration,
    });
  }

  /**
   * 웜업 요청 실패 기록
   */
  async recordWarmupFailure(requestId: string, error: string): Promise<void> {
    if (!this.enabled) return;

    await this.cloudWatchMetrics.putMetric(
      this.namespace,
      'WarmupRequestCount',
      1,
      'Count',
      {
        Status: 'Failure',
        RequestId: requestId,
      },
    );

    await this.cloudWatchMetrics.putMetric(
      this.namespace,
      'WarmupFailureCount',
      1,
      'Count',
      {
        RequestId: requestId,
        ErrorType: error,
      },
    );

    this.logger.warn('웜업 실패 메트릭 기록됨', {
      requestId,
      error,
    });
  }

  /**
   * 콜드 스타트 기록
   */
  async recordColdStart(functionName: string, initDuration?: number): Promise<void> {
    if (!this.enabled) return;

    await this.cloudWatchMetrics.putMetric(
      this.namespace,
      'ColdStartCount',
      1,
      'Count',
      {
        FunctionName: functionName,
      },
    );

    if (initDuration) {
      await this.cloudWatchMetrics.putMetric(
        this.namespace,
        'InitDuration',
        initDuration,
        'Milliseconds',
        {
          FunctionName: functionName,
        },
      );
    }

    this.logger.debug('콜드 스타트 메트릭 기록됨', {
      functionName,
      initDuration,
    });
  }

  /**
   * 웜 스타트 기록
   */
  async recordWarmStart(functionName: string, responseTime?: number): Promise<void> {
    if (!this.enabled) return;

    await this.cloudWatchMetrics.putMetric(
      this.namespace,
      'WarmStartCount',
      1,
      'Count',
      {
        FunctionName: functionName,
      },
    );

    if (responseTime) {
      await this.cloudWatchMetrics.putMetric(
        this.namespace,
        'WarmStartResponseTime',
        responseTime,
        'Milliseconds',
        {
          FunctionName: functionName,
        },
      );
    }

    this.logger.debug('웜 스타트 메트릭 기록됨', {
      functionName,
      responseTime,
    });
  }

  /**
   * Lambda 메모리 사용량 기록
   */
  async recordMemoryUsage(
    functionName: string,
    memoryUsed: number,
    memoryLimit: number,
  ): Promise<void> {
    if (!this.enabled) return;

    const utilizationPercent = (memoryUsed / memoryLimit) * 100;

    await this.cloudWatchMetrics.putMetric(
      this.namespace,
      'MemoryUtilization',
      utilizationPercent,
      'Percent',
      {
        FunctionName: functionName,
      },
    );

    await this.cloudWatchMetrics.putMetric(
      this.namespace,
      'MemoryUsed',
      memoryUsed,
      'Megabytes',
      {
        FunctionName: functionName,
      },
    );

    this.logger.debug('메모리 사용량 메트릭 기록됨', {
      functionName,
      memoryUsed,
      memoryLimit,
      utilizationPercent,
    });
  }

  /**
   * 웜업 효율성 계산 및 기록
   */
  async calculateWarmupEfficiency(period = 3600): Promise<WarmupMetrics> {
    if (!this.enabled) {
      return {
        totalWarmupRequests: 0,
        successfulWarmups: 0,
        failedWarmups: 0,
        averageWarmupDuration: 0,
        coldStartCount: 0,
        warmStartCount: 0,
      };
    }

    try {
      const [
        warmupRequests,
        warmupFailures,
        coldStarts,
        warmStarts,
        warmupDurations,
      ] = await Promise.all([
        this.cloudWatchMetrics.getMetricStatistics(
          this.namespace,
          'WarmupRequestCount',
          period,
          ['Sum'],
        ),
        this.cloudWatchMetrics.getMetricStatistics(
          this.namespace,
          'WarmupFailureCount',
          period,
          ['Sum'],
        ),
        this.cloudWatchMetrics.getMetricStatistics(
          this.namespace,
          'ColdStartCount',
          period,
          ['Sum'],
        ),
        this.cloudWatchMetrics.getMetricStatistics(
          this.namespace,
          'WarmStartCount',
          period,
          ['Sum'],
        ),
        this.cloudWatchMetrics.getMetricStatistics(
          this.namespace,
          'WarmupDuration',
          period,
          ['Average'],
        ),
      ]);

      const totalWarmupRequests = warmupRequests.reduce((sum, dp) => sum + dp.value, 0);
      const failedWarmups = warmupFailures.reduce((sum, dp) => sum + dp.value, 0);
      const coldStartCount = coldStarts.reduce((sum, dp) => sum + dp.value, 0);
      const warmStartCount = warmStarts.reduce((sum, dp) => sum + dp.value, 0);
      const averageWarmupDuration = warmupDurations.length > 0 
        ? warmupDurations.reduce((sum, dp) => sum + dp.value, 0) / warmupDurations.length
        : 0;

      const metrics: WarmupMetrics = {
        totalWarmupRequests,
        successfulWarmups: totalWarmupRequests - failedWarmups,
        failedWarmups,
        averageWarmupDuration,
        coldStartCount,
        warmStartCount,
      };

      // 효율성 메트릭 발행
      const warmupSuccessRate = totalWarmupRequests > 0 
        ? ((totalWarmupRequests - failedWarmups) / totalWarmupRequests) * 100 
        : 100;

      const coldStartReductionRate = (coldStartCount + warmStartCount) > 0 
        ? (warmStartCount / (coldStartCount + warmStartCount)) * 100 
        : 0;

      await this.cloudWatchMetrics.putMetric(
        this.namespace,
        'WarmupSuccessRate',
        warmupSuccessRate,
        'Percent',
      );

      await this.cloudWatchMetrics.putMetric(
        this.namespace,
        'ColdStartReductionRate',
        coldStartReductionRate,
        'Percent',
      );

      this.logger.debug('웜업 효율성 계산 완료', {
        metrics,
        warmupSuccessRate,
        coldStartReductionRate,
      });

      return metrics;
    } catch (error) {
      this.logger.error('웜업 효율성 계산 실패', error);
      return {
        totalWarmupRequests: 0,
        successfulWarmups: 0,
        failedWarmups: 0,
        averageWarmupDuration: 0,
        coldStartCount: 0,
        warmStartCount: 0,
      };
    }
  }

  /**
   * 웜업 비용 계산
   */
  async calculateWarmupCost(period = 86400): Promise<number> {
    if (!this.enabled) return 0;

    try {
      const warmupRequests = await this.cloudWatchMetrics.getMetricStatistics(
        this.namespace,
        'WarmupRequestCount',
        period,
        ['Sum'],
      );

      const totalRequests = warmupRequests.reduce((sum, dp) => sum + dp.value, 0);
      
      // AWS Lambda 요금 계산 (2025년 기준 ap-northeast-2)
      const requestCost = totalRequests * 0.0000002; // $0.20 per 1M requests
      const computeCost = totalRequests * 0.1 * 0.0000000083; // 100ms × $0.0000000083 per 100ms-GB
      const totalCost = requestCost + computeCost;

      await this.cloudWatchMetrics.putMetric(
        this.namespace,
        'WarmupCostUSD',
        totalCost,
        'None',
      );

      this.logger.debug('웜업 비용 계산 완료', {
        totalRequests,
        requestCost,
        computeCost,
        totalCost,
      });

      return totalCost;
    } catch (error) {
      this.logger.error('웜업 비용 계산 실패', error);
      return 0;
    }
  }

  /**
   * 웜업 스케줄 최적화 제안
   */
  async suggestOptimalWarmupSchedule(): Promise<{
    currentInterval: number;
    suggestedInterval: number;
    reason: string;
  }> {
    try {
      const coldStartMetrics = await this.cloudWatchMetrics.getMetricStatistics(
        this.namespace,
        'ColdStartCount',
        3600, // 1시간
        ['Sum'],
      );

      const avgColdStarts = coldStartMetrics.length > 0 
        ? coldStartMetrics.reduce((sum, dp) => sum + dp.value, 0) / coldStartMetrics.length
        : 0;

      let suggestedInterval = 5; // 기본 5분
      let reason = '기본 권장 설정';

      if (avgColdStarts > 10) {
        suggestedInterval = 3; // 3분으로 단축
        reason = '높은 콜드 스타트 빈도로 인해 더 자주 웜업 필요';
      } else if (avgColdStarts < 2) {
        suggestedInterval = 10; // 10분으로 연장
        reason = '낮은 콜드 스타트 빈도로 웜업 간격 연장 가능';
      }

      const result = {
        currentInterval: 5, // 현재 설정값
        suggestedInterval,
        reason,
      };

      await this.cloudWatchMetrics.putMetric(
        this.namespace,
        'OptimalWarmupInterval',
        suggestedInterval,
        'Minutes',
      );

      this.logger.debug('웜업 스케줄 최적화 제안', result);

      return result;
    } catch (error) {
      this.logger.error('웜업 스케줄 최적화 실패', error);
      return {
        currentInterval: 5,
        suggestedInterval: 5,
        reason: '분석 실패로 기본값 유지',
      };
    }
  }
}