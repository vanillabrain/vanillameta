# T02_S06: 메트릭 정의 및 알람 설정

## 태스크 개요
- **ID**: T02_S06
- **제목**: 핵심 메트릭 정의 및 CloudWatch 알람 구성
- **우선순위**: High
- **예상 소요 시간**: 2일
- **담당**: DevOps 엔지니어, 백엔드 개발자

## 목표
시스템의 건강성과 비즈니스 성과를 추적할 수 있는 핵심 메트릭을 정의하고, 이상 상황 발생 시 즉각적인 대응이 가능하도록 알람을 설정합니다.

## 구현 범위

### 1. 핵심 메트릭 카탈로그

#### 시스템 메트릭
```yaml
SystemMetrics:
  Availability:
    - API_Uptime: API Gateway 가용성 (목표: 99.9%)
    - Lambda_Success_Rate: Lambda 함수 성공률 (목표: 99.5%)
    - RDS_Availability: 데이터베이스 가용성 (목표: 99.9%)
  
  Performance:
    - API_Latency_P50: API 응답 시간 중위값 (목표: < 200ms)
    - API_Latency_P99: API 응답 시간 99분위 (목표: < 1000ms)
    - Query_Execution_Time: 쿼리 실행 시간 (목표: < 5s)
    - Lambda_Cold_Start_Rate: 콜드 스타트 비율 (목표: < 5%)
  
  Capacity:
    - Lambda_Concurrent_Executions: 동시 실행 수 (한계: 1000)
    - RDS_Connection_Count: DB 연결 수 (한계: 100)
    - S3_Storage_Usage: 스토리지 사용량 (한계: 1TB)
  
  Error:
    - API_4XX_Rate: 클라이언트 오류율 (목표: < 5%)
    - API_5XX_Rate: 서버 오류율 (목표: < 0.1%)
    - Lambda_Error_Count: Lambda 오류 수 (목표: < 10/hour)
```

#### 비즈니스 메트릭
```yaml
BusinessMetrics:
  UserEngagement:
    - DAU: 일일 활성 사용자 수
    - MAU: 월간 활성 사용자 수
    - User_Retention_7D: 7일 재방문율
    - Session_Duration: 평균 세션 시간
  
  FeatureUsage:
    - Dashboard_Creation_Rate: 대시보드 생성률
    - Chart_Creation_Rate: 차트 생성률
    - Query_Execution_Count: 쿼리 실행 횟수
    - Data_Source_Connection_Count: 데이터소스 연결 수
  
  BusinessValue:
    - Total_Dashboards: 총 대시보드 수
    - Active_Dashboards: 활성 대시보드 수
    - Data_Processing_Volume: 데이터 처리량
```

### 2. 알람 구성

#### Critical 알람 (5분 이내 대응)
```yaml
CriticalAlarms:
  - API_Gateway_5XX:
      Threshold: > 10 errors in 5 minutes
      Action: PagerDuty, SMS, Email
      
  - Lambda_Error_Spike:
      Threshold: Error rate > 10% for 5 minutes
      Action: PagerDuty, SMS, Email
      
  - RDS_Connection_Exhaustion:
      Threshold: Connections > 90% of max
      Action: PagerDuty, SMS, Email
      
  - System_Down:
      Threshold: API availability < 90% for 3 minutes
      Action: PagerDuty, SMS, Email, Auto-scaling
```

#### Warning 알람 (30분 이내 대응)
```yaml
WarningAlarms:
  - High_API_Latency:
      Threshold: P99 latency > 2000ms for 10 minutes
      Action: Slack, Email
      
  - Lambda_Throttling:
      Threshold: Throttles > 0 for 5 minutes
      Action: Slack, Email
      
  - RDS_CPU_High:
      Threshold: CPU > 80% for 15 minutes
      Action: Slack, Email
      
  - S3_Storage_Warning:
      Threshold: Storage > 80% of limit
      Action: Slack, Email
```

## 기술 구현 가이드

### 1. 메트릭 정의 및 발행
```typescript
// backend-api/src/infrastructure/monitoring/metrics/metric-publisher.ts
import { Injectable } from '@nestjs/common';
import { CloudWatchClient, PutMetricDataCommand, MetricDatum } from '@aws-sdk/client-cloudwatch';

@Injectable()
export class MetricPublisher {
  private cloudWatchClient: CloudWatchClient;
  private namespace = 'VanillaMeta';

  constructor() {
    this.cloudWatchClient = new CloudWatchClient({ 
      region: process.env.AWS_REGION 
    });
  }

  async publishMetric(
    metricName: string,
    value: number,
    unit: string = 'Count',
    dimensions?: Record<string, string>
  ): Promise<void> {
    const metricData: MetricDatum = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: dimensions ? 
        Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })) : 
        undefined,
    };

    try {
      await this.cloudWatchClient.send(new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: [metricData],
      }));
    } catch (error) {
      console.error(`Failed to publish metric ${metricName}:`, error);
    }
  }

  // 비즈니스 메트릭 헬퍼 메서드
  async trackUserActivity(userId: string, activityType: string): Promise<void> {
    await this.publishMetric('UserActivity', 1, 'Count', {
      UserId: userId,
      ActivityType: activityType,
    });
  }

  async trackApiLatency(endpoint: string, latency: number): Promise<void> {
    await this.publishMetric('APILatency', latency, 'Milliseconds', {
      Endpoint: endpoint,
    });
  }

  async trackQueryExecution(dataSourceType: string, executionTime: number): Promise<void> {
    await this.publishMetric('QueryExecutionTime', executionTime, 'Milliseconds', {
      DataSourceType: dataSourceType,
    });
  }
}
```

