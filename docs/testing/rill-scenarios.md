# Rill 사례 기반 VM 데모 시나리오 실행

목표: 사용자 승인(2026-10-18)에 따라 [조사된 RXS-01~24](../strategy/2026-10-18-rill-examples-scenarios.md)를 실제 VM 기능·샘플 데모에 연결해 완료한다. **최신 판정: RXS01~24 선택 샘플 데모 범위 24/24 PASS**다. 아래 시간순 실행 기록의 ACTIVE/NOT_RUN은 당시 상태이며 최신 인수 표와 최종 판정이 우선한다. gpt-6-luna 유지, VoiceOver BLOCKED, 실휴대폰/실고객/운영 수용은 별도다.

## 계약과 작업 순서

VM 합성 샘플과 Rill 공식 샘플은 구분한다. VM 샘플의 고정 정답은 독립 계산하며 Rill 동일 원본 비교의 대체라고 보고하지 않는다. 원본 샘플은 실제 checksum/모델 시점 이동까지 맞춰 대조한다. 기본 비공개 소스만 준비하고 생성/저장/게시/외부 전송을 자동 실행하지 않는다. 기존 코드 변경·계정·서버·사용자 자료를 보존한다. 완료된 관련 기반은 최신 testing/status에서 재사용한다.

1. 기존 Studio 샘플 진입에 VM 비용·마진/앱 전환 데이터와 추천 질문을 연결한다. 미리보기/저장/재조회·모바일/키보드까지 실제 실행한다.
2. 집계 후 조건·저장 지표 조합을 구현하고 Cost 원본/Rill/독립 SQL로 검증한다. 원본 profit 열의 ratio를 보여주는 것만으로 지표 조합 완료라고 하지 않는다.
3. 시간 상세/AI 답변의 조건 연결·설명/표 Artifact·재사용을 완성한다.
4. 갱신 작업 지속 상태/재시작/스키마 영향·정정을 구현한다. 실패 시 마지막 성공 버전을 유지한다.
5. 조직/역할·행/열/LLM 전송 정책을 모든 서버 경로에 연결한다. 소유권이나 화면 필터를 기업 정책 구현으로 간주하지 않는다.
6. 권한이 적용된 임베드/대화 이력, 조건 알림/보고서와 추가 관계/통계를 구현한다. 외부 계정·유료 연결·실발송을 꾸며내지 않는다. 실제 커넥터가 정해지기 전에는 로컬 샘플 원천으로 운영 계약을 검증한다.

## 인수 조건과 추적 상태

공통 Given은 명시한 VM 샘플/권한/고정 소스 버전, When은 각 행의 제품 사용자 행동이다. Then의 숫자·저장·보존 조건은 mock 결과가 아닌 실제 제품 경계에서 확인한다. 각 행은 구현/하위 검사/실제 화면/Rill 대조를 구분해 갱신한다.

| ID | When / Then | 현재 상태 |
|---|---|---|
| RXS-01 | 마진 생성→전체 미리보기→비공개 저장/reload; 합계·단위·정의와 source 일치 | PASS_VM_RILL_SELECTED — 실제 Codex/저장3/reload·수치·세폭/키보드, 같은CSV Rill 전체기간 대조. 공식 Cost 원본/전체 조건 Open |
| RXS-02 | company별 매출≥1000·마진<20%; 원본 행 필터와 다른 집계 범위·NULL 구분 | PASS_SELECTED — 실제 VM/Rill 두 고객8행·Decimal/CSV 정답·기간 재자격/0분모·빈 결과·세폭/키보드. 표시 집계 CSV C1~C3·개인 조건 저장/복원·집계 Pivot S1~S3·대시보드 공통 조건 D1~D3·CSV E1~E2 후속 선택 PASS |
| RXS-03 | 저장 지표 조합→KPI/추세/Pivot/CSV; 전체 합계 재계산·0분모·음수·기존 정의 보존 | PASS_VM_SELECTED — 직접 조합10/11·실제 Luna 신규 조합12/저장7·KPI/추세/Pivot/CSV·0분모·세폭. Rill 계산 이익/마진 표시 대조, 비용률 후속 기록 참조. 재귀 참조는 미지원, 소스 재매핑은RXS11 후속에서 확인 |
| RXS-04 | 급증일→서비스/지역→기여 행; 기간/합계/복귀 조건 유지 | PASS_VM_RILL_SELECTED — 실제 Luna/저장5, 1월16일→Query→Incheon→원본1행/1715, Escape/복귀/세폭. Rill 동일 탐색/CSV 대조; VM raw 시간차트 기여 지원 Open |
| RXS-05 | 앱 단계별 전환 생성; 합계 분자/분모·distinct·0분모 명시 | PASS_VM_RILL_SELECTED — 실제 Codex/저장4/reload·합계비율·세폭/키보드, 같은CSV Rill 전환합계/두비율 대조. 사용자 distinct/필터·기간 비교 Open |
| RXS-06 | 두 버전 추세→시간 상세→Pivot→복귀; 동일 조건·키보드 | PASS_VM_RILL_SELECTED — 실제 서버/화면840/1014·20%/23.25688…%, 시간 상세/Pivot/복귀·필터 무효화·409/명시 재조회·세폭/키보드. 저장 보기/CSV/UTC외·운영은 별도 |
| RXS-07 | 커밋/파일 관계→경로 분석; 1:N 중복·파일명/경로 정의 | PASS_VM_RILL_SELECTED — 실제 파일 선택/사전 연결·경로 파생·Luna 6블록/저장15/reload·활동4/경로6/파일명4/추가62·동일CSV Rill·세폭/키보드. 전체 부모 커밋/Pivot 확장은 별도 |
| RXS-08 | fact+lookup 결합; 중복키/미매칭·금액/행 보존·비가산 안내 | PASS_VM_RILL_SELECTED — 중복 사전 차단→정상 연결/미매칭2 명시 유지·8행/800USD/14건·Luna 5블록/저장16/reload·비가산 실제400/AI 원본 ID 질문·Rill/세폭/키보드. 일반 다중테이블·기업 열 보안은 별도 |
| RXS-09 | KPI+표+설명 보고서→저장/게시; 동일 정의·근거·초안/게시 구분 | PASS_SELECTED — 실제 Luna4블록/저장9·표/집계 요약·비공개 게시1/익명403·필터/모바일 키보드/세폭. 다중 지표 열·자유형 분석문/클레임별 인용은 후속 |
| RXS-10 | AI 답변→동일 조건 분석 링크; 기간/지표/권한/버전 일치 | PASS_VM_RILL_SELECTED — 단일 지표·차원 저장본→동일 조건 탐색·버전/digest409·기간735/고객1763.65·세폭/키보드. Rill Flat Pivot 전달 대조; VM의 중간 확인 단계/직접 Pivot UX 차이는 명시 |
| RXS-11 | 샘플→내 파일 매핑→새 복사본; 새ID/독립 정답·원본 불변 | PASS_VM_RILL_SELECTED — 실제 CSV 업로드·단위 확인·FORMULA 새 의존 지표/복사본11·표/요약 복사본12·배치/reload·세폭. 공개 수신자/모든 형식·운영 별도 |
| RXS-12 | 실제 소스/지표 오류→수정안→재미리보기; 성공본·비대상 유지 | PASS_SELECTED — 실제 열 교체 거절→서버 근거/실제 Luna 연결안→명시 매핑·USD 확인→3블록 미리보기/복사본17/reload·원본60.89%/복구123.31%·게시/배치 보존·세폭/키보드. 자유형 SQL 자동 수정은 별도 |
| RXS-13 | 환불률 분모 확인→수정/저장; 주문/금액 기준·없는 열 대체 금지 | PASS_SELECTED — 기존 금액21.23% 재사용·새 source6 주문22.86%/비공개8 저장/reload·Rill 동일37주문/세폭. 모든 자연어·운영 별도 |
| RXS-14 | 없는 금액 질의; 비율로 바꾸지 않고 필요한 자료 질문 | PASS_SELECTED — 실제 Luna 앱 데이터의 매출/단가 부재 질문·대체/미리보기/저장0·세폭 안내. 일반 자연어 전 범위 보장 아님 |
| RXS-15 | 새 파일 갱신; 이전/현재 데이터 시점·게시 불변 | PASS_VM_RILL_SELECTED — 실제18→19행 교체/Studio11 reload·121.91%/기존 비공개 게시123.31% 불변·업무/수집시점 구분·세폭/Enter. 지속 작업/운영 별도 |
| RXS-16 | 중단/재시작→동일 작업 확인; 성공본 보존·중복 활성화0 | PASS_VM_RILL_SELECTED — 실제 API 프로세스 종료/재기동·동일 작업 UUID/명시 재시도·20→1,000,000행 활성화1회·게시 불변·응답 유실 GET 복구·세폭/Enter. 물리 취소/운영 전체는 후속 |
| RXS-17 | 열 삭제/타입 변경→영향 블록/재매핑; 기존 수치 보존 | PASS_VM_RILL_SELECTED — 실제 삭제/타입 변경 거절·지표2/블록3 영향·새 파일11/명시 매핑·비공개13 저장/reload·원본/게시/배치 보존·Rill60.89%·세폭/키보드. 저장 분석 범위/일반 위젯·Pivot 등 제외 명시 |
| RXS-18 | 지연/정정 배치 재수신; 중복0·업무일/수정시점 구분 | PASS_VM_RILL_SELECTED — 업무 키/수정 시점 명시·실제3→4행/1000·90·910 USD/9%·동일 배치 no-op·동일 시점 충돌 거절·서버 재시작/설정 보존·Luna/저장14/reload·세폭/키보드. 전체행 단일 키/삭제 미지원 |
| RXS-19 | 작은 표본→큰 대표 데이터; 제한/시간/메모리·취소 | PASS_VM_SELECTED — 작은20/100만 재사용·실제400만행 적재/Decimal/게시 불변·별도400만 실행 중 Enter 취소/후보·입력 정리/기존20행 불변·RSS/시간·세폭. 반복 합성 데이터/운영p95·OS 메모리 상한 별도 |
| RXS-20 | 최신 성공 집계 임계값→보고/알림; 오래된 결과/중복 발송 방지 | PASS_SELECTED — 본인 수신 앱 안 예약/임계값, 실제 서버 재시작 자동 재개·발생1건·미달/범위변경 알림0·모바일/키보드 |
| RXS-21 | 관리자/그룹별 조회; UI/API/AI/export 권한 일치·회수 차단 | PASS_SELECTED — 실제 관리자/파트너2계정, 회수·만료403·이전값 제거·기존 공개링크403·세폭/키보드 |
| RXS-22 | 파트너A/B 조회·필터/속성 조작; 타 고객 데이터0 | PASS_SELECTED — 동일 분석21 A4260/B1171.25, 필터/상세/CSV·다른 scope409·서버 강제 행 범위 |
| RXS-23 | 외부 사용자 민감열 제한; schema/근거/계산/AI/CSV 금지값0 | PASS_SELECTED — 숨긴 company/cost/profit 미제공·필터400·소스403·A실제 Luna·BAI거절·허용 메타데이터 계약 |
| RXS-24 | 인증 embed→상태/테마→대화; identity·만료·대화 격리 | PASS_SELECTED — 동일 origin 포털·실제 Luna/허용 지표·typed 필터/테마·계정/같은JWT그룹 변경/만료·외부 frame 차단·세폭/키보드 |

## 첫 구현 범위와 데이터

기존 `/studio/new`에서 매출·환불/Rill 광고 샘플은 유지하고 VM 합성 비용·마진과 앱 전환을 추가한다. 같은 소유자의 동일 샘플은 실제 수치 재확인 후 재사용하며 다른 계정은 별도 비공개 소스다. 샘플 입력에 경로/URL/정책을 받지 않는다. 마진의 profit은 샘플에 명시한 파생 원본 열이며 일반 지표 조합 엔진을 구현한 것으로 집계하지 않는다. 앱 전환은 집계된 단계별 수치이며 사용자 이벤트 순서/코호트 엔진이 아니다.

첫 단위: source별 합계/oracle·손상된 재사용 거절·actor 분리·동시 샘플 요청·등록 실패 정리. UI: 샘플 종류/출처·질문 보존·지원 열에 맞는 추천·선택 시 AI호출0. 실제 새 로컬 계정에서 요청/LLM 생성/저장/reload와390/768/1440 화면·키보드를 확인한다. 실행 결과/증빙은 완료 후 아래에 기록한다.

## 2026-10-18 첫 데모 실행 — Ego25

격리 Node24.21.0 API4560/FE3460, metadata/uploads는 `/tmp/vm-rxs-demo/`다. 기존 서버·DB·사용자 자료는 수정하지 않았다. 새 테스트 계정에서 소스4(마진18행)/5(전환16행)를 준비했으며 기본 비공개다. 샘플 버튼은 설치/프로파일만 수행하고 AI·대시보드 쓰기를 자동 실행하지 않는다. 기존 매출·환불과 공식 광고 샘플은 코드/기존 증빙을 유지했다.

| 결과물 | 실제 제품 경로 | 독립 정답 |
|---|---|---|
| VM 마진 데모 | `/studio/new`→비용·마진 샘플→실제 gpt-6-luna 요청→5블록 미리보기→명시 저장→`/dashboard/3/studio`→reload/소유 API | 매출14937.49 USD, 비용12279.94 USD, 이익2657.55 USD, 마진17.7911416175…%=표시17.79%. 고객6개 이익 합계2657.55 |
| VM 앱 전환 데모 | `/studio/new`→앱 전환 샘플→실제 gpt-6-luna 요청→6블록 미리보기→명시 저장→`/dashboard/4/studio`→reload/소유 API | 방문8560/다운로드1854/가입555. 다운로드21.6588785…%=21.66%, 가입29.935275…%=29.94%. v1.9=840/v2.0=1014 |

금액 CSV는DOUBLE 추론이며 worker oracle은DECIMAL(18,2)로 검사한다. 실제 생성 결과는 독립 Decimal 기대값과1e-9 오차 이내로 비교했고 표시 금액은 소수2자리다. 원본 profit 열은 센트 정수로 revenue-cost를 만든 **fixture 열**이다. RXS03의 저장 지표 조합 구현이나 회계 정밀도 전반의 보장이 아니다. 앱 수치는 단계별 집계이며 user ID/이벤트 순서·distinct 사용자 분석을 추가 구현한 것이 아니다.

마진 샘플은 실제 버튼 focus→Enter로 선택, 저장은 focus→Enter로 실행했다. 두 저장본390px에서 설정 버튼Enter→모바일 Sheet→Escape 후 같은 설정 버튼으로 초점 복귀를 확인했다.1440/768/390에서 문서 scrollWidth는 각 innerWidth와 같다. 일반 버튼36px/14px·정렬·긴 회사명·차트/숫자·모바일을 실제 캡처로 열어 확인했다. 첫 resize 즉시 측정에서1776/1416px가 나온 기록도 보존하며 배치 안정화 후1440/768px로 재확인했다. 이를 지속 넘침 실패나 즉시 무조건 넘침0으로 바꾸어 기록하지 않는다.

하위 검사: 실제 DuckDB fixture8개+샘플 서비스 선택3개=11 PASS(무관한 기존4개 skip), FE StudioCreate/Remix39 PASS, FE type·변경BE/FE lint·양쪽build PASS. 처음 추가 fixture의 날짜 찾기 테스트가 TIMESTAMP 문자열을 DATE 문자열로 찾던 문제와 서비스의 enum 타입 오류를 수정한 뒤 통과했다. 신규 자동 UI suite는 추가하지 않았고 관련 없는 전체/core 테스트는 반복하지 않았다.

