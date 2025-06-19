---
task_id: T06_S03
sprint_sequence_id: S03
status: completed
complexity: Low
last_updated: 2025-06-17T12:00:00Z
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
- [x] 모든 데이터베이스 쿼리의 실행 시간이 측정됨
- [x] 느린 쿼리가 자동으로 로깅됨
- [x] CloudWatch 메트릭으로 쿼리 성능이 추적됨
- [x] 쿼리 성능 대시보드가 구성됨
- [x] 알람 설정으로 문제 조기 감지 가능

## Subtasks
- [x] 쿼리 인터셉터 구현
  - [x] TypeORM 쿼리 로깅 설정
  - [x] Knex 쿼리 로깅 설정
- [x] 실행 시간 측정 로직 구현
- [x] 느린 쿼리 판별 기준 설정
- [x] 구조화된 로깅 구현
- [x] CloudWatch 메트릭 전송
- [x] 모니터링 대시보드 구성

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

### 2025-06-17

#### 구현 완료 사항

1. **TypeORM 슬로우 쿼리 로거 통합**
   - `TypeOrmSlowQueryLogger` 클래스를 사용하여 커스텀 로깅 구현
   - app.module.ts에서 TypeORM 설정에 커스텀 로거 연결
   - 쿼리 실행 시간 자동 측정 및 임계값 기반 감지

2. **Knex 쿼리 모니터링 활성화**
   - `KnexQueryMonitor` 서비스를 통한 외부 DB 쿼리 모니터링
   - ConnectionService에서 Knex 인스턴스 생성 시 자동 연결
   - 모든 외부 데이터베이스 쿼리 추적

3. **슬로우 쿼리 분석 기능**
   - `QueryAnalyzerService` 개선으로 다중 DB 엔진 지원
   - EXPLAIN 분석을 통한 쿼리 성능 진단
   - 자동 최적화 제안 생성

4. **CloudWatch 메트릭 통합**
   - 슬로우 쿼리 발생 시 자동 메트릭 전송
   - 심각도별, 데이터베이스별 메트릭 분류
   - 대시보드 JSON 템플릿 제공
   - 알람 설정 템플릿 제공

5. **관리 API 엔드포인트**
   - `/monitoring/slow-queries/stats` - 통계 조회
   - `/monitoring/slow-queries` - 쿼리 목록 (필터링, 페이징)
   - `/monitoring/slow-queries/{id}/resolve` - 해결 처리
   - `/monitoring/slow-queries/config` - 설정 관리
   - `/monitoring/slow-queries/export` - 데이터 내보내기

6. **문서화**
   - 상세한 사용 가이드 작성 (`docs/slow-query-monitoring.md`)
   - API 문서 및 예제 포함
   - CloudWatch 설정 가이드
   - 성능 최적화 권장사항

7. **테스트 도구**
   - `test-slow-query.ts` 스크립트로 모니터링 테스트 가능
   - `yarn test:slow-query` 명령어 추가

#### 변경된 파일

1. `/workspace/vanillameta/backend-api/src/app.module.ts`
   - TypeORM 설정을 forRootAsync로 변경
   - 커스텀 슬로우 쿼리 로거 주입

2. `/workspace/vanillameta/backend-api/src/common/monitoring/monitoring.module.ts`
   - TypeOrmSlowQueryLogger, KnexQueryMonitor 프로바이더 추가
   - QueryAnalyzerService export 추가

3. `/workspace/vanillameta/backend-api/src/common/monitoring/query-analyzer.service.ts`
   - analyzeQuery 메서드 시그니처 개선
   - 실행 시간 파라미터 추가

4. `/workspace/vanillameta/backend-api/src/connection/connection.service.ts`
   - KnexQueryMonitor 주입 및 활성화
   - Knex 인스턴스 생성 시 모니터링 연결

5. `/workspace/vanillameta/backend-api/src/connection/connection.module.ts`
   - Git 충돌 해결

6. `/workspace/vanillameta/backend-api/.env.example`
   - SLOW_QUERY_THRESHOLD 환경 변수 추가
   - SLOW_QUERY_MONITORING_ENABLED 환경 변수 추가

7. 신규 생성 파일:
   - `docs/slow-query-monitoring.md`
   - `src/test-slow-query.ts`
   - `cloudwatch/slow-query-dashboard.json`
   - `cloudwatch/slow-query-alarms.json`

8. `/workspace/vanillameta/backend-api/package.json`
   - `test:slow-query` 스크립트 추가

#### 테스트 방법

1. 환경 변수 설정:
   ```bash
   export SLOW_QUERY_THRESHOLD=1000
   export SLOW_QUERY_MONITORING_ENABLED=true
   ```

2. 테스트 스크립트 실행:
   ```bash
   yarn test:slow-query
   ```

3. API를 통한 모니터링 확인:
   ```bash
   # 통계 조회
   curl -H "Authorization: Bearer {JWT_TOKEN}" \
        http://localhost:3000/monitoring/slow-queries/stats
   
   # 슬로우 쿼리 목록
   curl -H "Authorization: Bearer {JWT_TOKEN}" \
        http://localhost:3000/monitoring/slow-queries
   ```

#### 다음 단계 권장사항

1. **실시간 알림 시스템 구축**
   - SNS/SQS를 통한 이메일/Slack 알림
   - Critical 쿼리 즉시 알림

2. **쿼리 최적화 자동화**
   - 자주 발생하는 슬로우 쿼리 패턴 분석
   - 인덱스 자동 생성 제안

3. **성능 대시보드 UI**
   - 프론트엔드에 슬로우 쿼리 모니터링 화면 추가
   - 실시간 차트 및 분석 도구

4. **고급 분석 기능**
   - 쿼리 실행 계획 시각화
   - 머신러닝 기반 이상 감지
   - 예측적 성능 분석

5. **통합 테스트**
   - 다양한 데이터베이스 엔진에서 테스트
   - 대용량 쿼리 시나리오 테스트
   - Lambda 환경에서의 성능 검증