### 2. 알람 구성 코드
```typescript
// infrastructure/lib/alarms-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';

export class AlarmsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SNS 토픽 생성
    const criticalAlarmTopic = new sns.Topic(this, 'CriticalAlarmTopic', {
      topicName: 'vanillameta-critical-alarms',
    });

    const warningAlarmTopic = new sns.Topic(this, 'WarningAlarmTopic', {
      topicName: 'vanillameta-warning-alarms',
    });

    // Critical: API 5XX 오류 알람
    const api5xxAlarm = new cloudwatch.Alarm(this, 'API5XXAlarm', {
      alarmName: 'VanillaMeta-API-5XX-Errors',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: 'vanillameta-api',
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API Gateway 5XX errors exceeded threshold',
    });

    api5xxAlarm.addAlarmAction(
      new actions.SnsAction(criticalAlarmTopic)
    );

    // Critical: Lambda 오류율 알람
    const lambdaErrorRateAlarm = new cloudwatch.Alarm(this, 'LambdaErrorRateAlarm', {
      alarmName: 'VanillaMeta-Lambda-Error-Rate',
      metric: new cloudwatch.MathExpression({
        expression: 'errors / invocations * 100',
        usingMetrics: {
          errors: new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            dimensionsMap: {
              FunctionName: 'vanillameta-api',
            },
            statistic: 'Sum',
          }),
          invocations: new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Invocations',
            dimensionsMap: {
              FunctionName: 'vanillameta-api',
            },
            statistic: 'Sum',
          }),
        },
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Lambda error rate exceeded 10%',
    });

    lambdaErrorRateAlarm.addAlarmAction(
      new actions.SnsAction(criticalAlarmTopic)
    );

    // Warning: API 레이턴시 알람
    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'APILatencyAlarm', {
      alarmName: 'VanillaMeta-API-High-Latency',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: {
          ApiName: 'vanillameta-api',
        },
        statistic: 'p99',
        period: cdk.Duration.minutes(10),
      }),
      threshold: 2000,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API P99 latency exceeded 2000ms',
    });

    apiLatencyAlarm.addAlarmAction(
      new actions.SnsAction(warningAlarmTopic)
    );

    // RDS 알람들
    this.createRDSAlarms(criticalAlarmTopic, warningAlarmTopic);
  }

  private createRDSAlarms(
    criticalTopic: sns.Topic, 
    warningTopic: sns.Topic
  ): void {
    // RDS CPU 사용률 알람
    const rdsCpuAlarm = new cloudwatch.Alarm(this, 'RDSCPUAlarm', {
      alarmName: 'VanillaMeta-RDS-High-CPU',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          DBInstanceIdentifier: 'vanillameta-db',
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(15),
      }),
      threshold: 80,
      evaluationPeriods: 1,
      alarmDescription: 'RDS CPU utilization exceeded 80%',
    });

    rdsCpuAlarm.addAlarmAction(
      new actions.SnsAction(warningTopic)
    );

    // RDS 연결 수 알람
    const rdsConnectionAlarm = new cloudwatch.Alarm(this, 'RDSConnectionAlarm', {
      alarmName: 'VanillaMeta-RDS-Connection-Exhaustion',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'DatabaseConnections',
        dimensionsMap: {
          DBInstanceIdentifier: 'vanillameta-db',
        },
        statistic: 'Maximum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 90,
      evaluationPeriods: 1,
      alarmDescription: 'RDS connections approaching limit',
    });

    rdsConnectionAlarm.addAlarmAction(
      new actions.SnsAction(criticalTopic)
    );
  }
}
```

