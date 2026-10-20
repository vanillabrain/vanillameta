# Rill 로컬 실증과 VanillaMeta 비교 — 2026-10-12

## 판단

Rill을 초기 고객 검증용 분석 엔진·대시보드 도구로 활용할 가치는 높다. 이번 공식 샘플에서 수집, 지표, 시각화, AI 편집은 실제 동작했다. VanillaMeta를 전면 교체하거나 SaaS의 운영 계층까지 무료로 해결한다고 결론낼 근거는 없다. 우선 Rill 프로젝트를 템플릿으로 사용하는 소규모 파일럿을 권한다.

## 환경과 범위

- Rill v0.90.5, commit b9ea8c6f215e56c4c0848771e70b3ec38346eacc, macOS arm64.
- 실행 중 UI: http://localhost:9009/canvas/auction_qa?tr=inf
- 바이너리: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-comparison/bin/rill`
- 프로젝트: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-comparison/project`
- 공식 예제 checkout: rilldata/rill-examples, b84d2a2bb66026c9322d4d35daaebfcf83d555c8, Open RTB 광고 예제.
- VanillaMeta: HEAD 3785977212980b5a99ef1fa25f1a532f46a155ae + 기존 미커밋 UI 수정이 있는 현재 checkout. 이번 작업에서는 제품 소스 변경 없음.
- VanillaMeta FE http://127.0.0.1:3200, BE http://127.0.0.1:4200/v1. 기존 remaining-charts 격리 환경 재사용. 비교용 계정을 신규 생성함.
- 브라우저: Aside 실제 화면. 전체 회귀 테스트 재실행 없음.
- 사용자가 Rill 샘플 사용을 지정했으므로 실제 주문·환불 데이터 대신 공식 광고 데이터로 비교. 환불·정산·주문 조인은 NOT_RUN. 광고 지표를 매출·환불로 재명명하지 않음.
- 기본 Rill 모델은 데이터 시간을 현재로 이동한다. 총량·기기별 집계는 불변이므로 해당 수치를 비교했고, 시간 축의 원본 날짜 동일성은 비교하지 않았다.

## 입력과 정답

공식 파일: https://storage.googleapis.com/rilldata-public/auction_data.parquet

- 파일 크기: 39,015,650 bytes, 약 37.2 MiB.
- SHA256: 7549d18b0294932802407f6bd851a807ff88ba1406b2958bbd8b4c261a4ee157
- 행 수: 1,391,572.
- 총 요청: 634,513,000.
- 평균 Bid Floor: sum(bid_floor) / sum(has_bid_floor_cnt) = 약 5.571238676526.
- 기기별 요청: Mobile/Tablet 307,763,000; Personal Computer 173,308,000; Set Top Box[NR1] 105,976,600; Connected TV 27,207,600; Tablet 15,435,200; Phone 2,343,800; Not Available 1,530,400; Games Console 931,400; Connected Device 17,000.

Rill의 raw SQL과 metrics_sql로 별도 검증. VanillaMeta 브라우저 DuckDB SQL의 행 수·정수 집계 일치. 평균은 부동소수점 합산 차이 약 3e-12, 허용오차 1e-8 내 일치. Rill KPI는 635M, $5.57로 반올림되므로 화면 값만으로 정확성을 판단하지 않았다.

## MD 검증 케이스와 결과

이 문서 자체가 이번 비교의 추가 MD 명세다. 기존 FILE-03/04는 3행 oracle 조건이므로 이번 대용량 샘플 검증을 그 케이스 전체 PASS로 집계하지 않는다.

| ID | 기대 결과 | 관찰/결과 |
| --- | --- | --- |
| RILL-CMP-01 | 공식 예제의 소스·모델·지표가 구동 | PASS. auction raw 약 22.7초, derived 약 2.0초, bids raw 약 15.2초. 서버 로그 기준이며 환경 의존. |
| RILL-CMP-02 | 내장 AI가 기존 지표로 KPI 2개와 기기별 막대 차트 생성 | PASS 구조 생성. auction_qa.yaml 36줄 생성, 실제 렌더링 확인. |
| RILL-CMP-03 | 생성 시 전체 기간을 사용하고 정답 집계 표시 | 최초 FAIL. AI는 전체 기간이라고 답했지만 실제 Last 24 hours, 89.3M, $5.32. defaults.time_range 누락. |
| RILL-CMP-04 | AI 재요청으로 inf 기간과 가로 막대·정렬 적용 | PASS. defaults.time_range: inf, x=requests, y=device_type, sort=-x. 전체 집계 API 정답 일치. 화면 635M/$5.57. |
| RILL-CMP-05 | 편집 결과 저장 후 새로고침 유지 | PASS. YAML 파일 반영, reload 후 preview에서 All time/KPI/가로 막대 유지. |
| VM-CMP-01 | 동일 전체 Parquet를 브라우저에서 분석 | PASS. 1,391,572행 및 총 요청 일치. |
| VM-CMP-02 | 기기별 9개 집계와 막대 차트 표시 | PASS. 9개 정수 집계가 Rill과 일치. |
| VM-CMP-03 | 전체 원본을 서버에 저장 후 영속 대시보드 생성 | FAIL 저장 단계. UI Internal server error, BE invalid encoding: RLE_DICTIONARY. 이후 영속 대시보드 생성 BLOCKED. |
| VM-CMP-04 | 같은 프롬프트로 제품 내 AI가 대시보드 생성·수정 | NOT_RUN/현재 구현 공백. 확인한 AI controller는 text-to-sql, recommend-chart, dashboard-insight이며 대시보드 편집 에이전트 endpoint가 없다. |
| OPS-CMP-01 | 운영비/동시 사용자/배포/테넌트 격리 검증 | NOT_RUN. 로컬 단일 사용자 검증 범위 밖. |

