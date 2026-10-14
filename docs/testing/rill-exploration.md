# Rill 기준 동적 지표 탐색

## 구현 범위

SQL 없는 제작 화면(`/explore`)에서 저장한 지표를 별도 탐색 화면(`/explore/source?sourceId=...`)에서 선택한다. 서버의 소유권·지표 정의·소스 버전을 사용하며 클라이언트 SQL을 실행하지 않는다. 이번 단위는 Measure/Dimension 선택, 검색 가능한 값 필터, 기간/시간대/비교, KPI·추세·차원 순위·페이지 단위 원본 행이다. 숫자 범위 필터와 현재 값/변화량/증감률 정렬의 추가 구현·검증은 [범위·정렬 후속](explore-range-sort.md)을 참조한다. 탐색 개인 상태 저장·복원의 구현/선택 검증은 [저장 보기 후속](explore-saved-views.md)을 참조한다. Pivot, 내보내기와 운영 규모 부하는 후속 구현 항목이다.

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

### 숫자 표시 후속 — 2026-10-14

[밀도·숫자표시 검증](compact-controls-formatting.md)에서 저장compact/plain의 KPI·차원순위·추세/비교 연결, exact table·unsafe원문 보존과1440/390 화면을 검증했다. 이번 변경에 영향받는 EXPLORE-01/08 표시 조건만 확인했으며 카탈로그 전체를 새로 완료 처리하지 않는다. 기존 수치 oracle 재사용·API634513000/307763000·Rill635M/308M 표시 유지. 기간메뉴/축/내부스크롤과 후속 기능 차이는 남아있다.

### 숫자 범위·변화 정렬 후속 — 2026-10-14

[explore-range-sort.md](explore-range-sort.md)의 RANGE-01~03/SORT-01~02/RANGE-KEY-01 선택 조건을 검증했다. 같은 원본 날짜의 Rill 파생 범위 모델·독립SQL과 실제 UI XHR 집계/여섯 정렬을 대조했다. BE267/FE19, 타입·lint·build와1440/390·키보드 선택 조건 PASS. Rill 범위 입력 UI·표시 정밀도·시간별 곡선 차이는 구분해 기록했다. 위 과거 기록의 숫자범위/변화정렬 후속 항목은 이번 범위에서 구현되었으며 Pivot/탐색보기 저장·VoiceOver는 남아있다.

### 탐색 개인 저장 보기 후속 — 2026-10-14

[explore-saved-views.md](explore-saved-views.md)에서 EXP-VIEW-01~07의 하위·선택 실제 화면을 기록했다. Aside 이름 저장/새로고침 복원, 새 브라우저 세션·1440/390·키보드 저장/삭제/초점·load503/실제 지표 정의409와 복구를 확인했다. Rill의 동일 기간/비교/증감률 asc URL도 새로고침 후 유지되며 VM 복원 결과는 같은 독립 oracle와 일치했다. BE55/FE28 및 타입/lint/build PASS. 과거 탐색 상태 저장 잔여는 이번 개인·절대기간 범위로 보강됐고 Pivot/내보내기/팀·URL 공유/실제 새 파일 게시 복원/MySQL 실통합/VoiceOver는 남아 있다.

## 2026-10-14 Pivot 첫 범위 보강

[explore-pivot.md](explore-pivot.md) PIVOT-01~05의 선택 조건을 검증했다. 행1~2/열0~1/지표1~6, 공통필터/기간·축교환·행/열필터·전체합계·모바일/키보드를 지원한다. 같은Rill원본9×2/17실제셀·모든합계 독립SQL일치, Rill표시값·실제UI비교. BE13/PivotFE6·전환1·타입/lint/build PASS. 이전Pivot미구현기록은이첫범위로보강됐으며시간축/계층/이전기간/저장/공유/내보내기/운영부하는후속이다. VoiceOverBLOCKED·gpt-6-luna유지/호출0.
