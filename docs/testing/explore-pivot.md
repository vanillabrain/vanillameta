# Pivot 탐색 검증

기준 codex/self-service-next-20261014 @ db584d6e + 작업 diff. 같은 Rill 원본 Parquet1391572행/source3/user2, bid_floor1..10 범위, UTC2023-09-10~11로 검증한다. 기존 숫자 범위·저장 보기 조건은 재사용하고 신규 교차 집계·축·탐색만 실행한다. AI codex/gpt-6-luna 유지/이번 경로 모델 호출0, VoiceOver BLOCKED 유지.

| ID | 조작 | 기대 결과 |
| --- | --- | --- |
| PIVOT-01 | 행device_type×열app_or_site, 요청SUM/입찰가RATIO_SUM | 독립 Parquet SQL의 모든 셀/행·열/전체 합계 동일. 전체 requests56663800, ratio3.071708773726648±1e-9. 비율 합계는 원본 재집계. 같은 Rill 모델/기간 표 비교 |
| PIVOT-02 | 열 없음→열 추가→행·열 교환→두 행 차원→행/열 필터→Explore전환 | 값/NULL을 구분해 필터, 기존 다른 조건 유지, 겹친 축 선택 차단, 공통 필터/기간/지표 전달. Pivot에서 Explore 조회 중단; 복귀시 원 조건 재조회 |
| PIVOT-03 | NULL·빈결과·COUNT/ratio분모0·큰정수·상위50행/12열·권한/revision/unknown입력 | 결측 조합을0으로 위조하지 않음. 합계에는 숨겨진 그룹도 포함. 응답/렌더 한도 명시. 소유권403/등록되지 않은 입력400/변경버전409 |
| PIVOT-04 | 조회503/재시도·지연 응답 후 축 변경 | 실패한 결과를 성공으로 남기지 않음·이전 조건 응답 무시·최신조건 복구. 새로고침은 기본 탐색으로 복귀하며 저장한 Pivot은 저장 보기에서 명시적으로 복원한다 |
| PIVOT-05 | 1440/390px, Tab/Enter/방향키/스크롤·행필터 | 문서 가로넘침0, 표 내부 스크롤/명시적 레이블·caption·합계·상태/오류. Rill 동일 상태/뷰포트 비교; 전체 스크린리더 판정으로 확대하지 않음 |

행 차원1..2/열 차원0..1/지표1..6의 첫 구현이다. 기존 worker/메타데이터·canonical 지표를 재사용한다. 선택 축은 첫 지표 합계 내림차순,50×12 표시 제한이며 전체 합계는 제한 전 조건이다. 시간버킷 축·계층 펼침·이전기간 Pivot·드래그/정렬 편집·Pivot 공유는 후속. Pivot 저장·재조회와 CSV는 아래 PIVOT-06~08에서 확장 검증한다.

