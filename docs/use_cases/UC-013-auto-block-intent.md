# UC-013: Route A Selected Block Question

## Overview

**Use Case ID:** UC-013
**Use Case Name:** Route A Selected Block Question
**Primary Actor:** 운영 담당자
**Goal:** 목적 모드를 고르지 않고 선택 블록의 내용 또는 배치를 질문으로 수정한다.
**Trigger:** 선택 블록에서 질문을 제출한다.
**Status:** Draft
**Requirements:** [FR-009, FR-010, NFR-001](../requirements.md)

## Preconditions

- 소유 분석의 공통 편집 초안·selectedKey·expectedRevision이 있다.
- 지정 LLM과 기존 compiler/내용·배치 AI 및 미리보기 경계가 준비되어 있다.

## Main Success Scenario

1. 담당자가 블록을 선택하고 질문한다. 기본 목적은 자동이며 수동 목적은 접힌 고급 설정이다.
2. 서버가 소유권·revision·선택 블록·초안을 검증한다.
3. LLM이 질문을 content 또는 layout으로 분류한다. 분류에는 SQL/원본 행/제목을 제공하지 않는다.
4. 서버가 기존 내용 또는 선택 폭의 배치 경로를 실행하고 compiler·미리보기를 검증한다.
5. 화면이 서버의 실제 적용 목적을 표시하고 같은 이력에 변경을 반영한다.
6. 담당자가 기존 저장 버튼으로 저장하고 새로고침한다.

## Alternative Flows

### A1: Ambiguous or mixed intent

**Trigger:** 내용과 배치가 섞이거나 지원 범위 밖의 동작을 요청한다 (step 3).
**Flow:**

1. 내용/배치 중 한 작업을 구체화하도록 고정 질문을 표시하고 초안·이력·마지막 결과를 보존한다. 저장·게시를 추측 실행하지 않는다. 미리보기 재확인 전 저장은 차단한다.

### A2: Invalid response or cancellation

**Trigger:** 분류 JSON 불일치, 생성 실패 또는 취소 (step 3 or 4).
**Flow:**

1. 실행 중단·질문/초안 보존. 취소 후 늦은 응답을 적용하지 않는다. 다른 모델로 대체하지 않는다.

### A3: Revision conflict

**Trigger:** 원본 버전이 바뀐다 (step 2 or 6).
**Flow:**

1. 기존409 복구 계약을 유지하며 새 초안으로 몰래 덮어쓰지 않는다.

## Postconditions

### Success Postconditions

- 성공한 내용/배치 변경만 공통 이력에 추가된다. 비대상 정의·배치는 유지된다.
- 판별과 미리보기는 쓰기 없이 수행된다. 저장 버튼은 기존 revision 계약을 따른다.

### Failure Postconditions

- 실패/모호 응답은 초안과 원본을 변경하지 않는다.

## Business Rules

### BR-013-01: Rule 1

자동 분류는 content/layout/clarify의 엄격한 단일 결과다. 추가 필드·잘못된 값은 거절한다.

### BR-013-02: Rule 2

권한·revision·선택 검사가 분류보다 먼저다. LLM의 결과로 권한·선택 대상·폭을 바꾸지 않는다.

### BR-013-03: Rule 3

layout은 선택 폭 geometry만, content는 기존 내용 AI 경계를 따른다. 서버 응답의 실제 목적을 프런트가 검증한다.

### BR-013-04: Rule 4

모호/복합 요청은 쓰기·초안 변경·이력 증가 없이 안내한다. 자동 저장·게시·복제·다중 블록은 이번 범위가 아니다.

### BR-013-05: Rule 5

분류와 후속 생성은 같은 AbortSignal/FE session token을 사용한다. 기존 명시 content/layout API는 호환한다.
