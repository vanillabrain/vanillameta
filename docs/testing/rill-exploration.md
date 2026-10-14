# Rill 기준 동적 지표 탐색

## 구현 범위

SQL 없는 제작 화면(`/explore`)에서 저장한 지표를 별도 탐색 화면(`/explore/source?sourceId=...`)에서 선택한다. 서버의 소유권·지표 정의·소스 버전을 사용하며 클라이언트 SQL을 실행하지 않는다. 이번 단위는 Measure/Dimension 선택, 검색 가능한 값 필터, 기간/시간대/비교, KPI·추세·차원 순위·페이지 단위 원본 행이다. 숫자 범위·변화 정렬과 개인 탐색 보기 저장/복원은 아래 후속 기록까지 구현했다. Pivot의 첫 행·열 집계/UI와 v2 보기 저장은 아래 후속 기록까지 구현했다. 내보내기와 운영 규모 부하는 후속 구현 항목이다.

## 비교 조건

[공식 샘플 manifest](../../samples/rill/manifest.json)의 SHA256을 확인한다. Rill은 현재로 이동한 모델, VanillaMeta는 원본 날짜 모델이다. 전체 기간의 지표/기기/OS 집계는 시간 이동에 영향을 받지 않지만 날짜 라벨과 일별 곡선은 같지 않다. 날짜 필터/추세 대조에는 원본 기준 독립 정답을 사용하며 Rill과 날짜가 동일하다고 판정하지 않는다. 두 화면의 동일 뷰포트/동일 선택 상태 캡처를 보관한다.

독립 정답 재생성: 저장소 루트에서 `node samples/rill/verify-oracle.mjs [원본 Parquet 절대경로]`. 제품 SQL 생성 코드는 사용하지 않는다. NULL을 0으로 바꾸지 않으며 비율은 `SUM(bid_floor)/SUM(has_bid_floor_cnt)`이다.

## 케이스

| ID         | 조작                                                                              | 기대 결과                                                                                                              |
| ---------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| EXPLORE-01 | 전체 기간, Total Requests/Avg Bid Floor, Device Type/Device OS                    | 요청634513000, 평균5.571238676526892±1e-9, 원본1391572행, 기기9그룹. Rill 표시635M/$5.57                               |
| EXPLORE-02 | Mobile/Tablet 순위 클릭 후 원본 행 열기                                           | 필터 칩과 KPI/순위/추세/원본에 동일 조건. 요청307763000, 평균5.655265295537497±1e-9, 원본710193행. Rill 표시308M/$5.66 |
| EXPLORE-03 | 필터값 검색·다중 선택, 날짜2023-09-10~11 UTC, 기기Mobile/Tablet+Personal Computer | 요청138055400, 평균4.633939385003283±1e-9, 원본313193행, 기기90789400/47266000. 일별69127400/68928000                  |
| EXPLORE-04 | Measure/Dimension/순위 지표 변경·전체 해제                                        | 선택 지표 계산식 유지, 순위 지표로 서버 정렬, 미선택 안내, 이전 응답이 새 상태를 덮어쓰지 않음                         |
| EXPLORE-05 | 이전 기간 비교, 이전에만 존재하는 차원·NULL·이전0                                 | 양쪽 차원 집합 포함, 없는 쪽은0으로 위조하지 않음, 불가능한 증감률을 무한대나0%로 표시하지 않음                        |
| EXPLORE-06 | 원본 페이지 이동, 필터 변경·해제                                                  | 페이지 경계와 합계 정확, 조건 변경 시 첫 페이지로 복귀, 서버 제한 준수                                                 |
| EXPLORE-07 | 다른 소유자·변경된 소스 버전·미등록 컬럼/지표/SQL 입력                            | 서버 거절. 오래된 결과를 현재 조건의 성공으로 보여주지 않음                                                            |
| EXPLORE-08 | desktop와390px, 키보드로 컨트롤 조작                                              | Rill 같은 영역 구조·읽을 수 있는 범주/수치·표 대안, 문서 가로넘침 없음. 전체 스크린리더/대비 인증은 별도               |

실행 증빙과 판정은 아래에 실행 후 기록한다. 이 케이스 정의 자체는 PASS가 아니다.

## 2026-10-14 실행 기록

`develop-v2`의 기존 작업 변경을 보존한 상태에서 `/explore/source`와 `/v1/bi/explore/{catalog,query,values}`를 연결했다. 검증은 별도 SQLite `/tmp/vm-rill-explore/metadata.db`, API4893/프런트3693에서 수행했다. Rill 원본 Parquet source3, 저장 지표1/2를 사용했다. 운영 DB에 적용한 검증은 아니다.

- **EXPLORE-01~03 PASS 선택 조건**: 독립 Parquet SQL 및 실제 API 전체634513000/1391572행, Mobile307763000/710193행, 날짜+다중필터138055400/313193행. 평균은 각각5.571238676526892/5.655265295537497/4.633939385003283에서 오차1e-9 이내. Aside 실제 날짜 입력/필터 다중선택과 비교를 수행했다. 이전9월8~9일70612400, 증감67443000/+95.51155321161723%는 독립SQL 및 실제 브라우저 XHR201과 일치했다.
- **EXPLORE-04~07 PASS 하위·선택 화면**: 실제 DuckDB 회귀에 canonical SUM/COUNT/가중평균/비율, NULL·분모0, 이전만 존재하는 차원, 이전순위30밖의현재상위그룹, 상위20/값50제한,검색이스케이프, 소유권·revision·미등록입력 거절을 포함했다. 큰 정수9007199254740993의 문자열을 KPI·순위에서 보존한다. 모든 오류 변형의 실제 UI는 NOT_RUN. 실제 Model Data 필터710193행/다음 페이지 XHR를 확인했다.
- **EXPLORE-08 PASS 선택 조건**: Aside desktop 실제화면/필터/기간/비교, Codex브라우저390px iframe documentWidth375≤viewport390. 전체 VoiceOver·실기기 터치·대비 인증은 NOT_RUN. 내장viewportoverride는 실제폭1280을유지하여390검증근거로쓰지않았다.
- 실제화면에서발견한 nativeSelect누락(선택해도값미적용)은MUI native설정으로수정하고회귀검사를추가했다. 기간미완성/역순에서는결과를일시중지한다.
- Rill1280×720 캡처와 대조하여 접힌 표시 설정·왼쪽 KPI/추세·오른쪽 차원 막대·하단 Model Data를 구현했다. Rill시간이동모델과원본날짜추세는동일하지않다. 차트축밀도·기간메뉴·좌우내부스크롤은Rill과차이가남아있으며UI동일성완료로판정하지않는다.

증빙: `/tmp/vm-rill-explore/api-checks.json`, `api-{all,mobile,dated}.json`, `reference-oracle.json`, `browser-xhr.jsonl`(탐색요청/응답만, 인증헤더없음), `rill-all-time.png`, `rill-mobile.png`, `vm-all-time.png`, `vm-390-frame.png`. Aside 캡처는 해당세션`tmp/dated-compare.png`에보관했으며세션데이터를삭제하지않았다.

Pivot·숫자범위·전체차원의변화량정렬·탐색상태저장/내보내기·지역비교겹쳐보기는후속작업이다. 이번 API는현재선택지표값기준으로전체그룹을서버정렬하며차원비교는두기간전체집계JOIN후상위20개를선택한다. 전체운영규모부하·출시회귀는 NOT_RUN.

검사: BE BI 관련62개 PASS 후 큰 정수 회귀를 추가하여 탐색12개 PASS. FE Explore 관련49개 PASS, FE 타입/변경 lint 및 BE build/변경 lint PASS. 차원 기준 지표의 단위/소수점과 이전 값·변화 표시를 연결했고 최종 Aside 비교/XHR를 확인했다.

### 커밋 전 통합 검증 — 2026-10-14

