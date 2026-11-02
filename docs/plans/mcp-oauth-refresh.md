# 원격 MCP OAuth: grant에 묶인 회전형 refresh token

2026-11-02. 구현 계약이다. [원격 OAuth 계획](remote-ai-oauth.md)의 후속 항목이다. [협업 검증](../testing/report-comments-collaboration.md) RCOL-21과 [협업 설계](../architecture/artifact-comments-collaboration.md) "남은 위험"을 닫는다. architect 검토(2026-11-02)의 필수 변경 7건을 반영했다.

## 문제와 결론

access token은 10분 뒤 만료되고 refresh가 없었다. 그래서 실제 Claude Code 협업 세션은 10분마다 브라우저 재동의가 필요했다. 다음과 같이 해결한다.

- authorization code 교환과 refresh 모두 **새 access token 1개와 새 refresh token 1개**를 발급한다.
- refresh token은 사용할 때마다 회전한다. 재사용을 감지하면 **grant 전체를 회수**한다.
- grant의 8시간 상한은 그대로다. refresh는 grant를 연장하지 않는다. access token 10분도 그대로다.
- 매 refresh마다 `checkedGrant`를 다시 실행한다. 따라서 연결 해제·회수·계정 비활성·epoch·조직·fingerprint 변경이 refresh도 즉시 막는다.

## 클라이언트 근거

### Claude Code 2.1.316

설치된 CLI 바이너리 문자열에서 MCP OAuth provider와 SDK `refreshAuthorization` 코드를 확인했다.

- 요청: `POST token_endpoint`, form. 본문은 `grant_type=refresh_token`, `refresh_token`, `resource=<서버 URL href>`이고 auth method가 `none`이면 `client_id`가 붙는다. `scope`는 보내지 않는다.
- 응답 처리: `{refresh_token: <이전 값>, ...응답}`으로 병합한다. 응답에 `refresh_token`이 없으면 이전 값을 계속 쓰고, 다음 refresh가 재사용 감지에 걸린다. 따라서 **응답에 새 refresh token을 반드시 넣는다.**
- 시점: 남은 수명이 300초 이하일 때 다음 MCP 요청에서 선제 갱신한다. 프로세스 안에서는 promise를 공유하고, 프로세스 사이에서는 `mcp-refresh-<name>.lock` 파일 잠금(stale 60초)을 쓴다.
- 실패: `_doRefresh`는 최대 3회 시도한다. `invalid_grant`면 다른 프로세스가 저장한 새 토큰을 찾고, 없으면 **토큰을 지우고** 재인증한다. 따라서 일시 장애(설정 없음·DB·잠금 timeout)는 `invalid_grant`가 아니라 5xx로 응답해야 한다.

### Codex CLI 0.154.0

설치된 바이너리(`@openai/codex-darwin-arm64`)의 문자열에서 `rmcp-3.2.0/src/transport/auth.rs`, `oauth2-5.0.0`, Codex 자체 `rmcp-client/src/oauth/refresh_transaction.rs`·`refresh_lock.rs`를 확인했다. 사용자 설정은 건드리지 않았다.

- `oauth2` 5.0.0의 `exchange_refresh_token`은 `grant_type`, `refresh_token`을 보내고, secret 없는 client는 `client_id`를 본문에 넣는다. `scope`는 명시적으로 추가할 때만 보낸다. `redirect_uri`는 보내지 않는다.
- `resource` 문자열이 rmcp의 "refresh token present, attempting refresh" 문자열 옆에 있다. refresh에도 `resource`를 붙이는 것으로 보이지만 확정하지 못했다. **가정: `resource`는 있을 수도 없을 수도 있다.**
- Codex도 프로세스 간 refresh 잠금을 쓴다.

### 본문 schema 결정

- 필수: `grant_type=refresh_token`, `refresh_token`(64-hex 형식이 아니면 `invalid_grant`), `client_id`.
- 선택: `resource`(있으면 `config.resource`와 같아야 한다. 아니면 `invalid_request`), `scope`(아래), `redirect_uri`(**허용하고 무시한다.** 무해하고 일부 MCP client 버전이 보낸다).
- 그 밖의 키(`code`, `code_verifier` 등)와 배열 값(중복 키)은 `invalid_request`다.

