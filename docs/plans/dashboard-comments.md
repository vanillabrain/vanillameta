# 대시보드·차트 댓글과 MCP 협업 계획

상태: 1조각(웹)·2조각(원격 MCP) 구현 완료(2026-11-04, 검증 [DCOM-09](../testing/dashboard-comments.md)). 1조각은 웹 댓글, 2조각은 원격 MCP다.

## 목표

사용자는 대시보드 전체나 차트 하나를 골라 댓글을 단다. Claude·Codex 같은 외부 AI도 원격 MCP로 대시보드를 읽고 차트에 댓글을 단다. 편집자는 댓글을 보고 차트를 고친 뒤 스레드를 해결한다. 보고서 댓글([설계](../architecture/artifact-comments-collaboration.md))과 같은 테이블을 쓴다. AI는 댓글만 쓰고 변경은 사람이 한다.

## 현재 구조에서 확인한 사실

- `dashboard.id`는 정수다. 정수 편집 버전이 없다. `dashboardRevision()`(`backend-api/src/dashboard/dashboard-revision.ts`)은 저장하지 않는 SHA-256 값이다.
- `analysisDefinition`이 있는 대시보드는 `widgets[].blockId`가 저장되고 순서·크기가 바뀌어도 따라간다(`ai/dashboard-blocks.ts`의 `storedBlockIds`, `blockGeometry`). `legacy-*` ID도 한 번 저장되면 같다.
- `analysisDefinition` 없이 `DashboardWidget`만 쓰는 대시보드는 읽을 때 위치로 `legacy-<id>-<i>`를 만든다. 위젯을 지우거나 더하면 다른 차트를 가리킬 수 있다.
- 대시보드는 행을 실제로 지운다(`dashboard/dashboard-deletion.service.ts`). 인수인계 경로도 있다(`bundle-handover.service.ts`).
- 차트 정의(BI 편집기 `editorState`)는 소유자만 고친다. 정책 edit 권한자는 배치만 바꾼다.
- governed 대시보드의 조직 보기 사용자는 `SourceAccessService.dashboard(id, viewer, 'read')`를 통과하지 못한다(조직 소유자 기준으로 확인).

## 1조각 범위(웹)

- 앵커는 `whole`과 `block`이다. `block`은 `blockId`와 생성 시 차트 제목·종류 스냅샷을 저장한다. `block`은 `analysisDefinition`이 있는 대시보드에서만 허용한다. 나머지는 `whole`만 허용한다.
- 위치는 `exact | detached` 두 가지다. 현재 정의에 `blockId`가 있으면 exact, 없으면 detached다. 제목·종류가 스냅샷과 다르면 `changed: true`로 따로 표시한다. `legacy-*` ID는 제목·종류가 다르면 다른 차트일 수 있으므로 detached로 둔다.
- 수정 제안은 두지 않는다.
- governed 대시보드, 공개 게시 화면, 익명 공유 화면에는 댓글이 없다.
- 카드 배지(스레드 수)는 2조각 이후다. 1조각은 카드의 댓글 버튼과 오른쪽 패널이다.

## 데이터

- 스레드 행: `artifactKind='dashboard'`, `artifactId=String(dashboard.id)`, `version=0` 고정.
- migration으로 `artifact_comment_thread`에 nullable `artifactRevision varchar(64)`를 더한다. 대시보드 스레드는 생성 시 `dashboardRevision`을 저장한다. 블록 스냅샷은 `anchorQuote`(제목)·`anchorPrefix`(종류, 32자 안)를 재사용하지 말고 명확한 열이 필요하면 같은 migration에서 nullable `anchorLabel text`·`anchorType varchar(32)`로 더한다.
- 대시보드 삭제와 인수인계는 같은 트랜잭션에서 그 대시보드의 영수증 → 댓글 → 스레드 순으로 지운다. 영수증은 FK가 없어 스레드·댓글 ID 서브쿼리로 찾으므로 먼저 지우고, 댓글→스레드 FK가 RESTRICT라 댓글을 스레드보다 먼저 지운다.
- 영수증 `operation`은 `dashboard.*`로 따로 둔다. 같은 requestId를 보고서와 대시보드에 쓰면 operation이 달라 `REQUEST_REUSED`(409)다.
- 한도는 보고서 값을 대시보드 단위로 적용한다.