전체 BE 71개 suite/1,108개 테스트와 FE 45개 파일/690개 테스트 PASS. 루트 BE/FE 빌드, FE 타입·전체 src/e2e lint, 변경 BE lint PASS(기존 경고는 유지). 기존 회귀 테스트의 컨트롤러 인자 누락, 공통 프롬프트 때문에 잘못 식별한 중단 요청, 재시도에 남은 10ms 제한시간, preview 기본 집계/비교 인자 기대값을 수정했다.

격리 API4893/FE3693에서 full-flow와 product-flow의 CSV 집계·데이터셋 저장·로그인 오류/복구·위젯/대시보드 공개 공유 E2E 4개 PASS. 첫 실행은 Chromium 바이너리 누락으로 BLOCKED였고 `/tmp/vm-rill-playwright` 설치 후 재검증했다. 로그는 `/tmp/vm-rill-commit-{test,fe-test,build,e2e,lint,be-lint}.log`에 보관했다. 운영 배포·전체 확장 QA는 NOT_RUN이며 위 기능별 남은 조건은 유지한다.

### 숫자 범위와 변화 순위 — 2026-10-14 후속

원본 숫자 열의 포함 범위 `{column, range:{min?,max?}}`와 차원 순위 `rankingSort:{by:'value'|'delta'|'percentChange',direction:'asc'|'desc'}`를 연결했다. 최소/최대 중 하나를 생략할 수 있으며 0은 유효하다. 유한하지 않은 값, 역순, 값 목록과 범위 혼합, 숫자가 아닌 열은 거절한다. 대시보드 preview/details에도 실제 스키마 기반 숫자 검사를 적용했다. 비교 정렬은 전체 현재/이전 집계를 JOIN한 뒤 LIMIT20을 적용하고 비교 불가 값은 NULLS LAST로 정렬한다. 비교가 없는 정렬은 기본 현재값 내림차순이다. 전체 기간으로 돌아가면 비교/변화 정렬을 해제한다.

| ID         | 검증                                                                        | 결과                                                                                              |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| EXPLORE-09 | 포함/단측/0 범위, 검색값·KPI·순위·추세·원본 공통 조건, 잘못된 입력 거절     | 실제 DuckDB/FE 회귀 PASS. Aside `bid_floor:1~9` 적용 PASS. 모든 잘못된 입력의 실제 화면은 NOT_RUN |
| EXPLORE-10 | 현재값/변화량/변화율 × 오름/내림, 이전-only/NULL/0/음수, 현재 top20 밖 그룹 | 실제 DuckDB 및 원본 독립 SQL 6조합 PASS. Aside 변화량→변화율→오름차순, 원본 펼치기/XHR201 PASS    |

격리 API4896/FE3696, 새로운 정상 가입 테스트 계정, 별도 `range-metadata.db`/업로드를 사용했다. 공식 샘플 source3/지표1·2에서 2023-09-10~11 UTC와 `bid_floor >=1 AND <=9`: 요청55127800, 평균2.934985272971758±1e-9, 원본122756행. 이전9월8~9일28263800, 변화26864000. 실제 화면 마지막 XHR는 평균2.934985272971808이며 독립 정답과 허용 오차 안에서 일치한다. 범위 칩과 비교·정렬·원본에서 동일 조건을 유지했다. 첫 이벤트 방식의 XHR 수집은 빈 배열이어서 증빙으로 쓰지 않고 요청/응답만 저장하는 프록시로 재검증했다.

Rill 데모의 값/절대 변화/증감률 정렬과 범위 입력 흐름을 대조했다. **Rill의 Measure 숫자 필터는 선택한 차원별 집계 후 임계값 조건이고, 이번 VanillaMeta 범위는 원본 숫자 열의 조건이다. 두 필터를 동등하다고 판정하지 않는다.** Rill 모델은 날짜를 현재로 이동하므로 날짜 비교 수치는 원본 독립 정답으로 검증한다. UI는 기존 좌측 KPI/우측 순위 구조를 유지하되 이번 컨트롤의 전체 모바일·키보드·VoiceOver 대조는 NOT_RUN. 실제 화면의 비교 행 겹침은 자동 높이/최소48px로 수정하고 다시 캡처했다.

검사: 전체 BE71suite/1129개·FE45파일/696개 PASS 후 리뷰 수정. 최종 공통 AI/BI25suite/690개 및 추가 dashboard 실제 preview14개, FE 탐색20개·타입/변경lint PASS. 루트 빌드 PASS, CSV 집계/데이터셋 저장 핵심 E2E2개 PASS. DECIMAL(p,s) 타입의 비교 정확성 경계 누락은 회귀로 발견·수정했다. 전체 운영 부하/확장 QA/배포는 NOT_RUN.

증빙: `/tmp/vm-rill-explore/range-sort-api.json`, `range-browser-xhr.jsonl`, `range-ui-final.log`, `range-sort-final.png`, `/tmp/vm-rill-range-{integration-test,final-be,e2e}.log`. Aside 원본 캡처는 해당 세션에 보존했다. Pivot·탐색 보기 저장/내보내기·집계 지표 임계값 필터는 후속이다.

## 개인 탐색 보기 — 2026-10-14 후속

탐색 화면의 접을 수 있는 `탐색 보기` 패널에서 이름을 입력해 현재 조건을 서버에 저장하고 목록에서 다시 열거나 삭제한다. 지표·차원·순위 지표/정렬·값/숫자 범위 필터·기간 열/날짜/시간대·집계 단위·이전 비교·원본 펼침을 v1 상태로 보존한다. 원본 페이지 번호는 저장하지 않고 복원 시 0으로 초기화한다. 이름은 1~80자, 사용자/소스별 최대 20개다. 저장 기간은 현재 UI의 civil 날짜(YYYY-MM-DD) 계약이며 timestamp 정밀도는 이 저장 계약에서 거절한다.

별도 `explore_view` 테이블과 멱등 마이그레이션을 추가했다. 기존 대시보드 `personal_view` 계약은 유지한다. API는 `/v1/bi/explore/views/{create,list,load,remove}`이며 JWT 사용자와 소스 소유권을 모두 검사한다. 저장 시 클라이언트 catalog의 선택 지표 정의 버전과 서버의 버전이 일치해야 하며 서버에서 확정한 매핑을 보존한다. 소스 revision 또는 지표 정의 버전이 변경된 보기는 409로 복원을 막는다. 손상/미지원 상태는 목록에 삭제 가능한 항목으로 남기고 다른 정상 보기의 조회는 유지한다. UI는 오류 이유와 목록 새로 확인/새 보기 저장 안내를 표시하고 현재 탐색 조건을 보존한다.

| ID         | 조작                                                                   | 실행 범위와 결과                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EXPLORE-11 | 조건 저장 → 새로고침 → 선택/열기 → 원본 다음 페이지 → 다시 열기 → 삭제 | FE 회귀, 실제 API, 핵심 E2E PASS. Aside 공식 Rill 원본에서 저장/새로고침/복원/페이지 초기화 및 XHR PASS. 삭제/재로드는 E2E와 API에서 PASS                     |
| EXPLORE-12 | 다른 사용자 접근, 저장 직전 소스/지표 변경, 복원 시 버전 변경          | API 다른 사용자 4개 작업 403, 저장 시 revision/지표 불일치409 PASS. 복원 변경/현재 상태 보존/지연 응답은 BE·FE 회귀 PASS. 모든 실패의 실제 Aside UI는 NOT_RUN |
| EXPLORE-13 | 손상/미지원 상태·버전 매핑, 최대 수량 경합, 마이그레이션               | BE 회귀 PASS. 손상 항목 목록/삭제, 엄격한 복원, 정의 버전 누락, SQLite 동시 저장 상한 검증. 실제 MySQL 서버 경합은 NOT_RUN                                    |

검증 환경은 복사한 로컬 SQLite `/tmp/vm-rill-views/metadata.db`, API4898/프록시4899/FE3698이다. 원래 실행 서버와 데이터를 유지했다. 정상 로그인과 공식 Parquet 업로드로 source7, Total Requests/Avg Bid Floor 지표3/4를 준비했다. 기간 2023-09-10~11 UTC, bid_floor 1~9, 이전 비교, 변화율 오름차순, 원본 펼침을 저장해 새로고침 후 복원했다. 요청55127800, 평균2.934985272971758±1e-9, 원본122756행의 독립 정답과 실제 응답이 일치했다. 두 번째 원본 페이지에서 다시 열었을 때 XHR의 `page:0`과 첫 페이지 표시를 확인했다.

