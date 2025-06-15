# VanillaMeta Docker Compose 통합 가이드

## 개요

이 가이드는 VanillaMeta 프로젝트의 Docker Compose 통합을 통해 전체 스택을 한 번에 실행하는 방법을 설명합니다.

## 전제 조건

- Docker Engine 20.10 이상
- Docker Compose v2.0 이상
- 최소 4GB 메모리
- 최소 10GB 디스크 공간

## 빠른 시작

### 1. 전체 스택 실행

```bash
# 프로젝트 루트 디렉토리에서 실행
docker compose up -d

# 로그 확인
docker compose logs -f
```

### 2. 서비스 접속

- **프론트엔드**: http://localhost:80
- **백엔드 API**: http://localhost:3000/api/v1
- **헬스체크**: http://localhost:3000/api/v1/health

### 3. 서비스 중지

```bash
# 모든 서비스 중지
docker compose down

# 볼륨까지 삭제 (데이터 완전 초기화)
docker compose down -v
```

## 서비스 구성

### 백엔드 (backend)

- **포트**: 3000
- **컨테이너명**: vanillameta-backend
- **데이터베이스**: SQLite (로컬 모드)
- **헬스체크**: `/api/v1/health`
- **데이터 지속성**: `sqlite_data` 볼륨

### 프론트엔드 (frontend)

- **포트**: 80 (HTTP)
- **컨테이너명**: vanillameta-frontend
- **웹서버**: Nginx
- **API 프록시**: `/api/*` → `backend:3000/api/*`
- **헬스체크**: 루트 경로 (`/`)

## 환경 변수

### 백엔드 환경 변수

```env
NODE_ENV=local
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_NAME=vanillameta
DB_CONNECTION_LIMIT=10
JWT_SECRET=vanillameta-local-jwt-secret-key
JWT_EXPIRATION=1d
JWT_REFRESH_SECRET=vanillameta-local-refresh-secret-key
JWT_REFRESH_EXPIRATION=7d
```

### 프론트엔드 환경 변수

```env
REACT_APP_API_URL=/api/v1
REACT_APP_MODE=local
GENERATE_SOURCEMAP=false
```

## 데이터 지속성

SQLite 데이터베이스는 `sqlite_data` 볼륨에 저장되어 컨테이너 재시작 후에도 데이터가 유지됩니다.

```bash
# 볼륨 정보 확인
docker volume ls
docker volume inspect vanillameta_sqlite_data
```

## 개발 모드

### 로그 실시간 확인

```bash
# 모든 서비스 로그
docker compose logs -f

# 특정 서비스 로그
docker compose logs -f backend
docker compose logs -f frontend
```

### 서비스 개별 제어

```bash
# 특정 서비스만 시작
docker compose up -d backend
docker compose up -d frontend

# 특정 서비스 재시작
docker compose restart backend
docker compose restart frontend

# 특정 서비스 중지
docker compose stop backend
docker compose stop frontend
```

### 컨테이너 내부 접속

```bash
# 백엔드 컨테이너 접속
docker compose exec backend sh

# 프론트엔드 컨테이너 접속
docker compose exec frontend sh
```

## 트러블슈팅

### 1. 포트 충돌

```bash
# 사용 중인 포트 확인
netstat -tlnp | grep :80
netstat -tlnp | grep :3000

# 포트를 변경하려면 docker-compose.yml 수정
```

### 2. 빌드 캐시 클리어

```bash
# 캐시 없이 다시 빌드
docker compose build --no-cache

# 모든 Docker 캐시 정리
docker system prune -a
```

### 3. 볼륨 이슈

```bash
# 볼륨 권한 확인
docker compose exec backend ls -la /app/

# 볼륨 재생성
docker compose down -v
docker compose up -d
```

### 4. 네트워크 이슈

```bash
# 네트워크 상태 확인
docker network ls
docker network inspect vanillameta_vanillameta-network

# 서비스간 연결 테스트
docker compose exec frontend curl backend:3000/api/v1/health
```

## 성능 최적화

### 1. 메모리 제한 설정

docker-compose.yml에 메모리 제한 추가:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1GB
    # ...
  frontend:
    deploy:
      resources:
        limits:
          memory: 512MB
    # ...
```

### 2. 병렬 빌드

```bash
# 병렬로 빌드 실행
docker compose build --parallel
```

## 보안 고려사항

1. **JWT 시크릿**: 프로덕션에서는 강력한 시크릿 키 사용
2. **데이터베이스**: SQLite는 개발/데모 용도로만 사용 권장
3. **HTTPS**: 프로덕션에서는 SSL/TLS 인증서 구성
4. **방화벽**: 필요한 포트만 노출

## 프로덕션 배포

프로덕션 환경에서는 다음 사항을 고려하세요:

1. **환경 변수 분리**: `.env` 파일로 민감한 정보 관리
2. **데이터베이스**: MySQL/PostgreSQL 등 운영 데이터베이스 사용
3. **로드 밸런서**: Nginx 또는 HAProxy 앞단 구성
4. **모니터링**: Prometheus, Grafana 등 모니터링 도구 추가
5. **백업**: 데이터베이스 자동 백업 설정

## 지원 및 문의

- 이슈 리포트: GitHub Issues
- 문서: `/docs` 디렉토리
- 개발 가이드: `CLAUDE.md`