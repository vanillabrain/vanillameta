#!/bin/bash

# 환경 변수 설정
ENVIRONMENT=${1:-dev}
REGION=${AWS_REGION:-ap-northeast-2}
SERVICE_NAME="vanillameta-backend-api"
RDS_INSTANCE_ID=${RDS_INSTANCE_ID:-""}

echo "====================================="
echo "Deploying CloudWatch Monitoring Dashboard"
echo "====================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Service Name: $SERVICE_NAME"
echo "RDS Instance: ${RDS_INSTANCE_ID:-'Not specified'}"
echo ""

# CloudFormation 템플릿 검증
echo "Validating CloudFormation templates..."

# 통합 대시보드 템플릿 검증
echo "- Validating integrated monitoring dashboard template..."
aws cloudformation validate-template \
  --template-body file://cloudformation/integrated-monitoring-dashboard.yml \
  --region $REGION

if [ $? -ne 0 ]; then
  echo "ERROR: Integrated monitoring dashboard template validation failed!"
  exit 1
fi

# 기존 모니터링 대시보드 템플릿 검증
echo "- Validating existing monitoring dashboard template..."
aws cloudformation validate-template \
  --template-body file://cloudformation/monitoring-dashboard.yml \
  --region $REGION

if [ $? -ne 0 ]; then
  echo "ERROR: Monitoring dashboard template validation failed!"
  exit 1
fi

# Slow Query 모니터링 대시보드 템플릿 검증
echo "- Validating slow query monitoring dashboard template..."
aws cloudformation validate-template \
  --template-body file://cloudformation/slow-query-monitoring-dashboard.yml \
  --region $REGION

if [ $? -ne 0 ]; then
  echo "ERROR: Slow query monitoring dashboard template validation failed!"
  exit 1
fi

echo "✅ All templates validated successfully!"
echo ""

# 스택 배포
STACK_NAME="${SERVICE_NAME}-${ENVIRONMENT}-integrated-monitoring"

echo "Deploying CloudFormation stack: $STACK_NAME"

# 파라미터 설정
PARAMETERS="ParameterKey=Environment,ParameterValue=$ENVIRONMENT ParameterKey=ServiceName,ParameterValue=$SERVICE_NAME"

if [ ! -z "$RDS_INSTANCE_ID" ]; then
  PARAMETERS="$PARAMETERS ParameterKey=DBInstanceIdentifier,ParameterValue=$RDS_INSTANCE_ID"
fi

# CloudFormation 스택 배포
aws cloudformation deploy \
  --template-file cloudformation/integrated-monitoring-dashboard.yml \
  --stack-name $STACK_NAME \
  --parameter-overrides $PARAMETERS \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region $REGION \
  --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
  echo "✅ CloudFormation stack deployed successfully!"
  
  # 스택 출력 가져오기
  echo ""
  echo "Getting stack outputs..."
  
  DASHBOARD_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?OutputKey=='IntegratedDashboardURL'].OutputValue" \
    --output text \
    --region $REGION)
  
  POLICY_ARN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?OutputKey=='DashboardAccessPolicyArn'].OutputValue" \
    --output text \
    --region $REGION)
  
  echo ""
  echo "====================================="
  echo "Deployment Summary"
  echo "====================================="
  echo "✅ Integrated Dashboard URL: $DASHBOARD_URL"
  echo "✅ Access Policy ARN: $POLICY_ARN"
  
  if [ "$ENVIRONMENT" = "prod" ]; then
    TOPIC_ARN=$(aws cloudformation describe-stacks \
      --stack-name $STACK_NAME \
      --query "Stacks[0].Outputs[?OutputKey=='IntegratedNotificationTopicArn'].OutputValue" \
      --output text \
      --region $REGION)
    
    echo "✅ SNS Topic ARN: $TOPIC_ARN"
    echo ""
    echo "⚠️  Production alarms are enabled. Configure SNS subscriptions for alert notifications."
  fi
  
  echo ""
  echo "📌 Next Steps:"
  echo "1. Visit the dashboard URL above to view metrics"
  echo "2. Attach the access policy to users/roles who need dashboard access"
  echo "3. Configure SNS subscriptions if this is production"
  echo "4. Test the dashboard with actual traffic"
  
else
  echo "❌ CloudFormation stack deployment failed!"
  exit 1
fi

# 기존 대시보드들도 업데이트 (선택사항)
read -p "Do you want to update existing monitoring dashboards? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Updating existing monitoring dashboards..."
  
  # 기본 모니터링 대시보드
  aws cloudformation deploy \
    --template-file cloudformation/monitoring-dashboard.yml \
    --stack-name "${SERVICE_NAME}-${ENVIRONMENT}-monitoring" \
    --parameter-overrides $PARAMETERS \
    --capabilities CAPABILITY_IAM \
    --region $REGION \
    --no-fail-on-empty-changeset
  
  # Slow Query 모니터링 대시보드
  aws cloudformation deploy \
    --template-file cloudformation/slow-query-monitoring-dashboard.yml \
    --stack-name "${SERVICE_NAME}-${ENVIRONMENT}-slow-query-monitoring" \
    --parameter-overrides Environment=$ENVIRONMENT ServiceName=$SERVICE_NAME \
    --capabilities CAPABILITY_IAM \
    --region $REGION \
    --no-fail-on-empty-changeset
  
  echo "✅ All dashboards updated successfully!"
fi

echo ""
echo "====================================="
echo "Deployment completed successfully! 🎉"
echo "====================================="