Rill 로컬 v0.90.5 Explore 화면의 컨트롤과 기본 상태 저장 위치를 확인했고, cloned 소스의 `ExploreBookmarks.svelte`/`Bookmarks.svelte`에서 URL 기반 조건과 개인/공유/홈 보기 흐름을 대조했다. 이 로컬 개발 데모에는 개인 Bookmark UI가 표시되지 않아 개인 보기 저장 동작의 Rill 실화면 검증은 NOT_RUN이다. VanillaMeta는 상단 접이식 개인 보기 패널을 사용하며 Rill의 Bookmark 드롭다운·공유/홈 보기는 후속 차이다. Rill 데모의 기본 상태는 변경하지 않았다. 이번 패널의 전체 모바일/접근성 검증은 NOT_RUN.

전체 빠른 단위 검사: BE73suite/1144개, FE45파일/702개 PASS. BE/FE 빌드와 FE 타입/변경 lint PASS. 저장/재로드/복원/삭제 핵심 E2E1개 PASS. 최종 별칭 지표 키 거절 추가 회귀를 포함한 보기 서비스13개 PASS와 BE 재빌드 PASS. 전체 핵심 E2E·확장 QA·운영 부하·배포는 NOT_RUN.

증빙: `/tmp/vm-rill-views/api-checks.json`, `browser-xhr.jsonl`, `vm-views-restored.png`, `integration-test.log`, `frontend-build.log`, `e2e/`. Aside 원본 캡처는 `/Users/drumcap/.aside/u/0/sessions/2026-10-14_olA4jURGvmDeql8n/artifacts/`에 보존한다. 다음은 같은 필터/기간/지표 계약을 재사용하는 Pivot의 행·열·복수 지표 집계와 UI다. 내보내기, 공유 보기, 집계 지표 임계값 필터는 이후다.

## Pivot — 2026-10-14 후속

탐색/Pivot 전환, 좌측 필드 검색·지표 선택, 행/열 차원 배치, 행·열 바꾸기와 구성 초기화를 추가했다. 기간·시간대·값/숫자 범위 필터와 이전 기간 비교를 공유한다. 행 값 클릭으로 탐색 필터를 적용한다. 각 축 최대 2개 차원, 전체 최대 4개이며 같은 차원을 양쪽에 중복 배치하지 않는다. 선택 지표는 열에 배치한다. 복수 차원의 첫 구현은 평탄한 tuple 행/열이다.

`POST /v1/bi/explore/pivot`는 소유권과 파일 snapshot/revision을 검증하고 저장된 지표의 canonical 식을 재사용한다. 셀, 행 합계, 열 합계, 총합을 각각 원본 필터 데이터에서 집계한다. 평균·비율을 셀의 합/평균으로 대체하지 않는다. 값 없는 조합은 NULL이며 빈 데이터 COUNT의 실제 0은 유지한다. 이전에만 있던 조합도 두 기간의 축 합집합에 포함한다. 최대 50행/20열 그룹/6개 지표로 최대 6,000개 값까지이며 축 제한 초과 시 일부 값을 성공으로 표시하지 않고 필터/축 축소를 안내한다. 기간/필터 기준은 기존 탐색 API와 같다.

저장 보기 v2에 `pivot:{enabled,rowColumns,columnColumns}`를 추가했다. 기존 v1 보기 조회·복원은 유지하며 v1에 pivot 필드를 넣으면 거절한다. Pivot에서 보기 저장 후 새로고침해 다시 열면 같은 축·지표·필터·기간·비교가 적용된다. Pivot을 끄면 같은 조건의 기존 탐색으로 돌아간다.

| ID         | 입력/기대 결과                                                                                                                                  | 검증                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| EXPLORE-14 | device_type × app_or_site, Total Requests/Avg Bid Floor. 전체 총합634513000, 비율5.571238676526892±1e-9                                         | 아래 실행 기록 참조 |
| EXPLORE-15 | 기간2023-09-10~11 UTC, bid_floor 1~9, 이전 비교. 총합55127800/2.934985272971758±1e-9, 이전 요청28263800. 셀·축 합계도 원본 직접 GROUP BY와 일치 | 아래 실행 기록 참조 |
| EXPLORE-16 | 축 교환/빈 축/다중 축, NULL·희소 셀·이전-only·평균/비율/가중평균·큰 정수·그룹 제한·다른 사용자·revision                                         | 아래 실행 기록 참조 |
| EXPLORE-17 | Pivot v2 저장→재로드→복원, v1 호환, 조건 변경·오류 후 복구·지연 응답 차단                                                                       | 아래 실행 기록 참조 |

Rill 로컬 실제 Pivot에서 Device Type 행, App or Site 열, Total Requests/Avg Bid Floor를 배치하고 All time을 선택했다. 총합634.5M/$5.57, App/Site 열별 값과 전체9개 기기 행을 확인했다. 참고 소스는 `web-common/src/features/dashboards/pivot/`, `runtime/metricsview/executor/executor_pivot.go`와 로컬 `docs/docs/guide/dashboards/explore/pivot.md`이다. 기간 라벨은 Rill 모델의 현재 날짜 이동을 반영하므로 날짜 필터 수치는 원본 독립 정답으로 검증한다. Rill 기본 설정을 저장하지 않았다.

현재 UI는 Rill의 좌측 필드·행/열 영역·상단 합계·지표별 열 구조를 따른다. 차이는 drag/drop 대신 선택/추가 버튼, tuple를 평탄하게 표시하는 방식과 문자열 오름차순이다. Rill의 계층 펼침/부분합·시간 grain 축·Flat 모드·총합 위치 변경·내보내기는 이번 단위에 포함하지 않는다. 이 차이를 전체 Pivot 동등성 PASS로 확대하지 않는다.

### Pivot 실행 기록

- 격리 API `127.0.0.1:4898`, FE `3698`, XHR 기록 프록시 `4899`와 정상 로그인 계정을 사용했다. 공식 auction Parquet 1,391,572행, 저장된 SUM/RATIO_SUM 지표를 재사용했다.
- **EXPLORE-14 PASS(선택 조건)**: Aside 실제 화면에서 device_type × app_or_site와 두 지표를 배치했다. 전체 요청634513000, 평균$5.57, App213275400/Site421237600으로 Rill All time 화면의 표시값과 일치했다. 전체 기간의 모든 존재 셀·행/열/총합 XHR도 직접 Parquet GROUP BY와 일치했고 비율5.571238676526892±1e-9을 확인했다.
- **EXPLORE-15 PASS**: API 응답의 모든 원본 존재 셀·행 합계·열 합계·총합을 제품 SQL builder를 사용하지 않는 직접 Parquet GROUP BY와 대조했다. 요청55127800, 비율2.934985272971758±1e-9, 이전 요청28263800. Aside 복원 화면과 XHR도 같은 조건·수치를 확인했다.
- **EXPLORE-16 PASS(단위/API/선택 화면)**: 실제 DuckDB 테스트11개에서 2+2/2+1 다중 축 tuple·셀/합계 매핑, NULL/빈 데이터 COUNT 0, 희소 조합, 이전-only, 비율·가중평균 재집계, 안전 정수 범위 밖 문자열과 50×20×6 경계를 검증했다. 실제 API의 소스409·소유권403·잘못된 축/추가 SQL/그룹 제한400을 확인했다. Aside에서 50행 초과 안내·이전 표 제거·축 변경 후201 복구, 축 교환과 App 행 클릭 필터 적용을 확인했다.
- **EXPLORE-17 PASS(선택 조건)**: Aside에서 `Rill Pivot UI` v2 보기 저장→새로고침→복원 후 축·두 지표·날짜·숫자 범위·이전 비교가 유지됐다. 기존 핵심 탐색 보기 E2E에 v2 Pivot 저장/복원을 추가해 1개 통과했다. FE의 지연 응답 차단·오류 복구 회귀30개와 BE v1/v2 저장 회귀17개가 통과했다.
- 전체 빠른 단위 검사: BE74 suites/1159개, FE45 files/706개 PASS. BE build·변경 BE lint, FE typecheck·변경 FE/E2E lint·build PASS. 최종 FE 수정 후 관련30개·type/lint/build를 다시 통과했다. 이후 테스트만 추가한 다중 축 회귀는 Pivot suite11개·lint PASS로 확인했다. 독립 코드 리뷰에서 중간 이상 결함은 없었고 저장 목록 중복과 빈 축의 두 번째 선택 슬롯을 보완했다.
- **NOT_RUN**: 전체 핵심8개/확장 QA·운영 부하·모바일 실제 화면·계층/시간 축 등 위에 명시한 미구현 parity. Aside REPL은 `setViewportSize`를 지원하지 않아 모바일 화면 검증으로 집계하지 않았다. 비교 시 원본 날짜와 Rill 날짜 이동 모델의 기간을 혼동하지 않는다.

