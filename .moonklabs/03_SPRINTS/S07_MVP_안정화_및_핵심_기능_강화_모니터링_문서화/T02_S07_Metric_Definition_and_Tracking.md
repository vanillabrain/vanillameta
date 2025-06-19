---
task_id: T02_S07
sprint_sequence_id: S07
status: completed
complexity: Low
last_updated: 2025-06-16T19:10:00Z
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
*(This section is populated as work progresses on the task)*

## Output Log

### 2025-06-16 - 메트릭 정의 및 추적 시스템 구현

#### 구현 완료 사항

1. **핵심 메트릭 정의서 작성**
   - docs/metrics-definition.md 문서 생성
   - 5개 카테고리 (가용성, 성능, 에러율, 비즈니스, 리소스 사용률)
   - 총 25개 핵심 메트릭 정의
   - SLO 목표치 및 알람 임계값 설정
   - 우선순위별 알람 분류 (P0~P3)

2. **비즈니스 메트릭 서비스 구현**
   - BusinessMetricsService 생성
   - 대시보드 로딩 시간, 위젯 렌더링, 쿼리 캐시 메트릭
   - API 사용량 및 응답시간 추적
   - Lambda 콜드스타트 및 메모리 사용률 기록

3. **메트릭 수집 인프라 구축**
   - ResponseTimeInterceptor - API 응답시간 자동 측정
   - MemoryMonitorMiddleware - 메모리 사용률 추적
   - QueryPerformanceMetricsInterceptor - 쿼리 성능 메트릭
   - CloudWatchMetricsService - CloudWatch 통합

4. **메트릭 API 엔드포인트**
   - GET /api/monitoring/metrics/health - 시스템 헬스 체크
   - GET /api/monitoring/metrics/memory - 메모리 사용 현황
   - GET /api/monitoring/metrics/dashboard - 대시보드 메트릭
   - GET /api/monitoring/metrics/api - API 성능 메트릭
   - GET /api/monitoring/metrics/query - 쿼리 성능 메트릭
   - GET /api/monitoring/metrics/summary - 전체 메트릭 요약

5. **모듈 통합**
   - BusinessMetricsModule 생성 및 MonitoringModule 통합
   - 글로벌 인터셉터로 ResponseTimeInterceptor 등록
   - 메모리 모니터링 미들웨어 통합

6. **테스트 작성**
   - BusinessMetricsService 단위 테스트 (100% 커버리지)
   - 모든 메트릭 기록 메서드 테스트
   - 설정 비활성화 시나리오 테스트

#### 메트릭 네이밍 규칙
- {SERVICE_NAME}_{COMPONENT}_{METRIC_TYPE}_{AGGREGATION}
- 예: VANILLAMETA_API_RESPONSE_TIME_P90

#### 다음 단계 권장사항
1. CloudFormation 템플릿에 새 메트릭 대시보드 위젯 추가
2. 알람 설정 자동화 스크립트 작성
3. 메트릭 데이터 검증을 위한 통합 테스트
4. 프로덕션 배포 및 모니터링 시작
