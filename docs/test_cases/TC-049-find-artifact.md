# Test Case: Find My Artifact

## Overview

**ID:** TC-049
**Goal:** 허용 목록에서 산출물을 찾고 기존 저장본으로 이동한다.
**Status:** Draft

## Flow

| Step | Name     | Description                     | Use Case                                       |
| ---- | -------- | ------------------------------- | ---------------------------------------------- |
| 1    | Discover | 제목/유형/정렬을 함께 적용      | [UC-049](../use_cases/UC-049-find-artifact.md) |
| 2    | Recover  | 결과 없음 초기화·페이지 복귀    | [UC-049](../use_cases/UC-049-find-artifact.md) |
| 3    | Open     | 기존 조회/Studio/수정/삭제 유지 | [UC-049](../use_cases/UC-049-find-artifact.md) |

## Validation

BR04901: 서버 제공 목록만 사용·추가 요청 없음. BR04902: 검색/AND/정렬·원본 순서 불변·두 번째 페이지에서 검색 시 첫 페이지. BR04903: 기존 링크/삭제 콜백과 초기화 유지. 실제 화면/모바일은 로그인 gate가 해소된 후 검증한다.

## Execution

[검증 기록](../testing/artifact-library.md). 컴포넌트/정적 검사를 실제 화면 통과로 간주하지 않는다.