검증 환경의 첫 UI 로그인은 CORS origin 누락으로 실패해 해당 격리 서버의 origin만 수정했다. signup이 정상 텍스트를 반환하는데 임시 검증 스크립트가JSON으로 읽던 문제도 고쳤다. 제품 인증 코드는 변경하지 않았다. API로그/인증정보는 증빙에 복사하지 않았다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-scenarios-20261018/`. `samples-api.json`, `margin-saved.json`, `funnel-saved.json`, `oracle-checks.json`, `margin-layout-stable.json`, `funnel-layout.json`, `gallery-layout.json`, 세폭 screenshot, 관련 검사 로그. 실제 model 호출은2회이며 mock/다른 모델/로컬 LLM/공개 게시0이다.

남은 목표: **RXS01/05 선택 범위만 부분 검증**. 당시 나머지22개 새 시나리오는 NOT_RUN이었으며 기존 기반 PASS는 연결 검토 후 재사용한다. 다음은 RXS02의 집계 후 조건과RXS03의 지표 조합을 VM·Rill 같은 입력에서 구현/검증한다. Rill 실행 바이너리는 현재 호스트에 없으므로 공식 데모/원본 조사만으로 실제 Rill 화면 비교를 새 PASS로 올리지 않는다. 전 시나리오 완료·기업 권한·운영 준비·고객 수용·실휴대폰·VoiceOver는 완료가 아니다.


## RXS02 집계 조건과 Rill 실대조 — Ego25 후속

### 범위 / 서버 계약

`POST /bi/explore/segments`는 소유자 권한을 확인한 DuckDB 고정 버전에서 원본 WHERE/기간 → 선택한 차원별 GROUP BY/HAVING(1~3조건 AND) → 통과 대상의 원본 행(null-safe join)을 계산한다. 클라이언트 SQL을 받지 않으며 저장 지표의 서버 compiler 식과 bound 숫자를 쓴다. KPI/UTC 일·주·월 추세/원본 상세는 같은 통과 행에서 다시 집계하며 비율을 회사별 비율 평균으로 계산하지 않는다. 대상 표50개/추세200점/상세50행 페이지의 한도를 표시하고 전체 합계/대상 수는 제한 전에 계산한다. alias와 같은 이름의 원본 열도 scoped_rows 투영으로 구분한다. NULL 시각은 추세에 넣지 않으며 전체 KPI에는 포함될 수 있다.

지표 탐색의 별도 **집계 조건** 탭을 연결했다. 기존 Explore/Pivot 결과·저장/CSV에는 적용된 것처럼 표시하지 않는다. 미지원 요청 필드는 서버에서 거절한다. 조건/기간/필터 변경은 이전 결과와 지연 응답을 무효화하며 명시 적용 전 자동 조회0이다. 최대6지표/3조건이고 % 지표는20%를20으로 입력한다. 결과의 지표 단위/소수 자리수를 보존한다. 이 기능은 기업 행 정책이나 저장 지표 조합이 아니다.

### 실제 데이터·화면 결과

- VM source4에서 총매출≥1000 AND 마진<20 → Hanul Foods/Baro Tech,8행. 매출5431.25·비용5138.46·이익292.79 USD, 마진5.3908400460…%. Python Decimal로 CSV를 독립 그룹 집계한 정답과 실제 API 값이1e-9 이내다. 추세7시점/원본8행과 두 대상 표를 실제 UI에서 확인했다.
- 기간을2025-01-13~19 UTC로 변경한 실제 API는 Hanul Foods1개/2행/매출2260을 반환했다. 이전 기간의 고객 자격을 재사용하지 않는다.
- 원본 revenue≤0만 남기고 마진<20을 적용한 실제 API는0대상/0행/합계와 비율NULL이다. 분모0을 가짜0%로 만들지 않는다.390px UI에서 매출 기준999999의 빈 결과→키보드 Enter로 정상 조건 재적용/8행 복구도 확인했다.
- Node24.21.0 하위검사: 새 segment14개(실 DuckDB·권한/revision·NULL category/문자열null·0분모·정확 전체 합계/한도·alias 충돌) PASS. FE SourceExplore47+segment3=50 PASS, 표/오류문구 후속은 segment3+creationError9=12 PASS. byte동일 fixture2 PASS. FE type/lint/build 및 BE build PASS. 처음 FE 테스트에서 프로젝트에 없는 jest-dom matcher를 사용한 오류를 기본 DOM 값 검사로 수정했다. 루트에서 잘못 시작한 전체 테스트 명령은 확인된 자기 프로세스만 중단하고 backend 디렉터리의2개 선택 검사로 바꿨다. 중단 실행은 전체 PASS로 집계하지 않는다.

Rill **v0.90.5** 공식 darwin_arm64.zip144,698,983bytes/sha256`d13eb10a4ae890e149be85858f2467016e4f385ed3fe0ff445ca9357a76f80b7`를 검증하고 `/tmp/vm-rxs-demo/rill-project`를9019/49019에서 실행했다. Rill Cloud·Rill AI·외부 게시0이며 VM 제공자는 기존 gpt-6-luna다. 저장소의 [실행 가능한 비교 프로젝트](../../samples/rill-scenarios/README.md)는 VM과 바이트가 같은 두CSV/소스/지표/Explore를 포함한다. 공식 Cost/App 원본을 같은 데이터라고 바꾸어 보고하지 않는다.

Rill 마진 전체 기간은14,937/12,280/2,658USD·17.79% 표시로 VM의 센트 정답과 표시 반올림 범위에서 일치했다. 동일 company 집계 조건을 입력한 뒤8행/이익292.79/마진5.39%를 확인했고, **Rill UI의 Export model data→CSV**로 받은8행을 Decimal 합산해5431.25/5138.46/292.79를 정확 대조했다. Rill 지표는0~1 값을 percentage로 표시하므로 마진 조건은0.2, VM은 scale100/%이므로20이다. 처음20을 입력했을 때 동등하지 않아0.2로 바로잡았다. 편집기→Preview 이동 시 기간이 최근7일로 돌아가므로 최종 Preview에서 All time을 다시 적용했다. 이 차이를 수치 불일치나 모델 실패로 분류하지 않는다.

전환 대시보드도 Rill All time에서8,560/1,854/555·21.66%/29.94%를 확인했다. 이는 집계 단계 비율이며 사용자별 distinct 퍼널, 신규/기존·기기 필터 및 기간 비교의 전체 RXS05 완료를 뜻하지 않는다.

### 디자인·키보드·증빙

실제390/768/1440에서 scrollWidth=innerWidth. shadcn Card 기본 gap과 space-y의 중복 여백을 제거하고 입력/비교/삭제 행을 데스크톱 가로 정렬·모바일 세로 정렬했다. 원본 표와 대상 표는 페이지를 늘리지 않고 내부 가로 스크롤하며 focus 가능한 이름 있는 region이다.390px에서 `대상별 집계 표` focus→ArrowRight 후scrollLeft40을 확인했다. Enter로 적용/빈 결과/복구, 긴 회사명·숫자·단위·버튼/입력36px/14px를 확인했다. Ego의 회차 사이 viewport 상태를 가정하지 않고 최종 각 회차에 폭을 다시 지정했다. fullPage 캡처는 먼저scrollTop0으로 이동한 `final` 파일을 대표로 사용한다. VoiceOver BLOCKED/실기기 미검증은 유지한다.

증빙 폴더는 앞 절과 같다. `vm-qualified-api.json`, `vm-qualified-period.json`, `vm-qualified-zero-denominator.json`, `segment-layout-final.json`, `segment-keyboard.json`, `segment-empty.json`, `vm-qualified-final-{390,768,1440}.png`, `vm-qualified-empty-390.png`, `rill-margin-all.png`, `rill-margin-qualified.png`, `rill-qualified-rows.csv`, `rill-funnel-all.png`.

### 검토 후 보완 / 남은 목표

별도 검토에서 신규 VM 고정 USD 소스의 AI 단위 검증 누락을 찾아 정확한 현재 fixture tag+checksum+단일 활성 파일에만 USD 문맥을 제공하고 제안 미리보기/캐시 저장 전 재검증하도록 보완했다. 일반 CSV 통화는 추측하지 않는다. 교체/추가 버전·잘못된tag/checksum은 고정 문맥을 사용하지 않는다. 금액 열에 KRW/%/count를 붙이는 응답과 비율 단위를 거절하고 안전한 UI 문구를 연결했다. 파일 등록 실패 시 실제 실패 import만 제거하고 기존 등록 sibling이 남는 것도 보강했다. 이 하위검사는 creation87/sample7 PASS다. 기존 실제2회 모델 결과의 USD/% 정의는 확인했으며 이 검토 후 추가 실제 LLM 생성은 반복하지 않았다. 소스 이름의 버전 간 중복 식별은 후속 UX이고, 원본 profit identity 확인은 수식/반올림 guard이며 독립 정답 근거는 고정 합계·외부 Decimal 집계다.

이 시점은 **3개 시나리오의 선택 데모 범위만 검증**, 전체24 목표 ACTIVE다. RXS03은 구현 중이며 나머지20개는 아직 새 실행하지 않았고 기존 기반은 다음 단계에서 연결해 재사용한다. 다음 우선 작업은RXS03 저장 지표 조합(제한 AST/의존 버전/전체 경로)과 RXS04/06 탐색 왕복이다. 조직·행/열·LLM 정책·인증 embed·지속 refresh/관계/알림은 여전히 미구현/미검증 부분이 있으므로 기업 전체 기능 완료라고 표시하지 않는다.


## RXS04 비용 기여 탐색 — Ego25 후속

같은 source4를 재사용해 실제 gpt-6-luna로 총비용/날짜 추세/component/location4블록을 제안하고 명시 비공개 dashboard5에 저장했다. 모두 기존 총비용 지표#2/v1을 참조한다. 신규 단위 검증 이후 실제 제안/저장도 통과했으며 원본 profit에 의존한 계산은 없다. 현재까지 실제 VM 모델 호출은3회, Rill AI/외부 게시0이다.

Studio의 `기존 보기`로 이동해 총비용 KPI 시계열 표의1월16일을 키보드Enter로 선택(전체12,279.94→1,715 USD) → component 표 Query 필터 → location 표 Incheon 필터 → 해당 그룹 기여 원본을 Enter로 열었다. 실제 원본1행은2025-01-16 09:00:00/Cheonji Retail/Query/Incheon/Q-100/analytics, revenue2450/cost1715다. 별도 Python Decimal의 최대일 집계·선택 행과 일치했다. 이 날짜는 합성 기간 내 최대 비용이며 원인 추론/인과 주장을 하지 않는다.

1440/768/390의 상세 dialog 너비1200/736/358px, 문서넘침0. Escape 후 같은 `이 항목의 집계 원본 행 보기: Incheon` 버튼 초점과 날짜·두필터가 유지됐다. 지역/컴포넌트 chip 해제→선택 기간 되돌리기로 전체 기간·필터없음·12,279.94로 복귀했다. 기존 시간상세의 무관한 PASS는 반복하지 않았다. 증빙은 `cost-saved.json`, `cost-independent-oracle.json`, `cost-contributors-{1440,768,390}.png`, `cost-contributors-layout.json`, `cost-return.json`이다.

제약: Studio의 raw timestamp line은 기존 안전 증명기가 기여 원본을 지원하지 않아 안내를 표시하며, 이번 선택은 안전 지원되는 KPI 시간 선택+차원 차트를 이용했다. 이 제한을 우회해 원본을 추정하지 않았다. Rill의 동일 시간/차원 왕복은 아직 실행하지 않아 이 시나리오는 VM 선택 범위만 PASS다. 새 제품 코드 수정은 없으며 앞 절의 RXS02 후속 UI 충돌 안내는 별도로 보완했다.

RXS02 별도 검토 후 실제 브라우저 XHR **한 건**의 sourceRevision만 의도적으로 낡은 값으로 바꿔 서버409를 확인했다. 제품 서버/데이터/인증을 바꾸지 않았고 hook은 첫 전송 전 원복했다. 새 `카탈로그 다시 불러오기` 버튼을 Enter로 실행해 조회 복구를 확인했다. 이 명시 동작은 기존 카탈로그 재조회와 같이 탐색 조건을 초기화하므로 UI에도 이를 알린다. 통화 기호는 prefix, %는 공백 없는 suffix로 KPI/추세 표기를 맞췄다. `segment-conflict.json`은count1/status409, `vm-qualified-conflict-390.png`는 실제390px다. 관련 segment3+계산 제작2의5테스트 PASS. 이후 RXS03의 새 화면은 별도 IN_PROGRESS다.

## RXS03 저장 지표 조합·AI 신규 계산 — Ego25 후속

### 구현과 서버 경계

저장 지표의 정확한 ID/definitionVersion을 참조하는 제한 AST를 공통 metric compiler에 연결했다. add/subtract는 같은 단위, ratio는 같은 단위끼리 나눠 무단위/백분율을 만든다. SQL·문자열·임의 상수·클라이언트가 제공한 operand snapshot은 거절한다. 서버가 소유권·동일 소스·활성 상태·정의 버전을 확인한 뒤 피연산자 정의를 고정한다. 깊이4/고유 참조6이며 FORMULA를 다른 FORMULA의 잎으로 쓰는 저장 의존은 현재 거절한다. `(매출-비용)/매출`은 식 안의 subtract 노드로 지원한다. COUNT의 빈 레거시 단위는 count로 해석하며 금액/%로 표기한 COUNT는 조합하지 않는다.

지표 탐색의 계산 지표 화면은 미리보기→명시 저장이며, 같은 compiler를 Explore·Pivot·CSV·집계 조건·Studio 참조에서 사용한다. 원본 profit 열로 대체하지 않는다. 저장된 계산식은 참조 지표의 **고정 과거 정의**로 유지된다. 새 AI 계산안은 미리보기/첫 저장 직전에 현재 operand 정의를 다시 확인하며 변경/비활성/버전 차이는409로 차단한다. 기존 저장 FORMULA를 참조할 때는 그 고정 정의를 보존한다. 지원하지 않는 소스 재매핑은 거절한다.

### 실제 제품 결과

- source4의 총매출#1/v1·총비용#2/v1에서 직접 `계산 이익`#10=`매출-비용`, `계산 마진`#11=`(매출-비용)/매출×100`을 만들었다. 미리보기 전후 metric9개로 쓰기0, 명시 저장 후11개였다. 결과2657.55 USD/17.7911416175…%는 원본 CSV의 독립 Decimal 정답과1e-9 이내다. Explore14시점·company×location Pivot·CSV81레코드의 grand_total에서 합계 기준으로 재계산한다. 원본 revenue≤0에서는 이익-210·마진NULL이며 가짜0%를 만들지 않는다.
- 실제 gpt-6-luna로 저장10/11을 그대로 참조하는4블록을 생성→비공개 dashboard6 저장/reload했다. 이익/마진 KPI·day 추세·company 마진이며 SQL에서 원본 profit 열을 사용하지 않는다. 계산 근거는 실제 실행 SQL과 canonical SQL이 일치할 때만 operand 이름·ID·버전을 표시한다. SQL/설정/고정 정의 본문은 이 근거 패널에 노출하지 않는다.
- 다음 실제 gpt-6-luna 질문은 **선택한 총비용·총매출로 신규 비용률**을 만들도록 했다. 모델이 AST의 비용#2/v1÷매출#1/v1×100으로3블록을 제안했고 단위%는 서버가 추론했다. KPI82.20885838249933%=표시82.21%, day14행/company6행이다. 제안 전후 metric11/dashboard6으로 쓰기0, 명시 저장 후 metric12/dashboard7로 각1개만 늘었다. 세 블록은 같은 신규 지표#12를 참조한다. 저장/reload·소유 API와 원본 CSV Decimal82.20885838249933556440874605를 대조했다. 원본 지표1/2의 v1/SUM 정의는 유지된다.

현재 실제 VM 모델 호출은5회(초기 마진/전환·비용·저장 계산 참조·신규 비용률)다. 모두 기존 Codex/gpt-6-luna이며 다른 모델·로컬 LLM·Rill AI·공개 게시0이다. 실행 중단으로 없어진 격리 API4560/FE3460/Rill9019는 기존 임시 DB/파일로 재기동했다. 무관한 사용자 서버를 중지하지 않았다.

### 검증과 증빙

하위 검사: compiler19+실 DuckDB/SQLite 통합6=25 PASS, 계산 근거 BE6/FE7, 계산 제작/기존 탐색 FE21, Studio 생성 FE30 PASS. AI 신규 조합 추가 후 Studio creation 전체92 PASS(신규5 포함): 쓰기 없는 미리보기, 원자 저장/reload/영수증 재시도, operand 버전/같은 버전 정의 변경/비활성의 저장409·추가쓰기0, 모델 unit/snapshot/SQL/다른 소스 변조 거절을 포함한다. BE type/lint/build도 통과했다. 첫 신규 테스트의 StudioBlock에 없는 sql 속성을 읽던 오류는 실제 preview SQL 검사로 고쳤다. FE 소스가 바뀌지 않은 후속에는 직전 FE type/lint/build를 재사용했다. 별도 읽기 전용 검토에서 신규 AI 경로의 구체적인 결함은 발견되지 않았으며 운영 동시 변경 검증을 대신하지 않는다.

직접 계산·저장6/근거와 신규 저장7의390/768/1440 대표 화면을 남겼다. 신규7은 키보드Enter로 제안/저장,390px 설정Enter→Sheet→Escape/원래 설정 버튼 초점 복귀, reload와 문서 넘침0을 확인한다. 이미지 직접 확인과 추가 Rill 대조 결과는 아래 후속에 이어 기록한다. VoiceOver BLOCKED·실휴대폰/운영 수용은 별도다.

증빙: `formula-api.json`, `formula-pivot.csv`, `formula-zero-api.json`, `formula-saved-final.json`, `formula-builder-*`, `formula-evidence-*`, `ai-formula-proposal.json`, `ai-formula-saved.json`, `ai-formula-saved-*`, `ai-formula-layout.json`. 인증정보/API 원문 로그는 증빙에서 제외한다. Rill 같은 CSV의 calculated_profit/calculated_margin은 $2658/17.79% 표시로 대조했으며 고정 정답의 센트/원시 정밀도는 VM API/CSV·독립 Decimal을 따른다.

전체24 목표는 ACTIVE다. 계산 지표 소스 재매핑·저장 FORMULA 재귀 참조·임의 자연어/운영·게시의 모든 변형은 이번 PASS에 포함하지 않는다. 다음은 RXS06 차원 값별 동시 추세·동일 조건 상세/Pivot 왕복이다.

### RXS03/04 Rill 추가 대조

Rill의 같은 CSV에 cost_ratio=SUM(cost)/NULLIF(SUM(revenue),0)를 추가해 전체기간82.21%를 실제 DOM에서 확인했다. calculated_profit/calculated_margin과 함께 VM 신규 저장 비용률의 표시 결과가 일치한다.7지표가 있는 Explore의 고정 내부 스크롤 때문에 첫 fullPage 이미지에서 마지막 비용률 카드가 화면 밖일 수 있으며, 실제 값 확인과 전용 상세 캡처를 분리했다. Rill은 원시 합계 식을 쓰며 VM 저장 지표 참조 버전 API를 제공하는 것으로 해석하지 않는다.

RXS04는 Rill 기간 입력에 `2025-01-16 to 2025-01-17`→Query→Incheon→Model Data를 열어1/18행·비용1715 USD를 확인했다. UI의 Export as CSV로 받은 실제1행도 Decimal1715.0/Cheonji Retail/Query/Incheon과 일치한다. `rill-cost-contributors.png/.csv`가 추가 증빙이다. VM에서 이미 통과한 같은 조건은 반복하지 않았다. VM raw timestamp line 기여 증명 미지원은 그대로 Open이며 Rill에서의 지원을 VM 완료로 바꾸지 않는다.

신규 비용률7의 대표 캡처를 직접 열어1440/390의 제목·3블록 정렬·단위·긴 회사 이름·포커스·축 라벨을 확인했다. 저장 버튼36px/14px, 세폭 문서 넘침0이다. Ego 검증 스크립트의 잘못된 w 변수와 이름 없는 role locator는 고쳐 해당 관찰만 재실행했으며 제품 오류가 아니었다.

## RXS13/14 분모 확인·없는 금액 안내 — Ego25 후속

기존 UC033/Ego75의 금액 기준 저장42·주문 기준 미리보기, UC034의 누락 열 소스 교체 PASS를 재사용했다. 이번에는 같은 공개 합성37주문을 **새 검증 DB에서 시연 가능한 source6**으로 준비하고, 미검증이던 주문 기준의 비공개 저장/reload를 연결했다. 원본 CSV4개는 manifest SHA256을 확인했고 succeeded payment의 서로 다른 주문35개·refund가 있는 결제 주문8개를 독립 계산했다. 주문 기준8/35×100=22.8571428571…%, 금액 기준4457.60/20994.61×100=21.2321162431…%로 서로 다른 정의다. 주문 ID와 결제 event를 직접 조인해 중복 합산하지 않는다.

RXS13 실제 흐름: `/studio/new`→매출·환불 샘플→분모 없는 환불률 질문→계산 전 확인만 제공→`결제 완료 주문 수` 선택/Enter 답변→실제 gpt-6-luna 미리보기22.86%+ordered_at 추세→Enter 명시 저장8/reload·소유 API. 지표#13의RATIO_SUM(refunded_orders,paid_orders)/scale100은 두 블록에서 재사용되며 기존 마진·전환·계산 지표 정의는 변경하지 않았다.390/768/1440 넘침0, 저장 후 숫자/단위/버튼/차트 정렬을 캡처했다. 이익·환불 이벤트일 분석이나 모든 자연어 분모 판별 완료로 확대하지 않는다.

RXS14 실제 흐름: source5는 visits/downloads/signups와 전환율이 있지만 매출/단가는 없다. raw 열 이름을 지정하지 않은 `다운로드 수나 전환율이 아닌 총 매출 금액(USD)` 질문을 실제 gpt-6-luna로 보냈다. missingColumns 질문이 금액/단가 부재와 성공 결제 금액 자료를 요청했고 semanticProposal=[]/preview 없음·저장 버튼 없음이었다. 이 뒤 metric13/dashboard8로 추가 생성이 없었다.390/768/1440 안내를 캡처했다. 모든 누락 열 질문에도 보이던 ‘분모를 추측하지 않는다’ 보조문구를 누락 자료 안내로 구분했다. 변경 중 Vite HMR이 초기화한 화면은 기존 proposalId 읽기 전용 복원으로 재열어 **모델 재실행 없이** 수정 안내만 재검증했다. 기존 정상 안내를 제품 서버 재시작 복구 증거로 해석하지 않는다.

하위 검사: 같은 변경 구간의BE creation92와FE StudioCreate30 PASS를 사용했다. 신규 안내는 문구 분기만 바꾸며 엔진/권한/저장 API를 수정하지 않았다. missing raw requiredFields의 계산/저장 거절은 기존 creation 회귀를 재사용한다. 실제 모델은 누적7회이며 모두gpt-6-luna, Rill AI/외부 게시0이다. 고객사/운영/실휴대폰/VoiceOver는 별도다.

Rill 재현 파일 `data/commerce.csv`는 공개37주문 원본4개에서 독립 Python Decimal로 만든 **주문 코호트**다. `prepare-commerce.py`가 SHA256/각 합계/35·8을 확인하고 다시 생성한다. Rill commerce_explore All time에서35/8·22.86%/21.23%를 확인했다. 원본 event-date cashflow를 이 코호트로 바꾸어 설명하지 않으며 표시 반올림과 원시 정밀도도 구분한다. VM 추세는 raw ordered_at, Rill 대표 화면은 month이므로 **KPI와 분모만 대조**, 동일 추세 UX PASS로 집계하지 않는다.

증빙: `refund-denominator-oracle.json`, `refund-orders-proposal.json`, `refund-orders-saved.json`, `refund-orders-saved-{390,768,1440}.png`, `refund-orders-layout.json`, `missing-revenue-proposal.json`, 수정 전 `missing-revenue-*`/수정 후 `missing-revenue-fixed-*`, `missing-revenue-layout.json`, `rill-refund-denominators.png`. 수정 후390 안내와 주문 저장390·Rill 화면을 직접 열어 가시성을 확인했다. 전체24 목표는 ACTIVE이며 다음은RXS06 동시 추세/상세/Pivot의 실제 대조다.

RXS13의 비교 입력도 검증했다. 소유 API의 source6 원본 상세37행과 독립 생성 `commerce.csv`를 ordered_at(UTC)·channel·currency·세 금액(Decimal센트)·두 주문 flag의 multiset으로 대조해 모두 같았다(`refund-cohort-source.json`, `refund-cohort-equality.json`). 합계가 우연히 같은 서로 다른 행을 같은 데이터로 간주하지 않는다.

추가 시각적 차이: Rill 비용률 TDD의1월8일 표는 `-`(분모0)이나 대표 area 그림은 그 시점을0으로 이어 보인다. VM은 같은NULL을 선의 빈 구간으로 유지한다. 따라서 비용률 KPI/테이블 수치 일치와 모든 차트의NULL 표현 동일성을 구분한다(`rill-cost-ratio-detail.png`, `ai-formula-saved-1440.png`). Rill의 모호한NULL 시각화를 그대로 복제하지 않는다.


## RXS06 버전별 추세·시간 Pivot 왕복 — Ego25 후속

source5/다운로드#6·다운로드율#8의 두 버전을 동시에 조회했다. v1.9=840/20%, v2.0=1014/23.2568807339…%; 1월13/14일560/280,18/19일854/160은 독립 Decimal 일별 집계와 같다. 없는 날짜는 NULL/선의 빈 구간으로 유지하며 시간축 날짜 간격을 보존한다. 버전별 관측 날짜가 다르므로 전환 개선의 인과 증거로 해석하지 않는다. 같은 CSV의 Rill Version TDD에서 두 값/Line을 선택하고 Pivot으로 이동해 같은840/1014·560/280/854/160을 확인했다.

VM은1월18일 상세854/23.92156862745…%→같은 시점 Pivot854/23.92%→복귀 후 선택 시점/전체 추세를 유지했다. 실제 Pivot 요청의 version 두 값, UTC18일 범위, measure6/8이 유지됐다. 공통country=KR에서는540/20%,565/22.6%다. 필터 삭제 후 이전 결과를 무효화하고 POST 수1→1로 자동 재조회하지 않았다. 명시 실행만 새 비교를 만든다. 비교 API는소유권/고정 파일 버전·정의/값 타입/4값·6지표·값별400시점 제한을 적용하며 UTC 외 기간은 계산 전 명시 거절한다.

실제 다음 XHR 한 건의 sourceRevision만 낡은 값으로 바꾸어 서버409·오래된 결과 제거·선택 값 보존을 확인했다. 소스/데이터/인증은 수정하지 않았고 계측은 원복했다. `카탈로그 새로고침`을 Enter로 실행하면 **기존 부모 재조회처럼 Explore/기본 지표·필터 없음으로 초기화**된다. 비교 조건까지 보존한 복구로 보고하지 않는다.

390/768/1440 안정 캡처의 문서 넘침0·차트 canvas/container326/696/1312px·버튼36px/14px를 확인했다. 표는 실제 스크롤 요소에 이름/포커스를 제공해390px ArrowRight scrollLeft16을 확인했다. 순간 resize 때 ECharts canvas가 이전 폭으로 남던 문제를 해당 신규 차트의 native ResizeObserver로 보완했다. 기간 라벨을 중앙에 놓고 숫자 단위를 서버 measure 메타데이터에서 가져오도록 수정했다. 최종 필터/409 캡처는 이 보완 후이며, 정상 세폭 stable 캡처의 동일 축/숫자는 재사용한다. `final` 이전의 순간 canvas 캡처는 실패 관찰이며 대표 성공 증빙이 아니다.

검사: BE real DuckDB6 PASS; FE 초기 SourceExplore/DimensionSeries57 PASS와 후속 해당 컴포넌트12 PASS(정밀도/스크롤/resize·409에서 이전 성공 제거 포함), 양쪽 type/lint/build PASS. 전체 suite·기존 통과 화면은 반복하지 않았다. 증빙은 같은 외부 폴더의 `version-series-oracle.json`, `version-series-api.json`, `version-series-browser.json`, `version-series-stable-{390,768,1440}.png`, `version-series-stable-layout.json`, `version-table-keyboard-390.png`, `version-pivot-stable-390.png`, `version-series-filter-390.png/.json`, `version-series-conflict-390.png/.json`, `rill-version-*`, `rill-version-pivot-values.json`이다. 필터/409 실제 검증 후 서버는 사용자 중단으로 종료됐고 provider10100은 유지됐다. VoiceOver BLOCKED·실휴대폰/운영·비교 보기 저장/CSV는 별도다.

현재8개 시나리오의 선택 범위 PASS이며 전체24 목표 ACTIVE다. 다음 RXS09는 아래 계약으로 구현한다.

## RXS09 보고서 블록 실행 계약

Given: 고정 VM 마진 source4와 기존 매출/비용/이익 저장 지표. When: 같은 지표·기간·필터의 KPI/추세에 고객별 표와 집계 요약을 추가하고 배치→미리보기→명시 저장→reload→명시 비공개 게시. Then: 금액14937.49/12279.94/2657.55, 고객 표의 행 합계와 요약 숫자가 canonical 집계와 같고, 필터 변경 시 같이 갱신된다. 게시 후 초안 설명/표현을 바꿔도 기존 snapshot은 불변이다.

표와 요약은 새로운 SQL 종류가 아닌 **같은 블록 정의의 표현**(`display.presentation=table|summary`, 기본visual)으로 추가한다. summary는 단일 BOARD_NUMERIC 집계만, table은 분류/시간 집계만 허용한다. 요약 수치는 실제 집계 결과에서 생성하며 작성 설명을 검증된 결론으로 섞지 않고 일반 텍스트로 표시한다. 임의 HTML/코드/외부 fetch·추론 인과 문장을 실행하지 않는다. 저장/복제/AI 생성·수정·게시가 표현을 보존하고, 공개 응답에는 private SQL/소스 경로/지표ID를 추가하지 않는다. 현재 최대6블록/게시 크기 한도를 유지한다. 세폭·키보드 표 스크롤/NULL·긴 내용·정확한 수치 접근을 실제 확인 전에는 PASS로 올리지 않는다.


## RXS09 표·집계 요약 보고서 — Ego25 후속

### 구현 범위와 데이터 계약

기존 SQL/지표/차원 블록에 `display.presentation=visual|table|summary`를 추가했다. kind는 계산 형태이며 표현과 분리한다. summary는 BOARD_NUMERIC의 단일 실제 집계, table은 차원/시간 집계만 허용한다. 서버·클라이언트 문서/operation·legacy draft/옵션·AI 생성/수정·저장/reload·게시 whitelist·remix의 표현 전달을 연결했다. 지표 compiler·원본 행·권한을 바꾸지 않는다. 현재 표는 **차원1개/지표1개**이며, 요약은 실행 결과의 한 숫자를 읽는 제한 문장이다. 다중 지표 열·자유형 AI 분석문·문장별 근거 인용/의존 블록 연결 완료로 확대하지 않는다. 사용자 설명은 일반 텍스트/‘수치 검증 대상 아님’으로 구분하고 HTML을 실행하지 않는다.

표는 현재 조회 행 수/표시값/펼쳐보는 원시값을 제공한다. 기존 금융 fixture가 DOUBLE인 그룹의50.78999999999999 같은 값은 서버 원시 정밀도이며 금액 표시는50.79다. 원시값을 독립적인 회계 정확성 증명으로 부르지 않는다. 표 그룹 비율을 합산해 합계로 만들지 않으며, 요약은 독립 canonical 집계다. 결과 범위 안내는 편집 중 조건이 아닌 **실제로 성공한 미리보기 조건**을 표시한다. 게시본에는 private 소스ID/SQL/지표ID/근거 파일 경로를 추가하지 않는다.

### 실제 AI·저장·게시·필터

source4의 기존총매출#1·총비용#2·이익#3을 실제gpt-6-luna가 재사용해 총매출KPI/비용day추세/company이익표/전체이익요약4블록을 제안했다. 첫 생성은400으로 거절돼 오류 화면을 남겼다(원응답 상세 미보존). 동일 질문 재시도는201이지만 표현 필드가 없어 표·요약 요구 실패였다. 모델 JSON 예시에서 표현이 빠졌던 부분을 명시적 top-level presentation으로 수정한 뒤 **세 번째 실제 요청**에서visual/visual/table/summary를 확인했다. 실패를 정상 미리보기 PASS로 집계하지 않는다.

쓰기 없는 제안→Enter ‘Studio에 저장하고 열기’→비공개dashboard9→reload/API에서 같은 표현·지표ID1/2/3/3을 확인했다. 전체 지표13개는 그대로, 대시보드8→9로만 증가했다. 독립 CSV Decimal14937.49 매출/2657.55 이익·고객6그룹을1e-9 이내로 대조했다. 원시6개 고객값도 별도 합산과 같고 요약에 표의 첫 그룹1763.65를 전체합계로 사용하지 않는다.

모바일390에서 company=Cheonji Retail을Space로 선택→명시 적용→실제preview201한건·매출6750.65/이익1763.65/표1행·같은 조건 안내를 확인했다. 계측은원복했고 필터를해제/명시적용해 전체2657.55/표6행으로 복귀했다. 원래 저장본과 같아진 상태의 저장 버튼은 정상 비활성이며 추가 저장을 실행했다고 보고하지 않는다. 필터초안을 지운 직후 이미 전체 범위를 조회한 것처럼 보이던 보조문구를 ‘선택한 필터 열이 없습니다. 적용하면…’으로 수정하고 실제390px에서 확인했다.

게시창에서 명시 비공개→snapshot v1, 소유조회200/익명403이다. 표·요약과 숫자/배치를 고정했고 공개 whitelist에SQL/sourceId/measureRefs/metricId가 없는 것을 확인했다. 이어서390px 키보드로 요약 이동2칸·표 표현Home/End·긴 설명Enter·표 크게→명시저장/reload를 확인했다. 블록ID/지표/비대상lg/md배치는 유지, xs배치/설명만 바뀌었고 **기존 비공개v1 응답 전체는 불변**이다. 새 snapshot을 몰래 재게시하지 않았다. 비공개v1과저장9는 시연을 위해 유지한다.

이 단계의 실제 제품 모델 호출은 누적10회(이전7+보고서3)이며 전부 기존Codex/gpt-6-luna다. Rill AI/유료연결/외부배포/공개 게시0이다. 읽기 전용 파일 맵 담당은 완료했고 프런트 위임은 command-code provider disabled로 실행되지 않아 주 담당이 직접 구현/검증했다. 실패한 위임을 모델 검증이나 리뷰 통과로 집계하지 않는다.

### 화면·키보드·Rill 비교

첫390게시 캡처에서 표의세열 때문에 금액이잘려두열(분류/금액)+접힌원시값으로수정했다. 최종390/768/1440 소유·게시화면의문서넘침0, 표clientWidth=scrollWidth(소유330/688/1352,게시318/660/1332)다. 긴회사명/설명은줄바꿈,숫자우측정렬·tabular,저장36px/14px다.390의포커스가능한실제표에서ArrowDown scrollTop11과포커스유지,설정Sheet/Escape·표현키보드·설명Enter·배치저장/reload를확인했다. 초기표의ArrowRight scrollLeft28.5/ArrowDown21도관찰했지만최종표의정상금액은가로스크롤없이읽힌다. 게시390이focus재권한조회중이던초기빈캡처는재조회완료후stable/final로교체했다.

동일CSV의Rill Canvas `margin_report.yaml`에KPI/비용추세/company이익표/정적작성설명을구성했다. 현재공식예시의`__time`과시험한`time`은설치v0.90.5에서차원오류여서명시적day차원을추가해정상화했다. 실제화면의14937/12280/2658(정수표시)·고객순위/455.10/242/105/50.79/41.01과동일기간비용추세를대조했다. VM센트/원시정답과Rill축약표시를구분한다. Rillmarkdown은정적문맥이며VM동적집계요약과같은기능으로간주하지않는다. 1440높이는Rill1200/VM1000이므로배치픽셀동일성PASS가아니다. 원천은[Canvas](https://docs.rilldata.com/reference/project-files/canvas-dashboards)·[Data widgets](https://docs.rilldata.com/developers/build/dashboards/canvas-widgets/data)·[Chart widgets](https://docs.rilldata.com/developers/build/dashboards/canvas-widgets/chart)다.

검사: BE문서/실DuckDB+SQLite생성·원자저장·게시173 PASS,선택수정/AI18 PASS. FE초기protocol/adapter/report/public4파일24 PASS→editing/merge포함6파일33 PASS,최종표/게시/필터/editing4파일16 PASS. 양쪽type/lint/build PASS(최종FE2.58s),git diff check PASS. 첫새검사의공통DB지표재사용간섭과미존재updatehelper는새고유지표label/기존savehelper로고쳤다. 새옵션반환union으로기존검사의.content직접접근타입오류도동일내용의toMatchObject검사로수정했다. 마지막소스와같은기존검사는재사용했다. 전체suite/core·운영MySQL·실휴대폰·VoiceOver는실행하지않았다.

증빙폴더는같다: `report-initial-error.png`,표현누락`report-proposal.json`,수정후`report-proposal-final.json`, `report-preview-1440.png`, `report-saved9.json`, `report-publication-v1.json`, `report-layout-save-reload.json`, `report-filter.json/-390.png`, `report-owner-final-{390,768,1440}.png`, `report-published-final-{390,768,1440}.png`, `report-layout-final.json`, `report-table-fit-keyboard-390.png`, `rill-report-1440.png`, `rill-report-values.json`과선택검사로그다. `report-preview-1440`의원시값열은수정전관찰이며최종디자인은final을따른다. 전체24목표ACTIVE,9개선택PASS이며다음은RXS10보고서→같은조건탐색handoff다.


## RXS10 동일 조건 탐색 — 구현·검증 중간 기록

저장본의 canonical 단일 지표/차원 블록에서 owner-only `GET /studio/dashboards/:id/explore`가 저장revision/소스파일/지표 snapshot과 현재 정의 digest를 확인해 조건을 반환한다. URL에는 dashboard/block/revision/sourceRevision만 있고 SQL/숫자/인증정보/필터값은 없다. 목적지의 첫 읽기는 검증 화면이며 원본 report를 보존한다. `이 조건에서 계속 분석`은 같은 조건을 router state로 일반 탐색에 초기화하되 이후 편집은 현재 카탈로그 기준임을 표시한다. 원시 timestamp선/정밀도timestamp기간/다중 지표/검증 불가 계산은 미지원이다. 게시 수신자 권한을 이 owner-only경로로 확대하지 않는다.

BIquery의 optional measureGuards는 선택한 모든 지표의 id/version/정의digest를 검증한다. 카탈로그 검사뿐 아니라 실제 SQL을 만든prepare.definition도 다시 검사해 사이에 정의가 바뀌는 경계를 닫는다. 쿼리는 별도 실행이므로 대시보드 변경이후의 기존 컨텍스트를 영구보존하는 실행저장소가 아니다. 첫GET 이후보고서가바뀌어도검증된기존조건의조회가소스/지표버전이같을때진행될수있으며원본최신저장본이라고재주장하지않는다. 일반탐색확장은새조건의현재정의분석이다.

실제9번/company이익에서 전체2657.55/6그룹→소유자가고객조건을저장한뒤옛revision링크의409/이전숫자없음→새링크1763.65/1그룹→같은고객+UTC2025-01-16저장735/1그룹을확인했다. 마지막조건은API의filters/dateRange·measureGuards와같고wrong digest실제409·익명GET401이다.390/768/1440의새조건탐색은페이지넘침0·표폭324/686/1318에서가로넘침0이다.390pxEnter계속분석후일반Explore는지표1개/차원company1개/고객필터1개/1월16일·735를유지했다. 기본3지표를먼저조회하지않는초기화회귀도추가했다.

실제390에서보고서링크를Enter로열어새탭p7의2657.55/원본p3URL유지·넘침0을확인했고검증후새탭만닫았다. 단순goto검증과이키보드실행을구분한다. 날짜입력은Ego fill이값을유지하지않아표준DOM input/change이벤트로설정후실제UI의적용/저장으로검증했다. 네이티브날짜팝업키보드PASS로확대하지않는다. ‘공통필터접기 · 1’의동적이름과date입력의ARIA textbox부재때문인툴locator실패도제품오류로기록하지않는다. report9는최종전체기간/필터없음으로정상저장해원복했고블록/배치는동일·revision만새값이며비공개게시v1응답전체는그대로다.

아직 Rill Canvas→Explore 실제조건보존대조와최종기록중이다. `ReportExplore`가StudioCSS부모에의존하던표스타일을고유스타일파일로옮겨일반탐색진입에서도같이적용했다. FE편집초안은revision을제거하고서버revision을따로보관하므로근거컴포넌트에읽기전용으로명시전달했다. 첫타입검사의unknown라우터state/검증키타입을좁혔다. BE explore57/creation95 PASS,FE관련60 PASS·type/lint/build와BEtype/build PASS(최종기록에서범위확정). 전체24목표ACTIVE이며이시점RXS10은IN_PROGRESS다.


### RXS10 최종 Rill 대조·검사 범위

Rill Canvas에Company=Cheonji Retail와 `2025-01-16 to 2025-01-17`을적용해735를확인하고실제표카드의`Go to VM margin comparison`을실행했다. 같은탭의 `/explore/margin_explore?view=pivot&tr=2025-01-16+to+2025-01-17&f=company+IN+('Cheonji+Retail')&cols=company,profit&table_mode=flat`으로연결되며Company/Profit·하루·고객을보존하고총계/그룹각735.00이다. VM의end-inclusive1월16일은Rill의[16일,17일)와같은원본행범위다. Rill Model Data도1/18행이다. 공개합성CSV와독립Decimal(2450−1715=735)을같이대조했다. 이결과는금액/조건전달PASS이며**VM중간검증보기→계속분석2단계와Rill직접FlatPivot진입의UX는동일하지않다**. VM은원Studio를새탭으로유지하고Rill은같은탭으로이동한다. 직접Pivothandoff와모든형식확장은후속이다.

Rill의필터메뉴Enter만으로는필터가생기지않아실제포인터클릭으로선택했다. VM키보드검증과Rill전체키보드동등성은구분한다. 최초부모컴포넌트에숨겨진GoToExplore버튼을DOM의table→article관계/실제aria-label로식별했다. 파일/프로젝트/AI/클라우드쓰기는없었다.

최종BE실DuckDB explore57·생성/원자저장/권한95 PASS,FE ReportExplore/SourceExplore/Evidence60 PASS다. 양쪽type·lint·build PASS(최종FE2.23s)이며무관전체/core는반복하지않았다. 실제캡처 `report-handoff-final-{390,768,1440}.png`, `report-handoff-continue-390.png`, `report-handoff-keyboard-tab-390.png`, `report-handoff-stale-390.png`, `report-handoff-filter-390.png`, `report-handoff-api.json`, `report-handoff-filter.json`, `report-handoff-layout-final.json`, `report-handoff-restored.json`, `rill-report-handoff-before.png/after.png/.json`에조건/숫자/범위·원복이있다. 중간3폭캡처후잘못된native checkbox대기때문에JSON저장이중단된관찰은최종layout-final로대체했다. 스크린샷을열어최종확인하며새로바뀐CSS는공통보고서고유스타일파일로범위를제한했다.

현재10개시나리오의**선택범위**PASS,전체24목표ACTIVE다. 제품실LLM누적10회/gpt-6-luna·VoiceOverBLOCKED유지. 다음RXS11/12는새소스재계산/단위검증과제한된오류수정이며FORMULA재매핑은기존명시미지원부터보완한다.


## RXS11 내 파일 복제·RXS12 직접 오류 복구 — Ego25 후속

### 실행과 숫자

기존 샘플 설치/파일 업로드·소유자 복제 API를 재사용했다. 새 fixture `margin-reuse.csv`는18행·USD이며 원본 매출2배/비용3배로 만들어, 이름을 `sales_amount`/`expense_amount`/`net_profit`로 바꿨다. 고정 정답은매출29874.98/비용36839.82/이익-6964.84 USD·비용률123.313287573749…%다. 단순 전체 배율로 같은 비율이 나오는 테스트를 피했다. `margin-missing.csv`에는 이익 열이 없고 `margin-krw.csv`는 별도의 KRW 합성 금액이다. KRW fixture는 환산 예제가 아니다. repo CSV와 서버 builder/worker 입력을 함께 보관한다.

실제 브라우저 흐름1: 보고서9의 저장본 복제→Enter로 누락 파일 source7 준비→매출/비용 연결→이익을 사용하는 두 블록의 연결 필요 안내/미리보기 비활성·제목/4블록 보존→정상 USD source8로 변경→다른 열 이름 명시 연결→전체 미리보기→Enter 저장이다. 최초 복사본10에서 모바일 표 높이/요약 위치를 잃는 결함을 독립 API 대조로 발견했다. **10은 배치 실패 증빙이며 최종 데모가 아니다.** StudioState의 같은 revision 문서·모든 폭 배치를 함께 읽고 새ID에 매핑해 원자 저장하도록 고쳤다. 수정 후 같은 원본9→새 복사본12 저장/reload에서xs/md/lg의 모든 좌표·높이와 표/요약·설명을 보존했다. 원본/지표/게시본은 불변이다. StudioState만 바뀌고 기존 dashboard revision이 같은 경합도 추가 digest로 거절한다.

실제 흐름2: `/data/file`→실제 파일 선택창으로 repo의 `margin-reuse.csv` 선택→Enter 데이터셋 저장(서버 파일 source9 생성 후 기존 데이터셋 작성 폼으로 이동, 별도 데이터셋 작성 저장은 하지 않음)→비용률 보고서7 복제에 이 소스 선택→열 연결→단위 미확인400/입력 보존→같은 USD 단위임을 Space로 명시 확인→전체 미리보기→Enter 비공개11 저장/reload. 비용률 KPI123.31328757374898과14일 추세/6회사 분해는 새 원본 합계 식이며 원본82.21%를 복사하지 않았다. 새FORMULA#19는 새leaf#17/#18(v1·source9의 새 열)를 참조하고 세 블록에서 같은 지표를 사용한다.

금액 단위는 파일 이름이나 `currency` 열만으로 신뢰하지 않는다. 서버가 설치한 정확한 fixture description/checksum/현재 단일 파일 메타데이터와 기존 Commerce snapshot만 알려진 계약이다. 일반 업로드는 동일 단위 확인을 요구한다. 알려진USD→KRW는 확인 선택이 있어도400이며, 업로드를 거친 복사본11→KRW source10의 **다음 복제**도 고정USD 피연산자 의도를 보존해400이다. 자동 환산·화면 기호만 변경·다른 비율로 대체하지 않았다.

### 보존과 구현

canonical SQL과 실제 저장 지표 snapshot이 일치하는 블록만 구조화 지표로 복제한다. 지표와FORMULA 잎을 clone-local ID/source/v1로 저장하고 영수증·대시보드와 같은 transaction에서 rollback/replay한다. 명시 연결이 잘못된 root source/schema envelope도 거절하며 진짜 미연결 블록의 빈 슬롯은 보존한다. 대소문자만 다른 열 이름은 정확한 대상 철자로 바꾼다. 기본 공통 필터/기간도 연결/미리보기/저장에 유지한다(실제 이번 데모는 전체기간/필터0; 필터 보존은SQLite 회귀).

최종 재조회: 원본7/9 문서·정의 및 보고서9의 비공개 게시v1 전체 응답 불변. 복사본12는metric20/21/22(22를표/요약에서공유), source8·새블록ID·모든폭배치·표현 일치다. 복사본11은source9/metric17–19·새ID·배치/표현 일치다. 둘 다shareYn=N·공개 게시 생성0이다. 실패10도 보존해 최종metric22/dashboard12/receipt3이며, 최종reload/읽기 검사에 추가 쓰기0이다. 직접SQL 복사만 하고 지표 연결을 버리던 기존 경로를 보완했지만 공개 게시 수신자 remix의FORMULA/단위 정책까지 완료한 것은 아니다.

### 화면·Rill·검사

같은18행 CSV를 Rill의 `margin_reuse` 모델/metrics/Explore에 연결했다. All time·필터없음 Revenue $29,875/Cost $36,840/Profit -$6,965/Cost Ratio123.31%로 VM의센트/API·독립Decimal과 표시 반올림 범위에서 일치한다. Rill은 repo YAML의 열 이름을 직접 정의했고 VM은 제품 내 매핑/비공개 복제를 사용했다. **동일한 클릭 단계나 Rill AI 오류 복구 완료로 간주하지 않는다.**

390/768/1440의 저장 보고서/계산 보고서/표·요약 미리보기에서 문서 넘침0. 일반버튼36px/14px·Studioundo32px/14px, 표 내부스크롤/긴회사명·음수·단위를 확인했다. 복제 미리보기가 표/요약을 다시 차트로 표시하던 결함도 공통Report 렌더러 재사용으로 수정했다. 짧은 요약블록은 기간 안내가 금액을 밀어 숨기던 문제를 발견해 **숫자 우선의 압축 표현+조건/정확값 펼치기**로 고쳤다. 저장 배치는 바꾸지 않았다.390px 본문40px에 값28px가 완전히 보이고 표ArrowDown scrollTop26.5·요약상세Enter·단위확인Space·미리보기/저장Enter를 확인했다. native select의Home/ArrowDown 시도는 선택을 확정하지 못해 문서화된selectOption으로 연결했다. 이 부분을 전체 native 키보드 PASS로 보고하지 않는다.

하위검사: 복제·지표·통화·기존SQLremap 관련43개 PASS 뒤 Studio 독립 배치/경합 회귀1개 및 잘못된 envelope2개를 추가했다. 최신 관련 복제/구조화28개 PASS, 기존remap16/단위2 PASS를 재사용한다. fixture/샘플 worker 검사23개 PASS를 재사용한다. FE복제/미리보기17개와짧은Report5개 PASS, 양쪽type/lint/build를 확인했다. 최초테스트의타입·기대문구·테스트fixture배치정보 누락은 수정 후 대상만 재실행했다. 기존무관core/PASS화면은 반복하지 않았다. 신규E2E코드는 만들지 않았다. 실제 제품 모델 호출은 기존 누적10회 그대로gpt-6-luna이며 이번 직접복제/복구에AI호출0이다.

증빙은같은외부폴더의 `reuse-oracle.json`, `reuse-baseline.json`, `reuse-report-preview.json`, `reuse-formula-preview.json`, `reuse-unit-failures.json`, `reuse-persistence-checks-final.json`, `reuse-formula-saved11.json`, `reuse-report12-layout-final.json`, `reuse-report12-fixed-*`, `reuse-report12-summary-fixed-390.png`, `reuse-report12-table-keyboard-390.png`, `formula11-final-*`, `reuse-missing-mapped-390.png`, `reuse-krw-blocked-390.png`, `reuse-second-copy-krw-390.png`, `rill-reuse-file-1440.png` 및 선택검사로그다. 최초 `reuse-sample-initial-error-390.png`는새샘플raw응답을기존SUCCESS전용decoder로읽던실패이며전용creationData로수정했다. `report10-final-*`와압축수정전summary키보드캡처는이후성공본으로대체해판정한다.

현재11개선택범위PASS·RXS12 PARTIAL·12개NOT_RUN이며 **전체24목표ACTIVE**다. RXS12의대화형source/schema/metric 진단→AI수정안과공개복제변형/임의자연어·생산부하/실휴대폰/VoiceOver는완료가아니다. 다음은RXS15–19의갱신·중단복구·스키마영향·정정/중복·대표부하를기존worker/버전관리기반에연결한다.

## RXS15 파일 갱신과 게시 불변 — Ego25 후속

실제 업로드source9의18행을 `margin-refresh.csv`의같은여섯열/타입19행으로교체했다. 새행은2025-01-20 Hanul Foods/매출1000/비용800/이익200 USD다. 파일선택창→Enter `검증 후 파일 교체`→명시성공안내/18·19행이력→소유Studio11 reload를실행했다. source9/metric17–19/블록/정의·배치/revision은불변, 파일UUID/sourceRevision만바뀌었다. 업무날짜범위는2025-01-06~20이며서버저장/파일업로드시각2026-10-18과구분된다.

독립Decimal:19행·매출30874.98/비용37639.82/이익-6764.84 USD·비용률121.910427148454833…%. 실제API는121.91042714845481이고화면121.91%다. 같은19행CSV의Rill `margin_refresh_explore`도19/19행·$30,875/$37,640/-$6,765/121.91%로표시반올림범위에서일치한다. Rill에는별도의로컬같은파일모델을만들어결과를대조했으며Rill클라우드갱신/AI/버전복원흐름을검증한것은아니다.

갱신전에Studio11을실제Enter로**비공개게시v1**로만들었다. 갱신후동일게시URL/전체본문은불변이며여전히123.31%다. 원본소스9최신수치121.91%와고정게시본123.31%를390/768/1440실제화면에서구분했다. 문서넘침0, 파일표의18/19·업로드시각·현재버전표시/키보드포커스를확인했다. API비교도게시전체응답동일·소유문서/정의동일을검증했다. 새비공개링크는시연용으로보존하며외부공개/수신자/메일발송0이다. 기존보고서9의게시와source8/복사본12는영향없다.

이단계는제품코드변경0/fixture·Rill모델·검증기록추가다. 기존file-version 원자교체/동일바이트no-op/복원/스키마거절하위PASS를재사용하고무관테스트는반복하지않았다. 증빙:`refresh-oracle.json`, `refresh-before.json`, `refresh-after.json`, `refresh-layout.json`, `refresh-owner-*`, `refresh-versions-*`, `refresh-published-*`, `rill-refresh-1440.png`.390px파일이력캡처를직접열어버튼/표정렬과줄바꿈을확인했다.

현재12개선택범위PASS·RXS12 PARTIAL·11개NOT_RUN, 전체24목표ACTIVE다. 단순worker재생성을작업재시작복구로보고하지않는다. RXS16의지속작업/영수증/서버재시작조정과RXS17영향블록,RXS18업무키정정,RXS19취소는다음구현대상이다. VoiceOverBLOCKED·gpt-6-luna·운영/실기기별도는유지한다.


## RXS16 지속 갱신·실제 서버 재시작 — Ego25 후속

### 구현과 범위

기존 메타데이터 DB와 단일 DuckDB worker를 재사용했다. `/database/:id/file-refreshes`에 소유자 전용 접수/최근 상태/같은 요청 조회/명시 재시도/활성화 취소를 추가했다. UUID와 actor/source·입력 SHA·확장자·기준 revision을 묶고, 같은 요청의 다른 입력은409다. 입력은 서버 관리 영역에 보관하고 경로·체크섬·lease를 클라이언트에 노출하지 않는다. 실행 CAS·15초 lease/5초 heartbeat와 source 활성화/성공 영수증의 단일 transaction을 사용한다. reload/서버 재시작은 GET만 수행하며 자동 재실행하지 않는다.

파일 화면은 기존 동기 API를 보존하면서 이 작업 경로를 사용한다. 같은 로그인/탭의 최소 요청 ID를24시간 보관해 응답 유실 뒤 같은 작업을 조회한다. 최대 입력3개·각3회 실행, 폴링60초 이후 수동 확인이다. 성공/취소 입력 정리는 실패해도 보관 한도에 포함되며 재조회/접수/기동 시 재시도한다. 접수 commit 응답 유실은 영수증 확인 전 입력을 삭제하지 않는다. 접수 자체 실패+상태 조회 실패의 임시 입력도 marker로 보관 한도에 포함하고,15분 경과 후 DB에서 영수증 부재를 확인한 것만 정리한다. 별도 큐 서버/자동 원천 스케줄은 추가하지 않았다.

취소는 늦은 worker의 **활성화를 차단**한다. 실행 중 물리 worker 중단·프로세스 강제 종료가 남긴 DuckDB 후보 정리·전역 저장 용량/운영 다중 서버 전체는 RXS19/운영 후속이며 이번 PASS가 보장하지 않는다.

### 실제 흐름과 정답

1. source9의19행 성공본에 `margin-refresh-recovery.csv`의1행을 더해20행으로 갱신했다. 실제 POST가 서버에 접수된 후 브라우저 응답 **한 건만503**으로 바꿨다. UUID `c53e70e7-3be0-4d51-812e-0036b26b46e8`를 Enter로 GET 확인해 성공/attempt1·버전 추가1회를 확인했고 재업로드는 없었다.
2. 같은20행을50,000회 반복한1,000,000행 CSV(60,300,060 bytes)를 실제 파일 선택창에서 전송했다. UUID `5ea93a01-2531-4c7a-9c2d-f1c92237caad`의DB 상태 running/attempt1을 확인한 뒤 **격리 API PID25904만 SIGKILL**했다. 같은 메타데이터/파일 저장소로 실제 API를 재기동했다. reload 후 interrupted/attempt1·기존20행/버전3개를 확인했다. 재기동/reload만으로는 추가 실행/활성화0이었다.
3.390px에서 `보관한 입력으로 다시 실행`을 Enter로 눌러 같은 job `0b0c1495-8d99-4fdf-9613-43ef94ec9e95`의attempt2/succeeded·입력 정리·버전4개/현재1,000,000행을 확인했다. 파일 재전송·새job·중복 활성화는 없었다. 소유 dashboard11의 정의/배치/저장 revision은 그대로이며 source9의 현재 값만 바뀌었다.
4. 독립 Decimal 정답: 매출1,548,749,000.00/비용1,885,991,000.00/이익-337,242,000.00 USD, 비용률121.775123018642788…%다. 실제 제품 SQL의 DECIMAL(18,2) 합계가 정확히 일치한다. CSV의 기본 DOUBLE 합계에는 최대 약0.00102 USD 오차가 있어 원시 DOUBLE의 완전 일치는 주장하지 않는다. VM Studio11과 동일 CSV의 Rill `margin_restart_explore`는 둘 다121.78%를 표시한다. Rill은1.00M행/$1.55B/$1.89B/-$337M이다. 이는 반복 합성 데이터 비교이며 원본 Rill139만 행/고카디널리티 부하 검증의 대체가 아니다.
5. 비공개 게시11/v1의 전체 응답은 갱신 전과 동일하고 세폭에서123.31%를 유지한다. source8/보고서12와 원본7/9는 이 갱신의 대상이 아니다. 모델 추가 호출0이며 기존 총10회 모두 gpt-6-luna다.

### 발견 오류와 재검증

리뷰로 접수 commit 응답 유실 시 입력 삭제, 이전 실행 정리 중 명시 재시도의 영구 queued, 정리 실패 입력의 한도 누락, 영수증 없는 임시 입력 누락을 수정했다. 각 조건은 실제 SQLite+DuckDB 회귀에 추가했다. 실제 네트워크 장애의 `Network Error`는 기존 데이터/입력 보존·같은 요청 확인을 설명하는 한국어 안내로 수정하고 실제 읽기 요청 한 건 실패→정상 GET으로 재검증했다.

390px에서1,000,000행 숫자가 업로드 날짜와 겹치는 문제를 스크린샷에서 발견했다. 파일 표의 행 수 열을14→24%, 복원 열28→18%, 모바일 글자12px로 조정했다. 수정 후 숫자·날짜·복원 셀의 실제 좌표 비겹침과390/768/1440 문서 넘침0을 확인했다. 갱신 버튼36px/글자14px, 실제 파일 선택창·Enter 접수/상태 확인/재시도를 확인했다. 네이티브 파일 선택창 자체의 전체 키보드/VoiceOver는 이번 PASS에 포함하지 않는다.

하위 검사: 백엔드30개(지속 작업11+기존 파일 버전19), 프런트엔드26개(작업7+기존 파일 화면19), 양쪽 type/lint/build PASS. 별도 architect 정적 재검토에서 수정 범위의 추가 구체적 blocker는 없었다. 실제 브라우저/DB/숫자 대조는 위 증빙이며 정적 검토로 대체하지 않았다.

증빙 루트는 이 문서 상단과 같다. `job-response-lost-390.png`/`job-response-recovered-390.png`, `job-response-lost-audit.json`, `job-server-interrupted.json`, `job-server-down-390.png`, `job-restarted-before-retry.json`, `job-restarted-interrupted-390.png`, `job-restarted-retried.json`, `job-oracle.json`, `job-million-row-results.json`, `job-million-decimal-aggregate.json`, `job-million-owner-*`, `job-final-versions-*`, `job-final-published-*`, `job-final-layout.json`, `job-network-guidance-fixed-390.png`, `rill-job-million-1440.png`를 참조한다. 이전 `job-million-job-390.png`는 열이 겹치던 수정 전이며 최종 화면은 `job-final-versions-390.png`다.

현재 데모source9는100만행/보고서11은121.78%/고정 비공개 게시123.31%로 보존한다. 전체24 목표는ACTIVE(선택 범위PASS13/PARTIAL1/NOT_RUN10)다. 다음은RXS17 영향 블록 표시·명시 재매핑이며 VoiceOver BLOCKED·실기기/운영/전체 수용은 별도다.


## RXS17 열 변경 영향·새 파일로 복구 — Ego25 후속

### 구현과 판정 범위

실패한 owner 갱신 요청에 `GET /bi/sources/:id/file-refreshes/:requestId/impact`를 추가했다. source/actor/job·실패 코드·기준 파일 revision을 확인하고 조회 마지막에도 같은 파일인지 재확인한다. 현재 소유자의 저장 분석과 활성 저장 지표를 각100개까지 확인한다. 지표는 고정 FORMULA 피연산자 열, 블록은 기존 제한 SQL parser의 실제 참조 열과 저장 공통 기간/필터 열을 포함한다. 이름/ID/의존 열/판정만 응답하며 SQL·결과 행·파일 경로·설정·lease를 노출하지 않는다. 대시보드 SQL은 실행하지 않으며, 기존 프로필 조회를 재사용한다.

형식이 불명확한 정의·지원하지 않는 SQL·잘린 diff는 `직접 확인 필요`다. `변경 열 참조 없음`은 열 의존성 판정일 뿐 새 데이터의 수치 불변을 뜻하지 않는다. 일반 레거시 위젯/Pivot·미저장 초안·타 사용자 저장본은 제외됨을 화면에 명시한다. 실제 현재 소스가 바뀌면409이며 묵은 실패를 현재 파일에 적용하지 않는다.

기존 파일의 스키마 거절은 유지한다. 오류 화면에서 명시 영향 조회→새 소스 업로드 링크→영향 대시보드의 기존 복제/열 연결→전체 미리보기→비공개 복사본 저장으로 연결했다. 타입 자동 변환·블록 자동 제외·원본 갱신은 없다. 새로운 매핑 엔진이나 LLM 호출 없이 기존 P5 복제를 재사용한다.

### 실제 삭제·타입 변경과 복구

- source9의100만행/저장11을 기준으로 `margin-schema-renamed.csv`를 선택·Enter 전송했다. 실제 job `a403b123-802e-414a-b448-60579c172444`는 `expense_amount` 삭제/`actual_cost` 추가로 실패했다. 명시 영향 조회에서 총매출은 변경 열 참조 없음, 총비용#18·비용률#19는 영향 있음이며 비용률 KPI/day/company 블록3개가 모두 `expense_amount`를 참조함을 확인했다. 이후 이 테스트 작업의 활성화를 취소해 입력을 정리했다.
- 별도 `margin-schema-type-error.csv`는 비용을 `USD 2700.00` 같은 문자열로 넣은20행 오류 파일이다. job `7f64b7ac-bb71-4286-a72d-124085a2b53d`가 실제 DOUBLE→VARCHAR로 실패했고 같은 지표2개/블록3개의 영향을 표시했다. 두 실패 전후 source9의 **파일 버전 전체 응답이 동일**하며100만행/121.78%를 유지한다. 이 두 번째 실패 작업은 데모 확인을 위해 보존했다.
- 실제 오류 화면의 내 파일 링크로 새 탭을 열어 정상 숫자 `actual_cost` 파일을 업로드하고 source11/20행을 만들었다. 기존 비용의 절반을 행별 USD 센트 ROUND_HALF_UP로 정정한 별도 합성 파일이다. 영향 대시보드의 복사 링크→source11 선택→`expense_amount → actual_cost`를 직접 연결했다. 같은 USD 단위 확인을Space, 전체 미리보기/비공개 저장을Enter로 실행했다. 모든 블록3개·필요 열4개를 포함했으며 제외는0이다.
- 비공개 dashboard13 `열 변경 복구 · 내 새 파일 비용률`에 clone-local 지표23/24/25를 저장했다. FORMULA의 피연산자도 source11/새ID23·24, 비용 열 `actual_cost`로 고정됨을 확인했다. 새 블록ID3개와lg/md/xs 배치를 원본 순서대로 보존한다. 저장/reload/API에서60.88759379344232…%=60.89%다. 독립 CSV Decimal과 제품 DECIMAL 합계는20행/매출30,974.98/비용18,859.92/이익12,115.06 USD로 일치한다.
- 동일20행 CSV를 Rill `margin_schema_explore`로 열어20/20행·매출$30,975/비용$18,860/이익$12,115/비용률60.89%를 확인했다. 원본11의 문서·정의·revision, source9 모든 파일 버전, 비공개 게시11/v1 전체 응답은 동일하다. 새 복사본13은 게시하지 않았다. 기존 모델 호출10회/gpt-6-luna 설정은 그대로이며 이번 추가 모델 호출은0이다.

### 발견 오류와 검증

리뷰에서 `SELECT *`와 `SELECT source.*`가 빈 의존 열로 처리돼 영향 없음으로 오인할 수 있는 조건을 발견했다. 기존 remap parser에서 명시 열 없는 wildcard를 거절해 영향 조회는 직접 확인 필요, 복제는 명시 열 필요로 처리했다. COUNT(*)는 열 독립을 유지하고 일반 곱셈·CASE…END×2/2×CASE…END는 기존대로 열을 추적/연결한다. 첫 보완의CASE 곱셈 거절 회귀도 두 방향 검사와 함께 수정했다. 별도 정적 재검토에서 추가 구체적 blocker는 없었다.

백엔드59개(영향10/열 연결21/기존 복제22/구조화 복제6), 프런트엔드30개(영향4/갱신7/파일 화면19), 양쪽 type/lint/build PASS다. 권한은 실제 익명401·소유자200, 다른 소스/기준 변경/조회 중 변경·권한 회수는 회귀 검사로 확인한다. 실제 다른 사용자 쓰기를 실행한 것은 아니다.

실제390/768/1440 영향 상세/저장13 reload에서 문서 넘침0, 새 영향 버튼36px/14px를 확인했다.390px Tab은 영향 새로고침→복사/열 연결→내 파일 링크로 이동하고Shift+Tab으로 돌아온다. 영향 조회/미리보기/저장은Enter, 단위 확인은Space다. 네이티브select는 명시 선택 API로 조작했으므로 모든 네이티브select 키보드 조합을 PASS로 올리지 않는다. VoiceOver BLOCKED·실휴대폰/운영·모든 정의 범위는 별도다.

증빙: `schema-impact-before.json`, `schema-removed-impact.json`, `schema-type-impact.json`, `schema-impact-oracle.json`, `schema-impact-recovered.json`, `schema-impact-preservation.json`, `schema-impact-final-*`, `schema-recovery-mapped-390.png`, `schema-recovery-preview-390.png`, `schema-recovered-saved-*`, `schema-impact-keyboard-390.png`, `schema-recovery-final-layout.json`, `rill-schema-recovery-1440.png`와`schema-*-tests/build/lint/types.log`다. 상단 버튼 위치만 보인 초기 `schema-type-impact-*` 대신 최종 `schema-impact-final-*`가 영향 상세 화면이다.

전체24 목표는ACTIVE(선택 범위PASS14/PARTIAL1/NOT_RUN9)다. 다음RXS18은 업무 키·수정 시점 기준의 지연/정정 배치와 중복 없는 반영을 구현한다. 전체 파일의 바이트 동일 no-op를 업무 키 중복 제거로 대신하지 않는다.


## RXS18 지연 환불·정정 배치 — Ego25 후속

기존 DuckDB worker와 지속 갱신 영수증을 재사용해 선택 정정 모드를 추가했다. 업무 키/수정 시점은 명시 선택이며 일반 전체 교체는 유지한다. 기존 DB에는 nullable 정정 설정 열만 추가한다. exact schema(열 순서는 무관), 유일/비어 있지 않은 기존 키, 정수·문자열 키/날짜 시점만 지원한다. 입력 동일 행 중복 제거→키별 최신 선택·오래된 수정 무시, 같은 키·같은 시점의 다른 내용은 전체 거절이다. 최신 입력 뒤에 가려진 이전 동일 시점 충돌도 거절한다. 기존 DB는 READ_ONLY로 붙이고 별도 후보만 수정한다. source pointer와 통계 영수증은 같은 metadata transaction이다. 삭제·부분 patch·복합 키·자동 스케줄은 지원하지 않는다.

실제 파일 선택으로 source12의3행을 연결하고 gpt-6-luna로6블록을 생성해 비공개14에 저장했다. 기본600/20/580 USD·금액 환불률3.33%에서 정정6행 반영 뒤1000/90/910 USD·9%가 됐다. 신규1·수정1·동일1·오래됨1·입력 중복1·배치 내 이전 수정1이다. ORD001은 주문일1월1일을 유지하고 수정 시점은1월5일이다. 센트 DECIMAL과 전체4행을 고정 expected CSV로 독립 대조했다. 이 갱신 자체는 대시보드 revision·정의·블록ID·배치를 바꾸지 않았다.

실제 API 재시작 후 같은 설정/영수증을 GET으로 복구했다. 역순 동일 배치를 새 요청으로 재수신해 변경0·현재 source revision/파일 버전 목록 완전 동일(2개), 동일3/오래됨1을 확인했다. 같은 ORD002의 기존 시점 충돌+더 최신 행2개 입력은 실제 FILE_CORRECTION_AMBIGUOUS로 거절되고 마지막 성공4행/버전은 그대로다. 키·NULL·중복 기존 키/잘못된 시점 타입·취소/재시작 설정·다른 요청 설정 재전송409는 실제 SQLite/worker 회귀로 확인했다. 오류 샘플을 정상으로 몰래 전환하거나 충돌 행을 자동 제외하지 않았다.

Rill 동일 base/final CSV에서600/20/580/3.33%→1000/90/910/9%와 주문3→4를 확인했다. 첫 AI 생성은 환불률 분모 확인 뒤 통화 확인을 요구했고, 사실대로 전부 USD/성공 결제액임을 답한 뒤 생성됐다. 첫 생성의 차트 두 개가 표 표현이어서 모호한 모델 지침을 수정했다. 저장14는 사용자 직접 설정으로 두 표현만 visual로 바꿔 명시 저장/reload했다. 이 별도 편집의 revision·widget presentation만 변했고 SQL/지표/ID/모든 폭 배치는 유지됐다. 수정 지침으로 실제 Luna 두 차트 제안을 추가 실행해 선/막대 canvas2·저장 지표28 재사용을 확인했다. 미리보기 뒤 metric29/dashboard14 그대로이며 추가 저장/게시0이다. 표 대조를 차트 생성 성공으로 대신하지 않았다.

390/768/1440px 문서 넘침0, 저장 버튼36px/14px와 실제 정정 결과/오류 안내·모바일 두 차트를 열어 확인했다. details Enter·정정 checkbox Space·반영/저장 Enter를 실행했다. 열 선택은 Ego selectOption으로 실행했으며 모든 네이티브 select의 전체 키보드 지원 완료는 주장하지 않는다. 단위43(정정10/지속14/파일19)·생성95·FE36·양쪽type/lint/build PASS는 이 시점 증빙이다. 이후 RXS19 취소 변경은 별도 회귀를 따른다.

증빙: 같은 실행 폴더의 `correction-*.json/png/txt`, `rill-correction-base-final-1440.png`, `rill-correction-final-1440.png`, 검사 로그. `correction-preservation.json`은 갱신 불변, `correction-presentation-preservation.json`은 별도 표현 편집 불변을 구분한다. 현재 데모 `http://127.0.0.1:3460/dashboard/14/studio`, source12의 최신 실패는 충돌 안내로 보존한다. 운영/실기기/모든 타입·정정 정책/전체 수용은 별도다. 전체24 목표 ACTIVE, 선택PASS15/PARTIAL1/NOT_RUN8, 다음RXS19다.


