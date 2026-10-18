# UC055 대시보드 사용처 확인·원자 삭제

[설계](../plans/UC-055-dashboard-delete.md)는 Dashboard의 실제 소유자가 사용처를 확인한 뒤 명시 삭제하는 흐름이다. [개인 보관](personal-library-archive.md)과 구별하며 FR024/NFR005/007/008의 일부다. source/metric 삭제·조직 비활성·전체16개 수용은 별도다.

## 구현과 경계

기존 DashboardController의 body 없는 삭제 route와 DashboardService의 순차 삭제를 제거했다. 새 JWT/no-store 영향/삭제 API는 현재 활성 계정/JWT epoch, 읽은 actor/org와 단일 소유권·삭제 기준을 확인한다. source raw data를 조회하지 않는 소유 metadata 관리이며 SQL/수신자/그룹 이름·token은 영향 응답에 없다.

직접/그룹 권한·직접/그룹 전달·live 공유·legacy/Studio 게시·중복 share 참조의 8종 설정을 종류/건수로 표시한다. 아직 켜진 설정은 만료/구성원 비활성에도 차단하며 자동 중지/연쇄 삭제는 하지 않는다. 개인 상태/과거 영수증·독립 산출물은 활성 사용처로 보지 않는다. 조회 오류를 빈 사용처로 숨기지 않는다.

영향을 읽은 뒤 새 설정이 생기거나 저장 정의/배치/Pivot 기준이 달라지면 삭제 직전에409다. 허용된 요청은 부모 잠금 아래 원본 Dashboard·그 DashboardWidget/유일 소유 UserMapping·중지된 유일 DashboardShare만 삭제하고 영수증/조직 감사를 같은 transaction에 저장한다. Widget/Dataset/Source/Metric·다른 Dashboard·관계/게시·개인 상태/과거 기록은 지운 것으로 간주하지 않는다. 조직 없는 기존 소유자는 영수증에 행위/기준을 기록하며 가짜 조직0을 만들지 않는다.

`dashboard_delete_receipt`의 actor/requestId unique와 원래 대상/조직/기준 digest로 동일 요청 재확인을 처리한다. 재확인은 과거 확정 결과이며 현재 접근 권한이나 새 삭제를 뜻하지 않는다. 다른 본문/계정/조직은 거절한다. 조직 감사의 `dashboard-deletion.completed`는 resourceId=영수증ID/version=1이고 영수증의 원본ID/expectedRevision과 연결된다.

## 선택 실행

초기 실제 임시 파일 SQLite·정책/JWT HTTP 28개 PASS다. 8종 설정 차단, 영향 이후 변경, owner/actor/org/epoch, 원자 실패 rollback, 독립 다른 Dashboard와 source/dataset/widget·개인 상태 보존, 동시 같은 요청, 정책 쓰기 우선/삭제 우선 경합, 새 schema/unique, body 없는 우회 거절과 HTTP 재확인을 포함한다. SQLite 연결을 실제 닫고 재개해 같은 삭제 영수증을 확인했다. 이는 서버 프로세스 kill/restart 증거가 아니다.

공통 부모 잠금은 기존-ID 저장과 권한/전달/공유/게시 최종 쓰기도 조정한다. MySQL/MariaDB의 FOR UPDATE 옵션 검사와 실제 MySQL 실행은 구별한다. 기존 저장의 `save()`가 삭제 ID를 재삽입하지 않도록 존재 확인 후 쓰며 다중 분석은 ID 오름차순으로 선잠금한다. LLM/집계 SQL을 새로 잠금 안으로 옮기지 않는다. 최초 독립 검토는 지표 batch의 집계 SQL 동안 부모 잠금 유지 1건을 지적했다. `prepareSave`로 모든 대상 집계/SQL 준비를 transaction 밖에서 끝내고, 내부는 전체 부모 오름차순 선잠금→모든 현재 권한/기준 확인→단일 Metric CAS/저장으로 분리했다. 실제 DuckDB/SQLite 호출순서와 준비 후 revision/소유권/삭제 변경의 첫 Metric/자식 쓰기 시도0을 검사했다. standalone 저장과 저장 조건 범위도 유지했다.

## 화면과 미실행

