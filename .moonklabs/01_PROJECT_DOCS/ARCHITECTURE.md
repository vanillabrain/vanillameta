# VanillaMeta Architecture

## 프로젝트 개요

VanillaMeta는 기업용 비즈니스 인텔리전스(BI) 웹 애플리케이션으로, 스타트업부터 대기업까지 다양한 규모의 기업이 데이터를 시각화하고 분석할 수 있도록 지원합니다.

### 핵심 가치
- **코드 없는 차트 생성**: 비기술직 사용자도 쉽게 데이터 시각화 가능
- **다양한 데이터베이스 지원**: 기업의 기존 데이터 인프라와 원활한 통합
- **맞춤형 대시보드**: 기업별 요구사항에 맞는 대시보드 구성
- **엔터프라이즈급 확장성**: AWS Lambda 기반으로 자동 확장 가능

## 시스템 아키텍처

### 전체 구조
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - 대시보드 UI                                          │
│  - 차트 위젯 (ECharts)                                 │
│  - SQL 편집기                                           │
└─────────────────────────────────────────────────────────┘
                            │
                    AWS API Gateway
                            │
┌─────────────────────────────────────────────────────────┐
│              Backend API (NestJS + Lambda)               │
│  - RESTful API                                          │
│  - 인증/인가 (JWT)                                      │
│  - 비즈니스 로직                                        │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────────────┐                     ┌───────────────────┐
│  Primary DB   │                     │ Customer DBs      │
│   (MySQL)     │                     │ - PostgreSQL      │
│               │                     │ - Oracle          │
│ - 사용자 정보 │                     │ - SQL Server      │
│ - 대시보드    │                     │ - BigQuery        │
│ - 위젯 설정   │                     │ - Snowflake       │
└───────────────┘                     └───────────────────┘
```

### 주요 컴포넌트

#### Frontend (React 18)
- **UI Framework**: Material-UI v5
- **차트 라이브러리**: ECharts (50+ 차트 타입 지원)
- **상태 관리**: Context API
- **라우팅**: React Router v6
- **레이아웃**: React Grid Layout (드래그 앤 드롭 대시보드)

#### Backend API (NestJS)
- **런타임**: AWS Lambda (Serverless)
- **프레임워크**: NestJS v9 (모듈화된 구조)
- **ORM**: TypeORM (메타데이터 저장)
- **Query Engine**: Knex.js (다중 DB 쿼리 실행)
- **인증**: JWT + Refresh Token

## 핵심 모듈 구조

### Backend 모듈
```
src/
├── auth/           # JWT 인증 및 리프레시 토큰
├── common/         # 공통 엔티티, 열거형, 변환기
├── component/      # 차트 컴포넌트 관리
├── connection/     # 데이터베이스 연결 서비스 (Knex)
├── dashboard/      # 대시보드 생성 및 관리
├── database/       # DB 연결 및 쿼리 실행
├── dataset/        # 위젯용 SQL 쿼리 데이터셋
├── login/          # 사용자 로그인 서비스
├── share-url/      # 대시보드 공유 기능
├── template/       # 대시보드 템플릿
├── user/           # 사용자 관리
└── widget/         # 차트 위젯
```

### Frontend 구조
```
src/
├── components/     # 재사용 가능한 UI 컴포넌트
├── pages/          # 페이지 컴포넌트
│   ├── Dashboard/  # 대시보드 CRUD
│   ├── Data/       # 데이터소스 및 데이터셋 관리
│   └── Widget/     # 위젯 생성 및 편집
├── widget/         # 차트 모듈
│   ├── modules/    # 차트 타입별 구현
│   └── settings/   # 차트 설정 컴포넌트
└── api/           # API 서비스 레이어
```

## 데이터 흐름

### 위젯 생성 프로세스
1. **데이터베이스 연결**: 고객 DB 정보 등록
2. **데이터셋 생성**: SQL 쿼리 작성 및 저장
3. **위젯 구성**: 차트 타입 선택 및 속성 설정
4. **대시보드 배치**: 드래그 앤 드롭으로 위젯 배치

### 쿼리 실행 흐름
```
사용자 요청 → API Gateway → Lambda → Connection Service 
→ Knex Query Builder → Customer DB → 결과 반환
```

## 보안 고려사항

### 인증/인가
- JWT 기반 stateless 인증
- Refresh Token으로 토큰 갱신
- Role 기반 접근 제어 (준비 중)

### 데이터베이스 보안
- 고객 DB 연결 정보 암호화 저장
- 읽기 전용 권한 권장
- SQL Injection 방지 (파라미터화된 쿼리)

### API 보안
- CORS 설정
- Rate Limiting (API Gateway)
- Request/Response 로깅

## 확장성 및 성능

### 서버리스 아키텍처
- **자동 확장**: Lambda의 동시 실행 제한 내에서 자동 확장
- **콜드 스타트 최소화**: Warmup 플러그인 사용
- **비용 효율성**: 사용한 만큼만 과금

### 데이터베이스 최적화
- **연결 풀링**: 데이터베이스별 최적화된 연결 관리
- **쿼리 캐싱**: 자주 사용되는 쿼리 결과 캐싱 (계획)
- **인덱싱**: 메타데이터 테이블 적절한 인덱싱

## 기술 스택 요약

### Frontend
- React 18 + TypeScript
- Material-UI v5
- ECharts
- React Grid Layout
- Axios

### Backend
- NestJS v9 + TypeScript
- AWS Lambda + API Gateway
- TypeORM + Knex.js
- JWT Authentication
- MySQL (메타데이터)

### Infrastructure
- AWS Lambda
- AWS API Gateway
- AWS RDS (MySQL)
- Serverless Framework

## 향후 개선 계획

### 단기 계획
- [ ] Role 기반 접근 제어 구현
- [ ] 실시간 데이터 업데이트 (WebSocket)
- [ ] 쿼리 결과 캐싱
- [ ] 다국어 지원

### 장기 계획
- [ ] 머신러닝 기반 인사이트 제공
- [ ] 데이터 파이프라인 통합
- [ ] 모바일 앱 지원
- [ ] On-premise 버전 제공