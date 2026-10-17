# UC-047: Confirm a Studio Save After Reload

## Overview

**Use Case ID:** UC-047
**Use Case Name:** Confirm a Studio Save After Reload
**Primary Actor:** 대시보드 소유자
**Goal:** 저장 응답을 확인하지 못한 뒤 새로고침해도 같은 요청으로 결과를 확인하고 편집을 이어간다.
**Trigger:** 저장 응답 실패 후 담당자가 Studio를 새로고침한다.
**Status:** Draft
**Requirements:** [FR-009, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 같은 로그인·탭·대시보드의 유효한 저장 확인 기록이 있다.
- 최신 대시보드 접근 권한 조회가 성공한다.

## Main Success Scenario

1. 담당자가 미저장 블록을 편집하고 저장을 선택한다.
2. 시스템은 초안과 동일 저장 요청을 보관한 후 서버에 전달한다.
3. 저장 응답을 확인하지 못한 담당자가 새로고침한다.
4. 시스템은 권한 확인 후 편집 대신 저장 확인 화면을 연다.
5. 담당자가 같은 저장 요청 재확인을 명시 선택한다.
6. 시스템은 동일 요청을 확인해 기존 완료 결과를 받거나 미전달 저장을 완료한다.
7. 시스템은 저장 확인 상태를 보관하고 현재 최신 저장본을 조회한다.
8. 시스템은 확인 기록과 저장된 초안 기록을 정리하고 현재 저장본의 편집 화면을 연다.
9. 담당자가 새로고침해 결과와 질문 보존을 확인한다.

## Alternative Flows

### A1: Cannot retain recovery data

**Trigger:** 저장 전 보관에 실패한다 (step 2).
**Flow:**

1. 시스템은 전송하지 않고 현재 편집과 오류 안내를 유지한다.
2. Use case ends.

### A2: Cannot read the current saved version

**Trigger:** 저장 확인 뒤 최신 조회가 실패한다 (step 7).
**Flow:**

1. 시스템은 확인된 저장 상태와 질문을 보존한다.
2. 담당자가 재시도하면 저장을 다시 보내지 않고 최신 조회만 수행한다.
3. Use case continues at step 7.

### A3: Same request rejected

**Trigger:** 서버가 저장 요청을 충돌로 거절한다 (step 6).
**Flow:**

1. 시스템은 요청과 보관 초안을 유지하며 명시 복귀를 제공한다.
2. 담당자는 보관 초안으로 돌아가 최신본과 비교하는 UC046 흐름을 선택할 수 있다.
3. Use case ends.

## Postconditions

### Success Postconditions

- 같은 요청으로 중복 생성 없이 결과를 확인하고 현재 저장본·보관 질문으로 편집을 이어간다.

### Failure Postconditions

- 자동 재전송·새 저장 ID·AI·게시 없이 기록과 현재 편집을 보존한다.

## Business Rules

### BR-047-01: Exact bounded request

동일 인증 scope/탭/대시보드에 요청 ID·버전·SQL 없는 문서만 보관한다. 요청과 문서 초안 합계256KiB/24h를 지킨다. 보관 실패는 최초 전송을 차단한다.

### BR-047-02: Explicit confirmation before editing

권한 확인 전에 보관 요청을 노출하거나 실행하지 않는다. 확인 전에는 새 편집/저장 ID를 만들지 않는다. 미전달이면 명시 재확인이 실제 저장을 완료할 수 있음을 안내한다.

### BR-047-03: Receipt is not the latest version

이전 완료 응답을 현재 최신본으로 적용하지 않는다. 저장 확인 후 최신 조회가 실패하면 확인 상태를 보존하고 조회만 재시도한다.409 후 복귀는 명시 선택이며 질문은 별도로 보관한다. 이탈한 화면에 늦은 응답을 적용하지 않는다. 게시 승인은 별도다.
