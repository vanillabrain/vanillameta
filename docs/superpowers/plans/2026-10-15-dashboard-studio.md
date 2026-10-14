# Dashboard Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프롬프트 생성 → 직접/AI 블록 편집 → 저장 → 게시 → 다른 데이터로 재사용하는 하나의 제작 흐름을 완성한다.

**Architecture:** 기존 React/MUI/ECharts/react-grid-layout, Nest/AI compiler/DuckDB worker를 유지한다. Studio 문서의 변경은 하나의 작업 계약으로 모으고 기존 draft/Widget/layout은 adapter로 연결한다. 게시 결과와 초안을 분리하며 UI 프레임워크 교체는 이 계획에 포함하지 않는다.

**Tech Stack:** 저장소의 Node 24/npm/React/MUI 7.x, 기존 react-grid-layout 1.x와 AI SDK/Codex gpt-6-luna.

**Spec:** [제품 목표](../../strategy/prompt-to-dashboard.md), [UC-005](../../use_cases/UC-005-prompt-to-dashboard.md), [TC-005](../../test_cases/TC-005-dashboard-lifecycle.md), [방향 검토](../../design/prompt-canvas-direction-review-20261015.md).

## Global Constraints

- 기존 실행 환경·데이터·로그인을 유지하고 Codex gpt-6-luna를 사용한다. 자동 모델 대체와 새 의존성은 추가하지 않는다.
- 390/768/1440px 편집·조회에서 가로 넘침0px, 선택·미저장 정의·undo 상태 보존, 비대상 블록 ID/배치 동일을 TC-005로 확인한다.
- 재시도 시 중복 저장·게시·복제0개, revision 충돌 시 비의도 변경0개, 게시 실패 시 성공한 초안 저장 보존을 TC-005로 확인한다.
- 현재 브랜치는 codex/self-service-next-20261014. 구현·검증 단위별 커밋을 만들되 원격 push/develop-v2 병합은 해당 요청에 따른다. GitHub 계정은 drumcap.
- 전체 테스트를 파일 저장마다 실행하지 않는다. 기존 통과 범위는 관련 로직 변경이 없으면 재사용한다. 실제 캡처/디자인과 기능 PASS를 분리한다. VoiceOver BLOCKED 유지.

## Review Focus

- AI 요청 중 수동 편집: 이전 revision의 응답이 최근 배치·내용을 덮어쓰지 않아야 한다 → T5/T7.
- 긴 한글 이름·빈 값·큰 수치: 선택/오류 상태에서 이웃 요소·패널을 밀어내지 않아야 한다 → T1/T3.
- 신규 블록 저장 후 undo/redo: 임시 ID를 remap하고 참조·선택이 유지돼야 한다 → T2/T4.
- 저장 성공·게시 실패 후 재시도: 저장된 초안을 보존하고 게시/대시보드가 중복 생성되지 않아야 한다 → T7/T8.
- 복제 시 원본 열 누락/타인 소스: 잘못된 계산·원본 권한 전파 없이 문제 블록을 표시해야 한다 → T9.

---

## 범위·진행 원칙

T1은 합성 fixture의 선택 디자인/상호작용 범위로 구현·검증했다. [실행 기록](../../testing/dashboard-studio.md)을 참조한다. T2는 순수 계약/변경 이력·adapter 범위로 구현·검증했다. T3~T10은 PLANNED / NOT_RUN이다. 화면 배치·API는 구현 전에 관련 코드와 좁은 계약 검사를 확인한다. 다수 기능을 한 번에 작성하고 마지막에 검증하지 않는다. 아래 T 하나가 구현·검증·변경 기록·리뷰·커밋의 단위다. 선행 조건이 통과하면 다음 작업으로 진행하며 형식적인 승인 질문을 반복하지 않는다. 사용자 취소/실제 권한·파괴적 경계가 있으면 해당 조건을 따른다.

