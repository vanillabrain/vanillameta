# 이전 기간 비교 · 일/주/월 집계

기준: SSBI 탐색의 새 조건만 검사한다. 기존 파일 저장·개인 보기·Rill 139만 행·AI 생성 통과를 반복하거나 이번 통과로 집계하지 않는다. 모델은 Codex gpt-6-luna 설정을 유지하며 이 수동 탐색 기능에는 모델 호출이 없다.

## 계약

비교에는 적용한 UTC 시작일·종료일이 필요하다. 양끝을 포함한 N일을 현재 기간으로 하고 바로 앞의 N일을 이전 기간으로 한다. 동일 필터와 동일 파일 snapshot에서 원본 집계식을 각각 실행한다. 증감은 현재−이전, 증감률은 증감/abs(이전)×100이다. 이전=0이면 증감률은 계산 불가, NULL이면 값 없음으로 구분한다. 기간을 비우면 비교도 해제한다.

집계 선택은 자동/일/주/월이다. 주는 UTC 월요일, 월은 달력 첫날 시작이다. 날짜 필터를 먼저 적용하므로 경계에 걸친 주/월은 선택 기간 내 행만 포함한다. 비율·가중 평균은 원본 식을 버킷별 다시 계산하며 평균을 더하거나 평균끼리 평균내지 않는다. 빈 날짜를 0으로 채우지 않는다. 안전한 날짜 집계식이 아닌 선 차트는 지원 불가를 안내하고 원래 집계를 표시한다. 명시 집계의 240개 초과 시점은 잘린 결과를 표시하지 않는다.

개인 저장 보기에 새 옵션을 포함하며 이전 version1 보기는 자동/비교 해제로 호환한다. 대시보드 정의나 원본 파일은 탐색으로 변경하지 않는다.

## MD 케이스

| ID | 조작·기대 결과 | 상태 |
| --- | --- | --- |
| PERIOD-01 | source24/dashboard26: 2026-01-11~12, online+retail. 현재50/이전01-09~10=10/증감+40/+400%. online만 현재30/이전10. 두 기간 쿼리의 바인딩·snapshot 대조 | PASS |
| PERIOD-02 | 일: 10/20/30, 주: 01-05=30/01-12=30, 월: 01-01=60. KPI 추세와 선 차트가 같은 버킷. SQL 비율 원본 재집계·UTC 주/월 경계 | PASS_SELECTED_VARIANTS: UTC DATE/시간 경계 fixture·원본 비율 |
| PERIOD-03 | 이전0/NULL·현재NULL·음수 이전·윤년/연도 경계·잘못된 옵션. 0을 NULL로 바꾸거나 Infinity 생성 금지. 범위 없는 비교400 | PASS_SELECTED_VARIANTS: 0/NULL 실제 UI·API, 음수·날짜 경계 하위 검사 |
| PERIOD-04 | 주/월+비교+기간+필터 개인 보기 저장→reload→복원. 이전 version1 보기 열기 자동/비교해제. 날짜 초기화시 비교 해제 | PASS_SELECTED_VARIANTS: 실제 주별 절대 보기·legacy 호환, 월별/상대 옵션 하위 검사 |
| PERIOD-05 | 390폭: 날짜/선택/비교값/정확값 표/이전 표 가시성, 가로 overflow·카드 잘림 없음. Tab/방향키/Enter/Space로 단위·비교·보기 복원, 초점 유지 | PASS_SELECTED_VARIANTS: 새 컨트롤/표 경로, 실제 VoiceOver 미검증 |
| PERIOD-06 | 조회503 fixture로 주입: 이전 결과·미적용 조건 안내. 해제/재시도 정상. 240시점 초과·지원 불가 SQL 안내, 잘린 합계 시계열을 정상으로 표시 금지 | PASS_SELECTED_VARIANTS: 503 fixture·상위 N/정밀도 실제 UI, 240 한도 실제 worker 하위 검사 |

## 환경·증빙

Node24.21.0, FE3483/API4683, 기존 metadata SQLite + 서버 DuckDB worker. Aside guide/guide repl을 읽었으나 daemon 인증 challenge 요청 실패·미실행. 이전에 허용된 headed Chromium 실제 화면으로 진행하며 Aside 검증 성공으로 기록하지 않는다.

