# Database-Specific Optimizations (T07_S03)

## 개요
VanillaMeta 백엔드 API를 위한 종합적인 데이터베이스 최적화 시스템입니다. 이 모듈은 다양한 데이터베이스 엔진(PostgreSQL, MySQL, SQL Server, Oracle, BigQuery, Snowflake 등)에 대해 특화된 최적화 기능을 제공합니다.

## 주요 기능

### 🚀 DatabaseSpecificOptimizationService
- **6가지 주요 데이터베이스 엔진 지원**: PostgreSQL, MySQL, SQL Server, Oracle, BigQuery, Snowflake
- **엔진별 최적화 규칙**: 각 데이터베이스의 특성에 맞는 쿼리 최적화
- **동적 연결 풀 설정**: 프로덕션/개발 환경 및 Lambda 환경에 최적화된 설정
- **캐시 설정 관리**: 엔진별 특화된 캐시 전략

### 🎯 QueryCacheService
- **LRU 캐시 구현**: 메모리 효율적인 쿼리 결과 캐싱
- **지능형 무효화**: 데이터 변경 쿼리 감지 및 자동 캐시 무효화
- **엔진별 캐시 전략**: 각 데이터베이스의 특성에 맞는 TTL 및 크기 설정
- **실시간 통계**: 히트율, 메모리 사용량, 성능 메트릭 제공

### 🔄 EnhancedConnectionPoolService
- **지능형 풀 관리**: 사용 패턴 기반 동적 풀 크기 조정
- **실시간 모니터링**: 연결 획득 시간, 사용률, 성능 히스토리 추적
- **자동 최적화**: 성능 이슈 감지 및 자동 풀 설정 조정
- **헬스 체크**: 주기적인 풀 상태 검사 및 문제 감지

### 📊 IndexRecommendationService
- **테이블 분석**: 컬럼 통계, 카디널리티, 사용 패턴 분석
- **인덱스 추천**: 쿼리 패턴 기반 최적 인덱스 제안
- **중복 인덱스 탐지**: 불필요한 인덱스 식별 및 정리 권장
- **성능 영향 예측**: 인덱스 추가/제거의 성능 영향 계산

### 🧠 EnhancedQueryOptimizerService
- **통합 최적화**: 모든 최적화 서비스를 통합한 원스톱 솔루션
- **세션 관리**: 최적화 세션별 통계 및 성능 추적
- **고급 최적화 전략**: 테이블 크기, 실행 시간 기반 동적 최적화
- **종합 보고서**: 데이터베이스별 최적화 현황 및 권장사항 제공

## 지원 데이터베이스

### PostgreSQL
- **고급 인덱싱**: GIN, GIST 인덱스 활용
- **JSON 최적화**: JSON 연산자 사용 시 최적화
- **파티션 힌트**: 대용량 테이블 파티션 최적화

### MySQL
- **InnoDB 최적화**: 스토리지 엔진 특화 설정
- **인덱스 힌트**: FORCE INDEX 활용
- **LIMIT 최적화**: 큰 LIMIT 값 자동 조정

### SQL Server
- **Columnstore 인덱스**: 분석 쿼리 최적화
- **NOLOCK 힌트**: 읽기 성능 향상 (선택적)
- **쿼리 스토어**: 실행 계획 캐싱 활용

### Oracle
- **옵티마이저 힌트**: FIRST_ROWS, PARALLEL 힌트
- **함수 기반 인덱스**: 계산 컬럼 인덱싱
- **파티션 pruning**: 파티션 제거 최적화

### BigQuery
- **파티션 필터링**: _PARTITIONTIME 자동 추가
- **SELECT 최적화**: 컬럼 기반 과금 최적화
- **장기 캐싱**: 2시간 TTL 설정

### Snowflake
- **웨어하우스 최적화**: 쿼리 복잡도별 웨어하우스 권장
- **클러스터링 힌트**: 클러스터링 키 활용 권장
- **제로 카피**: 데이터 복제 최소화

## 사용법

### 기본 사용
```typescript
import { EnhancedQueryOptimizerService } from './enhanced-query-optimizer.service';

// 쿼리 최적화
const result = await queryOptimizer.optimizeQuery(
  knexInstance,
  database,
  'SELECT * FROM users WHERE email = ?',
  ['user@example.com'],
  'session-id'
);

console.log('최적화된 쿼리:', result.optimizedQuery);
console.log('적용된 최적화:', result.analysis.optimizations.appliedRules);
console.log('권장사항:', result.recommendations);
```

### 캐시 관리
```typescript
import { QueryCacheService } from './query-cache.service';

// 캐시 통계 조회
const stats = cacheService.getStats('pg');
console.log('히트율:', stats.hitRate);
console.log('메모리 사용량:', stats.memoryUsage);

// 캐시 설정 업데이트
await cacheService.updateCacheConfig('pg', {
  maxSize: 1000,
  ttl: 3600,
});
```

### 인덱스 분석
```typescript
import { IndexRecommendationService } from './index-recommendation.service';

// 테이블 분석 및 인덱스 추천
const report = await indexService.analyzeAndRecommend(
  knexInstance,
  'pg',
  'users',
  ['SELECT * FROM users WHERE email = ?']
);

console.log('추천 인덱스:', report.recommendations);
console.log('중복 인덱스:', report.redundantIndexes);
console.log('성능 영향:', report.performanceImpact);
```

