# Test Case: Block Layout Continuity

## Overview

**ID:** TC-006
**Goal:** 직접 편집 배치와 논리 ID를 선택 블록 AI 수정 후 재조회까지 유지한다.
**Priority:** High
**Status:** Reviewed

## Roles

- 운영 담당자: 이동/resize·AI 수정·저장·새로고침.

## Preconditions

- 소유 fixture에 서로 다른 위치/크기의 숫자·OS 블록이 있다. 실제 fixture ID는 실행 증빙에 기록한다.

## Flow

| Step | Name    | Description                    | Test Data     | Use Case                                               |
| ---- | ------- | ------------------------------ | ------------- | ------------------------------------------------------ |
| 1    | Arrange | 편집기에서 이동/resize 저장    | grid geometry | [UC-006](../use_cases/UC-006-preserve-block-layout.md) |
| 2    | Revise  | 특정 블록을 AI로 수정/미리보기 | 실제 지정 LLM | -                                                      |
| 3    | Save    | preview 저장                   | 최신revision  | -                                                      |
| 4    | Reload  | 각 ID/내용/배치와 표시 확인    | 비대상 불변   | -                                                      |

## Validation

1. SQLite: 레거시 조회 무쓰기/결정적 ID, 새 ID 발급, DB ID remapping, 순서 변경/삭제/추가, 중복/알 수 없는 ID 차단, A1충돌 rollback.
2. 실LLM 선택 수정: 비대상 보존과 target ID, geometry 유지. Rill 계산 기준은 기존 공식 sample을 재사용한다.
3. 실제 Aside desktop 이동/resize/AI/save/reload.390/768/1440 조회 시 동일 내용 유지 및 컨트롤/차트 가시성. 반응형 editor 전체는 후속이다.

## Postconditions

- fixture/증빙은 보존하고 사용자 원본은 삭제하지 않는다. TC-005/P1 전체 완료로 확대하지 않는다.
