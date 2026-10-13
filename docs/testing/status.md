# MD 검증 현황 — 2026-10-13

[가중 평균·합계 비율 후속](advanced-metrics.md): SSBI-03의 선택 조건 ADV-01~04를 보완했다. Rill 전체 평균5.571238676523254·독립 정답 대조, 정상 가중17.5/15%·NULL/0·음수 정책·정의/snapshot 저장·재조회·모바일/Enter 확인. 차트 표NaN을 수정·재검증했다. 원격/통화/임의식/파일 교체·VoiceOver는 남아 전체 SSBI는 부분 완료다. gpt-6-luna 유지·모델 호출0.

[139만 행 구조화 제작 후속](structured-rill-large.md): 새 소스 프로파일·저장 SUM/COUNT·3차트 편집·저장/reload·9기기 정답·snapshot 및 1440/390 화면을 확인했다. LARGE-01~03 PASS(모바일 숫자 축 밀집 수정 후 재검증). LARGE-04는 AVG와 Rill 가중 공식 구분만 PASS이며 구조화 가중 지표는 미구현이다. SSBI 전체의 부분 완료와 기존130개 집계 유지, gpt-6-luna 유지·AI 호출0.

[여러 지표·차트 편집](dashboard-chart-editor.md)의 SSBI-08 신규 조건 EDIT-01~09 PASS. 한 DuckDB 소스의 1~6개 차트 추가·표현/크기/순서·저장/reload·SQL/삭제 정의 보존·409·503 복구와 1440/390 실제 키보드를 검증했다. 재조회 크기 배열 오류와 삭제 후 초점 소실을 수정·재검증했다. 원격/다중 소스·제작 필터/고급 지표·VoiceOver는 남아 전체 SSBI-08/14는 부분 완료이며 기존 카탈로그 집계는 유지한다. gpt-6-luna 유지, AI 호출 0.

[SQL 없는 제작 2A](self-service-builder.md)의 새 DuckDB 프로파일·기본 6집계·정의 snapshot·숫자/막대/선 저장·내 파일 연결·503 복구는 선택 조건 PASS. 1440/390 화면과 Tab/입력/Enter도 확인했다. native select popup 자동화는 BLOCKED, VoiceOver는 NOT_RUN이며 SSBI-02/03/08/14 전체는 부분 완료다. 기존 130개 카탈로그 집계를 늘리지 않는다. AI 호출 0, gpt-6-luna 유지.

2026-10-13 후속: [개인 소스 소유권](source-ownership.md)의 기존 API/계보/공유 선택 조건은 수정·재검증 PASS. SSBI-04 전체는 부분 완료이며 저장 보기/팀 권한/전체 SaaS 운영 감사와 실제 legacy owner 배정은 남아 있다.

아래는 수정 전 발견 기록이다. 신규 SSBI-04 권한 계약은 [단계0 감사](../strategy/2026-10-13-self-service-contract-audit.md)에서 일반 source/metric/preview 계정 간 접근을 재현해 미해결 FAIL로 기록했다. 기존 단일 인스턴스 카탈로그130개 완료 집계를 새 개인 소유 격리 완료로 해석하지 않는다. 다음 보강은 일반 API 전체의 owner/참조 검사와 명시적 legacy migration이다.

셀프서비스 BI1A 신규 조건은 [self-service-onboarding.md](self-service-onboarding.md)에 별도 기록했다. 샘플37주문 실제 DuckDB 집계·재조회, 내 파일 진입/가져오기,503 재시도, 모바일·키보드가 선택 조건 PASS다. SSBI-01/02/11/14 전체 계획 완료로 확대하지 않고 기존130개 집계는 유지한다. AI 호출0, gpt-6-luna 설정 유지.

DESIGN-04 별도 색상 입력은 [color-adapters-keyboard.md](color-adapters-keyboard.md)에 추가했다. 중복 선택창3개를 통합하고 색상 입력 이름·불변 업데이트·빠른 입력 누락을 수정했다. 선형/히트맵/복합 차트의 적용·취소·포커스·390폭과 회귀5개를 검증했다. 실제 VoiceOver와 다른 전체 경로는 남아 있어129완료/1부분 완료 집계를 유지한다.

