# Studio Pivot Source Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장한 차트·집계 Pivot 혼합 Studio를 본인 다른 파일 소스로 연결해 쓰기 없는 미리보기 후 새 비공개 대시보드로 원자 저장한다.

**Architecture:** 기존 DashboardReuseService의 열 연결·ticket·영수증을 확장한다. 집계 실행 핵심을 저장 지표 준비와 분리하고, 서버가 검증한 후보 지표 그래프로 Pivot을 미리보기한다. 저장 시 지표의 실제 ID와 최종 catalog revision을 확정해 혼합 문서와 함께 저장한다.

**Tech Stack:** 저장소의 Node24, TypeScript, NestJS, TypeORM, SQLite/MySQL metadata, 서버 DuckDB, React18·shadcn, Jest/Vitest 및 MD/Ego 검증을 유지한다. 의존성/DB 스키마 추가는 없다.

**Spec:** [승인 설계](../specs/2026-10-19-studio-pivot-source-reuse-design.md), 기준 `f827046c`, develop-v2. 이 계획은 아직 실행 전이다.

## Global Constraints

- 첫 지원 범위는 본인이 소유한 활성 DuckDB 파일 소스와 저장된 `SEGMENT_PIVOT` 및 일반 차트가 함께 있는 최대6블록이다.
- 명시 제외 후에도 일반 차트가 최소1개 있어야 한다.
- 미리보기 때문에 Metric/PersonalView/Dashboard/Widget/StudioState/영수증 행을 생성·변경하지 않는다.
- 새 게시·익명 링크·grant는 만들지 않는다.
- 새 복제 서비스·DB 테이블·외부 큐·분석 엔진·UI 프레임워크는 추가하지 않는다.
- 수신자·공개 게시본 remix, 현재 파일 교체, 지표 이름 기반 재사용 추정, 조건 단위 변환, 원본 상세 조회, 새 AI 기능은 제외한다.
- gpt-6-luna 설정과 VoiceOver BLOCKED를 유지한다.
- 일반 버튼/입력36px·도구32px, 모바일 입력16px 및390/768/1440px를 따른다. 표 내부 이외 페이지 가로 넘침0이다.
- 실행 환경은 기존 package.json의 Node `>=24.11.0 <25`를 따른다. 전체 테스트를 매 단계 반복하지 않으며 실행하지 않은 조건은 NOT_RUN으로 남긴다.

## Review Focus

1. SQL 내부 alias와 같은 열 이름, NULL과 문자열 `null`, 따옴표가 있는 열/범주는 서로 섞이지 않아야 한다. Task1의 핵심 실행 테스트가 소유한다.
2. 두 블록이 공유하는 FORMULA leaf는 한 번만 복제하며 같은 이름의 다른 버전은 합치지 않는다. Task2의 그래프 테스트가 소유한다.
3. 서로 다른 원본 축·필터 열을 한 대상 열로 연결해 의미가 합쳐지는 경우는 미리보기 전에 거절한다. Task2/3의 매핑 테스트가 소유한다.
4. 새 지표 때문에 catalog revision이 바뀌는 순간, 결과 유실·서버 재시작·동일 저장 재시도는 새 복사본을 중복 생성하지 않아야 한다. Task4의 실제 metadata 통합 테스트가 소유한다.
5. 저장 StudioState가 없거나 legacy 순서/지표 연결과 어긋난 혼합 원본은 Pivot을 버린 차트 복제로 성공하면 안 된다. Task3의 원본 캡처 테스트가 소유한다.

---

## 파일별 책임과 공통 인터페이스

새 파일은 다음 책임으로 제한한다. 기존 큰 service 전체를 재구성하지 않는다.