증빙: `/tmp/vm-rill-pivot/api-oracle.json`, `whole-oracle.json`, `browser-xhr.jsonl`, `rill-pivot-reference.png`, `vm-pivot-all.png`, `vm-pivot-restored.png`, `vm-pivot-limit.txt`, `integration-test.log`, `frontend-build.log`, `fe-final.log`, `e2e/`. Aside 원본 캡처/스냅샷은 기존 세션의 artifacts에 보존한다.

## CSV 내보내기 — 2026-10-14 후속

탐색/Pivot 전환 아래의 `내보내기 ▾` → `CSV 다운로드`에서 현재 지표·차원/축·필터·기간·시간대·비교 조건을 서버에 전달한다. 서버는 클라이언트 표 데이터를 신뢰하지 않고 기존 조회/Pivot의 소유권·revision·구조화 지표·제한 계약으로 재집계한다. `POST /v1/bi/explore/export`의 엄격한 요청은 `{mode:'explore'|'pivot',query:<해당 조회 요청>}`다. 반환 JSON의 서버 CSV를 브라우저 Blob 다운로드로 저장하며 조건 변경/소스 전환/해제 후 늦은 응답은 다운로드하지 않는다.

첫 형식은 지표별 행 CSV다. 탐색은 KPI·현재/이전 추세·차원 순위(화면과 같은 상위20개), Pivot은 셀·행 합계·열 합계·총합을 포함한다. 조건 metadata 행도 함께 보존한다. 전체 원본 데이터·모든 차원 그룹 다운로드는 포함하지 않는다. `includeRows:true` 내보내기는 거절한다. 최대10,000행/2MiB(UTF-8 실제 byte)이며 제한을 넘으면 일부 CSV를 성공으로 반환하지 않는다. UTF-8 BOM·CRLF·인용부호 escaping을 사용하고 위험한 텍스트 수식 접두사를 보호한다. NULL은 빈 value와 `value_type=null`, 실제0은 `value_type=number`로 구별한다. 큰 정수 문자열은 반올림하지 않지만 스프레드시트 자동 타입 추론은 제품이 보장하지 않으므로 가져오기 시 문자열 타입을 사용한다.

| ID         | 기대 결과                                                                                                            | 실행 결과      |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | -------------- |
| EXPLORE-18 | Rill Device Type × App/Site CSV를 실제 다운로드. VM 전체 기간 셀/총합 CSV가 기존 독립 Parquet 정답과 일치            | 실행 기록 참조 |
| EXPLORE-19 | 저장한 v2 기간/범위/비교 조건으로 복원 후 CSV. 요청55127800·비율2.934985272971758±1e-9·이전28263800, 각 셀/합계 보존 | 실행 기록 참조 |
| EXPLORE-20 | 수식 텍스트·따옴표/쉼표/개행·NULL/0·큰 정수·행/byte 경계·권한/revision·추가SQL 거절                                  | 실행 기록 참조 |
| EXPLORE-21 | 탐색/Pivot 실제 다운로드 파일=서버 CSV, 조건 변경 후 지연 응답 차단, 오류 재시도·유효 결과 전 비활성                 | 실행 기록 참조 |

Rill `ExportMenu.svelte`와 `pivot-export.ts`는 현재 탐색 기간·필터·행/열·지표를 서버 export query에 전달한다. 실제 로컬 Pivot All time에서 CSV를 내려받아 `Device Type,App_Total Requests,App_Avg Bid Floor,Site_Total Requests,Site_Avg Bid Floor` 가로형 header와 9개 기기 행을 확인했다. VM 첫 형식은 지표별 세로 행·조건 metadata·합계를 포함한다. Rill 가로형 배열, Parquet/XLSX·원본 전체 export·예약 export는 이번 범위의 동등성으로 보고하지 않는다.

### CSV 실행 기록

- **EXPLORE-18 PASS(선택 조건)**: Rill 실제 다운로드의9행/18개 셀을 직접 Parquet 정답과 대조했다. VM 전체 기간 CSV의 모든 존재 셀·행/열 합계·총합도 같은 독립 정답과 일치했다. 평균/비율은 병렬 부동소수 집계의 차이를 고려해 ±1e-9로 대조하며 별도 집계 파일끼리 byte 동일성을 요구하지 않는다.
- **EXPLORE-19 PASS**: API CSV의 기간2023-09-10~11 UTC·bid_floor 1~9·이전 비교를 metadata에서 확인했다. 셀과 각 합계/총합의 독립 대조, 총 요청55127800·비율2.934985272971758±1e-9·이전28263800이 일치했다. Aside에서 기존 `Rill Pivot UI` 보기를 복원한 뒤 실제 `bi-pivot-7.csv` 68행을 다운로드해 같은 조건·정답을 확인했다.
- **EXPLORE-20 PASS(단위/API)**: serializer의 BOM·escaping·수식 텍스트·음수/큰 정수·NULL/0·행/byte 제한과 실제 DuckDB 조회 재사용 회귀12개가 통과했다. 실제 API에서 권한403, revision409, 추가SQL/알 수 없는 외부 필드/미지원 모드/원본 포함/그룹 제한400을 확인했다. 독립 리뷰의 음수 DECIMAL/지수 표기 문자열 보호 문제는 숫자 literal을 정확한 문자열로 보존하고 수식 텍스트는 계속 보호하도록 보완했다.
- **EXPLORE-21 PASS(선택 화면/E2E/단위)**: Aside에서 탐색 `bi-explore-7.csv` 56행과 Pivot 68행의 실제 파일을 각각 자신의 XHR CSV와 byte 단위로 확인했다. 그룹 제한 오류에서는 CSV 다운로드가 비활성이고 축 복구 후 활성화됐다. 기존 저장/복원 핵심 E2E에 탐색/Pivot 파일 다운로드→실제 파일 내용=서버 CSV 검증을 추가해1개 통과했다. FE9개는 성공/UTF-8 크기/비활성/재시도/409·실제 예외 envelope/지연 응답/해제/잘못된 응답을 검증했다.
- 전체 빠른 단위 검사: BE75 suites/1172개, FE46 files/715개 PASS. 변경 BE lint/build와 FE type/lint/build PASS. serializer의 DECIMAL 보완 뒤 관련13개·lint/build PASS를 다시 확인하고, 관련 변경이 없는 전체/E2E 증거는 재사용했다.
- **NOT_RUN**: 전체 핵심8개·확장 QA·모바일 화면·대표 운영 부하/동시성·10초 이상 export 및 XLSX/Parquet/원본 전체 다운로드. 공유 axios의10초 제한은 기존 조회와 같으며 장시간 export용 백그라운드 작업/스트리밍은 구현하지 않았다. 본 실행을 대규모 운영 지원이나 Rill 전체 export parity로 확대하지 않는다.

