# Test Case: Confirm Uncertain Studio Creation

## Overview

**ID:** TC-031
**Goal:** [UC-031](../use_cases/UC-031-confirm-studio-creation.md)의 실제 커밋 후 응답 유실/동일요청 재확인을 검증한다.
**Status:** Draft

## Flow

| Step | Name                     | Description                                                           | Use Case                                                 |
| ---- | ------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | Recover private creation | 실제질문→미리보기→명시저장/commit뒤응답유실→동일요청확인→저장본reload | [UC-031](../use_cases/UC-031-confirm-studio-creation.md) |

## Validation

- 같은request/proposal/revision·동일ID·dashboard/journal증가1·게시0.
- 불명확상태 변경잠금·질문/미리보기보존·추가자동쓰기/AI0.
- 원본/수치/폭별UI 보존. 미전달/권한/바인딩은 기존단위와 실제검증을 구분한다.

## Execution

PASS_SELECTED_VARIANTS. [Ego71·회귀·남은 경계](../testing/confirm-studio-creation.md).
