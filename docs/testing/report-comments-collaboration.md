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
| RCOL-19 | 실제 마우스 드래그(`mouse.down`→`move`→`up`)로 읽기 화면 본문 선택 → 댓글 버튼 → 스레드 작성(2026-11-03). 1440 한 문단 "저장 시점 기준으로 고정해", 1440 한국어 단어 중간에서 시작·끝 "표를 저장 시점 기준으로 고정해 공", 390 마우스 "이미지 블록을 같은 저장본에 고정" 모두 저장 `quote`가 드래그한 글자와 같고 `anchorEnd-anchorStart`가 길이와 같음. 테스트 브라우저에만 CDP `Emulation.setFocusEmulationEnabled(true)`를 켬. 390 터치(길게 누르기·핸들)는 NOT_RUN | PASS | PASS(1440·390 마우스) | 증빙 `rcol19-drag-20261103/result.json`, `case1-1440-*.png`, `case2-1440-*.png`, `case3-390-*.png` |
| RCOL-20 | PostgreSQL 운영 업그레이드 경로(`migrate-prod`): `fe71c5ea` 부트스트랩 → 기존 행 기록 → `7759bd02` 실행 | PASS | - | 아래 "운영 업그레이드 경로" |
| RCOL-21 | access token 만료 후 자동 갱신(grant에 묶인 회전형 refresh, 재동의 없음). 실제 Claude Code 2.1.316: `MCP_OAUTH_ACCESS_TTL_SECONDS=360`으로 21:13:49 승인 → 21:14:01 호출(갱신 없음, refresh 0회차 active) → 21:15:23 호출이 브라우저 없이 성공, refresh 0회차 rotated·1회차 active, grant 유지, access token 2개 | PASS | - | `mcp-oauth.service.spec.ts`, [refresh 계획](../plans/mcp-oauth-refresh.md), 증빙 `mcp-refresh-20261102/claude-code-refresh.txt` |
| RCOL-24 | 실제 Codex CLI 0.154.0 갱신. `MCP_OAUTH_ACCESS_TTL_SECONDS=60`, 범위 `reports:read`·`comments:read`, 모델 `gpt-6-luna`. 01:06:19 승인·code 교환 → 01:07:13 새 프로세스 시작 시 갱신(만료 약 6초 전, refresh 0회차 rotated) → 01:08:56 만료 뒤 다른 새 프로세스가 앞 프로세스가 저장한 1회차로 갱신(1회차 rotated·2회차 active). 두 호출 모두 `vm_list_reports` 성공, 로그인 뒤 authorize 요청 0회, grant 유지. VM 화면에서 연결 해제 뒤 같은 설정(`required = true`)은 갱신이 `invalid_grant`로 거절되어 도구 호출 없이 종료. 이후 `codex mcp logout`으로 이번 인증만 삭제. 화면 캡처는 저장 실패로 없음. 실행 중 세션의 만료 갱신은 확인하지 않음 | PASS | - | 증빙 `codex-refresh-20261103/refresh-verified.json`, `call*-events.jsonl`, `call3-after-revoke-stderr.log`, `backend.log`(token 요청 순서) |
| RCOL-25 | 인앱 알림(2026-11-03). 수신자 `qanotify`가 스레드 2개·답글 → 소유자 종 배지 3 → 키보드(포커스·Enter·Tab·Esc)로 목록 → 항목 Enter로 `/reports/:id/read?thread=` 이동·스레드 강조 → 배지 2. 수신자에게는 "guest 님이 스레드를 해결했습니다" 등 이벤트별 문구. 390·768에서 가로 넘침 없음. 실제 Claude Code 2.1.317 호스트(2026-11-04): 임시 프로젝트 등록 → 로그인 → 소유자 승인(읽기 4개, 쓰기는 댓글만) → `claude -p`가 `vm_add_comment`로 보고서 전체 댓글 → 소유자 종 3→4, 첫 항목 "Claude · Claude Code (로컬 검증) 님이 새 댓글을 남겼습니다" → 키보드로 열어 `?thread=` 스레드 강조. 검증 후 logout·등록 제거 | PASS | PASS(1440·768·390) | `comment-notifications-20261103/screens/*.png`, `claude-notify-20261104/*.png`, `claude-code-run.jsonl` |
| RCOL-26 | 공유 스레드(2026-11-04). 소유자 v7 공개 스레드 → 볼 수 있는 인원 1명 표시(v7 고정 수신자만) → 수신자는 답글만 가능(해결 403, 버튼 없음) → 수신자 답글 뒤 소유자 비공개 전환 409·버튼 숨김. 새 댓글의 "공유받은 사람에게도 공개" 체크와 안내, 체크를 바꿔도 입력 유지. 390 가로 넘침 없음 | PASS | PASS(1440·390) | `shared-threads-20261104/*.png` |

## 자동 테스트

