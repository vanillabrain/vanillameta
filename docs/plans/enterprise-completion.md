# 추가 기업용 요건 완료 목표

2026-10-18 사용자 지시로 FR014~025/NFR005~008 전체를 완료 목표로 등록했다. 브랜치 develop-v2·MK AI 연동 제외·비공개 기업자료 공개 금지를 유지한다. 이 계획은 승인/수용 완료가 아니다.

## 완료 판정

각 요건의 구현/자동 검사/실제 UI/권한·정답 대조/운영·사람 수용을 구분한다. [TC050](../test_cases/TC-050-enterprise-analysis.md) E01~E14 전체와 기존 TC005 회귀를 종료 기준으로 한다. 실제 Ego 사용자 제어권·실기기/운영 접근 등 미실행은 분리하고 완료로 승계하지 않는다. 진행률은 완전 충족 항목 수/16이며 하위 UI 작업 수를 전체 비율로 계산하지 않는다.

| 요건   | 현재 범위                                                                   | 남은 결과                                               |
| ------ | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| FR014  | 소스 설명/이력/미리보기·사용처·활성 상태/중앙 차단                          | 이용 범위·승인/영향 확인·실제 UI 수용                   |
| FR015  | 표시명/설명/단위·업무 유형/날짜·분류·지표 기준 조회                         | 공통 분류/AI·조건 실행 적용·실제 UI 수용                |
| FR016  | 격리 조직/직원·팀·동적 그룹/구성원 CAS 자동/HTTP 검증                       | 실제 UI·운영 조직 관리 수용                             |
| FR017  | 직접/그룹 grant·현재 구성원/권한·회수 자동/HTTP 검증                        | 영속 파일 소비자/실제 UI 수용                           |
| FR018  | 중첩 조건 저장·Studio 명시 적용/복구·게시/복제 연결                         | 실LLM·실제 UI 수용                                      |
| FR019  | 전체 건수·값 빈도/상위20+나머지·선택 열 정렬 표본                           | 실제 UI·대규모 성능/운영 수용                           |
| FR020  | 직접/AI 조건 검증·차이/전체 미리보기·명시 적용                              | 실LLM/설명·조회 구분의 실제 UI 수용                     |
| FR021  | 배치 공유·받은 자료·동의 기반 독립 복제/영수증·동적 그룹 받은 자료/복제     | 실제 UI·MySQL/운영·그룹 알림 수용                       |
| FR022  | 권한/공유/회수 본인 알림·그룹 사건 수신자 snapshot·읽음/목록 제거·멱등 상태 | 계정/조직 활성 변경 auto-notice·실제 UI/MySQL/운영 수용 |
| FR023  | 영속 집계 export 작업·멱등 접수/CAS 실행·만료/권한 보호 파일의 구현 slice   | 실제 UI/기기·MySQL/운영·사람 수용 및 전체 TC050         |
| FR024  | 직접 소스 사용처 일부                                                       | 개인 보관/복원·자산 비활성/삭제 영향                    |
| FR025  | 기존 기간 비교 기반·고정 집계 export 문맥                                   | 전체 비교 리포트/파일 업무 수용·독립 oracle 통합        |
| NFR005 | 소유권·활성/epoch·grant·확정 권한 조회/교차 큐 선택 검증                    | 조직/활성/회수 전 보호 경로 일관성                      |
| NFR006 | 기존 선택 숫자 정답 증빙                                                    | 조건/비교/export 동일 문맥 독립 정답                    |
| NFR007 | 소스 설명 actor/version 이력 일부                                           | 권한/공유/보관/export 감사                              |
| NFR008 | 기존 저장 영수증·명시 SQLite transaction 공통 조정                          | 전달/export/알림 작업 복구                              |

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
