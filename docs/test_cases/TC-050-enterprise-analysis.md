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

| ID  | 요구/규칙                 | 수용 조건                                                                                                                                                                   | 실행    |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| E01 | FR014/015 · UC050 BR01/02 | 표시명/날짜/단위·중복/유형 오류와 소스 변경 영향을 검증하고 실패 저장0                                                                                                      | NOT_RUN |
| E02 | FR016/017 · NFR005        | 조직 간 접근/본인 권한 확대 거절, 목록·상세·preview·변경·작업·파일을 서버별 검사                                                                                            | NOT_RUN |
| E03 | FR017 · NFR005            | 권한 회수/계정 비활성 후 다음 보호 요청의 비허용 응답/작업0                                                                                                                 | NOT_RUN |
| E04 | FR018/020 · UC052         | 중첩AND/OR·유형별 연산자·AI/직접 편집 차이 적용/저장/reload 동일. 알 수 없는 필드는 전체 무변경·질문 보존                                                                   | NOT_RUN |
| E05 | FR019 · NFR006            | 샘플/전체 구분·전체/조건충족/제외후 건수·비율/0분모가 독립 정답과 일치                                                                                                      | NOT_RUN |
| E06 | FR021 · UC053             | 직접/동적 그룹 받은 자료의 현재 권한과 복제 동의 구별·독립 사본의 원본/타 수신자 정의·ID/배치 보존, 공유 취소 후 본인 사본 유지                                             | NOT_RUN |
| E07 | FR021/022 · NFR008        | 동일 요청 전달1개·중복/취소 후 재공유, 그룹 사건 수신자 snapshot, 알림 실패 시 본 저장 유지·본인 읽음/목록 제거, 계정/조직 활성 변경 auto-notice 및 export 이벤트 범위 확인 | NOT_RUN |
| E08 | FR023/025 · NFR006        | 동일 버전/기간/시간대/필터/제외 조건의 미리보기·비교·파일 정답 일치                                                                                                         | NOT_RUN |
| E09 | FR023 · NFR005/008        | JWT 권한/조직/epoch 확인 전 작업·SQL 0, UUID/body 멱등 접수, 고정 기준·CAS 실행, 재조회 추가 실행 0, 만료/회수 파일 전달 0                                                  | NOT_RUN |
| E10 | FR023 · NFR008            | 실행 중 취소·만료 lease·stale worker fencing, 실패/부분 저장 rollback·재시도·안전 진단 및 명시 상태 확인. 실제 server restart는 별도                                        | NOT_RUN |
| E11 | FR024 · UC055             | 개인 보관/복원은 다른 사람 목록·공유·데이터 불변. 참조 중 삭제는 사용처 표시·자동 연쇄삭제0                                                                                 | NOT_RUN |
| E12 | NFR007                    | 권한/공유/정의/보관/export 행위자·자원·버전·결과 이력. 비밀/원본 행 노출0                                                                                                   | NOT_RUN |
| E13 | NFR003                    | 새 UI의390/768/1440 넘침0·공통36/32px 역할·키보드·입력/실패 상태 보존을 실제 확인                                                                                           | NOT_RUN |
| E14 | FR023/025 · NFR006/007    | 실제 DuckDB 집계의 기간/필터/포함·제외·선택 지표 CSV를 독립 oracle과 대조하고 기준/감사 metadata 확인. 구현 선택 검증과 TC050 수용은 별도                                   | NOT_RUN |

## Execution

전체 TC050 수용은 NOT_RUN이다. UC-054 구현 기반 선택 검증 범위는 [export 작업 증빙](../testing/export-jobs.md)에 기록하며, 그 결과가 E01~E14 또는 전체 기업용 목표의 수용을 자동 통과시키지 않는다. 실제 Ego96, 새 UI와 390/768/1440 화면, 물리 휴대폰, MySQL/운영 및 사람 수용은 NOT_RUN이다. 기존 TC005 통과 증빙을 이 여정의 통과로 승계하지 않는다.

### UC053 Group Delivery Implementation Pointer

