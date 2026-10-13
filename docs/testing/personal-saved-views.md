# SSBI-09 — 개인 저장 보기

기준 develop-v2 `4874e2d7` 이후. 새 저장 보기만 검증하며 기존 파일 교체·차트 제작·AI 통과를 반복하지 않는다. codex/gpt-6-luna 및 현재 연결 유지, 이 수동 경로는 모델 호출0.

| ID | 입력·기대 | 상태 |
| --- | --- | --- |
| VIEW-01 | 적용된 절대기간·다중 필터·숫자 표시를 이름으로 저장. reload 후 불러오면 정답·조건 유지 | PASS: 실제 Tab/Enter 저장→reload→Enter 복원, 두 채널/절대기간/compact 유지. KPI50·채널30/20·날짜20/30 모두 독립 CSV Decimal과 일치 |
| VIEW-02 | 최근7/30/90일 표현을 저장. 열 때 UTC 오늘 포함 N일로 재계산, 절대기간은 고정 | PASS 선택: 실제 최근30일 표현 저장/null 절대기간→서버 UTC09/14~10/13 복원, NULL KPI/빈 그룹. 7/90·UTC 윤년/날짜 경계는 하위 검사 |
| VIEW-03 | 개인 보기 삭제/취소는 대시보드·지표·배치·현재 결과를 삭제하지 않음 | PASS: 실제 취소→보기 유지/포커스 복귀, 삭제200→남은 보기1·대시보드 정의/revision/배치·KPI50 불변 |
| VIEW-04 | 타계정/공유 토큰/다른 dashboard 경로·소유 철회 차단. 유효한 주인만 저장/열기/삭제 | PASS 선택: 실제 타계정4route403·다른dashboard404. 공유 토큰4route/소유 철회는 하위 검사. 팀 공유는 범위 밖 |
| VIEW-05 | stale 정의409, 이름/조건/상태 버전/범위/개수 오류 차단, 기존 보기는 보존 | 부분 완료: 실제 stale 생성/정의 변경 복원409·잘못된 날짜/extra state400. 21동시 API→기존1+신규19=20, 초과2차단. MySQL row lock은 코드 검토만, 통합 NOT_RUN |
| VIEW-06 | API 장애·재시도·저장 중 중복 차단·미적용 날짜 저장 차단, 실패한 복원은 현재 조건 유지 | PASS 선택: 실제 503 복원 실패→현재 날짜/결과 유지→목록 재시도/복원50. 미적용 날짜 저장 disabled, 중복/진행 중 조건 변경은 하위 검사 |
| VIEW-07 | 390px overflow 없음, Tab/Enter 이름 저장·불러오기·삭제 확인/취소·포커스, 새 목록 재조회 | PASS 선택: 390=scrollWidth390, Tab/Enter·상대기간 방향키 선택·삭제 확인창 순환/포커스. 중복 영역·데이터 표 clipping 수정. OS 날짜 팝업/VoiceOver NOT_RUN |
| VIEW-08 | metadata migration 멱등·기존 데이터 유지. 보기 상태에 원본 행/SQL/자격증명 없음 | PASS 하위/실제: SQLite metadata 멱등/기존 row 유지·별도 personal_view 상태 JSON whitelist. 기존 대시보드 hash 동일. 실제 MySQL migration NOT_RUN |

현재 제공하는 공통 분석 상태(날짜·필터·숫자 표시)만 저장한다. 별도 지표 선택·정렬·팀 공유 보기는 후속이다. saved view ID는 권한이 아니며 요청마다 현재 대시보드/소스 계보의 소유권을 검사한다. 소스 데이터는 최신 정상 게시 버전을 읽는다. 정의 hash가 다르면 현재 정의로 조용히 전환하지 않고 복원을 차단하며 새 보기 저장을 안내한다. 역사 데이터/정의 전체 재현은 이번 범위 밖이다.

