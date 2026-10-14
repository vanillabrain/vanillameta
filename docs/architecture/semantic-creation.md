# P2 — 질문에서 지표·차원·분석을 함께 만드는 설계

상태: Draft / A API 구현·검증 완료, B/C 설계 상태. UC-012·FR-007/008·NFR-004. 쓰기 없는 제안·미리보기 API만 구현했으며 원자 저장·DB migration·고객 UI 연결은 미구현이다. [실행 증빙](../testing/semantic-proposal.md)을 확인한다. 현재 동작과 예정 계약을 혼동하지 않는다.

## 고객 흐름과 첫 범위

준비된 소스에서 “전체 요청 수와 평균 입찰가, OS별 요청 수를 보여 줘”라고 질문한다. 결과는 KPI2개+OS 차트1개와 숫자 KPI의 파생 시계열이다. 저장하면 지표2개·분류1개와 분석을 함께 남기고 같은 계산을 다음 질문에서 재사용한다. 소스·Measure·Dimension을 순서대로 만드는 별도 마법사는 기본 선행 단계가 아니다.

기존 소유 DuckDB 파일 소스 선택/업로드를 사용한다. 질문만으로 임의 DB에 접속하거나 인증 비밀을 생성하지 않는다. 새 커넥터, 파생 차원/CASE, 필터를 내장한 지표, 일반 SQL 역파싱, 기존 분석 수정, 게시·외부 엔진은 첫 범위 밖이다. 미지원 계산은 기존 지표로 임의 단순화하지 않고 요청을 좁히도록 알려 준다.

## 확인한 현재 코드와 재사용 경계

- `BiService.createMetric`: 소스 프로필·타입을 검증하고 Metric.definition을 저장한다. 지금은 `bi_`+randomUUID 이름이며 계산 의미의 중복을 막지 않는다.
- `metricFields`/`metricExpression`: SUM/AVG/COUNT/MIN/MAX/COUNT_DISTINCT/RATIO_SUM/WEIGHTED_AVG 구조화 계산기가 있다. SQL 문자열에서 의미를 추측하는 새 파서는 필요 없다.
- `BiService.prepare`: 기존 저장 지표 하나로 차트를 만드는 서버 컴파일 경로다. 요청/차트 수를 늘리기 위해 호출마다 지표를 먼저 저장하면 부분 실패 시 고아 지표가 생긴다.
- `AiDashboardService.generate`: 소유 소스의 활성 지표를 제공하고 명시 참조를 canonical 계산식으로 대체한다. 자유 SQL 생성 결과가 구조화 지표 정의로 저장되는 것은 아니다.
- `AiDashboardService.save`: 이미 `sharedManager?: EntityManager`를 받아 기존 저장 transaction에 참여할 수 있다. UC-004 batch save가 이를 사용한다. P2도 같은 manager로 지표·분석·저장 영수증을 묶는다. 별도 저장 엔진이나 전면 리팩터링을 추가하지 않는다.
- Dimension은 현재 원본 열 이름이다. 목표 논리 모델을 독립 차원 테이블의 현재 구현이라고 보고하지 않는다.

## 구조화 제안 계약

AI에는 소유 소스의 이름/열 이름·타입과 검증된 활성 지표 카탈로그를 제공한다. 접속 비밀·원본 파일 경로·원본 행은 보내지 않는다. 모든 표시 이름은 데이터로 취급한다. 저장 지표 후보를 이름만으로 자동 연결하지 않는다.

내부 `AnalysisProposal` version1:

```ts
{
  schemaVersion: 1,
  sourceId: number,
  sourceRevision: string,
  title: string,
  measures: Array<
    | { key: string; reuse: { metricId: number; definitionVersion: number } }
    | { key: string; definition: {
        label: string; aggregation: string; column: string;
        denominatorColumn?: string; weightColumn?: string; scale?: 1 | 100;
        unit: string; decimalPlaces: number; numberNotation: 'plain' | 'compact';
      } }
  >,
  dimensions: Array<{ key: string; column: string }>,
  blocks: Array<{
    key: string; measureKey: string; dimensionKey?: string;
    chart: 'number' | 'bar' | 'line'; title: string;
  }>
}
```

