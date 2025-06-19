# VanillaMeta 핵심 메트릭 정의서

## 1. 개요

이 문서는 VanillaMeta 시스템의 핵심 성능 지표(KPI)와 서비스 수준 지표(SLI)를 정의합니다.

## 2. 핵심 메트릭 카테고리

### 2.1 가용성 메트릭 (Availability)

| 메트릭명 | 설명 | 목표치 (SLO) | 측정 주기 | 알람 임계값 |
|---------|------|-------------|-----------|------------|
| API_AVAILABILITY | API 서비스 가용성 | 99.9% | 1분 | < 99.5% |
| HEALTH_CHECK_SUCCESS_RATE | 헬스체크 성공률 | 99.99% | 30초 | < 99% |

### 2.2 성능 메트릭 (Performance)

| 메트릭명 | 설명 | 목표치 (SLO) | 측정 주기 | 알람 임계값 |
|---------|------|-------------|-----------|------------|
| API_RESPONSE_TIME_P50 | API 응답시간 중앙값 | < 200ms | 1분 | > 300ms |
| API_RESPONSE_TIME_P90 | API 응답시간 90분위 | < 500ms | 1분 | > 800ms |
| API_RESPONSE_TIME_P99 | API 응답시간 99분위 | < 1000ms | 1분 | > 2000ms |
| QUERY_EXECUTION_TIME_P90 | 쿼리 실행시간 90분위 | < 100ms | 1분 | > 200ms |
| LAMBDA_COLD_START_DURATION | Lambda 콜드스타트 시간 | < 3s | 발생 시 | > 5s |
| LAMBDA_MEMORY_UTILIZATION | Lambda 메모리 사용률 | < 80% | 1분 | > 85% |

### 2.3 에러율 메트릭 (Error Rate)

| 메트릭명 | 설명 | 목표치 (SLO) | 측정 주기 | 알람 임계값 |
|---------|------|-------------|-----------|------------|
| API_ERROR_RATE | API 에러율 (5xx) | < 0.1% | 1분 | > 1% |
| API_CLIENT_ERROR_RATE | 클라이언트 에러율 (4xx) | < 5% | 5분 | > 10% |
| QUERY_ERROR_RATE | 데이터베이스 쿼리 에러율 | < 0.01% | 1분 | > 0.1% |
| LAMBDA_ERROR_COUNT | Lambda 함수 에러 수 | < 10/5분 | 5분 | > 10/5분 |

### 2.4 비즈니스 메트릭 (Business)

| 메트릭명 | 설명 | 목표치 (SLO) | 측정 주기 | 알람 임계값 |
|---------|------|-------------|-----------|------------|
| DASHBOARD_LOAD_TIME | 대시보드 로딩 시간 | < 2s | 5분 | > 3s |
| QUERY_CACHE_HIT_RATE | 쿼리 캐시 적중률 | > 70% | 5분 | < 50% |
| CONCURRENT_USERS | 동시 접속 사용자 수 | - | 1분 | > 1000 |
| DATA_REFRESH_SUCCESS_RATE | 데이터 새로고침 성공률 | > 99% | 5분 | < 95% |
| WIDGET_RENDER_TIME_P90 | 위젯 렌더링 시간 90분위 | < 500ms | 5분 | > 1000ms |

### 2.5 리소스 사용률 메트릭 (Resource Utilization)

| 메트릭명 | 설명 | 목표치 (SLO) | 측정 주기 | 알람 임계값 |
|---------|------|-------------|-----------|------------|
| RDS_CPU_UTILIZATION | RDS CPU 사용률 | < 70% | 1분 | > 80% |
| RDS_CONNECTION_COUNT | RDS 연결 수 | < 80% of max | 1분 | > 90% of max |
| REDIS_MEMORY_USAGE | Redis 메모리 사용률 | < 75% | 5분 | > 85% |
| REDIS_CONNECTION_COUNT | Redis 연결 수 | < 900 | 1분 | > 950 |

## 3. 메트릭 수집 방법

### 3.1 API 메트릭
- Interceptor를 통한 자동 수집
- Request/Response 시간 측정
- HTTP 상태 코드 기반 에러율 계산

### 3.2 데이터베이스 메트릭
- TypeORM Query Logger 활용
- Slow Query Monitor 통합
- Connection Pool Monitor 활용

### 3.3 Lambda 메트릭
- AWS Lambda 내장 메트릭 활용
- CloudWatch Logs Insights 쿼리

### 3.4 비즈니스 메트릭
- 커스텀 메트릭 구현
- 사용자 행동 추적
- 애플리케이션 레벨 측정

## 4. 메트릭 네이밍 규칙

```
{SERVICE_NAME}_{COMPONENT}_{METRIC_TYPE}_{AGGREGATION}
```

예시:
- `VANILLAMETA_API_RESPONSE_TIME_P90`
- `VANILLAMETA_RDS_CPU_UTILIZATION_AVG`
- `VANILLAMETA_DASHBOARD_LOAD_TIME_P99`

## 5. 메트릭 태그

모든 메트릭에는 다음 태그를 포함:
- `environment`: dev, staging, prod
- `region`: AWS 리전
- `service`: 서비스명
- `endpoint`: API 엔드포인트 (해당하는 경우)
- `database`: 데이터베이스 타입 (해당하는 경우)

## 6. 데이터 보존 정책

- 고해상도 메트릭 (1분): 3일
- 표준 해상도 메트릭 (5분): 15일
- 집계된 메트릭 (1시간): 63일
- 월간 집계: 15개월

## 7. 알람 우선순위

### P0 (Critical) - 즉시 대응
- API 가용성 < 99%
- Lambda 에러율 > 5%
- RDS CPU > 90%

### P1 (High) - 30분 내 대응
- API 응답시간 P99 > 2초
- 쿼리 에러율 > 0.5%
- Redis 메모리 > 90%

### P2 (Medium) - 업무시간 내 대응
- 캐시 적중률 < 40%
- 클라이언트 에러율 > 15%
- 콜드스타트 > 5초

### P3 (Low) - 다음 스프린트
- 위젯 렌더링 시간 증가 추세
- 리소스 사용률 증가 추세

## 8. 대시보드 구성

### 8.1 Overview Dashboard
- 전체 시스템 상태 요약
- P0/P1 알람 현황
- 주요 SLI 현황

### 8.2 Performance Dashboard
- API 응답시간 분포
- 쿼리 성능 메트릭
- 리소스 사용률 추세

### 8.3 Business Dashboard
- 사용자 활동 메트릭
- 기능별 사용 통계
- 비즈니스 KPI

## 9. 메트릭 검증

- 신규 메트릭은 staging 환경에서 1주일 검증
- 메트릭 정확성 주기적 감사
- 알람 임계값 분기별 리뷰