기존 numeric/chart와 단일 소스 분석을 첫 구현에 사용한다. 기존 생성기의 1~6 위젯 한도는 첫 시연에 적용하며 UI에 숨기지 않는다. 모든 블록 종류·다중 소스·대규모 보드 지원을 첫 시연 완료로 주장하지 않는다. 이 한도가 실제 수용 흐름을 막을 때 해당 compiler 계약과 함께 확장한다. 임의 코드 실행·새 chart engine·실시간 공동 편집·커넥터 확대는 제외한다. 텍스트/표/필터 블록은 T6에서 기존 렌더러 지원 범위를 확인하고 미지원 종류는 별도 승인된 구현 단위로 남긴다.

## 단계·의존성과 데모

| 단계 | 작업 | 보여줄 결과 | 선행 조건 / 게이트 |
| --- | --- | --- | --- |
| 1. 시안과 편집 기반 | T1–T4 | 기존 대시보드를 Studio에서 열어 이동/복제/undo/저장/재조회 | G1: 3폭 배치·ID·수치 보존 |
| 2. 데이터·AI 통합 | T5–T7 | 파일/샘플 → 생성 → 직접 이동 → 선택 AI 수정 → 같은 문서 저장 | G2: 실제 지정 LLM, 모드 선택 없는 실행, 중복0 |
| 3. 게시 | T8 | 명시 범위 게시 → 다른 계정 조회 → 초안 수정 → 재게시/중지 | G3: 초안 격리·데이터 시점·중지 서버 차단 |
| 4. 재사용·통합 | T9–T10 | 수신자가 새 데이터로 복제하고 독립 결과로 저장 | G4: 매핑·원본 불변·TC-005 전체 여정 |

Rill은 계산·필터·데이터 모델 참고, Claude Artifacts는 대화와 결과물·재사용 경험 참고, Metabase는 grid 편집 참고다. 같은 기능의 모든 제품을 매 단계 재실행하지 않는다. 채택한 패턴과 변경 UI만 실제 비교한다. 공식 링크와 채택/제외 범위는 방향 검토 문서를 따른다.

## 공통 계약: T2에서 고정할 인터페이스

이름은 아래로 통일하고 기존 API 응답을 그대로 Studio 타입이라고 부르지 않는다.

- `StudioDocumentV1`: `schemaVersion:1`, `dashboardId?:number`, `revision?:string`, `title`, `sourceId:number`, `blocks:StudioBlock[]`, `layouts:Record<Breakpoint,StudioLayoutItem[]>`.
- `Breakpoint = 'lg'|'md'|'xs'`; Studio 문서의 열 수는 12/8/1, 가용 캔버스 폭 기준 경계는 1000/600/0px. 현재 다른 화면의 breakpoint를 전역 변경하지 않는다. 프리뷰 선택과 실제 컨테이너 폭을 구분한다.
- `StudioBlock`: 안정적 `id`, 지원 `kind`, `measureRefs`, `dimensionRefs`, 기존 compiler가 검증하는 내용과 표시 옵션. Metric ID/definitionVersion, Dimension key/source schemaVersion을 참조한다.
- `StudioLayoutItem`: `id,x,y,w,h`; 양의 정수 크기, 음수 좌표/경계 초과/중복 ID/겹침 금지. 읽기와 편집이 같은 변환·검증 함수를 사용한다.
- `StudioOperation`: `addBlock|removeBlock|duplicateBlock|updateBlock|moveBlock|resizeBlock|renameDashboard`; 위치 변경에는 breakpoint를 포함. `updateBlock`은 layout을 수정하지 않는다. 신규 블록은 `new:<uuid>` 임시 ID, 서버 저장 시 발급 ID map을 반환한다. 기존 ID로 위장한 신규 블록을 받지 않는다.
- `applyStudioOperation(doc, operation): StudioDocumentV1`: 순수 함수. AI와 직접 UI가 같은 연산 경로를 사용. drag는 drop 시 한 번 history에 기록하고 pointermove마다 네트워크/undo를 만들지 않는다.
- `StudioState`: `present,past,future,selectedBlockId,activeBreakpoint,panel,saveState,savedBaseline,serverRevision,pendingSave`; history는 문서 내용만 보관하고 서버 revision은 별도. 최대100단계, 새 변경은 redo를 비운다. 삭제하면 선택 해제. 서버 ID map을 present/past/future/선택/baseline/제출 snapshot에 적용한다. `saveStarted`는 requestId·문서·baseRevision을 보관하고 `saved`는 정확한 요청/완전한 제출 ID map을 요구한다. 늦은 응답은 이후 편집을 clean으로 처리하지 않는다.
- 저장은 명시 실행을 첫 기본값으로 한다. 변경 없는 문서는 dirty가 아니며 새로고침/이탈 시 미저장 경고를 제공한다. 새로고침 이후 미저장 초안 복구는 첫 단계 범위가 아니다. 초안이 서버에 저장됐다고 오인시키지 않는다.
- 신규 API 경로는 `/v1/studio` 아래에 격리한다. 기존 `/ai`, `/bi`, `/dashboard`, 공유 경로 계약을 임의 교체하지 않는다. legacy adapter는 읽기 시 DB에 쓰지 않는다.

