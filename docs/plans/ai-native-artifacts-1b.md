# AI 네이티브 아티팩트 — 1b 구현 계획: 원격 MCP 대시보드 쓰기

상위 설계: `docs/plans/ai-native-artifacts.md`(2절 현재 상태, 4.1·4.3 구조, 9절 결정). 권한 기반: `docs/plans/ai-native-artifacts-1a.md`(구현 완료). 이 문서는 그 위의 1b 단계만 다룬다. 이미 확정된 결정은 다시 묻지 않는다.

상태: **확정(2026-11-06).** architect 검토를 반영했고 결정 A·B·C를 사용자가 정했다(12절). 구현은 아직 시작하지 않았다. 근거 표기는 직접(소스를 열어 확인), 조사(읽기 전용 조사 보고), 검토(architect가 코드를 읽고 제시)다. 미확인은 해당 줄에 적었다. 모든 경로는 `backend-api/src/` 기준이다.

## 1. 목표와 비목표

목표: 팀원이 **서버 AI 없이** 자기 AI(Claude Code, Codex 등)로 원격 MCP를 통해 **자기 소유 대시보드**를 생성·조회·수정·이전 버전 복원·삭제한다(요구 1, 3, 7). 쓰기는 사용자가 승인한 scope와 사용자의 등급 능력의 교집합 안에서만 된다(요구 6).

비목표(1b 밖):

- 보고서 MCP 쓰기, 팀원용 skill: 1c.
- MCP 게시·공유 확장. 게시 scope는 **enum에 넣지 않는다**(5절). 기존 `shares:write`는 보고서 공유로 그대로 둔다.
- 새 지표(`FORMULA`·새 정의) 생성, 기존 대시보드에 새 블록 추가: 사람이 한다(결정 10).
- 남의 대시보드 쓰기: 편집 grant만 받은 것도 MCP로는 못 고친다(결정 14).
- 소프트 삭제·휴지통(결정 12).

## 2. 사실 확인(근거)

| 사실 | 근거 |
| ---- | ---- |
| 원격 MCP 도구는 12개이고 대시보드 도구는 없다. 지침이 "보고서·문서·소스를 생성·저장·수정·삭제할 수 없고 서버 AI를 돌리지 않는다"고 못박고 스펙이 그 문구를 고정한다 | 직접 `mcp-oauth/mcp-server.ts:20-27`, `mcp-server.spec.ts:385-393` |
| Studio 신규 생성 `POST /studio/dashboards`의 본문은 `{requestId, proposalId, expectedSourceRevision}`이고 `proposalId`는 AI가 만든 생성안을 **프로세스 메모리 Map(64개, 10분)** 에서만 찾는다. AI가 없으면 `propose()`가 블록 생성 전에 실패한다 | 조사 `dashboard-studio/studio-creation.service.ts:110-119,366,385-389,581` |
| 블록 검증·컴파일·미리보기는 AI를 호출하지 않는다. `compile()`은 public, `validateBlock()`은 private이다. 미리보기는 `ai/ai-dashboard.service.ts:1403`의 `preview`로 LLM 호출이 없다 | 조사 `studio-creation.service.ts:856,1059,837` |
| 블록 spec 필드는 `title, kind, metric, dimension, presentation`이고 `kind`는 `BOARD_NUMERIC/CHART_COLUMN/CHART_BAR/CHART_LINE`이다. 저장 지표 참조는 `{id, definitionVersion}`이다. `FORMULA`와 새 정의는 `createOnce`가 새 `Metric` 행을 만든다(1586-1628) | 조사 `studio-creation.service.ts:865-885,942-960`, 검토 |
| 기존 `POST /studio/dashboards/:id/save`는 제목·표시·배치·필터 편집과 블록 삭제만 되고, 기존 블록의 정의를 바꾸거나 새 지표 블록을 추가하면 400이다. 현재에 없는 블록을 되살리는 것도 막는다(`!original`) | 조사 `studio.service.ts:1573-1586` |
| 저장은 `requestId`(`^[-a-zA-Z0-9_]{1,128}$`)와 `expectedRevision`(64 hex 해시)을 받고 `studio_run`(actor+requestId, payloadHash)으로 멱등이다. 충돌은 409이고 **메시지만 있고 기계 판독 코드가 없다.** 같은 requestId·다른 입력도 `ConflictException`이다 | 조사 `studio.service.ts:1394-1421,1480-1498`, 검토 `:1485-1486`, `studio-creation.service.ts:1521-1522` |
| **대시보드 저장 이력이 없다.** `studio_state`는 대시보드당 1행을 덮어쓰고 `studio_run.result`에 우연히 문서가 남지만 `dashboardId` 열이 없다. `studio_publication`은 버전별 스냅샷 행을 여럿 가지나 저장 이력이 아니다. `dashboard_publication`은 단일 행이다 | 조사 `studio-state.entity.ts`, `studio-run.entity.ts`, `studio-publication.entity.ts`, `dashboard-publication.entity.ts` |
| **대시보드에는 작성 주체 기록이 없다.** 보고서 댓글만 `authorKind('user'|'ai')`, `aiGrantId`, `aiClientName`을 가진다 | 조사 `reports/report-comment.entity.ts:31-82`, `report-comment-contract.ts:96-101` |
| 소유자는 `user_mapping` 행이 **정확히 1개**일 때만 정의된다(`resource-policy.resource()`). `SourceAccessService.dashboard()`의 'owner' 경로는 행 개수를 보지 않지만 생성 replay에서만 쓰이고, 저장·삭제·인계는 잠금 뒤 policy의 행 1개 검사나 `owned()`를 다시 지난다 | 조사 `enterprise/resource-policy.service.ts:84-90`, 검토 `studio.service.ts:1684-1687`, `dashboard-deletion.service.ts:263` |
| 삭제 영향 확인 `impact()`는 의존성이 있어도 throw하지 않고 `canDelete:false`와 `dependencies`를 돌려주고, `remove()`는 `requestId`(UUID **v4**)·`expectedRevision`(**`deletionRevision`**, Studio revision이 아님)·`expectedActorId`·`expectedOrganizationId` 정확히 4키를 요구하며 의존성이 남으면 409(종류·개수는 오류에 없음) | 조사·검토 `dashboard/dashboard-deletion.service.ts:173-324,209,267` |
| HTTP는 `JwtAuthGuard`가 등급 능력을 검사한다. **MCP가 서비스를 직접 호출하면 이 검사가 빠진다.** 보고서 쓰기는 `beforeAccess`에서 `assertGrant`와 `assertGrade`를 부르는데, 등급 상수·메서드는 `McpReportService` 안에 private으로 있다 | 조사 `auth/capability-policy.ts:72-92`, `mcp-oauth/mcp-report.service.ts:138-201` |
| **scope를 추가하면 바로 구멍이 되는 구조 둘.** (가) 서버 `WRITE_SCOPE_CAPABILITY`가 `Partial<Record>`라 매핑이 없는 scope는 등급 검사를 건너뛴다(지금은 읽기 4개만 없고 enum이 닫혀 있어 잠재 위험). (나) 승인 화면이 `scope.endsWith(':write')`로만 쓰기를 분류해 기본 선택에서 뺀다. `:delete`를 enum에 추가하는 순간 **기본 선택되어 승인된다** | 조사·검토 `mcp-report.service.ts:138-143,173-174`, `frontend-web/src/pages/AiConnections/shared.tsx:9`, `Approve.tsx:34` |
| grant의 유효성은 **설정 fingerprint**만 본다. 도구가 늘어도 재동의가 강제되지 않고, 클라이언트 허용 scope를 바꾸면 fingerprint가 바뀌어 모든 기존 연결이 무효가 된다 | 검토 `mcp-oauth/mcp-oauth.service.ts:506-509` |
| 대시보드 쓰기에는 사용자별 제한이 없다. `UserThrottle`은 일부 라우트의 인메모리 고정 창이고 MCP 경로(서비스 직접 호출)에는 적용되지 않는다. 쓰기 대기열 상한(`serializeWrite` 32)은 사람과 공유된다 | 조사 `common/throttle/user-throttle.guard.ts`, `studio.service.ts:1429` |
| 스펙이 대시보드 도구와 충돌한다: 도구 이름 정규식(`save|publish|apply|delete|…` 금지), `WRITE_TOOLS`의 `reportId` 필수 단언, `destructiveHint:false` 단언(공유 상수 `writeAnnotations`), `Pick` 타입, 지침 문구 고정 | 조사·검토 `mcp-server.spec.ts:326-343,385-393`, `mcp-server.ts:10-17,159` |
| Docker 스택은 `NODE_ENV=dev`라 `synchronize: true`다. 테이블이 자동으로 생겨 **Docker e2e는 마이그레이션을 검증하지 못한다.** 운영용은 `migrations/postgres/`에 파일을 두고 `app.module.ts:162-172`의 명시 배열에 등록해야 한다 | 검토 `app.module.ts:224,162-172` |
| 로컬 stdio는 `vm_save_analysis`가 서버 AI 제안을 로그인 JWT로 저장한다. 남기려던 `vm_propose_analysis`는 서버 AI를 실행한다(`/studio/proposals`). 상위 8절 요구 6은 "로그인 JWT로 MCP 밖 경로를 부르는 시도가 막힌다"를 이미 통과 조건으로 둔다 | 조사 `mcp-server/src/server.js:105,145-162`, `api.js:65`, 검토 상위 8절 |

