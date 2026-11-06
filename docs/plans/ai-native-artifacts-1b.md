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
- 이력 기록에는 **기능 플래그**(`DASHBOARD_REVISION_HISTORY`, 기본 켬)를 둬서 문제가 생기면 사람의 쓰기(생성·저장) 경로에서 이력 쓰기만 끌 수 있게 한다.

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
| 1b-4 | **구현 완료(서비스 계층, 도구로는 아직 노출 안 함).** `assertSoleOwner`, `McpDashboardService`(조회·미리보기·생성), 속도 제한 | 소유자만 통과, 남의 것·소유 행 2개·admin 우회 거부, viewer 거부, 지표 미등록·FORMULA 거부, `previewDigest` 불일치 409 |
| 1b-5 | **구현 완료(서비스 계층, 도구로는 아직 노출 안 함).** 1b-5a 수정·`REQUEST_REUSED` 사전 검사·AI 쓰기 앞 기준 행, 1b-5b 복원 | 오래된 `expectedRevision` 409, 복원이 새 이력, 지표·소스 드리프트 `RESTORE_STALE`, 다른 입력으로 같은 requestId는 `REQUEST_REUSED`(재시도 루프 없음) |
| 1b-6 | **구현 완료(서비스 계층, 도구로는 아직 노출 안 함).** 삭제(영향 확인→삭제, 의존성 목록 포함 409) | 게시가 걸린 대시보드 거절·목록 포함, 의존성 0 삭제 성공, 이력도 삭제 |
| 1b-7 | **구현 완료(단위·통합까지, PostgreSQL·Docker e2e는 1b-9).** MCP 도구 8개(+1b-9에서 `vm_list_metrics` 추가로 9개) 등록, 새 scope 개방, 지침·스펙·annotation 갱신, 프런트 승인 화면 | scope별 도구 목록이 정확히 일치, 승인하지 않은 도구는 보이지 않음, `destructiveHint` 단언 |
| 1b-8 | **구현 완료.** stdio 서버 폐기(12절 C): `mcp-server/`·로그인 스크립트·검증 스크립트 제거, README·`README_DOCKER.md`·검증 문서의 MCP 안내를 원격 MCP로 교체 | 저장소에 stdio 서버 참조가 남지 않음, 문서의 안내대로 원격 MCP 연결이 e2e로 통과 |
| 1b-9 | **구현·실행 완료(대시보드 케이스 6개 통과, 전체는 67/71: 아래 노트).** **Docker e2e 확장**(8절) | 깨끗한 스택에서 전체 통과 |

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
- **기록 지점(3곳).** 사람의 저장 `saveOnce`(`operation: save`), 신규 생성 `persistResolved`(`create`), Studio의 저장본 복제 `copy`(`create`, 새 대시보드를 만든다). 모두 `StudioState`를 쓰는 같은 트랜잭션 안, `StudioRun` insert 앞이다. `persistResolved`는 작성 주체(`author`)를 선택 인자로 받아 1b-4의 MCP 생성이 `external-ai`를 넘긴다. `saveOnce`의 작성 주체 인자는 MCP 수정이 생기는 1b-5에서 추가한다. 기록하지 않는 곳: remix(`prepareRemix`), 재사용(`bi/studio-reuse-persist`, `dashboard-reuse`), 위젯·데이터셋 수정, 레거시 `/ai/dashboard-save`, 수명주기(`assetActive`·`assetVersion`), 레거시 pivot 서비스(`bi/dashboard-pivot.service.ts`, `pivotDefinitions`를 쓴다). 인계는 복사가 아니라 같은 id의 **소유권 이전**이라 이력을 전부 지우고 새 기준 행도 남기지 않는다(이전 소유자의 연결 이름·grant가 새 소유자에게 넘어가지 않게 하려는 것).
- **삭제·인계.** `deleteDashboardComments`를 부르는 세 곳(삭제, 개인 인계, 묶음 인계)이 같은 트랜잭션에서 `deleteDashboardRevisions`도 부른다.
- **기능 플래그.** `DASHBOARD_REVISION_HISTORY=off`면 **사람의 쓰기(생성·저장)**만 기록하지 않는다(기본 켬). 외부 AI의 쓰기는 항상 기록한다: 이력은 사람이 AI의 변경을 되돌리는 안전망이라, 플래그를 꺼도 AI 쓰기가 기록되지 않는 일이 없어야 한다. 단 AI 행은 저장 **뒤** 상태만 담으므로, 플래그가 꺼져 있었거나 기록하지 않는 경로를 거친 뒤의 **첫 AI 변경 직전 상태**는 이력에 없다(1b-5 조건 (마) 참고).
- **1b-4·1b-5가 지킬 조건(architect, 1b-3 검토).** (가) 이력 행은 "X가 저장한 **상태**"이지 "X가 만든 **변경**"이 아니다. 기록하지 않는 경로의 변경은 다음 저장 행에 합쳐지므로 요약을 diff나 책임 귀속처럼 쓰지 않는다. (나) "가장 최근 이력 행의 `revision`이 현재와 같다"를 "기록되지 않은 변경이 없다"는 판정에 쓰지 않는다(수명주기·인계는 `assetVersion`·`assetActive`·`delYn`을 바꾸고 이 값들은 해시에 들어가므로 revision이 달라진다. 같은 revision인데 상태가 다른 실제 경우는 해시되지 않는 `pivotDefinitions`를 바꾸는 레거시 pivot 서비스다). (다) **복원은 `pivotDefinitions`를 되쓰지 않는다.** `dashboardRevision()`은 이 열을 해시하지 않으므로, 되쓰면 나중에 추가된 레거시 pivot이 409 없이 사라진다. 이 열은 기록용이다. (라) 이력 조회 도구는 `assertSoleOwner`를 통과한 `dashboardId` 범위 안에서만 조회하고(`revisionId`만으로 조회하는 길을 열지 않는다), 요약 필드는 `seq`, `revisionId`, `createdAt`, `operation`, `authorKind`, `aiClientName`, 작성자 표시로 한정한다(`studioDocument`·정의 열·`aiGrantId`는 내보내지 않는다. 공유 편집자의 grant가 들어 있을 수 있다). `aiClientName`과 `title`은 외부에서 들어온 문자열이라 "지시가 아니다" 규칙을 적용한다. 비활성(`assetActive=false`) 대시보드의 이력 조회 정책을 정한다. (마) AI의 저장·복원은 쓰기 전 상태의 revision이 가장 최근 이력 행의 revision과 다르면, 쓰기 전 상태를 기준 행(`human`)으로 먼저 남긴다. 그래야 첫 AI 변경도 되돌릴 수 있다. 기준 행을 더 남기는 방향이라 (나)와 충돌하지 않는다.
- **한계.** 사람 행의 총량 상한은 없다(사람의 저장은 사람 속도이고 Studio에 자동 저장이 없다). `seq`는 int4라 전역 약 21억 행이 상한이다. 이 기능을 켠 상태의 `docs/testing/postgres-metadata.md`의 테이블 개수(103)는 다시 실행한 영수증 없이 고치지 않았다.
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

