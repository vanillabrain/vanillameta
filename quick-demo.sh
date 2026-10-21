#!/bin/bash

# VanillaMeta 빠른 데모 실행 스크립트
# 이 스크립트는 Docker 환경을 빠르게 시작합니다.

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

clear

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                        🚀 VanillaMeta Quick Demo                               ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 빠른 시작 옵션
if [ "$1" == "--fast" ] || [ "$1" == "-f" ]; then
    echo -e "${YELLOW}⚡ 빠른 시작 모드로 실행합니다...${NC}"
    docker compose up -d
    echo ""
    echo -e "${GREEN}✅ 서비스가 시작되었습니다!${NC}"
    echo ""
    echo -e "${YELLOW}📝 접속 정보:${NC}"
    echo -e "   웹: ${BLUE}http://localhost${NC}"
    echo -e "   ID: ${BLUE}guest${NC}"
    echo -e "   PW: ${BLUE}Admin!@12${NC}"
    echo ""
    echo -e "${YELLOW}⏳ 서비스가 완전히 준비되려면 1-2분 정도 기다려주세요.${NC}"
    exit 0
fi

# 기본 실행 (전체 테스트 포함)
./docker-test.sh