## 데이터 모양

새 entity `McpOAuthRefresh`는 기존 `mcp-oauth.entities.ts`의 `MCP_OAUTH_ENTITIES`에 추가한다. `data-source.ts`·`mcp-oauth.module.ts`·spec에 함께 반영된다. code는 grant당 1개이고 단회 사용이므로 **refresh 체인 = grant**다. `grantId`를 family로 쓴다.

테이블 `mcp_oauth_refresh`(열 순서는 entity와 migration이 같다):

| 열 | 타입(PG / SQLite) | 의미 |
|---|---|---|
| `tokenHash` | `varchar(64)` PK | SHA-256 hex. 원문은 저장하지 않는다 |
| `grantId` | `varchar(36)`, `IDX_mcp_oauth_refresh_grant` | family |
| `clientId` | `varchar(255)` | 발급 client |
| `resource` | `text` | 발급 시 `config.resource` |
| `accessHash` | `varchar(64)` | 함께 발급한 access token hash. 후속이 `superseded`가 되면 이 access 행을 지운다 |
| `rotation` | `integer` | code 발급분 0, 이후 부모 +1 |
| `parentHash` | `varchar(64)` NULL | 직전 refresh. code 발급분은 NULL |
| `replacedByHash` | `varchar(64)` NULL | 현재 후속 refresh |
| `state` | `varchar(12)` default `'active'` | `active` \| `rotated` \| `superseded` |
| `issuedAt` | `timestamp` / `datetime` | |
| `expiresAt` | `timestamp` / `datetime` | 발급 시점의 `grant.expiresAt` |
| `usedAt` | `timestamp` / `datetime` NULL | **첫** 회전 시각. 다시 쓰지 않는다 |
| `retriedAt` | `timestamp` / `datetime` NULL | 유예 재회전 시각. 부모당 1회 |

- 시각 열은 기존 OAuth entity처럼 env 분기를 쓴다(PG·운영 `timestamp`, `test`/`local` SQLite `datetime`). PG `timestamp without time zone`에는 Node 프로세스의 지역 시각이 저장된다. 그래서 30초 유예는 모든 API 인스턴스가 같은 `TZ`(DST 없음)일 때만 정확하다. 어긋나면 결과는 회수와 재동의이고 보안 구멍은 아니다.
- grant당 `active`는 최대 1개다. grant 행 잠금 아래에서 코드로 강제하고 spec으로 검증한다. 부분 unique index는 쓰지 않는다.
- `mcp_oauth_token`은 바꾸지 않는다. scope 축소가 없으므로 `scopes` 열을 두지 않는다.
- 회수 사유 열과 연결 목록의 `lastRefreshedAt`은 두지 않는다. 재사용은 로그로 남긴다.

PG migration `backend-api/src/migrations/postgres/1793570000000-add-mcp-oauth-refresh.ts`의 `AddMcpOAuthRefresh1793570000000`:
- `1793560000000-add-artifact-comments.ts`처럼 QueryRunner `Table`/`TableIndex` API를 쓴다. raw SQL은 쓰지 않는다(쓰게 되면 식별자를 따옴표로 감싼다).
- `hasTable('mcp_oauth_refresh')` guard 안에서 테이블과 index를 만든다. 새 PG bootstrap은 entity를 먼저 동기화하고 migration을 fake로 기록하므로, 업그레이드와 새 bootstrap의 `pg_dump --schema-only`가 같아야 한다.
- `down`은 artifact comments처럼 백업 계획 없이 되돌리지 않는다(throw).
- `data-source.ts`는 `migrations/postgres/`를 자동으로 읽는다. `app.module.ts`의 PG 배열(`AddArtifactComments1793560000000` 다음)에는 직접 추가한다. 레거시 SQLite/MySQL migration은 만들지 않는다.

## 프로토콜

기존 `POST /v1/mcp-oauth/token`(form 전용, `requireForm`)을 그대로 쓴다. 본문은 `grant_type`으로 분기한다.