현재 서버 구현 범위는 [그룹 전달 계획](../plans/UC-053-group-deliveries.md)과 [범위 증빙](../testing/group-deliveries.md)을 참조한다. 이는 E06/E07 실행 결과가 아니며 전체 TC050과 E06/E07은 NOT_RUN을 유지한다. 실제 UI/모바일·MySQL/운영·그룹 알림과 전체 업무 수용은 남아 있다.

### UC053 Group Notification Implementation Pointer

그룹 공유/회수와 명시적 구성원 추가·제외/그룹 활성 변경 사건의 수신자 snapshot은 [계획](../plans/UC-053-group-notifications.md)·[증빙](../testing/group-notifications.md)을 참조한다. 이는 E06/E07 또는 전체 TC050 실행 결과가 아니며 `NOT_RUN`을 유지한다. 계정/조직 활성 변경 auto-notice와 export 이벤트, 실제 UI/모바일·MySQL/운영·사람 수용은 남아 있다.

### UC050 First Slice

전체 시나리오 상태는 NOT_RUN을 유지한다. 소유 DuckDB 소스의 표시명/설명·열별 표시명/설명/단위 버전 저장 부분만 [별도 증빙](../testing/source-catalog.md)에 연결한다. 실제 조직 권한·공식 승인/분류·날짜 형식·변경 영향 확인을 이 첫 단위의 자동 검사로 통과 처리하지 않는다.

### UC050 Semantic Business Basis — in progress

[선택 증빙](../testing/semantic-business-basis.md)은 신규 직접/AI 지표·차원 고정 업무 의미, 실제 DuckDB/SQLite 정답·경합·저장/reload/게시/복제와 실제 Codex/headless390/768/1440을 기록한다. E01/E04/E08/E13/E14의 해당 선택 흐름은 검증했으나 이번 MySQL/Ego/실기기/운영·사람 및 전체 TC050/16개 요건 수용은 `NOT_RUN`이다.

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

## UC051 계정 DB 무결성·실제 MySQL — 2026-10-18

[실제 엔진 증빙](../testing/identity-integrity.md)은 E02/E03의 동일 ID/email 가입 경쟁·편입/삭제 양순서·프로필 충돌 rollback과 늦은 legacy hash 갱신의 비활성/epoch 복원을 방지하는9개를 로컬 MySQL8.4.11에서 검증한다. SQLite 모델/마이그레이션·기존 회귀는 별도다. E02/E03 전체/운영·E13 화면/전체 TC050을 선택 DB 검증으로 승격하지 않는다.

## UC052 소스 조건·모집단 선택 검증 — 2026-10-18

[공통 조건 증빙](../testing/source-conditions.md)은 E04/E05의 유형별 중첩AND/OR·포함/제외·NULL·전체/충족/제외/최종 건수·비율·조건 버전 저장/재조회와 JWT/실제 권한/회수·독립 DuckDB 정답을 선택 검증한다. Studio/AI 차이 적용·분포/표본·기간/지표 버전/파일·E13 실제 Ego/모바일과 전체 TC050은 NOT_RUN을 유지한다.

## UC052 Studio 조건 연결 선택 검증 — 2026-10-18

[Studio 조건 증빙](../testing/studio-conditions.md)은 E04/E05/E08의 직접 적용/제거·저장/reload·독립 수치/영속 Dataset query·게시 집계/재사용 조건 보존을 선택 검증한다. AI 내용 변경은 기존 조건을 유지하며 AI 조건 변경 제안/차이 자체는 후속이다. 기존 core 통과를 새 UI의 E13 실제 Ego/모바일 검증으로 승계하지 않는다. 영속 export 작업·실휴대폰/운영·전체 TC050 표의 NOT_RUN은 유지한다.

## UC052 AI 조건 변경안 선택 검증 — 2026-10-18

[AI 제안 증빙](../testing/ai-condition-proposals.md)은 E04/E08 기반인 질문→현재/제안 조건·전체 미리보기→명시 적용/undo→저장/reload와 유형/열/무변경 거절·편집 세대 변경 후 stale 적용 차단·저장 요청의 검토 전 쓰기0을 검사한다. 모델 응답 fixture와 실제 SQLite/DuckDB 집계를 구분한다. E13 실제 Ego/390·768·1440·실휴대폰/실LLM·운영/사람 수용과 전체 TC050 NOT_RUN은 그대로다.

