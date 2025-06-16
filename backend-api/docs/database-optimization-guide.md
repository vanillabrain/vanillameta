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
  }
}
```

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
  }
}
```

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