DESIGN-04 색상 선택창은 [color-picker-keyboard.md](color-picker-keyboard.md)에 추가했다. HEX 입력 중 조기 닫힘·preset 역할/Space 선택을 수정하고21개 Tab·적용/취소·모바일·한영과 회귀4개를 검증했다. 실제 VoiceOver 재시도는 런타임/창 선택 제약으로 BLOCKED 유지다.

DESIGN-04 날짜 입력 후속은 [commerce-keyboard.md](commerce-keyboard.md)의 후속 기록에 추가했다. native 미완성 날짜의 전체 기간 오조회·입력 오류 연결·조회 중 포커스 소실을 수정하고 실제 키보드/중복 차단/모바일을 재검증했다. VoiceOver·native 팝업 등은 미검증으로 유지한다.

DESIGN-04의 매출·환불 화면은 [commerce-keyboard.md](commerce-keyboard.md)에 추가했다. 일별 정확값 표·이름 있는 표 스크롤 영역·AI 초기 포커스를 보완하고 1,096행 표시/방향키·대화상자 순환·모바일을 검증했다. 실제 VoiceOver와 날짜 입력 전체 경로 등은 미검증이므로 부분 완료 집계를 유지한다.

DESIGN-04의 위젯 생성은 [widget-keyboard.md](widget-keyboard.md)에 추가했다. 타입50개 카드 진입·선택 상태, 숫자판15개 Tab 경로, 공통 폼 이름과 색상 팝업 구조를 수정·재검증했다. 저장 취소·데이터 보존과 모바일을 확인했으며, 다른 차트 속성 전체·VoiceOver는 남아 있어 부분 완료 유지다.

DESIGN-04의 메트릭 화면은 [metric-keyboard.md](metric-keyboard.md)에서 Select/아이콘 이름·모바일 입력 배치를 수정했다. 실제 9개 Tab 순환·입력 취소·포커스 복귀·평가 결과 region과 데이터 보존을 확인했다. VoiceOver 및 다른 화면 전체 경로는 남아 있어 부분 완료 유지다.

DESIGN-04의 소스·데이터셋 폼 키보드 경로는 [data-forms-keyboard.md](data-forms-keyboard.md)에 추가했다. 타입 카드·SQL 편집기 이름/탈출 경로·같은 타입의 입력 보존을 수정하고 실제 키보드 조회/취소·한영·모바일을 확인했다. VoiceOver와 다른 화면의 전체 경로는 남아 있어 부분 완료 유지다.

Node 24·AI SDK 7 통합 검사와 DESIGN-04 데이터 화면 키보드 경로를 [node24-integration.md](node24-integration.md)에 추가했다. 전체 단위 599개·루트 빌드 통과, 데이터 카드 선택·아이콘 이름·미리보기 대화상자를 수정·재검증했다. VoiceOver와 다른 화면 전체 경로는 남아 있어 집계는 129완료/1부분 완료 유지다.

Assistant 저장 충돌·실행 중단의 ASSISTANT-06~07을 [assistant-reliability.md](assistant-reliability.md)에 추가했다. 실제 오래된 적용/되돌리기409, 중단 시 요청의 Codex 프로세스 종료, 실제 모델 후속 응답 복구와 모바일 안내를 확인했다. 신규2개 완료로 현재130개(129완료/1부분 완료)다.

우측 Assistant·AI SDK7·Node24의 ASSISTANT-01~05를 [dashboard-assistant.md](dashboard-assistant.md)에 추가했다. 실제 모델 질문/수정/적용/되돌리기와 필터·모바일·장애 안내 후 복구를 확인했다. 신규5개 완료로 고유ID는128개(127완료/1부분 완료)다. 기존 완료 케이스는 관련 변경이 없는 결과를 재사용했다.

숫자 KPI의 전체/축약(K/M/B/T) 전환·원래 값 유지·설정 영속·모바일 검증을 [compact-kpi.md](compact-kpi.md)에 추가했다. DESIGN-02·03/WIDGET-03의 신규 조건이며 당시 고유 ID 집계는122완료/1부분 완료였다.

신규 매출·환불 MVP의 COMMERCE-01~08은 `fd583392`에 커밋했고 [상세 결과](sales-refund-mvp.md)를 추가했다. 이후 [인증 잔여 조건](auth-remaining.md)에서 AUTH-01/05/06을 완료했다. Assistant 추가 전 집계는 기존115개+신규8개=123개다. 매출·환불 CSV 모델/첫 대시보드는 구현됐고, 외부 API·주기 수집·상품별 환불 배분·다중 통화는 후속 범위다.