## UC052 전체 값 분포·명시 표본 선택 검증 — 2026-10-18

[분포 증빙](../testing/condition-profile.md)은 E05/E08 중 현재 전체/포함/제외/최종 건수·빈도 상위20/나머지·NULL·정밀 타입·잘림/중복/0행과 동일 조건의 선택 열20행 정렬 표본을 독립 원본 정답과 대조한다. Source JWT/read grant/회수·조회 중 권한/파일/metadata 변경 거절·Studio metadata lease 밖 SQL·화면의 명시 실행/late/초안·질문 보존을 선택 검사한다. 실제 Ego/390·768·1440/실휴대폰·대규모/운영/전체 TC050 NOT_RUN을 승격하지 않는다.

## UC053 권한 알림 첫 단위

[검증 증빙](../testing/personal-notifications.md): 본인 현재 조직의 확정 권한 이벤트만 투영·조회 쓰기0·타인/이전 조직/비활성/epoch 차단·멱등 읽음/목록 제거·원 grant/감사 보존·회수 이벤트/접근 거절·실패 재시도/늦은 응답/커서 경계를 선택 검증한다. 공유/그룹 전달/독립 사본·export 이벤트·실제 Ego/모바일·운영 MySQL·전체 E 항목 수용을 대체하지 않는다.

## UC053 수신자 조회 공유

[공유 증빙](../testing/recipient-deliveries.md)의 직접 권한 독립/read-only 합성·원본/소스 grant 불변·배치 일부 권한/409 전체 rollback·멱등/회수 후 replay·탈퇴/비활성 회수·현재 소유자/수신자/소스 권한·공유 알림·명단 팀 선택/동일 재시도/늦은 응답을 실행 범위로 구분한다. 동적 그룹·수신자 독립 사본 전달·실제 Ego/모바일·MySQL/전체 업무 수용은 미완료다.

## UC053 받은 자료 조회·열기

[검증](../testing/received-dashboards.md): 현재 계정/조직/유일 소유권·소스 활성/read·공유 회수 후 제목 숨김, 원본/관계/영수증 쓰기0, 숨겨진20개 다음 구간, 현재 제목 제한·정의/링크 비공개, JWT static route/잘못된 cursor, FE 명시 열기·재조회·실패 후 목록 제거·StrictMode/늦은 응답을 선택 검증한다. 수신자 독립 사본 전달·동적 그룹·실제 Ego/모바일·MySQL/전체 수용은 별도다.

## UC053 받은 분석 독립 복제

[검증](../testing/received-copy.md): 별도 복제 동의/현재 read·원본 변경409·소유 데이터 선택/매핑/전체 미리보기/명시 원자 저장·수신자1000 oracle·새 ID/모든 폭 배치/원본 불변·미허용/타인/source 거절·저장 후 허용 회수 주입 rollback/동일 재시도·회수 후 사본 독립·게시 추가0·private/public resolver 혼동 차단·UI 별도 동의/회수/명시 재확인을 실행 범위로 기록한다. 실제 Ego/모바일·MySQL/운영·동적 그룹/전체 업무 수용은 별도다.

## UC051 동적 그룹 선택 검증

[설계](../plans/UC-051-groups.md)·[증빙](../testing/dynamic-groups.md)은 E02/E03의 그룹/구성원 CAS·직접/그룹 권한 합산·현재 소속/활성/소스 독립·동일 JWT 회수·게시 소비자·원자 rollback·생성 영수증 재확인을 선택 검증한다. 그룹 전달/알림·영속 파일 소비자·실제 Ego/모바일/MySQL/운영·전체 수용은 별도이며 요건 상태를 승격하지 않는다.

[출력 결과 알림 선택 검증](../testing/export-notifications.md)은 E07/E09/E10의 확정 사건·본인 조직/상태 보존 경계를 다룬다. 전체 TC050 또는 실제 새 UI/운영 수용 통과로 승계하지 않는다.

E11의 개인 보관/복원은 [UC055 계획](../plans/UC-055-library-archive.md), 참조 중 삭제 보호는 [별도 후속 설계](../plans/UC-055-dependency-deletion.md)를 따른다. 개인 보관 상태 저장으로 조직 자산 비활성화·삭제 보호·전체 E11 통과를 대체하지 않는다.

