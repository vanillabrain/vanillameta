# VanillaMeta

<img title="VanillaMeta Logo" src="design/vanillameta-logo.png"/><br/>

최신 엔터프라이즈용 비즈니스 인텔리전스 웹 애플리케이션입니다.

# 바닐라메타를 사용해야 하는 이유

바닐라메타는 최신 데이터 탐색적 분석 및 데이터 시각화 솔루션입니다. 비즈니스 인텔리전스 도구를 대체하거나 보강할 수 있으며, 다양한 데이터 소스와 잘 통합 됩니다.

## 바닐라메타의 기능

- 코딩없이 차트 위젯 제작.
- 50개 이상의 차트 지원
- 사용자 맞춤형 대시보드 편집 및 공유
- 대시보드 템플릿 디자인 추천
- 고급 SQL 쿼리 편집기 및 데이터 미리보기 제공
- 다양한 SQL 데이터베이스에 대한 즉시 지원

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



