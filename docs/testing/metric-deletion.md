# UC055 지표 사용처 확인·보호된 논리 삭제

[계획](../plans/UC-055-metric-delete.md)은 FR024/NFR005/007/008의 지표 삭제 단위다. source 영구 삭제/외부 파일 정리·조직 비활성/전체16개 수용은 별도다.

## 구현 경계

현재 실제 source 소유자의 metadata 관리 API는4종 종류/건수만 반환한다. Dashboard 구조화 정의/붙은 Pivot은 같은 Dashboard에서 중복 집계하지 않고, 실제 StudioState의 `{document,sourceRevision}` envelope와 ExploreView/소스 PersonalView의 현재 참조와 대기·실행 중 출력 작업을 확인한다. 삭제된 Dashboard의 과거 StudioState와 독립 Metric 사본·고정 게시/출력 snapshot은 원 지표의 현재 참조로 묶지 않는다.

지표 useYn=N과 지속 영수증/조직 감사는 같은 transaction이다. 현재 활성 User/JWT epoch/조직·source owner·지표 revision과 사용처를 삭제 직전에 재확인한다. body 없는 구 API는 우회할 수 없으며 같은 UUID/본문은 과거 확정 결과만 확인한다. 재활성 후 이전 영수증 확인도 새 삭제를 수행하지 않는다. 계정/조직 전환과 다른 본문은 별도 경계다. 소스 비활성에도 원래 소유자의 metadata 정리를 허용하며 데이터 SQL/집계는 실행하지 않는다.

## 최초 코드 검토와 수정

독립 검토는 실제 Studio envelope 해석, 끊어진 Widget 연결에서 다른 소스를 확정하는 문제, items의 null/false/배열을 빈 참조로 간주하는3건을 지적했다. 후속 검토에서 소스 미확정 items 분기를 추가로 확인해 함께 수정했다. 실제 envelope의 문서를 읽고, 모든 명시 소스 힌트가 일관되고 끊어진 연결이 없을 때만 다른 소스로 분류한다. 정상 빈 placeholder `{}`와 손상 항목을 구분한다. 회귀 fixture를 실제 저장 형태로 바꾸고 해당 손상 변형을 추가했다.

실제 임시 파일 SQLite/JWT HTTP45개 PASS는4종 참조/Pivot/개인 보기·중복·205개 이후 참조·다른 소스/독립 사본·손상 metadata·소유/actor/org/epoch·수정 기준·원자 rollback·연결 재개 후 영수증·동시 동일 요청·migration unique·HTTP no-store/body 없는 삭제 차단을 포함한다. SQLite 연결 close/reopen은 프로세스 재시작 증거가 아니다.

참조 writer 통합/최종 선택 회귀·실제 격리 화면/모바일 viewport·실제 MySQL·독립 재검토의 결과는 실행 증거를 확인한 뒤 기록한다. 실제 Ego96은 사용자 제어 상태이며 headless를 실제 Ego/휴대폰/운영·사람 수용으로 승계하지 않는다.

## 실제 MySQL 8.4.11

소유 label/UUID·127.0.0.1 임시 포트·전용 DB의 격리 Docker MySQL8.4.11에서 최종20개 PASS다(초기15개에서 출력 상태5개 확장). migration/unique/재접속 영수증, 실제 trigger 오류3곳의 rollback, 현재 소유/수정 기준/actor/org/epoch/active6개와 실제 Studio envelope/PersonalView/Pivot 참조3개를 확인했다.

두 DataSource가 같은 DB의 별도 연결을 사용한다. `performance_schema.data_lock_waits`로 Source 행 잠금 대기를 실제 확인했다. 공통 helper+실제 ExploreView INSERT가 먼저 확정되면 삭제409·지표Y/참조1을 유지하고, 삭제가 먼저 확정되면 대기 writer403·새 참조0·지표N/영수증1/감사1이다. 이는 모든 제품 writer의 MySQL 런타임 검증이나 운영 통과를 뜻하지 않는다.

