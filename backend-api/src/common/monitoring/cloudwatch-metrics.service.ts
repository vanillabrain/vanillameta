import { Injectable, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { ConfigService } from '@nestjs/config';

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  unit: string;
}

@Injectable()
export class CloudWatchMetricsService {
  private readonly logger = new Logger(CloudWatchMetricsService.name);
  private readonly cloudWatch: AWS.CloudWatch;
  private readonly enabled: boolean;
  private readonly region: string;
  private metricsBuffer: AWS.CloudWatch.MetricDatum[] = [];
  private lastFlushTime = Date.now();
  private readonly flushInterval = 60000; // 1분마다 플러시
  private readonly maxBufferSize = 20; // 최대 20개 메트릭 버퍼링

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('CLOUDWATCH_METRICS_ENABLED', true);
    this.region = this.configService.get<string>('AWS_REGION', 'ap-northeast-2');

    this.cloudWatch = new AWS.CloudWatch({
      region: this.region,
      apiVersion: '2010-08-01',
    });

    // 주기적으로 버퍼 플러시
    if (this.enabled) {
      setInterval(() => {
        this.flushMetrics().catch(error => {
          this.logger.error('Failed to flush metrics', error);
        });
      }, this.flushInterval);
    }
  }

  /**
   * 메트릭 전송
   */
  async putMetric(
    namespace: string,
    metricName: string,
    value: number,
    unit: AWS.CloudWatch.StandardUnit = 'None',
    dimensions?: Record<string, string>,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const metric: AWS.CloudWatch.MetricDatum = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: dimensions
        ? Object.entries(dimensions).map(([name, value]) => ({
            Name: name,
            Value: value,
          }))
        : undefined,
    };

    // 버퍼에 추가
    this.metricsBuffer.push(metric);

    // 버퍼가 가득 찼거나 일정 시간이 지났으면 플러시
    if (
      this.metricsBuffer.length >= this.maxBufferSize ||
      Date.now() - this.lastFlushTime > this.flushInterval
    ) {
      await this.flushMetrics();
    }
  }

  /**
   * 버퍼에 있는 메트릭 일괄 전송
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];
    this.lastFlushTime = Date.now();

    // 네임스페이스별로 그룹화
    const metricsByNamespace = new Map<string, AWS.CloudWatch.MetricDatum[]>();

    // 기본 네임스페이스 사용
    const defaultNamespace = 'VanillaMeta';
    metricsByNamespace.set(defaultNamespace, metricsToSend);

    // 각 네임스페이스별로 전송
    for (const [namespace, metrics] of metricsByNamespace) {
      try {
        const params: AWS.CloudWatch.PutMetricDataInput = {
          Namespace: namespace,
          MetricData: metrics,
        };

        await this.cloudWatch.putMetricData(params).promise();

        this.logger.debug(`Flushed ${metrics.length} metrics to CloudWatch`, {
          namespace,
          metricCount: metrics.length,
        });
      } catch (error) {
        this.logger.error('Failed to put metrics to CloudWatch', {
          namespace,
          error: error.message,
          metricCount: metrics.length,
        });
      }
    }
  }

  /**
   * 메트릭 통계 조회
   */
  async getMetricStatistics(
    namespace: string,
    metricName: string,
    period: number,
    statistics: string[] = ['Average', 'Sum', 'Maximum', 'Minimum'],
  ): Promise<MetricDataPoint[]> {
    if (!this.enabled) {
      return [];
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - period * 1000);

    const params: AWS.CloudWatch.GetMetricStatisticsInput = {
      Namespace: namespace,
      MetricName: metricName,
      StartTime: startTime,
      EndTime: endTime,
      Period: Math.min(period, 300), // 최소 5분 단위
      Statistics: statistics,
    };

    try {
      const result = await this.cloudWatch.getMetricStatistics(params).promise();

      return (
        result.Datapoints?.map(datapoint => ({
          timestamp: datapoint.Timestamp!,
          value: datapoint.Average || datapoint.Sum || datapoint.Maximum || datapoint.Minimum || 0,
          unit: datapoint.Unit || 'None',
        })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) || []
      );
    } catch (error) {
      this.logger.error('Failed to get metric statistics', {
        namespace,
        metricName,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * 커스텀 알람 생성
   */
  async createAlarm(
    alarmName: string,
    namespace: string,
    metricName: string,
    threshold: number,
    comparisonOperator: AWS.CloudWatch.ComparisonOperator,
    evaluationPeriods = 2,
    period = 300,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const params: AWS.CloudWatch.PutMetricAlarmInput = {
      AlarmName: alarmName,
      ComparisonOperator: comparisonOperator,
      EvaluationPeriods: evaluationPeriods,
      MetricName: metricName,
      Namespace: namespace,
      Period: period,
      Statistic: 'Average',
      Threshold: threshold,
      ActionsEnabled: true,
      AlarmDescription: `Alarm for ${metricName} in ${namespace}`,
      TreatMissingData: 'notBreaching',
    };

    try {
      await this.cloudWatch.putMetricAlarm(params).promise();
      this.logger.log(`Created alarm: ${alarmName}`);
    } catch (error) {
      this.logger.error('Failed to create alarm', {
        alarmName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 대시보드 위젯 JSON 생성
   */
  generateDashboardWidget(
    title: string,
    namespace: string,
    metrics: Array<{ name: string; stat?: string; period?: number }>,
    region: string = this.region,
  ): any {
    return {
      type: 'metric',
      properties: {
        metrics: metrics.map(metric => [
          namespace,
          metric.name,
          { stat: metric.stat || 'Average', period: metric.period || 300 },
        ]),
        period: 300,
        stat: 'Average',
        region,
        title,
        yAxis: {
          left: {
            min: 0,
          },
        },
      },
    };
  }

  /**
   * 강제 메트릭 플러시 (애플리케이션 종료 시)
   */
  async onModuleDestroy(): Promise<void> {
    if (this.enabled && this.metricsBuffer.length > 0) {
      await this.flushMetrics();
    }
  }
}
