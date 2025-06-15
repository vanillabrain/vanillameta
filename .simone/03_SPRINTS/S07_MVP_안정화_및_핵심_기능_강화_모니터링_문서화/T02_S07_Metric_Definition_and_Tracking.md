---
task_id: T02_S07
sprint_sequence_id: S07
status: open
complexity: Low
last_updated: 2025-06-14T19:00:00Z
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