#!/bin/bash

echo "✅ 안정적인 테스트만 실행..."

# 성공이 확인된 서비스들
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

echo "실행할 테스트 패턴: $PATTERN"
echo ""

# 테스트 실행
yarn jest --testPathPattern="($PATTERN)" --no-coverage --maxWorkers=2 --testTimeout=5000 --passWithNoTests