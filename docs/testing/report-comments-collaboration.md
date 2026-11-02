# 보고서 댓글·제안·MCP 협업 검증

2026-11-02. 설계는 [아티팩트 댓글·제안·MCP 협업](../architecture/artifact-comments-collaboration.md), 원격 연결 설정은 [운영 설정](../operations/remote-ai-oauth.md)을 따른다.

## 목적

- 공유받은 사람과 소유자가 보고서 전체, 이미지, 본문 텍스트 범위에 댓글과 수정 제안을 남기는 흐름을 실제로 확인한다.
- 제안 적용이 소유자의 편집 화면에서만, 저장과 원자적으로 표시되는지 확인한다.
- Claude가 백엔드 OAuth 원격 MCP(`/v1/mcp`)로 읽기·댓글·제안·공유를 하되 적용·저장·삭제는 못 하는지 확인한다.

## 환경

- 백엔드: `NODE_ENV=local` SQLite 메타데이터, Node 26, watch 없는 `nest start`. AI 제공자 설정은 `gpt-6-luna` 그대로 두었고 이번 흐름은 서버 AI를 호출하지 않는다.
- MCP: `MCP_PUBLIC_API_URL=http://127.0.0.1:4000/v1`, `MCP_PUBLIC_WEB_URL=http://127.0.0.1:3000`, loopback callback `http://127.0.0.1:4599/callback`을 등록한 검증용 클라이언트 `vm-qa-claude`.
- 웹: Vite dev. 브라우저: Ego(Lite).
- 소유자와 수신자는 origin을 나눠 동시에 로그인했다(`127.0.0.1`, `localhost`). 수신자 `qacomment`는 가입 → 조직 등록 → 소유자 조직 추가로 만들었다.
- MCP 클라이언트: `mcp-server/node_modules/@modelcontextprotocol/client`의 SDK. 실제 OAuth 승인(Ego 동의 화면 → callback → 토큰 교환)을 거쳤다.
- 증빙 폴더(저장소 밖): `/Users/moonklabs/workspace-vanilla/phase2-evidence/collab-comments-20261102/`. 토큰·이메일·비밀번호는 증빙에 없다.

## 시나리오

기능 PASS는 동작과 서버 상태를 확인한 것이고, 디자인 PASS는 390/768/1440에서 가로 넘침과 배치를 확인한 것이다. 두 항목은 따로 센다.

| ID | 시나리오 | 기능 | 디자인 | 증빙 |
| --- | --- | --- | --- | --- |
| RCOL-01 | 수신자 설정과 v2 공유 | PASS | - | `setup-recipient.json` |
| RCOL-02 | 수신자 읽기 화면 3폭(패널 우측 360px, 768/390은 쌓임, `scrollWidth == clientWidth`) | PASS | PASS | `recipient-read-{390,768,1440}.png` |
| RCOL-03 | 소유자 읽기·편집 화면 3폭 | PASS | PASS | `owner-read-*.png`, `owner-editor-*.png` |
| RCOL-04 | 수신자 본문 범위 댓글 생성과 수정 제안(v2) | PASS | PASS(1440) | `recipient-thread-created-1440.png`, `recipient-suggestion-1440.png` |
| RCOL-05 | 소유자 적용 → 취소 → 재적용 → 비공개 저장 r3. 제안 applied(base 2 → applied 3), 스레드 resolved | PASS | PASS(1440) | `owner-editor-applied-1440.png`, `owner-editor-saved-1440.png`, `apply-roundtrip.json` |
| RCOL-06 | 위치 재계산: 소유자 헤드에서는 detached, 수신자 고정 v2에서는 exact 위치 유지 | PASS | - | `apply-roundtrip.json` |
| RCOL-07 | MCP 동의 화면: 쓰기 범위 기본 해제, 공유 경고 표시 | PASS | PASS(1440) | `mcp-consent-1440.png` |
| RCOL-08 | 실제 OAuth: 동의 → callback → 토큰(scope 5개, 599초) | PASS | - | `mcp-real-run.json` |
| RCOL-09 | `tools/list` 8개, 적용·저장·삭제 도구 없음 | PASS | - | `mcp-real-run.json` |
| RCOL-10 | `vm_list_reports`, `vm_read_report`(v3, utf16) | PASS | - | `mcp-real-run.json` |
| RCOL-11 | `vm_add_comment`(작성자 ai · 클라이언트 이름), 같은 `requestId` 재전송은 replayed | PASS | - | `mcp-real-run.json` |
| RCOL-12 | `vm_propose_report_edit`(open, base 3). `confirmWrite` 누락은 SDK 입력 검증 오류로 거부되고 스레드 수가 늘지 않음 | PASS | - | `mcp-real-run.json` |
| RCOL-13 | `vm_list_comments`, `vm_list_report_shares` | PASS | - | `mcp-real-run.json` |
| RCOL-14 | `vm_share_report`로 `qacomment`에 공유(2 → 3 고정, sharedBy ai). 재전송은 replayed | PASS | - | `mcp-real-run.json` |
| RCOL-15 | 로그인 JWT로 `/v1/mcp`는 401(`WWW-Authenticate`), MCP 토큰으로 `/v1/reports/library`는 401 | PASS | - | `mcp-real-run.json` |
| RCOL-16 | 소유자가 Claude 제안을 보고 적용·저장 r4, 공유 목록에 "Claude가 공유함 · 클라이언트 이름" | PASS | PASS(1440) | `owner-editor-ai-suggestion-1440.png`, `owner-share-list-ai-1440.png` |
| RCOL-17 | Studio 정리: H1 하나, 툴바 32px 테두리 통일(이동한 "비공개 보고서 작성" 포함) | PASS | PASS(1440) | `studio-after-1440.png` |
| RCOL-22 | 최종 검토 후 수정: Claude 텍스트 댓글·제안(r4) → 소유자 r5 저장 → 같은 `requestId` 재전송은 replayed·같은 결과 ID, 입력 변경은 CONFLICT, 중복 없음 | PASS | - | `mcp-replay-after-save.json` |
| RCOL-18 | 실제 Claude Code 2.1.316 호스트: 임시 프로젝트 local 범위 등록(`--client-id`, `--callback-port 4598`) → `claude mcp login`(가상 터미널) → Ego 승인(읽기 4개 기본 체크, 쓰기 중 댓글·제안만 허용) → `claude -p`가 목록·본문 읽기, 범위 46–60 댓글과 삭제 제안 작성, 공유는 도구 없음으로 거절, 적용·저장은 불가로 거절 → 소유자가 "Claude · Claude Code (로컬 검증)" 제안을 적용해 r6 저장. 검증 후 logout·local 등록 제거 | PASS | PASS(1440) | `claude-code-consent-1440.png`, `claude-code-run.jsonl`, `claude-code-suggestion-editor-1440.png` |
| RCOL-23 | claude.ai 커넥터(원격 공개 HTTPS 필요) | NOT_RUN | NOT_RUN | - |
| RCOL-19 | 실제 포인터 드래그로 본문 선택 → 댓글 | NOT_RUN | NOT_RUN | - |
| RCOL-20 | PostgreSQL 운영 업그레이드 경로(`migrate-prod`) | NOT_RUN | - | - |
| RCOL-21 | access token 만료 후 재연결 흐름(refresh 없음) | NOT_RUN | - | - |