`.aiwf/evidence/UC055-metric-delete/mysql/verification.json`과 `2efb7fdf849da7d27bb74201.log`에 명령/버전/결과/cleanup을 기록했다. 첫 실행은 테스트 컴파일 오류로0개 실행·exit1이며 수정 후 초기15개와 확장20개를 각각 실제 실행했다. env gate가 없으면 최종20개 skip/DB 연결0이고, 전용 marker/server UUID/임시 credential 파일을 검사한 뒤에만 전용 schema를 준비한다. 완료 후 자기 label의 컨테이너·볼륨만 제거했고 임시 credential도 삭제했다. 기존 사용자 컨테이너/데이터는 건드리지 않았다.

출력 작업의 `queued/running` 상태는 지표의 현재 정의를 필요로 하므로 `exportJobs` 종류로 차단한다. 만료됐더라도 켜진 작업은 명시 취소 후 다시 확인한다. `ready/failed/cancelled`의 파일/과거 요청은 차단하지 않으며 실패 작업의 재실행은 현재 지표/버전을 Source→Metric 잠금 아래 재검사하고 새 실행 상태 쓰기 전 거절한다. 완료 파일을 현재 지표 참조로 자동 묶거나 삭제/취소하지 않는다.

## 실제 화면·FE 범위

FE의4종 사용처 API/dialog/페이지48개는 차단·영향 실패/409·동일 UUID 미확정 재확인·접기/재열기·정상 갱신 보존·새 계정의 private 제목/평가/폼 숨김·정리를 검사한다. 삭제 성공은 현재 목록/해당 평가 결과를 갱신하며, 질문/다른 편집기 초안을 건드리지 않는다. 로그인/브라우저 reload 간 삭제 의도 복구는 지원하지 않는다.

첫 격리 headless core10개는 실제 저장 탐색 보기→지표 삭제 차단→보기만 별도 명시 삭제→사용처 다시 읽기→지표 논리 삭제→동일 영수증 재확인→reload/소스 보존과 기존 Dashboard 삭제·생성/탐색/Pivot·공유/로그인 회귀를 확인했다. 390/768/1440px의 dialog 경계·문서 가로 넘침0, 도구32±1px를 검사하고 캡처했다.390px의 긴 이름 줄바꿈·건수 우측 정렬·버튼 높이/간격도 직접 확인했다. 출력 종류 추가 후 최종 core10개도 PASS이며390/768/1440의4종 dialog/버튼32±1px·넘침0과390px 캡처를 다시 확인했다. 마지막 inherited snapshot guard는 별도 AI69개 회귀/추가 독립 검토 findings0와 그 후의 production 빌드로 확인했다. 실제 Ego96/실휴대폰/운영 수용은 아니다.

독립 최종 소비자 검토에서 legacy PUT의 미정의 `useYn` 필드가 새 삭제 경계를 우회할 수 있음을 확인했다. create/update의 런타임 허용 필드를 고정하고 직접 사용 상태·ID/시각/알 수 없는 필드는 거절하는 보완을 같은 단위에서 수행한다. 실제 JWT의 PUT/POST에서 useYn/id/생성·수정 시각/unknown 필드를 거절하고 Metric 상태·영수증·감사 불변을 확인했다. 단순 TypeScript DTO만으로 런타임 입력 제한을 증명하지 않는다.

## 참조 writer 통합과 최종 코드 검토

기존 AI 단일/지표 batch·semantic/Studio 생성·저장/재사용·두 탐색 보기/Pivot과 legacy 지표 수정/재활성에 같은 Source→Metric 경계를 연결했다. 기존 Dashboard는 먼저 오름차순 선잠금하고 모든 Source/Metric도 각각 오름차순으로 현재 Y/소스/버전을 확인한다. 새 독립 복제 지표는 사본 전용이며 원 지표의 참조로 묶지 않는다. 실제 생성/Studio/재사용의 집계 준비는 transaction/부모 잠금 전에 끝내고 저장 직전 현재 소스/권한/revision/참조를 다시 확인한다. 취소와 파일/정의 교체 fault injection도 새 준비/저장 경계에서 그대로 검증했다.

Export 접수와 실패 작업 재실행은 현재 지표/버전/basis를 claim 전 재검사한다. 이 단계의 거절은 job/version/lease/audit/parts/집계 SQL을 바꾸지 않고, claim 이후의 실제 실행 실패는 기존 failed 상태 처리를 유지한다. 완료 파일·다른 작업을 자동 취소/수정하지 않는다.

