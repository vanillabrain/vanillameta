# 시간 버킷 선택 · 공통 기간 탐색

후속의 위젯별 집계 입력 행은 [aggregate-contributors.md](aggregate-contributors.md)에 구현·선택 검증을 기록했다. 아래 기록은 시간 버킷 작업 당시의 범위이며 기존 통과 조건을 반복하지 않았다.

기존 DRILL/기간 비교/파일 저장/AI 통과 케이스를 반복하지 않고 새 시간 선택 조건만 검증한다. AI 제공자는 Codex `gpt-6-luna`를 유지하며 이번 수동 탐색에는 모델 호출이 필요하지 않다.

## 계약

원본 시간 컬럼과 집계 단위를 서버가 확인한 현재 시계열만 선택한다. KPI 시계열은 시간·일·주·월, 일반 시간 차트는 확인된 일·주·월 또는 시간 SQL 버킷을 사용한다. 계산한 임의 라벨·직접 TIMESTAMP·이전 기간 차트의 표시값을 날짜로 추측하지 않는다.

선택 범위는 UTC `[시작, 종료)`다. 종료 시각의 행은 제외하고 직전 시각은 포함한다. 주는 월요일, 월은 실제 달력 경계를 따른다. 현재 공통 기간이 있으면 버킷과 겹치는 부분만 선택해 기간이 넓어지지 않는다. 차원 필터·집계·비교 설정은 유지하며 이전 기간은 선택한 범위와 같은 길이의 직전 범위다. 기존 수동 날짜 입력은 종료일을 포함하는 일 단위 계약을 유지한다.

키보드로 KPI 시계열의 ←/→/Home/End 후 Enter/Space 또는 정확값 표의 기간 버튼을 사용한다. `선택한 기간 되돌리기`는 직전 기간으로 복귀한다. 개인 보기에 시간 정밀도를 저장·재조회한다. 조회 중·오류·미적용 날짜 입력에서는 선택을 차단한다. 대시보드 정의는 수정하지 않는다.

## 선택 명세

| ID | 입력·기대 결과 | 상태 |
| --- | --- | --- |
| TIME-01 | UTC 윤년 CSV, online 필터. KPI 시간 또는 일별 차트 클릭 → 공통 범위·수치·원본 행 일치. 02-29 10~11은30/2행(id2,3), 11~12는40/1행(id4). 종료11시는 포함하지 않음 | PASS_SELECTED_VARIANTS |
| TIME-02 | 일별02-29 online70/직전02-28=2, 주별02-26~03-04 online152, 월별02-01~03-01 online72. 02-29~03-01 날짜 입력 후 주 클릭은02-29~03-02로 교집합150, 월03-01 선택은03-01~03-02=80 | PASS_SELECTED_VARIANTS |
| TIME-03 | 실제390폭, SVG/표 Enter·Space 기간 선택, Tab·되돌리기·원본 상세 닫기 포커스. 화면 overflow 없음. 터치 경로와 클릭 좌표/시간 매핑 | PASS_SELECTED_VARIANTS |
| TIME-04 | 시간 정밀도 개인 보기 저장·재로드·불러오기, 필터/시간/비교 보존, 대시보드 정의 revision 동일 | PASS_SELECTED_VARIANTS |
| TIME-05 | 미적용 날짜·조회 중·실패 시 선택 차단. 실패 안내→재시도/되돌리기 복구, 늦은 응답이 최신 기간을 덮지 않음 | PASS_SELECTED_VARIANTS |
| TIME-06 | 서버 strict UTC·윤년·월/주 경계·NULL/0·지원 안 되는 SQL/형식·위조 metadata·타컬럼/잘못된 정밀도 거부. 기존 일 입력 계약 영향 검사 | PASS_SELECTED_VARIANTS |

## 환경·증빙

