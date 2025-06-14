import { Injectable, Logger } from '@nestjs/common';
import { CloudWatch } from 'aws-sdk';
import { MetricDatum, PutMetricDataInput } from 'aws-sdk/clients/cloudwatch';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as v8 from 'v8';
import * as os from 'os';

@Injectable()
export class CloudWatchMetricsService {
  private readonly logger = new Logger(CloudWatchMetricsService.name);
  private readonly cloudWatch: CloudWatch;
  private readonly namespace: string;
  private readonly environment: string;
  private metricBuffer: MetricDatum[] = [];
  private readonly MAX_BUFFER_SIZE = 20; // CloudWatch supports max 20 metrics per request

  constructor(private readonly configService: ConfigService) {
    this.environment = this.configService.get('NODE_ENV') || 'dev';
    this.namespace = `VanillaMeta/${this.environment}`;
    
    // CloudWatch 클라이언트 초기화
    this.cloudWatch = new CloudWatch({
      region: this.configService.get('AWS_REGION') || 'ap-northeast-2',
    });

    this.logger.log(`CloudWatch Metrics Service initialized for namespace: ${this.namespace}`);
  }

  /**
   * 커스텀 메트릭 전송
   */
  async putMetric(
    metricName: string,
    value: number,
    unit: 'Count' | 'Bytes' | 'Seconds' | 'Percent' | 'None' = 'None',
    dimensions?: Array<{ Name: string; Value: string }>,
  ): Promise<void> {
    const metric: MetricDatum = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: dimensions || [],
    };

    // 버퍼에 추가
    this.metricBuffer.push(metric);

