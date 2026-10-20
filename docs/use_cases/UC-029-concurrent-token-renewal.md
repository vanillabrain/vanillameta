# UC-029: Coordinate Concurrent Token Renewal

## Overview

**Use Case ID:** UC-029
**Use Case Name:** Coordinate Concurrent Token Renewal
**Primary Actor:** 분석 소유자
**Goal:** 두 탭이 동시에 만료 응답을 받아도 같은 로그인 세대의 토큰 갱신을 조정하고 각 초안·질문을 복구한다.
**Trigger:** 같은 origin의 두 탭에서 같은 토큰으로 보낸 요청이 동시에 인증 만료된다.
**Status:** Draft
**Requirements:** [FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 같은 origin·로그인 세대이며 Web Locks가 지원되는 정상 인증 환경이다.
- 각 탭의 보관 초안은 UC025/028 범위 안에 있다.

## Main Success Scenario

1. 담당자가 두 탭에 서로 다른 미저장 제목·질문을 보관한다.
2. 시스템이 각 탭의 원 요청 토큰·로그인 세대를 기록한다.
3. 두 요청이 만료되면 첫 탭만 브라우저 잠금 안에서 서버 refresh를 수행한다.
4. 기다린 탭은 같은 세대의 토큰이 바뀐 것을 확인해 추가 refresh 없이 새 토큰으로 원 요청을 재시도한다.
5. 담당자가 두 탭을 새로고침하고 각 탭의 초안·질문을 명시 복구한다.
6. 담당자가 한 초안을 미리보기→저장→게시 미리보기→명시 게시한다.
7. 담당자가 새로고침해 결과를 확인한다.

## Alternative Flows

### A1: Login changes while waiting

**Trigger:** 잠금 대기·refresh 중 새 로그인/로그아웃으로 세대가 바뀐다 (step 3).
**Flow:**

1. 시스템은 이전 요청을 새 로그인으로 재실행하지 않고 새 인증도 지우지 않는다.
2. Use case ends.

### A2: Lock unavailable or wait timeout

**Trigger:** Web Locks 미지원 또는 잠금 대기10초 소진 (step 3).
**Flow:**

1. 미지원 환경은 기존 탭 내부 단일 갱신·UC028 세대 검사를 유지하며 전역 단일 갱신을 보장하지 않는다.
2. 잠금 실패/대기 만료는 기존 인증·초안을 보존하고 명시 재시도를 허용한다.
3. Use case ends.

## Postconditions

### Success Postconditions

- 검증한 두 탭 경합에서 서버 refresh1회·각 원 요청 재시도 성공, 서로의 초안 본문을 덮지 않는다.

### Failure Postconditions

- 다른 로그인 세대의 요청·토큰·초안을 연결하거나 잠금 실패만으로 로그아웃하지 않는다.

## Business Rules

### BR-029-01: Request generation fence

인증 헤더 설정 시 요청의 세대를 캡처한다. 만료 응답이 늦게 오더라도 그 세대와 현재 세대가 다르면 새 로그인으로 재시도하지 않는다. 토큰·세대가 일치할 때만 refresh하고 같은 유효 세대에서 이미 갱신된 토큰은 재사용한다.

### BR-029-02: Browser coordination

같은 origin Web Locks의 exclusive 잠금은 refresh·scope 승계·토큰 저장을 감싼다. 탭 내부 refreshPromise는 유지한다. 대기는10초로 제한하고 브라우저 잠금 오류를 조용히 무잠금 실행으로 우회하지 않는다.

### BR-029-03: Explicit draft lifecycle

본문은 탭별 sessionStorage, 공유 메타데이터는 UC028 세대/hash/scope만 사용한다. 새 미리보기·저장·게시의 명시 경계를 유지한다.
