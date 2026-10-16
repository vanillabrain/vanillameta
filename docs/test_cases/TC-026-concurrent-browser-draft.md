# Test Case: Concurrent Browser Draft Recovery

## Overview

**ID:** TC-026
**Goal:** [UC-026](../use_cases/UC-026-recover-concurrent-browser-draft.md)의 최신본 보존 복구를 검증한다.
**Status:** Draft

## Flow

| Step | Name                     | Description                                                                        | Use Case                                                          |
| ---- | ------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1    | Recover concurrent draft | 다른 탭 저장→reload→버전 차이 안내→초안 복구→명시 병합→재미리보기→저장→게시/reload | [UC-026](../use_cases/UC-026-recover-concurrent-browser-draft.md) |

## Validation

- 복구 전 안내와 후보 보존·복구/상태확인 쓰기0.
- 조회 실패 초안/질문/잠금 유지, 같은필드 충돌 명시 선택·비대상 최신 변경 보존.
- 병합 후 이전 미리보기 없음·최신 revision CAS/재미리보기 요구.
- 저장/게시/reload·원본/ID/계산/폭별 배치 보존·모바일 정렬/넘침0.

## Execution

PASS_SELECTED_VARIANTS. [Ego66·단위 검증과 미확인 범위](../testing/concurrent-browser-draft.md). 같은필드/비충돌·조회실패·재경합은 컴포넌트, 실제 화면은 제목 충돌+비대상 최신 OS 보존 흐름이다.