## 파일 구조와 소유 책임

| 위치 (신규 경로는 제안) | 책임 |
| --- | --- |
| frontend-web/src/pages/Dashboard/Studio/{index,StudioShell,StudioCanvas,StudioInspector,StudioConversation}.tsx | 경로 조립 / 상단·패널 / grid / 선택 설정 / AI 상태와 입력 |
| frontend-web/src/pages/Dashboard/Studio/{studioTypes,studioReducer,studioAdapter,studioApi}.ts | 계약 / history·연산 / 기존 응답 변환 / 서버 경계 |
| frontend-web/src/components/analysis/AnalysisUi.tsx | 기존 토큰 재사용·정리. 신규 전역 디자인 시스템 추가 없음 |
| frontend-web/src/router/index.tsx | `/dashboard/:dashboardId/studio`, 이후 `/studio/new`, `/p/:publicationToken` 추가 |
| backend-api/src/dashboard-studio/{studio.module,studio.controller,studio.service,studio-document,studio-operations}.ts | 인증/소유권, 문서/연산 검증, 기존 저장 adapter·revision |
| backend-api/src/dashboard-studio/{studio-run.service,studio-publication.service,studio-remix.service}.ts | 대화 실행 / 게시 / 소스 매핑. 각 단계에서만 추가 |
| backend-api/src/dashboard-studio/entities/{studio-state,studio-run,studio-publication}.entity.ts | 버전 문서 / idempotency·단계 결과 / 게시 정의·집계 snapshot |
| backend-api/src/ai/{ai-dashboard.service,dashboard-blocks}.ts, src/bi/bi.service.ts | 기존 compiler·저장 의미 재사용에 필요한 좁은 adapter. 전면 재작성 없음 |
| docs/testing/dashboard-studio.md | 아래 STUDIO 케이스의 명세·선택 실행 기록 |

StudioState는 dashboard별 한 행의 JSON 정의와 revision을 저장한다. 6개 도메인 테이블을 한꺼번에 만들지 않는다. migration은 해당 행을 사용하는 T4에서 추가하며 기존 dashboard/widget/metric 저장은 같은 메타데이터 DB transaction으로 연결한다. 기존 서비스를 재진입하며 별도 transaction을 여는 방식은 피한다. 필요 helper에만 EntityManager를 전달한다.

### T1: 4개 상태의 Studio 기준 시안 (P1 / FR-009·010)

**Files:** 신규 `Studio/StudioShell.tsx`, `Studio/studio-design.md`, 기존 `AnalysisUi.tsx`, 신규 MD `docs/testing/dashboard-studio.md`. 개발 모드 전용 `/_design/studio`에서 합성 fixture만 사용. 기존 데이터/API·인증 경로를 사용하지 않고 production에서 경로와 시안 import를 제거한다. 저장/게시 버튼은 동작하는 것처럼 보이지 않게 시안 상태를 표시.

**Interfaces:** `StudioShell({document,selectedBlockId,panel,onSelect,onPanelChange})`. 고정 fixture는 실데이터 결과를 대체하는 통과 증거가 아니다.

