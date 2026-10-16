# UC-025: Recover an Unsaved Browser Draft

## Overview

**Use Case ID:** UC-025
**Use Case Name:** Recover an Unsaved Browser Draft
**Primary Actor:** 분석 소유자
**Goal:** 실패 후 브라우저를 새로고침해도 미저장 초안과 질문을 복구해 저장·게시까지 이어간다.
**Trigger:** 편집 화면을 새로고침하거나 같은 탭에서 다시 연다.
**Status:** Draft
**Requirements:** [FR-007, FR-009, FR-011, NFR-001, NFR-004](../requirements.md)

## Preconditions

- 소유 분석의 정상 편집 권한이 있다.
- 같은 브라우저 로그인 세션·탭에 유효한 보관 초안이 있다.

## Main Success Scenario

1. 담당자가 제목·블록·질문을 편집한다.
2. 시스템이 현재 로그인 세션·분석 범위로 초안을 탭에 보관한다.
3. AI 실패 후 담당자가 새로고침한다.
4. 시스템이 권한과 최신 저장본을 확인하고 보관 초안 복구를 안내한다.
5. 담당자가 복구를 선택한다.
6. 시스템이 초안·질문·선택·화면 폭을 복구하고 이전 미리보기는 무효화한다.
7. 담당자가 재질문하고 전체 미리보기를 확인한 뒤 저장·게시한다.
8. 시스템은 확인된 저장 성공 후 보관 초안을 제거한다.

## Alternative Flows

### A1: Changed revision or uncertain save

**Trigger:** 저장본 버전이 달라졌거나 이전 저장 결과가 불명확하다 (step 6).
**Flow:**

1. 기존 기준본과 로컬 초안을 보존하고 저장 상태 확인·충돌 복구를 요구한다.
2. 확인 전 자동 저장·AI 재실행·게시 이동을 차단한다.
3. Use case continues at step 7.

### A2: Unavailable or invalid storage

**Trigger:** 보관 공간 접근 실패·한도·손상·만료·다른 로그인 세션·소스다름 (step 4).
**Flow:**

1. 유효하지 않은 내용을 실행하지 않는다. 저장 실패는 보관 불가 안내를 보여 주고 현재 메모리 초안을 유지한다.
2. 담당자는 최신본에서 계속하거나 해당 보관 초안을 명시 폐기한다.
3. Use case ends.

## Postconditions

### Success Postconditions

- 복구 전후 비대상·ID·모든 폭 배치와 원본을 보존한다. 저장 성공 전 서버 쓰기는 없다.

### Failure Postconditions

- 복구·새로고침·AI 실패가 저장·게시를 자동 재실행하지 않는다.

## Business Rules

### BR-025-01: Scoped local draft

sessionStorage에 로그인 토큰의 SHA-256 scope·대시보드ID로 분리한다. 원 토큰·인증·행 데이터·미리보기 결과는 새로 보관하지 않는다. 탭 종료/다른 기기/브라우저 재시작 복구는 보장하지 않는다. SQL 정의를 포함한 초안은 같은 기기의 탭 저장소에 남음을 안내한다. 로그아웃 시 이 기능의 key만 제거한다.

### BR-025-02: Explicit recovery and cleanup

복구/폐기는 명시 선택이다. 복구 전에는 보관 초안을 덮어쓰지 않는다. 저장 성공·명시 폐기·최신본으로 초기화·로그아웃에서 제거한다. 실패/취소/저장 불명확에서는 보존한다. TTL24시간·UTF-8 최대256KiB를 적용하고 저장 실패를 안내한다.

### BR-025-03: Validate before reuse

권한 있는 최신 editor 조회 후 source/ID·스키마/크기·revision을 검증한다. 다른 버전은 UC017 기준본 비교로, 불명확 저장은 읽기 상태 확인으로 연결한다. 복구는 preview·undo/redo·실행 중 요청·선택 후보를 되살리지 않으며 새 미리보기 없이 저장하지 않는다.

정상 인증 refresh 성공 시에만 토큰 hash와 기존 scope의 별칭을 같은 탭에 이어 붙인다. 원 토큰은 별칭에도 저장하지 않으며 새 로그인·로그아웃은 이전 초안/별칭을 제거한다. 다른 탭이 토큰을 갱신하는 경합은 후속 검증 범위다.
