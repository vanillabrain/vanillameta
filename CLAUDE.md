# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

VanillaMeta는 최신 엔터프라이즈용 비즈니스 인텔리전스(BI) 웹 애플리케이션입니다. 백엔드 API(NestJS)와 프론트엔드 웹(React)으로 구성된 풀스택 프로젝트이며, 다양한 SQL 데이터베이스를 지원하여 데이터 시각화와 대시보드 기능을 제공합니다.

## 개발 환경 설정 및 실행

### 초기 설치
```bash
# 백엔드 의존성 설치
cd backend-api
npm install

# 프론트엔드 의존성 설치  
cd ../frontend-web
npm install
```

### 개발 서버 실행
```bash
# 1. 백엔드 시드 데이터 초기화 (최초 1회)
cd backend-api
npm run seed

# 2. 백엔드 개발 서버 시작
npm run start:dev  # 개발 환경
npm run start:local  # 로컬 환경

# 3. 프론트엔드 개발 서버 시작 (새 터미널)
cd ../frontend-web
npm run start:dev  # 개발 환경
npm run start:local  # 로컬 환경
```

### 빌드 및 배포
```bash
# 백엔드 빌드
cd backend-api
npm run build
npm run deploy:dev  # 개발 배포
npm run deploy:prod  # 프로덕션 배포

# 프론트엔드 빌드
cd frontend-web
npm run build:dev  # 개발 빌드
npm run build  # 프로덕션 빌드
npm run deploy:dev  # 개발 배포
npm run deploy:prod  # 프로덕션 배포
```

### 테스트 및 코드 품질
```bash
# 백엔드 테스트
cd backend-api
npm run test  # 단위 테스트
npm run test:e2e  # E2E 테스트
npm run test:cov  # 커버리지 포함
npm run lint  # ESLint 실행

# 프론트엔드 테스트
cd frontend-web
npm run test  # Jest 테스트
```

## 프로젝트 아키텍처

### 전체 구조
- `backend-api/`: NestJS 기반 백엔드 API 서버
- `frontend-web/`: React 기반 프론트엔드 웹 애플리케이션  
- `backend-api-libs-lambda-layer/`: AWS Lambda Layer용 공유 라이브러리
- `landing-page/`: 정적 랜딩 페이지
- `design/`: 디자인 리소스 및 스크린샷
- `docs/`: 프로젝트 문서화

### 백엔드 아키텍처 (backend-api/)
- **모듈 기반 구조**: NestJS의 모듈 시스템을 활용한 기능별 분리
- **인증 시스템**: JWT 기반 인증 (`auth/` 모듈)
- **데이터베이스 연결**: TypeORM + Knex.js 조합으로 다중 DB 지원
- **핵심 도메인 모듈**:
  - `connection/`: 데이터베이스 연결 관리
  - `dataset/`: SQL 쿼리 기반 데이터셋 관리  
  - `widget/`: 차트 위젯 생성 및 관리
  - `dashboard/`: 대시보드 구성 및 레이아웃
  - `template/`: 대시보드 템플릿 시스템
  - `share-url/`: URL 기반 공유 기능

### 프론트엔드 아키텍처 (frontend-web/)
- **컴포넌트 기반**: 재사용 가능한 UI 컴포넌트 구조
- **상태 관리**: React Context API 활용 (Auth, Alert, Loading, Layout)
- **페이지 구조**: `pages/` 디렉토리의 기능별 페이지 컴포넌트
- **차트 시스템**: ECharts 기반 50+ 차트 타입 지원 (`widget/` 모듈)
- **레이아웃**: React Grid Layout을 통한 드래그 앤 드롭 대시보드

### 지원 데이터베이스
PostgreSQL, MySQL, MariaDB, SQLServer, SQLite, Oracle, BigQuery, Redshift, Snowflake, CockroachDB

## 기본 로그인 정보
- **ID**: guest
- **PW**: Admin!@12

## 배포 환경
- **백엔드**: AWS Lambda (Serverless Framework)
- **프론트엔드**: S3 + CloudFront 정적 호스팅
- **환경 구분**: dev, local, prod 환경별 설정 관리

## 주요 기술 스택
- **백엔드**: NestJS 9.x, TypeORM 0.3.x, Knex.js, Passport JWT
- **프론트엔드**: React 18.x, TypeScript, Material-UI 5.x, ECharts
- **데이터베이스**: 다중 SQL 데이터베이스 지원
- **배포**: Serverless Framework, AWS Lambda, S3 + CloudFront