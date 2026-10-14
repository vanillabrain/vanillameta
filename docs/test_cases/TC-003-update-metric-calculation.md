# Test Case: Update Metric Calculation

## Overview

**ID:** TC-003
**Goal:** Rill 데모 요청 수 지표의 SUM을 AVG로 변경하고 기존 분석의 선택 차트에 반영한다.
**Priority:** High
**Status:** Reviewed

## Roles

- 운영 담당자: 변경·검토·저장.

## Preconditions

- Rill 공식 광고 파일을 저장한 소스와 활성 요청 수 지표, 숫자+추세 분석이 있다. 검증용 복제 지표를 사용해 기존 Total Requests 정의를 보존한다.

## Flow

| Step | Name    | Description                                      | Test Data            | Use Case                                                   |
| ---- | ------- | ------------------------------------------------ | -------------------- | ---------------------------------------------------------- |
| 1    | Change  | 지표와 숫자 차트를 선택하여 SUM을 AVG로 변경한다 | bid_request_cnt      | [UC-003](../use_cases/UC-003-update-metric-calculation.md) |
| 2    | Preview | 계산식·숫자+추세와 같은 조회 조건을 확인한다     | 원본 DuckDB AVG 정답 | -                                                          |
| 3    | Save    | 지표와 기존 분석을 저장한다                      | 두 버전 확인         | -                                                          |
| 4    | Reload  | 변경된 결과·SQL·지표 버전을 확인한다             | 다른 차트 불변       | -                                                          |

## Validation

1. 단위/API: canonical 식, WHERE/정렬 보존, 소유권, 버전 충돌, 저장 실패 rollback.
2. 실제 화면/XHR: 변경→미리보기→저장→새로고침. Rill AVG 원본식과 비교, 공식 데모 정의는 보존한다.
3. 디자인: 390/1440 입력32px·버튼28px·폰트12px, modal overflow/겹침 확인.

## Postconditions

- 검증용 지표/분석은 남기며 기존 공식 지표/원본은 변경하지 않는다.
