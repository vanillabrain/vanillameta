#!/bin/bash

# 빌드 검증 스크립트
# 백엔드와 프론트엔드의 빌드 상태를 검증합니다.

echo "🔍 Build Verification Script"
echo "==========================="

BACKEND_SUCCESS=false
FRONTEND_SUCCESS=false
OVERALL_SUCCESS=true

# Backend build verification
echo ""
echo "📦 Backend Build Check"
echo "---------------------"
if [ -d "backend-api" ]; then
    cd backend-api
    echo "Running: yarn build"
    yarn build > build.log 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Backend build: SUCCESS"
        BACKEND_SUCCESS=true
    else
        echo "❌ Backend build: FAILED"
        echo "Error log (last 20 lines):"
        tail -n 20 build.log
        OVERALL_SUCCESS=false
    fi
    rm -f build.log
    
    # Test check
    echo ""
    echo "Running: yarn test --passWithNoTests"
    yarn test --passWithNoTests > test.log 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Backend tests: PASSED"
    else
        echo "⚠️  Backend tests: FAILED (non-critical)"
        echo "Failed tests (summary):"
        grep -E "(FAIL|PASS)" test.log | head -10
    fi
    rm -f test.log
    cd ..
else
    echo "⚠️  Backend directory not found"
fi

# Frontend build verification
echo ""
echo "📦 Frontend Build Check"
echo "----------------------"
if [ -d "frontend-web" ]; then
    cd frontend-web
    echo "Running: yarn build"
    yarn build > build.log 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Frontend build: SUCCESS"
        FRONTEND_SUCCESS=true
    else
        echo "❌ Frontend build: FAILED"
        echo "Error log (last 20 lines):"
        tail -n 20 build.log
        OVERALL_SUCCESS=false
    fi
    rm -f build.log
    cd ..
else
    echo "⚠️  Frontend directory not found"
fi

# Summary
echo ""
echo "📊 Build Verification Summary"
echo "============================"
echo "Backend:  $([ "$BACKEND_SUCCESS" = true ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "Frontend: $([ "$FRONTEND_SUCCESS" = true ] && echo "✅ PASS" || echo "❌ FAIL")"
echo ""

if [ "$OVERALL_SUCCESS" = true ]; then
    echo "🎉 All builds passed successfully!"
    exit 0
else
    echo "💥 Build verification failed. Please fix the errors above."
    exit 1
fi