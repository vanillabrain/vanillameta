# Test Case: Batch Block Edit

## Overview

**ID:** TC-016
**Goal:** [UC-016](../use_cases/UC-016-batch-block-edit.md)의 전체 적용·원자 저장·부분 실패 복구.
**Priority:** High
**Status:** Draft

## Roles

- 운영 담당자: 다중 변경 질문·미리보기·저장·실패 복구.

## Preconditions

공개 Rill 분석22, Codex/gpt-6-luna, 현재 revision·4블록.

## Flow

1. 두 블록의 명시 변경을 질문하고 전체 결과를 확인한다.
2. undo/redo가 전체를 전환하고 저장/reload가 두 결과를 보존한다.
3. 일부 변경을 실패시켜 전체 무변경을 확인하고 수정 질문으로 재시도한다.
4. 저장 중간 실패 rollback과390/768/1440 UI를 확인한다.

## Validation

| ID        | 검증                         | 기대                                                                                                | 상태                                   |
| --------- | ---------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------- |
| TC-016-01 | 분류/대상/권한/revision      | strict2~6·원문참조·추가키/임의키/누락플래그거절·내용+다른블록배치batch·중복/모호전체거절·선검사     | PASS 단위                              |
| TC-016-02 | 변경/preview 부분실패·취소   | 전체적용0·DB0·질문/초안/이력 유지·재시도                                                            | PASS 단위·Ego change실패/재시도        |
| TC-016-03 | 전체응답/이력/저장           | 모든응답검증·단일undo/redo·이후변경preview무효화·frozen전체save·저장실패/응답유실초안유지·409재조회 | PASS FE·Ego / 실제save409·유실 NOT_RUN |
| TC-016-04 | transaction 중간실패         | SQLite 두번째widget연결쓰기실패→전체rollback·includeRevision재조회불변                              | PASS 실제SQLite trigger중간실패        |
| TC-016-05 | 실제질문→preview→save→reload | 두변경·비대상/SQL/다른폭보존                                                                        | PASS Ego·XHR·정의대조                  |
| TC-016-06 | UI                           | 390/768/1440·28/32px·정렬/넘침                                                                      | PASS Ego390/768/1440 / 실기기 NOT_RUN  |

범위·발견/수정·남은검증은 [실행기록](../testing/batch-block-edit.md)을 따른다. Draft는 승인과 별개다.