증빙: `/tmp/vm-rill-export/`의 `rill-pivot-export.csv`, `whole.csv`, `range.csv`, `explore.csv`, `aside-explore.csv`, `aside-pivot.csv`, `api-checks.json`, `browser-xhr.jsonl`, `integration-test.log`, `frontend-build.log`, `e2e/`, `vm-pivot-export-success.png`. Aside 성공/실패 캡처와 스냅샷은 기존 세션 artifacts에 보존한다.

## Pivot 행 계층·부분합·정렬 — 2026-10-14 후속

행 차원 2개에서 `행 계층`을 켜면 첫 차원의 상위 집계와 펼친 두 번째 차원의 하위 행을 표시한다. 개별/전체 펼침·접기는 표시 상태만 변경하고 집계를 다시 요청하지 않는다. 이름 또는 선택 지표의 현재 행 합계로 오름/내림차순을 선택한다. 상위 그룹은 자신의 원본 집계로 정렬하고 하위 행은 같은 그룹 안에서 정렬한다. NULL은 양방향 마지막, 값 동률은 이름 오름차순이며 큰 정수·DECIMAL 문자열을 Number로 반올림해 비교하지 않는다.

`POST /bi/explore/pivot`의 선택 필드는 `rowHierarchy:boolean`과 `rowSort:{by:'label'|'value',direction:'asc'|'desc',measureId?}`다. 생략 시 계층 없이 이름 오름차순이다. 제공한 sort 객체는 by/direction이 필수이며 value는 선택 지표 ID, label은 measureId 없는 형식만 허용한다. `rowSubtotals`의 상위 합계와 상위×열 셀은 현재/이전 기간 원본에서 각각 재집계한다. 비율/가중 평균을 하위 결과의 합으로 계산하지 않는다. 50행/20열/6개 지표 제한은 유지하고 상위 그룹도 6,000개 값 예산에 포함해 초과 시 거절한다.

v3 개인 보기는 계층·정렬·펼친 상위 tuple까지 저장하며 v1/v2 계약을 유지한다. 펼침 키는 NULL과 문자열 "null"을 구별한다. 같은 보기를 연속 복원해도 새 집계와 내보내기 준비 상태를 복구한다. CSV는 펼침 상태와 무관하게 전체 제한된 계층 결과를 포함하고 `subtotal_cell`/`subtotal_total` 및 조건 metadata를 추가한다. 쿼리/export에 `expandedRows`를 보내면 거절한다.

| ID         | 입력/기대 결과                                                                                                                   | 검증                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| EXPLORE-22 | All time, device_type→app_or_site, 두 지표, 요청 내림차순. Mobile/Tablet307763000/$5.66, Site202863400/$5.62, App104899600/$5.73 | 실제 Rill/VM 화면·CSV·독립 원본 대조 |
| EXPLORE-23 | 기간2023-09-10~11 UTC, bid_floor1~9, 이전 비교, device_os 열. 상위·상위×열·하위 셀·총합은 각각 원본 GROUP BY와 일치              | 실제 API·DuckDB 단위                 |
| EXPLORE-24 | NULL/큰 정수·비율/가중 평균·정렬/동률·상위 포함 제한, malformed sort/SQL/expandedRows·권한/revision 거절                         | 단위·실제 API                        |
| EXPLORE-25 | v3 저장→새로고침→복원·동일 보기 재복원, v1/v2 호환, 계층 CSV 실제 파일=자신의 서버 CSV                                           | 실제 화면·핵심 E2E·단위              |

### Rill 비교와 실행 기록

Rill 공식 auction 데모의 실제 Pivot에서 All time, 행 Device Type→App or Site, Total Requests/Avg Bid Floor를 배치했다. Total Requests 헤더 클릭으로 ASC/DESC와 상위/하위 순서를 확인했다. Mobile/Tablet을 펼친 화면의 상위307.8M/$5.66, Site202.9M/$5.62, App104.9M/$5.73과 VM 표시가 일치한다. Rill 실제 CSV `Device Type,App or Site,Total Requests,Avg Bid Floor`의18개 하위 그룹 모두 원본 Parquet와 일치했다. VM18개 하위·9개 상위 및 전체 총합도 같은 독립 정답으로 검증했다. 요청 수는 정확 비교, 비율은 ±1e-9다. 원본 날짜와 Rill의 현재로 이동한 날짜는 다르므로 기간 비교 수치는 원본 직접 SQL로만 판정했다.

Rill 소스 `pivot-expansion.ts`, `pivot-utils.ts`, `pivot-export.ts`, `toProto.ts`도 대조했다. Rill은 다단계 nested subRows와 셀/변화 지표 정렬, 행 한도 선택을 지원한다. 상위 집계 행을 VM에서는 `부분합`으로 표시하며 평균/비율 재집계 의미를 맞췄다. VM의 펼침 상태 저장은 Rill URL/proto가 보존하지 않는 추가 동작이다. Rill 가로형 export와 VM 지표별 행·부분합/metadata CSV는 형식이 다르다.

- **PASS API/숫자**: 격리 API4898, FE3698, 기록 프록시4899, 공식 Parquet1,391,572행의 기존 source7을 재사용했다. 전체/기간·필터·이전 비교의 상위/상위×device_os/하위 셀/총합과 ASC/DESC, malformed sort/추가 SQL/expandedRows400, 소스409·소유권403·50행 초과400, 부분합 CSV를 확인했다.
- **PASS 실제 화면/파일(선택 범위)**: 앱 내 브라우저에서 Rill 계층·ASC/DESC·CSV와 VM 계층·v3 저장→재로드→펼침 복원을 확인했다. VM 실제 `bi-pivot-7 (1).csv`는 해당 XHR CSV와 byte 단위로 일치하며 부분합 섹션을 포함한다. 초기 Aside CDP 연결 지연 뒤 새 연결로 복구해 저장된 `Rill 행 계층` v3의 두 축·요청 내림차순·Mobile/Tablet 펼침과 같은 수치를 Aside 실제 화면에서도 확인하고 캡처했다. 전체 펼침/접기와 오름차순 전환도 실제 화면으로 확인했다. 기존 사용자 보기와 세션 데이터는 보존했다. 다운로드 도구 응답은 장시간 지연되어 브라우저 검증 세션을 다시 연결했으며 제품 export API의 지연으로 판정하지 않는다.
- **PASS 통합**: 전체 빠른 단위 BE75 suites/1191개·FE46 files/722개, 루트 build, 변경 BE lint·FE type/lint 통과. 마지막 동일 보기 재복원/부분합 누락 fallback 회귀 추가 뒤 관련 FE39개·type/lint 통과. E2E 초기 실행은 Playwright 브라우저 미설치로 시작하지 못했고 공식 Chromium 설치 후 기존 저장/복원 핵심1개가 v1/v2/v3·실제 CSV 비교까지 통과했다. E2E의 non-null assertion 경고3개와 기존 canvas/act 경고는 실패가 아니다.
- **NOT_RUN/남은 차이**: 전체 핵심8개·확장 QA·운영 부하·모바일/전체 접근성. 3단계 이상 계층, 시간 grain 축, 셀/변화 지표 정렬, drag/drop, Rill Flat 전환/총합 위치/행 한도·리사이즈와 가로형 CSV/XLSX/Parquet는 후속이다. 이번 결과를 Rill 전체 Pivot 동등성으로 확대하지 않는다.

증빙: `/tmp/vm-rill-hierarchy/`의 `api-oracle.json`, `api-export.json`, `rill-hierarchy.csv`, `rill-expanded.jpg/.txt`, `vm-expanded.jpg/.txt`, `vm-hierarchy.csv`, `browser-xhr.json`, `aside-hierarchy-restored.png/.txt`, `integration-test.log`, `build.log`, `fe-final.log`, `e2e/`와 `e2e.log`. 실제 브라우저 XHR은 `/tmp/vm-rill-views/browser-xhr.jsonl`에 보존한다.

## Pivot 시간 축·셀·변화 정렬 — 2026-10-14 후속