    // 버퍼가 가득 차면 즉시 전송
    if (this.metricBuffer.length >= this.MAX_BUFFER_SIZE) {
      await this.flushMetrics();
    }
  }

  /**
   * 통계 메트릭 전송 (평균, 최소, 최대 등)
   */
  async putStatisticMetric(
    metricName: string,
    values: number[],
    unit: 'Count' | 'Bytes' | 'Seconds' | 'Percent' | 'None' = 'None',
    dimensions?: Array<{ Name: string; Value: string }>,
  ): Promise<void> {
    if (values.length === 0) return;

    const metric: MetricDatum = {
      MetricName: metricName,
      StatisticValues: {
        SampleCount: values.length,
        Sum: values.reduce((a, b) => a + b, 0),
        Minimum: Math.min(...values),
        Maximum: Math.max(...values),
      },
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: dimensions || [],
    };

    this.metricBuffer.push(metric);

    if (this.metricBuffer.length >= this.MAX_BUFFER_SIZE) {
      await this.flushMetrics();
    }
  }

  /**
   * 버퍼의 메트릭을 CloudWatch로 전송
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricBuffer.length === 0) return;

    const params: PutMetricDataInput = {
      Namespace: this.namespace,
      MetricData: [...this.metricBuffer],
    };

    try {
      await this.cloudWatch.putMetricData(params).promise();
      this.logger.debug(`Sent ${this.metricBuffer.length} metrics to CloudWatch`);
      this.metricBuffer = [];
    } catch (error) {
      this.logger.error('Failed to send metrics to CloudWatch:', error);
      // 실패한 메트릭은 버리고 계속 진행
      this.metricBuffer = [];
    }
  }

  /**
   * 메모리 사용량 메트릭 수집 및 전송
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectMemoryMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const heapStats = v8.getHeapStatistics();
      const maxMemory = 3 * 1024 * 1024 * 1024; // Lambda 3GB

      // 메모리 사용률
      const memoryUsedPercent = (memUsage.rss / maxMemory) * 100;
      await this.putMetric('MemoryUsedPercent', memoryUsedPercent, 'Percent', [
        { Name: 'Function', Value: 'backend-api' },
      ]);

      // 힙 사용량
      await this.putMetric('HeapUsedMB', memUsage.heapUsed / (1024 * 1024), 'None', [
        { Name: 'Function', Value: 'backend-api' },
      ]);

      // RSS 메모리
      await this.putMetric('RSSMemoryMB', memUsage.rss / (1024 * 1024), 'None', [
        { Name: 'Function', Value: 'backend-api' },
      ]);

      // 힙 사용률
      const heapUsedPercent = (heapStats.used_heap_size / heapStats.heap_size_limit) * 100;
      await this.putMetric('HeapUsedPercent', heapUsedPercent, 'Percent', [
        { Name: 'Function', Value: 'backend-api' },
      ]);

      // 메트릭 전송
      await this.flushMetrics();
    } catch (error) {
      this.logger.error('Failed to collect memory metrics:', error);
    }
  }

  /**
   * API 응답 시간 메트릭
   */
  async recordApiResponseTime(
    path: string,
    method: string,
    responseTime: number,
    statusCode: number,
  ): Promise<void> {
    // 응답 시간 메트릭
    await this.putMetric('ApiResponseTime', responseTime, 'Seconds', [
      { Name: 'Path', Value: path },
      { Name: 'Method', Value: method },
      { Name: 'StatusCode', Value: statusCode.toString() },
    ]);

    // 느린 요청 카운트 (1초 이상)
    if (responseTime > 1000) {
      await this.putMetric('SlowApiRequests', 1, 'Count', [
        { Name: 'Path', Value: path },
        { Name: 'Method', Value: method },
      ]);
    }

    // 에러 카운트
    if (statusCode >= 500) {
      await this.putMetric('ApiServerErrors', 1, 'Count', [
        { Name: 'Path', Value: path },
        { Name: 'Method', Value: method },
      ]);
    } else if (statusCode >= 400) {
      await this.putMetric('ApiClientErrors', 1, 'Count', [
        { Name: 'Path', Value: path },
        { Name: 'Method', Value: method },
      ]);
    }
  }

  /**
   * 쿼리 캐시 메트릭
   */
  async recordCacheMetrics(hitRate: number, l1HitRate: number, l2HitRate: number): Promise<void> {
    await this.putMetric('CacheHitRate', hitRate, 'Percent', [
      { Name: 'CacheType', Value: 'QueryCache' },
    ]);

    await this.putMetric('L1HitRate', l1HitRate, 'Percent', [
      { Name: 'CacheType', Value: 'QueryCache' },
    ]);

    await this.putMetric('L2HitRate', l2HitRate, 'Percent', [
      { Name: 'CacheType', Value: 'QueryCache' },
    ]);
  }

  /**
   * 백그라운드 작업 메트릭
   */
  async recordBackgroundJobMetrics(
    jobType: string,
    status: 'queued' | 'processed' | 'failed',
  ): Promise<void> {
    const metricName = 
      status === 'queued' ? 'JobsQueued' :
      status === 'processed' ? 'JobsProcessed' : 'JobsFailed';

    await this.putMetric(metricName, 1, 'Count', [
      { Name: 'JobType', Value: jobType },
    ]);
  }

  /**
   * 데이터베이스 연결 풀 메트릭
   */
  async recordConnectionPoolMetrics(
    databaseId: string,
    activeConnections: number,
    idleConnections: number,
    waitingRequests: number,
  ): Promise<void> {
    await this.putMetric('DBActiveConnections', activeConnections, 'Count', [
      { Name: 'DatabaseId', Value: databaseId },
    ]);

    await this.putMetric('DBIdleConnections', idleConnections, 'Count', [
      { Name: 'DatabaseId', Value: databaseId },
    ]);

    await this.putMetric('DBWaitingRequests', waitingRequests, 'Count', [
      { Name: 'DatabaseId', Value: databaseId },
    ]);

    const totalConnections = activeConnections + idleConnections;
    const utilizationPercent = totalConnections > 0 ? (activeConnections / totalConnections) * 100 : 0;
    
    await this.putMetric('DBConnectionUtilization', utilizationPercent, 'Percent', [
      { Name: 'DatabaseId', Value: databaseId },
    ]);
  }

  /**
   * 스트리밍 쿼리 메트릭
   */
  async recordStreamingQueryMetrics(
    databaseId: string,
    rowsProcessed: number,
    duration: number,
    success: boolean,
  ): Promise<void> {
    await this.putMetric('StreamingQueryRows', rowsProcessed, 'Count', [
      { Name: 'DatabaseId', Value: databaseId },
      { Name: 'Success', Value: success.toString() },
    ]);

    await this.putMetric('StreamingQueryDuration', duration / 1000, 'Seconds', [
      { Name: 'DatabaseId', Value: databaseId },
      { Name: 'Success', Value: success.toString() },
    ]);

    if (!success) {
      await this.putMetric('StreamingQueryErrors', 1, 'Count', [
        { Name: 'DatabaseId', Value: databaseId },
      ]);
    }
  }

  /**
   * 사용자 활동 메트릭
   */
  async recordUserActivity(
    userId: string,
    action: string,
    resourceType: string,
  ): Promise<void> {
    await this.putMetric('UserActivity', 1, 'Count', [
      { Name: 'Action', Value: action },
      { Name: 'ResourceType', Value: resourceType },
    ]);

    // 고유 활성 사용자 추적 (HyperLogLog 등 확률적 자료구조 대신 간단히 카운트)
    await this.putMetric('ActiveUsers', 1, 'Count', [
      { Name: 'UserId', Value: userId },
    ]);
  }

  /**
   * 시스템 리소스 메트릭
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async collectSystemMetrics(): Promise<void> {
    try {
      // CPU 사용률 (Lambda에서는 제한적)
      const cpus = os.cpus();
      const cpuUsage = cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length;

      await this.putMetric('SystemCPUPercent', cpuUsage, 'Percent', [
        { Name: 'Function', Value: 'backend-api' },
      ]);

      // 파일 디스크립터 (열린 파일 수)
      const openHandles = (process as any)._getActiveHandles().length;
      const openRequests = (process as any)._getActiveRequests().length;
      
      await this.putMetric('OpenHandles', openHandles, 'Count', [
        { Name: 'Function', Value: 'backend-api' },
      ]);

      await this.putMetric('OpenRequests', openRequests, 'Count', [
        { Name: 'Function', Value: 'backend-api' },
      ]);

      await this.flushMetrics();
    } catch (error) {
      this.logger.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * 애플리케이션 종료 시 남은 메트릭 전송
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.flushMetrics();
      this.logger.log('Flushed remaining metrics before shutdown');
    } catch (error) {
      this.logger.error('Failed to flush metrics on shutdown:', error);
    }
  }
}