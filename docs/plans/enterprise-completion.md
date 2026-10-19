# 추가 기업용 요건 완료 목표

2026-10-19 현재 대조 · develop-v2/26a5be57 (`fix: preserve export jobs across process restarts`) 기준. 2026-10-18 등록한 FR014~025/NFR005~008 전체 완료 목표를 유지한다. MK AI 연동 제외·비공개 기업자료 공개 금지를 지키며, 이 계획은 승인/수용 완료가 아니다.

## 완료 판정

각 요건의 구현/선택 자동 검사/실제 UI/권한·정답 대조/운영·사람 수용을 구분한다. [TC050](../test_cases/TC-050-enterprise-analysis.md) E01~E14 전체와 기존 TC005 회귀가 종료 기준이다. 개별 Ego·MySQL 통과를 현재 TC050의 동일 데이터 전체 여정이나 운영·실휴대폰·사람 수용으로 승계하지 않는다. 하위 구현 수·겹치는 테스트 수를 전체16개 완료율로 환산하지 않으며 **모든 행의 전체 업무 수용은 Open**이다.

최신 세부 대조는 [16개 요건 수용 점검](../testing/enterprise-acceptance-audit.md)을 따른다. 아래 현재 표·다음 작업이 누적 후속 기록의 과거 잔여 문구보다 우선한다. 직원 검색/이동·지원 범위 인계·조직 탈퇴, 직원/그룹 전달·받은 사본 저장 복구, 실제 출력 프로세스 재시작은 최신 증빙의 구현·선택 검증 완료 범위이며 다시 미구현으로 올리지 않는다.

**구현·계약 + 수용**은 미구현 기능 또는 미확정 정책이 있는 행, **경로 확인 + 수용**은 전체 연결 여부를 더 대조해야 하는 행, **수용 중심**은 지원 계약 안에서 확인된 주요 구현 결손 없이 통합/업무 검증이 남은 행이다. 경로 미확인을 확정 결함으로, 수용 공백을 미구현으로 계산하지 않는다.

