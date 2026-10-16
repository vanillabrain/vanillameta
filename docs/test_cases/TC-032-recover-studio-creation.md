# Test Case: Recover Studio Creation Confirmation

## Overview

**ID:** TC-032
**Goal:** [UC-032](../use_cases/UC-032-recover-studio-creation.md)의 reload후동일저장확인을 검증한다.
**Status:** Draft

## Flow

| Step | Name                 | Description                                                                                 | Use Case                                                 |
| ---- | -------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | Recover confirmation | 실제질문/preview→명시저장/응답유실→reload/권한조회→기록/질문→명시동일요청확인→기존ID/reload | [UC-032](../use_cases/UC-032-recover-studio-creation.md) |

## A5: Request not delivered

| Step | Name                      | Description                                                                            | Use Case                                                 |
| ---- | ------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | Fresh save after recovery | 실제제안→저장미전달503/쓰기0→reloadGET만/질문복구→동일요청확인/최초저장1→같은ID/reload | [UC-032](../use_cases/UC-032-recover-studio-creation.md) |

PASS_SELECTED_VARIANTS. [Ego73 미전달 실제 검증](../testing/recover-studio-creation.md#a5-미전달-저장-후속--2026-10-16). 제안만료/서버재시작/실기기는 미검증이다.

## Validation

-기록의형식/크기/24h·authscope/refresh·쓰기실패와명시폐기를회귀로확인한다.
-reload POST0/SQL·preview·토큰미보관·같은body·추가dashboard/journal0·정상성공정리. -원본·수치·정의와390/768/1440크기/정렬보존.

## Execution

PASS_SELECTED_VARIANTS. [Ego72·회귀·남은 경계](../testing/recover-studio-creation.md).

## A6 and integration follow-up

- 미전달→실제 서버 재시작→reload→동일 확인의 구조화400→질문/소스 유지한 명시 재제안→새 미리보기→최초 비공개 저장. 일반400/403/409/5xx는 새 저장 요청으로 우회하지 않는다.
- 대화의 분모 확인 링크→실제 새 탭의 원 질문 복원→금액 답변→계산→저장/게시/소스 교체 복제와 원본 보존.
- 복제본 선택 AI 수정 뒤 별도 저장 질문, 추가 보존 문장이 있는 복합 명시 저장의 재검증. 인용/부정 저장은 저장0회다.
- 최신 실행/제한은 [1–5 통합 증빙](../testing/studio-completion-1-5.md)을 따른다. 고객 데이터·실휴대폰·운영MySQL·전체 수용을 통과로 확대하지 않는다.
