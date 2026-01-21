# VanillaMeta 쿼리 최적화 가이드라인

## 개요

이 문서는 VanillaMeta 애플리케이션의 데이터베이스 쿼리 성능을 최적화하기 위한 가이드라인을 제공합니다. 쿼리 실행 계획 분석을 통해 식별된 비효율적인 패턴과 최적화 전략을 포함합니다.

## 쿼리 분석 도구 사용법

### 1. 단일 쿼리 분석

```bash
# API 엔드포인트
POST /api/query-analyzer/analyze
{
  "query": "SELECT * FROM dashboard WHERE user_id = ?",
  "databaseId": 1  // 선택적: 외부 데이터베이스 ID
}
```

### 2. 다중 쿼리 일괄 분석

```bash
POST /api/query-analyzer/analyze-batch
{
  "queries": [
    "SELECT * FROM dashboard",
    "SELECT COUNT(*) FROM widget"
  ]
}
```

### 3. 최적화 보고서 생성

```bash
GET /api/monitoring/query-optimization/report?analyzeSystem=true
```

### 4. 쿼리 패턴 분석

```bash
GET /api/monitoring/query-optimization/query-patterns
```

## 주요 최적화 전략

### 1. Full Table Scan 제거

**문제점**
- 인덱스 없이 전체 테이블을 스캔하여 성능 저하
- 대용량 테이블에서 특히 심각한 성능 문제 발생

**해결 방법**
```sql
-- Before: Full table scan
SELECT * FROM dashboard WHERE title LIKE '%report%';

-- After: 인덱스 추가
CREATE INDEX idx_dashboard_title ON dashboard(title);

-- 또는 Full-text 인덱스 사용 (MySQL)
ALTER TABLE dashboard ADD FULLTEXT(title);
SELECT * FROM dashboard WHERE MATCH(title) AGAINST('report');
```

**예상 개선**: 50-90% 실행 시간 감소

### 2. 복합 인덱스 활용

**최적의 인덱스 순서**
```sql
-- WHERE 절과 ORDER BY를 함께 고려
CREATE INDEX idx_widget_dashboard_updated 
ON widget(dashboard_id, updated_at DESC);

-- 쿼리 예시
SELECT * FROM widget 
WHERE dashboard_id = 1 
ORDER BY updated_at DESC;
```

### 3. 서브쿼리를 JOIN으로 변환

**Before: 비효율적인 서브쿼리**
```sql
SELECT d.*, 
  (SELECT COUNT(*) FROM widget w WHERE w.dashboard_id = d.id) as widget_count
FROM dashboard d
WHERE d.user_id = ?;
```

**After: 효율적인 JOIN**
```sql
SELECT d.*, COUNT(w.id) as widget_count
FROM dashboard d
LEFT JOIN widget w ON w.dashboard_id = d.id
WHERE d.user_id = ?
GROUP BY d.id;
```

**예상 개선**: 30-70% 성능 향상

### 4. 임시 테이블 사용 최소화

**문제점**
- GROUP BY나 ORDER BY에서 임시 테이블 생성
- 메모리/디스크 사용 증가

**해결 방법**
```sql
-- 커버링 인덱스 생성
CREATE INDEX idx_covering ON table_name(col1, col2, col3);

-- 인덱스 순서와 일치하는 GROUP BY
SELECT col1, col2, COUNT(*)
FROM table_name
GROUP BY col1, col2;  -- 인덱스 순서와 동일
```

### 5. SELECT * 방지

**Before**
```sql
SELECT * FROM large_table WHERE condition = true;
```

**After**
```sql
SELECT id, name, status, updated_at 
FROM large_table 
WHERE condition = true;
```

**이점**
- 네트워크 트래픽 감소
- 메모리 사용량 감소
- 커버링 인덱스 활용 가능

## 데이터베이스별 최적화

### MySQL 최적화

1. **EXPLAIN 분석**
```sql
EXPLAIN SELECT * FROM dashboard;
EXPLAIN FORMAT=JSON SELECT * FROM dashboard;  -- 더 상세한 정보
```

2. **인덱스 힌트 사용**
```sql
SELECT * FROM dashboard USE INDEX (idx_user_id) 
WHERE user_id = 1;
```

3. **파티셔닝 활용**
```sql
ALTER TABLE large_table
PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2022 VALUES LESS THAN (2023),
  PARTITION p2023 VALUES LESS THAN (2024),
  PARTITION p2024 VALUES LESS THAN (2025)
);
```

### PostgreSQL 최적화

