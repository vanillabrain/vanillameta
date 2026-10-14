# Test Case: Consistent Analysis

## Overview

**ID:** TC-001
**Goal:** 운영 담당자가 Rill 광고 데이터 분석을 만들거나 수정하고 숫자·시계열 미리보기와 저장·새로고침 일치를 확인한다.
**Priority:** High
**Status:** Reviewed

## Roles

- 운영 담당자: 분석 검토·저장·재조회.

## Preconditions

- 기존 로컬3698/4898이 실행 중이며 소스7 rill-auction과 분석5가 존재한다. fixture는 기존 Rill 공식 auction_data.parquet이다. 로그인 정보는 증빙에 포함하지 않는다.

## Flow

| Step | Name             | Description                                                                 | Test Data                                                         | Use Case                                                  |
| ---- | ---------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Request analysis | 총 요청 수와 평균 Bid Floor 지표 및 OS별 막대를 요청한다.                   | 총 요청 수와 평균 Bid Floor를 유지하고 OS별 요청 수 막대를 보여줘 | [UC-001](../use_cases/UC-001-review-and-save-analysis.md) |
| 2    | Verify preview   | 두 숫자와 시계열, OS별 막대의 표시를 확인한다.                              | 634513000, 5.57                                                   | -                                                         |
| 3    | Inspect settings | 보조 설정과 저장 보기 관리를 펼쳐 기존 기능을 확인하고 닫는다.              | -                                                                 | [UC-001](../use_cases/UC-001-review-and-save-analysis.md) |
| 4    | Save analysis    | 검토한 분석을 명시적으로 저장한다.                                          | -                                                                 | [UC-001](../use_cases/UC-001-review-and-save-analysis.md) |
| 5    | Reload analysis  | 저장 화면을 새로고침한다.                                                   | -                                                                 | [UC-001](../use_cases/UC-001-review-and-save-analysis.md) |
| 6    | Verify parity    | 숫자·시계열·계산 기준이 유지되고 Rill의 같은 지표 표현과 대응함을 확인한다. | 634513000, 5.57                                                   | -                                                         |

## Validation

1. **Pairing:** 두 숫자에 시계열이 함께 보인다. 시간 데이터 없는 변형은 제공 불가 안내가 보인다.
2. **Persistence:** 저장한 정의가 재조회되며 추세는 현재 조건으로 다시 계산된다.
3. **Disclosure:** 접힌 보조 설정과 저장 보기를 펼칠 수 있고 기존 조회 기능은 유지한다.
4. **Layout:** 390px·1440px에서 미리보기와 조회 화면의 변경 영역이 겹치거나 가로로 넘치지 않는다.

## Postconditions

- 분석5의 정의를 검토 후 저장한다. 새 분석 생성 변형은 고유 제목으로 남긴다. 기존 원본과 사용자 저장 보기는 삭제하지 않는다.
