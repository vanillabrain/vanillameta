# 셀프서비스 BI 2A — 프로파일·지표·SQL 없는 제작

기준: develop-v2의 `9f74f8be` 이후 변경, 2026-10-13. 기존 통과 케이스는 반복하지 않았다. `$vanillameta-verify`의 선택 검증을 사용한다. 이 문서의 선택 조건 통과를 전체 SSBI 계획 완료로 확대하지 않는다.

## 구현 계약

- 첫 화면의 **SQL 없이 차트 만들기**, 또는 내 파일 선택 → 동일 버튼 → 서버 저장 → 새 소스가 선택된 제작 화면.
- 서버 DuckDB `uploaded_data` 파일만 지원한다. 소유권을 캐시 조회보다 먼저 확인한다. 기존 메타데이터 DB·서버 워커를 재사용한다.
- 전체 행 수·열 타입·NULL 수·DATE/TIMESTAMP 최소/최대는 전체 저장 데이터를 집계한다. 원본 미리보기는 처음 최대 5행이며 표본임을 표시한다. 최대 128열, 프로파일 캐시 최대 50소스.
- 지표: SUM/COUNT/COUNT_DISTINCT/AVG/MIN/MAX, 열·단위·소수 0~6자리·일반/축약 표시. SUM/AVG/MIN/MAX는 숫자 열만 허용한다. COUNT는 NULL을 포함한 행 수, 다른 집계는 SQL NULL 규칙을 따른다.
- 구조화 지표는 불변 version 1이다. 바꾸려면 새 정의로 저장한다. 기존 메트릭 API로 정의 주입·덮어쓰기·삭제된 정의 재활성화를 차단한다. 같은 표시 이름을 다시 사용할 수 있다.
- 숫자/범주 막대/날짜 선 차트를 미리보고 정확값 표로도 확인한다. SQL은 서버가 식별자와 집계 목록을 제한해 생성한다. 범주·날짜는 최대 500그룹이다. 전체 결과라고 과장하지 않는다.
- 저장은 기존 대시보드 트랜잭션을 사용한다. 지표 정의·정의 버전·소스 revision·차트/분류 snapshot을 함께 저장한다. 지표를 삭제해도 이미 저장한 SQL/대시보드는 유지한다. 원본 파일을 삭제해도 실행 가능하다는 뜻은 아니다.
- `dataVersion`은 소스 ID/메타데이터 생성·수정 시각의 revision hash이며 파일 내용 hash나 과거 데이터 보존 기능이 아니다. 파일 불변 저장 계약을 전제로 한다. 기존 SQL/AI로 정의를 교체하면 구조화 snapshot을 비워 오래된 계보를 표시하지 않는다.
- 기존 nullable 필드에 추가하는 멱등 migration, fresh local DB는 entity synchronize 사용. 기존 SQL/legacy 행은 NULL 유지, rollback은 백업 없이 데이터 제거하지 않는다.

## 입력과 독립 정답

외부 증빙 폴더의 `orders.csv`를 계정 A로 업로드한다. 새 소스 19, 업로드 화면 경로 재검사 소스 20. 계정 B는 독립 소스 18이다. 계정·토큰·키는 기록하지 않는다.

```csv
date,channel,amount,order_id
2025-01-01,online,10,a
2025-01-02,online,20,b
2025-01-03,store,30,c
2025-01-03,store,,d
2025-01-04,partner,40,e
2025-01-04,partner,50,e
```

기대: 6행, amount NULL 1, 날짜 2025-01-01~04, 표본 5행. 전체 SUM 150(표본 SUM 100과 다름), COUNT 6, DISTINCT order_id 5, AVG 30, MIN 10, MAX 50. 채널 partner 90/online 30/store 30, 날짜별 10/20/30/90.

## MD 선택 조건 및 결과

