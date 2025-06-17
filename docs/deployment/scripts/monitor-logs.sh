#!/bin/bash
# monitor-logs.sh
# VanillaMeta 실시간 로그 모니터링 스크립트

STAGE=${1:-prod}
PROFILE="vanillameta-${STAGE}"
LOG_GROUP="/aws/lambda/vanillameta-backend-api-${STAGE}-app"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "=== VanillaMeta Log Monitor ==="
echo "Stage: $STAGE"
echo "Log Group: $LOG_GROUP"
echo "Profile: $PROFILE"
echo ""
echo "Monitoring patterns:"
echo -e "${RED}ERROR${NC} - Error messages"
echo -e "${YELLOW}WARN${NC} - Warning messages"
echo -e "${GREEN}INFO${NC} - Information messages"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo "========================================="
echo ""

# 로그 스트림 모니터링
aws logs tail $LOG_GROUP \
  --follow \
  --format short \
  --profile $PROFILE \
  --color on \
  | while IFS= read -r line; do
    if [[ $line == *"ERROR"* ]]; then
        echo -e "${RED}${line}${NC}"
    elif [[ $line == *"WARN"* ]]; then
        echo -e "${YELLOW}${line}${NC}"
    elif [[ $line == *"WarmUp"* ]]; then
        echo -e "${GREEN}[WARMUP] ${line}${NC}"
    else
        echo "$line"
    fi
done