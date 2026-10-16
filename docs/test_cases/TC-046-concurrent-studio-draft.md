# Test Case: Concurrent Studio Draft Recovery

## Overview

**ID:** TC-046
**Goal:** 다른 탭의 변경 뒤 초안·질문을 보존하고 병합 미리보기·저장·새로고침을 확인한다.
**Status:** Draft

## Flow

| Step | Name                | Description                                                        | Use Case                                                 |
| ---- | ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| 1    | Preserve draft      | 첫 탭 제목·복제·배치·질문 보관, 다른 탭 같은 제목·비대상 제목 저장 | [UC-046](../use_cases/UC-046-concurrent-studio-draft.md) |
| 2    | Compare and recover | reload→최신 조회→충돌 선택→전체 미리보기→질문 별도 복구            | [UC-046](../use_cases/UC-046-concurrent-studio-draft.md) |
| 3    | Save and verify     | 명시 저장→reload·비대상/배치/수치 보존·390/768/1440 확인           | [UC-046](../use_cases/UC-046-concurrent-studio-draft.md) |

## Validation

- BR-046-01/A2: v1 호환·v2 기준 검증·TTL/용량·로그인 분리, 구조/소스 변경 차단.
- BR-046-02/A1: 서로 다른 항목 보존·같은 항목의 두 값/기본 동의 없음·새 블록 모든 폭 배치.
- BR-046-03/A3: 조회 실패/409 재비교·지연 중 새 편집 보존·저장 후 조회 지연 중 기록 정리.

## Execution

PASS_SELECTED: Ego90 실제 두 탭의 충돌 비교/동의→미리보기→질문 복구→저장/reload·원본45 보존·46 내용 원복과390/768/1440을 확인했다. 장애/구조 변형은 회귀 증빙이며 실기기/운영/전체 수용은 별도다. [검증 증빙](../testing/concurrent-studio-draft.md).

A3 실제 후속 PASS_SELECTED: Ego91의 GET503 한 건→재조회→두 번째 실제 저장/preview409→최신 재조회/재동의→preview201/save201/reload, 기록/질문/서버 보존과390/768/1440을 확인했다. 회귀44/type/lint·실제 대조36개 PASS. [A3 증빙](../testing/studio-draft-retry.md).