## 자동 테스트

- 백엔드 jest(Node 26, in-band, `MCP_OAUTH_HTTP_TESTS=1`, `src/mcp-oauth`·`src/reports`·route-inventory·module-wiring·metadata-postgres-schema): 14/14 묶음, 215 통과, 1 건너뜀(PostgreSQL 전용 parity).
- 실제 PostgreSQL 17.11: 댓글 서비스·마이그레이션·공유 spec 32/32. 마이그레이션을 두 번 올려 엔티티와 차이가 없었다.
- nest build 통과. `mcp-server` `node --test` 17/17.
- 프런트 vitest(Reports·AiConnections·Dashboard·Documents·Artifacts·components·api): 2,279 통과, 14 실패.
  - `Dashboard/index.test.tsx` 12개는 `fe71c5ea`에서 같은 이름으로 실패하는 기존 실패다.
  - `SourceDetails.test.tsx` 2개는 동시 부하 중 5초 시간 초과였고 단독 재실행은 통과했다.
- 프런트 `tsc --noEmit`, 변경 파일 37개 eslint 통과.
- `route-inventory.spec.ts`의 익명 허용 목록에 9개 경로를 추가했다. 모두 `fe71c5ea`에 이미 열려 있던 경로(`/mcp`, `/mcp-oauth/*`, `.well-known`, `/artifacts/shared/:token`)를 각자의 보호 장치와 함께 목록화한 것이며 새로 노출한 경로가 아니다.

## 자동화 기록

Ego Lite는 동작 사이에 페이지 visibility를 전환한다. 보고서 보호 장치가 이를 감지해 선택과 작성 중인 입력을 지운다. 의도한 보안 동작이다. 그래서 선택 → 댓글은 한 번의 페이지 내 시퀀스(`Range` 생성, `mouseup`, 요소 `click`)로 구동했다. 실제 포인터 드래그가 아니다(RCOL-19).

OAuth callback 수신기는 같은 경로로 들어오는 `favicon.ico` 요청에 기록이 덮어써졌다. code는 브라우저 탭 주소에서 다시 읽었다.

## 알려진 공백

- Claude Code는 실제로 검증했다(RCOL-18). claude.ai 커넥터는 공개 HTTPS 주소가 필요해 실행하지 않았다.
- Claude Code는 서버가 광고한 범위 7개를 모두 요청한다. 운영 클라이언트 허용 범위에 하나라도 빠지면 `invalid_scope`로 연결이 실패한다. 범위 축소는 승인 화면에서 사용자가 한다.
- Claude가 UTF-16 오프셋을 직접 계산하려고 셸을 사용했다. 인용문으로 범위를 지정하는 도구 입력을 추가하면 호스트 도구 의존이 줄어든다(개선 후보).
- 문장 삭제 제안은 앞의 빈 줄을 남긴다. Claude 스스로 지적했으며, 편집자가 적용 후 정리한다.
- access token은 10분이고 refresh가 없다. 협업 도중 만료되면 다시 연결해야 한다. 호스트 검증에서 문제가 되면 grant에 묶인 회전형 refresh를 올린다.
- 실제 포인터 드래그 선택은 자동화하지 못했다.
- 여러 수신자 공유는 원자적이지 않다. 일부만 공유되면 `complete: false`를 돌려주고 같은 `requestId`로 재시도해 마저 공유한다.
- 같은 `requestId`에 다른 수신자 목록을 보내면 409가 아니라 추가 수신자만 공유된다. 매번 `confirmShare`가 필요하지만 설계와 다르다.
- 수신자는 자신이 낸 제안의 `appliedVersion`을 본다. 소유자가 몇 번째 저장본에 반영했는지가 드러난다.
- PostgreSQL 운영 업그레이드 경로(`migrate-prod`)는 실행하지 않았다. 신규 스키마와 마이그레이션 재실행만 확인했다.
- 기존 `report-delivery-transfer.ts`의 따옴표 없는 camelCase 원시 SQL은 PostgreSQL에서 실패할 가능성이 있다(이번 변경 밖, 별도 확인 필요).
