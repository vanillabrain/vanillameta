# 추가 기업용 요건 완료 목표

2026-10-18 사용자 지시로 FR014~025/NFR005~008 전체를 완료 목표로 등록했다. 브랜치 develop-v2·MK AI 연동 제외·비공개 기업자료 공개 금지를 유지한다. 이 계획은 승인/수용 완료가 아니다.

## 완료 판정

각 요건의 구현/자동 검사/실제 UI/권한·정답 대조/운영·사람 수용을 구분한다. [TC050](../test_cases/TC-050-enterprise-analysis.md) E01~E14 전체와 기존 TC005 회귀를 종료 기준으로 한다. 실제 Ego 사용자 제어권·실기기/운영 접근 등 미실행은 분리하고 완료로 승계하지 않는다. 진행률은 완전 충족 항목 수/16이며 하위 UI 작업 수를 전체 비율로 계산하지 않는다.

최신 세부 대조는 [16개 요건 수용 점검](../testing/enterprise-acceptance-audit.md)을 따른다. 아래는 현재 표이며, 뒤의 누적 후속 문단은 각 실행 당시의 역사 기록이다. 이미 확인한 기능·정답·실모델/화면을 전부 미구현으로 재분류하지 않는다.

| 요건   | 현재 확인 범위                                                                                 | 남은 구현·수용                                         |
| ------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| FR014  | 설명/이력/직접 사용처·권한·활성 차단                                                           | 전체 영향 지원 범위·schema/권한 변경 안내·업무 수용    |
| FR015  | 업무 유형/날짜/단위/공통 분류·고정 의미·직접/실AI 생성·저장/게시/복제·이번 MySQL64 선택 통과   | 복합 부정/전체 생성 조합·실기기·운영/업무 의미 수용    |
| FR016  | 계정 연결·팀/역할/활성·epoch·동적 그룹·계정 MySQL·직원 검색/명시 조직 이동·권한 회수/자료 보존 | 탈퇴·업무 자산 이관 계약·실제 관리 화면/운영·사람 수용 |
| FR017  | 직접/그룹 권한·소스 read·완료 파일 현재 권한 검사                                              | 전 역할×보호 경로 대조·운영 경합 수용                  |
| FR018  | 중첩 조건/명시 적용·저장/reload/게시/복제·실 Codex 단일 조건                                   | 복합 부정·중첩/오류 연속 화면·사용자 수용              |
| FR019  | 전체 분포/건수·선택 정렬 표본·독립 정답                                                        | 실제 화면/키보드·목표 데이터 규모 성능 수용            |
| FR020  | 설명/조회0연산·차이/전체 미리보기·명시 적용·실 Codex 사례                                      | 복합 부정·실모델 설명/조회/오류 각 여정 수용           |
| FR021  | 직접/그룹 공유·받은함·동의 복제·원본/사본 분리                                                 | member 공유 정책·미확정 reload 복구·통합 UI/MySQL 수용 |
| FR022  | 권한/공유/그룹/출력 알림·본인 읽음/제거                                                        | 계정/조직 자동 사건 계약·장애·격리 통합 수용           |
| FR023  | 영속 export/CAS/lease·원자 파일·권한/만료·인스턴스 복구                                        | 실제 프로세스 재시작·MySQL 부분 실패·파일 업무 수용    |
| FR024  | 보관·Dashboard/Metric/Source 삭제 보호·정리·대시보드 상태                                      | 조직 자체 상태와 구분·통합 정리/Ego/운영 수용          |
| FR025  | 직전 기간 비교/Pivot/CSV 독립 정답·동일 기준 headless2                                         | 임의 비교 기간 계약·대표 보고서 전체 여정 수용         |
| NFR005 | 현재 계정/epoch/조직·권한/회수·선택 교차 큐·이번 MySQL 잠금                                    | 전 보호 경로/일반 쓰기 일관성·운영 수용                |
| NFR006 | 조건/비교/Pivot/CSV와 semantic 독립 oracle                                                     | 고정 기준 전체 여정·정밀/오차 기준·업무 정답 승인      |
| NFR007 | 정의/권한/공유/삭제/export actor/version 감사                                                  | 전체 사건 필수 필드·열람/보존 정책·운영 감사 수용      |
| NFR008 | 영수증/rollback·stale worker·일부 reload·MySQL 두 연결                                         | 공유/복제 reload·실제 재시작/실패 조합 통합 수용       |

