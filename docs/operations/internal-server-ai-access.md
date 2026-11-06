# 사내 서버에 올리고 외부 AI로 쓰기: 체크리스트

팀원이 자기 AI(Claude Code 등)로 VanillaMeta의 대시보드·보고서를 쓰게 하려는 사내 서버용이다. 서버 AI 키는 필요 없다. 설정값의 자세한 의미는 [`deploy/README.md`](../../deploy/README.md)(운영 스택)와 [`remote-ai-oauth.md`](./remote-ai-oauth.md)(MCP)를 따르고, 여기서는 **순서와 빠지기 쉬운 것**만 적는다. 각 항목에 확인한 것과 하지 않은 것을 구분해 두었다.

## 0. 먼저 알아 둘 것

- **빠른 시작 스택(`docker-compose.yml`)은 사내 운영용이 아니다.** `NODE_ENV=dev`, `127.0.0.1` 바인딩, 데모 계정, 개발용 비밀값, 스키마 동기화를 쓴다. 사내 서버에는 `deploy/docker-compose.prod.yml`을 쓴다.
- **대시보드 도구가 들어 있는 코드는 이 문서를 쓴 시점(2026-11-06)에 `test/docker-e2e` 브랜치에만 있었고 push·병합 전이었다.** 병합되기 전에는 이 브랜치의 체크아웃에서 이미지를 빌드해야 한다(§2).
- **확인한 것:** 빠른 시작 스택(PostgreSQL 17, localhost)에서 OAuth 승인 → 도구 호출 → 대시보드 생성·수정·복원·삭제까지 e2e 71/71. **확인하지 않은 것:** 운영 스택(`deploy/`)에서의 같은 흐름, 사내 TLS 구성, 실제 Claude Code로 대시보드 도구 호출(보고서 도구만 Claude Code 2.1.316으로 확인했다).

## 1. 어떤 AI를 쓸지에 따라 달라지는 것

| 방식 | 서버가 닿아야 하는 곳 | 상태 |
| --- | --- | --- |
| 직원 PC의 **Claude Code 같은 로컬 클라이언트** | 직원 PC에서 사내 서버의 HTTPS 주소 | 보고서 도구로 확인. 대시보드 도구는 미확인 |
| **웹·클라우드 AI 커넥터**(AI 업체 서버가 서버를 부르는 방식) | **인터넷에서 서버로** | 사내 전용 서버로는 불가. 시험하지 않음 |

사내 전용이면 앞의 방식만 가능하다. 이 문서는 그 경우를 기준으로 쓴다.

## 2. 서버 준비

1. **VM:** 메모리 8GB 이상, 디스크 40GB 이상, Docker Engine + compose 플러그인. 인스턴스는 **하나만** 둔다(일부 상태가 프로세스 메모리에 있다).
2. **이미지:** `deploy/`는 GitHub 워크플로가 GHCR에 올린 이미지를 받는 구조인데 그 워크플로는 실제 GitHub에서 실행해 본 적이 없다. 사내에서는 서버에 올릴 브랜치 체크아웃에서 직접 빌드해 `.env.prod`의 `API_IMAGE`·`WEB_IMAGE`·`IMAGE_TAG`로 지정하는 쪽이 안전하다. 빠른 시작 compose의 빌드 정의와 같은 Dockerfile이다(이 문서를 쓰며 운영 태그 빌드는 실행하지 않았다).
   ```bash
   docker build -f backend-api/Dockerfile.prod --build-arg BUILD_HEAP_MB=3072 -t vanillameta-api:<태그> backend-api
   docker build -f frontend-web/Dockerfile.prod -t vanillameta-web:<태그> frontend-web
   ```
   Docker 메모리가 4GB 미만이면 API 빌드가 힙 부족으로 실패한다.
   **갱신 경로가 달라진다:** `release.sh`(§7)는 `compose pull api web`이 실패하면 중단하므로 레지스트리 없이 로컬 이미지만 있으면 쓸 수 없다. 사내 레지스트리에 이미지를 올려 두거나, 새 태그를 빌드한 뒤 `IMAGE_TAG`를 바꿔 `docker compose … up -d`로 직접 갱신하고 사전 백업(`backup.sh`)은 손으로 한다.
