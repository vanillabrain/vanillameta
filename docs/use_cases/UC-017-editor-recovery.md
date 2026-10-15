# UC-017: Recover Editor Requests Without Losing Drafts

## Overview

**Use Case ID:** UC-017
**Use Case Name:** Recover Editor Requests Without Losing Drafts
**Primary Actor:** 운영 담당자
**Goal:** 저장 충돌·응답 유실·AI 취소 후 초안을 보존하고 저장 상태를 확인하여 안전하게 재시도한다.
**Trigger:** 편집 중409, 저장 결과 불명확 또는 AI 요청 취소가 발생한다.
**Status:** Draft
**Requirements:** [FR-009, NFR-001, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 소유 분석의 최초 편집 기준과 revision, 현재 공통 초안·질문이 있다.
- 저장은 기존 revision CAS와 단일 transaction을 사용한다.

## Main Success Scenario

1. 담당자가 질문 또는 직접 변경을 미리보기하고 저장한다.
2. 409 또는 저장 결과 불명확이 발생하면 초안·질문·이력을 보존하고 추가 저장/AI 실행을 잠근다.
3. 담당자가 저장 상태 확인을 누르면 서버의 최신 편집 정의를 읽기만 한다.
4. 현재 초안과 최신 저장 내용이 같으면 저장 화면으로 이동할 수 있다. 쓰기를 반복하지 않는다.
5. 다르면 최초 기준·내 초안·최신 저장본을 비교한다. 같은 블록의 내용은 하나의 단위이고 표시 필드·폭별 배치는 별도로 비교한다.
6. 서로 다른 변경을 합친 결과를 초안으로 반영한다. 같은 단위 충돌은 항목을 보여주고 내 변경 사용을 명시 선택한 뒤 합친다.
7. 최신 revision으로 전체 미리보기를 다시 성공시킨 뒤 한 번 저장하고 새로고침한다.

## Alternative Flows

### A1: Check fails or the latest changes again

**Trigger:** 조회 오류 또는 복구 뒤 또 다른 변경이 저장된다 (step 3 or 7).
**Flow:**

1. 초안과 질문을 유지하고 상태 확인을 다시 시도한다. 새409는 같은 복구 흐름으로 돌아간다.
2. Use case continues at step 3.

### A2: Structural changes

**Trigger:** 최초 기준과 내 초안·최신본의 블록 순서/집합이 다르다 (step 5).
**Flow:**

1. 자동 병합하지 않는다. 현재 초안을 유지하며 최신본을 확인하고 명시적인 기존 버리기/재로드를 선택할 수 있다.
2. Use case ends.

### A3: Cancel AI request

**Trigger:** 생성/미리보기 응답 전 취소를 누른다 (step 1).
**Flow:**

1. 해당 요청만 abort하고 늦은 응답을 무시한다. 초안·질문·이력·DB는 유지된다.
2. 같은 질문을 다시 실행하고 미리보기·저장할 수 있다. 저장 전송 뒤에는 취소 성공이나 rollback을 주장하지 않는다.
3. Use case continues at step 1.

## Postconditions

### Success Postconditions

- 이미 저장된 결과를 중복 저장하지 않으며 최신 revision으로 확인한 초안만 재시도한다.
- 최신본의 비대상 변경은 보존하고 충돌 선택은 사용자가 확인한 단위에만 적용한다.

### Failure Postconditions

- 상태 확인·미리보기·저장·취소 실패로 초안을 버리거나 늦은 응답을 적용하지 않는다.

## Business Rules

### BR-017-01: Recovery lock

409와 결과 불명확을 구분해 안내한다. 결과 불명확은 서버 rollback을 추측하지 않는다. 확인 전 저장·AI·미리보기 재실행을 잠그며 직접 편집은 가능하되 기존 조회 결과를 무효화한다. 자동 저장 재시도는 없다. 응답 없는 통신 오류·timeout·5xx는 결과 불명확이며 확정된4xx 거절은 입력/권한 오류로 구분한다.

### BR-017-02: Read and compare

현재 소유권의 GET editor만 조회하고 서버의 savedDefinition으로 실제 SQL·종류를 비교한다. 키·배치·표시·정의 비교는 순서 독립 객체 비교이며 kind 변환이나 정규화된 표시 필드를 중복 변경으로 오인하지 않는다. 실제 canonical 정의를 확인할 수 없으면 같다고 추정하지 않는다.

### BR-017-03: Bounded merge

동일 블록 집합/순서에서 제목·단위·소수·표기·크기·각 폭 rect와 계산/차트 정의를 비교한다. 로컬만 변경한 단위는 로컬, 서버만 변경한 단위는 서버다. 양쪽이 서로 다르게 바꾼 단위는 충돌이며 화면에 나열된 모든 충돌 단위에 대해 내 변경 사용을 한 번 명시한다. 개별 단위의 서버/로컬 혼합 선택은 범위 밖이다. 서버 블록의 비대상 정보는 보존한다. 병합 후 묵은 undo/redo·미리보기·후보를 해제하고 질문은 유지한다. 다시 미리보기해야 저장 가능하다.

### BR-017-04: Cancel boundary

AI 요청 중만 취소를 제공하고 저장 전송 뒤에는 제공하지 않는다. request token과 abort로 늦은 결과/저장 연결을 차단한다. 취소 후 같은 질문의 재시도는 새 요청이다. 취소와 오류 안내를 동시에 남기지 않는다.
