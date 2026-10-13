# 업무 시간대 도입 — 날짜 계산 기반

2026-10-14, `develop-v2` 기존 작업 checkout에서 구현. Rill 도입 계획의 2차 중 서버 내부 날짜 계약 단계다. 시간대 선택 제품 기능 전체 완료가 아니다.

## 이번 코드

- `dashboard-date-range.ts`: 명시적 IANA 지역 이름/UTC 검사, 지역 달력 날짜와 시작 경계를 계산. 포함 종료일을 다음 지역 날짜의 시작인 반개구간으로 변환한다. UTC가 기본값이며 기존 공개 dateRange whitelist는 유지한다.
- `dashboard-period.ts`: 지역 날짜의 이전 기간은 같은 **달력 날짜 수**로 계산하고 각 범위를 지역 경계로 검증한다. timestamp 선택은 같은 경과 초 수를 유지한다. 비교용 날짜를 먼저 계산하고 각각 UTC timestamp로 변환해야 한다.
- `personal-view-state.ts`: 상대 기간 계산 함수에 내부 timezone 인자를 추가했다. 기존 서비스 호출/저장 payload는 UTC 그대로다.
- 새 라이브러리는 추가하지 않는다. Node Intl/ICU 시간대 데이터를 사용한다. [ECMA-402 시간대 계약](https://tc39.es/ecma402/#sec-use-of-the-iana-time-zone-database)을 참고했다.

## 선택 검증

| 범위                                                                              | 결과                          |
| --------------------------------------------------------------------------------- | ----------------------------- |
| KST 자정/윤일, Kathmandu 45분 offset                                              | PASS                          |
| New York DST 23/25시간 날짜, Lord Howe 23.5시간 날짜                              | PASS                          |
| Sao Paulo 생략된 자정, Havana 반복 자정                                           | PASS                          |
| Apia 생략 날짜 거절 및 직전 날짜 종료 경계                                        | PASS                          |
| 잘못된 timezone, 날짜 오류, 지원 연도 범위 초과                                   | PASS                          |
| 절대 timestamp 보존, DST 이전 달력 날짜/경과 초 구별                              | PASS                          |
| KST 상대 기간, 호스트 timezone 독립성                                             | PASS                          |
| 실제 DuckDB 집계/행 필터: KST 30/2행, spring 30/2행, fall 100/4행, spring 이전 90 | PASS                          |
| 기존 기간/저장 보기/시간 선택/실제 UTC preview 회귀                               | PASS                          |
| BE build, 변경 5개 TS 파일 lint                                                   | PASS                          |
| 시간대 선택 UI/저장 재조회/Assistant/실제 HTTP XHR                                | NOT_RUN — 공개 API/UI 연결 전 |

관련 6개 suite 243개 검사 통과. 단위/API 서비스 내부와 실제 DuckDB worker 검증이며 브라우저 화면/XHR 증빙으로 확대하지 않는다. 최초 계산 테스트에서 ICU iso8601 calendar의 BC era 미제공 문제를 발견하여 gregory calendar와 era 파싱으로 수정한 뒤 회귀를 재실행했다.

## 후속 통합 계약

1. 요청과 개인 보기 whitelist에 timezone을 추가하고 기본 UTC와 revision/소유권 검사를 유지한다. 상대 기간 서버 재평가에도 전달한다.
2. 날짜 필터·KPI/라인 일·주·월 집계·시간 선택·contribution fingerprint/원본 조회가 같은 지역 경계를 사용하도록 연결한다. UTC timestamp 문자열에 지역 시간을 Z로 붙이지 않는다. 기존 SQL의 직접 DATE grouping 등 안전 재집계가 증명되지 않는 경우는 사용 불가 이유를 보여준다.
3. API 응답/Assistant 문맥/FE 라벨/비교 정렬·이전 원본 조회/개인 보기 상태를 연결한다. 공개 UI는 이 일관성이 검증된 뒤 노출한다.
4. KST 경계 고정 fixture와 DST 두 날짜로 API → Aside 실제 화면/XHR → 저장 재조회 확인. 지금 결과를 전체 기능 PASS로 바꾸지 않는다.

증빙: `/tmp/vanillameta-business-time-20261014/RESULTS.md`.

독립 코드 리뷰 후 non-UTC 종료일9999-12-31이 잘못된 형식 오류로 거절되던 진단을 명시적 범위 초과로 수정했다. timestamp는 절대 UTC 순간, civil 문자열은 지역 경계로 해석할 날짜 라벨이라는 주석을 보강했다. 수정 후6개 suite243개·lint·build를 재검증했다.

## 후속 연결 검증 — 2026-10-14

위 기록은 날짜 기반 단계의 당시 결과다. 현재 작업 코드에는 요청 `dateRange.timeZone`, 개인 보기의 절대/상대 기간 whitelist, 서버 상대 기간 재평가, Assistant 기간 문맥과 UTC/KST 선택기가 연결되어 있다. non-UTC 추이 버킷과 추이 기여 행은 미지원 사유를 반환한다. 이 상태를 일·주·월 시간대 집계 전체 완료로 집계하지 않는다.

- FE `resolveRelativePeriod`가 지역 달력 날짜를 계산한 뒤 명시적 `timeZone`을 반환값에서 누락하던 문제를 수정했다. 명시적 UTC도 보존하고, 생략된 기존 payload는 그대로 유지한다.
- 새 화면 테스트의 preview 경로를 실제 `/ai/dashboard-preview` 계약으로 바로잡았다.
- FE 개인 보기/분석/시간 선택 3개 suite 123개 PASS. FE 타입 검사 및 관련 6개 파일 lint PASS.
- BE 날짜/실제 DuckDB/개인 보기 state·서비스/coding-agent 5개 suite 151개 PASS. 새 서비스 인스턴스의 KST 저장·재조회 포함. BE build와 관련 7개 파일 lint PASS.
- Aside 기존 탭에 연결해 실제 화면을 읽었다. `http://127.0.0.1:3683/dashboard/2`는 오류 대화상자를 표시하며, API `http://127.0.0.1:4883/v1`의 기존 검증 계정 로그인은 최초 HTTP 500이었다. 검증 서버 기동에서 누락된 기존 `.env.local`을 적용해 API 로그인 HTTP 201로 복구했지만 Aside 로그인 폼은 여전히 실패 안내를 표시했다. 실제 preview/원본/저장 XHR 검증은 BLOCKED이며, 단위 검사 결과로 대신 통과시키지 않는다.

화면 캡처: `/Users/drumcap/.aside/u/0/sessions/2026-10-14_EhVEIVkRBiSqE0vJ/tmp/saved-view-ui-blocked.png`. 후속 실행 기록: `/tmp/vanillameta-business-time-20261014/saved-view-followup.md`.

남은 작업은 로컬 API 로그인 실패 복구 후 실제 KST preview/원본/저장 재조회 검증, 지역 시간대 버킷과 비교 정렬·추이 원본 조회 연결이다. timestamp를 날짜 입력으로 표시할 때의 시간대 유지와 미적용 조건 판단도 후속 통합에서 검증해야 한다.

## 실제 화면/XHR 복구 및 KST 저장 검증

후속 실행에서 API의 `.env.local` 로딩뿐 아니라 검증 FE 주소 `http://127.0.0.1:3683`에 대한 `CORS_ORIGIN`도 복원해 Aside 폼 로그인을 통과했다. 기존 source3/dashboard2는 암호화 연결 설정의 키가 현재 설정과 달라 조회되지 않는다. 기존 ciphertext를 덮어쓰거나 복호화 보호를 제거하지 않았다. 별도 로컬 API 업로드/저장으로 source4/dashboard3을 생성해 화면 검증에 사용했다. 이는 SQL 없는 제작 화면 전체 검증이나 기존 source3 복구 완료를 뜻하지 않는다.

- **PASS 실제 KST preview**: `2026-01-01`의 시작 UTC `2025-12-31T15:00:00Z`에 10, 종료 직전 `2026-01-01T14:59:59Z`에 20, 합계30. 시작 직전999와 종료 경계900은 제외됐다.
- **PASS 비교**: 직전 지역 날짜 `2025-12-31`은100+999=1099, 증감−1069, 화면−97.27%. 비교 응답의 두 날짜 범위 모두 `Asia/Seoul`이다.
- **PASS 개인 보기**: 화면에서 `KST 자정 경계`를 저장한 POST201, 새로고침 후 목록 GET200, 보기 불러오기 GET200을 확인했다. 복원된 날짜·시간대·comparePrevious와 재조회 preview201의30/1099가 일치한다.
- **PASS 집계 원본**: 화면 버튼의 details201은 총2행, amount10/20을 반환한다. 모달 날짜 라벨은KST, 원본 timestamp는UTC offset을 유지한다. 닫기 후 호출 버튼에 초점이 복귀했다.
- **PASS 응답 정답 대조**: 실제 XHR JSON을 Python assert로 고정 CSV와 대조했다. `totalRows`는 문자열 숫자로 반환되어 정수로 해석했다. 초기 assert의 타입 불일치는 제품 값 오류가 아니며 재대조는 통과했다.

인증 header/cookie/token은 관찰·증빙에 포함하지 않았다. 임시 apiHelper 응답 관찰 코드와 작업 전 사본의 byte 일치를 확인하고 원복했다. 이번에는 제품 코드를 바꾸지 않아 이전 단위·타입·빌드 결과를 재사용한다. 실제 상대 기간 저장/지역 추이 버킷/DST 화면 변형/모바일·VoiceOver는 미실행이다.

증빙: `/tmp/vanillameta-business-time-20261014/live-xhr.json`, `kst-live.csv`, `live-resource.json`; 화면 `/Users/drumcap/.aside/u/0/sessions/2026-10-14_EhVEIVkRBiSqE0vJ/tmp/kst-saved-loaded.png`, `kst-details.png`. 이전 BLOCKED 기록 중 **별도 fixture의 절대 KST 기간 preview/비교/원본/저장 재조회**는 이번에 해소됐다.

## KPI 지역 추이 후속 확인 — 2026-10-14

현재 코드는 `numericTrendQuery`에서 지역 시간으로 변환한 뒤 일·주·월을 집계하고, civil 버킷 라벨을 지역 날짜 시작의 실제 UTC instant로 반환한다. FE는 해당 instant를 응답 timeZone의 날짜로 표시한다. 기존 본문의 지역 추이 미지원 기록은 당시 상태이며 **KPI 일·주·월 표시**에 대해서는 아래 결과로 갱신한다. 일반 CHART_LINE 재집계·지역 추이 시점 선택/기여 행·지역 비교 겹쳐 보기는 여전히 미지원이다.

- PASS: 실제 DuckDB를 사용하는 business-time-query 및 business-time 2 suite 52개. KST 일/주/월, New York DST23/25시간, 현재/이전 원래 버킷 instant, DATE civil 의미 포함.
- PASS: FE MetricTrendTimezone/comparisonTrend/DashboardAnalysis 3 suite 45개 및 타입 검사.
- PASS_SELECTED_VARIANTS: Aside 기존 dashboard3에서 `KST 자정 경계` 보기 불러오기 후 일별(자동), 주별, 월별 조작. 합계30/이전1099 유지, 일별2026-01-01, 주별2025-12-29(지역 월요일), 월별2026-01-01 및 Asia/Seoul 표시 확인. 선택한 날짜 밖의 주/월 전체로 합계가 확대되지 않았다.
- NOT_RUN: 이번 브라우저 response 이벤트 수집은 빈 배열로 종료되어 새 XHR payload 증빙으로 사용할 수 없다. 실제 worker/service 정답 검사와 실제 화면 증거를 구분한다. 기존 절대 KST 저장/원본 XHR 기록은 위 절의 범위로만 유지한다.
- NOT_RUN: DST 실제 화면, 상대 기간 화면, 이번 변경의 모바일/VoiceOver.

화면 증빙: `/Users/drumcap/.aside/u/0/sessions/2026-10-14_EhVEIVkRBiSqE0vJ/artifacts/kst-week-trend.png`, `kst-month-trend.png`. 제품 코드는 기존 구현을 유지하고 진행 문서만 갱신했다. 다음 구현 단위는 지역 추이 시점의 기간 선택과 기여 행 조회 계약 연결이다.

## 지역 KPI 추이 시점 선택·기여 행 — 2026-10-14

- 서버 지역 달력 버킷 선택은 지역 자정의 실제 UTC instant를 확인하고 DST23/25시간과 생략 자정을 처리한다. 주·월 선택은 적용된 기간으로 잘라 조회 범위를 넓히지 않는다. FE 선택 요청은 timeZone을 유지하고 범위·시점 라벨은 지역 시간대를 표시한다.
- 지역 numeric 기여 행은 원래 aggregate의 eligibility를 검증한다. 실제 그룹을 다시 조회하여 public canonical instant fingerprint/선택 시점을 확인한 뒤 bucket predicate와 기존 날짜/필터/SQL 조건을 함께 적용한다. 원본·대시보드 revision 검사는 유지한다.
- PASS: 지역 선택/기존 UTC 선택73개 후 생략 자정·timestamp clipping 추가로75개. 실제 DuckDB regional-query23개(현재KST 일/주/월, DST두 날짜, 변조 fingerprint 거절, 이전 DST기간 원본 포함). 기존 contribution compiler55개 및 현재/이전 contributor68개 회귀 PASS.
- PASS: FE timeSelection/MetricTrendTimezone28개, DashboardAnalysis36개(선택 timezone 보존), trend 현재/이전 선택·기여 관련36개. FE 타입·변경 lint, BE build/변경 lint PASS. 일부 suite는 겹치므로 합산 고유 검사 수로 보고하지 않는다.
- PASS_SELECTED_VARIANTS Aside/XHR: dashboard3의 KST보기→현재 시점 details201 금액10/20·2행, 이전 시점 details201 금액100/999·2행. 날짜 표의 기간 선택 후 preview201은 `[2025-12-31T15:00:00Z,2026-01-01T15:00:00Z)` 및 Asia/Seoul을 유지하고 합계30.
- 앞 실행의 일/주/월 XHR 미수집은 기존 임시 인터셉터의 관찰 기록에서 실제 응답을 확보해 고정 정답 assert로 보완했다. KST day/week/month의 canonical 시작 instant와30/이전1099 모두 PASS.
- DATE civil 열은 지역 시점 선택을 명시적으로 제한한다. 해당 제한 사유는 FE에 표시한다. 일반 CHART_LINE 지역 재집계, 지역 비교 겹쳐 보기, DST 실제 브라우저·모바일·VoiceOver는 이번 범위 밖이다.

인증 헤더/토큰 없이 request/body만 증빙에 저장하고 임시 apiHelper 관찰 코드는 제거했다. 증빙: `/Users/drumcap/.aside/u/0/sessions/2026-10-14_EhVEIVkRBiSqE0vJ/artifacts/kst-point-xhr.json`, `kst-selected-point-xhr.json`, `regional-xhr-observed.json`, `kst-point-details.png`, `kst-previous-point-details.png`. 다음은 DATE 열 선택 계약과 일반 라인 차트 지역 재집계다.
