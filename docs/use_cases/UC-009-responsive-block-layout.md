# Use Case: 화면 폭별 블록 배치

## Overview

**Use Case ID:** UC-009
**Use Case Name:** 화면 폭별 블록 배치
**Primary Actor:** 운영 담당자
**Goal:** 선택한 화면 폭의 블록 위치와 크기를 편집하고 저장·재조회한다.
**Trigger:** 담당자가 소유 분석에서 편집할 화면 폭을 선택한다.
**Status:** Draft
**Requirements:** [FR-009, FR-010](../requirements.md)

## Preconditions

- 소유 분석의 차트·배치 편집이 열려 있다.

## Main Success Scenario

1. 모바일4/태블릿8/데스크톱12열 중 편집 대상을 선택한다.
2. 블록 설정에서 위치·너비·높이를 지정한다. 다른 화면 폭의 좌표는 유지된다.
3. 공통 undo/redo로 배치를 복원하고 다시 미리보기한다.
4. 서버가 정수·범위·겹침을 검증하고 명시 저장한다.
5. 재조회 및 분석 읽기 화면에서 해당 폭의 좌표를 사용한다.
6. AI 내용 수정·블록 복제 후에도 비대상 세 배치가 보존된다.

## Alternative Flows

### A1: 검증 실패 또는 실행 제한

**Trigger:** 처리 조건을 충족하지 못한다 (step 4).
**Flow:**

1. 좌표 오류/버전 경합은 전체 저장을 거절한다. 기존 소유권·계산식·블록 식별자 경계를 유지한다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 선택 폭의 배치가 서버 blockId로 저장되고 다른 폭 좌표는 유지된다. 조회만으로 저장하지 않는다.

### Failure Postconditions

- 좌표 오류/버전 경합이면 전체 저장을 거절하며 기존 저장본은 유지한다.

## Business Rules

### BR-001: 기존 편집 경계 보존

좌표는0부터, y≤1000/h≤50이며 x+w는 해당 열 수 이하이다. 분석 JSON에 서버 blockId로 기록한다. 신규 블록은 기존 점유 영역 아래에 기본 배치한다. AI 일반 저장의 클라이언트 배치 필드는 쓰기 권한이 아니다.

## Execution Evidence

[계획](../plans/UC-009.md), [최초 증빙](../testing/responsive-block-layout.md). 이 UC는 좌표 컨트롤과 소유 분석의 반응형 읽기다. 최초 UI BLOCKED 이후 [UC010/Ego 후속](../testing/pointer-block-layout.md)에서 실제 선택 배치를 검증했다. 포인터 드래그·AI 배치·게시/공유 화면은 각각의 후속 계약을 따른다. Studio의 열 수/배치 계약으로 이 분석 흐름을 대체하지 않는다.

Draft는 명세 검토 상태다. 기존 구현/선택 검증 결과를 취소하거나 전체 제품 수용으로 승격하지 않는다.
