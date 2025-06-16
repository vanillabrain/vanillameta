import { Injectable, Logger } from '@nestjs/common';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';
import { ConfigService } from '@nestjs/config';

export interface BusinessMetric {
  name: string;
  value: number;
  unit: 'Count' | 'Milliseconds' | 'Percent' | 'Bytes' | 'None';
  dimensions?: Record<string, string>;
}

@Injectable()
export class BusinessMetricsService {
  private readonly logger = new Logger(BusinessMetricsService.name);
  private readonly enabled: boolean;
  private readonly namespace: string;

  constructor(
    private readonly cloudWatchMetrics: CloudWatchMetricsService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('BUSINESS_METRICS_ENABLED', true);
    this.namespace = this.configService.get<string>('METRICS_NAMESPACE', 'VanillaMeta/Business');
  }

  /**
   * 대시보드 로딩 시간 기록
   */
  async recordDashboardLoadTime(
    dashboardId: string,
    loadTime: number,
    userId?: string,
  ): Promise<void> {
    if (!this.enabled) return;

    const metric: BusinessMetric = {
      name: 'DASHBOARD_LOAD_TIME',
      value: loadTime,
      unit: 'Milliseconds',
      dimensions: {
        DashboardId: dashboardId,
        ...(userId && { UserId: userId }),
      },
    };

    await this.publishMetric(metric);

    // P90 계산을 위한 백분위 메트릭
    await this.publishPercentileMetric('DASHBOARD_LOAD_TIME', loadTime);
  }

  /**
   * 위젯 렌더링 시간 기록
   */
  async recordWidgetRenderTime(
    widgetId: string,
    widgetType: string,
    renderTime: number,
  ): Promise<void> {
    if (!this.enabled) return;

    const metric: BusinessMetric = {
      name: 'WIDGET_RENDER_TIME',
      value: renderTime,
      unit: 'Milliseconds',
      dimensions: {
        WidgetId: widgetId,
        WidgetType: widgetType,
      },
    };

    await this.publishMetric(metric);
    await this.publishPercentileMetric('WIDGET_RENDER_TIME', renderTime);
  }

  /**
   * 쿼리 캐시 적중률 기록
   */
  async recordQueryCacheMetrics(hit: boolean, queryType: string): Promise<void> {
    if (!this.enabled) return;

    // 캐시 히트/미스 카운트
    const metric: BusinessMetric = {
      name: hit ? 'QUERY_CACHE_HIT' : 'QUERY_CACHE_MISS',
      value: 1,
      unit: 'Count',
      dimensions: {
        QueryType: queryType,
      },
    };

    await this.publishMetric(metric);
  }

  /**
   * 데이터 새로고침 결과 기록
   */
  async recordDataRefreshResult(
    success: boolean,
    datasetId: string,
    duration?: number,
  ): Promise<void> {
    if (!this.enabled) return;

    const metric: BusinessMetric = {
      name: success ? 'DATA_REFRESH_SUCCESS' : 'DATA_REFRESH_FAILURE',
      value: 1,
      unit: 'Count',
      dimensions: {
        DatasetId: datasetId,
      },
    };

    await this.publishMetric(metric);

    if (duration) {
      await this.publishMetric({
        name: 'DATA_REFRESH_DURATION',
        value: duration,
        unit: 'Milliseconds',
        dimensions: {
          DatasetId: datasetId,
        },
      });
    }
  }

  /**
   * 동시 접속 사용자 수 기록
   */
  async recordConcurrentUsers(count: number): Promise<void> {
    if (!this.enabled) return;

    const metric: BusinessMetric = {
      name: 'CONCURRENT_USERS',
      value: count,
      unit: 'Count',
    };

    await this.publishMetric(metric);
  }