- [x] 첫 입력 / 생성 결과 / 블록 선택·설정 / 게시 미리보기의 4개 상태와 1440·768·390px 검토표 작성.
- [x] 기존 MUI로 동일 shell 구현. 상단 주요 액션은1개, 중앙 캔버스, 우측 AI/설정 공용 패널. 좁은 화면은 overlay 패널이고 닫으면 선택 블록으로 초점 복귀.
- [x] STUDIO-D01/D02: 긴 한글 이름·다중 필터·큰 값·오류/disabled/keyboard focus 상태 실제 캡처. 페이지 가로 넘침0, 수치 영역 가림0, 기존 분석 UI Kit의 버튼28/input32px 기본을 참조하되 Studio 툴바는 입력과 정렬하기 위해 버튼32px의 국소 시안 예외를 기록한다. 기존 화면 토큰은 변경하지 않음. 모바일 조작 hit area44px 이상은 별도 디자인 수용안으로 기록하며 기존 compact 검증을 소급 변경하지 않음.
- [x] 캡처를 눈으로 비교하고 변경 파일 lint/type 확인. 버튼 동작이나 수치 정확성 PASS로 확대하지 않음. 기본안·불채택안/이유를 studio-design.md에 기록.
- [x] 디자인 기준과 시안만 커밋. G0: 4상태·3폭 검토가 끝나야 동작 구현으로 진행.

### T2: 문서 adapter·연산·history (P1 / BR-003)

**Files:** 신규 `studioTypes.ts`, `studioReducer.ts`, `studioAdapter.ts`, `studioReducer.test.ts`, BE `studio-document.ts`, `studio-operations.ts`와 대응 spec.

**Interfaces:** 공통 계약의 `applyStudioOperation`; `fromLegacyAnalysis({dashboardId,analysis,semanticSnapshot?}):StudioImportResult`, `toLegacySave(doc,definitions,expectedRevision?):StudioSaveProjection`, `remapStudioIds(state,idMap):StudioState`.

- [x] 회귀 테스트 선행: b1 이동은 b2 내용/좌표 불변, duplicate는 새 ID·내용 동일, delete/undo 복구, rename 이후 redo 없음, 101회 변경 시 history100, 임시 ID remap 뒤 undo/redo가 같은 블록을 참조.
- [x] `npx vitest run src/pages/Dashboard/Studio/studioReducer.test.ts`와 BE 해당 spec 실패 확인 후 최소 구현. sql/credential을 history·UI 문서의 공개 값에 넣지 않음.
- [x] legacy 분석은 기존 blockId 우선 사용, 없는 경우 기존 결정적 adapter 사용. 기존 데이터는 조회만으로 저장/재배치하지 않음. 미지원 혼합 소스/블록은 기존 화면으로 연결하고 변환 불가 이유 표시.
- [x] invalid bounds/duplicate ID/누락 metric/unknown kind의 서버 검증과 adapter roundtrip PASS. migration 없음.
- [x] 연산 계약·테스트를 커밋. 기존 `storedBlockIds` 정책을 우회해 임의 persisted ID를 허용하지 않음.

### T3: 실제 블록 편집과 반응형 (P1 / FR-009·010)

**Files:** `StudioCanvas.tsx`, `StudioInspector.tsx`, `Studio/index.tsx`, `studioReducer.ts`, 대응 FE tests, router. 기존 `readLayouts.ts`는 legacy 경로를 유지.

**Interfaces:** `StudioCanvas({document,breakpoint,selectedBlockId,onOperation,onSelect})`. grid item key는 blockId, canvas width는 container 측정. legacy lg를 최초 변환할 때만 md/xs를 도출하고 그 후 명시 편집 배치를 보존.

- [ ] 추가/복제/삭제, 핸들 drag·resize, 키보드 이동/순서·크기 preset을 같은 연산으로 연결. 선택·panel tab 전환은 history 변경 아님.
- [ ] 드래그1회=undo1회, typing중 방향키는 입력 편집 유지, Escape로 선택/패널 문맥 종료, 빈 캔버스 안내를 테스트.
- [ ] `npx vitest run src/pages/Dashboard/Studio`와 FE 타입/변경 lint 실행. 숫자 renderer/MetricTrend를 재사용.
- [ ] STUDIO-E01: b1 위치/크기 변경→복제→삭제→undo/redo. 390→768→1440→390에서 선택/내용/history/각 배치 보존, overflow0 실제 확인·캡처.
- [ ] 편집 단위 커밋. DB 저장은 아직 NOT_RUN으로 표시.