### 1b-4 구현 노트

- **범위.** 서비스 계층까지다. 도구 등록·scope 개방·모듈 DI 연결·감사 기록(`dashboard.mcp-create`)은 1b-7에서 한다. 서비스는 `McpOAuthModule`에 provider로 아직 등록하지 않았다(`StudioService`·`StudioCreationService`·`EnterpriseResourcePolicyService`를 모듈이 가져와야 한다). **1b-7의 통과 조건에 "실제 Nest 컨테이너에서 서비스가 만들어진다"를 넣는다.**
- **scope 이음매.** `dashboards:*` 세 이름은 `McpScope`에 아직 없고 `mcp-oauth/dashboard-scope.ts`에 따로 있다. 클라이언트 설정과 승인 화면은 `McpScope`만 알아서 지금은 어떤 연결도 이 scope를 가질 수 없다(서비스는 `principal.scopes`를 직접 확인한다). 1b-7이 세 이름을 `McpScope`와 `MCP_SCOPE_POLICY`로 옮기고 이 파일을 지운다. 프런트 enum이 서버보다 먼저 받아야 한다는 순서는 그대로다.
- **assertSoleOwner.** 대시보드가 없거나, 삭제·비활성이거나, 소유 행이 2개 이상이거나, 호출자가 소유자가 아니거나(조직 admin·공유 편집자 포함) 계정이 비활성이면 모두 같은 `ForbiddenException`이다. 존재 여부를 구별할 단서를 주지 않는다. **비활성(`assetActive=false`) 대시보드는 MCP로 읽지도 쓰지도 못한다**(1b-3 조건 (라)의 정책 결정). 목록은 같은 조건을 SQL로 쓰고, 스펙이 모든 픽스처에서 둘의 판정이 일치함을 확인한다.
- **읽기 등급 검사.** 모든 호출이 `begin()`에서 scope → `revalidate` → 등급(`assertGradeAllows`, `McpReportService`와 공용) 순으로 확인한다. 알 수 없는 role 문자열은 읽기에서도 거부된다(1b-1에서 미룬 항목).
- **쓰기의 grant 검사.** `createFromSpec`이 `beforeAccess` 훅을 받아 저장 트랜잭션의 첫 줄에서 `assertGrant`와 등급을 읽는다. 스펙이 훅이 트랜잭션 안에서 돌고, 훅이 거부하면 대시보드·`StudioRun`이 남지 않음을 확인한다.
- **원본 값 반출.** 미리보기·생성 모두 한 블록이 500행(`SPEC_ROW_LIMIT`)을 넘으면 `CARDINALITY_LIMIT`으로 거부한다(자르지 않는다). 도구가 돌려주는 미리보기에는 쿼리 문장(`sql`)을 넣지 않고 블록당 100행까지만 준다. 소스는 호출자가 **소유한** 것만 허용한다(공유받은 소스는 안 된다).
- **이력 요약.** `vm_read_dashboard`는 `revisionId, createdAt, operation, authorKind, clientName(AI일 때), byYou, isCurrent`만 준다. 다른 사람의 계정 정보는 `byYou: false`로만 드러난다. 문서 본문·`actorId`·`aiGrantId`는 내보내지 않는다.
- **오류.** `DashboardToolException(code, reason)`이 `detail.reason`을 싣는다. 서비스 예외의 `code`(`PREVIEW_STALE`, `SOURCE_CHANGED`, `REQUEST_REUSED`, `REPLAY_UNREADABLE`, `CARDINALITY_LIMIT`, `QUEUE_FULL`)와 코드 없는 409·503만 변환하고, 그 밖(거부, 404, 모르는 코드가 붙은 409, 버그)은 그대로 둔다. 같은 `requestId`·다른 입력은 `createFromSpec`이 쓰기 전에 `StudioRun`을 읽어 `REQUEST_REUSED`를 낸다(재시도 무한 루프를 막는다). 이미 만든 기록을 읽을 수 없는 경우(`REPLAY_UNREADABLE`)도 `REQUEST_REUSED`다: 같은 requestId로 다시 보내도 같은 답이므로 목록으로 확인하게 한다.
- **속도 제한.** 계정별 고정 창: 미리보기 10/분, 쓰기 20/분, 생성 10/시간. 초과는 `LIMIT`/`RATE_LIMITED`. 재시도(replay)도 한도를 쓴다.
- **읽기는 계산하지 않는다(architect 1b-4 블로커).** `vm_read_dashboard`는 `StudioService.get`(대시보드 전체 쿼리를 실행)이 아니라 `readDocument`(문서·`sourceRevision`·`sourceName`만)를 쓴다. 계산은 `dashboards:write`의 미리보기에만 있다. 미리보기 응답은 블록마다 `rowCount`와 `truncated`를 준다.
- **오류 사유.** `STATE_CHANGED`는 코드 없이 던져진 409(파일 교체, 지표 변경 등)이고 "다시 미리보기부터"를 뜻한다. `INVALID_INPUT`은 형식이 틀린 id·커서이고 `UNSUPPORTED_CHANGE`(블록 정의 변경 불가)와 다르다. 일시적 혼잡은 **재시도 가능한 `CONFLICT` 코드**로 낸다(`LIMIT`은 `retryable:false`라 에이전트가 재시도를 멈춘다. 5.6의 "`LIMIT`로 돌려준다"에서 바꾼 점): 서비스가 `code: 'QUEUE_FULL'`을 싣는 503은 `QUEUE_FULL`, 코드 없는 503(DuckDB worker busy 등)은 `BUSY`다. 속도 제한 초과만 `LIMIT`/`RATE_LIMITED`다.
- **replay의 한계(수용).** 같은 `requestId` 재시도는 `beforeAccess`를 거치지 않는다. 끝의 `revalidate`가 grant 회수는 막지만 등급 하락은 못 잡는다. 새는 것은 이미 만든 대시보드의 `{dashboardId, revision}`뿐이다. replay된 대시보드가 지금도 단독 소유인지는 확인하지 않는다. 지침 "CONFLICT면 같은 requestId로 재시도"와 시간당 생성 10회가 맞물려 정상 재시도 몇 번으로 한도가 줄 수 있다(재시도도 한도를 쓴다).
- **1b-7 도구 설명에 적을 것.** `isCurrent`는 "이 저장 상태가 지금 대시보드와 같다"는 뜻이지 "기록되지 않은 변경이 없다"는 뜻이 아니다(1b-3 조건 (나)). 읽기는 공유받은 소스 위의 **소유한** 대시보드도 돌려주지만 생성은 소유한 소스만 허용한다(받은 대시보드는 4절의 별도 결정).
- **1b-7 통합 통과 조건에 추가.** 실제 `assertGrant`가 저장 트랜잭션 안에서 grant 행을 잠그고 거부하는 경로를 한 번 실행한다(지금은 `studio-creation` 스펙이 가짜 훅의 위치를, MCP 스펙이 `assertGrant` 호출을 따로 증명할 뿐 둘이 이어진 경로는 어디서도 실행되지 않는다).
- **미해결(1b-7로).** 감사 기록, 모듈 DI, 쓰기 대기열 상한 도달이 사람 저장에 주는 영향 관찰, `expectedSourceRevision`을 받지 않는 미리보기 응답의 `blocks`를 plan의 `{key, kind, …, warnings}` 모양으로 맞출지 결정.

