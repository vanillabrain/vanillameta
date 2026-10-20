# 숫자 범위 필터와 차원 변화 정렬

기준 `codex/self-service-next-20261014`, HEAD `db584d6e` + 작업 diff. FE3484/API4684, source3의 원본 Rill1391572행. 기존 통과를 반복하지 않고 이번 신규 조건만 확인한다. AI gpt-6-luna 유지, 이 기능에는 모델 호출이 필요하지 않다.

## MD 검증 조건

| ID | 조작 | 기대 결과 |
| --- | --- | --- |
| RANGE-01 | bid_floor 최솟값1·최댓값10 포함, 전체 기간 | 요청198575000·평균3.034962406996876±1e-9·439898행. KPI·추세·차원·원본 같은 필터, NULL 제외 |
| RANGE-02 | UTC2023-09-10~11 및 이전 기간 비교 | 현재56663800/126090행, 이전29059200/64723행. 평균3.071708773726648/2.9874935428651495±1e-9. 동일 필터를 두 기간에 적용 |
| RANGE-03 | 빈 범위·역순·문자·무한/안전 범위 밖·비숫자 열, 한쪽만 입력 | 잘못된 조건은 조회 전 차단/서버400, 기존 필터 보존. 경계값 포함·음수/소수·NULL 제외·동일 열 교체·최대5개 하위 검사 |
| SORT-01 | 현재 값/변화량/증감률 오름·내림차순 | 전체 차원 그룹을 서버에서 정렬한 후 상위20개. 독립SQL oracle와 순서/수치 일치. 증감률 내림 첫 Set Top Box[NR1]142.5680739445416%, 오름 첫 Connected Device−66.66666666666666% |
| SORT-02 | 비교 해제/전체 기간, 없는 이전·0·NULL·동률·20개 초과 | 비교 없으면 변화 정렬 차단, UI는 현재 값 내림으로 복귀. 계산 불가 마지막·동률 category 오름·큰정수 SQL 정렬 보존 |
| RANGE-KEY-01 | 1440/390px, Tab·숫자 입력·Enter 적용·네이티브 선택창 키보드·칩 해제 | 문서 가로넘침 없음, 레이블/오류 도움 연결, 적용/닫기 후 필터 추가로 초점 복귀. 원본 표 내부 스크롤 유지 |

독립 정답: 저장소 밖 `range-change-explore-20261014/oracle.cjs` 및 `oracle.json`. 원본 SHA256 `7549d18b0294932802407f6bd851a807ff88ba1406b2958bbd8b4c261a4ee157`. 제품 SQL 생성기를 사용하지 않는다. 실제 VoiceOver는 기존 BLOCKED 유지.

## 실행 결과

2026-10-14, 위 HEAD + 이번 diff, Node24. API4684/FE3484와 Aside 실제 창 및 headed Chromium1440×900/390×844에서 실행했다. 이번 신규 필터/정렬 조건만 선택하고 관련 없는 기존 통과 결과는 재사용했다.

| ID | 판정 | 확인 범위와 근거 |
| --- | --- | --- |
| RANGE-01 | PASS | 원본 Parquet 독립 SQL 대비 전체439898행·198575000요청·평균3.034962406996876±1e-9. 실제 브라우저 XHR201, KPI/차원/원본 첫 페이지 범위 확인. 두 기간 추세·값 검색의 같은 범위 적용은 실제 DuckDB 단위 검사 |
| RANGE-02 | PASS | 현재126090행·56663800요청, 이전64723행·29059200요청. 날짜+필터+비교 XHR와 독립 정답 일치. KPI 평균 두 기간은 UI 표시 $3.07/$2.99, 정밀 수치는 독립SQL/하위 검사 |
| RANGE-03 | PASS_SELECTED_VARIANTS | 빈 범위·역순은 실제 화면 안내·기존 조건 보존. 문자·무한·안전 범위 밖·비숫자 열·한쪽 경계·혼합5개/6개 거절은 BE/FE 하위 검사. 모든 오류의 실제 UI는 NOT_RUN |
| SORT-01 | PASS | 실제 XHR의 현재 값/변화량/증감률 × asc/desc 여섯 순서와 Device Type9그룹의 현재/이전/변화/증감률을 독립 SQL과 대조. 전체 그룹을 JOIN·정렬한 뒤20개 제한 |
| SORT-02 | PASS_SELECTED_VARIANTS | 비교 해제 시 실제 UI 현재 값/desc 복귀. 없는 이전·0·NULL·동률·20개 초과·큰정수 정확 정렬은 실제 DuckDB 하위 검사. 경계값 화면 변형은 NOT_RUN |
| RANGE-KEY-01 | PASS_SELECTED_VARIANTS | 실제390px 문서폭390·가로넘침0. Enter 적용·닫기 후 추가 버튼 초점 복귀, 최솟값→Tab→최댓값, 오류 aria-describedby 확인. 실제 Aside OS 입력 Tab→Space→Down→Return으로 native 방향 asc 적용·순위 갱신. 필터 칩은 Delete로 제거(Enter는 제거 키가 아님). 전체 VoiceOver BLOCKED 유지 |