| 요건/TC050                | 잔여 구분        | 확인한 구현·최신 증거                                                                                                                                                                                                                                                                                     | 구현·계약 공백                                                                                                       | 검증·수용 공백                                                                                                                                      |
| ------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR014 E01/E02/E12         | 구현·계약 + 수용 | 설명·버전·미리보기·제한된 직접 사용처·이용 권한·활성 차단 ([사용처](../testing/source-catalog-usage.md), [활성](../testing/source-availability.md))                                                                                                                                                       | 지원 영향 종류·미포함 범위와 변경 안내 계약 확정. 직접 참조 목록을 전체 영향 그래프로 간주하지 않음                  | schema/활성/권한 변경 안내·거절 시 저장0의 연결 여정, 운영·업무 승인 기준                                                                           |
| FR015 E01/E04/E08/E13/E14 | 구현·계약 + 수용 | 업무 유형/날짜/단위·공통 분류·고정 의미·직접/AI 생성·저장/게시/복제·실 Codex/headless·MySQL 선택 검증 ([업무 기준](../testing/semantic-business-basis.md), [MySQL](../testing/semantic-business-mysql.md))                                                                                                | 복합 부정 표현의 안전한 분기·지원 범위. 모든 자연어 지원을 보장하지 않음                                             | 전체 생성 조합과 현재 TC050 고정 데이터 대조·실휴대폰·운영·업무 의미 수용                                                                           |
| FR016 E02/E03             | 구현·계약 + 수용 | 직원 검색·양쪽 admin 검토/이동 ([화면](../testing/staff-transfer-ui.md)); 별도 최종 동의의 [대시보드](../testing/handover-transfer.md)·[소스](../testing/source-handover.md)·[묶음 인계](../testing/bundle-handover.md), [조직 탈퇴](../testing/staff-departure.md)의 회수·재로그인·본인 영수증·자료 보존 | 외부 연결/활성 공유 자산 인계는 현재 차단 범위이며 확장 계약 미확정. 법적 퇴사·계정 삭제를 조직 탈퇴와 혼용하지 않음 | 이동/지원 인계/탈퇴의 선택 MySQL·Ego101/106~109는 확인됨. 전체 직원 관리 연결 여정·전 역할·운영·실기기·사람 수용                                    |
| FR017 E02/E03/E09         | 경로 확인 + 수용 | 직접/그룹 grant·별도 source read·게시/복제·완료 파일 현재 권한 검사와 이동/탈퇴 후 회수 ([권한](../testing/enterprise-resource-access.md), [탈퇴](../testing/staff-departure.md), [출력 재시작](../testing/export-restart.md))                                                                            | 전 보호 경로의 정책 연결 여부 목록화·누락 확인. 이미 보호된 파일 소비자를 미구현으로 재분류하지 않음                 | [역할 HTTP 선택 검증](../testing/enterprise-access-matrix.md)299건/거절111건을 확인. 미실행 보호 경로·legacy/별도 governance·진행 중 경합·운영 수용 |
| FR018 E04                 | 구현·계약 + 수용 | 중첩 조건·명시 적용·undo/redo·저장/reload/게시/복제·실 Codex 단일 조건 ([조건](../testing/business-condition-semantics.md))                                                                                                                                                                               | 복합 부정 표현 지원 범위. 조건 자동 전파를 명시 적용 계약에 추가하지 않음                                            | 중첩 AND/OR·오류·파일 교체의 연속 화면과 현재 TC050 동일 조건 대조·사용자 수용                                                                      |
| FR019 E05                 | 수용 중심        | 전체 건수·빈도/상위20+나머지·선택 열 정렬 표본·독립 정답 ([분포](../testing/condition-profile.md))                                                                                                                                                                                                        | 확인된 주요 구현 결손 없음. 정렬 표본을 무작위 대표표본으로 부르지 않음                                              | 분포/표본 실제 화면·키보드·변경 중 거절·목표 데이터 규모 성능·업무 수용                                                                             |
| FR020 E04                 | 구현·계약 + 수용 | 설명/조회0연산·조건 차이/전체 미리보기·명시 적용·검토 전 저장0·실 Codex 조건 ([AI 조건](../testing/ai-condition-proposals.md), [의미](../testing/business-condition-semantics.md))                                                                                                                        | 복합 부정 의도 처리의 지원·거절 경계                                                                                 | 실모델 설명/조회/변경의 연속 여정, unknown/type/no-op/stale 시 질문·초안·저장본 불변·사람 수용                                                      |
| FR021 E06/E07             | 구현·계약 + 수용 | 직접/그룹 공유·받은함·별도 복제 동의·본인 소스 사본; [직원 복구](../testing/delivery-recovery.md)·[그룹 복구](../testing/group-delivery-recovery.md)·[받은 사본 복구](../testing/received-copy-recovery.md)의 reload/정확 replay·회수 후 사본 유지·Ego110~112                                             | 일반 소유 member 공유 정책 미확정. 일반 게시/소유 저장본의 전면 초안 복구는 이번 지원 밖이며 임의 필수화하지 않음    | 현재 TC050의 공유→복제→회수→사본 보존을 전체 HTTP MySQL에서 연결·전 역할/경합·전달 업무 수용                                                        |
| FR022 E07/E12             | 구현·계약 + 수용 | 권한/공유/그룹 audience·출력 완료/실패/취소 알림·본인 읽음/목록 제거 ([그룹 알림](../testing/group-notifications.md), [출력 알림](../testing/export-notifications.md))                                                                                                                                    | 계정/조직 활성 변경 auto-notice는 미구현. FR022 사건 범위와 TC050 E07 계약 일치 여부 결정                            | 알림 장애에도 확정 공유/파일 보존·본인/현재 조직 격리의 통합 UI/MySQL·감사 수용                                                                     |
| FR023 E08/E09/E10/E14     | 수용 중심        | 고정 기준 UUID접수·CAS/lease·원자 파일·만료/현재 권한; [재시작](../testing/export-restart.md)의 실제 MySQL 서비스 자식 SIGKILL/새 PID 7 PASS와 SQLite 전체 API/Ego113 queued/ready 재시작·동일 CSV·중단 명시 재실행                                                                                       | 이번 지원 계약의 확인된 추가 구현 결손 없음. 인스턴스 재생성만의 한계는 실제 프로세스 검증으로 보완됨                | 전체 Nest HTTP MySQL·현재 TC050 비교/파일 정답·전 역할·모든 중단 위치/자연 시간 경과·파일 업무/운영 수용                                            |
| FR024 E03/E11/E12         | 경로 확인 + 수용 | 개인 보관·대시보드/지표/소스 삭제 보호·정리·조직 대시보드 비활성/복원 ([보관](../testing/personal-library-archive.md), [지표](../testing/metric-deletion.md), [소스](../testing/source-deletion.md), [상태](../testing/dashboard-asset-lifecycle.md))                                                     | 모든 writer의 보호 연결 범위 확인. 조직 자체 비활성과 조직 대시보드 상태를 혼용하지 않음                             | 동일 자료의 보관/공유/삭제/정리 연결 여정·전체 HTTP MySQL·운영/사람 수용. 기존 MySQL은 해당 slice만 인정                                            |
| FR025 E08/E14             | 구현·계약 + 수용 | 현재/직전 기간·시간대·분류/추이/Pivot·즉시/영속 CSV 정답·headless 고유2 ([동일 기준](../testing/explore-reviewed-basis.md))                                                                                                                                                                               | 임의 비교 기간 요구 여부 확정. 별도 보고서 엔진을 임의 필수로 추정하지 않음                                          | 현재 TC050 대표 보고서 조회/파일 동일성·0행/0분모·기간 경계의 전체 HTTP MySQL 대조·업무 수용                                                        |
| NFR005 E02/E03/E09        | 경로 확인 + 수용 | 현재 active/epoch/조직·소유/grant·파일 권한·선택 교차 큐/MySQL 잠금; [이동](../testing/staff-transfer.md)·[탈퇴](../testing/staff-departure.md)·[복제 복구](../testing/received-copy-recovery.md)·[출력 완료](../testing/export-restart.md)의 재검사                                                      | 일반 Repository/조회와 모든 writer의 잔여 경로 목록화·누락 확인                                                      | [HTTP 행렬](../testing/enterprise-access-matrix.md)의 다음 요청 회수는 확인. 미실행 경로/모든 writer·진행 중 경합·운영 수용                         |
| NFR006 E05/E08/E14        | 수용 중심        | 조건/기간 비교/Pivot/CSV·semantic 독립 oracle 및 버전 변경 거절 ([조건 정답](../testing/condition-profile.md), [동일 기준](../testing/explore-reviewed-basis.md), [업무 기준](../testing/semantic-business-basis.md))                                                                                     | 확인된 주요 구현 결손 없음. 독립 정답 자체를 미구현으로 계산하지 않음                                                | 현재 TC050의 하나의 고정 기준으로 전체 여정 대조·정밀값/NULL/0분모/오차 기준·업무 정답 승인                                                         |
| NFR007 E12/E14            | 경로 확인 + 수용 | 정의·권한/공유·보관/삭제·출력 actor/resource/version 감사와 인계/탈퇴·복구 replay의 추가 감사0 ([탈퇴](../testing/staff-departure.md), [직원 복구](../testing/delivery-recovery.md), [그룹 복구](../testing/group-delivery-recovery.md), [재시작](../testing/export-restart.md))                          | 전체 사건 필수 필드·현재 열람 경로의 누락 여부 확인                                                                  | time/result·원본 행/비밀 비노출, 운영 보존 기간·감사 열람 정책/담당자 합의                                                                          |
| NFR008 E07/E09/E10        | 경로 확인 + 수용 | 저장/공유/출력/삭제 영수증·rollback·stale worker; [직원](../testing/delivery-recovery.md)/[그룹](../testing/group-delivery-recovery.md)/[받은 사본](../testing/received-copy-recovery.md) reload 복구 및 [실제 출력 프로세스 재시작](../testing/export-restart.md)                                        | 일부 일반 쓰기 조정·모든 writer 적용 범위 확인. 검증된 세 복구와 출력 재시작을 미구현 잔여로 다시 올리지 않음        | 응답 유실/중복/알림 장애/재시작을 현재 TC050 전체 HTTP MySQL 여정으로 연결·운영 복구 수용                                                           |

