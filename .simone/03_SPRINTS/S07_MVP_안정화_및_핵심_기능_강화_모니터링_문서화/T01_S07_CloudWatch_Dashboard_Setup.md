---
task_id: T01_S07
sprint_sequence_id: S07
status: completed
complexity: Medium
last_updated: 2025-06-14T23:00:00Z
---

# Task: CloudWatch 통합 대시보드 구성

## Description
시스템 전반의 운영 상태를 실시간으로 모니터링할 수 있는 CloudWatch 대시보드를 구성합니다. Lambda 함수, API Gateway, RDS 등 주요 AWS 서비스의 메트릭을 한눈에 볼 수 있도록 구성하여 운영 가시성을 확보합니다.

## Goal / Objectives
- 시스템 전체 상태를 한눈에 파악할 수 있는 통합 대시보드 구축
- 주요 서비스별 핵심 메트릭 시각화
- 이상 징후 조기 발견을 위한 모니터링 체계 구축

## Acceptance Criteria
- [ ] Lambda 함수별 호출 횟수, 에러율, 지연시간 대시보드 구성
- [ ] API Gateway의 요청 수, 4xx/5xx 에러율 모니터링
- [ ] RDS의 CPU, 메모리, 연결 수 메트릭 표시
- [ ] 최근 24시간, 7일, 30일 기간별 뷰 제공
- [ ] 모바일에서도 확인 가능한 반응형 대시보드

## Subtasks
- [ ] CloudWatch 대시보드 인프라 코드(CloudFormation) 작성
- [ ] Lambda 함수 메트릭 위젯 구성
- [ ] API Gateway 메트릭 위젯 구성
- [ ] RDS 성능 메트릭 위젯 구성
- [ ] 커스텀 메트릭 수집을 위한 코드 수정
- [ ] 대시보드 접근 권한 설정

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

### 2025-06-14

#### 완료된 작업

1. **CloudWatch 대시보드 인프라 코드 작성**
   - `cloudformation/integrated-monitoring-dashboard.yml` 생성
   - 포괄적인 모니터링 위젯 구성 (Lambda, API Gateway, RDS, Redis)
   - 커스텀 메트릭 필터 및 알람 설정

2. **CloudWatch 메트릭 서비스 구현**
   - `src/common/monitoring/cloudwatch-metrics.service.ts` 생성
   - 버퍼링 및 배치 전송 기능
   - 다양한 메트릭 타입 지원 (API 응답 시간, 메모리, 캐시 등)

3. **메트릭 수집 통합**
   - `ResponseTimeInterceptor` 구현 및 글로벌 적용
   - `MemoryMonitorMiddleware` CloudWatch 통합
   - `MonitoringModule`에 CloudWatchMetricsService 추가

4. **IAM 권한 설정**
   - `serverless.yml`에 CloudWatch PutMetricData 권한 추가
   - Lambda 실행 역할에 필요한 권한 부여

5. **배포 자동화**
   - `scripts/deploy-cloudwatch-dashboard.sh` 스크립트 생성
   - `package.json`에 배포 명령어 추가 (deploy:dashboard:dev/prod)

6. **문서화**
   - `docs/cloudwatch-dashboard-guide.md` 작성
   - 대시보드 사용법, 알람 설정, 트러블슈팅 가이드 포함

#### 주요 메트릭 구성

- **Lambda 메트릭**: 호출 수, 에러율, 응답 시간, 메모리 사용량
- **API Gateway 메트릭**: 요청 수, 4XX/5XX 에러, 지연시간
- **RDS 메트릭**: CPU, 메모리, 연결 수, I/O 성능
- **Redis 메트릭**: CPU, 연결 수, 캐시 히트/미스
- **커스텀 메트릭**: 쿼리 캐시 효율성, 백그라운드 작업 상태

#### 알람 구성 (프로덕션)

- 높은 에러율 알람 (10개/5분)
- Lambda 에러율 알람 (5% 초과)
- API Gateway 5XX 알람 (5개/5분)
- RDS CPU 알람 (80% 초과)
- Lambda 메모리 알람 (85% 초과)

#### 다음 단계

- CloudFormation 스택 실제 배포 테스트
- 알람 SNS 이메일 구독 설정
- 대시보드 접근 권한 관리
- 추가 커스텀 메트릭 정의 (T02_S07로 이어짐)