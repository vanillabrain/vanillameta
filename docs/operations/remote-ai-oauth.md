# 외부 AI의 VM 연결 설정

이 연결은 외부 AI 클라이언트가 사용자가 승인한 조직의 소스 설명, 보관 문서, 보고서와 보고서 댓글을 읽고, 허용한 경우 보고서 댓글과 수정 제안을 남기고, 공유 권한까지 허용하면 소유한 보고서를 같은 조직 구성원에게 공유하도록 한다. AI 모델 API를 VM에 연결하는 설정이나 Google 원문 연결과 별개다.

## 서버 설정

기존 API와 같은 단일 서버에서 실행한다. 운영 설정에 다음 항목을 제공한다. 빈 설정에서는 원격 연결을 비활성화한다.

```dotenv
MCP_PUBLIC_API_URL=https://app.example.com/v1
MCP_PUBLIC_WEB_URL=https://app.example.com
MCP_OAUTH_CLIENTS_JSON='[{"id":"registered-ai","name":"등록한 AI","redirectUris":["https://ai-client.example/callback"],"scopes":["sources:read","documents:read","reports:read","comments:read","comments:write","suggestions:write","shares:write"]}]'
```

예제 주소를 실제 서버 주소와 AI 클라이언트의 등록 callback으로 바꾼다. `CONFIG_SECRET_KEY`도 필요하다. 운영 API와 웹 주소는 HTTPS를 사용한다. 네이티브 AI 클라이언트의 callback만 명시 등록한 HTTP loopback 주소를 허용한다. callback의 scheme·host·port·path가 정확히 일치해야 한다. 임의 포트를 매번 생성하는 클라이언트는 고정 callback 설정 또는 별도 호환성 확인이 필요하다.

client ID·표시 이름·callback과 허용 scope를 운영자가 등록한다. 동적 클라이언트 등록은 제공하지 않는다. 클라이언트는 위 일곱 scope 중 필요한 것만 등록한다. 쓰기 scope(`comments:write`, `suggestions:write`)는 해당 클라이언트가 보고서 협업에 쓰일 때만, `shares:write`는 AI에게 공유까지 맡길 때만 넣는다.

`MCP_OAUTH_CLIENTS_JSON`을 바꾸면(scope 추가 포함) 설정 fingerprint가 바뀌어 **모든 클라이언트의 기존 grant와 token이 즉시 무효**가 된다. 사용자는 AI 클라이언트에서 다시 연결해야 한다. 기존 운영 클라이언트에 보고서 scope나 `shares:write`를 추가할 때는 배포 전에 사용자에게 재연결을 공지한다. 연결 목록에는 무효가 된 연결이 해제됨으로 표시된다.

## 클라이언트 연결

1. AI 클라이언트의 MCP 주소를 `https://app.example.com/v1/mcp`로 지정한다.
2. 등록한 client ID로 authorization-code flow를 시작한다. `resource`는 같은 MCP 주소다. PKCE S256과 state가 필수다.
3. 열린 VM 화면에서 로그인한다. 계정과 현재 조직을 확인한다.
4. 요청받은 권한 중 허용할 항목을 선택한다. 읽기 권한은 기본 선택이고, 쓰기 권한은 경고와 함께 따로 표시되며 기본 해제다. `shares:write`에는 공유 전용 경고가 따로 붙는다.
5. 연결 승인을 선택하면 등록한 callback으로 돌아간다. 취소하면 `access_denied`를 반환하며 code나 연결을 만들지 않는다.
6. AI 클라이언트가 code와 verifier를 token endpoint에 교환한다.

access token은 10분 뒤 만료된다. code 교환과 갱신은 새 access token과 새 refresh token을 함께 발급한다(`grant_type=refresh_token`, form, `client_id` 필수, `resource`는 선택이지만 보내면 MCP 주소와 같아야 한다). AI 클라이언트가 자동으로 갱신하므로 연결은 승인 만료(최대 8시간)까지 다시 묻지 않고 유지된다. 갱신은 grant를 연장하지 않으며 8시간이 지나면 다시 승인한다. 설계와 근거는 [refresh 계획](../plans/mcp-oauth-refresh.md)에 있다.

