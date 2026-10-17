# UC-014: Execute Explicit Save Request

## Overview

**Use Case ID:** UC-014
**Use Case Name:** Execute Explicit Save Request
**Primary Actor:** 운영 담당자
**Goal:** 질문에 명시한 현재 초안 저장 또는 선택 블록 수정 후 저장을 실행한다.
**Trigger:** 기본 자동 질문창에 저장을 명시한다.
**Status:** Draft
**Requirements:** [FR-009, FR-010, NFR-001](../requirements.md)

## Preconditions

- 소유 분석·현재 편집 초안·expectedRevision이 있다.
- 기존 미리보기·원자 저장·충돌 검사가 준비되어 있다.

## Main Success Scenario

1. 담당자가 “현재 편집 내용을 저장해 줘” 또는 선택 블록의 한 가지 변경과 저장을 요청한다.
2. 서버가 권한·revision·초안을 먼저 검증하고 질문만 LLM에 전달한다.
3. 엄격한 분류 결과가 명시 저장 여부와 내용/배치/저장 목적을 반환한다. 변경 요청만 후속 생성기에 전달한다.
4. 서버가 필요 시 선택 블록만 수정하고 전체 초안을 재컴파일·미리보기한다. 여기까지 DB 쓰기는 없다.
5. 화면이 검증된 미리보기를 표시하고 같은 요청의 결과 초안으로 기존 저장 API를 호출한다.
6. 저장 시 revision을 다시 검사한다. 성공 시 저장 분석으로 이동하고 새로고침 후 결과가 유지된다.

## Alternative Flows

### A1: No save or ambiguous request

**Trigger:** 변경만 요청하거나 저장이 부정·조건부·질문형이거나 혼합/공유/삭제 등 미지원 (step 3).
**Flow:**

1. 변경만 요청하면 기존 미리보기로 끝난다. 불명확·미지원은 고정 안내를 표시하고 저장하지 않는다.
2. Use case ends.

### A2: Save failure or revision conflict

**Trigger:** 저장 통신 실패 또는409 (step 5 or 6).
**Flow:**

1. 수정된 초안·미리보기·이력을 보존하고 저장 실패와 복구 방법을 표시한다. 자동 재시도하지 않는다.409는 기존 최신 내용 복구를 따른다.
2. Use case ends.

### A3: Cancellation

**Trigger:** 생성/미리보기 중 취소 또는 화면 이탈 (step 3 or 4).
**Flow:**

1. 같은 signal/세션 토큰으로 늦은 응답과 후속 저장을 막는다. 저장 전송 이후에는 취소 버튼을 제공하지 않는다. 통신 중단이 이미 수행된 서버 저장을 되돌린다고 약속하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 저장된 정의·블록ID·배치가 미리보기 초안과 같고 비대상은 유지된다.

### Failure Postconditions

- 미리보기 실패/취소에는 저장 요청0회다. 저장 실패 시 초안이 남고 성공으로 안내하지 않는다.

## Business Rules

### BR-014-01: Explicit save intent

엄격 분류는 intent(content/layout/save/clarify), saveRequested(boolean), editPrompt(string|null)의 정확한3키다. save는 true/null, clarify는 false/null, content/layout은 비어 있지 않은 변경 질문이다. 원문이 저장을 명시하지 않으면 저장을 추측하지 않는다.

### BR-014-02: Validation before write

분류/생성은 저장 권한이 아니다. 모든 저장은 기존 소유권·compiler·expectedRevision·atomic 저장을 거친다. 저장만 요청하면 선택 블록이 필요 없다. 변경 요청은 기존 selectedKey 검사로 대상을 한정한다.

### BR-014-03: Frozen result and one dispatch

화면은 현재 React state의 이전 값이 아닌 검증한 결과 items로 저장 body를 만든다. 미리보기 이후 저장이 끝날 때까지 다른 편집/중복 제출을 막는다. 변경만 요청/clarify/취소/미리보기 실패에는 저장하지 않는다.

### BR-014-04: Recovery boundary

저장 실패는 변경 성공과 구분하고 초안을 보존한다. 저장 전송 후 결과 불명확은 자동 재시도하지 않는다. 서버 저장 취소·exactly-once 영수증은 이번 범위가 아니다.

## Related Use Cases

[UC-015](UC-015-prompt-target.md)는 자동 내용/배치의 대상을 번호·정확 제목 또는 후보 확인으로 정한다. UC014의 명시 저장·미리보기·복구 계약은 유지하며 사전 선택만 필수로 요구하지 않는다.

UC-016 확장: 서로 다른2~6개 블록을 명시한 내용/배치 작업은 [다중 블록 계약](../use_cases/UC-016-batch-block-edit.md)으로 처리한다. 기존 단일 의도 strict3키/save/clarify·후보 확인은 유지하고 batch만 별도strict actions 스키마를 사용한다. 다중 블록을 clarify로 제한한 위 설명은 UC016 이전 범위이며, 같은 블록의 내용+배치 혼합·모호한 요청은 여전히clarify다.

UC-017 후속: 저장409와결과불명확은 [편집 복구 계약](UC-017-editor-recovery.md)의상태확인/초안보존·제한병합을사용한다. 저장실패후즉시재전송하지않고서버저장상태부터확인한다. 기존초안을버리는재로드는명시선택으로남긴다.
