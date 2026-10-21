#!/bin/bash

echo "🚀 백엔드 테스트 성능 분석 시작..."

# 테스트 시작 시간
START_TIME=$(date +%s)

# 주요 서비스 테스트만 실행 (병렬 처리)
echo "📋 핵심 서비스 테스트 실행 중..."
TEST_SERVICES=(
  "auth"
  "user"
  "dashboard"
  "widget"
  "dataset"
  "database"
  "component"
)

for service in "${TEST_SERVICES[@]}"; do
  echo -n "Testing $service service... "
  START=$(date +%s)
  
  if yarn jest "src/$service/$service.service.spec.ts" --no-coverage --silent > /dev/null 2>&1; then
    END=$(date +%s)
    DURATION=$((END - START))
    echo "✅ PASS (${DURATION}s)"
  else
    END=$(date +%s)
    DURATION=$((END - START))
    echo "❌ FAIL (${DURATION}s)"
  fi
done

# 전체 소요 시간
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo "📊 테스트 성능 요약:"
echo "- 총 실행 시간: ${TOTAL_DURATION}초"
echo "- 평균 실행 시간: $((TOTAL_DURATION / ${#TEST_SERVICES[@]}))초"

# 느린 테스트 찾기
echo ""
echo "🐌 느린 테스트 파일 (5초 이상):"
find src -name "*.spec.ts" -type f | while read -r file; do
  # 파일 크기로 대략적인 복잡도 추정
  SIZE=$(wc -l < "$file")
  if [ "$SIZE" -gt 500 ]; then
    echo "  - $file (${SIZE} lines)"
  fi
done

# Jest 캐시 정보
echo ""
echo "💾 Jest 캐시 상태:"
if [ -d ".jest-cache" ]; then
  CACHE_SIZE=$(du -sh .jest-cache 2>/dev/null | cut -f1)
  echo "  - 캐시 크기: $CACHE_SIZE"
else
  echo "  - 캐시 없음"
fi

echo ""
echo "💡 성능 개선 제안:"
echo "  1. maxWorkers를 CPU 코어 수의 50%로 설정"
echo "  2. 통합 테스트와 단위 테스트 분리 실행"
echo "  3. 테스트 파일이 큰 경우 분할 고려"
echo "  4. 불필요한 beforeEach/afterEach 최소화"