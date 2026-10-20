#!/bin/bash

echo "🔍 테스트 실패 분석 시작..."

# 테스트 결과 파일
TEST_RESULTS_FILE="test-results.json"
TEST_LOG_FILE="test-run.log"

# JSON 리포터로 테스트 실행
echo "📋 테스트 실행 중..."
yarn test --json --outputFile="$TEST_RESULTS_FILE" --maxWorkers=1 --testTimeout=10000 > "$TEST_LOG_FILE" 2>&1 || true

# 기본 통계
TOTAL_TESTS=$(jq '.numTotalTests // 0' "$TEST_RESULTS_FILE" 2>/dev/null || echo "0")
PASSED_TESTS=$(jq '.numPassedTests // 0' "$TEST_RESULTS_FILE" 2>/dev/null || echo "0")
FAILED_TESTS=$(jq '.numFailedTests // 0' "$TEST_RESULTS_FILE" 2>/dev/null || echo "0")
PENDING_TESTS=$(jq '.numPendingTests // 0' "$TEST_RESULTS_FILE" 2>/dev/null || echo "0")

echo ""
echo "📊 테스트 요약:"
echo "- 전체 테스트: $TOTAL_TESTS"
echo "- 성공: $PASSED_TESTS"
echo "- 실패: $FAILED_TESTS"
echo "- 보류: $PENDING_TESTS"

if [ "$TOTAL_TESTS" -ne "0" ]; then
    SUCCESS_RATE=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    echo "- 성공률: ${SUCCESS_RATE}%"
fi

echo ""
echo "❌ 실패한 테스트 파일들:"
grep "FAIL " "$TEST_LOG_FILE" | grep -v "Test Suites:" | sort | uniq

echo ""
echo "🔴 TypeScript 에러:"
grep -E "error TS[0-9]+" "$TEST_LOG_FILE" | sort | uniq | head -20

echo ""
echo "⚠️  가장 많이 발생하는 에러 패턴:"
grep -E "(Cannot|Error:|TypeError:|ReferenceError:|missing|undefined)" "$TEST_LOG_FILE" | \
    grep -v "console\." | \
    sort | uniq -c | sort -nr | head -10

# 느린 테스트 찾기
echo ""
echo "🐌 느린 테스트 (5초 이상):"
grep -E "\([5-9]\.[0-9]+ s\)" "$TEST_LOG_FILE" | head -10

# 정리
rm -f "$TEST_RESULTS_FILE" "$TEST_LOG_FILE"

echo ""
echo "✅ 분석 완료!"