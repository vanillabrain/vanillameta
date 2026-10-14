# Use Case: Reuse Saved Metric

## Overview

**Use Case ID:** UC-002
**Use Case Name:** Reuse Saved Metric
**Primary Actor:** 운영 담당자
**Secondary Actors:** AI 제공자
**Goal:** 저장 지표의 같은 계산 기준으로 새 분석을 얻는다.
**Trigger:** 운영 담당자가 저장 지표를 활용한 분석을 요청한다.
**Status:** Tested
**Requirements:** [FR-004, C-001, C-002](../requirements.md)

## Preconditions

- 운영 담당자가 로그인되어 있고 소유한 데이터 소스와 저장 지표가 있다.

## Main Success Scenario

1. 운영 담당자가 저장 지표를 이용한 분석을 요청한다.
2. 시스템이 소유한 데이터 소스의 저장 지표를 분석 생성에 제공한다.
3. 시스템이 참조된 저장 지표의 계산 기준으로 미리보기를 보여준다.
4. 운영 담당자가 결과를 검토하고 저장한다.
5. 시스템이 같은 계산 기준의 분석을 다시 보여준다.

## Alternative Flows

### A1: Invalid reference

**Trigger:** 참조 지표가 해당 데이터 소스의 활성 지표가 아니다 (step 3).
**Flow:**

1. 시스템이 참조 오류를 알려 생성 결과를 수정 요청한다.
2. 반복 실패하면 저장하지 않는다.
3. Use case ends.

### A2: No saved metric reference

**Trigger:** 요청이 새 지표이거나 생성 결과가 저장 지표를 참조하지 않는다 (step 3).
**Flow:**

1. 시스템이 기존 검증된 새 지표 생성 흐름을 사용한다.
2. Use case continues at step 4.

## Postconditions

### Success Postconditions

- 참조한 지표의 계산식으로 미리보기·저장 분석이 생성된다.
- 기존 저장 지표와 원본은 변경되지 않는다.

### Failure Postconditions

- 잘못된 참조로 생성된 분석은 저장되지 않는다.

## Business Rules

### BR-001: Authorized catalog

해당 운영 담당자 소유 데이터 소스의 활성 구조화 지표만 제공한다. 최대30개로 제한한다. 손상된 정의는 제공하지 않는다.

### BR-002: Canonical expression

참조가 명시된 지표는 서버의 기존 구조화 계산기를 사용한다. AI가 작성한 계산식은 해당 위젯에서 대체하며 분류별·시간별 집계도 같은 식을 사용한다.

### BR-003: Immutable source definition

분석의 표시·제목·차트 변경은 저장 지표를 수정하지 않는다. 생성 결과의 참조는 계산식 snapshot으로 저장되며 live 참조형 새 DB스키마는 추가하지 않는다.
