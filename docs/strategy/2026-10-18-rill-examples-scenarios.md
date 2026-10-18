# Rill 데모·샘플·튜토리얼 조사와 VanillaMeta 적용 시나리오

조사일: **2026-10-18 KST**. 상태: **조사/제안 — 신규 기능 구현·시나리오 실행·고객 수용 아님**.

후속 사용자 승인으로 전체24개 구현 목표를 시작했다. 아래 NOT_RUN은 조사 당시 제안 상태이며 최신 구현/실행 판정은 [시나리오 실행 기록](../testing/rill-scenarios.md)을 따른다. VM 합성 마진/전환의 선택 실행과 Rill 동일 원본 비교를 구분한다.

사용자 요청은 Rill의 실제 사례를 확인하고 종류별 기능·유즈케이스·VM 적용 시나리오를 도출하는 것이다. 아래 Rill 사실은 공식 문서/공개 원본에서 확인했고 VM 시나리오는 이를 바탕으로 한 설계 제안이다. 기존 [제품 목표](prompt-to-dashboard.md), [Enterprise Artifact A–E](enterprise-data-artifact.md), [최신 검증 상태](../testing/status.md)를 대체하지 않는다. 이미 통과한 기반을 다시 만들거나 재검증하지 않는다.

## 1. 조사 범위와 수량

| 조사 대상 | 확인 수량 | 집계 방법/한계 |
|---|---:|---|
| 공식 `rill-examples` | 최상위 예제 폴더 **13개** | 아래 고정 커밋의 전체 Git tree, truncated=false. 업무·엔진 변형·임베드·권한·모델 패턴을 함께 포함 |
| 같은 저장소의 대시보드 | YAML **31개** | `/dashboards/` 아래 `.yaml`. 31개 업무/독립 데이터셋/동작 성공을 뜻하지 않음 |
| Dashboard101 공식 데모 진입점 | **8개** | Explore4 + Canvas4, URL의 프로젝트 식별자는5개. 다른 문서/저장소에 있는 데모까지 합친 총수가 아님 |
| Tutorials 색인의 최상위 과정 | **9종** | Basics, ClickHouse, Clone, Performance, Cost, GitHub, OpenRTB, MCP, Admin API. 과정별 세부 페이지는 별도 |
| 별도 시작 가이드 | 일반/Agentic **2종** | Tutorials9종과 구분 |
| 모델 패턴 갤러리 | **9패턴 × 4계열 = 36 YAML** | S3→DuckDB, S3→ClickHouse, Snowflake, BigQuery. 경로·인증을 교체하는 설계 예제이며 즉시 실행 가능한 공개 데이터36개가 아님 |
| 파트너 보안 샘플 | **5패턴** | 하나의 상위 예제 내부. 13개에 더해 집계하지 않음 |
| 임베드 데모 사이트 | **9사례** | 기본3·커스터마이즈3·보안3. 예제 사이트 홈 제외 |

고정 원본: [`rill-examples@b84d2a2bb66026c9322d4d35daaebfcf83d555c8`](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8). 재현 가능한 목록은 [조사 manifest](rill-sample-inventory-2026-10-18.json)에 둔다. 현재/과거 모든 블로그·영상·샘플 저장소의 전수 총수라고 주장하지 않는다. 공식 블로그가 연결한 별도 NYC Taxi 저장소와 과거 `rill-developer-example`도 있으나 위13/31에는 포함하지 않는다.

