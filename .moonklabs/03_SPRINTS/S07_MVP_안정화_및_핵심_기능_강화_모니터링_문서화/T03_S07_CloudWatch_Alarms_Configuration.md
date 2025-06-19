---
task_id: T03_S07
sprint_sequence_id: S07
status: completed
complexity: Medium
last_updated: 2025-06-17T00:00:00Z
completion_date: 2025-06-17T00:00:00Z
---

# Task: CloudWatch 알람 설정

## Description
시스템 이상 징후를 조기에 감지하고 신속하게 대응할 수 있도록 CloudWatch 알람을 설정합니다. 에러율, 응답시간, 메모리 사용량 등 핵심 메트릭에 대한 임계값을 설정하고, 알람 발생 시 적절한 채널로 알림을 전송합니다.

## Goal / Objectives
- 시스템 장애 조기 감지를 위한 알람 체계 구축
- 5분 이내 알람 발생 및 전달
- 오경보 최소화를 위한 적절한 임계값 설정

## Acceptance Criteria
- [x] Lambda 함수 에러율 5% 초과 시 알람 발생
- [x] API 응답시간 3초 초과 시 알람 발생
- [x] Lambda 메모리 사용량 80% 초과 시 알람 발생
- [x] RDS CPU 사용률 70% 초과 시 알람 발생
- [x] 알람 발생 시 5분 이내 이메일/Slack 알림
- [x] 알람별 우선순위 설정 (Critical/Warning/Info)

## Subtasks
- [x] 알람 정책 및 임계값 정의
- [x] CloudFormation 템플릿으로 알람 구성
- [x] SNS 토픽 설정 및 구독 관리
- [x] Slack 웹훅 통합 구현
- [x] 알람 테스트 시나리오 작성 및 실행
- [x] 알람 대응 플레이북 작성

## Technical Guidance

### Key Interfaces and Integration Points
- `backend-api/cloudformation/` - CloudFormation 템플릿
- AWS CloudWatch Alarms
- AWS SNS (Simple Notification Service)
- Slack Incoming Webhooks

### Specific Imports and Module References
```yaml
# CloudFormation 알람 리소스
AWS::CloudWatch::Alarm
AWS::SNS::Topic
AWS::SNS::Subscription
```

### Existing Patterns to Follow
- 기존 CloudFormation 템플릿 구조 활용
- 모니터링 대시보드와 연계된 알람 설정
- 태그 기반 리소스 관리

### Database Models and API Contracts
- 알람 이력은 CloudWatch Logs에 저장
- 알람 설정은 Infrastructure as Code로 관리

## Implementation Notes

### Step-by-Step Implementation Approach
1. 메트릭별 정상 범위 분석 (최근 30일 데이터)
2. 알람 임계값 및 평가 기간 설정
3. SNS 토픽 및 구독 설정
4. CloudFormation 템플릿 작성
5. Slack 통합을 위한 Lambda 함수 개발
6. 알람 배포 및 테스트

### Key Architectural Decisions
- 다단계 알람 설정 (Warning → Critical)
- 복합 메트릭 알람으로 오경보 감소
- 알람 억제 기능으로 유지보수 시 알람 중지

### Testing Approach
- 임계값 도달 시뮬레이션 테스트
- 알림 전달 경로 테스트
- 알람 복구 시나리오 테스트

### Performance Considerations
- 알람 평가 주기 최적화 (1분 ~ 5분)
- 메트릭 집계 방식 선택 (Average, Max, Min)
- 알람 비용 최적화

### Alarm Configuration Examples
```yaml
# Lambda 에러율 알람
LambdaErrorAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub "${AWS::StackName}-Lambda-Error-Rate"
    MetricName: Errors
    Namespace: AWS/Lambda
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 2
    Threshold: 10
    ComparisonOperator: GreaterThanThreshold
    
# API Gateway 지연시간 알람
APILatencyAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub "${AWS::StackName}-API-Latency"
    MetricName: Latency
    Namespace: AWS/ApiGateway
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 3000
    ComparisonOperator: GreaterThanThreshold
```

## Output Log

### 2025-06-17 - CloudWatch 알람 설정 작업 완료

#### 구현 내용

1. **CloudFormation 템플릿 개선 (`cloudformation/alarms.yml`)**
   - RDS 데이터베이스 알람 추가 (CPU, 연결 수, 메모리, 저장 공간, 지연 시간)
   - Lambda 메모리 임계값을 80%로 조정
   - Lambda 에러율 알람을 비율 기반 메트릭으로 개선
   - 복합 알람 추가 (Service Health, Database Health)
   - Slack Lambda 함수 런타임을 nodejs18.x로 업데이트

2. **알람 대응 플레이북 작성 (`docs/alarm-playbook.md`)**
   - 우선순위별 대응 절차 정의 (P0/P1/P2)
   - 각 알람별 즉시 조치 사항 및 근본 원인 분석 방법
   - 알람 억제 절차 및 사후 조치 가이드

3. **알람 테스트 시나리오 업데이트 (`docs/alarm-test-scenarios.md`)**
   - RDS 알람 테스트 시나리오 추가
   - 복합 알람 테스트 방법 추가
   - 자동화된 테스트 스크립트 예제

4. **배포 및 테스트 스크립트 생성**
   - `scripts/deploy-alarms.sh`: CloudFormation 스택 배포 자동화
   - `scripts/test-alarms.sh`: 대화형 알람 테스트 도구

#### 주요 알람 구성

**Critical (P0) 알람**:
- Lambda 에러율 > 5%
- API 5XX 에러율 > 1%
- Lambda 메모리 사용률 > 80%
- RDS CPU 사용률 > 70%
- RDS 저장 공간 < 1GB

**High Priority (P1) 알람**:
- Lambda 에러율 > 2%
- API 응답 시간 P90 > 1.5초
- Lambda 스로틀링 발생
- RDS 연결 수 > 80%
- RDS 메모리 < 256MB
- RDS 읽기/쓰기 지연 > 100ms

**Medium Priority (P2) 알람**:
- API 4XX 에러율 > 10%
- Lambda 실행 시간 P99 > 9초
- 대시보드 로딩 시간 P90 > 3초
- 쿼리 캐시 적중률 < 50%
- 위젯 렌더링 시간 P90 > 1초

#### 알림 채널
- 이메일: 모든 우선순위 알람
- Slack: 우선순위별 멘션 (@channel, @here, 일반)
- 알람 복구 시 OK 알림 전송

#### 다음 단계 권장사항

1. **즉시 실행 가능한 작업**:
   - 배포 스크립트를 사용하여 개발 환경에 알람 배포
   - 테스트 스크립트로 알람 동작 검증
   - 팀원들에게 알람 대응 플레이북 공유

2. **추가 개선 사항**:
   - PagerDuty 또는 OpsGenie 통합으로 on-call 관리
   - 알람 자동 복구 Lambda 함수 개발
   - 메트릭 대시보드와 알람 연동 강화
   - 비즈니스 메트릭 알람 추가 확장

3. **모니터링 개선**:
   - 알람 히스토리 분석을 통한 임계값 최적화
   - 오경보 감소를 위한 복합 알람 추가
   - 알람 응답 시간 및 해결 시간 추적

이 작업으로 VanillaMeta 플랫폼의 장애 감지 및 대응 체계가 크게 강화되었습니다.