## 3. 설계 원칙(1b 한정)

1. **하나의 커널.** 사람 UI와 MCP가 같은 검증·저장 코드를 지난다. MCP를 위해 검증을 복제하지 않는다.
2. **상태 없는 미리보기.** 메모리 제안 저장소에 기대지 않는다. 생성은 **spec 전체와 `previewDigest`** 를 함께 받아 서버가 다시 계산해 일치를 확인한다.
3. **닫힌 방향으로 실패한다.** 새 scope·새 도구는 "목록에서 빠뜨리면 열린다"가 아니라 "빠뜨리면 컴파일·테스트가 실패한다"로 만든다.
4. **소유자 한정은 서비스에서 강제한다.** 목록·읽기 도구도 같은 "행 1개 + 본인 + 활성" 필터를 쓴다. MCP는 기존 서비스 진입점만 호출하고 우회 경로를 만들지 않는다.
5. **쓰기는 이력을 남긴다.** 사람·AI 구분 없이 같은 이력에 들어가야 복원이 일관된다. 다만 이력이 덮는 쓰기 지점은 한정된다(5.4).
6. **scope의 의미는 넓히지 않는다.** 이미 승인된 scope가 나중에 더 많은 일을 하게 되면 기존 grant가 조용히 넓어진다(재동의가 없다). 능력이 늘면 **새 scope 이름**으로 낸다.

## 4. 도구와 scope

scope 이름은 12절 결정 A에 따른다. 아래는 종류별 이름(`dashboards:*`) 기준이다.

| scope | 기본 승인 | 도구 | 등급 능력 |
| ----- | --------- | ---- | -------- |
| `dashboards:read` | 선택됨 | `vm_list_dashboards`, `vm_read_dashboard` | `read` |
| `dashboards:write` | 해제 | `vm_preview_dashboard`, `vm_create_dashboard`, `vm_update_dashboard`, `vm_restore_dashboard` | `write`(contributor 이상) |
| `dashboards:delete` | 해제 | `vm_get_dashboard_removal`, `vm_remove_dashboard` | `write`(HTTP 삭제 라우트와 같음) |

- **게시 scope는 enum에 넣지 않는다.** 예약만 하면 1b에서 클라이언트가 요청해 사용자가 승인한 grant가, 나중에 게시 도구가 생길 때 재동의 없이 게시 권한을 얻는다(원칙 6).
- 쓰기 판정을 접미사 규칙이 아니라 **scope별 분류 표**로 바꾼다(5.3). 표에 없는 scope는 컴파일이 막고, 쓰기·삭제는 승인 화면에서 항상 기본 해제다.
- `vm_preview_dashboard`는 계산을 하므로 `dashboards:write`다(읽기 scope로 열지 않는다).
- 읽기 도구는 소유한 대시보드만 보여 준다. 받은 대시보드를 여는 것은 별도 결정이다.
- 도구 이름의 동사는 `create/update/restore/remove`로 하고, 기존 스펙의 이름 금지 정규식은 "scope별 허용 목록 일치"로 바꾼다.
- 읽기 도구는 `safe()`(읽기 오류를 일반 문구로 삼킴)가 아니라 `structured`를 쓴다.

도구 입력:

