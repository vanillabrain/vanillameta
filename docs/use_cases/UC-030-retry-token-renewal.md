# UC-030: Retry Token Renewal After Interruption

## Overview

**Use Case ID:** UC-030
**Use Case Name:** Retry Token Renewal After Interruption
**Primary Actor:** 분석 소유자
**Goal:** 갱신 일시 장애나 잠금 보유 탭 종료 뒤에도 살아 있는 탭의 초안·질문을 보존하고 명시 재시도로 저장/게시한다.
**Trigger:** UC029 갱신 중 서버503/통신 실패 또는 보유 탭 종료.
**Status:** Draft
**Requirements:** [FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- UC028의 같은 로그인 세대와 UC025의 탭별 보관 범위를 따른다.
- 탭 종료 인계는 같은 origin Web Locks 지원 환경이다.

## Main Success Scenario

1. 담당자가 미저장 초안과 질문을 만든다.
2. 시스템이 만료 요청 뒤 갱신을 시도하지만 일시 장애로 실패한다.
3. 시스템은 요청을 실패로 마치고 인증 세대·초안·질문을 보존한다. 저장/게시나 백그라운드 재시도는 실행하지 않는다.
4. 담당자가 새로고침하고 보관 초안을 명시 복구한다.
5. 담당자가 미리보기를 재시도하고 정상 refresh 후 미리보기→저장→게시 미리보기→명시 링크 게시한다.
6. 담당자가 새로고침해 저장·게시 결과와 추가 쓰기 없음을 확인한다.

## Alternative Flows

### A1: Lock holder closes

**Trigger:** 실제 잠금 보유 탭 종료 (step 2).
**Flow:**

1. 브라우저가 잠금을 해제하고 대기 탭은 같은 로그인 세대를 다시 검사한다.
2. 새 토큰이 있으면 재사용하고 없으면 갱신한다. 닫힌 탭의 본문 복구는 보장하지 않는다.
3. 살아 있는 탭의 질문/초안을 유지한다.
4. Use case continues at step 5.

### A2: Explicit authentication rejection

**Trigger:** refresh 응답이401/403 (step 2).
**Flow:**

1. 현재 토큰·세대가 원 요청과 같은 경우만 기존 로그아웃/초안 정리를 수행한다.
2. 새 로그인 또는 다른 탭 갱신은 UC028/029 경계를 유지한다.
3. Use case ends.

## Postconditions

### Success Postconditions

- 선택한 일시 장애와 탭 종료에서 살아 있는 탭 초안·질문이 유지되고 저장/게시까지 이어진다.

### Failure Postconditions

- 인증 거절을 성공으로 취급하거나 이전 요청을 새 로그인으로 연결하지 않는다.

## Business Rules

### BR-030-01: Transient failures preserve session

refresh의401/403만 인증 거절로 분류한다.503/통신/timeout/잘못된 성공 응답은 요청 실패로 보고하고 자동 로그아웃하지 않는다. 대기 promise·잠금을 해제해 명시 재시도를 허용한다.

### BR-030-02: Browser-owned release

탭 종료 시 Web Locks 해제는 브라우저 책임이다. 수동 lease·강제잠금해제·닫힌 탭 초안 이관은 추가하지 않는다. 이미 서버가 처리한 갱신은 취소/rollback으로 표기하지 않는다.

### BR-030-03: Explicit write boundary

질문/초안은 그대로 유지하며 재미리보기/저장/게시의 명시 경계를 따른다. 오류 주입은 테스트 프록시에 한정한다.