## 다음 작업

1. [실제 전체 앱 MySQL 통합](../testing/enterprise-integrated-mysql.md)의 대표 정상 여정은 PASS_SELECTED다. 실제 모델 질문·비공개 저장·직접 공유·본인 소스 복제·비교/CSV·보관/복원·재시작 보존은 확인했다. 역할/회수 HTTP 선택 행렬은 이번 후속에서 확인했다. 다음은 미실행 경로·조합과 AI·조건/정답 변형이다. 이미 통과한 정상 여정을 미실행으로 다시 올리지 않는다.
2. 일반 소유 member 공유 정책, 계정/조직 활성 변경 자동 알림, 복합 부정 지원·거절, 임의 비교 기간·지원 밖 인계 확장 범위를 별도 결정한다. 미확정 정책을 자동 권한 부여/삭제/이관으로 구현하거나 이 통합의 새 필수 기능으로 추정하지 않는다.
3. 확정 계약의 전 역할×보호 경로·일반 writer·알림 장애·권한 회수·원본/사본/파일·감사를 대조하고, 확인된 통합 결함만 최소 수정한다. E01~E14 실행 결과와 운영 migration/Node24·물리 휴대폰·업무 정답/사람 수용은 각각 별도 gate로 기록한다.

[출력 재시작 증빙](../testing/export-restart.md)의 MySQL 7 PASS는 서비스 호스팅 자식 프로세스의 SIGKILL/새 PID·실제 DB/파일 검증이고, Ego113은 SQLite 전체 HTTP API의 queued/ready 재시작·동일 CSV와 별도 interrupted fixture 검증이다. 전체 Nest HTTP MySQL이나 자연 임대/TTL 경과·모든 중단 위치의 증거는 아니다. 앞선 [semantic MySQL64](../testing/semantic-business-mysql.md)도 해당 선택 범위로만 유지한다.

