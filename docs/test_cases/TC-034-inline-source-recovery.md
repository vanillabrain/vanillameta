# Test Case: Inline Missing Field Recovery

## Overview

**ID:** TC-034
**Goal:** 같은 대화에서 부족한 소스를 교체하고 원 질문의 저장까지 이어간다.
**Status:** Draft

## Flow

| Step | Name           | Description                                              | Use Case                                                |
| ---- | -------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| 1    | Recover source | 질문→열 누락→소스 선택→원 질문 미리보기→명시 저장→reload | [UC-034](../use_cases/UC-034-inline-source-recovery.md) |

## Validation

- BR03401: 소유 실행/필수 열 질문/원 제안·버전과 새 소스 권한을 확인한다. 원 질문·이전 분모를 서버에서 보존한다.
- BR03402: 소스 선택/미리보기는 저장0, 명시 저장1개, 원본 초안/소스/배치 불변이다.
- BR03403: 응답 실패 선택 보존·같은 요청 재시도·다른 요청409·낡은 결과 차단을 검사한다.
- A1/A2/A3: 목록 재시도·새 소스에도 열 누락·권한/만료 및390/768/1440 컨트롤 정렬을 선택 검증한다.

## Execution

PASS_SELECTED: Ego76 두 Rill 소스의 열 누락→source32 교체→미리보기→비공개 저장43→reload 및 이전 amount 답변 보존을 확인했다. [증빙](../testing/inline-source-recovery.md)에 단위/실제 화면·디자인과 미실행 범위를 구분했다. 전체 수용은 Open이다.
