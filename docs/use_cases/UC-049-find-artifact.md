# Use Case: Find My Artifact

## Overview

**Use Case ID:** UC-049
**Use Case Name:** Find My Artifact
**Primary Actor:** 운영 담당자
**Goal:** 허용된 저장 산출물을 검색·분류·정렬해 다시 연다.
**Trigger:** 담당자가 대시보드 목록에 진입한다.
**Status:** Draft
**Requirements:** [FR-013, NFR-003](../requirements.md)

## Preconditions

- 로그인 사용자의 목록을 기존 서버 권한으로 조회한다.

## Main Success Scenario

1. 화면이 기존 API의 허용 목록을 받는다.
2. 담당자가 제목 검색, 전체/분석/일반 유형, 최근 수정/이름 정렬을 선택한다.
3. 화면은 조건을 함께 적용하고 첫 페이지부터 결과와 건수를 표시한다.
4. 담당자가 기존 조회 또는 분석 Studio 링크로 저장본을 연다.

## Alternative Flows

### A1: No matching result

**Trigger:** 조건에 맞는 항목이 없다 (step 3).
**Flow:**

1. 검색 결과 없음과 초기화 버튼을 제공한다. 초기화는 제목/유형/정렬 기본값을 복원한다.
2. Use case continues at step 2.

### A2: Empty or failed list

**Trigger:** 원래 목록이 비어 있거나 조회가 실패했다 (step 1).
**Flow:**

1. 기존 빈 목록/조회 오류 안내를 유지하며 필터 결과 없음으로 오인하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 선택 조건으로 기존 저장본을 찾는다. 추가 쓰기/게시/권한 확대는 없다.

### Failure Postconditions

- 목록을 임의 생성하거나 원본 정의·배치·삭제 상태를 변경하지 않는다.

## Business Rules

### BR-049-01: Authorized discovery

기존 서버 응답 범위 안에서만 검색한다. 클라이언트 필터는 접근 권한을 부여하지 않는다. 부서/전사 공유는 별도 미구현 범위다.

### BR-049-02: Consistent navigation

제목은 유니코드 정규화·앞뒤 공백 제거·대소문자 무시 부분 검색을 사용한다. 유형과 AND 조건이다. 정렬은 원본 응답을 변경하지 않는다. 조건/결과 건수 변경 시 첫 페이지로 복귀한다. 분석 여부는 기존 analysisDefinition/Studio 링크 계약을 따른다.

### BR-049-03: Simple responsive controls

공통 입력/선택36px·작은 버튼32px와 반응형 줄바꿈을 사용한다. 제목/행 조회·이름 수정·삭제·Studio 진입을 유지한다. 검색 조건은 이 화면의 임시 상태다.
