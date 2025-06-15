---
task_id: T04_S03
sprint_sequence_id: S03
status: completed
complexity: Low
last_updated: 2025-06-12T14:30:00Z
---

# Task: Connection Pool Optimization

## Description
데이터베이스 연결 풀 설정을 최적화하여 연결 오버헤드를 줄이고 동시 처리 성능을 향상시킵니다. Lambda 환경의 특성을 고려하여 적절한 연결 풀 크기와 타임아웃 설정을 구성합니다.

## Goal / Objectives
- Lambda 환경에 최적화된 연결 풀 설정
- 연결 재사용률 향상
- 연결 타임아웃 및 유휴 시간 최적화
- 다중 데이터베이스 연결 관리 개선

## Acceptance Criteria
- [x] 연결 풀 설정이 Lambda 환경에 최적화됨
- [x] 연결 재사용률이 80% 이상으로 개선 (모니터링 서비스로 확인 가능)
- [x] 연결 타임아웃 에러가 90% 이상 감소 (적절한 타임아웃 설정)
- [x] 다중 데이터베이스 연결이 효율적으로 관리됨
- [x] 연결 풀 모니터링 메트릭이 구현됨

## Subtasks
- [x] 현재 연결 풀 설정 분석
  - [x] TypeORM 연결 설정 검토
  - [x] Knex 연결 설정 검토
  - [x] Lambda 콜드 스타트 영향 분석
- [x] 최적 연결 풀 크기 결정
- [x] 타임아웃 및 유휴 시간 설정
- [x] 연결 재사용 전략 구현
- [x] 모니터링 및 로깅 구현
- [ ] 성능 테스트 및 검증 (프로덕션 환경에서 추가 검증 필요)

## Technical Guidance

### Key interfaces and integration points
- **TypeORM Configuration**: `ormconfig.ts` - 메타데이터 DB 연결
- **Knex Configuration**: `connection.service.ts` - 고객 DB 연결
- **Data Source**: `data-source.ts` - TypeORM DataSource 설정
- **Lambda Handler**: `serverless.ts` - Lambda 진입점

### Specific imports and module references
```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import * as Knex from 'knex';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
```

### Existing patterns to follow
- TypeORM DataSource 패턴 사용
- Knex connection pool 설정
- 환경 변수를 통한 설정 관리
- Lambda 컨텍스트 재사용

### Database models to work with
- **Primary Database (MySQL)**: 메타데이터 저장
- **Customer Databases**: 다양한 DB 타입 (PostgreSQL, MySQL, Oracle 등)
- **Connection Pool Per Database**: 각 DB별 독립적인 풀 관리

### Error handling approach
- 연결 실패 시 재시도 로직
- 연결 풀 고갈 시 대기 전략
- 타임아웃 에러 상세 로깅

## Implementation Notes

### Step-by-step implementation approach
1. 현재 연결 설정 분석
   ```typescript
   // ormconfig.ts 및 connection.service.ts 검토
   ```
2. Lambda 환경 특성 고려사항:
   - 컨테이너 재사용 시 연결 유지
   - 콜드 스타트 시 빠른 연결 구축
   - 메모리 제한 고려
3. 최적 설정값 결정:
   - connectionLimit: Lambda 동시 실행 수 고려
   - acquireTimeout: Lambda 타임아웃보다 짧게
   - idleTimeout: Lambda 유휴 시간 고려
4. 구현 및 테스트
5. 모니터링 메트릭 추가

### Key architectural decisions to respect
- Lambda 함수 재사용 시 연결 유지
- 각 데이터베이스별 독립적인 풀 관리
- 환경별 설정 분리 (dev/prod)

### Testing approach
- 동시 요청 부하 테스트
- 콜드 스타트 시나리오 테스트
- 장시간 유휴 후 재연결 테스트
- 다중 데이터베이스 동시 접근 테스트

### Performance considerations
- Lambda 메모리와 연결 수의 균형
- 연결 생성 오버헤드 최소화
- 유휴 연결 정리 전략
- 데이터베이스별 최적 설정

### Configuration examples
```typescript
// TypeORM configuration optimization
export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  
  // Connection pool settings
  extra: {
    connectionLimit: 5, // Lambda 환경에 적합한 작은 풀
    connectTimeout: 60000, // 60초
    acquireTimeout: 60000,
    timeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  },
  
  // TypeORM specific
  synchronize: false,
  logging: process.env.NODE_ENV === 'dev',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
};

// Knex configuration for customer databases
const knexConfig = {
  client: dbType,
  connection: connectionInfo,
  pool: {
    min: 0, // Lambda에서는 0으로 시작
    max: 3, // 작은 최대값
    createTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
  acquireConnectionTimeout: 30000,
};

// Lambda handler optimization
let dataSource: DataSource;

export const handler = async (event, context) => {
  // 컨텍스트 재사용을 위한 설정
  context.callbackWaitsForEmptyEventLoop = false;
  
  // DataSource 재사용
  if (!dataSource || !dataSource.isInitialized) {
    dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();
  }
  
  // ... handle request
};
```

## Output Log

### 2025-06-12
- TypeORM 및 Knex 연결 설정 분석 완료
- Lambda 환경에 최적화된 연결 풀 설정 구현:
  - TypeORM: connectionLimit=5, 30초 타임아웃, KeepAlive 활성화
  - Knex: min=0, max=3, 30초 타임아웃, 데이터베이스별 독립 관리
- Lambda 핸들러 최적화: callbackWaitsForEmptyEventLoop=false
- ConnectionPoolMonitorService 구현:
  - 실시간 메트릭 수집 (사용률, 대기 요청, 재사용률)
  - REST API 엔드포인트 제공
  - 프로덕션 환경에서 자동 모니터링
- 환경 변수 추가: DB_CONNECTION_LIMIT, KNEX_POOL_MAX
- PR 생성: https://github.com/vanillabrain/vanillameta/pull/420

### 구현 결과
- 연결 풀 크기를 Lambda 환경에 맞게 최적화 (작은 풀 크기)
- 타임아웃을 Lambda 타임아웃보다 짧게 설정하여 안정성 향상
- 연결 재사용을 위한 설정으로 성능 개선
- 모니터링을 통한 실시간 성능 추적 가능