3. **주소와 TLS:** MCP의 `MCP_PUBLIC_API_URL`·`MCP_PUBLIC_WEB_URL`은 운영 모드에서 **항상 https**여야 한다(`localhost`도 마찬가지). `http://localhost` 예외는 AI 클라이언트의 **redirect URI**에만 있다. 기본 `Caddyfile`은 Let's Encrypt로 인증서를 받으므로 도메인이 **공인 DNS**를 가지고 80/443이 인터넷에서 닿아야 한다. 사내 전용 서버라면 `Caddyfile`에 `tls` 지시문을 **새로 추가**해야 한다(없다). 사내 CA 인증서를 쓰려면 compose의 caddy 서비스에 인증서·키 파일 마운트도 추가해야 하고(지금은 `Caddyfile`과 데이터 볼륨만 마운트), `ACME_EMAIL`은 이 경우에도 필수 값이다. Caddy 내부 CA(`tls internal`)를 쓰면 루트 인증서는 `caddy-data` 볼륨의 `/data/caddy/pki/authorities/local/root.crt`에 생긴다. 어느 쪽이든 **직원 PC의 OS·브라우저(OAuth 승인은 브라우저에서 일어난다)와 AI 클라이언트가 그 루트를 신뢰**해야 하고(Node 기반 CLI는 `NODE_EXTRA_CA_CERTS`), HSTS 때문에 인증서 경고를 넘길 수도 없다. 이 구성은 이 저장소에서 시험하지 않았다.
4. **접속 주소는 항상 `APP_DOMAIN`이다.** MCP는 요청의 `Host`를 `MCP_PUBLIC_API_URL`의 호스트와 비교하므로 IP나 별칭으로 접속하면 `access_denied`가 난다. `MCP_PUBLIC_*`의 호스트는 `APP_DOMAIN`과 정확히 같게 하고, `CORS_ORIGIN`도 `https://<APP_DOMAIN>`로 고정돼 있다.
5. **프록시 홉:** compose는 `TRUST_PROXY_HOPS=2`(caddy, web nginx)로 고정돼 있다. 사내 로드밸런서나 TLS 종단 장비를 Caddy **앞에** 두면 3이 되어야 하고, 그대로 두면 IP 위조 또는 전 사용자가 한 요청 한도 버킷에 묶이는 문제가 생긴다(`deploy/README.md`).
6. 도메인의 **A 레코드만** 서버를 가리키게 한다(AAAA를 두면 IPv6 사용자가 한 요청 한도 버킷에 묶인다).

## 3. `.env.prod`

`deploy/.env.prod.example`을 복사해 모든 값을 채운다(비밀값 5개는 32자 이상 `openssl rand -hex 32`). 이 작업에 중요한 항목:

```dotenv
APP_DOMAIN=ai.company.internal
# 서버 AI는 선택이다. 비우면 앱의 AI 기능만 꺼지고 MCP는 동작한다.
# AI_API_KEY=

# 조직 관리 모드(권장, 새 설치 전용): 이 로그인 ID만 조직을 만든다. "guest"는 쓰지 않는다(아래).
BOOTSTRAP_ADMIN_USER_ID=companyadmin
SIGNUP_MODE=invite

MCP_PUBLIC_API_URL=https://ai.company.internal/v1
MCP_PUBLIC_WEB_URL=https://ai.company.internal/
MCP_OAUTH_CLIENTS_JSON='[{"id":"claude-code","name":"Claude Code","redirectUris":["http://localhost:8765/callback"],"scopes":["sources:read","reports:read","comments:read","comments:write","dashboards:read","dashboards:write","dashboards:delete"]}]'
```

- **`BOOTSTRAP_ADMIN_USER_ID`는 이 변경 전의 `deploy/docker-compose.prod.yml`이 API에 전달하지 않았다.** 그래서 운영 스택에서는 관리 모드를 켤 수 없었고 초대받은 누구나 자기 조직을 만들 수 있었다. 이 문서와 함께 compose에 전달 줄을 추가했다(`docker compose config`로 값이 api·migrate에 들어가는 것만 확인했고 운영 스택을 띄워 보지는 않았다). 이 변수가 없으면 "관리자가 구성원과 등급을 관리한다"는 전제가 서지 않는다.
- **`guest`를 넣지 않는다.** 운영은 DB에 `guest` 계정이 있으면 부팅을 거부하는데, 환경변수 값 자체는 막지 않는다. `guest` 계정이 없을 때 이 값이 `guest`면 경고만 남기고 부팅되고, 초대 코드를 가진 사람이 `guest`로 가입하면 그 사람이 관리자가 되며 **다음 재시작부터 서버가 뜨지 않는다.**
- **새 설치 전용이다.** 이미 조직이 있으면 관리자가 조직을 만들 수 없고(조직이 0개일 때만 만든다), 조직이 둘 이상이면 대기 화면에 조직 번호가 채워지지 않으며, 조직 밖 기존 사용자는 바로 `ORGANIZATION_REQUIRED`(403)를 받는다. 기존 설치에서 켜기 전에 조직 수와 소속을 먼저 확인한다.
- 관리 모드 값은 **계정이 아직 없을 때 `SIGNUP_MODE=open`이면 부팅이 거부된다**(먼저 가입하는 사람이 관리자가 되는 것을 막는다). `invite`(기본)로 둔다.
- `MCP_OAUTH_CLIENTS_JSON`: 클라이언트마다 **정확한 redirect URI**를 등록한다(동적 등록 없음). Claude Code는 `--callback-port`로 포트를 고정할 수 있으니 팀 전체가 같은 고정 포트를 쓰게 하면 한 항목으로 충분하다. `dashboards:*`를 넣어야 대시보드 도구가 보인다. **이 값을 바꾸면 모든 연결이 끊기니** 처음에 필요한 범위를 정해 두는 것이 좋다.

## 4. 올리기와 첫 관리자