E11/E12의 대시보드 사용처/삭제·원자 영수증은 [UC055 계획](../plans/UC-055-dashboard-delete.md)·[검증](../testing/dashboard-deletion.md)을 따른다. source/metric 삭제·조직 비활성·전체 E11/E12 수용은 별도이며 실제 MySQL과 headless/Ego/실기기를 구별한다.

지표 삭제 보호의 다음 단위는 [계획](../plans/UC-055-metric-delete.md)·[증빙](../testing/metric-deletion.md)을 따른다. 저장 분석/Pivot·Studio/탐색 보기의 현재 참조와 source 소유/계정·조직·기준을 재확인하며 자동 연결 해제는 하지 않는다. source/조직 비활성·전체 TC050/16개 수용은 별도다.

소스 삭제 보호는 [계획](../plans/UC-055-source-delete.md)·[증빙](../testing/source-deletion.md)의 고정10종 영향/기준 확인과 원자 metadata 삭제·별도 지속 파일 정리를 따른다. 현재 참조·하위 공유 파일은 차단하며 자동 연쇄 삭제0이다. 실제 MySQL/파일/자동 화면·Ego/실기기/운영을 구별하고 조직 비활성·전체 E11/E12/TC050 수용은 별도다.

조직 대시보드 비활성화/복원은 [계획](../plans/UC-055-dashboard-lifecycle.md)·[증빙](../testing/dashboard-asset-lifecycle.md)을 따른다. 비활성 일반 이용과 제한된 현재 소유 admin 관리/회수를 구분하며 원본·관계·게시·독립 사본을 보존한다. 복원 전 준비 요청의 lifecycle 기준과 과거 영수증/현재 상태를 구별하고, 실행 결과와 전체 E03/E11/E12/E14 수용은 별도로 판정한다.

## Explore reviewed basis follow-up

[UC052/054 설계](../plans/UC-052-explore-basis.md)는 E05/E08/E14의 검토 조건 명시 적용→동일 비교·Pivot→보기 저장/reload→CSV 및 조회 후 지표 변경 거절을 연결한다. 실제 DuckDB 독립 정답과 격리 headless UI의 실행 결과를 별도 기록한다. 사용자 제어 Ego96/실휴대폰/운영·전체16개 사람 수용 및 위 전체 NOT_RUN 표를 이 단위로 승격하지 않는다.

[동일 기준 실행 증빙](../testing/explore-reviewed-basis.md)은 BE397/FE237과 격리 headless 고유2개의 명시 조건 적용·보기 복구·현재/이전 기간·CSV·지표 변경 거절 범위를 기록한다. 실제 Ego/휴대폰/이번 MySQL/운영 및 전체16개/TC050 수용은 별도다.

### UC050/052 고정 업무 의미 선택 검증 — 2026-10-18

[업무 조건 의미 증빙](../testing/business-condition-semantics.md)은 E01/E04/E05/E08/E13/E14 중 과거 이력/native 보존·전체 날짜 정답·명시 최신 채택·저장 보기 복구·조회/출력/재사용 소비자의 선택 검사를 연결한다. Source49·격리 MySQL migration/영속2·Studio profile41·FE52 suites/802 distinct·Source headless UI1은 별도 배치이며 합산하지 않는다. UI390/768/1440 overflow0·채택36px/14px를 확인했지만 실 Codex 단일 조건 질문1개는14.5초 PASS로 V3 검토/명시 적용/저장/reload200·모바일390 overflow0을 확인했다. 앞선 취소 시도와 복합 부정 의도 제한은 남기며 BE26 suites/884 unique는 단계별 검증 완료, Jason·Bernoulli 범위 검토는 APPROVE/0 findings다. 안정 BE type/lint/build·최종 dist ui-stable1 PASS/11.9초를 확인했고 해당 조건 의미 단위의 core-stable14 PASS/38.3초를 확인했다. 새 분류 검증으로 승계하지 않는다. 조직 공통 분류·새 semantic 지표/차원 생성·실제 Ego/휴대폰/운영·사람/전체16개 및 위 표의 TC050 NOT_RUN은 승격하지 않는다.