최종 writer 선택16 suites/364 PASS는 AI/조건/snapshot·생성/Studio/재사용·탐색 보기/Pivot·기존 metadata 큐·legacy 지표·참조 경합/export를 포함한다(`backend-writer-final.log`). 실제 SQLite의 personal/Pivot/Dashboard writer-first와 delete-first는 쓰기0/현재 참조 차단을 검사한다. 생성/저장/복제의 실제 집계 SQL이 부모 잠금 전에 끝나는 선택 검사3개는 별도로 확인했다(`backend-sql-order.log`, 다른 선택 suite와 중복 합산하지 않는다). 확장 JWT/Export 검사와 미정의 필드 우회 거절은 별도 로그에 기록하며 총수에 겹쳐 더하지 않는다.

전체 BE source/spec 타입과 production 타입·빌드, FE 타입/범위 lint/빌드·QA 타입을 검사했다. 범위 BE lint는 오류0·기존 AI spec 경고6개이고 strict spec lint는 기존 FR011/NFR002 상태 경고2개로 exit1/오류0이다. baseline으로 숨기거나 수용 상태를 올리지 않았다. 독립 최종 검토는 앞선 scanner/우회 HIGH 해소·추가 findings0(APPROVE)이며 사람/제품 수용과 구별한다. 실제 MySQL20은 공통 helper+ExploreView INSERT 경합 범위이고 모든 writer의 실제 MySQL 검증은 아니다.

16 suites/364개 후 기존 AI 저장의 상속 snapshot이 준비 후 바뀌면 revision 없는 저장도 첫 쓰기 전409로 거절하는1개 회귀를 추가했다. 해당 AI suite69개를 재검증했으며68개는 앞선 결과와 중복이다. 따라서 고유 writer 검사는365개이고364+69로 합산하지 않는다. 마지막 guard는 별도 독립 검토와 최종 production 빌드로 확인한다. 초기 worker HTTP spec은 중복 소유를 피하려 제거했고 Main의 실제 JWT core45개에 같은 우회 거절을 유지했다.

기존 지표 API QA의 같은 이름 재활성/삭제 후 평가 거절2개는 PASS다. 기존 UI QA 첫 실행은 실제 접근성 이름 `Evaluate 지표명` 대신 오래된 `Evaluate` 정확 일치 선택자를 기다려 실패했다. 생성/목록 HTTP는 정상 확인했고 기존 locale/버튼 이름에 맞춰 선택자만 수정했다. 실패 로그를 유지하고 수정 후 UI 생성→정확값500 평가→reload→삭제 영향/명시 삭제의 선택 재검증을 별도 기록한다.2개 API PASS를 반복 실행하거나 초기 UI 실패를 제품 동작 PASS로 바꾸지 않는다.

## 종료 기록

| 검사                              | 결과              | 로컬 증빙(.aiwf/evidence/UC055-metric-delete 아래)         |
| --------------------------------- | ----------------- | ---------------------------------------------------------- |
| 실제 SQLite/JWT 삭제/편집 우회    | 45 PASS           | backend-core-final.log                                     |
| 기존 writer 고유 회귀             | 365 PASS(364+새1) | backend-writer-final.log·backend-ai-inherited-final.log    |
| 실제 MySQL8.4.11                  | 20 PASS           | mysql/2efb7fdf849da7d27bb74201.log                         |
| FE 영향/복구/계정/페이지          | 48 PASS           | frontend-final-tests.log                                   |
| 최종4종 dialog 포함 headless core | 10 PASS           | core-final/playwright-001.log                              |
| 기존 지표 API/정정한 UI QA        | 2 API+1 UI PASS   | qa-final/playwright-001.log·qa-ui-final/playwright-001.log |

정정한 UI QA는 실제 생성→500 평가→reload→삭제를 통과했다. 최종 상속 snapshot guard의 추가 독립 검토 findings0와 그 후 BE 빌드 PASS를 확인했다. 기존 strict spec 경고는 유지하며 pin/check는 내용 동기화, packet은 awaiting_review/acceptance not_recorded로 구별한다. 실제 Ego96·실휴대폰·모든 MySQL writer/운영·사람 수용·source 영구 삭제/조직 비활성·전체TC050/16개는 계속 미완료다.