근거: [공식 예제 저장소](https://github.com/rilldata/rill-examples), [데모 색인](https://docs.rilldata.com/developers/build/dashboards/dashboards-101), [튜토리얼 색인](https://docs.rilldata.com/developers/tutorials), [임베드 예제](https://rill-embedding-example.netlify.app/).

### 증거 수준

- **원본 확인**: README, 소스 연결, 선택 지표/모델 YAML·SQL, 디렉터리/대시보드 수량.
- **데이터 주소 확인**: 네 공개 Parquet에 HEAD200. 전체 다운로드·새 행 수/무결성/원본 정답 검증은 하지 않음.
- **문서상 데모**: E-commerce/NYC는 공식 진입 링크 확인. SPA의 실제 차트 조작·현재 정상 작동은 이번에 검증하지 않음.
- **VM 설계 제안**: 아래 RXS 시나리오는 모두 NOT_RUN. 기존 MD의 PASS는 그 조건에 한해서 재사용.
- 오래된 튜토리얼의 제품 설명과 최신 문서가 다를 수 있다. CLI/API 문법을 구현에 쓸 때는 해당 버전 문서·원본을 다시 고정한다.

## 2. 공식 예제 폴더 전체 목록

아래 경로는 모두 위 고정 원본의 최상위 폴더다. 데이터 공개 여부와 동작 보장은 서로 다르다.

| 폴더 | dashboard YAML | 종류 | 사례에서 도출할 VM 기능 |
|---|---:|---|---|
| `rill-openrtb-prog-ads` | 3 | 광고 경매/입찰, Explore+Canvas | 집계 비율·단위·교차 필터·분석→요약 |
| `rill-openrtb-prog-ads-canvas` | 3 | 같은 광고 업무의 Canvas 변형 | 블록 구성·여러 metrics view·보고용 표현 |
| `rill-openrtb-prog-ads-clickhouse` | 2 | 같은 광고 업무의 엔진 변형 | 엔진 차이와 수치/성능을 분리 |
| `rill-cost-monitoring` | 2 | 비용·매출·고객 마진 | 지표 조합·비가산 비율·적자 고객 탐색 |
| `rill-app-engagement` | 1 | 앱 전환·버전별 행동 | 단계별 전환율·중복 제거·세그먼트 |
| `rill-github-analytics` | 6 | 여러 저장소 커밋+비교 Canvas | 1:N 데이터·정확한 distinct·재사용 템플릿 |
| `medicaid-provider-spending` | 1 | 공공 의료 청구 지출+사전 결합 | 다중 lookup·품질·합산 불가 지표·출처 |
| `rill-sec-formd` | 1 | 증권 발행 신고·발행자·수신자 | 다중 TSV·중앙값·결합 후 중복 방지 |
| `rill-partner-filtered-dashboards` | 5 | 권한 정책 패턴 | 역할/행/열/그룹·사용자 속성 |
| `embedding` | 5 | 외부 웹 앱 내 Explore/Canvas | 서버 발급 접근·UI 상태·브랜드·사용자 격리 |
| `connector-clickhouse` | 1 | ClickHouse Git 이력 연결 | 기존 분석 DB 연결 흐름 |
| `clickhouse-s3-postgres` | 1 | S3 fact+Postgres lookup | 증분 적재·차원 사전·데이터 관계 |
| `rill-modeling-examples` | 0 | 36개 모델 설정 | 갱신·실패/재시도·지연 데이터·스키마 변경 |
| **합계** | **31** | 상위 폴더13 | 같은 데이터를 재사용한 예제는 별도 업무로 부풀리지 않음 |

## 3. 업무 종류별 구체 사례

### 3.1 광고 운영 — 안정된 수치/탐색 기준

원본: [OpenRTB 프로젝트](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8/rill-openrtb-prog-ads), [공식 튜토리얼](https://docs.rilldata.com/developers/tutorials/openrtb-analytics), [데모](https://ui.rilldata.com/demo/rill-openrtb-prog-ads).

- 데이터: 경매 요청과 입찰 응답의 두 원본. 요청 수, floor, bid, 노출, 클릭, 광고비 등의 집계 열.
- 사용자 작업: 기기/브라우저/매체별 요청 감소 확인, 캠페인별 낙찰률·CTR 비교, 기간 비교 후 문제 세그먼트 탐색.
- 의미: 요청 수는 `SUM(bid_request_cnt)`이며 파일 행 수가 아니다. floor는 `SUM(bid_floor)/SUM(has_bid_floor_cnt)`로 구한다. 셀 평균의 평균으로 대체하지 않는다. 광고비/가격의 스케일은 실제 모델과 지표식을 함께 확인한다.
- VM 적용: 기존139만 행 테스트는 재사용하고 새 집계 조건·임시 지표·차원 추세 비교의 기준 데이터로 사용한다. 이 업무를 VM의 초기 고객군으로 바꾸자는 제안은 아니다.

### 3.2 비용·매출·마진 — 첫 추가 업무 템플릿으로 추천

원본: [Cost 프로젝트](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8/rill-cost-monitoring), [튜토리얼](https://docs.rilldata.com/developers/tutorials/cost-monitoring-analytics), [데모](https://ui.rilldata.com/demo/rill-cost-monitoring).

- 데이터: 일별 비용·매출, company/plan/location/component/app/SKU/pipeline/environment. 공개 Parquet 약0.98MB로 시작 부담이 작다.
- 지표: 총매출, 총비용, 매출-비용, `(SUM(revenue)-SUM(cost))/SUM(revenue)`, 고객 수.
- 유즈케이스: 매출 규모가 큰 적자 고객 찾기, 비용 급증일의 서비스/지역/환경 확인, 월별 고객 수익성 표를 경영진 요약으로 구성.
- VM 기능: 저장 지표 조합, 차원별 집계 후 임계값 조건, 음수/0분모, KPI·표·추세의 동일 계산, 근거를 가진 설명 블록.
- 설계 질문: Rill 샘플은 이 차액을 `Net Revenue`라고 부른다. VM은 사업 정의에 따라 `공헌이익/인프라 차감 후 이익` 등 의미를 명시하고 단순히 순매출이라고 복사하지 않는다.

### 3.3 앱·마케팅 전환 — 분모와 중복 제거 검증

원본: [App 프로젝트](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8/rill-app-engagement), [데모](https://ui.rilldata.com/demo/rill-app-engagement/explore/mobile_events_explore).

- README는 한 달의 합성 이벤트500만+로 설명한다. 이번에는 실제 행 수를 새로 세지 않았다.
- 데이터: 페이지 조회/클릭/다운로드/가입, 앱 버전·유입·국가·기기·네트워크·신규/기존.
- 유즈케이스: 새 버전 이후 전환율 하락 탐색, 특정 기기/국가에서 어느 단계가 감소했는지 비교.
- VM 기능: ratio-of-sums, distinct 분자/분모, 단계별 비율 표시, 비교 시 동일 코호트/기간, 차원별 추세.
- 주의: 이 샘플의 집계 기반 전환 분석을 사용자별 이벤트 순서를 증명하는 funnel/cohort/retention 엔진과 동일시하지 않는다. 월별 비율이 높다는 이유로 특정 버전이 원인이라고 단정하지 않는다.

### 3.4 GitHub 개발 활동 — 한 데이터에서 여러 업무 결과 재사용

원본: [GitHub 프로젝트](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8/rill-github-analytics), [튜토리얼](https://docs.rilldata.com/developers/tutorials/github-analytics), [데모](https://ui.rilldata.com/demo/rill-github-analytics).

- 데이터: 커밋과 변경 파일, 공개 저장소별 Parquet glob. 추출 스크립트로 다른 저장소에 템플릿 적용 가능.
- 지표: distinct 커밋/기여자, 추가·삭제·변경 줄, 커밋당 파일 수. 차원: 작성자·경로·확장자·디렉터리·merge 여부.
- 유즈케이스: 변경이 집중된 경로 탐색, 기간별 활동 추세, 여러 저장소를 한 Canvas에서 비교.
- VM 기능: 1커밋:N파일 결합의 중복 방지, 경로 기반 차원, 소스 교체/지표 재사용, 비교 보고서.
- 주의: `COUNT(DISTINCT filename)`과 전체 `file_path` 기준 파일 수는 다를 수 있다. 커밋/코드 줄 수를 개발자 생산성 평가의 정답으로 해석하지 않는다.

### 3.5 공공 의료 지출 — 코드 사전과 품질을 갖춘 분석

원본: [Medicaid 프로젝트](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8/medicaid-provider-spending), [데모](https://ui.rilldata.com/demo/medicaid-provider-spending/explore/medicaid_provider_spending).

- 데이터: 의료 제공자·절차·월별 지출에 제공자 사전, HCPCS/RBCS 코드, 제외 목록을 결합한다. README상2018-01~2024-12. 로컬 dev는 지출50만/제공자1만 제한이다.
- 지표/탐색: 지급액·청구 수·건당 지급액, 지역/절차/제공자 분해, 제외 목록에 해당하는 제공자 표시.
- VM 기능: 코드→업무 이름, 여러 역할의 lookup, 미매칭/중복키 품질, 자료별 출처·기간·샘플 제한 표시.
- 원본 자체가 `SUM(total_unique_beneficiaries)`는 제공자/코드 간 중복 가능성을 설명한다. 집계된 고유값 합산을 전체 고유 인원이라고 표시하지 않는 검증 사례로 사용한다. 제외 플래그만으로 개별 지급이 부정하다고 판단하지 않는다.

### 3.6 SEC Form D — 다중 파일과 비가산 통계

원본: [SEC 프로젝트](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8/rill-sec-formd).

- 데이터: ISSUERS/OFFERING/RECIPIENTS/RELATEDPERSONS/SIGNATURES의5종 TSV 연결 정의. 공개 버킷/glob는 확인했으나 실제 파일 접근/완전성은 미검증.
- 지표: 신고 행 수·고유 발행자/수신자·발행액 중앙값·평균/최대/최소·판매 수수료. 산업/법인/증권 유형 차원.
- VM 기능: 여러 파일 연결·중앙값·코드/긴 문자열·중복 검증·원본 기여 행 탐색.
- README에 광고 문구가 섞여 있어 업무는 실제 소스/지표 정의로 판정했다. 지표 label 오타/식 의미도 복사하지 않는다. 결합 후 `count(*)`가 신고 건수를 뜻하는지는 원본 키로 따로 증명해야 한다.

### 3.7 E-commerce — 직접적인 업무 참고, 데이터 확보는 미완료

공식 링크: [Explore](https://ui.rilldata.com/demo/ezcommerce-demo/explore/data_metrics_explore), [Canvas](https://ui.rilldata.com/demo/ezcommerce-demo/canvas/canvas), [소개 문서](https://docs.rilldata.com/developers/build/dashboards/dashboards-101).

문서는 판매 분석·매출 추적 용도로 소개한다. 이번 공식 예제13개에는 대응 프로젝트가 없고 SPA 텍스트만으로 지표/원본/환불 데이터를 확인할 수 없었다. 환불·부분 환불·결제 상태 데이터까지 제공한다고 추정하지 않는다.

VM은 기존 Analytics Engineering 매출·환불 정상/오류 fixture를 유지한다. E-commerce 화면은 요약/탐색 표현의 추가 레퍼런스로 사용하고, 동등 수치 비교는 원본 확보 후에만 한다.

### 3.8 NYC 도시/교통·Agentic 분석 — 여러 자료의 보고서화

공식 데모: [NYC scorecard](https://ui.rilldata.com/demo/nyc-canvas-jam/canvas/scorecard%20canvas), [NYC leaderboard](https://ui.rilldata.com/demo/nyc-canvas-jam/canvas/Leaderboard). 두 링크가 별도 데이터셋임을 뜻하지 않는다.

공식 [Agentic modeling 글](https://www.rilldata.com/blog/data-modeling-for-the-agentic-era-semantics-speed-and-stewardship)은 별도 [NYC Taxi 예제](https://github.com/sspaeti/rill-nyc-taxi)를 연결한다. 글의 동작 사례는 택시 질의의 실제 지표 확인, 부족한 지표 처리, 311 소음 민원 분석 후 Pivot 링크다. 글의 화면/저장소/현재 NYC 데모가 모두 같은 소스 버전이라고 가정하지 않는다.

VM 적용: 지역 코드 사전·업무 질문→분해 결과→동일 조건 탐색 링크, 표/설명/차트 구성. 지도는 수요가 확인되면 추가하며 초기 순서를 앞당기지 않는다. 존재하지 않는 금액 지표를 비율로 임의 대체하지 않는 AI 시나리오로도 활용한다.

## 4. 구현·운영 종류별 사례

### 4.1 모델링: 36개 설정에서 추출한9개 패턴

근거: [모델 갤러리 README](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8/rill-modeling-examples). 각 패턴의 적용 DB/실행 방식은 다르며 VM의 DuckDB에 ClickHouse 저장 엔진 구문을 옮기지 않는다.

| 번호 | 패턴 | 해결하는 문제 | VM 적용 시나리오 |
|---|---|---|---|
| 00 | 전체 갱신 | 단순 기준선 | 작은 파일 수동 교체·활성 버전 원자 전환 |
| 01 | 시간별 파티션 덮어쓰기+watermark | 같은 시간 재실행 중복/변경 파일 | 향후 API/파일 배치에 안정 ID·동일 배치 재실행 |
| 02 | 일별 파티션 덮어쓰기+watermark | 일별 마감 수정 | 어제 정산 재수신 시 해당 배치만 교체 |
| 03 | 지연 변경 merge | 늦은 정정 이벤트 | 취소/환불 정정의 business key·update time 계약 |
| 04 | schema patch | 정의 변경 시 전체 재구축 비용 | 영향 범위 확인·선택 재처리, 자동 성공 처리 금지 |
| 05 | schema reset | 정의 변경 후 과거 재계산 | 명시 전체 재구축·기존 게시본 보존 |
| 06 | hook·검사·재시도 | 전후 검사/부분 실패 | 새 버전 검증 후 활성화·중복 없는 재시도 |
| 07 | hash bucket | 시간 파티션이 맞지 않는 분포 | 실제 부하 필요 시 도입, 초기 필수 아님 |
| 08 | 상태 기반 증분 | watermark/checkpoint | 마지막 성공 지점·재시작 복구 |

관련 [S3+Postgres 예제](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8/clickhouse-s3-postgres)는 이벤트 fact와 사용자 lookup을 분리한다. VM은 먼저 lookup의 중복키/미매칭/조인 팽창을 보이고 결합을 승인받는 최소 기능부터 만든다. 초기 단계에서 새 엔진·4종 외부 커넥터를 도입하자는 의미가 아니다.

### 4.2 파트너 보안: 5가지 사용자별 접근 패턴

근거: [보안 프로젝트](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8/rill-partner-filtered-dashboards).

| 패턴 | Rill 사례 | VM에서 증명할 조건 |
|---|---|---|
| 관리자만 접근 | admin 정책 | viewer가 화면/API/AI/export로 우회 못함 |
| 열 제외 | 외부 사용자에게 회사/내부 분류 숨김 | schema·값·표시·AI 문맥·CSV 모두 일치 |
| 사용자 속성 행 제한 | 회사+요금제+지역 | 클라이언트 필터 제거/본문 조작으로 범위 확대 불가 |
| 매핑 테이블 행 제한 | email→허용 회사 | 여러 회사 허용·권한 회수·캐시 분리 |
| 그룹 제한 | 부서 그룹 또는 admin | 역할/그룹 변경의 적용 시점·서버 검사 |

VM의 소유권/공유/게시 기능은 재사용하되 이 정책들의 구현 완료로 집계하지 않는다. Enterprise C 단계의 제안 수용 조건이며 실제 정책 설계는 구현 전 상세 UC로 좁힌다.

### 4.3 임베드: 9가지 독립 예제

근거: [실제 예제 사이트](https://rill-embedding-example.netlify.app/), [고정 소스](https://github.com/rilldata/rill-examples/tree/b84d2a2bb66026c9322d4d35daaebfcf83d555c8/embedding).

| 종류 | 사례 | VM에서 도출할 기능 |
|---|---|---|
| 기본 | Explore | 허용된 탐색 화면을 고객 포털에 표시 |
| 기본 | Canvas | 보고형 Artifact 임베드 |
| 기본 | Navigation | 허용 대상 간 이동, 다른 대상 접근 차단 |
| 표현 | Themes | 고객사 색·폰트·로고와 가독성 |
| 표현 | Disable pivots | 노출 UI 범위 제어. 숨김은 권한 통제의 대체가 아님 |
| 표현 | UI state | 같은 기간/지표/필터로 진입·상태 전달 |
| 보안 | Filter by user | 서버가 검증한 사용자 정체성으로 행 제한 |
| 보안 | Custom attributes | 고객사/지역 등 검증된 속성별 제한 |
| 보안 | AI chat history | 임베드 AI 대화 문맥의 분리·수명 확인 |

이번에는 예제 목록/선택 설명/소스 존재를 확인했다. 실제 iframe 발급·사용자 전환·대화 격리는 실행하지 않았다. 사이트의 사용자 선택 버튼은 데모 장치이며 고객 입력 email을 신뢰하는 인증 설계로 복사하지 않는다. VM 기존 embed code와 운영용 사용자 인증 임베드는 별도다.

## 5. 튜토리얼에서 추출할 제품 여정

근거: [튜토리얼 색인](https://docs.rilldata.com/developers/tutorials). 문서별 소개/단계를 조사했으며 전 과정을 실행한 상태가 아니다.

| 과정 | 구체 사례/작업 | 추출할 VM 유즈케이스 |
|---|---|---|
| Source→Published | GitHub Parquet 수집→SQL 모델→metrics→Explore/Canvas→배포의6단계 | 파일 연결→열/업무 의미 확인→미리보기→비공개 저장→명시 게시 |
| ClickHouse | 기존 테이블 연결→metrics→AI Explore→배포 | 허용 저장 소스로 시작, 물리 엔진 선택을 일반 사용자에게 요구하지 않음 |
| Clone project | 기존 프로젝트 복제·환경/샘플 범위·수정 후 업데이트 | 원본 불변 복제→내 소스 매핑→재미리보기→새 비공개 저장 |
| Performance | materialization·dev subset·분할/증분·질의 최적화 | 작은 결정적 fixture로 개발, 대표 큰 데이터는 영향 범위 검증 때만 |
| Cost | 비용/매출 결합·지표·고객별 분석 | 마진 Artifact와 집계 조건 |
| GitHub | Git 추출 스크립트·Parquet·프로젝트 생성 | 커넥터 추출/저장/분석 분리, 업무 템플릿 재사용 |
| OpenRTB | 요청/입찰·단위·Explore/Canvas | 큰 집계 수치·ratio·여러 소스 보고 |
| MCP | 기존 metrics 조회·업무 문맥·AI 질의 | UI/AI/API가 동일 계산·권한·기간 사용 |
| Admin API | service account로 viewer provisioning·정리 | 조직 관리/서비스 정체성/수명. 일반 분석 기능 이후 |

별도 [일반 Quickstart](https://docs.rilldata.com/developers/get-started/quickstart)는 공개 경매 소스의 프로파일→AI metrics/dashboard 생성을 보여준다. [Agentic Quickstart](https://docs.rilldata.com/developers/get-started/ai-quickstart)는 소스→null 제거/가격 구간 모델→지표→Canvas→오류 상태 확인/수정의 구체 프롬프트를 제공한다.

중요한 차이: 로컬 Developer MCP의 파일 편집·SQL·상태 확인과 Cloud 분석 MCP의 지표 조회를 같은 권한으로 보지 않는다. VM에서는 이미 승인된 gpt-6-luna 실행을 유지하며 변경 제안→검증→명시 저장 경계를 지킨다. 프로젝트 건강 상태를 조회해 오류를 설명하는 기능과 데이터/정의를 실제 수정하는 기능은 분리한다.

## 6. 데이터 확보 계획

네 URL은2026-10-18 조사에서 HEAD200과 Content-Length/ETag를 확인했다. decimal MB이며 압축 파일 크기다. 전체 유효성·조회 RAM/시간을 뜻하지 않는다.

| 데이터 | 직접 공개 URL | 크기 | 현재 선택 |
|---|---|---:|---|
| 경매 | [auction_data.parquet](https://storage.googleapis.com/rilldata-public/auction_data.parquet) | 39.02MB | 기존139만 행 증빙 재사용 |
| 입찰 | [bids_data.parquet](https://storage.googleapis.com/rilldata-public/bids_data.parquet) | 35.51MB | 새로운 비율·광고비 단위 사례 필요 시 |
| 비용/마진 | [metrics_margin_monitoring.parquet](https://storage.googleapis.com/rilldata-public/metrics_margin_monitoring.parquet) | 0.98MB | **다음 구현의 우선 데이터** |
| 앱 전환 | [mobile-demo-funnel.parquet](https://storage.googleapis.com/rilldata-public/mobile-demo-funnel.parquet) | 211.99MB | 고정 소표본+대표 전체 데이터 분리 |

GitHub는 공개 glob와 추출 스크립트가 있으나 개별 객체 재현 목록을 고정해야 한다. Medicaid는 공개 데이터/lookup 정의가 있으나 대용량과 여러 배포처를 고려해 선별 추출한다. SEC 버킷·E-commerce 대응 소스·NYC demo의 정확한 원본 대응은 확인 대기다. 갤러리의 example-bucket과 외부 DB는 가짜 경로/자격증명 치환이 필요하다.

공개 URL 접근과 VM에 샘플을 재배포할 권리는 별개다. 템플릿에 묶어 배포할 때는 자료별 출처·이용 조건을 확인한다. 이번에는 대용량 데이터를 저장소에 추가하거나 외부 계정/유료 엔진을 생성하지 않았다.

## 7. VM 적용 시나리오 — 모두 설계/NOT_RUN

### A. 생성·계산·탐색

| ID | 사용자/질문 | 작업 | 인수 결과 | 추적/기반 |
|---|---|---|---|---|
| RXS-01 | 운영자: 고객별 매출과 비용, 마진을 만들어 줘 | Cost 소스 프로파일→지표 제안→전체 미리보기→비공개 저장/reload | 독립 SQL 총액/고객별 ratio 일치, 통화·분모·출처, 쓰기는 명시 저장만 | P2/P3, EA-01/03 |
| RXS-02 | 재무: 매출1000 이상·마진20% 미만 고객 | company별 집계 조건→매출 순위 | 조건은 원본행 cost/revenue 필터가 아닌 집계 기준, 빈 결과/0분모 명시 | P2, 집계 조건 신설 |
| RXS-03 | 분석가: 이익/마진 지표 추가 | 저장 지표를 참조하는 계산 제안→검증→KPI/추세/Pivot/CSV | 합계에서 재계산, 0/NULL/음수·스케일 일치, 기존 지표 불변 | P2/P3, 제한된 계산 AST |
| RXS-04 | 운영자: 비용 급증일과 관련 서비스 | 시점 선택→component/location 분해→상세 | 조건 왕복 유지, 기여 행/합계 일치, 상관을 원인으로 단정하지 않음 | 기존 시간 필터/상세 재사용 |
| RXS-05 | 마케팅: 버전별 다운로드 전환 비교 | App 소스→신규/기존·기기 필터→기간 비교 | 분자/분모·distinct 범위 동일, 비율 평균 금지 | P2, ratio/distinct |
| RXS-06 | 제품 담당: 두 버전 추세를 같이 | 차원 값 비교→시간 상세→Pivot→복귀 | 동일 세그먼트/기간/시간대 유지, 범례/색/키보드 접근 | TDD형 흐름 추가 |
| RXS-07 | 개발 리드: 많이 바뀐 디렉터리 | Git 커밋+파일→경로 차원→distinct/Pivot | 1:N 중복 커밋 방지, filename/path 정의 분리 | 결합·품질 설계 선행 |
| RXS-08 | 담당자: 코드 대신 이름으로 지출 분석 | Medicaid fact+lookup→미매칭 확인→집계 | 결합 전후 fact 건수/금액 보존, 중복키 차단, 비가산 고유값 안내 | P2, 관계/품질 추가 |

### B. Artifact 편집·AI·재사용

| ID | 사용자/질문 | 작업 | 인수 결과 | 추적/기반 |
|---|---|---|---|---|
| RXS-09 | 대표: 월간 마진 보고서 | KPI+추세+고객표+근거 설명 구성→배치→저장→게시 | 같은 지표 정의·기간, 설명의 수치/링크 연결, 고정 게시본과 초안 분리 | P1/P3/P4, EA-04, D |
| RXS-10 | 분석가: 이 답의 근거를 열어 줘 | AI 답변→조건이 포함된 Explore/Pivot 링크 | AI 수치와 화면 수치 일치, 권한/기간/비교/지표 버전 유지 | EA-03, AI handoff |
| RXS-11 | 신규 사용자: 이 샘플을 내 파일로 | 샘플 설명→내 파일→열/단위 매핑→미리보기→새 저장 | 원본 불변·새ID·누락 열/통화 질문, 새 데이터 독립 정답 | P5, EA-11 |
| RXS-12 | 운영자: 모델 오류를 고쳐 줘 | source/schema/metric 오류 구조 조회→수정안→재미리보기 | 오류를 숨기기 위한 블록 삭제 없음, 기존 성공 버전 보존, 비대상 불변 | A/B, 상태·근거 |
| RXS-13 | 재무: 환불률을 주문 기준으로 | 기존 Commerce fixture→분모 확인→AI 수정→저장 | Rill에 없는 환불 열을 발명하지 않음, 주문/금액 기준 구분 | 기존 Commerce/UC033 재사용 |
| RXS-14 | 담당자: 존재하지 않는 팁 금액 질의 | NYC형 소스에 없는 measure 질문 | 없는 금액을 비율로 대체하지 않음, 보강할 열/정의 질문 | EA-01, AI 의미 경계 |

### C. 반복 운영·데이터 품질

| ID | 사용자/상황 | 작업 | 인수 결과 | 추적/기반 |
|---|---|---|---|---|
| RXS-15 | 운영자: 새 일자 파일 갱신 | 검증→활성화→작업본 재조회 | 이전/현재 버전·데이터 시점 구분, 재게시 전 게시본 불변 | B, EA-05 |
| RXS-16 | 수집 중 실패/서버 재시작 | 동일 작업 명시 재시도 | 마지막 성공 보존·거짓 성공0·중복 활성 버전0 | B/E durable job |
| RXS-17 | 금액 열 삭제/타입 변경 | 갱신 거절→영향 블록→재매핑 | 기존 수치 보존·영향 설명·자동 형변환 금지 | B, EA-06, 기존 B1 확대 |
| RXS-18 | 지연 환불/정정 배치 재도착 | 같은 키/배치 재반영 | 중복 매출/환불0, 정정 시점과 업무 발생일 구분 | E, merge/replace 계약 선행 |
| RXS-19 | 큰 데이터 개발 | 결정적 작은 표본→변경 범위 테스트→전체 대표 실행 | 표본/전체 표시, 실행 횟수/메모리/대기/취소 기록 | NFR, 기존 worker |
| RXS-20 | 운영 기준 초과 | 성공한 최신 집계에 임계값→알림/예약 보고 | 오래된/실패 결과로 경보 안 함, 수신자 권한·중복 발송 방지 | E 후속, 수요 확인 뒤 |

### D. 기업 공유·임베드

| ID | 사용자/상황 | 작업 | 인수 결과 | 추적/기반 |
|---|---|---|---|---|
| RXS-21 | 관리자/부서별 담당자 | 역할·그룹으로 같은 Artifact 조회 | 허용 지표만 UI/API/export/AI 동일, 권한 회수 후 차단 | C, EA-08 |
| RXS-22 | 파트너A/B | 같은 대시보드에서 자기 회사/지역 | 프런트 필터 제거·ID/속성 조작·캐시로 다른 고객 데이터0 | C, 행 정책 |
| RXS-23 | 외부 사용자 | 내부 고객명/원가 열 숨김 | 목록·질의·근거·AI 문맥·CSV에 금지 열/값0 | C, 열/LLM 정책 |
| RXS-24 | 고객 포털 사용자 | 허용 identity로 embed→테마/필터→AI | 서버 검증 정체성·만료·상태 연결, 타인 대화0·문서 넘침0 | C 이후 D/E |

이는 상세 UC/테스트 명세의 입력 목록이다. 실제 구현 시 선택한 한 시나리오를 기존 FR/UC에 연결하고 Given/When/Then·실패 조건·권한·데이터 계약을 작성한다. Rill도 모든 조합이 검증됐다는 의미가 아니다.

## 8. 최소 부담의 적용 순서

| 순서 | 실행 묶음 | 산출/이유 | 완료를 선언할 조건 |
|---|---|---|---|
| 1 | Cost 기반 RXS01~03 | 작은 공개 파일로 지표 조합·집계 필터를 증명. 기존 A 근거를 연결 | Rill 고정 원본과 동일 범위+독립 SQL, VM 저장/복원·세폭·키보드, 0/NULL/음수 |
| 2 | Cost 기반 RXS09~12 | 탐색 결과를 설명/표가 있는 Artifact로 완성 | 동일 계산·조건 handoff·수정/저장/게시/내 파일 복제 연결 |
| 3 | RXS15~17와 기존 A–E의 B | 반복 사용에 필요한 갱신/복구·영향 블록 | 실패·재시작·재시도에 원본/게시 보존, 추가 활성화0 |
| 4 | RXS21~23와 C | 실제 기업 데이터 사용의 권한/전송 전제 | UI뿐 아니라 전체 서버 진입점·AI/export/캐시 검사 |
| 5 | App RXS05~06 | 두 번째 분야에서 의미/추세 비교 재사용 검증 | 분모·distinct·추세/Pivot 왕복 조건 일치 |
| 6 | 실수요 커넥터1종·RXS18/20/24 | 예약·정정·보고/임베드 확장 | 운영 소스·인증·실패/비용 기준 확보 후. 미선정 커넥터를 가정하지 않음 |

기존 A–E 승인을 취소하거나 새 FR 상태를 임의 승인하지 않는다. 위1~2는 A/D에 필요한 의미·Artifact 공백을 좁게 검증하는 제안이다. 로컬 공개 샘플의 비공개 개발은 가능하지만 실제 기업 데이터 외부 LLM 전송/파트너 공개는 C의 정책 준비가 선행한다.

고객에게 전면에 제시할 업무 샘플은 **기존 매출·환불 / 비용·마진 / 앱 전환** 세 종류를 추천한다. 광고는 대용량 계산 기준, Git/의료/SEC/NYC는 재사용·관계·품질의 확장 검증용으로 둔다. 이 추천은 예제 적합성에 대한 판단이며 시장 수요가 검증됐다는 뜻은 아니다.

## 9. Rill과 동일하게 실행하는 검증 계약

1. 원본 커밋·파일 checksum·기간·시간대·스키마·단위·지표식·포맷 스케일을 고정한다. 조회일로 시점을 이동하는 모델은 원본과 같은 좌표로 정규화한다.
2. 같은 업무 질문으로 각 제품의 정상 경로를 수행한다. 내부 생성 파일/화면 단계가 달라도 사용자 목표와 계산 범위가 같아야 한다.
3. LLM 생성이 정답을 정의하지 않는다. 독립 DuckDB SQL로 현재/이전 합계·각 그룹·ratio·NULL/0/음수와 distinct를 비교한다.
4. Rill 원본도 오타·식/단위·중복 의미를 검토한다. 차이를 발견하면 Rill 동작, 업무 정답, VM 의도된 규칙을 구분한다. 숫자만 맞추기 위해 잘못된 의미를 복제하지 않는다.
5. Desktop1440/Tablet768/Mobile390에서 같은 핵심 상태를 캡처한다. 로딩/빈 결과/오류·긴 이름·버튼/입력 높이·정렬·폰트·색/포커스·표 내부 스크롤까지 확인한다.
6. 키보드로 필터/기간·블록·근거·저장·게시 창을 조작하고 닫기 후 초점을 확인한다. 실제 휴대폰과 VoiceOver BLOCKED는 별도 유지한다.
7. 신규 조건만 MD에 추가한다. 해당 기능을 수정하지 않은 기존 PASS는 재사용하고 대규모 실행은 영향 범위가 정당화할 때만 한다. 외부 실게시/메일/관리자 계정 생성은 조사에 포함하지 않는다.

gpt-6-luna 설정은 유지한다. 이번 조사는 모델 호출·새 화면 테스트·외부 시스템 쓰기를 수행하지 않았다.

## 10. 조사 산출물 검증과 남은 불확실성

manifest의 폴더13/대시보드31/모델36/임베드9는 고정 Git tree에서 기계적으로 집계한다. 모델링 README와 보안 README로 각각9패턴/5패턴을 확인한다. docs101의 링크8개는 존재 확인이며8개 실제 화면 성공의 증거가 아니다. 새 문서 링크·JSON 파싱·합계를 확인하며 제품 소스/테스트 결과는 변경하지 않는다.

미확인: E-commerce 원본/환불 포함 여부, NYC 각 데모와 별도 Taxi 소스의 완전 대응, GitHub glob의 고정 객체 목록·각 데이터의 전체 최신 행 수, SEC 데이터 접근, 샘플별 재배포 조건, 현재 데모의 모든 기능 정상 동작, 실고객 수요. 다음 구현 시작 전 선택한 사례의 다운로드/checksum·실제 Rill 정상 실행부터 확인한다.