위 선택 증빙의 후속은 core headless14 PASS/49.4초와 Explore semantic oracle8 PASS/22 SKIP다. Source390/실 Codex 저장 Studio390 스크린샷은 Main이 넘침 없음을 열람 확인했다. BE26-suite 최초24 PASS/2 FAIL 뒤 stale fixture suite legacy18/resource6을 전체 재실행해26 suites/884 unique를 단계별 검증했다. 최초864 PASS에는 두 suite의 성공4개가 포함돼864+24로 합산하지 않는다. 비활성 계정 read guard 수정·두 reviewer APPROVE0·안정 BE type/lint/build PASS·최종 dist ui-stable1 PASS/11.9초이며 core-stable14개만 실행 대기다. 이전 ui-codex와 같은 시나리오이므로 합산하지 않는다. 전체 TC050 NOT_RUN은 유지한다.

### UC050 조직 공통 분류 선택 검증 — 2026-10-18

[분류 증빙](../testing/organization-classifications.md)은 E01/E02/E03/E12/E13 중 조직 사전 조회/admin 관리·별도 source edit·명시 연결/해제/최신 채택과 사건 당시 영수증을 구분한다. registry SQLite/JWT HTTP47 PASS와 실제 MySQL8.4.11/두 DuckDB 소스15 PASS는 독립 실행이며 합산하지 않는다. MySQL 분류/User lock 대기·stale CAS/epoch·audit/receipt rollback·migration 반복과 표식한 격리 자산 cleanup을 확인했다.

검토 항목에는 bound ref 생략/legacy 문자열 편집 차이, 명시 null의 저장/preview 보존, 이름 변경/비활성 뒤 역사 ref 보존, 생성 유실→로그인 세대/actor/조직에 묶인24시간/8KiB reload 복구→현재 권한 조회→동일 UUID 명시 확인/자동 POST0을 포함한다. catalog read/JWT 보강 후135 PASS·types/lint/격리 build·Bernoulli APPROVE0, 실제 ui-second1 PASS/9.7초를 확인했다. commit503→reload→자동 POST0/동일 UUID와 전체 본문 확인·entry1, 두 source 연결/rename 보존/최신 채택·비활성 보존/해제를 포함한다. Main은 Source/조직390/768/1440 overflow0·controls36px·입력900px 미만16px/desktop14px를 열람했다. 최초768px14px 테스트 기대값은 기존 토큰에 맞춰 수정했다. BE 최종10 suites/293 PASS는 registry47/catalog135/condition regression111을 포함하며 다시 더하지 않는다. global BE types/lint/build와 FE helper read/delete 수정 후8 suites/102 PASS·types/lint/build를 확인했다. read-guard 후 MySQL 최종15 PASS/8.924초는 현재8개 source hash 실행 중 불변·owned CLEANUP PASS이며 이전15를 더하지 않는다. core-final15 PASS/51.0초 뒤 마지막 FE receipt/pagination finding을 수정했다. 영향 Classifications13 PASS·types/lint/build는 기존102와 겹치며 새3개를 포함하므로102+13으로 합산하지 않는다. 수정 후 실제 ui-stable2 PASS/13.4초는 확장 전체 흐름과 페이지 밖 역사 영수증/현재 목록 분리를 확인했다. Jason 최종 FE·Bernoulli BE는 모두 APPROVE0다. Main이 최종6개 controls capture를 열람해768/1440에서 업무 유형/날짜 custom label+NativeSelect와 분류 TextField 입력 상단이 약7px 어긋나는 문제를 확인했다. Tesla가 기존 UI Kit을 유지하며 동일 TextField select로 맞추는 수정과 세 입력행 top 차이≤1px assertion을 포함한 실제 UI2 재실행이 대기다. 이전 UI2 PASS는 시각 수정 전 결과이며 최종 정렬 PASS로 승계하지 않는다. Ego96 제어권 인수·물리 휴대폰·운영·사람 수용은 미실행이다. 이 선택 실행을 수용으로 승격하지 않으며 E01~E14·전체 TC050의 NOT_RUN과 새 semantic 지표/차원 생성·전체16개 요건 수용 상태는 승격하지 않는다.

## 고정 업무 기준 MySQL 선택 후속

