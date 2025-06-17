---
task_id: T01_S07
sprint_sequence_id: S07
status: completed
complexity: Medium
last_updated: 2025-06-17T12:30:00Z
completed_date: 2025-06-17T12:30:00Z
---

# Task: CloudWatch 통합 대시보드 구성

## Description
시스템 전반의 운영 상태를 실시간으로 모니터링할 수 있는 CloudWatch 대시보드를 구성합니다. Lambda 함수, API Gateway, RDS 등 주요 AWS 서비스의 메트릭을 한눈에 볼 수 있도록 구성하여 운영 가시성을 확보합니다.

## Goal / Objectives
- 시스템 전체 상태를 한눈에 파악할 수 있는 통합 대시보드 구축
- 주요 서비스별 핵심 메트릭 시각화
- 이상 징후 조기 발견을 위한 모니터링 체계 구축

## Acceptance Criteria
- [x] Lambda 함수별 호출 횟수, 에러율, 지연시간 대시보드 구성
- [x] API Gateway의 요청 수, 4xx/5xx 에러율 모니터링
- [x] RDS의 CPU, 메모리, 연결 수 메트릭 표시
- [x] 최근 24시간, 7일, 30일 기간별 뷰 제공
- [x] 모바일에서도 확인 가능한 반응형 대시보드

## Subtasks
- [x] CloudWatch 대시보드 인프라 코드(CloudFormation) 작성
- [x] Lambda 함수 메트릭 위젯 구성
- [x] API Gateway 메트릭 위젯 구성
- [x] RDS 성능 메트릭 위젯 구성
- [x] 커스텀 메트릭 수집을 위한 코드 수정
- [x] 대시보드 접근 권한 설정

## Technical Guidance

### Key Interfaces and Integration Points
- `backend-api/cloudformation/monitoring-dashboard.yml` - 기존 모니터링 템플릿
- `backend-api/src/common/monitoring/` - 모니터링 모듈
- AWS CloudWatch SDK
- AWS CloudFormation

### Specific Imports and Module References
```typescript
// AWS SDK
import { CloudWatch } from 'aws-sdk';
import { MetricDatum } from 'aws-sdk/clients/cloudwatch';
// 모니터링 서비스
import { ConnectionPoolMonitorService } from '@/common/monitoring/connection-pool-monitor.service';
import { SlowQueryMonitorService } from '@/common/monitoring/slow-query-monitor.service';
```

### Existing Patterns to Follow
- 기존 monitoring-dashboard.yml 템플릿 확장
- slow-query-monitoring-dashboard.yml 패턴 참조
- LoggerService를 활용한 커스텀 메트릭 수집

### Database Models and API Contracts
- SlowQueryLog 엔티티 활용
- 모니터링 데이터는 CloudWatch Logs Insights 쿼리 활용

## Implementation Notes

### Step-by-Step Implementation Approach
1. 기존 CloudFormation 템플릿 분석 및 확장
2. 대시보드 위젯 레이아웃 설계
3. 각 서비스별 핵심 메트릭 정의
4. CloudFormation 템플릿 업데이트
5. 커스텀 메트릭 수집 코드 추가
6. 대시보드 배포 및 테스트

### Key Architectural Decisions
- Infrastructure as Code 원칙에 따라 CloudFormation 사용
- 기존 모니터링 인프라와 통합
- 비용 효율적인 메트릭 수집 주기 설정

### Testing Approach
- CloudFormation 템플릿 유효성 검증
- 스테이징 환경에서 대시보드 테스트
- 부하 테스트 중 메트릭 수집 검증

### Performance Considerations
- 메트릭 수집이 애플리케이션 성능에 미치는 영향 최소화
- 필수 메트릭만 수집하여 비용 최적화
- 데이터 보존 기간 설정 (30일 권장)

## Output Log

### 2025-06-17 - Task Completed

#### 구현된 기능:

1. **통합 CloudWatch 대시보드 (integrated-monitoring-dashboard.yml)**
   - Lambda, API Gateway, RDS 메트릭 통합 표시
   - 실시간 로그 분석 위젯 포함
   - 30일 요약 통계 위젯
   - 모바일 반응형 레이아웃

2. **커스텀 메트릭 수집 서비스 (IntegratedMetricsService)**
   - API 요청/응답 메트릭 자동 수집
   - 데이터베이스 연결 풀 메트릭
   - Lambda 콜드 스타트 추적
   - 비즈니스 메트릭 지원

3. **메트릭 인터셉터 (MetricsInterceptor)**
   - 모든 API 요청에 대한 자동 메트릭 수집
   - 에러율 및 응답 시간 추적
   - 느린 응답 자동 감지

4. **배포 자동화**
   - deploy-monitoring-dashboard.sh 스크립트
   - CloudFormation 템플릿 검증
   - 환경별 파라미터 지원

5. **프로덕션 알람 시스템**
   - 종합 시스템 건강성 알람
   - API Gateway 5XX 에러 알람
   - RDS CPU 및 연결 수 알람
   - SNS 토픽을 통한 알림

6. **상세 문서화**
   - monitoring-dashboard-guide.md
   - 사용법, 메트릭 해석, 문제 해결 가이드

#### 변경된 파일:
- cloudformation/integrated-monitoring-dashboard.yml (신규)
- src/common/monitoring/integrated-metrics.service.ts (신규)
- src/common/monitoring/integrated-metrics.service.spec.ts (신규)
- src/common/interceptors/metrics.interceptor.ts (신규)
- src/common/interceptors/metrics.interceptor.spec.ts (신규)
- src/common/monitoring/monitoring.module.ts (수정)
- src/common/monitoring/connection-pool-monitor.service.ts (수정)
- src/app.module.ts (수정)
- scripts/deploy-monitoring-dashboard.sh (신규)
- docs/monitoring-dashboard-guide.md (신규)

#### 테스트 결과:
- IntegratedMetricsService 단위 테스트 작성 완료
- MetricsInterceptor 단위 테스트 작성 완료
- CloudFormation 템플릿 문법 검증 완료

#### 다음 단계 권장사항:
1. 스테이징 환경에서 대시보드 배포 및 테스트
2. SNS 토픽에 이메일/Slack 구독 설정
3. 메트릭 임계값 조정 (실제 트래픽 패턴 기반)
4. 추가 비즈니스 메트릭 정의 및 구현
5. 대시보드 사용자 교육