# Test Case: Batch Metric Update

## Overview

**ID:** TC-004
**Goal:** Rill 공식 광고 데이터를 쓰는 같은 검증 지표의 숫자·OS 분석을 일괄 변경한다.
**Priority:** High
**Status:** Tested

## Roles

- 운영 담당자: 영향 확인·선택·검토·저장.

## Preconditions

- source7의 검증용 저장 지표와 같은 지표로 저장한 숫자/OS 분석이 있다. 원래 공식 지표는 보존한다.

## Flow

| Step | Name    | Description                                                  | Test Data                  | Use Case                                             |
| ---- | ------- | ------------------------------------------------------------ | -------------------------- | ---------------------------------------------------- |
| 1    | Impact  | 연결된 분석 제목과 차트 개수를 확인한다                      | 숫자·OS 분석               | [UC-004](../use_cases/UC-004-batch-metric-update.md) |
| 2    | Preview | AVG를 SUM으로 바꾸고 각 분석을 미리본다                      | 634513000, OS합계634513000 | -                                                    |
| 3    | Save    | 지표와 선택 분석들을 일괄 저장한다                           | 지표 버전1회 증가          | -                                                    |
| 4    | Reload  | 각 분석을 새로고침하여 숫자·시계열·OS 결과와 연결을 확인한다 | 다른 분석 불변             | -                                                    |

## Validation

1. SQLite/API: 소유권·삭제/소스/미연결 제외·다중 차트·선택 한도·지표/각 분석 경합·후반 실패 전체 rollback.
2. 실제 UI/XHR: 영향 확인→복수 미리보기→일괄 저장→각 분석 reload. Rill 같은 measure 수정 후 Explore/Pivot 반영과 비교한다.
3. 디자인: 목록/checkbox/접힌 미리보기·입력·버튼의390/1440 정렬·밀도·폭 전환 상태 유지.

## Postconditions

- 검증 fixture는 남기고 공식 지표와 원본은 보존한다.
