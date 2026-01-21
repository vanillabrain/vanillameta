#!/bin/bash
# 긴급 복구 스크립트

set -e

STAGE="${1:-prod}"
ACTION="${2:-status}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}🚨 VanillaMeta 긴급 복구 스크립트${NC}"
echo -e "${YELLOW}Stage: $STAGE${NC}"
echo -e "${YELLOW}Action: $ACTION${NC}"
echo "====================================================="

# 사용법 출력
usage() {
  echo "사용법: $0 <stage> <action>"
  echo ""
  echo "Stage options:"
  echo "  dev       개발 환경"
  echo "  prod      프로덕션 환경"
  echo ""
  echo "Action options:"
  echo "  status    현재 상태 확인"
  echo "  restart   Lambda 함수 재시작 (강제 업데이트)"
  echo "  rollback  이전 버전으로 롤백"
  echo "  scale     Lambda 동시성 조정"
  echo "  warmup    Lambda 웜업 실행"
  echo "  logs      최근 에러 로그 출력"
  echo ""
  echo "예시:"
  echo "  $0 prod status     # 프로덕션 상태 확인"
  echo "  $0 prod restart    # Lambda 재시작"
  echo "  $0 prod rollback   # 이전 버전으로 롤백"
  exit 1
}

# 파라미터 검증
if [ "$STAGE" != "dev" ] && [ "$STAGE" != "prod" ]; then
  echo -e "${RED}❌ 올바르지 않은 stage: $STAGE${NC}"
  usage
fi

FUNCTION_NAME="vanillameta-backend-api-${STAGE}-app"
REGION="${AWS_REGION:-ap-northeast-2}"

# AWS CLI 설치 확인
if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ AWS CLI가 설치되지 않았습니다${NC}"
  exit 1
fi

# AWS 자격 증명 확인
if ! aws sts get-caller-identity &> /dev/null; then
  echo -e "${RED}❌ AWS 자격 증명이 설정되지 않았습니다${NC}"
  exit 1
fi

# 현재 상태 확인
check_status() {
  echo -e "${BLUE}📊 시스템 상태 확인${NC}"
  echo "------------------------------"
  
  # Lambda 함수 상태
  echo "🔍 Lambda 함수 상태:"
  FUNCTION_STATUS=$(aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query 'Configuration.State' \
    --output text 2>/dev/null || echo "ERROR")
  
  if [ "$FUNCTION_STATUS" = "Active" ]; then
    echo -e "${GREEN}✅ Lambda 함수 정상 ($FUNCTION_STATUS)${NC}"
  else
    echo -e "${RED}❌ Lambda 함수 이상 ($FUNCTION_STATUS)${NC}"
  fi
  
  # API 연결성 테스트
  echo "🌐 API 연결성 테스트:"
  API_URL="https://api.vanillameta.com/v1"
  if [ "$STAGE" = "dev" ]; then
    API_URL="https://dev-api.vanillameta.com/v1"
  fi
  
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" --max-time 10 || echo "000")
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ API 정상 응답 (HTTP $HTTP_STATUS)${NC}"
  else
    echo -e "${RED}❌ API 응답 이상 (HTTP $HTTP_STATUS)${NC}"
  fi
  
  # 최근 에러 확인
  echo "⚠️ 최근 10분간 에러 확인:"
  START_TIME=$(date -d '10 minutes ago' +%s)000
  ERROR_COUNT=$(aws logs filter-log-events \
    --log-group-name "/aws/lambda/$FUNCTION_NAME" \
    --filter-pattern "ERROR" \
    --start-time "$START_TIME" \
    --region "$REGION" \
    --query 'length(events)' \
    --output text 2>/dev/null || echo "0")
  
  if [ "$ERROR_COUNT" = "0" ]; then
    echo -e "${GREEN}✅ 에러 없음${NC}"
  else
    echo -e "${YELLOW}⚠️ $ERROR_COUNT 개의 에러 발견${NC}"
  fi
}

# Lambda 재시작 (강제 업데이트)
restart_lambda() {
  echo -e "${YELLOW}🔄 Lambda 함수 재시작${NC}"
  echo "------------------------------"
  
  read -p "정말로 Lambda 함수를 재시작하시겠습니까? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "취소되었습니다."
    return
  fi
  
  # 환경 변수를 약간 변경하여 강제 업데이트
  CURRENT_TIME=$(date +%s)
  
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "Variables={FORCE_UPDATE=$CURRENT_TIME}" \
    --region "$REGION"
  
  echo -e "${GREEN}✅ Lambda 함수 업데이트 요청 완료${NC}"
  echo "몇 분 후 상태를 다시 확인하세요."
}

# 이전 버전으로 롤백
rollback() {
  echo -e "${YELLOW}⏪ 이전 버전으로 롤백${NC}"
  echo "------------------------------"
  
  # 사용 가능한 버전 확인
  echo "사용 가능한 버전들:"
  aws lambda list-versions-by-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query 'Versions[?Version!=`$LATEST`].[Version,LastModified]' \
    --output table
  
  read -p "롤백할 버전을 입력하세요: " -r VERSION
  
  if [ -z "$VERSION" ]; then
    echo "버전이 입력되지 않았습니다."
    return
  fi
  
  read -p "버전 $VERSION으로 롤백하시겠습니까? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "취소되었습니다."
    return
  fi
  
  # 별칭을 이전 버전으로 업데이트
  aws lambda update-alias \
    --function-name "$FUNCTION_NAME" \
    --name "PROD" \
    --function-version "$VERSION" \
    --region "$REGION" 2>/dev/null || \
  aws lambda create-alias \
    --function-name "$FUNCTION_NAME" \
    --name "PROD" \
    --function-version "$VERSION" \
    --region "$REGION"
  
  echo -e "${GREEN}✅ 버전 $VERSION으로 롤백 완료${NC}"
}