### 1b-5a 구현 노트(수정, architect 설계 검토 반영)

- **쓰기 옵션.** `StudioService.save(id, body, actor, signal, options)`의 `SaveOptions {author, beforeAccess, payloadKey}`. 서버 안 호출자만 넘기고 컨트롤러는 넘기지 않는다. `beforeAccess`는 저장 트랜잭션 첫 줄에서 돈다(1b-4 생성과 같음). `author`는 이력에 `external-ai`로 남는다.
- **요청 정체성.** MCP 수정의 문서는 "현재 문서 + changes"로 파생되므로, 성공 뒤 같은 `requestId`로 재시도하면 파생 결과가 달라져 오탐이 된다. 그래서 `payloadKey`가 있으면 `StudioRun.payloadHash`를 `studioDigest(payloadKey)`로 만든다. 키는 `{kind:'mcp-dashboard-update', id, expectedRevision, expectedSourceRevision, 정규화한 changes}`이고, MCP 계층은 문서를 파생하기 전에 `StudioService.replayRecord`로 같은 해시의 기록을 먼저 찾아 저장된 결과를 돌려준다(revision 검사보다 앞). 다른 해시면 `REQUEST_REUSED`다. 사람 저장은 `payloadKey`가 없어 해시가 바이트 단위로 그대로다(테스트로 고정). `replayRecord`가 던지는 409에 코드(`REQUEST_REUSED`, `REPLAY_UNREADABLE`)를 붙였다. 저장의 낡은 revision·교체된 파일 409에도 `REVISION_CHANGED`·`SOURCE_CHANGED` 코드를 붙였다(메시지 유지).
- **기준 행(조건 마).** AI 쓰기는 잠금과 CAS 직후, `persist` 전에 최신 이력 행의 revision이 쓰기 전 revision과 다르거나 이력이 없으면 쓰기 전 상태를 `operation: 'baseline'`, `authorKind: 'human'` 행으로 먼저 남긴다. 이력 플래그가 꺼져 있어도 쓴다. 이 행은 "그 상태였다"일 뿐 누가 만들었는지는 말하지 않으므로(공유 편집자나 기록 안 되는 경로의 결과일 수 있다) `read()`는 baseline 행에 `byYou`를 내지 않는다. 사람 행처럼 정리 대상이 아니다. `operation` 열은 `varchar(8)`이라 `baseline`(8자)이 들어가며 마이그레이션에 CHECK가 없어 스키마 변경이 없다.
- **허용 변경.** `applyStudioOperation`을 허용 목록으로 감쌌다(`mcp-dashboard.changes.ts`): `renameDashboard`, `updateBlock{title,description,display}`, `moveBlock`, `resizeBlock`, `removeBlock`, `setFilters`, `setDateRange`. 그 밖의 연산(블록 추가·복제, `setConditions`)과 `updateBlock`의 다른 키(`measureRefs` 등)는 `UNSUPPORTED_CHANGE`, 모양 오류·모르는 블록·마지막 블록 삭제는 `INVALID_INPUT`이다. 변경은 1..20개, 요청 전체 64KiB 이하. `display`는 통째 교체가 아니라 병합이다(서버 AI 경로와 같음). 연산마다 문서를 검증하므로 자리 맞바꾸기는 빈 자리를 거치는 이동 3번이 필요하다(도구 설명에 적는다, 1b-7). 변경이 없는 결과(파생 문서 = 현재)는 쓰지 않고 `changed:false`로 현재 revision을 돌려준다(Widget·Dataset 고아 행이 AI의 반복 호출로 늘지 않게 한다. 저장마다 위젯·데이터셋 행이 새로 생기고 지워지지 않는 것은 기존 동작이며 한계로 남는다).
- **오류 계약.** `REVISION_CHANGED`·`SOURCE_CHANGED`는 다시 읽고 재시도하는 `CONFLICT`다. **`RESTORE_STALE`은 `INVALID`(재시도 불가)다**: `CONFLICT`는 `retryable`이라 영구히 낡은 복원이 재시도 루프에 빠진다(1b-5b가 이 코드를 던진다).
- **1b-5b가 지킬 조건(architect).** (B2) 이력 행 무결성은 `dashboardRevision` 재계산이 아니다(해시에 들어가는 `delYn/assetActive/assetVersion`이 이력 행에 없다). 구조 일관성으로 검사한다: `validateStudioDocument`, `document.revision === row.revision`, `document.dashboardId`, `analysisDefinition`의 blockId 집합과 `studioCharts` id 집합 일치, `structuredDefinition`이 있으면 `metricLinkItems` 길이 = 위젯 수. 실패는 서버 데이터 손상이라 재시도 불가 사유로 내고 `RESTORE_STALE`과 구분한다. `analysisDefinition`이 null인 레거시 행은 거부한다. (B3) baseline은 호출자가 넘기지 않는다. `restoreFrom: {revisionId}`만 받고 `StudioService`가 `(dashboardId, revisionId)`로 행을 직접 읽어 B2 검사를 거쳐 합성한다(템플릿에는 저장·실행되는 SQL이 있다). (B4) 이력의 차트 블록 중 id를 유지하는 것이 하나도 없으면 거부한다(`storedBlockIds`가 모두 임시 id일 때 위치 순서로 현재 블록 id를 물려준다). 폴백은 현재에 없는 `definitionKey`만 `old.blocks/items/analysis.widgets` 끝에 index를 맞춰 덧붙인다. 현재와 이력 중 한쪽만 `structuredDefinition`이 있으면 거부, 문서 `businessBasis` 불일치와 `conditions.sourceRevision` 불일치는 `RESTORE_STALE`. STALE 변환은 던지는 곳의 코드로 하고 `lockMetricReferences`의 403은 가리지 않는다. 피벗 블록이 현재 또는 이력에 있으면 거부, `pivotDefinitions`는 되쓰지 않는다.
- **검증.** tsc 통과. 실제 DuckDB·SQLite 통합 테스트 `studio.service.spec.ts`(요청 해시 불변, 파생 재시도, 동시 같은 requestId 한 번 쓰기, 기준 행 4경우, `beforeAccess` 거부 시 쓰기 0, 오류 코드)와 `mcp-dashboard.update.spec.ts`(8개: 변경 적용·이력, 블록 삭제·마지막 블록, 금지 연산 전수, 필터, 재시도·`REQUEST_REUSED`, 낡은 revision·교체된 파일, 무변경, 비소유자·viewer·scope·철회된 grant). 관련 스펙 127개 스위트(2987건) 통과. 실제 PostgreSQL 실행과 Docker e2e는 도구 등록(1b-7) 이후다.

