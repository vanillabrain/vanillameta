# UC-015: Resolve A Block From A Question

## Overview

**Use Case ID:** UC-015
**Use Case Name:** Resolve A Block From A Question
**Primary Actor:** 운영 담당자
**Goal:** 블록을 미리 선택하지 않고 번호·정확한 제목으로 한 블록을 수정하고 모호한 대상은 후보로 해소한다.
**Trigger:** 자동 질문에서 수정 대상과 변경을 요청한다.
**Status:** Draft
**Requirements:** [FR-009, FR-010, NFR-001](../requirements.md)

## Preconditions

- 소유 분석·현재 순서의 공통 초안·revision과 기존UC014 저장 경계가 있다.

## Main Success Scenario

1. 담당자가 “2번 차트의 소수 자릿수를 바꾸고 저장해 줘” 또는 정확한 제목의 블록을 질문한다.
2. 서버가 권한·revision·전체 초안과 요청 선택 키를 먼저 검증한다.
3. 기존 분류가 내용/배치로 판별하면 서버가 원래 질문의 명시 대상(번호 또는 제목)을 현재 items의 안정 key로 결정한다.
4. 명확한 대상만 기존 선택 블록 생성·재컴파일·미리보기를 실행한다. 화면은 실제 대상과 결과를 표시한다.
5. 명시 저장이 있으면 UC014대로 새 결과를 저장하고 reload 후 비대상을 보존한다.

## Alternative Flows

### A1: Missing or ambiguous target

**Trigger:** 대상이 없거나 같은 제목이 여러 개거나 잘못된 번호/서로 다른 참조가 나온다 (step 3).
**Flow:**

1. 후보의 번호·제목을 표시하고 질문·초안·이력을 보존한다. 생성·미리보기·저장은 실행하지 않는다.
2. 담당자가 후보를 선택하고 같은 질문을 다시 실행한다. 선택 확인은 그 질문/현재 후보에만 유효하다.

### A2: Explicit reference overrides context

**Trigger:** 이전 선택 블록과 다른 정확한 번호/제목을 명시한다 (step 3).
**Flow:**

1. 명시한 대상이 우선이다. 잘못된/모호한 명시 참조는 이전 선택으로 조용히 대체하지 않는다.

### A3: Invalid key, cancellation or conflict

**Trigger:** 선택/확인 key가 유효하지 않거나 취소·revision409 (step 2 or 4).
**Flow:**

1. 기존 오류·취소·복구를 유지하고 다른 블록이나 늦은 결과를 적용하지 않는다.

## Postconditions

### Success Postconditions

- 현재 items에서 유일하게 확인한 key만 수정한다. 비대상·다른 폭·저장 지표는 유지한다.

### Failure Postconditions

- 후보 안내만으로 초안·이력·DB를 바꾸지 않는다. 미지원 다중 블록 작업을 단일 대상으로 축소 실행하지 않는다.

## Business Rules

### BR-015-01: Bounded deterministic reference

대상 판별은 서버의 현재 items(key/title/순서)만 사용한다. 숫자형 `2번 차트/블록`, `2번째 차트/블록`과 정확한 제목 뒤 `블록/차트/의`, 따옴표로 감싼 제목 뒤 `블록/차트`를 지원한다. 자유 유사도·LLM 대상 key 선택·한글 서수·대명사 전체 지원은 이번 범위가 아니다.

### BR-015-02: Selection precedence and ambiguity

명시 참조가 있으면 이전 선택보다 우선한다. 참조 없는 질문만 기존 selectedKey를 문맥으로 사용한다. 같은 제목/여러 참조/알 수 없는 번호는 후보 안내이며 잘못된 참조를 기존 선택으로 숨기지 않는다. 변경할 새 제목의 따옴표만으로 대상을 선택하지 않는다.

### BR-015-03: Scoped confirmation

모호 후보 확인은 targetChoiceKey로 보내고 서버가 같은 질문에서 재계산한 후보 집합에 속하는지 검사한다. 후보가 없는 명확한 대상은 다른 확인 키로 덮어쓰지 않는다. 화면은 질문 변경·직접 대상 선택·초안 변경/undo 시 후보와 확인을 해제한다. 후보는 최대 현재6개다.

### BR-015-04: Existing execution boundary

compileEditor·분류·대상 확인→기존 생성/preview→선택적 저장 순서를 따른다. 모호 대상은 saveRequested=false와 후보만 반환한다. save-only/수동content/layout은UC014대로 유지한다. 실제 반환 targetKey를 FE가 현재items에 대조하고 해당 key에만 결과를 병합한다.

UC-016 확장: 서로 다른2~6개 블록을 명시한 내용/배치 작업은 [다중 블록 계약](../use_cases/UC-016-batch-block-edit.md)으로 처리한다. 기존 단일 의도 strict3키/save/clarify·후보 확인은 유지하고 batch만 별도strict actions 스키마를 사용한다. 다중 블록을 clarify로 제한한 위 설명은 UC016 이전 범위이며, 같은 블록의 내용+배치 혼합·모호한 요청은 여전히clarify다.
