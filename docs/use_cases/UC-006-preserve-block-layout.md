# Use Case: Preserve Block Layout

## Overview

**Use Case ID:** UC-006
**Use Case Name:** Preserve Block Layout
**Primary Actor:** 운영 담당자
**Goal:** 직접 배치한 블록을 AI로 수정하고 저장·재조회해도 해당 배치를 유지한다.
**Trigger:** 담당자가 배치 저장 후 특정 블록의 AI 수정을 요청한다.
**Status:** Tested
**Requirements:** [FR-009, NFR-004](../requirements.md)

## Preconditions

- 소유한 저장 분석과 지원하는 숫자/차트 블록이 있다.

## Main Success Scenario

1. 담당자가 기존 편집기에서 블록을 이동·크기 조절하고 저장한다.
2. 시스템이 분석을 안정적 블록 ID와 최신 버전으로 불러온다.
3. 담당자가 선택 블록의 내용을 AI로 수정 요청한다.
4. 시스템이 대상 변경만 미리보기하고 비대상 정의·ID를 유지한다.
5. 담당자가 저장한다. 시스템이 논리 ID로 기존 geometry를 새 DB 위젯에 연결한다.
6. 담당자가 새로고침해 변경 내용과 기존 위치·크기를 확인한다.

## Alternative Flows

### A1: Stale revision

**Trigger:** 다른 화면에서 배치가 바뀐다 (step 5).
**Flow:**

1. 시스템이 저장을 거절하고 기존 정의와 배치를 보존한다.
2. 담당자가 최신 상태를 불러온다.
3. Use case continues at step 3.

### A2: Invalid identity

**Trigger:** 블록 ID가 중복되거나 기존 분석의 ID와 맞지 않는다 (step 5).
**Flow:**

1. 시스템이 잘못된 연결의 저장을 거절하고 기존 정의를 보존한다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 저장/AI 수정으로 DB widget ID가 바뀌어도 논리 blockId와 기존 geometry는 유지된다.
- 비대상 블록 내용은 대상 수정으로 바뀌지 않는다.

### Failure Postconditions

- 충돌/검증 실패 후 일부 새 위젯·데이터셋·배치 변경이 남지 않는다.

## Business Rules

### BR-001: Compatible identity

신규 저장은 서버 논리 ID를 부여한다. 기존 ID 없는 정의는 분석 ID·원래 index 기반의 결정적 ID를 읽기 응답에 제공하고 다음 명시 저장부터 기록한다. 조회만으로 DB를 변경하지 않는다. 기존 같은 개수의 ID 없는 클라이언트 저장은 index 호환을 유지하며 개수가 바뀌는 legacy 수정은 최신 정의를 요구한다.

### BR-002: Preserve by identity

기존 블록 geometry는 배열 위치가 아니라 blockId로 찾는다. 순서 변경/삭제 시 남는 블록 위치를 유지한다. 신규 블록은 기존 배치 아래에 놓는다. 이번 단위는 AI 위치 변경·breakpoint 편집·undo 통합까지 완료하지 않는다.

### BR-003: Selected edit isolation

선택 블록 AI 응답은 서버가 해당 블록에만 합치고 ID를 유지한다. 비대상 블록/대시보드 제목은 보존한다. 전체 AI 수정은 보존할 블록 ID를 반환해야 한다. 의미 없는 ID 재발급을 허용하지 않는다.

실행 증빙: [검증 결과](../testing/block-layout-continuity.md).
