# 대시보드·차트 댓글과 MCP 협업 계획

상태: 확정(2026-11-03, architect 검토 반영). 1조각은 웹 댓글, 2조각은 원격 MCP다.

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
- 영수증 `operation`은 `dashboard.*`로 따로 둔다. 같은 requestId를 보고서와 대시보드에 쓰면 409다.
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
- 댓글 도구는 기존 인자를 유지하고 `target`(`report` 기본, `dashboard`)을 더한다. 대시보드 쓰기는 `dashboards:read`와 `comments:write`가 모두 필요하다. `vm_read_dashboard`의 revision을 받아 다르면 CONFLICT다. 트랜잭션 안에서 `assertGrant`를 다시 확인한다.
- 범위를 더하면 클라이언트 fingerprint가 바뀌어 기존 연결이 끊긴다. 운영 공지가 필요하다.
- 필수 테스트: 다른 조직 대시보드 403·목록 제외, 다중 매핑·무조직·governed 제외, 삭제·비활성 거부, 확인과 쓰기 사이 grant 회수, 범위 조합, 종류 교차 스레드 404, requestId 교차 409, AI 열린 스레드 상한, 도구 설명의 신뢰할 수 없는 내용 안내, 공개·익명 경로 비노출.

## 검증

- 1조각: 단위(권한·위치·changed·한도·idempotency·삭제 정리), migration(SQLite·PostgreSQL 17), 실제 브라우저에서 소유자와 정책 읽기 권한자가 차트 댓글 → 소유자가 차트 수정 → `changed` 표시 → 해결, 대시보드 삭제 후 행 정리, 390/768/1440·키보드 포커스.
- 2조각: 위 MCP 필수 테스트와 실제 Claude Code 호스트에서 `vm_read_dashboard` 후 차트 댓글.