## 권한

- 읽기: `dashboard(id, actor, 'read')`. 댓글 작성과 자기가 시작한 스레드 보기.
- 관리: `dashboard(id, actor, 'edit')`(소유자 포함). 모든 스레드 보기, 해결·재개. 차트 정의를 실제로 고치는 사람은 소유자뿐이다.
- 위험: 그룹 권한으로 함께 보는 사람들은 서로의 스레드를 보지 못한다. "구성원 공개 스레드" 옵션이 곧 필요할 수 있다.

## REST(1조각)

보고서 댓글 응답 모양을 따른다. 경로는 `/dashboards/:id/comments`다.

- `GET /dashboards/:id/comments` → `{ revision, canManage, blockAnchors: boolean, blocks: [{ blockId, title, type }], threads: [...] }`. 스레드는 보고서 스레드 뷰에 `anchor`(`{kind:'whole'}` 또는 `{kind:'block', blockId, title, type}`), `location`(`exact|detached`), `changed`를 둔다.
- `POST /dashboards/:id/comments` `{ requestId, revision, anchor, body }`. `revision`이 현재 값과 다르면 409로 다시 읽게 한다.
- `POST /dashboards/:id/comments/:threadId/replies` `{ requestId, body }`.
- `POST /dashboards/:id/comments/:threadId/status` `{ requestId, status, expectedStatusVersion }`.
- 다른 종류의 스레드 ID는 404다(`artifactKind` 필터).

## 구현 방식

- `DashboardCommentService`를 새로 만든다. 보고서 서비스는 일반화하지 않는다. 한도·충돌 판정·영수증 같은 순수 함수만 같이 쓴다. kind 레지스트리는 만들지 않는다.
- 화면은 스레드 목록·답글·해결·작성자 배지·위치 라벨을 표시 전용 공용 컴포넌트로 뽑아 보고서와 같이 쓴다. 앵커 생성, 제안 UI, 데이터 불러오기는 각 화면에 둔다.

## 2조각(원격 MCP)

- 새 범위 `dashboards:read`. 도구 `vm_list_dashboards`, `vm_read_dashboard`(제목, revision, 블록: `blockId`·종류·제목·측정값/필터 요약). 저장된 `analysisDefinition`을 직접 읽고 `legacyBlockIds`를 붙인다. `analysis()`·`preview()`는 SQL을 실행하므로 쓰지 않는다. SQL 원문과 데이터 값은 주지 않는다.
- 조직 경계: 대시보드 조직은 `UserMapping`이 정확히 1개인 소유자의 `EnterpriseMembership.organizationId`다. 매핑이 여럿이거나 소유자 조직이 없거나 governed면 제외한다. `delYn`·비활성 대시보드는 목록·읽기·쓰기 모두 같은 결과로 거부한다.
- (2026-11-04 설계에서 대체) 댓글 도구는 대시보드 전용 이름으로 나눈다. 아래 "2조각 설계"를 따른다. 대시보드 쓰기는 `dashboards:read`와 `comments:write`가 모두 필요하다. `vm_read_dashboard`의 revision을 받아 다르면 CONFLICT다. 트랜잭션 안에서 `assertGrant`를 다시 확인한다.
- 범위를 더하면 클라이언트 fingerprint가 바뀌어 기존 연결이 끊긴다. 운영 공지가 필요하다.
- 필수 테스트: 다른 조직 대시보드 403·목록 제외, 다중 매핑·무조직·governed 제외, 삭제·비활성 거부, 확인과 쓰기 사이 grant 회수, 범위 조합, 종류 교차 스레드 404, requestId 교차 409, AI 열린 스레드 상한, 도구 설명의 신뢰할 수 없는 내용 안내, 공개·익명 경로 비노출.

## 검증

