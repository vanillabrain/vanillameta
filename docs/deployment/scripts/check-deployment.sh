#!/bin/bash
# check-deployment.sh
# VanillaMeta 배포 상태 확인 스크립트

STAGE=${1:-prod}
PROFILE="vanillameta-${STAGE}"

echo "=== VanillaMeta Deployment Status Check ==="
echo "Stage: $STAGE"
echo "Profile: $PROFILE"
echo "Time: $(date)"
echo ""

echo "=== Lambda Function Status ==="
aws lambda get-function \
  --function-name vanillameta-backend-api-${STAGE}-app \
  --query 'Configuration.[FunctionArn, Runtime, MemorySize, Timeout, LastModified]' \
  --output table \
  --profile $PROFILE

echo -e "\n=== Recent Invocations (Last Hour) ==="
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=vanillameta-backend-api-${STAGE}-app \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --output table \
  --profile $PROFILE

echo -e "\n=== Error Rate (Last Hour) ==="
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=vanillameta-backend-api-${STAGE}-app \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --output table \
  --profile $PROFILE

echo -e "\n=== API Gateway Status ==="
API_ID=$(aws apigatewayv2 get-apis \
  --query "Items[?Name=='vanillameta-backend-api-${STAGE}'].ApiId" \
  --output text \
  --profile $PROFILE)

if [ ! -z "$API_ID" ]; then
    echo "API ID: $API_ID"
    aws apigatewayv2 get-api \
      --api-id $API_ID \
      --query '[ApiEndpoint, CreatedDate, Description]' \
      --output table \
      --profile $PROFILE
else
    echo "API Gateway not found for stage: $STAGE"
fi

echo -e "\n=== RDS Status ==="
aws rds describe-db-instances \
  --db-instance-identifier vanillameta-${STAGE} \
  --query 'DBInstances[0].[DBInstanceIdentifier, DBInstanceStatus, Engine, AllocatedStorage, DBInstanceClass]' \
  --output table \
  --profile $PROFILE 2>/dev/null || echo "RDS instance not found for stage: $STAGE"

echo -e "\n=== CloudFront Distribution ==="
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='vanillameta-frontend-${STAGE}'].Id" \
  --output text \
  --profile $PROFILE)

if [ ! -z "$DISTRIBUTION_ID" ]; then
    echo "Distribution ID: $DISTRIBUTION_ID"
    aws cloudfront get-distribution \
      --id $DISTRIBUTION_ID \
      --query 'Distribution.[Status, DomainName, LastModifiedTime]' \
      --output table \
      --profile $PROFILE
else
    echo "CloudFront distribution not found for stage: $STAGE"
fi

echo -e "\n=== Deployment Check Complete ==="