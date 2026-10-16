# UC-035: Refine a Creation Preview in the Same Conversation

## Overview

**Use Case ID:** UC-035
**Use Case Name:** Refine a Creation Preview in the Same Conversation
**Primary Actor:** 분석 소유자
**Goal:** 같은 대화의 저장 전 생성안을 질문으로 수정하거나 블록을 추가하고 전체 미리보기 후 명시 저장한다.
**Trigger:** 소유자가 저장 전 생성 미리보기를 수정하려 한다.
**Status:** Draft
**Requirements:** [FR-008, FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 소유 실행의 저장 전 생성안에 완성된 미리보기가 있고 소스 권한·기준이 유효하다.

## Main Success Scenario

1. 소유자가 같은 카드의 생성안 수정을 펼친다.
2. 소유자가 수정할 블록 또는 새 블록 추가를 선택하고 질문을 입력한다.
3. 서버는 실행·원 제안·소스 기준·질문 요청 ID를 확인하고 기존 생성기로 대상만 수정한다.
4. 시스템은 같은 카드에 수정된 전체 미리보기를 표시한다. 비대상 블록·대시보드 제목·원본 편집기는 유지한다.
5. 소유자가 전체 결과를 확인하고 비공개 저장을 명시한다.
6. 시스템은 최신 생성안만 저장하고 새로고침에도 같은 완료 결과를 제공한다.

## Alternative Flows

### A1: Failed or uncertain refinement

**Trigger:** 수정 실패·취소·응답 불명확 (step 3).
**Flow:**

1. 기존 미리보기·대상·질문을 보존한다. 결과 불명확 시 질문 변경·저장을 잠그고 같은 요청으로 재확인한다.
2. Use case continues at step 3.

### A2: Invalid or incomplete result

**Trigger:** 열 누락·추가 기준 필요·변경 없음·잘못된 응답 (step 3).
**Flow:**

1. 이전 미리보기를 유지하고 질문을 구체화하도록 안내한다. 실패 응답을 저장안으로 바꾸지 않는다.
2. Use case continues at step 2.

### A3: Stale proposal or access denied

**Trigger:** 만료·권한 없음·저장 완료·다른 바인딩·늦은 응답 (step 3).
**Flow:**

1. 최신 생성안·원본을 덮지 않고 오류를 표시한다. 자동 저장·게시하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 선택 블록 수정 또는 추가가 전체 미리보기와 명시 저장으로 이어진다.

### Failure Postconditions

- 이전 미리보기/질문/원본 편집기를 유지하고 자동 저장은 없다.

## Business Rules

### BR-035-01: Scoped refinement

기존 생성기의 parentProposalId/targetBlockIndex 계약을 재사용한다. 기존 블록 수정은 ID와 비대상 정의를 유지하고 추가는 최대6개다. 원본 편집기의 정의/배치는 바꾸지 않는다.

### BR-035-02: Bound replay

UC033/034와 같은 진행 단일화·마지막 완료 receipt·최신 바인딩 CAS로 수정/답변/저장 경합을 처리한다. 원 제안·소스 버전을 바꿔 보내는 요청과 늦은 결과는 거절한다. 실행에 수정 질문/계산식/미리보기를 추가 영속 저장하지 않는다.

### BR-035-03: Explicit save

수정/추가는 계산 미리보기만 만들고 대시보드·지표·게시를 생성하지 않는다. 미완성 결과는 바인딩을 교체하지 않는다. 명시 저장은 최신 생성안만 허용하며 전체 제품 수용은 별도다.