| 파일 | 책임 |
| --- | --- |
| `backend-api/src/bi/bi-segment-engine.ts` | 저장/후보 지표가 함께 사용하는 집계 SQL 실행 핵심과 내부 타입 |
| `backend-api/src/bi/reuse-metric-graph.ts` | 고정 정의 그래프의 중복 제거·열 연결·후보 컴파일·실제 ID 치환 |
| `backend-api/src/bi/studio-reuse-plan.ts` | 검증된 혼합 원본 캡처·블록 선택·매핑·배치/범위/계획 digest |
| `backend-api/src/bi/studio-reuse-preview.ts` | 후보 Pivot 읽기 계산·혼합 결과의 명시 투영 |
| `backend-api/src/bi/studio-reuse-persist.ts` | transaction manager에서 지표/혼합 문서/최종 revision 결합 |
| `frontend-web/src/pages/Dashboard/DashboardReuse/studioReusePreviewContract.ts` | 혼합 payload 타입·strict 응답 검증 |
| `frontend-web/src/pages/Dashboard/DashboardReuse/StudioReusePreview.tsx` | 기존 renderer를 이용한 저장 전 혼합 블록·배치 표시 |
| `frontend-web/src/pages/Dashboard/Studio/PublishedBlockView.tsx` | 기존 PublishedDashboard의 순수 블록 renderer를 추출해 재사용 |

아래 이름/계약은 후속 Task에서도 그대로 사용한다. 기존 프로필·기간·필터·문서 타입을 import하며 외부 요청에 표현식이나 catalog를 추가하지 않는다.

- `CandidateMetricKey = \`candidate:${number}\``. DB 지표 ID는 양의 정수다. 후보 키는 클라이언트가 선택하는 ID가 아니다.
- `ReuseMetricNode = { key: CandidateMetricKey; origin: { id: number; version: number; digest: string }; definition: Record<string, unknown>; dependencies: CandidateMetricKey[] }`. definition은 기존 canonical 컴파일러로 검증한 뒤에만 사용한다.
- `ReuseMetricGraph = { nodes: ReuseMetricNode[]; digest: string }`. nodes는 leaf 우선이며 순환·미지원 중첩 FORMULA를 거절한다.
- `PersistedReuseMetrics = Map<CandidateMetricKey, { id: number; definitionVersion: number; definition: Record<string, unknown> }>`.
- `StudioReusePreviewV1 = { schemaVersion: 1; kind: 'studio-reuse-preview'; title: string; capturedAt: string; scope: string; blocks: StudioReusePreviewBlock[]; layouts: StudioDocumentV1['layouts']; newMetricCount: number }`.
- `StudioReusePreviewBlock`은 `{ blockId: string; kind: StudioBlockKind; title: string; description: string; display: StudioDisplay }`와 차트의 기존 표시 결과 또는 Pivot의 whitelist 집계를 결합한 판별 union이다. Pivot은 `kind:'SEGMENT_PIVOT'`와 `pivot`, 차트는 원래 kind와 `widget`을 가진다. 두 payload가 동시에 존재하면 오류다.
- 기존 차트 전용 preview 응답의 `snapshot`은 유지한다. 혼합 응답은 그 대신 `studioPreview: StudioReusePreviewV1`을 반환한다. 공통 ticket/originalId/sourceId/expiresAt 필드는 유지하고 두 종류를 동시 반환하지 않는다.

### Task 1: 저장 지표와 후보 지표가 공유하는 집계 실행 핵심

**Files:** Create `backend-api/src/bi/bi-segment-engine.ts`, `backend-api/src/bi/bi-segment-engine.spec.ts`; Modify `backend-api/src/bi/bi-segment.service.ts`; Test 기존 `backend-api/src/bi/bi-segment.service.spec.ts`.

**Interfaces:** `executePreparedSegment<K extends number | CandidateMetricKey>(input: PreparedSegmentInput<K>, context: PreparedSegmentContext): Promise<PreparedSegmentResult<K>>`를 export한다. `PreparedSegmentInput`은 검증한 measures `{id:K,label,unit,decimalPlaces,expression}`, dimensionColumn/pivotColumn/filters/dateRange/trendGrain/page/pageSize/aggregateOnly/detailSelection을 가진다. context는 기존 profile/sourceRevision/viewRevision과 `query(sql:string, bindings:unknown[]):Promise<Record<string,unknown>[]>`, `assertCurrent():Promise<void>`를 가진다. 결과는 기존 segment 반환 필드/한도를 유지하며 집계 값 ID만 K다.

