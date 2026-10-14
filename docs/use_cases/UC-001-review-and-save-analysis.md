# Use Case: Review And Save Analysis

## Overview

**Use Case ID:** UC-001
**Use Case Name:** Review And Save Analysis
**Primary Actor:** 운영 담당자
**Secondary Actors:** AI 제공자
**Goal:** 숫자·시계열이 함께 보이는 분석을 검토하고 저장해 다시 조회한다.
**Trigger:** 운영 담당자가 새 분석 또는 기존 분석의 변경을 요청한다.
**Status:** Tested
**Requirements:** [FR-001, FR-002, FR-003, NFR-001, NFR-002, C-001, C-002](../requirements.md)

## Preconditions

- 운영 담당자가 로그인되어 있고 소유한 데이터 소스가 존재한다.

## Main Success Scenario

1. 운영 담당자가 분석 목적이나 변경 요청을 입력한다.
2. 시스템이 숫자·시계열·분류별 차트의 미리보기를 보여준다.
3. 운영 담당자가 계산 기준과 결과를 검토한다.
4. 운영 담당자가 필요하면 보조 설정을 펼쳐 표시와 조회 조건을 확인한다.
5. 운영 담당자가 분석 저장을 확정한다.
6. 시스템이 저장된 분석을 보여준다.
7. 운영 담당자가 화면을 새로고침한다.
8. 시스템이 저장 정의와 현재 조회 조건으로 숫자·시계열을 다시 보여준다.

## Alternative Flows

### A1: Time data unavailable

**Trigger:** 시계열을 계산할 시간 데이터가 없거나 집계가 지원되지 않는다 (step 2).
**Flow:**

1. 시스템이 숫자 결과와 시계열 제공 불가 이유를 보여준다.
2. 운영 담당자가 안내를 검토한다.
3. Use case continues at step 3.

### A2: Cancel preview

**Trigger:** 운영 담당자가 변경을 저장하지 않기로 한다 (step 3).
**Flow:**

1. 운영 담당자가 미리보기를 취소한다.
2. 기존 저장 분석을 유지한다.
3. Use case ends.

### A3: Generation or save failure

**Trigger:** 초안 생성 또는 저장이 실패하거나 저장 버전이 충돌한다 (step 2 or step 5).
**Flow:**

1. 시스템이 오류와 재요청 또는 최신 분석 조회 방법을 안내한다.
2. 이전 저장 분석을 유지한다.
3. Use case ends.

## Postconditions

### Success Postconditions

- 저장된 정의의 지표와 차트를 다시 조회할 수 있다.
- 기존 데이터 소스는 변경되지 않는다.

### Failure Postconditions

- 확정하지 않은 변경은 기존 저장 분석을 덮어쓰지 않는다.

## Business Rules

### BR-001: Numeric and trend pairing

숫자 지표에는 동일 계산 기준의 시계열 또는 제공 불가 안내를 함께 표시한다. 미리보기와 조회 화면은 같은 시계열 렌더러를 사용한다.

### BR-002: Explicit persistence

저장은 명시적인 확정 후에만 실행한다. 임시 조회 조건과 미리보기의 데이터는 저장 정의에 고정하지 않는다.

### BR-003: Progressive disclosure

숫자 표시·업무 시간대·저장 보기 관리·계산 안내는 기본적으로 접는다. 주요 기간·필터·집계 단위·비교·질문은 바로 사용할 수 있다. 접힌 내용은 펼친 뒤 기존 동작을 유지한다.

### BR-004: Safe absence

시간 데이터 없는 숫자 지표에도 제공 불가 이유를 표시하며 가짜 시계열을 만들지 않는다.
