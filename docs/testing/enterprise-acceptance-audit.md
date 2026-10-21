# 기업용 추가 요건 수용 항목 점검

2026-10-19 · 현재 코드/증빙 기준 develop-v2/26a5be57 (`fix: preserve export jobs across process restarts`). FR014~025/NFR005~008의16개 요건과 [TC050](../test_cases/TC-050-enterprise-analysis.md) E01~E14를 대조했다. 새 제품 정책을 승인하거나 전체 수용을 선언하는 감사가 아니다. [고정 업무 기준 MySQL](semantic-business-mysql.md)에 최신 인계/탈퇴·공유/복제 복구·출력 재시작 증빙을 반영했으며, 이번 문서 동기화에서 제품 검증을 재실행한 것은 아니다.

## 요건별 잔여

모든 행의 **전체 업무 수용은 Open**이다. 아래 현재 표와 다음 작업이 뒤의 역사 기록에 남은 과거 잔여 문구보다 우선한다. 구현·선택 검증·통합/업무 수용을 구별하고, 이미 실행한 증거를 미구현으로 계산하거나 겹치는 배치 수를 전체 완료율로 환산하지 않는다.

**구현·계약 + 수용**은 미구현 기능 또는 미확정 정책이 있는 행, **경로 확인 + 수용**은 전체 연결 여부를 더 대조해야 하는 행, **수용 중심**은 지원 계약 안에서 확인된 주요 구현 결손 없이 통합/업무 검증이 남은 행이다. 경로 미확인을 확정 결함으로, 수용 공백을 미구현으로 계산하지 않는다.

