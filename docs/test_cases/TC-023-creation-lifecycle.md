# Test Case: Creation Lifecycle Continuation

## Overview

**ID:** TC-023
**Goal:** [UC023](../use_cases/UC-023-creation-lifecycle.md)의 생성→후속 저장/게시 질문 연결을 검증한다.
**Status:** Draft

## Flow

| Step | Name     | Description                                                                                                | Use Case                                            |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1    | Continue | 전체 Rill 파일 생성/기존 지표 재사용 → 현재 초안 저장·게시 준비 질문 → 원자 저장/revision → 별도 링크 게시 | [UC-023](../use_cases/UC-023-creation-lifecycle.md) |

새 소스·부정 요청·오류/취소·같은 영수증 재시도는 독립 확인한다.

## Validation

| ID      | Expected                                                  | Status                 |
| ------- | --------------------------------------------------------- | ---------------------- |
| TC02301 | 생성/후속 의도 strict 검증·쓰지 않는 미리보기             | PASS_SELECTED_VARIANTS |
| TC02302 | frozen proposal/digest/requestId 저장·새 revision handoff | PASS_SELECTED_VARIANTS |
| TC02303 | 부정/모호/취소/버전 변경/다른 소스에서 추가 쓰기0         | PASS_SELECTED_VARIANTS |
| TC02304 | 영수증 재생은 같은 ID·자동 게시 미리보기 없음             | PASS_SELECTED_VARIANTS |
| TC02305 | Ego 실제 질문/저장/게시/reload·390/768/1440 UI            | PASS_SELECTED_VARIANTS |

실행 범위·새 저장/재생·실LLM 제한·미검증은 [통합 증빙](../testing/dashboard-lifecycle.md)을 따른다. 자동 검사가 모든 자연어/실기기/운영 수용을 대신하지 않는다.