요청은2000자, proposal JSON은128KiB 이내, 제목300자/지표명100자/단위12자·소수0~6자리 등 기존 검증 상한을 따른다. 최대6블록·6지표·6차원, key는 배열별 고유, 참조 누락/중복과 알려지지 않은 필드는 거절한다. AI 제안 key는 임시 참조이며 DB ID/소유권이 아니다. 원시 SQL 필드는 받지 않는다. numeric dimension은 명시 분류 요청에만 사용하며, line은 temporal 원본 열만 허용한다. 차트 정렬·행 한도·숫자+시계열은 기존 컴파일·미리보기 기준을 재사용한다. 이번 첫 범위의 line은 원본 시간 열이고 추가 grain/timezone은 기존 지원 계약이 있는 범위에서만 허용한다.

## 지표 의미와 재사용

서버가 `metricFields`로 허용된 타입/필드를 검증하고 정규형을 만든다. 계산 identity에는 sourceId·tableName·aggregation·정규화한 column/denominator/weight/scale·unit이 들어간다. label·소수 자릿수·축약 표시는 계산 identity에서 제외하고 블록 표시로 유지한다. sourceRevision은 재검증 토큰이며 데이터 갱신만으로 같은 지표를 새로 만들지 않는다.

- 활성·같은 소스·같은 정규형만 재사용한다. 기존 여러 동등 정의가 있으면 가장 작은 ID를 일관되게 선택하며 결과에 표시한다. 계산/단위가 다른 동명이인 지표를 선택하지 않는다.
- 명시 metricId/definitionVersion은 소유권·활성·소스와 버전을 검증한다. 일치하지 않으면409 또는 접근 오류로 종료하고 새 지표로 바꾸지 않는다.
- 신규 지표의 내부 name은 `bi_v2_`+SHA256(정규형)으로 만든다. 기존 Metric.name unique 제약을 활용한다. 기존 random name은 조회만으로 재명명하지 않고 유효 정의 정규형 비교로 재사용한다.
- 새 지표 생성의 unique 충돌은 같은 정규형의 활성 정의인지 확인한 뒤 전체 transaction을 재시도한다. 비활성 행을 자동 재활성화하지 않는다. 같은 정규형의 비활성 deterministic name만 남아 있으면 명시 충돌로 종료한다.
- 저장 전 카탈로그를 다시 검사한다. 새 ID 대신 기존 지표를 재사용하게 되면 화면의 “새 지표” 계획이 달라지므로409 `PLAN_CHANGED`로 미리보기 재확인을 요구한다. 조용히 다른 의미/버전으로 저장하지 않는다.

동등 정의를 찾는 저장 경계 조회는 AI에 전달하는 최대30개 카탈로그와 분리한다. AI 카탈로그 밖의 기존 정의도 이름 추측 없이 정규형으로 찾는다. 유효하지 않은 레거시 정의는 재사용하지 않는다.

## 차원 identity와 snapshot

첫 범위는 원본 열 차원이다. 서버가 sourceId+검증된 원본 column의 정규 JSON을 SHA256으로 해시해 논리 dimensionId를 만들고 definitionVersion1·column·source type·label을 구조화 분석 snapshot에 저장한다. 모델이 준 key나 타입을 저장 ID/실제 열 타입으로 신뢰하지 않는다.

같은 소스·열은 다른 분석에서도 같은 논리 ID를 사용한다. 이 단계는 독립 차원 편집/카탈로그 저장을 구현하지 않는다. 공유 label/파생식의 개별 버전 관리는 후속이며, 조회만으로 DB에 새 차원 엔티티를 만들지 않는다. 열 삭제/호환되지 않는 타입 변경은 sourceRevision 불일치로 다시 제안·미리보기한다. 미래 파생 차원과 원본 열 차원의 ID 규칙을 혼합하지 않는다.

## 기존 분석에 연결

저장 snapshot은 기존 `schemaVersion:2 / kind:structured-bi-dashboard`의 items 계약을 재사용한다. block과 같은 순서로 sourceId/metricId/definitionVersion/definition/key/chart/dimension/presentation을 기록하고 원본 열의 dimensionDefinition을 추가한다. key는 저장 시 서버 blockId에 대응시킨다. dimension은 기존 compiler가 사용하는 원본 column 이름이며 dimensionId를 SQL 열로 해석하지 않는다.

