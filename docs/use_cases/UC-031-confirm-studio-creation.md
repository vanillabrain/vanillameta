# UC-031: Confirm Uncertain Studio Creation

## Overview

**Use Case ID:** UC-031
**Use Case Name:** Confirm Uncertain Studio Creation
**Primary Actor:** 분석 소유자
**Goal:** 새 Studio 생성 저장의 응답을 받지 못해도 같은 저장 요청으로 기존 비공개 결과를 확인하고 중복 생성을 막는다.
**Trigger:** 생성 미리보기를 명시 저장했으나 응답이 유실된다.
**Status:** Draft
**Requirements:** [FR-008, FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 본인 DuckDB 소스의 생성 제안과 전체 미리보기를 검토했다.
- 같은 화면 수명 내 요청 ID·제안 ID·소스 revision을 유지한다.

## Main Success Scenario

1. 담당자가 소스를 고르고 새 대시보드를 질문해 지표·차원과 전체 결과를 확인한다.
2. 담당자가 비공개 저장을 명시한다.
3. 서버가 대시보드·지표·저장 영수증을 원자 저장하지만 화면은 응답을 받지 못한다.
4. 화면은 완료 여부 불명확 안내를 표시하고 제안/소스/후속 수정 변경을 잠근다.
5. 담당자가 같은 저장 요청 확인을 실행한다.
6. 서버가 같은 요청의 영수증과 소유권을 확인해 기존 ID를 반환한다.
7. 담당자가 저장된 Studio와 새로고침 결과를 확인한다.

## Alternative Flows

### A1: Request never committed

**Trigger:** 서버에 요청이 전달되지 않아 영수증이 없다 (step 3).
**Flow:**

1. 같은 요청 재시도는 유효한 원 제안으로 최초 저장하거나 만료/권한 오류를 명확히 반환한다.
2. Use case continues at step 6.

### A2: Access or request binding changed

**Trigger:** 다른 계정 또는 같은 요청 ID의 다른 제안/소스 기준 (step 6).
**Flow:**

1. 서버는 기존 비공개 결과를 공개하거나 새 복사본을 만들지 않고 거절한다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 요청 재확인은 같은 비공개 ID이고 대시보드·영수증 증가는 각각1개다. 게시0이며 원본과 다른 대시보드는 유지한다.

### Failure Postconditions

- 불명확 저장을 미저장/완료로 단정하거나 자동 재생성·게시하지 않는다.

## Business Rules

### BR-031-01: Exact request replay

StudioCreate는 불명확 상태에서 requestId/proposalId/expectedSourceRevision을 유지한다. 서버 영수증은 소유자·payloadHash·현재 접근권한에 바인딩하며 제안 캐시 소비 뒤에도 replay한다.

### BR-031-02: Explicit private creation

미리보기는 쓰기 없고 명시 비공개 저장만 생성한다. 결과 확인 전 입력/소스/수정을 잠근다. 재확인 및 reload가 새 AI·생성·게시를 자동 실행하지 않는다.

### BR-031-03: Scoped recovery

이번 검증은 같은 생성 화면에서 유실→재확인→저장본 reload다. 불명확 상태 자체의 브라우저 reload/다른 탭 복구는 아직 보장하지 않는다.
