# UC-033: Clarify a Studio Creation in the Same Conversation

## Overview

**Use Case ID:** UC-033
**Use Case Name:** Clarify a Studio Creation in the Same Conversation
**Primary Actor:** 분석 소유자
**Goal:** 새 탭 이동 없이 같은 대화에서 환불률 분모에 답하고 미리보기·명시 저장을 이어간다.
**Trigger:** 대화의 새 대시보드 제안에 분모 확인이 필요하다.
**Status:** Draft
**Requirements:** [FR-008, FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 소유 실행의 원 제안과 소스 접근권한이 유효하다.
- 원 제안은 미리보기 없이 환불률 분모 선택을 요청한다.

## Main Success Scenario

1. 소유자가 대화에서 환불률 새 대시보드를 요청한다.
2. 시스템은 같은 대화 카드에 분모 선택과 확인 버튼을 표시한다.
3. 소유자가 금액 또는 주문 건수 기준을 선택하고 미리보기를 요청한다.
4. 서버는 원 실행·제안·소스 기준과 답변 요청 ID를 확인하고 원 질문으로 계산을 제안한다.
5. 시스템은 최신 실행의 생성안만 교체하고 같은 카드에 전체 미리보기를 표시한다. 현재 편집 초안과 원본은 유지한다.
6. 소유자가 결과를 확인하고 비공개 저장을 명시한다.
7. 시스템은 최신 생성안만 저장하고 완료 링크와 새로고침 후 같은 저장 결과를 표시한다.

## Alternative Flows

### A1: Failed or uncertain answer

**Trigger:** 답변 요청 실패 또는 응답 유실 (step 4).
**Flow:**

1. 질문과 선택을 유지한다. 결과가 불명확하면 선택 변경을 잠그고 같은 요청으로 재확인한다.
2. Use case continues at step 3.

### A2: Stale binding or access denied

**Trigger:** 제안 만료·기준 변경·다른 소유자·저장 완료 (step 4).
**Flow:**

1. 최신 제안과 원본을 변경하지 않고 명확한 오류를 표시한다. 자동 재생성·저장·게시하지 않는다.
2. Use case ends.

### A3: Required fields absent

**Trigger:** 실제 필수 열이 없어 분모 선택만으로 해결할 수 없다 (step 5).
**Flow:**

1. 필수 열 안내를 유지하고 [UC034](UC-034-inline-source-recovery.md)의 같은 카드 소스 교체 경로를 제공한다. 결과를 다른 지표로 대체하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 같은 대화에서 미리보기와 명시 저장을 완료하며 원본 초안·계산·배치가 보존된다.

### Failure Postconditions

- 이전 질문·선택을 유지하며 실패한 답변이 저장 동의가 되지 않는다.

## Business Rules

### BR-033-01: Bound answer

원 질문/소스는 권한 확인한 서버 제안 캐시에서 읽는다. 클라이언트는 질문·SQL을 새로 지정하지 않고 분모·요청ID·이전 제안/기준만 보낸다.

### BR-033-02: No automatic save

답변은 미리보기와 실행 바인딩만 갱신한다. 대시보드/지표/게시 생성0이며 기존 영수증 기반 명시 저장을 재사용한다.

### BR-033-03: Replay and concurrency

같은 요청/본문의 동시 답변은 한 작업을 공유하고 완료 영수증으로 재확인한다. 다른 답변·낡은 바인딩·늦은 응답은 최신 제안을 덮지 않는다. 만료/재시작 뒤 캐시 자동 복원은 보장하지 않는다.
