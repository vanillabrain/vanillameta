# VanillaMeta Backend API Makefile
# Docker Compose 명령어를 간편하게 실행하기 위한 Makefile

.PHONY: help up down restart logs build status clean test dev local prod multi

# 기본 명령 (help 표시)
help:
	@echo "VanillaMeta Backend API - Docker Compose 명령어"
	@echo ""
	@echo "사용법: make [명령]"
	@echo ""
	@echo "환경별 시작:"
	@echo "  make local     - SQLite 로컬 환경 시작"
	@echo "  make dev       - MySQL 개발 환경 시작"
	@echo "  make prod      - 프로덕션 환경 시작"
	@echo "  make test      - 테스트 실행"
	@echo "  make multi     - 다중 DB 환경 시작"
	@echo ""
	@echo "공통 명령어:"
	@echo "  make up        - 기본(프로덕션) 환경 시작"
	@echo "  make down      - 모든 환경 중지"
	@echo "  make logs      - 로그 확인"
	@echo "  make status    - 서비스 상태 확인"
	@echo "  make clean     - 모든 데이터 정리"
	@echo ""
	@echo "개발 명령어:"
	@echo "  make build     - 이미지 빌드"
	@echo "  make shell     - API 컨테이너 쉘 접속"
	@echo "  make db-shell  - MySQL 컨테이너 접속"
	@echo "  make redis-cli - Redis CLI 접속"

# 기본 환경 (프로덕션)
up:
	@./scripts/docker-compose.sh prod up

# 환경별 시작
local:
	@./scripts/docker-compose.sh local up

dev:
	@./scripts/docker-compose.sh dev up

prod:
	@./scripts/docker-compose.sh prod up

test:
	@./scripts/docker-compose.sh test up

multi:
	@./scripts/docker-compose.sh multi up

# 모든 환경 중지
down:
	@echo "모든 Docker Compose 환경 중지 중..."
	@docker-compose -f docker-compose.yml down 2>/dev/null || true
	@docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
	@docker-compose -f docker-compose.local.yml down 2>/dev/null || true
	@docker-compose -f docker-compose.test.yml down 2>/dev/null || true
	@docker-compose -f docker-compose.multi-db.yml down 2>/dev/null || true
	@echo "완료!"

# 로그 확인 (실행 중인 모든 컨테이너)
logs:
	@docker-compose -f docker-compose.yml logs -f 2>/dev/null || \
	docker-compose -f docker-compose.dev.yml logs -f 2>/dev/null || \
	docker-compose -f docker-compose.local.yml logs -f 2>/dev/null || \
	docker-compose -f docker-compose.multi-db.yml logs -f 2>/dev/null || \
	echo "실행 중인 환경이 없습니다."

# API 로그만 확인
logs-api:
	@docker logs -f vanillameta_api 2>/dev/null || \
	docker logs -f vanillameta_api_dev 2>/dev/null || \
	docker logs -f vanillameta_api_local 2>/dev/null || \
	docker logs -f vanillameta_api_multi 2>/dev/null || \
	echo "실행 중인 API 컨테이너가 없습니다."

# 서비스 상태 확인
status:
	@echo "실행 중인 VanillaMeta 컨테이너:"
	@docker ps --filter "name=vanillameta" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 이미지 빌드
build:
	@echo "프로덕션 이미지 빌드 중..."
	@docker-compose -f docker-compose.yml build
	@echo "개발 이미지 빌드 중..."
	@docker-compose -f docker-compose.dev.yml build

# 빌드 (캐시 없이)
build-no-cache:
	@echo "프로덕션 이미지 빌드 중 (캐시 없이)..."
	@docker-compose -f docker-compose.yml build --no-cache
	@echo "개발 이미지 빌드 중 (캐시 없이)..."
	@docker-compose -f docker-compose.dev.yml build --no-cache

# 모든 데이터 정리
clean:
	@echo "경고: 이 작업은 모든 Docker 볼륨과 데이터를 삭제합니다!"
	@read -p "계속하시겠습니까? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(MAKE) down; \
		docker volume rm vanillameta_mysql_data 2>/dev/null || true; \
		docker volume rm vanillameta_redis_data 2>/dev/null || true; \
		docker volume rm vanillameta-dev_mysql_dev_data 2>/dev/null || true; \
		docker volume rm vanillameta-dev_redis_dev_data 2>/dev/null || true; \
		docker volume rm vanillameta-local_redis_local_data 2>/dev/null || true; \
		echo "정리 완료!"; \
	else \
		echo "취소되었습니다."; \
	fi

# API 컨테이너 쉘 접속
shell:
	@docker exec -it vanillameta_api sh 2>/dev/null || \
	docker exec -it vanillameta_api_dev sh 2>/dev/null || \
	docker exec -it vanillameta_api_local sh 2>/dev/null || \
	docker exec -it vanillameta_api_multi sh 2>/dev/null || \
	echo "실행 중인 API 컨테이너가 없습니다."

# MySQL 쉘 접속
db-shell:
	@docker exec -it vanillameta_mysql mysql -u root -p 2>/dev/null || \
	docker exec -it vanillameta_mysql_dev mysql -u root -p 2>/dev/null || \
	docker exec -it vanillameta_mysql_multi mysql -u root -p 2>/dev/null || \
	echo "실행 중인 MySQL 컨테이너가 없습니다."

# Redis CLI 접속
redis-cli:
	@docker exec -it vanillameta_redis redis-cli 2>/dev/null || \
	docker exec -it vanillameta_redis_dev redis-cli 2>/dev/null || \
	docker exec -it vanillameta_redis_local redis-cli 2>/dev/null || \
	docker exec -it vanillameta_redis_multi redis-cli 2>/dev/null || \
	echo "실행 중인 Redis 컨테이너가 없습니다."

# 데이터베이스 백업
backup-db:
	@echo "MySQL 데이터베이스 백업 중..."
	@mkdir -p backups
	@docker exec vanillameta_mysql mysqldump -u root -p vanillameta > backups/vanillameta_$(shell date +%Y%m%d_%H%M%S).sql 2>/dev/null || \
	docker exec vanillameta_mysql_dev mysqldump -u root -p vanillameta_dev > backups/vanillameta_dev_$(shell date +%Y%m%d_%H%M%S).sql 2>/dev/null || \
	echo "실행 중인 MySQL 컨테이너가 없습니다."

# 빠른 재시작 (개발용)
restart-api:
	@docker-compose -f docker-compose.dev.yml restart api 2>/dev/null || \
	docker-compose -f docker-compose.local.yml restart api 2>/dev/null || \
	echo "개발 환경이 실행되고 있지 않습니다."

# 환경 확인
check-env:
	@echo "Docker 버전:"
	@docker --version
	@echo ""
	@echo "Docker Compose 버전:"
	@docker-compose --version
	@echo ""
	@echo "환경 변수 파일:"
	@ls -la .env* 2>/dev/null || echo ".env 파일이 없습니다."