### 1b-5b 구현 노트(복원)

- **구조.** `McpDashboardService.restore`가 입력(`requestId`·`revisionId` UUID v4, `expectedRevision`)을 검사하고, 소유자 확인 → 요청 이름(`{kind:'mcp-dashboard-restore', id, revisionId, expectedRevision}`)으로 `replayRecord` → `(dashboardId, revisionId)` 쌍으로 이력 행 조회(없으면 NOT_FOUND, 다른 대시보드의 이력은 닿지 않는다) → 낡은 revision이면 `REVISION_CHANGED` → 행 revision이 현재와 같으면 쓰지 않고 `changed:false` → `StudioService.restore`. 복원 결과도 새 이력 행(`operation: 'restore'`, 작성 주체 `external-ai`)이고 AI 쓰기 앞의 기준 행 규칙을 그대로 따른다.
- **`StudioService.restore`는 서버가 행을 직접 읽는다**(B3). 호출자는 어떤 상태인지만 말한다. 행이 온전한지 `deriveRestore`(`studio-restore.ts`, 순수 함수)가 구조로 확인한다(B2): 문서 검증, `document.revision === row.revision`, `dashboardId`, `analysisDefinition`의 blockId 집합과 문서의 차트 id 집합 일치, `structuredDefinition`이 있으면 연결 항목 수 = 위젯 수. 온전하지 않거나 `analysisDefinition`이 없는 옛 행, 피벗이 현재·이력 어느 쪽에든 있는 경우, 업무 조건(`conditions`)이 달라진 경우는 `UNSUPPORTED_CHANGE`(재시도 불가)다. 데이터 소스·업무 기준이 달라졌거나 한쪽에만 구조화 저장 형식이 있으면 `RESTORE_STALE`.
- **블록 대응.** 같은 id·같은 계산(`definitionKey`·`kind`)인 블록은 id를 유지하고 저장된 제목·설명·표시·배치를 되찾는다. 지금 없는 블록은 임시 id(`new:`)로 저장되어 위젯이 새로 만들어지고(댓글은 옛 id에 남는다), 그 `definitionKey`가 현재에 없는 블록은 이력 행의 분석 정의·연결 항목을 `old.blocks/items/템플릿`의 끝에 덧붙여(`RestoreExtras`) 기존 저장 검증(계산 정의 불변, 지표 참조 최신성)을 그대로 탄다. `definitionKey`가 현재에 있는 것은 이미 테스트된 복제 경로를 탄다. 유지되는 차트 블록이 하나도 없으면 거부한다(B4: `storedBlockIds`가 모두 임시 id일 때 위치 순서로 현재 블록 id를 물려주어 댓글이 엉뚱한 차트에 붙는다. 사람의 저장에도 있는 기존 결함이며 복원이 자동화하지 않게 막았다).
- **`RESTORE_STALE`의 판정.** 복원의 저장 입력은 전부 서버가 만든 것이므로, 저장이 코드 없는 400·409를 던지면 "옛 상태가 오늘의 지표·열에 맞지 않는다"는 뜻이다. `StudioService.restore`는 그 경우만 `RESTORE_STALE`로 바꾸고, 코드가 있는 오류(`REVISION_CHANGED`, `SOURCE_CHANGED` 등)와 403은 그대로 통과시킨다(권한 거부를 가리지 않는다). MCP에서는 `INVALID`·`retryable:false`다.
- **`pivotDefinitions`는 되쓰지 않는다**(조건 다, 테스트로 고정). 복원은 `studioDocument`·분석·구조 정의로 저장 경로를 거쳐 저장하며 레거시 pivot 열을 건드리지 않는다.
- **한계.** 복원은 업무 조건이 달라진 저장본과 피벗이 든 대시보드를 지원하지 않는다. 메타데이터 고아 행(저장마다 위젯·데이터셋이 새로 생김)은 1b-5a와 같다. 복원된 블록의 차트 댓글 앵커가 분리될 수 있음을 도구 설명에 적는다(1b-7).
- **검증.** tsc 통과. `mcp-dashboard.update.spec.ts`(복원 8개: 삭제 블록 복원·같은 수치·이력 순서, 재시도·`REQUEST_REUSED`, 무변경, 다른 대시보드·낡은 revision, `pivotDefinitions` 불변, 저장이 거부될 때 `RESTORE_STALE`/403 통과, 소스·기준·형식 변화 판정, 손상된 행, 유지 블록 없음 거부)와 `studio-creation.service.spec.ts`(저장 지표 연결·차원 참조가 있는 대시보드에서 AI가 지운 차트를 복원해 같은 값과 `measureRefs`를 되찾는다). 관련 스펙 127개 스위트(2997건) 통과. **실제 지표 정의 변경·열 변경에 따른 `RESTORE_STALE`은 저장 오류를 주입해 매핑만 확인했다**(통합 fixture의 레거시 블록은 지표·차원 참조가 없어 실제 드리프트를 만들 수 없다). 실제 PostgreSQL 실행과 Docker e2e는 도구 등록(1b-7) 이후다.

### 1b-5 완료 검토 반영(architect)