기준 브랜치 `develop-v2`, 기록 기준 커밋 `3ecc67ba`. INGEST-04 직렬화 검증 기록은 이 커밋에 반영했다. 이 문서는 기존 실행 증빙을 감사한 결과이며 제품 테스트·브라우저·모델 호출을 재실행하지 않았다.

완료는 **해당 MD에 명시한 한정 조건의 증빙이 모인 경우**다. 부분 완료는 일부 조건 통과, 기록 누락 또는 관련 구현 변경으로 이전 결과만 재사용할 수 없는 경우다. 미검증은 적합한 실행 증빙을 찾지 못한 경우이며, 과거에 한 번도 실행되지 않았다고 단정하지 않는다. 과거 보고서의 NOT_RUN/BLOCKED는 후속 증빙이 있는 조건에 한해 해소했다.

기본 E2E의 500행 sales 정답(298250/60550)과 MD의 3행 oracle(500)을 혼용하지 않는다. 고정 HTTP AI fixture는 모델 품질 증명이 아니다. 실AI 검증은 현재 Codex `gpt-6-luna` 연결 증빙으로 판정하며 설정은 변경하지 않았다.

| 범위 | 완료 | 부분 완료 | 미검증 | 합계 |
| --- | ---: | ---: | ---: | ---: |
| cases.md | 102 | 0 | 0 | 102 |
| 서버 DuckDB + 디자인/필터/AI 대시보드 | 12 | 1 | 0 | 13 |
| COMMERCE-01~08 | 8 | 0 | 0 | 8 |
| ASSISTANT-01~07 | 7 | 0 | 0 | 7 |
| 전체 | 129 | 1 | 0 | 130 |

집계 단위는 고유 MD ID다. 단위 테스트 수·변형 수·스크린샷 수와 다르다. 과거 통과를 현재 전체 출시 회귀 완료로 확대하지 않으며, 관련 변경이 없는 결과만 재사용한다. DATA-04~07의 결과 JSON은 남았지만 상세 HTTP 원본 일부가 덮어써진 기록 한계도 보존한다.

## 기본 기능 102개

