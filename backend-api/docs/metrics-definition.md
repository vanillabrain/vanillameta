# VanillaMeta 메트릭 정의서

## 1. 개요

이 문서는 VanillaMeta 시스템의 핵심 메트릭과 SLI(Service Level Indicator)를 정의합니다.

## 2. 메트릭 카테고리

### 2.1 가용성 메트릭 (Availability)

#### API 가용성
- **메트릭 이름**: `ApiAvailability`
- **계산식**: (성공 요청 수) / (전체 요청 수) × 100
- **목표치 (SLO)**: 99.9%
- **수집 주기**: 1분
- **차원**: Environment, Endpoint

#### Lambda 함수 가용성
- **메트릭 이름**: `LambdaAvailability`
- **계산식**: (성공 실행 수) / (전체 실행 수) × 100
- **목표치 (SLO)**: 99.95%
- **수집 주기**: 1분
- **차원**: Environment, FunctionName

### 2.2 성능 메트릭 (Performance)

#### API 응답 시간
- **메트릭 이름**: `ApiResponseTime`
- **측정 단위**: 밀리초 (ms)
- **목표치 (SLO)**: 
  - P50 < 200ms
  - P90 < 500ms
  - P99 < 1000ms
- **수집 주기**: 실시간
- **차원**: Environment, Endpoint, Method

#### 데이터베이스 쿼리 성능
- **메트릭 이름**: `DatabaseQueryDuration`
- **측정 단위**: 밀리초 (ms)
- **목표치 (SLO)**:
  - P50 < 50ms
  - P90 < 200ms
  - P99 < 500ms
- **수집 주기**: 실시간
- **차원**: Environment, DatabaseId, QueryType

#### Lambda Cold Start
- **메트릭 이름**: `LambdaColdStartRatio`
- **계산식**: (Cold Start 수) / (전체 실행 수) × 100
- **목표치 (SLO)**: < 5%
- **수집 주기**: 5분
- **차원**: Environment

### 2.3 에러율 메트릭 (Error Rate)

#### HTTP 4xx 에러율
- **메트릭 이름**: `Http4xxErrorRate`
- **계산식**: (4xx 응답 수) / (전체 요청 수) × 100
- **목표치 (SLO)**: < 5%
- **수집 주기**: 1분
- **차원**: Environment, Endpoint

#### HTTP 5xx 에러율
- **메트릭 이름**: `Http5xxErrorRate`
- **계산식**: (5xx 응답 수) / (전체 요청 수) × 100
- **목표치 (SLO)**: < 0.1%
- **수집 주기**: 1분
- **차원**: Environment, Endpoint

### 2.4 리소스 사용률 메트릭 (Resource Utilization)

#### Lambda 메모리 사용률
- **메트릭 이름**: `LambdaMemoryUtilization`
- **측정 단위**: 퍼센트 (%)
- **경고 임계값**: 80%
- **위험 임계값**: 90%
- **수집 주기**: 1분
- **차원**: Environment

#### RDS CPU 사용률
- **메트릭 이름**: `RDSCPUUtilization`
- **측정 단위**: 퍼센트 (%)
- **경고 임계값**: 70%
- **위험 임계값**: 85%
- **수집 주기**: 5분
- **차원**: Environment, InstanceId

#### Redis 메모리 사용률
- **메트릭 이름**: `RedisMemoryUtilization`
- **측정 단위**: 퍼센트 (%)
- **경고 임계값**: 75%
- **위험 임계값**: 90%
- **수집 주기**: 5분
- **차원**: Environment, ClusterId

### 2.5 비즈니스 메트릭 (Business)

#### 일일 활성 사용자 (DAU)
- **메트릭 이름**: `DailyActiveUsers`
- **측정 단위**: Count
- **수집 주기**: 24시간
- **차원**: Environment

#### 대시보드 생성 수
- **메트릭 이름**: `DashboardCreated`
- **측정 단위**: Count
- **수집 주기**: 실시간
- **차원**: Environment, UserType

#### 위젯 사용 통계
- **메트릭 이름**: `WidgetUsage`
- **측정 단위**: Count
- **수집 주기**: 실시간
- **차원**: Environment, WidgetType, ChartType

#### 쿼리 실행 수
- **메트릭 이름**: `QueryExecutions`
- **측정 단위**: Count
- **수집 주기**: 실시간
- **차원**: Environment, DatabaseType, QueryComplexity

### 2.6 캐시 효율성 메트릭 (Cache Efficiency)

