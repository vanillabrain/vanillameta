# Docker에서 Claude 시연 준비

이 문서는 Docker로 VanillaMeta를 시작하고, 새 소유자 계정과 조직 수신자를 만든 뒤 Claude Code로 차트를 공유하는 순서를 안내합니다.

이 안내에 맞춘 변경은 `codex/customer-demo-1123` 브랜치에 있습니다. 기본 브랜치가 이 변경을 포함한다고 가정하지 말고 이 브랜치를 직접 받아 확인합니다.

## 준비 {#prepare}

- `--wait`를 지원하는 Docker Compose v2와 Git
- Claude Code를 실행할 터미널
- 서로 다른 계정으로 로그인할 브라우저 세션 두 개. 별도 프로필 두 개 또는 일반 창과 시크릿 창을 준비합니다.
- 기본값을 쓸 때 비어 있는 3000, 4000 포트

```sh
docker compose version
```

명령이 `--wait`를 알 수 없다는 오류를 내면 설치된 Docker Compose를 갱신한 뒤 진행합니다.

## 1. 현재 브랜치로 시작 {#start}

```sh
git clone --branch codex/customer-demo-1123 https://github.com/vanillabrain/vanillameta.git
cd vanillameta
docker compose up --build -d --wait
```

상태를 확인하고 `http://localhost:3000`을 엽니다.

```sh
docker compose ps
curl http://localhost:4000/v1/health
```

이미지나 코드를 갱신할 때도 같은 명령을 다시 실행합니다. 3000 또는 4000 포트가 사용 중이면 두 포트를 함께 바꿉니다.

```sh
VM_WEB_PORT=3100 VM_API_PORT=4100 docker compose up --build -d --wait
```

이 경우 웹은 `http://localhost:3100`, API는 `http://localhost:4100/v1`입니다. 같은 환경 변수를 지정한 상태에서 같은 명령을 다시 실행하면 이미지도 갱신됩니다.

## 2. 새 소유자 계정과 조직 만들기 {#owner}

소유자는 운영자가 미리 준비한 계정 없이 시작할 수 있습니다.

1. 로그인 화면에서 **회원가입**을 엽니다.
2. 아이디, 비밀번호, 비밀번호 확인, 이메일을 입력하고 **가입하기**를 누릅니다.
3. 가입 완료 창에서 **확인**을 누르고 새 계정으로 로그인합니다.
4. 대시보드의 **먼저 시작하기 → 작업 공간 연결 → 조직·직원**을 누르거나 계정 메뉴의 **조직·직원**을 엽니다. 화면 경로는 `/organization`입니다.
5. **새 조직 이름**에 `VanillaMeta Demo`를 입력하고 **조직 만들기**를 누릅니다.
6. **조직 번호**와 **내 역할** `admin (관리자)`을 확인합니다.

Studio의 **조직 접근** 화면 `/organizations`는 소속 조직의 분석 접근을 다루는 별도 화면입니다. 첫 조직 만들기와 직원 추가는 singular 경로 `/organization`의 **조직·직원**에서 진행합니다.

새 조직은 기존 개인 대시보드를 자동 공개하거나 다른 조직의 자료를 옮기지 않습니다. 공유할 소스와 아티팩트는 조직 문맥에서 따로 확인합니다.

## 3. 새 수신자 계정을 조직에 연결 {#recipient}

수신자도 다른 브라우저 프로필에서 별도 계정을 만듭니다.

1. 로그인 화면에서 **회원가입 → 가입하기 → 확인**을 진행하고 새 계정으로 로그인합니다.
2. 계정 메뉴의 **조직·직원**에서 **참여할 조직 번호**에 소유자의 조직 번호를 입력합니다.
3. **조직 연결 코드 발급**을 누르고 **코드 복사**를 선택합니다.
4. 수신자의 로그인 ID와 연결 코드를 소유자에게 전달합니다.
5. 소유자는 **기존 계정 추가**에서 **로그인 ID (userId)**, **팀**, **역할**, **연결 코드**를 입력합니다.
6. **역할**은 `member (구성원)`을 선택하고 동의란을 선택한 뒤 **직원 추가**를 누릅니다.
7. 수신자가 **조직·직원**을 다시 열어 조직명, **조직 번호**, **내 역할** `member (구성원)`을 확인합니다.

