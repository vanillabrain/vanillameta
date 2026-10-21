#!/bin/bash
# Lambda 함수 상태 종합 체크 스크립트

set -e

FUNCTION_NAME="vanillameta-backend-api-${STAGE:-prod}-app"
REGION="${AWS_REGION:-ap-northeast-2}"

echo "🔍 Lambda 함수 상태 체크: $FUNCTION_NAME"
echo "====================================================="

# 1. 함수 기본 정보 확인
echo "📋 1. 함수 기본 정보"
aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query '{
    FunctionName: Configuration.FunctionName,
    Runtime: Configuration.Runtime,
    Handler: Configuration.Handler,
    CodeSize: Configuration.CodeSize,
    Timeout: Configuration.Timeout,
    MemorySize: Configuration.MemorySize,
    LastModified: Configuration.LastModified,
    State: Configuration.State
  }' \
  --output table

# 2. 최근 오류 로그 확인
echo -e "\n⚠️  2. 최근 1시간 오류 로그"
LOG_GROUP="/aws/lambda/$FUNCTION_NAME"
START_TIME=$(date -d '1 hour ago' +%s)000

aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "ERROR" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'events[*].[timestamp,message]' \
  --output table | head -20

# 3. 타임아웃 발생 확인
echo -e "\n⏱️  3. 타임아웃 발생 확인"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "Task timed out" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'length(events)' \
  --output text | xargs -I {} echo "타임아웃 발생 횟수: {} 건"

# 4. 메모리 사용량 확인
echo -e "\n💾 4. 최근 메모리 사용량"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "Max Memory Used" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'events[*].message' \
  --output text | grep -o 'Max Memory Used: [0-9]* MB' | tail -5

# 5. 콜드 스타트 확인
echo -e "\n🥶 5. 콜드 스타트 발생"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "INIT_START" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'length(events)' \
  --output text | xargs -I {} echo "콜드 스타트 발생: {} 건"

# 6. 웜업 상태 확인
echo -e "\n🔥 6. 웜업 요청 확인"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --filter-pattern "WarmUp" \
  --start-time "$START_TIME" \
  --region "$REGION" \
  --query 'length(events)' \
  --output text | xargs -I {} echo "웜업 요청: {} 건"

# 7. 함수 테스트
echo -e "\n🧪 7. 함수 연결성 테스트"
if command -v curl &> /dev/null; then
  API_URL="https://api.vanillameta.com/v1"
  if [ "$STAGE" = "dev" ]; then
    API_URL="https://dev-api.vanillameta.com/v1"
  fi
  
  echo "Health check: $API_URL/health"
  curl -s -o /dev/null -w "HTTP Status: %{http_code}, Response Time: %{time_total}s\n" "$API_URL/health" || echo "❌ Health check 실패"
else
  echo "⚠️ curl이 설치되지 않아 API 테스트를 건너뜁니다."
fi

echo -e "\n✅ Lambda 상태 체크 완료"
echo "상세한 로그는 CloudWatch에서 확인하세요:"
echo "https://console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:log-groups/log-group/\$252Faws\$252Flambda\$252F$FUNCTION_NAME"