- `authorization_code`: 기존 그대로 라이브러리(PKCE)를 쓴다. `generateRefreshToken`이 `randomSecret()`을 반환하고, `saveToken`이 같은 트랜잭션에서 access와 `rotation=0` refresh를 넣는다. `server()`에 `refreshTokenLifetime: 28800`을 명시하지만 실제 만료는 `grant.expiresAt`이다.
- `refresh_token`: **라이브러리를 거치지 않고 서비스가 직접 처리한다.** `@node-oauth/oauth2-server` 5.3.1의 refresh grant는 조회·회수·저장을 별도 model 호출로 나눠 원자적이지 않고, 회수를 commit하면서 오류를 반환하는 흐름과 맞지 않는다.
- scope: 생략하면 grant scope 전체다. 값이 있으면 공백으로 나눈 비어 있지 않고 중복 없는 집합이어야 하고 grant scope의 부분집합이어야 한다. 아니면 `invalid_scope`다. **축소하지 않는다.** 항상 grant scope 전체로 발급하고 응답에 `scope`를 넣는다(RFC 6749 §5.1: 요청과 다르면 `scope`를 반환한다).
- 응답(200, `Cache-Control: no-store`): `{access_token, token_type: "Bearer", expires_in, refresh_token, scope}`. 두 grant type 모두 같다.
- 수명: access는 `expires_in = min(600, grant 남은 초)`. refresh `expiresAt = grant.expiresAt`이다. 회전해도 grant를 연장하지 않는다. 8시간이 지나면 재동의한다. grant 마지막 5분에는 access 수명이 300초 이하라 Claude가 요청마다 refresh한다. 회전 상한이 이를 막는다.
- 오류: 형식 오류·`resource` 불일치는 `invalid_request`, 등록되지 않은 `client_id`는 `invalid_client`, scope 확대는 `invalid_scope`다. 모르는 토큰·만료·client 불일치·grant 무효·재사용·회전 상한·fingerprint 변경은 모두 `invalid_grant`이고 같은 본문(`Request rejected.`)을 쓴다.
- metadata: `grant_types_supported: ['authorization_code','refresh_token']`. `McpOAuthService.authorizationMetadata()`와 `mcp.controller.ts`의 `.well-known` 응답이 `config.ts`의 같은 상수를 쓴다.
- `/revoke`: `token_type_hint`와 무관하게 access와 refresh 두 테이블을 모두 조회한다(RFC 7009 §2.1). 어느 쪽이든 grant 전체를 회수한다. `lockSourceActor`를 쓰지 않는 현재 잠금 패턴을 유지해 비활성 계정도 회수할 수 있다.

## 회전 트랜잭션

등록된 `client_id`와 요청 `resource`는 DB 전에 확인한다. 그 뒤 refresh 1회는 `sourceWriteTransaction` 하나다. 잠금 순서는 기존 규칙인 grant → user다.

1. `tokenHash`로 refresh 행을 읽는다(잠금 없음). 없으면 `invalid_grant`.
2. `checkedGrant(manager, row.grantId, config, lock=true)`로 grant를 잠그고 무효·만료·resource·fingerprint·client·scope allowlist·사용자·authVersion·조직을 다시 검사한다.
3. `lockSourceActor(grant.actorId, grant.authVersion)`.
4. **검증(쓰기 전).** 행을 다시 읽는다(같은 grant의 회전은 2의 잠금으로 직렬화된다). 다음이면 회수 없이 거절한다.
   - `invalid_grant`: 요청 `client_id`·`row.clientId`·`grant.clientId` 불일치, `row.resource ≠ config.resource`, `row.expiresAt` 경과, `row.rotation ≥ 300`(회전 상한).
   - `invalid_scope`: 요청 scope가 grant scope의 부분집합이 아님.
5. 분기
   - `active`: 회전한다. 조건부 update(`WHERE state='active'`, affected 1 확인)로 `state=rotated`, `usedAt=now`, `replacedByHash`를 쓴다. 새 access 1개와 새 refresh(`rotation+1`, `parentHash`, `accessHash`)를 insert한다.
   - `rotated`이고 아래를 **모두** 만족하면 **유예 재회전**이다.
     - `0 ≤ now − usedAt < 30초`. 음수(시계·timezone 차이)는 유예가 아니라 재사용이다.
     - `retriedAt IS NULL`. 부모당 1회만 허용하고, 부모 행에 기록하며 grant 잠금 아래에서 확인한다.
     - 후속(`replacedByHash`)이 존재하고 `active`다(아직 쓰이지 않았다).
     처리: 후속을 `superseded`로 바꾸고 후속의 `accessHash` access 행을 지운다. 부모에 `retriedAt=now`, 새 `replacedByHash`를 쓴다. **`usedAt`은 바꾸지 않는다.** 새 쌍을 발급한다. `warn` 로그를 재사용과 같은 필드로 남긴다.
   - 그 밖(`superseded`, 유예 밖 `rotated`, 두 번째 재시도, 후속이 이미 쓰인 `rotated`): **재사용이다.** `grant.revoked=true`로 바꾸는 결과를 반환해 **commit한 다음** 바깥에서 `invalid_grant`를 던진다. 트랜잭션 안에서 throw하면 회수가 rollback되기 때문이다.