위 내부 타입은 `bi-segment-engine.ts`에서 export한다. PreparedSegmentResult는 기존 sourceRevision/viewRevision/scope/kpis/groups/groupsTruncated/pivot/trends/trendsTruncated/time/details 및 detail selection의 분기를 그대로 타입화한다. 값은 `number|string|null`, 범주/선택은 기존 허용 scalar이며 모든 metric id는 K다. HAVING 조건은 `{measureId:K;operator:'gte'|'gt'|'lte'|'lt'|'eq';value:number}`이고 detailSelection이 있으면 pivot aggregate가 아닌 기존 상세 결과를 반환한다. CandidateMetricKey도 이 파일에서 정의하고 graph가 type import한다.

- [x] **1. 실패 테스트 작성:** `prepared_candidate_matches_saved_aggregate`에서 후보 매출5431.25/마진5.390840046029919%, 같은 셀·그룹·합계; `null_and_literal_null_and_alias_columns_remain_distinct`에서 NULL/`null` 분리와 내부 alias 이름 열 보존; `prepared_result_rechecks_before_return`에서 assertCurrent 거절 시 결과 반환 없음; `aggregate_only_reads_no_raw_rows`에서 상세 SELECT0을 단언한다.
- [x] **2. Red 확인:** backend-api에서 `./node_modules/.bin/jest --runInBand --runTestsByPath src/bi/bi-segment-engine.spec.ts`. 새 export 부재로 실패해야 한다.
- [x] **3. 구현:** 현재 segmentsSnapshot의 필터→HAVING→기여 행 재집계와 detail/추세/한도 실행을 한 핵심으로 옮긴다. 저장 지표 adapter는 기존 권한·파일 snapshot·bi.prepare·최종 지표/catalog 검사를 수행한 뒤 핵심을 호출한다. Controller strict 입력은 바꾸지 않는다. 후보는 DB prepare를 호출하지 않는다.
- [x] **4. Green 확인:** 위 새 파일과 `src/bi/bi-segment.service.spec.ts`를 한 선택 명령으로 실행한다. 기존 details/export·distinct/비율/추세/잘림도 의미 불변이어야 한다. 미지원 expression/catalog 추가 필드는400이어야 한다.
- [x] **5. 커밋:** 위3파일만 stage하고 `refactor(bi): share prepared segment aggregate execution`으로 커밋한다. 공개 복제의 기존 Pivot 차단은 아직 유지한다.

### Task 2: 차트·Pivot의 공통 지표 그래프와 열 연결

**Files:** Create `backend-api/src/bi/reuse-metric-graph.ts`, `backend-api/src/bi/reuse-metric-graph.spec.ts`; Modify `backend-api/src/bi/structured-reuse.ts`; Test 기존 `backend-api/src/bi/structured-reuse.spec.ts`.

**Interfaces:** `buildReuseMetricGraph(input:{references:FrozenMetricReference[]; originalProfile:BiProfile; targetProfile:BiProfile; columnMap:Record<string,string>}): ReuseMetricGraph`; `persistReuseMetricGraph(graph:ReuseMetricGraph, sourceId:number, dataVersion:string, manager:EntityManager):Promise<PersistedReuseMetrics>`. `BiProfile = Awaited<ReturnType<BiService['profile']>>`; `FrozenMetricReference = {id:number;version:number;definition:Record<string,unknown>}`이며 입력 정의의 버전·sourceId·tableName을 검증한다. 이 파일에서 위 alias/graph 타입을 export한다. 기존 prepare/persistStructuredReuse 공개 signature/차트 응답은 보존하고 내부 그래프를 공유한다.

- [x] **1. 실패 테스트 작성:** `shared_formula_leaf_is_persisted_once`는 두 블록의 동일 ID/버전/digest leaf1개; `same_label_different_identity_is_not_merged`는 같은 이름 다른 정의2개; `formula_refs_use_new_leaf_ids`는 원본 ID 잔존0; `unsupported_basis_and_nested_formula_fail_closed`는 쓰기0; `explicit_null_default_date_is_preserved`를 단언한다. 금액 숫자·분모·가중치·COUNT(*)의 필수 열도 구분한다.
- [x] **2. Red 확인:** backend-api에서 `./node_modules/.bin/jest --runInBand --runTestsByPath src/bi/reuse-metric-graph.spec.ts`.
- [x] **3. 구현:** 기존 canonical metricFields/metricExpression/pinMetricFormula를 이용해 원본 검증→열 변환→대상 검증한다. 후보 참조는 graph 내부 키로 보존하고 영속화 시 leaf부터 새 ID를 넣는다. businessBasis를 단순 sourceId 치환하지 않는다. 대상 최신 업무 정의/기본 날짜를 자동 채택하지 않는다.
- [x] **4. Green 확인:** 새 graph와 기존 structured-reuse 테스트를 선택 실행한다. 실패 시 transaction 밖 임시 DB 지표를 만들거나 SQL 문자열로 식을 추정하지 않는다.
- [x] **5. 커밋:** `refactor(bi): plan canonical reuse metric graphs`.