## 구현 순서

1. [UC051](UC-051.md): 격리 조직/직원 수명주기·인증 회수 → 자원별 정책/보호 경로.
2. UC050 잔여: 조직 원천/변수 관리·상태/분류/날짜·승인/영향 확인.
3. UC052: 공통 조건 정의/직접·AI 차이·분포/규모/독립 oracle.
4. UC053: 수신자 권한 관계/독립 복제·멱등 전달/알림함.
5. UC054: 고정 실행 문맥·기간 비교·영속 export/파일 만료/회수.
6. UC055: 개인 보관/복원·사용처 기반 보호·전체 감사/TC050 통합.

각 단위는 AIWF 설계→작은 구현→선택 회귀/type/lint/build→독립 리뷰/화면 검증→문서/증빙→commit/push를 따른다. 테스트 계정/원본 데이터를 임의 정리하거나 운영을 변경하지 않는다. 전체 목표는 이 계획을 모두 채우기 전까지 active로 유지한다.

[공통 transaction 조정](UC-051-sqlite-coordination.md)은 SQLite의 Studio/enterprise/view/semantic 큐와 명시 metadata transaction을 DataSource별로 통합한다. 실제 Studio rollback에 다른 작업의 성공 쓰기가 사라지는 결함과 미커밋 활성/인증 상태 조회를 재현·선택 검증한다. 원시 Repository 단일 save/update/delete와 다른 일반 조회 경로·운영 경합은 후속이다. [검증 증빙](../testing/sqlite-coordination.md)을 전체 NFR005/008 완료로 확대하지 않는다.

[소스·지표/갱신 인증 후속](UC-051-metadata-boundaries.md)은 일반 metadata save/CAS·정의 RMW와 확정 refresh 조회를 이어간다. [증빙](../testing/metadata-boundaries.md)에 실제 rollback 저장 유실·확정 정의/SQL 구간 분리의 검증을 기록한다. 계정/세션 쓰기와 나머지 일반 경로/전체 NFR005/008은 후속이다.

[계정·세션 쓰기](UC-051-account-session-writes.md)는 token/사용자 연결 transaction·현재 연결/actor·epoch 재검사와 계정/가입·샘플 metadata 경계를 보완한다. [검증](../testing/account-session-writes.md)에서 실제 rollback/부분 실패와 전체 회귀를 구분한다. 다른 일반 자산 경계와 공통 분류/조건·수신자·파일/export·보관 등 제품 요건은 계속 열린다.