6. 발급 분기는 commit 직전에 `this.config(config.fingerprint)`를 다시 확인한다. 기존 `saveToken`과 같다. 재사용 분기는 이 확인을 하지 않는다. 회수는 안전한 방향이고, 확인이 실패하면 회수가 rollback되기 때문이다.

### 유예가 덮는 것과 덮지 않는 것

- 덮는 것: 응답이 유실된 뒤의 1회 재시도, timeout과 겹친 동시 요청 1건. 원문을 저장하지 않으므로 같은 응답 재전송(진짜 멱등)은 불가능하고 새 쌍을 준다.
- 덮지 않는 것: 30초 뒤의 재시도, 같은 부모의 두 번째 재시도, 후속이 이미 쓰인 뒤의 재시도, 두 client가 각자 응답을 받은 뒤 이전 쌍으로 다시 refresh하는 경우. 모두 재사용으로 grant를 회수한다.
- 비용: 유예 재회전은 이미 발급된 후속 access token을 즉시 무효화한다. 그 토큰을 받은 쪽은 401을 받고 refresh가 재사용으로 판정되어 재동의가 필요하다. 오늘의 10분 재동의와 같은 결과이며 Claude·Codex 모두 프로세스 간 잠금을 써서 드물다.
- 공격자가 탈취한 이전 refresh를 유예 안에 쓰면 정상 후속이 `superseded`가 되고, 정상 client의 다음 refresh가 재사용으로 grant를 회수한다. 감지는 늦어질 뿐 사라지지 않는다. 유예는 부모당 1회라 반복 악용할 수 없다.

## 오류 매핑(수동 refresh 경로)

Claude는 `invalid_grant`에서 토큰을 지운다. 그래서 일시 장애를 `invalid_grant`로 보내지 않는다.

- `invalid_grant`: `checkedGrant`·`lockSourceActor`의 `UnauthorizedException`/`ForbiddenException`, `this.config(fingerprint)` 불일치(`ForbiddenException`), 위 4·5의 자체 grant 상태 검사.
- 그대로 전달: `OAuth2Server.OAuthError`(`invalid_request`·`invalid_client`·`invalid_scope`).
- 5xx `temporarily_unavailable`: 설정 없음(`ServiceUnavailableException`), DB 오류, 잠금 timeout, 조건부 update의 예상 밖 affected 수. 그 밖의 모든 예외는 `ServiceUnavailableException`으로 바꾸고 `error` 로그에 예외 class 이름과 PG 오류 코드만 남긴다(메시지·bind parameter에는 hash가 있으므로 남기지 않는다).

## 보안

- 연결 해제(`disconnect`)와 `/revoke`는 grant만 회수한다. refresh는 매번 `checkedGrant`를 거치므로 함께 죽는다.
- 토큰 원문과 hash는 로그·오류·연결 목록에 남기지 않는다. 재사용과 유예 재회전은 `warn`으로 `grantId`·`clientId`·`actorId`·`rotation`만 기록한다.
- rate limit: token endpoint는 전역 IP ThrottlerGuard(기본 120/60초) 아래에 있다. 회전 상한 300은 grant당 행 증가를 제한한다.
- **만료 행 정리는 이번 변경에서 제외한다.** 기존 `mcp_oauth_token`도 정리가 없다. refresh 행은 grant당 최대 약 600개(회전 300 × 부모당 재시도 1)이고 활성 grant는 actor당 20개다. 정상 Claude 주기(약 5분)로는 8시간 grant당 refresh·access 각 약 96행이다. 정리는 후속 항목이며, 할 때는 commit 뒤 grant 잠금 밖에서 직렬화하고 테이블당 500행 이하로 지운다.
- 연결 목록 문구(`aiConnections.tokenLifetime`, ko/en): "접근 토큰은 10분이고 자동 갱신된다. 연결은 재동의 없이 최대 8시간 유지된다. 이미 쓰인 갱신 토큰이 다시 쓰이면 연결이 해제된다"로 고친다. 그 밖의 UI 변경은 없다.

