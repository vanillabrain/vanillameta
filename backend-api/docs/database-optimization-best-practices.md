# 데이터베이스별 최적화 베스트 프랙티스 가이드

## 개요

VanillaMeta는 다양한 데이터베이스를 지원하며, 각 데이터베이스의 고유한 특성을 활용한 최적화 전략을 제공합니다.

## 지원 데이터베이스

- MySQL/MariaDB
- PostgreSQL 
- Oracle
- SQL Server
- BigQuery
- Snowflake

## 1. MySQL/MariaDB 최적화

### 연결 설정
```typescript
const optimizedConfig = {
  client: 'mysql2',
  connection: {
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: false,
    multipleStatements: false,
    charset: 'utf8mb4',
    timezone: 'Z',
    enableKeepAlive: true,
    compress: true, // 프로덕션에서 사용
  },
  pool: {
    min: 0,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  }
};
```

### 쿼리 최적화
- **인덱스 힌트 사용**: 복잡한 조인에서 특정 인덱스 강제 사용
- **배치 크기**: 1,000건씩 처리 (INSERT IGNORE 활용)
- **세션 설정**: `sql_mode='TRADITIONAL'`, `innodb_lock_wait_timeout=10`

### 성능 모니터링
```sql
-- 슬로우 쿼리 확인
SELECT digest_text, count_star, avg_timer_wait/1000000000 as avg_time_seconds
FROM performance_schema.events_statements_summary_by_digest
WHERE avg_timer_wait/1000000000 > 1
ORDER BY avg_timer_wait DESC;
```

## 2. PostgreSQL 최적화

### 연결 설정
```typescript
const optimizedConfig = {
  client: 'pg',
  connection: {
    ssl: false,
    statement_timeout: 30000,
    idle_in_transaction_session_timeout: 60000,
    application_name: 'vanillameta',
    timezone: 'UTC',
  },
  pool: {
    min: 0,
    max: 20, // PostgreSQL은 많은 연결을 효율적으로 처리
  },
  searchPath: ['public'],
};
```

### 고급 기능 활용
- **JSON 연산**: `jsonb_path_query`로 복잡한 JSON 쿼리 최적화
- **배열 연산**: `&&` 연산자로 배열 교집합 검사
- **COPY 명령**: 50,000건 이상 대용량 삽입 시 사용
- **파티션 제거**: WHERE 절에 파티션 키 필수 포함

### 성능 설정
```sql
-- 세션별 최적화
SET random_page_cost = 1.1; -- SSD 환경
SET effective_cache_size = '256MB';
SET work_mem = '4MB';
SET maintenance_work_mem = '64MB';
```

## 3. Oracle 최적화

### 연결 설정
```typescript
const optimizedConfig = {
  client: 'oracledb',
  connection: {
    connectTimeout: 30000,
    fetchArraySize: 10000,
    poolMin: 0,
    poolMax: 15,
    poolTimeout: 60,
    enableStatistics: true,
  }
};
```

### 최적화 기법
- **힌트 사용**: `/*+ PARALLEL(4) */`, `/*+ FIRST_ROWS(10) */`
- **Array Insert**: 대용량 삽입 시 배열 바인딩 사용
- **병렬 DML**: 50,000건 이상 처리 시 `ENABLE PARALLEL DML`
- **MERGE 문**: UPSERT 작업에 효율적

### 성능 분석
```sql
-- 실행 계획 분석
EXPLAIN PLAN FOR SELECT ...;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY());

-- 세션 통계
SELECT name, value FROM v$sesstat s, v$statname n 
WHERE s.statistic# = n.statistic# 
AND s.sid = SYS_CONTEXT('USERENV', 'SID');
```

## 4. SQL Server 최적화

### 연결 설정
```typescript
const optimizedConfig = {
  client: 'mssql',
  connection: {
    options: {
      encrypt: true, // 프로덕션
      trustServerCertificate: false,
      connectionTimeout: 30000,
      requestTimeout: 60000,
      packetSize: 32768, // 32KB
      isolationLevel: 'READ_COMMITTED',
    }
  }
};
```

### 최적화 전략
- **인덱스 힌트**: `WITH (INDEX(idx_name))`, `WITH (NOLOCK)`
- **BULK INSERT**: 10,000건 이상 처리 시 사용
- **MERGE 문**: 복잡한 UPSERT 로직에 최적
- **병렬 처리**: `OPTION (MAXDOP 4)`

### 모니터링
```sql
-- 슬로우 쿼리 분석
SELECT TOP 50 qs.avg_elapsed_time, st.text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY qs.avg_elapsed_time DESC;

-- 인덱스 조각화 확인
SELECT avg_fragmentation_in_percent, fragment_count
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED');
```

## 5. BigQuery 최적화

### 연결 설정
```typescript
const optimizedConfig = {
  connection: {
    projectId: process.env.BIGQUERY_PROJECT_ID,
    location: 'US',
    autoRetry: true,
    maxRetries: 3,
    totalTimeout: 300000,
    maxResults: 10000,
  },
  pool: {
    max: 5, // API 호출 제한 고려
    acquireTimeoutMillis: 300000,
  }
};
```