- `vm_preview_dashboard {sourceId, title, blocks[]}` → `{previewDigest, sourceRevision, blocks:[{key, kind, title, value|series, warnings}], caveats}`. 저장 없음. 블록은 `{title, kind, metric:{id, definitionVersion}, dimension?, presentation?}`이다. **`metric.id`가 없는 블록(FORMULA·새 정의)은 MCP 계층이 커널에 넣기 전에 400 `UNSUPPORTED_CHANGE`로 거부한다**(결정 10). 소스는 호출자가 소유한 것만.
- `vm_create_dashboard {sourceId, title, blocks[], previewDigest, expectedSourceRevision, requestId, confirmWrite}` → `{dashboardId, revision}`. **spec을 다시 받는다.** 서버가 같은 입력으로 다시 계산해 digest 일치를 확인한다. 불일치는 409 `PREVIEW_STALE`.
- `vm_read_dashboard {dashboardId}` → 문서(블록·배치·필터), `revision`, `sourceRevision`, 이력 요약(최근 N개의 `revisionId, createdAt, authorKind, clientName`). 이 요약이 `vm_restore_dashboard`의 `revisionId`를 얻는 유일한 길이다.
- `vm_update_dashboard {dashboardId, requestId, expectedRevision, expectedSourceRevision, changes[], confirmWrite}`. `changes`는 기존 Studio 저장이 허용하는 것만: 제목, 배치, 표시, 필터, 블록 삭제. 블록 정의 변경·추가는 400 `UNSUPPORTED_CHANGE`.
- `vm_restore_dashboard {dashboardId, revisionId, requestId, expectedRevision, confirmWrite}`. 5.5.
- `vm_get_dashboard_removal {dashboardId}` → `impact()`를 그대로 감싼 `{canDelete, dependencies:[{kind,count}], revision}`. `revision`은 `deletionRevision`이다.
- `vm_remove_dashboard {dashboardId, requestId, expectedRevision, confirmWrite}`. `expectedRevision`은 위의 `deletionRevision`이다. `expectedActorId`·`expectedOrganizationId`·`expectedEpoch`는 principal에서 채운다. 의존성이 있으면 409와 함께 **오류에 의존성 목록**을 담는다.

공통:

- `requestId`는 **UUID v4**만 받는다(삭제가 v4만 받는다. 기존 MCP `uuid()`는 모든 버전을 받으므로 v4로 좁힌다). Studio의 정규식은 UUID를 포함하므로 그대로 전달한다.
- `confirmWrite`는 AI가 채우는 보조 신호이며 서버가 scope·소유자·등급·revision으로 강제한다.
- **annotation은 도구별로 다르게 준다.** 삭제 도구, 블록 삭제를 포함할 수 있는 `vm_update_dashboard`, `vm_restore_dashboard`는 `destructiveHint:true`다(호스트가 사용자 확인을 요청하는 신호). 기존의 공유 상수 `writeAnnotations`에 얹지 않는다.

## 5. 서버 구조

### 5.1 서버 AI 없는 생성 커널 — `createOnce`를 둘로 나눈다

새 클래스를 추출하지 않는다. `StudioCreationService`는 `StudioRemixService`(`studio-remix.service.ts:682-984`)와 `StudioExecutionService`가 주입받아 쓰므로 클래스 추출은 DI와 호출처를 흔든다(검토).

- `createOnce`(1514-1699)를 1539행 근처에서 둘로 나눈다. 기존 경로는 "Map에서 `{value, basis, context}`를 꺼냄", 공통 부분은 `persistResolved(resolved, requestId, payloadHash, actor, author)`다. 상태 없는 경로는 같은 `resolved` 모양을 `validateBlock → revalidate → compile → preview`로 만든다.
- `persistResolved` 입력: `sourceId, title`, 검증된 blocks(지표 정의·businessBasis·defaultDateColumn 포함), `basis`, `CatalogActorContext`(`catalogActorContext(manager, actor, authVersion)`), `sourceRevision`, `schemaVersion`, `requestId`, `payloadHash`, `author`.
- 기존 경로에서 넘어오는 숨은 의존: `signal`(MCP는 없음 또는 요청 abort), `validateBlock`의 `denominator`/`refund`(856-940행; 프롬프트에서 나오는 값이라 MCP에는 없다. 저장 지표 참조에서는 이 검사를 어떻게 할지 1b-2에서 정해 스펙으로 고정한다), `trustedSourceContext/validateUnits`, `serializeWrite`와 앞뒤의 `assertCatalogActor`.
- MCP 경로가 `createOnce` 1586-1628의 `Metric` 생성 구간에 닿을 수 없음을 **단언(assert)** 으로 박는다.
- StudioRun의 `payloadHash`는 `{kind:'studio-create-spec', sourceId, title, blocks, previewDigest, expectedSourceRevision}`로 계산한다. 종류 값은 기존 `'studio-create'`와 달라야 한다.
- **`previewDigest`의 구성.** 넣는 것: 정규화한 입력 spec, 카탈로그에서 해석한 지표 정의(`{id, definitionVersion}`과 정의 다이제스트), `sourceRevision`(데이터 버전), `profile.schemaVersion`, **다시 캡처한 businessBasis**(기존 `createOnce`는 Map의 `stored.basis`·`stored.context`를 쓰므로, 상태 없는 경로는 `captureBusinessBasis`로 다시 잡고 미리보기와 생성 사이의 업무 기준 변경을 digest로 잡는다), 블록별 basis 조각과 `defaultDateColumn`. 넣지 않는 것: `blockId: 'new:'+randomUUID()`(977행)와 `proposalId`(511행)처럼 매번 바뀌는 값, 미리보기 결과 값(데이터 변경은 `sourceRevision`이 잡는다). 선례는 `bi/semantic-proposal.ts:360`의 `semanticDigest({proposal, plan})`이다.
- 회귀 방지: 분리 전후 같은 입력의 출력을 비교하는 스펙. 무작위 ID(proposalId, blockId)는 정규화한 뒤 비교한다.