- **AI 쓰기는 되돌릴 수 있는 상태만 덮는다**(조건 마의 완결). 저장 트랜잭션 안에서 AI 쓰기 직전 상태를 `assertRestorableRow`(복원 검사의 무결성 부분을 꺼낸 것)로 확인하고 통과하지 못하면 `UNSUPPORTED_CHANGE`로 거부한다: 피벗 블록, `analysisDefinition`이 없는 옛 대시보드, v1 단일 블록 스냅샷처럼 항목 수가 위젯 수와 맞지 않는 경우. 사람 저장은 이 검사를 받지 않는다. 통합 fixture는 항상 `analysisDefinition`이 있어 이 거부를 실제 행으로 재현하지 못했고, 배선(AI에게만 호출됨)만 검사를 강제해 확인했다.
- **`RESTORE_STALE`로 바뀌는 범위를 좁혔다.** 코드 없는 400·409를 모두 STALE로 바꾸는 폴백은 재시도하면 되는 경합까지 "영구히 복원 불가"로 바꿀 수 있다. 소스 경합(`저장 안의 파일 교체`, `Business/Condition source revision changed`)에 `SOURCE_CHANGED`, `load()`의 읽기 일관성 409와 `차트 배치를 다시 불러와 주세요`에 `STATE_CHANGED`를 붙였고(둘 다 재시도 가능한 `CONFLICT`), 폴백이 잡는 것은 지표 정의·열 구성 드리프트(`validateCurrentReferences`, `Saved metric changed.` 등)로 줄었다. STALE로 바꿀 때 원래 오류를 서버 경고 로그에 남긴다. 손상된 이력 행도 경고 로그를 남긴다. 남은 한계: 사유 열거에 `RESTORE_CORRUPT`는 없다(손상과 미지원이 같은 `UNSUPPORTED_CHANGE`).
- **템플릿 조회.** 복원이 되살리는 블록의 위젯 템플릿은 id가 아니라 덧붙인 자리로 찾는다(현재의 다른 블록이 같은 id를 가진 경우 그 SQL이 섞이지 않게).
- **복원의 재시도.** `StudioService.restore`는 revision 검사 전에 같은 요청의 기록을 먼저 찾는다. MCP의 재시도 응답(`update`·`restore`)에도 `changed:true`를 넣어 첫 응답과 같은 모양이다.
- **1b-7이 처리할 것(이 변경에서 생김).** (가) `read()`는 이력을 20개만 주고 커서가 없다. AI 쓰기가 20번을 넘으면 기준 행의 `revisionId`를 MCP로 찾을 수 없으므로 커서나 `operation` 필터를 둔다. (나) `restore`는 `expectedSourceRevision`을 받지 않고 서버가 채운다(update와 비대칭). 도구 설명에 적는다. (다) 복원은 지표 참조가 없는 옛 SQL 블록의 계산(SQL)을 되돌리지 않고 현재 것을 유지한다. 도구 설명에 "표시·배치·제목·필터·블록 존재만 복원"이라고 적는다. (라) 사람 저장이 같은 id를 새 블록에 위치 순서로 물려주는 기존 결함은 그대로다. (마) `assertSoleOwner`는 트랜잭션 밖에서만 확인한다. 진행 중 공유가 부여되면 쓰기 하나가 통과할 수 있어, `serializeMetadataWork` 재진입을 확인한 뒤 `beforeAccess`에 넣을지 판단한다. (바) 통과 조건에 추가: 옛 대시보드(`analysisDefinition` null)와 피벗 대시보드의 update 거부, 실제 지표 버전 변경·열 삭제로 생기는 `RESTORE_STALE`, PostgreSQL 실행.

### 1b-6 구현 노트(삭제)

- **서비스.** `McpDashboardService.removalImpact`·`remove`는 둘 다 `dashboards:delete` scope를 요구하고(영향 확인도 삭제 흐름의 일부라 읽기 scope로 열지 않는다), 기존 `DashboardDeletionService.impact/remove`를 그대로 쓴다: 단독 소유 확인, 의존성 검사(직접·그룹 권한, 직접·그룹 전달, 라이브 공유, 레거시·Studio 게시, 공유 기록), 댓글·이력·위젯 연결·소유 연결 삭제, 영수증, 감사 이벤트가 한 트랜잭션이다. `expectedActorId`·`expectedOrganizationId`·epoch는 principal에서 채운다. 삭제 서비스에 선택 인자 `options.beforeAccess`를 더했다: 삭제 트랜잭션 첫 줄에서 grant와 등급을 읽으므로, 철회·강등된 연결은 삭제는 물론 영수증 재생도 하지 못한다.
- **재시도.** 삭제 뒤에는 대시보드가 없어 `assertSoleOwner`가 실패하므로, `remove`는 같은 요청의 영수증이 있으면 소유자 확인을 건너뛰고 삭제 서비스의 영수증 재생(`replayed:true`)에 맡긴다. 영수증이 없는 호출은 `assertSoleOwner`를 먼저 지난다(비활성 대시보드는 MCP로 닿지 않는다). 같은 요청 ID에 다른 `expectedRevision`은 `REQUEST_REUSED`.
- **오류.** 삭제 서비스의 409에 코드를 붙였다(메시지 유지): 낡은 revision → `REVISION_CHANGED`(재시도 가능한 `CONFLICT`, 영향 확인을 다시 읽는다), 다른 입력의 같은 요청 번호 → `REQUEST_REUSED`, 경합 → `STATE_CHANGED`, **사용처 → `HAS_DEPENDENCIES`**. `HAS_DEPENDENCIES`는 재시도로 풀리지 않으므로 `INVALID`(`retryable:false`)이고 `detail.dependencies`에 `[{kind, count}]`(종류와 개수뿐, id 없음)를 담는다. 이를 위해 `DashboardToolException`에 선택 `extra`를 두고 `mcpError`가 `detail`에 합쳐 준다.
- **속도 제한.** 삭제 10회/분(사용자별).
- **감사.** 삭제 서비스가 이미 쓰는 `dashboard-deletion.completed` 이벤트를 그대로 쓴다. 이 이벤트는 연결(grant·클라이언트 이름)을 담지 않으므로, MCP가 지웠다는 표시가 필요하면 1b-7의 감사 항목(`dashboard.mcp-*`)에서 정한다.
- **1b-7이 처리할 것.** `vm_remove_dashboard` 설명에 "먼저 `vm_get_dashboard_removal`로 revision을 읽고, `HAS_DEPENDENCIES`면 사용자에게 사용처 중지를 요청하라(재시도 금지)"를 적고, `destructiveHint:true`를 준다. 사람 삭제 UI는 응답 본문이 `{code,message,dependencies}`로 바뀐 409를 상태 코드로 판정하는지 프런트에서 확인한다.
- **검증.** tsc 통과. 실제 SQLite에서 `mcp-dashboard.update.spec.ts`의 삭제 6개: 영향 보고와 revision, 의존성이 있으면 목록과 함께 거부·삭제 0, 삭제 성공 시 이력·댓글·연결·소유 연결 제거와 감사 1건·영수증 재생·`REQUEST_REUSED`, 낡은 revision, 비소유자·쓰기 scope만·viewer·철회된 grant 거부, 속도 제한. 기존 `dashboard-deletion.spec.ts` 통과. 관련 127개 스위트(3004건) 통과. 실제 PostgreSQL과 Docker e2e는 1b-7 이후.

### 1b-7 구현 노트(도구 등록, architect 설계 검토 반영)