```bash
cd /opt/vanillameta/deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
sudo ./egress-guard.sh apply        # api의 외부 호출 제한(사설·링크로컬 주소 차단)
docker compose --env-file .env.prod -f docker-compose.prod.yml ps -a   # migrate는 exited(0), 나머지는 healthy
```

새 DB는 `migrate`가 스키마와 마이그레이션 기록을 한 번에 만든다. **기존 DB를 갱신할 때** 이번 변경의 이력 테이블(`dashboard_revision`) 마이그레이션이 실행된다. 이 마이그레이션은 스키마 동기화를 끈 PostgreSQL에서 실행해 확인했고(1b 계획 문서), `migrate-prod`와 운영 스택으로 확인한 것은 아니다.

`egress-guard.sh`는 api가 **사설 주소(10/8, 172.16/12, 192.168/16)로 나가는 것**을 막는다. 사내 LLM 게이트웨이(`AI_API_BASE_URL`이 사설 IP)나 사내 HTTP 프록시를 쓰려면 막히고, compose에는 `HTTPS_PROXY` 전달도 없다. 서버 AI를 쓰지 않으면 영향이 없다. Docker가 nftables 백엔드면 이 스크립트가 동작하지 않는다(`deploy/README.md`).

1. 관리자 초대 코드를 만든다: `C="docker compose --env-file .env.prod -f docker-compose.prod.yml"; $C run --rm migrate node dist/src/access/access-cli.js invite create --label "관리자" --days 14`
2. `https://<도메인>/signup?invite=<코드>`로 **`BOOTSTRAP_ADMIN_USER_ID`와 같은 로그인 ID**로 가입하고 로그인해 조직을 한 번 만든다.
3. 구성원은 초대 코드(운영자가 전달)로 가입한 뒤 조직 페이지의 대기 화면에서 **연결 코드**를 만들고, 관리자가 등급(admin·editor·contributor·viewer)을 정해 추가한다. 빠른 시작 스택에서 확인한 흐름이며 운영 스택의 초대 가입과 합친 흐름은 시험하지 않았다. 자세한 설명: [`README_DOCKER.md`](../../README_DOCKER.md#조직과-등급).

## 5. 열기 전에 확인(서버에서)

```bash
curl -s https://<도메인>/healthz        # nginx가 고정 응답을 주는 경로라 API 상태는 보지 못한다
curl -s https://<도메인>/v1/health      # API 상태
curl -s https://<도메인>/.well-known/oauth-authorization-server/v1/mcp-oauth   # 200, token_endpoint와 S256
curl -s https://<도메인>/.well-known/oauth-protected-resource/v1/mcp           # scopes_supported = 설정한 범위의 합집합
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<도메인>/v1/mcp        # 토큰 없이 401
```

사내 CA·내부 CA를 쓰면 `curl`에도 `--cacert <루트 인증서>`가 필요하다. 그다음 관리자 계정으로 **실제 AI 클라이언트 하나**를 연결해 본다(아래). 이 단계가 이 문서의 가장 큰 미확인 지점이다.

## 6. 팀원이 연결하는 방법(Claude Code)

```bash
claude mcp add --transport http --client-id claude-code --callback-port 8765 vanillameta https://ai.company.internal/v1/mcp
```

열린 승인 화면에서 허용할 권한을 고른다(읽기는 기본 선택, 쓰기·삭제는 기본 해제). 대시보드를 만들려면 `sources:read`와 `dashboards:read`·`dashboards:write`를 함께 승인한다. 쓰는 방법은 [사용자 매뉴얼의 MCP 페이지](../user-manual/site/mcp.md)에 있다.

- 연결은 최대 8시간 뒤 다시 승인해야 한다. 연결 해제는 아티팩트 목록의 **외부 AI 연결**에서 한다.
- AI는 **본인 계정의 등급과 소유**를 넘지 못한다. 대시보드를 만들려면 본인 소유 소스와 그 소스의 저장 지표가 필요하다. **대시보드의** 쓰기·삭제는 `contributor` 이상이다(보고서 댓글은 viewer도 쓸 수 있다).
- **AI가 읽은 집계 값은 그 AI 제공자에게 전달된다.** 사내 정책에서 허용되는지 먼저 확인한다.

## 7. 운영 중 알아 둘 것

- 백업(`deploy/backup.sh`, 암호화)과 키 보관(`.env.prod`의 `CONFIG_SECRET_KEY`와 백업 암호를 서버 밖에)은 `deploy/README.md`를 따른다.
- 업데이트는 `release.sh`(사전 백업 → migrate → 헬스 확인)로 한다. API에 종료 신호 처리가 없어 재시작 때 처리 중인 요청이 끊긴다.
- 롤백하려면 **먼저 클라이언트 설정에서 `dashboards:*`를 제거**한다. 남아 있으면 이전 버전이 설정을 거부해 `/v1/mcp` 전체가 503이 된다.
- 한 번에 여러 사람이 같은 서버에서 AI로 쓸 때의 동시 요청 경쟁은 시험하지 않았다. 사용자별 한도(쓰기 분당 20회, 생성 시간당 10개, 삭제 분당 10회, 미리보기 분당 10회)는 서버 메모리 기준이라 인스턴스 하나를 전제한다.