`metric-analysis-links.ts`의 명시 참조 탐지를 재사용하여 같은 지표를 쓰는 KPI/OS 차트를 모두 UC-003/004 영향 확인 대상으로 연결한다. 저장 배치·복제/undo·내용/배치 AI가 dimensionDefinition을 보존하는 회귀가 필요하다. 새 snapshot kind 때문에 기존 참조 탐지에서 제외되지 않도록 한다.

## 제안·미리보기·저장 API 계획

아래 경로는 예정이며 아직 등록되지 않았다.

1. `POST /bi/analysis-proposals` — sourceId/prompt. 소유권·프로필·카탈로그 검증 후 기존 지정 LLM으로 구조화 제안을 얻고 서버 정규화 결과를 반환한다. DB 쓰기0.
2. `POST /bi/analysis-proposals/preview` — proposal. 소스 revision·열·지표 version을 확인하고 canonical SQL을 생성한다. 기존 dashboard preview의 KPI+추세/정확한 값·원본 정밀도를 사용한다. 저장될 정의의 digest와 지표 생성/재사용 계획을 함께 반환한다. DB 쓰기0.
3. `POST /bi/analysis-proposals/save` — proposal, previewDigest, requestId(UUID). 최신 소스/지표와 정규형을 재검증하고 동일한 정의만 저장한다. payload 변경은 미리보기 재확인이 필요하다. requestId는 첫 저장 클릭에서 만들고 네트워크 오류 재시도에서 재사용한다. source/지표/제안이 바뀌면 새로운 preview·requestId를 사용한다.

모든 입력은 클라이언트에서 바뀔 수 있으므로 제안 key/서버 생성처럼 보이는 SQL/digest를 권한으로 신뢰하지 않는다. digest는 정규화한 sourceId/sourceRevision·지표 참조 버전/계산·차원·블록·표시를 포함한다. 숫자 결과 행을 identity에 넣지 않는다. sourceRevision으로 결과 데이터 변화를 판별한다.

## 원자 저장과 재시도

P2 저장은 신규 `AnalysisCreationReceipt`의 **actorId+requestId DB unique 제약**을 사용한다. 영수증을 분석 JSON에서 검색하거나 메모리 mutex만 사용해 동시 요청의 중복 방지를 보장한다고 주장하지 않는다. 이 테이블과 migration은 저장 단계 구현 시 추가하며 이번 설계 작업에서는 DB를 변경하지 않는다.

한 metadata transaction 안에서 영수증 key를 확보하고, 활성 지표를 다시 검사/생성하고, 분석 snapshot에 실제 metricId/definitionVersion과 dimension 정의를 연결한 뒤 `AiDashboardService.save(..., sharedManager)`와 영수증의 dashboardId/응답 식별자를 저장한다. 중간 실패는 지표·Dataset·Widget·Dashboard·영수증 전체 rollback이다. LLM 호출은 이 transaction 밖에서 수행한다.

먼저 제출 payload를 구조적으로 정규화해 receipt digest를 계산하고 현재 actor의 영수증을 조회한다. 이미 성공한 같은 key/digest는 현재 소스·지표가 이후 갱신됐어도 기존 저장 결과를 반환한다. 새 저장일 때만 최신 소스·지표 재검증을 한다. receipt digest 계산에 현재 카탈로그 재해석이나 새 서버 blockId를 넣지 않는다.

동일 actor/requestId+동일 정규 payload digest는 저장한 dashboardId를 반환한다. 같은 key의 다른 payload는409이며 기존 분석/영수증을 바꾸지 않는다. 다른 requestId의 같은 지표는 지표1개를 재사용하되 서로 다른 분석을 만들 수 있다. 동시 생성으로 새 지표 계획이 재사용 계획으로 바뀌면 PLAN_CHANGED 후 다시 미리보기해야 하며 한 번의 저장 요청이 항상 성공한다는 뜻은 아니다. source 파일은 DuckDB snapshot 경계를 유지한다. `withDuckDBSnapshot`은 재진입 가능하지만 snapshot 안의 `duckDBVersion`은 고정된 파일 버전이므로 최신 원본 변경 감지에 단독 사용하지 않는다. metadata transaction에서 공유 manager로 현재 Database 원본 포인터/revision을 직접 읽어 preview의 소스 토큰과 대조하는 좁은 검증 경계가 필요하다. SQLite write 경계와 불변 파일 참조를 유지하여 소스 포인터 교체와 저장이 순서화되는지 interleaving 테스트로 확인한다. DB 저장이 파일을 원자적으로 갱신한다고 주장하지 않는다. 같은 영수증 재시도에서 분석이 이미 삭제됐으면 다시 생성하지 않고 명시 unavailable을 반환한다.