## RXS19 대표 부하·실행 중 취소 — Ego25 후속

기존20행/100만행 저장·재시작·Rill121.78% 증빙을 재사용했다. 같은 결정적 생성기를400만행(241,200,060bytes)까지 제한 확장했다. 기존 입력을 덮어쓰거나 큰 파일을 커밋하지 않는다. 실행 중 취소를 위해 서버 소유 AsyncLocalStorage의 AbortSignal을 해당 DuckDB 제출에만 전달한다. 대기 작업은 그 작업만 큐에서 제거하고, 실행 중이면 connection.interrupt→네이티브 작업 종료 확인→worker 종료→다음 큐를 실행한다. 다른 요청을 함께 취소하지 않는다. 취소 DB 확정/활성화 CAS는 기존 원자 경계를 유지하고 다른 인스턴스 취소는5초 heartbeat에서 감지한다. 강제 종료25ms 뒤에 native 초기화가 남던 경합을 재현해, 초기화 중 취소 flag·종료 응답 대기로 수정했다. 이를 OS 전체 SIGKILL/영구 native hang 복구 보장으로 일반화하지 않는다.

첫 실제 source9 시도는 취소 동작 전에 완료됐다. 이 실행을 취소 PASS로 바꾸지 않고 **400만행 적재 성공**으로 기록했다. 독립 Decimal 매출6,194,996,000.00/비용7,543,964,000.00/이익-1,348,968,000.00 USD와 전체400만행이 일치한다. 비율121.775123…%=121.78%는 반복 배율과 무관하다. dashboard11의 revision·정의·블록/배치·기존 비공개 게시 전체 응답은 불변이다. source9 현재 버전은5개/400만행으로 보존했다.