[계획](../plans/UC-050-semantic-mysql.md)·[증빙](../testing/semantic-business-mysql.md)은 E01/E04/E08/E13/E14의 metadata MySQL8.4.11/native DuckDB64개를 실행했다. 두 connection의 실제 잠금·epoch 회수·동시 게시 영수증·rollback/409도 포함하지만, 실제 LLM/브라우저/MySQL 앱 서버·운영 migration·모든 조합을 의미하지 않는다. [16개 수용 점검](../testing/enterprise-acceptance-audit.md)은 이미 실행한 기능/정답을 미구현으로 계산하지 않고 계약/실행/운영·사람 잔여를 분리한다. 전체 E01~E14/16개 수용은 NOT_RUN을 유지한다.

## E02/E03 직원 검색·이동 후속

[설계](../plans/UC-051-staff-transfer.md)·[선택 검증](../testing/staff-transfer.md)의 현재 조직 문자 검색/비밀 비노출, 본인 동의→대상 admin 수락→원 조직 다른 admin 검토/이동, 변경된 reviewBasis·양쪽 version/epoch/만료/철회 거절을 검사한다. 기존 access/refresh 회수와 자료/소유/독립 사본/게시 행 보존, 이전 권한/그룹 해제 및 A→B→A 비부활, 실제 MySQL 두 연결 finalizer/권한·그룹 writer 경합과 late rollback을 구별한다. 선택 시나리오는 full E02/E03/TC050·운영·실기기/사람 수용 통과가 아니다.

### E02/E03 Ego 화면 후속 — 2026-10-19

[실행 범위](../testing/staff-transfer-ui.md)는 Ego101의 격리 SQLite 실제 로그인/검색/발급/철회/수락/최종 이동과 수락 변경409·명시 재검토·이전 토큰401·재로그인/reload,390/768/1440을 확인한다. 배경 API의 수락 변경을 실제 두 탭 동작으로 계산하지 않으며 MySQL25 HTTP 회귀는 별도 증거다. full TC050/운영/실기기/사람 수용 상태는 유지한다.

### E02/E03 퇴사·인계 전 영향 확인

[설계](../plans/UC-051-departure-impact.md)의 같은 조직 admin만 고정11종 건수 조회, 비활성 대상 허용·다른 조직/일반 직원/오래된 epoch 차단, 단독/중복 mapping 구분·타 조직 관계 제외·회수 관계/종료 출력 포함을 검사한다. 내용/경로/게시 링크 비노출과 조회 전후 DB 쓰기0, 조회 중 기준 변경 거절, FE 대상 변경/접기/재조회 실패 뒤 이전/늦은 결과 비노출을 확인한다. 실제 실행은 [증빙](../testing/staff-departure-impact.md)과 구분하며 퇴사/탈퇴/인계 확정·전체 TC050 수용으로 확대하지 않는다.

### E02/E03 자료 선택·인계 의향 후속

[설계](../plans/UC-051-handover-proposal.md)는 소유자의 활성 소스/단독 대시보드 후보 조회→명시 선택/제목·번호 공개 동의→같은 조직 수신자 지정→고정 요청 조회/수락/철회를 검사한다. 타인/타 조직/중복 mapping/비활성 후보 제외, 양쪽 epoch·조직/선택 metadata 변경·만료/CAS 거절, 같은 UUID 재시도와 응답 유실 후 명시 조회·감사 rollback·원본/권한 불변을 확인한다. [선택 증빙](../testing/handover-proposal.md)과 실제 이전/퇴사·운영/사람 수용을 분리하며 전체 TC050 상태를 승격하지 않는다.

### E02/E03 인계 전 연결·보관 조건 검토

[설계](../plans/UC-051-handover-review.md)의 수락된 고정 요청 소유자 명시 조회, 수신자/admin/타 조직/epoch 거절·상태/metadata 변경409를 확인한다. analysis/structured/Pivot/Studio/legacy widget 저장 연결·소스 중복 제거·미선택/타인/비활성/누락/손상 구별과 소스 지표 전체 건수, 파일/연결 보관 검토 필요 표시를 검사한다. 미선택 제목/ID·SQL·경로·hash 비노출·DB 쓰기0·실패 후 초안/요청 보존·재조회/접기/늦은 응답 및390/768/1440을 확인한다. 실행 증빙은 별도이며 전역 역방향 의존성/파일 실체·실제 인계/탈퇴·전체 TC050/16개 수용은 승격하지 않는다.

