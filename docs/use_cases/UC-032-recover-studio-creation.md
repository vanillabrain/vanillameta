# UC-032: Recover Studio Creation Confirmation After Reload

## Overview

**Use Case ID:** UC-032
**Use Case Name:** Recover Studio Creation Confirmation After Reload
**Primary Actor:** 분석 소유자
**Goal:** 저장 완료 여부 불명확 상태에서 reload해도 같은 로그인/탭의 저장 요청과 질문을 복구하고 기존 비공개 결과를 확인한다.
**Trigger:** UC031 저장 요청 후 응답 유실 또는 요청 중 reload.
**Status:** Draft
**Requirements:** [FR-008, FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 같은 정상 로그인 세대·탭이며 원 소스 조회 권한이 있다.
- 최소 저장 확인 기록이24시간/8KiB 범위 안에 있다.

## Main Success Scenario

1. 담당자가 새 생성 제안을 검토하고 비공개 저장을 명시한다.
2. 시스템은 요청 ID·제안 ID·소스 revision과 소스 ID·제목·질문만 탭 저장소에 먼저 보관한 뒤 기존 저장 API를 호출한다.
3. 서버 커밋 후 응답을 받지 못한 담당자가 reload한다.
4. 시스템은 권한 조회 후 확인 대기 기록과 질문을 표시한다. 모델·제안 복원·저장 요청은 자동 실행하지 않는다.
5. 담당자가 같은 저장 요청 확인을 누른다.
6. 시스템은 같은 로그인 범위/본문으로 요청하고 서버 영수증의 기존 ID를 연다.
7. 저장 확인 기록을 지우고 새로고침해 저장본과 추가 생성0을 확인한다.

## Alternative Flows

### A1: Temporary confirmation failure

**Trigger:** 재확인 응답의 통신/서버 실패 (step 6).
**Flow:**

1. 질문과 요청 기록을 보존하고 재확인을 허용한다.
2. Use case continues at step 5.

### A2: Missing or invalid record

**Trigger:** 만료·잘못된형식·새로그인 범위·권한없는소스 (step 4).
**Flow:**

1. 기록 내용을 복구하거나 요청을 자동 실행하지 않는다. 잘못된/만료 기록은 해당 key만 제거한다.
2. Use case ends.

### A3: Explicit discard

**Trigger:** 담당자가 확인 대기 기록 지우기를 선택 (step 4).
**Flow:**

1. 이 탭의 해당 확인 기록만 지우고 서버 저장본은 유지한다고 안내한다.
2. Use case ends.

### A4: Initial permission lookup fails

**Trigger:** 초기 소스 권한/인증scope 조회 실패 (step 4).
**Flow:**

1. 기록과 질문을 노출하거나 새 생성으로 덮지 않고 입력을 잠근다.
2. 담당자가 저장 확인 상태 다시 불러오기를 선택한다.
3. Use case continues at step 4.

### A5: Save request was not delivered

**Trigger:** 첫 저장 요청이 서버에 전달되기 전에 실패 (step 3).
**Flow:**

1. 시스템은 확인 대기 기록을 유지하고 서버 처리 여부를 임의로 단정하지 않는다.
2. 담당자가 reload 후 같은 질문/요청을 복구하고 명시 재확인한다.
3. 서버에 영수증이 없고 원 제안이 유효하면 같은 request/proposal/revision으로 최초 비공개 저장한다. 제안 만료/권한 거절은 실패로 유지하고 임의 재생성하지 않는다.
4. Use case continues at step 7.

## Postconditions

### Success Postconditions

- 같은 request/proposal/revision으로 기존 ID를 확인하고 dashboard/영수증 추가 생성0이다. A5의 미전달 요청은 최초 저장 시에만 각각1개가 증가하고 그 뒤 재시도는 같은 ID다.

### Failure Postconditions

- 저장소 기록 실패 전에는 저장 요청을 시작하지 않고 이유를 알린다. 인증 범위를 넘겨 요청을 복구하지 않는다.

## Business Rules

### BR-032-01: Minimal tab-local record

version/time/sourceId/title/prompt/request3필드만 sessionStorage에 보관한다. SQL·preview·token·cookie·원본행은 보관하지 않는다. 기존 editorDraftKey의 안정 scope와 prefix를 재사용하고 정상 refresh는 유지·로그아웃/새 로그인은 격리한다. namespace 계산의 상수1은 대시보드 대상이 아니며 suffix로 기존 본문key와 분리한다.

### BR-032-02: Explicit replay

reload는 권한있는소스 목록 조회와 기록 표시만 수행한다. 명시 재확인만 기존 POST와 서버 receipt replay를 실행한다. 저장소 실패는 요청을 보내기 전에 차단한다. 미전달 뒤 유효 제안의 최초 저장도 같은 요청 계약을 따른다.

### BR-032-03: Retention and discard

기록은24h/8KiB 제한이며 명시 성공/폐기 때 제거한다. 권한/만료/서버 실패를 미저장으로 단정하지 않는다. 확인 기록을 버려도 서버 대시보드를 삭제하지 않는다.
