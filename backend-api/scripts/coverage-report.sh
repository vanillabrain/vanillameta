#!/bin/bash

echo "📊 테스트 커버리지 리포트 생성 중..."

# 안정적인 서비스들만 커버리지 측정
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

# 커버리지 실행
echo "테스트 실행 중..."
yarn jest --testPathPattern="($PATTERN)" \
  --coverage \
  --coverageReporters="text" \
  --coverageReporters="lcov" \
  --coverageReporters="html" \
  --collectCoverageFrom="src/**/*.service.ts" \
  --collectCoverageFrom="!src/**/*.spec.ts" \
  --collectCoverageFrom="!src/**/index.ts" \
  --maxWorkers=2 \
  --silent

# 커버리지 요약
if [ -f "coverage/lcov.info" ]; then
  echo ""
  echo "📈 커버리지 요약:"
  
  # lcov.info 파일에서 전체 커버리지 계산
  TOTAL_LINES=$(grep -E "^DA:" coverage/lcov.info | wc -l)
  COVERED_LINES=$(grep -E "^DA:[0-9]+,[1-9]" coverage/lcov.info | wc -l)
  
  if [ "$TOTAL_LINES" -gt 0 ]; then
    COVERAGE=$((COVERED_LINES * 100 / TOTAL_LINES))
    echo "- 전체 라인 커버리지: ${COVERAGE}%"
    echo "- 커버된 라인: $COVERED_LINES / $TOTAL_LINES"
  fi
  
  echo ""
  echo "📁 상세 리포트:"
  echo "- HTML 리포트: coverage/index.html"
  echo "- LCOV 리포트: coverage/lcov.info"
else
  echo "❌ 커버리지 파일을 찾을 수 없습니다."
fi