| ID | 상태 | 확인 범위 / 남은 조건 | 증빙 |
| --- | --- | --- | --- |
| AUTH-01 | 완료 | 기존 dashboard·unknown 결과 재사용. root/widget/data/source/dataset/metric/file 및 신규 commerce의 14경로 실제 로그인 전환, 보호 API 요청0. | [core], [authremaining] |
| AUTH-02 | 완료 | 초기 missing/malformed/tampered와 후속 expired/AI 계열 증빙 합산. | [post], [security] |
| AUTH-03 | 완료 | 필수누락4종+약한 암호/불일치/이메일: 안내·가입요청0·계정 미생성. | [auth], [authai] |
| AUTH-04 | 완료 | 신규 가입·로그인·숫자가 로드된 온보딩. | [post] |
| AUTH-05 | 완료 | ID/이메일 각각409·화면 안내. 가입 시도 전후 19테이블 행 수/해시 동일, 원 계정 로그인201 및 기존 매출·환불 조회200. 동시 중복 가입은 이 순차 명세 밖. | [authremaining] |
| AUTH-06 | 완료 | 기존 잘못된 암호 결과 재사용. unknown 실제 UI401·오류 안내·토큰/쿠키 부재, 같은 화면 정상 계정 로그인 복구. | [core], [authremaining] |
| AUTH-07 | 완료 | 로그인·프로필 reload와 올바른 userinfo/password 미노출 합산. | [post], [auth] |
| AUTH-08 | 완료 | 실제 refresh cookie 유무별 만료 토큰 복구/로그인 이동. | [security] |
| AUTH-09 | 완료 | 실제 refresh cookie 유무별 만료 토큰 복구/로그인 이동. | [security] |
| AUTH-10 | 완료 | 로그아웃·쿠키 철회, 삭제 전후 계정 상태, 손상 저장 JSON 복구. | [authnav] |
| AUTH-11 | 완료 | 잘못된 현재 암호는 보존, 정상 수정은 새 로그인·재조회 확인. | [profile] |
| AUTH-12 | 완료 | 잘못된 현재 암호는 보존, 정상 수정은 새 로그인·재조회 확인. | [profile] |
| AUTH-13 | 완료 | 로그아웃·쿠키 철회, 삭제 전후 계정 상태, 손상 저장 JSON 복구. | [authnav] |
| AUTH-14 | 완료 | 로그아웃·쿠키 철회, 삭제 전후 계정 상태, 손상 저장 JSON 복구. | [authnav] |
| FILE-01 | 완료 | 동일 oracle 브라우저3행6열/500 증빙 재사용, 현재 집계 CSV 실제 다운로드·파싱으로 total500 정확 일치. | [fileduck], [oraclecreate] |
| FILE-02 | 완료 | 3행/500 및 쿼리 오류·빈 결과 후 정상 복구. | [post] |
| FILE-03 | 완료 | 3행/500 및 쿼리 오류·빈 결과 후 정상 복구. | [post] |
| FILE-04 | 완료 | bar/line/pie, CSV 실제 다운로드 원값, BIGINT 정확 문자열. | [files] |
| FILE-05 | 완료 | 3행/500 및 쿼리 오류·빈 결과 후 정상 복구. | [post] |
| FILE-06 | 완료 | 3행/500 및 쿼리 오류·빈 결과 후 정상 복구. | [post] |
| FILE-07 | 완료 | bar/line/pie, CSV 실제 다운로드 원값, BIGINT 정확 문자열. | [files] |
| FILE-08 | 완료 | bar/line/pie, CSV 실제 다운로드 원값, BIGINT 정확 문자열. | [files] |
| FILE-09 | 완료 | 교체·특수 파일명·잘못된 형식 UI 오류와 복구. | [bound] |
| FILE-10 | 완료 | 교체·특수 파일명·잘못된 형식 UI 오류와 복구. | [bound] |
| FILE-11 | 완료 | 교체·특수 파일명·잘못된 형식 UI 오류와 복구. | [bound] |
| FILE-12 | 완료 | 실제 WASM 바이너리 차단 시 초기화 무응답 수정. Worker 오류/15초 제한, 실제 오류 안내→서버3행 저장/500→차단 제거·SPA 이동 후 브라우저3행/500 복구. JS 로더 모듈 장애는 별도 범위. | [fileduck] |
| FILE-13 | 완료 | 현재 서버 DuckDB CSV/JSON/Parquet 각각3행 원값·500, metadata SQLite 유지. | [fileduck] |
| FILE-14 | 완료 | 현재 DuckDB missing/empty/header-only/malformed JSON/scalar array/corrupt Parquet 각각400·소스 목록 동일. | [fileduck] |
| FILE-15 | 완료 | .txt 업로드400·소스 미생성. | [fileduck] |
| FILE-16 | 완료 | BOM/CRLF/quoted comma·newline·escaped quote 원값 그대로 조회. | [fileduck] |
| FILE-17 | 완료 | sanitized collisions/duplicate raw headers/대소문자/숫자/Unicode 7열 이름 유일·원값 모두 보존. | [fileduck] |
| FILE-18 | 완료 | heterogeneous JSON 4열 union·missing/null 및 원값 보존. | [fileduck] |
| FILE-19 | 완료 | CSV100001 전체 저장·집계, Parquet1391572 기존 결과 합산. | [data], [ingest] |
| FILE-20 | 완료 | 4096바이트 설정/4097 업로드413·목록불변·후속health200 및 UI 복구. | [data03] |
| DATA-01 | 완료 | 실제 SQLite 연결 폼 저장/reload, 실패 후 유효 연결 복구. | [profile] |
| DATA-02 | 완료 | 실제 SQLite 연결 폼 저장/reload, 실패 후 유효 연결 복구. | [profile] |
| DATA-03 | 완료 | SQLite 풀 초기화 후 같은 ID 연결 교체: 결과500→600. | [data03] |
| DATA-04 | 완료 | ID20경로/원값·CTE·빈쿼리/쓰기·다중문장 거절/오류 후500. 결과 JSON 보존, 상세 HTTP 원본 일부 덮어쓰기 한계 있음. | [data] |
| DATA-05 | 완료 | ID20경로/원값·CTE·빈쿼리/쓰기·다중문장 거절/오류 후500. 결과 JSON 보존, 상세 HTTP 원본 일부 덮어쓰기 한계 있음. | [data] |
| DATA-06 | 완료 | ID20경로/원값·CTE·빈쿼리/쓰기·다중문장 거절/오류 후500. 결과 JSON 보존, 상세 HTTP 원본 일부 덮어쓰기 한계 있음. | [data] |
| DATA-07 | 완료 | ID20경로/원값·CTE·빈쿼리/쓰기·다중문장 거절/오류 후500. 결과 JSON 보존, 상세 HTTP 원본 일부 덮어쓰기 한계 있음. | [data] |
| DATA-08 | 완료 | 실제 SCRAM 암호 PostgreSQL의 생성/목록/info/detail/수정 응답 비노출, uploaded_data 및 합계500. 생성 응답 암호·credential URL 노출 수정, 관련 회귀4개 PASS. | [data], [boundaries] |
| SET-01 | 완료 | UI 업로드→500→저장, source/query/title 재조회. | [post] |
| SET-02 | 완료 | 수정/reload 및 invalid query/required title 저장 차단. | [major] |
| SET-03 | 완료 | 수정/reload 및 invalid query/required title 저장 차단. | [major] |
| SET-04 | 완료 | CRUD/invalid update 보존과 후속 deleted/missing detail/update/delete 합산. | [major], [profile] |
| SET-05 | 완료 | CRUD/invalid update 보존과 후속 deleted/missing detail/update/delete 합산. | [major], [profile] |
| SET-06 | 완료 | 의존 위젯 처리 후 대시보드 계속 사용 가능. | [widget] |
| METRIC-01 | 완료 | 실제 UI CRUD/500, 6집계/2그룹 독립 정답. | [post] |
| METRIC-02 | 완료 | 필수/중복/취소 및 활성 목록 보존. | [profile] |
| METRIC-03 | 완료 | 실제 UI CRUD/500, 6집계/2그룹 독립 정답. | [post] |
| METRIC-04 | 완료 | 실제 UI CRUD/500, 6집계/2그룹 독립 정답. | [post] |
| METRIC-05 | 완료 | 필터7/거절5/수정 보존, 재생성 optional 잔존 수정 후 동일ID·활성1·250. | [metric] |
| METRIC-06 | 완료 | 필터7/거절5/수정 보존, 재생성 optional 잔존 수정 후 동일ID·활성1·250. | [metric] |
| METRIC-07 | 완료 | 필터7/거절5/수정 보존, 재생성 optional 잔존 수정 후 동일ID·활성1·250. | [metric] |
| METRIC-08 | 완료 | 필터7/거절5/수정 보존, 재생성 optional 잔존 수정 후 동일ID·활성1·250. | [metric] |
| METRIC-09 | 완료 | missing 및 deleted 평가 거절 합산. | [major], [profile] |
| WIDGET-01 | 완료 | 실제 oracle 소스15/amount/sum/숫자판 신규 저장201, 위젯104 fresh GET 및 reload500·option 동일. | [oraclecreate] |
| WIDGET-02 | 완료 | 필수/뒤로/취소, 옵션 수정/reload, 삭제 취소/확인. | [major] |
| WIDGET-03 | 완료 | 필수/뒤로/취소, 옵션 수정/reload, 삭제 취소/확인. | [major] |
| WIDGET-04 | 완료 | 필수/뒤로/취소, 옵션 수정/reload, 삭제 취소/확인. | [major] |
| WIDGET-05 | 완료 | TABLE/DATASET CRUD, 옵션 파싱 및 무관 위젯 보존. | [widget] |
| WIDGET-06 | 완료 | 52개 enabled component 각각 한 명시적 fixture. 실패 차트 수정 후 재검증 포함; 모든 옵션/모바일/디자인 품질 검증은 아님. | [widget], [chart] |
| WIDGET-07 | 완료 | missing/소스 삭제 오류와 정상500 화면 복귀. | [authnav] |
| DASH-01 | 완료 | 위젯104로 신규 대시보드6 UI 생성201, fresh GET/reload 제목500·widget ID/layout 동일. | [oraclecreate] |
| DASH-02 | 완료 | 제목·위젯·배치 영속/삭제 취소·확인/타계정5행동 거절. | [major] |
| DASH-03 | 완료 | 제목·위젯·배치 영속/삭제 취소·확인/타계정5행동 거절. | [major] |
| DASH-04 | 완료 | 제목·위젯·배치 영속/삭제 취소·확인/타계정5행동 거절. | [major] |
| DASH-05 | 완료 | title-only 보존+목록 격리+삭제시 mapping/widget/share 청소 합산. | [major], [dash] |
| DASH-06 | 완료 | 제목·위젯·배치 영속/삭제 취소·확인/타계정5행동 거절. | [major] |
| DASH-07 | 완료 | unknown/deleted URL 제어된 오류 및 private 내용 부재. | [authnav] |
| DASH-08 | 완료 | UI 템플릿 생성·선택 위젯1회 매핑/배치/reload500. | [nav] |
| SHARE-01 | 완료 | 실제 공유 설정/reload·익명 share/embed500·OFF 즉시 철회. | [post] |
| SHARE-02 | 완료 | 실제 공유 설정/reload·익명 share/embed500·OFF 즉시 철회. | [post] |
| SHARE-03 | 완료 | 실제 공유 설정/reload·익명 share/embed500·OFF 즉시 철회. | [post] |
| SHARE-04 | 완료 | 만료/없는/삭제/날짜 경계 및 철회 토큰 읽기·쓰기·다른 보드 차단. | [security] |
| SHARE-05 | 완료 | 만료/없는/삭제/날짜 경계 및 철회 토큰 읽기·쓰기·다른 보드 차단. | [security] |
| SHARE-06 | 완료 | 만료/없는/삭제/날짜 경계 및 철회 토큰 읽기·쓰기·다른 보드 차단. | [security] |
| SHARE-07 | 완료 | 실제 clipboard exact 링크/iframe, 거절 주입 피드백; 후속 embed overflow 재검증. | [authnav], [bound] |
| TEMPLATE-01 | 완료 | CRUD/추천 매핑/잘못된 값 제어; component duplicate409/missing404 수정 후 재검증. | [authnav] |
| TEMPLATE-02 | 완료 | CRUD/추천 매핑/잘못된 값 제어; component duplicate409/missing404 수정 후 재검증. | [authnav] |
| TEMPLATE-03 | 완료 | CRUD/추천 매핑/잘못된 값 제어; component duplicate409/missing404 수정 후 재검증. | [authnav] |
| AI-01 | 완료 | 설정 없음/빈·2001자/nonpositive ID 제어 오류, 외부 호출 없음. | [authai] |
| AI-02 | 완료 | 실제 HTTP 고정 fixture→Nest→SQLite500; 쓰기/다중문장 거절 및 원본3행 보존. | [provider] |
| AI-03 | 완료 | 실제 HTTP 고정 fixture→Nest→SQLite500; 쓰기/다중문장 거절 및 원본3행 보존. | [provider] |
| AI-04 | 완료 | HTTP503/빈content/잘못된JSON ERROR→정상 복구, 별도 고정 provider. | [recovery] |
| AI-05 | 완료 | 실Luna 등록차트와 고정 provider unknown/invalidJSON 거절·등록차트 UI 복구 합산. | [authai], [recommend] |
| AI-06 | 완료 | 빈/missing 거절과 정상 고정 literal API·UI 합산. | [authai], [literal] |
| AI-07 | 완료 | 실제 고정 provider literal/오류/복구 UI 및 별도 실Luna 복구. mock과 실모델 구분. | [recovery], [literal] |
| AI-08 | 완료 | 실제 고정 provider literal/오류/복구 UI 및 별도 실Luna 복구. mock과 실모델 구분. | [recovery], [literal] |
| RELIABILITY-01 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님. | [security] |
| RELIABILITY-02 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님. | [security] |
| RELIABILITY-03 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님. | [security] |
| RELIABILITY-04 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님. | [security] |
| RELIABILITY-05 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님. | [security] |
| RELIABILITY-06 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님. | [security] |
| NAV-01 | 완료 | 한/영 전환·reload 언어 지속. | [authnav] |
| NAV-02 | 완료 | 390/768 대표 화면 조작, back/forward/deep link/reload/404 복구. | [nav] |
| NAV-03 | 완료 | 390/768 대표 화면 조작, back/forward/deep link/reload/404 복구. | [nav] |
| NAV-04 | 완료 | 기존 source/dataset/widget/AI 취소 재사용. 일반 dashboard 생성·편집 각각 취소/메뉴 이동4조건: 쓰기요청0·목록/상세 동일·reload 원 제목/위젯/layout/500. | [authnav], [major], [filtererrors], [dashunsaved] |
| COMPONENT-01 | 완료 | CRUD/추천 매핑/잘못된 값 제어; component duplicate409/missing404 수정 후 재검증. | [authnav] |
| COMPONENT-02 | 완료 | CRUD/추천 매핑/잘못된 값 제어; component duplicate409/missing404 수정 후 재검증. | [authnav] |