연결 코드는 15분 동안 한 번만 사용할 수 있습니다. 만료되면 수신자가 새 코드를 발급합니다.

## 4. Claude Code 연결 {#claude}

Claude Code 자체 로그인과 VanillaMeta 연결은 별개입니다.

```sh
claude --version
claude auth status
```

로그인이 필요하면 `claude auth login`을 실행합니다. VanillaMeta에서 **내 아티팩트 → 먼저 시작하기 → 작업 공간 연결 → Claude 또는 외부 AI 연결**로 이동하거나 `http://localhost:3000/ai-connections`를 엽니다.

**Claude Code 연결**에서 **원격 MCP 서버 등록**의 **복사**를 누르고 터미널에서 실행합니다. 이어서 **Claude Code 로그인 시작**도 복사해 실행합니다. 화면의 **서버가 제공한 MCP 주소**에는 현재 API 포트가 들어 있습니다.

```sh
claude mcp add --transport http --client-id claude-code --callback-port 53683 vanillameta --scope local 'http://localhost:4000/v1/mcp'
claude mcp login vanillameta --no-browser
claude mcp get vanillameta
```

로그인 명령이 출력한 URL을 소유자가 로그인한 브라우저에서 엽니다. 별칭 `vanillameta`는 명령을 실행한 프로젝트에서 사용합니다. 승인 화면에서 소유자 계정과 **VanillaMeta Demo** 조직을 확인하고 **내 아티팩트 읽기**와 **내 아티팩트 만들기·수정·삭제**를 모두 선택한 뒤 **연결 승인**을 누릅니다. `claude mcp get vanillameta`에서 **Connected**를 확인합니다.

승인 요청은 5분 뒤 만료되고 접근 토큰은 최대 10분 동안 유효합니다. **요청 취소**는 `access_denied`를 반환하고 연결을 만들지 않습니다.

## 5. 차트 만들기와 공유 {#share}

Claude Code에서 지역별 합성 매출 차트를 만들고 같은 대화에서 부산 값을 수정합니다. 생성, 버전 확인, **내 아티팩트** 검색, **조직 구성원과 공유**, **공유받음**, **공유 회수**의 정확한 순서는 [Codex로 첫 차트 만들기](./codex-first-chart.md)를 따릅니다.

공유를 확인할 때 소유자는 **수신자 로그인 ID**를 입력하고 **읽기 권한 공유**를 누릅니다. 수신자는 **공유받음**에서 차트를 열어 **읽기 전용**과 최신 저장 버전을 확인합니다. 소스 읽기와 대시보드 공유는 별도이므로 수신자가 열지 못하면 [조직 공유와 권한](./organization.md)의 두 권한을 모두 확인합니다.

## 6. 중단한 뒤 다시 시작 {#resume}

```sh
docker compose stop
docker compose start
```

컴퓨터나 Docker를 다시 시작했다면 같은 기본 명령으로 이어서 실행합니다.

```sh
docker compose up --build -d --wait
```

메타데이터와 업로드 파일은 Compose 볼륨에 남습니다. `docker compose down`도 볼륨을 남깁니다. `docker compose down -v`는 데이터를 삭제하므로 새 시연으로 초기화할 때만 사용합니다.

## 7. 막혔을 때 {#troubleshooting}

