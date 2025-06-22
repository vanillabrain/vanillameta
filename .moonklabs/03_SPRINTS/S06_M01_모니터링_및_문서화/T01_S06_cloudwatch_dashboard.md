# T01_S06: CloudWatch 대시보드 구축

## 태스크 개요
- **ID**: T01_S06
- **제목**: CloudWatch 통합 대시보드 구축
- **우선순위**: High
- **예상 소요 시간**: 3일
- **담당**: DevOps 엔지니어

## 목표
VanillaMeta 애플리케이션의 전체 시스템 상태를 한눈에 모니터링할 수 있는 CloudWatch 통합 대시보드를 구축합니다.

## 구현 범위

### 1. 시스템 대시보드
```yaml
SystemDashboard:
  - Lambda 함수 메트릭
    - 호출 횟수
    - 오류율
    - 실행 시간
    - 동시 실행 수
    - 콜드 스타트 빈도
  
  - API Gateway 메트릭
    - 요청 수
    - 4XX/5XX 오류
    - 레이턴시 (P50, P90, P99)
    - 처리량
  
  - RDS 메트릭
    - CPU 사용률
    - 메모리 사용률
    - DB 연결 수
    - 읽기/쓰기 IOPS
    - 스토리지 사용량
  
  - S3 메트릭
    - 버킷 크기
    - 요청 수
    - 대역폭 사용량
```

### 2. 비즈니스 대시보드
```yaml
BusinessDashboard:
  - 사용자 메트릭
    - 활성 사용자 수 (DAU/MAU)
    - 신규 가입자
    - 로그인 빈도
  
  - 기능 사용 메트릭
    - 대시보드 생성 수
    - 차트 생성 수
    - 데이터소스 연결 수
    - 쿼리 실행 수
  
  - 성능 메트릭
    - 페이지 로드 시간
    - API 응답 시간
    - 쿼리 실행 시간
```

### 3. 비용 대시보드
```yaml
CostDashboard:
  - 서비스별 비용
    - Lambda 실행 비용
    - RDS 운영 비용
    - S3 스토리지 비용
    - CloudFront 전송 비용
  
  - 일별/월별 추이
  - 예산 대비 사용률
```

## 기술 구현 가이드

### 1. CloudWatch Dashboard 구성
```typescript
// backend-api/src/infrastructure/monitoring/dashboards/system-dashboard.ts
import { CloudWatchClient, PutDashboardCommand } from '@aws-sdk/client-cloudwatch';

export class SystemDashboardBuilder {
  private cloudWatchClient: CloudWatchClient;

  constructor() {
    this.cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION });
  }

  async createSystemDashboard(): Promise<void> {
    const dashboardBody = {
      widgets: [
        this.createLambdaMetricsWidget(),
        this.createApiGatewayMetricsWidget(),
        this.createRDSMetricsWidget(),
        this.createS3MetricsWidget(),
      ],
    };

    const command = new PutDashboardCommand({
      DashboardName: 'VanillaMeta-System-Dashboard',
      DashboardBody: JSON.stringify(dashboardBody),
    });

    await this.cloudWatchClient.send(command);
  }

  private createLambdaMetricsWidget() {
    return {
      type: 'metric',
      properties: {
        metrics: [
          ['AWS/Lambda', 'Invocations', { stat: 'Sum' }],
          ['.', 'Errors', { stat: 'Sum' }],
          ['.', 'Duration', { stat: 'Average' }],
          ['.', 'ConcurrentExecutions', { stat: 'Maximum' }],
        ],
        period: 300,
        stat: 'Average',
        region: process.env.AWS_REGION,
        title: 'Lambda Function Metrics',
      },
    };
  }

  // 다른 위젯 생성 메서드들...
}
```

### 2. Custom Metrics 구현
```typescript
// backend-api/src/infrastructure/monitoring/metrics/custom-metrics.ts
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

export class CustomMetricsPublisher {
  private cloudWatchClient: CloudWatchClient;

  constructor() {
    this.cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION });
  }

  async publishBusinessMetric(
    metricName: string,
    value: number,
    unit: string = 'Count',
    dimensions?: Record<string, string>
  ): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: 'VanillaMeta/Business',
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
          Dimensions: dimensions ? 
            Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })) : 
            undefined,
        },
      ],
    });

    await this.cloudWatchClient.send(command);
  }

  // 비즈니스 메트릭 발행 예시
  async trackDashboardCreation(userId: string): Promise<void> {
    await this.publishBusinessMetric('DashboardCreated', 1, 'Count', {
      UserId: userId,
    });
  }

  async trackQueryExecution(duration: number, dataSourceType: string): Promise<void> {
    await this.publishBusinessMetric('QueryExecutionTime', duration, 'Milliseconds', {
      DataSourceType: dataSourceType,
    });
  }
}
```

### 3. Dashboard 템플릿
```json
{
  "start": "-PT6H",
  "periodOverride": "auto",
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "VanillaMeta/Business", "ActiveUsers", { "stat": "Sum", "period": 86400 } ],
          [ ".", "NewUsers", { "stat": "Sum", "period": 86400 } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "ap-northeast-2",
        "title": "User Activity",
        "period": 300
      }
    }
  ]
}
```

### 4. Infrastructure as Code (CDK)
```typescript
// infrastructure/lib/monitoring-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 시스템 대시보드
    const systemDashboard = new cloudwatch.Dashboard(this, 'SystemDashboard', {
      dashboardName: 'VanillaMeta-System',
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    // Lambda 메트릭 위젯
    const lambdaWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Performance',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Invocations',
          dimensionsMap: {
            FunctionName: 'vanillameta-api',
          },
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          dimensionsMap: {
            FunctionName: 'vanillameta-api',
          },
          statistic: cloudwatch.Stats.SUM,
          color: cloudwatch.Color.RED,
        }),
      ],
    });

    systemDashboard.addWidgets(lambdaWidget);
  }
}
```

## 검증 항목

### 기능 검증
- [ ] 모든 시스템 메트릭이 정상적으로 수집됨
- [ ] 커스텀 비즈니스 메트릭이 발행됨
- [ ] 대시보드가 실시간으로 업데이트됨
- [ ] 모든 위젯이 올바른 데이터를 표시함

### 성능 검증
- [ ] 대시보드 로딩 시간 < 3초
- [ ] 메트릭 발행 지연 < 1분
- [ ] CloudWatch API 호출 최적화

### 비용 검증
- [ ] 월간 CloudWatch 비용 예상치 계산
- [ ] 불필요한 메트릭 제거
- [ ] 적절한 메트릭 보관 기간 설정

## 산출물
1. CloudWatch 대시보드 (시스템, 비즈니스, 비용)
2. 커스텀 메트릭 발행 코드
3. 대시보드 접근 권한 설정
4. 대시보드 사용 가이드 문서
5. 메트릭 카탈로그 문서

## 참고 자료
- [AWS CloudWatch Dashboard API](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_PutDashboard.html)
- [CloudWatch Custom Metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/publishingMetrics.html)
- [CloudWatch Dashboard Best Practices](https://aws.amazon.com/blogs/mt/cloudwatch-dashboards-best-practices/)