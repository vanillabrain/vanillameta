#!/bin/bash

echo "🚀 빠른 테스트 상태 확인 시작..."

# 병렬로 몇 개의 테스트 파일 실행
TEST_FILES=(
  "src/auth/auth.service.spec.ts"
  "src/user/user.service.spec.ts"
  "src/dashboard/dashboard.service.spec.ts"
  "src/widget/widget.service.spec.ts"
  "src/dataset/dataset.service.spec.ts"
  "src/database/database.service.spec.ts"
  "src/connection/connection.service.spec.ts"
  "src/component/component.service.spec.ts"
)

PASSED=0
FAILED=0
FAILED_FILES=()

echo "📋 주요 서비스 테스트 실행 중..."
echo ""

for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -n "Testing $(basename $file .spec.ts)... "
    if yarn jest "$file" --no-coverage --silent > /dev/null 2>&1; then
      echo "✅ PASS"
      ((PASSED++))
    else
      echo "❌ FAIL"
      ((FAILED++))
      FAILED_FILES+=("$file")
    fi
  fi
done

echo ""
echo "📊 빠른 확인 결과:"
echo "- 성공: $PASSED"
echo "- 실패: $FAILED"

if [ ${#FAILED_FILES[@]} -gt 0 ]; then
  echo ""
  echo "❌ 실패한 파일들:"
  for file in "${FAILED_FILES[@]}"; do
    echo "  - $file"
  done
fi

# 전체 테스트 수 추정
TOTAL_TEST_FILES=$(find src -name "*.spec.ts" | wc -l)
echo ""
echo "📈 전체 테스트 파일: $TOTAL_TEST_FILES개"
echo "   (샘플 ${#TEST_FILES[@]}개 중 $PASSED개 성공)"

SUCCESS_RATE=$((PASSED * 100 / ${#TEST_FILES[@]}))
echo "   샘플 성공률: ${SUCCESS_RATE}%"