별도 source11에서 같은 형식/다른 헤더의400만행을 실제 파일 선택→Enter 반영→UI실행 중→Enter 활성화 취소로 연결했다. 요청c2659584…/job1746b4b1…은1회 실행·cancelled이며 GET 확인/reload 후 cleanupPending=false다. 관측에 실제 importing 후보가 있고 취소 뒤 후보/보관 입력이 모두 제거됐다. 기준20행/원 source revision·파일 버전 목록·dashboard13 문서/정의는 완전 동일하다. 이후3개 실제 GET은 합계 약0.12초에 응답해 worker 복구를 확인했다. 브라우저 reload는 추가POST/활성화 없이 취소 영수증을 읽는다.

실제 관측 수치는 `load-summary.json`을 따른다. 성공 적재의 running→success는100ms 표본의 관측 간격으로 약4.07초이며 정확한서버 latency가 아니다. API RSS는 기준약217MiB→최대약883MiB, 취소는약200→581MiB였다. 설정512MB는 DuckDB buffer 메모리 제한이며 Node/CSV/native를 포함한 프로세스 전체512MB 상한이 아니다. 입력·분포가 반복 합성이므로 운영p95/다양한 고카디널리티 성능을 주장하지 않는다. 쿼리/큐 timeout·결과행/결과bytes·후보 저장한도/권한/파일 읽기 제한은 실제 worker 회귀로 확인했다. 현재 제한은512MiB입력·후보2GiB·큐16·실행300초/조회60초·결과1만행/8MiB·DuckDB512MB/스필2GB/스레드2다.