검사: BE8suite/267개, FE SourceExplore19개 PASS. BE/FE build, FE 타입·변경 lint PASS. BE lint 오류0/기존 경고4. Vite 기존 configLoader 경고는 남아 있으며 전체 테스트/출시 회귀를 이번 결과로 확대하지 않는다. BE 검사는 번들 Node24.19.0, 서버와 FE 최종 검사는 격리 Node24.21.0이다.

증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/range-change-explore-20261014/`. `oracle.json`, `ui-xhr.json`, `ui-results.json`, `keyboard-results.json`, `native-keyboard.json`, `backend-verification.json` 및 검사 로그/`implementation.diff`로 재현 범위를 고정한다. 임시 브라우저 검증 코드는 이 증빙 폴더에만 보관하고 저장소 E2E 코드를 추가하지 않았다.

핵심 캡처: `vm-percent-viewport-desktop.png`, `vm-percent-viewport-mobile.png`, `vm-range-input-mobile.png`, `vm-range-error-desktop.png`, `vm-range-error-mobile.png`, `aside-range-desktop.png`, `aside-native-keyboard-asc.png`.

## Rill 결과·UX 대조

로컬 Rill0.90.5/API9014에서도 **동일 원본 날짜**를 사용했다. `auction_range` 비교 모델은 같은 Parquet에 `bid_floor >= 1 AND bid_floor <= 10`만 적용한다. 원래 Rill metrics 파일은 백업 내용으로 복구했으며 비교용 모델/metrics만 별도로 남겼다. Rill 선택창에서 관찰한 원시 숫자 열 연산자는 Select/Contains/In list였다. 이번 설치에서 범위 입력 UI를 확인하지 못했으므로 파생 모델 조건으로 대조했다. 이를 모든 Rill 버전의 미지원으로 일반화하지 않는다.

Rill Custom Sep10~11(끝 exclusive Sep12), Previous period Sep8~9(끝 exclusive Sep10), Device Type 기준에서 현재56.7M/평균$3.07/126k행과 증감률 내림 Set Top Box143%→Phone127%→Mobile109%, 오름 Connected Device−67%→Games39%→PC70%가 독립 정답/VanillaMeta와 일치했다. 증빙 `rill-ui.json`, `rill-percent-desktop.png`, `rill-percent-mobile.png`, `aside-rill-percent-{desc,asc}.png`.

UX 차이: Rill은 순위 표 헤더의 #/변화량/% 클릭, VanillaMeta는 레이블이 있는 두 native 선택창이다. Rill은7개 미리보기+Expand, VanillaMeta는최대20개이며 비교 설명을 행 아래에 표시한다. VanillaMeta 기존 요청 지표 decimalPlaces0의 compact 표시57M과 Rill56.7M은 표시 정밀도가 다르고 실제 집계56663800은 같다. 저장된 지표 정의는 바꾸지 않았다. Rill 캡처는 시간별/지표10개, VanillaMeta는 일별/지표2개이므로 차트 곡선·전체 UX 동일성은 PASS로 판정하지 않는다. 두 모바일 캡처는390폭 가로넘침0이다.

## 환경 복구와 미실행 범위

처음 기존 API를 새 빌드로 기동할 때 Node 경로/개발 env/격리 DB 암호화 키가 달라 소스 읽기가 실패했다. 이것은 테스트 환경 준비 실패다. 원래 개발 env를 명시적으로 로드하고, 정확한 테스트 계정 user2/source3의 connectionConfig만 백업 후 같은 로컬 DuckDB 파일 경로로 재암호화했다. 원본 파일·행·revision·기존 지표는 변경하지 않았다. 다른 소스의 연결 복구/건강 상태는 검증하지 않았다. 평균 공식 비교에 필요한 신규 QA metric2(RATIO_SUM bid_floor/has_bid_floor_cnt)를 추가했고 기존 요청 지표1은 유지했다.

`keyboard.log`와 `ui-failure.png`는 Playwright의 native 선택창 키 입력이 변경 요청을 만들지 못한 자동화 실패다. OS 실제 Aside 입력으로 같은 선택창의 값/결과 변경을 확인했다. `keyboard-final.log`는 모바일 Tab 이동의 별도 성공 기록이다. 오류 입력 캡처는 정상적인 사용자 오류 안내이며 제품 장애로 집계하지 않는다.

숫자 범위/정렬은 현재 탐색 세션에만 적용한다. 탐색 보기 저장·내보내기, Pivot, MySQL/원격 소스, 운영 동시 부하, 실기기 터치/실제 VoiceOver는 이번 완료 범위가 아니다. AI gpt-6-luna 연결 설정은 유지했으며 이 기능 검증의 실제 모델 호출은0이다. 기존130개 카탈로그 완료 집계를 늘리지 않는다.


## 2026-10-14 RANGE-03·KEY-01 — 한쪽 경계·비정상 숫자 실제 화면

기준 `a7dc501d` + 앞선 삭제 재시도 초점 diff(그대로 보존). 이번 제품 변경0. 대용량 page10000은 이전 DETAIL-LARGE-02에서 실제 API 정답이 이미 확인돼 반복하지 않았고, RANGE-03의 하위 검사에서만 확인했던 한쪽 경계/비정상 숫자 입력을 실제 화면으로 연결했다. gpt-6-luna 설정과 VoiceOver BLOCKED 유지/AI 호출0.

**PASS_SELECTED_VARIANTS**: 원본 Rill Parquet1391572행 SHA256 `7549d18b0294932802407f6bd851a807ff88ba1406b2958bbd8b4c261a4ee157` 확인 후 별도 메모리 DuckDB에서 직접 SQL 집계했다. 1440×1000의 bid_floor 최솟값1/최댓값빈칸은 요청342506200·가중 평균10.581600405605014, 390×844의 최솟값빈칸/최댓값10은 요청490581800·평균1.2501132274324376. 실제 Enter 적용의 POST201·range에 입력한 경계 키만 포함·요청 합계 exact/평균±1e-9 일치, 적용 뒤 필터 추가로 초점 복귀를 확인했다. 최대/최소 한쪽 입력만 허용하는 제품 계약이며, 기존 양쪽1..10 정답 조건은 재실행하지 않았다.

각 화면에서 이미 적용한 경계를 유지한 채 같은 열의 새 입력 abc/Infinity/9007199254740992를 각각 시도했다. 유효 숫자/안전 범위 안내, aria-describedby=range-filter-error, 적용 후 300ms 관찰 동안 새 explore/query 요청0·기존 KPI 유지 PASS. 잘못된 입력을 서버에 보낸 API 거절 검사로 세지 않는다. 닫기 Enter 뒤 초점 복귀·두 문서 가로 넘침0. 필터칩의 제한 없음 표시, KPI의343M/$10.58·491M 표시, 모바일 입력/오류 줄바꿈·버튼/포커스/인접 배치를 실제 캡처로 검토했다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/range-one-sided-20261014/`: oracle.json, results.json, applied-min-1440.png, applied-max-390.png, invalid-preserves-1440.png/invalid-preserves-390.png. 기존 허용된 headed Chromium과 입력/Enter 경로이며 native 소스 선택은 selectOption을 사용했다. 소스/보기/지표/대시보드 저장 요청0, 신규 리소스0, 브라우저 검증 창만 종료. 제품 코드가 바뀌지 않아 기존 관련 단위·타입/lint/build를 재사용하고 문서 diff check만 수행했다.