### Task 3: 혼합 저장본 캡처와 쓰기 없는 미리보기

**Files:** Create `backend-api/src/bi/studio-reuse-plan.ts`, `backend-api/src/bi/studio-reuse-preview.ts`, 각 `.spec.ts`; Modify `backend-api/src/bi/dashboard-reuse.service.ts`, `backend-api/src/bi/bi.module.ts`는 내부 연결 준비만 한다. Controller의 혼합 원본 활성화는 Task4 끝에서 한다.

**Interfaces:** `captureStudioReuseOrigin(input:{analysis:Analysis; snapshot:Record<string,unknown>; document:StudioDocumentV1; catalog:Catalog}):StudioReuseOrigin`; `prepareStudioReusePlan(origin:StudioReuseOrigin, target:BiProfile, input:{title:string;columnMap:Record<string,string>;blockIds:string[]}):StudioReusePlan`; `previewStudioReuse(plan:StudioReusePlan, context:StudioReuseReadContext):Promise<StudioReusePreviewV1>`. `Analysis = Awaited<ReturnType<AiDashboardService['analysis']>>['data']`, `Catalog = Awaited<ReturnType<BiExploreService['catalog']>>`를 사용한다. Origin/Plan/Context와 미리보기 payload 타입은 `studio-reuse-plan.ts`에서 export한다. plan은 원본·대상 버전/catalog digest, 원본 참조, 선택 블록/세 폭 배치, 범위, Task2 graph를 포함한다. Context는 일반 차트 preview, Task1 집계 query, 전후 현재 기준 확인 callback을 가진다.

- [x] **1. 실패 테스트 작성:** `mixed_order_is_keyed_not_widget_index`는 chart/Pivot/chart 순서·모든 폭 배치; `missing_studio_state_never_falls_back`와 `legacy_pivot_order_mismatch_is_rejected`는 오류; `explicit_exclusion_removes_only_unused_requirements`는 제외 블록 전용 열만 제거; `two_axes_or_filter_columns_cannot_merge_implicitly`는 모호한 매핑 거절; `common_scope_overrides_pivot_scope_per_column`은 기존 우선순위를 단언한다.
- [x] **2. Red 확인:** backend-api에서 `./node_modules/.bin/jest --runInBand --runTestsByPath src/bi/studio-reuse-plan.spec.ts src/bi/studio-reuse-preview.spec.ts`.
- [x] **3. 구현:** 저장 document/structured snapshot/일반 widgets의 subset·ID·revision을 대조한다. 지원 밖 블록은 draft 설명에 이유를 표시하되 기본 선택을 해제하지 않는다. 원본·대상 권한/파일을 계산 전후 검사하고, 미리보기는 Task1/2로 계산한다. Pivot 출력은 기존 studioPivotResult의 whitelist/표시용 순번 ID를 사용해 실제 DB ID와 후보 키를 외부 결과에 섞지 않는다. 부분 실패에는 저장 ticket을 발급하지 않는다.
- [x] **4. Green 확인:** 위 테스트 + 실제 임시 DuckDB에서 이름 변경18행/중복36행의 Decimal 정답을 확인한다. query callback이 metadata transaction 안에서 실행되면 실패하도록 검사하고 모든 대상 metadata 테이블을 전후 내용 비교한다.
- [x] **5. 커밋:** `feat(bi): prepare read-only mixed Studio reuse previews`.

### Task 4: 혼합 복사본 원자 저장과 API 활성화

**Files:** Create `backend-api/src/bi/studio-reuse-persist.ts`, `backend-api/src/bi/studio-reuse.integration.spec.ts`, `backend-api/src/bi/studio-reuse.mysql.spec.ts`; Modify `backend-api/src/bi/dashboard-reuse.service.ts`; Test 기존 `backend-api/src/bi/dashboard-reuse.service.spec.ts`, `backend-api/src/bi/shared-reuse.service.spec.ts`.

