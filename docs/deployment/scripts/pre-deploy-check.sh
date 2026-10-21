#!/bin/bash
# pre-deploy-check.sh
# VanillaMeta 배포 전 사전 검증 스크립트

STAGE=${1:-prod}
ERRORS=0

echo "=== VanillaMeta Pre-Deployment Check ==="
echo "Stage: $STAGE"
echo "Time: $(date)"
echo "========================================="
echo ""

# 1. Node.js 버전 확인
echo "1. Checking Node.js version..."
NODE_VERSION=$(node --version)
REQUIRED_NODE="14"
if [[ $NODE_VERSION == v$REQUIRED_NODE* ]] || [[ $NODE_VERSION > v$REQUIRED_NODE ]]; then
    echo "✅ Node.js version: $NODE_VERSION"
else
    echo "❌ Node.js version $NODE_VERSION is not compatible. Required: v$REQUIRED_NODE or higher"
    ((ERRORS++))
fi

# 2. AWS CLI 확인
echo -e "\n2. Checking AWS CLI..."
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version)
    echo "✅ AWS CLI installed: $AWS_VERSION"
else
    echo "❌ AWS CLI not found"
    ((ERRORS++))
fi

# 3. Serverless Framework 확인
echo -e "\n3. Checking Serverless Framework..."
if command -v serverless &> /dev/null; then
    SLS_VERSION=$(serverless --version)
    echo "✅ Serverless Framework: $SLS_VERSION"
else
    echo "❌ Serverless Framework not found"
    ((ERRORS++))
fi

# 4. AWS 자격증명 확인
echo -e "\n4. Checking AWS credentials..."
PROFILE="vanillameta-${STAGE}"
AWS_IDENTITY=$(aws sts get-caller-identity --profile $PROFILE 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ AWS Profile '$PROFILE' is valid"
    echo "   Account: $(echo $AWS_IDENTITY | jq -r .Account)"
    echo "   User: $(echo $AWS_IDENTITY | jq -r .Arn)"
else
    echo "❌ AWS Profile '$PROFILE' is not configured or invalid"
    ((ERRORS++))
fi

# 5. 백엔드 테스트 실행
echo -e "\n5. Running backend tests..."
cd backend-api
if [ -f "package.json" ]; then
    echo "Installing dependencies..."
    yarn install --frozen-lockfile > /dev/null 2>&1
    
    echo "Running tests..."
    yarn test:baseline > test-results.log 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ All backend tests passed"
    else
        echo "❌ Backend tests failed. Check test-results.log for details"
        ((ERRORS++))
    fi
else
    echo "❌ backend-api/package.json not found"
    ((ERRORS++))
fi
cd ..

# 6. 프론트엔드 빌드 확인
echo -e "\n6. Checking frontend build..."
cd frontend-web
if [ -f "package.json" ]; then
    echo "Installing dependencies..."
    yarn install --frozen-lockfile > /dev/null 2>&1
    
    echo "Building frontend..."
    if [ "$STAGE" == "prod" ]; then
        yarn build > build.log 2>&1
    else
        yarn build:dev > build.log 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Frontend build successful"
        # 번들 사이즈 확인
        if [ -d "build" ]; then
            BUNDLE_SIZE=$(du -sh build | cut -f1)
            echo "   Bundle size: $BUNDLE_SIZE"
        fi
    else
        echo "❌ Frontend build failed. Check build.log for details"
        ((ERRORS++))
    fi
else
    echo "❌ frontend-web/package.json not found"
    ((ERRORS++))
fi
cd ..

# 7. 환경 변수 파일 확인
echo -e "\n7. Checking environment variables..."
ENV_FILES=(
    "backend-api/.env.$STAGE"
    "frontend-web/.env.$([ "$STAGE" == "prod" ] && echo "production" || echo "development")"
)

for env_file in "${ENV_FILES[@]}"; do
    if [ -f "$env_file" ]; then
        echo "✅ Found: $env_file"
    else
        echo "❌ Missing: $env_file"
        ((ERRORS++))
    fi
done

# 8. Git 상태 확인
echo -e "\n8. Checking Git status..."
GIT_STATUS=$(git status --porcelain)
if [ -z "$GIT_STATUS" ]; then
    echo "✅ Working directory is clean"
else
    echo "⚠️  Warning: Uncommitted changes detected"
    echo "$GIT_STATUS"
fi

# 현재 브랜치 확인
CURRENT_BRANCH=$(git branch --show-current)
echo "   Current branch: $CURRENT_BRANCH"

# 최신 커밋 정보
LAST_COMMIT=$(git log -1 --oneline)
echo "   Last commit: $LAST_COMMIT"

# 9. 데이터베이스 연결 확인 (프로덕션만)
if [ "$STAGE" == "prod" ]; then
    echo -e "\n9. Checking database connectivity..."
    # 실제 환경에서는 적절한 데이터베이스 연결 테스트 추가
    echo "⚠️  Database connectivity check skipped (implement actual check)"
fi

# 결과 요약
echo -e "\n========================================="
echo "Pre-deployment Check Summary"
echo "========================================="

if [ $ERRORS -eq 0 ]; then
    echo -e "✅ ${GREEN}All checks passed!${NC}"
    echo "Ready for deployment to $STAGE environment"
    exit 0
else
    echo -e "❌ ${RED}Found $ERRORS error(s)${NC}"
    echo "Please fix the issues before proceeding with deployment"
    exit 1
fi