# UC-034: Recover Missing Fields in the Same Conversation

## Overview

**Use Case ID:** UC-034
**Use Case Name:** Recover Missing Fields in the Same Conversation
**Primary Actor:** 분석 소유자
**Goal:** 필수 열 누락 시 같은 대화에서 다른 소스로 원 질문을 다시 미리보기하고 명시 저장한다.
**Trigger:** 새 대시보드 생성안이 필수 열 누락을 안내한다.
**Status:** Draft
**Requirements:** [FR-008, FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 로그인한 소유자의 미저장 생성 실행과 원 제안이 유효하다.
- 원 제안에 필수 열 누락 질문이 있다.

## Main Success Scenario

1. 소유자가 새 대시보드를 요청하고 시스템이 필수 열 누락을 안내한다.
2. 시스템은 같은 카드에서 접근 가능한 소스 목록을 제공한다.
3. 소유자가 다른 소스를 선택하고 원 질문의 미리보기를 명시 요청한다.
4. 서버는 실행·원 제안·기존 소스 기준·새 소스 권한을 확인하고 원 질문과 이미 답한 계산 기준을 적용한다.
5. 시스템은 같은 카드의 생성안과 소스 표시만 갱신한다. 시작한 편집기의 소스·초안·배치는 유지한다.
6. 소유자가 결과를 확인하고 비공개 저장을 명시한다.
7. 시스템은 새 소스로 새 대시보드를 저장하고 새로고침에도 같은 저장 결과를 제공한다.

## Alternative Flows

### A1: Source list or calculation fails

**Trigger:** 목록 조회 또는 미리보기 실패 (step 2 or 4).
**Flow:**

1. 기존 질문과 선택을 보존하고 재시도를 제공한다. 응답 불명확이면 같은 요청만 재확인한다.
2. Use case continues at step 2.

### A2: Missing fields remain

**Trigger:** 새 소스도 필요한 열이 없다 (step 5).
**Flow:**

1. 새 소스의 부족한 열을 안내하고 저장을 막는다. 이미 답한 분모는 임의 변경하지 않는다.
2. Use case continues at step 2.

### A3: Stale or unauthorized request

**Trigger:** 만료·권한 없음·낡은 제안·저장 완료·늦은 결과 (step 4).
**Flow:**

1. 최신 생성안과 원본을 유지하고 오류를 표시한다. 자동 저장·게시하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 원 질문의 새 소스 결과를 명시 저장하고 원본은 유지한다.

### Failure Postconditions

- 다른 지표 대체·자동 저장 없이 질문·선택을 유지한다.

## Business Rules

### BR-034-01: Source-bound recovery

원 질문과 이전 분모 답변은 서버 캐시에서 읽는다. 클라이언트는 원 제안/소스 기준·새 소스 ID·요청 ID만 보낸다. 소스 접근과 새 계산의 버전 검사는 기존 생성기를 재사용한다. 필수 열 질문이 없는 실행에는 허용하지 않는다.

### BR-034-02: Preserve editor and explicit consent

소스 선택만으로 모델·대시보드 저장을 실행하지 않는다. 미리보기 동의와 저장 동의를 분리한다. 현재 편집기의 소스와 배치를 바꾸지 않는다.

### BR-034-03: Replay and stale response

UC033의 진행 단일화/완료 영수증/최신 제안 비교를 재사용한다. 불명확 결과의 선택을 잠그고 같은 요청으로 재확인한다. 다른 요청·늦은 결과가 최신 생성안을 덮지 않는다. 캐시는10분이며 만료 후 자동 재생성을 보장하지 않는다.
