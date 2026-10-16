# Test Case: Interrupted Token Renewal

## Overview

**ID:** TC-030
**Goal:** [UC-030](../use_cases/UC-030-retry-token-renewal.md)의 일시 실패 보존과 살아 있는 탭 인계를 검증한다.
**Status:** Draft

## Flow

| Step | Name              | Description                                                    | Use Case                                             |
| ---- | ----------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| 1    | Transient failure | 만료→refresh503→질문/초안/세대보존→reload/복구→명시재시도      | [UC-030](../use_cases/UC-030-retry-token-renewal.md) |
| 2    | Holder closes     | 두 탭held/pending→보유탭종료→대기탭preview→save/publish/reload | [UC-030](../use_cases/UC-030-retry-token-renewal.md) |

## Validation

-401/403정리와503/네트워크/timeout/잘못된응답보존을 구분하고 새 로그인 경계를 유지한다. -살아있는탭 초안/질문/정의/배치 보존·명시쓰기·모바일 정렬을 확인한다.

## Execution

PASS_SELECTED_VARIANTS. [Ego70·회귀·미확인 범위](../testing/retry-token-renewal.md).
