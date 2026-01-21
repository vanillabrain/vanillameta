# Docker Compose 통합 가이드

## 개요

VanillaMeta Backend API는 다양한 환경에서 쉽게 실행할 수 있도록 Docker Compose 설정을 제공합니다. 이 가이드는 각 환경별 Docker Compose 파일의 사용법과 특징을 설명합니다.

## 환경별 Docker Compose 파일

### 1. 프로덕션 환경 (`docker-compose.yml`)

프로덕션 환경을 위한 기본 설정입니다.

**특징:**
- MySQL 8.0 데이터베이스
- Redis 캐시 서버
- 최적화된 Dockerfile 사용
- 헬스체크 설정
- 자동 재시작 설정

**사용법:**
```bash
# 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 서비스 중지
docker-compose down
```

### 2. 개발 환경 (`docker-compose.dev.yml`)

개발 환경을 위한 설정으로, 핫 리로딩과 디버깅을 지원합니다.

**특징:**
- 소스 코드 볼륨 마운트 (핫 리로딩)
- 디버그 포트 (9229) 노출
- MySQL 상세 로깅 활성화
- 개발용 환경 변수

**사용법:**
```bash
# 개발 환경 시작
docker-compose -f docker-compose.dev.yml up -d

# 특정 서비스만 재시작
docker-compose -f docker-compose.dev.yml restart api

# 로그 실시간 확인
docker-compose -f docker-compose.dev.yml logs -f api
```

### 3. 로컬 환경 (`docker-compose.local.yml`)

SQLite를 사용하는 가벼운 로컬 개발 환경입니다.

**특징:**
- SQLite 데이터베이스 사용
- Redis만 컨테이너로 실행
- 최소한의 리소스 사용
- 빠른 시작과 종료

**사용법:**
```bash
# 로컬 환경 시작
docker-compose -f docker-compose.local.yml up -d

# SQLite 데이터베이스 파일은 ./sqlite.db에 저장됨
```

### 4. 테스트 환경 (`docker-compose.test.yml`)

자동화된 테스트 실행을 위한 환경입니다.

**특징:**
- 격리된 테스트 데이터베이스
- 메모리 기반 MySQL (tmpfs)
- 테스트 커버리지 리포트 생성
- 일회성 실행

**사용법:**
```bash
# 테스트 실행
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# 테스트 후 정리
docker-compose -f docker-compose.test.yml down -v
```

### 5. 다중 데이터베이스 환경 (`docker-compose.multi-db.yml`)

여러 데이터베이스 타입을 동시에 테스트할 수 있는 환경입니다.

**지원 데이터베이스:**
- MySQL 8.0 (포트: 3306)
- PostgreSQL 15 (포트: 5432)
- MariaDB 11 (포트: 3308)
- Oracle XE 21c (포트: 1521)
- SQL Server 2022 (포트: 1433)

**사용법:**
```bash
# 다중 DB 환경 시작
docker-compose -f docker-compose.multi-db.yml up -d

# 특정 데이터베이스 서비스만 시작
docker-compose -f docker-compose.multi-db.yml up -d mysql postgres
```

## Docker Compose 헬퍼 스크립트

편리한 사용을 위해 `scripts/docker-compose.sh` 헬퍼 스크립트를 제공합니다.

### 사용법

```bash
# 스크립트에 실행 권한 부여 (최초 1회)
chmod +x scripts/docker-compose.sh

# 개발 환경 시작
./scripts/docker-compose.sh dev up

# 테스트 실행
./scripts/docker-compose.sh test up

# 프로덕션 로그 확인
./scripts/docker-compose.sh prod logs

# 환경 정리 (볼륨 포함)
./scripts/docker-compose.sh dev clean
```

### 지원 명령어

- `up`: 서비스 시작
- `down`: 서비스 중지
- `restart`: 서비스 재시작
- `logs`: 로그 확인
- `build`: 이미지 빌드
- `status`: 서비스 상태 확인
- `clean`: 볼륨 포함 전체 정리

## 환경 변수 설정

각 환경에서 사용하는 환경 변수는 다음과 같이 설정할 수 있습니다:

### .env 파일 생성

```bash
# .env.example을 복사하여 .env 파일 생성
cp .env.example .env

# 필요에 따라 값 수정
vim .env
```

### 주요 환경 변수

```env
# 데이터베이스 설정
DB_TYPE=mysql
DB_HOST=mysql
DB_PORT=3306
DB_USERNAME=vanillameta
DB_PASSWORD=your_password
DB_NAME=vanillameta

# Redis 설정
REDIS_HOST=redis
REDIS_PORT=6379

# JWT 설정
ACCESS_SECRET=your_access_secret
REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_SECRET=your_jwt_secret
URL_ACCESS_SECRET=your_url_secret

# CORS 설정
CORS_ORIGIN=http://localhost:3001
```

## 데이터 영속성

### 볼륨 관리

Docker Compose는 다음 볼륨을 사용하여 데이터를 영속화합니다:

- `mysql_data`: MySQL 데이터베이스 파일
- `redis_data`: Redis 영속성 파일
- `sqlite_data`: SQLite 데이터베이스 파일

### 볼륨 백업

```bash
# MySQL 데이터 백업
docker-compose exec mysql mysqldump -u root -p vanillameta > backup.sql

# 볼륨 직접 백업
docker run --rm -v vanillameta_mysql_data:/data -v $(pwd):/backup alpine tar czf /backup/mysql_backup.tar.gz /data
```

## 문제 해결

### 1. 포트 충돌

이미 사용 중인 포트가 있을 경우:

```bash
# 사용 중인 포트 확인
lsof -i :3306
lsof -i :6379

# docker-compose.yml에서 포트 변경
ports:
  - "3307:3306"  # 호스트 포트를 3307로 변경
```

### 2. 메모리 부족

Docker Desktop의 메모리 할당을 늘려주세요:
- Docker Desktop → Settings → Resources → Memory: 4GB 이상 권장

### 3. 빌드 오류

```bash
# 캐시 없이 이미지 다시 빌드
docker-compose build --no-cache

# 모든 이미지, 컨테이너, 볼륨 정리
docker system prune -a --volumes
```

### 4. 데이터베이스 연결 오류

```bash
# 데이터베이스 컨테이너 상태 확인
docker-compose ps

# 데이터베이스 로그 확인
docker-compose logs mysql

# 네트워크 확인
docker network ls
docker network inspect vanillameta_default
```

## 성능 최적화

### 1. 빌드 캐시 활용

```dockerfile
# package.json을 먼저 복사하여 의존성 캐시 활용
COPY package*.json ./
RUN yarn install
COPY . .
```

### 2. 멀티 스테이지 빌드

프로덕션 Dockerfile은 멀티 스테이지 빌드를 사용하여 이미지 크기를 최소화합니다.

### 3. 헬스체크 최적화

각 서비스에 적절한 헬스체크를 설정하여 안정성을 향상시킵니다.

## 보안 고려사항

1. **프로덕션 환경에서는 반드시 강력한 비밀번호 사용**
2. **환경 변수 파일(.env)은 절대 커밋하지 않음**
3. **필요한 포트만 노출**
4. **비root 사용자로 컨테이너 실행 (프로덕션 Dockerfile)**

## 추가 리소스

- [Docker Compose 공식 문서](https://docs.docker.com/compose/)
- [Docker 보안 가이드](https://docs.docker.com/engine/security/)
- [NestJS Docker 가이드](https://docs.nestjs.com/recipes/docker)