## 서버·디자인 추가 명세 13개

| ID | 상태 | 확인 범위 / 남은 조건 | 증빙 |
| --- | --- | --- | --- |
| INGEST-01 | 완료 | 1391572행 실제 UI 저장/manifest/engine DuckDB·메타데이터 유지. | [ingest] |
| INGEST-02 | 완료 | 전체 요청634513000/가중평균/9기기 정답 및 정상 재시작 후 동일. | [ingest] |
| INGEST-03 | 완료 | 실제 UI 생성·9개 값/순서·reload 지속. | [ingest] |
| INGEST-04 | 완료 | 기존 제한/timeout/quota 복구+실worker query3개→remove 순서·API 단일경합·정상42. MD가 제외한 stress/전역quota/강제crash는 미검증. | [ingest], [serial] |
| DESIGN-01 | 완료 | 기존 Luna 정답 재사용. 현재 All time 동일 질문의 Rill 정확9개/요청/평균·설명·최종 AI 차트 대조. 원본 날짜 이동은 별도. | [luna], [designfinal] |
| DESIGN-02 | 완료 | 실제 Luna 저장 완료 화면의2KPI·USD2자리·9개 이름/0축/전체 폭·기간/필터·작은값 표, Rill 완료 차트/답변 비교. | [luna], [designfinal] |
| DESIGN-03 | 완료 | 동일 수정문 Rill 조회/편집 AI 실행 및 reload, 기존 VM/필터 증빙 합산. Rill 즉시 파일 쓰기와 VM 명시저장/취소 차이 기록; UX 동일성은 아님. | [filters], [luna], [designfinal] |
| DESIGN-04 | 부분 완료 | 기존 모바일/키보드 선택 재사용. 대시보드/헤더 이름 누락 수정·한영/Enter·controls 대상/390폭 검증. 대비·대상 화면 키보드·대화상자·169행 추세 표 보완. 실제 VoiceOver 발화/다른 화면 전체 키보드 미검증. | [luna], [designfinal], [kpia11y] |
| FILTER-01 | 완료 | 기존 수치/초기화/바인딩/역순/503 복구 재사용. 타계정 analysis/필터preview/save/draft 실제403, 원 초안·자산5테이블 해시 동일, 실제 UI 차단. | [filters], [filtererrors], [boundaries] |
| FILTER-02 | 완료 | 138055400/평균4.633939385003283±1e-9/2기기 정답, VM desktop/mobile·Rill desktop·UTC 경계·역순/부분 입력. Rill 모바일/기간 비교/필터 지속은 추가 범위. | [date], [filtererrors] |
| AI-DASH-01 | 완료 | 기존 Luna 생성/수정/저장/취소/오류 합산. Rill 동일 수정문 실행 비교 및 복제DB 별도 미설정 실API ERROR→UI 저장차단·5자산테이블 불변. | [luna], [filtererrors], [aierrors], [designfinal] |
| AI-DASH-02 | 완료 | 실Chromium390 필터/AI편집 취소/KPI/긴 이름/표/overflow 없음. 기존 모바일 실행의 로컬 모델 기록은 역사적 UI 증거로만 재사용; 실AI 성공 근거는 Luna 별도. | [filters], [date] |
| AI-AGENT-01 | 완료 | 실제 모델 연결 실패→명시 URL/catalog 수정→같은 질문 생성/정답. timeout/빈출력 경계는 해당 하위 회귀; 다른 모델 fallback 없음. | [date], [luna] |

