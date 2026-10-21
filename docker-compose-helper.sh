#!/bin/bash

# Docker Compose 헬퍼 스크립트
# VanillaMeta 프로젝트를 위한 Docker 컨테이너 관리

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 프로젝트 이름
PROJECT_NAME="vanillameta"

# 함수: 사용법 출력
usage() {
    echo -e "${BLUE}VanillaMeta Docker Compose Helper${NC}"
    echo -e "사용법: $0 [command] [options]"
    echo -e ""
    echo -e "Commands:"
    echo -e "  ${GREEN}start${NC}       - 모든 서비스 시작"
    echo -e "  ${GREEN}stop${NC}        - 모든 서비스 중지"
    echo -e "  ${GREEN}restart${NC}     - 모든 서비스 재시작"
    echo -e "  ${GREEN}build${NC}       - 이미지 빌드"
    echo -e "  ${GREEN}rebuild${NC}     - 이미지 재빌드 (캐시 무시)"
    echo -e "  ${GREEN}logs${NC}        - 로그 보기"
    echo -e "  ${GREEN}status${NC}      - 서비스 상태 확인"
    echo -e "  ${GREEN}clean${NC}       - 컨테이너, 이미지, 볼륨 삭제"
    echo -e "  ${GREEN}reset${NC}       - 완전 초기화 (데이터 손실 주의)"
    echo -e "  ${GREEN}dev${NC}         - 개발 모드로 시작"
    echo -e "  ${GREEN}prod${NC}        - 프로덕션 모드로 시작"
    echo -e ""
    echo -e "Options:"
    echo -e "  -d           - 백그라운드로 실행"
    echo -e "  -f           - 특정 서비스 로그 팔로우"
    echo -e ""
}

# 함수: 환경 파일 확인
check_env_file() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}환경 파일(.env)이 없습니다. .env.example을 복사합니다...${NC}"
        cp .env.example .env
        echo -e "${GREEN}환경 파일이 생성되었습니다. 필요에 따라 수정하세요.${NC}"
    fi
}

# 함수: 서비스 시작
start_services() {
    local mode=$1
    local detached=$2
    
    check_env_file
    
    echo -e "${BLUE}서비스를 시작합니다...${NC}"
    
    if [ "$mode" = "dev" ]; then
        if [ "$detached" = "true" ]; then
            docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
        else
            docker-compose -f docker-compose.yml -f docker-compose.override.yml up
        fi
    else
        if [ "$detached" = "true" ]; then
            docker-compose up -d
        else
            docker-compose up
        fi
    fi
}

# 함수: 서비스 중지
stop_services() {
    echo -e "${BLUE}서비스를 중지합니다...${NC}"
    docker-compose down
}

# 함수: 서비스 재시작
restart_services() {
    stop_services
    start_services "prod" "true"
}

# 함수: 이미지 빌드
build_images() {
    local no_cache=$1
    
    echo -e "${BLUE}이미지를 빌드합니다...${NC}"
    
    if [ "$no_cache" = "true" ]; then
        docker-compose build --no-cache
    else
        docker-compose build
    fi
}

# 함수: 로그 보기
show_logs() {
    local follow=$1
    local service=$2
    
    if [ "$follow" = "true" ]; then
        if [ -n "$service" ]; then
            docker-compose logs -f $service
        else
            docker-compose logs -f
        fi
    else
        docker-compose logs --tail=100
    fi
}

# 함수: 상태 확인
check_status() {
    echo -e "${BLUE}서비스 상태:${NC}"
    docker-compose ps
    echo -e ""
    echo -e "${BLUE}헬스 체크 상태:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep $PROJECT_NAME
}

# 함수: 정리
clean_all() {
    echo -e "${YELLOW}경고: 모든 컨테이너, 이미지, 볼륨이 삭제됩니다.${NC}"
    read -p "계속하시겠습니까? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v --rmi all
        echo -e "${GREEN}정리가 완료되었습니다.${NC}"
    else
        echo -e "${YELLOW}취소되었습니다.${NC}"
    fi
}

# 함수: 완전 초기화
reset_all() {
    echo -e "${RED}경고: 모든 데이터가 삭제됩니다!${NC}"
    read -p "정말로 초기화하시겠습니까? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v --rmi all
        rm -rf ./backend-api/sqlite_data
        rm -rf ./backend-api/logs
        docker system prune -af
        echo -e "${GREEN}초기화가 완료되었습니다.${NC}"
    else
        echo -e "${YELLOW}취소되었습니다.${NC}"
    fi
}

# 메인 로직
case "$1" in
    start)
        if [ "$2" = "-d" ]; then
            start_services "prod" "true"
        else
            start_services "prod" "false"
        fi
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    build)
        build_images "false"
        ;;
    rebuild)
        build_images "true"
        ;;
    logs)
        if [ "$2" = "-f" ]; then
            show_logs "true" "$3"
        else
            show_logs "false"
        fi
        ;;
    status)
        check_status
        ;;
    clean)
        clean_all
        ;;
    reset)
        reset_all
        ;;
    dev)
        if [ "$2" = "-d" ]; then
            start_services "dev" "true"
        else
            start_services "dev" "false"
        fi
        ;;
    prod)
        if [ "$2" = "-d" ]; then
            start_services "prod" "true"
        else
            start_services "prod" "false"
        fi
        ;;
    *)
        usage
        exit 1
        ;;
esac