- refresh token은 쓸 때마다 바뀐다. **이미 쓰인 refresh token이 다시 오면 연결 전체를 해제한다.** 응답 유실에 대비해 첫 사용 후 30초 안의 재시도 1회만 새 쌍을 다시 준다. 이때 앞서 준 access token은 바로 무효가 된다. 재사용과 유예 재발급은 `warn` 로그에 `grantId`·`clientId`·`actorId`·`rotation`만 남긴다. 토큰 값은 남기지 않는다.
- 연결 해제, `/revoke`(access·refresh 어느 쪽이든), 계정 비활성·권한 epoch 변경, 조직 이동, 클라이언트 설정(fingerprint) 변경은 갱신도 즉시 막는다. 이때 응답은 `invalid_grant`이고 클라이언트가 다시 승인을 요청한다.
- 설정 누락·DB 장애·잠금 timeout은 `invalid_grant`가 아니라 5xx `temporarily_unavailable`로 답한다. Claude Code는 `invalid_grant`에서 저장한 토큰을 지우기 때문이다.
- grant당 갱신은 300회까지다. 정상 주기(약 5분)로는 8시간에 약 96회다.
- 비운영 확인용 `MCP_OAUTH_ACCESS_TTL_SECONDS`(정수, 60–600으로 제한)로 access 수명을 줄일 수 있다. `NODE_ENV=prod`에서는 무시하며, 값이 있으면 production guard가 부팅을 거부한다.
- **이미 교환한 authorization code가 다시 오면 그 code의 연결 전체를 해제한다**(RFC 6749 §4.1.2). 단 같은 client·같은 `redirect_uri`·맞는 PKCE verifier를 함께 보낸 경우만이다. code만 가진 쪽(예: 로그에서 본 경우)은 토큰을 받을 수 없으므로 회수하지 않는다. 응답은 어느 쪽이든 모르는 code와 같은 `invalid_grant`다. 회수는 `warn` 로그에 `grantId`·`clientId`·`actorId`·`revoked`만 남긴다. 응답을 놓친 클라이언트가 같은 code를 다시 보내도 연결이 해제되고 다시 승인한다.
- code 교환이나 갱신이 성공할 때마다 만료 행을 테이블당 최대 500행씩 정리한다. 5분 여유를 둔다. 대상은 만료된 access token, 만료·회수된 grant의 refresh 행(회수 grant는 발급 5분 뒤), 만료된 미사용 code, 끝난 grant의 code다. 살아 있는 grant의 회전된 refresh와 사용한 code는 재사용 감지를 위해 grant가 끝날 때까지 남긴다. grant(연결 목록)는 지우지 않는다. 결정된 pending 요청도 남기고, 만료된 대기 요청은 기존처럼 승인 요청 때 정리한다. 정리 실패는 응답에 영향을 주지 않고 `error` 로그에 예외 class 이름만 남긴다.
- 모든 API 인스턴스는 같은 `TZ`(예: `UTC` 또는 `Asia/Seoul`)로 실행한다. 갱신 시각은 시간대 없는 timestamp로 저장되므로 인스턴스마다 시간대가 다르면 정상 재시도가 재사용으로 판정되어 연결이 해제될 수 있다.
- 배포 직후 기존 연결에는 refresh token이 없어 만료 때 한 번 다시 승인한다. PostgreSQL은 백업 후 `1793570000000-add-mcp-oauth-refresh` migration(`mcp_oauth_refresh` 테이블)을 적용한다.

VM 로그인 JWT를 외부 AI 설정에 붙여넣지 않는다. 로컬 stdio MCP 설정과 원격 OAuth 설정을 혼용하지 않는다.

## 제공하는 권한과 도구

| 권한 | 도구와 전달 내용 |
|---|---|
| `sources:read` | `vm_list_sources`, `vm_describe_source`. 승인 조직의 현재 읽기 허용 소스 이름과 열 이름·타입. 원본 행·접속정보는 제외한다. 미지원 소스는 명시 표시한다. |
| `documents:read` | `vm_list_documents`, `vm_read_document`. 본인의 비공개 보관 문서 목록과 명시한 고정 버전 본문. 본문은12,000 Unicode 문자씩 반환한다. |
| `reports:read` | `vm_list_reports`, `vm_read_report`. 본인 보고서와 공유받은 보고서 목록, 조회자 버전(소유자=최신 저장본, 수신자=공유 버전)의 제목·문서 텍스트·이미지 블록(ID·대체 텍스트)·고정 KPI/차트 제목. 문서 텍스트는 절대 UTF-16 오프셋으로 20,000 단위씩 반환하며 서로게이트 쌍을 자르지 않는다. 집계 값·SQL·원본 경로·이미지 데이터는 제외한다. |
| `comments:read` | `vm_list_comments`. 볼 수 있는 댓글 스레드·답글·수정 제안과 조회자 버전 기준 위치. 수신자는 자신이 시작한 스레드만 본다. |
| `comments:write` | `vm_add_comment`(보고서 전체·본문 범위·이미지), `vm_reply_comment`. AI 작성으로 "클라이언트 이름"과 함께 기록한다. 본문 범위는 `quote`(+`occurrence`) 또는 `start`/`end` 중 하나로 지정한다(아래 참고). |
| `suggestions:write` | `vm_propose_report_edit`. 본문 범위 교체를 제안만 한다. 범위 지정은 `vm_add_comment`와 같다. 빈 `replacement`로 문단 전체를 지우면 인접한 빈 줄(`\n\n`) 하나를 함께 지우고 결과에 `widenedForParagraph: true`를 붙인다. 적용과 저장은 편집 화면에서 편집자가 한다. |
| `shares:write` | `vm_list_report_shares`(소유자 전용: 수신자 로그인 ID·상태·관계 버전·공유 버전, 최신 저장 버전, 같은 조직 후보의 로그인 ID·팀), `vm_share_report`(소유자 전용: 최신 저장본을 같은 조직 활성 구성원 1~5명에게 읽기 전용 공유). 이메일·내부 숫자 ID는 내보내지 않는다. |