배치한 날짜 열 하나를 `timeAxis:{column,grain:'day'|'week'|'month',timeZone}`로 묶는다. 행 또는 열 축에 배치한 실제 temporal 열만 허용하며, 기간이 있으면 기간과 같은 시간대가 필수다. 결과 tuple은 해당 지역의 버킷 시작일 `YYYY-MM-DD`, 주 시작은 월요일이다. DATE는 지역 변환 없이 달력 날짜로 처리하고 TIMESTAMP는 UTC 저장 시점에서 지역 시점으로 변환한다. 축 이름은 원본 열 이름을 유지한다. 50행/20열/6개 지표·부분합을 포함한 6,000개 값 한도는 유지한다.

비교 기간의 원본 행을 현재 기간 시작에 맞게 이동한 뒤 버킷으로 묶는다. 날짜 레이블 기간은 지역 시점에서 시작일 간 달력 일수만큼 이동하므로 DST의 23/25시간 하루를 보존한다. timestamp precision 기간은 UTC 시점 차이만큼 이동한 뒤 지역 버킷을 계산한다. 원본 조회 필터는 이전 기간에 적용하고 이동한 레이블로 현재/이전 셀을 결합한다. 이전에만 존재하는 tuple도 포함하고 누락된 셀은 NULL이다.

`rowSort.by`는 `label|value|delta|percentChange`다. metric 정렬은 선택한 `measureId`가 필수이며, 선택적 `columnTuple`이 없으면 행 합계, 있으면 정확한 해당 열의 셀로 정렬한다. 부모는 부모×열 원본 집계, 자식은 자신의 셀을 사용한다. 변화 정렬은 명시적 기간과 이전 비교가 필요하다. 존재하지 않는/차원 수가 다른 tuple은 400이며 빈 결과의 오래된 선택도 거절한다. NULL은 양방향 마지막, 동률은 이름 오름차순이다. 큰 정수 현재값은 기존 정밀도 비교를 유지하고 안전하게 계산할 수 없는 변화값은 NULL이다.

UI는 시간 축 켜기·날짜 열·일/주/월 선택, 지표 헤더 셀 클릭, 행 합계/특정 열 범위, 현재값/변화량/변화율과 양방향 정렬을 제공한다. 비교 해제·지표 제거·축/기간/시간대/필터 변경으로 부적합해진 정렬은 현재값·행 합계 또는 이름으로 복구한다. v4 보기는 시간 축과 셀/변화 정렬을 저장하며 v1~v3 strict 계약을 유지한다. CSV는 같은 구조화 요청을 재집계하고 timeAxis/columnTuple 조건을 포함하며 펼침 키를 쿼리로 전송하지 않는다.

| ID         | 입력/기대 결과                                                                                 | 검증                        |
| ---------- | ---------------------------------------------------------------------------------------------- | --------------------------- |
| EXPLORE-26 | 공식 Parquet, UTC/LA 일·주·월 버킷, 각 셀/비율 및 총합을 독립 원본 SQL과 대조                  | 실제 API·DuckDB 단위        |
| EXPLORE-27 | 시간 셀 현재값·변화량·변화율 ASC/DESC, 부모/자식 자신의 집계, 이전 레이블 정렬·NULL/정밀도·DST | 실제 API·DuckDB 단위        |
| EXPLORE-28 | v4 저장→재로드→복원→실제 CSV 파일, v1~v3 기존 흐름 유지                                        | 핵심 E2E·단위·선택 화면/XHR |
| EXPLORE-29 | 시간 열/zone/grain/tuple/비교 조건 strict 거절, stale 셀/비교 해제 복구                        | 단위·실제 API·선택 화면     |

### Rill 대조 범위와 의도된 차이

로컬 Rill `dd080fc7`의 `pivot-queries.ts`, `pivot-data-config.ts`, `pivot-utils.ts`, `pivot-column-definition.ts` 및 runtime `metricsview/ast.go`를 대조했다. 실제 Rill Pivot에서 Time 열의 주→일 전환, 날짜 지표 헤더 셀 정렬, 2일 기간/이전 기간 비교와 Δ/Δ% 표시 및 변화율 헤더 정렬을 실행했다. Rill은 기간에 따라 허용 grain과 기본 grain을 선택하며 더 많은 시간 단위를 지원한다. VM은 기존 일/주/월 계약으로 제한한다.

Rill의 `auction_data_model.sql`은 `CURRENT_TIMESTAMP - max_time`만큼 원본 시점을 이동하므로 날짜뿐 아니라 하루 내부 시점도 다르다. 같은 화면 날짜가 같은 원본 레코드를 뜻하지 않으므로 Rill 기간 셀의 수치/순서와 VM 원본 날짜 셀을 직접 같다고 판정하지 않았다. 동일한 공식 Parquet의 VM 수치는 독립 원본 SQL로 확인했다. Rill 화면은 조작·배치·비교 표시를 검증한 증거이며 전체 수치 동등성 증거가 아니다.

Rill은 metrics view의 최소 grain 기준 DATEDIFF/interval로 이전 버킷을 이동한다. VM은 기존 기간 계약의 달력 일수 또는 timestamp span을 보존하므로 DST/월 경계에서 완전 동등하지 않다. VM 변화율은 기존 KPI/추세/순위와 같은 `(현재-이전)/abs(이전)*100`의 퍼센트 값이며 Rill은 signed denominator의 fraction을 formatter로 퍼센트 표시한다. 양수 이전값의 표시/순서는 같지만 음수 이전값에서는 부호 의미가 다르다. 이 기존 정의를 이번 Pivot만 바꾸지 않았다. VM은 각 셀 안에 비교 요약을 표시하며 Rill처럼 Δ/Δ%를 각각 별도 열로 펼치지는 않는다.

증빙: `/tmp/vm-rill-time/api-oracle.json`, `rill-time-percent.png/.txt`, `e2e.log`, `e2e/`, `integration-test.log`, `build.log`. 실제 VM 요청/응답은 `/tmp/vm-rill-views/browser-xhr.jsonl`에 보존한다.

### 실행 결과

- **PASS — 서버/원본 대조**: BE 75 suites / 1,212 tests, Pivot·CSV 관련 49 tests. 공식 Parquet 1,391,572행의 UTC/LA 일·주·월, 각 셀의 SUM/비율, 현재/이전 버킷과 셀 정렬을 독립 DuckDB SQL과 대조했다. 봄 DST 전환의 달력 이동과 UTC timestamp 이동은 별도 회귀로 확인했다.
- **PASS — 실제 Aside/XHR**: 원본 `2023-09-10~11`, UTC, `device_type × __time`의 9행×2열에서 9월 11일 Total Requests 셀의 현재값·변화량·변화율 오름차순이 응답 점수와 일치했다. 총합 181,853,400, 9월 11일 91,805,200 / 이전 87,188,000 / 변화 4,617,200이다. 개인 v4 보기 `Rill 시간 Pivot`을 새로 저장하고 복원했다. 기존 사용자 보기와 소스는 유지했다. 정렬 증빙은 `/tmp/vm-rill-time/aside-sort-xhr.json`이다.
- **PASS — 실제 파일**: 선택 핵심 `explore-views.spec.ts`에서 v1~v4 저장→새로고침→복원→CSV 파일 다운로드→자체 생성 보기 삭제가 통과했다. 내려받은 CSV 파일의 바이트를 서버 응답과 대조했다.
- **PASS — 오래된 셀 복구**: 시간 집계 일→월 전환은 첫 요청에서 `columnTuple`을 해제하여 9행×1열을 표시한다. 기간을 9월 12~13일로 바꿔 이전 셀이 사라진 경우 실제 서버 400 이후 셀 범위를 해제한 행 합계 요청이 201로 복구됐다. 다른 오류는 기존 도움 흐름을 유지한다. 정확한 오류 메시지에 의존하는 복구 분기는 서버 문구 변경 시 함께 갱신해야 하며 실제 예외 envelope 회귀를 포함한다. `/tmp/vm-rill-time/aside-recovery-xhr.json`, `aside-sort-desc-xhr.json`과 `vm-time-pivot-viewport.png/.txt`에 기록했다. 변화량 내림차순도 실제 XHR 점수와 일치했다.
- **PASS — 통합 점검**: FE 전체 46 files / 735 tests, BE/FE 빌드, FE 타입 검사, 변경 파일 린트(오류 0; E2E non-null assertion 경고 4개), 공백 검사와 추가 셀 복구 회귀를 포함한 화면 단위 50개가 통과했다. 선택 E2E 최종 실행은 1개 / 9.4초 통과다. 로그는 `frontend-test-final.log`, `fe-target-final.log`, `type-fe-final.log`, `lint-fe-production-final.log`, `lint-fe-test-final.log`, `frontend-build-final.log`, `e2e-final.log`다.
- **NOT_RUN**: 핵심 E2E 전체 8개, 확장 QA, 모바일/운영 검증, 가을 DST 및 주·월 경계의 DST 회귀. Rill의 이동된 기간과 VM 원본 기간의 셀 수치 동등성은 검증 범위에서 제외했다.

