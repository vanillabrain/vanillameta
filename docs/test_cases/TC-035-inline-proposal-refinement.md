# Test Case: Inline Creation Preview Refinement

## Overview

**ID:** TC-035
**Goal:** 같은 대화에서 저장 전 생성안을 재질문하고 전체 미리보기·명시 저장한다.
**Status:** Draft

## Flow

| Step | Name           | Description                                       | Use Case                                                    |
| ---- | -------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| 1    | Refine preview | 생성→미리보기→수정/추가→전체 미리보기→저장→reload | [UC-035](../use_cases/UC-035-inline-proposal-refinement.md) |

## Validation

- BR03501: 선택 블록만 변경/기존 ID·비대상 유지·새 블록 추가 최대6개, 원본 불변.
- BR03502: 소유권/부모/기준 확인·혼합/잘못된 입력 거절·동일 재시도·낡은 응답 차단.
- BR03503: 미리보기 시 저장0, 실패/질문 보존·불명확 시 변경/저장 잠금, 명시 저장1개와reload.
- A1/A2/A3: 미완성/변경 없음/만료/권한·모바일 입력·버튼 크기/정렬을 선택 검증한다.

## Execution

PASS_SELECTED: Ego77 실패→재질문/제목 수정→새 블록 추가→전체 미리보기→명시 저장44/reload와390/768/1440을 확인했다. [증빙](../testing/inline-proposal-refinement.md)에 실제/컴포넌트·디자인·미실행을 구분했다. 전체 수용은 Open이다.
