# CloudWatch 알람 배포 가이드

## 개요
이 문서는 VanillaMeta CloudWatch 알람을 AWS 환경에 배포하는 방법을 설명합니다.

## 사전 요구사항

### AWS CLI 설정
```bash
# AWS CLI 설치 확인
aws --version

# AWS 자격 증명 설정
aws configure
```

### 필요한 권한
- CloudWatch 전체 액세스
- SNS 전체 액세스
- Lambda 생성 권한 (Slack 통합 시)
- CloudFormation 스택 생성 권한

## 배포 절차

### 1. 파라미터 준비

`cloudwatch-alarms-params.json` 파일 생성:
```json
[
  {
    "ParameterKey": "ServiceName",
    "ParameterValue": "vanillameta"
  },
  {
    "ParameterKey": "Environment",
    "ParameterValue": "prod"
  },
  {
    "ParameterKey": "AlarmEmail",
    "ParameterValue": "devops@vanillameta.com"
  },
  {
    "ParameterKey": "SlackWebhookUrl",
    "ParameterValue": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
  },
  {
    "ParameterKey": "LambdaFunctionName",
    "ParameterValue": "vanillameta-backend-api-prod-serverlessExpressLambdaFunction"
  },
  {
    "ParameterKey": "ApiGatewayName",
    "ParameterValue": "vanillameta-backend-api-prod"
  },
  {
    "ParameterKey": "RDSInstanceId",
    "ParameterValue": "vanillameta-prod-db"
  }
]
```

### 2. CloudFormation 스택 생성

```bash
# 개발 환경 배포
aws cloudformation create-stack \
  --stack-name vanillameta-dev-cloudwatch-alarms \
  --template-body file://cloudformation/cloudwatch-alarms.yml \
  --parameters file://cloudwatch-alarms-params-dev.json \
  --capabilities CAPABILITY_IAM \
  --tags Key=Service,Value=vanillameta Key=Environment,Value=dev

# 프로덕션 환경 배포
aws cloudformation create-stack \
  --stack-name vanillameta-prod-cloudwatch-alarms \
  --template-body file://cloudformation/cloudwatch-alarms.yml \
  --parameters file://cloudwatch-alarms-params-prod.json \
  --capabilities CAPABILITY_IAM \
  --tags Key=Service,Value=vanillameta Key=Environment,Value=prod
```

### 3. 배포 상태 확인

```bash
# 스택 생성 상태 확인
aws cloudformation describe-stacks \
  --stack-name vanillameta-prod-cloudwatch-alarms \
  --query 'Stacks[0].StackStatus'

# 스택 이벤트 확인
aws cloudformation describe-stack-events \
  --stack-name vanillameta-prod-cloudwatch-alarms \
  --max-items 10
```

### 4. 이메일 구독 확인

SNS 토픽 구독 확인 이메일이 발송됩니다:
1. 알람 이메일 주소로 AWS SNS 구독 확인 메일 수신
2. "Confirm subscription" 링크 클릭
3. 구독 완료 페이지 확인

### 5. Slack 웹훅 설정