  /**
   * API 엔드포인트별 사용량 기록
   */
  async recordApiUsage(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
  ): Promise<void> {
    if (!this.enabled) return;

    // API 호출 수
    await this.publishMetric({
      name: 'API_REQUEST_COUNT',
      value: 1,
      unit: 'Count',
      dimensions: {
        Endpoint: endpoint,
        Method: method,
        StatusCode: statusCode.toString(),
      },
    });

    // 응답 시간
    await this.publishMetric({
      name: 'API_RESPONSE_TIME',
      value: responseTime,
      unit: 'Milliseconds',
      dimensions: {
        Endpoint: endpoint,
        Method: method,
      },
    });

    // 에러율 계산을 위한 메트릭
    if (statusCode >= 500) {
      await this.publishMetric({
        name: 'API_ERROR_5XX',
        value: 1,
        unit: 'Count',
        dimensions: {
          Endpoint: endpoint,
          Method: method,
        },
      });
    } else if (statusCode >= 400) {
      await this.publishMetric({
        name: 'API_ERROR_4XX',
        value: 1,
        unit: 'Count',
        dimensions: {
          Endpoint: endpoint,
          Method: method,
        },
      });
    }
  }

  /**
   * 쿼리 실행 메트릭 기록
   */
  async recordQueryExecution(
    queryType: string,
    executionTime: number,
    success: boolean,
    databaseType?: string,
  ): Promise<void> {
    if (!this.enabled) return;

    const baseMetric = {
      dimensions: {
        QueryType: queryType,
        ...(databaseType && { DatabaseType: databaseType }),
      },
    };

    // 쿼리 실행 시간
    await this.publishMetric({
      ...baseMetric,
      name: 'QUERY_EXECUTION_TIME',
      value: executionTime,
      unit: 'Milliseconds',
    });

    // 쿼리 성공/실패
    await this.publishMetric({
      ...baseMetric,
      name: success ? 'QUERY_SUCCESS' : 'QUERY_ERROR',
      value: 1,
      unit: 'Count',
    });

    await this.publishPercentileMetric('QUERY_EXECUTION_TIME', executionTime);
  }

  /**
   * Lambda 콜드스타트 메트릭 기록
   */
  async recordLambdaColdStart(duration: number): Promise<void> {
    if (!this.enabled) return;

    const metric: BusinessMetric = {
      name: 'LAMBDA_COLD_START_DURATION',
      value: duration,
      unit: 'Milliseconds',
    };

    await this.publishMetric(metric);
  }

  /**
   * 메모리 사용률 기록
   */
  async recordMemoryUsage(used: number, total: number): Promise<void> {
    if (!this.enabled) return;

    const utilizationPercent = (used / total) * 100;

    await this.publishMetric({
      name: 'LAMBDA_MEMORY_UTILIZATION',
      value: utilizationPercent,
      unit: 'Percent',
    });

    await this.publishMetric({
      name: 'LAMBDA_MEMORY_USED',
      value: used,
      unit: 'Bytes',
    });
  }

  /**
   * 백분위 메트릭 발행 (P50, P90, P99 계산용)
   */
  private async publishPercentileMetric(metricName: string, value: number): Promise<void> {
    // CloudWatch의 백분위 계산을 위해 각 값을 개별적으로 발행
    await this.cloudWatchMetrics.putMetric(
      this.namespace,
      `${metricName}_VALUES`,
      value,
      'Milliseconds',
    );
  }

  /**
   * 메트릭 발행
   */
  private async publishMetric(metric: BusinessMetric): Promise<void> {
    try {
      await this.cloudWatchMetrics.putMetric(
        this.namespace,
        metric.name,
        metric.value,
        metric.unit,
        metric.dimensions,
      );

      this.logger.debug('Business metric published', {
        metric: metric.name,
        value: metric.value,
        dimensions: metric.dimensions,
      });
    } catch (error) {
      this.logger.error('Failed to publish business metric', {
        metric: metric.name,
        error: error.message,
      });
    }
  }

  /**
   * 캐시 적중률 계산 및 발행
   */
  async calculateAndPublishCacheHitRate(period: number = 300): Promise<void> {
    if (!this.enabled) return;

    try {
      // CloudWatch에서 메트릭 가져오기 (실제 구현 시 CloudWatch GetMetricStatistics 사용)
      // 여기서는 예시로 직접 계산
      const hitRate = await this.cloudWatchMetrics.getMetricStatistics(
        this.namespace,
        'QUERY_CACHE_HIT_RATE',
        period,
      );

      this.logger.debug('Cache hit rate calculated', { hitRate });
    } catch (error) {
      this.logger.error('Failed to calculate cache hit rate', error);
    }
  }
}