worker11+지속17+정정10+파일19=57개 관련 회귀(56 통과 뒤 정리 실패 회귀를 포함한 지속17 재검증), FE37/type/lint/build PASS. 원격 취소 회귀는 실제5초 heartbeat를 기다리는 주입된 긴SQL이며 실제 브라우저의 다른 서버 취소를 뜻하지 않는다. 검토에서 발견한 attempt 삭제 실패 시 controller가 남던 오류는 inner finally로 수정하고 EACCES1회 회귀/GET 정리를 확인했다. 리뷰는 focused CLEAR이며 실제 검사는 위 로그로 구분한다. 새 범용 E2E runner는 추가하지 않았다.

390/768/1440px 취소/정리완료 화면 넘침0·확인 버튼36px/14px, 실제 Enter 반영/취소/재확인·새로고침을 확인했다. 입력파일명 줄바꿈/버전20행 표·오류/정리 중 안내를 캡처로 검토했다. 증빙 `load-running-390.png`, `load-cancel-390.png`, `load-cancel-settled-*.png`, `load-cancel-result.json`, `load-four-million-*.json`, `load-*-observations.json`, `load-summary.json` 및 관련 검사 로그다. crash 후 참조불명 후보 정리/전역 저장quota·운영 다중서버·실휴대폰/VoiceOver는 별도다. 전체24 ACTIVE, 선택PASS16/PARTIAL1/NOT_RUN7이며 다음은RXS07/08 관계/비가산 지표다.


## RXS07/08 관계·품질·비가산 지표 — Ego25 후속

### 구현 계약

소유 DuckDB fact와 유일한 lookup 키를 명시해 **fact행을 그대로 유지하는 독립 비공개 스냅샷**을 만든다. 키 타입/원시 동등성은 동일하며 자동 trim/cast하지 않는다. 중복/빈 lookup키는 연결 전에 차단한다. 미매칭/미사용 사전 수·첫5행을 읽기 전용 미리보기로 보여주고 미매칭을 유지한다는 명시 동의 후 저장한다. 파일 경로의 basename/디렉터리/확장자는 서버 문자열 함수로 계산한다. 후보 파일·소스 권한/revision/digest를 재검증하고 source+actor/request영수증을 같은 transaction에 저장한다. 동일 요청은 같은 소스를 반환하며 다른 본문은409다. 불명확 응답은 auth scope의 탭 저장소에 정확한16KiB 이하 요청을 보관하고 명시 재확인한다. 모델 소스는 파일 교체/갱신/복원을 허용하지 않으며 원본 자동 동기화를 주장하지 않는다.

비가산으로 명시한 고유값·숫자/boolean lookup 속성의 집계는 structured compiler와 AI SQL 미리보기에서 차단한다. 보호 표시는 연결 소스의 재연결/지표 재구성에도 승계된다. 일반 소유자 SQL 도구는 별도 전문가 경로이며 기업 열/행 정책 완료가 아니다. 모델에는 경로·부모 소스 ID 없이 fact key/연결된 범주 별칭/미매칭 수/비가산 열만 whitelist로 전달한다. 이 문맥 없이 이미 연결된 작성자 열을 다시 묻던 문제를 보완했다.

### 실제 샘플 실행과 독립 정답

Git CSV 두 개는 실제 파일 선택창으로 업로드(source13 커밋5행/source14 변경파일7행)했다. commit_id→commit_id, author→commit_author와 file_path 파생 열을 선택해 품질 미리보기→미매칭1행 Space 동의→Enter 저장으로 source15를 만들었다. 사전의 미사용 커밋2개는 활동 커밋에 넣지 않는다. 실제 Codex/gpt-6-luna 6블록→명시 Enter 저장→dashboard15/reload/API를 확인했다. 활동 커밋4/전체 경로6/파일명4/추가62줄, 디렉터리별28·15·12·4·3, 작성자 Alice41/Bob17/NULL4가 독립 CSV 정답과 같다. 전체 등록 커밋5·변경 이벤트7과 구분한다.

지출 facts8행/source16+중복 provider 사전18의 실제 UI 미리보기는 중복키1로 저장을 차단했다. 정상 provider17로 교체하고 provider_name/region을 연결·total_unique_beneficiaries를 비가산으로 명시했다. 품질은 fact8/사전4/중복0/미매칭2/미사용1/출력8이며 Space 동의/Enter 저장으로 source19를 만들었다. 실제 Luna 5블록→Enter 저장→dashboard16/reload의 지급액800.00 USD/청구14건, 공급자 Danbi350/Hanul220/Baro130/NULL100과 지역별 값이 독립 Decimal 정답/Rill과 일치했다. 정상 지출 두 지표를4차트에 재사용하며 저장 지표는2개다. 초기 AI 제목의 ‘월별’은 raw timestamp가 월 버킷이 아니므로 ‘기록 시점별’로 직접 수정·저장/reload했다. 실제 원시 날짜6시점이며 월 집계 완료를 주장하지 않는다. 수정 전후 widget.title/revision만 다르고 SQL/ID/계산/모든 폭 배치는 동일하다.

보호 열의 SUM/AVG/COUNT_DISTINCT 실제 POST는 각각400이며 DB19/지표35/대시보드16/모델영수증2개가 불변이다. 실제 Luna에 전체 고유 수혜자를 합산해 달라고 질문하면 ‘이미 집계된 비가산 값이며 원본 수혜자 ID가 필요하다’고 안내하고 제안/저장 없이 끝난다. 가짜 전체80명을 만들지 않았다. 실제/고객 의료 데이터가 아닌 VM 합성 자료다.

Git 생성은 처음 불필요한 작성자 확인 질문→문맥 보완 후 한 번400→동일 질문 재시도201을 관찰했다. 중간400의 세부 원인은 수집하지 못했으므로 모든 모델 응답이 수정됐다고 주장하지 않는다. 재시도 결과의6개 정의/실제 쿼리와 재조회가 최종 증빙이며 다른 모델/로컬 LLM/임의 SQL 생성 우회는 없다. 저장 전 실패·미리보기는 지표/대시보드 쓰기0이다.

### Rill·디자인·키보드

같은 두 CSV로 Rill0.90.5의 Git/공급자 모델과 Explore를 추가했다. Git Reload 후 All time의4/6/4/62와 Added lines leaderboard의 Alice41/Bob17/NULL4 및 디렉터리28/15/12/4/3을 확인했다. 초기 로딩 캡처는 최종 증빙에서 제외했다. 지출 Rill은800USD/14/8행 및 동일 공급자·지역 NULL100을 확인했다. Rill의 연속 일별 시간축/leaderboard와 VM의 raw 날짜 범주 차트·개별 블록 UX는 다르며 픽셀·모든 탐색 기능 동등을 뜻하지 않는다. Rill AI/Cloud/외부 게시0이다.

두 저장본390/768/1440 모두 scrollWidth=innerWidth, 주요 버튼36px/14px·차트2/3개를 실제 캡처로 열어 확인했다. 작은 축에서 생략된 디렉터리는390px Enter로 데이터 표→모든5값/ArrowDown scrollTop10.5/초점 유지로 확인했다. 연결 요약 Enter·속성/비가산/미매칭 체크 Space·품질/저장 Enter, 지출390px 설정 Enter→Sheet→Escape→같은 설정 버튼 초점 복귀도 확인했다. 표는 내부 가로/세로 스크롤이고 페이지를 늘리지 않는다. 실휴대폰/VoiceOver BLOCKED는 유지한다.

하위 검사: native lookup/서비스/AI90 PASS, 서비스/creation/worker/갱신/버전156 PASS, 최종 문맥 privacy+서비스110 PASS(겹치는 결과를 합산하지 않음). FE 관계/버전24 PASS, BE/FE type·변경 lint·build PASS. 검토에서 결과 byte budget 전 검사·숫자 속성 cast 우회·영수증 race 재확인·경로 오류 노출·9개 이상 보호 열 승계를 수정/회귀했다. 다중서버 실제 MySQL 경합/실제 저장응답 유실 reload는 이 단위의 하위 회귀 범위이며 실제 UI 실행으로 바꾸어 보고하지 않는다.

증빙은 기존 폴더의 lookup-oracle.json, git-ai-proposal.json, lookup-dashboard-{15,16}(-final).json, lookup-reload-checks.json, lookup-protection-api.json, lookup-layout.json, git/spending-studio-final-{390,768,1440}.png, git-data-table-keyboard-390.png, spending-duplicate-390.png, spending-quality-390.png, spending-nonadditive-390.png, rill-git-additions-final-1440.png, rill-spending-final-1440.png 및 model-* 검사 로그다. 공급자 제목 변경 때문에 definitions 전체 비교는false이며 위 title/revision 두 차이만 있는 것을 별도로 확인했다.

전체24 목표 ACTIVE: **선택 PASS18/PARTIAL1(RXS12)/NOT_RUN5(RXS20~24)**. 다음은 실제 모델 오류의 대화 진단·수정안, 이후 조직/행/열/LLM 정책과 보고·임베드다. 선택 PASS는 각 행에 명시한 범위만이며 모든 자연어/운영·실기기/제품 수용 완료가 아니다.


## RXS12 대화형 오류 진단→비공개 복구 — Ego25 후속

실제 source11의 파일 선택창에서 type-error CSV를 선택→Enter 교체 요청하면 actual_cost(DOUBLE) 삭제/expense_amount(VARCHAR) 추가로 실패한다. 실패 job `4b6c5746-12a3-4cde-a246-aa0b25b4aacc`, 마지막 성공20행·dashboard13 비용률60.89%·비공개 게시11은 보존된다. 영향 목록에서 지표3개/분석1개/블록3개 의존성을 확인한 뒤 **AI와 오류 원인 확인**에 정상 대체 source8을 선택했다.

신규 owner-only 진단은 같은 실패job/파일 revision·전체 저장 지표/분석 의존성 지문과 두 소스 권한을 확인한다. 실제 모델에는 열 이름·타입/의존성·서버가 확인한 실패 diff와 질문만 보내며 raw값/SQL/경로/내부 설정을 보내지 않는다. gpt-6-luna 수정안은 같은 타입의 실제 열·필수 의존 열 전체 coverage·중복/없는 열/임의 실행 코드 금지로 검증한다. 느린 응답 후 파일+저장 지표 정의/분석 revision 지문을 재확인하며 바뀌면409다. UI도 지문 변경 시 낡은 제안을 버린다. 진단은 읽기 전용이며 데이터 수정/블록 삭제/게시하지 않는다.

처음 두 실제 응답은 actual_cost를 미해결로 남겼다. 의미·USD 단위가 같다는 확인 질문과 원본/실패 입력/선택한 정상 파일의 구분을 프롬프트에 보완한 뒤 실제 연결안을 받았다. 한 응답은 삭제·추가를 같은 열 타입 변경처럼 설명해, 실제 오류 원인은 **서버 observedChanges**로 표시하고 AI 설명은 다음 복구 조언으로 분리했다. 최종 실제201은 actual_cost→expense_amount 및 day/company/sales_amount identity를 제안하며 missingColumns0/repaired:false다. 첫 미해결/중간 설명을 최종 성공으로 세지 않는다. 다른 모델/로컬 LLM/고객 자료·Rill AI 호출0이다.

제안의 기존 복사 링크→source8 선택→원가 열 직접 연결/동일USD Space확인→전체 미리보기 Enter→비공개 복사본17 저장 Enter→Studio/reload를 실행했다. 모든3블록을 유지하며 비용률123.3132875737…%=123.31%가 기존 독립 Decimal/Rill 같은18행 정답과 일치한다(관련 원본 정답은 재사용). 새블록 ID/모든 폭 배치 보존, 원본13 정의/SQL/수치·source11 파일버전·게시11 본문이 불변이다. 원본 GET 전체 비교false는 preview.evidence.queriedAt만 달라졌으며 그 차이를 기록하고 제외한 비교는true다. 원본을 덮어쓰거나 복구 성공을 AI 설명만으로 판정하지 않았다.

진단/복구390/768/1440의 문서 넘침0·주요 버튼36px/14px, 질문은 모바일/태블릿16px·데스크톱14px다. 실제 화면을 열어 확인했고 진단 viewport 캡처의 상단/하단 일부는 스크롤 위치 때문에 잘린다. 캡처가 패널 전체를 한 번에 담았다고 보고하지 않는다. 기존 핵심 키보드는 영향/진단/미리보기/저장 Enter·동의 Space로 확인했다. 복구본17의 새 저장/reload·세폭 전체 캡처를 별도로 남겼다. 실휴대폰/VoiceOver BLOCKED/전체 접근성은 별도다.