Node24.21.0, FE3483/API4683, 기존 metadata DB + 서버 DuckDB worker. Aside guide/guide repl 이후 로컬 daemon 인증 challenge 실패·미실행을 확인했다. 이전에 허용된 실제 headed Chromium을 사용한다. 증빙은 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/time-bucket-drilldown/`에 저장한다.

새 CSV는8행이다. online 전체312, 전체 채널412. Python Decimal 원본 oracle와 실제 preview/details를 대조한다. 테스트용 source27/dashboard31만 만들며 기존 source24/dashboard26의 정의도 읽기 비교한다. 실제 VoiceOver·Rill/139만 행·LLM 생성은 이번 선택 범위 밖이다.

## 실제 결과 — 2026-10-13

TIME-01~06은 **PASS_SELECTED_VARIANTS**다. 별도 CSV/Decimal oracle의7개 범위가 실제 preview 수치와 details의 row_id까지 일치했다. 실제 KPI 마우스11시 선택은40/id4, 실제 일별 canvas02-29 선택은70/이전2/증감68/3400%다. 최초 전체 범위는 online312이며 원본 중 retail100을 포함한 전체는412다. 주152·월72·시간 종료 경계는 API/worker 정답으로 확인했다.

390폭 KPI SVG의 Home→ArrowRight→Enter는10~11시30/id2,3이며 SVG 초점을 유지했다. 상세 닫기는 원본 상세 버튼으로 돌아왔다. 주별 표의 Space는 현재 입력 기간과 겹치는02-29~03-02=150, 월별 표의 Enter는03-01~03-02=80이다. 원래 주 시작02-26·월 시작03-01 표시값과 실제 선택 교집합을 구분했다. 표 버튼의 aria-pressed와 초점, 되돌리기 Space의150/버튼 초점, 문서390=viewport390을 확인했다. 별도 hasTouch/isMobile Chromium 컨텍스트의 touchscreen.tap은 실제 pointerType=touch로11~12시40을 선택했다. SVG의 모바일 tap 배경 덮임은 제거하고 키보드 초점 표시는 유지했다.

`TIME UTC 11시`를 저장·페이지 재로드·불러오기한 실제 요청은 precision=timestamp, 02-29T11:00:00Z~12:00:00Z, channel=online, 비교=true를 보존했다. 현재40/이전30/증감10/33.333…%다. 기존 source24/dashboard26에서도 새로운 UTC day 버킷 선택01-12~01-13은 현재30/이전20을 표시한다. 기존26 및 검증31의 정의 revision은 변경 전후 동일하다.

미적용 날짜의 SVG Enter는 요청0/aria-disabled=true였다. 503은 브라우저 route fixture이며 실제 서버 장애가 아니다. 이전 결과·조건 미적용 안내, 오류 중 Space 요청 차단, 되돌리기 Enter의 전체 기간312/channel 유지/버튼 초점을 확인했다. 최초 브라우저 검증 스크립트는 실제 화면과 다른 오류 문구를 기다려 timeout이 났고, 실제 DOM 문구로 고친 뒤 동일 실패 상태에서 복구를 계속 확인했다. 제품 오류로 오인하거나 통과 횟수에 더하지 않았다. 조회 중/사라진 행·SVG 초점 회복 및 사용자가 이동한 초점 보호는 신규 하위 검사다. 새 브라우저 지연 응답 경쟁 변형은 실행하지 않았다.

## 오류 수정·검사

DuckDB native TIMESTAMPTZ의 직렬화가 연결 UTC 설정과 별개로 호스트 offset을 출력해 처음 worker 검사4개가 실패했다. adapter offset을 UTC로 고정한 뒤 해당 worker 검사를 다시 통과했다. 다른 날짜 컬럼을 선택하면서 기존 기간 필터를 제거하는 경로는 독립 코드 리뷰로 확인했고, 서버 metadata 생성과 FE 표시·콜백에서 차단했다. 두 시간 컬럼의 실제 worker·FE 회귀가 통과했다. 임의 날짜 라벨·직접 TIMESTAMP·241개 버킷은 선택을 추측하지 않는다. JSON NULL과 값0을 구분하고 기간 경계는 strict UTC로 검증한다.

BE 신규85 + 영향받는 기존331 =416개 고유 선택 검사 PASS. 기존 검사는 공통 날짜 계약·UTC adapter 변경 영향으로 SQL/필터/상세/기간/개인 보기/Assistant 관련 파일만 선택했고, 실패 수정 뒤 해당2개/새1개만 추가로 확인했다. FE 신규76개(분석 상태26·개인 보기10·Assistant 전달1·상세 문구1·추세/범위33·차트 선택5) PASS. 반복 실행은 고유 개수에 더하지 않았다. FE 타입·변경 파일 lint·production build, BE nest build·변경 파일 lint, diff check PASS. 기존 ts-jest 지원 범위 경고와 기존 assertion lint4개 경고는 남아 있다.

전체 기존 MD/E2E, 실제 VoiceOver, Rill/139만 행 성능, LLM 생성은 NOT_RUN이며 이전 통과를 이번 결과에 합치지 않는다. 이번 AI 호출0, Codex gpt-6-luna 및 기존 연결 설정 유지. 원본 상세의 위젯별 기여 행·피벗·업무 시간대/전년 비교는 후속이다.

## 증빙

`oracle.json`, `api-oracle.json`, `kpi-mouse.json`, `day-canvas-click.json`, `mobile-keyboard.json`, `clipped-keyboard.json`, `saved-view-reload.json`, `error-recovery.json`, `touch.json`, `existing-date-source.json`에 수치·행·정밀도·입력·초점을 구분해 저장했다. 대표 화면은 `hour-details-desktop/mobile.png`, `hour-keyboard-mobile.png`, `clipped-week/month-keyboard-mobile.png`, `query-error/recovered-mobile.png`, `touch-hour-card-mobile.png`, `final-existing-desktop.png`다. BE 상세 명령·실패/재검사는 상위 evidence 폴더의 `time-selection-backend-verification.json`에 보존한다.

테스트용 source27/dashboard31과 그 개인 보기만 API200/SUCCESS로 정리했다. 원본 CSV·응답·스크린샷은 보존한다. 최종 실제 브라우저는 기존 source24/dashboard26의 새 기간 탐색 화면을 남긴다.