### E02/E03 관리 파일 보관 관측 후속

[설계](../plans/UC-051-handover-custody.md)의 고정 수락 소유자 전용 조회와 관리 파일 ready/등록·실체/버전·symlink/경계·hardlink/알려진 공유 소비자·열린/만료 갱신 lease를 확인한다. 파일/metadata 변경·권한/의향 철회 뒤 결과 차단, 비밀/타인 정보 비노출·DB/파일 쓰기0·실패 후 입력 보존/명시 재시도와390/768/1440을 검사한다. 실제 파일을 이용한 선택 실행·Ego 화면과 운영/실휴대폰/실제 인계·전체16개/TC050 수용을 구별한다.

### E02/E03 별도 최종 동의·대시보드 원자 인계

[설계](../plans/UC-051-handover-transfer.md)에 따라 비공개 단독 소유 대시보드만 선택하고, source 혼합/미소유 연결/활성 공유·게시·작업/손상 정의를 차단한다. 소유자 준비→수신자 별도 최종 수락→소유자 최신 상태 확인/명시 실행과 전 mapping 원자 변경·기존 ID/Studio document bytes/폭별 배치·원본/이력 보존을 검사한다. 양쪽 epoch/소속·기준/CAS·만료·철회409, 실패 rollback·응답 유실/동일 UUID 재확인·중복 실행·완료 이후 역사 영수증을 구별한다. 이전 소유자 다음 요청 거절/수신자 접근과 늦은 저장/공유 writer 경합을 검증한다. Ego 역할 전환/reload·390/768/1440 및 실제 MySQL 선택 실행 결과는 별도 증빙에 기록하며 source/파일 이전·퇴사/운영/실기기/전체16개 수용으로 확대하지 않는다.

### E02/E03 소스·파일 자체 최종 인계

[설계](../plans/UC-051-source-handover.md)의 source-only 관리 DuckDB 목록·별도 내용 공개/관리권 동의→준비/수락/실행→reload·역사 영수증을 검사한다. fileModel/외부 연결/혼합·미등록/ready 불일치·symlink/hardlink·공유/불명확 소비자·진행 갱신/출력/연결 사용처·활성 권한은 차단한다. 양쪽 epoch/조직·CAS/기한/metadata/파일 변경과 철회는 전체 쓰기0/rollback이며 같은 완료 재시도는 감사/이전 추가0이다. 원본/manifest/버전 파일 bytes/hash/mtime와 Metric/정의/이력·source ID를 전후 대조하고, 구 소유자 같은 JWT의 다음 보호 요청403·수신자200 및 늦은 갱신/권한 writer 경합을 확인한다. Ego 실화면 양쪽 별도 최종 동의·미확정 준비/reload/같은 UUID 복구·390/768/1440과 로컬 Docker MySQL은 선택 범위이며 운영/실휴대폰/퇴사·전체16개 수용은 승격하지 않는다.

## UC051 E02/E03 소스·대시보드 묶음 인계 후속

[설계](../plans/UC-051-bundle-handover.md)·BR-051-10/A9: 일반 업로드 소스와 정상 저장된 연결 분석을 함께 선택→조건 검토→별도 준비→수신자 최종 수락→소유자 실행→새로고침을 확인한다. 미선택 연결/고아·공유 자식/외부·활성 권한/게시/열린 작업은 전체 차단하고 미선택 신원을 노출하지 않는다. 양쪽 epoch/기준 변경409·잠금 대기 후 기한·두 연결의 늦은 writer 거절·중간 실패 전체 rollback·정확 완료 replay 쓰기0을 확인한다. 같은 구 소유자 JWT의 source/dashboard/Studio/Widget/Dataset 보호 요청403·수신자200, source/Metric/config/파일/manifest·mapping ID/문서 bytes/모든 폭 배치 보존과 허용 버전만 변경함을 대조한다. 통신 실패→reload→동일 UUID 확인/재시도·390/768/1440 정렬/넘침0은 Ego 증빙과 구분 기록하며 운영/실기기·전체 수용은 별도다.

