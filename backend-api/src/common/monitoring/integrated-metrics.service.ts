import { Injectable, Logger } from '@nestjs/common';
import { CloudWatchMetricsService } from './cloudwatch-metrics.service';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';

export interface MetricDimensions {
  [key: string]: string;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestRate: number;
  errorRate: number;
  avgResponseTime: number;
}

@Injectable()
export class IntegratedMetricsService {
  private readonly logger = new Logger(IntegratedMetricsService.name);
  private readonly environment: string;
  private readonly namespace: string;
  private requestCount = 0;
  private errorCount = 0;
  private totalResponseTime = 0;
  private lastResetTime = Date.now();

  constructor(
    private readonly cloudWatchMetrics: CloudWatchMetricsService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.get<string>('NODE_ENV', 'dev');
    this.namespace = `VanillaMeta/${this.environment}`;

    // 주기적으로 시스템 메트릭 수집
    this.startMetricsCollection();
  }

  /**
   * API 요청 메트릭 기록
   */
  async recordApiRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
  ): Promise<void> {
    this.requestCount++;
    this.totalResponseTime += responseTime;

    const dimensions: MetricDimensions = {
      Method: method,
      Path: this.sanitizePath(path),
      StatusCodeGroup: this.getStatusCodeGroup(statusCode),
    };

    if (userId) {
      dimensions.HasUser = 'true';
    }

    // 요청 수 메트릭
    await this.cloudWatchMetrics.putMetric(
      this.namespace,
      'ApiRequestCount',
      1,
      'Count',
      dimensions,
    );

    // 응답 시간 메트릭
    await this.cloudWatchMetrics.putMetric(
      this.namespace,
      'ApiResponseTime',
      responseTime,
      'Milliseconds',
      dimensions,
    );

    // 에러 추적
    if (statusCode >= 400) {
      this.errorCount++;
      await this.recordError(statusCode, path, method);
    }

    // 느린 응답 추적
    if (responseTime > 5000) {
      // 5초 이상
      await this.recordSlowResponse(path, method, responseTime);
    }
  }

  /**
   * 데이터베이스 연결 풀 메트릭 기록
   */
  async recordConnectionPoolMetrics(
    poolSize: number,
    activeConnections: number,
    idleConnections: number,
    waitingRequests: number,
  ): Promise<void> {
    const utilization = poolSize > 0 ? (activeConnections / poolSize) * 100 : 0;

    await Promise.all([
      this.cloudWatchMetrics.putMetric(
        `${this.namespace}/Database`,
        'ConnectionPoolSize',
        poolSize,
        'Count',
      ),
      this.cloudWatchMetrics.putMetric(
        `${this.namespace}/Database`,
        'ActiveConnections',
        activeConnections,
        'Count',
      ),
      this.cloudWatchMetrics.putMetric(
        `${this.namespace}/Database`,
        'IdleConnections',
        idleConnections,
        'Count',
      ),
      this.cloudWatchMetrics.putMetric(
        `${this.namespace}/Database`,
        'ConnectionPoolUtilization',
        utilization,
        'Percent',
      ),
      this.cloudWatchMetrics.putMetric(
        `${this.namespace}/Database`,
        'WaitingRequests',
        waitingRequests,
        'Count',
      ),
    ]);

    // 연결 풀이 포화 상태인 경우 경고
    if (utilization > 80) {
      this.logger.warn('Connection pool utilization is high', {
        utilization,
        activeConnections,
        poolSize,
      });
    }
  }

  /**
   * Lambda 함수 메트릭 기록
   */
  async recordLambdaMetrics(
    coldStart: boolean,
    memoryUsed: number,
    duration: number,
  ): Promise<void> {
    const dimensions: MetricDimensions = {
      ColdStart: coldStart ? 'true' : 'false',
    };

    await Promise.all([
      this.cloudWatchMetrics.putMetric(
        this.namespace,
        'LambdaMemoryUsed',
        memoryUsed,
        'Megabytes',
        dimensions,
      ),
      this.cloudWatchMetrics.putMetric(
        this.namespace,
        'LambdaDuration',
        duration,
        'Milliseconds',
        dimensions,
      ),
    ]);

    if (coldStart) {
      await this.cloudWatchMetrics.putMetric(this.namespace, 'ColdStartCount', 1, 'Count');
    }
  }

  /**
   * 비즈니스 메트릭 기록
   */
  async recordBusinessMetric(
    metricName: string,
    value: number,
    unit: 'Count' | 'None' | 'Milliseconds' | 'Bytes' | 'Percent' = 'Count',
    dimensions?: MetricDimensions,
  ): Promise<void> {
    await this.cloudWatchMetrics.putMetric(
      `${this.namespace}/Business`,
      metricName,
      value,
      unit as any,
      dimensions,
    );
  }

  /**
   * 에러 기록
   */
  private async recordError(statusCode: number, path: string, method: string): Promise<void> {
    const errorType = statusCode >= 500 ? 'ServerError' : 'ClientError';

    await this.cloudWatchMetrics.putMetric(this.namespace, 'ErrorCount', 1, 'Count', {
      ErrorType: errorType,
      StatusCode: statusCode.toString(),
      Path: this.sanitizePath(path),
      Method: method,
    });

    if (statusCode >= 500) {
      await this.cloudWatchMetrics.putMetric(this.namespace, 'Http5xxErrorCount', 1, 'Count');
    }
  }

  /**
   * 느린 응답 기록
   */
  private async recordSlowResponse(
    path: string,
    method: string,
    responseTime: number,
  ): Promise<void> {
    await this.cloudWatchMetrics.putMetric(this.namespace, 'SlowResponseCount', 1, 'Count', {
      Path: this.sanitizePath(path),
      Method: method,
      ResponseTimeRange: this.getResponseTimeRange(responseTime),
    });
  }

  /**
   * 시스템 메트릭 수집 시작
   */
  private startMetricsCollection(): void {
    // 1분마다 시스템 메트릭 수집
    setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        this.logger.error('Failed to collect system metrics', error);
      }
    }, 60000);

    // 5분마다 요약 메트릭 수집
    setInterval(async () => {
      try {
        await this.collectSummaryMetrics();
      } catch (error) {
        this.logger.error('Failed to collect summary metrics', error);
      }
    }, 300000);
  }

  /**
   * 시스템 메트릭 수집
   */
  private async collectSystemMetrics(): Promise<void> {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUtilization = (usedMemory / totalMemory) * 100;

    await Promise.all([
      this.cloudWatchMetrics.putMetric(
        `${this.namespace}/System`,
        'MemoryUtilization',
        memoryUtilization,
        'Percent',
      ),
      this.cloudWatchMetrics.putMetric(
        `${this.namespace}/System`,
        'HeapUsed',
        memoryUsage.heapUsed / 1024 / 1024,
        'Megabytes',
      ),
      this.cloudWatchMetrics.putMetric(
        `${this.namespace}/System`,
        'ExternalMemory',
        memoryUsage.external / 1024 / 1024,
        'Megabytes',
      ),
    ]);
  }

  /**
   * 요약 메트릭 수집
   */
  private async collectSummaryMetrics(): Promise<void> {
    const currentTime = Date.now();
    const timeDiff = currentTime - this.lastResetTime;

    if (timeDiff > 0) {
      const requestRate = (this.requestCount / timeDiff) * 1000 * 60; // requests per minute
      const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
      const avgResponseTime =
        this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0;

      await Promise.all([
        this.cloudWatchMetrics.putMetric(
          `${this.namespace}/Summary`,
          'RequestRate',
          requestRate,
          'Count',
        ),
        this.cloudWatchMetrics.putMetric(
          `${this.namespace}/Summary`,
          'ErrorRate',
          errorRate,
          'Percent',
        ),
        this.cloudWatchMetrics.putMetric(
          `${this.namespace}/Summary`,
          'AverageResponseTime',
          avgResponseTime,
          'Milliseconds',
        ),
      ]);

      // 카운터 리셋
      this.requestCount = 0;
      this.errorCount = 0;
      this.totalResponseTime = 0;
      this.lastResetTime = currentTime;
    }
  }

  /**
   * 경로 정규화
   */
  private sanitizePath(path: string): string {
    // ID나 UUID 같은 동적 세그먼트를 일반화
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*$/, ''); // 쿼리 파라미터 제거
  }

  /**
   * 상태 코드 그룹화
   */
  private getStatusCodeGroup(statusCode: number): string {
    if (statusCode < 300) return '2XX';
    if (statusCode < 400) return '3XX';
    if (statusCode < 500) return '4XX';
    return '5XX';
  }

  /**
   * 응답 시간 범위 구하기
   */
  private getResponseTimeRange(responseTime: number): string {
    if (responseTime < 1000) return '<1s';
    if (responseTime < 5000) return '1-5s';
    if (responseTime < 10000) return '5-10s';
    if (responseTime < 30000) return '10-30s';
    return '>30s';
  }

  /**
   * 현재 시스템 메트릭 가져오기
   */
  async getCurrentMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      cpuUsage: os.loadavg()[0] * 100, // 1분 평균 CPU 로드
      memoryUsage: (usedMemory / totalMemory) * 100,
      activeConnections: 0, // 실제 연결 수는 다른 서비스에서 가져와야 함
      requestRate: this.requestCount,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      avgResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
    };
  }
}
