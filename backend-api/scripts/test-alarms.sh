#!/bin/bash

# VanillaMeta CloudWatch Alarms 테스트 스크립트

set -e

# 색상 코드 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 기본 변수 설정
REGION="${AWS_REGION:-ap-northeast-2}"
STAGE="${STAGE:-dev}"
SERVICE_NAME="vanillameta-backend-api"
FUNCTION_NAME="${SERVICE_NAME}-${STAGE}-app"

# 함수: 정보 메시지 출력
info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# 함수: 성공 메시지 출력
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 함수: 경고 메시지 출력
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 함수: 오류 메시지 출력
error() {
    echo -e "${RED}✗ $1${NC}"
}

# 함수: 알람 상태 확인
check_alarm_state() {
    local alarm_name=$1
    local expected_state=${2:-"ALARM"}
    
    local actual_state=$(aws cloudwatch describe-alarms \
        --alarm-names "$alarm_name" \
        --region $REGION \
        --query 'MetricAlarms[0].StateValue' \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$actual_state" = "$expected_state" ]; then
        success "$alarm_name is in $expected_state state"
        return 0
    else
        error "$alarm_name is in $actual_state state (expected: $expected_state)"
        return 1
    fi
}

# 함수: 알람 트리거 대기
wait_for_alarm() {
    local alarm_name=$1
    local max_wait=360  # 6분
    local elapsed=0
    
    info "Waiting for $alarm_name to trigger..."
    
    while [ $elapsed -lt $max_wait ]; do
        if check_alarm_state "$alarm_name" "ALARM" &>/dev/null; then
            return 0
        fi
        sleep 10
        elapsed=$((elapsed + 10))
        echo -n "."
    done
    echo
    return 1
}

echo "========================================"
echo "VanillaMeta CloudWatch Alarms Test"
echo "========================================"
echo "Stage: $STAGE"
echo "Region: $REGION"
echo "Function: $FUNCTION_NAME"
echo "========================================"

# 메뉴 표시
echo ""
echo "Select test to run:"
echo "1) Lambda Error Rate (Critical)"
echo "2) Lambda Memory Usage (Critical)"
echo "3) API Response Time (Warning)"
echo "4) Quick Health Check (All alarms)"
echo "5) Exit"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        info "Testing Lambda Error Rate Alarm..."
        warning "This will generate errors in your Lambda function"
        read -p "Continue? (y/n) " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # 에러 발생 페이로드
            ERROR_PAYLOAD='{"test": "trigger-error", "error_type": "alarm-test"}'
            
            info "Invoking Lambda with error payload 20 times..."
            for i in {1..20}; do
                aws lambda invoke \
                    --function-name $FUNCTION_NAME \
                    --payload "$ERROR_PAYLOAD" \
                    --region $REGION \
                    response_$i.json &>/dev/null || true
                echo -n "."
            done
            echo
            
            success "Error invocations completed"
            
            # 알람 대기
            ALARM_NAME="${SERVICE_NAME}-${STAGE}-Lambda-Error-Rate-Critical"
            if wait_for_alarm "$ALARM_NAME"; then
                success "Alarm triggered successfully!"
            else
                error "Alarm did not trigger within expected time"
            fi
        fi
        ;;
        
    2)
        echo ""
        info "Testing Lambda Memory Usage Alarm..."
        warning "This will create high memory usage in your Lambda function"
        read -p "Continue? (y/n) " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # 메모리 사용 메트릭 발행
            info "Publishing high memory usage metric..."
            
            for i in {1..5}; do
                aws cloudwatch put-metric-data \
                    --namespace "VanillaMeta/${STAGE}" \
                    --metric-name "LAMBDA_MEMORY_UTILIZATION" \
                    --value 85 \
                    --unit Percent \
                    --region $REGION
                sleep 2
            done
            
            success "Memory metrics published"
            
            # 알람 대기
            ALARM_NAME="${SERVICE_NAME}-${STAGE}-Lambda-Memory-Critical"
            if wait_for_alarm "$ALARM_NAME"; then
                success "Alarm triggered successfully!"
            else
                error "Alarm did not trigger within expected time"
            fi
        fi
        ;;
        
    3)
        echo ""
        info "Testing API Response Time Alarm..."
        warning "This requires API Gateway endpoint access"
        
        # API 엔드포인트 찾기
        API_ID=$(aws apigateway get-rest-apis \
            --query "items[?name=='${STAGE}-${SERVICE_NAME}'].id" \
            --output text \
            --region $REGION 2>/dev/null || echo "")
        
        if [ -z "$API_ID" ]; then
            error "API Gateway not found"
            exit 1
        fi
        
        API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"
        info "API URL: $API_URL"
        
        read -p "Continue? (y/n) " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # 느린 응답 시뮬레이션
            info "Simulating slow API responses..."
            
            for i in {1..10}; do
                curl -X GET "${API_URL}/health?delay=2000" \
                    -H "Content-Type: application/json" \
                    --max-time 10 \
                    --silent --output /dev/null || true
                echo -n "."
            done
            echo
            
            success "Slow response simulation completed"
            
            # 알람 대기
            ALARM_NAME="${SERVICE_NAME}-${STAGE}-API-Response-Time-Warning"
            if wait_for_alarm "$ALARM_NAME"; then
                success "Alarm triggered successfully!"
            else
                error "Alarm did not trigger within expected time"
            fi
        fi
        ;;
        
    4)
        echo ""
        info "Performing Quick Health Check..."
        
        # 모든 알람 상태 확인
        echo ""
        echo "Checking all alarm states:"
        echo "------------------------"
        
        aws cloudwatch describe-alarms \
            --alarm-name-prefix "${SERVICE_NAME}-${STAGE}-" \
            --region $REGION \
            --query 'MetricAlarms[*].[AlarmName,StateValue,StateReason]' \
            --output table
        
        # OK 상태가 아닌 알람 카운트
        ALARM_COUNT=$(aws cloudwatch describe-alarms \
            --alarm-name-prefix "${SERVICE_NAME}-${STAGE}-" \
            --state-value ALARM \
            --region $REGION \
            --query 'length(MetricAlarms)' \
            --output text 2>/dev/null || echo "0")
        
        echo ""
        if [ "$ALARM_COUNT" -gt 0 ]; then
            warning "$ALARM_COUNT alarm(s) in ALARM state"
        else
            success "All alarms in OK state"
        fi
        ;;
        
    5)
        echo "Exiting..."
        exit 0
        ;;
        
    *)
        error "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "========================================"
info "Test completed"
echo ""
echo "To view alarm history:"
echo "aws cloudwatch describe-alarm-history \\"
echo "  --alarm-name-prefix '${SERVICE_NAME}-${STAGE}-' \\"
echo "  --region $REGION \\"
echo "  --max-records 10"
echo ""