### 비용 최적화
- **파티션 필터**: `_PARTITIONDATE` 필수 사용
- **클러스터링**: 자주 조인되는 컬럼으로 클러스터 생성
- **비용 제한**: `maximumBytesBilled` 설정으로 예산 관리
- **쿼리 캐시**: `useQueryCache: true`로 반복 쿼리 최적화

### 파티션 테이블 생성
```sql
CREATE TABLE `dataset.table_name`
PARTITION BY DATE(created_at)
CLUSTER BY user_id, status
AS SELECT * FROM `dataset.source_table`;
```

## 6. Snowflake 최적화

### 연결 설정
```typescript
const optimizedConfig = {
  connection: {
    account: process.env.SNOWFLAKE_ACCOUNT,
    warehouse: 'COMPUTE_WH',
    clientSessionKeepAlive: true,
    clientSessionKeepAliveHeartbeatFrequency: 3600,
    useCompression: true,
    maxRetries: 3,
  }
};
```

### 웨어하우스 관리
- **동적 스케일링**: 쿼리 복잡도에 따라 웨어하우스 크기 조정
- **멀티 클러스터**: `MULTI_CLUSTER_WAREHOUSE_SCALING_POLICY = STANDARD`
- **자동 중단**: 유휴 시간 최소화로 비용 절약
- **결과 캐싱**: `USE_CACHED_RESULT = TRUE`

### 대용량 처리
```sql
-- 웨어하우스 전환
USE WAREHOUSE LARGE_WH;

-- COPY INTO를 사용한 대용량 로딩
COPY INTO table_name
FROM @stage_name
FILE_FORMAT = (TYPE = 'CSV' FIELD_DELIMITER = ',')
ON_ERROR = 'CONTINUE';
```

## 공통 최적화 원칙

### 1. 쿼리 최적화
- **SELECT * 피하기**: 필요한 컬럼만 선택
- **WHERE 절 최적화**: 인덱스 활용 가능한 조건 우선 배치
- **LIMIT 사용**: 페이지네이션으로 메모리 사용량 제한
- **JOIN 순서**: 작은 테이블을 먼저 조인

### 2. 인덱스 전략
- **복합 인덱스**: WHERE, ORDER BY 절의 컬럼 순서 고려
- **커버링 인덱스**: SELECT 절의 모든 컬럼 포함
- **파티션 인덱스**: 대용량 테이블의 파티션별 인덱스

### 3. 연결 관리
- **풀 크기**: 환경별 적절한 연결 수 설정
- **타임아웃**: 데드락 방지를 위한 적절한 타임아웃
- **Keep-Alive**: 연결 재사용을 통한 성능 향상

### 4. 배치 처리
- **청크 크기**: 데이터베이스별 최적 배치 크기 적용
- **트랜잭션**: 적절한 크기의 트랜잭션으로 메모리 사용량 관리
- **병렬 처리**: CPU 코어 수와 데이터베이스 특성 고려

### 5. 모니터링
- **슬로우 쿼리**: 1초 이상 쿼리 자동 감지
- **성능 메트릭**: 처리량, 응답시간, 오류율 추적
- **리소스 사용량**: CPU, 메모리, 디스크 I/O 모니터링

## 환경별 설정

### 개발 환경
```typescript
const devConfig = {
  pool: { min: 0, max: 5 },
  debug: true,
  enableLogging: true,
  connectionTimeout: 30000,
};
```

### 프로덕션 환경
```typescript
const prodConfig = {
  pool: { min: 0, max: 20 },
  debug: false,
  enableLogging: false,
  connectionTimeout: 10000,
  enableCompression: true,
};
```

## 성능 벤치마킹

시스템에서 제공하는 성능 비교 도구를 사용하여 데이터베이스별 성능을 측정할 수 있습니다:

```typescript
// 성능 비교 실행
const comparator = new DatabasePerformanceComparatorService();
const benchmarkResult = await comparator.benchmarkQueries(
  ['SELECT COUNT(*) FROM users', 'SELECT * FROM orders LIMIT 1000'],
  [
    { knex: mysqlKnex, type: 'mysql', name: 'MySQL-Prod' },
    { knex: pgKnex, type: 'postgresql', name: 'PostgreSQL-Prod' },
  ]
);
```

## 문제 해결 가이드

### 일반적인 성능 문제
1. **슬로우 쿼리**: 인덱스 추가, 쿼리 구조 개선
2. **연결 풀 고갈**: 풀 크기 증가, 연결 누수 확인
3. **메모리 부족**: 배치 크기 감소, 스트리밍 사용
4. **타임아웃**: 쿼리 최적화, 타임아웃 값 조정

### 데이터베이스별 특수 문제
- **MySQL**: `max_connections` 초과 시 연결 풀 설정 확인
- **PostgreSQL**: `idle_in_transaction` 상태의 연결 정리
- **Oracle**: `ORA-01013` 에러 시 쿼리 타임아웃 증가
- **BigQuery**: 비용 초과 시 파티션 필터 확인
- **Snowflake**: 웨어하우스 크기 부족 시 스케일 업

이 가이드를 따라 각 데이터베이스의 특성을 최대한 활용하여 최적의 성능을 달성할 수 있습니다.