## Pivot 컨트롤·셀 레이아웃 — 2026-10-14 후속

기능 상태와 API 계약은 유지하고 차원/시간/정렬 컨트롤의 높이·폰트·간격, 선택 상태, 좁은 화면 필드 목록 높이와 비교값 셀의 줄바꿈을 정리했다. Rill의 조밀한 축/보기 컨트롤과 현재값·변화값 구분을 실제 화면에서 대조했다. 이번 변경은 Rill 디자인 전체 동등성 또는 Flat 구현 완료가 아니다.

- 기준은 공식 Parquet 소스7, 보기 `Rill 시간 Pivot`의 UTC 2023-09-10~11, device_type × \_\_time(day), 두 지표, 이전 기간 비교다. 총합181,853,400을 유지한다. 변경 전/후 Chromium 1440×900·390×844 화면과 Aside 실제 화면을 남긴다. Aside의 viewport 변경 API는 지원되지 않아 390px는 문서의 기존 Playwright 대체 경로를 사용한다.
- 변경 전에는 축 컨트롤의 Stack margin과 gap이 겹쳐 모바일 줄바꿈 들여쓰기가 달랐다. 비교 정렬의 aria-pressed는 true이지만 배경은 투명했다. 비교 요약이 nowrap 셀을 넓혔다. 변경 후에는 gap을 단일 기준으로 사용하고 선택 배경/테두리를 표시하며 보조 비교값을 줄바꿈한다. 필드 목록은 좁은 화면에서 높이를 제한하고 자체 스크롤한다.
- Rill 실제 Flat 전환은 시간·기기 차원을 각각 행 레코드의 필드로 펼쳐 18개 레코드를 표시했다. VM의 `rowHierarchy=false`는 기존 행 tuple과 열 축을 유지한다. 두 기능을 같은 것으로 부르지 않는다. 실제 Flat, 별도 Δ/Δ% 열, drag/drop·리사이즈·총합 위치·행 한도 선택은 후속이다. Rill 1280×720 화면은 구조·밀도 참조이며 VM 1440×900의 픽셀 단위 동일성 판정이 아니다.

증빙: `/tmp/vm-rill-layout/`의 `baseline.md`, 변경 전/후 화면, geometry JSON, 실제 Aside 화면과 단위/타입 로그. 기존 API/독립 원본 집계 검증은 집계 구현 변경이 없어 재사용한다. 전체 E2E, BE 재검사, 오류/빈 결과/로딩 상태의 새 디자인 검증과 전체 키보드·스크린리더 검증은 NOT_RUN이다.

### 이번 실행 결과

- **PASS — 기능**: Explore 관련4파일/94테스트, FE 타입·변경 파일 린트, 저장 보기25 복원/총합181,853,400, 변화율 선택·월 집계 시 셀 범위 초기화, 계층 보기16의 모두 펼침/접기. 실제 Aside에서 변화량 내림차순과 총합·9행×2열을 다시 확인했다. 저장 상태/API/집계 정의를 수정하지 않았다.
- **PASS — 관찰한 디자인 범위**: 1440×900·390×844에서 문서 폭은 뷰포트와 같고 표 가로 스크롤은 결과 영역 내부에 유지된다. 선택 필드는32px/13px, 모바일 이름 필드는332px로 같은 왼쪽29px에 정렬되어 `video_max_duration_bucket`도 잘리지 않는다. Aside 선택 버튼은32px/13px이고 선택 배경이 표시된다. 첫 수치 셀은257.25px→180px, 표 scrollWidth는1314px→1260px로 줄었으며 비교 요약과 단위를 읽을 수 있다. 큰 수치·기기 이름·선택/비활성 상태를 캡처했다. 시간 컨트롤이 데스크톱에서 두 줄로 늘어나는 중간 회귀도 수정 후 재확인했다.
- **NOT_RUN — 확대 범위**: 모든 뷰포트·전체 Rill 디자인 동등성, 전체 E2E·빌드·BE 재검사, 새 오류/빈 결과/로딩 화면과 전체 접근성. 스타일만 변경하여 기존 집계·다운로드·저장 API 결과를 재사용한다. 실제 Flat은 미구현이다.

## Pivot Flat 보기 — 2026-10-14 후속

### 계약·Rill 대조

Flat은 계층 끄기와 구분한다. 서버는 선택한 열 차원 뒤에 행 차원을 붙인 결합 차원으로 다시 집계하고, 화면은 각 차원을 독립 열로 표시한다. 원래 두 축 선택은 보존하여 Pivot 전환 시 복원한다. 현재값·변화량·변화율 정렬은 각 결합 레코드의 값을 기준으로 전체에 적용한다. 계층 부분합·펼침·특정 Pivot 열 셀 범위는 Flat에서 사용하지 않는다. 평균/비율과 총합은 원본 재집계 의미를 유지한다.

기존 제한은 각 선택 축2개·지표6개, 결합 레코드50개다. 50개를 넘으면 필터 또는 축 축소 안내로 거절하며 임의 상위50개로 잘라 성공하지 않는다. 원본 명칭·NULL·이전 기간만 존재하는 조합은 기존 집계 계약을 유지한다. Flat 요청과 CSV 조건에는 `tableMode=flat`을 담는다. 개인 보기 v5는 tableMode와 기존 v4 기간/시간 축/정렬을 저장하고 v1~v4는 기존 Pivot으로 복원한다.

Rill 로컬 소스의 `pivot-data-config.ts` isFlat 분기와 `pivot-data-assembly.ts`의 assembleFlatPivotRows를 참고했다. 실제 Rill에서 Device Type × Time Day를 Flat으로 전환하면 Time day·Device Type·Total Requests 열과18개 레코드를 표시했다. Δ% 헤더 클릭으로 DESC/ASC 전체 레코드 순서를 바꾸는 것을 확인했다. `/tmp/vm-rill-flat/rill-flat.png`, `rill-flat-percent.png`를 남겼다. Rill 원본 시점 이동 때문에 화면 날짜/셀값의 직접 동일성을 주장하지 않고 VM 수치는 같은 공식 Parquet의 독립 원본 SQL과 비교한다. VM은 기존 비교 요약을 셀 안에 표시하고, Rill의 별도 Δ/Δ% 열·개별 차원 열 정렬·All 행 한도는 후속이다.

### 실행 증거와 검증 범위