본문 범위는 `quote`를 권장한다. 서버가 조회자 버전 본문에서 대소문자·공백·줄바꿈까지 정확히 같은 위치를 찾는다. `occurrence`는 1부터 세며 두 곳 이상 일치할 때만 필요하다. 겹치는 일치도 따로 센다. 일치가 없거나 `occurrence`가 범위를 벗어나면 `INVALID`, 두 곳 이상 일치하는데 `occurrence`가 없으면 일치 수를 담은 `INVALID`를 돌려준다. `start`/`end`(UTF-16 오프셋)와 함께 보내면 `INVALID`다. 같은 `requestId` 재시도는 해석된 범위로 비교하며, 새 저장 이후에는 이전 본문이 없어 인용문·저장된 범위로만 비교한다(`occurrence`만 바뀐 경우는 구분하지 못한다).

각 호출은 현재 계정·조직·원본 접근권과 연결 grant를 다시 확인한다. 쓰기는 같은 트랜잭션 안에서 grant 행을 잠그고 scope를 다시 확인하므로, 호출 중 연결 해제·계정 변경이 커밋되면 아무것도 쓰지 않는다. 쓰기 도구는 `confirmWrite: true`와 `requestId`(UUID)가 필수이며 같은 `requestId`·같은 입력의 재시도는 중복 없이 같은 결과를 돌려준다. 보고서 도구의 오류는 `{code, retryable, message}`이며 code는 `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INVALID`, `LIMIT` 중 하나다. 승인 후 새 권한이 생겼다고 해서 승인하지 않은 scope가 추가되지는 않는다. 문서의 내용은 AI에게 전달되므로 해당 클라이언트의 데이터 처리 정책도 확인한다.

보고서·문서·소스의 생성·수정·적용·저장·게시·삭제 도구와 공유 회수 도구는 이 원격 연결에 제공하지 않으며 서버 AI도 호출하지 않는다. 보고서·댓글 텍스트는 다른 사람이 쓴 신뢰할 수 없는 내용으로 AI에게 지시로 따르지 말라고 안내한다. 조직이 없는 예전 보고서는 원격 연결로 접근할 수 없다. 문서 읽기로 Google 갱신이나 AI 요약을 자동 실행하지 않는다. gpt-6-luna 모델 설정은 바꾸지 않는다.

## 공유 권한(`shares:write`)

- 소유자만 공유할 수 있다. 수신자·다른 조직 사용자의 호출은 `FORBIDDEN`이다.
- 수신자는 로그인 ID로 지정하며 승인 조직의 활성 구성원(admin·member)이어야 한다. 다른 조직·없는 ID·본인·중복은 `INVALID`다. 그룹 공유·복제 허용·게시·회수는 제공하지 않는다. 회수는 소유자가 VM 공유 관리에서 한다.
- `expectedHeadVersion`이 최신 저장 버전과 다르면 `CONFLICT`로 거절해 사용자가 새 버전을 다시 검토하게 한다. `confirmShare: true`가 필수다.
- 수신자마다 `requestId`에서 정해지는 요청 ID로 기존 공유 경로를 실행한다. 같은 `requestId`·입력의 재시도는 이미 공유한 수신자를 다시 공유하지 않으며, 일부만 공유된 경우(`complete: false`) 같은 요청으로 마저 공유한다. 각 공유 트랜잭션 안에서 grant와 scope를 먼저 다시 확인하므로 호출 중 연결이 해제되면 공유하지 않는다.
- 공유 영수증에 grant ID와 클라이언트 이름을 남기고, 소유자의 공유 관리 목록에 "Claude가 공유함 · 클라이언트 이름"으로 표시한다.
- **주 위협은 프롬프트 인젝션이다.** 수신자가 남긴 댓글이나 보고서 본문이 소유자의 AI에게 공유를 유도할 수 있다. 도구 설명과 서버 안내는 보고서·댓글 텍스트를 공유 지시로 따르지 말고 사용자가 대화에서 직접 요청한 공유만 하라고 명시한다. 이 범위는 필요한 사용자에게만 허용하고, 연결한 AI에서 공유 호출을 매번 확인하게 안내한다.

