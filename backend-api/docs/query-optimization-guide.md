# Query Execution Plan Analysis Guide

## 개요

VanillaMeta 백엔드 API에 쿼리 실행 계획 분석 및 최적화 시스템이 구현되었습니다. 이 시스템은 데이터베이스 쿼리의 성능을 모니터링하고 최적화 기회를 식별합니다.

## 주요 기능

### 1. 쿼리 실행 계획 분석

- **자동 EXPLAIN 분석**: 모든 쿼리에 대해 EXPLAIN 분석 실행
- **다중 데이터베이스 지원**: MySQL, PostgreSQL, SQL Server, Oracle 등
- **성능 메트릭 수집**: 실행 시간, 스캔된 행 수, 인덱스 사용 여부 등

### 2. 쿼리 성능 모니터링

- **실시간 쿼리 수집**: 모든 실행되는 쿼리 자동 수집
- **느린 쿼리 감지**: 1초 이상 걸리는 쿼리 자동 로깅
- **쿼리 패턴 분석**: 반복되는 쿼리 패턴 식별

### 3. 최적화 제안

- **자동 최적화 제안**: 쿼리 분석 결과를 기반으로 최적화 제안
- **인덱스 추천**: 누락된 인덱스 추천
- **쿼리 리팩토링 가이드**: 비효율적인 쿼리 패턴 개선 방법 제시

## API 엔드포인트

### 1. 단일 쿼리 분석
```
POST /query-analyzer/analyze
{
  "query": "SELECT * FROM users WHERE status = 'active'",
  "databaseId": 1  // optional
}
```

### 2. 다중 쿼리 일괄 분석
```
POST /query-analyzer/analyze-batch
{
  "queries": [
    "SELECT * FROM dashboard WHERE user_id = ?",
    "SELECT * FROM widget ORDER BY created_at DESC"
  ]
}
```

### 3. 쿼리 최적화 보고서
```
GET /monitoring/query-optimization/report?analyzeSystem=true
```

### 4. 수집된 쿼리 조회
```
GET /monitoring/query-optimization/collected-queries?source=database-1&minExecutionTime=1000
```

### 5. 쿼리 패턴 분석
```
GET /monitoring/query-optimization/query-patterns
```

## 쿼리 최적화 예시

### 1. Full Table Scan 최적화

**문제가 있는 쿼리:**
```sql
SELECT * FROM dashboard WHERE title LIKE '%report%'
```

**분석 결과:**
- Type: ALL (Full Table Scan)
- Rows examined: 10,000+
- Index used: No

**최적화 제안:**
```sql
-- 1. title 컬럼에 인덱스 추가
CREATE INDEX idx_dashboard_title ON dashboard(title);

-- 2. 가능하면 전체 텍스트 검색으로 변경
ALTER TABLE dashboard ADD FULLTEXT(title);
SELECT * FROM dashboard WHERE MATCH(title) AGAINST('report');
```

### 2. N+1 쿼리 문제 해결

**문제가 있는 코드:**
```typescript
const dashboards = await this.dashboardRepository.find();
for (const dashboard of dashboards) {
  const widgets = await this.widgetRepository.find({ 
    where: { dashboardId: dashboard.id } 
  });
}
```

**최적화된 코드:**
```typescript
const dashboards = await this.dashboardRepository
  .createQueryBuilder('dashboard')
  .leftJoinAndSelect('dashboard.widgets', 'widget')
  .getMany();
```

### 3. 복잡한 조인 최적화

**문제가 있는 쿼리:**
```sql
SELECT d.*, 
  (SELECT COUNT(*) FROM widget w WHERE w.dashboard_id = d.id) as widget_count
FROM dashboard d
WHERE d.user_id = ?
```

**최적화된 쿼리:**
```sql
SELECT d.*, COUNT(w.id) as widget_count
FROM dashboard d
LEFT JOIN widget w ON w.dashboard_id = d.id
WHERE d.user_id = ?
GROUP BY d.id
```

## 모니터링 및 분석 워크플로우

### 1. 개발 환경에서의 사용

```bash
# 1. 쿼리 수집 활성화
export QUERY_PERFORMANCE_MONITORING=true

# 2. 애플리케이션 실행
npm run start:dev

# 3. 일반적인 사용 패턴 실행

# 4. 최적화 보고서 확인
curl http://localhost:3000/monitoring/query-optimization/report
```

### 2. 프로덕션 모니터링

- CloudWatch 로그에서 "Slow query detected" 검색
- 주기적으로 최적화 보고서 실행
- 쿼리 패턴 분석을 통한 중복 쿼리 식별

## 주요 최적화 지표

### 1. 쿼리 실행 시간
- **목표**: 평균 100ms 이하
- **경고**: 1초 이상
- **위험**: 5초 이상

### 2. 스캔된 행 수 대비 반환된 행 수
- **좋음**: 비율 < 10:1
- **주의**: 비율 10:1 ~ 100:1
- **나쁨**: 비율 > 100:1

### 3. 인덱스 사용률
- **목표**: 90% 이상의 쿼리가 인덱스 사용
- **주의**: 70% ~ 90%
- **위험**: 70% 미만

## 데이터베이스별 특화 최적화

### MySQL/MariaDB
- `EXPLAIN ANALYZE` 사용 (MySQL 8.0.18+)
- `optimizer_trace` 활용
- 파티션 테이블 고려

### PostgreSQL
- `EXPLAIN (ANALYZE, BUFFERS)` 사용
- Parallel Query 활용
- Partial Index 활용

### Oracle
- `DBMS_XPLAN.DISPLAY` 사용
- Hint 활용
- Materialized View 고려

### SQL Server
- Query Store 활용
- 실행 계획 캐시 분석
- 통계 업데이트 자동화

## 성능 테스트 자동화

```typescript
// 성능 테스트 예시
describe('Query Performance', () => {
  it('should execute dashboard queries within 100ms', async () => {
    const start = Date.now();
    const result = await dashboardService.findAll(userId);
    const executionTime = Date.now() - start;
    
    expect(executionTime).toBeLessThan(100);
  });
});
```

## 트러블슈팅

### 1. "Query analysis not supported" 오류
- 해당 데이터베이스 타입의 EXPLAIN 구문 확인
- 데이터베이스 버전 확인

### 2. 분석 결과가 부정확한 경우
- 데이터베이스 통계 업데이트: `ANALYZE TABLE`
- 쿼리 캐시 초기화

### 3. 최적화 후에도 성능 개선이 없는 경우
- 하드웨어 리소스 확인
- 네트워크 레이턴시 측정
- 데이터베이스 연결 풀 설정 확인

## 모범 사례

1. **정기적인 모니터링**: 주 1회 이상 최적화 보고서 실행
2. **프로액티브 최적화**: 문제가 발생하기 전에 미리 최적화
3. **인덱스 관리**: 사용하지 않는 인덱스 정리
4. **쿼리 리뷰**: 새로운 기능 추가 시 쿼리 성능 검토
5. **캐싱 전략**: 자주 사용되는 읽기 전용 데이터는 캐싱 고려