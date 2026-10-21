#!/bin/bash

# Docker Compose 헬퍼 스크립트
# 다양한 환경에서 Docker Compose를 쉽게 사용할 수 있도록 도와주는 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수: 사용법 출력
usage() {
    echo -e "${BLUE}사용법:${NC}"
    echo -e "  $0 [환경] [명령] [옵션]"
    echo ""
    echo -e "${BLUE}환경:${NC}"
    echo -e "  ${GREEN}local${NC}    - SQLite를 사용하는 로컬 개발 환경"
    echo -e "  ${GREEN}dev${NC}      - MySQL을 사용하는 개발 환경"
    echo -e "  ${GREEN}prod${NC}     - 프로덕션 환경"
    echo -e "  ${GREEN}test${NC}     - 테스트 환경"
    echo -e "  ${GREEN}multi${NC}    - 다중 데이터베이스 테스트 환경"
    echo ""
    echo -e "${BLUE}명령:${NC}"
    echo -e "  ${GREEN}up${NC}       - 서비스 시작"
    echo -e "  ${GREEN}down${NC}     - 서비스 중지"
    echo -e "  ${GREEN}restart${NC}  - 서비스 재시작"
    echo -e "  ${GREEN}logs${NC}     - 로그 확인"
    echo -e "  ${GREEN}build${NC}    - 이미지 빌드"
    echo -e "  ${GREEN}status${NC}   - 서비스 상태 확인"
    echo -e "  ${GREEN}clean${NC}    - 볼륨 포함 전체 정리"
    echo ""
    echo -e "${BLUE}예시:${NC}"
    echo -e "  $0 dev up        # 개발 환경 시작"
    echo -e "  $0 test up       # 테스트 실행"
    echo -e "  $0 prod logs     # 프로덕션 로그 확인"
    exit 1
}

# 인자 확인
if [ $# -lt 2 ]; then
    usage
fi

ENV=$1
COMMAND=$2
shift 2

# Docker Compose 파일 선택
case $ENV in
    local)
        COMPOSE_FILE="docker-compose.local.yml"
        PROJECT_NAME="vanillameta-local"
        ;;
    dev)
        COMPOSE_FILE="docker-compose.dev.yml"
        PROJECT_NAME="vanillameta-dev"
        ;;
    prod)
        COMPOSE_FILE="docker-compose.yml"
        PROJECT_NAME="vanillameta"
        ;;
    test)
        COMPOSE_FILE="docker-compose.test.yml"
        PROJECT_NAME="vanillameta-test"
        ;;
    multi)
        COMPOSE_FILE="docker-compose.multi-db.yml"
        PROJECT_NAME="vanillameta-multi"
        ;;
    *)
        echo -e "${RED}오류: 알 수 없는 환경 '$ENV'${NC}"
        usage
        ;;
esac

# Docker Compose 실행 함수
run_compose() {
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME "$@"
}

# 명령 실행
case $COMMAND in
    up)
        echo -e "${BLUE}[$ENV] 환경 시작 중...${NC}"
        run_compose up -d "$@"
        echo -e "${GREEN}[$ENV] 환경이 시작되었습니다!${NC}"
        
        # 서비스 상태 표시
        echo -e "\n${BLUE}서비스 상태:${NC}"
        run_compose ps
        
        # 접속 정보 표시
        echo -e "\n${BLUE}접속 정보:${NC}"
        if [ "$ENV" != "test" ]; then
            echo -e "  API 서버: ${GREEN}http://localhost:3000${NC}"
            echo -e "  Swagger: ${GREEN}http://localhost:3000/api${NC}"
        fi
        
        case $ENV in
            dev|prod)
                echo -e "  MySQL: ${GREEN}localhost:3306${NC}"
                ;;
            multi)
                echo -e "  MySQL: ${GREEN}localhost:3306${NC}"
                echo -e "  PostgreSQL: ${GREEN}localhost:5432${NC}"
                echo -e "  MariaDB: ${GREEN}localhost:3308${NC}"
                echo -e "  Oracle: ${GREEN}localhost:1521${NC}"
                echo -e "  SQL Server: ${GREEN}localhost:1433${NC}"
                ;;
        esac
        
        echo -e "  Redis: ${GREEN}localhost:6379${NC}"
        ;;
        
    down)
        echo -e "${BLUE}[$ENV] 환경 중지 중...${NC}"
        run_compose down "$@"
        echo -e "${GREEN}[$ENV] 환경이 중지되었습니다!${NC}"
        ;;
        
    restart)
        echo -e "${BLUE}[$ENV] 환경 재시작 중...${NC}"
        run_compose restart "$@"
        echo -e "${GREEN}[$ENV] 환경이 재시작되었습니다!${NC}"
        ;;
        
    logs)
        echo -e "${BLUE}[$ENV] 로그 확인 중...${NC}"
        run_compose logs -f "$@"
        ;;
        
    build)
        echo -e "${BLUE}[$ENV] 이미지 빌드 중...${NC}"
        run_compose build "$@"
        echo -e "${GREEN}[$ENV] 이미지 빌드가 완료되었습니다!${NC}"
        ;;
        
    status)
        echo -e "${BLUE}[$ENV] 서비스 상태:${NC}"
        run_compose ps
        ;;
        
    clean)
        echo -e "${YELLOW}경고: 이 작업은 모든 데이터를 삭제합니다!${NC}"
        read -p "계속하시겠습니까? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}[$ENV] 전체 정리 중...${NC}"
            run_compose down -v --remove-orphans
            echo -e "${GREEN}[$ENV] 정리가 완료되었습니다!${NC}"
        else
            echo -e "${YELLOW}취소되었습니다.${NC}"
        fi
        ;;
        
    *)
        echo -e "${RED}오류: 알 수 없는 명령 '$COMMAND'${NC}"
        usage
        ;;
esac