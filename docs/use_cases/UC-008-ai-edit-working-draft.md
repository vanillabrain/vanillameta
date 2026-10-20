# Use Case: 미저장 초안의 선택 블록 AI 수정

## Overview

**Use Case ID:** UC-008
**Use Case Name:** 미저장 초안의 선택 블록 AI 수정
**Primary Actor:** 운영 담당자
**Goal:** 직접 편집한 미저장 초안에서 선택 블록만 AI로 수정한다.
**Trigger:** 담당자가 같은 편집 화면에서 선택 블록 변경을 질문한다.
**Status:** Draft
**Requirements:** [FR-009](../requirements.md)

## Preconditions

- 소유 분석이 차트·배치 편집 화면에 열려 있다.

## Main Success Scenario

1. 직접 제목·순서·크기를 편집하거나 블록을 추가/복제한다.
2. 같은 화면에서 블록을 선택하고 변경을 질문한다.
3. 서버가 현재 revision과 전체 초안을 검증하고 선택 블록만 AI로 변경한다.
4. 사용자가 전체 미리보기를 확인한다. 다른 블록과 미저장 제목·배치는 유지된다.
5. AI 변경을 되돌리거나 다시 실행할 수 있다. 복원 후 미리보기를 다시 요청한다.
6. 명시 저장 후 재조회에서 계산과 논리 ID·배치를 확인한다.

## Alternative Flows

### A1: 검증 실패 또는 실행 제한

**Trigger:** 처리 조건을 충족하지 못한다 (step 3).
**Flow:**

1. 잘못된 소스·계산식·블록 식별자와 오래된 버전은 거절한다. 취소/오류 후 초안은 유지하고 늦게 도착한 결과를 적용하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 선택 블록 변경과 비대상 블록·미저장 제목·배치를 보존하며 명시 저장 후 재조회한다.

### Failure Postconditions

- 취소/오류 후 초안은 유지하며 늦게 도착한 결과는 적용하지 않는다.

## Business Rules

### BR-001: 기존 편집 경계 보존

초안 종류는 내부 계약이며 사용자에게 모드 선택을 요구하지 않는다. 이 흐름의 계산식 변경은 해당 분석의 snapshot이며 중앙 저장 지표의 수정·일괄 반영은 UC-003/004로 분리한다.

## Execution Evidence

[계획](../plans/UC-008.md), [최초 실행 기록](../testing/working-draft-ai.md), [연속 편집/Ego 후속](../testing/block-editor-continuity.md). 최초 단위·실LLM/API PASS·UI BLOCKED와 후속 실제 선택 검증을 구분한다.

Draft는 명세 검토 상태다. 기존 구현/선택 검증 결과를 취소하거나 전체 제품 수용으로 승격하지 않는다.
