---
task_id: T06_S03
sprint_sequence_id: S03
status: open
complexity: Low
last_updated: 2025-06-12T17:00:00Z
---

# Task: Slow Query Monitoring Setup

## Description
느린 쿼리를 자동으로 감지하고 로깅하는 모니터링 시스템을 구축합니다. 쿼리 실행 시간을 추적하고, 임계값을 초과하는 쿼리를 식별하여 성능 문제를 사전에 발견하고 해결할 수 있도록 합니다.

## Goal / Objectives
- 쿼리 실행 시간 자동 측정
- 느린 쿼리 임계값 설정 및 감지
- 상세한 쿼리 정보 로깅
- CloudWatch 통합 모니터링

## Acceptance Criteria
- [ ] 모든 데이터베이스 쿼리의 실행 시간이 측정됨
- [ ] 느린 쿼리가 자동으로 로깅됨
- [ ] CloudWatch 메트릭으로 쿼리 성능이 추적됨
- [ ] 쿼리 성능 대시보드가 구성됨
- [ ] 알람 설정으로 문제 조기 감지 가능

## Subtasks
- [ ] 쿼리 인터셉터 구현
  - [ ] TypeORM 쿼리 로깅 설정
  - [ ] Knex 쿼리 로깅 설정
- [ ] 실행 시간 측정 로직 구현
- [ ] 느린 쿼리 판별 기준 설정
- [ ] 구조화된 로깅 구현
- [ ] CloudWatch 메트릭 전송
- [ ] 모니터링 대시보드 구성

## Technical Guidance

### Key interfaces and integration points
- **TypeORM Logger**: Custom logger implementation
- **Knex Events**: Query event listeners
- **Logger Service**: `common/logger/logger.service.ts`
- **CloudWatch Integration**: AWS SDK for metrics

### Specific imports and module references
```typescript
import { Logger as TypeOrmLogger } from 'typeorm';
import { LoggerService } from '@nestjs/common';
import * as AWS from 'aws-sdk';
```

### Existing patterns to follow
- Structured JSON logging format
- Correlation ID inclusion
- Environment-based configuration
- Existing logger service patterns

### Database models to work with
- All database queries through TypeORM
- Customer database queries through Knex
- Both read and write operations
- Transaction monitoring

### Error handling approach
- Non-blocking logging (실패해도 쿼리는 계속 실행)
- Metric 전송 실패 시 로컬 로깅
- 과도한 로깅으로 인한 성능 저하 방지

## Implementation Notes

### Step-by-step implementation approach
1. TypeORM 커스텀 로거 구현
2. Knex 이벤트 리스너 설정
3. 실행 시간 측정 및 임계값 판별
4. 구조화된 로그 포맷 정의
5. CloudWatch 메트릭 전송
6. 대시보드 및 알람 구성

### Key architectural decisions to respect
- 기존 LoggerService 활용
- 성능 오버헤드 최소화
- 환경별 다른 임계값 설정
- 민감한 정보 마스킹

### Testing approach
- 다양한 쿼리 타입 테스트
- 임계값 경계 테스트
- 대량 쿼리 상황 테스트
- CloudWatch 통합 테스트

### Performance considerations
- 로깅 자체가 성능 병목이 되지 않도록
- 비동기 메트릭 전송
- 로그 버퍼링 고려
- 샘플링 전략 (모든 쿼리 vs 샘플)

### Implementation examples
```typescript
// TypeORM Custom Logger
export class SlowQueryLogger implements TypeOrmLogger {
  constructor(
    private readonly logger: LoggerService,
    private readonly slowQueryThreshold: number = 1000, // 1초
  ) {}

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    const startTime = Date.now();
    
    // Store start time for later use
    if (queryRunner) {
      queryRunner.data.queryStartTime = startTime;
    }
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (time > this.slowQueryThreshold) {
      this.logger.warn({
        message: 'Slow query detected',
        query: this.sanitizeQuery(query),
        executionTime: time,
        threshold: this.slowQueryThreshold,
        parameters: this.sanitizeParameters(parameters),
        correlationId: queryRunner?.data?.correlationId,
      });
      
      // Send metric to CloudWatch
      this.sendMetric('SlowQuery', time, query);
    }
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data from query
    return query.substring(0, 500); // Truncate long queries
  }

  private sanitizeParameters(params?: any[]): any[] {
    // Mask sensitive parameter values
    return params?.map(p => typeof p === 'string' ? '***' : p) || [];
  }

  private async sendMetric(metricName: string, value: number, query: string) {
    // CloudWatch metric emission
    const cloudwatch = new AWS.CloudWatch();
    const params = {
      Namespace: 'VanillaMeta/Database',
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: 'Milliseconds',
        Dimensions: [
          {
            Name: 'Environment',
            Value: process.env.NODE_ENV || 'dev'
          },
          {
            Name: 'QueryType',
            Value: this.getQueryType(query)
          }
        ]
      }]
    };
    
    try {
      await cloudwatch.putMetricData(params).promise();
    } catch (error) {
      this.logger.error('Failed to send metric to CloudWatch', error);
    }
  }

  private getQueryType(query: string): string {
    const normalizedQuery = query.trim().toUpperCase();
    if (normalizedQuery.startsWith('SELECT')) return 'SELECT';
    if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
    if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
    if (normalizedQuery.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }
}

// Knex Query Monitoring
export class KnexQueryMonitor {
  constructor(
    private readonly logger: LoggerService,
    private readonly slowQueryThreshold: number = 1000,
  ) {}

  attachToKnex(knex: Knex) {
    // Query start event
    knex.on('query', (query) => {
      query.__startTime = Date.now();
    });

    // Query completion event
    knex.on('query-response', (response, query) => {
      const duration = Date.now() - query.__startTime;
      
      if (duration > this.slowQueryThreshold) {
        this.logger.warn({
          message: 'Slow Knex query detected',
          sql: query.sql,
          bindings: query.bindings?.map(() => '***'), // Mask values
          duration,
          method: query.method,
          options: query.options,
        });
      }
      
      // Always log query metrics
      this.logger.log({
        message: 'Query executed',
        duration,
        method: query.method,
      });
    });

    // Query error event
    knex.on('query-error', (error, query) => {
      this.logger.error({
        message: 'Query error',
        error: error.message,
        sql: query.sql,
        duration: Date.now() - query.__startTime,
      });
    });
  }
}

// Integration in app.module.ts
@Module({
  providers: [
    {
      provide: 'SLOW_QUERY_LOGGER',
      useFactory: (logger: LoggerService) => {
        const threshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000');
        return new SlowQueryLogger(logger, threshold);
      },
      inject: [LoggerService],
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply query monitoring middleware
    consumer
      .apply(QueryMonitoringMiddleware)
      .forRoutes('*');
  }
}

// CloudWatch Dashboard Configuration (JSON)
const dashboardBody = {
  widgets: [
    {
      type: "metric",
      properties: {
        metrics: [
          ["VanillaMeta/Database", "SlowQuery", { stat: "Sum" }],
          [".", ".", { stat: "Average" }]
        ],
        period: 300,
        stat: "Average",
        region: "us-east-1",
        title: "Slow Query Metrics"
      }
    },
    {
      type: "log",
      properties: {
        query: `SOURCE '/aws/lambda/vanillameta-api'
          | fields @timestamp, message
          | filter message like /Slow query detected/
          | stats count() by bin(5m)`,
        region: "us-east-1",
        title: "Slow Query Count"
      }
    }
  ]
};
```

## Output Log
*(This section is populated as work progresses on the task)*