# Test Case: Browser Draft Recovery

## Overview

**ID:** TC-025
**Goal:** [UC-025](../use_cases/UC-025-recover-browser-draft.md)의 새로고침 복구를 검증한다.
**Status:** Draft

## Flow

| Step | Name    | Description                                     | Use Case                                               |
| ---- | ------- | ----------------------------------------------- | ------------------------------------------------------ |
| 1    | Recover | 실패→reload→명시 복구→재질문→미리보기→저장→게시 | [UC-025](../use_cases/UC-025-recover-browser-draft.md) |

## Validation

- 로그인세션/탭/분석 범위·권한 조회 선행, 손상/만료/한도/저장 불가 안내.
- 복구 전 덮어쓰기0·preview/실행 자동복원0, 미저장 제목/질문/블록/배치 보존.
- 다른revision/불명확 저장은 기존 상태 확인·충돌 복구, source변경 복구 차단.
- 성공 저장/폐기/초기화/로그아웃 제거, 실패는 보존, 다른 저장소 key 불변.
- Ego 실제 흐름·원본 보존·390/768/1440 대표 정렬·추가쓰기0.

## Execution

PASS_SELECTED_VARIANTS. [Ego65/단위/핵심 회귀 증빙](../testing/browser-draft-recovery.md). [실행 계획](../plans/UC-025.md). 운영·실기기·브라우저 재시작/다른 기기는 범위 밖이다.
