# Use Case: Update Metric Calculation

## Overview

**Use Case ID:** UC-003
**Use Case Name:** Update Metric Calculation
**Primary Actor:** 운영 담당자
**Goal:** 저장 지표의 계산식 변경을 선택한 기존 분석 차트에 검토 후 반영한다.
**Trigger:** Assistant에서 차트와 저장 지표를 선택하고 계산식 변경을 연다.
**Status:** Tested
**Requirements:** [FR-005, NFR-001, NFR-002, C-001, C-002](../requirements.md)

## Preconditions

- 로그인된 운영 담당자가 소유한 DuckDB 소스의 분석과 활성 구조화 지표가 있다.

## Main Success Scenario

1. 담당자가 기존 차트와 저장 지표를 선택한다.
2. 집계 방식과 계산 컬럼을 변경한다.
3. 시스템이 기존/새 계산식과 같은 조회 조건의 숫자·시계열 또는 분류 차트를 미리보기로 보여준다.
4. 담당자가 지표와 분석에 변경을 저장한다.
5. 새로고침 후 변경 계산식의 분석이 유지된다.

## Alternative Flows

### A1: Stale definition or analysis

**Trigger:** 미리보기 후 지표 또는 분석 버전이 바뀐다 (step 4).
**Flow:**

1. 시스템이 충돌을 알리고 저장하지 않는다.
2. 최신 상태를 다시 조회해 미리보기한다.
3. Use case continues at step 3.

### A2: Invalid calculation or ownership

**Trigger:** 잘못된 컬럼·미지원 정의·다른 소스/소유자의 지표를 사용한다 (step 3).
**Flow:**

1. 시스템이 미리보기/저장을 거부한다.
2. 지표와 분석은 그대로다.
3. Use case ends.

## Postconditions

### Success Postconditions

- 지표 정의 버전이 증가하고 선택 차트의 SQL snapshot이 같은 계산식으로 저장된다.
- 다른 차트·제목·조회 조건은 유지된다.

### Failure Postconditions

- 저장 실패 시 지표와 분석 모두 원래 상태다.

## Business Rules

### BR-001: Explicit scope

현재 선택한 분석의 한 차트에 반영한다. 다른 분석은 snapshot으로 유지되며 자동 일괄 전파나 SQL 이름 추측을 수행하지 않는다. 이전 AI 분석도 명시 지표 선택으로 반영할 수 있다.

### BR-002: Deterministic preview

기존 구조화 계산기와 source SQL 검증을 재사용한다. WHERE·분류·정렬·LIMIT·표시 옵션을 유지하며 numeric 추세는 같은 계산식으로 파생한다. LLM 호출 없이 확정된 계산식만 변경한다.

### BR-003: Atomic optimistic save

미리보기에서 본 지표 definitionVersion과 dashboard revision을 요구한다. 저장 시 두 버전을 다시 확인하고 지표 변경과 분석 저장을 하나의 DB transaction으로 처리한다. 실패·경합은 모두 rollback한다.
