# VanillaMeta Docker 고객 시연

VanillaMeta를 Docker로 시작하고 새 소유자 계정, 조직 수신자, Claude Code 연결을 준비합니다. 화면 단위 안내와 검증 순서는 [Docker에서 Claude 시연 준비](./docs/user-manual/site/customer-demo.md)를 따릅니다.

이 시연 변경은 `codex/customer-demo-1123` 브랜치에 있습니다. 기본 브랜치에 포함된 것으로 가정하지 않습니다.

## 시작

`--wait`를 지원하는 Docker Compose v2가 필요합니다. 설치된 명령을 확인합니다.

```sh
docker compose version
```

`--wait`를 알 수 없다는 오류가 나면 Docker Compose를 갱신한 뒤 진행합니다. 현재 브랜치를 받고 저장소 루트에서 기본 스택을 시작합니다.

```sh
git clone --branch codex/customer-demo-1123 https://github.com/vanillabrain/vanillameta.git
cd vanillameta
docker compose up --build -d --wait
docker compose ps
curl http://localhost:4000/v1/health
```

웹은 `http://localhost:3000`, API는 `http://localhost:4000/v1`, API 문서는 `http://localhost:4000/v1/api-docs`, 원격 MCP는 `http://localhost:4000/v1/mcp`에서 엽니다.

이미지나 코드를 갱신할 때도 같은 명령을 다시 실행합니다.

```sh
docker compose up --build -d --wait
```

### 다른 포트

3000 또는 4000 포트가 사용 중이면 `VM_WEB_PORT`와 `VM_API_PORT`를 명령 앞에 지정합니다.

```sh
VM_WEB_PORT=3100 VM_API_PORT=4100 docker compose up --build -d --wait
```

웹은 `http://localhost:3100`, API는 `http://localhost:4100/v1`, MCP는 `http://localhost:4100/v1/mcp`에서 엽니다. 같은 변수를 지정한 상태에서 같은 명령을 실행하면 이미지도 갱신됩니다. Compose 파일은 직접 고치지 않습니다.

## 새 소유자와 수신자

소유자는 로그인 화면의 **회원가입**에서 새 계정을 만들고 **가입하기 → 확인**을 진행합니다. 새 계정으로 로그인하고 대시보드의 **먼저 시작하기 → 작업 공간 연결 → 조직·직원** 또는 계정 메뉴의 **조직·직원**(`/organization`)에서 **새 조직 이름**을 입력한 뒤 **조직 만들기**를 누릅니다. 이 계정은 해당 조직의 `admin (관리자)`가 됩니다.

로컬 데모 계정이 이미 준비된 환경이라면 `guest` / `Admin!@12`를 선택적으로 사용할 수 있습니다. 새 소유자 회원가입이 기본 경로이며, 문서 사이트에서는 회원가입 경로를 사용합니다.

수신자는 별도 브라우저 프로필에서 새 계정을 만들고 **조직·직원 → 참여할 조직 번호**에 소유자의 조직 번호를 입력합니다. **조직 연결 코드 발급 → 코드 복사** 후 로그인 ID와 코드를 소유자에게 전달합니다. 소유자는 **기존 계정 추가**에서 로그인 ID, 팀, `member (구성원)` 역할, 연결 코드를 입력하고 동의란을 선택한 뒤 **직원 추가**를 누릅니다. 코드는 15분 동안 한 번만 사용할 수 있습니다.

첫 조직 만들기와 직원 추가는 singular 경로 `/organization`에서 진행합니다. Studio의 **조직 접근** 화면 `/organizations`는 소속 조직의 분석 접근을 다루는 별도 화면입니다.

## Claude Code

VanillaMeta에서 **내 아티팩트 → 먼저 시작하기 → 작업 공간 연결 → Claude 또는 외부 AI 연결**을 열거나 `http://localhost:3000/ai-connections`를 엽니다. **Claude Code 연결**의 **원격 MCP 서버 등록**과 **Claude Code 로그인 시작** 명령을 각각 **복사**해 실행합니다. 명령은 현재 프로젝트 범위와 별칭 `vanillameta`를 사용합니다.

```sh
claude mcp add --transport http --client-id claude-code --callback-port 53683 vanillameta --scope local 'http://localhost:4000/v1/mcp'
claude mcp login vanillameta --no-browser
claude mcp get vanillameta
```

승인 화면에서 현재 계정과 조직을 확인하고 **내 아티팩트 읽기**와 **내 아티팩트 만들기·수정·삭제**를 모두 선택합니다. **연결 승인** 뒤 `claude mcp get vanillameta`에서 **Connected**를 확인합니다. 다른 API 포트를 썼다면 제품 화면의 **서버가 제공한 MCP 주소**와 등록 명령을 새로 복사합니다.

## 중지와 재개

```sh
docker compose stop
docker compose start
```

컴퓨터나 Docker를 다시 시작한 뒤에는 같은 기본 명령으로 이어서 실행합니다. 메타데이터와 업로드 파일은 Compose 볼륨에 남습니다. `docker compose down`도 볼륨을 남기며, `docker compose down -v`는 데이터를 삭제합니다.

## 문제 확인

```sh
docker compose ps
docker compose logs --tail=200 postgres backend frontend
```

- 웹 이미지를 갱신한 뒤 이전 안내가 보이면 해당 설치본의 VanillaMeta 탭을 모두 닫고 웹을 다시 엽니다.
- 포트 충돌은 `VM_WEB_PORT`와 `VM_API_PORT`로 해결합니다.
- Claude 도구가 없으면 `/ai-connections`의 주소와 `claude mcp get vanillameta`를 확인합니다.
- 승인 화면에 쓰기 권한이 없으면 **요청 취소** 후 등록 명령과 로그인 명령을 새로 실행합니다.
- 조직 연결 코드가 만료됐거나 이미 사용됐다면 수신자가 새 코드를 발급합니다.
- 수신자가 차트를 열지 못하면 소유자와 같은 조직인지, 수신자 로그인 ID가 **열람 가능한 구성원**에 있는지 확인합니다.
- `revision mismatch`이면 새 차트를 만들지 말고 현재 차트를 다시 읽어 한 번만 수정합니다.

## 문서와 확인

- [Docker와 소유자·수신자·Claude 전체 순서](./docs/user-manual/site/customer-demo.md)
- [화면별 검증 순서](./docs/user-manual/site/customer-demo.md#verification)
- [조직 공유와 권한](./docs/user-manual/site/organization.md)
- [Codex와 Claude로 첫 차트 만들기](./docs/user-manual/site/codex-first-chart.md)
- [원격 MCP 연결](./docs/user-manual/site/remote-mcp.md)
- [초안·충돌 복구](./docs/user-manual/site/recovery.md)
- [문제 해결](./docs/user-manual/site/troubleshooting.md)

VitePress 문서는 다음 명령으로 빌드하고 링크를 검사합니다.

```sh
npm run docs:build
npm --prefix docs/user-manual run check
```

기본 Claude 연결은 아티팩트 읽기와 작성 범위를 요청합니다. 소스·문서 조회를 추가하는 관리자는 [원격 MCP 안내](./docs/user-manual/site/remote-mcp.md)를 참고해 클라이언트 허용 목록을 설정합니다. 원격 연결을 끄려면 `MCP_OAUTH_CLIENTS_JSON=`을 지정하고 Compose를 다시 실행합니다.