Rill 공식 참조: [Pivot and Flat Tables](https://docs.rilldata.com/guide/dashboards/explore/pivot). 문서의 계층·드래그·시간축까지 구현했다는 뜻은 아니다.

## 실행 결과

2026-10-14 PIVOT-01~05 **PASS_SELECTED_VARIANTS**. 동일 원본의9행/2열/17셀, 모든행·열·전체합계 independent SQL 일치(requests56663800 / ratio3.07170877372671, 허용오차1e-9). Rill 실제56.7M/$3.07·모든표시값과 대조했다. BE13/PivotFE6·SourceExplore전환1, 타입/lint/build PASS.1440/390 overflow0, Tab/Enter/OSnative방향키/표내스크롤·고정행이름·행/열필터·축교환·503복구·50행숨은합계 PASS. 실제HTTP 타소유자500 발견→권한검사먼저수정→403 재검증PASS.

증빙·차이·선택범위: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-explore-20261014/RESULTS.md`. 원시값은VM전셀독립검사/Rill표시값·정의비교로 구분했다. 실제12열초과/지연소스교체UI·운영동시부하·실기기터치는NOT_RUN, VoiceOverBLOCKED 유지. 전체MD완료수130불변. AI codex/gpt-6-luna 유지/모델호출0. 현재워크트리 미커밋작업.


## Pivot 저장·CSV 확장 — 2026-10-14

| ID | 조작 | 기대 결과 |
| --- | --- | --- |
| PIVOT-06 | 현재 Pivot 저장→새로고침→보기 불러오기 | 모드·행1..2·열0..1·지표·필터·기간 복원 후 최신 데이터 조회. 기존 Explore v1 보기 호환. 겹친/미등록/시간 축·Pivot 없는 mode 거부 |
| PIVOT-07 | CSV 다운로드와 실제 파일 파싱 | long-form record_type별 셀/행·열·전체 합계 구분. 숫자는 K/M·단위·추가 반올림 없이 응답값 그대로. 빈 조합은 missing/빈 값, NULL 값은 present/빈 값. 표시 제한은 export_scope에 명시. BOM·CSV escaping·텍스트 수식 무력화, 숫자 음수 유지. 조건 변경/조회중/오류 시 오래된 결과 내보내기 차단 |
| PIVOT-08 | 1440/390px 저장·복원·내보내기, Tab/Enter | 모바일 문서 overflow0, Tab으로 내보내기 도달/Enter 다운로드. 동일 조건 모바일/데스크톱 CSV 스키마·정수 동일, DuckDB 재집계 비율은 기존1e-9 허용오차. VoiceOver 완료로 확대하지 않음 |

CSV는 최대50행×12열 표시 그룹만 내보내며 숨겨진 그룹을 포함하는 전체 합계를 별도 기록한다. 전체 무제한 export·Pivot 위젯 추가·자동 최종보기 복원은 범위 밖이다. 기존 SQL oracle/request totals는 재사용하고 새 CSV 정밀도/복원 조건만 실행한다.


PIVOT-06~08 PASS_SELECTED_VARIANTS (2026-10-14): Aside 실제 저장·새로고침·복원·Enter 다운로드 확인. headed Chromium390×844에서 복원/Tab 내보내기/Enter 다운로드·overflow0. 실제 다운로드17셀 요청값 exact/비율 independent oracle±1e-9. BE신규1·FE CSV/상태/Pivot/SourceExplore47+신규stale export1 PASS, FE타입·변경lint·BE/FEbuild·diffcheck PASS. 기존Explore shape 회귀 발견→mode는Pivot만직렬화→22회귀재검사PASS. 응답 raw 숫자 문자열을CSV에추가반올림없이저장(집계자체의DOUBLE오차는유지). 원시CSV·XHR·캡처·결과: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-saved-export-20261014/RESULTS.md`. 기존PIVOT01~05 전체반복안함. 표시제한CSV/큰정수/escaping은단위선택검사, 실제파일모바일·복원은UI.2행축실브라우저저장/실기기/VoiceOverNOT_RUN/BLOCKED유지. AI설정codex/gpt-6-luna 유지·모델호출0. 미커밋.

## 2026-10-14 두 행축 복원·12열 초과 후속

PIVOT-03/06/07/08 잔여 선택 변형: source3 같은1391572행, 전체기간/필터없음. Aside실제 device_type+app_or_site 행2개/device_os 열 설정→새 보기 저장→새로고침→Enter 복원 PASS. 18행/28열 중12열 표시·숨겨진그룹안내 PASS. headed390px 복원·표 내부스크롤·문서overflow0·Enter 실제CSV다운로드 PASS. 캡처직접디자인검토(축/버튼/포커스/제한안내/표).

표시12열 request합630168200 vs 전체634513000으로 숨겨진16열4344800이 전체에 포함. 다운로드파일의 모든 export_scope=displayed_groups_only;totals_include_hidden_groups 및 grand_total정수 일치 PASS. 기존SQL기본정답/Rill비교재사용; 이번새축 전셀독립SQL/RillUI비교는 수행하지 않았다. 새 오류0/제품코드변경0, 생성보기7만정리. 이전단위·빌드반복안함.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-two-axes-20261014/RESULTS.md`, `two-axes-mobile.png`, `two-axes-desktop.png`, `limited.csv`, `response.json`, `csv-results.json`. 두 행축저장/실제12열초과는 이 범위에서해소. 남은 지연응답후소스교체UI·운영동시부하·실기기touch NOT_RUN; VoiceOverBLOCKED 및 gpt-6-luna유지.

## 2026-10-14 지연 응답·소스 전환 후속

PIVOT-04 **PASS_SELECTED_VARIANTS**: 실제headed1440/390에서 source3 Pivot 응답을 보류→source4(지표0) 전환→늦은 응답 해제. 기존 요청 취소/늦은 응답 후 source4 표 없음·CSV 차단, source3 복귀 새201/정상표 PASS. 지연 중 저장/CSV차단·Pivot Enter 조작·문서overflow0 및 캡처 디자인 확인 PASS. source4 기존 연결 암호화키가 현재 서버와 달라 같은 Rill source3 설정을 임시 차용했고 원본 정확히 복구/백업삭제. 지표있는 두 소스의 경쟁응답/취소불가transport는 NOT_RUN; 취소 및 빈소스격리 범위만 통과. CSV다운로드·전체Tab·실기기·운영동시부하 재실행안함, VoiceOverBLOCKED/gpt-6-luna유지. 새제품수정0, 이전단위/빌드재사용. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-stale-20261014/RESULTS.md`, `ui-results.json`, `pending-*.png`, `source4-*.png`, `recovered-*.png`. 미커밋.

## 2026-10-14 지표 있는 두 소스 경쟁 응답 후속

PIVOT-04 **PASS_SELECTED_VARIANTS**: bca84b2b 기준, 동일 Rill1391572행 source3/4·각2지표. source3 실제Pivot응답 보류→source4 카탈로그/Pivot201·표 표시→이전응답 해제 후 새표/소스 유지 PASS(1440/390). 기존 요청은 브라우저에서 취소됨; 취소불가transport 검증으로 확대하지 않는다. 지연중 저장/CSV차단·새결과 저장가능·Enter CSV다운로드 PASS. 실제CSV 지표ID3/4만 포함·총요청634513000 exact·비율새응답±1e-9 PASS. 문서overflow0/컨트롤배치·모바일표내스크롤 캡처검토 PASS.

source4 원본연결은 현서버 암호화키와 달라 config백업/동일source3 연결임시차용, 신규검증지표3/4만추가. 실행뒤 정확히삭제·원본config복구/백업삭제. 기존지표·저장보기변경없음. 새제품오류/수정0, 기존단위/빌드/Rill대조재사용. 신규항목만검증; VoiceOverBLOCKED·gpt-6-luna유지/모델호출0. 운영동시부하·실기기touch/취소불가transport NOT_RUN. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-race-20261014/RESULTS.md`, `ui-results.json`, `csv-results.json`, `source4-1440.png`, `source4-390.png`.

## PIVOT-09 — 운영 동시 부하의 로컬 선택 검증 (2026-10-14)

- 입력: 같은 Rill1391572행 source3·지표1/2·행device_type/열app_or_site. 4개 필터정답(전체634513000/MobileTablet307763000/PC173308000/ConnectedTV27207600)을 교차 배치해4·8·16·24개 HTTP요청 동시 실행.
- 기대: 성공응답의 조건/정답/revision 혼선없음,50×12상한유지. 큐포화시 controlled503 busy, 무관한500·client timeout없음, 종료후 정상조회복구. 실제브라우저 오류/재시도도 확인. 운영SLA는 별도정의하며 측정값으로 통과기준을 사후발명하지 않는다.
- 결과 **PASS_SELECTED_VARIANTS**: 4/8/16은 전부201,24는17성공/7큐busy503. 52요청중45성공·모든성공정답일치,4개후속복구201. p95 351/688/1653/1767ms; 복구93~113ms. API peakRSS302.5MiB(300ms표본, 누수판정아님). 실제32부하중브라우저503→표제거/CSV차단→Enter재시도201/표복구 캡처PASS. 제품변경0·기존빌드/단위/Rill/모바일전체반복없음.
- 범위: 단일로컬서버/같은QA사용자의 독립요청; 다중tenant·지속부하·실운영하드웨어·혼합import/write·multi-replica·crash복구 NOT_RUN.16은측정지점이며보장사용자한도아님. VoiceOverBLOCKED·gpt-6-luna유지/호출0.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-load-20261014/RESULTS.md`, `results.json`, `browser-results.json`, `busy-desktop.png`, `recovered-desktop.png`.

## PIVOT-10 — 지속 부하 선택 조건

- 사전 범위: 단일 로컬 QA 서버·Rill1391572행·동일사용자·4개 필터, 8개 독립 클라이언트가 180초간 응답 직후 다음 요청을 전송(닫힌 부하 모델). 기존 단발4/8/16/24 burst는 반복하지 않는다.
- 기대: 성공응답의 요청합계/지표/revision/표 제한 정확, 비정상500·타임아웃·전송실패 없음. busy503·요청제한429는 별도 집계하고 성공으로 세지 않는다. 429는5초대기후재시도하고 제한해제까지최대65초복구대기한다. (초기실행에서기존120회/60초제한을발견해범위명시) 부하 종료 후 정상 조회·화면 유지.
- 측정:30초 구간 처리량/응답p95와1초 RSS표본·종료후15초안정구간. 지연/RSS 증가만으로 누수나운영SLA를 사후단정하지 않는다. 실제화면 부하중/종료후 캡처. 장시간 soak·운영하드웨어·다중사용자/tenant·쓰기혼합은 별도미검증.


PIVOT-10 **PASS_SELECTED_VARIANTS** (2026-10-14): 기본요청제한120회/60초 유지·8클라이언트·실측181.4초·455요청중183성공201/272제한429. 성공183건 모두4개필터정답·지표/revision·50×12상한일치,500/전송실패/timeout0. 성공응답p95=595ms. RSS1초표본peak347.0MiB/종료45.9MiB, 장시간누수판정아님. 제한해제뒤정상복구201/154ms, 총복구관찰20.2초는15초idle포함. 실제1440px429 표없음/CSV차단→수정한요청제한안내·부하종료정상표/634513000/pageerror0/overflow0 캡처PASS. 일반오류만보이던429안내를명확히수정, 새선택단위1PASS(8skip)·FEtype/lint/build PASS.

초기helper는429를503로가정해중단→기존보호동작을그대로반영해재실행. 이실행은rate limit에따른대기포함이며3분내내worker포화검증이아니다. 무제한worker지속포화·장시간soak·다중사용자/tenant·운영하드웨어·혼합write/import·multi-replica/crash NOT_RUN. 기존단발부하·통과UI/Rill전체반복없음. gpt-6-luna/VoiceOverBLOCKED 유지. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-sustained-20261014/RESULTS.md`, `results.json`, `during-desktop.png`, `after-desktop.png`.


## 2026-10-14 취소불가 응답·진행 중 필터 변경 후속

기준 `6d88eb80`(drumcap으로 현재 워크트리 브랜치 커밋·push 완료). PIVOT-04 잔여 취소불가 transport 변형은 단위 수준에서 PASS_SELECTED_VARIANTS: 동일 shared pool에서 source3 요청을 취소 신호를 무시하는 Promise로 보류하고 source4/revision/지표3·4 조회를 완료한 뒤 이전 성공 또는 오류를 반환했다. 최신 전체합계123456789·CSV활성·오류없음·pool정리 유지. 실제 네트워크가 취소를 무시하는 환경까지 검증한 것은 아니다.

CHART-FILTER-02: 공통 차트 조회 중 재선택 및 늦은 성공/오류. 단위 2조건 PASS: 첫 Mobile/Tablet 요청이 이미 제출된 뒤 true 추가 선택→최신42 표시→취소 무시 이전999/오류 도착해도42 유지. 기존 단위 재실행 대신 신규4개만 선택 실행(4 PASS/51 skipped). 최초 Pivot 검사 fixture가 열 없는 표의 숨겨진 전체합계를 찾고 정상 범위안내 alert를 오류로 오인해 실패했으며 검사 fixture/판정만 수정했다. 제품 오류/코드 수정 없음.

실제 headed Chromium 1440×1000/390×844에서는 Rill source3/dashboard2 첫 Mobile/Tablet 실제 API 응답307763000을 route.fetch 후 보류→키보드 Space로 Personal Computer 추가→최종481071000·상세활성→이전 응답 해제 후 최신 결과 유지 PASS. 진행 중 옵션 선택 가능, Escape/Enter/Space 경로 및 문서overflow0, 포커스·레이블·테마·줄바꿈 캡처 확인. 브라우저의 이전 요청은 취소되므로 이 화면 검증을 취소불가 transport 증명으로 확대하지 않는다. 원본 파일/지표/대시보드 저장내용 변경 없음, 필터 초기화로 종료.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/chart-inflight-20261014/`의 results.json, pending-1440.png, pending-390.png, final-1440.png, final-390.png, selected-tests.log. 기존 빌드 재사용(제품 변경 없음); FE 타입/변경 검사 lint 통과. 전체통과 MD 반복 없음. gpt-6-luna 설정 유지/호출0. VoiceOver BLOCKED·실기기touch·다중tenant/혼합write/import·장시간운영soak는 미검증 유지. 이번 후속 검사/기록은 미커밋.