- **scope 개방.** `mcpScopeSchema`에 `dashboards:read|write|delete`를 더하고 `MCP_SCOPE_POLICY` 한 표에 넣었다(임시 `dashboard-scope.ts`는 삭제, `DashboardScope`는 `Extract<McpScope, 'dashboards:…'>`). 승인 화면의 `scopeKinds`는 같은 표에서 나온다. 저장된 grant·pending의 `scopes`는 `simple-json`이고 검증은 클라이언트 허용 목록의 부분집합 검사뿐이라 마이그레이션이 없다.
- **광고 scope(B1).** `scopes_supported`(두 메타데이터 응답)는 `MCP_SCOPES` 전체가 아니라 **설정된 클라이언트들 `scopes`의 합집합**(`advertisedScopes`)이다. Claude Code는 광고 목록 전체를 요청하고 `authorize`는 클라이언트 허용 목록 밖의 scope를 `invalid_scope`로 거부하므로, enum만 늘어도 7개로 등록된 클라이언트의 새 연결이 배포 당일 실패한다. 이제 새 scope는 운영자가 클라이언트 `scopes`에 넣기 전에는 어떤 응답에도 나오지 않는다. fingerprint는 클라이언트별이 아니라 **전역**이라 한 클라이언트의 scope를 바꾸면 모든 연결이 무효가 된다(문서에 반영). 7개 scope 설정의 fingerprint가 이 변경 전 코드와 같음을 고정값으로 단언한다(변경 전 `config.ts`로 계산한 값과 일치 확인).
- **도구.** `mcp-dashboard.tools.ts`: `dashboards:read` → `vm_list_dashboards`, `vm_read_dashboard`; `dashboards:write` → `vm_preview_dashboard`, `vm_create_dashboard`, `vm_update_dashboard`, `vm_restore_dashboard`; `dashboards:delete` → `vm_get_dashboard_removal`, `vm_remove_dashboard`. 읽기·미리보기는 `structured(…, false)`(미리보기는 최대 6블록×100행이라 256KiB를 넘을 수 있어 쓰기 경로로 등록하지 않는다). annotation: 읽기·미리보기·삭제 영향 확인은 `readOnlyHint`, 생성은 비파괴·멱등, **수정·복원·삭제는 `destructiveHint:true`**, 전부 `openWorldHint:false`. 최상위 키·`confirmWrite`·`requestId`(UUID v4)·`expectedRevision`은 strict, **`changes[]`와 `blocks[].metric`은 규칙이 거부할 모양을 일부러 받아 주는 느슨한 형태**(알 수 없는 연산, FORMULA 블록, `patch.measureRefs`)라 서버가 `UNSUPPORTED_CHANGE`로 답한다. 스키마 오류가 아니라 규칙이라는 것이 에이전트에게 전달된다.
- **오류 문구(B4).** `ERRORS`와 `MCP_INSTRUCTIONS`의 보고서 전용 문구를 일반화했다(CONFLICT는 `vm_read_dashboard`와 `detail.reason`, REQUEST_REUSED는 `vm_read_dashboard`/`vm_list_dashboards`, INVALID는 사유 열거). 지침은 `dashboards:*`의 의미를 적고 "보고서·문서·소스는 생성·저장·적용·게시·삭제·수정하지 못한다"를 유지한다. 도구 설명에 미리보기 뒤 새 requestId, 자리 맞바꾸기 3번 이동, 복원 범위(표시·배치·제목·필터·블록 존재만, 옛 SQL 블록의 계산은 아님)와 댓글 앵커 분리, `baseline` 의미, `isCurrent`, `HAS_DEPENDENCIES` 처리, 복원이 `expectedSourceRevision`을 받지 않는다는 점을 적었다.
- **커밋 뒤 재검사 제거(B3).** `create`·`update`·`restore`·`remove`는 커밋 뒤 `auth.revalidate`를 부르지 않는다. 권한은 쓰기 트랜잭션 안 `beforeAccess`가 보장하고, 커밋 뒤 실패는 이미 일어난 쓰기를 "변경 없음"으로 보고하게 만든다. 재생 경로의 재검사는 남겼다.
- **이력 커서.** `read(principal, dashboardId, historyBefore?)`: 이력 요약에 `seq`를 내고 `historyNext`를 돌려준다. 조회는 계속 `dashboardId` 범위다. 쓰기 한도가 분당 20이라 20개 창을 쉽게 넘기 때문에 필요했다.
- **감사(N5).** `afterWrite` 훅 대신 `recordDashboardRevision`이 저장 트랜잭션 안에서 외부 AI의 `create/save/restore`에 대해 `dashboard.mcp-create/-update/-restore`를 쓴다(`baseline`은 제외, 조직이 없으면 생략). 삭제는 `DashboardDeletionService`의 `options.byConnection`이 `dashboard-deletion.completed` 옆에 `dashboard.mcp-remove`를 같은 트랜잭션에서 쓴다. 기존 알림 투영은 허용 목록이라 새 action이 새지 않는다.
- **모듈.** `McpRemoteModule`이 `StudioModule`·`DashboardModule`을 import하고 `McpDashboardService`를 provide한다. `StudioModule`은 `StudioCreationService`를, `DashboardModule`은 `DashboardDeletionService`를 export한다. **`StudioService`는 한 인스턴스여야 한다**(쓰기 대기열 `queued/tail`이 거기 있다): `McpRemoteModule`이 다시 provide하지 않는지 모듈 메타데이터로 검사한다(`mcp-remote.module.spec.ts`). 전체 앱 그래프를 부팅하는 DI 테스트는 시도했으나 메모리·시간이 커서 단위 테스트로 둘 수 없었다(실제 부팅은 1b-9 Docker e2e가 한다).
- **프런트.** `AI_SCOPES`·라벨·경고에 3개를 더했다(쓰기 경고: 집계 값 읽기와 이력 보존, 삭제 경고: 되돌릴 수 없음). 일반 쓰기 경고 문구는 대시보드까지 포함하도록 고쳤다. 연결 목록은 모르는 scope를 이름 그대로 보여 주어(`scopes: string[]`), 새 scope를 가진 연결도 해제할 수 있다. 동의 요청은 계속 엄격하다. 사람의 삭제·저장 화면은 409를 상태 코드로 판정하고 본문의 `data.message`를 읽으므로(`dashboardDeletionService.ts`, `DashboardDeleteDialog.tsx`, `studioApi.ts`, `dashboardPreview.ts`) 오류 코드를 붙인 본문 변경은 영향이 없다.
- **결정 기록.** (가) `assertSoleOwner`는 트랜잭션 밖에서만 확인한다: 공유는 `user_mapping` 행을 늘리지 않고 인계는 revision을 바꿔 CAS가 막으며 저장·삭제는 잠금 뒤 소유·권한을 다시 확인한다. (나) 미리보기 `blocks` 응답은 1b-4에서 만든 모양(`rowCount`, `truncated`, 최대 100행, 쿼리 문장 제외)을 확정한다. (다) 대기열 상한이 사람 저장에 주는 영향은 관찰하지 못했다(Docker e2e 항목).
- **검증.** tsc 통과(백엔드·프런트), 백엔드 관련 133개 스위트와 프런트 `AiConnections`·`api` 588건 통과. 새로 고정한 것: scope별 도구 목록 정확 일치, 도구별 annotation, 스키마 거부 시 서비스 호출 0, `UNSUPPORTED_CHANGE`가 도구를 거쳐 나옴, `HAS_DEPENDENCIES`의 `retryable:false`·종류/개수만, 오류 문구가 대시보드 도구를 가리킴, 실제 `assertGrant`가 저장 트랜잭션 안에서 철회된 연결을 막는 경로(호출 중 철회 → `UNAUTHORIZED`, 쓰기 0), 감사 이벤트, 이력 커서, 광고 scope 합집합과 fingerprint 고정값. **검증하지 못한 것:** 실제 PostgreSQL, Docker 스택에서의 실제 MCP 호출, 호스트(Claude Code 등)의 도구 이벤트, 실제 지표 버전 변경·열 삭제로 인한 `RESTORE_STALE`, 옛 대시보드·피벗 대시보드 fixture.

