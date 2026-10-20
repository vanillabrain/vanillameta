# UC-026: Recover a Draft After Another Tab Saves

## Overview

**Use Case ID:** UC-026
**Use Case Name:** Recover a Draft After Another Tab Saves
**Primary Actor:** 분석 소유자
**Goal:** 새로고침한 초안을 최신 저장본과 비교해 필요한 변경만 합치고 다시 미리보기·저장·게시한다.
**Trigger:** 미저장 초안이 있는 동안 다른 탭이 같은 대시보드를 저장한 뒤 첫 탭을 새로고침한다.
**Status:** Draft
**Requirements:** [FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 같은 로그인 세션·탭에 UC025 유효 초안이 있고 최신 편집 권한이 있다.
- 같은 소스·블록 ID/순서이며 다른 탭의 저장 revision이 기준본과 다르다.

## Main Success Scenario

1. 담당자가 첫 탭에서 제목·질문을 편집한다.
2. 다른 탭에서 같은 항목과 별도 항목을 변경해 저장한다.
3. 첫 탭을 새로고침하면 시스템이 최신 저장본과 보관 초안의 버전 차이를 안내한다.
4. 담당자가 초안을 명시 복구한다. 시스템은 질문·기준본을 보존하고 AI·미리보기·저장을 잠근다.
5. 담당자가 저장 상태를 조회해 충돌 목록과 비대상 최신 변경 보존 안내를 확인한다.
6. 담당자가 충돌 항목에 내 변경 사용을 명시 선택한다.
7. 시스템이 최신본 기준으로 합치고 이전 미리보기를 무효화한다.
8. 담당자가 전체 재미리보기→저장→게시 미리보기→명시 게시를 수행한다.
9. 담당자가 새로고침해 합친 저장본과 게시본을 확인한다.

## Alternative Flows

### A1: Nonoverlapping edits

**Trigger:** 양쪽이 서로 다른 항목을 변경했다 (step 5).
**Flow:**

1. 담당자가 내 변경과 최신본 합치기를 선택한다.
2. Use case continues at step 7.

### A2: Changed structure or unavailable latest state

**Trigger:** 소스·블록 구성/순서 변경 또는 상태 조회 실패 (step 5).
**Flow:**

1. 시스템은 자동 병합·저장을 차단하고 초안·질문을 보존한다.
2. 담당자는 상태 확인을 재시도하거나 최신본에서 명시적으로 다시 편집한다.
3. Use case ends.

### A3: Another save after comparison

**Trigger:** 비교 후 저장 전에 다른 탭이 다시 저장했다 (step 8).
**Flow:**

1. 서버는 최신 revision 불일치로 저장을 거절하고 현재 초안을 유지한다.
2. 조회 실패와 재충돌의 반복 복구는 [UC-027](UC-027-retry-editor-recovery.md)을 따른다.
3. Use case continues at step 5.

## Postconditions

### Success Postconditions

- 선택한 충돌 항목만 로컬을 사용하고 비대상 최신 변경·계산·블록 ID·배치는 유지한다.
- 확인된 저장 후 해당 초안을 제거하고 같은 저장 revision의 게시 미리보기를 사용한다.

### Failure Postconditions

- 복구·상태 확인은 서버 쓰기0이며 미리보기 없이 저장·게시하지 않는다.

## Business Rules

### BR-026-01: Visible revision boundary

복구 전 버전 차이를 알리고 복구 후에는 UC017의 읽기 비교·제한 병합을 따른다. 버전 차이가 항목 충돌을 뜻한다고 단정하지 않는다.

### BR-026-02: Explicit conflict choice

같은 항목의 서로 다른 변경은 명시 선택이 필요하다. 비충돌 최신 변경을 버리지 않는다. 구조/소스 변경 자동 병합은 범위 밖이다.

### BR-026-03: New preview and CAS

병합은 최신 revision을 기준으로 삼고 미리보기/이력을 비운다. 저장은 새 미리보기와 revision CAS를 요구한다. 다른 탭 인증 갱신 경합·실휴대폰은 별도 gate다.