## access TTL 설정

Claude는 남은 시간이 300초 이하일 때만 갱신한다. 비운영에서 짧게 보기 위해 `MCP_OAUTH_ACCESS_TTL_SECONDS`를 둔다.

- `NODE_ENV==='prod'`이면 무시하고 600을 쓴다. 또 `production-guard`가 prod에서 이 값이 설정되어 있으면 부팅을 거부한다.
- 그 밖에서는 0 이상 정수를 [60, 600]으로 clamp한다. 그 밖의 값(음수·소수·문자)은 600이다. config fingerprint에는 넣지 않는다.
- `accessTokenLifetime`, code 교환 `saveToken`, refresh 세 곳에 같은 값을 쓴다.

## 테스트 계획

단위·spec(`mcp-oauth.service.spec.ts`, 실제 SQLite):
- code 교환 응답 키가 5개이고 DB에는 hash만 있다. 기존 "refresh 거절" 검사는 모르는 refresh token → `invalid_grant`로 바꾼다.
- 201행 테스트는 레거시 OAuth 테이블 4개만 지우고 다시 만든다. `mcp_oauth_refresh`는 `synchronize`로 남고 `mcp_oauth_token`은 바뀌지 않으므로 `db.synchronize()`가 필요 없다.
- 회전, 재사용 회수(기존 access 401), 유예 1회와 후속 access 삭제, 두 번째 재시도 회수, 미래 `usedAt` 회수, 31초 회수, 만료·grant 경계, 잘못된 client·resource, scope 상위집합 `invalid_scope`, authVersion·조직·fingerprint → `invalid_grant`, 설정 없음 → 503, 동시 refresh, disconnect·`/revoke`(refresh token), 회전 상한 300, 잠금 순서, metadata 두 경로.
- `MCP_OAUTH_HTTP_TESTS=1` 실제 HTTP: code → access+refresh → refresh → 새 쌍으로 MCP 인증 → 이전 refresh 재사용 400 `invalid_grant` → 새 access도 401. JSON 본문·query 문자열은 `invalid_request`.
- PG 17: 7759bd02 bootstrap에서 업그레이드 1회 적용, 재실행 no-op, `createSchemaBuilder().log()` 차이 0, 새 bootstrap과 `pg_dump --schema-only` 동일.

실제 Claude Code(비운영, `MCP_OAUTH_ACCESS_TTL_SECONDS=360`)로 재동의 없이 갱신되는지 확인하는 단계는 실제 호스트에서 따로 한다. 절차: 등록·승인 → 61초 뒤 도구 호출에서 `Token refresh successful`, 브라우저 없음 → 별도 프로세스 2개 동시 호출에도 회수 없음 → VM에서 연결 해제 뒤 재인증 요구.

## 롤아웃과 운영

- 배포는 fingerprint를 바꾸지 않는다. 기존 grant는 유효하지만 refresh 행이 없어 만료 때 한 번 재동의한다. 그 뒤부터 refresh를 받는다.
- 긴급 중단은 `MCP_OAUTH_CLIENTS_JSON` 변경(전체 무효) 또는 개별 연결 해제다. 별도 kill switch는 두지 않는다.
- 운영 PG는 백업 후 migration을 적용한다. `app.module.ts` PG 배열 등록을 리뷰 항목으로 둔다.

## 미결정

- 유예 30초의 적정값. 실제 로그로 확인한 뒤 조정한다.
- 재사용 회수를 연결 목록에 따로 표시할지. 이번에는 로그로만 남긴다.
- 만료 행 정리(위 보안 절).
- authorization code 재사용 시 그 code로 발급한 grant 회수(RFC 6749 §4.1.2 SHOULD). 이제 code 하나가 8시간 refresh 체인이 되므로 후속 항목으로 둔다.