**Interfaces:** `persistStudioReuse(plan:StudioReusePlan, metrics:PersistedReuseMetrics, savedCharts:SavedChartResult, manager:EntityManager):Promise<{id:number;revision:string;document:StudioDocumentV1}>`는 원자 저장의 내부 단계다. 이 파일에서 `SavedChartResult = {id:number;draft:Analysis;blockIdMap:Record<string,string>}`를 export한다. blockIdMap은 원본 chart blockId→최종 chart blockId이며 새 Pivot ID는 이 단계에서 발급한다. transaction/영수증의 소유자는 계속 DashboardReuseService다. 저장 입력은 `{ticket,requestId}` 그대로다.

- [x] **1. 실패 테스트 작성:** `preview_writes_zero_and_save_adds_graph_once`, `new_metric_catalog_revision_covers_all_copied_pivots`, `failure_after_metric_insert_rolls_back_everything`, `same_receipt_after_ticket_loss_returns_one_copy`, `changed_target_catalog_rejects_before_insert`, `revoked_epoch_or_deactivated_source_rejects_save_and_receipt_read`를 실제 SQLite로 작성한다. `PersonalView` 행 증가는0, 원본/게시/대상 기존 지표 내용 불변, 모든 최종 참조는 대상 source와 새 ID임을 단언한다.
- [x] **2. Red 확인:** backend-api에서 `./node_modules/.bin/jest --runInBand --runTestsByPath src/bi/studio-reuse.integration.spec.ts`.
- [x] **3. 구현:** 현재 actor/epoch fence→원본 Dashboard fence→두 Source 오름차순→참조 Metric 오름차순의 기존 helper 계약을 지킨다. receipt를 현재 권한으로 확인하고 plan의 원본/대상/catalog digest를 재검사한다. Task2 영속화와 기존 chart 저장, Task4 문서 결합을 한 metadata transaction에 둔다. 최종 catalog는 같은 manager에서 읽고 revision 확정 후 StudioState/영수증을 저장한다. 일반 `StudioPivotService.assertSaved`는 변경하지 않는다. 기존 owned guard를 검증한 혼합 경로로 대체하고 share/publication guard는 유지한다.
- [ ] **4. Green 확인:** 위 통합과 기존 owner/shared reuse를 선택 실행한다. MySQL용 별도 연결2개에서 source 변경/지표 삭제 대기·복제 중복 저장을 검증한다. 기존 metric-deletion.mysql.spec.ts의 `VM_UC055_MYSQL_CONFIG`/`VM_UC055_MYSQL_OWNER`와 같은 설정 파일·owner guard 형식을 사용하되 이번 새 spec은 `VM_STUDIO_REUSE_MYSQL_CONFIG`/`VM_STUDIO_REUSE_MYSQL_OWNER`로 분리한다. backend-api에서 `./node_modules/.bin/jest --runInBand --runTestsByPath src/bi/studio-reuse.mysql.spec.ts`를 실행한다. 설정이 없으면 명시 SKIP/NOT_RUN이며 PASS가 아니다. 작업 소유 격리 컨테이너·전용 DB 외 접속은 금지한다.
- [x] **5. 커밋:** `feat(bi): atomically save Pivot source replacement copies`. 이 시점부터 backend 혼합 복제 API를 사용할 수 있다.

### Task 5: 혼합 미리보기 렌더러와 응답 계약

**Files:** Create `frontend-web/src/pages/Dashboard/DashboardReuse/studioReusePreviewContract.ts`, `studioReusePreviewContract.test.ts`, `StudioReusePreview.tsx`, `StudioReusePreview.test.tsx`, `frontend-web/src/pages/Dashboard/Studio/PublishedBlockView.tsx`; Modify `frontend-web/src/pages/Dashboard/Studio/PublishedDashboard.tsx`; Test 기존 `PublishedBlockView.test.tsx`와 `PublishedDashboardRefresh.test.tsx`.

**Interfaces:** `validateStudioReusePreview(input:unknown):StudioReusePreviewV1`; `StudioReusePreview({preview}:{preview:StudioReusePreviewV1}):React.ReactElement`를 제공한다. PublishedBlockView의 기존 props `{block:PublishedBlock}`와 named export를 유지한다. 별도 파일로 옮긴 순수 renderer는 조회·게시·권한 동작을 추가하지 않는다.