이번 검증 기록은 미커밋. 최대5개 혼합필터의 전체 화면 조합·큰 정수 정렬의 실제 화면·실기기/전체Tab·MySQL 운영·실제 VoiceOver는 완료로 확대하지 않는다. 앞선 삭제 재시도 초점 수정도 미커밋 상태로 보존했다.


## 2026-10-14 RANGE-03·KEY-01 — 혼합5필터 한도와 같은 열 교체

기준 `a7dc501d` + 앞선 삭제 재시도 초점 diff(보존). 이번 제품 변경0. 하위 검사에서만 확인했던 값·범위 혼합5개/6번째 열 거절/한도에서 같은 열 교체를 실제 화면으로 선택 검증했다. 앞선 한쪽 경계·비정상 숫자·일반 저장/복원·Rill 전체 수치 조건은 반복하지 않았다.

**PASS_SELECTED_VARIANTS**: 임시 CSV App200/Site300, n1..n5가 각1/2인 두 행을 준비했다. category 값필터(App/Site)+n1..n4 범위1..2인 개인 보기 fixture를 API로 생성하고 실제1440×1000/390×844 화면에 적용했다(저장 기능 재검증이 아닌 입력 준비). n5 범위1..2를 Enter 적용하면 최대5개 열 안내·300ms 관찰 동안 새 explore/query 요청0·현재500 유지. 같은 창에서 기존 n1 범위를1..1로 바꾸고 Enter 적용→실제 query201·filters.length5·n5미포함·나머지 값/범위 조건 보존·합계200 exact. 저장한 원래 fixture state도 변경되지 않았다. CSV 두 행의 산술 정답과 대조했으며 제품 SQL 생성기를 oracle로 사용하지 않았다.