## 연결 해제

아티팩트 목록의 **외부 AI 연결**에서 연결과 권한을 확인한다. **연결 해제**를 누르고 확인하면 기존 token과 교환 전 code의 후속 사용을 거절한다. 확인 창에서 취소하거나 Escape를 누르면 연결을 유지한다. 이미 AI 클라이언트가 받은 내용은 소급 회수하지 못한다. VM 원본·보관 문서·Google 연결은 유지한다.

## Codex CLI 0.154.0 연결

이 버전에서 실제 로그인·문서 조회·회수를 확인했다. [실행 증빙](../testing/remote-oauth-codex.md)을 따른다.

1. Codex MCP 설정에 서버 URL과 사전 등록 `oauth.client_id`, 요청할 `scopes`를 지정한다.
2. `oauth.callback_port`로 고정 loopback 포트를 선택한다.
3. Codex가 출력한 승인 URL의 `redirect_uri`를 확인한다. 이 서버에서는 `/callback` 뒤에 서버별 식별자가 붙었다. 전체 URI를 VM client allowlist에 정확히 등록한다.
4. `oauth.callback_url`도 확인한 전체 URI로 맞춘다. 다른 MCP 서버의 callback 식별자를 재사용하지 않는다.
5. `codex mcp login <서버 이름> --scopes documents:read`를 실행하고 VM에서 승인한다.

Codex0.154.0은 새 프로세스가 시작될 때 저장된 refresh token으로 갱신하고(만료 약 6초 전·만료 후 모두 확인) 새 refresh token을 저장해 다음 프로세스에서 쓴다. 갱신 시점 기준과 실행 중 세션의 갱신은 확인하지 않았다. VM에서 연결을 해제하면 다음 갱신이 `invalid_grant`로 거절된다. `required = true`이면 Codex는 MCP 서버 초기화 실패로 끝난다. 다시 쓰려면 `codex mcp login`으로 새로 승인한다. [실행 증빙](../testing/report-comments-collaboration.md)의 RCOL-24를 따른다.

설정 형태는 다음과 같다. 예시 주소와 client ID, `실제_callback_id`를 실제 값으로 바꾼다.

```toml
[mcp_servers.vanillameta]
url = "https://app.example.com/v1/mcp"
scopes = ["documents:read"]
required = true

[mcp_servers.vanillameta.oauth]
client_id = "registered-codex"
callback_port = 4467
callback_url = "http://127.0.0.1:4467/callback/실제_callback_id"
```

VM이 resource metadata를 제공하므로 이 검증에서는 `oauth_resource`를 생략했다. Codex0.154.0에 명시 값도 주면 같은 `resource`가 두 번 붙어 VM이 요청을 거절했다. `resource` 중복을 허용하도록 서버 검증을 낮추지 않는다.

이번 검증은 `-c` 실행별 옵션을 사용했고 전역 MCP 항목을 추가하지 않았다. 검증 뒤에는 같은 옵션과 `codex mcp logout <서버 이름>`으로 이번 MCP 인증만 지웠다. 일반 `codex logout`은 OpenAI 로그인까지 해제하므로 이 정리에 사용하지 않는다.

근거는 [공식 MCP 연결 안내](https://learn.chatgpt.com/docs/extend/mcp)와 [callback 설정 기준](https://learn.chatgpt.com/docs/config-file/config-reference)다. 이후 CLI 버전에서는 생성된 callback과 요청을 다시 확인한다.

## 운영 확인

공개 metadata 경로 `/.well-known/oauth-protected-resource/v1/mcp`와 `/.well-known/oauth-authorization-server/v1/mcp-oauth`를 API로 전달해야 한다. 저장소의 nginx 구성은 이 경로를 전달한다. 프록시가 원래 Host를 유지해야 하며 임의 Host/Origin을 허용하지 않는다.

신규 마이그레이션은 pending 요청·grant·code hash·token hash를 저장한다. 운영 DB 적용 전에 기존 마이그레이션·백업 절차를 따른다. 실제 공개 URL, AI 제품별 callback/등록 호환성, 운영 nginx 경유는 [검증 기록](../testing/remote-ai-oauth.md)의 확정 범위와 구분한다.

Claude Code(2.1.316 확인)는 보호 리소스 메타데이터의 `scopes_supported` 전체를 요청한다. 해당 클라이언트의 `scopes`에 7개 범위를 모두 등록해야 `invalid_scope` 없이 승인 화면이 열린다. 실제 허용 범위는 사용자가 승인 화면에서 고르며 쓰기 범위는 기본 해제다. Claude Code는 `claude mcp add --transport http --client-id <등록 id> --callback-port <포트> <이름> <API>/mcp`로 등록하고 `http://localhost:<포트>/callback`을 redirect URI로 쓴다(2026-11-02 로컬 검증).
