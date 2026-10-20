# VanillaMeta Docker Setup

VanillaMeta를 Docker로 실행하기 위한 완전한 가이드입니다.

## 필수 요구사항

- Docker 20.10+
- Docker Compose 2.0+
- 4GB 이상의 여유 메모리
- 포트 80, 3000, 6379가 사용 가능해야 함

## 빠른 시작

### 1. 저장소 클론
```bash
git clone https://github.com/vanillameta/vanillameta.git
cd vanillameta
```

### 2. 환경 설정
```bash
# 환경 파일 생성
cp .env.example .env

# 필요에 따라 .env 파일 수정
nano .env
```

### 3. 헬퍼 스크립트 사용
```bash
# 프로덕션 모드로 시작
./docker-compose-helper.sh start -d

# 개발 모드로 시작 (핫 리로드 지원)
./docker-compose-helper.sh dev

# 상태 확인
./docker-compose-helper.sh status

# 로그 보기
./docker-compose-helper.sh logs -f
```

### 4. 애플리케이션 접속
- 프론트엔드: http://localhost
- 백엔드 API: http://localhost/api/v1
- API 문서: http://localhost/api/v1/docs

## 아키텍처

### 서비스 구성
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│  Frontend   │     │   Redis     │
│  (Port 80)  │     │ (React App) │     │ (Port 6379) │
└──────┬──────┘     └─────────────┘     └──────▲──────┘
       │                                        │
       │            ┌─────────────┐             │
       └───────────▶│   Backend   │─────────────┘
                    │ (NestJS API)│
                    │ (Port 3000) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   SQLite    │
                    │  (Volume)   │
                    └─────────────┘
```

### 서비스 상세

#### Redis
- 캐싱 및 세션 관리
- 영구 저장을 위한 AOF 활성화
- 헬스체크 포함

#### Backend (NestJS)
- TypeScript 기반 API 서버
- JWT 인증
- SQLite 데이터베이스 (로컬 개발)
- Oracle Instant Client 포함
- 헬스체크 엔드포인트: `/api/v1/health`

#### Frontend (React)
- Material-UI 기반 UI
- ECharts를 통한 50+ 차트 타입 지원
- Nginx로 정적 파일 서빙

#### Nginx
- 리버스 프록시
- API 요청 라우팅
- 정적 파일 캐싱
- 보안 헤더 설정

## 개발 환경

### 개발 모드 실행
```bash
# docker-compose.override.yml이 자동으로 적용됨
./docker-compose-helper.sh dev

# 또는 직접 실행
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
```

### 개발 모드 특징
- 소스 코드 볼륨 마운트 (핫 리로드)
- 디버그 로깅 활성화
- 프론트엔드 개발 서버 포트 3001
- Redis 디버그 모드

### 특정 서비스만 실행
```bash
# 백엔드만
docker-compose up backend

# 프론트엔드만
docker-compose up frontend

# Redis만
docker-compose up redis
```

## 환경 변수

### 백엔드 환경 변수
```env
# 기본 설정
NODE_ENV=local              # local, dev, prod
PORT=3000                   # API 서버 포트

# JWT 설정
JWT_SECRET=your-secret-key
JWT_EXPIRATION=1d
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRATION=7d

# 데이터베이스 (외부 DB 사용 시)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_NAME=vanillameta
DB_CONNECTION_LIMIT=10

# Redis 설정
REDIS_HOST=redis
REDIS_PORT=6379
```

### 프론트엔드 환경 변수
```env
REACT_APP_API_URL=http://localhost/api/v1
REACT_APP_MODE=local
GENERATE_SOURCEMAP=false
```

## 데이터 영속성

### 볼륨 구성
- `sqlite_data`: SQLite 데이터베이스 파일
- `redis_data`: Redis 데이터
- `log_data`: 애플리케이션 로그
- `nginx_logs`: Nginx 액세스/에러 로그

### 백업
```bash
# 데이터 백업
docker run --rm -v vanillameta_sqlite_data:/data -v $(pwd):/backup alpine tar czf /backup/sqlite_backup.tar.gz -C /data .

# 데이터 복원
docker run --rm -v vanillameta_sqlite_data:/data -v $(pwd):/backup alpine tar xzf /backup/sqlite_backup.tar.gz -C /data
```

## 모니터링 및 디버깅

### 로그 확인
```bash
# 모든 서비스 로그
./docker-compose-helper.sh logs

# 특정 서비스 로그 팔로우
./docker-compose-helper.sh logs -f backend

# 직접 명령
docker-compose logs -f redis
docker-compose logs --tail=100 nginx
```

### 컨테이너 접속
```bash
# 백엔드 컨테이너 쉘
docker-compose exec backend sh

# Redis CLI
docker-compose exec redis redis-cli

# SQLite 데이터베이스 확인
docker-compose exec backend sqlite3 /app/sqlite_data/sqlite.db
```

### 헬스체크
```bash
# 백엔드 헬스체크
curl http://localhost/api/v1/health

# Nginx 헬스체크
curl http://localhost/health

# Redis 헬스체크
docker-compose exec redis redis-cli ping
```

## 문제 해결

### 포트 충돌
포트가 이미 사용 중인 경우:
```bash
# 사용 중인 포트 확인
lsof -i :80
lsof -i :3000
lsof -i :6379

# docker-compose.yml에서 포트 변경
ports:
  - "8080:80"    # 80 대신 8080 사용
```

### 권한 문제
Linux에서 권한 문제 발생 시:
```bash
# Docker 그룹에 사용자 추가
sudo usermod -aG docker $USER

# 로그아웃 후 다시 로그인
```

### 메모리 부족
Docker Desktop 설정에서 메모리 할당 증가:
- Windows/Mac: Docker Desktop → Settings → Resources
- Linux: `/etc/docker/daemon.json` 수정

### 빌드 캐시 문제
```bash
# 캐시 없이 재빌드
./docker-compose-helper.sh rebuild

# 또는
docker-compose build --no-cache
```

## 프로덕션 배포

### 보안 설정
1. `.env` 파일의 시크릿 값들 변경
2. HTTPS 설정 추가 (Let's Encrypt)
3. 방화벽 규칙 설정

### 성능 최적화
1. 빌드 시 프로덕션 최적화 활성화
2. 리소스 제한 설정:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 모니터링 추가
- Prometheus + Grafana
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Health check 대시보드

## 유용한 명령어

```bash
# 전체 시스템 재시작
./docker-compose-helper.sh restart

# 이미지 업데이트 후 재시작
./docker-compose-helper.sh build && ./docker-compose-helper.sh restart

# 완전 초기화 (데이터 손실 주의!)
./docker-compose-helper.sh reset

# 디스크 공간 확보
docker system prune -af

# 실행 중인 컨테이너 리소스 사용량
docker stats
```

## 추가 리소스

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [VanillaMeta 개발 가이드](./docs/개발_가이드.md)
- [기술 아키텍처](./docs/기술_아키텍처.md)