### 1b-7 완료 검토 반영(architect)

- **정정: 실제 `assertGrant` 증명의 범위.** 위 1b-7 노트가 말한 "실제 `assertGrant`가 저장 트랜잭션 안에서 막는 경로"는 처음에는 두 절반이 따로 증명된 상태였다: `mcp-server.spec.ts`는 `createFromSpec`을 스텁하고 테스트가 연 트랜잭션에서 훅을 불렀고, `mcp-dashboard.update.spec.ts`는 `assertGrant`를 목으로 두었다. 이제 update 스펙이 목 `assertGrant`가 받은 manager의 `queryRunner.isTransactionActive`를 기록해, 실제 Studio 저장(update)과 실제 삭제 서비스가 훅을 **쓰기 트랜잭션 안에서** 부른다는 것을 SQLite에서 확인한다. 두 증명이 이어졌다. 남은 것은 PostgreSQL의 `FOR UPDATE` 잠금 아래에서의 동작이고 1b-9 통과 조건이다(`AGENTS.md`도 잠금은 PostgreSQL에서 확인하라고 한다).
- **오류 약속과 실제의 일치.** 코드 없는 400/422는 `INVALID_INPUT`으로 바꾸고 커널의 문장은 `detail.hint`로만 준다(지침이 "대시보드는 `detail.reason`이 사유를 말한다"고 약속하므로). 속도 제한(`RATE_LIMITED`)은 시간이 지나면 풀리므로 `LIMIT` 코드를 유지하되 `retryable:true`(그 사유에 한함)로 돌려주고, LIMIT 문구에 적었다.
- **문서.** `AGENTS.md`의 "MCP 도구에는 적용·저장·삭제가 없다"와 "범위 7개 모두 등록"을 날짜와 함께 고쳤다. 배포 순서에 이전 프런트의 연결 목록 엄격 검사와 **롤백 시 클라이언트 설정에서 `dashboards:*` 제거**(이전 백엔드는 알 수 없는 scope 설정을 거부해 `/v1/mcp` 전체가 503)를 추가했다.
- **1b-8/1b-9가 처리할 것.** `scripts/docker-e2e.sh`의 `MCP_SCOPES`(7개)에 `dashboards:*`를 더하고, 목록이 다른 클라이언트 둘로 광고 합집합 동작을 시험한다. `skills/verify-vanillameta/features/mcp-collaboration.md:21`의 클라이언트 JSON, `docs/architecture/artifact-comments-collaboration.md:119`의 scope 표, `docs/testing/docker-quickstart.md:215`의 NOT_RUN 목록, **`docs/user-manual/site/mcp.md`의 scope 표(190-199행)와 "삭제·공유 회수 도구가 없다"(203행)** 를 고친다. 미리보기 결과가 256KiB를 넘으면 `LIMIT`이 나가고 `previewDigest`를 받지 못해 생성이 막힌다: 행 수를 크기에 맞춰 줄이거나 digest만 주는 대체 응답을 정한다. 삭제 경고 문구에 "전달"을 더한다(서버의 `HAS_DEPENDENCIES`에는 들어 있다). `authorize`가 클라이언트 허용 목록 밖의 scope에 `invalid_scope`를 던지는 대신 **요청 scope와 허용 목록의 교집합으로 좁히도록**(교집합이 비면 거부, RFC 6749 §3.3) 바꾸면 합집합 광고가 클라이언트별 최소 권한을 포기하지 않아도 안전해진다(후속). 삭제 감사에는 연결 이름이 남지 않는다(이력 행도 함께 지워지므로). 재생 뒤 감사 개수 단언이 없다. **PR 전에 실제 `docker compose up --build` 부팅을 한 번 본다**: 모듈 그래프가 실패하면 MCP만이 아니라 백엔드 전체가 뜨지 않는다.

### 1b-8 구현 노트(stdio 폐기)

- **제거.** `mcp-server/`(stdio 서버, 로그인 스크립트 `scripts/login.js`, 검증 스크립트, 테스트, `package*.json`, `.env.example`)와 `.github/workflows/mcp-server.yml`, `.gitignore`의 `/mcp-server` 항목, 이 서버의 스크린샷 4장(`docs/user-manual/images/29~32`)을 지웠다. `vm_propose_analysis`(서버 AI 실행)와 `vm_save_analysis`(로그인 JWT로 MCP 밖 API 호출)가 함께 없어져 상위 8절 요구 6의 통과 조건을 만족한다. 루트 `package.json`·`pnpm-workspace.yaml`·`turbo.json`은 `mcp-server`를 참조하지 않았다.
- **교체한 안내.** `README.md`(두 곳), `README_DOCKER.md`의 "MCP와 AI 키"(원격 MCP 설정, `dashboards:*` 범위, 합집합 광고, 설정 변경 시 모든 연결 해제), `AGENTS.md`의 UC056 항목(폐기 표시와 현재 문서 링크), `skills/verify-vanillameta/features/mcp-collaboration.md`(SDK 클라이언트 위치를 `backend-api/node_modules`로), 사용자 매뉴얼 `docs/user-manual/site/mcp.md`(원격 OAuth 연결, 권한·도구 표 10개 scope, 대시보드 만들기→수정→되돌리기→삭제 흐름, 오류 표). stdio 시절 설명(Node 설치, 로그인 파일, Codex/Claude 등록, 프롬프트 6단계, `VM_HTTP_*` 오류)은 모두 뺐다.
- **역사 문서.** 로컬 stdio를 다루는 계획·검증·설계 문서 9개 머리에 "2026-11-06 제거됨, 아래는 역사 기록" 안내를 붙였고(`UC-056-*`, `mcp-artifact-authoring`, `mcp-remote-authoring`, `remote-ai-oauth` 계획, `report-comments-collaboration`, `artifact-comments-collaboration`, `artifact-implementation-audit-20261029`, `ai-native-artifacts` 계획), `docker-quickstart.md`는 stdio 검증 구간 앞에 같은 안내를 붙이고 두 줄을 역사로 표시했다. 증빙을 지우거나 다시 쓰지 않았다.
- **남은 `mcp-server` 참조.** 백엔드의 `mcp-server.ts`(원격 MCP 서버 파일), 계획 문서(1b, 역사), `docs/testing/status.md`의 2026-11-02 폐기 기록뿐이다.
- **검증.** 처음에는 `grep`으로 참조가 없다고 적었으나 완료 검토가 현재형으로 stdio를 안내하는 매뉴얼 5곳(`troubleshooting`, `scope`, `feature-scenarios`, `agent-connection`, `agent-artifacts`)과 운영·상태 문서를 더 찾아 모두 고쳤고, 역사 배너를 "로컬 stdio 부분만 제거된 기록"으로 좁혔다(원격 MCP를 다루는 증빙 문서의 지위를 지키기 위해). 사용자 매뉴얼 사이트(VitePress)의 빌드는 실행하지 않았다.

