# Use Case: 블록 복제와 편집 되돌리기

## Overview

**Use Case ID:** UC-007
**Use Case Name:** 블록 복제와 편집 되돌리기
**Primary Actor:** 운영 담당자
**Goal:** 소유 분석의 블록을 복제하고 편집 이력을 되돌리거나 다시 실행한다.
**Trigger:** 담당자가 차트·배치 편집에서 블록 복제를 선택한다.
**Status:** Draft
**Requirements:** [FR-009](../requirements.md)

## Preconditions

- 소유한 분석이 열려 있고 편집 가능한 기존 블록이 있다.

## Main Success Scenario

1. 차트·배치 편집에서 기존 블록을 복제한다.
2. 복제본이 새 ID로 표시된다. 원본 계산·표시·ID는 유지된다.
3. 모바일에서도 위/아래 이동과 크기 선택으로 편집한다.
4. 삭제/순서/크기/설정/제목 변경을 되돌리거나 다시 실행한다.
5. 변경 결과를 다시 미리보기한 뒤 저장하고 재조회한다.

## Alternative Flows

### A1: 검증 실패 또는 실행 제한

**Trigger:** 처리 조건을 충족하지 못한다 (step 5).
**Flow:**

1. 충돌 시 초안과 이력은 유지하되 저장은 최신 버전을 요구한다. 복원 후 이전 미리보기로 저장하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 복제본은 새 ID를 가지며 원본 계산·표시·ID를 유지한다. 명시 저장 결과를 재조회할 수 있다.

### Failure Postconditions

- 충돌 시 초안과 이력은 유지하며 최신 버전 없는 저장은 거절한다.

## Business Rules

### BR-001: 기존 편집 경계 보존

1~6개 블록, 최대50단계 로컬 편집 이력. undo는 서버 저장을 취소하지 않는다. 명시 재조회/분석 전환은 이력을 버린다. 기존 SQL 복제의 copyOf는 현재 소유 분석의 저장 블록만 참조하며 신규 key와 달라야 한다.

## Execution Evidence

[실행 계획](../plans/UC-007.md), [최초 실행 기록](../testing/block-editor-history.md), [Ego 연속 편집 후속](../testing/block-editor-continuity.md). 최초 UI BLOCKED와 후속 선택 검증은 구분한다. 순서·크기 편집과 breakpoint별 자유 위치 저장을 구별한다.

Draft는 명세 검토 상태다. 기존 구현/선택 검증 결과를 취소하거나 전체 제품 수용으로 승격하지 않는다.