### T4: 저장·재조회·기존 경로 호환 (P1 / FR-003·NFR-004)

**Files:** 신규 studio module/controller/service와 StudioState/StudioRun entity 및 migration; 기존 app.module, ai 저장 adapter/bi 필요한 helper, studioApi.ts; 대응 BE transaction·권한 spec 및 FE save test.

**Interfaces:** `GET /studio/dashboards/:id -> StudioDocumentV1`; `POST /studio/dashboards/:id/save {requestId,expectedRevision,document} -> {document,idMap}`. 생성은 T6의 `POST /studio/dashboards`에서 같은 save helper 사용.

- [ ] 소유권은 문서·source·metric 모두 서버 확인. 오래된 revision은409/쓰기0, 데이터 검증 실패는 rollback. requestId 같은 body는 같은 결과, 다른 body는409. run record는(actor,requestId) unique와 payload hash로 저장.
- [ ] legacy 분석/Widget/layout과 StudioState JSON을 같은 transaction으로 저장. 기존 필터·저장 지표 링크/definitionVersion·blockId 유지. legacy 경로에서 문서 변경이 발생하면 digest/revision 검증으로 오래된 Studio 문서를409 처리하고 재조회 adapter로 복원.
- [ ] BE 관련 spec 후 build, FE 저장/409/error 재시도 test. migration up/down은 임시 DB에서 기존 행 불변 확인. StudioRun은 T4에서 저장 idempotency journal로 먼저 만들고 T7에서 단계 실행에 확장한다. run record의 장기 정리는 후속 운영 작업이며 MVP에서 시간 만료를 중복 실행 근거로 쓰지 않음.
- [ ] STUDIO-E02: 저장→reload→기존 보기 대조, 요청 replay의 중복0·2탭 충돌 확인. 충돌은 미저장 로컬 변경을 보존하고 최신 상태 비교/재적용 경로 제공, 자동 last-write-wins 금지.
- [ ] 커밋. **G1:** 숫자·배치·ID 저장 복원이 통과. 이때 첫 실제 제품 데모가 가능해야 함.

### T5: 선택 블록 AI 수정 연결 (P2/P3 / BR-001·003)

**Files:** StudioConversation.tsx/studioApi.ts, 신규 studio-run.service.ts, 기존 assistantTransport.ts와 ai-dashboard.service.ts의 명시 adapter; 대응 tests.

**Interfaces:** `POST /studio/runs {requestId,conversationId?,dashboardId?,expectedRevision?,prompt,selectedBlockId?,sourceId?,clientEditVersion?,parentRunId?,clarificationAnswers?}` → `{runId,steps[],proposedOperations,baseRevision,clarifications?}`. 단계 상태 queued/running/succeeded/failed/cancelled. clarification 응답은 새 requestId와 parentRunId로 제출하고 원 요청의 payload를 바꾸지 않는다. 기존 AI SDK transport를 재사용하고 문서/연산 실행과 스트림 UI를 구분.

- [ ] 단일 입력에서 질문/수정 의도를 내부로 분류. UI의 ask/edit 모드 선행 선택 제거. 선택 블록 ID·현재 필터/기간·source revision 전달. 현재 지원되지 않는 생성/게시 의도는 미지원으로 표시하고 실행 성공으로 답하지 않음.
- [ ] LLM은 임의 React 코드를 쓰는 대신 검증할 operations를 제안. 수동편집중 응답의 baseRevision/local edit generation이 달라지면 적용 금지. 다른 블록 ID/계산/layout을 서버에서 대조.
- [ ] 취소·timeout·잘못된 operation·409·응답도착전 manual move tests. 관련 assistant/identity 검사만 선택 실행.
- [ ] STUDIO-A01: 직접 이동 후 실 gpt-6-luna로 ‘선택 차트만 주간으로’, 비대상/배치 유지·undo 확인. 실제 LLM 불가 시 BLOCKED, stub을 실제 성공으로 대체하지 않음.
- [ ] 커밋. 명확한 수정 요청은 검증 후 로컬 초안에 적용하고 undo 제공. 저장/게시를 요청하지 않았으면 서버 persisted 결과를 자동 변경하지 않음.