두 뷰포트 document overflow0, 칩 wrapping·오류 문구·입력/버튼 높이·정렬·선택 상태·KPI/카드 인접 배치를 캡처로 직접 검토했다. 적용 뒤 ‘필터 추가’ 초점 복귀 PASS. 열 선택은 selectOption, 적용은 Enter이며 OS native 방향키/실기기 touch·전체Tab·VoiceOver 발화로 확대하지 않는다. 제품 오류/수정0, 기존 관련 단위/타입/lint/build를 재사용·문서 diff check만 수행했다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/range-filter-cap-20261014/`: results.json, sixth-rejected-1440.png/sixth-rejected-390.png, same-column-replaced-1440.png/same-column-replaced-390.png, cleanup.json. source34/metric34/view69만 API 삭제·metric soft-delete 후 DB temporarySources/Views/activeTemporaryMetrics=0, 기존 source3/view1 응답 불변 확인. gpt-6-luna 설정 유지/AI 호출0·VoiceOver BLOCKED 유지.

이번 기록과 앞선 삭제 초점 수정은 미커밋. 혼합 필터의 모든 데이터 타입 조합·큰 정수 정렬 실제 화면·운영 다중 서버·실기기/VoiceOver는 미검증으로 유지한다.


## 2026-10-14 SORT-02·NUMBER-01·02 — 큰 정수 실제 화면과 추세 정밀도 수정

기준 `a7dc501d` + 앞선 미커밋 수정. 별도 CSV의 Alpha9007199254740992, Beta/Gamma9007199254740993, Zero0, Missing NULL을 사용했다. 독립 BigInt 산술 합계27021597764222978, asc Zero/Alpha/Beta/Gamma/Missing, desc Beta/Gamma/Alpha/Zero/Missing이 정답이다. 실제1440×1000/390×844에서 query201·정수1 차이/동률 category asc/NULL마지막·0 유지, KPI/순위의 raw title·aria-label 정확값을 확인했다. NUMBER-01의 큰 정수 화면 조건만 보강했고 기존 Rill 전체 정렬·비교 조건은 반복하지 않았다.

**FAIL→PASS_SELECTED_VARIANTS**: KPI/순위는 정확했지만 추세 상세 표는27021597764222976으로2 작게 표시됐다. 서버 trend points의 Number(rawValue) 변환이 원인이다. AiDashboardService는 안전 정수 범위를 넘는 원본 숫자 문자열을 유지하고 정상 숫자의 기존 number 계약은 유지하도록 보정했다. 실제 DuckDB CSV 회귀로 수정 전 실패를 재현했고 수정 후 신규/기존 숫자범위·NULL 추세3개 PASS/38skip. BE 변경lint 오류0(기존 non-null 경고4)/nest build PASS. 같은 환경 서버를 해당 빌드로 재기동했으며 AI_PROVIDER=codex/gpt-6-luna 및 연결/catalog 설정 유지. AI 호출0.

수정 후 위 네 화면 정렬 조건과 Enter 정확값 표에서 27,021,597,764,222,978 전체 자릿수 표시·document overflow0를 확인했다. 최초 helper는 기본 desc payload 생략을 처리하지 못했고 table이 region 안에 있음을 잘못 가정해 보정했다. 천 단위 구분자를 제거한 값으로 비교하되 마지막 자릿수 차이를 허용하지 않았다. geometry 근삿값과 표시 원값을 구분한다. DOUBLE 자체의 저장 정밀도/지수 극대값/모든 부호·통화 조합까지 검증한 것은 아니다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/sort-bigint-ui-20261014/`: oracle.json/results.json, before-exact-trend-1440.png, sorted-asc/desc-1440/390.png, exact-trend-1440.png/exact-trend-390.png, regression-before.log/regression-after.log, browser-before.log/browser-after.log, build.log, cleanup.json. 임시 source/metric35~38 정리·기존 source3/view1 보존. 현재 코드/기록 미커밋, VoiceOver BLOCKED 유지.