## 남은 작업 우선순위

1. **P0 — 이번 선택 범위 완료.** DATA-08 실제 암호 연결 응답과 FILTER-01 신규 필터 API 타계정 차단을 보완했다. AUTH-01/05/06을 포함해 관련 변경 없이 반복하지 않는다. 전체 커넥터/테넌트 보안 감사 완료를 뜻하지 않는다.
2. **P1 — 현재 DuckDB 수집 경로 완료.** FILE-12~18 잔여 조건을 보완했다. INGEST-01~04/FILE-19·20과 함께 관련 변경 없으면 반복하지 않는다. 느린 기기의 15초 초기화 한도와 JS 로더 모듈 배포 장애는 별도 운영 범위다.
3. **기본 MD 102개 완료.** FILE-01·WIDGET-01·DASH-01의 신규 생성·export와 [NAV-04 미저장 취소/이동](dashboard-unsaved.md)까지 보완했다. 관련 변경이 없으면 반복하지 않는다. 전체 출시 회귀나 운영 준비 완료를 뜻하지 않는다.
4. **P1 — DESIGN-04 접근성 잔여 조건.** 최종 AI 차트/설명·동일 수정 질문 Rill 비교·실제 미설정 조건은 [후속 비교](design-final-audit.md)에서 보완했다. 버튼 이름 누락도 수정했다. 추세·대비·대상 화면 키보드는 [후속 기록](kpi-trends-accessibility.md)으로 보완했다. 실제 VoiceOver 발화·읽기 순서와 다른 화면 전체 키보드 경로가 남았다. 제품 간 UX 차이를 동일성 PASS로 확대하지 않는다.
5. **운영 파일럿 전 P1 / 다중 사용자 확장 전 P2.** 아래 별도 운영 범위를 정의하고 필요한 최소 검사를 시행한다. 전체 MD 통과와 운영 준비는 다른 판정이다.

