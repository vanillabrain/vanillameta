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
