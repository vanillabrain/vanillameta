# SSBI-03 후속 — 가중 평균·합계 비율

기준 develop-v2 `5ff1e824` 이후. 기본6집계·대용량 SUM/COUNT·9기기·레이아웃 기존 통과는 반복하지 않는다. 이번 선택은 신규 두 공식·경계·저장 재조회다. 기존 DuckDB worker/메타데이터 DB·codex/gpt-6-luna 유지.

- RATIO_SUM: 각 열의 전체 합계를 따로 계산해 분자/분모, 결과 배율1 또는100. 각 합계는 자기 NULL을 제외. 분모 합계0/NULL 또는 분자 전체NULL은NULL(화면—).
- WEIGHTED_AVG: SUM(값×가중치)/SUM(완전한 쌍의 가중치). 값·가중치 NULL 쌍 제외, 전체 가중치0/NULL 또는 그룹 안 음수 가중치가 있으면NULL(화면—). Rill의 이미 집계된 가중 합계/가중치 합계는 RATIO_SUM이다.

| 조건 | 기대 | 결과 |
| --- | --- | --- |
| ADV-01 | Rill source22에서 RATIO_SUM bid_floor/has_bid_floor_cnt 생성. 정답5.5712386765263995±1e-9, 저장·reload·snapshot·차트 | PASS: 실제5.571238676523254, 화면5.57 USD, 지표27/대시보드24 |
| ADV-02 | 실제 fixture의 가중 평균·백분율, 분모0/NULL·불완전한 쌍·음수 가중치 → —. API 원값과 독립 계산 | FAIL→PASS: chart table NaN 수정. 정상17.5/15%, 나머지 정책에 맞는NULL 유지 |
| ADV-03 | 없는/문자열/주입 secondary column, scale 임의 값·저장 정의 변조는400. 타계정 새 지표 사용403 | PASS: 실제6종400/타계정403. 저장 정의 재검사는 단위 검사로 확인 |
| ADV-04 |390px 제작/저장·공식/단위·재선택 보존·Enter 실행·표 확인. native select 기존BLOCKED/VoiceOver NOT_RUN 유지 | PASS 선택 범위:390폭 일치·Enter 저장/미리보기/표, native popup·VoiceOver 제한 유지 |

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/advanced-metrics/`. Aside unavailable일 때 기존 허용 headed Chromium으로 실제 화면을 확인한다. 수동 제작 모델 호출0. 고급 지표 전체(통화 변환·조인·임의 식·정의 수정·원격 DB) 완료를 뜻하지 않는다.

## 구현 범위

제작 화면에 합계 비율/가중 평균 선택과 숫자 열2개, 비율의1/100배 선택·공식·NULL 정책 안내를 추가했다. 계산식을 바꾸면 기존 선택 지표와 미리보기가 무효화된다. 소스의 실제 숫자 열만 허용하고 서버가 열 이름·배율을 다시 검증한다. 기존 정의 schemaVersion1의 선택 필드(denominatorColumn/scale/weightColumn)에 저장하며 immutable 지표/snapshot·DuckDB 워커·메타데이터 DB를 재사용한다. 새 패키지/마이그레이션/서버는 추가하지 않았다. 고급 집계는 BI 제작 API 범위이며 기존 일반 metric evaluate의6집계를 확장한 것으로 보고하지 않는다.

## 독립 정답·실제 실행

source23 `pairs.csv` 6행을 실제 파일 화면에서 업로드했다. 저장 지표28 가중 평균/29 백분율, 대시보드25에 NULL 숫자·그룹별 가중 평균·그룹별 백분율3차트를 저장하고 reload했다. CSV를 Python Decimal로 독립 계산했다. 정상 그룹 가중 평균=(10×1+20×3)/(1+3)=17.5, 백분율=(10+20)/(100+100)×100=15. 음수 가중치 그룹의 가중 평균은NULL이고 비율은9%, 불완전/분모NULL/분모0 그룹은NULL이다. 전체 weighted KPI도 음수 가중치가 포함돼NULL이다. `verification-results.json`의5그룹과 저장 API를 대조했다. 실제0과NULL 구분은 추가 chart 회귀에서 확인했다.

Rill source22의 전체1391572행을 새 공식으로 계산했다. 이전 원본 독립 DuckDB 정답5.571238676526887 및 Rill 정답5.5712386765263995와 오차1e-9 안에서 일치한다. 직접 화면에서 정의 저장→reload 재선택 분자/분모/배율→preview→대시보드 저장/reload, 모바일5.57 USD/추세를 확인했다. 기존 SUM/COUNT/9기기·Rill UI/AI 전체를 다시 실행하지 않았다. 대시보드24/25의 snapshot과 편집 재조회에서도 공식/열/배율이 보존된다.

## 발견·수정·재검증

서버NULL·제작 정확값 표는 정상이었으나 공통 LineChart의 클라이언트 SUM이 parseFloat(NULL)로NaN을 만들었다. 실제 최초 `weighted-chart-table-before.png`에서4그룹NaN을 확인했고 새 하위 검사도 FAIL이었다. SUM에서 빈 값은 제외하고 전체NULL 그룹은NULL로 남기도록 수정했다. 차트의 NULL 데이터 표/tooltip도—로 표시한다. 실제0은0으로 유지하며 유효 값+NULL 혼합에서도 유효 값이 사라지지 않는다.

수정 후 같은 편집 미리보기·저장/reload 데이터 표는 valid17.5, 나머지4그룹—였다. 최종 `weighted-chart-table-after.png`, `saved-weighted-table-mobile.png`, `fixture-saved-desktop.png`, `fixture-saved-mobile.png`를 참조한다. 390px 문서 scrollWidth=390, 전체 표 행은 내부 스크롤로 조회 가능하다. 소스 프로파일·제작 기본 흐름 통과를 추가 집계하지 않았다.

## 검사·환경·남은 범위

BE 신규 계산/0·NULL·음수·컬럼/배율·snapshot10개 PASS. 같은 기본 집계 compiler가 바뀌어 영향받는 기존8개만 재검증 PASS(전체 suite 반복 아님). FE 신규 제작16개·NULL 집계/실제 chart table2개 PASS, NULL 최초FAIL→수정→PASS. FE 타입/변경 파일lint/build 및 BE 변경 파일lint/build PASS. 기존 ts-jest TypeScript/Vite config/Toast UI CSS 경고 유지. 실행 Node24, FE3483/API4683·기존 격리 DB/worker. API 재기동에서도 codex/gpt-6-luna·base URL/catalog 설정을 유지했다.

키보드는 입력·지표 저장/결과/대시보드 저장·편집 저장·표 열기 Enter를 확인했다. native 선택에는 selectOption을 사용했으므로 전체 키보드 완료로 확대하지 않는다. 실제VoiceOver 발화/native popup 선택은 기존 제한이 남았다. 고급 지표의 다른 DB·임의식·조인/통화 변환·정의 업데이트·파일 버전 교체는 후속이다. SSBI 전체/기존130개 카탈로그 집계는 유지한다.

증빙 추가: `rill-preview.json`, `rill-dashboard.json`, `ratio-groups-preview.json`, `weighted-null-save.json`, `editor-final-preview.json`, `saved-editor-results.json`, `saved-snapshots.json`, `api-boundaries.json`, `verification-results.json`. 화면 `rill-preview-desktop.png`, `rill-saved-desktop.png`, `rill-saved-mobile.png`, `weighted-form-mobile.png`, `weighted-null-preview-mobile.png`, `ratio-groups-preview-mobile.png`. 인증정보는 기록하지 않았다.