개인 보기는 metadata DB의 personal_view 테이블에 저장되며 대시보드별 최대20개, 이름1~80자, 필터5열×50개로 제한한다. 원본 행·SQL·접속 설정을 저장하지 않는다. 상대기간은 UTC 오늘 포함 최근7/30/90일이고 과거 샘플이 범위 밖이면 빈 결과가 정상이다. 모바일 OS 날짜 팝업·VoiceOver는 별도 미검증으로 유지한다.

## 검증 환경·증빙

Node24.21.0, FE3483/API4683, 기존 격리 metadata DB/서버 DuckDB worker 유지. source24/dashboard26의 고정3행 파일은 day/channel/amount: 2026-01-10 online10, 11 retail20, 12 online30. 기간11~12·online 필터 기대30, online+retail 기대50. 원본 CSV를 Python Decimal로 읽어 별도 정답을 계산한다.

Aside guide는 읽었으나 daemon 미실행으로 기존 허용 headed Chromium을 사용한다. 숨은 단위/API 통과를 UI 통과로 확대하지 않는다.

증빙 경로: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/personal-saved-views/.

## 실제 실행 결과·수정

source24/dashboard26의 같은 정상3행을 사용했고 파일 교체/AI/Rill139만 행 기존 통과를 반복하지 않았다. 기간 2026-01-11~12와 channel online+retail를 저장했다. 서버 POST201 후 브라우저 전체 reload 기본60에서 저장 보기 Enter 복원→50, 두 그룹 online30/retail20과 일별20/30이 원본 CSV를 독립 Python Decimal로 집계한 정답과 일치했다. 숫자 표시는 compact로 복원했고 row/SQL/draft를 상태에 저장하지 않았다. 새 단위 서비스 인스턴스 재조회도 같은 타입/NULL을 보존했다.

최근30일은 저장 당시 절대기간이 아니라 relativePeriod={column:day,days:30}만 보관한다. 실제 2026-10-13 UTC 서버에서 2026-09-14~10-13으로 열렸고 이 오래된 샘플에 해당 행이 없어 KPI NULL(—)/그룹0/시간축 없음이 정상이다. 브라우저/서버 시계가 같은 당일인 실제 검증에 하루 경과 재평가 증명을 덧붙이지 않는다. 두 개의 서로 다른 UTC 날짜와 윤년 경계·7/30/90 표현은 하위 검사로 확인한다.

서비스 장애503은 브라우저 route fixture로 주입했으며 실제 서버 장애로 보고하지 않는다. 실패한 열기는 현재 날짜/결과를 변경하지 않았다. route 해제→목록 재시도→원래50 복원. 정의 충돌은 실제 dashboard title API 변경 후 GET view409으로 확인했다. 보기는 삭제되지 않고 현재50/조건 유지, 마지막에 원래 title/revision을 복원했다. 이 임시 정의 변경은 테스트 격리 fixture에만 적용했다.

삭제창은 취소에 초기 포커스, Tab으로 확인→Shift+Tab 취소, Enter 취소 후 원래 삭제 버튼에 복귀했다. 다시 열어 Shift+Tab 확인→Enter 삭제200, 삭제된 버튼 대신 목록 재조회로 포커스 복귀. 남은 절대 보기1·대시보드/지표/배치/hash 및 현재50을 유지했다. 동시 한도 검증 임시 보기19개와 전체기간 초기화 임시 보기는 ID를 지정해 정리했다.

첫 구현은 PersonalSavedViews와 DashboardAssistant가 같은 dashboardId key를 써 동일 부모에서 저장 보기 영역이 누적됐다. unique personal-views-* key로 분리해 DOM region1개/상태 변경 회귀를 확인했다. 첫 during-hmr-duplicates.png는 초기 오류 캡처이며 당시 이름은 HMR 가설을 반영했다. duplicates-before.png는 이미 수정이 적용된 캡처이므로 실패 증빙으로 쓰지 않는다. 저장 버튼의 데스크톱 라벨 줄바꿈은 nowrap/최소 폭으로 보정했다.

