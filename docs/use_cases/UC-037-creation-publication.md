# UC-037: Prepare Publication of a Saved Creation in Conversation

## Overview

**Use Case ID:** UC-037
**Use Case Name:** Prepare Publication of a Saved Creation in Conversation
**Primary Actor:** 분석 소유자
**Goal:** 새 생성안 저장 후 같은 입력창에서 새 대시보드 게시 준비·공개 범위 확인·게시를 이어간다.
**Trigger:** 최근 성공 생성 실행에 저장 영수증이 있다.
**Status:** Draft
**Requirements:** [FR-008, FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 로그인한 소유자가 생성안 저장을 완료했다.

## Main Success Scenario

1. 입력창은 저장된 새 대시보드 번호를 대상으로 유지한다.
2. 사용자가 “게시 준비해 줘”라고 요청한다.
3. 시스템은 저장 영수증의 새 ID·revision으로 기존 게시·공유 창을 연다. 아직 쓰기는 없다.
4. 사용자가 공개 범위와 복제 허용 여부를 확인하고 게시하기를 누른다.
5. 서버가 소유권·저장 버전을 검사해 고정 집계 게시본과 링크를 만든다.
6. 사용자가 링크/새로고침으로 게시본을 확인한다. 원본 편집기는 유지된다.

## Alternative Flows

### A1: Unsupported request

**Trigger:** 부정·혼합·모호한 게시 또는 수정 요청 (step 2).
**Flow:**

1. 질문을 보존하고 지원하는 게시 준비 문구와 새 대시보드 편집 링크를 안내한다. 원본에 전달하거나 공개하지 않는다.
2. Use case continues at step 2.

### A2: Stale or inaccessible saved copy

**Trigger:** 저장 버전 변경·접근 거절·조회 실패 (step 3 or 5).
**Flow:**

1. 기존 게시 오류·동일 요청 재시도 정책을 적용한다. 최신본으로 자동 게시하지 않는다. 새 대시보드를 열어 최신 내용을 확인하도록 안내한다.
2. Use case ends.

### A3: Return to original

**Trigger:** 사용자가 원본 편집 복귀를 선택 (step 1).
**Flow:**

1. 질문은 보존하고 명시적으로 원본 대상으로 돌아간다. 자동 전송하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 게시 대상은 저장한 새 대시보드이며 원본 정의·배치·게시에는 변경이 없다.

### Failure Postconditions

- 자동 공개·자동 재게시·원본으로의 요청 전환이 없다.

## Business Rules

### BR-037-01: Saved target

UC036의 저장 후 원본 자동 복귀를 대체한다. 최신 성공 생성 실행의 저장 ID·revision을 문맥/입력창/게시 창에 표시한다. 새 실행이나 명시 복귀로만 대상이 바뀐다. reload는 영수증을 읽되 창/쓰기를 자동 재실행하지 않는다.

### BR-037-02: Explicit preparation and publication

지원 문구는 “게시 준비해 줘”, “저장한 대시보드 게시 준비해 줘”, “공유 설정 열어 줘”, “prepare publication”의 단독 긍정 요청이다. 준비 요청은 기존 게시 창만 열고 실제 공개는 그 창의 범위 선택과 버튼에 맡긴다. 임의 자연어/생성안 저장+공개 혼합 명령은 이번 범위 밖이다.

### BR-037-03: Reuse owner and version gates

기존 StudioPublish의 소유 조회·CAS·requestId 재시도·중지 동작을 재사용한다. original transport/onApply/onSaved를 호출하지 않으며 기본 공개 범위는 기존 정책(신규 private)을 유지한다. 별도 서버 API·토큰·엔티티를 추가하지 않는다.