## 현재 MD 밖의 운영·제품 작업

- 백업과 복원(메타데이터 암호화 키 포함), 운영 메타데이터 마이그레이션, 강제 프로세스 종료/미완료 import/임시 파일 정리의 복구 검증. RELIABILITY-05 정상 재시작은 강제 crash를 입증하지 않는다.
- 다중 사용자 동시 query/delete stress, 전체 디스크 quota/용량 관찰, 테넌트 권한 설계와 보존·삭제 정책. INGEST-04는 명세상 이 범위를 제외하며 미구현·미검증을 통과로 처리하지 않는다.
- 외부 API 커넥터·주기 수집·재시도/중복방지는 추가 제품 범위다. 주문·환불 CSV 모델과 첫 대시보드는 COMMERCE-01~08에서 Analytics Engineering 자료로 검증했다. 기존 광고 경매 샘플과 별도 증빙이다.
- Oracle/ODBC 실연결, pnpm 설치·배포, 출시용 전체 회귀는 별도 미검증 범위다. 매 개발마다 실행하는 항목으로 만들지 않는다.

## 증빙 참조

각 기록 안의 JSON/PNG/최초 실패 및 재검증 기록이 원본이다. 증빙은 저장소 밖에 있으며 이 문서에는 인증정보를 복사하지 않는다. 과거 보고서의 당시 미커밋/미설정 상태는 당시 기록으로 보존한다.