- 1조각: 단위(권한·위치·changed·한도·idempotency·삭제 정리), migration(SQLite·PostgreSQL 17), 실제 브라우저에서 소유자와 정책 읽기 권한자가 차트 댓글 → 소유자가 차트 수정 → `changed` 표시 → 해결, 대시보드 삭제 후 행 정리, 390/768/1440·키보드 포커스.
- 2조각: 위 MCP 필수 테스트와 실제 Claude Code 호스트에서 `vm_read_dashboard` 후 차트 댓글.

## 2조각 제품 결정 (2026-11-04 사용자 확인)

1. `vm_list_dashboards` 범위는 웹 목록과 같다. 내 대시보드와 그룹·정책 권한으로 읽을 수 있는 대시보드 중 grant 조직과 같은 것만. governed·삭제·비활성은 뺀다.
2. `vm_read_dashboard`는 구조만 준다. 차트별 `blockId`·제목·설명·종류·측정값 열(`valueField`)·구분 열(`categoryField`)과 대시보드 제목·설명·revision. SQL 원문과 데이터 값은 주지 않고 쿼리를 실행하지 않는다.
3. 승인 화면에서 `dashboards:read`는 다른 읽기 범위처럼 기본 체크한다.
4. 보관함으로 옮긴 대시보드도 목록에 넣고 `archived: true`로 표시한다. 보관은 사용자별 목록 정리일 뿐 접근 권한이 아니다.

## 2조각 설계 (2026-11-04)

- 범위: `dashboards:read`를 backend `mcpScopeSchema`와 frontend `scopeSchema`·라벨(ko·en)에 더한다. 이름이 `:read`로 끝나므로 승인 화면 기본 체크와 읽기 묶음은 기존 규칙으로 정해진다.
- 도구는 `target` 인자 대신 대시보드 전용 이름으로 나눈다. 보고서 도구의 `reportId`·`version`·텍스트 앵커와 대시보드의 정수 `dashboardId`·`revision`·블록 앵커가 달라, 하나의 입력 스키마에 합치면 필수값과 검증이 흐려진다. 기존 보고서 도구 입력은 바꾸지 않는다.
  - `dashboards:read`: `vm_list_dashboards { after? }`(id 커서, 50개), `vm_read_dashboard { dashboardId }`.
  - `dashboards:read` + `comments:read`: `vm_list_dashboard_comments { dashboardId, threadOffset }`(보고서와 같은 바이트 페이지).
  - `dashboards:read` + `comments:write`: `vm_add_dashboard_comment { dashboardId, revision, anchor: whole | {kind:'block', blockId}, body, requestId, confirmWrite }`, `vm_reply_dashboard_comment { dashboardId, threadId, body, requestId, confirmWrite }`. 해결·재개 도구는 두지 않는다.
