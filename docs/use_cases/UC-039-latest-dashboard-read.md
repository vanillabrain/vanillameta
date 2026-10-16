# UC-039: Retry Reading the Latest Dashboard after Publication Conflict

## Overview

**Use Case ID:** UC-039
**Use Case Name:** Retry Reading the Latest Dashboard after Publication Conflict
**Primary Actor:** 분석 소유자
**Goal:** 게시 충돌 복구의 최신 저장본 조회 실패를 명시 재시도로 복구하고 접근 거절·늦은 응답에서 다른 내용을 노출하지 않는다.
**Trigger:** UC038 최신 저장본 확인 화면의 조회가 실패한다.
**Status:** Draft
**Requirements:** [FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 이전 게시 창은 저장 버전 충돌로 잠겼으며 최신 저장본 확인 링크를 제공한다.

## Main Success Scenario

1. 소유자가 최신 저장본 확인 링크를 연다.
2. 조회가 일시 실패하면 기존 Studio 오류와 다시 시도를 표시하며 저장·게시 작업을 제공하지 않는다.
3. 사용자가 다시 시도를 누른다.
4. 현재 대시보드의 조회 성공 결과만 표시한다. 최신 제목·수치·차트를 확인한다.
5. 사용자가 기존 게시 설정에서 공개 범위를 선택하고 명시 게시한다.
6. 새로고침으로 게시본을 확인한다. 이전 편집·게시 충돌 상태는 유지된다.

## Alternative Flows

### A1: Permission denied

**Trigger:** 최신 저장본 접근이 거절됨 (step 2).
**Flow:**

1. 기존 권한 오류 안내를 표시한다. 저장본·원본 행·게시 버튼을 보여주거나 공개하지 않는다.
2. Use case ends.

### A2: Target changes during a read

**Trigger:** 조회 도중 다른 대시보드로 이동하거나 화면이 닫힘 (step 3).
**Flow:**

1. 이전 조회의 성공/오류를 무시한다. 새 대상의 현재 조회만 화면에 반영한다.
2. Use case continues at step 4.

## Postconditions

### Success Postconditions

- 현재 대상의 최신 저장본만 표시하고 사용자의 명시 확인 이후 게시한다.

### Failure Postconditions

- 실패/늦은 응답으로 다른 대시보드가 표시되거나 저장·게시가 자동 실행되지 않는다.

## Business Rules

### BR-039-01: Read-only recovery

조회 실패는 기존 Studio 오류/명시 재시도 UI를 재사용한다. 이전 창의 초안/게시 버전/공개 동의를 변경하지 않는다. 실제 조회 성공 전에 이전 결과로 편집·게시 화면을 채우지 않는다.

### BR-039-02: Latest target wins

각 load에 세대를 부여하고 재시도·대상 변경·unmount 시 이전 결과를 무효화한다. 결과 문서의 dashboardId가 현재 경로와 일치하기 전에는 Workspace를 표시하지 않는다. 서버 요청을 취소한 것으로 간주하지 않으며 늦은 응답의 UI 반영만 막는다.

### BR-039-03: Existing authority and publication gates

권한 조회/오류 문구·저장/게시 CAS/requestId는 기존 API 계약을 사용한다. 자동 재시도·새 모드·추가 설정·새 API를 만들지 않는다.