AI 프롬프트 1:

> Create an auction QA dashboard using auction_metrics with requests, avg_bid_floor and a bar chart of requests by device_type, all available data.

AI 프롬프트 2:

> The dashboard currently shows Last 24 hours and 89.3M requests, not all data. Fix auction_qa defaults.time_range to inf. Rename it Auction QA Verified and change requests chart to horizontal bars sorted descending. Keep both KPIs.

두 요청 모두 Rill의 AI 버튼/채팅창에서 실행. Codex가 대신 YAML을 작성한 결과가 아니다. 채팅에는 파일 조회, 스킬 조회, 파일 쓰기, 프로젝트 상태 검사 이력이 보였으며 실제 파일을 확인했다. API key 신규 설정이나 클라우드 배포는 수행하지 않았다. AI 모델 제공자·토큰 비용·평가판 한도·데이터 외부 전송 범위는 확인하지 않았으므로 내장 AI가 무료/오프라인이라고 주장하지 않는다. 생성·수정의 정밀 wall-clock 지연은 계측하지 않았다.

추가 관찰: display_name은 Auction QA Verified로 바뀌었지만 본문 markdown 제목은 Auction QA로 남음. 숫자/차트 수정 성공과 문구의 완전 일관성은 별개다.

## 저장 실패의 의미

VanillaMeta 브라우저의 DuckDB-WASM은 원본을 읽었다. 서버의 parquetjs-lite는 RLE_DICTIONARY를 디코딩하지 못했다. 별도로 서버에 UPLOAD_MAX_ROWS=100000이 있어 인코딩 문제를 해결해도 이번 139만 행의 전체 저장은 정책상 허용되지 않는다. 쿼리 결과 9행이 아니라 selectedFile 원본을 업로드하므로 집계로 화면을 바꿔도 제한을 피할 수 없다.

이번 요청은 비교 실증이므로 파서를 교체하거나 제한을 올리는 제품 수정은 수행하지 않았다. 분석 가능과 운영용 저장 가능을 혼동하지 않는 것이 핵심이다.

## 개발·운영 부담 비교

| 작업 | Rill 활용 | VanillaMeta 직접 확장 |
| --- | --- | --- |
| Parquet 수집/분석 | 이번 샘플 정상. 네이티브 DuckDB, 선언형 source/model | 브라우저 분석 정상. 서버 파서 호환성·행 제한 해결 필요 |
| 지표/차원 | 기존 metrics view 재사용, 두 대시보드에서 공통 정의 | 데이터셋 SQL/차트와 metric 정의의 연결 설계·검증 필요 |
| AI 생성·수정 | 내장 UI에서 생성/수정 실제 성공. 수치 oracle 검증은 필요 | 자연어 SQL·차트 추천·인사이트는 있으나 편집 에이전트 추가 필요 |
| 저장·미리보기 | YAML 파일 반영과 hot reload, reload persistence 확인 | 앱 API/DB 기반 상태 편집과 저장 흐름 유지 필요 |
| 갱신 작업 | 모델 refresh 선언을 예제가 제공. 이번 정기 실행 자체는 미검증 | API 수집 재시도·스케줄·중복 방지 워커 필요 |
| 사업 운영 | Cloud 구독 또는 자체 운영/통합 설계 필요 | 기존 앱 운영 + 분석 워커/DB 운영 필요 |
| 고객 가치 | 주문·환불 도메인 모델과 커넥터는 직접 만들어야 함 | 동일하게 직접 만들어야 함 |

관찰 시점 Rill 프로세스 RSS 약 186 MiB, 예제 tmp 약 251 MiB. 단일 시점이고 초기 적재 피크·브라우저 메모리·AI 메모리·동시 접속을 포함하지 않는다. VanillaMeta의 대칭 자원 계측도 없으므로 메모리 우열이나 운영비 절감률로 사용하지 않는다.