각 단위는 AIWF 설계→작은 구현→범위에 맞는 검증→독립 리뷰/실제 화면→문서/증빙 순서를 따른다. 테스트 계정/원본 데이터를 임의 정리하거나 운영을 변경하지 않는다. 전체 목표는 수용 잔여가 실제로 해소되기 전까지 active로 유지한다.

## 누적 후속 기록 — 각 실행 당시 기준

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

[UC051 실제 화면 후속](../testing/staff-transfer-ui.md)은 초기 상태 조회 공백과 오류 안내/검색 정렬을 보완하고 Ego101에서 명시 조직 이동/409 복구/재로그인/reload를 확인했다. 직원 관리의 다음은 탈퇴/업무 자산 인계 계약이며 운영/전 경로/사람 수용은 남는다.

[퇴사·인계 전 영향 확인 설계](UC-051-departure-impact.md)는 탈퇴·계정 삭제·자료 인계의 단계를 구분하고 먼저 같은 조직 admin의11종 건수 조회를 구현한다. 자산 내용 접근권·소유권 변경을 부여하지 않으며 개인 전체 소유 건수와 조직 관계 수를 구분한다. 실제 인계/탈퇴 확정·수신자 수락/의존성 계약·전체 수용은 후속이며 [선택 증빙](../testing/staff-departure-impact.md)만 실행 범위로 인정한다.

[자료 선택·인계 의향 후속](UC-051-handover-proposal.md)은 소유자의 source/dashboard 명시 선택과 제목·번호 공개 동의→지정 수신자 검토/수락·소유자 철회를 연결한다. 의향 기록은 grant/실제 소유권 이전/퇴사 확정이 아니며, 실행은 전체 의존성·파일 보관 주체·최신 기준을 고정하는 후속으로 남는다. [선택 증빙](../testing/handover-proposal.md)과 전체16개 수용을 분리한다.