**BI 의미 제안 경로(`/bi/analysis-proposals/*`) 재사용은 채택하지 않는다.** 이유는 (가) proposal 형식(measures/dimensions)이 Studio 블록 spec과 다르고 (나) 저장이 정의에서 새 `Metric` 행을 만들어 결정 10과 충돌한다는 것이다. BI로 만든 대시보드가 Studio로 열리지 않는다는 이유는 **틀렸다**: Studio는 `StudioState`가 없으면 그 자리에서 `importStudio`로 연다(`studio.service.ts:133-136`). 반대로 BI는 상태 없는 digest·receipt·PostgreSQL 경합 재시도(40001/40P01/55P03)를 이미 갖췄고 `createOnce`에는 재시도가 없다. 이 장점은 1b-2에서 공통 저장 구간에 재시도를 넣을지 판단하는 근거로 쓴다.

### 5.2 소유자 한정

`EnterpriseResourcePolicyService`에 public `assertSoleOwner('dashboard', id, actor)`를 둔다: `user_mapping` 행이 정확히 1개이고 본인이며 삭제·비활성이 아님(`resource()`와 같은 조건). MCP 대시보드 조회·쓰기·목록은 모두 이를 **첫 검사**로 지나고, 저장·삭제는 기존 서비스가 잠금 뒤 트랜잭션 안에서 다시 확인하는 경로를 그대로 쓴다(검토). 소유 행이 둘 이상인 비정상 자원은 거부된다. 조직 admin은 grant를 보지 않으므로 막힌다.

### 5.3 등급·grant — 한 곳에서 강제한다

`McpReportService` 안의 private 상수·메서드를 복사하지 않는다.

- `Record<McpScope, {kind:'read'|'write'|'delete', capability}>` 표 하나를 `mcp-oauth`의 공용 위치로 옮기고 `assertGrant`(`mcp-oauth.service.ts:1063-1090`) 안에서 등급까지 검사한다. **읽기 scope도 `read`를 갖는다**(`null`이 아니다). 그래야 `principal.organizationId` 소속 확인이 읽기에도 걸린다.
- 같은 표를 승인 화면이 쓰도록 동의 요청 응답에 scope별 `kind`를 실어 보낸다. 프런트가 접미사로 분류하지 않는다.
- 대시보드 쓰기는 `assertGrant`(grant 행 잠금)와 등급 검사를 **Studio 저장 트랜잭션 안에서** 돌리는 `beforeAccess` 훅을 커널에 넣는다. 그래야 쓰기 도중 연결이 해제되는 경합이 남지 않는다.
- 쓰기마다 grant와 등급을 다시 읽는다. 등급이 낮아지면 다음 호출부터 거부된다.

### 5.4 저장 이력과 작성 주체

새 테이블 `dashboard_revision`. 엔티티 파일은 `*.entity.ts` 규칙에 맞춘다.

| 열 | 뜻 |
| -- | -- |
| `id` (uuid) | `revisionId` |
| `seq` (단조 증가) | 정렬·보존용. uuid·`createdAt`만으로는 "최근 N개"가 안정적이지 않다(SQLite 시각 해상도) |
| `dashboardId`, `revision` | 대상, 그 시점의 해시 |
| `studioDocument` (json) | 저장 직후의 `StudioState` 문서 |
| `title`, `layout`, `analysisDefinition`, `structuredDefinition` | `dashboardRevision`이 해시하는 필드 전부(`dashboard/dashboard-revision.ts`). 복원의 기준선이다 |
| `actorId`, `organizationId` | 저장한 사용자(조직이 없으면 null) |
| `authorKind` | `human` / `external-ai`(`server-ai`는 서버 AI 저장 경로가 연결될 때 추가) |
| `aiGrantId`, `aiClientName` | `external-ai`일 때만(보고서의 `aiProvenance` 검증과 같음) |
| `requestId` | 멱등 키와 연결 |

- 같은 트랜잭션에서 `StudioRun` insert 옆에 한 행을 쓴다(재시도 replay는 쓰기 전에 반환하므로 행이 늘지 않는다. `serializeWrite`·`lockMetricReferences`와 충돌하지 않는다, 검토).
- **이력이 덮는 쓰기 지점.** `StudioState`를 쓰는 곳: `studio.service.ts` 482·1767행, `studio-creation.service.ts` 1446·1659행, `bi/studio-reuse-persist.ts:151`, `bi/dashboard-reuse.service.ts:1152`, `enterprise/handover-transfer.service.ts:427`, `enterprise/bundle-handover.service.ts:476`. 1b는 **Studio 저장·신규 생성·복원**만 기록한다. 이력 없이 revision을 바꾸는 경로(`widget/widget.service.ts:317`, `dataset/dataset.service.ts:224`, 레거시 `/ai/dashboard-save` `ai/ai-dashboard.service.ts:2585`, 수명주기, 인계, 재사용)는 한계로 문서에 적는다. 복원은 현재 `expectedRevision`으로 보호되므로 이 경로가 개입해도 안전하다(이력이 사슬을 이루지 않을 뿐이다).
- **보존 규칙.** 대시보드당 `human` 행과 생성 행은 **항상 보존**하고 `external-ai` 행만 최근 50개로 제한한다(`seq` 기준). AI가 사소한 수정을 50번 해서 사람의 정상 버전을 모두 밀어내는 것을 막는다(결정 13의 안전망 유지). `human` 행의 총량 상한은 두지 않되 대시보드 삭제와 함께 지운다.
- **삭제·인계.** 삭제는 `dashboard/dashboard-deletion.service.ts:274-280` 흐름의 같은 트랜잭션 안, `m.delete(Dashboard)` 앞에서 이력을 지운다(이 저장소에는 `StudioState`에도 FK가 없어 관례를 따른다. `StudioState`·`StudioRun`이 지금도 고아로 남는 것은 별도 기존 문제). 인계(`handover-transfer.service.ts:416`이 댓글을 지우는 선례)도 이력을 지운다. 그래야 새 소유자가 이전 소유자의 `aiClientName`·`grantId`·버전을 이어받지 않는다.
- **데이터 노출.** 이력의 문서에는 계산 정의만 있는 것이 아니다. `filters/conditions/dateRange`에는 데이터 값(리터럴)이 들어갈 수 있다. 그래서 이력 읽기는 소유자만, MCP로는 요약만 준다(문서 본문은 복원 때만 서버가 읽는다).
- 감사: 기존 `EnterpriseAuditEvent`에 `dashboard.mcp-create/update/restore/remove`를 기록한다(`action varchar(40)` 안, 조직이 없으면 기록하지 않는 기존 규칙).
- 이력 기록에는 **기능 플래그**(`DASHBOARD_REVISION_HISTORY`, 기본 켬)를 둬서 문제가 생기면 사람의 저장 경로에서 이력 쓰기만 끌 수 있게 한다.

