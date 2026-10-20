# Test Case: Concurrent Token Renewal

## Overview

**ID:** TC-029
**Goal:** [UC-029](../use_cases/UC-029-concurrent-token-renewal.md)의 다중 탭 갱신과 초안 복구를 검증한다.
**Status:** Draft

## Flow

| Step | Name               | Description                                                                          | Use Case                                                  |
| ---- | ------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 1    | Concurrent renewal | 두 탭401→잠금 대기/refresh1회→원 preview201→양쪽reload/복구→한탭preview/save/publish | [UC-029](../use_cases/UC-029-concurrent-token-renewal.md) |

## Validation

- 실제 브라우저 held/pending·refresh1회·각 원 preview201과 같은 세대/scope.
- 새 로그인 뒤 옛 요청 차단·잠금 오류/만료가 새 인증/초안을 지우지 않음.
- 각 탭 질문·초안 분리·명시 복구/저장/게시·수치·배치 보존·모바일 넘침0.

## Execution

PASS_SELECTED_VARIANTS. [Ego69·회귀·미확인 범위](../testing/concurrent-token-renewal.md). 실제 두 탭 Web Locks held/pending·refresh1회·각 preview201·독립 초안 복구를 확인했다.