### 3. 알람 대응 자동화
```typescript
// backend-api/src/infrastructure/monitoring/alarm-handler.ts
import { Injectable } from '@nestjs/common';
import { SNSEvent } from 'aws-lambda';
import { SlackService } from './slack.service';
import { AutoScalingService } from './auto-scaling.service';

@Injectable()
export class AlarmHandler {
  constructor(
    private readonly slackService: SlackService,
    private readonly autoScalingService: AutoScalingService,
  ) {}

  async handleAlarm(event: SNSEvent): Promise<void> {
    for (const record of event.Records) {
      const message = JSON.parse(record.Sns.Message);
      const alarmName = message.AlarmName;
      const newState = message.NewStateValue;
      const reason = message.NewStateReason;

      if (newState === 'ALARM') {
        await this.processAlarm(alarmName, reason);
      } else if (newState === 'OK') {
        await this.processRecovery(alarmName);
      }
    }
  }

  private async processAlarm(alarmName: string, reason: string): Promise<void> {
    // Slack 알림
    await this.slackService.sendAlert({
      channel: '#alerts',
      severity: this.getSeverity(alarmName),
      title: `🚨 ${alarmName}`,
      message: reason,
      actions: this.getRecommendedActions(alarmName),
    });

    // 자동 대응
    if (this.shouldAutoRemediate(alarmName)) {
      await this.autoRemediate(alarmName);
    }
  }

  private async autoRemediate(alarmName: string): Promise<void> {
    switch (alarmName) {
      case 'VanillaMeta-Lambda-Error-Rate':
        // Lambda 동시 실행 한도 증가
        await this.autoScalingService.increaseLambdaConcurrency();
        break;
      
      case 'VanillaMeta-RDS-High-CPU':
        // RDS 인스턴스 크기 증가
        await this.autoScalingService.scaleUpRDS();
        break;
      
      case 'VanillaMeta-API-High-Latency':
        // API Gateway 캐싱 활성화
        await this.autoScalingService.enableAPICaching();
        break;
    }
  }

  private getSeverity(alarmName: string): 'critical' | 'warning' | 'info' {
    const criticalAlarms = [
      'VanillaMeta-API-5XX-Errors',
      'VanillaMeta-Lambda-Error-Rate',
      'VanillaMeta-RDS-Connection-Exhaustion',
      'VanillaMeta-System-Down',
    ];

    return criticalAlarms.includes(alarmName) ? 'critical' : 'warning';
  }

  private getRecommendedActions(alarmName: string): string[] {
    const actionMap: Record<string, string[]> = {
      'VanillaMeta-API-5XX-Errors': [
        'Check Lambda function logs',
        'Verify database connectivity',
        'Review recent deployments',
      ],
      'VanillaMeta-Lambda-Error-Rate': [
        'Check function logs for exceptions',
        'Verify environment variables',
        'Check memory/timeout settings',
      ],
      'VanillaMeta-RDS-High-CPU': [
        'Identify slow queries',
        'Check for missing indexes',
        'Consider scaling up RDS instance',
      ],
    };

    return actionMap[alarmName] || ['Check CloudWatch logs'];
  }
}
```

### 4. 메트릭 대시보드 구성
```typescript
// backend-api/src/infrastructure/monitoring/dashboards/metrics-dashboard.ts
export class MetricsDashboardBuilder {
  createMetricsCatalogDashboard(): object {
    return {
      widgets: [
        {
          type: 'metric',
          properties: {
            title: 'System Health Score',
            metrics: [
              ['VanillaMeta', 'SystemHealthScore', { stat: 'Average' }],
            ],
            annotations: {
              horizontal: [
                { value: 95, label: 'Target', color: '#00ff00' },
                { value: 90, label: 'Warning', color: '#ffff00' },
                { value: 80, label: 'Critical', color: '#ff0000' },
              ],
            },
            period: 300,
            region: process.env.AWS_REGION,
            yAxis: { left: { min: 0, max: 100 } },
          },
        },
        {
          type: 'metric',
          properties: {
            title: 'Business KPIs',
            metrics: [
              ['VanillaMeta', 'DAU', { stat: 'Sum', period: 86400 }],
              ['.', 'MAU', { stat: 'Sum', period: 2592000 }],
              ['.', 'DashboardCreated', { stat: 'Sum', period: 86400 }],
              ['.', 'QueryExecuted', { stat: 'Sum', period: 86400 }],
            ],
            view: 'singleValue',
            region: process.env.AWS_REGION,
          },
        },
      ],
    };
  }
}
```

## 검증 항목

### 메트릭 검증
- [ ] 모든 정의된 메트릭이 CloudWatch에 발행됨
- [ ] 메트릭 값이 정확하게 계산됨
- [ ] 메트릭 지연 시간 < 1분

### 알람 검증
- [ ] 모든 Critical 알람이 5분 이내 트리거됨
- [ ] 알람 알림이 모든 채널로 전송됨
- [ ] 자동 대응 액션이 정상 작동함
- [ ] False positive 비율 < 5%

### 문서화
- [ ] 메트릭 카탈로그 완성
- [ ] 알람 대응 가이드 작성
- [ ] 메트릭 계산 방법 문서화

## 산출물
1. 메트릭 정의 카탈로그 (YAML/JSON)
2. CloudWatch 알람 구성 코드
3. 알람 대응 자동화 스크립트
4. 메트릭 발행 라이브러리
5. 알람 대응 런북

## 참고 자료
- [CloudWatch Metrics Best Practices](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html)
- [Alarm Actions](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- [Custom Metrics Publishing](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/publishingMetrics.html)