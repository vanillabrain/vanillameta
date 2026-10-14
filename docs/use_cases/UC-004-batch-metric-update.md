# Use Case: Batch Metric Update

## Overview

**Use Case ID:** UC-004
**Use Case Name:** Batch Metric Update
**Primary Actor:** 운영 담당자
**Goal:** 같은 저장 지표의 계산식 변경을 선택한 관련 분석들에 일괄 반영한다.
**Trigger:** 계산식 변경 창에서 같은 지표를 쓰는 분석을 확인한다.
**Status:** Tested
**Requirements:** [FR-006](../requirements.md)

## Preconditions

- 소유한 DuckDB 소스·활성 저장 지표·현재 분석이 있다.

## Main Success Scenario

1. 담당자가 집계 방식/컬럼을 변경하고 영향받는 분석을 확인한다.
2. 시스템이 동일 소스의 명시 지표 연결을 가진 소유 분석과 차트 개수를 보여준다.
3. 담당자가 최대10개 분석을 선택하고 결과를 미리본다.
4. 시스템이 각 대상의 숫자·시계열 또는 분류 차트와 변경 식을 보여준다.
5. 담당자가 지표·분석 일괄 저장을 누른다.
6. 새로고침하여 모든 선택 분석의 변경 결과를 확인한다.

## Alternative Flows

### A1: Unlinked legacy analysis

**Trigger:** 같은 이름/SQL이어도 저장 지표 연결 정보가 없다 (step 2).
**Flow:**

1. 시스템이 미연결 분석은 자동 목록에 포함하지 않는다고 안내한다.
2. 담당자가 해당 분석에서 지표를 명시 선택해 계산식 변경을 저장하면 연결을 기록한다.
3. Use case continues at step 1.

### A2: Conflict or failure

**Trigger:** 미리보기 후 지표/대상 분석 버전이 바뀌거나 저장이 실패한다 (step 5).
**Flow:**

1. 전체 지표·분석 저장을 rollback한다.
2. 오류를 안내하고 영향 목록을 다시 확인한다.
3. Use case continues at step 2.

## Postconditions

### Success Postconditions

- 지표 버전이 한 번 증가하고 선택한 모든 연결 차트의 SQL/정의 snapshot이 갱신된다.
- 미선택 분석·다른 지표·다른 소스의 차트는 그대로다.

### Failure Postconditions

- 해당 일괄 저장으로 지표/분석/위젯/데이터셋의 일부 변경이 남지 않는다.

## Business Rules

### BR-001: Proven owned links

목록은 actor 소유 분석과 같은 sourceId 및 metricId의 저장 연결로 확정한다. 현재 차트의 수동 선택은 포함한다. 이름/SQL 유사성은 연결 근거가 아니다. raw AI 분석의 명시 선택은 기존 structuredDefinition JSON에 metric-linked-analysis snapshot으로 기록한다. DB migration은 없다.

### BR-002: Bound and visible scope

현재 분석은 포함하며 사용자 선택은 분석10개까지다. 목록에 분석 제목·차트 개수·버전을 보여준다. 미리보기 이후 대상/계산/조회 조건 변경은 저장을 막는다. 각 분석 안의 동일 지표 연결 차트는 모두 반영한다.

### BR-003: Atomic version check

각 대상의 dashboard revision과 지표 definitionVersion을 요구한다. 서버가 대상과 SQL을 재컴파일하고 공통 transaction에서 지표 CAS 한 번 및 분석 CAS를 실행한다. 어떤 실패도 전체 rollback한다. 신규 연결 분석이 나중에 추가되면 기존 선택에 몰래 포함하지 않는다.