| 조건 | 기대·실행 | 판정 |
| --- | --- | --- |
| SSBI-02 새 파일 프로파일 | 서버 저장 후 전체 6행/NULL 1/날짜 경계, 표본 5행 구분. 실제 API 및 1440/390 화면 대조 | PASS |
| SSBI-02 업로드 진입 | 내 파일 화면에서 파일 선택, 제작 버튼 Enter → `/explore?sourceId=20`, 소스 자동 선택·프로파일 표시. 브라우저 WASM 시작 없이 서버 업로드 | PASS |
| SSBI-03 기본 집계 정의 | 6개 집계를 저장 후 실제 API 결과를 독립 정답과 대조. reload 후 저장 지표 13 재선택 | PASS (기본 6개만) |
| SSBI-08 제작·영속 | 숫자 150, 막대 90/30/30, 선 10/20/30/90. 대시보드 14/15 저장 후 재조회·표·snapshot 확인 | PASS (단일 위젯만) |
| SSBI-04 신규 API 경계 | 비인증 목록 401, 타계정 프로파일/지표/미리보기/저장 403. 자기 소스+다른 계정 metric도 403, 잘못된 날짜 분류·문자열 SUM 400 | PASS (신규 경로만) |
| 정의 삭제 호환 | 별도 metric 14 삭제 → 신규 제작 preview 400. 대시보드 17 snapshot 동일, 저장 SQL preview는 여전히 150 | PASS |
| 구조화→기존 SQL 교체 | 실제 SQLite 트랜잭션 단위 검사로 snapshot 저장 및 raw SQL 교체 시 NULL 확인 | PASS |
| SSBI-14 모바일·표 대체 | 390×844 제작/저장 차트, 문서 scrollWidth 390=viewport 390, 표는 이름 있는 내부 스크롤 영역 | PASS |
| SSBI-14 Tab/입력/실행 | source → 프로파일 표 → 저장 지표 → 이름 → 집계 → 열 → 단위 → 자릿수 → 표시 → 저장 순서, 실제 Tab. 이름/제목 keyboard.type, 지표/preview/dashboard Enter, 결과 region→저장 Tab | PASS (아래 제한 참조) |
| SSBI-14 native select popup | 네이티브 메뉴 선택은 이 headed Chromium 자동화의 키 입력으로 값 변경을 확인하지 못함. selectOption으로 선택 후 Tab/Enter 경로를 검증했으므로 전체 키보드 완료로 보고하지 않음 | BLOCKED |
| SSBI-14 VoiceOver | 실제 발화 미실행, 기존 도구 제한 유지 | NOT_RUN |
| SSBI-11 미리보기 장애 | 테스트에서 preview 응답을 503으로 주입. 오류 안내, 이전 결과 제거, 저장 비활성화. 주입 제거 후 동일 지표 재시도 | PASS (주입한 장애·동일 지표 재시도) |

## 발견·수정

새 BI 모듈에 JwtService provider가 빠져 정상 로그인 계정의 제작 API만 401을 반환했고 글로벌 인터셉터로 첫 화면으로 이동했다. BiModule provider를 추가하고 격리 서버를 재시작했다. 기존 database 200/새 BI 401 → 새 프로파일 200 및 저장 성공으로 재검증했다. `initial-module-auth-failure.png`는 **인증 리다이렉트 이후 화면**이며 화면의 오류 alert를 찍은 것이 아니다.

모바일 소스 revision은 표시를 12자리로 줄이고 API/snapshot에는 64자리 전체 값을 보존한다. 첫 측정도 root overflow는 없었으므로 이것을 overflow 실패 수정이라고 부르지 않는다. 차트는 기존 테마 primary 색과 정확값 표를 함께 사용한다.

## 실행·증빙