### T6: 내 데이터·샘플에서 같은 Studio 생성 (P2 / FR-008)

**Files:** 신규 StudioSourcePicker.tsx/StudioSemanticReview.tsx, GettingStarted.tsx/FileAnalysis의 진입 링크, studio-run/service, 기존 bi profile/metric compiler/save helper; 대응 tests.

**Interfaces:** run의 `clarifications`는 `{id,question,choices?,affectedBlockIds}`. `semanticProposal`은 existing metric ref 또는 new definition, dimension column/type/version. `POST /studio/dashboards`는 requestId/document로 생성하고 새 dashboardId/revision/idMap 반환.

- [ ] `/studio/new`에서 기존 데이터·파일·매출환불 샘플을 선택하고 프롬프트 한 번으로 source profile→semantic proposal→계산 preview→canvas로 연결. 파일 저장은 기존 DuckDB worker를 재사용.
- [ ] 기존 지표 선택은 canonical ID/version 유지. 신규 지표·dimension 정의와 dashboard 저장은 동일 transaction. dimension은 첫 단계 원본열+타입+버전 참조이며 불필요한 전역 catalog를 만들지 않음.
- [ ] 환불률 분모 모호함은 질의/저장/게시 전 clarification, 업로드 실패·필수열 없음·중복 지표·source revision 변경·동시 저장을 spec으로 고정. 샘플 수치 기대값은 기존 commerce MD oracle을 연결하고 임의 신규 값을 만들지 않음.
- [ ] STUDIO-A02: Rill 공식 sample 생성(634513000 / 5.571238676526892), 별도 commerce fixture의 매출·환불 생성. 두 fixture의 수치·업무 의미를 혼동하지 않음. 신규 블록 종류는 지원 검증된 renderer만 제안.
- [ ] 커밋. **G2 일부:** 생성→직접 이동→선택 수정→저장/reload가 같은 화면에서 실LLM으로 완료.

### T7: 한 요청 실행·부분 실패 복구 (P3 / NFR-004)

**Files:** studio-run.service.ts/기존 StudioRun 단계 기록 확장, StudioConversation.tsx, 대응 BE run tests/FE activity tests.

**Interfaces:** run step은 `inspectSource|proposeSemantics|preview|applyDraft|saveDraft|publish|remix`. `{stepId,status,resultRef?,errorCode?,retryable}` 저장. `POST /studio/runs/:id/retry {stepId}`는 실패한 단계와 의존하는 미실행 단계만 재개. `GET /studio/runs/:id`로 refresh 후 상태 조회.

- [ ] 요청한 의도만 단계 실행. ‘만들어 줘’는 preview/local draft, ‘저장해 줘’는 save, 공유 범위 불명확은 private 상태로 clarification. T8/T9 전에는 publish/remix를 성공으로 응답하지 않음.
- [ ] 동일 request replay·저장 response loss·취소와 commit 경합 tests. commit 전 cancel이면 쓰기0, commit 후 cancel이면 저장 완료를 표시하고 되돌리기 필요성을 명확히 함. 대화 기록은 원본 행/인증 비밀을 저장하지 않음.
- [ ] reload 후 completed step 재실행0·진행 상태 복원, 최근 수동 변경 보존 테스트. 첫 단계는 기존 단일 Node 프로세스에서 실행하고 재시작 시 미완료 run은 interrupted 오류로 표기한다. 이미 commit한 단계는 DB 결과로 복구하고 사용자 재시도 전 자동 외부 작업은 하지 않는다. in-memory queue만으로 정확히 한 번 실행을 주장하지 않음. DB 기록/unique·transaction을 근거로 제한.
- [ ] STUDIO-A03: 저장 성공·다음 단계 실패의 부분 완료 표시와 retry. stage3 이전에는 의도적으로 주입한 실행 adapter로 복구를 검증하고 실제 게시 PASS는 T8까지 NOT_RUN.
- [ ] 커밋. **G2:** 단일 입력의 의도 실행·취소·충돌·중복 제어까지 통과.

### T8: 게시 snapshot·링크·재게시·중지 (P4 / FR-011)