## 2026-10-14 DESIGN-FILTER-02 — 여러 필터 적용 상태의 레이아웃 수정

사용자의 필터 추가 후 디자인 피드백을 반영했다. SourceExplore의 wrapped Stack spacing이 새 행에도 앞 여백을 만들고, 추가 버튼이 칩과 함께 밀리는 배치를 개선했다. 적용된 필터 개수/추가 버튼을 독립 행에 배치하고 칩은 useFlexGap으로 정렬했다. 칩 색/테두리·라벨/삭제 아이콘 간격을 맞추고 긴 이름은 여러 줄로 표시한다. 필터 설정 패널 여백·두 숫자 입력의 동일 폭·도움/오류 행간을 정리했으며 적용/닫기는 모바일 같은 폭, 브랜드 primary/outlined 버튼으로 구분했다. 필터 추가/적용/닫기의 원형 ripple을 제거하고 기존 키보드 focus ring은 유지했다. 필터 쿼리/저장 계약은 변경하지 않았다.

**PASS_SELECTED_VARIANTS**: 임시 두 행500, 값+범위5개·6번째 거절·같은 열 변경200 상태에서1440×1000/390×844를 재검증했다. 일반 이름 및 refund_amount_after_coupon_and_partial_cancellation 긴 이름 변형 모두 칩/버튼 가림 없음·document overflow0. 칩 bounding boxes로 모바일 각 새 행 시작 x29 일치를 확인했고 실제 전후 캡처를 검토했다. 오류 상태는 입력/안내/적용·닫기까지 한 캡처에 남겼다. 긴 이름 최종 캡처는 페이지 맨 위부터 fullPage로 저장해 고정 헤더에 제목이 가려지지 않게 했다. UI 의미내용·URL/title·Vite overlay 없음·pageerror/console.error0·Enter 적용/초점 복귀 PASS. Browser plugin not available: 기존 허용된 headed Playwright로 대표 뷰포트를 검증했으며 Aside/실기기 터치/전체 스크린리더 통과로 세지 않는다.

