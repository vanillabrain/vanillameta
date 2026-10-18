# Test Case: Enterprise Analysis And Internal Distribution

## Overview

**ID:** TC-050
**Goal:** 기업용 데이터·권한·분석·공유·내보내기·보관을 하나의 업무 여정으로 검증한다.
**Status:** Draft

## Flow

| Step | Name    | Description                                | Use Case                                                       |
| ---- | ------- | ------------------------------------------ | -------------------------------------------------------------- |
| 1    | Catalog | 관리자가 업무 변수/원천 정의를 등록        | [UC-050](../use_cases/UC-050-manage-analysis-catalog.md)       |
| 2    | Access  | 직원/팀의 데이터·Artifact 권한을 각각 지정 | [UC-051](../use_cases/UC-051-manage-enterprise-access.md)      |
| 3    | Analyze | 직접/AI 조건 차이→분포/규모→저장/reload    | [UC-052](../use_cases/UC-052-explore-visual-conditions.md)     |
| 4    | Deliver | 수신자 공유/독립 복사·알림→조회·공유 중지  | [UC-053](../use_cases/UC-053-distribute-artifacts.md)          |
| 5    | Export  | 같은 기간/비교/제외 조건의 작업→파일 대조  | [UC-054](../use_cases/UC-054-export-comparable-analysis.md)    |
| 6    | Archive | 사용처 확인→개인 보관/복원·삭제 차단       | [UC-055](../use_cases/UC-055-archive-artifact-dependencies.md) |

## Test Data

서로 다른 두 조직·동일 조직의 관리자/데이터 관리자/분석 담당자/수신자·권한 없는 직원의 격리 검증 계정을 준비한다. 비식별 소스와 독립 정답에 전체/필터/제외 후 건수·분포·기간 비교·0행/0분모를 포함한다. 실제 계정 생성/운영 데이터 접근은 실행 권한이 확인된 환경에서만 수행한다. 이 문서는 계정·데이터·외부 서비스를 생성하지 않는다.

## Validation

| ID  | 요구/규칙                 | 수용 조건                                                                                                 | 실행    |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------- | ------- |
| E01 | FR014/015 · UC050 BR01/02 | 표시명/날짜/단위·중복/유형 오류와 소스 변경 영향을 검증하고 실패 저장0                                    | NOT_RUN |
| E02 | FR016/017 · NFR005        | 조직 간 접근/본인 권한 확대 거절, 목록·상세·preview·변경·작업·파일을 서버별 검사                          | NOT_RUN |
| E03 | FR017 · NFR005            | 권한 회수/계정 비활성 후 다음 보호 요청의 비허용 응답/작업0                                               | NOT_RUN |
| E04 | FR018/020 · UC052         | 중첩AND/OR·유형별 연산자·AI/직접 편집 차이 적용/저장/reload 동일. 알 수 없는 필드는 전체 무변경·질문 보존 | NOT_RUN |
| E05 | FR019 · NFR006            | 샘플/전체 구분·전체/조건충족/제외후 건수·비율/0분모가 독립 정답과 일치                                    | NOT_RUN |
| E06 | FR021 · UC053             | 조회 공유와 독립 사본 구별·원본/타 수신자 정의·ID/배치 보존, 공유 취소 후 본인 사본 유지                  | NOT_RUN |
| E07 | FR021/022 · NFR008        | 동일 요청 전달1개·중복/취소 후 재공유 정책 검증, 알림 실패로 본 저장 취소0·알림은 본인만 읽음/목록 제거   | NOT_RUN |
| E08 | FR023/025 · NFR006        | 동일 버전/기간/시간대/필터/제외 조건의 미리보기·비교·파일 정답 일치                                       | NOT_RUN |
| E09 | FR023 · NFR005/008        | 권한 검사 전에 작업0, 같은 요청 작업1·상태 재조회 추가작업0·만료/회수 파일 전달0                          | NOT_RUN |
| E10 | FR023 · NFR008            | 실행 중 재시작·실패·취소에서 현재 상태/명시 확인·복구 제공, 파일 없는 완료 표시0                          | NOT_RUN |
| E11 | FR024 · UC055             | 개인 보관/복원은 다른 사람 목록·공유·데이터 불변. 참조 중 삭제는 사용처 표시·자동 연쇄삭제0               | NOT_RUN |
| E12 | NFR007                    | 권한/공유/정의/보관/export 행위자·자원·버전·결과 이력. 비밀/원본 행 노출0                                 | NOT_RUN |
| E13 | NFR003                    | 새 UI의390/768/1440 넘침0·공통36/32px 역할·키보드·입력/실패 상태 보존을 실제 확인                         | NOT_RUN |

