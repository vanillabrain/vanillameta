# Test Case: Saved Metric Analysis

## Overview

**ID:** TC-002
**Goal:** 운영 담당자가 저장한 요청 수 지표를 AI 분석으로 재사용해 같은 수치를 확인한다.
**Priority:** High
**Status:** Reviewed

## Roles

- 운영 담당자: 요청·검토·저장.

## Preconditions

- 기존 소유 Rill 광고 소스7과 활성 구조화 지표가 있다. Rill 공식 광고 파일의 전체 기간을 사용한다.

## Flow

| Step | Name                  | Description                                | Test Data                                                  | Use Case                                                  |
| ---- | --------------------- | ------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Request saved measure | 저장 지표를 요청한다.                      | 저장된 요청 수 지표로 전체 요청 수와 OS별 요청 수를 보여줘 | [UC-002](../use_cases/UC-002-reuse-saved-metric.md)       |
| 2    | Verify expression     | 저장 지표 재사용과 두 KPI·추세를 확인한다. | 지표3/4, 634513000, $5.57                                  | -                                                         |
| 3    | Save analysis         | 미리보기를 검토하고 저장한다.              | -                                                          | [UC-001](../use_cases/UC-001-review-and-save-analysis.md) |
| 4    | Reload                | 다시 조회하여 같은 계산 기준을 확인한다.   | 634513000                                                  | [UC-001](../use_cases/UC-001-review-and-save-analysis.md) |

## Validation

1. **Canonical:** 참조한 지표에 서버 계산식이 적용된다.
2. **Ownership:** 다른 소스/계정의 지표는 제공하지 않고 잘못된 참조는 거부한다.
3. **Preservation:** 저장 지표와 원본은 변경되지 않는다.

## Postconditions

- 검증용 분석은 남기며 원본 지표는 수정/삭제하지 않는다.

## Explicit selection regression

- OS별 차트와 Total Requests를 선택해 수정 요청한다. AI가 metricId를 생략해도 SUM(bid_request_cnt)가 적용되고 두 KPI는 그대로다.
- 미리보기에서 서버 확인된 지표명을 읽고 저장·새로고침 후 같은 분류 수치/SQL을 확인한다.
- 목록/선택 상태 변경은 기존 미리보기 저장을 차단한다. 잘못된 ID/대상/복수 출력은 거부한다.
- 데스크톱과 390px에서 선택 입력·버튼·주변 레이아웃의 높이, 폰트, 정렬, overflow를 확인한다.