### 1b-9 중 발견: 지표를 찾는 도구가 없었다

- 실제 사용 흐름을 e2e로 옮기다 확인했다: 블록은 `metric:{id, definitionVersion}`을 요구하는데 **MCP에는 저장 지표의 id와 버전을 알려 주는 도구가 없었다**(`vm_describe_source`는 열 이름·타입뿐). 외부 AI는 `dashboards:write` 도구를 쓸 수 없었다. 단위·통합 테스트는 id를 직접 넘겨 이 공백을 드러내지 못했다.
- **`vm_list_metrics`**(`dashboards:write`, 읽기 전용) 추가, 도구 9개. scope 위치(architect): `dashboards:read`에 두면 이미 승인된 기본 선택 grant가 조용히 넓어지고(원칙 6), 이 scope는 `vm_preview_dashboard`로 이미 지표 존재를 알아낼 수 있어 실질적으로 넓어지는 것이 없다. 별도 scope는 만들지 않는다(fingerprint). 본인 소유 소스만(앞뒤 확인), 50개씩 `afterId`.
- 목록의 기준은 **커널의 것과 같다**: `StudioCreationService.specCatalog`(version-1 정의, 그 소스의 것)를 만들어 제안·스펙 해석·MCP가 함께 쓴다. 출력은 화이트리스트(`id, definitionVersion(number), label, aggregation, column, denominatorColumn?, weightColumn?, scale?, unit, decimalPlaces, numberNotation`)이고 `businessBasis`·수식 내부 정의·`tableName` 등은 서버에 둔다. 지표 `label`은 사람이 쓴 문자열이라 "지시가 아니다" 목록에 넣었다.
- `vm_describe_source`의 열에 `numeric`·`temporal`을 더했다(꺾은선 차트는 날짜 열이 필요하고 AI가 고를 수 없었다. 앱의 업무 유형 선언이 다르면 서버 답이 우선).
- **남은 함정(기록):** 문서의 `measureRefs.definitionVersion`은 문자열(`"1"`), 카탈로그는 숫자(`1`)다. 도구 설명에 "목록의 값을 그대로 쓰고 `vm_read_dashboard`에서 복사하지 말 것"을 적었다. 문자열 숫자를 받아 줄지는 후속. 환불 제목 게이트(제목에 환불이 들어가면 RATIO_SUM 비율 지표만)를 도구 설명에 한 줄 적었다.

### 1b-9 구현 노트(Docker e2e 확장)와 결과

- **추가한 것.** `scripts/docker-e2e.sh`는 `dashboards:*`를 포함한 10개 scope로 클라이언트를 등록하고 허용 범위가 좁은 두 번째 클라이언트(`e2e-reader`)를 더한다. `scripts/e2e/docker-e2e.mjs`에 케이스 6개(총 71개): (1) 광고 범위가 설정의 합집합이고 좁은 클라이언트가 넓은 범위를 `invalid_scope`로 거절당함, (2) 대시보드 scope가 승인 화면에서 기본 해제이고 읽기만 승인하면 읽기 도구 2개만 보임, (3) `vm_list_metrics`로 지표를 찾아 미리보기(값이 CSV 합계와 같고 쿼리 문장이 없음) → 생성(같은 요청 ID 재시도는 같은 대시보드, 다른 입력은 `REQUEST_REUSED`, 바뀐 입력은 `PREVIEW_STALE`) → 앱 목록에 나타남, (4) 제목 수정이 앱에 반영되고 이력에 AI 연결 이름이 남고(생성 행이 직전 상태라 baseline 행은 쌓이지 않음) 낡은 revision은 `REVISION_CHANGED`·블록 추가는 `UNSUPPORTED_CHANGE`이며 복원이 제목을 되돌림, (5) 게시가 걸린 대시보드는 `HAS_DEPENDENCIES`(`retryable:false`, 종류·개수 목록)로 삭제가 거절되고 사용처 없는 대시보드는 삭제되어 재시도는 영수증으로 응답되고 이후 읽기는 거절됨, (6) 연결 해제 뒤 쓰기 도구는 401.
- **결과(실제 Docker 스택, PostgreSQL 17, colima `vm-quickstart`).** 위 케이스 6개는 **깨끗한 스택에서 통과**했다(두 번째·세 번째 실행, 그리고 첫 실행은 스택이 불안정해 앞 케이스부터 연쇄 실패해 판단에서 제외). 이 경로로 PostgreSQL에서 쓰기 트랜잭션 안의 grant 잠금·revision CAS·이력·감사·삭제가 실제로 실행됐다(동시 요청 경쟁은 시험하지 않았다). **전체는 71개 중 67개 통과(세 번째 실행, 종료 코드 1)**: 첫 실행 43/71, 둘째 60/71, 셋째 67/71로 실행마다 달랐다. 실패는 모두 이번 작업과 무관한 UI 케이스다: 클래식 위젯 마법사 4개(`sales_orders 선택` 뒤 '다음'이 넘어가지 않음, 선택 클릭을 DOM click으로 바꿔도 다음 단계 선택 요소를 찾지 못해 하네스를 되돌렸다)와 앞선 실행에서 로딩 대기·`ERR_CONNECTION_REFUSED`로 실패한 케이스들. 이전 65/65 실행(1b-3 시점) 이후 ego-browser가 0.6.2.8(chromium 156)인 점과 합성 클릭 불안정(검증 문서에 적힌 기존 한계)이 원인 후보이며 **원인은 확인하지 못했다**. 제품 변경이 위젯 마법사를 깨뜨렸는지는 검증하지 못했다(이 작업이 바꾼 코드는 위젯 경로에 닿지 않는다).
- **e2e로 하지 않은 것.** 다른 사용자의 대시보드를 MCP로 열지 못하는 것, viewer 등급의 쓰기 거부, 사람 화면 저장과 AI revision 충돌, 타인 소스의 `vm_list_metrics` 거절, 좁은 클라이언트가 자기 범위로 승인되는 양성 경로(모두 단위·통합 테스트가 한다). 호스트(Claude Code 등)의 도구 이벤트는 수동 항목이다. 사용자 매뉴얼 사이트 빌드는 실행하지 않았다.