- 백엔드 jest(Node 26, in-band, `MCP_OAUTH_HTTP_TESTS=1`, `src/mcp-oauth`·`src/reports`·route-inventory·module-wiring·metadata-postgres-schema): 14/14 묶음, 215 통과, 1 건너뜀(PostgreSQL 전용 parity).
- 실제 PostgreSQL 17.11: 댓글 서비스·마이그레이션·공유 spec 32/32. 마이그레이션을 두 번 올려 엔티티와 차이가 없었다.
- nest build 통과. `mcp-server` `node --test` 17/17.
- 프런트 vitest(Reports·AiConnections·Dashboard·Documents·Artifacts·components·api): 2,279 통과, 14 실패.
  - `Dashboard/index.test.tsx` 12개는 `fe71c5ea`에서 같은 이름으로 실패하는 기존 실패다.
  - `SourceDetails.test.tsx` 2개는 동시 부하 중 5초 시간 초과였고 단독 재실행은 통과했다.
- 프런트 `tsc --noEmit`, 변경 파일 37개 eslint 통과.
- `route-inventory.spec.ts`의 익명 허용 목록에 9개 경로를 추가했다. 모두 `fe71c5ea`에 이미 열려 있던 경로(`/mcp`, `/mcp-oauth/*`, `.well-known`, `/artifacts/shared/:token`)를 각자의 보호 장치와 함께 목록화한 것이며 새로 노출한 경로가 아니다.

## refresh token PostgreSQL 검증(RCOL-21)

2026-11-02, PostgreSQL 17.11 임시 클러스터(검증 후 삭제), `TZ=Asia/Seoul`. 구현 담당 에이전트가 실행했고 아래는 보고된 결과다.

| 확인 | 결과 |
| --- | --- |
| `7759bd02` 부트스트랩에서 현재 코드 `migrate-prod` | `AddMcpOAuthRefresh1793570000000` 1회 실행 |
| 같은 DB 재실행 | 실행된 migration 없음 |
| `createSchemaBuilder().log()` | 차이 0 |
| `pg_dump --schema-only` | 새 코드 신규 부트스트랩과 동일 |
| refresh `usedAt` 왕복 | 2ms 이내 일치(재시도 창 판정 정상) |
| 같은 refresh token 동시 갱신 2건 | 둘 다 성공, 1개 active·1개 superseded, superseded 쪽 access token 삭제, grant 유지 |
| 같은 refresh token 동시 갱신 3건 | 정확히 1건 `invalid_grant`, grant 회수 커밋 |

`mcp-oauth.service.spec.ts`에는 PostgreSQL 실행 옵션이 없어 이 표가 PG 잠금(`FOR UPDATE`)·READ COMMITTED 재조회·timestamp 왕복의 근거다.

## 자동화 기록

Ego Lite는 동작 사이에 페이지 visibility를 전환한다. 보고서 보호 장치가 이를 감지해 선택과 작성 중인 입력을 지운다. 의도한 보안 동작이다. 그래서 선택 → 댓글은 한 번의 페이지 내 시퀀스(`Range` 생성, `mouseup`, 요소 `click`)로 구동했다. 실제 포인터 드래그가 아니다. RCOL-19는 이후 CDP focus emulation을 켜서 보호 장치가 포커스 상실로 오인하지 않게 하고 실제 마우스 드래그로 확인했다. 댓글 목록을 불러오는 중에 드래그하면 선택이 간헐적으로 비었다. 보고서 재조회 때 본문이 잠시 가려지는 것이 원인 후보이며 확정하지 않았다. 로딩이 끝난 뒤의 시도는 모두 성공했다.

OAuth callback 수신기는 같은 경로로 들어오는 `favicon.ico` 요청에 기록이 덮어써졌다. code는 브라우저 탭 주소에서 다시 읽었다.

## 알려진 공백