FE 관련 필터/범위8개 PASS/15skip, FE 타입/변경lint/production build 및 diff check PASS. ripple 최종 보정은 기능 결과 재사용 + 긴 이름 해당 화면 재캡처·타입/lint/build로 확인했다. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/filter-layout-20261014/`: before-*.png, sixth-rejected-1440/390.png, same-column-replaced-1440/390.png, chip-boxes-*.json, health.json/results.json, tests.log/build.log, long-name/의 동일 파일과 final-browser.log, cleanup.json. 임시 소스/보기 삭제·지표 soft-delete 뒤 임시 active 자원0/원보기1 보존. 앞선 미커밋 삭제 초점 수정도 보존했다. gpt-6-luna 설정·VoiceOver BLOCKED 유지/AI 호출0. 이번 두 수정·기록은 미커밋이다.

## 2026-10-14 RANGE-03·KEY-01 — 음수·소수 경계와 문자 값 선택 배치

기준 `a7dc501d` + 기존 미커밋 삭제 초점/추세 정밀도/필터 디자인 수정 보존. 이번에는 아직 실제 화면으로 확인하지 않은 음수·소수 경계/NULL 제외/문자 열 범위 입력 차단만 선택했다. Aside는 `Aside isn't running on this machine`으로 연결되지 않아 기존 허용된 headed Chromium1440×1000/390×844로 검증했다. 실행 중 API4684를 재사용했고 프런트엔드3484를 다시 기동했다. 별도 API 기동 시도는 포트 점유로 종료됐으며 기존 프로세스를 종료하거나 설정을 바꾸지 않았다.

**PASS_SELECTED_VARIANTS**: CSV score=-2/−1.5/0/0.25/0.5/NULL, amount=100/20/30/40/200/300의 독립 정답은 전체690, −1.5..0.25 포함 조건90이다. 두 화면에서 Enter 적용 query201·요청 경계 키/값 일치·KPI90·차원 High40/Mid30/Low20·NULL 및 외부 경계 제외·필터 추가로 초점 복귀를 확인했다. 문자 category 열을 선택하면 숫자 범위 버튼/경계 입력이 없으므로 사용자 화면에서 범위 입력을 차단한다. 서버의 잘못된 타입 거절은 이번 UI 결과로 대체하지 않는다. 기존 Rill 집계/한쪽 경계/필터 한도 검사는 반복하지 않았다.

**디자인 FAIL→PASS_SELECTED_VARIANTS**: 문자 값 선택 목록의 기본 FormControlLabel 음수 여백과 테마 Checkbox padding0 때문에 체크박스 왼쪽이 잘리고 라벨 간격이 사라졌다. 해당 목록에만 margin0·행 최소40px·체크박스 여백·라벨 줄바꿈을 지정하고 모바일 한 열/데스크톱 두 열 grid로 정렬했다. 긴 이름은 모바일64px 두 줄, 일반 행40px이며 목록 높이220px 내에서 세로 스크롤한다. 선택 배경·행 전체 키보드 초점을 표시하고 중첩 원형 초점/잔상만 제거했다. 전역 테마/다른 체크박스/데이터 계약은 변경하지 않았다.