#### 전체 캐시 히트율
- **메트릭 이름**: `OverallCacheHitRate`
- **계산식**: (캐시 히트 수) / (전체 요청 수) × 100
- **목표치 (SLO)**: > 80%
- **수집 주기**: 5분
- **차원**: Environment

#### L1 캐시 히트율
- **메트릭 이름**: `L1CacheHitRate`
- **계산식**: (L1 히트 수) / (L1 요청 수) × 100
- **목표치 (SLO)**: > 60%
- **수집 주기**: 5분
- **차원**: Environment

#### L2 캐시 히트율
- **메트릭 이름**: `L2CacheHitRate`
- **계산식**: (L2 히트 수) / (L2 요청 수) × 100
- **목표치 (SLO)**: > 90%
- **수집 주기**: 5분
- **차원**: Environment

## 3. SLI/SLO 정의

### 3.1 핵심 SLI

1. **가용성 SLI**
   - 정의: 5분 동안 성공적인 API 응답 비율
   - 목표 (SLO): 99.9%
   - 측정: (200-399 상태 코드) / (전체 요청)

2. **지연시간 SLI**
   - 정의: API 응답 시간 P99
   - 목표 (SLO): < 1초
   - 측정: 99번째 백분위수 응답 시간

3. **에러율 SLI**
   - 정의: 5분 동안 5xx 에러 비율
   - 목표 (SLO): < 0.1%
   - 측정: (5xx 상태 코드) / (전체 요청)

### 3.2 보조 SLI

1. **쿼리 성능 SLI**
   - 정의: 데이터베이스 쿼리 P90 응답 시간
   - 목표 (SLO): < 200ms
   - 측정: 90번째 백분위수 쿼리 시간

2. **캐시 효율성 SLI**
   - 정의: 전체 캐시 히트율
   - 목표 (SLO): > 80%
   - 측정: 캐시 히트 / 전체 캐시 요청

## 4. 메트릭 수집 구현

### 4.1 자동 수집 메트릭
- AWS 네이티브 메트릭 (Lambda, API Gateway, RDS, ElastiCache)
- ResponseTimeInterceptor를 통한 API 메트릭
- MemoryMonitorMiddleware를 통한 메모리 메트릭

### 4.2 커스텀 메트릭 수집 포인트

```typescript
// 비즈니스 메트릭 예시
await cloudWatchMetrics.recordUserActivity(userId, 'dashboard_created', 'dashboard');
await cloudWatchMetrics.putMetric('WidgetUsage', 1, 'Count', [
  { Name: 'WidgetType', Value: widgetType },
  { Name: 'ChartType', Value: chartType }
]);
```

## 5. 알람 설정

### 5.1 Critical 알람 (즉시 대응 필요)
- API 가용성 < 99.5% (5분간)
- 5xx 에러율 > 1% (5분간)
- Lambda 메모리 사용률 > 95%
- RDS CPU > 90%

### 5.2 Warning 알람 (모니터링 필요)
- API P99 응답 시간 > 2초
- 캐시 히트율 < 60%
- Lambda Cold Start > 10%
- 4xx 에러율 > 10%

## 6. 메트릭 보존 정책

- 고해상도 메트릭 (1분): 3일
- 일반 메트릭 (5분): 15일
- 집계 메트릭 (1시간): 63일
- 일별 집계: 455일

## 7. 메트릭 네이밍 규칙

- PascalCase 사용
- 동사 없이 명사로 구성
- 단위는 메트릭 이름에 포함하지 않음
- 예: `ApiResponseTime`, `CacheHitRate`, `QueryExecutions`

## 8. 차원(Dimensions) 표준

- **Environment**: dev, prod
- **Service**: backend-api, frontend-web
- **Endpoint**: API 경로
- **Method**: GET, POST, PUT, DELETE
- **StatusCode**: HTTP 상태 코드
- **DatabaseType**: mysql, postgresql, oracle
- **CacheType**: L1, L2, QueryCache

## 9. 메트릭 검증 체크리스트

- [ ] 메트릭이 비즈니스 가치와 연결되는가?
- [ ] 측정 가능하고 정량화 가능한가?
- [ ] 실시간 또는 준실시간으로 수집 가능한가?
- [ ] 액션 가능한 인사이트를 제공하는가?
- [ ] 비용 효율적으로 수집/저장 가능한가?

## 10. 메트릭 리뷰 주기

- **주간 리뷰**: 트렌드 분석 및 이상 징후 확인
- **월간 리뷰**: SLO 달성률 검토 및 조정
- **분기별 리뷰**: 메트릭 유효성 평가 및 개선