# Lambda 동시성 조정
scale_lambda() {
  echo -e "${YELLOW}📈 Lambda 동시성 조정${NC}"
  echo "------------------------------"
  
  # 현재 동시성 설정 확인
  CURRENT_CONCURRENCY=$(aws lambda get-function-concurrency \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query 'ReservedConcurrencyAmount' \
    --output text 2>/dev/null || echo "제한 없음")
  
  echo "현재 동시성 설정: $CURRENT_CONCURRENCY"
  
  echo "동시성 옵션:"
  echo "1) 제한 제거 (무제한)"
  echo "2) 보수적 설정 (10)"
  echo "3) 일반 설정 (50)"
  echo "4) 높은 설정 (100)"
  echo "5) 커스텀 값 입력"
  
  read -p "선택하세요 (1-5): " -n 1 -r CHOICE
  echo
  
  case $CHOICE in
    1)
      aws lambda delete-function-concurrency \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION"
      echo -e "${GREEN}✅ 동시성 제한 제거됨${NC}"
      ;;
    2)
      aws lambda put-function-concurrency \
        --function-name "$FUNCTION_NAME" \
        --reserved-concurrency-amount 10 \
        --region "$REGION"
      echo -e "${GREEN}✅ 동시성이 10으로 설정됨${NC}"
      ;;
    3)
      aws lambda put-function-concurrency \
        --function-name "$FUNCTION_NAME" \
        --reserved-concurrency-amount 50 \
        --region "$REGION"
      echo -e "${GREEN}✅ 동시성이 50으로 설정됨${NC}"
      ;;
    4)
      aws lambda put-function-concurrency \
        --function-name "$FUNCTION_NAME" \
        --reserved-concurrency-amount 100 \
        --region "$REGION"
      echo -e "${GREEN}✅ 동시성이 100으로 설정됨${NC}"
      ;;
    5)
      read -p "동시성 값을 입력하세요: " -r CUSTOM_CONCURRENCY
      aws lambda put-function-concurrency \
        --function-name "$FUNCTION_NAME" \
        --reserved-concurrency-amount "$CUSTOM_CONCURRENCY" \
        --region "$REGION"
      echo -e "${GREEN}✅ 동시성이 $CUSTOM_CONCURRENCY로 설정됨${NC}"
      ;;
    *)
      echo "취소되었습니다."
      ;;
  esac
}

# Lambda 웜업 실행
warmup_lambda() {
  echo -e "${YELLOW}🔥 Lambda 웜업 실행${NC}"
  echo "------------------------------"
  
  # 웜업 이벤트 생성
  WARMUP_EVENT='{"source":"serverless-plugin-warmup"}'
  
  for i in {1..3}; do
    echo "웜업 요청 $i/3..."
    aws lambda invoke \
      --function-name "$FUNCTION_NAME" \
      --payload "$WARMUP_EVENT" \
      --region "$REGION" \
      /tmp/warmup-response-$i.json
    
    echo "응답:"
    cat /tmp/warmup-response-$i.json
    echo ""
    
    sleep 2
  done
  
  echo -e "${GREEN}✅ 웜업 완료${NC}"
  rm -f /tmp/warmup-response-*.json
}

# 최근 에러 로그 출력
show_logs() {
  echo -e "${YELLOW}📋 최근 에러 로그 (30분)${NC}"
  echo "------------------------------"
  
  START_TIME=$(date -d '30 minutes ago' +%s)000
  
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/$FUNCTION_NAME" \
    --filter-pattern "ERROR" \
    --start-time "$START_TIME" \
    --region "$REGION" \
    --query 'events[*].[timestamp,message]' \
    --output text | \
    while read -r timestamp message; do
      READABLE_TIME=$(date -d "@$(($timestamp/1000))" '+%Y-%m-%d %H:%M:%S')
      echo -e "${RED}[$READABLE_TIME]${NC} $message"
    done
}

# 메인 로직
case $ACTION in
  status)
    check_status
    ;;
  restart)
    check_status
    echo ""
    restart_lambda
    ;;
  rollback)
    rollback
    ;;
  scale)
    scale_lambda
    ;;
  warmup)
    warmup_lambda
    ;;
  logs)
    show_logs
    ;;
  *)
    echo -e "${RED}❌ 알 수 없는 액션: $ACTION${NC}"
    usage
    ;;
esac

echo ""
echo -e "${BLUE}🔗 추가 리소스:${NC}"
echo "CloudWatch 로그: https://console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:log-groups/log-group/\$252Faws\$252Flambda\$252F$FUNCTION_NAME"
echo "Lambda 콘솔: https://console.aws.amazon.com/lambda/home?region=$REGION#/functions/$FUNCTION_NAME"
echo "API Gateway: https://console.aws.amazon.com/apigateway/home?region=$REGION"

if [ "$ACTION" != "status" ]; then
  echo ""
  echo -e "${GREEN}작업 완료. 몇 분 후 상태를 다시 확인하세요:${NC}"
  echo "$0 $STAGE status"
fi