목록/상세에서 공통 삭제 영향 dialog로 종류/건수와 중지 안내를 확인한 뒤 명시 삭제한다. 응답 불명확은 UUID/body를 보존해 같은 요청 결과만 확인한다. 취소/초안·다른 분석 정의는 자동 삭제하지 않는다. 같은 로그인 세션의 접기/재열기·정상 token 갱신은 UUID/body를 유지하고 재열기 자동 영향 GET은 하지 않는다. 새 로그인/로그아웃은 이전 사적 제목·기준을 render 단계부터 숨긴 뒤 로컬 요청을 폐기한다. 로그인 간/브라우저 새로고침 후 삭제 의도 복구는 지원하지 않는다. 이미 확정됐을 수 있는 삭제 결과는 새 로그인 후 목록으로 확인한다. 이 정리는 서버 삭제 rollback을 뜻하지 않는다.

새 격리 Chromium 시나리오는 공유 중 차단→별도 공유 중지→사용처 다시 읽기→명시 삭제→영수증 재확인→새로고침과390/768/1440 넘침/도구32px를 확인한다. 실제 Ego96은 사용자 제어 상태이며 새 Ego/실휴대폰·MySQL/운영·사람 수용·전체 TC050은 NOT_RUN이다. headless 실행을 이 gate로 승계하지 않는다.

## 최종 자동 검증 범위

| 검사                                  | 결과                | 로컬 증빙                                                          |
| ------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| 삭제 전용 실제 파일 SQLite/JWT HTTP   | 28 PASS             | `.aiwf/evidence/UC055-dashboard-delete/backend-deletion-final.log` |
| 최종 AI/조건/snapshot/공통 잠금       | 4 suites / 119 PASS | `backend-batch-final.log`                                          |
| 기존 Dashboard/공유/API fixture 전환  | 4 suites / 54 PASS  | `backend-fixture-regressions-final.log`                            |
| FE 삭제/목록/상세/개인 보관 선택 회귀 | 5 files / 103 PASS  | `frontend-tests.log`                                               |
| 격리 Chromium core                    | 9 PASS              | `core-final/playwright-001.log`                                    |
| 삭제 계약 변경 소비자 QA              | 4 PASS              | `qa-targeted/playwright-001.log`                                   |

로그 상대 이름은 위 공통 증빙 디렉터리 아래다. 최초 공통 잠금35/기존238 회귀는 수정 전 선택 증거이며 최종173개에 합산하지 않는다. 최종 helper는 mock batch 순서 검사를 실제 집계 순서 검사로 교체해34개이고, AI4개를 추가했다. 현재 전체 BE source/spec 타입과 FE 타입·범위 lint/build·별도 QA 타입을 확인한다. BE 선택 lint는 오류0이며 기존 AI spec 경고6개가 남는다. strict spec lint는 기존 FR011/NFR002 상태 경고2개 때문에 exit1이며 오류0이고 baseline으로 숨기지 않았다.

새 삭제 headless 여정은 실제 HTTP의 공유 중 차단→별도 공유 중지→다시 읽기→명시 삭제→동일 영수증 재확인→reload·독립 다른 Dashboard 보존을 확인했다. 실제 복제 생성까지 포함한 새 clone/delete 통합 검사는 아니다. 390/768/1440px에서 dialog 경계·문서 가로 넘침0과 도구 버튼 높이32±1px를 assertion으로 검사하고 세 화면을 보존했다. 390px 캡처의 줄바꿈·개수 우측 정렬·버튼 정렬도 직접 확인했다. 기존 QA는 제목 수정/위젯 보존→삭제, 타 계정의 유효 본문 삭제403, 삭제 후 익명 공유 거절·삭제 deep link 오류 안내를 실행했다. 기존 생성/탐색/Pivot/공유·로그인 core도 통과했다.

수정된 최종 BE production 빌드와 core9 재실행은 PASS이며 독립 재검토는 최초 MEDIUM 해소·추가 findings0(APPROVE)다. 이는 코드 검토 결과이며 제품/사람 수용 승인이 아니다. spec pin/check/packet은 별도 snapshot/검토 패킷으로 기록한다. 실제 Ego96·실휴대폰/MySQL/운영·사람 수용·소스/지표 삭제/조직 비활성/전체16개는 계속 미완료다.
