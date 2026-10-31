# MCP 원격 제작(HTTP) 구현과 검증

2026-10-31. 기준 브랜치 `develop`. 이번 단위는 같은 6개 도구를 원격 HTTP로 제공하고, 저장 승인 경계가 원격에서도 유지되는지 확인하는 작업이다.

## 데이터 형태

- 전송: 공식 MCP SDK의 `createMcpHandler`가 돌려주는 Streamable HTTP 핸들러를 `POST /mcp`에 연결했다. 세션을 두지 않고 요청마다 서버 인스턴스를 만든다.
- 인증: 요청의 `Authorization: Bearer <user token>`을 그대로 `VmApi`에 넘긴다. 서버는 토큰을 저장하지 않고, `VM_ACCESS_TOKEN`도 읽지 않는다.
- 도구: stdio와 같은 6개(`vm_list_sources`, `vm_describe_source`, `vm_propose_analysis`, `vm_get_proposal`, `vm_save_analysis`, `vm_get_artifact`). 게시·공유·SQL·파일 도구는 없다.
- 승인: `vm_save_analysis`는 여전히 `confirmSave: z.literal(true)`를 요구한다. 누락하면 스키마 검증에서 거부되고 API를 호출하지 않는다.
- 공개 경로는 `GET /health` 하나뿐이다. `/mcp`가 아니면 404, POST가 아니면 405, 토큰이 없거나 형식이 틀리면 401과 `WWW-Authenticate: Bearer`를 준다.
- 기본 바인딩은 `127.0.0.1:8787`이고 본문 상한은 1MiB다.

## VERIFIED

| Check | Result | Evidence |
| --- | --- | --- |
| 인증 경계 | 토큰 없는 `/mcp`는 401과 Bearer challenge, 다른 경로는 404, GET은 405, `/health`는 200 | `test/http.test.js` |
| initialize·tools/list | 세션 없이 초기화되고 6개 도구 이름이 정확히 반환 | 같은 파일 |
| 사용자 토큰 전달 | `vm_list_sources` 호출에서 API 요청 헤더가 `Bearer private.jwt.token`이고 결과가 projection을 거쳐 반환 | 같은 파일 |
| 저장 승인 | `confirmSave` 없는 `vm_save_analysis`는 오류로 끝나고 API 호출 0회 | 같은 파일 |
| 설정 실패 | 잘못된 API URL이면 503으로 닫히고 응답에 토큰 문자열이 없음 | 같은 파일 |
| 회귀 | `mcp-server` 전체 22 PASS(기존 stdio·API·projection 포함), 새 HTTP 5 PASS | `npm test` |

stdio 쪽은 실제 MCP 클라이언트 SDK로 자식 프로세스를 띄워 initialize와 도구 6개 발견까지 확인하는 기존 테스트가 계속 통과한다(`test/stdio.test.js`). 이는 프로토콜 수준 확인이며 Codex 호스트 실행 증빙은 아니다.

## BLOCKED

- HTTP 서버를 실제 포트에 바인딩하는 확인. 이 세션 샌드박스가 `listen`에 EPERM을 반환한다(`127.0.0.1:3000`, `0.0.0.0:4000`에서 확인). 그래서 `index-http.js`는 문법과 핸들러 수준까지만 검증했고, 실제 소켓·TLS·프록시 경유는 미확인이다.
- 실제 Codex 호스트에서 `vm_propose_analysis` → `vm_save_analysis`를 실행하는 여정. 실행에는 API·DuckDB 소스·Codex AI가 필요하고, 기존 `scripts/verify-codex-host.js`가 그 증빙을 만든다.
- 실제 사용자 JWT로의 왕복. 테스트는 토큰 전달을 모의 fetch로 확인했다.
- OAuth authorization-server discovery. 클라이언트는 이미 발급된 VanillaMeta 토큰을 가져야 한다.

## 다음 확인

1. QA supervisor를 띄운 환경에서 `npm --prefix mcp-server run start:http`를 실행하고 `curl /health`와 `POST /mcp` initialize를 확인한다.
2. `node mcp-server/scripts/verify-codex-host.js <owned-evidence>`로 실제 호스트의 미리보기·별도 승인 저장·DB 0→1과 API 재조회를 확인한다.
3. 같은 토큰으로 저장을 두 번 보내 같은 `requestId`가 replay로 처리되고 새 행이 생기지 않는지 확인한다.
4. 토큰 없이/만료 토큰으로 401이 유지되는지 실제 소켓에서 확인한다.