BE 진단/실 SQLite 영향 지문23 PASS, FE 진단/기존 영향7 PASS, 양쪽build·FEtype·변경 lint PASS. 정적 검토의 파일은 같고 의존성만 달라지는 경합을 지문/전후검사로 수정했으며 재검토 CLEAR다. 실제 브라우저 장애 주입·모든 자연어/다중 서버/MySQL·범용 SQL 자동수정은 이번 범위가 아니다. 기존 PASS 무관 조건은 반복하지 않았다.

증빙: diagnosis-first-unresolved.json, diagnosis-final-response.json, diagnosis-baseline.json, diagnosis-original-diff.json, diagnosis-preservation-final.json, diagnosis-recovered-api.json, diagnosis-layout.json, diagnosis-advice-{390,768,1440}.png, diagnosis-recovered-studio-{390,768,1440}.png 및 선택 검사 로그. 추가 게시0·비공개17 보존. 전체24 목표 ACTIVE: **선택 PASS19/PARTIAL0/NOT_RUN5(RXS20~24)**. 다음은 조직/그룹 및 행/열/AI 전송 정책을 실제 두 계정 데모에 연결한다.


## RXS21–23 조직·그룹·행/열·AI 정책 — Ego25 후속

기존 원본3/소스4의 저장 정의를 제품 복제 API로 새 **비공개21**에 복제해 검증했다. 원본3과 기존19개 PASS 데모를 정책 대상으로 바꾸지 않았다. 관리자가 실제 `/organizations`에서 조직1·파트너A/B 그룹·구성원을 만들고, 같은 분석21에 그룹별 허용 숫자 지표/열과 필수 company 행 범위를 설정했다. A 정책은 Space로 열/day·component·revenue, 총매출, AI/CSV, 일반 공개 링크 차단 동의→Enter 저장했다. B는 같은 공개 API로 설정했으며 AI는 금지했다. 현재 유효 UI 계정은 로컬 검증용 `vmrxsa1810`/`vmrxsb1810`, 인증정보는 저장소/증빙에 넣지 않는다. 초기 API용 ID가 UI의 영문숫자/20자 미만 정책에 맞지 않아 UI 로그인은 실행되지 않았고 해당 구성원은 회수 후 유효 ID로 재검증했다. 계정/샘플 자동 준비 개수는 숫자 검증 원본에 영향을 주지 않는다.

독립 `margin.csv` Decimal 합산: A/Hanul Foods4행 **4260 USD**, B/Baro Tech4행 **1171.25 USD**. 실제 catalog/query/후보/상세/CSV는 이 정답과 일치한다. company/cost/profit 및 SQL/소스 경로는 응답에 없고, company/cost 필터 조작·actorId/groupId/미허용 block 조작400, 다른 그룹 viewRevision409, 기존 Studio/원본 profile/관리자403, 익명401다. A의 Compute 필터는 독립 원본3행1200+1320+940=**3460**이며 화면/상세의 day/component/revenue만 노출한다. CSV는 A4260/B1171.25·숫자 타입으로 실제 다운로드했다. 전체/내보내기는 no-store이며 공유 결과 캐시/모델 스트리밍을 추가하지 않았다.

A의 실제 Codex/gpt-6-luna 질문→허용 총매출 선택→서버 집계4260을 확인했다. AI에는 사용자가 입력한 질문과 허용 블록/열 메타데이터만 전달하며 원본 행/숨긴 열·필수 행 조건을 자동 전달하지 않는다. 사용자 질문 자체의 임의 텍스트를 DLP 처리한다고 주장하지 않는다. B의 AI 입력은 UI에 없고 서버403이다. provider 호출0 보장은 서비스 회귀에서 확인한 경계이며 실제 외부 모델 서버의 모든 요청 계측 완료로 과장하지 않는다. 숨긴/존재하지 않는 이름을 구별해 provider 호출 여부를 달리하던 분기를 제거했다.

A 구성원 회수→실제 UI Enter 재조회403에서 기존 숫자·상세·AI 패널이 사라지는 것을390px로 확인했고 관리자 명시 재활성화했다. A 정책을 실제1초 만료로 변경→실제403→명시 갱신했다. 일반 공개 링크를 막는 sticky governed는 회수 후에도 유지한다. 적용 전 공개한 합성 분석21의 token은 정책 적용 후 익명/파트너 모두403이며 원 소유자만 기존 비공개 소유 경로를 유지한다. 기존 UUID recipe/사전 발급 복제·게시 ticket 차단은 실제 SQLite 회귀로 확인했다. 정책은 다른 독립 Artifact를 일괄 회수하는 전역 보안 분류가 아니다.

리뷰에서 BiService.profile과 달랐던 소스 버전 계산, 과거 공유 recipe 우회, 레거시 전체 엔티티 저장이 sticky flag를 덮는 경합을 수정했다. 기존 편집은 필요한 필드만 UPDATE한다. 추가로 storage 이벤트보다 A의 응답이 먼저 도착하는 계정 전환 경계를 로그인 세대 검사로 응답/다음 단계/실제 다운로드 직전에 차단했다. 이벤트를 보내지 않고 계정 세대를 바꾼 뒤 응답을 resolve하는 렌더/CSV 회귀를 포함한다. 정상 token refresh는 같은 로그인 세대를 유지하며 새 로그인은 넘지 않는다.

390/768/1440 가로 넘침0, 입력·버튼36px/14px와 모바일 textarea16px, 데스크톱 우측320px AI 패널을 실측/캡처했다. Enter 옵션 읽기/저장/후보/적용/상세/CSV, Space 체크박스를 실제 조작했다. 최초 admin config fullPage는 스크롤 중 고정 헤더가 중간에 찍힌 관측본이며 최종 상단 캡처/세폭 조회 화면을 기준으로 한다. 전체 스크린리더/실휴대폰/SSO·SCIM/조직 편집 역할/운영 MySQL·부하/제품 전체 수용은 별도다. VoiceOver BLOCKED와 gpt-6-luna 설정은 유지한다.

검사: 조직+컴파일러19 PASS, 기존 공유/Studio 게시/소유권/마이그레이션89 PASS, 수정 후 게시/레거시/Pivot31 PASS, 기존 AI 저장65 PASS(서로 겹치는 suite는 합산하지 않음), 최종 FE7 PASS, type/lint/build PASS(후속 RXS20 작성 전 범위). 보고 작업을 추가한 최종 BE 조직 suite11 PASS는 기존8+보고3이며 아직 RXS20 실제 시연 PASS가 아니다. 증빙은 같은 외부 폴더의 `governance-*`와 CSV/독립 oracle/API final JSON이다.

현재 전체24 목표 ACTIVE: **선택 PASS22/NOT_RUN2(RXS20·24)**. 다음은 현재 권한 경계를 재사용한 본인 수신 앱 안 조건 보고·예약, 인증된 동일 origin 포털 embed다.


## RXS20 본인 수신 조건 보고·알림 — Ego25 후속

조직 보기의 숫자 KPI 한 개를 전체 기간/화면 추가 필터 없이 새로 조회하는 지속 예약을 구현했다. 집계 CSV 보관이 허용된 구성원 본인만 만들고 읽는다. 다른 수신자/원본/SQL/body actor는 받지 않는다. 60초~24시간·최대 활성10개/구성원, 15초 poll/한 tick20개·중단 기간 최신 발생1건 따라잡기다. 별도 Redis/외부 스케줄러/메일·Slack 발송0이다. 성공 쿼리와 최종 현재 권한을 확인한 숫자만 암호화 보관하고 조회할 때도 exact viewRevision을 재검사한다. 임계값은 정수30자리/소수12자리 이내의 10진 문자열이며 기존 정확 숫자 비교기를 재사용해 DECIMAL을 Number로 바꾸지 않는다.

실제 B/분석21에서1분·총매출>1000 예약을 Enter로 저장→도래 확인→1171.25 USD/조건 충족·앱 안 알림을 확인했다. 같은 발생에 중복 확인해도1건이었다. **실제 API 서버를 종료/재시작한 뒤 수동 실행 없이** 다음 scheduledAt의 배경 작업이 실행됐다. 이전1건 보존+다음 발생 정확1건=2건이며 이후 Enter로 중지했다. B>2000은 실제1171.25/조건 미달·알림 없음, 별도 A>4000은4260/충족이다. A를 같은 JWT의 B그룹으로 변경하면 A 과거 보고 payload가 숨겨지고, 다음 실제 배경 발생은 stale/result NULL이었다. A는 관리자가 A그룹으로 복원했으며 그전 보고는 원래 scope에 고정해 계속 숨긴다. 최종 모든 로컬 검증 예약은 중지했다.

영수증(reportId,scheduledAt) unique와 다음 시점/receipt 저장을 transaction·현재 lease/활성/config version/최종 lease 만료 CAS로 묶는다. SQLite stop/claim도 같은 쓰기 큐를 쓰며 MySQL 활성 제한은 actor row lock을 사용한다(운영 검증 아님). 회귀는 실제 SQLite/Native DuckDB에서 재실행/새 worker·그룹 전환 이력 차단·실패 숫자 재사용0·취소/낡은 lease·최종 커밋 중 stop/lease 만료·활성 목록 보존을 확인했다. 큰 DECIMAL 문자열 경계는 실제 모델/worker 실행을 대신한 응답 프로토콜 주입 회귀다. 소스/지표/정책이 바뀌면 자동 승계하지 않고 새 예약을 명시적으로 만든다. 기존 기록은 권한이 같을 때의 과거 시각을 표시하며 최신 실패를 과거 성공으로 대체하지 않는다.

390/768/1440 본문 넘침0·36px 입력/버튼, Enter 예약/확인/중지와 새로고침·저장 기록을 확인했다. 최종 stopped 화면은 ‘다음 확인’ 대신 중지 상태를 표시한다. 추가 BE 조직/보고16 PASS(기존 조직8 포함), migration3 PASS, FE 보고3/조직7 PASS와 후속 portal 포함16 PASS·BE build/FE type PASS. lint/build 최종 통합 결과는 아래 최종 기록을 따른다. 증빙 `reports-before-restart.json`, `reports-after-restart.json`, `reports-under-threshold-and-identity.json`, `reports-autonomous-stale.json`, `reports-*-{390,768,1440}.png`와 선택 검사 로그다. 외부 전달/정시 보장/운영 분산 부하/실휴대폰/VoiceOver는 별도다.

전체24 목표 ACTIVE: **선택 PASS23/NOT_RUN1(RXS24)**. RXS24는 실제 테마·필터/동일 origin frame을 검증 중이며 실제 AI·계정/만료 격리·최종 디자인 확인이 남았다.


## RXS24 인증된 동일 origin 포털 — Ego25 후속

`/organizations/:orgId/embed/:dashboardId`가 실제 조직 보기를 iframe으로 연다. 서버 JWT의 로그인 구성원과 중앙 정책이 identity이며 URL/body actor/group/role은 허용하지 않는다. 부모는 허용 catalog로 받은 열의 typed equality filter와 light/dark만 전한다. unknown/중복 query key·숨긴 열/손상 값은 첫 집계 전에 차단한다. 사용자 질문/AI 결과는 프레임 메모리이며 새 경로·부모 테마/필터·로그인 세대/subject·정책 revision에서 이어붙이지 않는다. 신뢰된 같은 origin 코드만 지원한다. 서버 signed embed·외부 기업 SSO·외부 호스트 API/공유 대화 저장을 구현했다고 주장하지 않는다.

실제 B 포털에서 dark를 Enter로 선택→component/Compute 후보→적용 Enter로 **640.50USD**를 확인했다. A로 다른 탭에서 로그인하자 부모와 프레임이 새 scope로 바뀌고 필터/이전 질문을 지웠다. A iframe에서 실제 Codex/gpt-6-luna 질문→서버 실제 총매출4260USD를 확인했다. 단순 텍스트/목업 숫자로 모델 응답을 대신하지 않았다. 같은 JWT의 A를 B그룹으로 바꿔 **iframe의 접근·데이터 다시 확인** Enter를 실행하자1171.25·AI 입력0·이전 A 질문/숫자0이었다. 코드 리뷰에서 발견한 이전 질문 보존을 accepted policy revision 비교로 고치고 컴포넌트/실제 이 흐름을 재검증했다. 이후 A로 복원했다.

실제 A 정책1초 만료→프레임 Enter 재조회403 안내/카드0·textarea0→관리자 명시 갱신을 확인했다. 6시간 JWT 만료를 기다려 검증한 것은 아니며 JWT 거절은 기존 guard 회귀를 재사용한다. 별도 A 미전송 질문을 입력한 채 다른 탭에서 B로 실제 로그아웃/로그인하면 A 질문/숫자0·B1171.25·AI 입력0이다. 늦은 A 응답이 storage 이벤트 전에 resolve하는 렌더/CSV와 로그인 epoch가 먼저 바뀌고 token subject가 나중에 바뀌는 경계는 회귀로 확인했다. 프런트 subject 해석은 응답 적용을 막는 fence일 뿐 서버 인증을 대신하지 않는다. 같은 로그인/subject의 정상 refresh는 이어가며 새 로그인 세대는 넘지 않는다.

Vite dev의 실제 조직 문서 응답은 `frame-ancestors 'self'`/no-store, 기존 `/embed`는 변경 없는 헤더였다. 다른 origin의 임시3461 포털에서 조직 iframe을 열자 실제 Chromium이 ‘127.0.0.1에서 연결을 거부했습니다’로 차단했다. 임시 서버는 종료했다. 모든 상위 창의 same origin 검사도 첫 catalog 전에 수행해 기존 공개 SPA 경유를 막는다. Vite preview/nginx 설정은 추가했지만 nginx/Docker/운영 프록시 실행을 검증한 것은 아니다. Context7의 Vite8 공식 dev/preview middleware 문서로 설정 경계를 확인했다.

390/768/1440에서 바깥 문서/iframe 모두 가로 넘침0, 안쪽 실제 너비356/718/1390px와 B필터640.50/A4260을 확인했다. 최초 모바일→데스크톱 전환 시 min-height100dvh 측정 때문에 iframe이 줄어들지 않아 빈 공간이 남았다. 실제 main/header의 자연 높이를 관찰하도록 수정했으며 **최종 B 높이1037/812/628px**로 줄어든다. 최종 `portal-final-B-*`가 디자인 기준이며 이전 A AI 캡처의 큰 하단 여백은 수정 전 관측본이다. dark에서 브랜드 로고를 원래 색으로 읽을 수 있도록 흰 바탕을 뒀다. 초기 native 테마 select의 End/Space로 선택 완료를 확인하지 못했으므로 이를 PASS라고 하지 않는다. 최종 두 테마 버튼은 aria-pressed와 실제 Enter로 확인했고 후보/적용/재조회/AI Enter, 필터 값은 명세된 selectOption으로 조작했다. 전체 native OS 메뉴/VoiceOver·실휴대폰은 별도다.

증빙은 동일 외부 폴더의 `portal-B-dark-filter-*`, `portal-A-ai-*`, `portal-same-jwt-scope-change.json/-B-390.png`, `portal-expiry-evidence.json/-expired-390.png`, `portal-account-switch.json`, `portal-cross-origin-blocked.png`, `portal-final-B-*`, `portal-final-layout.json`이다. 별도 localhost 원 소유자와127.0.0.1 파트너 B 로그인으로 저장 데모/조직 포털을 동시에 열어 보존했다. API CORS에는 이 두 로컬 origin만 명시했다.

## 최종 판정 — 2026-10-18

