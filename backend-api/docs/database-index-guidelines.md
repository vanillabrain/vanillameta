# 데이터베이스 인덱스 관리 가이드라인

## 1. 인덱스 명명 규칙

### 일반 인덱스
- 형식: `IDX_[테이블명]_[컬럼명]`
- 예시: `IDX_DASHBOARD_UPDATED_AT`

### 복합 인덱스
- 형식: `IDX_[테이블명]_[컬럼1]_[컬럼2]`
- 예시: `IDX_WIDGET_DATASET_TYPE_ID`

### 유니크 인덱스
- 형식: `UQ_[테이블명]_[컬럼명]`
- 예시: `UQ_USER_EMAIL`

## 2. 인덱스 추가 기준

### 필수 인덱스
1. **외래키 컬럼**: JOIN 성능 향상
2. **WHERE 절 조건**: 자주 사용되는 필터 조건
3. **ORDER BY 컬럼**: 정렬 성능 향상
4. **GROUP BY 컬럼**: 집계 성능 향상

### 선택적 인덱스
1. **복합 인덱스**: 여러 컬럼을 함께 조회하는 경우
2. **부분 인덱스**: 특정 조건의 데이터만 인덱싱
3. **함수 기반 인덱스**: 계산된 값으로 조회하는 경우

## 3. 인덱스 성능 모니터링

### 쿼리 실행 계획 확인
```sql
-- MySQL
EXPLAIN SELECT * FROM dashboard WHERE updatedAt > '2024-01-01';

-- PostgreSQL
EXPLAIN ANALYZE SELECT * FROM dashboard WHERE updatedAt > '2024-01-01';
```

### 인덱스 사용률 확인
```sql
-- MySQL: 인덱스 통계
SELECT 
    table_name,
    index_name,
    cardinality
FROM information_schema.statistics
WHERE table_schema = 'vanillameta'
ORDER BY cardinality DESC;

-- PostgreSQL: 인덱스 사용 빈도
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 4. 인덱스 유지보수

### 정기 점검 항목
1. **인덱스 단편화 확인** (월 1회)
2. **미사용 인덱스 식별** (분기 1회)
3. **중복 인덱스 제거** (분기 1회)
4. **인덱스 통계 업데이트** (주 1회)

### 인덱스 재구성
```sql
-- MySQL
ALTER TABLE dashboard ENGINE=InnoDB;

-- PostgreSQL
REINDEX TABLE dashboard;
```

## 5. TypeORM 인덱스 정의

### Entity 레벨 인덱스
```typescript
@Entity()
@Index('IDX_DASHBOARD_UPDATED_AT', ['updatedAt'])
export class Dashboard extends BaseEntity {
  // ...
}
```

### 복합 인덱스
```typescript
@Index('IDX_WIDGET_DATASET_TYPE_ID', ['datasetType', 'datasetId'])
```

### 유니크 인덱스
```typescript
@Index('IDX_USER_EMAIL', ['email'], { unique: true })
```

### 부분 인덱스 (PostgreSQL)
```typescript
@Index('IDX_DASHBOARD_ACTIVE', ['updatedAt'], { 
  where: "delYn = 'N'" 
})
```

## 6. 인덱스 영향 분석

### 쿼리 성능 개선
- SELECT 쿼리: 30-70% 성능 향상
- JOIN 쿼리: 40-80% 성능 향상
- ORDER BY 쿼리: 50-90% 성능 향상

### 쓰기 성능 영향
- INSERT: 5-10% 성능 저하
- UPDATE: 5-15% 성능 저하 (인덱스 컬럼 수정 시)
- DELETE: 5-10% 성능 저하

## 7. 데이터베이스별 최적화

### MySQL/MariaDB
- InnoDB 클러스터드 인덱스 활용
- 인덱스 힌트 사용 가능
- 최대 64개 인덱스 제한

### PostgreSQL
- 부분 인덱스 활용
- GIN/GiST 인덱스 (JSON, 전문 검색)
- BRIN 인덱스 (시계열 데이터)

### SQLite
- 단순 B-tree 인덱스만 지원
- 인덱스 수 제한 없음
- 메모리 기반 임시 인덱스

### Oracle
- 함수 기반 인덱스 지원
- 비트맵 인덱스 (낮은 카디널리티)
- 파티션 인덱스

## 8. 인덱스 추가/삭제 프로세스

### 1. 요구사항 분석
- 쿼리 패턴 분석
- 성능 병목 지점 식별

### 2. 개발 환경 테스트
- 인덱스 추가
- 성능 측정
- 부작용 확인

### 3. 스테이징 환경 검증
- 실제 데이터 규모 테스트
- 동시성 테스트

### 4. 프로덕션 적용
- 트래픽이 적은 시간대 선택
- 온라인 인덱스 생성 (가능한 경우)
- 롤백 계획 수립

### 5. 모니터링
- 성능 지표 확인
- 에러 로그 모니터링
- 사용자 피드백 수집

## 9. 주의사항

### 과도한 인덱스 생성 금지
- 테이블당 5-7개 이하 권장
- 쓰기 성능과 균형 고려

### 인덱스 컬럼 순서
- 카디널리티가 높은 컬럼을 앞에 배치
- 범위 조건 컬럼은 마지막에 배치

### 정기적인 검토
- 분기별 인덱스 사용률 검토
- 연간 전체 인덱스 재평가