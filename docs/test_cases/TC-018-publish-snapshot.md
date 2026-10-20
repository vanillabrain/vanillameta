# TC-018: Explicit Publication Snapshot

## Overview

**ID:** TC-018
**Related Use Cases:** [UC-018](../use_cases/UC-018-publish-snapshot.md)
**Status:** Draft
**Goal:** 게시 snapshot의 권한·비밀 경계·버전·UI를 검증한다.

## Test Scenarios

| ID      | Input / action                                              | Expected                                                                        | Result                                                         |
| ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| TC01801 | owner 아닌 preview/publish/revoke, malformed/expired ticket | 거절·게시/분석 불변                                                             | PASS(unit/SQLite), 실제다른계정UI NOT_RUN                      |
| TC01802 | 전체기간 preview→link publish→anonymous reload              | 동일 집계/추세/배치·version1·범위/시점/만료 표시                                | PASS(Ego/API)                                                  |
| TC01803 | 저장 분석 제목 변경→공개 reload→새 preview/repub            | 이전 결과 유지→활성같은 URL version2·새 제목, 중지/만료후재개는새URL·과거URL404 | PASS(Ego/API)                                                  |
| TC01804 | 동시 expectedVersion/definition conflict·same request retry | CAS409·한 번만증가·같은영수증                                                   | PASS(SQLite/FEunit), 실제같은요청API PASS,실제409/유실 NOT_RUN |
| TC01805 | 공개 JSON/반복 읽기/중지/만료/삭제                          | SQL/소스/토큰/fields/queries없음·원본query0·중지/만료거절                       | PASS(unit/SQLite/Ego중지/API),만료/삭제UI NOT_RUN              |
| TC01806 | 390/768/1440·loading/error/long labels                      | 28px button32px input·overflow0·주변정렬                                        | PASS(Ego대표),실기기/전체상태 NOT_RUN                          |
| TC01807 | migration up×2 / down withdata                              | 멱등·기존자료보존·데이터있으면rollback거절                                      | PASS(SQLite),MySQL NOT_RUN                                     |

## Preconditions

공개 Rill 분석12와별도임시 SQLite fixture. 기존공유중지상태보존. 실제휴대폰/운영MySQL/질문게시/전체TC005는NOT_RUN.

실행증거: [UC018검증](../testing/publication-snapshot.md).