리뷰에서 날짜 두 입력을 지워 적용해도 column이 남아 저장을 계속 차단하는 문제를 찾아 전체 draft를 비웠다. 실제 날짜 초기화→전체기간60→state dateRange=null/relativePeriod=null 저장201을 재검증했다. 기존 정상 케이스를 새 통과 수로 재집계하지 않았다.

리뷰에서 count/insert 경쟁과 생성 직전 정의 변경을 발견해 MySQL dashboard row를 transaction 안에서 잠근 뒤 revision·count·insert를 처리하도록 바꿨다. 로컬 SQLite는 singleton service의 create/delete write queue로 직렬화하고 실패 후에도 후속 작업을 허용한다. 실제 기존1개 상태에서21동시 요청 중19개만201/나머지2개400, 총20개를 확인하고 기존 보기를 보존했다. 실제 MySQL/다중 서버 시험은 수행하지 않았다. production에서는 migration을 적용하고 synchronize=false를 유지해야 한다. 기존 migration:run npm script는 NODE_ENV=dev를 강제하므로 운영 환경에서는 그 스크립트를 그대로 사용하지 않는다.

낮은 차트에서 데이터 표가 카드 아래로 잘렸다. LineChart는 표가 열렸을 때 chart 최소 높이80/auto와 table max min(180px,40%)로 공간을 나눴다. 이름 있는 포커스/스크롤 region을 추가했다. 실제 모바일 table scrollHeight103/client76, ArrowDown 이후27/End 이동, 표 영역 bottom이 부모 안에 있음을 확인했다. 정확한 셀30/20·NULL과0 의미를 바꾸지 않았다. 표를 닫은 최종50 캡처는 전체 높이 차트를 유지한다.

상대기간 첫 캡처는 query 응답 직후의 ECharts 애니메이션 중 이전 막대를 담았다. 안정화 후 공용 데이터 표는 header만/0행, 차트는 축만 표시함을 확인했다. 내부 차트 상태를 정답으로 쓰지 않았고 원래 상대기간 캡처와 relative-empty-stable-mobile.png를 분리 보존했다. 후자는 스크롤 중 fixed header 캡처 위치가 달라 최종 대표 증빙은 absolute-final-*를 사용한다. 너무 이른 disabled 버튼 Enter·Select의 합성 접근 이름 exact-match 실패는 자동화 대기/locator 실패이며 제품 실패나 성공으로 집계하지 않았다.

## 검사·한계

신규 BE26개·FE27개=53개 통과. 영향받는 기존 controller1·정의 revision apply/undo1·필터/날짜3·차트 NULL 표1만 확인했다. FE 타입·변경 파일 lint·production build, BE nest build·변경 파일 lint, diff check 통과. 초기 Jest가 AI SDK ESM import를 따라가 실패한 의존을 제거하고 기존 revision hash를 순수 helper로 공유했다. 실제 저장된 hash 비교와 해당 revision 회귀1개로 동작 보존을 확인했다. 새 패키지·별도 서버·LLM 호출 없이 기존 metadata DB/Node/DuckDB worker를 사용한다.

권한과 숫자/영속 상태 증빙은 api-boundaries.json, absolute-save.json, absolute-reload.json, oracle-absolute.json, relative-reload.json, failure-recovery.json, delete-results.json, concurrent-api.json, clear-dates-fix.json, table-layout.json에 남겼다. 최종 화면은 absolute-final-desktop.png/absolute-final-mobile.png. 외부 verification-results.json에 커밋·파일 hash·범위·환경을 기록한다.

현재 SSBI-09 전체는 부분 완료다. 별도 지표 선택/정렬, 팀 저장 보기/링크 공유, 역사 정의·데이터 재현, 실제 MySQL 통합·VoiceOver는 미검증 또는 미구현이다. 다음 제품 우선순위는 비교기간·일/주/월 집계 선택이며, 외부 파일럿 전에는 파일 최대5버전 보존/정리·디스크 quota와 MySQL/백업 복원도 운영 gate로 남는다. 기존 전체130개 집계는 이번 신규 후속과 별개로 유지한다.
