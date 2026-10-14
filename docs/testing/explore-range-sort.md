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