| 요건/TC050                | 잔여 구분        | 확인한 구현·최신 증거                                                                                                                                                                                                                              | 구현·계약 공백                                                                                                       | 검증·수용 공백                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR014 E01/E02/E12         | 구현·계약 + 수용 | 설명·버전·미리보기·제한된 직접 사용처·이용 권한·활성 차단 ([사용처](source-catalog-usage.md), [활성](source-availability.md))                                                                                                                      | 지원 영향 종류·미포함 범위와 변경 안내 계약 확정. 직접 참조 목록을 전체 영향 그래프로 간주하지 않음                  | schema/활성/권한 변경 안내·거절 시 저장0의 연결 여정, 운영·업무 승인 기준                                                                                                                                                                                                                                                                              |
| FR015 E01/E04/E08/E13/E14 | 구현·계약 + 수용 | 업무 유형/날짜/단위·공통 분류·고정 의미·직접/AI 생성·저장/게시/복제·실 Codex/headless·MySQL 선택 검증 ([업무 기준](semantic-business-basis.md), [MySQL](semantic-business-mysql.md))                                                               | 복합 부정 표현의 안전한 분기·지원 범위. 모든 자연어 지원을 보장하지 않음                                             | 전체 생성 조합과 현재 TC050 고정 데이터 대조·실휴대폰·운영·업무 의미 수용                                                                                                                                                                                                                                                                              |
| FR016 E02/E03             | 구현·계약 + 수용 | 직원 검색·양쪽 admin 검토/이동 ([화면](staff-transfer-ui.md)); 별도 최종 동의의 [대시보드](handover-transfer.md)·[소스](source-handover.md)·[묶음 인계](bundle-handover.md), [조직 탈퇴](staff-departure.md)의 회수·재로그인·본인 영수증·자료 보존 | 외부 연결/활성 공유 자산 인계는 현재 차단 범위이며 확장 계약 미확정. 법적 퇴사·계정 삭제를 조직 탈퇴와 혼용하지 않음 | 이동/지원 인계/탈퇴의 선택 MySQL·Ego101/106~109는 확인됨. 전체 직원 관리 연결 여정·전 역할·운영·실기기·사람 수용                                                                                                                                                                                                                                       |
| FR017 E02/E03/E09         | 경로 확인 + 수용 | 직접/그룹 grant·별도 source read·게시/복제·완료 파일 현재 권한 검사와 이동/탈퇴 후 회수 ([권한](enterprise-resource-access.md), [탈퇴](staff-departure.md), [출력 재시작](export-restart.md))                                                      | 전 보호 경로의 정책 연결 여부 목록화·누락 확인. 이미 보호된 파일 소비자를 미구현으로 재분류하지 않음                 | [역할 HTTP 선택 검증](enterprise-access-matrix.md)299건/거절111건을 확인. 미실행 보호 경로·legacy/별도 governance·진행 중 경합·운영 수용                                                                                                                                                                                                               |
| FR018 E04                 | 구현·계약 + 수용 | 중첩 조건·명시 적용·undo/redo·저장/reload/게시/복제·실 Codex 단일 조건 ([조건](business-condition-semantics.md))                                                                                                                                   | 복합 부정 표현 지원 범위. 조건 자동 전파를 명시 적용 계약에 추가하지 않음                                            | 중첩 AND/OR·오류·파일 교체의 연속 화면과 현재 TC050 동일 조건 대조·사용자 수용                                                                                                                                                                                                                                                                         |
| FR019 E05                 | 수용 중심        | 전체 건수·빈도/상위20+나머지·선택 열 정렬 표본·독립 정답 ([분포](condition-profile.md))                                                                                                                                                            | 확인된 주요 구현 결손 없음. 정렬 표본을 무작위 대표표본으로 부르지 않음                                              | [Ego51 대표 UI/키보드](condition-profile.md#실제-브라우저-후속--2026-10-20--ego51) 확인. [Ego52 상위20/NULL/0행](condition-profile.md#경계-화면-결과--2026-10-20--ego52) 보완.[Ego53 정밀값/Source 경합](condition-profile.md#정밀값조회-중-변경-화면-후속--2026-10-20--ego53) 보완. Studio 동일 경합 화면·목표 규모/이번MySQL/실기기/업무 수용        |
| FR020 E04                 | 구현·계약 + 수용 | 설명/조회0연산·조건 차이/전체 미리보기·명시 적용·검토 전 저장0·실 Codex 조건 ([AI 조건](ai-condition-proposals.md), [의미](business-condition-semantics.md))                                                                                       | 복합 부정 의도 처리의 지원·거절 경계                                                                                 | [Ego54 설명/조회/변경](ai-condition-proposals.md#설명조회변경-실제-대화--2026-10-21--ego54) 선택 화면/명시 적용·Undo 보완. [Ego55 오류/stale 선택 화면](ai-condition-proposals.md#오류늦은-응답-후속--2026-10-21--ego55) 보완(명확화 질문 보존/두 안전 거절/두 로컬 편집 경합). 다른 stale 축·복합 부정/상세 오류 안내·이번MySQL/운영/실기기·사람 수용 |
| FR021 E06/E07             | 구현·계약 + 수용 | 직접/그룹 공유·받은함·별도 복제 동의·본인 소스 사본; [직원 복구](delivery-recovery.md)·[그룹 복구](group-delivery-recovery.md)·[받은 사본 복구](received-copy-recovery.md)의 reload/정확 replay·회수 후 사본 유지·Ego110~112                       | 일반 소유 member 공유 정책 미확정. 일반 게시/소유 저장본의 전면 초안 복구는 이번 지원 밖이며 임의 필수화하지 않음    | 현재 TC050의 공유→복제→회수→사본 보존을 전체 HTTP MySQL에서 연결·전 역할/경합·전달 업무 수용                                                                                                                                                                                                                                                           |
| FR022 E07/E12             | 구현·계약 + 수용 | 권한/공유/그룹 audience·출력 완료/실패/취소 알림·본인 읽음/목록 제거 ([그룹 알림](group-notifications.md), [출력 알림](export-notifications.md))                                                                                                   | 계정/조직 활성 변경 auto-notice는 미구현. FR022 사건 범위와 TC050 E07 계약 일치 여부 결정                            | 알림 장애에도 확정 공유/파일 보존·본인/현재 조직 격리의 통합 UI/MySQL·감사 수용                                                                                                                                                                                                                                                                        |
| FR023 E08/E09/E10/E14     | 수용 중심        | 고정 기준 UUID접수·CAS/lease·원자 파일·만료/현재 권한; [재시작](export-restart.md)의 실제 MySQL 서비스 자식 SIGKILL/새 PID 7 PASS와 SQLite 전체 API/Ego113 queued/ready 재시작·동일 CSV·중단 명시 재실행                                           | 이번 지원 계약의 확인된 추가 구현 결손 없음. 인스턴스 재생성만의 한계는 실제 프로세스 검증으로 보완됨                | 전체 Nest HTTP MySQL·현재 TC050 비교/파일 정답·전 역할·모든 중단 위치/자연 시간 경과·파일 업무/운영 수용                                                                                                                                                                                                                                               |
| FR024 E03/E11/E12         | 경로 확인 + 수용 | 개인 보관·대시보드/지표/소스 삭제 보호·정리·조직 대시보드 비활성/복원 ([보관](personal-library-archive.md), [지표](metric-deletion.md), [소스](source-deletion.md), [상태](dashboard-asset-lifecycle.md))                                          | 모든 writer의 보호 연결 범위 확인. 조직 자체 비활성과 조직 대시보드 상태를 혼용하지 않음                             | 동일 자료의 보관/공유/삭제/정리 연결 여정·전체 HTTP MySQL·운영/사람 수용. 기존 MySQL은 해당 slice만 인정                                                                                                                                                                                                                                               |
| FR025 E08/E14             | 구현·계약 + 수용 | 현재/직전 기간·시간대·분류/추이/Pivot·즉시/영속 CSV 정답·headless 고유2 ([동일 기준](explore-reviewed-basis.md))                                                                                                                                   | 임의 비교 기간 요구 여부 확정. 별도 보고서 엔진을 임의 필수로 추정하지 않음                                          | 현재 TC050 대표 보고서 조회/파일 동일성·0행/0분모·기간 경계의 전체 HTTP MySQL 대조·업무 수용                                                                                                                                                                                                                                                           |
| NFR005 E02/E03/E09        | 경로 확인 + 수용 | 현재 active/epoch/조직·소유/grant·파일 권한·선택 교차 큐/MySQL 잠금; [이동](staff-transfer.md)·[탈퇴](staff-departure.md)·[복제 복구](received-copy-recovery.md)·[출력 완료](export-restart.md)의 재검사                                           | 일반 Repository/조회와 모든 writer의 잔여 경로 목록화·누락 확인                                                      | [HTTP 행렬](enterprise-access-matrix.md)의 다음 요청 회수는 확인. 미실행 경로/모든 writer·진행 중 경합·운영 수용                                                                                                                                                                                                                                       |
| NFR006 E05/E08/E14        | 수용 중심        | 조건/기간 비교/Pivot/CSV·semantic 독립 oracle 및 버전 변경 거절 ([조건 정답](condition-profile.md), [동일 기준](explore-reviewed-basis.md), [업무 기준](semantic-business-basis.md))                                                               | 확인된 주요 구현 결손 없음. 독립 정답 자체를 미구현으로 계산하지 않음                                                | 현재 TC050의 하나의 고정 기준으로 전체 여정 대조·정밀값/NULL/0분모/오차 기준·업무 정답 승인                                                                                                                                                                                                                                                            |
| NFR007 E12/E14            | 경로 확인 + 수용 | 정의·권한/공유·보관/삭제·출력 actor/resource/version 감사와 인계/탈퇴·복구 replay의 추가 감사0 ([탈퇴](staff-departure.md), [직원 복구](delivery-recovery.md), [그룹 복구](group-delivery-recovery.md), [재시작](export-restart.md))               | 전체 사건 필수 필드·현재 열람 경로의 누락 여부 확인                                                                  | time/result·원본 행/비밀 비노출, 운영 보존 기간·감사 열람 정책/담당자 합의                                                                                                                                                                                                                                                                             |
| NFR008 E07/E09/E10        | 경로 확인 + 수용 | 저장/공유/출력/삭제 영수증·rollback·stale worker; [직원](delivery-recovery.md)/[그룹](group-delivery-recovery.md)/[받은 사본](received-copy-recovery.md) reload 복구 및 [실제 출력 프로세스 재시작](export-restart.md)                             | 일부 일반 쓰기 조정·모든 writer 적용 범위 확인. 검증된 세 복구와 출력 재시작을 미구현 잔여로 다시 올리지 않음        | 응답 유실/중복/알림 장애/재시작을 현재 TC050 전체 HTTP MySQL 여정으로 연결·운영 복구 수용                                                                                                                                                                                                                                                              |

## 대조 범위와 판정

직원 검색·삼자 검토 조직 이동은 [Ego101/후속 MySQL](staff-transfer-ui.md), 대시보드·소스·묶음의 별도 최종 동의/관리권 이전은 [Ego106](handover-transfer.md)·[Ego107 정상 업로드 후속](source-handover.md)·[Ego108](bundle-handover.md), 인계 후 조직 탈퇴·기존 token 회수·재로그인/본인 과거 영수증은 [Ego109/보존 대조](staff-departure.md)로 확인됐다. 제목 공개 의향과 실제 이전, 조직 Membership 탈퇴와 법적 퇴사/계정 삭제를 구분한다. 외부 연결·활성 공유 등 현재 차단 범위를 일반 자산 이전 완료로 확대하지 않는다.

직접/그룹 전달의 frozen UUID·CAS 탭 복구와 정확 replay는 [Ego110](delivery-recovery.md)·[Ego111](group-delivery-recovery.md), 원본 회수 후 본인 사본 확인과 미관측 시 원 기준 재미리보기/저장은 [Ego112](received-copy-recovery.md)로 확인됐다. 세 문서의 선택 MySQL·FE 검증은 해당 계약만 증명하며 일반 member 공유 정책이나 전체 초안 복구를 승인하지 않는다.

[출력 재시작](export-restart.md)은 MySQL 서비스 자식 프로세스 SIGKILL/새 PID 7 PASS와 별도 SQLite 전체 HTTP/Ego113의 queued/ready 재시작·동일 CSV·조회 실패 뒤 명시 복구·대표390/768/1440을 구분한다. Ego의 interrupted는 별도 소유 DB fixture이고, MySQL의 임대/TTL은 가속한 시험이다. 실제 프로세스 재시작을 미구현으로 두지 않는다. 이후 [전체 앱 후속](enterprise-integrated-mysql.md)은 MySQL 전체 HTTP의 완료 작업/분석 재시작 보존도 확인했다. 자연 시간 경과·모든 중단 지점 검증은 별도다.

[실제 MySQL 전체 앱 통합](enterprise-integrated-mysql.md)에서 같은 합성 데이터의 질문/저장→공유→독립 복제→비교/출력→개인 보관과 API 재시작의 대표 연결 여정을 선택 검증했다. E01~E14의 모든 변형·전체 수용은 여전히 NOT_RUN이다. 이번 연결 실행과 이전 분리 시험을 합산하지 않는다. E13은 추가16개 밖 NFR003에도 연결되며, 대표 viewport 실측을 물리 휴대폰/키보드 전체·운영·사람 수용으로 승계하지 않는다. “승인된 데이터”를 근거 없이 다단계 승인 workflow의 추가 필수 요건으로 확대하지 않는다.

## 다음 작업

1. [전체 HTTP MySQL 통합 증빙](enterprise-integrated-mysql.md)의 대표 정상 연결 여정은 PASS_SELECTED다. 역할/회수 HTTP 선택 행렬은 이번 후속에서 확인했다. 다음은 미실행 경로·조합과 AI·조건/0행/0분모/기간 경계의 미검증 변형을 대조한다. 이미 통과한 정상 여정을 다시 다음 미실행으로 올리지 않는다.
2. 일반 소유 member 공유 정책·계정/조직 변경 자동 알림·복합 부정 지원·임의 비교 기간과 지원 밖 인계 확장 계약을 별도 결정한다. 완료된 이동/지원 인계/탈퇴·세 복구·출력 재시작을 반복 구현할 다음 작업으로 올리지 않는다.
3. 전 역할/보호 HTTP 경로·일반 writer·권한 회수/알림 장애·감사/원본 보존을 대조하고 확인된 결함만 수정한다. 운영 migration/Node24·목표 규모·실휴대폰·고객 업무 정답·사람 수용은 별도 gate다.

소유 MySQL fixture 정리와 재현 명령은 각 최신 증빙을 따른다. 전체16개 요건은 구현·선택 검증·전체 수용을 계속 분리해 관리한다.

## 누적 후속 기록 — 각 실행 당시 기준

## 퇴사·인계 영향 확인 후속

[설계](../plans/UC-051-departure-impact.md)·[선택 증빙](staff-departure-impact.md)은 현재 조직 admin의 읽기 전용11종 건수 확인 첫 단위다. 전체 개인 소유와 조직 내 저장 관계를 구분하고 내용/경로/링크 공개·자동 이관/삭제0을 유지한다. 실제 업무 인계·퇴사/탈퇴 확정·전체 FR016 수용과 혼동하지 않는다.

[인계 의향 설계](../plans/UC-051-handover-proposal.md)·[증빙](handover-proposal.md)은 FR016의 소유자 선택/동의·지정 수신자 수락을 구현하는 후속이다. 수락은 제목·번호의 고정 검토 기록이며 실제 이전·조회 grant/퇴사 완료로 승격하지 않는다. 전역 의존성·파일 보관과 실제 인계 확정·전체 수용은 잔여다.

## UC051 최종 대시보드 인계 후속

[설계](../plans/UC-051-handover-transfer.md)와 [실행 기록](../testing/handover-transfer.md)은 제목 공개 의향과 별도의 양쪽 최종 동의·원자 소유 mapping 변경/영수증을 연결했다. MySQL215·Ego106/대표 폭은 선택 범위이며 전체 수용과 구별한다. 지원 범위는 수신자가 소스를 이미 소유한 비공개 단독 대시보드이며 source/파일·퇴사/탈퇴·운영/사람/전체16개 수용은 별도다. 하위 구현 수를 전체 완료율로 계산하지 않는다.

## UC051 소스·파일 관리권 인계 후속

[설계](../plans/UC-051-source-handover.md)·[증빙](source-handover.md)은 사용 중 관계가 없는 ready 등록 DuckDB 소스의 별도 양쪽 최종 동의·원자 관리권 이전/영수증이다. 파일 경로/bytes·지표 정의/이력은 보존하며 기존 소유자의 다음 보호 요청은 거절한다. 외부 연결·혼합 자산/실사용 관계·물리 파일 이동·퇴사/탈퇴 확정·운영/실기기·전체16개 수용은 별도다. 하위 구현 수를 전체 완료율로 계산하지 않는다.

## UC051 소스·연결 대시보드 묶음 인계 후속

[설계](../plans/UC-051-bundle-handover.md)·[증빙](bundle-handover.md)은 고정 선택 소스와 그 소스만 쓰는 비공개 단독 대시보드의 양쪽 최종 동의→원자 관리권 이전/영수증을 연결한다. 미선택 연결/활성 공유/열린 작업은 전체 차단하며 검증된 canonical·동등 미연결 자식과 파일/문서/ID/과거 정의는 보존한다. MySQL313·SQLite45/8SKIP·FE176은 범위별 중복 배치이며 합산하지 않는다. Ego108의 실패/reload/동일 UUID·수락/실행/reload·권한 회수/파일·문서 보존·대표 폭은 선택 범위다. 외부/실사용 공유·퇴사/운영/실기기/전체16개 수용은 별도다.

## UC051 인계 후 조직 탈퇴 후속

[설계](../plans/UC-051-staff-departure.md)·[증빙](staff-departure.md)은 본인 명시 요청과 다른 현재 admin의 잔여 검토/최종 동의를 분리한다. 소유 자료와 미해결 작업이 남으면 차단하며, 인계 이후 잔여 0건에서 Membership·직접/그룹/전달 관계와 로그인 epoch를 회수한다. 계정 활성·인계된 원본/파일/문서/과거 기록을 보존한다. MySQL78/1SKIP·SQLite145/11SKIP·FE120/후속26 및 Ego109 대표 여정은 선택/중복 범위이며 합산하지 않는다. 법적 퇴사·계정 삭제·외부/활성 공유 자산 인계·전체 역할/운영/실휴대폰/사람·전체16개 수용은 Open이다.

## UC053 직접 직원 공유 요청 복구 후속

[설계](../plans/UC-053-delivery-recovery.md)·[증빙](delivery-recovery.md)은 직접 공유/회수·복제 허용 설정의 frozen UUID/입력 탭 보존과 reload→현재 조회→별도 동의 동일 요청을 연결한다. 역사 결과와 현재 관계를 구별하고 User 잠금 뒤 epoch를 검사한다. MySQL7·SQLite23/2SKIP·BE4·FE57/부모16·Ego110은 선택/중복 범위다. 그룹 공유·독립 사본 생성 요청 복구와 일반 member 공유 정책·전체16개 수용은 Open이다.

## UC053 그룹 공유 요청 복구 후속

[설계](../plans/UC-053-group-delivery-recovery.md)·[증빙](group-delivery-recovery.md)은 그룹 공유/회수·복제 허용 설정의 frozen 요청 탭 복구를 연결한다. 최신 그룹을 읽어도 원래 버전/CAS를 자동 바꾸지 않으며409·미확정 요청을 보존한다. 현재 epoch/관리 권한 뒤 역사 replay와 명시 보관 해제·최신 회수 저장을 구분한다. MySQL6/22범위밖SKIP·SQLite24/4SKIP·BE4·FE51/부모16·Ego111은 선택/중복 범위다. 독립 사본 생성 요청 복구·일반 member 공유 정책·운영/실기기/전체16개 수용은 Open이다.

## UC053 받은 분석 독립 복제 요청 복구 후속

[설계](../plans/UC-053-received-copy-recovery.md)·[증빙](received-copy-recovery.md)은 frozen 저장 요청 복구→읽기 전용 본인 사본 확인, 미관측→원 기준 전체 재미리보기/동일 요청 저장을 연결한다. 원본 공유 회수 후 본인 사본 보존과 정확 digest/현재 소유·epoch를 구별한다. MySQL14·recovery30/조건23·FE78/공용11·Ego112는 선택/중복 범위다. 일반 게시/소유 저장본 전면 초안 복구·일반 member 공유 정책·전 역할/운영/실기기·전체16개 수용은 Open이다.

## 2026-10-19 UC054 출력 재시작 후속

[출력 재시작 증빙](../testing/export-restart.md)은 MySQL 실제 서비스 자식 프로세스 SIGKILL/새 PID 검증7 PASS와 별도 SQLite 전체 API/Ego113의 queued/ready 재시작·동일 CSV·조회 실패 복구·390/768/1440을 확인했다. 성공 응답 전 commit, 최종 TTL/권한 회수 경합을 보완했다. 임대/TTL 시험 가속과 실제 전체 HTTP MySQL 미실행을 구분한다. 종전 새 서비스 인스턴스만의 재시작 한계는 이 범위에서 보완됐으며 전체 비교 정답/역할 행렬·운영/실휴대폰/사람·전체16개/TC050 수용은 계속 Open이다.

## TC050 실제 전체 앱 MySQL 통합 후속

[계획](../plans/TC-050-integrated-mysql.md)·[증빙](enterprise-integrated-mysql.md)의 실제 Codex 질문/저장·사내 직접 공유·본인 소스 복제·독립 정답/CSV·보관/복원·API 새 PID/reload와 Ego114/대표 폭을 확인했다. 매핑 select의 공통 UI Kit 덮어쓰기를 수정했다. 대표 정상 여정 선택 검증이며 전 역할/변형·운영/실기기/업무·전체16개 수용은 Open이다.

## TC050 역할별 HTTP 행렬 후속 — 2026-10-19

[설계](../plans/TC-050-access-matrix.md)·[증빙](enterprise-access-matrix.md)의 새 전체 앱/MySQL299 HTTP 요청은 현재 역할 축과 직접/그룹 회수·source/dashboard 독립·전달·파일·epoch·실제 독립 사본을 확인했다. 거절111건의13표 hash/count 보존과 제품 변경0을 구분한다. Enterprise dashboard export는 투영만이며 실제 파일 소비자 연결은 공백이다. legacy/별도 governance·진행 중 경합·모든 writer·운영/사람·전체16개 수용은 Open이다. 다음은 AI/조건·0행/0분모/기간 경계의 미검증 정답 변형과 확인된 소비자 공백의 좁은 설계다.