| 증상 | 다음 동작 |
| --- | --- |
| `port is already allocated` | `VM_WEB_PORT`와 `VM_API_PORT`에 비어 있는 포트를 지정하고 같은 명령을 다시 실행합니다. |
| `--wait`가 끝나도 시작하지 않음 | `docker compose ps`와 `docker compose logs --tail=200 postgres backend frontend`를 확인합니다. 원인을 고친 뒤 같은 명령을 다시 실행합니다. |
| 웹은 열리지만 API가 응답하지 않음 | 현재 포트의 `/v1/health`를 확인하고 사용자 지정 포트를 지정한 터미널에서 명령을 실행했는지 확인합니다. |
| Claude 도구가 보이지 않음 | **외부 AI 연결**의 서버 주소, `claude mcp get vanillameta`, **Connected** 상태를 확인합니다. `Needs authentication`이면 **Claude Code 로그인 시작** 명령을 다시 실행합니다. |
| 승인 화면에 쓰기 권한이 없음 | 승인으로 권한을 추가할 수 없습니다. **요청 취소** 후 등록 명령을 다시 복사하고 쓰기 범위를 요청하는 설정으로 새 로그인을 시작합니다. |
| 승인 요청이 만료됨 | `claude mcp login vanillameta --no-browser`로 새 로그인을 시작합니다. |
| 조직 연결 코드가 거절됨 | 수신자가 같은 조직 번호로 코드를 새로 발급하고 소유자는 15분 안에 새 코드를 한 번 사용합니다. |
| 수신자가 차트를 못 엶 | 수신자가 같은 조직의 계정으로 로그인했는지 확인한 뒤, 소유자 화면의 **열람 가능한 구성원**에서 수신자의 로그인 ID를 확인합니다. |
| `revision mismatch` | 현재 차트를 다시 읽고 최신 리비전으로 같은 수정을 한 번만 요청합니다. |

다른 포트의 설치본으로 바꾼 뒤 같은 별칭이 이미 등록됐다고 나오면, 먼저 `claude mcp get vanillameta`로 URL을 확인합니다. 새 Claude 프로젝트 폴더에서 현재 화면의 등록 명령을 실행하면 두 설치본을 따로 사용할 수 있습니다.

## 검증 순서 {#verification}

| 확인할 결과 | 앱에서 볼 화면 | 문서 메뉴 |
| --- | --- | --- |
| 기본 포트 또는 지정 포트에서 웹과 API가 시작됨 | `/`와 `/v1/health` | [Docker 시작](./customer-demo.md#start) |
| 새 소유자가 가입하고 조직의 관리자가 됨 | **회원가입**, **먼저 시작하기 → 작업 공간 연결 → 조직·직원**, `/organization` | [소유자 조직](./customer-demo.md#owner) |
| 새 수신자가 조직 구성원이 됨 | **참여할 조직 번호**, **기존 계정 추가** | [수신자 연결](./customer-demo.md#recipient) |
| Claude가 `vanillameta` 연결과 두 아티팩트 범위로 승인됨 | **외부 AI 연결**, **연결 승인** | [Claude 연결](./customer-demo.md#claude) |
| 차트가 생성되고 같은 링크에서 수정됨 | **내 아티팩트**, **산출물 제목 검색** | [첫 차트 실습](./codex-first-chart.md) |
| 수신자가 최신 차트를 읽기 전용으로 열 수 있음 | **조직 구성원과 공유**, **공유받음** | [차트 공유](./customer-demo.md#share) |
| 중지 뒤 같은 볼륨과 자료로 재개됨 | `docker compose ps` | [재개](./customer-demo.md#resume) |
| 오류 뒤 로그와 현재 상태를 확인함 | 로그와 `/v1/health` | [문제 해결](./troubleshooting.md) |

## 관련 문서 {#related}

- [전체 안내](./contents.md)
- [조직 공유와 권한](./organization.md)
- [Codex로 첫 차트 만들기](./codex-first-chart.md)
- [원격 MCP 연결](./remote-mcp.md)
- [초안·충돌 복구](./recovery.md)
- [문제 해결](./troubleshooting.md)
