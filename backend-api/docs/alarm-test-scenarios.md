# VanillaMeta 알람 테스트 시나리오

## 1. 개요

이 문서는 CloudWatch 알람의 정상 작동을 검증하기 위한 테스트 시나리오를 정의합니다.

## 2. 테스트 환경 설정

### 2.1 사전 요구사항
- AWS CLI 설치 및 구성
- 테스트 환경 접근 권한
- Slack 테스트 채널 생성 (#vanillameta-alerts-test)
- 테스트용 이메일 주소

### 2.2 테스트 데이터
```bash
# 환경 변수 설정
export STAGE=dev
export SERVICE_NAME=vanillameta-backend-api
export REGION=ap-northeast-2
```

## 3. Lambda 함수 알람 테스트

### 3.1 Lambda Error Rate 알람 테스트

#### Critical (5% 초과)
```bash
# 에러를 발생시키는 테스트 페이로드
for i in {1..20}; do
  aws lambda invoke \
    --function-name ${SERVICE_NAME}-${STAGE}-app \
    --payload '{"test": "trigger-error"}' \
    --region ${REGION} \
    response.json
done

# 5분 후 알람 상태 확인
aws cloudwatch describe-alarms \
  --alarm-names "${SERVICE_NAME}-${STAGE}-Lambda-Error-Rate-Critical" \
  --region ${REGION}
```

#### Warning (2% 초과)
```bash
# 적은 수의 에러 발생
for i in {1..5}; do
  aws lambda invoke \
    --function-name ${SERVICE_NAME}-${STAGE}-app \
    --payload '{"test": "trigger-error"}' \
    --region ${REGION} \
    response.json
done
```

### 3.2 Lambda Throttle 알람 테스트
```bash
# 동시 실행 제한 임시 설정
aws lambda put-function-concurrency \
  --function-name ${SERVICE_NAME}-${STAGE}-app \
  --reserved-concurrent-executions 1 \
  --region ${REGION}

# 동시 요청 발생
for i in {1..20}; do
  aws lambda invoke \
    --function-name ${SERVICE_NAME}-${STAGE}-app \
    --payload '{}' \
    --region ${REGION} \
    response_$i.json &
done

# 테스트 후 제한 해제
aws lambda delete-function-concurrency \
  --function-name ${SERVICE_NAME}-${STAGE}-app \
  --region ${REGION}
```

### 3.3 Lambda Duration 알람 테스트
```bash
# 지연 시간을 유발하는 페이로드
aws lambda invoke \
  --function-name ${SERVICE_NAME}-${STAGE}-app \
  --payload '{"test": "long-running", "delay": 10000}' \
  --region ${REGION} \
  response.json
```

### 3.4 Lambda Memory 알람 테스트
```bash
# 메모리 사용량을 증가시키는 페이로드
aws lambda invoke \
  --function-name ${SERVICE_NAME}-${STAGE}-app \
  --payload '{"test": "high-memory", "size": "900MB"}' \
  --region ${REGION} \
  response.json
```

## 4. API Gateway 알람 테스트

### 4.1 API Response Time 알람 테스트
```bash
# API 엔드포인트 찾기
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='${STAGE}-${SERVICE_NAME}'].id" \
  --output text \
  --region ${REGION})

API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"

# 느린 응답 테스트
for i in {1..10}; do
  curl -X POST ${API_URL}/test/slow \
    -H "Content-Type: application/json" \
    -d '{"delay": 4000}'
done
```

### 4.2 API Error Rate 알람 테스트

#### 5XX 에러 테스트
```bash
# 서버 에러 유발
for i in {1..20}; do
  curl -X POST ${API_URL}/test/error \
    -H "Content-Type: application/json" \
    -d '{"error": "internal-server-error"}'
done
```

#### 4XX 에러 테스트
```bash
# 클라이언트 에러 유발
for i in {1..50}; do
  curl -X POST ${API_URL}/invalid-endpoint \
    -H "Content-Type: application/json"
done
```

## 5. 비즈니스 메트릭 알람 테스트

### 5.1 Dashboard Load Time 알람 테스트
```bash
# 대시보드 로딩 시간 메트릭 발행
aws cloudwatch put-metric-data \
  --namespace "VanillaMeta/Business" \
  --metric-name "DASHBOARD_LOAD_TIME" \
  --value 4000 \
  --unit Milliseconds \
  --dimensions DashboardId=test-dashboard \
  --region ${REGION}
```

### 5.2 Query Cache Hit Rate 알람 테스트
```bash
# 캐시 미스 메트릭 발행 (적중률 낮추기)
for i in {1..10}; do
  aws cloudwatch put-metric-data \
    --namespace "VanillaMeta/Business" \
    --metric-name "QUERY_CACHE_MISS" \
    --value 1 \
    --unit Count \
    --dimensions QueryType=test-query \
    --region ${REGION}
done

# 캐시 히트 메트릭 발행
aws cloudwatch put-metric-data \
  --namespace "VanillaMeta/Business" \
  --metric-name "QUERY_CACHE_HIT" \
  --value 1 \
  --unit Count \
  --dimensions QueryType=test-query \
  --region ${REGION}
```

## 6. 복합 알람 테스트

### 6.1 Service Health Composite 알람 테스트
```bash
# 여러 임계값을 동시에 초과
# 1. Lambda 에러 발생
for i in {1..10}; do
  aws lambda invoke \
    --function-name ${SERVICE_NAME}-${STAGE}-app \
    --payload '{"test": "trigger-error"}' \
    --region ${REGION} \
    response.json
done

# 2. 메모리 사용량 증가
aws cloudwatch put-metric-data \
  --namespace "VanillaMeta/${STAGE}" \
  --metric-name "LAMBDA_MEMORY_UTILIZATION" \
  --value 90 \
  --unit Percent \
  --region ${REGION}
```

## 7. 알람 복구 테스트

### 7.1 알람 복구 확인
```bash
# 정상 메트릭 발행하여 알람 해제
for i in {1..20}; do
  aws lambda invoke \
    --function-name ${SERVICE_NAME}-${STAGE}-app \
    --payload '{"test": "success"}' \
    --region ${REGION} \
    response.json
done

# 알람 상태 확인
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --region ${REGION}
```

## 8. 알림 전달 테스트

### 8.1 이메일 알림 확인
1. 테스트 이메일 주소로 알람 알림 수신 확인
2. 이메일 제목과 내용의 정확성 검증
3. 알람 우선순위별 구분 확인

### 8.2 Slack 알림 확인
1. #vanillameta-alerts-test 채널 확인
2. 멘션 (@channel, @here) 동작 확인
3. 알람 색상 코드 확인 (빨강/주황/노랑)
4. 타임스탬프 및 한국 시간 표시 확인

## 9. 테스트 자동화 스크립트

### 9.1 전체 알람 테스트 실행
```bash
#!/bin/bash
# alarm-test.sh

set -e

echo "Starting VanillaMeta Alarm Tests..."

# Lambda Error Rate Test
echo "Testing Lambda Error Rate..."
./test-lambda-errors.sh

sleep 360  # 6분 대기

# API Response Time Test
echo "Testing API Response Time..."
./test-api-latency.sh

sleep 360

# Memory Usage Test
echo "Testing Memory Usage..."
./test-memory-usage.sh

sleep 360

# Check all alarms
echo "Checking alarm states..."
aws cloudwatch describe-alarms \
  --alarm-name-prefix "${SERVICE_NAME}-${STAGE}" \
  --query "MetricAlarms[?StateValue=='ALARM'].[AlarmName,StateValue]" \
  --output table \
  --region ${REGION}

echo "Alarm tests completed!"
```

## 10. 테스트 결과 검증

### 10.1 성공 기준
- [ ] 모든 알람이 설정된 임계값에서 트리거됨
- [ ] 알람 발생 시간이 5분 이내
- [ ] 이메일 알림이 정상적으로 수신됨
- [ ] Slack 알림이 올바른 채널에 전송됨
- [ ] 알람 복구 시 OK 상태로 전환됨

### 10.2 실패 시 조치사항
1. CloudWatch Logs에서 메트릭 필터 확인
2. SNS 토픽 구독 상태 확인
3. Lambda 함수 권한 확인
4. 알람 임계값 및 평가 기간 재검토

## 11. 정기 테스트 일정

- **월간 테스트**: 매월 첫째 주 화요일 14:00
- **분기별 전체 테스트**: 분기 마지막 주 목요일 10:00
- **긴급 패치 후**: 배포 완료 후 30분 이내

## 12. 테스트 로그 보관

모든 테스트 결과는 다음 경로에 저장:
- S3: `s3://vanillameta-monitoring/alarm-tests/${YYYY}/${MM}/${DD}/`
- 보관 기간: 1년