## Execution

전체 NOT_RUN. 요구사항/설계 추가 단계이며 코드·DB·실제 UI·외부 연계·운영 수용 시험은 수행하지 않았다. [설계](../architecture/enterprise-analysis.md)를 따른다. 기존 TC005 통과 증빙을 이 여정의 통과로 승계하지 않는다.

### UC050 First Slice

전체 시나리오 상태는 NOT_RUN을 유지한다. 소유 DuckDB 소스의 표시명/설명·열별 표시명/설명/단위 버전 저장 부분만 [별도 증빙](../testing/source-catalog.md)에 연결한다. 실제 조직 권한·공식 승인/분류·날짜 형식·변경 영향 확인을 이 첫 단위의 자동 검사로 통과 처리하지 않는다.

### UC050 Saved History Follow-up

[후속 검증](../testing/source-catalog-history.md)에서 소유권·20건 커서·동일 소스의 두 저장 버전 차이·손상 이력·입력/저장본 불변을 선택 검증한다. 공식 승인/사용처 영향 검토·전체 TC050의 NOT_RUN을 대체하지 않는다.

### UC050 Pre-save Preview Follow-up

[미리보기 증빙](../testing/source-catalog-preview.md)은 변경 입력→쓰기 없는 서버 미리보기→명시 확인→정확한 draft 저장과 경쟁409/입력 보존을 선택 검증한다. 실제 Ego/모바일·사용처 영향 검토/공식 승인·전체 TC050의 NOT_RUN을 대신하지 않는다.

### UC050 Direct Usage Follow-up

[사용처 증빙](../testing/source-catalog-usage.md)은 소유 소스의 활성 지표·본인 저장 분석 직접 연결과 자원 권한·후보 페이지/손상 정의·조회 불변·초안/동의 보존을 선택 검증한다. 기존 분석의 전체 변경 영향 계산·공식 승인·실제 Ego/모바일·전체 TC050 NOT_RUN을 대체하지 않는다.

### UC050 Studio Business Meaning Follow-up

[Studio 조회 검증](../testing/studio-source-catalog.md)에서 명시 읽기·업무/원본 구분·미등록/버전·구조 불일치·오류 후 이전 표시 제거·늦은 응답 격리와 기존 질문/생성안/저장 버튼 보존을 선택 검증한다. 공용 선택기는 생성/소스 재사용에 연결되지만 실제 Ego/모바일·전체 TC050 NOT_RUN은 유지한다.

### UC050 Studio Source Search Follow-up

[데이터 찾기 검증](../testing/studio-source-search.md)은 소유권·최신/손상 요약·응답 최소화·조회 불변, 업무/원본 이름·ID 검색·동명이름 구별·선택/질문/생성안 보존을 선택 검증한다. 실제 Ego/모바일·운영MySQL·조직 카탈로그/전체 TC050 NOT_RUN을 대체하지 않는다.

### UC050 Saved Metric Discovery Follow-up

[지표 선택 검증](../testing/studio-metric-picker.md)은 동명이름 구별·정규화/열/단위 검색·선택 유지·계산 기준 필드/비대상 정의 미표시·busy와 생성 요청의 selectedMetricIds 및 검색 후 질문/계산안 보존을 선택 검증한다. 실제 Ego/모바일·새 저장/계산 실행·조직 승인·전체 TC050 NOT_RUN을 대신하지 않는다.

### UC050 Generated Preview Basis Follow-up

[계산 기준 표시 검증](../testing/studio-metric-basis.md)은 공통 선택기 회귀와 고정 생성안의 저장ID/버전·ratio/weighted 필드·누락 안내·SQL 미표시·details 기본접힘/명시 펼침·숫자/차트/입력 불변을 선택 검증한다. 새 수치 실행/현재 스키마 검증·실제 Ego/모바일·전체 TC050 NOT_RUN을 대체하지 않는다.

### UC050 Saved Analysis Basis Follow-up