- Claude Code는 실제로 검증했다(RCOL-18). claude.ai 커넥터는 공개 HTTPS 주소가 필요해 실행하지 않았다.
- Claude Code는 서버가 광고한 범위 7개를 모두 요청한다. 운영 클라이언트 허용 범위에 하나라도 빠지면 `invalid_scope`로 연결이 실패한다. 범위 축소는 승인 화면에서 사용자가 한다.
- 해결(2026-11-02 후속): Claude가 오프셋 계산에 셸을 쓰던 문제는 `quote`/`occurrence` 입력으로, 문단 삭제 후 빈 줄이 남던 문제는 구분자 하나를 함께 지우는 방식으로 고쳤다(MCP 경로만).
- 문단 안의 문장 하나만 삭제하는 제안은 넓히지 않는다. 앞뒤 공백 정리는 편집자가 한다.
- 새 저장 이후 같은 `requestId`로 `occurrence`만 바꿔 다시 보내면 REQUEST_REUSED가 아니라 이전 결과를 재생한다. 이전 버전 텍스트를 서비스가 읽어야 고칠 수 있다.
- 구현·검증(2026-11-02 후속): access token 10분 만료 시 grant에 묶인 회전형 refresh로 재동의 없이 갱신한다(grant 상한 8시간 유지, 재사용 시 grant 회수). SQLite spec·실제 HTTP·PostgreSQL 17 migration·동시 갱신과 실제 Claude Code 호스트 자동 갱신(RCOL-21)을 확인했다. 실제 Codex CLI 0.154.0의 새 프로세스 시작 시(만료 전·후) 갱신과 해제 뒤 거절도 확인했다(RCOL-24). 실행 중 세션의 만료 갱신은 확인하지 않았다.
- 알려진 로깅 문제: 갱신 거절(`invalid_grant`, HTTP 400)이 pino 요청 로그에는 `status:200`으로 찍힌다. interceptor 로그는 400이다. 동작에는 영향이 없고 따로 고친다.
- 해결(2026-11-02 후속): 이미 교환한 authorization code가 같은 client·`redirect_uri`·맞는 PKCE verifier와 함께 다시 오면 grant를 회수한다(verifier 없는 재사용은 DoS 방지를 위해 회수하지 않는다). code 교환·갱신 성공 뒤 만료 token·refresh·code 행을 테이블당 500행, 5분 여유로 정리한다. SQLite spec·실제 HTTP·PostgreSQL 17 임시 클러스터에서 확인했다. [refresh 계획](../plans/mcp-oauth-refresh.md#후속-구현-code-재사용-회수와-만료-행-정리)
- 실제 마우스 드래그 선택은 확인했다(RCOL-19). 모바일 터치 선택(길게 누르기·선택 핸들)은 검증하지 않았다.
- 여러 수신자 공유는 원자적이지 않다. 일부만 공유되면 `complete: false`를 돌려주고 같은 `requestId`로 재시도해 마저 공유한다.
- 같은 `requestId`에 다른 수신자 목록을 보내면 409가 아니라 추가 수신자만 공유된다. 매번 `confirmShare`가 필요하지만 설계와 다르다.
- 수신자는 자신이 낸 제안의 `appliedVersion`을 본다. 소유자가 몇 번째 저장본에 반영했는지가 드러난다.
- 운영 업그레이드 경로는 빈 DB에서 부트스트랩한 `fe71c5ea` 스키마로만 확인했다(RCOL-20). 실제 운영 데이터, 기존 MySQL에서 옮긴 스키마, 앱 컨테이너 기동 순서는 확인하지 않았다.
- `report-delivery-transfer.ts`의 따옴표 없는 camelCase SQL 의심은 PostgreSQL 17에서 재현되지 않았다. TypeORM 0.3.31 update 빌더는 별칭 없는 속성명을 쿼리 전체에서 `"ownerId"`, `"relationVersion"`으로 바꾼다(실행 SQL: `SET "active" = $1, "relationVersion" = "relationVersion" + 1 WHERE ("ownerId" = $2 OR "recipientId" = $2) AND "active" = $3`). 코드는 그대로 두고 회귀 spec만 추가했다. `StaffTransferService` 전체 흐름은 PostgreSQL에서 돌리지 않았다(`staff-transfer.spec.ts`는 SQLite, 동시성 3건은 MySQL 전용).

## 운영 업그레이드 경로(RCOL-20)

2026-11-02. Homebrew PostgreSQL 17.11 임시 클러스터(127.0.0.1:55492), Node 26.13.0. `fe71c5ea`와 `7759bd02`를 각각 임시 worktree로 꺼내 `tsc -p tsconfig.build.json`으로 `dist`를 만들고 `NODE_ENV=prod DB_HOST=127.0.0.1 DB_PORT=55492 DB_USERNAME=postgres DB_NAME=vm_upgrade node dist/src/database/migrate-prod.js`로 실행했다. node_modules는 메인 체크아웃을 링크만 했다. 실행 후 클러스터와 worktree는 지웠다.

| 단계 | 결과 |
| --- | --- |
| `fe71c5ea` 빈 DB 부트스트랩 / 재실행 | `bootstrapped, recordedMigrations:4` / `migrated, ranMigrations:0`. 106개 테이블, `artifact_comment*` 없음 |
| 기존 행 기록 | `private_report`·`revision`·`chunk`·`delivery`·`delivery_receipt` 각 1행, 시드 `template` 10·`template_item` 46 |
| `7759bd02` 1회차 | `migrated, ranMigrations:1`. `migrations`에 `AddArtifactComments1793560000000` 한 줄 추가(총 5) |
| `7759bd02` 2회차 | `migrated, ranMigrations:0` |
| 엔티티 차이 | `createSchemaBuilder().log()` 결과 0건. 대조군(`fe71c5ea` 스키마에 같은 검사)은 11건 |
| 신규 부트스트랩과 비교 | `7759bd02` 빈 DB 부트스트랩(`recordedMigrations:5`)과 `pg_dump --schema-only`가 같다(pg_dump `\restrict` 토큰만 다름). 제약·인덱스 이름 포함 |
| 기존 행 보존 | 위 7개 테이블 행 수와 md5 동일. 영수증은 기존 6개 열 md5 동일, 새 `aiGrantId`·`aiClientName`은 NULL |

PostgreSQL 회귀(`VM_REPORT_COMMENT_POSTGRES_PORT=55492`): `report-delivery-transfer.spec.ts` 3/3, `report-comment-migration.spec.ts` 5/5. SQLite: 위 두 파일과 `staff-transfer.spec.ts` 36 통과, 4 건너뜀(PostgreSQL 1, MySQL 3).
