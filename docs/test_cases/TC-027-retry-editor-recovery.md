# Test Case: Retry Editor Recovery

## Overview

**ID:** TC-027
**Goal:** [UC-027](../use_cases/UC-027-retry-editor-recovery.md)의 오류 후 반복 복구를 검증한다.
**Status:** Draft

## Flow

| Step | Name           | Description                                                                                  | Use Case                                               |
| ---- | -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | Retry recovery | 초안 복구→조회503→보존/재시도→병합/preview→실제409→보존/재조회→병합/preview→저장/게시/reload | [UC-027](../use_cases/UC-027-retry-editor-recovery.md) |

## Validation

- 오류마다 초안/질문/기준본 보존·복구 잠금·자동 쓰기0.
- 재조회는 실제 최신 revision·비대상 변경 보존, 전체 새 preview 전에 저장 불가.
- 저장 성공 후 보관 정리·동일 revision 게시·reload·모바일 정렬/넘침0.

## Execution

PASS_SELECTED_VARIANTS. [Ego67·단위·정렬 검증](../testing/retry-editor-recovery.md).503은1회 프록시 주입,409는 실제 둘째 탭 저장이다. 반복503 전체 조합/실휴대폰/운영은 미확인이다.
