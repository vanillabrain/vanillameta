import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CloudWatchClient,
  PutMetricDataCommand,
  PutMetricDataCommandInput,
  MetricDatum,
  StandardUnit,
  Dimension,
} from '@aws-sdk/client-cloudwatch';
import { PerformanceAlert, PerformanceStats } from './performance-metrics.service';

/**
 * CloudWatch 통합 서비스
 * 
 * 성능 메트릭을 AWS CloudWatch로 전송하고 대시보드 및 알람을 관리합니다.
 */
@Injectable()
export class CloudWatchIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(CloudWatchIntegrationService.name);
  private cloudWatchClient: CloudWatchClient;
  private readonly namespace = 'VanillaMeta/API';
  private metricsBuffer: MetricDatum[] = [];
  private readonly BUFFER_SIZE = 20; // CloudWatch API 제한
  private readonly FLUSH_INTERVAL = 60000; // 1분
  
  constructor(
    private readonly configService: ConfigService,
  ) {
    this.initializeCloudWatchClient();
  }

  onModuleInit() {
    // 주기적으로 메트릭 버퍼 플러시
    setInterval(() => {
      this.flushMetrics();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * CloudWatch 클라이언트 초기화
   */
  private initializeCloudWatchClient(): void {
    const region = this.configService.get<string>('AWS_REGION', 'ap-northeast-2');
    
    this.cloudWatchClient = new CloudWatchClient({
      region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  /**
   * API 응답 시간 메트릭 전송
   */
  async putResponseTimeMetric(
    endpoint: string,
    responseTime: number,
    statusCode: number,
    method: string,
  ): Promise<void> {
    try {
      const dimensions: Dimension[] = [
        { Name: 'Endpoint', Value: endpoint },
        { Name: 'Method', Value: method },
        { Name: 'StatusCode', Value: statusCode.toString() },
        { Name: 'Environment', Value: this.configService.get<string>('NODE_ENV', 'development') },
      ];

      const metric: MetricDatum = {
        MetricName: 'ResponseTime',
        Value: responseTime,
        Unit: StandardUnit.Milliseconds,
        Timestamp: new Date(),
        Dimensions: dimensions,
      };

      this.addToBuffer(metric);

      // 에러 응답인 경우 에러 카운트도 증가
      if (statusCode >= 400) {
        const errorMetric: MetricDatum = {
          MetricName: 'ErrorCount',
          Value: 1,
          Unit: StandardUnit.Count,
          Timestamp: new Date(),
          Dimensions: dimensions,
        };
        this.addToBuffer(errorMetric);
      }

    } catch (error) {
      this.logger.error('Failed to put response time metric', error);
    }
  }

  /**
   * 활성 요청 수 메트릭 전송
   */
  async putActiveRequestsMetric(count: number): Promise<void> {
    try {
      const metric: MetricDatum = {
        MetricName: 'ActiveRequests',
        Value: count,
        Unit: StandardUnit.Count,
        Timestamp: new Date(),
        Dimensions: [
          { Name: 'Environment', Value: this.configService.get<string>('NODE_ENV', 'development') },
        ],
      };

      this.addToBuffer(metric);

    } catch (error) {
      this.logger.error('Failed to put active requests metric', error);
    }
  }

  /**
   * 메모리 사용량 메트릭 전송
   */
  async putMemoryMetric(heapUsed: number, external: number): Promise<void> {
    try {
      const dimensions: Dimension[] = [
        { Name: 'Environment', Value: this.configService.get<string>('NODE_ENV', 'development') },
      ];

      const heapMetric: MetricDatum = {
        MetricName: 'HeapUsedMemory',
        Value: heapUsed / (1024 * 1024), // MB 단위로 변환
        Unit: StandardUnit.Megabytes,
        Timestamp: new Date(),
        Dimensions: dimensions,
      };

      const externalMetric: MetricDatum = {
        MetricName: 'ExternalMemory',
        Value: external / (1024 * 1024), // MB 단위로 변환
        Unit: StandardUnit.Megabytes,
        Timestamp: new Date(),
        Dimensions: dimensions,
      };

      this.addToBuffer(heapMetric);
      this.addToBuffer(externalMetric);

    } catch (error) {
      this.logger.error('Failed to put memory metric', error);
    }
  }

  /**
   * CPU 사용률 메트릭 전송
   */
  async putCPUMetric(cpuPercentage: number): Promise<void> {
    try {
      const metric: MetricDatum = {
        MetricName: 'CPUUtilization',
        Value: cpuPercentage,
        Unit: StandardUnit.Percent,
        Timestamp: new Date(),
        Dimensions: [
          { Name: 'Environment', Value: this.configService.get<string>('NODE_ENV', 'development') },
        ],
      };

      this.addToBuffer(metric);

    } catch (error) {
      this.logger.error('Failed to put CPU metric', error);
    }
  }

  /**
   * 엔드포인트별 통계 메트릭 전송
   */
  async putEndpointStats(stats: PerformanceStats): Promise<void> {
    try {
      const dimensions: Dimension[] = [
        { Name: 'Endpoint', Value: stats.endpoint },
        { Name: 'Environment', Value: this.configService.get<string>('NODE_ENV', 'development') },
      ];

      const metrics: MetricDatum[] = [
        {
          MetricName: 'AverageResponseTime',
          Value: stats.avgResponseTime,
          Unit: StandardUnit.Milliseconds,
          Timestamp: new Date(),
          Dimensions: dimensions,
        },
        {
          MetricName: 'P95ResponseTime',
          Value: stats.p95ResponseTime,
          Unit: StandardUnit.Milliseconds,
          Timestamp: new Date(),
          Dimensions: dimensions,
        },
        {
          MetricName: 'P99ResponseTime',
          Value: stats.p99ResponseTime,
          Unit: StandardUnit.Milliseconds,
          Timestamp: new Date(),
          Dimensions: dimensions,
        },
        {
          MetricName: 'ErrorRate',
          Value: stats.errorRate * 100, // 백분율로 변환
          Unit: StandardUnit.Percent,
          Timestamp: new Date(),
          Dimensions: dimensions,
        },
        {
          MetricName: 'RequestCount',
          Value: stats.count,
          Unit: StandardUnit.Count,
          Timestamp: new Date(),
          Dimensions: dimensions,
        },
      ];

      metrics.forEach(metric => this.addToBuffer(metric));

    } catch (error) {
      this.logger.error('Failed to put endpoint stats', error);
    }
  }

  /**
   * 성능 알림 이벤트 핸들러
   */
  @OnEvent('performance.alert')
  async handlePerformanceAlert(alert: PerformanceAlert): Promise<void> {
    try {
      // CloudWatch 커스텀 메트릭으로 알림 전송
      const dimensions: Dimension[] = [
        { Name: 'AlertType', Value: alert.type },
        { Name: 'Severity', Value: alert.severity },
        { Name: 'Environment', Value: this.configService.get<string>('NODE_ENV', 'development') },
      ];

      if (alert.endpoint) {
        dimensions.push({ Name: 'Endpoint', Value: alert.endpoint });
      }

      const metric: MetricDatum = {
        MetricName: 'PerformanceAlert',
        Value: 1,
        Unit: StandardUnit.Count,
        Timestamp: new Date(),
        Dimensions: dimensions,
      };

      this.addToBuffer(metric);

      // 즉시 플러시 (중요한 알림)
      if (alert.severity === 'critical') {
        await this.flushMetrics();
      }

    } catch (error) {
      this.logger.error('Failed to handle performance alert', error);
    }
  }

  /**
   * 메트릭을 버퍼에 추가
   */
  private addToBuffer(metric: MetricDatum): void {
    this.metricsBuffer.push(metric);

    // 버퍼가 가득 차면 즉시 플러시
    if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
      this.flushMetrics();
    }
  }

  /**
   * 메트릭 버퍼 플러시
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      const params: PutMetricDataCommandInput = {
        Namespace: this.namespace,
        MetricData: metricsToSend,
      };

      const command = new PutMetricDataCommand(params);
      await this.cloudWatchClient.send(command);

      this.logger.debug(`Flushed ${metricsToSend.length} metrics to CloudWatch`);

    } catch (error) {
      this.logger.error('Failed to flush metrics to CloudWatch', error);
      
      // 실패한 메트릭을 다시 버퍼에 추가 (재시도를 위해)
      // 단, 버퍼 크기 제한을 고려
      const remainingSpace = this.BUFFER_SIZE - this.metricsBuffer.length;
      const metricsToRetry = metricsToSend.slice(0, remainingSpace);
      this.metricsBuffer.push(...metricsToRetry);
    }
  }

  /**
   * 시스템 메트릭 수집 및 전송
   */
  async collectSystemMetrics(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // 메모리 메트릭
      await this.putMemoryMetric(memoryUsage.heapUsed, memoryUsage.external);
      
      // CPU 메트릭 (대략적인 계산)
      const cpuPercentage = (cpuUsage.user + cpuUsage.system) / 1000000 * 100;
      await this.putCPUMetric(Math.min(cpuPercentage, 100)); // 100% 초과 방지

    } catch (error) {
      this.logger.error('Failed to collect system metrics', error);
    }
  }

  /**
   * CloudWatch 대시보드 설정을 위한 메트릭 정보 반환
   */
  getMetricDefinitions(): Record<string, any> {
    return {
      namespace: this.namespace,
      metrics: [
        {
          name: 'ResponseTime',
          description: 'API 응답 시간 (밀리초)',
          unit: StandardUnit.Milliseconds,
          dimensions: ['Endpoint', 'Method', 'StatusCode', 'Environment'],
        },
        {
          name: 'ErrorCount',
          description: '에러 응답 수',
          unit: StandardUnit.Count,
          dimensions: ['Endpoint', 'Method', 'StatusCode', 'Environment'],
        },
        {
          name: 'ActiveRequests',
          description: '동시 처리 중인 요청 수',
          unit: StandardUnit.Count,
          dimensions: ['Environment'],
        },
        {
          name: 'HeapUsedMemory',
          description: '힙 메모리 사용량 (MB)',
          unit: StandardUnit.Megabytes,
          dimensions: ['Environment'],
        },
        {
          name: 'CPUUtilization',
          description: 'CPU 사용률 (%)',
          unit: StandardUnit.Percent,
          dimensions: ['Environment'],
        },
        {
          name: 'AverageResponseTime',
          description: '평균 응답 시간 (밀리초)',
          unit: StandardUnit.Milliseconds,
          dimensions: ['Endpoint', 'Environment'],
        },
        {
          name: 'P95ResponseTime',
          description: '95 백분위수 응답 시간 (밀리초)',
          unit: StandardUnit.Milliseconds,
          dimensions: ['Endpoint', 'Environment'],
        },
        {
          name: 'ErrorRate',
          description: '에러율 (%)',
          unit: StandardUnit.Percent,
          dimensions: ['Endpoint', 'Environment'],
        },
        {
          name: 'PerformanceAlert',
          description: '성능 알림 발생 수',
          unit: StandardUnit.Count,
          dimensions: ['AlertType', 'Severity', 'Endpoint', 'Environment'],
        },
      ],
      dashboards: {
        overview: {
          name: 'VanillaMeta API Overview',
          widgets: [
            'ResponseTime by Endpoint',
            'Error Rate by Endpoint',
            'Active Requests',
            'Memory Usage',
            'CPU Utilization',
          ],
        },
        performance: {
          name: 'VanillaMeta API Performance',
          widgets: [
            'P95/P99 Response Times',
            'Response Time Distribution',
            'Slowest Endpoints',
            'Performance Alerts',
          ],
        },
      },
    };
  }
}