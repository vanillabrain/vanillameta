#!/bin/bash

# CloudWatch Dashboard 배포 스크립트
# T01_S07: CloudWatch 통합 대시보드 구성

set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 환경 변수 체크
if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 <environment> [dev|prod]${NC}"
    exit 1
fi

ENVIRONMENT=$1
STACK_NAME="vanillameta-cloudwatch-dashboard-${ENVIRONMENT}"
TEMPLATE_FILE="cloudformation/integrated-monitoring-dashboard.yml"

echo -e "${YELLOW}🚀 CloudWatch 대시보드 배포 시작 (${ENVIRONMENT})${NC}"

# CloudFormation 템플릿 유효성 검증
echo -e "${YELLOW}📋 템플릿 유효성 검증 중...${NC}"
aws cloudformation validate-template \
    --template-body file://${TEMPLATE_FILE} \
    --region ap-northeast-2

# 스택 존재 여부 확인
STACK_EXISTS=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ap-northeast-2 2>&1 || true)

if [[ $STACK_EXISTS == *"does not exist"* ]]; then
    # 스택 생성
    echo -e "${YELLOW}📊 새 대시보드 생성 중...${NC}"
    aws cloudformation create-stack \
        --stack-name ${STACK_NAME} \
        --template-body file://${TEMPLATE_FILE} \
        --parameters \
            ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \
            ParameterKey=ServiceName,ParameterValue=vanillameta-backend-api \
            ParameterKey=RDSInstanceIdentifier,ParameterValue=vanillameta-rds \
            ParameterKey=RedisClusterName,ParameterValue=vanillameta-redis \
        --capabilities CAPABILITY_IAM \
        --region ap-northeast-2
    
    echo -e "${YELLOW}⏳ 스택 생성 대기 중...${NC}"
    aws cloudformation wait stack-create-complete \
        --stack-name ${STACK_NAME} \
        --region ap-northeast-2
else
    # 스택 업데이트
    echo -e "${YELLOW}🔄 기존 대시보드 업데이트 중...${NC}"
    aws cloudformation update-stack \
        --stack-name ${STACK_NAME} \
        --template-body file://${TEMPLATE_FILE} \
        --parameters \
            ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \
            ParameterKey=ServiceName,ParameterValue=vanillameta-backend-api \
            ParameterKey=RDSInstanceIdentifier,ParameterValue=vanillameta-rds \
            ParameterKey=RedisClusterName,ParameterValue=vanillameta-redis \
        --capabilities CAPABILITY_IAM \
        --region ap-northeast-2 2>&1 || {
            if [[ $? -eq 255 ]]; then
                echo -e "${GREEN}✅ 스택이 이미 최신 상태입니다.${NC}"
                exit 0
            else
                echo -e "${RED}❌ 스택 업데이트 실패${NC}"
                exit 1
            fi
        }
    
    echo -e "${YELLOW}⏳ 스택 업데이트 대기 중...${NC}"
    aws cloudformation wait stack-update-complete \
        --stack-name ${STACK_NAME} \
        --region ap-northeast-2
fi

# 스택 출력 가져오기
echo -e "${YELLOW}📤 대시보드 정보 조회 중...${NC}"
OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs' \
    --region ap-northeast-2)

# 대시보드 URL 추출
DASHBOARD_URL=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="IntegratedDashboardURL") | .OutputValue')
ALERT_TOPIC_ARN=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="AlertTopicArn") | .OutputValue')

echo -e "${GREEN}✅ CloudWatch 대시보드 배포 완료!${NC}"
echo -e "${GREEN}📊 대시보드 URL: ${DASHBOARD_URL}${NC}"
echo -e "${GREEN}🔔 알림 토픽 ARN: ${ALERT_TOPIC_ARN}${NC}"

# 환경별 추가 설정
if [ "$ENVIRONMENT" == "prod" ]; then
    echo -e "${YELLOW}📧 프로덕션 알림 이메일 구독 설정이 필요합니다.${NC}"
    echo -e "${YELLOW}   다음 명령어로 이메일 구독을 추가하세요:${NC}"
    echo -e "${YELLOW}   aws sns subscribe --topic-arn ${ALERT_TOPIC_ARN} --protocol email --notification-endpoint your-email@example.com${NC}"
fi

echo -e "${GREEN}🎉 모든 작업이 완료되었습니다!${NC}"