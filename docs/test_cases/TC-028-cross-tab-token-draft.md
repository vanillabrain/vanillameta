# Test Case: Cross Tab Token Draft Recovery

## Overview

**ID:** TC-028
**Goal:** [UC-028](../use_cases/UC-028-cross-tab-token-draft.md)의 다른 탭 갱신 후 복구를 검증한다.
**Status:** Draft

## Flow

| Step | Name              | Description                                                      | Use Case                                               |
| ---- | ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | Renew and recover | 다른 탭 refresh→첫 탭 reload→명시 복구→미리보기→저장→게시/reload | [UC-028](../use_cases/UC-028-cross-tab-token-draft.md) |

## Validation

- 공유 메타데이터는 토큰 해시/세대/scope만, 본문은 탭별 보관.
- 정상 갱신만 승계·새로그인/로그아웃 경계·늦은 refresh의 새 인증 덮어쓰기/제거 차단.
- 명시 복구 전 추가 쓰기0·질문/정의/ID/배치·수치 보존·성공 정리.
- 실제 refresh/XHR·모바일 컨트롤 정렬·정상 프록시 복원·게시 중지.

## Execution

PASS_SELECTED_VARIANTS. [Ego68·자동 회귀·모바일 증빙과 제한](../testing/cross-tab-token-draft.md). 실제 시간 만료 대신401만 주입하고 서버 refresh201을 확인했다. 다중 탭 동시 갱신/실기기/운영은 미확인이다.