### 5.5 복원 — 기준선을 이력 행에서 넣는다

별도 `restoreRevision` 연산을 만들지 않는다(검토). `saveOnce`는 현재 대시보드에서 `old/items/indices`를 만들고(1537-1539행) `!original`이면 400을 낸다(1573-1586행). 복원은 이 **기준선을 이력 행에서 넣는** 내부 전용 옵션 `saveOnce(…, {baseline: historyRow})`로 한다.

- 현재에 없는 블록은 임시 ID로 바꾼다. 1600행의 `isTemporaryStudioId → blockId: undefined` 덕분에 `prepareSave`가 위젯을 새로 만든다.
- 이 옵션은 **이력 행의 digest와 일치할 때만** 허용되는 내부 전용이며, MCP `vm_update_dashboard`로 블록을 추가하는 길(결정 10)을 열지 않는다.
- 아래는 409 `RESTORE_STALE`과 이유로 거부한다: `validateCurrentReferences`/`lockMetricReferences` 실패(지표 정의 변경), `businessBasis` 불변 검사 실패(1511-1514행), 소스 교체. **pivot 블록**(`pivots.assertSaved` 필요)이 든 이력은 1b에서 거부한다.
- 복원 결과도 새 이력 행이다. 복원된 블록은 ID가 바뀌므로 **차트 댓글 앵커가 분리(detached)될 수 있다**(도구 설명에 적는다).

### 5.6 속도 제한과 데이터 반출

- 제한은 **사용자(actor)별** 인메모리 고정 창이다(연결을 여러 개 만들면 grant별 제한은 우회된다). 시작값: 쓰기 20회/분, 생성 10개/시간, 삭제 10회/분, **미리보기 10회/분**(DuckDB 계산을 하므로). 초과는 MCP 오류 `LIMIT`이다. 단일 인스턴스 가정을 문서에 적는다(`UserThrottle`과 같음).
- 사람과 MCP가 `serializeWrite` 대기열(상한 32)을 함께 쓴다. 상한 도달은 5xx가 아니라 `LIMIT`로 돌려준다.
- **원본 값 반출.** 식별자 열(email 등)을 차원으로 두고 집계를 걸면 미리보기가 그 열의 원본 값을 사실상 덤프한다. 기존 도구의 "행 없음" 약속보다 범위가 크다. 차원 카디널리티 상한(BI의 `categoryLimit: 500` 같은 값)을 미리보기·생성에 건다. 승인 화면에 "AI가 내 소스의 집계 값을 읽고 대시보드로 만든다" 경고를 넣는다.

### 5.7 오류 코드와 requestId 재사용

- 기존 MCP 오류 코드(`UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, REQUEST_REUSED, INVALID, LIMIT`)를 쓰고, `detail.reason`으로 `REVISION_CHANGED`, `SOURCE_CHANGED`, `PREVIEW_STALE`, `RESTORE_STALE`, `HAS_DEPENDENCIES`, `UNSUPPORTED_CHANGE`를 구분한다. 한국어 메시지 문자열로 분류하지 않는다. 서비스 내부 예외 타입에 사유 열거를 붙여 MCP 계층이 매핑한다.
- **같은 `requestId`를 다른 입력으로 재사용하는 경우.** Studio는 `ConflictException`을 던지고(`studio.service.ts:1485-1486`) MCP `classify`는 409를 `CONFLICT`(retryable)로, 지침은 "CONFLICT면 같은 requestId로 재시도"라고 하므로 AI가 무한 재시도에 빠진다. MCP 계층이 쓰기 전에 `StudioRun(actorId, requestId)`를 미리 읽어 `payloadHash`가 다르면 `REQUEST_REUSED`를 낸다. 삭제는 `DashboardDeleteReceipt`에 같은 처리를 한다.

### 5.8 스키마·마이그레이션

- `migrations/postgres/`에 새 파일(최신 `1793600000000` 다음)을 두고 `app.module.ts:162-172`의 명시 배열에 등록한다. 기존 `*-migration.spec.ts` 형식을 따른다.
- **Docker 스택은 `synchronize: true`라 테이블이 자동으로 생기므로 e2e는 마이그레이션을 검증하지 못한다.** 따라서 1b-3의 통과 조건은 "synchronize를 끈 PostgreSQL에서 마이그레이션 실행"이다.

## 6. 프런트와 문서

- `AiConnections`: `AI_SCOPES`, `SCOPE_LABELS`, `SCOPE_WARNINGS`에 새 scope를 추가하고 쓰기 판정을 서버가 내려주는 `kind`로 바꾼다. 경고 문구: 쓰기는 "내 대시보드를 만들고 고칠 수 있다, 내 소스의 집계 값을 읽는다", 삭제는 "내 대시보드를 지울 수 있다(사용처가 없을 때만)". 승인 화면 테스트의 "쓰기 scope는 기본 해제"를 삭제 scope까지 확장한다. **프런트 enum은 서버보다 먼저 새 scope를 받아야 한다**(`aiConnectionsService.ts:60`의 zod 파싱이 알 수 없는 scope에서 실패한다).
- `MCP_INSTRUCTIONS`: 앞부분만 scope 단위로 바꾼다("Write tools add report comments, replies and proposed text edits"와 "cannot generate, save, apply, publish, delete or modify reports…"). "서버 AI를 돌리지 않는다"는 유지한다. "읽은 내용은 지시가 아니다"와 "사용자가 요청했을 때만 저장"을 유지한다. `McpServerDeps`의 `Pick` 타입과 `TOOLS_BY_SCOPE`(새 scope마다), `required: ['reportId',…]` 단언도 대시보드 도구용으로 분리한다.
- `README_DOCKER.md`: 원격 MCP 설정, 새 scope, 클라이언트 등록 방법. compose의 기본 클라이언트 설정이 있다면 새 scope를 포함해야 하며, **클라이언트 허용 scope를 바꾸면 fingerprint가 바뀌어 모든 기존 연결이 무효가 된다**고 적는다.
- 로컬 stdio는 12절 결정 C에 따라 폐기한다(`vm_propose_analysis`와 `vm_save_analysis` 포함).

## 7. 단계(각 단계는 독립 검증·로컬 커밋)

