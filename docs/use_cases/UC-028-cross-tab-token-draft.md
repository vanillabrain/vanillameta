# UC-028: Recover a Draft After Token Renewal in Another Tab

## Overview

**Use Case ID:** UC-028
**Use Case Name:** Recover a Draft After Token Renewal in Another Tab
**Primary Actor:** 분석 소유자
**Goal:** 다른 탭의 정상 인증 갱신 후에도 원래 탭의 미저장 초안·질문을 복구해 저장·게시한다.
**Trigger:** 둘째 탭이 인증 만료 응답 후 정상 refresh를 마치고 첫 탭을 새로고침한다.
**Status:** Draft
**Requirements:** [FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 같은 origin·로그인 세션이며 첫 탭에 UC025 유효 초안이 있다.
- 서버의 정상 refresh 인증과 최신 editor 권한 확인을 통과한다.

## Main Success Scenario

1. 담당자가 첫 탭에서 미저장 제목·질문을 보관한다.
2. 둘째 탭의 요청이 인증 만료로 거절된다.
3. 시스템은 서버 refresh 인증 성공 후 새 토큰과 기존 초안 세션 식별자의 연결을 같은 origin에 기록한다.
4. 담당자가 첫 탭을 새로고침한다.
5. 시스템은 최신 편집 권한을 확인한 후 기존 탭의 보관 초안을 명시 복구하도록 안내한다.
6. 담당자가 복구를 선택하고 전체 미리보기→저장→게시 미리보기→명시 게시를 수행한다.
7. 담당자가 새로고침해 저장본·게시본을 확인한다.

## Alternative Flows

### A1: Login session replaced

**Trigger:** 갱신 대기 중 다른 탭에서 새 로그인 또는 로그아웃이 일어났다 (step 3).
**Flow:**

1. 시스템은 늦은 refresh 성공·실패가 새 토큰/초안 세션을 덮어쓰거나 로그아웃시키지 못하게 한다.
2. 이전 초안은 다른 로그인 세션으로 자동 연결하지 않는다.
3. Use case ends.

### A2: Unavailable shared metadata

**Trigger:** 공유 메타데이터 접근·스키마·세션 검증 실패 (step 5).
**Flow:**

1. 검증할 수 없는 연결을 추측하지 않는다. 보관 불가 안내를 제공하고 서버 권한 확인을 유지한다.
2. 담당자는 현재 메모리 초안을 저장하거나 명시 재시도한다.
3. Use case ends.

## Postconditions

### Success Postconditions

- 같은 탭의 초안·질문·계산·ID·배치가 유지되고 성공 저장 후 보관을 정리한다.

### Failure Postconditions

- 새로운 로그인/다른 계정으로 이전 초안을 넘기지 않으며 복구 전 AI·저장·게시를 재실행하지 않는다.

## Business Rules

### BR-028-01: Shared metadata, tab-local content

초안 본문은 sessionStorage에 유지한다. 같은 origin localStorage에는 무작위 로그인 세대·현재 토큰 SHA256·안정된 초안 scope만 기록하며 원 토큰/SQL/질문/행/미리보기를 추가 보관하지 않는다. 서버 권한 검사를 이 메타데이터로 대체하지 않는다.

### BR-028-02: Authenticated continuity only

정상 refresh만 scope를 승계한다. 새 로그인/로그아웃은 공유 세대를 교체하고 해당 탭의 기능 보관을 정리한다. 다른 탭의 이전 본문을 직접 지우지는 않지만 새 세대의 조회로 연결하지 않는다. 동일 문자열 토큰 재로그인도 세대로 구별한다.

### BR-028-03: Async boundary checks

해시 계산/서버 refresh 대기 중 세대·토큰이 바뀌면 늦은 결과를 적용하지 않는다. 저장소 오류는 기존 인증 성공을 실패로 바꾸지 않지만 초안 복구 가능성을 과장하지 않는다. 지원 브라우저에서 같은 origin의 동시 갱신 조정은 [UC-029](UC-029-concurrent-token-renewal.md)을 따른다. 미지원 환경의 전역 단일화는 보장하지 않는다.
