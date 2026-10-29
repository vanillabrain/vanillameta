# 외부 AI의 VM 연결 설정

이 연결은 외부 AI 클라이언트가 사용자가 승인한 조직의 소스 설명과 보관 문서를 읽도록 한다. AI 모델 API를 VM에 연결하는 설정이나 Google 원문 연결과 별개다.

## 서버 설정

기존 API와 같은 단일 서버에서 실행한다. 운영 설정에 다음 항목을 제공한다. 빈 설정에서는 원격 연결을 비활성화한다.

```dotenv
MCP_PUBLIC_API_URL=https://app.example.com/v1
MCP_PUBLIC_WEB_URL=https://app.example.com
MCP_OAUTH_CLIENTS_JSON='[{"id":"registered-ai","name":"등록한 AI","redirectUris":["https://ai-client.example/callback"],"scopes":["sources:read","documents:read"]}]'
```

예제 주소를 실제 서버 주소와 AI 클라이언트의 등록 callback으로 바꾼다. `CONFIG_SECRET_KEY`도 필요하다. 운영 API와 웹 주소는 HTTPS를 사용한다. 네이티브 AI 클라이언트의 callback만 명시 등록한 HTTP loopback 주소를 허용한다. callback의 scheme·host·port·path가 정확히 일치해야 한다. 임의 포트를 매번 생성하는 클라이언트는 고정 callback 설정 또는 별도 호환성 확인이 필요하다.

client ID·표시 이름·callback과 허용 scope를 운영자가 등록한다. 동적 클라이언트 등록은 제공하지 않는다. 설정 변경은 기존 grant를 무효화하므로 사용자가 다시 승인해야 한다.

## 클라이언트 연결

1. AI 클라이언트의 MCP 주소를 `https://app.example.com/v1/mcp`로 지정한다.
2. 등록한 client ID로 authorization-code flow를 시작한다. `resource`는 같은 MCP 주소다. PKCE S256과 state가 필수다.
3. 열린 VM 화면에서 로그인한다. 계정과 현재 조직을 확인한다.
4. 요청받은 두 읽기 권한 중 허용할 항목을 선택한다.
5. 연결 승인을 선택하면 등록한 callback으로 돌아간다. 취소하면 `access_denied`를 반환하며 code나 연결을 만들지 않는다.
6. AI 클라이언트가 code와 verifier를 token endpoint에 교환한다.

access token은10분 뒤 만료된다. refresh token은 발급하지 않는다. 만료 후에는 다시 연결 승인을 진행한다. VM 로그인 JWT를 외부 AI 설정에 붙여넣지 않는다. 로컬 stdio MCP 설정과 원격 OAuth 설정을 혼용하지 않는다.

## 제공하는 권한과 도구

| 권한 | 도구와 전달 내용 |
|---|---|
| `sources:read` | `vm_list_sources`, `vm_describe_source`. 승인 조직의 현재 읽기 허용 소스 이름과 열 이름·타입. 원본 행·접속정보는 제외한다. 미지원 소스는 명시 표시한다. |
| `documents:read` | `vm_list_documents`, `vm_read_document`. 본인의 비공개 보관 문서 목록과 명시한 고정 버전 본문. 본문은12,000 Unicode 문자씩 반환한다. |

각 호출은 현재 계정·조직·원본 접근권과 연결 grant를 다시 확인한다. 승인 후 새 권한이 생겼다고 해서 승인하지 않은 scope가 추가되지는 않는다. 문서의 내용은 AI에게 전달되므로 해당 클라이언트의 데이터 처리 정책도 확인한다.

생성·수정·저장·게시·공유 도구는 이 원격 연결에 제공하지 않는다. 문서 읽기로 Google 갱신이나 AI 요약을 자동 실행하지 않는다. gpt-6-luna 모델 설정은 바꾸지 않는다.

## 연결 해제

아티팩트 목록의 **외부 AI 연결**에서 연결과 권한을 확인한다. **연결 해제**를 누르고 확인하면 기존 token과 교환 전 code의 후속 사용을 거절한다. 확인 창에서 취소하거나 Escape를 누르면 연결을 유지한다. 이미 AI 클라이언트가 받은 내용은 소급 회수하지 못한다. VM 원본·보관 문서·Google 연결은 유지한다.

## 운영 확인

공개 metadata 경로 `/.well-known/oauth-protected-resource/v1/mcp`와 `/.well-known/oauth-authorization-server/v1/mcp-oauth`를 API로 전달해야 한다. 저장소의 nginx 구성은 이 경로를 전달한다. 프록시가 원래 Host를 유지해야 하며 임의 Host/Origin을 허용하지 않는다.

신규 마이그레이션은 pending 요청·grant·code hash·token hash를 저장한다. 운영 DB 적용 전에 기존 마이그레이션·백업 절차를 따른다. 실제 공개 URL, AI 제품별 callback/등록 호환성, 운영 nginx 경유는 [검증 기록](../testing/remote-ai-oauth.md)의 확정 범위와 구분한다.