현재 한 상시 서버/SQLite 로컬 경계에서 transaction contention은 최대3번의 bounded transaction retry로 처리한다. 이 재시도에서 LLM을 다시 호출하거나 새 requestId로 바꾸지 않는다. 운영 DB/복수 서버 보장은 해당 DB의 unique·transaction 동시 실행 테스트가 통과해야 하며 SQLite 통과를 그대로 확대하지 않는다. 게시 영수증/외부 엔진을 함께 설계하지 않는다.

## 고객 UI

현재 AI 분석 만들기의 질문→결과→저장을 유지한다. KPI·추세/차트 아래 짧게 “지표2개 · 분류1개 · 기존 지표1개 재사용”을 보여주고, 계산/원본 열/새 정의/재사용 상세는 `계산 기준`을 펼칠 때만 표시한다. SQL이나 원본 파일 경로를 기본 표시하지 않는다. 오류 시 질문과 마지막 유효 결과를 유지한다. 일부 정의 생성만 성공한 것처럼 저장 완료를 표시하지 않는다.

설계 토큰은 기존 Analysis UI Kit: 버튼28px·입력32px·12px 보조 글꼴,390/768/1440px 실제 크기/간격/줄바꿈과 숫자+시계열 확인. 새 화면 모드/개발자 YAML 트리·전역 min-height 규칙을 추가하지 않는다. 현재 브라우저 auto-review 거절은 UI 구현 완료 증거로 대신하지 않고 실제 gate로 남긴다.

## Rill 비교와 수용 fixture

로컬 공식 소스 `../rill/web-common/tests/projects/openrtb/`에서 source HTTPS parquet→model→metrics view→Explore 연결, measures의 이름/표현식과 dimensions의 column/display_name 분리를 확인했다. Rill 코드 구조를 고객 파일 트리로 복제하는 것이 목표는 아니다.

공식 auction fixture의 requests는 SUM(bid_request_cnt), avg_bid_floor는 SUM(bid_floor)/SUM(has_bid_floor_cnt)이다. 후자를 단순 AVG(bid_floor)나 WEIGHTED_AVG로 바꾸면 실패다. 전역 요청 수634513000, 평균5.571238676526892(기존 상대 오차1e-9), OS별 요청 수 합계와 원본 SQL을 대조한다. KPI와 OS 차트는 같은 measure ID를 사용한다. 날짜 이동·UTC/PDT와 표시 반올림은 별도 차이이며 버킷 동일성으로 확대하지 않는다.

## 출하 조건

[TC-012](../test_cases/TC-012-semantic-creation.md)의 제안 DB무쓰기·canonical 계산·중복·rollback·권한/충돌·실LLM·실제UI 저장/새로고침이 필요하다. 현재 문서·설계 검증과 제품 기능 PASS는 별개다. [계획](../plans/UC-012.md)의 A/B/C는 구현 체크포인트이며 A만으로 고객 기능/P2 완료를 선언하지 않는다.

## A 구현 경계 — 2026-10-15

`POST /bi/analysis-proposals`는 `{sourceId,prompt}`를 받아 proposal·생성/재사용 plan·서버 draft·previewDigest·categoryLimit을 반환한다. `POST /bi/analysis-proposals/preview`는 `{proposal}`만 받아 다시 검증·컴파일하고 기존 숫자+추세 미리보기를 반환한다. 두 경로는 JWT 사용자 소스 소유권을 검사하며 저장 경로를 제공하지 않는다. LLM이 요청과 다른 소스나 revision을 반환하면 거절한다.

`semantic-proposal.ts`가 strict validator/identity/catalog를 담당하고 `structured-widget.ts`가 기존 BiService.prepare와 SQL 제작기를 공유한다. AI에는 열 이름·타입/숫자·시간 여부와 유효 카탈로그 최대30개만 제공하며 동등 비교는 전체 유효 카탈로그를 검색한다. 정확히 같은 계산·표시 정의의 임시 key는 합치되 표시 정밀도 등이 다르면 별도 블록 정의를 유지한다. 같은 identity의 여러 create plan 항목은 B 저장 시 하나의 지표 ID로 묶어야 하며 A의 plan 항목 수는 신규 DB row 수가 아니다.