### 절감 규모 — 이번 실증에서 확인한 범위

이번 신규 대시보드에 추가된 결과물은 AI가 작성한 YAML 1개, 최종 38줄이다. 기존 공식 예제의 수집·모델·지표를 재사용했으며, 신규 FE 차트 코드·저장 API·AI 편집 에이전트 코드를 개발하지 않았다. 내장 AI에 생성 1회와 오류 수정/편집 1회를 요청했다. 예제를 재사용한 결과이므로 데이터 모델을 처음부터 작성하는 시간까지 절감했다고 해석하지 않는다.

- 이번 범위에서는 Parquet 서버 디코딩, 공통 지표 기반 차트 조립, 대시보드 영속 편집, AI 파일 수정의 네 작업을 Rill의 기존 기능으로 처리했다.
- 이를 직접 구현할 개발 주 수나 인건비 절감률은 측정하지 않았다. VanillaMeta의 같은 영속 대시보드 흐름이 저장 단계에서 실패해 대칭적인 완료 시간 비교가 성립하지 않는다.
- 주문·환불 정합성, 커넥터, 테넌트 인증, 과금, 고객지원은 그대로 남는다.
- 운영 절감률도 미측정이다. Cloud는 분석 서비스 운영을 맡길 수 있으나 구독/사용량 비용이 생긴다. 로컬 Developer는 팀용 운영 플랫폼 검증을 대체하지 않는다.

## 비용 확인과 권장 선택

2026-10-12 공식 가격: Starter $20/seat/month, Growth $30/seat/month, hosted compute 별도. Starter embedding은 preview만, Growth embedding은 $500/month에 100 active embedded seats까지. API·AI 사용 quota/초과 비용도 확인해야 한다.

예: Growth 내부 seat 2개 + embedding이면 좌석/embedding 소계만 $560/month. 이는 전체 청구액이 아니며 compute·storage·초과 사용량은 제외했다. 초기 작은 고객군에서 무조건 싼 구조라고 볼 수 없다.

권장 순서:

1. 현재 Rill 프로젝트를 고객 검증용 템플릿으로 유지한다. 별도 네이티브 앱 개발은 우선 미룬다. localhost 웹 UI + 파일 기반 편집만으로 핵심 컨셉이 확인됐다.
2. 파일럿 고객 한 곳의 실제 주문·환불 CSV로 모델과 지표를 정의한다. 부분 환불, 중복 주문, 환불일/주문일 기준, 할인/배송/세금, 취소 주문을 정답 표와 비교한다. 광고 데이터 실증을 상거래 검증으로 대체하지 않는다.
3. 커넥터/업로드·테넌트 운영은 VanillaMeta 측에 두고, Rill을 별도 분석 도구로 운영하는 파일럿부터 시작한다. 처음부터 두 대시보드 편집기를 모두 유지하거나 깊게 포크하지 않는다.
4. 고객이 반복 사용하고 유료 전환이 보이면 Rill Cloud embed의 비용·권한·브랜딩을 검증한다. 또는 분석 엔진/선언형 지표/AI 도구 구조만 참고해 VanillaMeta에 필요한 최소 기능을 개발한다.
5. 각 AI 변경 뒤 파일 diff + parse/reconcile 상태 + 고정 집계 정답 + 변경 화면 캡처를 확인한다. 기존 MD/Aside 방식과 맞으며 매 저장 전체 E2E는 필요 없다.

## 증빙

절대 경로 실행 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-comparison`

- rill-ai-created.png — 최초 생성, 잘못된 최근 24시간 범위.
- rill-ai-edit-chat.png, ai-edit-result.txt — 내장 AI 수정 대화/파일 diff.
- rill-ai-corrected.png — 전체 기간과 가로 막대 적용.
- rill-ai-preview.png, rill-preview.txt — 새로고침 후 preview.
- vanillameta-same-data-totals.png, vm-totals.txt — 같은 파일 총량.
- vanillameta-same-data-chart.png, vm-devices.txt — 같은 기기별 집계.
- vanillameta-save-failed.png — 서버 저장 실패.
- oracle-totals.json, oracle-devices.json — Rill metrics query 수치.
- project/dashboards/auction_qa.yaml — 실제 AI 생성·수정 파일.

## 출처

- 공식 예제: https://github.com/rilldata/rill-examples
- AI 개발 및 로컬 MCP: https://docs.rilldata.com/developers/get-started/ai-quickstart
- Cloud 가격: https://www.rilldata.com/pricing
- Embed: https://docs.rilldata.com/developers/embed

클라우드 배포/production embed/자체 호스팅 보안/라이선스 법률 검토/상거래 환불 정합성/부하 테스트는 미실행이다.