Aside daemon 인증 challenge fetch 실패로 실행 불가. 기존 허용된 headed Chromium bridge를 재사용했다. FE `http://127.0.0.1:3483`, BE `http://127.0.0.1:4683/v1`, Node 24, 별도 `assistant24.db`, 기존 DuckDB uploads. 실제 브라우저 화면과 API 결과를 함께 확인했다. 신규 Playwright suite는 추가하지 않았다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/self-service-builder/`.

- `api-results.json`: 전체 프로파일, 6집계, 신규 접근 행렬, 대시보드 14 snapshot.
- `snapshot-delete-results.json`: 정의 삭제 후 보존·저장 SQL 150.
- `recovery-results.json`: 503 주입 때 이전 결과 0/저장 disabled, 복구 후 날짜별 10/20/30/90·저장 enabled.
- `keyboard-path.json`: 실제 Tab 포커스 순서. native popup 선택 성공 증빙으로 사용하지 않는다.
- `number-preview-desktop.png`, `bar-preview-desktop.png`, `saved-dashboard-desktop.png`.
- `line-preview-mobile.png`, `builder-mobile-full.png`, `saved-line-mobile.png`, `upload-to-builder-mobile.png`.
- `preview-outage-mobile.png`, `preview-recovered-mobile.png`, `keyboard-saved-mobile.png`.

검사: 초기 BI/migration/legacy 34개 PASS. 후속 SQL·단위 변경 때문에 BI/이동한 migration/AI 저장 3 suites 54개를 재검사 PASS, 이후 추가한 단위 영속 회귀 1개도 PASS. 변경 없는 legacy 경계 18개 결과는 재사용한다. 이 턴에서 확인한 고유 BE 검사는 73개다. FE 관련 25개 PASS, 새 업로드 경로 assertion을 navigate state 계약에 맞춰 수정 후 해당 1개 PASS, 차트 값/배치 관련 기존 5개와 새 ResizeObserver 1개 PASS, 신규 저장 단위 렌더 1개 PASS(고유 33개). 전체 suite를 실행했다고 보고하지 않는다.

FE typecheck/lint, BE 선택 lint, BE/FE build PASS. lint 오류 0, BE 기존 테스트의 non-null assertion 경고 4개 유지. 기존 Vite native config 경고·Toast UI CSS 레거시 문법 경고는 유지됐다. 실제 `migration:show -d dist/src/data-source.js`는 새 migration 포함 7개를 정상 로드했다. `cli-ts-node-commonjs`를 transpile-only로 직접 실행하면 기존 Widget.datasetType의 Object/SQLite 메타데이터 오류가 있어 이 실행 경로는 통과로 보고하지 않는다.

AI 모델 호출 0. 이 흐름은 수동 제작이며 모델 호출을 요구하지 않는다. 기존 AI_PROVIDER=codex, AI_MODEL=gpt-6-luna 및 연결 설정은 변경하지 않았다.

## 남은 범위

SSBI-02/03/08/14 전체는 **부분 완료**다. 원격 DB 프로파일, 가중 평균/비율/통화 의미, 파일 갱신·실제 데이터 버전 보존, 139만 행 Rill oracle 비교, 제작 단계 필터·여러 위젯 배치/순서, 표시 포맷 전체 회귀, native 선택 메뉴·실제 스크린리더는 후속이다. 기존 130개 카탈로그 집계는 유지한다.


## 후속 검토·수정 및 재검증

- **실제 화면 FAIL → PASS:** 데이터 표를 열었을 때 차트 컨테이너 높이 192px인데 캔버스가 328px로 남아 표를 덮었다. LineChart에 ResizeObserver/프레임 정리로 컨테이너 변화 시 resize를 연결했다. 수정 후 데스크톱 192=192, 모바일 200=200, 문서 폭 390=390을 확인했다. 새 observer/cleanup 회귀와 관련 차트 값 5개를 검증했다. 기존 통과를 반복한 이유는 공통 차트 코드 변경이다. `saved-dashboard-desktop.png`/`saved-dashboard-desktop-settled.png`는 실패 증빙이며 최종 성공은 `saved-dashboard-desktop-after.png`, `saved-bar-mobile-after.png`를 사용한다.
- **열 이름 치환:** 단순 문자열 replace가 quoted column 안의 `FROM source`를 바꿀 수 있어 기존 sourceQuery CTE를 재사용했다. 실제 DuckDB 회귀의 `amount FROM source` 열은 22를 유지한다. 일반 업로드는 열 이름을 normalize하므로 이 quoted-name 결과를 업로드 화면에서 재현했다고 보고하지 않는다.
- **단위 위치:** 새 지표 unit을 prefix로 저장하면 미리보기 `150 kg`와 저장 `kg150`가 달라진다. suffix를 draft 검증·저장 옵션·일반 분석 렌더까지 전달하고 숫자 미리보기도 기존 NumericBoard를 재사용해 소수·큰 정수·축약 계약을 일치시켰다. 별도 1행 fixture 소스 21(업로드가 열을 `amount_FROM_source`로 normalize), 지표 22/대시보드 19에서 preview→save→reload `150 kg`, 정확값 150·suffix ` kg`를 확인했다. `unit-results.json`, `unit-preview-mobile.png`, `unit-saved-mobile.png`와 실제 SQLite/렌더 회귀를 남겼다. 이 fixture는 단위 표시 검증용이며 주문 금액을 실제 무게로 해석하지 않는다.
- **migration 발견:** TypeORM source glob에 Jest spec이 들어가지 않도록 테스트를 `src/bi/bi-migration.spec.ts`로 옮겼다. 실제 SQLite 멱등/NULL 보존과 compiled CLI 목록을 확인했다.
- native 메뉴 확인을 위해 CUA 앱 경로도 시도했지만 Chrome for Testing bundle 중복 및 정확한 경로 선택 timeout으로 추가 확인하지 못했다. 위 BLOCKED와 VoiceOver NOT_RUN을 유지한다.


후속 여러 위젯·배치/순서·저장 조건은 [여러 지표·차트 편집](dashboard-chart-editor.md)에서 선택 검증했다. 위의 최초 단일 제작 범위와 당시 미검증 기록은 이력으로 유지한다.

139만 행 Rill 프로파일·저장 지표 SUM/COUNT·3차트 재조회 조건은 [대용량 후속](structured-rill-large.md)에서 보완했다. 모바일 숫자 축 밀집을 수정했다. 가중 평균 저장 정의는 미구현이며 native popup/VoiceOver 제한과 나머지 미검증 범위는 유지한다.