#### Slack 앱 생성
1. [Slack API](https://api.slack.com/apps)에서 새 앱 생성
2. "Incoming Webhooks" 활성화
3. 웹훅 URL 생성 및 복사

#### 웹훅 테스트
```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"CloudWatch 알람 테스트 메시지"}' \
  YOUR_WEBHOOK_URL
```

## 배포 후 검증

### 1. 알람 목록 확인
```bash
# 생성된 알람 목록
aws cloudwatch describe-alarms \
  --alarm-name-prefix "vanillameta-prod-" \
  --query 'MetricAlarms[*].[AlarmName,StateValue,ActionsEnabled]' \
  --output table
```

### 2. SNS 토픽 구독 확인
```bash
# SNS 토픽 ARN 조회
TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name vanillameta-prod-cloudwatch-alarms \
  --query 'Stacks[0].Outputs[?OutputKey==`AlarmTopicArn`].OutputValue' \
  --output text)

# 구독 목록 확인
aws sns list-subscriptions-by-topic --topic-arn $TOPIC_ARN
```

### 3. 테스트 알람 발생
```bash
# 테스트를 위한 임시 메트릭 발행
aws cloudwatch put-metric-data \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions FunctionName=vanillameta-backend-api-prod-serverlessExpressLambdaFunction \
  --value 20 \
  --timestamp $(date -u +%Y-%m-%dT%H:%M:%S)
```

## 환경별 설정

### 개발 환경 조정
개발 환경에서는 알람 임계값을 완화:
```yaml
# cloudwatch-alarms-dev.yml 수정 예시
LambdaErrorAlarmCritical:
  Properties:
    Threshold: 20  # 개발 환경은 20개 이상
    EvaluationPeriods: 3  # 평가 기간도 늘림
```

### 프로덕션 환경 강화
프로덕션 환경에서는 더 엄격한 모니터링:
```yaml
# 추가 알람 설정
DatabaseConnectionPoolAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub '${ServiceName}-${Environment}-DB-Connection-Pool'
    MetricName: DatabaseConnections
    Threshold: 50  # 연결 수 50개 초과 시
```

## 업데이트 및 롤백

### 스택 업데이트
```bash
# CloudFormation 템플릿 업데이트
aws cloudformation update-stack \
  --stack-name vanillameta-prod-cloudwatch-alarms \
  --template-body file://cloudformation/cloudwatch-alarms.yml \
  --parameters file://cloudwatch-alarms-params-prod.json \
  --capabilities CAPABILITY_IAM
```

### 변경 세트 미리보기
```bash
# 변경 세트 생성
aws cloudformation create-change-set \
  --stack-name vanillameta-prod-cloudwatch-alarms \
  --change-set-name update-alarms-$(date +%Y%m%d%H%M%S) \
  --template-body file://cloudformation/cloudwatch-alarms.yml \
  --parameters file://cloudwatch-alarms-params-prod.json \
  --capabilities CAPABILITY_IAM

# 변경 사항 검토
aws cloudformation describe-change-set \
  --change-set-name update-alarms-20240614120000 \
  --stack-name vanillameta-prod-cloudwatch-alarms
```

### 롤백 절차
```bash
# 스택 삭제 (완전 롤백)
aws cloudformation delete-stack \
  --stack-name vanillameta-prod-cloudwatch-alarms

# 이전 버전으로 업데이트
aws cloudformation update-stack \
  --stack-name vanillameta-prod-cloudwatch-alarms \
  --template-body file://cloudformation/cloudwatch-alarms-previous.yml \
  --parameters file://cloudwatch-alarms-params-prod.json
```

## 트러블슈팅

### 일반적인 문제

#### 1. SNS 구독 확인 메일이 오지 않음
- 스팸 폴더 확인
- 이메일 주소 정확성 확인
- SNS 토픽 정책 확인

#### 2. Slack 알림이 작동하지 않음
```bash
# Lambda 함수 로그 확인
aws logs tail /aws/lambda/vanillameta-prod-slack-notifier --follow
```

#### 3. 알람이 발생하지 않음
```bash
# 알람 히스토리 확인
aws cloudwatch describe-alarm-history \
  --alarm-name vanillameta-prod-Lambda-Error-Rate-Critical \
  --max-records 10
```

#### 4. 메트릭이 수집되지 않음
```bash
# 메트릭 존재 여부 확인
aws cloudwatch list-metrics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=vanillameta-backend-api-prod-serverlessExpressLambdaFunction
```

### 디버깅 명령어

```bash
# CloudFormation 스택 리소스 확인
aws cloudformation list-stack-resources \
  --stack-name vanillameta-prod-cloudwatch-alarms

# 특정 알람 상세 정보
aws cloudwatch describe-alarms \
  --alarm-names vanillameta-prod-Lambda-Error-Rate-Critical

# SNS 토픽 속성 확인
aws sns get-topic-attributes --topic-arn $TOPIC_ARN

# Lambda 함수 설정 확인 (Slack 통합)
aws lambda get-function-configuration \
  --function-name vanillameta-prod-slack-notifier
```

## 모니터링 대시보드 통합

알람과 함께 대시보드도 배포:
```bash
# 통합 모니터링 대시보드 배포
aws cloudformation create-stack \
  --stack-name vanillameta-prod-monitoring-dashboard \
  --template-body file://cloudformation/integrated-monitoring-dashboard.yml \
  --parameters ParameterKey=ServiceName,ParameterValue=vanillameta \
               ParameterKey=Environment,ParameterValue=prod
```

## 비용 최적화

### 알람 비용 절감 팁
1. **평가 기간 최적화**: 너무 짧은 평가 기간은 비용 증가
2. **복합 알람 사용**: 여러 메트릭을 하나의 알람으로 통합
3. **불필요한 알람 제거**: 정기적인 알람 사용 현황 검토

### 비용 모니터링
```bash
# CloudWatch 비용 확인
aws ce get-cost-and-usage \
  --time-period Start=2024-06-01,End=2024-06-30 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --filter file://cloudwatch-cost-filter.json
```

## 보안 고려사항

### 1. 최소 권한 원칙
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricAlarm",
        "cloudwatch:DeleteAlarms",
        "cloudwatch:DescribeAlarms"
      ],
      "Resource": "arn:aws:cloudwatch:*:*:alarm:vanillameta-*"
    }
  ]
}
```

### 2. 민감 정보 보호
- Slack 웹훅 URL은 파라미터 스토어 사용
- 알람 설명에 민감 정보 포함 금지

### 3. 액세스 제어
- SNS 토픽 정책으로 발행자 제한
- Lambda 함수 실행 역할 최소화

## 체크리스트

### 배포 전
- [ ] AWS 자격 증명 설정 완료
- [ ] 파라미터 파일 생성 및 검증
- [ ] 이메일 주소 정확성 확인
- [ ] Slack 웹훅 URL 획득

### 배포 후
- [ ] 모든 알람 생성 확인
- [ ] 이메일 구독 승인 완료
- [ ] Slack 알림 테스트 성공
- [ ] 초기 테스트 알람 발생 확인

### 운영
- [ ] 월간 알람 테스트 일정 등록
- [ ] 분기별 임계값 검토 일정 등록
- [ ] 알람 대응 플레이북 팀 공유
- [ ] 온콜 로테이션 설정