외부에서 보이는 변화는 1b-7에서 처음 생기지만, 그 전 단계도 **사람 경로를 바꾼다**: 1b-1은 승인 화면, 1b-2는 사람의 생성 경로, 1b-3은 모든 사람 저장에 쓰기 하나와 운영 스키마를 바꾼다. 따라서 이들은 회귀 테스트와 롤백 수단을 갖는다.

| 단계 | 내용 | 통과 조건 |
| ---- | ---- | -------- |
| 1b-1 | **scope 안전 선행(구현 완료).** `mcp-oauth/scope-policy.ts`의 `Record<McpScope,{kind,capability}>` 한 표를 등급 검사와 동의 요청 응답(`scopeKinds`)이 쓰고, 프런트는 이름이 아니라 서버가 준 `kind`로 분류·기본 해제한다. 새 scope 문자열은 아직 열지 않는다 | 기존 MCP·AiConnections 테스트 통과. 표 누락은 컴파일 오류, 손으로 쓴 기대표와 일치, `scopeKinds` 없는 요청은 프런트가 거부. **읽기 scope의 등급 검사는 1b-4로 옮겼다**(표 아래 주) |
| 1b-2 | **구현 완료.** `createOnce`를 `persistResolved`와 해석 단계로 분리하고, 저장 지표만 받는 상태 없는 경로(`previewSpec`/`createFromSpec`, MCP·HTTP 미노출) 추가 | 기존 Studio 스펙 전부 통과 + 분리 전후 같은 입력의 정규화 출력 비교 + `metric.id` 없는 블록이 Metric 생성에 닿지 않는다는 단언 |
| 1b-3 | **구현 완료.** `dashboard_revision` 엔티티·**마이그레이션**·등록, Studio 저장·신규 생성에 이력(플래그 포함), 삭제·인계 정리 | 저장마다 행 1개, 같은 `requestId` 재시도는 행 추가 없음, 보존 규칙(human·생성 보존, ai 50개), **synchronize를 끈 PostgreSQL에서 마이그레이션 실행** |
| 1b-4 | `assertSoleOwner`, `McpDashboardService`(조회·미리보기·생성), 속도 제한 | 소유자만 통과, 남의 것·소유 행 2개·admin 우회 거부, viewer 거부, 지표 미등록·FORMULA 거부, `previewDigest` 불일치 409 |
| 1b-5 | 수정, 복원(`saveOnce` baseline), `REQUEST_REUSED` 사전 검사 | 오래된 `expectedRevision` 409, 복원이 새 이력, 지표·소스 드리프트 `RESTORE_STALE`, 다른 입력으로 같은 requestId는 `REQUEST_REUSED`(재시도 루프 없음) |
| 1b-6 | 삭제(영향 확인→삭제, 의존성 목록 포함 409) | 게시가 걸린 대시보드 거절·목록 포함, 의존성 0 삭제 성공, 이력도 삭제 |
| 1b-7 | MCP 도구 8개 등록, 새 scope 개방, 지침·스펙·annotation 갱신, 프런트 승인 화면 | scope별 도구 목록이 정확히 일치, 승인하지 않은 도구는 보이지 않음, `destructiveHint` 단언 |
| 1b-8 | stdio 서버 폐기(12절 C): `mcp-server/`·로그인 스크립트·검증 스크립트 제거, README·`README_DOCKER.md`·검증 문서의 MCP 안내를 원격 MCP로 교체 | 저장소에 stdio 서버 참조가 남지 않음, 문서의 안내대로 원격 MCP 연결이 e2e로 통과 |
| 1b-9 | **Docker e2e 확장**(8절) | 깨끗한 스택에서 전체 통과 |

1b-1 주(읽기 등급 검사를 1b-4로 옮긴 이유): 계획 초안은 읽기 scope에도 `read` 능력을 주어 소속을 확인하라고 했다. 확인해 보니 **소속 확인은 읽기에도 이미 있다.** 모든 MCP 도구가 `safe`/`structured`로 감싸여 실행 앞뒤로 `auth.revalidate`를 부르고, 이것이 `principalForHash` → `checkedGrant` → `actorContext`로 내려가 `EnterpriseMembership` 행을 조회한다(행이 없거나 조직이 `grant.organizationId`와 다르면 401, `mcp-oauth.service.spec.ts`의 'membership' 케이스가 증명). 읽기에 빠진 것은 소속이 아니라 **등급 검사**(`roleAllows(role, 'read')`)뿐이고, 네 등급과 legacy `member`가 모두 `read`를 가지므로 차이는 알 수 없는 role 문자열(예: `owner`)을 읽기에서 거부하지 못한다는 것이다(쓰기는 grade 스펙이 거부한다). 이 검사를 `assertGrant`(쓰기 트랜잭션 전용)에 넣으면 기존 읽기 도구 전체가 영향을 받으므로, 1b-1에서는 표를 한 곳으로 모으고 누락을 컴파일로 막는 데까지만 했다. 읽기 등급 검사는 새 대시보드 읽기 도구를 만드는 1b-4에서 `McpDashboardService`가 한다. `scope-policy.ts`의 읽기 `capability`는 그때까지 강제되지 않는다.

1b-2 주(결정과 남은 것):