- [x] **1. 실패 테스트 작성:** `rejects_unknown_duplicate_missing_or_mixed_payload_blocks`, `candidate_pivot_and_chart_render_in_saved_order`, `all_breakpoint_layouts_reference_exact_block_set`, `renders_long_labels_and_no_source_lookup`를 작성한다. chart 또는 Pivot 누락을 성공으로 처리하지 않고 static 렌더 중 API 호출0을 단언한다.
- [x] **2. Red 확인:** frontend-web에서 `./node_modules/.bin/vitest run src/pages/Dashboard/DashboardReuse/studioReusePreviewContract.test.ts src/pages/Dashboard/DashboardReuse/StudioReusePreview.test.tsx`.
- [x] **3. 구현:** 기존 static 블록 renderer를 추출/재export하고 typed adapter로 차트/Pivot 표시 데이터만 전달한다. 원래 xs/md/lg 배치와 표 내부 스크롤을 유지하고 일반 SnapshotView의 차트 전용 입력 타입은 바꾸지 않는다.
- [x] **4. Green 확인:** 위2파일 + 기존 PublishedBlockView/PublishedDashboardRefresh 테스트, FE `./node_modules/.bin/tsc --noEmit`. 실제 브라우저 레이아웃 PASS는 Task7에서만 판정한다.
- [x] **5. 커밋:** `feat(ui): render typed mixed Studio reuse previews`.

### Task 6: 기존 소스 교체 화면과 Studio 진입점 연결

**Files:** Modify `frontend-web/src/pages/Dashboard/DashboardReuse/index.tsx`, `DashboardReuse.test.tsx`, `frontend-web/src/pages/Dashboard/Studio/StudioEditor.tsx`, `StudioPivotEditor.test.tsx`.

**Interfaces:** 기존 GET draft 블록에 `kind`, `columns`, `measures`/`conditions` 읽기 요약과 `unsupportedReason?:string`을 소비한다. 기존 POST preview의 `snapshot` 또는 Task5 `studioPreview` 중 정확히 한 결과를 검사한다. 저장 성공 `{id,replayed?}`와 `/dashboard/:id/studio` 이동 계약은 유지한다.

- [x] **1. 실패 테스트 작성:** `opens_saved_baseline_reuse_even_when_unsaved_draft_has_pivot`, `unsupported_blocks_require_explicit_exclusion`, `last_ordinary_chart_cannot_be_excluded`, `source_mapping_selection_changes_invalidate_old_ticket`, `stale_preview_never_replaces_latest`, `uncertain_save_preserves_request_id_and_inputs`, `expired_ticket_without_receipt_prompts_repreview`를 작성한다. 미지원 블록 자동 제외0, 새 지표 생성 수 안내, 미저장 원본 초안 불변을 단언한다.
- [x] **2. Red 확인:** frontend-web에서 `./node_modules/.bin/vitest run src/pages/Dashboard/DashboardReuse/DashboardReuse.test.tsx src/pages/Dashboard/Studio/StudioPivotEditor.test.tsx`.
- [x] **3. 구현:** Pivot 혼합 저장본에도 기존 복제·소스 교체 링크를 연다. 블록 종류/사용 열·지표·조건/미지원 이유를 접어서 표시한다. sequence/abort·저장 결과 불명확 입력 잠금과 동일 requestId 복구를 유지한다. 오류·로딩 때 현재 열 연결과 포커스를 보존하고, 새 지표 생성·기존 대상 보기 갱신 가능성을 명시한다. 새 혼합 미리보기는 Task5로 표시한다.
- [x] **4. Green 확인:** 위2파일, Task5 응답 계약 테스트, FE 타입/변경 파일 lint를 실행한다. native select와 날짜 입력의 실제 키보드 판정은 DOM 값 강제 변경으로 대체하지 않는다.
- [x] **5. 커밋:** `feat(ui): connect Studio Pivot source replacement flow`.

### Task 7: MD 선택 흐름·실제 화면과 최종 영향 검증

