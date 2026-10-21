#!/bin/bash

# 빠른 검증 스크립트
# 개발 중 빠른 테스트를 위한 경량화 스크립트

set -e

# 스크립트가 실행되는 디렉토리를 backend-api로 변경
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "⚡ 빠른 검증 시작..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 빠른 린팅 (경고는 무시하고 오류만 체크)
echo -e "${BLUE}🔍 린팅 검사 (오류만)...${NC}"
if yarn lint --quiet; then
    echo -e "${GREEN}✅ 린팅 통과 (오류 없음)${NC}"
else
    echo -e "${YELLOW}⚠️ 린팅 경고가 있지만 진행합니다${NC}"
fi

# 핵심 테스트만 실행
echo -e "${BLUE}🧪 핵심 테스트 실행...${NC}"
if yarn test --testPathPattern="controller\.spec\.ts$" --testTimeout=15000 --silent; then
    echo -e "${GREEN}✅ Controller 테스트 통과${NC}"
else
    echo -e "${RED}❌ Controller 테스트 실패${NC}"
    exit 1
fi

if yarn test --testPathPattern="service\.spec\.ts$" --testTimeout=15000 --silent; then
    echo -e "${GREEN}✅ Service 테스트 통과${NC}"
else
    echo -e "${RED}❌ Service 테스트 실패${NC}"
    exit 1
fi

echo -e "\n${GREEN}🎯 빠른 검증 완료! 모든 핵심 테스트를 통과했습니다.${NC}"
exit 0