[저장본 기준 검증](../testing/studio-saved-metric-basis.md)은 snapshot 연결/whitelist·입력불변/실제 Studio GET, 선택기/Inspector 참조 대조/새 요청·편집0·형식검증/backward 호환을 선택 검증한다. 현재 지표 변경 후에도 저장 버전 기준을 유지하며 기존409 경계는 그대로다. 실제 Ego/모바일·공식 승인/전체 TC050 NOT_RUN을 대신하지 않는다.

## UC051 첫 단위 선택 검증 — 2026-10-18

[조직·직원 증빙](../testing/enterprise-membership.md)은 E02/E03 중 조직 격리·동의 없는 편입 거절·관리자 CAS·계정 비활성/재활성 인증 경계만 확인한다. 데이터/산출물 자원별 허용·회수·export/파일과 실제 UI는 이 실행에 포함하지 않으므로 표의 전체 NOT_RUN을 승격하지 않는다.

## UC051 자원 권한 선택 검증 — 2026-10-18

[자원 권한 증빙](../testing/enterprise-resource-access.md)은 E02/E03/E12의 자원별 부여·권한 확대/다른 조직 거절·회수·실제 행위자/수신자 감사와 SQLite/DuckDB 독립 정답을 선택 검증한다. 실제 HTTP/저장/게시 후 회수까지 포함하지만 그룹·영속 파일/알림·실제 Ego/모바일·전체 업무 수용은 포함하지 않는다. 위 표의 전체 NOT_RUN을 선택 회귀로 승격하지 않는다.

## UC050 업무 변수 선택 검증 — 2026-10-18

[변수 의미 증빙](../testing/source-variable-semantics.md)은 E01 중 실제 스키마와 업무 유형 호환·날짜 형식/윤년/전체 값 확인·실패 저장0·이전 클라이언트 의미 보존·버전 미리보기/저장·Explore/Studio 표현을 검증한다. 업무 분류 문자열은 저장하지만 조직 공통 분류 사전/공식 승인·활성 상태·조건/AI 실행 의미 적용은 포함하지 않는다. 실제 Ego/모바일/전체 TC050은 NOT_RUN을 유지한다.

## UC050 소스 활성 상태 선택 검증 — 2026-10-18

[소스 상태 증빙](../testing/source-availability.md)은 E01/E02/E03/E12 중 관리자 상태 CAS/감사·비활성의 다음 조회/작업 차단과 재활성 복구를 선택 검증한다. 상태 API는 원본 값/연결정보를 반환하지 않는다. 기존 데이터/분석/게시 보존과 현재 권한을 확인하며 진행 중 요청 취소나 이미 전달된 파일 원격 회수로 확대하지 않는다. 실제 Ego/모바일·전체 TC050은 NOT_RUN을 유지한다.

## UC051 SQLite 교차 작업 선택 검증 — 2026-10-18

[공통 조정 증빙](../testing/sqlite-coordination.md)은 E02/E03/E12의 기반인 명시 transaction 원자성/확정 권한 조회를 실제 SQLite로 검증한다. Studio rollback 후 다른 enterprise 쓰기의 독립 commit과 미커밋 계정/소스 상태가 권한·JWT 검사에 섞이지 않는지 확인한다. 기존 생성/저장/게시/재사용 회귀는 전체 E07/E09/E10을 대신하지 않으며 일반 Repository 쓰기·다른 조회/운영 경합·E13 실제 화면·전체 NOT_RUN을 유지한다.

## UC051 소스·지표/갱신 인증 후속 — 2026-10-18

[경계 증빙](../testing/metadata-boundaries.md)은 E01/E02/E03 기반의 일반 source/metric 성공 쓰기 보존·확정 정의/refresh 인증 조회와 긴 분석 SQL의 큐 해제를 선택 검증한다. 기존 세션/계정 쓰기·다른 일반 경로·E13 실제 UI/운영·전체 TC050 NOT_RUN은 승격하지 않는다.

## UC051 계정·세션 쓰기 후속 — 2026-10-18

[계정·세션 증빙](../testing/account-session-writes.md)은 E02/E03 기반의 session row/계정 연결 실패 rollback·활성/epoch 재검사·로그아웃 및 계정 변경의 SQLite 성공 유실 방지를 검증한다. 기존 모든 token/계정 소비자·운영/MySQL·E13 실제 UI·전체 TC050 NOT_RUN을 승격하지 않는다.
