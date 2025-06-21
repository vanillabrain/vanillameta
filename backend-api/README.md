# VanillaMeta Backend API

기업용 비즈니스 인텔리전스(BI) 웹 애플리케이션의 백엔드 API 서버입니다. NestJS 프레임워크를 기반으로 구축되었으며, AWS Lambda에서 서버리스로 실행됩니다.

## 주요 기능

- 다중 데이터베이스 연결 지원 (MySQL, PostgreSQL, Oracle, SQL Server, SQLite 등)
- 실시간 데이터 시각화를 위한 API
- JWT 기반 인증 시스템
- 대시보드 및 위젯 관리
- SQL 쿼리 실행 및 데이터셋 관리
- 대시보드 공유 기능

## 기술 스택

- **프레임워크**: NestJS v9 + TypeScript
- **런타임**: Node.js 18, AWS Lambda
- **데이터베이스**: TypeORM (메타데이터), Knex.js (다중 DB 쿼리)
- **캐시**: Redis
- **인증**: JWT + Refresh Token
- **컨테이너**: Docker & Docker Compose

## 빠른 시작

### Docker Compose 사용 (권장)

```bash
# 개발 환경 시작
make dev

# 또는 스크립트 사용
./scripts/docker-compose.sh dev up

# 로그 확인
make logs

# 환경 중지
make down
```

### 로컬 개발 (Docker 없이)

```bash
# 의존성 설치
yarn install

# Redis 서버 시작 (별도 터미널)
redis-server

# 개발 서버 실행
yarn start:local  # SQLite 사용
yarn start:dev    # MySQL 사용
```

### 환경별 Docker Compose

```bash
# 로컬 환경 (SQLite)
docker-compose -f docker-compose.local.yml up -d

# 개발 환경 (MySQL)
docker-compose -f docker-compose.dev.yml up -d

# 프로덕션 환경
docker-compose up -d

# 테스트 실행
docker-compose -f docker-compose.test.yml up

# 다중 DB 테스트
docker-compose -f docker-compose.multi-db.yml up -d
```

자세한 Docker Compose 사용법은 [Docker Compose 가이드](docs/docker-compose-guide.md)를 참조하세요.

## 프로젝트 구조

```
src/
├── auth/           # JWT 인증 및 리프레시 토큰
├── common/         # 공통 모듈 (로거, 모니터링, 최적화)
├── connection/     # 데이터베이스 연결 서비스
├── dashboard/      # 대시보드 관리
├── database/       # DB 연결 및 쿼리 실행
├── dataset/        # 데이터셋 관리
├── user/           # 사용자 관리
└── widget/         # 위젯 관리
```

## 주요 명령어

```bash
# 개발
yarn start:local      # SQLite 사용 (로컬)
yarn start:dev        # MySQL 사용 (개발)
yarn start:debug      # 디버그 모드

# 테스트
yarn test             # 단위 테스트
yarn test:watch       # 감시 모드
yarn test:cov         # 커버리지
yarn test:e2e         # E2E 테스트

# 코드 품질
yarn lint             # ESLint
yarn format           # Prettier

# 배포
yarn build            # 빌드
yarn deploy:dev       # 개발 환경 배포
yarn deploy:prod      # 프로덕션 배포
```

## 환경 설정

`.env.example`을 복사하여 `.env` 파일을 생성하고 필요한 값을 설정하세요:

```bash
cp .env.example .env
```

주요 환경 변수:
- `DB_TYPE`: 데이터베이스 타입 (mysql, sqlite 등)
- `DB_HOST`: 데이터베이스 호스트
- `DB_PORT`: 데이터베이스 포트
- `DB_USERNAME`: 데이터베이스 사용자명
- `DB_PASSWORD`: 데이터베이스 비밀번호
- `DB_NAME`: 데이터베이스 이름
- `REDIS_HOST`: Redis 호스트
- `REDIS_PORT`: Redis 포트

## API 문서

서버 실행 후 Swagger 문서를 확인할 수 있습니다:
- http://localhost:3000/api

## 테스트

```bash
# 모든 테스트 실행
yarn test

# 특정 모듈 테스트
yarn test --testPathPattern="auth"

# E2E 테스트
yarn test:e2e

# 테스트 커버리지
yarn test:cov
```

## Docker 지원

프로젝트는 다양한 Docker Compose 설정을 제공합니다:

- `docker-compose.yml`: 프로덕션 환경
- `docker-compose.dev.yml`: 개발 환경
- `docker-compose.local.yml`: 로컬 환경 (SQLite)
- `docker-compose.test.yml`: 테스트 환경
- `docker-compose.multi-db.yml`: 다중 DB 테스트

## 문제 해결

### Redis 연결 오류
```bash
# Redis 서버 시작
redis-server --daemonize yes

# Redis 연결 확인
redis-cli ping
```

### 데이터베이스 연결 오류
- 환경 변수가 올바르게 설정되었는지 확인
- 데이터베이스 서버가 실행 중인지 확인
- 네트워크 연결 상태 확인

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.