**Files:** studio-publication.service.ts/StudioPublication entity/migration/controller; 신규 StudioPublish.tsx/PublishedDashboard.tsx; router; run dispatch adapter와 BE/FE tests.

**Interfaces:** `POST /studio/dashboards/:id/publications {requestId,expectedRevision,visibility:'private'|'link',allowRemix:boolean,expiresAt?:string}`; `GET /studio/publications/:token`; `POST /studio/publications/:token/revoke`. 재게시도 첫 경로로 새 버전을 생성하고 stable token의 activeVersion을 atomic 갱신. 공개 응답은 sanitize된 definition·집계 결과·기간/필터·dataVersion/기준시점만 반환.

- [ ] 첫 공개 데이터 모드는 snapshot만. 초안 저장과 별도 transaction으로 생성, preview 수치가 아니라 publish 시 재검증한 같은 revision의 집계를 저장. 원본 상세/소스config/SQL·인증정보는 공개 payload에서 제외. private 결과는 owner 인증 조회만 허용하며 token 존재만으로 익명 접근을 허용하지 않음. 만료/중지 링크는410과 데이터 없는 안내를 반환.
- [ ] 같은 token은 명시 재게시 후 최신 version 표시. 이전 version 공개조회 endpoint는 MVP에 제공하지 않음. revoke는 token 전체 차단. 한 번 공개된 캡처·다운로드까지 회수했다고 주장하지 않음.
- [ ] 서버·프런트 캐시는 no-store를 기본으로 하고 만료/중지는 서버 우선. snapshot JSON 기본 상한2MiB(제안한 MVP 설정), 초과는 실패·이전 게시 유지, 조용히 truncate 금지. renderer는 데이터만 처리하고 임의 HTML/JS 실행 없음.
- [ ] STUDIO-P01/P02: 다른 계정 조회, 초안 수정 후 기존 게시 불변, 재게시 version 증가, 실패 retry 중복0, revoke/expiry 응답에 데이터0, payload에 원본 비밀0. 관련 BE 권한/snapshot spec과 실제 UI·캡처.
- [ ] 커밋. **G3:** ‘저장하고 링크로 공유’ 요청의 단계 결과·데이터 시점이 정확히 표시. live/운영배포 완료는 주장하지 않음.

### T9: 내 데이터로 복제·매핑 (P5 / FR-012)

**Files:** studio-remix.service.ts, 신규 StudioRemix.tsx, run dispatch, 대응 tests.

**Interfaces:** `POST /studio/publications/:token/remix-preview {targetSourceId,mapping}` → 검증 preview/unmappedBlocks; `POST /studio/publications/:token/remix {requestId,targetSourceId,mapping}` → 새 private dashboard/document. authenticated owner/source 검증과 allowRemix 정책 필수.

- [ ] 공개 가능한 의미 정의만 복사. 새 dashboard/block IDs, 독립 source·metric/dimension 참조. 원본 share token·publication 설정·인증·실행 이력은 복사하지 않음.
- [ ] 정확한 이름/타입은 자동 매핑하고 후보가 여러 개면 확인. 문자열/숫자 변환 추측 금지. 필수열 누락은 해당 블록 표시·저장/게시 차단. 제외를 명시하면 블록과 그 layout 참조를 함께 제거.
- [ ] 타인 targetSource 거절·remix 금지·revoke와 commit경합·동일 requestId 재시도 tests. 원본 source 비공개여도 공개 템플릿+수신자 소유 source만으로 재사용 가능해야 함.
- [ ] STUDIO-R01/R02: 열 이름만 바꾼 동일 값 source에서 원본 정답 일치, 필수열 누락 차단, 원본/복제본 수정 독립성·기존 원본 ID/revision/version 불변 확인·캡처.
- [ ] 커밋. 새 복제본은 기본 private. 원본이 공개였다는 이유로 공개하지 않음.

### T10: 전체 흐름과 디자인 회귀 수용 (G4 / TC-005)

**Files:** docs/testing/dashboard-studio.md, docs/testing/status.md, 관련 UC/TC/implementation delta. 새 범용 E2E 프레임워크/스크립트 대량 생성 없음.