[core]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/hybrid-cleanup/result.md
[post]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/post-merge/result.md
[major]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-major/result.md
[profile]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-profile-source/result.md
[files]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-files/result.md
[nav]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-navigation-template/result.md
[security]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-security-recovery/report.md
[authnav]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-auth-navigation/report.md
[bound]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-file-boundaries/report.md
[widget]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-widget-dependencies/REPORT.md
[chart]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-charts/REPORT.md
[metric]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-metric/RESULTS.md
[data]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-data/RESULTS.md
[data03]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/data03-file20/RESULTS.md
[dash]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-dashboard-cleanup/RESULTS.md
[auth]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/auth-completion/RESULTS.md
[authai]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/auth-ai/RESULTS.md
[recovery]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-recovery/RESULTS.md
[provider]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-provider-db/RESULTS.md
[literal]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-ui-contracts/RESULTS.md
[recommend]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-chart-contract/RESULTS.md
[ingest]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/server-duckdb-1391572/RESULTS.md
[serial]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ingest-serialization/RESULTS.md
[design]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/design-rill-parity-improved/RESULTS.md
[rill]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/design-rill-parity/RESULTS.md
[filters]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-common-filters/RESULTS.md
[date]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/date-multi-filters/RESULTS.md
[luna]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/codex-luna-connection/RESULTS.md
[filtererrors]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-ai-filter/RESULTS.md
[aierrors]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-ai-errors/RESULTS.md
[authremaining]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/auth-remaining-2026-10-12/RESULTS.md
[boundaries]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/data-filter-boundary/RESULTS.md
[fileduck]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/file-duckdb-boundaries/RESULTS.md

[oraclecreate]: oracle-create-export.md

[dashunsaved]: dashboard-unsaved.md

[designfinal]: design-final-audit.md

[kpia11y]: kpi-trends-accessibility.md
