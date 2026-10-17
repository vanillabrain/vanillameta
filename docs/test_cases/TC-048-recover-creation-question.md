# Test Case: Recover New Creation Question

## Overview

**ID:** TC-048
**Goal:** 새 생성 질문·선택 소스를 명시 복구하고 자동 요청을 방지한다.
**Status:** Draft

## Flow

| Step | Name     | Description                                          | Use Case                                                   |
| ---- | -------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| 1    | Retain   | 소스/질문 입력→새로고침                              | [UC-048](../use_cases/UC-048-recover-creation-question.md) |
| 2    | Restore  | 권한 목록→명시 복구→소스 재확인→질문 입력            | [UC-048](../use_cases/UC-048-recover-creation-question.md) |
| 3    | Boundary | 접근 거절·직접 링크·보관 오류·명시 폐기/저장 후 정리 | [UC-048](../use_cases/UC-048-recover-creation-question.md) |

## Validation

- BR04801:2000자·24h·8KiB·키 분리·잘못된/추가 필드·손상/한도·scope 없음/보관 실패.
- BR04802:재마운트 자동POST0·명시복구 후 입력·소스 확인 실패의 본문 미적용·기록 보존·직접 링크 우선.
- BR04803:현재 질문 저장 성공 정리·명시 폐기·비대상 기록 보존.

- A3: 다른 소스 선택만으로 기록 불변/입력 비어 있음·자동POST0 → 명시 복구의 새 소스 재조회 → 질문/새 sourceId 보관. 재조회403은 원래 기록 보존 후 다른 소스 선택으로 명시 재시도한다.

## Execution

컴포넌트/보관 회귀 실행은 [증빙](../testing/creation-question-recovery.md)을 따른다. 기존 로그인 차단으로 Ego/실제3폭 검증은 BLOCKED이며 전체 제품 수용이 아니다.
