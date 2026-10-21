#!/bin/bash
# API 성능 분석 스크립트

set -e

STAGE="${STAGE:-prod}"
REGION="${AWS_REGION:-ap-northeast-2}"
HOURS="${HOURS:-24}"

echo "📈 API 성능 분석 (최근 ${HOURS}시간, Stage: $STAGE)"
echo "====================================================="

LOG_GROUP="/aws/lambda/vanillameta-backend-api-${STAGE}-app"
START_TIME=$(date -d "$HOURS hours ago" +%s)000

# 1. 응답 시간 분석
echo "⏱️ 1. API 응답 시간 분석"
echo "------------------------------"

# CloudWatch Insights 쿼리로 응답 시간 분석
QUERY_ID=$(aws logs start-query \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --end-time "$(date +%s)000" \
  --query-string '
    fields @timestamp, @message
    | filter @message like /REPORT RequestId/
    | parse @message "Duration: * ms" as duration
    | parse @message "Billed Duration: * ms" as billed_duration
    | parse @message "Memory Size: * MB" as memory_size
    | parse @message "Max Memory Used: * MB" as memory_used
    | stats 
        count() as requests,
        avg(duration) as avg_duration,
        min(duration) as min_duration,
        max(duration) as max_duration,
        pct(duration, 50) as p50_duration,
        pct(duration, 95) as p95_duration,
        pct(duration, 99) as p99_duration
  ' \
  --region "$REGION" \
  --query 'queryId' \
  --output text)

echo "CloudWatch Insights 쿼리 실행 중... (쿼리 ID: $QUERY_ID)"
sleep 10

# 쿼리 결과 확인
aws logs get-query-results \
  --query-id "$QUERY_ID" \
  --region "$REGION" \
  --query 'results[*][*].value' \
  --output table

# 2. 에러율 분석
echo -e "\n❌ 2. 에러율 분석"
echo "------------------------------"

TOTAL_REQUESTS=$(aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "REPORT RequestId" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'length(events)' \
  --output text)

ERROR_COUNT=$(aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "ERROR" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'length(events)' \
  --output text)

TIMEOUT_COUNT=$(aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "Task timed out" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'length(events)' \
  --output text)

if [ "$TOTAL_REQUESTS" -gt 0 ]; then
  ERROR_RATE=$(echo "scale=2; $ERROR_COUNT * 100 / $TOTAL_REQUESTS" | bc -l)
  TIMEOUT_RATE=$(echo "scale=2; $TIMEOUT_COUNT * 100 / $TOTAL_REQUESTS" | bc -l)
else
  ERROR_RATE="0"
  TIMEOUT_RATE="0"
fi

echo "총 요청 수: $TOTAL_REQUESTS"
echo "에러 발생: $ERROR_COUNT 건 (${ERROR_RATE}%)"
echo "타임아웃: $TIMEOUT_COUNT 건 (${TIMEOUT_RATE}%)"

# 3. 가장 느린 엔드포인트 확인
echo -e "\n🐌 3. 가장 느린 엔드포인트 (상위 10개)"
echo "------------------------------"

aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern '[timestamp, requestId, level="INFO", message="Request completed", method, path, statusCode, duration > 2000]' \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'events[*].message' \
  --output text | \
  head -10 | \
  while read -r line; do
    echo "$line"
  done

# 4. 메모리 사용 패턴 분석
echo -e "\n💾 4. 메모리 사용 패턴"
echo "------------------------------"

MEMORY_QUERY_ID=$(aws logs start-query \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --end-time "$(date +%s)000" \
  --query-string '
    fields @timestamp, @message
    | filter @message like /Max Memory Used/
    | parse @message "Memory Size: * MB" as memory_size
    | parse @message "Max Memory Used: * MB" as memory_used
    | stats 
        count() as samples,
        avg(memory_used) as avg_memory,
        min(memory_used) as min_memory,
        max(memory_used) as max_memory,
        pct(memory_used, 95) as p95_memory
    by bin(5m)
  ' \
  --region "$REGION" \
  --query 'queryId' \
  --output text)

sleep 8
aws logs get-query-results \
  --query-id "$MEMORY_QUERY_ID" \
  --region "$REGION" \
  --query 'results[*][*].value' \
  --output table

# 5. 콜드 스타트 분석
echo -e "\n🥶 5. 콜드 스타트 분석"
echo "------------------------------"

COLD_START_COUNT=$(aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "INIT_START" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'length(events)' \
  --output text)

if [ "$TOTAL_REQUESTS" -gt 0 ]; then
  COLD_START_RATE=$(echo "scale=2; $COLD_START_COUNT * 100 / $TOTAL_REQUESTS" | bc -l)
else
  COLD_START_RATE="0"
fi

echo "콜드 스타트 발생: $COLD_START_COUNT 건 (${COLD_START_RATE}%)"

# 초기화 시간 분석
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern '[timestamp, requestId, level, message="REPORT*", ..., duration_label="Init Duration:", init_duration, duration_unit]' \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'events[*].message' \
  --output text | \
  grep "Init Duration" | \
  tail -5

# 6. API Gateway 메트릭 (가능한 경우)
echo -e "\n🌐 6. API Gateway 메트릭"
echo "------------------------------"

# API Gateway 메트릭 확인
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
START_TIME_ISO=$(date -u -d "$HOURS hours ago" +%Y-%m-%dT%H:%M:%S)

METRICS=("Count" "Latency" "IntegrationLatency" "4XXError" "5XXError")

for metric in "${METRICS[@]}"; do
  echo "📊 $metric (최근 1시간 평균):"
  aws cloudwatch get-metric-statistics \
    --namespace AWS/ApiGateway \
    --metric-name "$metric" \
    --start-time "$START_TIME_ISO" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Average,Sum \
    --region "$REGION" \
    --query 'Datapoints[*].[Average,Sum]' \
    --output text 2>/dev/null | head -1 || echo "데이터 없음"
done

# 7. 추천 개선사항
echo -e "\n💡 7. 성능 개선 추천사항"
echo "------------------------------"

# 에러율이 높은 경우
if (( $(echo "$ERROR_RATE > 1" | bc -l) )); then
  echo "⚠️ 에러율이 높습니다 (${ERROR_RATE}%). 로그를 확인하여 근본 원인을 파악하세요."
fi

# 타임아웃이 많은 경우
if (( $(echo "$TIMEOUT_RATE > 0.5" | bc -l) )); then
  echo "⚠️ 타임아웃이 자주 발생합니다 (${TIMEOUT_RATE}%). 쿼리 최적화나 메모리 증가를 고려하세요."
fi

# 콜드 스타트가 많은 경우
if (( $(echo "$COLD_START_RATE > 5" | bc -l) )); then
  echo "⚠️ 콜드 스타트 비율이 높습니다 (${COLD_START_RATE}%). 웜업 전략을 검토하세요."
fi

echo "✅ Lambda 메모리를 1024MB → 2048MB로 증가하면 성능 향상 가능"
echo "✅ 프로비저닝된 동시성 설정으로 콜드 스타트 감소 가능"
echo "✅ 데이터베이스 연결 풀 최적화 검토 필요"

# 8. CloudWatch 대시보드 링크
echo -e "\n🔗 8. 관련 링크"
echo "------------------------------"
echo "CloudWatch 로그: https://console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:log-groups/log-group/\$252Faws\$252Flambda\$252F$(echo $LOG_GROUP | sed 's/\//%252F/g')"
echo "Lambda 모니터링: https://console.aws.amazon.com/lambda/home?region=$REGION#/functions/vanillameta-backend-api-${STAGE}-app?tab=monitoring"
echo "API Gateway 메트릭: https://console.aws.amazon.com/apigateway/home?region=$REGION#/apis"

echo -e "\n✅ 성능 분석 완료"