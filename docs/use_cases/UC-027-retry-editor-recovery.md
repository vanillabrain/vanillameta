# UC-027: Retry Recovery After Read Failure and Repeated Conflict

## Overview

**Use Case ID:** UC-027
**Use Case Name:** Retry Recovery After Read Failure and Repeated Conflict
**Primary Actor:** 분석 소유자
**Goal:** 최신 상태 조회 실패와 저장 직전 재충돌에서도 초안·질문을 보존하고 재시도·미리보기·저장·게시를 마친다.
**Trigger:** UC026 복구 중 최신 상태 조회가 실패하거나 비교 후 최신본이 다시 저장된다.
**Status:** Draft
**Requirements:** [FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 유효한 로컬 초안·질문과 소유 분석의 편집 권한이 있다.
- 같은 소스·블록 구성/순서이며 UC017/026 제한 병합을 적용할 수 있다.

## Main Success Scenario

1. 담당자가 다른 탭 저장 후 첫 탭의 초안·질문을 복구한다.
2. 담당자가 저장 상태 확인을 요청하지만 시스템은 조회 실패를 안내한다.
3. 시스템은 초안·질문·기준본을 보존하고 AI·미리보기·저장 잠금을 유지한다.
4. 담당자가 상태 확인을 재시도하고 최신본을 명시 병합한다.
5. 담당자가 전체 재미리보기를 확인한다.
6. 다른 탭이 최신본을 다시 저장한 뒤 담당자가 저장을 요청한다.
7. 서버는409로 거절하고 시스템은 초안·질문을 보존하며 상태 확인을 안내한다.
8. 담당자가 다시 상태 확인→명시 병합→전체 재미리보기→저장을 수행한다.
9. 담당자가 같은 저장 revision의 게시 미리보기를 확인하고 링크 게시 후 새로고침한다.

## Alternative Flows

### A1: Repeated read failure

**Trigger:** 재시도한 조회도 실패했다 (step 4).
**Flow:**

1. 시스템은 현재 초안과 잠금을 유지하고 이전 성공 비교를 재사용하지 않는다.
2. Use case continues at step 4.

### A2: Changed source or structure

**Trigger:** 최신 상태가 다른 소스·블록 구조를 가진다 (step 8).
**Flow:**

1. 시스템은 자동 병합을 차단하고 초안·질문을 보존한다.
2. 담당자가 최신본에서 명시적으로 다시 편집한다.
3. Use case ends.

## Postconditions

### Success Postconditions

- 최신 비대상 변경·계산·ID·배치를 유지하고 저장 성공 후 로컬 보관을 제거한다.

### Failure Postconditions

- 조회 실패와409는 로컬 초안·질문을 버리거나 자동 저장·게시하지 않는다.

## Business Rules

### BR-027-01: Failed read is not a saved state

실패한 최신 조회는 비교 결과를 비우고 복구 잠금을 유지한다. 재시도는 새로운 GET이어야 한다.

### BR-027-02: Repeat CAS recovery

각 병합은 확인한 최신 revision을 새 기준으로 삼는다.409 후 상태 확인을 다시 수행하고 새 전체 미리보기 없이 저장하지 않는다. 불명확 저장과 확정409를 구분한다.

### BR-027-03: Explicit writes

오류/복구 GET은 쓰기0, 거절된409는 서버 변경0이다. 실제 성공 저장과 링크 게시만 명시 요청으로 실행한다. 다른 탭 인증 갱신 경합·실휴대폰·운영DB는 별도 gate다.