- [ ] 각 T의 통과 결과를 commit/diff·fixture·환경별로 재사용할 수 있는지 확인. 변경 영향이 없으면 개별 케이스를 반복하지 않음.
- [ ] TC-005 전체 흐름을 실제 gpt-6-luna·UI/API로 1회 연결 실행. Rill 고정 정답과 commerce oracle은 별도 확인. 전체 흐름의 미실행 단계가 있으면 전체 PASS 금지.
- [ ] STUDIO-D01/D02의 최종 영향 상태와 3폭·키보드·필터 추가 전후 레이아웃 캡처. VoiceOver는 BLOCKED 유지하고 DOM 접근성 결과로 대체 PASS하지 않음.
- [ ] 통합 시 루트 npm test / npm run build, FE tsc --noEmit / 변경 파일 lint / 영향 핵심 E2E만 실행. 매 T마다 전체 반복하지 않음.
- [ ] 결과·증빙·미지원 범위를 기록하고 리뷰 후 커밋. push/merge는 요청 범위를 확인하고 수행. 모든 체크박스가 문서에 존재한다는 이유로 완료 처리하지 않음.

## 검증 기록 단위

`caseId, phase, commit+diff, source/schema/dataVersion, metric versions, originalPrompt, viewport/containerWidth, expected/actual, functionalStatus, designStatus, screenshotPath, remaining`을 기록한다. 인증·토큰·비밀번호는 증빙 제외. 캡처는 저장소 밖 실행별 폴더에 저장하고 채팅에 실제 이미지로 표시한다.

새 MD 케이스: D01 desktop/태블릿 구조, D02 mobile/keyboard, E01 작업/history/폭전환, E02 저장·충돌, A01 선택AI수정, A02 생성·semantics, A03 단계복구, P01 게시버전, P02 권한·중지, R01 새소스매핑, R02 오류·원본불변. 기능 PASS와 디자인 PASS를 별도 기록한다.

## 자기 검토

- FR-007:T5/T7/T8, FR-008:T6, FR-009:T2/T3/T5, FR-010:T1/T3/T4, FR-011:T8, FR-012:T9. UC-005 A1:T6, A2:T4/T5, A3:T7/T8, A4:T9, A5:T8.
- 현재 지원 블록 종류/1~6 한도, single-source, live 미지원, 미저장 새로고침 복구 미지원, VoiceOver BLOCKED를 명시했다. 이 제한이 실제 TC-005를 막으면 해당 단계는 부분 완료로 남긴다.
- T1의 선택 시안·세 폭과 T2 순수 계약 검증이 완료됐고 다음 실행은 T3다. 전체 작업량/기간은 T2 adapter 영향 확인 전 확정하지 않는다. 성능·공수 절감 수치를 근거 없이 약속하지 않는다.

## T2 실행 중 확정한 계약 보완

- Ruling: SQL을 history에서 제외하면서 변환을 보존하기 위해 `StudioImportResult`에 `definitions`를 분리했다. 기존 GET은 canonical 저장 버전을 모두 노출하지 않아 `unresolvedReferences`를 명시한다. 이를 추정해 링크를 덮어쓰지 않는다.
- Ruling: `toLegacySave`는 HTTP body가 아닌 `requiresServerSnapshot:true` projection이다. T4에서 원본 structured snapshot·geometry·지표 링크를 서버가 함께 검증/저장해야 한다. 현재 기존 save 경로로 연결하지 않는다.
- Ruling: 신뢰 가능한 서버 `assertStudioReferences` context는 sourceId/sourceSchemaVersion, definitionKeys, measureVersions, dimensionKeys다. 구조 검증과 소유권 확인을 동일시하지 않는다.
- Ruling: 같은 프로토콜을 FE/BE에 독립 구현하고 고정 JSON 예제로 대조했다. 프로젝트 간 runtime import로 backend build root나 번들 경계를 바꾸지 않았다.
- Ruling: 저장 응답은 제출 snapshot에만 대응한다. save-start/requestId를 이력과 별도로 기록하고 그 이후 편집은 dirty로 유지한다. T4는 이 계약을 실제 요청 수명주기에 연결한다.
