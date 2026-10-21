#!/bin/bash

echo "🔍 테스트 안정성 모니터링..."
echo ""

# 테스트 결과 저장 디렉토리
RESULTS_DIR="test-results"
mkdir -p "$RESULTS_DIR"

# 현재 시간
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULT_FILE="$RESULTS_DIR/test-run-$TIMESTAMP.json"

# 안정적인 서비스들 테스트
STABLE_SERVICES=(
  "auth/auth.service.spec.ts"
  "user/user.service.spec.ts"
  "dashboard/dashboard.service.spec.ts"
  "widget/widget.service.spec.ts"
  "dataset/dataset.service.spec.ts"
  "database/database.service.spec.ts"
  "component/component.service.spec.ts"
)

PATTERN=""
for service in "${STABLE_SERVICES[@]}"; do
  if [ -z "$PATTERN" ]; then
    PATTERN="$service"
  else
    PATTERN="$PATTERN|$service"
  fi
done

# JSON 리포터로 테스트 실행
echo "📋 테스트 실행 중..."
yarn jest --testPathPattern="($PATTERN)" \
  --json \
  --outputFile="$RESULT_FILE" \
  --no-coverage \
  --maxWorkers=2 \
  --testTimeout=5000 \
  > /dev/null 2>&1

# 결과 분석
if [ -f "$RESULT_FILE" ]; then
  echo "📊 테스트 결과 분석:"
  
  # JSON 파싱
  TOTAL_TESTS=$(jq '.numTotalTests' "$RESULT_FILE")
  PASSED_TESTS=$(jq '.numPassedTests' "$RESULT_FILE")
  FAILED_TESTS=$(jq '.numFailedTests' "$RESULT_FILE")
  SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
  
  echo "- 전체 테스트: $TOTAL_TESTS"
  echo "- 성공: $PASSED_TESTS"
  echo "- 실패: $FAILED_TESTS"
  echo "- 성공률: ${SUCCESS_RATE}%"
  
  # 실패한 테스트 상세 정보
  if [ "$FAILED_TESTS" -gt 0 ]; then
    echo ""
    echo "❌ 실패한 테스트:"
    jq -r '.testResults[] | select(.status == "failed") | .name' "$RESULT_FILE" 2>/dev/null || echo "실패한 테스트 정보를 파싱할 수 없습니다."
  fi
  
  # 느린 테스트 감지
  echo ""
  echo "🐌 느린 테스트 (3초 이상):"
  jq -r '.testResults[] | .assertionResults[] | select(.duration > 3000) | "\(.fullName) - \(.duration)ms"' "$RESULT_FILE" 2>/dev/null | head -5 || echo "느린 테스트가 없습니다."
  
  # 최근 5회 실행 결과 트렌드
  echo ""
  echo "📈 최근 테스트 실행 트렌드:"
  ls -t "$RESULTS_DIR"/test-run-*.json 2>/dev/null | head -5 | while read -r file; do
    TIMESTAMP=$(basename "$file" | sed 's/test-run-//;s/.json//')
    RATE=$(jq -r '(.numPassedTests * 100 / .numTotalTests) | floor' "$file" 2>/dev/null || echo "N/A")
    echo "  - $TIMESTAMP: ${RATE}% 성공률"
  done
  
else
  echo "❌ 테스트 결과 파일을 생성할 수 없습니다."
fi

echo ""
echo "💡 개선 제안:"
if [ "$SUCCESS_RATE" -lt 95 ]; then
  echo "  - 성공률이 95% 미만입니다. 실패한 테스트를 수정하세요."
fi
echo "  - 느린 테스트는 분할하거나 최적화를 고려하세요."
echo "  - 테스트 결과는 $RESULTS_DIR 디렉토리에 저장됩니다."