- **PASS — 독립 원본/API**: `/tmp/vm-rill-flat/check-api.cjs`, `api-oracle.json`. 공식 1,391,572행 Parquet에서 UTC 2023-09-10~11의 시간×기기 18개 레코드·181,853,400 요청·각 가중평균·이전 값을 직접 SQL로 계산하여 API와 대조했다. 현재값/변화량/변화율 × ASC/DESC 6조합, 네 차원 필터 결과(Connected Device 총합 1,600), 50조합 초과/잘못된 모드/계층·셀 범위의 400 거절, CSV 조건을 확인했다.
- **PASS — 실제 화면/XHR**: Aside에서 기존 v4 보기 25를 열어 Flat 18개 레코드·별도 시간/기기 열·변화율 순서·전체 총합을 확인했다. `/tmp/vm-rill-flat/aside-flat-final.png`, `/tmp/vm-rill-views/browser-xhr.jsonl`. Playwright 브라우저의 `ui-results.json`은 Flat 정렬 및 Pivot 복귀 XHR 201과 원래 열 축 유지, 페이지 오류 0건을 기록한다.
- **PASS — 디자인 선택 검증**: 1440×900 및 390×844에서 페이지 너비는 각각 1440/390px, 결과 영역은 1126/358px이다. 390px의 720px 표는 결과 영역 내부 가로 스크롤을 사용한다. 모드 버튼 높이32px/폰트13px/선택 표시를 확인했다. 데스크톱 차원·숫자 정렬과 비교 요약, 390px 첫 로드의 차원 열/헤더를 실제 캡처로 확인했다. 리사이즈 직후 캡처의 빈 영역은 390px 첫 로드로 재확인해 정상 렌더를 확인했다. `vm-flat-1440.png`, `vm-flat-fresh-390.png`은 저장소 밖 같은 증빙 폴더에 있다.
- **PASS — 핵심 저장 E2E**: `explore-views.spec.ts` 1개. 기존 v1~v4 흐름에 v5 Flat 저장→실제 재로드→복원→CSV 다운로드·응답 바이트 대조→자기 보기 삭제→원래 축으로 Pivot 복귀를 추가했다. 빈 조합을 생성하지 않는 3개 실제 레코드 및 총합600을 확인했다. `/tmp/vm-rill-flat/e2e`.
- **PASS — 서버 검사**: BI 8 suites/159 tests, 관련 Pivot/보기/CSV 3 suites/88 tests, Nest 빌드와 변경 파일 ESLint. 새 검사는 이전 기간에만 있는 조합/NULL·희소 조합·정렬·총합·축 없는 Flat·v5 엄격 검증과 시간 축 카탈로그 검증을 포함한다.
- **PASS — 프런트 검사**: Explore 관련 4파일/103 tests, 프런트 타입 검사·변경 파일 ESLint·Vite 빌드. 핵심 E2E ESLint는 오류0/기존 방식의 non-null assertion 경고5건이다. Vite 빌드는 기존 TUI Grid CSS와 구성 로더 안내를 출력하며 성공했다.
- **PASS — 좁은 화면 보완**: 가로 스크롤에서 첫 날짜 차원이 지표 값을 덮는 문제를 실제 캡처로 발견하고 Flat 첫 차원 고정을 제거했다. 재캡처 `vm-flat-390-measures.png`에서 요청 수/가중평균 헤더와 각 값·비교 요약을 확인했다.
- **PASS — 마지막 의미/리뷰 보완**: 축 없는 Flat은 총합 한 행만 표시하며 v5 Flat의 계층/펼침/셀 범위 모순을 프런트 복원 검사에서도 거절한다. 시간 버킷은 원본 단일 값으로 필터하지 않도록 일반 텍스트로 표시한다. 추가 단위3개(관련 전체103개)와 최종 저장 E2E를 통과했다. `check-ui-final.cjs` 실제 차원 클릭으로 Personal Computer 두 날짜 레코드·총합47,266,000 및 버킷 필터 버튼 부재를 확인했다. 읽기 전용 정적 리뷰의 총합 중복/프런트 검사 비대칭을 해소했으며, 향후 오류 코드 개선은 현재 자동 셀 범위 제거 계약에서 비차단이다. 버킷 전체 클릭 필터는 별도 후속이다.
- **NOT_RUN**: 관련 없는 전체 핵심 8개/확장 QA, 운영 배포·외부 엔진·대규모 동시 요청. Rill 이동 날짜와 원본 날짜의 차이로 두 실행 앱의 수치 동일성은 주장하지 않는다. 위 독립 원본 대조와 UI 동작 비교를 구분한다.

## Pivot 표시 방식·디자인 개선 — 2026-10-14 후속

사용자 우선순위에 따라 Pivot/Flat을 하나의 표시 방식 선택 그룹으로 묶고, 행 계층·시간 축은 다음 행에 분리했다. 현재 모드의 설명을 표시하며 버튼 높이32px·폰트13px를 통일했다. 표 숫자는 tabular-nums를 사용하고 정렬 헤더는 수치 열의 오른쪽 정렬을 상속하며 전체 폭을 클릭 영역으로 사용한다. 표 버튼의 키보드 포커스 테두리도 추가했다. 집계·정렬·저장·CSV 계약은 수정하지 않았다.

- **PASS — 기능/정적 검사**: SourceExplore 단위59개, FE 타입 검사·변경 파일 ESLint·공백 검사. Aside에서 공식 소스7의 Pivot→Flat→Pivot 전환, Flat의 계층 비활성화 및 원래 축 복원, device_type/app_or_site 계층의9개 부모 부분합을 확인했다. 전체 기간 총합634,513,000/$5.57은 유지된다. device_os 두 번째 축의50조합 초과 안내도 유지된다.
- **PASS — 관찰한 디자인**: 1440×900에서 보기 그룹과 계층/시간/정렬 행의 배치, 선택·비활성 상태 및 숫자 정렬을 캡처했다. 390×844에서 모드 버튼32px/13px, 설명·컨트롤 줄바꿈과 표 내부 가로 스크롤을 확인했다. innerWidth390px/document scrollWidth375px로 페이지 가로 넘침이 없다. 키보드 Tab으로 Avg Bid Floor 헤더에 이동했을 때2px 파란 포커스 테두리/offset2px/minHeight24px를 확인했다. 좁은 화면은 Codex 브라우저 viewport로 검증하고 임시 설정을 복구했다.
- **PASS — Rill UI 대조**: 같은1440×900에서 실제 Rill Pivot/Flat 선택 그룹과 차원·지표 열 배치를 비교했다. 동일 공식 원본의 전체 기간 총합 표시634.5M/$5.57을 확인했다. VM은 원래 축을 유지하고 별도 계층/시간 컨트롤을 제공하며 Rill은 Flat 전환 시 차원을 열 배치로 이동한다. VM의 더 넓은 수직 간격과 기본 정렬 차이는 남아 있으며 픽셀 단위 디자인 동등성을 주장하지 않는다. Rill 시점 이동/시간대 차이 때문에 이번 검증은 기간 버킷 수치 비교가 아니다.
- **NOT_RUN**: 전체 E2E·BE 재검사·빌드, 새 XHR 수집, 전체 접근성 및 모든 화면 폭. 프런트 스타일/레이아웃 변경에 맞춰 기존 수치·저장·CSV 검증을 재사용했다.

증빙은 저장소 밖 `/tmp/vm-pivot-design/`의 nest/flat/hierarchy-1440.png, flat-390.png, header-focus-390.png, rill-nest/flat-1440.png 및 receipt.json이다. 기존 검증 스킬의 크기·높이·정렬·폰트·좁은 화면 기준을 적용했다.

### 버튼 밀도 재조정 — 사용자 피드백

직전 디자인 PASS는 크기·줄바꿈의 관찰 결과였으며 사용자가 기대한 조밀함을 충분히 충족하지 못했다. 공통 테마의 좌우14px 여백·짙은 비활성 배경과 SourceExplore의 최소 높이32px가 Pivot에도 적용됐다. Pivot 내부 MUI 버튼에만 높이/최소 높이28px·폰트12px·좌우8px·radius4px를 적용하고 비활성 배경을 투명하게 조정했다. 모드·계층·정렬·필드 추가 버튼을 함께 조정하여 주변 요소의 밀도를 맞춘다. 입력 크기와 다른 화면의 공통 테마는 유지한다.

- **PASS**: Aside 1440×900 실제 캡처와 높이28px/폰트12px/좌우8px 측정, Codex 브라우저390×844 Flat 선택/계층 비활성 및 줄바꿈 캡처, FE 타입·변경 파일 린트·공백 검사. 총합634,513,000/$5.57 유지.
- **NOT_RUN**: 집계·저장 로직을 변경하지 않아 직전 단위59개와 저장/API 검증을 재사용하며 전체 테스트·E2E·빌드는 반복하지 않았다. 전체 접근성 및 Rill 픽셀 동등성은 미검증이다.

증빙: `/tmp/vm-pivot-design/compact-1440.png`, `compact-390.png`.
