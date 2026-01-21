#!/bin/bash
# rollback.sh
# VanillaMeta 긴급 롤백 스크립트

STAGE=${1:-prod}
PROFILE="vanillameta-${STAGE}"
ROLLBACK_TYPE=${2:-"all"} # all, backend, frontend

echo "=== VanillaMeta Emergency Rollback ==="
echo "Stage: $STAGE"
echo "Profile: $PROFILE"
echo "Rollback Type: $ROLLBACK_TYPE"
echo "Time: $(date)"
echo ""

# 확인 프롬프트
read -p "⚠️  WARNING: This will rollback the $STAGE environment. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

# Backend 롤백
if [ "$ROLLBACK_TYPE" == "backend" ] || [ "$ROLLBACK_TYPE" == "all" ]; then
    echo -e "\n=== Rolling back Backend ==="
    
    # 현재 버전 확인
    FUNCTION_NAME="vanillameta-backend-api-${STAGE}-app"
    CURRENT_VERSION=$(aws lambda get-function \
        --function-name $FUNCTION_NAME \
        --query 'Configuration.Version' \
        --output text \
        --profile $PROFILE)
    
    echo "Current Lambda version: $CURRENT_VERSION"
    
    # 이전 버전 목록
    echo -e "\nAvailable versions:"
    aws lambda list-versions-by-function \
        --function-name $FUNCTION_NAME \
        --max-items 10 \
        --query 'Versions[?Version!=`$LATEST`].[Version, LastModified, Description]' \
        --output table \
        --profile $PROFILE
    
    # 롤백할 버전 선택
    read -p "Enter version number to rollback to: " TARGET_VERSION
    
    if [ ! -z "$TARGET_VERSION" ]; then
        echo "Rolling back to version $TARGET_VERSION..."
        
        # 알리아스 업데이트
        aws lambda update-alias \
            --function-name $FUNCTION_NAME \
            --name live \
            --function-version $TARGET_VERSION \
            --profile $PROFILE
        
        if [ $? -eq 0 ]; then
            echo "✅ Backend rolled back to version $TARGET_VERSION"
        else
            echo "❌ Backend rollback failed"
        fi
    else
        echo "No version selected. Skipping backend rollback."
    fi
fi

# Frontend 롤백
if [ "$ROLLBACK_TYPE" == "frontend" ] || [ "$ROLLBACK_TYPE" == "all" ]; then
    echo -e "\n=== Rolling back Frontend ==="
    
    BUCKET_NAME="vanillameta-frontend-${STAGE}"
    
    # index.html의 이전 버전 확인
    echo "Recent versions of index.html:"
    aws s3api list-object-versions \
        --bucket $BUCKET_NAME \
        --prefix index.html \
        --max-items 5 \
        --query 'Versions[?IsLatest==`false`].[VersionId, LastModified, Size]' \
        --output table \
        --profile $PROFILE
    
    read -p "Enter version ID to rollback to (or press Enter to skip): " VERSION_ID
    
    if [ ! -z "$VERSION_ID" ]; then
        echo "Rolling back frontend to version $VERSION_ID..."
        
        # 모든 파일의 이전 버전 복원 (실제로는 더 정교한 로직 필요)
        aws s3api copy-object \
            --bucket $BUCKET_NAME \
            --copy-source "${BUCKET_NAME}/index.html?versionId=${VERSION_ID}" \
            --key index.html \
            --profile $PROFILE
        
        if [ $? -eq 0 ]; then
            # CloudFront 캐시 무효화
            DISTRIBUTION_ID=$(aws cloudfront list-distributions \
                --query "DistributionList.Items[?Comment=='vanillameta-frontend-${STAGE}'].Id" \
                --output text \
                --profile $PROFILE)
            
            if [ ! -z "$DISTRIBUTION_ID" ]; then
                echo "Invalidating CloudFront cache..."
                aws cloudfront create-invalidation \
                    --distribution-id $DISTRIBUTION_ID \
                    --paths "/*" \
                    --profile $PROFILE > /dev/null
                
                echo "✅ Frontend rolled back and cache invalidated"
            fi
        else
            echo "❌ Frontend rollback failed"
        fi
    else
        echo "No version selected. Skipping frontend rollback."
    fi
fi

# 롤백 후 상태 확인
echo -e "\n=== Post-Rollback Status ==="

# Backend 상태
if [ "$ROLLBACK_TYPE" == "backend" ] || [ "$ROLLBACK_TYPE" == "all" ]; then
    echo -e "\nBackend Status:"
    aws lambda get-alias \
        --function-name $FUNCTION_NAME \
        --name live \
        --query '[FunctionVersion, Description]' \
        --output table \
        --profile $PROFILE 2>/dev/null || echo "No 'live' alias found"
fi

# Frontend 상태
if [ "$ROLLBACK_TYPE" == "frontend" ] || [ "$ROLLBACK_TYPE" == "all" ]; then
    echo -e "\nFrontend Status:"
    aws s3api head-object \
        --bucket $BUCKET_NAME \
        --key index.html \
        --query '[LastModified, VersionId]' \
        --output table \
        --profile $PROFILE 2>/dev/null || echo "Frontend status check failed"
fi

echo -e "\n=== Rollback Complete ==="
echo "Please verify the application is working correctly."
echo "Monitor CloudWatch for any errors."