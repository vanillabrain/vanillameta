#!/bin/bash

# YOLO Mode 자동화 스크립트
# 테스트 실행, 빌드, 린팅을 자동화하여 안전한 개발 환경 제공

set -e  # 에러 발생 시 즉시 중단

# 스크립트가 실행되는 디렉토리를 backend-api로 변경
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "🚀 YOLO Mode 자동화 시작..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 단계별 실행 함수
run_step() {
    local step_name=$1
    local command=$2
    
    echo -e "${BLUE}🔄 ${step_name}...${NC}"
    
    if eval "$command"; then
        echo -e "${GREEN}✅ ${step_name} 성공${NC}"
        return 0
    else
        echo -e "${RED}❌ ${step_name} 실패${NC}"
        return 1
    fi
}

# 1. 린팅 및 포맷팅 검사
echo -e "\n${YELLOW}=== 1단계: 코드 품질 검사 ===${NC}"
run_step "ESLint 검사" "yarn lint"
run_step "Prettier 포맷팅" "yarn format"

# 2. 단위 테스트 실행
echo -e "\n${YELLOW}=== 2단계: 단위 테스트 실행 ===${NC}"
run_step "Controller 테스트" "yarn test --testPathPattern='controller\.spec\.ts$' --testTimeout=20000"
run_step "Service 테스트" "yarn test --testPathPattern='service\.spec\.ts$' --testTimeout=20000"

# 3. 전체 단위 테스트 확인
echo -e "\n${YELLOW}=== 3단계: 전체 단위 테스트 검증 ===${NC}"
run_step "모든 단위 테스트" "yarn test --testPathPattern='controller\.spec\.ts$|service\.spec\.ts$' --testTimeout=30000"

# 4. 빌드 테스트
echo -e "\n${YELLOW}=== 4단계: 빌드 검증 ===${NC}"
run_step "TypeScript 빌드" "yarn build"

# 5. 테스트 커버리지 생성
echo -e "\n${YELLOW}=== 5단계: 테스트 커버리지 리포트 ===${NC}"
run_step "커버리지 생성" "yarn test:cov --testPathPattern='controller\.spec\.ts$|service\.spec\.ts$' --testTimeout=30000"

echo -e "\n${GREEN}🎉 YOLO Mode 자동화 완료!${NC}"
echo -e "${GREEN}✨ 모든 검사를 통과했습니다. 안전하게 개발을 진행하세요!${NC}"

# 커버리지 결과 출력
if [ -f "coverage/lcov-report/index.html" ]; then
    echo -e "\n${BLUE}📊 커버리지 리포트가 생성되었습니다: coverage/lcov-report/index.html${NC}"
fi

exit 0