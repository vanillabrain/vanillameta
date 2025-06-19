#!/bin/bash

# VanillaMeta CloudWatch Alarms 배포 스크립트

set -e

# 색상 코드 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 기본 변수 설정
STACK_NAME="vanillameta-cloudwatch-alarms"
TEMPLATE_FILE="cloudformation/alarms.yml"
REGION="${AWS_REGION:-ap-northeast-2}"
STAGE="${STAGE:-dev}"

# 함수: 사용법 출력
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -s, --stage <stage>          Environment stage (dev/prod) [default: dev]"
    echo "  -e, --email <email>          Alarm notification email [required]"
    echo "  -w, --webhook <url>          Slack webhook URL [optional]"
    echo "  -d, --db-instance <id>       RDS DB instance identifier [default: vanillameta-db]"
    echo "  -r, --region <region>        AWS region [default: ap-northeast-2]"
    echo "  -h, --help                   Display this help message"
    exit 1
}

# 함수: 오류 메시지 출력
error() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

# 함수: 성공 메시지 출력
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 함수: 경고 메시지 출력
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 파라미터 파싱
ALARM_EMAIL=""
SLACK_WEBHOOK=""
DB_INSTANCE="vanillameta-db"

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stage)
            STAGE="$2"
            shift 2
            ;;
        -e|--email)
            ALARM_EMAIL="$2"
            shift 2
            ;;
        -w|--webhook)
            SLACK_WEBHOOK="$2"
            shift 2
            ;;
        -d|--db-instance)
            DB_INSTANCE="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# 필수 파라미터 검증
if [ -z "$ALARM_EMAIL" ]; then
    error "Alarm email is required. Use -e or --email option."
fi

# 스택 이름에 stage 추가
STACK_NAME="${STACK_NAME}-${STAGE}"

echo "========================================"
echo "VanillaMeta CloudWatch Alarms Deployment"
echo "========================================"
echo "Stack Name: $STACK_NAME"
echo "Stage: $STAGE"
echo "Region: $REGION"
echo "Email: $ALARM_EMAIL"
echo "DB Instance: $DB_INSTANCE"
if [ -n "$SLACK_WEBHOOK" ]; then
    echo "Slack: Configured"
else
    echo "Slack: Not configured"
fi
echo "========================================"

# CloudFormation 템플릿 검증
echo -n "Validating CloudFormation template... "
if aws cloudformation validate-template \
    --template-body file://$TEMPLATE_FILE \
    --region $REGION &>/dev/null; then
    success "Template is valid"
else
    error "Template validation failed"
fi

# 파라미터 준비
PARAMETERS="ParameterKey=Stage,ParameterValue=$STAGE"
PARAMETERS="$PARAMETERS ParameterKey=AlarmEmail,ParameterValue=$ALARM_EMAIL"
PARAMETERS="$PARAMETERS ParameterKey=DBInstanceIdentifier,ParameterValue=$DB_INSTANCE"

if [ -n "$SLACK_WEBHOOK" ]; then
    PARAMETERS="$PARAMETERS ParameterKey=SlackWebhookUrl,ParameterValue=$SLACK_WEBHOOK"
fi

# 스택 존재 여부 확인
if aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION &>/dev/null; then
    
    echo "Stack already exists. Updating..."
    
    # 변경 세트 생성
    CHANGE_SET_NAME="update-$(date +%Y%m%d%H%M%S)"
    
    aws cloudformation create-change-set \
        --stack-name $STACK_NAME \
        --change-set-name $CHANGE_SET_NAME \
        --template-body file://$TEMPLATE_FILE \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_IAM \
        --region $REGION
    
    # 변경 세트 생성 대기
    echo -n "Creating change set... "
    aws cloudformation wait change-set-create-complete \
        --stack-name $STACK_NAME \
        --change-set-name $CHANGE_SET_NAME \
        --region $REGION
    success "Change set created"
    
    # 변경 사항 표시
    echo "Changes to be applied:"
    aws cloudformation describe-change-set \
        --stack-name $STACK_NAME \
        --change-set-name $CHANGE_SET_NAME \
        --region $REGION \
        --query 'Changes[*].[Type,ResourceChange.ResourceType,ResourceChange.LogicalResourceId,ResourceChange.Action]' \
        --output table
    
    # 사용자 확인
    read -p "Do you want to apply these changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 변경 세트 실행
        aws cloudformation execute-change-set \
            --stack-name $STACK_NAME \
            --change-set-name $CHANGE_SET_NAME \
            --region $REGION
        
        echo -n "Updating stack... "
        aws cloudformation wait stack-update-complete \
            --stack-name $STACK_NAME \
            --region $REGION
        success "Stack updated successfully"
    else
        # 변경 세트 삭제
        aws cloudformation delete-change-set \
            --stack-name $STACK_NAME \
            --change-set-name $CHANGE_SET_NAME \
            --region $REGION
        warning "Update cancelled"
        exit 0
    fi
else
    echo "Creating new stack..."
    
    aws cloudformation create-stack \
        --stack-name $STACK_NAME \
        --template-body file://$TEMPLATE_FILE \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_IAM \
        --region $REGION
    
    echo -n "Creating stack... "
    aws cloudformation wait stack-create-complete \
        --stack-name $STACK_NAME \
        --region $REGION
    success "Stack created successfully"
fi

# 스택 출력 표시
echo ""
echo "Stack Outputs:"
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

# 알람 목록 표시
echo ""
echo "Created Alarms:"
aws cloudwatch describe-alarms \
    --alarm-name-prefix "vanillameta-backend-api-${STAGE}-" \
    --region $REGION \
    --query 'MetricAlarms[*].[AlarmName,StateValue]' \
    --output table

echo ""
success "CloudWatch alarms deployment completed!"
echo ""
echo "Next steps:"
echo "1. Check your email ($ALARM_EMAIL) to confirm SNS subscription"
echo "2. Test alarms using: ./test-alarms.sh"
echo "3. Monitor alarm status in CloudWatch console"
if [ -z "$SLACK_WEBHOOK" ]; then
    echo "4. Consider adding Slack integration for real-time notifications"
fi