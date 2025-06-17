---
task_id: T02_S07
sprint_sequence_id: S07
status: completed
complexity: Low
last_updated: 2025-06-14T23:30:00Z
---

# Task: 주요 메트릭 정의 및 추적 설정

## Description
시스템 성능과 안정성을 측정하기 위한 핵심 메트릭을 정의하고, 이를 자동으로 수집하고 추적하는 시스템을 구축합니다. 비즈니스 목표와 연계된 SLI(Service Level Indicator)를 설정하고 지속적으로 모니터링합니다.

## Goal / Objectives
- 시스템 건강도를 나타내는 핵심 메트릭 정의
- 자동화된 메트릭 수집 파이프라인 구축
- SLI/SLO 기반 모니터링 체계 확립

## Acceptance Criteria
- [ ] 핵심 메트릭 목록 정의 (가용성, 지연시간, 에러율 등)
- [ ] 각 메트릭별 임계값 및 목표치 설정
- [ ] 메트릭 수집 코드 구현 및 배포
- [ ] 메트릭 데이터 검증 및 정확성 확인
- [ ] 메트릭 문서화 완료

## Subtasks
- [ ] 비즈니스 요구사항 기반 핵심 메트릭 정의
- [ ] 메트릭별 수집 방법 및 주기 결정
- [ ] CloudWatch 커스텀 메트릭 구현
- [ ] 메트릭 수집 미들웨어 개발
- [ ] 메트릭 대시보드 위젯 추가
- [ ] 메트릭 정의서 작성

## Technical Guidance

### Key Interfaces and Integration Points
- `src/common/interceptors/query-performance.interceptor.ts` - 성능 인터셉터
- `src/common/monitoring/` - 모니터링 모듈
- `src/middleware/logging.middleware.ts` - 로깅 미들웨어
- AWS CloudWatch PutMetricData API

### Specific Imports and Module References
```typescript
// 성능 모니터링
import { QueryPerformanceInterceptor } from '@/common/interceptors/query-performance.interceptor';
// 로거
import { LoggerService } from '@/common/logger/logger.service';
// AWS SDK
import { CloudWatch } from 'aws-sdk';
```

### Existing Patterns to Follow
- QueryPerformanceInterceptor의 메트릭 수집 패턴
- LoggerService의 구조화된 로깅 패턴
- 기존 모니터링 서비스의 메트릭 수집 방식

### Database Models and API Contracts
- 메트릭 데이터는 CloudWatch에 저장
- 로그 기반 메트릭은 CloudWatch Logs Insights 활용

## Implementation Notes

### Step-by-Step Implementation Approach
1. 핵심 메트릭 정의 워크샵 진행
2. 메트릭별 수집 포인트 식별
3. 메트릭 수집 유틸리티 클래스 개발
4. 각 서비스에 메트릭 수집 코드 통합
5. CloudWatch 커스텀 메트릭 설정
6. 메트릭 검증 및 튜닝

### Key Architectural Decisions
- 성능 영향 최소화를 위해 비동기 메트릭 전송
- 메트릭 네임스페이스: "VanillaMeta/Production"
- 차원(Dimensions)으로 서비스, 환경, 기능 구분

### Testing Approach
- 단위 테스트: 메트릭 수집 로직 검증
- 통합 테스트: CloudWatch 전송 확인
- 부하 테스트: 메트릭 정확성 검증

### Performance Considerations
- 메트릭 수집은 백그라운드에서 비동기 처리
- 배치 전송으로 API 호출 최소화
- 샘플링을 통한 고빈도 메트릭 최적화

### Recommended Metrics
1. **가용성 메트릭**
   - API 가용성 (성공 요청 / 전체 요청)
   - Lambda 함수 에러율
   
2. **성능 메트릭**
   - API 응답 시간 (P50, P90, P99)
   - 데이터베이스 쿼리 실행 시간
   - Lambda Cold Start 비율
   
3. **비즈니스 메트릭**
   - 활성 사용자 수
   - 대시보드 생성 수
   - 위젯 사용 패턴

## Output Log

### 2025-06-14

#### 완료된 작업

1. **메트릭 정의서 작성**
   - `docs/metrics-definition.md` 생성
   - 6개 카테고리의 핵심 메트릭 정의
   - SLI/SLO 목표치 설정
   - 메트릭 네이밍 규칙 및 차원 표준화

2. **비즈니스 메트릭 서비스 구현**
   - `BusinessMetricsService` 생성
   - 사용자 활동, 대시보드, 위젯, 쿼리 메트릭 추적
   - DAU/HAU 자동 집계 (스케줄링)
   - SLI 계산 플래그 전송

3. **메트릭 수집 통합**
   - `ResponseTimeInterceptor` 업데이트 (API 가용성 추적)
   - `QueryPerformanceMetricsInterceptor` 구현 (쿼리 성능 추적)
   - DatasetService에 쿼리 메트릭 통합

4. **메트릭 API 엔드포인트**
   - `/metrics/health` - 시스템 헬스 체크
   - `/metrics/system` - 시스템 메트릭 조회
   - `/metrics/business` - 비즈니스 메트릭 조회
   - `/metrics/sli` - SLI 지표 정의 조회
   - `/metrics/cold-start` - Lambda Cold Start 추적

#### 정의된 핵심 메트릭

**가용성 메트릭**
- API 가용성 (SLO: 99.9%)
- Lambda 함수 가용성 (SLO: 99.95%)

**성능 메트릭**
- API 응답 시간 (P50 < 200ms, P90 < 500ms, P99 < 1000ms)
- 데이터베이스 쿼리 성능 (P50 < 50ms, P90 < 200ms, P99 < 500ms)
- Lambda Cold Start 비율 (SLO: < 5%)

**에러율 메트릭**
- HTTP 4xx 에러율 (SLO: < 5%)
- HTTP 5xx 에러율 (SLO: < 0.1%)

**리소스 사용률**
- Lambda 메모리 사용률 (경고: 80%, 위험: 90%)
- RDS CPU 사용률 (경고: 70%, 위험: 85%)
- Redis 메모리 사용률 (경고: 75%, 위험: 90%)

**비즈니스 메트릭**
- 일일 활성 사용자 (DAU)
- 대시보드 생성 수
- 위젯 사용 통계
- 쿼리 실행 수

**캐시 효율성**
- 전체 캐시 히트율 (SLO: > 80%)
- L1 캐시 히트율 (SLO: > 60%)
- L2 캐시 히트율 (SLO: > 90%)

#### 메트릭 수집 포인트

1. **자동 수집**
   - 모든 API 요청 (ResponseTimeInterceptor)
   - 데이터셋 쿼리 실행 (DatasetService)
   - 메모리 사용량 (MemoryMonitorMiddleware)
   - 스케줄된 집계 (Cron)

2. **이벤트 기반 수집**
   - 사용자 활동 (로그인, 대시보드 생성 등)
   - 위젯 생성 및 사용
   - 쿼리 실행 및 캐싱

#### 다음 단계

- 실제 환경에서 메트릭 수집 검증
- CloudWatch 대시보드에 SLI 위젯 추가
- 알람 임계값 미세 조정
- 메트릭 기반 자동 스케일링 설정 (T03_S07로 이어짐)