MySQL 계정 후속의 구체 잔여는 [계정·세션 계획](UC-051-account-session-writes.md#독립-검토의-잔여)의 가입 unique·membership FK/공통 잠금이다. SQLite 성공을 현재 없는 DB 제약의 증거로 대체하지 않는다.

[계정 무결성 후속](UC-051-identity-integrity.md)에서 userId/email unique·membership User FK·편입/삭제 공통 User 잠금과 legacy rehash CAS를 연결했다. [실제 MySQL 검증](../testing/identity-integrity.md)은 로컬 격리8.4.11의 동시 가입·프로필/소속·비활성 보존을 확인한다. 과거 계정·세션 문서의 MySQL unique/FK 잔여는 이 단위 범위로 갱신하며 운영 적용/실제 기존 데이터·다른 보호 경로 전체/공통 분류·조건·수신자·출력·보관·전체 수용은 열린다.

[UC052 소스 조건](UC-052.md)은 중첩 포함/제외 트리·전체 모집단 집계·현재 소스/조건 버전과 권한 확인·명시 버전 저장/재조회를 연결한다. [선택 증빙](../testing/source-conditions.md)을 Studio/AI·분포/출력/전체 FR018~020 수용으로 확대하지 않는다.

[UC052 Studio 연결](UC-052-studio-conditions.md)은 저장 조건을 명시 복사해 편집 문서·undo/redo·저장/reload와 기존 숫자/추세·게시·재사용에 연결한다. [검증 범위](../testing/studio-conditions.md)의 실제 SQLite/DuckDB 검사와 전체 업무 수용은 구분한다. 소스 조건 변경의 자동 전파·분포/표본·영속 export·Ego/실기기/운영은 남아 있다. AI 조건 변경안의 코드/선택 검증은 아래 후속을 따른다.

[UC052 AI 조건 검토](UC-052-ai-conditions.md)는 기존 질문에서 실제 열/타입으로 조건 변경안을 검증하고 현재/제안 차이·전체 미리보기를 명시 적용한 뒤 기존 저장으로 연결한다. 조건 제안의 저장 요청은 검토 전 쓰기0이며 설명/조회는 문서를 바꾸지 않는다. [선택 증빙](../testing/ai-condition-proposals.md)을 실제 Ego/모바일·실LLM/모든 자연어·전체 FR020 수용으로 확대하지 않는다.

[UC052 분포·표본](UC-052-profile.md)은 Source 조건 입력과 Studio 기간/공통 필터/포함·제외의 같은 범위에서 전체 빈도·상위20+나머지/정확 건수와 선택 열 최대20행 정렬 표본을 구분한다. [독립 원본 대조/실행 범위](../testing/condition-profile.md)는 실제 DuckDB/JWT/SQLite와 화면 mock 응답을 구분하며 새 실제 Ego/모바일·운영/전체 FR019 수용은 별도다.

[UC053 권한 알림](UC-053-notifications.md)은 기존 권한 변경의 확정 감사 원장을 본인 알림으로 투영하고 개인 읽음/목록 제거를 분리한다. [증빙](../testing/personal-notifications.md)은 JWT/SQLite와 컴포넌트 검증이며 직원/그룹 전달·독립 사본·공유/export 이벤트·실제 Ego/모바일·전체 FR021/022 수용은 후속이다.

[UC053 조회 공유](UC-053-deliveries.md)는 직접 grant와 별도인 수신자 관계·최대50명 원자 저장/CAS·조직에 묶인 요청 영수증·공유/회수 알림과 기존 대시보드 허용 목록을 연결한다. [증빙](../testing/recipient-deliveries.md)의 현재 명단 팀 선택은 snapshot이며 동적 그룹 권한이 아니다. 수신자의 소스 권한은 별도로 확인하고 회수는 직접 권한/원본/독립 사본을 지우지 않는다. 독립 사본 전달의 증빙은 별도다.

[UC053 받은 자료](UC-053-received.md)는 수신자 본인의 현재 유효한 delivery와 모든 소스 read를 확인한 뒤 제목/번호/공유 버전만 반환한다. 20개 후보가 모두 숨겨져도 검사 cursor로 다음 구간을 읽는다. [증빙](../testing/received-dashboards.md)의 명시 열기/새로 읽기·오류/늦은 응답/기존 보호 대시보드 링크 검증을 동적 그룹·독립 사본 전달·실제 Ego/운영 수용으로 확대하지 않는다.

[UC053 독립 복제](UC-053-copy.md)는 기본 미허용의 별도 소유자 동의와 private received resolver로 기존 본인 소스 매핑/미리보기/원자 저장을 재사용한다. [증빙](../testing/received-copy.md)은 실제 DuckDB/SQLite/JWT HTTP·수신자 데이터1000 oracle/새 ID·모든 폭 배치·rollback/영수증·회수 후 사본 독립성을 구분한다. 동적 그룹·미저장/미확정 요청의 브라우저 reload·실제 Ego/모바일/MySQL/사람 수용과 전체16개 목표는 계속 열린다.

[UC053 동적 그룹 전달](UC-053-group-deliveries.md)은 그룹 단위 CAS/감사/영수증, 현재 구성원 기반 받은 자료와 그룹 동의에 묶인 private 복제 reference를 구현 범위로 정의한다. [선택 실행 증빙](../testing/group-deliveries.md)은 SQLite/JWT/DuckDB·컴포넌트 실행 범위를 기록하며 실제 UI/전체 수용 완료를 뜻하지 않는다. 실제 UI/모바일·MySQL/운영·그룹 알림과 전체 FR021 수용은 남는다.

[UC053 그룹 알림](UC-053-group-notifications.md)은 그룹 감사 subjectId를 groupId로 유지하고 사건 시점의 `(eventId, recipientId)` snapshot을 별도 저장한다. 그룹 공유/회수와 명시적 구성원 추가·제외/그룹 활성 변경만 알림 사건이며, 계정/조직 활성 변경 auto-notice는 후속이다. [증빙](../testing/group-notifications.md)은 SQLite/JWT·컴포넌트 선택 실행을 기록한다. export 이벤트와 실제 UI/모바일·MySQL/운영·사람 수용은 남아 있으며 TC050은 NOT_RUN이다.

[UC054 영속 집계 export](UC-054-export-jobs.md) 구현 slice는 현재 JWT actor/조직·소스 export 권한과 auth epoch를 재검사하고, 고정 Explore/Pivot aggregate 요청을 UUID 멱등 작업으로 저장한다. 명시 실행은 CAS/lease 기반 running 응답 후 SQL을 metadata transaction/SQLite queue 밖에서 처리하며 완료 상태와 파일 조각을 원자 저장한다. [증빙](../testing/export-jobs.md)의 SQLite/DuckDB/JWT와 FE 컴포넌트 범위는 FR023 전체 완료, FR025 전체 수용 또는 E09/E10/E14 통과를 뜻하지 않는다. Ego96 새 UI/390·768·1440, 실휴대폰, MySQL/운영, 사람 수용과 전체 TC050은 NOT_RUN이다. FR014~025/NFR005~008 전체 목표는 유지한다.

[동적 그룹 설계](UC-051-groups.md)·[증빙](../testing/dynamic-groups.md)은 현재 구성원 기반 직접/그룹 권한 합산·동일 token 회수·게시 소비자 차단·그룹 생성 영수증을 연결한다. UC053의 그룹 전달은 별도 [계획](UC-053-group-deliveries.md)과 위 구현 포인터를 따른다. 그룹 알림·영속 파일/실제 Ego/MySQL·운영/전체16개 수용은 별도다.

[UC054 출력 결과 알림](UC-054-export-notifications.md)은 확정 export 감사 사건의 본인/현재 조직 투영을 기존 받은함에 연결한다. [증빙](../testing/export-notifications.md)은 알림 읽음/제거·목록 장애와 파일 보존/현재 권한 차단을 분리한다. 외부 발송·실제 UI/모바일/MySQL/운영 및 전체 수용은 후속이다.

[UC055 개인 보관/복원 계획](UC-055-library-archive.md)은 기존 허용 목록과 분리한 본인/현재 조직 상태로 active/archived 목록을 연결한다. [삭제 보호 후속 설계](UC-055-dependency-deletion.md)는 현재 순차 삭제의 원자성/사용처 경합 공백을 기록한다. 개인 보관을 영구 삭제 보호 완료로 승계하지 않으며 FR024 전체·실제 UI/운영 수용은 계속 열린다.

[UC055 대시보드 삭제](UC-055-dashboard-delete.md)는 사용처 종류/건수·현재 소유/actor/org/JWT epoch·기준 재검증과 공통 부모 잠금 아래 원자 삭제/영수증을 연결한다. [증빙](../testing/dashboard-deletion.md)은 실제 SQLite/JWT·선택 공유/저장 경합과 자동 화면의 범위를 구분한다. source/metric 삭제·조직 비활성·실제 Ego/실휴대폰/MySQL/운영 및 전체 FR024/NFR005/007/008 수용은 계속 열린다.

[UC055 지표 삭제 보호](UC-055-metric-delete.md)는 Dashboard 구조화 정의/붙은 Pivot·현재 Studio 문서·ExploreView/소스 PersonalView를 현재 명시 참조로 조사한다. [증빙](../testing/metric-deletion.md)은 source 소유/현재 계정/조직/epoch·삭제 기준과 Source→Metric 잠금/영수증의 실행 범위를 기록한다. 무조건 논리 삭제를 보호 경로로 교체하지만 source 영구 삭제·조직 비활성·실제 Ego/실기기/운영 및 전체16개 수용으로 승계하지 않는다.

[UC055 소스 삭제](UC-055-source-delete.md)·[증빙](../testing/source-deletion.md)은 원자 metadata 삭제와 별도 파일 정리 복구의 현재 단위를 기록한다. 참조 자원은 자동 정리하지 않으며 전체16개 요건과 조직 비활성/운영·사람 수용은 계속 열린다.

[UC055 조직 대시보드 상태](UC-055-dashboard-lifecycle.md)·[증빙](../testing/dashboard-asset-lifecycle.md)은8종 중단 영향·명시 비활성화/복원과 제한된 관리/회수, 원자 영수증과 복제 준비 lifecycle 기준을 연결한다. 개인 보관·물리 삭제와 분리하며 현재 원 소스/권한·만료를 우회하지 않는다. 실제 실행 범위와 전체 E03/E11/E12/E14·16개 수용은 구별한다.

## 다음 단위의 명세·코드 대조

[UC052 조회·출력 기준 설계](UC-052-explore-basis.md)는 명시 조건 snapshot의 Explore/Pivot·저장 보기 연결과 화면 후 지표 변경의 CSV 차단을 다룬다. 기간 비교/시간대/중첩 조건/CSV 계산 자체는 기존 구현을 재사용한다. 업무 날짜·유형의 직접/AI 조건 실행 후속은 [고정 의미 계획](UC-050-condition-semantics.md)·[선택 증빙](../testing/business-condition-semantics.md)에 연결했다. 조직 공통 분류 재사용의 registry/실제 MySQL 선택 증거는 아래 단위를 따른다. 공통 분류의 권한/FE 복구·통합/수정 후 UI 검사는 아래 최종 증빙을 따른다. FR015 잔여는 최종 시각 열람과 새 semantic 지표/차원 생성의 전체 업무 의미 적용·업무 수용이다. 유형/날짜 문자열 저장 자체나 소스 이용 권한을 전혀 없는 기능으로 계산하지 않는다. 별도 다단계 승인 workflow를 새 필수 요건으로 추정하지 않는다. 구현·실행 증빙과 전체16개/TC050 수용은 계속 구별한다.

[동일 기준 실행 증빙](../testing/explore-reviewed-basis.md)은 BE397/FE237과 격리 headless 고유2개의 명시 조건 적용·보기 복구·현재/이전 기간·CSV·지표 변경 거절 범위를 기록한다. 실제 Ego/휴대폰/이번 MySQL/운영 및 전체16개/TC050 수용은 별도다.

[업무 조건 의미 선택 증빙](../testing/business-condition-semantics.md)은 Source49·격리 MySQL migration/영속2·Studio profile41·FE Studio+Explore52 suites/802 distinct·Source headless UI1의 개별 범위를 기록한다. 각 배치의 중복을 합산하지 않는다. 390/768/1440 overflow0·채택36px/14px와 실제 Ego/휴대폰 수용을 구별한다. 단일 조건 질문의 실 Codex UI1개는14.5초 PASS지만 복합 부정 의도 제한은 열린다. BE26 suites/884 unique는 단계별 검증했고 Jason·Bernoulli 범위 검토는 APPROVE/0 findings지만 안정 BE type/lint/build·ui-stable1 PASS/11.9초를 확인했고 해당 조건 의미 단위의 core-stable14 PASS/38.3초를 확인했으며 전체16개 요건 수용은 열린다.

조건 의미 후속의 core headless14 PASS/49.4초·Explore semantic oracle8 PASS/22 SKIP는 [동일 증빙](../testing/business-condition-semantics.md)에 별도 기록한다. Source390/실 Codex 저장 Studio390 화면은 Main이 넘침 없음을 열람 확인했다. BE26-suite는 최초24 PASS/2 FAIL 뒤 legacy18/resource6 전체 재실행으로26 suites/884 unique를 단계별 검증했다. 최초864 PASS의 중복4개를 재가산하지 않는다. 비활성 계정 read guard 수정·Jason/Bernoulli APPROVE0·안정 BE type/lint/build PASS·최종 dist ui-stable1 PASS/11.9초를 반영하며 해당 조건 의미 단위의 core-stable14 PASS/38.3초를 확인했다. 새 분류 UI/통합 검증으로 승계하지 않는다. ui-stable은 같은 질문의 우선 증빙으로 이전 ui-codex와 합산하지 않는다.

[UC050 조직 공통 분류](UC-050-classifications.md)·[선택 증빙](../testing/organization-classifications.md)은 현재 조직 registry와 source edit의 분리, 두 source의 같은 ID 연결·역사 이름/ref 보존·명시 최신 채택·nullable 해제, UUID 생성 영수증/CAS/감사를 연결한다. registry47 PASS와 실제 MySQL15 PASS는 각각의 실행 범위이며 합산하지 않는다. 실제 SourceCatalogService/DuckDB·InnoDB 잠금 대기/rollback·migration 반복과 격리 fixture CLEANUP PASS를 확인했다. 생성 영수증은 현재 상태 증명이 아니며 reload 복구는 로그인 세대/actor/조직에 묶인24시간/8KiB 최소 요청의 명시 확인/자동 POST0이다. catalog read/JWT 보강 후135 PASS·types/lint/격리 build·Bernoulli APPROVE0와 실제 ui-second1 PASS/9.7초를 확인했다. Main의 Source/조직390/768/1440 열람은 overflow0·controls36px·입력900px 미만16px/desktop14px다. BE 최종10 suites/293 PASS는 registry47/catalog135/condition regression111을 포함하며 다시 더하지 않는다. global BE types/lint/build와 FE helper read/delete 수정 후8 suites/102 PASS·types/lint/build를 확인했다. read-guard 후 MySQL 최종15 PASS/8.924초는 현재8개 source hash 실행 중 불변·owned CLEANUP PASS이며 이전15를 더하지 않는다. core-final15 PASS/51.0초 뒤 마지막 FE receipt/pagination finding을 수정했다. 영향 Classifications13 PASS·types/lint/build는 기존102와 겹치며 새3개를 포함하므로102+13으로 합산하지 않는다. 수정 후 실제 ui-stable2 PASS/13.4초는 확장 전체 흐름과 페이지 밖 역사 영수증/현재 목록 분리를 확인했다. Jason 최종 FE·Bernoulli BE는 모두 APPROVE0다. Main이 최종6개 controls capture를 열람해768/1440에서 업무 유형/날짜 custom label+NativeSelect와 분류 TextField 입력 상단이 약7px 어긋나는 문제를 확인했다. Tesla가 기존 UI Kit을 유지하며 동일 TextField select로 맞추는 수정과 세 입력행 top 차이≤1px assertion을 포함한 실제 UI2 재실행이 대기다. 이전 UI2 PASS는 시각 수정 전 결과이며 최종 정렬 PASS로 승계하지 않는다. Ego96 제어권 인수·물리 휴대폰·운영·사람 수용은 미실행이다. 새 semantic 지표/차원 생성·실제 Ego/휴대폰/운영·사람 및 전체16개 요건 수용은 열린다.

[신규 semantic 업무 기준](UC-050-semantic-business-basis.md)·[증빙](../testing/semantic-business-basis.md)은 실제 Codex/격리 Chromium의 직접/AI 생성·정답60/30/30/40/20·저장/reload·비공개 게시/중지와390/768/1440을 선택 검증했다. 모바일 SVG 너비 오류도 수정·실측했다. BE481/검토 영향161·FE182/후속124/98은 중복이므로 합산하지 않는다. 다음 수용은 이번 단위 MySQL과 남은 TC050 요건별 결손 감사·실기기/운영/사람이며 전체16개 goal은 계속 활성이다.

## 고정 업무 기준 MySQL 후속

[계획](UC-050-semantic-mysql.md)·[실행 증빙](../testing/semantic-business-mysql.md)은 이번 metadata MySQL8.4.11/native DuckDB의64개(이전61과 중복)와 실제 두 연결의 User 잠금·동시 게시 영수증·rollback/409를 확인한다. LLM/Studio snapshot fixture와 runtime의 실제 ConnectionService를 구분한다. 기존 조건·파일 권한·출력 알림·삭제 보호·독립 oracle를 현재 표에 반영했다. [전체 수용 점검](../testing/enterprise-acceptance-audit.md)의 계약/검증/운영·사람 잔여가 모두 해소되기 전 전체16개 완료로 판정하지 않는다.

## UC051 직원 검색·조직 이동 후속

[설계](UC-051-staff-transfer.md)·[증빙](../testing/staff-transfer.md)은 직원 검색과 본인/양쪽 admin 동의·고정 수락 기준·양쪽 조직 CAS·이전 access/refresh 회수·직접/그룹/전달 권한 회수 및 개인 자료/독립 사본/게시 행 보존을 연결한다. SQLite/실제 Docker MySQL·FE 선택 실행은 증빙에 한정한다. 전체 FR016/FR017·탈퇴/업무 자산 이관·실제 Ego/실기기/운영/사람 수용은 미완료다.
