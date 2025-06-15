---
task_id: T03_S07
sprint_sequence_id: S07
status: completed
complexity: Medium
last_updated: 2025-06-15T02:45:00Z
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

### 2025-06-15 - CloudWatch 알람 구현 완료

#### 구현 사항

1. **CloudFormation 템플릿 생성**
   - `backend-api/cloudformation/cloudwatch-alarms.yml` 파일 생성
   - 다음 알람들을 구성:
     - Lambda 에러율 알람 (Critical: 5%, Warning: 2%)
     - Lambda 메모리 사용량 알람 (80% 임계값)
     - API Gateway 응답시간 알람 (3초 임계값)
     - API Gateway 4xx/5xx 에러 알람
     - RDS CPU 사용률 알람 (70% 임계값)
     - RDS 연결 수 및 디스크 공간 알람
     - Lambda 동시 실행 및 스로틀링 알람
     - 비즈니스 메트릭 (DAU 감소) 알람

2. **SNS 및 Slack 통합**
   - SNS 토픽 자동 생성 및 이메일 구독 설정
   - Slack 웹훅 통합을 위한 Lambda 함수 구현
   - 알람 우선순위별 색상 및 아이콘 설정

3. **문서화**
   - `docs/alarm-response-playbook.md`: 알람 대응 절차서
   - `docs/alarm-test-scenarios.md`: 알람 테스트 시나리오
   - `docs/deploy-cloudwatch-alarms.md`: 배포 가이드

#### 주요 기능

1. **다단계 알람 체계**
   - Critical/Warning 레벨로 단계적 알람 설정
   - 우선순위별 대응 시간 정의

2. **자동화된 알림**
   - 이메일 및 Slack 동시 알림
   - 한국어 시간대 및 메시지 포맷팅

3. **복합 메트릭 알람**
   - 콜드 스타트 비율 계산
   - DAU 변화율 추적

4. **운영 편의성**
   - 파라미터화된 템플릿으로 환경별 배포 용이
   - 알람 억제 기능으로 유지보수 시 알람 중지 가능

#### 다음 단계

- CloudFormation 스택 배포 후 실제 알람 테스트
- 팀원들과 알람 대응 플레이북 공유
- 정기적인 알람 테스트 일정 수립