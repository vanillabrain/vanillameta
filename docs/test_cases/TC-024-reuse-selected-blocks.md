# Test Case: Reuse Selected Blocks

## Overview

**ID:** TC-024
**Goal:** 누락 열 블록을 제외해 안전하게 복제한다.
**Status:** Draft

## Flow

| Step | Name   | Description                                                    | Use Case                                               |
| ---- | ------ | -------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | Select | 누락 소스의 영향 블록 확인→제외→필수 연결→미리보기→저장→reload | [UC-024](../use_cases/UC-024-reuse-selected-blocks.md) |

## Validation

- 전체 선택은 기존 동작, 빈/중복/타 원본 ID와 불필요한 매핑은 서버 거절.
- 선택 원본 순서/모든 폭 좌표·새 ID·비공개 복사본·원본 보존.
- 선택 복원은 누락 안내/preview 무효화, 결과 불명확 저장은 같은 영수증.
- 소유/게시 수신자 API·Ego 실제 화면/XHR와390/768/1440 크기·정렬 확인.

## Execution

PASS_SELECTED_VARIANTS. [Ego55/API·단위/통합 검증](../testing/reuse-block-selection.md). 운영/실기기·모든 경합·제품 수용은 Open.
