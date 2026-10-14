# UC-011: AI Block Layout

## Overview

**Use Case ID:** UC-011
**Use Case Name:** AI Block Layout
**Primary Actor:** 분석 소유 사용자
**Goal:** 선택 블록·화면 폭의 배치를 AI로 변경하고 저장한다.
**Trigger:** AI 변경 목적에서 배치를 선택하고 요청한다.
**Status:** Draft
**Requirements:** [FR-009, FR-010](../requirements.md)

## Preconditions

- 소유 분석과 현재 버전의 초안이 열려 있고 블록이 선택되어 있다.

## Main Success Scenario

1. 사용자는 AI로 수정에서 블록을 선택하고 목적을 배치로 지정한다.
2. 편집할 화면 폭을 선택하고 “오른쪽으로 한 칸 옮겨 줘”처럼 요청한다.
3. 서버는 현재 초안·권한·버전을 검증하고 선택 폭의 좌표와 제목만 AI에 전달한다.
4. AI 좌표를 서버가 검증하고 선택 블록의 선택 폭만 대체하여 실제 미리보기를 반환한다.
5. 사용자는 결과를 확인하고 되돌리거나 명시 저장한다. 저장·새로고침 후 좌표가 유지된다.

## Business Rules

### BR-011-01: Preserve content

SQL/지표/차트 종류/다른 블록/다른 폭은 AI 배치 응답으로 바꾸지 않는다.

### BR-011-02: Validate geometry

정수·범위·겹침·버전·소유권을 기존 서버 경계에서 재검증한다.

### BR-011-03: Draft only

제안은 공통 초안 이력에만 적용되며 자동 저장하지 않는다.

### BR-011-04: Failure isolation

미지원·오류·취소·오래된 응답은 초안을 덮어쓰지 않는다. 다른 모델로 대체하지 않는다.

## Alternative Flows

### A1: Unsupported or invalid request

**Trigger:** 내용 수정·모호한 요청·범위 초과·겹침이 발생한다 (step 4).
**Flow:**

1. 시스템은 적용하지 않고 현재 초안을 보존한다.
2. 사용자가 요청을 수정한다.
3. Use case continues at step 2.

### A2: Cancel or conflict

**Trigger:** 요청을 취소하거나 다른 화면에서 저장한다 (step 3).
**Flow:**

1. 취소된 응답을 버리거나409 충돌을 표시한다.
2. 현재 초안은 유지한다. Use case ends.

## Postconditions

### Success Postconditions

- 선택 배치 변경이 미리보기되고 명시 저장 후 좌표가 유지된다.

### Failure Postconditions

- 기존 저장 분석과 미저장 초안의 일부를 덮어쓰지 않는다.

## References

[계획](../plans/UC-011.md), [TC-011](../test_cases/TC-011-ai-block-layout.md).