**Files:** Create `docs/testing/studio-pivot-source-reuse.md`; Modify `docs/plans/studio-pivot.md`, `docs/testing/studio-pivot.md`에는 새 증빙 링크/지원 경계만 추가한다. 공개 CSV는 기존 샘플을 읽어 격리 실행 폴더에서 이름 변경/36행 파일로 만들며 제품 샘플 목록은 늘리지 않는다.

**Interfaces:** 설계의 SPR-01~07를 그대로 사용한다. 증빙 root는 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-source-reuse-20261019/`이며 기존 폴더가 있으면 덮어쓰지 않고 새 고유 suffix를 붙인다. browser 작업은 ego-browser 스킬/현재 가이드를 읽고 이번 작업의 TaskSpace 한 개에서 진행한다.

- [x] **1. MD 사전 기록:**7개 조건을 NOT_RUN으로 작성하고 원본18/대상18·36행, 매핑, 독립 Decimal 정답, 생성할 자원/정리 범위와 기존 증빙 재사용 범위를 적는다. 토큰/비밀번호/고객 자료를 기록하지 않는다.
- [x] **2. 영향 검사:** Node24 PATH에서 BE `./node_modules/.bin/tsc --noEmit`와 `./node_modules/.bin/tsc --noEmit -p tsconfig.build.json`, FE `./node_modules/.bin/tsc --noEmit`, 두 프로젝트 변경 TS/TSX 파일만 non-fixing eslint, 루트 `npm run build`를 실행한다. 집계 핵심/복제 공통 경로를 바꾸므로 기존 segment·owner/shared reuse·Studio Pivot 통합을 최종 diff 기준 한 번 선택 실행한다. 단계별 결과를 겹쳐 합산하지 않는다.
- [x] **3. SPR-01~05 실제 검증:** 로컬 테스트 계정의 소유 공개 샘플만 사용해 미리보기→저장→reload·영수증·실패 복구/원본 보존을 확인한다. 독립 정답은18행5431.25/292.79,36행10862.50/585.58/동일 마진5.390840046029919%다. API와 metadata 내용 대조를 실제 UI 관찰과 구별한다.
- [x] **4. SPR-06 실제 검증:**390/768/1440 정상·긴 이름·매핑 누락 오류·저장 결과에서 screenshot, 버튼/입력 크기·정렬·가로 넘침과 포커스를 실측한다. Tab/Shift+Tab/Enter/Space/Escape·표 조작을 실제 브라우저에서 확인한다. native 입력 도구 한계는 해당 조건만 BLOCKED로 남긴다. 캡처를 직접 열어 디자인을 확인한다.
- [x] **5. SPR-07 실제 검증:** 새 복사본의 기존 게시 미리보기에서 숫자·순서·표 whitelist를 확인한다. 실링크 생성·중지는 해당 로컬 테스트 링크에 사용자 승인이 적용되는 범위만 수행한다. 그 외에는 미리보기 관찰 범위와 NOT_RUN을 구별한다. 원본 게시를 변경하지 않는다.
- [x] **6. 증빙 확정:** manifest에 commit/diff·실제 URL/환경·행 변형·정답·요청/DB 결과·PASS/FAIL/BLOCKED/NOT_RUN·남은 조건을 기록한다. 실패는 수정 전/후를 구별하고 해당 조건만 재검증한다. Rill 신규 변형을 실행하지 않으면 과거 동일 입력 증빙만 재사용했다고 명시한다. 실제 휴대폰·VoiceOver·운영/전체 수용을 PASS로 올리지 않는다.
- [x] **7. 커밋과 보고:** 증빙 MD/링크만 `docs(testing): record Studio Pivot source reuse verification`으로 커밋한다. Git 작업은 drumcap 지침을 유지하되 이 계획 승인만으로 새 push/merge 요청을 추정하지 않는다. 완료 보고에 실제 대표 캡처, 정확성/디자인 결과, 미실행 조건과 커밋을 포함한다.

## 자체 점검 및 실행 제안

설계1~4절은 Task2/3/6,5절은 Task1/3,6절은 Task2/4,7절은 Task5/6,8~9절은 Task7에 대응한다. Review Focus5개는 각 Task의 명시 테스트에 연결했다. 새 함수·파일·payload 이름은 위 공통 인터페이스와 일치해야 하며 타입을 바꿀 경우 소비 Task도 함께 갱신한다.

Task1→2→3→4 순서는 계산과 저장 계약에 의존하고 Task5→6은 최종 API에 의존한다. 리소스와 문맥 전달 부담을 줄이기 위해 **Native: 같은 세션에서 순차 구현하고 마지막에 독립 reviewer 한 번**을 추천한다. reviewer를 실제 도구로 실행하지 못하면 검토 완료라고 기록하지 않는다. 다른 실행 방식을 선택하면 지정된 역할/모델 규칙을 따르며 허구의 role routing을 만들지 않는다.

위 체크는 승인 후 실행한 범위를 반영한다. Task4의 실제 MySQL gate는 Docker daemon 미기동으로 미완료다. Task7은 아래 선택 증빙의 범위만 완료이며 native 전체 키보드·익명 공개 링크·운영/실기기/VoiceOver 수용을 뜻하지 않는다.


## 2026-10-19 실행 종료 기록

사용자 “확인했어 구현시작” 승인으로 Native 순차 구현·독립 읽기 검토1회를 실행했다. [SPR 증빙](../../testing/studio-pivot-source-reuse.md)이 실제 범위/수치/오류/차단의 기준이다. 구현은1b6554f0까지 로컬 커밋했다. Task4 SQLite/재시작 영수증은 통과했지만 MySQL 두 연결 gate는 NOT_RUN이다. Task7 게시는 새 검증 사본의 비공개 게시/소유200·익명403까지만 수행했다. 공개 링크를 생성하지 않았다. source mapping과 버튼36px/모바일16px·페이지 넘침0을 확인했으며 native 화살표 선택/실휴대폰/VoiceOver는 승격하지 않는다.

계획 중 계약 모듈 basename 충돌은 studioReusePreviewContract.ts로 구별했고, 실제 schemaVersion을 원본 캡처에 전달한다. 이 차이는 실행 ledger에 기록했다. 원본/기존 지표·게시·개인 보기 행은 보존했다. push/merge는 이번 실행에 포함하지 않는다.


## 격리 MySQL 후속 — 2026-10-19

[실제 MySQL 증빙](../../testing/studio-pivot-source-reuse-mysql.md)에서 기존 Colima 소켓을 명시해 MySQL8.4.11의 최초6개와 독립 두 연결 동일 요청1개를 확인했다. 위 최초 Docker/NOT_RUN 기록은 역사 상태이며 현재 해당7개는 PASS_SELECTED다. 빈 DB/UUID/소유자 확인과 test backend 제목을 보완했다. 실제 MetricDeletionService와의 직접 경합·모든 writer/운영·ticket 분산은 후속이므로 Task4의 광범위 gate를 전체 완료로 바꾸지 않는다. 기존 제품 UI·SQLite 통과 조건은 반복하지 않았다.


## 실제 지표 삭제 경합 후속 — 2026-10-19

[후속 MD](../../testing/studio-pivot-metric-delete-race.md)의 SPR-DELETE-01/02에서 실제 MetricDeletionService와 혼합 복제의 삭제 우선/복제 우선·User 잠금 대기·commit 후 재검사/원자성을 확인했다. 선택2개/BE type·변경 파일 lint PASS이며 테스트 타이머 정리 외 제품 변경은 없다. 복제 우선의 삭제 요청 기준은 테스트 내부 미commit 행으로 구성하므로 공개 impact/UI 수용과 구별한다. 다음은 다른 requestId 동시 복제이며 기존 동일 요청 재시도는 반복하지 않는다. 모든 writer/운영·전체 Task4 수용은 Open이다.


## 서로 다른 복제 요청 후속 — 2026-10-19

[SPR-REQUEST-01](../../testing/studio-pivot-distinct-requests.md)은 독립 두 연결의 같은 캡처 계획·다른 requestId에서 실제 User 대기 트랜잭션2개→저장1/409한건·부분 자산0→명시 재미리보기/실패 requestId의 별도 저장을 확인했다. 선택1개/BE type·해당 lint PASS, 기존9개 반복0이다. 운영 ticket 분산·UI 클릭 수용은 아니며 추가 합성 경합보다 남은 실제 사용자 여정/업무 파일럿을 우선한다. 제품 diff가 없어 build/FE/core 증빙은 재사용했다.
