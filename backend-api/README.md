# VanillaMeta Backend API

<p align="center">
  <img src="../design/vanillameta-logo.png" width="200" alt="VanillaMeta Logo" />
</p>

**VanillaMeta의 백엔드 API 서버**

기업용 비즈니스 인텔리전스(BI) 웹 애플리케이션의 백엔드 API 서버입니다. NestJS 프레임워크를 기반으로 구축되었으며, AWS Lambda에서 서버리스로 실행됩니다.

## 🛠️ 기술 스택

- **Framework**: NestJS 9.x
- **언어**: TypeScript
- **ORM**: TypeORM 0.3.x + Knex.js
- **캐시**: Redis
- **인증**: Passport JWT
- **검증**: class-validator, class-transformer
- **배포**: AWS Lambda (Serverless Framework)
- **모니터링**: 프로메테우스 메트릭 지원
- **테스트**: Jest
- **컨테이너**: Docker & Docker Compose

## 📁 프로젝트 구조

```
src/
├── auth/                 # JWT 인증 및 권한 관리
├── common/               # 공통 모듈 (로거, 모니터링, 최적화)
├── connection/           # 데이터베이스 연결 관리
├── dataset/              # SQL 쿼리 기반 데이터셋 관리
├── widget/               # 차트 위젯 생성 및 관리
├── dashboard/            # 대시보드 구성 및 레이아웃
├── template/             # 대시보드 템플릿 시스템
├── share-url/            # URL 기반 공유 기능
├── user/                 # 사용자 관리
└── app.module.ts         # 메인 애플리케이션 모듈
```

## 🗄️ 지원 데이터베이스

- PostgreSQL
- MySQL / MariaDB
- Microsoft SQL Server
- SQLite
- Oracle Database
- Amazon Redshift
- Google BigQuery
- CockroachDB
- Snowflake

## 🚀 빠른 시작

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

## 🚀 설치 및 실행

### 필수 요구사항
- Node.js 16.x 이상
- npm 또는 yarn
- Redis Server (캐싱 및 세션 관리용)

### 의존성 설치

```bash
npm install
```

### 환경 설정

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
- `JWT_SECRET`: JWT 시크릿 키
- `JWT_EXPIRATION`: JWT 만료 시간

### 데이터베이스 초기화

```bash
# 시드 데이터 실행
npm run seed
```

### 개발 서버 실행

```bash
# 개발 모드 (핫 리로드)
npm run start:dev

# 로컬 환경
npm run start:local

# 일반 실행
npm run start

# 프로덕션 모드
npm run start:prod

# 디버그 모드
npm run start:debug
```

## 🧪 테스트

```bash
# 단위 테스트
npm run test

# E2E 테스트
npm run test:e2e

# 테스트 커버리지
npm run test:cov

# 테스트 감시 모드
npm run test:watch

# 특정 모듈 테스트
npm run test --testPathPattern="auth"
```

## 🔧 코드 품질

```bash
# ESLint 실행
npm run lint

# ESLint 자동 수정
npm run lint:fix

# Prettier 포맷팅
npm run format
```

## 🚢 배포

### AWS Lambda 배포 (Serverless)

```bash
# 개발 환경 배포
npm run deploy:dev

# 프로덕션 환경 배포
npm run deploy:prod
```

### Docker 배포

```bash
# Docker 이미지 빌드
docker build -t vanillameta-backend .

# Docker 컨테이너 실행
docker run -p 3000:3000 vanillameta-backend
```

프로젝트는 다양한 Docker Compose 설정을 제공합니다:

- `docker-compose.yml`: 프로덕션 환경
- `docker-compose.dev.yml`: 개발 환경
- `docker-compose.local.yml`: 로컬 환경 (SQLite)
- `docker-compose.test.yml`: 테스트 환경
- `docker-compose.multi-db.yml`: 다중 DB 테스트

## 📊 API 문서

서버 실행 후 다음 URL에서 Swagger API 문서를 확인할 수 있습니다:

- 개발: http://localhost:3000/api/docs
- 프로덕션: https://api.vanillameta.com/api/docs

## 🔒 인증

JWT 기반 인증을 사용합니다. API 요청 시 Authorization 헤더에 Bearer 토큰을 포함해야 합니다:

```
Authorization: Bearer <your-jwt-token>
```

## 🎯 주요 기능

### 데이터베이스 연결 관리
- 다중 데이터베이스 동시 연결 지원
- 연결 풀 관리
- 연결 상태 모니터링

### SQL 쿼리 실행
- 사용자 정의 SQL 쿼리 실행
- 쿼리 결과 캐싱
- 쿼리 실행 시간 모니터링

### 차트 위젯
- 50+ 차트 타입 지원
- 데이터셋 기반 위젯 생성
- 위젯 설정 저장 및 관리

### 대시보드
- 레이아웃 관리
- 위젯 배치 및 크기 조정
- 대시보드 공유 기능

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

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](../LICENSE) 파일을 참조하세요.

## 📞 지원

문제가 발생하거나 질문이 있으시면 [이슈](https://github.com/vanillabrain/vanillameta/issues)를 생성해 주세요.