[인계 전 연결·보관 조건 검토](UC-051-handover-review.md)는 수락된 요청의 소유자에게 선택 대시보드의 명시 연결과 소스 누락·파일/외부 연결 보관 검토 필요를 표시하는 다음 단위다. 선택 연결의 covered는 전체 이전 가능 판정이 아니며 실제 실행·전역 역방향 의존성/파일 실체·최종 이전 동의/원자 영수증·탈퇴는 후속이다. [선택 증빙](../testing/handover-dependency-review.md)만 실행 범위로 인정한다.

[관리 파일 보관 관측](UC-051-handover-custody.md)은 수락된 요청 소유자의 파일 존재/연결 신원·알려진 공유 소비자·미해제 갱신 상태를 별도 읽는다. observed/none_observed는 관측 범위이며 내용 정상·배타적 보관·실행 승인이 아니다. [선택 증빙](../testing/handover-file-custody.md)과 실제 이전/퇴사·최종 동의/CAS/영수증·전체16개 수용을 분리한다.

## UC051 최종 대시보드 인계 후속

[설계](../plans/UC-051-handover-transfer.md)와 [실행 기록](../testing/handover-transfer.md)은 제목 공개 의향과 별도의 양쪽 최종 동의·원자 소유 mapping 변경/영수증을 연결했다. MySQL215·Ego106/대표 폭은 선택 범위이며 전체 수용과 구별한다. 지원 범위는 수신자가 소스를 이미 소유한 비공개 단독 대시보드이며 source/파일·퇴사/탈퇴·운영/사람/전체16개 수용은 별도다. 하위 구현 수를 전체 완료율로 계산하지 않는다.

## UC051 소스·파일 관리권 인계 후속

[설계](UC-051-source-handover.md)·[증빙](../testing/source-handover.md)은 사용 중 관계가 없는 ready 등록 DuckDB 소스의 별도 양쪽 최종 동의·원자 관리권 이전/영수증이다. 파일 경로/bytes·지표 정의/이력은 보존하며 기존 소유자의 다음 보호 요청은 거절한다. 외부 연결·혼합 자산/실사용 관계·물리 파일 이동·퇴사/탈퇴 확정·운영/실기기·전체16개 수용은 별도다. 하위 구현 수를 전체 완료율로 계산하지 않는다.

## UC051 소스·연결 대시보드 묶음 인계 후속

[설계](UC-051-bundle-handover.md)·[증빙](../testing/bundle-handover.md)은 고정 선택 소스와 그 소스만 쓰는 비공개 단독 대시보드의 양쪽 최종 동의→원자 관리권 이전/영수증을 연결한다. 미선택 연결/활성 공유/열린 작업은 전체 차단하며 검증된 canonical·동등 미연결 자식과 파일/문서/ID/과거 정의는 보존한다. MySQL313·SQLite45/8SKIP·FE176은 범위별 중복 배치이며 합산하지 않는다. Ego108의 실패/reload/동일 UUID·수락/실행/reload·권한 회수/파일·문서 보존·대표 폭은 선택 범위다. 외부/실사용 공유·퇴사/운영/실기기/전체16개 수용은 별도다.

## UC051 인계 후 조직 탈퇴 후속

[설계](UC-051-staff-departure.md)·[증빙](../testing/staff-departure.md)은 본인 명시 요청과 다른 현재 admin의 잔여 검토/최종 동의를 분리한다. 소유 자료와 미해결 작업이 남으면 차단하며, 인계 이후 잔여 0건에서 Membership·직접/그룹/전달 관계와 로그인 epoch를 회수한다. 계정 활성·인계된 원본/파일/문서/과거 기록을 보존한다. MySQL78/1SKIP·SQLite145/11SKIP·FE120/후속26 및 Ego109 대표 여정은 선택/중복 범위이며 합산하지 않는다. 법적 퇴사·계정 삭제·외부/활성 공유 자산 인계·전체 역할/운영/실휴대폰/사람·전체16개 수용은 Open이다.

## UC053 직접 직원 공유 요청 복구 후속