증빙은 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/period-comparison-grain/`에 남긴다. 화면·API 응답·CSV 독립 정답·검사 결과·파일 hash를 구분해 기록한다. 실제 VoiceOver/native 날짜 팝업, 실제 MySQL 운영 통합은 이번 범위의 미검증으로 유지한다.

## 실제 결과

원본 week1.csv를 Python Decimal로 독립 집계했다. source24의 현재 01-11~12=50, 바로 앞 01-09~10=10, 증감40/400%가 일치했다. online만 선택한 API는 현재30/이전10/증감20/200%다. 전체 데이터의 일10/20/30, 주01-05=30/01-12=30, 월01-01=60은 KPI 추세와 선 차트 모두 oracle와 일치했다. 날짜를 먼저 필터링하므로 01-11~12 선택 상태의 주01-05=20/01-12=30이 정상이며 전체 주의30을 가져오지 않는다. 비율·가중 식과 NULL/0·윤일/연말 경계는 실제 DuckDB fixture 및 하위 계산 검사로 확인했다.

브라우저에서 Enter로 기존 version1 보기를 열어 새 옵션이 자동/비교 해제로 적용되는 것을 확인했다. Home/방향키/Enter로 주별 선택, Space로 비교 켜기, 정확값 표 및 이전 기간 표를 Enter로 열었다. 조회가 끝나도 각각 combobox/checkbox에 포커스가 유지됐다. 새 보기 `주별 · 이전 기간 비교`(id24)에 week/comparePrevious=true/기간/두 채널/compact를 저장했다. 전체 reload 후 Enter로 열면 동일50·10·400%·주별 버킷이 복원됐다. 월별 화면의 현재 기간 합계50와 이전10도 확인했다. 날짜 두 입력을 지워 적용하면 자동/비교 해제·체크박스 disabled로 돌아간다. 최종 정상 주별 보기는 남겨 두었다.

390px 문서 scrollWidth=390이며 이전 기간 표 width/scrollWidth=332/332, 표 bottom2800.51은 부모 bottom2817.51 안이다. 실제 Tab 경로는 집계 combobox→비교 checkbox→저장 이름→목록 재조회→보기 불러오기이며, 이전 표 summary의 Tab은 이름 있는 region으로 이동한다. 최종 모바일 카드/전체 화면과 1440 데스크톱을 직접 확인했다. 초기 비교 모바일 캡처의 일부 점은 ECharts 전환 중 상태였으므로 안정화 후 `comparison-final-*`를 최종 증빙으로 사용한다. 개발 중 `day-desktop.png`의 임시 Assistant 차단 문구는 최종 구현에서 제거했다.

01-08의 빈 기간은 현재/이전 NULL로 표시하고 0이나 증감0으로 만들지 않았다. source24를 사용하는 전용 임시 dashboard27의 COUNT는 현재01-10~11=2/이전01-08~09=0/증감+2/증감률 계산 불가였다. 큰 정수 지표는 정확한 비교 범위 초과를 경고하고, 상위 날짜1개 선 차트는 원래20 결과를 유지하며 시간 집계 미지원 안내를 표시했다. 실제 화면·API를 저장한 후 임시 dashboard27만 삭제200했다. 원래 dashboard26의 정의 revision은 변경 전후 동일하다.

503은 브라우저 route로 주입한 fixture이며 실제 서버 장애가 아니다. 월별 결과가 남은 상태에서 일별 조회 실패 시 현재 조건 미적용 안내를 확인했다. route 해제 후 전체 데이터 복구60/auto/비교 해제를 확인하고 마지막에 정상 주별 저장 보기를 열었다. 오류 주입과 임시 정의는 실제 사용자 대시보드 정의를 덮어쓰지 않았다.

## 수정 · 검사 범위

선 차트 날짜 축의 긴 ISO 문자열은 날짜만 표시하도록 수정하고 정확값 표의 원래 값을 유지했다. 비교·추세·표가 늘어나도 카드가 잘리지 않도록 카드 높이는 저장 크기를 최소 크기로 유지하며 내용에 맞춰 늘린다. 조회 중 새 집계/비교 컨트롤을 비활성화하면 키보드 포커스가 사라질 수 있어 활성 상태를 유지하고 최신 요청만 반영한다. 지연 응답·두 번 선택 검사는 하위 테스트로 확인했다.

리뷰에서 상위 N/값 기준 정렬 SQL을 재집계하면서 제한을 버리는 문제를 발견했다. 값 정렬·역순·작은 LIMIT는 재집계를 지원하지 않고 원래 쿼리로 돌아간다. 안전한 정수 범위를 넘는 입력·증감과 경계에서 반올림되는 소수/지수 문자열은 비교 불가 안내를 반환한다. 실제 DuckDB 큰 정수와 마지막 경계4개(현재/이전 양방향)를 수정·재검증했다. 일반 소수는 기존 Number 계산 정책이며 임의 정밀도 금액 엔진으로 변경한 것은 아니다.

Assistant의 질문/수정 transport와 서버 문맥에도 같은 집계·비교 상태를 전달한다. 이전 행은100개로 제한하며 총/포함/누락·미지원 정보를 함께 보낸다. 새 패널 차단을 추가하지 않았고 Codex gpt-6-luna 설정은 유지했다. 이번에는 실제 LLM 요청을 실행하지 않았으며 transport/mock 및 실제 worker 문맥 전달 통과를 LLM 의미 검증으로 확대하지 않는다.

고유 신규 BE180개(기간·차트 helper117, 개인 보기50, 실제 preview13) + FE28개 통과. 영향받은 기존 KPI builder6·저장 보기6만 재사용/선택했다. BE nest build·변경 파일 lint, FE 타입·변경 파일 lint·production build, diff check 통과. 오류 수정으로 영향받은 조건만 재실행했고 전체 기존130개 MD/전체E2E·139만 행/Rill·AI 생성은 반복하지 않았다. 린트 형식 오류와 경계 테스트 단언이 다른 조건군에 잘못 붙은5실패는 수정 후 비교42개 및 관련 lint가 통과했다. 검사 수를 늘리기 위해 기존 카탈로그 통과를 다시 집계하지 않는다.

증빙: oracle-week1/oracle-assertions, full-grains, api-comparison, saved/reloaded-week, clear-period, null-comparison, boundary-result, error-query/query-recovery, mobile-layout/keyboard-tab-order, definition-preserved, fixture-cleanup JSON. 최종 화면은 comparison-final-desktop/mobile.png, comparison-card-mobile.png이며 month-mobile, null-comparison-mobile, query-error-mobile, boundary-mobile.png로 경계·장애 화면을 남겼다. 외부 verification-results.json에 커밋·파일 hash·환경·검사 범위를 기록한다.

SSBI-06 전체는 부분 완료로 유지한다. 업무 시간대(KST/IANA)·전년/달력 기간 비교·이전 선 겹쳐 보기·Commerce 현금 이벤트/주문 코호트별 비교·전체 VoiceOver는 후속이다. 새 상태의 Rill139만 행 성능·Rill 동일 조작 비교는 이번에 실행하지 않았다. 다음 기본 BI 우선순위는 차원 클릭으로 필터링/상세 내역 탐색이다.
