# Use Case: 손잡이로 블록 배치 변경

## Overview

**Use Case ID:** UC-010
**Use Case Name:** 손잡이로 블록 배치 변경
**Primary Actor:** 운영 담당자
**Goal:** 블록 손잡이와 키보드로 선택 화면 폭의 배치를 수정한다.
**Trigger:** 담당자가 블록 손잡이를 끌거나 오른쪽 아래 모서리를 조절한다.
**Status:** Draft
**Requirements:** [FR-009, FR-010](../requirements.md)

## Preconditions

- 서버 미리보기를 완료하고 편집 화면 폭을 선택했다.

## Main Success Scenario

1. 담당자가 블록 손잡이를 끌거나 오른쪽 아래 모서리를 조절한다.
2. 선택 폭의 x/y/w/h만 변경되고 다른 폭과 계산식·지표는 유지된다.
3. 이동 종료 한 번을 undo 단계 하나로 기록한다.
4. 담당자가 변경 결과 미리보기를 성공시킨다.
5. UC-009 서버 계약에 따라 명시 저장하고 재조회한다.

## Alternative Flows

### A1: 검증 실패 또는 실행 제한

**Trigger:** 처리 조건을 충족하지 못한다 (step 1).
**Flow:**

1. 겹침과 열 범위 초과는 거절한다. AI·미리보기·저장 요청 중 손잡이는 비활성화된다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 선택 폭의 배치를 저장하며 다른 폭·계산 정의를 유지한다.

### Failure Postconditions

- 겹침/열 범위 초과를 반영하지 않고 자동 저장하지 않는다.

## Business Rules

### BR-001: 기존 편집 경계 보존

방향키는 이동, Shift+방향키는 크기 조절이다. 배치 변경 중 결과는 직전 계산 값으로 유지하며 안내한다. 미리보기 재확인 전 저장 버튼은 비활성화된다. 내용/제목/블록 개수 변경은 이전 결과를 숨긴다. 배치만 undo/redo하면 결과를 유지하지만 미리보기 재확인은 필요하다. 자동 저장이나 쿼리 자동 실행은 없다.

## Execution Evidence

[검증 기록/Ego 포인터·터치 후속](../testing/pointer-block-layout.md). 실제 마우스/Chromium 터치 에뮬레이션 선택 검증과 실제 휴대폰/멀티터치 미검증을 구분한다.

Draft는 명세 검토 상태다. 기존 구현/선택 검증 결과를 취소하거나 전체 제품 수용으로 승격하지 않는다.