- 조직 경계: 대시보드 조직(소유자 조직)은 `UserMapping`이 정확히 1개인 소유자의 `EnterpriseMembership.organizationId`. 매핑이 0개·여러 개이거나 소유자 조직이 없거나 grant 조직과 다르면 목록에서 빼고 읽기·쓰기는 같은 403(FORBIDDEN)이며 detail을 주지 않는다. 영수증 키의 조직은 행위자 조직(`catalogActorContext`)으로 따로 둔다. MCP 경로에서는 `assertGrant`(행위자 조직 = grant 조직)와 아래 확인(소유자 조직 = grant 조직)으로 셋이 같다.
- `DashboardCommentService`에 `CommentWriteOptions`(`beforeAccess`, `ai`, `expectedOrganizationId`)를 더한다. `write()`는 트랜잭션 → `beforeAccess`(grant 재확인만) → 대시보드 잠금·접근 → 잠근 행 기준 소유자 조직 = `expectedOrganizationId` 확인 → 영수증 → 쓰기 순서다. 조직 확인을 잠금 아래에 두어 인수인계와 경합해도 다른 조직 대시보드에 쓰지 않는다. `list()`도 `expectedOrganizationId`를 받아 같은 트랜잭션에서 확인한다.
- `ai`가 있으면 `perform`에 `author`(`authorKind`·`aiGrantId`·`aiClientName`)를 넘겨 스레드·댓글에 기록하고 영수증 해시에 포함한다. AI가 연 열린 스레드는 보고서와 같은 상한(`openAiThreadsPerReport`)을 대시보드 단위로 적용한다. 웹 경로는 바뀌지 않는다.
- 대시보드에는 `replay()`가 필요 없다. 쓰기 전 앵커 해석이 없고 revision 검사는 영수증이 없을 때만 `perform` 안에서 하므로, revision이 바뀐 뒤 같은 requestId 재시도는 이전 결과를 돌려준다.
- grant 확인: 쓰기 도구는 `assertGrant`가 범위 배열을 받아 `dashboards:read`와 `comments:write`를 함께 확인한다. 읽기 도구는 보고서와 같이 도구 실행 앞뒤의 `revalidate`에 맡긴다.
- 새 `McpDashboardService`(mcp-oauth)가 목록·읽기·댓글을 맡는다.
- 목록(`McpReadService.sources()` 모양): id 후보는 내 매핑과 `readableDashboardIds`의 합집합. SQL에서 `id > after`, `delYn <> 'Y'`, `assetActive`, `governed = false`, 매핑이 정확히 1개인 소유자의 membership 조직 = grant 조직으로 거르고 `ORDER BY id`, 51개를 읽는다. 그 뒤 행마다 `dashboard(id, actor, 'read')`를 부르고 거부되면 건너뛴다. `nextCursor`는 마지막으로 검사한 id라서 걸러져 빈 페이지에도 다음 커서가 있을 수 있다(도구 설명에 적음). 출력은 허용 목록 `{ dashboardId, title, updatedAt, archived }`만.
- 읽기 허용 목록: 대시보드 `dashboardId`·`title`·`description`(= `analysisDefinition.explanation`)·`revision`·`blockAnchors`, 블록(`validateDraft` → `legacyBlockIds`) `blockId`·`title`·`description`·`type`·`valueField`·`categoryField`. `sql`, `businessBasis`(SQL 조각을 담음), `defaultDateColumn`, `databaseId`, 표시 서식 필드, `structuredDefinition`·`pivotDefinitions`·`layout`·위젯 테이블은 읽거나 내보내지 않는다. 정의가 없는 대시보드는 `blocks: []`, `blockAnchors: false`이며 전체 댓글만 가능하다. 제목·설명은 신뢰할 수 없는 내용으로 표시한다.
- 공용 MCP 문구: `MCP_INSTRUCTIONS`, 오류 안내(FORBIDDEN·NOT_FOUND·CONFLICT·REQUEST_REUSED), `UNTRUSTED`를 보고서 전용이 아닌 문구로 바꾸고 대시보드 다시 읽기(`vm_read_dashboard`·`vm_list_dashboard_comments`)를 안내한다.
- 오류: 대시보드 `REVISION_CONFLICT`(409)는 CONFLICT다.
- 추가 필수 테스트: 조직 확인과 잠금 사이 인수인계 경합, AI 열린 스레드 상한과 AI 출처 기록, 웹과 MCP 같은 requestId는 REQUEST_REUSED, revision 변경 뒤 같은 requestId 재시도는 이전 결과, 걸러진 빈 페이지의 커서, 출력 허용 목록 스냅샷(sql·businessBasis·shareId 없음), legacy 대시보드 블록 앵커 INVALID, 손상된 정의, 없음·다른 조직·비활성·governed가 같은 FORBIDDEN, 범위별 도구 노출과 트랜잭션 안 범위 회수 UNAUTHORIZED, 프론트 범위 라벨과 기본 체크.
- 운영: 기존 클라이언트 설정(`MCP_OAUTH_CLIENTS_JSON`)에 `dashboards:read`를 더하면 설정 fingerprint가 바뀌어 기존 연결이 끊긴다. 배포 노트에 재연결 안내를 적는다. 설정을 바꾸지 않은 클라이언트는 새 도구가 보이지 않을 뿐 그대로 동작한다.
