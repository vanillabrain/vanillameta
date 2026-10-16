# UC-038: Recover Publication after a Saved Dashboard Changes

## Overview

**Use Case ID:** UC-038
**Use Case Name:** Recover Publication after a Saved Dashboard Changes
**Primary Actor:** 분석 소유자
**Goal:** 게시 직전 다른 탭에서 저장본이 변경됐을 때 최신 내용을 확인한 뒤 명시 게시한다.
**Trigger:** 게시 요청이 저장 버전 충돌로 거절된다.
**Status:** Draft
**Requirements:** [FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 소유자가 저장본의 게시 설정을 열었으며 다른 탭에서 그 저장본이 변경되었다.

## Main Success Scenario

1. 소유자가 기존 저장 버전의 게시를 요청한다.
2. 서버는 버전 충돌을 반환하고 저장본과 기존 게시본을 변경하지 않는다.
3. 시스템은 낡은 버전의 게시를 잠그고 해당 대시보드의 “최신 저장본 확인” 링크를 제공한다.
4. 소유자가 링크로 새 편집 화면을 열어 최신 제목·숫자·차트를 확인한다.
5. 소유자가 그 화면에서 게시 설정과 공개 범위를 확인하고 게시를 명시 실행한다.
6. 최신 저장본의 고정 게시 링크를 새로고침해 확인한다. 이전 화면의 미저장 초안은 유지된다.

## Alternative Flows

### A1: Latest read fails or access is denied

**Trigger:** 최신 저장본 조회 실패·접근 거절 (step 4).
**Flow:**

1. 기존 편집 화면의 조회 실패/재시도 안내를 사용한다. 예전 창에서 게시를 자동 재시도하거나 최신 버전을 추측하지 않는다.
2. Use case continues at step 4.

### A2: Conflict repeats

**Trigger:** 최신 내용을 확인한 뒤 게시 직전에 다시 변경됨 (step 5).
**Flow:**

1. 같은 버전 검사와 명시 최신 저장본 확인을 반복한다. 자동 게시하지 않는다.
2. Use case continues at step 3.

## Postconditions

### Success Postconditions

- 명시 확인한 최신 저장본만 게시되며 이전 화면의 편집·원본 대시보드는 유지된다.

### Failure Postconditions

- 충돌 요청으로 게시가 생기거나 기존 게시본이 바뀌지 않는다.

## Business Rules

### BR-038-01: Conflict locks stale publication

409 응답은 동일 저장 버전의 게시 버튼을 잠근다. 닫기/다시 열기로 잠금을 해제하지 않는다. 부모가 다른 dashboardId/revision을 제공한 경우에만 잠금을 초기화한다. 네트워크/5xx의 동일 요청 재시도는 기존 정책을 유지한다.

### BR-038-02: Explicit saved-copy handoff

링크는 게시 요청의 dashboardId로만 /dashboard/:id/studio를 연다. 생성 원본 ID와 혼동하지 않는다. 최신 버전을 이전 화면에 자동 반영하지 않으며 새 화면의 기존 권한 조회/실데이터 미리보기/명시 게시를 재사용한다.

### BR-038-03: Independent saved and published states

최신 저장본 조회는 읽기만 수행한다. 기존 게시본·이전 편집 초안·공개 범위/복제 동의를 자동 변경하지 않는다. 재게시/중지/CAS는 기존 서버 계약이다.
