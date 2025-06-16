# VanillaMeta Backend API

<p align="center">
  <img src="../design/vanillameta-logo.png" width="200" alt="VanillaMeta Logo" />
</p>

**VanillaMeta의 백엔드 API 서버**

NestJS 기반의 엔터프라이즈 비즈니스 인텔리전스(BI) 백엔드 애플리케이션입니다. 
다양한 SQL 데이터베이스에 연결하여 데이터 조회, 차트 위젯 생성, 대시보드 관리 등의 기능을 제공합니다.

## 🛠️ 기술 스택

- **Framework**: NestJS 9.x
- **언어**: TypeScript
- **ORM**: TypeORM 0.3.x + Knex.js
- **인증**: Passport JWT
- **검증**: class-validator, class-transformer
- **배포**: AWS Lambda (Serverless Framework)
- **모니터링**: 프로메테우스 메트릭 지원
- **테스트**: Jest

## 📁 프로젝트 구조

```
src/
├── auth/                 # JWT 인증 및 권한 관리
├── connection/           # 데이터베이스 연결 관리
├── dataset/              # SQL 쿼리 기반 데이터셋 관리
├── widget/               # 차트 위젯 생성 및 관리
├── dashboard/            # 대시보드 구성 및 레이아웃
├── template/             # 대시보드 템플릿 시스템
├── share-url/            # URL 기반 공유 기능
├── user/                 # 사용자 관리
├── common/               # 공통 유틸리티 및 데코레이터
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

## 🚀 설치 및 실행

### 필수 요구사항
- Node.js 16.x 이상
- npm 또는 yarn

### 의존성 설치

```bash
npm install
```

### 환경 설정

`.env` 파일을 생성하고 필요한 환경 변수를 설정하세요:

```bash
# 데이터베이스 설정
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=username
DATABASE_PASSWORD=password
DATABASE_NAME=vanillameta

# JWT 설정
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# 서버 설정
PORT=3001
NODE_ENV=development
```

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
docker run -p 3001:3001 vanillameta-backend
```

## 📊 API 문서

서버 실행 후 다음 URL에서 Swagger API 문서를 확인할 수 있습니다:

- 개발: http://localhost:3001/api/docs
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

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 Apache-2.0 라이선스 하에 있습니다. 자세한 내용은 [LICENSE](../LICENSE) 파일을 참조하세요.

## 📞 지원

문제가 발생하거나 질문이 있으시면 [이슈](https://github.com/vanillabrain/vanillameta/issues)를 생성해 주세요.