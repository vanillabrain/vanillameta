# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

VanillaMeta는 기업용 비즈니스 인텔리전스(BI) 웹 애플리케이션으로, 사용자가 코드 작성 없이 다양한 데이터베이스에 연결하여 시각화를 생성하고 대시보드를 구축할 수 있습니다.

## 개발 가이드라인

- Backend 개발 TODO 완료시 마지막 단계는 항상 아래의 프로세스가 추가로 있어야 한다
  1. yarn build:dev 를 실행하고 발생하는 오류를 모두 수정
  2. yarn start:local 을 실행하고 발생하는 오류를 모두 수정
- 변경작업 시작 전에 항상 develop-refactor- 로 시작하는 working 브랜치를 만들고 작업
- 변경작업이 끝나고 pr 할 때는 develop-refactor 으로 할것
- develop 브랜치 커밋 전 다음 순서대로 항상 수행하고 커밋할것. 
  1. backend 의 yarn build:dev 를 실행하고 오류 수정
  2. backend 의 yarn start:local 을 실행하고 오류수정

## 프로젝트 구조

```
vanillameta/
├── backend-api/                    # NestJS 백엔드 API (AWS Lambda)
├── frontend-web/                   # React 프론트엔드 웹 애플리케이션
├── landing-page/                   # 정적 랜딩 페이지
├── backend-api-libs-lambda-layer/  # Lambda 레이어 (의존성 관리)
├── design/                         # 디자인 리소스 및 이미지
└── docs/                          # 프로젝트 문서 및 화면 설계서
```

[Rest of the file content remains the same as in the original file]