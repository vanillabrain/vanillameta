# Test Case: Copied Dashboard AI Edit and Publication

## Overview

**ID:** TC-022
**Goal:** [UC-022](../use_cases/UC-022-copy-ai-publication.md)의 통합 여정과 권한을 검증한다.
**Status:** Draft

## Preconditions

공개 Rill 파생 복사본26/source27, 별도 소유자·원본23·비대상 복사본25, 기존 실행 환경과 지정 LLM.

## Flow

질문 변경→전체 미리보기→명시 저장/게시 준비 질문→저장 revision 확인→게시→owner/public reload→원본/비대상·권한·추가 쓰기 확인→검증 링크 중지.

## Validation

| ID      | Expected                                                      | Status                                                                                                                        |
| ------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| TC02201 | 실제 LLM 질문·새 소스 미리보기·비대상/ID/배치 보존            | PASS_SELECTED_VARIANTS: 계산식2배·제목 변경을 별도 질문으로 확인                                                              |
| TC02202 | 복사본 ID 저장·같은 revision 게시 미리보기·명시 게시          | PASS: 두 번의 저장 handoff·버전1→같은 링크 버전2                                                                              |
| TC02203 | owner/public reload 추가 쓰기0·snapshot 수치/차트 일치        | PASS: 읽기성 preview POST와 저장/게시 쓰기를 구분                                                                             |
| TC02204 | 원본/다른 복사본 불변·다른 계정/익명 편집 거절·공개 whitelist | PASS_SELECTED_VARIANTS: 실제 GET403/401·화면 차단·서버 변경 거절 회귀. 타 계정 변경 POST 실제 실행은 승인 검토 거절로 NOT_RUN |
| TC02205 | 390/768/1440 질문/미리보기/게시/읽기 크기·정렬·넘침           | PASS_SELECTED_VARIANTS: 소유390/767/1440·익명390/768/1440 실측, 대표 정상/clarify/접근 오류. 소유 화면 정확768은 NOT_RUN      |

모든 오류/언어 조합·운영 MySQL·실기기·전체 TC005는 NOT_RUN이다.

[실행 증거와 질문/치수/권한 제한](../testing/copy-ai-publication.md). Draft는 자동 검사나 agent 리뷰만으로 Approved로 바꾸지 않는다.

## UC024 제외 복사본 후속

[Ego59 실행](../testing/copy-ai-publication.md#uc024-제외-복사본-후속--2026-10-16): 평균 블록 없는 복사본35/source30의 요청2배→미리보기→명시 저장→게시1→제목 AI 수정/저장→같은 링크 게시2→reload를 확인했다. 원본27·비대상OS·2개 ID/모든 폭 배치 보존,169점 각각2배/OS28그룹, reload추가쓰기0·최종중지404를 확인했다. 소유390/769/1440·공개390/768/1440 대표 크기·정렬 PASS이며 물리휴대폰은 NOT_RUN이다. 변경 없는 선택 응답의 교정/교정소진 실패 회귀도 확인했다.