## UC051 E02/E03 인계 후 조직 탈퇴 확정 후속

[설계](../plans/UC-051-staff-departure.md)·A10/BR-051-11: 본인 명시 요청→다른 admin 잔여 건수/현재 기준 검토→별도 탈퇴 확정→직원 access/refresh 회수→재로그인/소속 없음→본인 과거 영수증을 확인한다. 미인계 소유/열린 작업·게시/미확정 인계·이동/마지막 active admin·본인 실행/타 조직은 거절하고 자료를 자동 삭제하지 않는다. 양쪽 epoch·조직/관계/기한 변경409·잠금 대기 후 현재 권한·중간 실패 rollback·정확 replay 추가 변경0을 MySQL 두 연결/SQLite/HTTP로 검증한다. 원본/인계된 문서·모든 폭 배치/파일/계정 자격정보/과거 actor 보존·직접/그룹/전달 접근 회수·재가입 시 과거 권한 부활0을 대조한다. Ego 통신 실패/같은 UUID·reload·역할 로그인과390/768/1440 정렬은 별도 증빙으로 남기며 운영/실기기/법적 퇴사·전체 수용은 별도다.

## UC053 E06/E07 직원 공유 요청 새로고침 복구

[설계](../plans/UC-053-delivery-recovery.md)·A2/BR-053-03: 공유/회수 전 UUID·정확 입력 탭 저장→응답 유실→접기/reload→쓰기0→현재 관계 조회→별도 동의 동일 요청→역사 결과 확인→최신 관계를 확인한다. 미전달 재시도는 최초 쓰기를 수행할 수 있음을 명시한다. 저장소 실패/손상/만료·다른 계정/조직/대시보드/epoch·409/403·GET 실패는 자동 재전송/CAS 변경 없이 보존·차단한다. 명시 보관 해제는 서버 취소와 구분한다. 회수 후 과거 replay의 재활성화0·원본/직접 권한/사본 불변·MySQL 대기 중 epoch 변경 거절·390/768/1440px를 선택 검증한다. 그룹/독립 복제 요청 복구·운영/실기기/전체 수용은 별도다.

## UC053 E06/E07 그룹 공유 요청 새로고침 복구

[설계](../plans/UC-053-group-delivery-recovery.md)·A3/BR-053-04: 그룹 공유/회수 frozen UUID·그룹 버전/관계 CAS·복제 설정 저장→응답 유실→접기/reload→자동 쓰기0→현재 GET→별도 동의→동일 replay를 확인한다. 미전달 뒤 그룹 변경409/비활성403·조회 실패는 원 요청을 보존하며 자동 버전 변경 없이 명시 보관 해제/재검토한다. 저장소 실패/한도/엄격 키·다른 사용자/조직/대시보드/epoch·늦은 응답을 차단한다. MySQL 잠금 대기 epoch 회수·도메인 충돌·원자 rollback·회수 뒤 과거 replay의 재공유0·원본/직접 공유/사본 보존·390/768/1440px를 선택 검증한다. 독립 사본 생성 요청 복구·운영/실기기/전체 수용은 별도다.

## UC053 E06/E07 받은 분석 독립 복제 생성 요청 복구

[설계](../plans/UC-053-received-copy-recovery.md)·A4/BR-053-05: 전송 전 scoped 탭 기록→실제 commit 후 응답 유실→reload→읽기 전용 확정 결과 확인→본인 사본 열기와 원본 공유 회수 후 사본 보존을 확인한다. 미전달→미관측→원 reference/소스 revision 재미리보기→별도 동의→같은 UUID/입력 저장/reload·동시 재시도의 사본 중복0을 대조한다. 다른 actor/조직/epoch·digest/소스 불일치·사본 소유권 상실/비활성·403/409/조회 실패·저장소 손상/한도/쓰기 실패는 자동 생성/초안 폐기 없이 차단한다. 명시 보관 해제는 서버 취소/사본 삭제가 아니다. 원본/파일·폭별 배치 보존·현재 사본 숫자·390/768/1440px와 실제 MySQL 선택 경합을 별도 증빙에 기록한다. 운영/실기기/전체 수용은 승격하지 않는다.
