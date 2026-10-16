# Test Case: Saved Dashboard Publication Conflict

## Overview

**ID:** TC-038
**Goal:** 다른 탭 변경 후 게시 충돌을 최신 저장본 확인과 명시 게시로 복구한다.
**Status:** Draft

## Flow

| Step | Name             | Description                                                     | Use Case                                              |
| ---- | ---------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| 1    | Recover conflict | 다른 탭 저장→실제409→최신 저장본 확인→미리보기→게시→reload·중지 | [UC-038](../use_cases/UC-038-publication-conflict.md) |

## Validation

- BR03801:409 게시 잠금·같은 버전 reopen 잠금·버전 변경 해제·유실 재시도 불변.
- BR03802:정확한 새 대시보드 링크·기존 원본/미저장 초안 보존·읽기 후 명시 게시.
- BR03803:기존 게시본 무변경·공개 범위 명시·390/768/1440 크기/정렬/넘침.
- A1/A2:기존 조회 실패 경로/반복409의 검증 범위를 실행 증빙과 구분한다.

## Execution

PASS_SELECTED: Ego80의 다른 탭 실제 저장→409→45번 최신 화면→미리보기/게시1/reload→중지410, 원본39 보존·45 내용 원복 및390/768/1440을 확인했다. FE47/type/lint/build/core8·실제 증빙40개 PASS. A1/A2의 실제 화면 전체와 수용은 Open. [증빙](../testing/publication-conflict.md).
