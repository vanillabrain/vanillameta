# 데이터베이스 인덱스 분석 보고서

## 1. 주요 엔티티 쿼리 패턴 분석

### Dashboard Entity
- **테이블명**: dashboard
- **주요 쿼리 패턴**:
  1. `findOne({ where: { id: id } })` - PK로 조회 (이미 인덱스 존재)
  2. `findOne({ where: { id: findId[i] } })` - PK로 조회 (이미 인덱스 존재)
  3. 정렬: `order: { updatedAt: 'desc', title: 'asc' }`
- **인덱스 추천**:
  - `updatedAt` 단일 인덱스 (정렬 성능 향상)
  - `(updatedAt, title)` 복합 인덱스 (정렬 최적화)

### Widget Entity
- **테이블명**: widget
- **주요 쿼리 패턴**:
  1. `findOne({ where: { id: id } })` - PK로 조회 (이미 인덱스 존재)
  2. JOIN 쿼리: `widget.componentId = component.id`
  3. 정렬: `orderBy('widget.updatedAt', 'DESC').addOrderBy('widget.title')`
  4. `delete({ datasetType: DatasetType.DATASET, datasetId: find_dataset.id })`
- **인덱스 추천**:
  - `componentId` 단일 인덱스 (JOIN 성능 향상)
  - `(datasetType, datasetId)` 복합 인덱스 (삭제 쿼리 최적화)
  - `(updatedAt, title)` 복합 인덱스 (정렬 최적화)

### Dataset Entity
- **테이블명**: dataset
- **주요 쿼리 패턴**:
  1. `findOne({ where: { id: id } })` - PK로 조회 (이미 인덱스 존재)
  2. `find({ where: { databaseId: id } })` - 외래키로 조회
- **인덱스 추천**:
  - `databaseId` 단일 인덱스 (외래키 조회 최적화)

### Database Entity
- **테이블명**: database
- **주요 쿼리 패턴**:
  1. `findOne({ where: { id } })` - PK로 조회 (이미 인덱스 존재)
  2. `find()` - 전체 조회 (인덱스 불필요)
- **인덱스 추천**: 추가 인덱스 불필요

### User Entity
- **테이블명**: user
- **주요 쿼리 패턴**:
  1. `findOne({ where: { id: userId } })` - PK로 조회 (이미 인덱스 존재)
  2. `findOne({ where: { userId: userId } })` - userId로 조회
  3. 인증 관련 조회 (email 기반)
- **인덱스 추천**:
  - `userId` 유니크 인덱스 (로그인 성능 향상)
  - `email` 유니크 인덱스 (이미 존재할 가능성 높음)

### UserMapping Entity
- **테이블명**: user_mapping
- **주요 쿼리 패턴**:
  1. `where('user_mapping.userInfoId = :userInfoId', { userInfoId: id })`
  2. `findOne({ where: { dashboardId: id } })`
- **인덱스 추천**:
  - `userInfoId` 단일 인덱스 (사용자별 대시보드 조회 최적화)
  - `dashboardId` 단일 인덱스 (대시보드 삭제 시 조회 최적화)

### DashboardShare Entity
- **테이블명**: dashboard_share
- **주요 쿼리 패턴**:
  1. `findOne({ where: { id: find_dashboard.shareId } })`
- **인덱스 추천**: PK 인덱스로 충분

### TableQuery Entity
- **테이블명**: table_query
- **주요 쿼리 패턴**:
  1. `findOne({ where: { id: datasetId } })`
  2. `delete({ databaseId: id })`
- **인덱스 추천**:
  - `databaseId` 단일 인덱스 (데이터베이스 삭제 시 성능 향상)

## 2. 인덱스 우선순위

### 높은 우선순위
1. **user_mapping.userInfoId** - 대시보드 목록 조회 시 매번 사용
2. **widget.componentId** - 위젯 목록 조회 시 JOIN에 사용
3. **dataset.databaseId** - 데이터베이스별 데이터셋 조회
4. **widget.(datasetType, datasetId)** - 데이터셋 삭제 시 연관 위젯 삭제

### 중간 우선순위
1. **dashboard.updatedAt** - 대시보드 목록 정렬
2. **widget.updatedAt** - 위젯 목록 정렬
3. **user.userId** - 로그인 및 토큰 재발급
4. **table_query.databaseId** - 데이터베이스 삭제 시 사용

### 낮은 우선순위
1. **dashboard.(updatedAt, title)** - 복합 정렬 최적화
2. **widget.(updatedAt, title)** - 복합 정렬 최적화
3. **user_mapping.dashboardId** - 대시보드 삭제 시 사용

## 3. 성능 영향 분석

### 예상 성능 개선
- 대시보드 목록 조회: 30-50% 개선 (user_mapping 인덱스)
- 위젯 목록 조회: 20-40% 개선 (componentId 인덱스)
- 데이터베이스 상세 조회: 20-30% 개선 (dataset.databaseId 인덱스)

### INSERT/UPDATE 성능 영향
- 인덱스 추가로 인한 쓰기 성능 저하: 약 5-10%
- B-tree 인덱스 유지 비용 발생
- 대부분 읽기 위주 작업이므로 전체적인 성능 향상 예상

## 4. 데이터베이스별 고려사항

### MySQL/MariaDB
- InnoDB 엔진 사용 확인
- 인덱스 힌트 사용 가능

### PostgreSQL
- 부분 인덱스 활용 가능 (예: WHERE delYn = 'N')
- BRIN 인덱스 고려 (시계열 데이터)

### SQLite (개발 환경)
- 인덱스 수 제한 없음
- 메모리 기반 임시 인덱스 활용

### Oracle/SQL Server
- 클러스터드 인덱스 고려
- 파티셔닝과 함께 사용