- **환불 분모.** 스펙 경로의 호출자는 질문을 받을 수 없으므로, 저장 지표가 **정의에 이미 담은 분모**(`denominatorColumn`)를 답으로 쓴다(`savedRefundDenominator`: `paid_orders`는 주문 기준, `revenue`·`amount`·`payment_amount`는 금액 기준, 그 밖은 답 없음). 이후 기존의 비율 검증(분자·분모·배율 100)이 그대로 적용되므로 비율이 아닌 지표에 "환불률" 제목을 붙이는 우회는 막힌다. 정상 환불률 지표는 받는다. 순수 함수와 `validateBlock` 인자 전달을 테스트로 고정했다.
- **경합 재시도(40001/40P01/55P03).** 공통 저장 구간에는 **넣지 않았다.** 기존 사람 경로의 동작을 바꾸지 않는 것이 이 단계의 조건이었다. MCP 쓰기가 필요로 하면 같은 `requestId`로 안전하게 재시도되므로 MCP 계층에서 처리한다(1b-4에서 재판단).
- **저장 대기열.** 무거운 해석(미리보기 계산 포함)은 `serializeWrite` 밖에서 하고, 대기열 안에서는 replay 확인과 `persistResolved`(재검증·잠금)만 한다.
- **오류 코드.** 서비스 예외에 `PREVIEW_STALE`, `REQUEST_REUSED`, `SOURCE_CHANGED`, `UNSUPPORTED_CHANGE` 코드를 붙였다(기존 메시지는 그대로). 1b-4의 MCP 오류 매핑은 이 코드를 쓴다. 미리보기 뒤 지표가 삭제되거나 버전이 바뀌면 `validateBlock`이 400("저장 지표 버전을 확인해 주세요")을 내며 `PREVIEW_STALE`(409)이 아니다. 지표 정의가 바뀌었지만 버전은 같으면 digest가 달라 `PREVIEW_STALE`이다.
- **도구 설명에 적을 것(1b-4).** 새 미리보기 뒤에는 새 `requestId`를 쓴다(같은 `requestId`에 다른 digest는 `REQUEST_REUSED`).
- **닿지 않는 방어.** `resolveSpec`의 `!metric.id` 두 번째 검사와 `persistResolved`의 `storedMetricsOnly` 단언은 앞단 `cleanSpec`이 먼저 막아 테스트가 닿지 않는 이중 방어다.
- **PostgreSQL.** 새 경로는 jest(실제 DuckDB, SQLite 메타데이터)에서만 실행했다. 실제 PostgreSQL 실행은 1b-4에서 도구로 노출된 뒤 e2e(1b-9)로 확인한다.
- **통과 조건 충족.** 분리 전후 동일 출력: 같은 저장 지표 블록을 제안 경로와 스펙 경로로 저장해 `document`와 `StudioState`를 id·hash·무작위 키를 정규화한 뒤 비교하는 테스트로 증명했다.

1b-3 주(구현 사실과 정한 것):

- **열.** 계획 5.4의 열에 `operation`(`create`/`save`/`restore`)을 더했다. 보존 규칙 "사람 행과 생성 행은 항상 보존, `external-ai`의 저장·복원 행만 최근 50개"를 구현하려면 생성 행을 구분할 표시가 필요하다. `seq`는 정수 자동 증가(PostgreSQL `integer`, 숫자로 읽힌다), `createdAt`은 다른 아티팩트 테이블처럼 ISO 문자열이다.
- **기록 지점(3곳).** 사람의 저장 `saveOnce`(`operation: save`), 신규 생성 `persistResolved`(`create`), Studio pivot에서 새 대시보드를 만드는 경로(`create`). 모두 `StudioState`를 쓰는 같은 트랜잭션 안, `StudioRun` insert 앞이다. `persistResolved`는 작성 주체(`author`)를 선택 인자로 받아 1b-4의 MCP 생성이 `external-ai`를 넘긴다. `saveOnce`의 작성 주체 인자는 MCP 수정이 생기는 1b-5에서 추가한다. 기록하지 않는 곳: remix(`prepareRemix`), 재사용(`bi/studio-reuse-persist`, `dashboard-reuse`), 인계(복사본의 첫 이력 없음), 위젯·데이터셋·레거시 `/ai/dashboard-save`.
- **삭제·인계.** `deleteDashboardComments`를 부르는 세 곳(삭제, 개인 인계, 묶음 인계)이 같은 트랜잭션에서 `deleteDashboardRevisions`도 부른다.
- **기능 플래그.** `DASHBOARD_REVISION_HISTORY=off`면 기록하지 않는다(기본 켬).
- **기존 스펙 수정.** 명시적 엔티티 목록을 쓰는 스펙 15개에 `DashboardRevision`을 추가했고(두 곳은 `EnterpriseMembership`과 `User`도), 새 테이블이 없으면 `this.subQuery is not a function`으로 실패한다는 점이 확인됐다. 기록 함수가 조직 ID를 채우려고 `EnterpriseMembership`을 조회하기 때문에 이 의존이 생겼다.
- **마이그레이션 검증.** 마이그레이션 스펙(SQLite, 엔티티와 스키마 차이 0, 재실행 가능)에 더해 **실제 PostgreSQL 17에서 synchronize를 끄고** 실행했다: 스키마 차이 0, 열 형식 확인, 사람 행 2·생성 행 1·AI 저장 50개 보존, 삭제. 이 확인은 일회성(임시 스펙, 커밋하지 않음)이다. 운영 마이그레이션 실행은 따로 검증해야 한다.
- **Docker e2e.** 이 단계의 이력은 읽을 도구나 API가 아직 없어 e2e로 직접 볼 수 없다. 사람의 저장·삭제가 회귀하지 않는지는 기존 e2e로 확인한다. 이력 조회는 1b-4(`vm_read_dashboard`)부터 e2e에 들어간다.

배포 순서: 동의 요청 응답에 `scopeKinds`가 추가됐다. 새 프런트는 이것이 없는 응답을 거부하므로(닫힌 방향) **백엔드를 먼저 올리거나 함께 올린다.** Docker compose는 기본이 함께 올린다. 구 프런트는 모르는 키를 버리므로 새 백엔드와 같이 동작한다.

## 8. 검증 계획(수용 조건)

`scripts/docker-e2e.sh`에 케이스를 추가한다. 코드 읽기만으로 PASS로 적지 않는다.

1. AI 설정 없는 스택에서 PKCE로 `dashboards:read/write/delete`를 승인(쓰기·삭제는 사람이 체크)하고 도구 목록이 정확히 그 scope의 도구인지.
2. `vm_preview_dashboard` → `vm_create_dashboard`로 만든 대시보드가 **앱 목록과 Studio에서 열리고** 값이 CSV 집계와 같다.
3. 같은 `requestId` 재시도는 대시보드를 하나만 만든다. 다른 입력으로 같은 `requestId`는 `REQUEST_REUSED`. `previewDigest` 불일치와 미등록 지표·FORMULA는 거부된다.
4. `vm_update_dashboard`가 제목·배치를 바꾸고 오래된 `expectedRevision`은 409다. 블록 정의 변경은 `UNSUPPORTED_CHANGE`.
5. 수정 뒤 `vm_restore_dashboard`로 이전 상태로 돌아가고 이력에 AI 작성 주체(`clientName`)가 보인다. AI가 50번 수정해도 사람의 이력 행은 남는다.
6. 사람이 같은 대시보드를 화면에서 저장하면 `human` 이력이 쌓이고, AI가 그 revision을 모르고 덮으려 하면 409다.
7. 다른 사용자(같은 조직 admin 포함)의 대시보드는 MCP로 읽지도 쓰지도 못한다. 편집 grant를 받은 대시보드도 쓰기 거부.
8. viewer 계정의 토큰은 쓰기 scope를 승인해도 쓰기가 거부되고, 등급을 낮추면 다음 호출부터 거부된다.
9. 게시된 대시보드의 `vm_remove_dashboard`는 의존성 목록과 함께 409, 의존성이 없는 것은 삭제되어 목록에서 사라지고 이력도 사라진다.
10. 연결을 해제하면 쓰기 도구가 즉시 401이다.
11. 한도 초과는 `LIMIT`이고 서버 5xx가 아니다.
12. 마이그레이션: synchronize를 끈 PostgreSQL에서 실행(1b-3, e2e와 별개).