### 연결 풀 모니터링
```typescript
import { EnhancedConnectionPoolService } from './enhanced-connection-pool.service';

// 풀 상태 확인
const status = poolService.getPoolStatus(databaseId);
console.log('풀 건강도:', status.isHealthy);
console.log('문제점:', status.issues);
console.log('권장사항:', status.recommendations);

// 성능 히스토리
const history = poolService.getPerformanceHistory(databaseId);
console.log('평균 연결 획득 시간:', 
  history.reduce((sum, h) => sum + h.acquireTime, 0) / history.length
);
```

## API 엔드포인트

### 최적화 설정 조회
```http
GET /optimization/engines/pg/config
GET /optimization/engines/mysql2/pool-config?production=true
```

### 캐시 관리
```http
GET /optimization/cache/stats?engine=pg
POST /optimization/cache/config
POST /optimization/cache/clear?engine=pg
GET /optimization/cache/diagnostics
```

### 풀 모니터링
```http
GET /optimization/pool/stats?databaseId=1
POST /optimization/pool/1/refresh
GET /optimization/pool/1/performance
```

### 최적화 보고서
```http
GET /optimization/reports/1
GET /optimization/sessions?sessionId=session-123
GET /optimization/engines/supported
```

## 성능 특징

### 메모리 사용량
- **캐시 크기**: 엔진별 100MB 제한
- **LRU 정책**: 자동 메모리 관리
- **압축**: 큰 결과셋 압축 저장

### 응답 시간
- **캐시 히트**: 1-5ms
- **최적화 처리**: 10-50ms
- **인덱스 분석**: 100-500ms

### 확장성
- **다중 데이터베이스**: 동시 처리 지원
- **세션 격리**: 사용자별 독립적 처리
- **비동기 처리**: 논블로킹 최적화

## 모니터링 및 알림

### 로깅
- **구조화된 로그**: JSON 형태의 상세 로그
- **성능 메트릭**: 실행 시간, 메모리 사용량 추적
- **오류 추적**: 최적화 실패 및 원인 분석

### 알림
- **슬로우 쿼리**: 1초 이상 쿼리 감지
- **높은 풀 사용률**: 80% 이상 사용 시 알림
- **캐시 문제**: 높은 미스율 감지

### 대시보드 메트릭
- **최적화율**: 전체 쿼리 대비 최적화된 쿼리 비율
- **성능 향상**: 평균 쿼리 속도 향상 정도
- **리소스 절약**: 메모리, I/O 사용량 절약

## 설정 가이드

### 환경 변수
```bash
# 연결 풀 설정
KNEX_POOL_MAX=5
MYSQL_POOL_MAX=3
PG_POOL_MAX=5
MSSQL_POOL_MAX=4
ORACLE_POOL_MAX=4
BIGQUERY_POOL_MAX=2
SNOWFLAKE_POOL_MAX=3

# 캐시 설정
QUERY_CACHE_ENABLED=true
QUERY_CACHE_TTL=3600
QUERY_CACHE_MAX_SIZE=1000

# 모니터링 설정
SLOW_QUERY_THRESHOLD=1000
POOL_HEALTH_CHECK_INTERVAL=300000
```

### Lambda 환경 최적화
```typescript
// Lambda 환경에서 자동 적용되는 설정
{
  pool: {
    min: 0,
    max: 2,
    idleTimeoutMillis: 60000, // 1분
  },
  acquireConnectionTimeout: 30000,
}
```

## 테스트

### 단위 테스트
```bash
npm test -- --testPathPattern="database-specific-optimization"
npm test -- --testPathPattern="query-cache"
npm test -- --testPathPattern="enhanced-query-optimizer"
```

### 통합 테스트
```bash
npm test -- --testPathPattern="optimization.integration"
```

### 성능 테스트
```bash
# 벤치마크 실행
npm run test:benchmark
```

## 장애 대응

### 일반적인 문제
1. **캐시 메모리 부족**: maxSize 조정 또는 TTL 단축
2. **연결 풀 고갈**: 풀 크기 증가 또는 타임아웃 조정
3. **슬로우 쿼리**: 인덱스 추천 적용 또는 쿼리 재작성

### 디버깅
```typescript
// 디버그 모드 활성화
process.env.LOG_LEVEL = 'debug';

// 상세 메트릭 조회
const diagnostics = cacheService.getDiagnostics();
const poolStatus = poolService.getPoolStatus(databaseId);
const sessionStats = optimizerService.getSessionStats(sessionId);
```

## 향후 개선 계획

### 단기 (1-3개월)
- [ ] 머신러닝 기반 쿼리 최적화
- [ ] 실시간 성능 대시보드
- [ ] 자동 인덱스 생성 기능

### 중기 (3-6개월)
- [ ] 분산 캐시 지원
- [ ] 클러스터 환경 최적화
- [ ] 예측적 스케일링

### 장기 (6-12개월)
- [ ] AI 기반 성능 튜닝
- [ ] 다중 리전 최적화
- [ ] 자동 데이터 아카이빙

## 기여 가이드

### 새로운 데이터베이스 엔진 추가
1. `DatabaseSpecificOptimizationService`에 엔진 설정 추가
2. `QueryCacheService`에 무효화 규칙 추가
3. `IndexRecommendationService`에 인덱스 분석 로직 추가
4. 테스트 케이스 작성

### 최적화 규칙 추가
1. 엔진별 최적화 규칙 정의
2. 성능 영향 측정 로직 구현
3. A/B 테스트를 통한 효과 검증
4. 문서화 및 테스트 추가

---

이 최적화 시스템은 VanillaMeta의 데이터베이스 성능을 크게 향상시키며, 사용자 경험 개선과 운영 비용 절감에 기여합니다.