1. **EXPLAIN ANALYZE 사용**
```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM dashboard;
```

2. **부분 인덱스**
```sql
CREATE INDEX idx_active_users ON users(email) 
WHERE status = 'active';
```

3. **통계 업데이트**
```sql
ANALYZE dashboard;  -- 테이블 통계 업데이트
VACUUM ANALYZE dashboard;  -- VACUUM과 함께 실행
```

## 성능 모니터링

### 1. 느린 쿼리 로깅 설정

**MySQL**
```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;  -- 1초 이상
```

**PostgreSQL**
```sql
-- postgresql.conf
log_min_duration_statement = 1000  # 1초
```

### 2. 쿼리 수집 및 분석

```javascript
// 환경변수 설정
QUERY_PERFORMANCE_MONITORING_ENABLED=true
QUERY_AUTO_ANALYZE_THRESHOLD=5000  // 5초 이상 요청 자동 분석
```

### 3. 정기적인 최적화 보고서 확인

```bash
# 매주 월요일 최적화 보고서 생성
curl -X GET http://localhost:3000/api/monitoring/query-optimization/optimization-plan

# 가이드라인 문서 다운로드
curl -X GET http://localhost:3000/api/monitoring/query-optimization/optimization-guidelines \
  -o query-optimization-guidelines.md
```

## 인덱스 관리 best practices

### 1. 인덱스 생성 원칙

- **선택도(Selectivity)가 높은 컬럼**을 우선
- **WHERE, JOIN, ORDER BY**에 자주 사용되는 컬럼
- **복합 인덱스**는 왼쪽부터 사용됨을 고려
- **과도한 인덱스**는 INSERT/UPDATE 성능 저하

### 2. 인덱스 사용 확인

```sql
-- MySQL: 인덱스 사용 통계
SELECT * FROM sys.schema_unused_indexes;

-- PostgreSQL: 인덱스 사용 통계
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

### 3. 인덱스 유지보수

```sql
-- MySQL: 인덱스 재구성
OPTIMIZE TABLE dashboard;

-- PostgreSQL: 인덱스 재구성
REINDEX INDEX idx_dashboard_user_id;
```

## 쿼리 작성 가이드라인

### 1. 효율적인 페이징

```sql
-- LIMIT/OFFSET 대신 커서 기반 페이징
SELECT * FROM dashboard
WHERE id > ? -- 마지막 ID
ORDER BY id
LIMIT 20;
```

### 2. 대량 데이터 처리

```sql
-- 배치 처리
INSERT INTO table_name (col1, col2) VALUES
  (val1, val2),
  (val3, val4),
  (val5, val6);

-- UPSERT 패턴 (MySQL)
INSERT INTO table_name (id, value) VALUES (1, 'new')
ON DUPLICATE KEY UPDATE value = VALUES(value);
```

### 3. 조건문 최적화

```sql
-- OR 대신 IN 사용
-- Before
WHERE status = 'active' OR status = 'pending' OR status = 'processing'

-- After  
WHERE status IN ('active', 'pending', 'processing')
```

## 트러블슈팅 체크리스트

### 쿼리가 느릴 때 확인사항

1. [ ] EXPLAIN으로 실행 계획 확인
2. [ ] 인덱스 존재 여부 확인
3. [ ] 테이블 통계 최신화 여부
4. [ ] 쿼리에서 함수 사용 여부 (인덱스 무효화)
5. [ ] 조인 조건의 데이터 타입 일치 여부
6. [ ] 임시 테이블 생성 여부
7. [ ] 결과 셋 크기 확인

### 일반적인 안티패턴

1. **SELECT * 사용**
2. **인덱스 컬럼에 함수 적용**
   ```sql
   -- Bad
   WHERE YEAR(created_at) = 2024
   
   -- Good
   WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
   ```

3. **암시적 형변환**
   ```sql
   -- Bad (user_id가 INT인 경우)
   WHERE user_id = '123'
   
   -- Good
   WHERE user_id = 123
   ```

4. **부정 조건 사용**
   ```sql
   -- Bad
   WHERE status != 'deleted'
   
   -- Good (인덱스 활용 가능)
   WHERE status IN ('active', 'pending', 'processing')
   ```

## 결론

쿼리 최적화는 지속적인 프로세스입니다. 정기적인 모니터링과 분석을 통해 성능 저하 요인을 조기에 발견하고 해결하는 것이 중요합니다. 이 가이드라인을 참고하여 효율적인 쿼리를 작성하고, 필요시 DBA와 협력하여 더 심도 있는 최적화를 진행하시기 바랍니다.