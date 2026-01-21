<<<<<<< HEAD
# 데이터베이스별 최적화 가이드

이 문서는 VanillaMeta에서 지원하는 각 데이터베이스별 최적화 전략과 베스트 프랙티스를 설명합니다.

## 목차

1. [개요](#개요)
2. [MySQL/MariaDB 최적화](#mysqlmariadb-최적화)
3. [PostgreSQL 최적화](#postgresql-최적화)
4. [BigQuery 최적화](#bigquery-최적화)
5. [Snowflake 최적화](#snowflake-최적화)
6. [일반적인 최적화 원칙](#일반적인-최적화-원칙)
7. [성능 모니터링](#성능-모니터링)

## 개요

VanillaMeta는 다양한 데이터베이스 타입을 지원하며, 각 데이터베이스의 고유한 특성을 활용한 최적화 시스템을 제공합니다.

### 지원되는 데이터베이스

- **관계형 데이터베이스**: MySQL, MariaDB, PostgreSQL, Oracle, SQL Server
- **클라우드 데이터 웨어하우스**: BigQuery, Snowflake
- **분산 데이터베이스**: CockroachDB
- **기타**: SQLite (로컬 개발용)

### 최적화 시스템 구조

```
DatabaseOptimizerFactory
├── MySQLOptimizer
├── PostgreSQLOptimizer  
├── BigQueryOptimizer
├── SnowflakeOptimizer
└── BaseDatabaseOptimizer (기본 구현)
```

## MySQL/MariaDB 최적화

### 연결 설정 최적화

```javascript
// 최적화된 연결 설정
{
  client: 'mysql2',
  connection: {
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: false,
    multipleStatements: false,
    timezone: 'Z',
    charset: 'utf8mb4',
    connectTimeout: 30000,
    enableKeepAlive: true,
    compress: true, // 프로덕션 환경
  },
  pool: {
    min: 0,
    max: 10, // 프로덕션 기준
    afterCreate: (conn, done) => {
      // 세션 최적화
      conn.query("SET SESSION sql_mode='TRADITIONAL'", done);
    }
  }
}
```

### 쿼리 최적화

#### 인덱스 힌트 사용
```sql
SELECT * FROM users USE INDEX (idx_created_at) WHERE created_at > '2024-01-01';
```

#### 배치 삽입 최적화
- **배치 크기**: 1,000개 (최적 크기)
- **INSERT IGNORE** 사용으로 중복 방지
- **ON DUPLICATE KEY UPDATE** 활용

```javascript
// 사용 예제
await mysqlOptimizer.batchInsert(knex, 'users', userData, {
  chunkSize: 1000,
  useIgnore: true
});
```

### 성능 모니터링

#### Performance Schema 활용
```sql
-- 슬로우 쿼리 분석
SELECT digest_text, avg_timer_wait/1000000000 as avg_time_seconds
FROM performance_schema.events_statements_summary_by_digest
WHERE avg_timer_wait/1000000000 > 1
ORDER BY avg_timer_wait DESC;

-- 인덱스 사용률 분석
SELECT object_name, index_name, count_read
FROM performance_schema.table_io_waits_summary_by_index_usage
ORDER BY count_read DESC;
```

### 베스트 프랙티스

1. **InnoDB 엔진 사용**: 트랜잭션과 동시성 지원
2. **적절한 인덱스 설계**: 복합 인덱스 활용
3. **쿼리 캐시 활용**: MySQL 5.7 이하에서 효과적
4. **연결 풀 관리**: 적절한 풀 크기 설정
5. **정기적인 통계 업데이트**: `ANALYZE TABLE` 실행

## PostgreSQL 최적화

### 연결 설정 최적화

```javascript
// 최적화된 연결 설정
{
  client: 'pg',
  connection: {
    ssl: false,
    statement_timeout: 30000,
    idle_in_transaction_session_timeout: 60000,
    application_name: 'vanillameta',
    timezone: 'UTC'
  },
  pool: {
    min: 0,
    max: 20, // PostgreSQL은 더 많은 연결 지원
    afterCreate: async (conn, done) => {
      // 세션 최적화
      await conn.query('SET random_page_cost = 1.1'); // SSD 최적화
      await conn.query('SET work_mem = \'4MB\'');
      done(null, conn);
    }
  },
  searchPath: ['public']
}
```

### 고급 기능 활용

#### JSON 쿼리 최적화
```sql
-- JSONB 인덱스 활용
SELECT * FROM users WHERE metadata->>'status' = 'active';

-- 배열 연산
SELECT * FROM tags WHERE tag_list && ARRAY['postgresql', 'optimization'];
```

#### 배치 처리 최적화
- **배치 크기**: 2,000개 (PostgreSQL은 더 큰 배치 지원)
- **COPY 명령**: 대용량 데이터 삽입시 최적
- **INSERT ... ON CONFLICT**: UPSERT 패턴

```javascript
// COPY를 사용한 고속 삽입
await postgresOptimizer.batchInsert(knex, 'events', eventData, {
  chunkSize: 5000,
  useCopy: true
});
```

### 성능 분석

#### EXPLAIN ANALYZE 활용
```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '1 day';
```

#### pg_stat_statements 활용
```sql
-- 슬로우 쿼리 분석
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements 
WHERE mean_time > 1000
ORDER BY mean_time DESC;
```

### 베스트 프랙티스

1. **VACUUM과 ANALYZE**: 정기적인 실행으로 성능 유지
2. **부분 인덱스**: 조건부 인덱스로 공간 절약
3. **파티셔닝**: 대용량 테이블 분할
4. **연결 풀링**: PgBouncer 등 활용
5. **통계 수집**: pg_stat_* 뷰 모니터링

## BigQuery 최적화

### 연결 설정 최적화

```javascript
// 최적화된 연결 설정
{
  client: BigQueryClient,
  connection: {
    projectId: 'your-project',
    location: 'US',
    autoRetry: true,
    maxRetries: 3,
    maxResults: 10000,
    timeoutMs: 300000
  },
  pool: {
    min: 0,
    max: 5, // API 호출 제한 고려
    acquireTimeoutMillis: 300000
=======
# Database-Specific Optimization Guide

VanillaMeta에서 지원하는 각 데이터베이스별 최적화 전략과 설정에 대한 가이드입니다.

## 개요

VanillaMeta는 다양한 데이터베이스를 지원하며, 각 데이터베이스의 특성에 맞는 최적화를 제공합니다.

### 지원 데이터베이스

- **관계형 데이터베이스**: MySQL/MariaDB, PostgreSQL, Oracle
- **클라우드 데이터 웨어하우스**: BigQuery, Snowflake
- **기타**: CockroachDB, SQL Server, SQLite

## 데이터베이스별 최적화

### 1. MySQL/MariaDB

#### 특징
- 높은 성능과 안정성
- 트랜잭션 지원 (InnoDB)
- JSON 데이터 타입 지원 (5.7+)

#### 최적화 설정
```typescript
{
  connectionConfig: {
    client: 'mysql2',
    connection: {
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      charset: 'utf8mb4',
      timezone: '+09:00',
    },
    pool: {
      min: 0,
      max: 10,
      idleTimeoutMillis: 300000, // 5분
    }
  },
  performanceSettings: {
    batchSize: 1000,
    queryTimeout: 30000,
    maxConnections: 10,
>>>>>>> task/T07_S03
  }
}
```

<<<<<<< HEAD
### 비용 최적화

#### 쿼리 비용 제어
```javascript
// 비용 제한 쿼리
await bigQueryOptimizer.queryWithCostControl(knex, query, '1000000000'); // 1GB 제한
```

#### 파티션 활용
```sql
-- 파티션 테이블 생성
CREATE TABLE dataset.events_partitioned
PARTITION BY DATE(created_at)
CLUSTER BY user_id, event_type
AS SELECT * FROM dataset.events;

-- 파티션 필터 사용
SELECT * FROM dataset.events_partitioned 
WHERE _PARTITIONDATE = '2024-01-01';
```

### 배치 처리

- **배치 크기**: 5,000개 (더 큰 배치 지원)
- **스트리밍 삽입**: 실시간 데이터용
- **MERGE 문**: UPSERT 패턴

```javascript
// 스트리밍 삽입
await bigQueryOptimizer.batchInsert(knex, 'events', eventData, {
  chunkSize: 5000,
  useStreaming: true,
  ignoreUnknownValues: true
});
```

### 베스트 프랙티스

1. **파티셔닝과 클러스터링**: 스캔 비용 절약
2. **쿼리 캐싱**: 결과 재사용
3. **배치 작업**: BATCH 우선순위 사용
4. **비용 모니터링**: maximumBytesBilled 설정
5. **슬롯 관리**: 예약 슬롯 활용

## Snowflake 최적화

### 연결 설정 최적화

```javascript
// 최적화된 연결 설정
{
  client: SnowflakeDialect,
  connection: {
    account: 'your-account',
    warehouse: 'COMPUTE_WH',
    database: 'ANALYTICS',
    schema: 'PUBLIC',
    clientSessionKeepAlive: true,
    useCompression: true,
    maxRetries: 3
  },
  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 300000 // 세션 유지
=======
#### 성능 힌트
- **인덱싱**: WHERE 절에 사용되는 컬럼에 인덱스 생성
- **쿼리 최적화**: SELECT * 대신 필요한 컬럼만 지정
- **배치 처리**: 1000개 단위로 배치 삽입
- **JOIN 최적화**: 작은 테이블을 먼저 배치

#### 특화 기능
- ✅ JSON 연산 (5.7+)
- ✅ 파티셔닝
- ✅ UPSERT (INSERT ... ON DUPLICATE KEY UPDATE)
- ✅ 벌크 삽입
- ❌ 배열 연산

### 2. PostgreSQL

#### 특징
- 고급 SQL 기능 지원
- JSON/JSONB 및 배열 지원
- 확장성과 커스터마이징

#### 최적화 설정
```typescript
{
  connectionConfig: {
    client: 'pg',
    connection: {
      statement_timeout: 30000,
      idle_in_transaction_session_timeout: 60000,
      timezone: 'Asia/Seoul',
    },
    pool: {
      min: 0,
      max: 20, // PostgreSQL은 더 많은 연결 처리 가능
      idleTimeoutMillis: 300000,
    },
    searchPath: ['public'],
  },
  performanceSettings: {
    batchSize: 5000,
    queryTimeout: 30000,
    maxConnections: 20,
>>>>>>> task/T07_S03
  }
}
```

<<<<<<< HEAD
### 웨어하우스 관리

#### 적응형 웨어하우스 사용
```javascript
// 쿼리 크기에 따른 웨어하우스 선택
await snowflakeOptimizer.executeWithWarehouse(knex, complexQuery, 'LARGE');
```

#### 결과 캐싱
```javascript
// 24시간 캐시
await snowflakeOptimizer.queryWithCache(knex, query, 86400);
```

### 배치 처리

- **배치 크기**: 10,000개 (가장 큰 배치 지원)
- **COPY INTO**: 대용량 로딩
- **MERGE**: 효율적인 UPSERT

```javascript
// 대용량 벌크 로딩
await snowflakeOptimizer.batchInsert(knex, 'events', eventData, {
  chunkSize: 10000,
  useBulkLoad: true,
  warehouse: 'LARGE'
});
```

### 베스트 프랙티스

1. **자동 클러스터링**: 대용량 테이블에 적용
2. **Time Travel**: 데이터 복구 활용
3. **웨어하우스 크기 조정**: 워크로드에 맞는 크기
4. **멀티 클러스터**: 동시성 처리
5. **크레딧 모니터링**: 비용 관리

## 일반적인 최적화 원칙

### 1. 연결 풀 관리

```javascript
// 환경별 최적 설정
const poolConfig = {
  local: { min: 0, max: 2 },
  dev: { min: 0, max: 5 },
  prod: { min: 0, max: 20 }
};
```

### 2. 배치 처리 전략

| 데이터베이스 | 최적 배치 크기 | 특수 기능 |
|-------------|--------------|-----------|
| MySQL | 1,000 | INSERT IGNORE |
| PostgreSQL | 2,000 | COPY, UPSERT |
| BigQuery | 5,000 | 스트리밍 삽입 |
| Snowflake | 10,000 | COPY INTO |

### 3. 쿼리 최적화

- **인덱스 활용**: 적절한 인덱스 생성
- **LIMIT 사용**: 대용량 결과 제한
- **조건 최적화**: WHERE 절 효율화
- **조인 최적화**: 적절한 조인 순서

### 4. 모니터링 지표

- **연결 수**: 활성/대기 연결 모니터링
- **쿼리 실행 시간**: 슬로우 쿼리 감지
- **에러율**: 연결/쿼리 실패율
- **처리량**: 초당 처리 쿼리 수

## 성능 모니터링

### 1. SlowQueryMonitor 활용

```javascript
// 슬로우 쿼리 분석
const slowQueries = await slowQueryMonitorService.getSlowQueryStats(24);
console.log('슬로우 쿼리 통계:', slowQueries);
```

### 2. CloudWatch 메트릭

- **SlowQueryCount**: 슬로우 쿼리 개수
- **SlowQueryExecutionTime**: 평균 실행 시간
- **SlowQueryBySeverity**: 심각도별 분포
- **SlowQueryByDatabase**: DB별 성능

### 3. 데이터베이스별 통계

```javascript
// 성능 메트릭 수집
const metrics = await databaseOptimizerFactory.getPerformanceMetrics(
  databaseType, 
  knexInstance
);
```

## 문제 해결 가이드

### 1. 연결 문제

**증상**: 연결 타임아웃, 연결 풀 고갈
**해결책**:
- 연결 풀 크기 조정
- 타임아웃 설정 검토
- 네트워크 상태 확인

### 2. 성능 문제

**증상**: 쿼리 실행 시간 증가
**해결책**:
- 인덱스 추가/최적화
- 쿼리 실행 계획 분석
- 배치 크기 조정

### 3. 메모리 문제

**증상**: Out of Memory 에러
**해결책**:
- 배치 크기 감소
- 연결 풀 크기 조정
- 메모리 사용량 모니터링

## 설정 예제

### 환경 변수

```bash
# MySQL 최적화
MYSQL_POOL_MAX=10
MYSQL_BATCH_SIZE=1000

# PostgreSQL 최적화  
PG_POOL_MAX=20
PG_WORK_MEM=4MB

# BigQuery 최적화
BIGQUERY_MAX_COST_BYTES=1000000000
BIGQUERY_LOCATION=US

# Snowflake 최적화
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_CACHE_TTL=86400

# 일반 설정
SLOW_QUERY_THRESHOLD=1000
NODE_ENV=production
```

### 런타임 설정

```javascript
// 최적화 레벨 설정
const optimizer = databaseOptimizerFactory.getOptimizer('mysql');
const optimizedQuery = optimizer.optimizeQuery(queryBuilder, {
  useIndex: 'idx_created_at',
  sqlCalcFoundRows: true
});
```

## 마무리

이 가이드를 통해 각 데이터베이스별로 최적화된 성능을 얻을 수 있습니다. 지속적인 모니터링과 튜닝을 통해 시스템 성능을 유지하시기 바랍니다.

더 자세한 정보는 각 데이터베이스 공식 문서를 참조하시기 바랍니다.
=======
#### 성능 힌트
- **인덱싱**: JSON 컬럼에 GIN 인덱스 생성
- **배열 인덱싱**: 배열 컬럼에 GIN 인덱스 생성
- **CTE 활용**: 복잡한 쿼리를 Common Table Expression으로 단순화
- **EXPLAIN ANALYZE**: 쿼리 실행 계획 분석
- **부분 인덱스**: 조건부 인덱스로 크기 최적화

#### 특화 기능
- ✅ JSON/JSONB 연산
- ✅ 배열 연산
- ✅ 윈도우 함수
- ✅ CTE (Common Table Expression)
- ✅ 머티리얼라이즈드 뷰
- ✅ 전문 검색
- ✅ 지리 정보 시스템 (PostGIS)

### 3. BigQuery

#### 특징
- 구글 클라우드의 서버리스 데이터 웨어하우스
- 페타바이트 규모 분석
- 비용은 처리된 데이터량 기준

#### 최적화 설정
```typescript
{
  connectionConfig: {
    client: require('knex-bigquery'),
    connection: {
      projectId: process.env.BIGQUERY_PROJECT_ID,
      useLegacySql: false,
      useQueryCache: true,
      maximumBillingTier: 1,
    },
    pool: {
      min: 0,
      max: 5, // API 제한으로 낮은 수
      idleTimeoutMillis: 600000, // 10분
    }
  },
  performanceSettings: {
    batchSize: 1000,
    queryTimeout: 300000, // 5분
    maxConnections: 5,
  }
}
```

#### 성능 힌트
- **파티션 필터**: `_PARTITIONTIME`을 사용하여 스캔 비용 절감
- **컬럼 선택**: SELECT * 대신 필요한 컬럼만 선택
- **클러스터링**: 자주 사용되는 컬럼으로 클러스터링
- **APPROX 함수**: 대용량 집계에 근사 함수 사용
- **머티리얼라이즈드 뷰**: 반복 쿼리 최적화

#### 특화 기능
- ✅ JSON 연산
- ✅ 배열 연산
- ✅ 윈도우 함수
- ✅ 파티셔닝 (날짜 기반)
- ✅ 클러스터링
- ✅ 스트리밍 삽입
- ❌ 전통적인 UPSERT (MERGE 사용)

### 4. Snowflake

#### 특징
- 클라우드 네이티브 데이터 웨어하우스
- 자동 스케일링
- 웨어하우스 크기별 비용 책정

#### 최적화 설정
```typescript
{
  connectionConfig: {
    client: require('../knex-dialects/snowflake'),
    connection: {
      warehouse: 'COMPUTE_WH',
      clientSessionKeepAlive: true,
      timezone: 'Asia/Seoul',
    },
    pool: {
      min: 0,
      max: 10,
      idleTimeoutMillis: 600000, // 10분
    },
    options: {
      autoResume: true,
      autoSuspend: 600, // 10분 후 자동 일시정지
      useCache: true,
    }
  },
  performanceSettings: {
    batchSize: 10000,
    queryTimeout: 300000, // 5분
    maxConnections: 10,
  }
}
```

#### 성능 힌트
- **클러스터링 키**: 자주 필터링되는 컬럼에 클러스터링 설정
- **웨어하우스 크기**: 쿼리 복잡도에 따른 적절한 크기 선택
- **자동 클러스터링**: 대용량 테이블에 자동 클러스터링 활성화
- **결과 캐싱**: 동일한 쿼리 결과 재사용
- **COPY INTO**: 대용량 데이터 로드

#### 특화 기능
- ✅ JSON 연산
- ✅ 배열 연산
- ✅ 윈도우 함수
- ✅ 파티셔닝
- ✅ 클러스터링 (자동)
- ✅ MERGE (UPSERT)
- ✅ 스트리밍

### 5. Oracle Database

#### 특징
- 엔터프라이즈급 기능
- 고급 옵티마이저
- 강력한 PL/SQL

#### 최적화 설정
```typescript
{
  connectionConfig: {
    client: 'oracledb',
    connection: {
      connectTimeout: 30000,
      callTimeout: 30000,
    },
    pool: {
      min: 0,
      max: 15,
      idleTimeoutMillis: 600000, // 10분
    },
    options: {
      autoCommit: false,
      maxRows: 1000,
      prefetchRows: 100,
    }
  },
  performanceSettings: {
    batchSize: 1000,
    queryTimeout: 30000,
    maxConnections: 15,
  }
}
```

#### 성능 힌트
- **옵티마이저 힌트**: INDEX, FIRST_ROWS 등 힌트 활용
- **실행 계획**: EXPLAIN PLAN으로 쿼리 분석
- **파티셔닝**: 대용량 테이블의 범위/해시 파티셔닝
- **MERGE 문**: UPSERT 연산 최적화
- **배열 DML**: 배치 처리 성능 향상

#### 특화 기능
- ✅ JSON 연산 (12c+)
- ✅ 윈도우 함수
- ✅ 파티셔닝
- ✅ MERGE (UPSERT)
- ✅ 저장 프로시저
- ✅ 벌크 삽입
- ❌ 배열 연산

## 환경별 최적화

### Local Development
```typescript
{
  poolSize: 0.3,        // 30% 연결 풀
  queryTimeout: 10000,  // 10초
  batchSize: 0.1,       // 10% 배치 크기
  enableLogging: true,
  enableProfiling: true,
}
```

### Development Environment
```typescript
{
  poolSize: 0.7,        // 70% 연결 풀
  queryTimeout: 30000,  // 30초
  batchSize: 0.5,       // 50% 배치 크기
  enableLogging: true,
  enableProfiling: true,
}
```

### Production Environment
```typescript
{
  poolSize: 1.0,        // 100% 연결 풀
  queryTimeout: 30000,  // 30초
  batchSize: 1.0,       // 100% 배치 크기
  enableLogging: false,
  enableProfiling: false,
}
```

## Lambda 최적화

### 연결 풀 설정
- **최소 연결**: 0 (콜드 스타트 최적화)
- **최대 연결**: 메모리 크기 기반 조정
- **유휴 타임아웃**: 30초-5분
- **컨텍스트 재사용**: `callbackWaitsForEmptyEventLoop = false`

### 메모리 기반 조정
```typescript
const memoryMB = parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) || 512;
const memoryMultiplier = Math.min(memoryMB / 512, 3.0);
const maxConnections = Math.ceil(baseMax * envMultiplier * memoryMultiplier);
```

## 성능 모니터링

### 주요 메트릭
- **연결 풀 사용률**: 활성/유휴 연결 수
- **쿼리 실행 시간**: 평균/최대 실행 시간
- **슬로우 쿼리**: 임계값 초과 쿼리
- **에러율**: 연결/쿼리 실패율
- **처리량**: 초당 쿼리 수

### CloudWatch 통합
- 자동 메트릭 전송
- 슬로우 쿼리 알람
- 연결 풀 모니터링
- 에러 추적

## 사용법

### 테스트 스크립트 실행
```bash
# 전체 데이터베이스 최적화 테스트
npm run test:db-optimizations

# 특정 데이터베이스 테스트
npm run test:db-optimizations mysql
npm run test:db-optimizations postgresql
npm run test:db-optimizations bigquery
```

### 최적화 설정 확인
```typescript
import { DatabaseOptimizerFactory } from './optimizers/database-optimizer.factory';

const factory = new DatabaseOptimizerFactory(...);
const optimizer = factory.getOptimizer('mysql');

if (optimizer) {
  const hints = optimizer.getPerformanceHints();
  const batchSize = optimizer.getBatchSize();
  const features = optimizer.supportsFeature(DatabaseFeature.JSON_OPERATIONS);
}
```

## 트러블슈팅

### 일반적인 문제

1. **연결 타임아웃**
   - 연결 풀 설정 확인
   - 네트워크 지연 시간 점검
   - 데이터베이스 서버 상태 확인

2. **슬로우 쿼리**
   - EXPLAIN 계획 분석
   - 인덱스 추가 검토
   - 쿼리 최적화 적용

3. **메모리 부족**
   - Lambda 메모리 크기 증가
   - 연결 풀 크기 조정
   - 배치 크기 감소

### 로그 분석
```bash
# 연결 풀 메트릭 확인
grep "Connection pool metrics" /var/log/lambda.log

# 슬로우 쿼리 확인
grep "Slow query detected" /var/log/lambda.log

# 최적화 적용 확인
grep "Applied database-specific optimization" /var/log/lambda.log
```

## 베스트 프랙티스

1. **연결 관리**
   - 연결 풀 재사용
   - 적절한 타임아웃 설정
   - 유휴 연결 정리

2. **쿼리 최적화**
   - 인덱스 활용
   - 배치 처리
   - 결과 제한

3. **모니터링**
   - 성능 메트릭 추적
   - 알람 설정
   - 정기적인 최적화 검토

4. **보안**
   - SQL 인젝션 방지
   - 파라미터화된 쿼리
   - 접근 권한 최소화
>>>>>>> task/T07_S03
