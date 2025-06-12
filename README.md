# VanillaMeta

<img title="VanillaMeta Logo" src="design/vanillameta-logo.png"/><br/>

**최신 엔터프라이즈용 비즈니스 인텔리전스(BI) 웹 애플리케이션**

VanillaMeta는 NestJS 백엔드와 React 프론트엔드로 구성된 풀스택 BI 솔루션으로, 다양한 SQL 데이터베이스를 지원하여 강력한 데이터 시각화와 대시보드 기능을 제공합니다.

[![Build Status](https://github.com/vanillabrain/vanillameta/actions/workflows/ci.yml/badge.svg)](https://github.com/vanillabrain/vanillameta/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🚀 주요 기능

- **🎨 코딩 없는 차트 제작**: 직관적인 UI로 차트 위젯 생성
- **📊 50+ 차트 타입 지원**: ECharts 기반 다양한 시각화 옵션
- **📱 반응형 대시보드**: 드래그 앤 드롭으로 레이아웃 편집
- **🔗 다중 데이터베이스 지원**: 10개 이상의 SQL 데이터베이스 연결
- **⚡ 고성능 SQL 편집기**: 실시간 쿼리 실행 및 데이터 미리보기
- **🎯 템플릿 시스템**: 사전 정의된 대시보드 템플릿 제공
- **🔒 보안 인증**: JWT 기반 사용자 인증 및 권한 관리
- **📤 공유 기능**: URL 기반 대시보드 공유

## 🛠️ 기술 스택

### 백엔드 (backend-api/)
- **Framework**: NestJS 9.x
- **ORM**: TypeORM 0.3.x + Knex.js
- **인증**: Passport JWT
- **배포**: AWS Lambda (Serverless Framework)
- **모니터링**: 프로메테우스 메트릭 지원

### 프론트엔드 (frontend-web/)
- **Framework**: React 18.x + TypeScript
- **UI Library**: Material-UI 5.x
- **차트 라이브러리**: Apache ECharts
- **상태 관리**: React Context API
- **레이아웃**: React Grid Layout
- **배포**: S3 + CloudFront

## 주요기능 화면

- **다양한 시각화 차트**
<kbd><img title="Chart" src="design/feature-01.png"/></kbd><br/>

- **강력한 SQL 편집기**
<kbd><img title="Chart" src="design/feature-02.png"/></kbd><br/>

- **코딩없이 차트 제작**
<kbd><img title="Chart" src="design/feature-03.png"/></kbd><br/>

- **템플릿 추천**
<kbd><img title="Chart" src="design/feature-04.png"/></kbd><br/>

## 지원하는 데이터베이스

- PostgreSQL
- MariaDB
- MySQL
- SQLServer
- SQLite
- Oracle
- Amazon Redshift
- Big Query
- Cockroachdb
- Snowflake

## 설치하기


```
cd ~/vanillameta/backend-api/ npm install
cd ~/vanillameta/frontend-web/ npm install
```

## 시작하기
```
cd 현재위치/vanillameta/backend-api/ npm run seed:run 완료 후
cd 현재위치/vanillameta/backend-api/ npm run start

새로운 터미널에서
cd 현재위치/vanillameta/frontend-web/ npm run start
```
실행 후 localhost:3000경로에서
![로그인 화면](https://user-images.githubusercontent.com/83908329/219256208-2c8fab3e-751d-4612-bda0-158dd4309032.png)
화면이 뜬다면 성공 !

```
현재 default 계정정보는
ID: guest
PW: Admin!@12
```
입니다. 이후 회원정보 변경하기 페이지에서 비밀번호를 바꿔서 사용하시면 됩니다

## db연동하기

사용하고 계신 MySql의 연결을 확인한 후 저장해 주세요.
![db연결 확인 및 저장](https://user-images.githubusercontent.com/83908329/219614086-9bb4545f-1306-48bb-9613-c78cfa968430.png)

## 데이터셋 설정하기
위젯에 적용할 데이터를 query문을 사용하여 선택하시고 저장해 주세요.
![데이터셋 설정](https://user-images.githubusercontent.com/83908329/219614709-e4621672-b4c5-4b17-bcbc-117f9145e555.png)



## 위젯 생성하기

1. 생성한 데이터 셋을 선택하고 다음으로 넘어가 주세요.
![위젯 데이터 선택 이미지](https://user-images.githubusercontent.com/83908329/219615999-745dcbf7-6e6d-4d7f-8100-9d34bb0b0654.png)


2. 원하는 타입의 위젯을 선택하고 다음으로 넘어가 주세요.
![위젯 타입 선택 이미지](https://user-images.githubusercontent.com/83908329/219616299-a571ab00-5bab-454c-9a96-2e70caefd33d.png)


3. 원하는 위젯의 속성을 선택하시고 저장을 눌러주세요.
![위젯 속성 이미지](https://user-images.githubusercontent.com/83908329/219616483-48551fb9-d123-4c87-b8d7-42d37219fe48.png)



생성한 위젯들로 대시보드를 구성해 보세요!



