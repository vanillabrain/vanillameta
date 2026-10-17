# Use Case: Manage Analysis Catalog

## Overview

**Use Case ID:** UC-050
**Use Case Name:** Manage Analysis Catalog
**Primary Actor:** 데이터 관리자
**Goal:** 분석 데이터와 변수의 업무 의미를 등록·유지한다.
**Trigger:** 데이터 등록 또는 정의 변경을 요청한다.
**Status:** Draft
**Requirements:** [FR-014, FR-015, NFR-005, NFR-007](../requirements.md)

## Preconditions

- 요청자가 같은 조직의 유효한 업무 계정이며 대상의 현재 권한을 확인할 수 있다.
- 신규 목표 명세이며 구현·실제 실행 검증은 NOT_RUN이다.

## Main Success Scenario

1. 관리자가 현재 권한으로 원천의 허용 구조를 조회한다.
2. 표시명·설명·열 유형/날짜 형식/단위·분류 연결을 입력한다.
3. 서버가 관리자 권한·실제 스키마·이름 중복·필수 옵션을 검증한다.
4. 현재 정의와 변경 영향을 보여주고 명시 저장한다.
5. 새 정의/버전·변경 이벤트를 기록하며 기존 분석은 영향 확인 없이 덮어쓰지 않는다.

## Alternative Flows

### A1: Rejected or incomplete operation

**Trigger:** 조회 권한 부족·중복·유형 불일치·사용 중 삭제 요청 (step 2 or 3).
**Flow:**

1. 사유와 영향을 표시하고 등록/변경/삭제를 반영하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 분석 데이터와 변수의 업무 의미를 등록·유지한다. 명시한 범위의 결과/이력이 제공된다.

### Failure Postconditions

- 비대상 자원·기존 초안/원본·허용되지 않은 권한을 변경하지 않는다. 작업/알림의 별도 성공 여부는 구분한다.

## Business Rules

### BR-050-01: Scoped business operation

목록과 실제 스키마/권한을 대조한다. 변수 수·허용 범위·활성 상태를 관리자가 확인하며 원본 데이터 값은 불필요하게 복사하지 않는다.

### BR-050-02: Preservation and evidence

날짜 형식·열명/표시명·단위를 구별하고 스키마 변경은 영향 확인을 요구한다. 카탈로그는 승인 원천이며 업로드 파일 전체를 자동 공식 등록하지 않는다.

## Source Evidence

[VM 목표 설계](../architecture/enterprise-analysis.md)·[TC050](../test_cases/TC-050-enterprise-analysis.md)를 따른다. 신규 요구이며 구현/실행 검증은 미완료다.
