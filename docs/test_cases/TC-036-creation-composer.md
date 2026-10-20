# Test Case: Creation Composer Continuation

## Overview

**ID:** TC-036
**Goal:** 기존 대화 입력에서 생성안 수정과 명시 저장을 이어간다.
**Status:** Draft

## Flow

| Step | Name              | Description                                               | Use Case                                           |
| ---- | ----------------- | --------------------------------------------------------- | -------------------------------------------------- |
| 1    | Continue creation | 생성→기존 입력창 수정/추가→전체 미리보기→명시 저장→reload | [UC-036](../use_cases/UC-036-creation-composer.md) |

## Validation

- BR03601: 최신 미저장 생성안 표시·명시 원본 복귀·두 경로의 원본 보존.
- BR03602: 번호/제목/추가·명시 긍정 저장, 부정/혼합/모호한 대상의 무변경.
- BR03603: 질문/초안 보존·동일 요청 재확인·불명확 잠금·최신 바인딩/완료 저장/reload.
- A1/A2/A3: 실패/만료/접근 거절과390/768/1440 컨트롤·레이아웃을 선택 검증한다.

## Execution

PASS_SELECTED: Ego78 기존 입력창의 부정/모호 요청 차단→제목 수정→추가→명시 저장45와 원본 보존·390/768/1440을 확인했다. [증빙](../testing/creation-composer.md)에 실행/컴포넌트/미검증을 구분했다. 전체 수용은 Open이다.