수정 후 별도 긴 이름 fixture에서 두 화면 모두 Space 선택→해제→재선택·Enter 적용 query201·정확 합계20·초점 복귀 PASS. 목록 scrollWidth=clientWidth, 문서 가로 넘침0, pageerror/console.error0. 최종 캡처는 전환 애니메이션 종료/페이지 상단 상태이며 행 포커스와 활성 적용 버튼을 직접 검토했다. 관련 FE 필터/범위4개 PASS/19skip, 타입·변경 파일 lint·production build PASS. CSS 최종 보정은 기능 결과 재사용+해당 화면 재캡처와 타입/lint/build로 확인했다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/range-decimal-20261014/`: fixture.csv/oracle.json, query-1440/390.json, results.json, inclusive-range-1440/390.png, text-column-1440/390.png(수정 전), tests-after.log/final-build.log, cleanup-db.json. `value-layout/`에 before-text-column-*·value-selected-*·value-applied-*·results.json·final-browser.log·cleanup.json을 남겼다. 최초 검증 도우미가 응답의 rows를 values로 읽은 오류는 helper-first-failure.log에 분리했고 제품 실패로 세지 않는다. 임시 source/metric44~48 삭제/soft-delete 뒤 남은 소스0·활성 지표0, 기존 source3/view1 내용 보존. 이번 코드/MD는 미커밋. gpt-6-luna 설정 유지/AI 호출0·VoiceOver BLOCKED·실기기/전체 스크린리더 미검증 유지.

## 2026-10-14 SORT-02 — 상위20 제한과 비교 불가 값의 실제 화면

기준 `a7dc501d` + 기존 미커밋 수정 보존. 이전에 DuckDB 하위 검사로만 확인한 20개 초과·이전0/NULL/현재만·이전만 있는 그룹을 실제 화면으로 연결했다. 기존 Rill9그룹/큰 정수/동률 화면은 반복하지 않았다. Aside 미실행으로 기존 허용된 headed Chromium1440×1000/390×844와 FE3484/API4684를 재사용했다.

**수치 PASS_SELECTED_VARIANTS**: CSV의 G01~G24 현재100+i/이전100, 현재2026-10-02·이전10-01 UTC 조건을 독립 산술로 대조했다. 증감률 내림 G24..G05/오름 G01..G20, 각20행·truncated=true·‘상위 20개만 표시’, 합계2700/이전2400·각 행 현재/이전/변화/증감률 exact(비율±1e-9) PASS. 전체24그룹을 정렬한 뒤20개를 제한하며 현재합계는 표시20행 합으로 축소되지 않는다.

별도8그룹은 현재45/이전25, 알려진 증감률−100/0/+100 순서와 계산 불가5그룹의 마지막/category asc 순서를 양 방향에서 확인했다. 이전0인 A-zero-prior는 이전0·변화+10·percent=null로 ‘0%’를 만들지 않는다. B-current-only/E-null-prior는 ‘이전 값 없음’, C-prior-only/D-null-current는 현재 ‘값 없음’/이전5를 표시하며 delta/percent=null이다. 기본 fixture를 저장 보기 API로 준비한 것은 입력 설정이며 기존 저장/복원 케이스 재실행으로 세지 않는다. 보기 열기/불러오기/닫기는 Enter, 순위 방향은 native selectOption으로 조작했다. OS 선택창 방향키/전체Tab·실제 VoiceOver로 확대하지 않는다.

**디자인 FAIL→PASS_SELECTED_VARIANTS**: 최초20행 화면에서 테마의 고정 버튼 높이 때문에 비교 설명이 행 밖으로 잘렸다. LeaderboardCard의 버튼만 height:auto·상하 여백·본문/비교 행간을 지정해 내용이 들어가도록 보정했다. 각 행의 설명 bounding box가 버튼 안에 들어오는지 양 뷰포트/양 방향8조건을 확인했다. 문서 가로 넘침0·pageerror/console.error0. 모바일 대표 최종 캡처는 고정 헤더가 중간에 찍힌 최초 캡처를 상단 상태로 다시 저장했다. 다른 전역 버튼/쿼리/저장 계약은 변경하지 않았다.

관련 FE 비교/정렬5개 PASS/18skip, FE 타입·변경 파일 lint·production build·diff check PASS. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/sort-comparison-boundaries-20261014/`: fixture.csv/oracle.json, before-browser.log/before-large-desc-1440.png/json, large/edge-asc/desc-1440/390.png/json, results.json/browser-after.log, capture-results.json/capture-final.log, tests.log/build.log, exact-checks-cleanup.json. source/metric49~51과 개인 보기75~79만 생성 후 삭제/soft-delete·임시 소스0/활성 지표0·기존 source3/view1 응답 보존. 코드/MD는 미커밋. gpt-6-luna 설정 유지/AI 호출0·VoiceOver BLOCKED 유지, 운영 DB/실기기/모든 정렬 조합은 완료로 확대하지 않는다.