NOT_RUN으로 남을 것: 실제 Claude Code·Codex 호스트의 도구 이벤트(수동), claude.ai 커넥터, 모바일, VoiceOver(기존 차단 유지).

## 9. 위협과 대응(1b 추가분)

| 위협 | 대응 |
| ---- | ---- |
| AI가 사용자 의도 없이 지우거나 덮는다 | 쓰기·삭제 scope 기본 해제, 소유자만, 삭제는 의존성 0일 때만, `destructiveHint`, 모든 쓰기 이력과 복원 |
| AI가 이력을 밀어내 복원을 무력화한다 | `human`·생성 행 항상 보존, `external-ai` 행만 상한 |
| 미리보기와 저장 사이에 데이터·업무 기준이 바뀐다 | `previewDigest`에 sourceRevision·businessBasis 포함, 불일치는 `PREVIEW_STALE` |
| 새 scope가 기본 승인된다 | 서버가 내려주는 `kind` 표, 누락은 컴파일 오류(1b-1에서 선행) |
| 승인된 scope의 의미가 나중에 넓어진다 | 게시 scope는 enum에 넣지 않음, 능력 확장은 새 scope 이름(원칙 6) |
| 등급 검사 누락(fail-open) | 완전 `Record` 표, 읽기도 소속 확인, 트랜잭션 안 `beforeAccess` |
| 같은 requestId를 다른 입력으로 보내 무한 재시도 | 사전 검사로 `REQUEST_REUSED` |
| 다른 사용자의 대시보드에 쓰기·읽기 | `assertSoleOwner` 첫 검사, 목록도 같은 필터, e2e에 admin·grant 케이스 |
| 식별자 열 집계로 원본 값 반출 | 차원 카디널리티 상한, 승인 화면 경고 |
| 대량 쓰기·계산 폭주 | 사용자별 제한(쓰기·생성·삭제·미리보기), 대기열 상한은 `LIMIT`로 |
| 이력으로 이전 소유자 정보가 새 소유자에게 이전 | 삭제·인계 시 이력 삭제 |
| stdio JWT로 MCP 밖 API 호출 | 결정 C, 상위 8절 요구 6의 통과 조건 |

## 10. 알려진 한계(1b 후에도 남는 것)

- 블록 정의 변경·새 블록 추가·새 지표는 사람만 한다. AI가 만든 대시보드에 "차트 하나 더"를 하려면 새로 만들어야 한다.
- 게시·공유 MCP는 없다.
- 속도 제한은 단일 인스턴스 인메모리다.
- 이력은 Studio 저장·생성·복원만 덮는다(5.4의 목록). Studio로 열리지 않는 레거시 위젯 대시보드와 pivot 블록이 든 이력은 복원하지 않는다.
- 복원하면 차트 댓글 앵커가 분리될 수 있다.
- 삭제된 대시보드의 이력은 함께 지운다(결정 12의 "복구 기간 없음"과 일치).

## 11. 되돌리기

- 1b-1·2·3은 사람 경로를 바꾸므로 각 커밋이 독립적으로 되돌려진다. 이력 쓰기는 기능 플래그로 끌 수 있다. 롤백 마이그레이션으로 `dashboard_revision`을 지운다.
- 1b-7 이후 도구를 닫으려면 새 scope를 `MCP_OAUTH_CLIENTS_JSON`의 허용 목록에서 빼서 승인을 막는다. **이때 fingerprint가 바뀌어 모든 기존 MCP 연결(읽기 포함)이 무효가 되므로 사용자는 다시 연결해야 한다.** Docker compose 기본 클라이언트 설정이 있다면 함께 바꾼다.

## 12. 결정(2026-11-06 확정)

- **A. scope 이름: 종류별 `dashboards:read/write/delete`.** 상위 설계 결정 4·4.3이 정한 `artifacts:*`를 **변경**한다. 이유는 3절 원칙 6이다: 1c에서 보고서 쓰기를 같은 scope 아래 두면 1b에서 승인된 grant가 재동의 없이 보고서까지 쓰게 된다. 종류별이면 `reports:write`가 새 scope라 재동의를 받는다. 상위 문서의 4.3·9절 결정 4에 이 변경을 반영한다.
- **B. 생성 경로: Studio `createOnce` 분리.** 해석 단계와 공통 저장 단계(`persistResolved`)로 나눠 사람 UI와 MCP가 같은 저장 코드를 쓴다. BI 의미 제안 경로는 쓰지 않는다(proposal 형식 불일치, 새 `Metric` 행 생성이 결정 10과 충돌). BI의 경합 재시도(40001/40P01/55P03) 장점은 1b-2에서 공통 저장 구간에 넣을지 판단한다.
- **C. 로컬 stdio: 폐기하고 원격 MCP로 안내.** 1b-8에서 `mcp-server/`(stdio 서버, 로그인 JWT 스크립트, 검증 스크립트)와 관련 문서를 제거하고 README·`README_DOCKER.md`의 MCP 안내를 원격 MCP(OAuth)로 바꾼다. 서버 AI를 실행하는 `vm_propose_analysis`와 JWT로 MCP 밖 API를 부르는 길이 함께 사라져 상위 8절 요구 6의 통과 조건을 만족한다. 제거 범위(예: `docs/testing/docker-quickstart.md`의 stdio 검증 기록)는 1b-8에서 목록으로 확정한다.

해결한 것: 이력 보존은 5.4(`human`·생성 보존, AI 50개)로 정했다. `StudioSpecService` 추출은 폐기하고 `createOnce` 분리로 바꿨다.
