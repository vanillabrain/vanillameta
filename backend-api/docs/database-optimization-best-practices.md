# Database-Specific Optimization Best Practices

## 개요

VanillaMeta 백엔드는 다양한 데이터베이스 엔진에 대한 특화된 최적화 기능을 제공합니다. 이 문서는 각 데이터베이스별 최적화 모범 사례를 설명합니다.

## 지원 데이터베이스

- **MySQL/MariaDB**: 트랜잭션 처리, 인덱스 힌트
- **PostgreSQL**: JSON 쿼리, 전문 검색, 윈도우 함수
- **Oracle**: 힌트 기반 최적화, 병렬 처리
- **SQL Server**: Columnstore 인덱스, 격리 수준
- **BigQuery**: 비용 최적화, 파티션 프루닝
- **Snowflake**: 웨어하우스 관리, 클러스터링

## 주요 구성 요소

### 1. DB별 Optimizer 클래스

각 데이터베이스에 대한 전용 optimizer 클래스가 제공됩니다:

- `MySQLOptimizer`: MySQL 특화 최적화
- `PostgreSQLOptimizer`: PostgreSQL 특화 최적화
- `BigQueryOptimizer`: BigQuery 특화 최적화
- `SnowflakeOptimizer`: Snowflake 특화 최적화

### 2. DatabaseSpecificQueryBuilder

통합된 쿼리 최적화 인터페이스를 제공하여 데이터베이스 타입에 따라 적절한 optimizer를 자동 선택합니다.

### 3. 연결 설정 최적화

각 데이터베이스의 특성에 맞는 연결 풀 설정을 자동으로 적용합니다.

## 데이터베이스별 최적화 가이드

### MySQL/MariaDB

**주요 최적화:**
- 배치 삽입: 1000건 단위 청크 처리
- 인덱스 힌트: 적절한 인덱스 강제 사용
- JSON 쿼리: JSON_EXTRACT 함수 활용
- 페이지네이션: 큰 OFFSET 방지

**연결 설정:**
```javascript
{
  pool: { min: 0, max: 10 },
  supportBigNumbers: true,
  bigNumberStrings: true,
  charset: 'utf8mb4'
}
```

### PostgreSQL

**주요 최적화:**
- JSON 연산: GIN 인덱스 활용
- 전문 검색: ts_vector 사용 권장
- 윈도우 함수: 적절한 인덱싱
- CTE: 재귀 쿼리 최적화

**연결 설정:**
```javascript
{
  pool: { min: 0, max: 20 },
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 60000
}
```

### BigQuery

**주요 최적화:**
- 비용 제어: 처리 바이트 수 제한
- 파티션 프루닝: _PARTITIONTIME 필터
- 컬럼 선택: SELECT * 방지
- 슬롯 관리: 복잡한 쿼리에 대한 슬롯 권장

**연결 설정:**
```javascript
{
  pool: { min: 0, max: 5 },
  options: {
    useLegacySql: false,
    useQueryCache: true,
    maximumBillingTier: 1
  }
}
```

### Snowflake

**주요 최적화:**
- 웨어하우스 크기 조정: 쿼리 복잡도에 따른 자동 권장
- 클러스터링 키: WHERE/JOIN 조건 기반 권장
- 결과 캐싱: 반복 쿼리 최적화
- 쿼리 태그: 모니터링 및 추적

**연결 설정:**
```javascript
{
  pool: { min: 0, max: 10 },
  queryTimeout: 300000,
  application: 'VanillaMeta'
}
```

## 사용 방법

### 1. 고급 쿼리 최적화

```typescript
const result = await optimizationService.optimizeQueryAdvanced(
  query,
  database,
  userId
);

console.log('최적화된 쿼리:', result.optimizedQuery);
console.log('적용된 최적화:', result.appliedOptimizations);
console.log('예상 성능 개선:', result.performance.estimatedImprovementPercent);
```

### 2. 배치 작업 최적화

```typescript
await optimizationService.executeBatchOperation(
  knex,
  'insert',
  data,
  tableName,
  engine
);
```

### 3. 쿼리 성능 분석

```typescript
const analysis = await optimizationService.analyzeQueryPerformance(
  query,
  engine,
  knex
);

console.log('복잡도:', analysis.complexity);
console.log('권장사항:', analysis.recommendations);
```

## 성능 모니터링

### 지표 추적

시스템은 다음 지표를 자동으로 추적합니다:

- 쿼리 실행 시간
- 적용된 최적화 수
- 예상 성능 개선율
- 데이터베이스별 연결 상태

### 로깅

최적화 과정은 상세하게 로깅되어 문제 해결과 성능 분석에 활용됩니다:

```typescript
// 최적화 시작 로그
this.logger.debug('Advanced query optimization started', {
  databaseEngine,
  queryType,
  isAnalytical
});

// 최적화 완료 로그  
this.logger.log('Query optimization completed', {
  optimizationsCount,
  improvementPercent
});
```

## 주의사항

### 1. 타입 안정성

BigQuery, Snowflake 등의 연결 설정은 Knex 표준 타입과 다르므로 `as any` 타입 캐스팅을 사용합니다.

### 2. Lambda 환경 고려

AWS Lambda 환경에서는 다음 사항을 고려합니다:
- 작은 연결 풀 크기 (최대 2-10개)
- 짧은 유휴 타임아웃 (30초-5분)
- 연결 재사용 최적화

### 3. 에러 처리

최적화 실패 시 원본 쿼리로 폴백하여 서비스 연속성을 보장합니다.

## 확장성

새로운 데이터베이스 지원을 추가하려면:

1. 새 optimizer 클래스 생성 (`src/common/optimization/optimizers/`)
2. `DatabaseSpecificQueryBuilder`에 케이스 추가
3. `OptimizationModule`에 provider 등록
4. 테스트 코드 작성

## 베스트 프랙티스 요약

1. **데이터베이스별 특성 활용**: 각 DB의 고유 기능을 최대한 활용
2. **비용 최적화**: BigQuery, Snowflake 등에서 비용 제어
3. **성능 모니터링**: 지속적인 성능 측정 및 개선
4. **안전한 폴백**: 최적화 실패 시 원본 쿼리 사용
5. **Lambda 최적화**: 서버리스 환경에 적합한 설정

이 가이드를 따라 각 데이터베이스의 특성에 맞는 최적화를 적용하면 최대 80%까지의 성능 향상을 기대할 수 있습니다.