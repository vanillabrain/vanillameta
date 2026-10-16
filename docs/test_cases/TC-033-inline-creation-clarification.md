# Test Case: Inline Creation Clarification

## Overview

**ID:** TC-033
**Goal:** 같은 대화의 분모 답변과 최신 미리보기/명시 저장을 검증한다.
**Status:** Draft

## Flow

| Step | Name          | Description                                                  | Use Case                                                       |
| ---- | ------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| 1    | Inline answer | 소유 대화 질문→분모 선택→미리보기→명시 저장→reload/원본 불변 | [UC-033](../use_cases/UC-033-inline-creation-clarification.md) |

## Validation

- BR03301: 원 질문/소스/권한을 서버에서 고정. 타계정·원제안/기준 불일치·잘못된 답변은 거절한다.
- BR03302: 답변 전후 dashboard/metric/publication0 증가, 명시 저장 후1개·반복은같은ID다.
- BR03303: 동일 동시요청/응답유실 재시도는 모델1회·새 바인딩, 다른 요청/지연결과409·최신 보존이다.
- A1/A2/A3: 실패 선택 보존·재시도, 만료/권한/저장완료·필수열 안내. 원본 초안/배치와390/768/1440 정렬을 확인한다.

## Execution

PASS_SELECTED: Ego75 질문→분모 답변→미리보기→비공개 저장42→reload, 응답 교체503/동일 답변 복구, 주문 기준 미리보기와390/768/1440을 확인했다. 단위/API/실제 화면의 범위 및 미실행은 [증빙](../testing/inline-creation-clarification.md)을 따른다. 전체 수용은 Open이다.