[설계](UC-053-delivery-recovery.md)·[증빙](../testing/delivery-recovery.md)은 직접 공유/회수·복제 허용 설정의 frozen UUID/입력 탭 보존과 reload→현재 조회→별도 동의 동일 요청을 연결한다. 역사 결과와 현재 관계를 구별하고 User 잠금 뒤 epoch를 검사한다. MySQL7·SQLite23/2SKIP·BE4·FE57/부모16·Ego110은 선택/중복 범위다. 그룹 공유·독립 사본 생성 요청 복구와 일반 member 공유 정책·전체16개 수용은 Open이다.

## UC053 그룹 공유 요청 복구 후속

[설계](UC-053-group-delivery-recovery.md)·[증빙](../testing/group-delivery-recovery.md)은 그룹 공유/회수·복제 허용 설정의 frozen 요청 탭 복구를 연결한다. 최신 그룹을 읽어도 원래 버전/CAS를 자동 바꾸지 않으며409·미확정 요청을 보존한다. 현재 epoch/관리 권한 뒤 역사 replay와 명시 보관 해제·최신 회수 저장을 구분한다. MySQL6/22범위밖SKIP·SQLite24/4SKIP·BE4·FE51/부모16·Ego111은 선택/중복 범위다. 독립 사본 생성 요청 복구·일반 member 공유 정책·운영/실기기/전체16개 수용은 Open이다.

## UC053 받은 분석 독립 복제 요청 복구 후속

[설계](UC-053-received-copy-recovery.md)·[증빙](../testing/received-copy-recovery.md)은 frozen 저장 요청 복구→읽기 전용 본인 사본 확인, 미관측→원 기준 전체 재미리보기/동일 요청 저장을 연결한다. 원본 공유 회수 후 본인 사본 보존과 정확 digest/현재 소유·epoch를 구별한다. MySQL14·recovery30/조건23·FE78/공용11·Ego112는 선택/중복 범위다. 일반 게시/소유 저장본 전면 초안 복구·일반 member 공유 정책·전 역할/운영/실기기·전체16개 수용은 Open이다.

## 2026-10-19 UC054 출력 재시작 후속

[출력 재시작 증빙](../testing/export-restart.md)은 MySQL 실제 서비스 자식 프로세스 SIGKILL/새 PID 검증7 PASS와 별도 SQLite 전체 API/Ego113의 queued/ready 재시작·동일 CSV·조회 실패 복구·390/768/1440을 확인했다. 성공 응답 전 commit, 최종 TTL/권한 회수 경합을 보완했다. 임대/TTL 시험 가속과 실제 전체 HTTP MySQL 미실행을 구분한다. 종전 새 서비스 인스턴스만의 재시작 한계는 이 범위에서 보완됐으며 전체 비교 정답/역할 행렬·운영/실휴대폰/사람·전체16개/TC050 수용은 계속 Open이다.

## TC050 실제 전체 앱 MySQL 통합 후속

[계획](TC-050-integrated-mysql.md)·[증빙](../testing/enterprise-integrated-mysql.md)에서 새 소유 MySQL 전체 HTTP/native DuckDB와 실제 Codex 질문→원본600 저장→직접 공유→본인 소스1200 독립 복제→비교300/200·CSV→보관/복원→API 재시작/reload를 선택 검증했다. 이전 완료 기준 정리와 대표 정상 연결 단위는 보완됐으며 다음은 전 역할/보호 경로·AI/정답 변형이다. 운영 migration/고객·실기기/사람·전체16개/TC050 수용은 Open이다.

## TC050 역할별 HTTP 행렬 후속 — 2026-10-19

[설계](../plans/TC-050-access-matrix.md)·[증빙](../testing/enterprise-access-matrix.md)의 새 전체 앱/MySQL299 HTTP 요청은 현재 역할 축과 직접/그룹 회수·source/dashboard 독립·전달·파일·epoch·실제 독립 사본을 확인했다. 거절111건의13표 hash/count 보존과 제품 변경0을 구분한다. Enterprise dashboard export는 투영만이며 실제 파일 소비자 연결은 공백이다. legacy/별도 governance·진행 중 경합·모든 writer·운영/사람·전체16개 수용은 Open이다. 다음은 AI/조건·0행/0분모/기간 경계의 미검증 정답 변형과 확인된 소비자 공백의 좁은 설계다.