**RXS01~24 모두 MD의 선택 샘플 데모 범위 PASS(24/24)**다. 기존19개는 무관한 조건을 반복하지 않았고 RXS20~24의 구현/정확 수치·실제 브라우저·모델/권한·모바일·키보드 증빙을 추가했다. [시연 순서와 진입점](../../samples/rill-scenarios/README.md#24개-시나리오-시연-순서)에서 실제 저장된 데모와 재현용 CSV를 확인한다. 표의 각 행에 명시한 미지원/후속 변형, 실제 고객 업무/운영 MySQL·부하·외부 전달·SSO·실기기/VoiceOver·사람 제품 수용은 그대로 별도다. **Rill 전체 기능 동등성/기업 운영 완료**로 해석하지 않는다.

새 권한/보고 경계의 최종 하위 검사는 BE 조직/보고16·마이그레이션3·컴파일러11, 관련 공개/복제/소유권/레거시/Pivot/AI 저장 회귀와 FE 조직/보고/포털16 PASS다(겹치는 suite를 합산하지 않음). BE build·FE type/lint/build, 변경 BE lint(경고는 별도), 격리 core E2E **8 PASS/24.6초**를 확인했다. 핵심 E2E는 별도 생성한 SQLite/포트에서 실행 후 종료했으며 실제 데모 DB/기존 사용자 서버를 초기화하지 않았다. 실제 제품 AI는 기존Codex/gpt-6-luna를 유지했고, 테스트 double 회귀를 실제 모델 실행으로 보고하지 않는다. 이번 요청에서 commit/push는 실행하지 않았다. 검증 예약 모두 중지·임시 외부-origin 테스트 서버 종료·합성 분석21 기존 공개 token은 조직 정책으로 차단 상태다.

최종 증빙 manifest: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-scenarios-20261018/final-manifest.json`. 검사 로그10개·실제 캡처250개·현재 작업 파일 hash와 검증용 활성 예약0건을 기록했다. 캡처 수는 실패/수정 전 관측본도 포함하며 최신 판정은 각 절과 `portal-final-B-*`를 따른다. 인증 파일/API 로그는 포함하지 않았다.

## RXS02 CSV 후속 — 실행 계약

RXS02-C1 Given company 집계의 적용된 결과, When **집계 조건 표시 CSV**를 명시 다운로드, Then 같은 기간/원본 필터/조건/지표 정의·파일의 서버 재계산으로 KPI/대상 상위50/시계열200점을 저장한다. 합계는 전체 대상의 재집계이며 표시 상한과 잘림 여부를 CSV에 기록한다. 원본 행·전체 대상 내보내기로 부르지 않는다. 표시 반올림/비율 평균을 하지 않고 기존 CSV의 식 주입 방지·2MB/1만행 상한을 재사용한다.

RXS02-C2 Given 적용 후 파일/지표·기간/조건 변경, When 이전 viewRevision으로 CSV 요청, Then409/재적용 안내·다운로드0이다. 입력 변경 중 지연 응답도 버린다. 비소유자403·알 수 없는 필드400은 기존 소유권을 유지한다. 저장 보기/Pivot 연결은 이번 단위에 포함하지 않는다.

RXS02-C3 Given 실제 같은 VM/Rill 샘플, When390/768/1440과Enter로CSV 다운로드, Then 고정 정답·조건 메타데이터/반올림 전 값 일치·개행/쉼표 정확 파싱·가로 넘침0·기존 버튼 높이/글자 계층을 확인한다. 기존 RXS02 대상 판정PASS는 재사용하고 CSV만 검증한다.

### RXS02-C1~C3 결과 — 2026-10-18 Ego26

**PASS_SELECTED**: 같은 소유자 source4의 매출 지표1/마진4·company별 매출≥1000/마진<20%·전체기간/원본 필터없음/UTC 일 단위다. 독립 CSV Decimal의 Hanul4260/Baro1171.25·2대상8행·매출5431.25USD/이익292.79/마진5.390840046029919447640966628%와 실제 다운로드의 KPI/대상/추세를 대조했다. 숫자는 worker가 반환한 반올림 전 DOUBLE 값이며 금전 DECIMAL 저장 보장으로 확대하지 않는다. Samil Trading, Inc.의 쉼표는 별도4대상 CSV에서 정확히 파싱됐다. NULL 추세는 value_type=null/빈 셀로 보존한다.

실제 desktop/mobile Enter 다운로드·API·최종 코드 서버 재기동 뒤 다운로드 **4파일 SHA256 동일**이다. CSV는35행(조건15+KPI2+대상4+추세14)이며 단위/기간·조건/대상수/기여행수·잘림 여부/50대상·200시점 상한을 포함한다. 상세 pagination은 export identity에 포함하지 않고, export는 원본 상세 SELECT를 아예 실행하지 않는다. 표시 범위 CSV이며 전체 대상·원본 행을 내보내는 기능은 아니다.

viewRevision은 actor/source파일/선택 지표 전체 정의/기간·필터·조건·집계 단위를 고정하고 CSV 전에 다시 계산한다. 실제 조건변경/이전파일409·view누락/알 수 없는 필드400·타 소유자403/익명401을 확인했다. 실제390px 조건1000→2000에서 이전 숫자/내보내기 버튼이 사라지고1000 명시 재적용으로 복귀했다. 지표 정의 자체 변경/조회 도중 변경 거절은 실제 DuckDB 단위 회귀 범위다.

검토에서 발견한 계정 변경 후 늦은 CSV 응답 다운로드를 공통 로그인 세대/subject 검사로 막았다. 기존 조직 검사 함수를 helpers/authResponseFence로 그대로 옮기고 별칭을 유지했다. storage event 없이 계정이 바뀐 응답은 Blob/다운로드0이며 정상 같은 세대 갱신은 기존 계약을 유지한다. 이 계정 변경 경합은 컴포넌트 회귀이며 실제 두 계정 브라우저 경합 실행으로 보고하지 않는다. 서버 JWT 소유권 검사는 그대로다.

390/768/1440 실제 scrollWidth=innerWidth, CSV 버튼36px/14px·너비332/422/422px, 키보드 포커스/Enter 다운로드를 확인했다. 최초 desktop 안내 폭이1054px로 너무 길어져 max-w-md로 제한했고 최종 이미지를 직접 확인했다. 초기 관측본 `segment-csv-1440-initial.png`와 최종 `segment-csv-final-{390,768,1440}.png`, 조건 무효화390 화면을 구분한다. 실휴대폰/VoiceOver BLOCKED는 유지한다.

BE segment/기존 export34·FE export/segment/조직 보고·포털30, BE/FE build·FE type·변경 lint(오류0/경고0), 영향받는 격리 탐색/Pivot 저장·재조회·CSV core1건(9.4초) PASS다. 과거 export 단위의 Repository manager mock이 최신 비가산 확인과 맞지 않아 실패했으며 fixture만 보완했다. 첫 새 CSV 검사의 잘못된 기대 고객명도 독립 조건에 맞게 Hanul/Baro로 교정했고 초기 실패 로그를 보존했다. 기존 전체8/core·실LLM·Rill 화면은 무관 기능을 반복하지 않고 이전 증빙을 재사용한다. 이 데모 소스의 새 AI 호출/지표/대시보드/게시/외부 발송0(격리 core는 자체 픽스처 사용), 설정 Codex/gpt-6-luna 유지·commit/push 미실행이다.

증빙은 기존 외부 폴더의 `segment-csv-*`, 최종 로그·`segment-csv-manifest.json`이다. 당시 다음 기능 잔여는 집계 조건 저장 보기/Pivot 연결이며, 아래 S1~S3 후속에서 별도 검증했다.

## RXS02 저장·Pivot 후속 계약

RXS02-S1 Given 적용한 집계 조건, When 개인 보기로 저장→reload→명시 복원→집계 조건 적용, Then 대상/조건·선택 지표/기간·필터·집계와 Pivot 열을 복원하고 현재 파일로 같은 독립 정답을 계산한다. 저장된 결과로 가장하지 않는다. 기존 개인 보기20개/소유권·정의 revision 검사를 재사용하며 다른 탐색 모드에 집계 조건을 조용히 적용하지 않는다.

RXS02-S2 Given company 매출≥1000/마진<20%, When component를 Pivot 열로 선택·명시 적용, Then 자격 판정은 company 전체 범위에서 유지하고 셀/행/열/전체 합계는 기여 원본으로 다시 계산한다. 대상50·열20 상한과 잘림을 명시하고 총합은 모든 대상·열 포함이다. 비율을 더하거나 상위 대상만으로 전체 합계를 만들지 않는다. 숫자/시간 열·중복 축은 거절하며 NULL과 문자열null은 분리한다.

RXS02-S3 Given 저장/복원과 Pivot 결과, When390/768/1440·키보드로 복원/적용/표 탐색/CSV, Then UI 전체 넘침0·표 내부 스크롤·36px/14px 계층과 독립 수치를 확인한다. 과거 Rill/집계/CSV PASS는 재사용한다. 운영/실기기/VoiceOver는 별도다.

### RXS02-S1~S3 결과 — 2026-10-18 Ego27

**PASS_SELECTED**: 기존 개인 탐색 보기 테이블/소유권·definition revision·20개 상한을 재사용하고 mode=segment의 대상/조건/지표/기간·원본 필터/일·주·월/Pivot 열을 엄격하게 저장한다. 임의 SQL/다른 모드에 segment 혼합·숫자/시간 Pivot 열·중복 축은 거절한다. 저장 결과/숫자는 보관하지 않는다. 이 흐름은 집계 조건 탭 안의 Pivot이며 기존 일반/고급 Pivot·대시보드 Pivot 연결로 자동 전달하지 않는다.

실제 소유 source4에서 **개인 보기1 `RXS02 매출 1000·마진 20 미만 Pivot`**을 Enter로 저장했다. 새로고침→기존 저장 보기 목록→Enter 불러오기→company·조건2개·지표1/4·전체기간·일·component 열 복원/결과 없음→명시 적용으로2대상8행·5431.25USD/5.3908400460…%를 확인했다. 처음 HMR 직후 결과가 무효화되어 저장 버튼이 비활성인 관측은 입력을 보존하고 재적용한 뒤 저장했다. 자동 저장/자동 생성으로 우회하지 않았다.

두 번째 **보기2 `RXS02 기간·Compute 복원`**은 실제 API로 준비했다. 아무 segment 결과가 없는 첫 진입에서 불러오기 활성/저장 비활성을 확인한 뒤 Enter 복원→원본 component=Compute/2025-01-06~15 UTC/주 단위→명시 적용으로 Hanul만1대상·3460USD/12.7745664739…%=12.77%를 확인했다. 다시 보기1 복원으로 날짜 입력/Compute 필터가 제거되고5431.25로 돌아왔다. source5→4 전환 뒤 기준값빈문자/이전 복원 안내·결과 없음→명시 보기1 재복원도 실제 확인했다. 두 보기는 로컬 소유자 데모로 보존한다.

Pivot 자격 판정은 company 전체 적용 범위에서 수행한다. 셀/행/열/전체 합계는 각 기여 원본에서 canonical 지표를 다시 계산한다. Hanul Compute3460/12.77%, Baro Compute640.50/-12.79%, Compute 전체4100.50/8.78185…%=8.78%, Storage 전체1330.75/-5.0580499718…%=-5.06%, 전체5431.25/5.39%다. 실제 모든4셀·두 열 합계를 원본CSV Decimal로 대조했다(금액1e-9·백분율1e-10 이내). DOUBLE 원본의 반환값을 반올림 전에 보관하며 금융 DECIMAL 저장 보장은 아니다. 표시50대상/20열, 전체 합계는 표시 상한 밖의 행·열도 포함한다. 260열에서20열/총33930·보이는 열210의 차이와 NULL 축/문자열null 분리는 실제 DuckDB 회귀 범위다. 해당 대용량/NULL 변형의 새 UI 실행으로 보고하지 않는다.

같은 CSV 다운로드에는 기존 조건/KPI/대상/추세 외 Pivot 셀8행(2지표×4셀)/열 합계4행이 있고 실제 API 응답과 바이트 동일하다. 새 저장의 다른 mode 혼합/문자열 임계값은 실제400이다. 비소유/이전파일 CSV 차단은 C1~C3 및 기존 개인 보기 검사를 재사용한다. Rill의 같은 CSV/조건 및 일반 Pivot 대조는 앞선 증빙을 재사용하며, 이번 새 집계 Pivot의 Rill 화면을 다시 실행하거나 픽셀 동등성을 주장하지 않는다.

검토에서 `disabledReason` 때문에 미조회 때 불러오기까지 막히던 문제는 `saveDisabledReason`으로 저장만 분리했다. source/catalog reset·비segment 이동 시 복원 handoff를 지워 서로 다른 기간/조건이 섞이지 않게 했다. 불러오기 GET 대기 중 미완성 날짜 편집은 일반 disabledReason과 최신 문맥 검사로 적용하지 않는다. 이 지연 경합은 컴포넌트 회귀이며 실제 proxy 경합으로 보고하지 않는다.

디자인/키보드는390/768/1440 전체 넘침0, 모바일 교차표326px 안에639px 표를 두고 내부 스크롤, 저장/적용/불러오기 Enter와 초점을 확인했다. 초기 native ArrowRight가 실제 focused region에서도scrollLeft0이라 명시 키 처리를 추가했다. 최종 실제 End313→Left233→Right313→Home0, 변경키/내부 컨트롤은 가로 키를 가로채지 않는다. 이전 즉시 측정0/대기 실패/스크롤 관측본은 최종 `segment-pivot-keyboard.json` 및 final390과 구분한다. 실휴대폰·VoiceOver BLOCKED를 그대로 둔다.

최종 BE segment/개인 보기50, FE segment/Pivot/parser/SourceExplore/export/개인 보기154 PASS. BE build(제품 코드가 같은 직전 실행 재사용)·FE type/lint/build·변경 BE lint0오류/0경고, 공통 보기 스키마/저장 UI 영향의 격리 기존 Pivot 저장·새로고침·CSV core1건9.2초 PASS다. 마지막 새 segment 키 처리/paused 전달은 관련 회귀로 확인했으며 변경 없는 classic core를 반복하지 않았다. 실제 모델 호출·새 대시보드/지표·게시·외부 발송0, Codex/gpt-6-luna/VoiceOver 설정 유지·commit/push 미실행이다.

증빙: 기존 외부 폴더의 `segment-saved-view.json`, `segment-period-view.json`, `segment-pivot-oracle.json`, `segment-pivot-browser.csv`, `segment-pivot-csv-checks.json`, `segment-pivot-layout.json`, `segment-pivot-keyboard.json`, `segment-pivot-final-{390,768,1440}.png`, `segment-saved-controls-390.png`, `segment-period-restored-390.png`, 검사 로그와 `segment-saved-pivot-manifest.json`. 다음 범위는 저장한 집계 Pivot의 기존 대시보드 추가·공통 필터 계약이며 이번 탐색 완료와 구분한다.


## RXS02 대시보드 집계 Pivot 연결 — D1~D3

- D1: 저장한 segment 보기 중 Pivot 열이 있는 보기만 같은 소스의 기존 소유 대시보드에 추가한다. 정의/게시/기존 블록을 보존하고 저장된 조건 사본을 reload로 재조회한다. 일반 탐색/열 없는 segment·타 소스·비소유·낡은 정의는 기존 경계로 거절한다.
- D2: 공통 필터/기간은 같은 열의 저장 기본값보다 우선하며 나머지는 유지한다. 원본 필터→company 자격 판정→기여 행의 셀/행/열/전체 재집계를 따른다. 기본5431.25USD/5.3908400460%, Compute 필터 후 Hanul만3460USD/12.7745664740%, Baro+Compute는 대상0이다. 필터 초기화는 기본값 복원, 빠른 변경은 마지막 조건만 조회하고 늦은 응답을 표시하지 않는다.
- D3: 실제 추가→대시보드→reload/공통 필터→모바일390/768/1440·Tab/Enter·표 Home/End를 확인한다. 페이지 넘침0, 표 내부 스크롤, 이름/제거/재시도 정렬을 확인한다. 이미 통과한 Rill 숫자와 하위 집계기는 재사용하며 공개 게시/운영/실기기/VoiceOver는 범위 밖이다.

### RXS02-D1~D3 결과 — 2026-10-18 Ego28

**선택 범위 PASS.** 실제 원 소유자의 탐색 저장 보기1/2에서 ‘대시보드에 추가’→같은 source4의 기존 **VM 마진 데모3**→Enter 추가를 실행했다. 두 Pivot의 조건/행·열/지표/기본 기간·필터를 별도 사본으로 저장하고 실제 reload로 재조회했다. 대시보드의 기존 정의·배치·공유/게시 관련 필드는 불변이며 DB 변경은 `pivotDefinitions`/`updatedAt`뿐이다. 신규 대시보드/지표/게시를 만들지 않았다. 개인 Pivot은 소유 대시보드의 기존 조회 화면에서만 연결하며 Studio 블록/공개 게시물로 확대하지 않는다. 추가 대화상자에 이 범위를 명시했다.

독립 CSV Decimal 정답/앞선 Rill 증빙을 재사용했다. 기본 보기1은2고객8행/5431.25USD·5.3908400460…%, 보기2는 저장된 Compute/2025-01-06~15/주 집계 기본값으로1고객3행/3460USD·12.7745664739…%다. 공통 Compute를 Enter로 선택하면 보기1도 Hanul만3460/12.77%이며 Baro+Compute는 대상0·기여0행/빈 결과 안내·SUM NULL(숫자0으로 조작하지 않음)이다. 초기화하면 각각의 저장 기본 범위로 복귀한다. 공통 날짜 입력→Enter 적용은 두 카드의 날짜를 우선한다. Ego date `fill`이 React 상태에 남지 않은 초기 관측 뒤 일반 DOM input 값 setter/input 이벤트로 양쪽 날짜를 전달하고 실제 Enter 적용/서버 dateRange를 확인했다. 네이티브 날짜 팝업 전체를 재검증한 것은 아니다.

실제 고수준 클릭 두 건은2166ms 간격이라 중간 범위 조회가 발생했다. 이를 debounce 실패로 분류하거나 ‘마지막만 조회’ PASS로 포장하지 않는다. 별도로 관측된 메뉴 항목의 DOM click 이벤트 두 건을 같은 브라우저 실행에서 **22.8ms**에 전달했을 때, 서버 요청은 최종 Compute+Storage 조건만 **2건(day/week 각각1)**이었다. 저장 단위가 달라 완전히 같은 요청은 아니며 동일 요청의 중복 공유는 별도 컴포넌트/풀 회귀로 확인했다. 필터/기간 변경 즉시 이전 숫자를 숨기고 250ms 뒤 현재 원본 범위로 자격을 다시 판정한다. 중간/늦은 응답·일시정지·503 명시 재시도는 관련 회귀로 확인했다.

리뷰에서 발견한 두 오류를 수정했다. (1) 페이지를 연 뒤 지표가 바뀌어도 같은 저장 임계값으로 새 정의를 조용히 사용하던 경계를, 매 조회의 **저장 catalogRevision** 전후 검사로409 차단했다. 실제 API의 낡은 revision409와 실제 DuckDB의 조회 전/실행 중 지표 변경 회귀를 확인했다. (2) 같은 요청 풀이 계정 전환 뒤 이전 계정 promise를 새 구독자에게 공유하지 않도록 항목의 로그인 세대/subject fence를 가입·완료 시 검사했다. 인증이 전송 전에 사라지면 POST0·비동기 거절로 기존 Pivot 호출자의 오류/로딩 종료를 유지한다. A→B pending 공유/늦은 데이터·전송 전 인증 소실을 회귀로 확인했다. 개발 중 FE HMR이 새 catalogRevision을 먼저 보낸 동안 구 API가400을 반환한 관측은 초기 network 기록에 남겼으며, 최종 빌드 API 재기동 후201로 확인했다.

디자인 검증에서 카드 좌우 padding 누락·과한 수직 간격·중첩 ring을 발견해 기존 shadcn **CardHeader/Content, sm spacing**과 일반 div의 embedded 표로 정리했다. 수정 전 `segment-dashboard-before-spacing-*`, 최종 `segment-dashboard-final-*`를 구분한다. 최종390/768/1440 모두 페이지 넘침0·카드 제목16/18/18px·제거 버튼36px·내용 좌우12px다. 모바일 표 영역310px/표639px는 내부 스크롤만 사용한다. 실제 End329→Home0·Shift+Tab 제거→Tab 표 포커스를 확인했다. 최종 세폭/키보드 캡처를 직접 검토했다. 실휴대폰·VoiceOver는 미실행/BLOCKED다.

관련 BE55개/FE99개·최종 간격 수정 후 영향8개, 양쪽 build·FE type/양쪽 lint·기존 격리 Pivot 저장/복원/CSV core1 PASS다. 순수 시각 변경 뒤 core 전체를 반복하지 않았다. 읽기 전용 리뷰의 두P2와 비동기 거절 회귀를 수정한 뒤 CLEAR를 받았다. 기존 비소유/타 소스/정의 변경·20개 보기/8개 Pivot 한도는 관련 하위 회귀를 재사용했다. AI/VoiceOver/운영 설정을 바꾸지 않았고 모델 호출은 이번 범위에서 새로 실행하지 않았다. commit/push 없음.

증빙: 기존 외부 폴더의 `segment-dashboard-{before,api,reload}.json`, `segment-dashboard-network-initial.json`, `segment-dashboard-common-date.json`, `segment-dashboard-rapid.json`(느린 클릭) / `segment-dashboard-rapid-under250.json`(최종 조건), `segment-dashboard-layout.json`, `segment-dashboard-keyboard-final.json`, `segment-dashboard-final-{390,768,1440}.png`, `segment-dashboard-keyboard-final-390.png`, `segment-dashboard-add-390.png`, `segment-dashboard-empty-390.png`와 `segment-dashboard-manifest.json`. 기존 Rill 숫자/비율/원본/일반 Pivot 비교는 재사용하며 이번 새 대시보드 배치를 Rill 픽셀 동등성으로 주장하지 않는다. 운영·외부 채널·실기기·전체 제품 수용은 별도다.


## RXS02 대시보드 집계 CSV — E1~E2

- E1: 현재 대시보드 집계 Pivot의 결과에서 표시 집계 CSV를 명시 다운로드한다. 저장 catalogRevision/현재 필터·기간/집계 단위와 결과 viewRevision을 전달하고 KPI·셀·행/열 합계의 정확 값이 화면 및 독립 정답과 일치한다. 원본 행은 제외하며 범위/단위/상한을 포함한다. 필터 변경·재조회/오류/일시정지에는 이전 CSV 컨트롤을 유지하지 않는다. 기존 export 인증·정의 변경409·한도/계정 전환 차단을 재사용한다.
- E2: 실제 기본5431.25/Compute3460USD CSV를 비교하고,390/768/1440의 컨트롤 정렬·설명/오류 줄바꿈·페이지 넘침0·Tab/Enter 다운로드를 확인한다. 새 엔진·게시/외부 공유를 추가하지 않는다. Rill/원본 집계 정답의 기존 PASS와 무관한 검사는 반복하지 않는다.

### RXS02-E1~E2 결과 — 2026-10-18 Ego29

**선택 범위 PASS.** 기존 대시보드3의 두 집계 Pivot에 `ExploreExport`를 연결했다. 현재 합성 요청 본문(저장 catalogRevision/공통 필터·기간/저장 집계 단위)과 최신 성공 결과의 viewRevision을 함께 보낸다. 지표 정의·CSV 생성·인증 경계는 기존 서버/내보내기 구현을 재사용하며 새 엔진/백그라운드 작업/DB 쓰기는 없다. 필터/기간 변경·일시정지/오류에는 이전 내보내기 컴포넌트가 제거되며 새 성공 결과에만 다시 나타난다. 범위 변경 후 stale export·늦은 계정 응답/정의409·크기 한도 검증은 기존 단위 범위를 재사용했다.

실제 Tab/Enter로 기본 CSV50행을 다운로드했다. 공통 Compute 결과는32행·3460USD/12.774566473988438%, 저장한2025-01-06~15/주 집계는31행·동일 금액/마진이다. 기본은5431.25USD/5.390840046029919%이며 셀/열 합계와 조건 metadata를 포함한다. 세 파일 모두 실제 서버 CSV와 바이트 동일, Pivot 셀·기간/필터·지표 단위/잘림 정보를 확인했고 원본 행 section은 없다. 숫자 기대값은 기존 독립 CSV/Rill 증빙을 재사용했다. DB의 대시보드3 전체 row는 D1~D3 종료 이후 불변이다.

자동화 중 두 번째 다운로드 대기가30초 만료됐다. 관측 당시 실제 포커스는 Compute 메뉴에 있었고 두 번째 export POST가 없었다. 이를 다운로드 성공이나 제품 서버 오류로 처리하지 않았다. 이후 메뉴가 닫혔는지 확인하고 정확한 기간 Pivot 다운로드 버튼의 포커스/그룹명을 재확인→Enter로31행 파일을 받았다. 최종 레이아웃에서도390px에서 trigger→Tab→다운로드 Enter·50행 파일을 재확인했고 이전 기본 파일과 바이트 동일하다. 네이티브 메뉴 전체/OS 파일 chooser를 검증한 것은 아니다.

최초 화면에서768px의 요약 줄바꿈/1440px의 오른쪽 좁은 안내 패널 때문에 생긴 빈 공간을 발견했다. 기존 Export에 선택적 summary 툴바를 추가해 요약+36px/14px 버튼을 정렬하고 펼친 안내는 전체 폭 grid를 사용한다. 원래 탐색 화면의 기본 레이아웃은 유지한다. 수정 전 `segment-dashboard-export-before-toolbar-*`, 최종390/768/1440 캡처를 구분해 직접 확인했다. 최종 페이지 넘침0·툴바 폭310/574/1238px·요약 높이36px·버튼36px/14px이며 표 내부 스크롤 계약은 유지한다.

관련 FE16/type/lint/build PASS. 서버/SQL/저장 계약을 바꾸지 않아 직전 BE55·영향 core1과 Rill/지표 숫자 PASS를 재사용했다. 이번에는 전체 단위/core/모델 호출/실기기를 반복하지 않았다. gpt-6-luna 설정/VoiceOver BLOCKED 유지·commit/push 없음. 증빙은 기존 외부 폴더의 `segment-dashboard-export-{default,compute,period,final-keyboard}.csv`, `segment-dashboard-export-checks.json`, `segment-dashboard-export-network.json`, `segment-dashboard-export-layout.json`, `segment-dashboard-export-{390,768,1440}.png`, `segment-dashboard-export-keyboard-390.png/-keyboard.json`, 검사 로그와 `segment-dashboard-export-manifest.json`이다. Studio 블록/공개 게시 Pivot·운영/실기기/전체 제품 수용은 별도다.


## RXS02 대시보드 집계 조건 재사용 — F1~F3

- F1: 소유 대시보드의 집계 Pivot에서 조건 다시 탐색을 열면 현재 공통 필터·기간/저장 집계 조건·선택 지표·축을 시작점으로 복원한다. 열기/수정만으로 집계/저장하지 않고 명시 적용한다. 기존 AggregateSegment/개인 보기/추가 경로를 재사용하며 source/catalogRevision을 고정한다. 원래 Pivot/개인 보기는 자동 덮어쓰지 않는다.
- F2: Compute 범위의 매출≥1000→600·마진<20으로 수정하면 Hanul/Baro 두 대상6기여행의 매출4100.50USD/마진8.7818558712…%다. 새 개인 보기로 저장→같은 대시보드에 추가→닫기/reload하며 원래 두 Pivot/보기/정의 보존을 확인한다. 저장 없이 닫기는 입력만 폐기한다. 원본 행의 계산기/권한/낡은 revision 차단은 기존 하위 검증을 재사용한다.
- F3:390/768/1440에서 대화상자의 높이·안쪽 스크롤·버튼/레이블 정렬·표 스크롤·닫기와 키보드 적용/저장/추가를 확인한다. VoiceOver/실기기·공개 게시 지원은 별도다.

### RXS02-F1~F3 결과 — 2026-10-18 Ego30

**선택 범위 PASS.** 기존 소유 대시보드3의 집계 Pivot에 ‘조건 다시 탐색’을 연결했다. 저장 조건/지표·행/열·집계 단위와 열 때의 유효 공통 필터·기간을 지역 초안으로 복원하고, 열기/조건 변경은 집계를 자동 실행하지 않는다. 원본 Pivot/개인 보기는 자동 덮어쓰지 않으며 기존 AggregateSegment→개인 보기→대시보드 추가 경로를 재사용한다. 저장 catalogRevision과 sourceRevision을 조회/CSV에 전달하고 응답 직전 로그인 세대를 확인한다. 늦은 타 계정 응답·소스/정의 변경 차단은 해당 회귀와 기존 서버 검증을 재사용했다.

실제 공통 Compute 범위에서 매출≥1000을600으로 바꾸고 마진<20을 유지→Enter 적용→Hanul/Baro 두 대상·기여6행을 확인했다. 독립 CSV Decimal 정답은 **매출4100.50USD/이익360.10USD/마진8.781855871235…%**이고 화면8.78%/서버 응답과 일치한다. 비율은 고객/셀 비율을 평균하지 않는다. Enter로 새 개인 보기3 `RXS02 Compute 600 재사용` 저장→기존 대시보드3 선택/Enter 추가→닫기→reload로 세 번째 Pivot을 확인했다. 공통 필터가 초기화된 reload 뒤에도 새 보기의 저장 Compute/600 범위는 유지된다. 원래 보기1/2·Pivot1/2 전체 사본과 대시보드의 분석/배치/공유·게시 관련 필드는 보존했다. 변경은 개인 보기3 추가 및 기존 대시보드의 pivotDefinitions/updatedAt이며 새 지표/대시보드/게시 생성0이다.

세 번째 Pivot을 다시 열 때 요청0·기준600 복원을 확인했다. 적용 후 기준값9000을 키보드로 입력하고 적용/저장 없이 Escape→닫기는 Pivot 목록 GET만 실행하며9000 조회/저장0이다. 최종 SQLite 원문 비교에서 저장 직후와 대시보드 전체 row/개인 보기3개가 정확히 동일하다. 닫기는 편집 초안을 버리며 실제 실행 중 쓰기의 취소/확정 결과를 추측하지 않는다.

읽기 전용 리뷰에서 저장/추가 응답 대기 중 바깥 편집창이 닫혀 확인 상태를 잃을 수 있는 P2를 발견해 수정했다. 개인 보기 저장/삭제·대시보드 추가의 pending을 상위에 전달하고 동기 ref로 Escape/바깥 클릭/닫기/패널 해제를 잠근다. 중첩 쓰기 수를 합쳐 먼저 끝난 응답이 다른 쓰기의 잠금을 해제하지 않게 했다. 읽기 조회는 닫을 수 있다. held save/add 응답의 닫기 차단은 컴포넌트 회귀이며 실제 지연 프록시 UI 실행으로 확대하지 않는다. 후속 리뷰 CLEAR다.

디자인 검증 중768px에서 Dialog가 화면 전체768px로 늘어나 여백이 사라지는 오류를 캡처하고 지역 width/maxWidth로 수정했다. 최종390/768/1440 대화상자는 **358/736/1100px**, 높이900px(1000px viewport), 좌우 최소16px·페이지/대화상자 가로 넘침0이며 내용만 세로 스크롤한다. X 도구32px/일반 버튼36px·14px를 확인했다. 모바일 표는290px 영역 안479px 표를 두고 실제 키 이벤트 **End189→Home0**, 포커스/합계4,100.50·8.78%를 캡처했다. 초기 resize 직후 End0은 아직 데스크톱 폭 전환 중이었으므로 모바일 PASS로 세지 않았고, 안정358px/표290px를 기다린 뒤 CDP 실제 keyDown/keyUp으로 재확인했다. 최종 세폭 편집창/저장 카드와 모바일 결과를 직접 검토했다. 실휴대폰/VoiceOver는 미실행/BLOCKED다.

관련 BE4·FE 6파일144개 및 추가 인증 응답 회귀1개(해당 파일5개 재실행)로 **서로 다른145개** PASS다. BE build/lint·최종 FE type/lint/build PASS, 공통 개인 보기/추가 영향의 기존 격리 Pivot 저장·새로고침·복원·CSV·삭제 core1개9.0초 PASS다. 마지막 지역 폭 CSS 변경 뒤 동작 테스트/core를 반복하지 않고 세폭 UI/type/lint/build로 확인했다. 린트 명령의 잘못된 PersonalSavedViews 경로 오류는 올바른 Dashboard/Components 경로로 수정해0으로 마쳤다. 서버 SQL/Rill 계산기는 바꾸지 않아 이전 같은 CSV/Rill 숫자·권한/상한 증빙을 재사용하며 이번 새 편집창의 Rill 픽셀 동등성을 주장하지 않는다. 모델 호출0·gpt-6-luna/VoiceOver 설정 유지·commit/push 없음.

증빙: 기존 외부 폴더의 `segment-edit-{before,after,query,saved-flow}.json`, `segment-edit-before-tablet-width.{png,json}`, `segment-edit-final-dialog-{390,768,1440}.png`, `segment-edit-final-layout.json`, `segment-edit-result-390.png`, `segment-edit-mobile-table-keyboard.json`, `segment-edit-cancel-keyboard.json`, `segment-edit-final-db-check.json`, `segment-edit-dashboard-final-{390,768,1440}.png`/`-layout.json`, 검사 로그와 `segment-edit-manifest.json`이다. Studio 블록/공개 게시 지원·운영/실기기/전체 제품 수용은 별도다.


## RXS02 Pivot 기여 원본 탐색 — G1~G3

P3 직접 탐색/근거 확인을 위한 후속이다. 현재 집계 Pivot은 전체 대상 원본만 보여 셀의 기여를 바로 확인할 수 없다. 기존 원본 필터→HAVING 자격 판정은 보존하고 그 뒤 행/열 선택으로만 상세 범위를 좁힌다. 같은 canonical 지표·고정 파일·권한/정의 검사를 재사용한다. 저장/CSV/공통 필터와 원래 Pivot을 바꾸지 않는다.

- G1: 실제 margin.csv/보기1(company 매출≥1000·마진<20%)의 Baro×Compute는 원래 company 자격 판정 후 기여3행·매출640.50USD/이익-81.90USD/마진-12.7868852459…%다. Compute를 원본 필터로 먼저 적용해 Baro가 사라지는 동작으로 대체하지 않는다. Hanul×Compute는3행3460USD/12.7745664739…%. 셀/행합계/열합계/전체합계의 명시 상세 요청과 페이지 이동을 지원하고 빈 셀/NULL 축을 구분한다.
- G2: 적용 결과 viewRevision과 source/catalogRevision을 확인하고, 선택 값은 데이터 바인딩으로만 전달한다. 자격 미달/없는 값은0행, 낡은 결과409·비소유403·익명401, 느린 응답 뒤 필터/대상/계정 변경은 이전 행을 표시하지 않는다. 상세는 명시 요청이며 새 KPI/차트 전체를 재계산하지 않는다. 저장·게시·새 지표/대시보드 쓰기0.
- G3: 대시보드와 기존 조건 재탐색의 Pivot에서 선택→상세→닫기를 연결하고390/768/1440 레이아웃·표 내부 스크롤·Tab/Enter/Escape·포커스 복귀를 확인한다. 새 캡처/독립 숫자와 기존 Rill 계산 증빙을 구분한다. 실제 Rill 새 drill 동작은 실행 전 미확인, 실휴대폰/VoiceOver BLOCKED/운영은 별도다.

### RXS02-G1~G3 결과 — 2026-10-18 Ego31

**선택 범위 PASS.** 대시보드와 조건 재탐색의 집계 Pivot 셀/행 합계/열 합계/전체 합계를 실제 버튼으로 연결했다. 공통 `SegmentPivotDetails`는 같은 적용 결과의 고정 source/catalog/view revision과 원래 조건을 보내고, 명시 선택 뒤에만 읽기 전용 상세를 조회한다. 새 `/bi/explore/segments/details`는 기존 검증/정의 compiler/eligible→scoped_rows를 재사용한다. 선택은 HAVING 뒤에만 `IS NOT DISTINCT FROM ?`/bound 값으로 적용하며, COUNT+canonical 합계1회와 페이지 원본1회만 분석 조회한다. Pivot/추세를 다시 조회하지 않는다. preflight의 소유권/정의 메타데이터 조회는 별도이며 전체 DB 요청이 두 건뿐이라는 뜻은 아니다.

보기1의 원래 company 자격(매출≥1000·마진<20%)은 보존한다. 실제 Enter로 **Baro×Compute**를 열면 기여3행/매출640.50USD·이익-81.90USD·마진-12.7868852459…%=**-12.79%**다. 매출0·원가150/60인 두 행도 기여에 포함해 양수 매출 행만 보는 오류를 피한다. Hanul×Compute3행3460USD/12.7745664739…%, Baro 행합계4행1171.25USD, Compute 열합계6행4100.50USD/8.7818558712…%, 전체8행5431.25USD/5.3908400460…%를 실제 API/독립 CSV Decimal과 대조했다. UI는 셀/중첩 행 합계, API는5선택 범위·단위는2개씩 페이지로3행을 정확히 확인했다. 20행 넘는 실제 브라우저 페이지 이동은 미실행이며 해당21행 응답 변형은 컴포넌트 회귀다.

Rill0.90.5의 같은 margin.csv를 열어 최초 Model Data 진입을 확인했다. 초기 Last7Days 캡처는 동일 범위 정답 비교로 세지 않는다. 이후 **All time/UTC·company Baro Tech·component Compute**를 실제 선택해 Revenue$640.5/Cost$722.4/Profit-$81.9/Margin Percent-12.79%와 Model Data **3 of18 rows**를 확인했다. Rill은 하단 Model Data 패널, VM은 셀에서 여는 범위/합계/행의 읽기 전용 대화상자다. 같은 세 행의 결과는 일치하지만 Rill에서 이번 HAVING+Pivot 셀 drill까지 실행하거나 픽셀·전체 기능 동등성을 주장하지 않는다. 범위 필터를 먼저 넣으면 자격이 달라지는 VM 조건은 별도 실제 DuckDB 검사로 확인했다.

낡은 view/source/catalog 실제409·비소유 파트너403·익명401·잘못된 선택400을 확인했다. NULL 축과 문자열null/빈 교차 셀·SQL 형태의 값0행·조회 중 지표 변경409·페이지 합계/바인딩은 실제 DuckDB 회귀다. 선택은 `{row?,column?}`의 원래 scalar만 받으며 축 이름/SQL은 받지 않는다. `{}`는 전체 합계, 자격 미달/없는 값은0행이다. 표시 상한 밖의 값도 같은 소스 소유자의 기존 원본 권한을 확대하지 않으며, 표시 상한을 접근 권한으로 간주하지 않는다. CSV/개인 저장 보기에는 selection을 추가하지 않는다.

상세 응답은 원래 KPI/CSV/저장 상태와 분리된다. 기준 필터/기간 변경은 즉시 창을 닫고 요청 취소·늦은 결과 무시, 계정 변경 뒤 늦은 응답/503 명시 재시도/409 재조회 유도는 회귀로 확인했다. 실제 오류 주입 프록시 UI로 확대하지 않는다. DB 원문 비교에서 대시보드3의 전체 row·개인 보기3개·dashboard/metric/view 개수 불변이다. source 수정·새 저장/게시0이며 UI 읽기 요청만 실행했다. 읽기 전용 reviewer는 P1/P2 없음(CLEAR)으로 판정했다.

390/768/1440 최종 대화상자 폭358/736/1100px·페이지/대화상자 가로 넘침0·일반 버튼36px/14px, 표 영역320/698/1062px이며 모바일 표926px만 내부 스크롤한다. 모바일 캡처에서 잘리던 caption을 표 밖 안내/접근 가능한 숨김 caption으로 옮겨 수정했다. 실제 End606→Home0·Escape→원래 셀 포커스를 확인했다. 조건 재탐색의600 초안 안에서 셀 Enter→상세 Escape→Tab 행 합계/Enter→상세 Escape에도 외부 창1개/기준600·결과/초점 유지→바깥 Escape로 종료했다. 초기 offscreen 재탐색 클릭의 고정 헤더 svg 가림은 입력 실패로 기록하고, 현재 보이는 세 번째 카드의 Tab/Enter 경로로 이어갔다. 셀은14px/우측 정렬/두 지표58px의 ghost 버튼이며 일반 제어 높이를 표 셀에 일괄 강제하지 않았다. 최종 편집·상세/표 캡처를 직접 검토했다. 실휴대폰/VoiceOver는 NOT_RUN/BLOCKED다.

관련 BE23 PASS(조회 후 변경 guard1개 보강 재실행), FE 고유82개 PASS(5파일20+통합61+상세 새409 회귀1; 상세 파일5개 재실행), BE build/lint·최종 FE type/lint/build·diff check PASS다. 기존 classic Pivot/저장·CSV core는 제품 경로 미변경으로 직전 PASS를 재사용했으며 전체 suite/core를 반복하지 않았다. 서버 재기동은 이번 격리4560 프로세스만 수행했고 정상 API를 유지했다. AI 호출0·Codex/gpt-6-luna/VoiceOver 설정 유지·commit/push 없음.

증빙: 기존 외부 폴더의 `segment-cell-before.json`, `segment-cell-api-oracle.json`, `segment-cell-final-db-check.json`, `segment-cell-{browser-network,final-browser-network}.json`, `segment-cell-final-dialog-{390,768,1440}.png`/`-layout.json`, `segment-cell-keyboard-390.png`/`-keyboard.json`, `segment-cell-nested-390.png`/`-nested-keyboard.json`, `segment-cell-dashboard-final-1440.png`, `segment-cell-rill-{model-data,baro-compute,filtered-rows}-1440.png`/대응JSON·검사 로그와 `segment-cell-manifest.json`이다. 조직 정책/Studio 블록·공개 게시 Pivot/운영/전체 제품 수용은 이번 선택 검증과 구분한다.


## 누적 변경 커밋 전 통합 — 2026-10-18

RXS01~24 및 C~G 후속의 누적 변경을 사용자 요청으로 develop-v2에 커밋·push한다. 로컬 f4c0f632 기준 root build PASS, 전체 BE2394 중 기존135파일 PASS와 실패5파일 수정 재검증을 합쳐2394 PASS, FE115파일1553 PASS다. 비가산 모델 metadata 조회가 추가된 뒤 구 테스트의 빈 manager mock이67건 실패했으며 제품의 검사를 완화하지 않고5개 fixture에 올바른 EntityManager.findOne 시그니처를 제공했다. 재실행4파일/마지막 탐색1파일에서 전부 확인했다. 기존 실제 브라우저/core 증빙은 관련 변경 없이 재사용했다. 원격 develop-v2가49커밋 앞선 상태를 확인했으므로 로컬 기록 커밋 후 병합/필요한 통합 검증을 별도로 기록한다. 검증 로그는 기존 외부 증빙 폴더에 보존하며 AI/VoiceOver 설정은 유지한다.

### 최신 develop-v2 통합

로컬 누적 커밋 `a9b6e04e`와 원격 `e763aee3`(49커밋)의39개 충돌을 양쪽 기능·권한 계약을 보존해 해결했다. root build PASS. BE 전체 최초 실행은186파일3793 PASS/16파일94 FAIL/6파일87 SKIP였으며 실패16파일을 수정·선택 재실행해 모두 PASS다(전체 suite를 다시 실행했다고 보고하지 않는다). Studio 복제2건의 병렬 부하 timeout은 파일 단독49/49 PASS로 확인했고 한도를 늘리지 않았다. FE 전체154파일 중153파일2332 PASS, DataLayout 문구4건 실패는 기대 문구 수정 후 해당 파일15/15 PASS다. 격리 핵심 E2E는 원격에서 확장된 현재 구성16/16 PASS(1.1분)다.

실제 제품 통합 수정은 파일 갱신의 인증 세대 전달이다. 같은 JWT 요청에서 확인된 epoch를 작업 접수/영속 저장/재시작·재시도/파일 포인터 활성화 트랜잭션에 연결했다. 현재 사용자 epoch로 대체해 권한을 새로 만들지 않는다. 기존 null epoch 작업은 fail-closed이며 nullable migration은 SQLite up/down/멱등 검증했다. guard 후 회수·클라이언트 덮어쓰기·null job HTTP를 포함한 파일22개 검증 PASS, 운영 MySQL은 미실행이다. 나머지는 새 manager/메타데이터·통화 확인 계약의 fixture 보정이며 조건/권한/타입 검사를 완화하지 않았다.

증빙: `/tmp/vm-studio-pivot-merge-{full-tests,full-fe,full-build,core}.log`, `/tmp/vm-studio-merge-{remix-full-retry,legacy-retry2}.log`, `/private/tmp/vm-be-integration-handoff/REPORT.md`와 해당 선택 로그, `/tmp/vm-studio-pivot-merge-data-layout-recheck.log`. core 실행 루트는 `/var/folders/sl/hmhwv1h547bbqpt651cb43140000gn/T/vanillameta-qa-kO4wZG/`다. gpt-6-luna/VoiceOver BLOCKED 유지. 이 통합 검증은 신규 Studio Pivot 완료 증빙이 아니다.

통합 커밋 `6ecb22a9`의 첫 push는 원격 동시 갱신으로 fetch-first 거절되어, 신규 `305bc9af` 업무 의미 고정 변경도 강제 push 없이 합쳤다. 추가8충돌과 자동 병합의 FORMULA 경계를 정리했다. 기존 보고서 presentation/통화 확인·비가산 열/저장 지표 식을 유지하고 새 raw 열 업무 기준·고정 이력과 결합했다. 계산 지표도 동일 actor/소스/참조 lock·트랜잭션을 거쳐 저장하며 Studio의 식 피연산자 열도 업무 기준에 포함한다. 추가 root build/type/lint PASS, Studio 기존 Service33 PASS 및 변경 Creation/Remix/BusinessBasis170 PASS, 관련 semantic/compiler/trend72 PASS·runtime/consumer/formula62 PASS와 helper40 PASS(중복 합산 금지), FE 관련155/후속107·최종표현8 PASS다. 신규 업무 기준 E2E1개는 직접 미리보기 범위 PASS이며 `QA_REAL_CODEX` 이후 실제 모델·저장·게시 분기는 이번 실행에서 미실행이다. 증빙 `/tmp/vm-second-merge-*.log`, `/tmp/vm-second-formula-runtime-tests.log`, `/tmp/vm-studio-merge2-fe-handoff.md`, 선택 E2E 루트 `/var/folders/sl/hmhwv1h547bbqpt651cb43140000gn/T/vanillameta-qa-NOl9Oq/`를 참조한다.

추가 피연산자 의미 회귀24 PASS 및 BE 최종 build/lint PASS. 기존 native FORMULA의 계산/저장은 보존했지만 새 businessBasis 이력에 고정된 지표를 피연산자로 구성하는 FORMULA는 기존 엄격 helper가 거절한다. 이 조합의 지원은 미완료이며 의미를 제거해 우회하지 않는다. [BE 인계](/private/tmp/vm-second-merge-be-handoff/REPORT.md)의 한계를 유지한다.
