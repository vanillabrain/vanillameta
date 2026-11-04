# Docker 한 줄 실행 검증 (2026-11-04)

목표: 저장소를 받아 `docker compose up --build` 한 줄로 앱을 띄우고 `guest` 로 로그인해 체험한다.

## 바뀐 것

- `docker-compose.yml`이 운영과 같은 `backend-api/Dockerfile.prod`, `frontend-web/Dockerfile.prod`를 쓴다. 이전에는 Oracle 클라이언트를 외부에서 받는 `Dockerfile`과, `/v1` 프록시가 없는 nginx 이미지를 썼다.
- 웹이 `/v1`·`/socket.io`를 backend로 프록시한다. 프런트 build arg `REACT_APP_API_URL`을 넘기지 않아 기본값 `/v1`(같은 오리진)이 쓰인다. 이 arg가 남아 있으면 프록시를 우회해 4000 포트를 직접 부른다.
- backend(4000)와 PostgreSQL(5432)은 호스트에 열지 않는다. 웹 포트만 기본 `127.0.0.1:3000`이다(`VM_BIND`, `VM_WEB_PORT`).
- 자동 병합되어 `nginx` 서비스 검증을 깨던 `docker-compose.override.yml`과, 이를 전제로 한 `docker-compose-helper.sh`를 삭제했다.
- backend에는 SIGTERM 핸들러가 없다(`src`에 `enableShutdownHooks`, `process.on('SIGTERM')` 없음). 핸들러 없는 프로세스가 PID 1이면 커널이 SIGTERM을 무시하므로 `exec node`만으로는 부족하다. 그래서 `init: true`(tini)를 PID 1로 두고 `exec`로 node를 그 자식으로 만들었다. 실측은 아래 "init: true 재검증" 표.
- `REDIS_URL`을 환경에 넘길 수 있게 했다. `REDIS_URL`은 쿼리 결과 캐시(`connection.service.ts:97`)와 Bull 작업 큐(`background-job.module.ts:28`)를 함께 켠다. 큐와 `redis-cache.service.ts`는 `REDIS_HOST`도 읽는다. 쓰려면 `REDIS_URL`과 `COMPOSE_PROFILES=cache`를 같이 설정해야 한다.
- 시드 계정 `guest`는 샘플 대시보드가 없다. 샘플은 가입 시 `provisionForUser`(`login.service.ts:119`)가 만든다.
- backend healthcheck를 5초 간격·start_period 120초로 덮어써 첫 실행 대기를 줄이고, 웹은 backend가 healthy일 때만 기동한다.
- 새 스모크 스크립트 `scripts/docker-smoke.sh`: 기동 → 웹 `/healthz` → 프록시 경유 `/v1/health` → guest 로그인(201, accessToken, `jwt_re` 쿠키) → 잘못된 비밀번호 거절 → 정리.

## 설계 검토 (architect, 코드 읽기)

- `Dockerfile.prod`의 `npm prune --omit=dev` 이후에도 `run-seed`가 동작한다. `typeorm-extension`은 타입으로만 쓰여 컴파일 결과에 require가 없고, `dotenv`는 남는다. 엔티티는 `dist`의 `.js` glob으로 찾는다.
- `NODE_ENV=dev`에서는 `production-guard`의 환경 검사만 통과하면 되고 `dev-only-*` 비밀값도 허용된다. 쿠키는 `secure=false`, `sameSite=lax`라 http에서 로그인된다.
- 로그인 성공은 **201**이다(`POST /v1/login/signin`).

## 실제 실행 결과

환경: colima(aarch64) 전용 프로필 4 CPU/6GiB/30GiB, 이미지는 `Dockerfile.prod` 두 개를 이 저장소 변경본으로 직접 빌드. 컨테이너는 compose 파일과 같은 환경변수·명령·healthcheck로 `docker run`으로 연결했다.

| 확인                                                           | 결과                                  |
| -------------------------------------------------------------- | ------------------------------------- |
| backend 이미지 빌드(`Dockerfile.prod`)                         | PASS, 1.3GB                           |
| 웹 이미지 빌드(`Dockerfile.prod`)                              | PASS, 210MB                           |
| PostgreSQL 17 healthy                                          | PASS                                  |
| `NODE_ENV=dev`에서 `run-seed.js` → `main.js`, 스키마 생성·시드 | PASS (`[seed] completed on postgres`) |
| backend healthcheck                                            | PASS (healthy)                        |
| 웹 `/healthz`                                                  | 200                                   |
| 웹 경유 `/v1/health`(nginx 프록시)                             | 200                                   |
| SPA `/`, 딥링크 `/dashboards/1`                                | 200, 200                              |
| guest 로그인                                                   | 201, `accessToken`, `jwt_re` 쿠키     |
| 잘못된 비밀번호                                                | 401                                   |
| 번들에 `localhost:4000` 직접 호출 문자열                       | 0건                                   |
| backend 재시작 후 healthy·로그인                               | PASS (시드 멱등)                      |
| `/data/uploads` 소유자                                         | `node` (non-root 쓰기 가능)           |

## compose 실제 실행 (2026-11-04, architect 차단 항목 해소)

`brew install docker-compose`(Docker Compose 5.7.0, 독립 실행형)로 설치한 뒤 `DOCKER_HOST`로 같은 colima 프로필을 지정하고 `scripts/docker-smoke.sh`를 그대로 실행했다. `docker compose` 플러그인이 없어 스크립트의 폴백(`docker-compose`)이 쓰였다. 이 표의 실행은 `init: true` 추가 전의 compose 파일이다. 최종 파일의 근거는 아래 "init: true 재검증"을 본다.

| 확인                                                                 | 결과                      |
| -------------------------------------------------------------------- | ------------------------- |
| `up -d --build --wait`: postgres → backend → frontend 순서로 Healthy | PASS                      |
| 웹 `/healthz`, 프록시 경유 `/v1/health`                              | PASS (200, 200)           |
| guest 로그인(201, accessToken, `jwt_re` 쿠키), 잘못된 비밀번호 거절  | PASS                      |
| SPA 첫 화면                                                          | PASS (200)                |
| 스크립트 종료 코드·정리(`down -v`)                                   | 0, 컨테이너·볼륨 0개 남음 |

## init: true 재검증 (2026-11-04T04:17Z 시작, architect 지적 반영 후)

기준: 저장소 HEAD `3697c2df`에 미커밋 변경을 얹은 상태. `docker-compose.yml` sha256 `dc07ff6a…a858b`, `scripts/docker-smoke.sh` sha256 `34d83af9…b48`(실행 직후 다시 계산해 같음을 확인). 환경은 위와 같은 전용 colima 프로필(4 CPU/6GiB/30GiB, aarch64), 독립 실행형 `docker-compose` 5.7.0. 실행 후 프로필은 삭제했다.

| 확인                                                                          | 결과                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| `scripts/docker-smoke.sh` 전체(`VM_BIND=127.0.0.1` 고정, 잘못된 비밀번호 401) | PASS, 종료 코드 0                                      |
| postgres → backend → frontend 순서로 Healthy                                  | PASS                                                   |
| `docker-compose stop backend` 소요                                            | 실측 0.317초                                           |
| backend 컨테이너의 PID 1                                                      | `docker-init`(tini). node는 그 자식 프로세스           |
| `docker-compose down -v` 소요                                                 | 실측 0.555초(프론트·postgres 포함, 볼륨·네트워크 제거) |

`init: true` 없이 같은 측정을 한 값은 없다. "init 없이는 10초를 기다린다"는 커널 동작과 코드(핸들러 없음)에서 추론한 것이며 실측하지 않았다.

## 완전 빌드와 브라우저 UI 검증 (2026-11-04T09:18Z 시작)

플러그인 형태의 `docker compose` 호출로 캐시 없이 빌드하고 기본 포트 3000으로 띄운 뒤 브라우저로 확인했다. 임시 설정에 buildx가 없어 classic 빌더로 빌드했다(로그의 `falling back to the classic builder` 경고). Docker Desktop·OrbStack 사용자가 쓰는 BuildKit 경로는 검증하지 않았다.

환경: 위와 같은 전용 colima 프로필(4 CPU/6GiB/30GiB, aarch64). 독립 실행형 `docker-compose` 5.7.0을 임시 `DOCKER_CONFIG/cli-plugins/`에 링크해 `docker compose`로 호출했다(사용자 Docker 설정은 건드리지 않았다). 검증 후 스택과 프로필을 삭제했다. 단 `colima delete`는 VM만 지우고 프로필 전용 데이터 디스크(이미지 캐시·볼륨, 이 프로필은 16GB)는 남긴다. 이 사실을 뒤늦게 발견해 `colima delete -p vm-quickstart -f --data`로 지웠다. 같은 이유로 이 절 이후의 재실행은 처음에 이전 이미지 캐시를 물려받아 실패했다(아래 "깨끗한 VM 재실행" 참고). 이 절의 `--no-cache` 빌드 수치는 영향이 없다.

소스: HEAD `3697c2df` 위의 미커밋 변경. 이미지는 작업 트리에서 빌드했으므로 이번 변경과 무관한 미커밋 파일 `frontend-web/src/pages/Documents/SheetsImport.tsx`도 프런트 이미지에 포함됐다. 실행 직전 해시는 `docker-compose.yml` `dc07ff6a…`, 커밋될 최종 파일은 `7c3b1e1f…`이다. 둘의 차이는 prettier가 `command` 배열을 여러 줄로 바꾼 서식뿐이다. 최종 파일로 `docker compose up -d --wait`를 다시 실행했을 때 컨테이너가 재생성되지 않았다(생성 시각 18:32:13 KST 그대로, 9분 가동). 서비스 설정 해시가 같다는 뜻이다.

| 확인                                    | 결과                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `docker compose version`(플러그인 호출) | Docker Compose version 5.7.0                                                                |
| `docker compose build --no-cache`       | PASS, 13분 19초, 종료 코드 0                                                                |
| `docker compose up -d --wait`           | PASS, 47.5초, 세 서비스 모두 healthy, 웹은 `127.0.0.1:3000`만 게시                          |
| 로그인 화면 렌더(1440/768/390)          | PASS, 가로 넘침 없음                                                                        |
| 폼 입력으로 guest 로그인                | PASS, `/dashboard`로 이동. `127.0.0.1:3000`과 `localhost:3000` 모두                         |
| 로그인 후 API 호출                      | 모두 같은 오리진 `/v1/*`, `:4000` 직접 호출 0건                                             |
| 로그인 후 화면(1440/768/390)            | PASS, 가로 넘침 없음. guest 홈은 비어 있음(문서와 일치)                                     |
| "샘플 대시보드 보기"                    | PASS. `POST /v1/commerce/sample` 201 → `/commerce/1?sample=1`, ECharts 캔버스 2개, KPI 표시 |
| 샘플 대시보드(1440/768/390)             | PASS, 가로 넘침 없음                                                                        |
| `docker compose down -v`                | 실측 1.18초                                                                                 |

스크린샷(`00`~`05` 번호 파일)과 실행 로그(`phaseA-compose-plugin-build-up.log`, `rerun-smoke-init-true.log`)는 저장소 밖 `/Users/moonklabs/workspace-vanilla/phase2-evidence/docker-quickstart/`에 있다. 표의 빌드·기동 시간과 해시는 그 로그에서 나온 값이다. 다음 값은 저장된 로그가 없고 실행 중 도구 출력으로 본 것이다. `down -v` 1.18초, 최종 파일로 `up`을 다시 실행했을 때 재생성되지 않은 것, 브라우저 네트워크 관찰(`:4000` 0건, `POST /v1/commerce/sample` 201, 캔버스 2개), 막힌 요청이 nginx 로그에 없던 것. `05-localhost-login-dashboard-1440.png`는 `02-after-login-1440.png`와 바이트까지 같아서 `localhost` 오리진 로그인의 독립 증거가 아니다. 그 로그인은 스크립트가 출력한 `origin: http://localhost:3000`, `/dashboard`만 근거다.

관찰한 문제와 한계:

- 첫 `localhost:3000` 탭이 로드된 뒤 약 6분간 그 탭에서 `/healthz` GET, 로그인 POST, 새 탭의 `goto`가 모두 타임아웃됐다. 같은 시간에 호스트 `curl`은 1~5ms로 응답했고, `127.0.0.1:3000`을 연 새 탭은 정상이었다. 막힌 요청은 nginx 접근 로그에 없었다. 아무 조치 없이 풀렸고 다시 재현되지 않았다. 원인은 확인하지 못했다. 증거는 호스트 쪽보다 브라우저의 오리진별 상태를 가리킨다(같은 오리진의 새 탭도 막혔고, 호스트 `curl`과 다른 호스트명의 탭은 정상이었으며, 막힌 요청이 nginx에 도달하지 않았다). 후보는 호스트당 HTTP/1.1 연결 한도, 이 앱의 서비스 워커(`serviceWorkerRegistration.ts`)가 첫 방문 직후 하는 이미지 precache, 이 PC의 Colima ssh 포트 포워딩이다. 모두 추정이다. 실제 사용자의 첫 방문에서도 생길 수 있는지는 알 수 없다.
- 샘플 버튼은 도구의 좌표 클릭이 두 번 반응하지 않아 DOM `click()`으로 실행했다. 처음에는 스크롤 애니메이션 중에 좌표를 잡은 도구 쪽 문제로 추정했으나, 뒤의 "깨끗한 VM 재실행과 실제 마우스 클릭" 절에서 좌표를 확정해도 같은 실패가 났고 그 추정은 증거와 맞지 않았다. 클릭 직후 스크린샷(`04a-sample-click-debug.png`)에서 버튼은 hover 색이었고 상태 문구는 busy가 아니었다. 즉 그 클릭 이벤트는 핸들러에 닿지 않았다. DOM `click()`은 화면 위치 판정을 건너뛰므로 버튼을 덮는 투명 오버레이 같은 결함을 잡지 못한다. 그래서 사람 손으로 직접 누르는 경로는 검증하지 못했다.
- 이 브라우저 프로필에 `localhost:3000`, `127.0.0.1:3000`의 서비스 워커 등록과 localStorage 항목이 남았다. 사용자 프로필의 상태를 지우는 것은 하지 않았다.
- 이 브랜치는 앱 코드를 바꾸지 않았으므로 backend·frontend 단위 테스트는 돌리지 않았다. 참고로 `develop`의 2026-11-01 CI 실행(`gh run 41278960041`, `fe71c5ea`)에서 `frontend`, `backend`, `postgres-integration`이 이미 실패했다. 이 브랜치의 HEAD는 그보다 앞서 있으므로 그 실패가 지금도 같다고 단정하지 않는다.

## 깨끗한 VM 재실행과 실제 마우스 클릭 (2026-11-04T09:52Z~10:12Z)

사용자가 치는 명령 `docker compose up --build`를 한 번에 실행했다. 직전 실행의 데이터 디스크를 `--data`로 지운 새 VM이다. 소스 해시는 `docker-compose.yml` `7c3b1e1f…`, `docker-smoke.sh` `34d83af9…`로 커밋될 파일과 같다. 로그는 증빙 폴더의 `phaseC-clean-vm-up-build*.log`.

| 확인                                                                     | 결과                                                                                |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `docker compose up --build -d --wait` (빌드부터 기동까지)                | PASS, 9분 24초, 종료 코드 0, `Using cache` 0건, 세 서비스 healthy                   |
| `docker compose down -v`                                                 | 실측 1.08초                                                                         |
| 키보드(포커스 후 Enter)로 홈의 "SQL 없이 차트 만들기"                    | PASS, `/explore`로 이동                                                             |
| 도구의 일반 마우스 클릭을 이 페이지에 주입한 일반 버튼에 사용            | PASS (pointerdown 1, click 1). 도구의 마우스 입력 자체는 정상                       |
| 도구의 마우스 클릭으로 홈의 "샘플 대시보드 보기", "SQL 없이 차트 만들기" | 실패. 시도마다 클릭이 버튼에 닿지 않았고 `POST /v1/commerce/sample`은 나가지 않았다 |

실패의 관찰 근거는 다음과 같다(원인 확정은 아님).

- 이벤트 추적에서 `pointerdown`과 `mousedown`은 버튼이 받았는데 `pointerup`, `mouseup`, `click`은 부모 카드 `DIV`가 받은 시도가 있었다.
- 다른 시도에서는 `<p role="status" class="mb-4">보고서 접근권을 확인하고 있습니다.</p>` 문단이 약 40ms 동안 나타났다 사라지기를 반복했다. 이 문단이 있는 동안 버튼이 63px 아래로 밀렸다(예: 좌표를 잡을 때 `top=542`, `pointerdown` 시점 `top=605` 또는 `633`). 커서는 이전 위치에 있어 부모 `DIV`가 맞았다.
- 마우스를 가만히 두면 13초 동안 이 문단은 생기지 않았다. 마우스를 움직이면 생겼다. 이 문단의 렌더링 위치는 `frontend-web/src/pages/Dashboard/index.tsx`의 `role="status"` 구간이다.
- 좌표를 확정한 직후 `mouse.down`/`mouse.up`을 보낸 3회는 이 문단이 없는 상태에서도 모두 실패했다. 그래서 이 문단의 레이아웃 이동만으로 모든 실패를 설명하지 못한다.

따라서 확인된 것은 "DOM `click()`과 키보드 Enter는 동작하고, 도구가 보낸 합성 마우스 클릭은 이 화면의 앱 버튼에서 반응하지 않았다"까지다. 사람이 손으로 누르는 경우 실제로 같은 문제가 생기는지는 알 수 없다. 화면 이동 문단의 깜빡임이 사람에게도 클릭 실패를 만들 수 있는지는 후속으로 확인해야 하며, 이번 브랜치가 바꾼 코드가 아니다.

이 재실행에서 드러난 환경 문제:

- 첫 시도는 `RWLayer ... is unexpectedly nil`과 `volume already exists but was not created by Docker Compose` 경고로 실패했다. 원인은 지워지지 않은 데이터 디스크(앞의 설명)였다.
- 두 번째 시도에서 컨테이너는 healthy였는데 호스트 3000 포트가 열리지 않았다. Lima 호스트 에이전트 로그에 `ssh -O forward -L 127.0.0.1:3000:127.0.0.1:3000 ... exit status 255`가 반복됐다. 호스트에는 이전 VM 때부터 남은 `colima-vm-quickstart`의 ssh 마스터 프로세스 3개(시작 09:00, 13:17, 18:51)가 있었고, 이들은 `colima delete`로 정리되지 않았다. 그 프로세스를 종료하면서 현재 VM의 제어 소켓(`ssh.sock`)까지 지워져 포워딩 복구가 더 어려워졌고, 프로필을 `stop`/`start`해서 복구했다.
- 첫 `localhost:3000` 막힘과 이 고아 ssh 마스터가 관련 있는지는 확인하지 못했다. 당시 09:00 시작 마스터는 이미 있었다는 점만 사실이다.

## 확인하지 못한 것

- 사람 손으로 직접 누르는 홈의 버튼 클릭(위 절). 샘플 경로는 DOM `click()`으로만 실행했다.
- amd64 이미지(이번 빌드는 arm64), BuildKit 빌드 경로, 메모리 4GB 미만 환경의 빌드(OOM 가능성은 코드 주석 기준 추측).
- 사람 손으로 직접 누르는 샘플 버튼(DOM `click()`으로만 실행), 첫 방문 직후 `localhost` 탭이 막히는 일의 재현 여부.
- 가입 시 백그라운드로 만들어지는 별도의 시작용 샘플(`provisionForUser`, SQLite 기반 `샘플 매출 데이터`. 홈 버튼의 매출·환불 샘플과 다르다. 실패해도 경고 로그만 남기는 경로라 이 스택에서 실제로 만들어지는지 알 수 없다), AI 어시스턴트, Redis 프로필(`REDIS_URL` + `COMPOSE_PROFILES=cache`).
- 이전 `vanillameta-data` 볼륨(root 소유)이 남은 PC: 새 볼륨 이름(`uploads`)을 써서 충돌하지 않는다는 점은 구성상의 판단이며 실제로 재현하지 않았다.

## 환경에서 만난 문제 (이번 PC 한정)

- `docker run`이 `docker-credential-desktop`을 찾지 못해 이미지를 받지 못했다. Docker Desktop 삭제 후 `~/.docker/config.json`의 `credsStore`가 남은 것으로 추정한다(파일은 읽지 않았다). 빈 `DOCKER_CONFIG`로 우회했다. 같은 증상이면 `credsStore` 항목을 지우거나 Docker를 다시 설치한다.
- 기존 colima 프로필 `vm-m0-build`는 데이터 디스크가 100%라 빌드가 `no space left on device`로 실패했다. 지우지 않고 전용 프로필로 검증했다.

## 알려진 한계

- dev 모드는 TypeORM이 모든 SQL을 로그로 남겨 `docker compose up` 출력이 시끄럽다.
- 이 스택의 DB는 마이그레이션 기록이 없어 `migrate-prod`로 운영에 승격할 수 없다. 쓰고 버리는 체험용이다.
- dev 모드는 `GET /v1/`이 데모 계정을 반환하고 회원가입이 열려 있으며 비밀번호 변경 경로가 없다. 그래서 인터넷 공개용이 아니며 `VM_BIND=0.0.0.0`은 신뢰하는 LAN 한정이다.
- 루트의 `docker-test.sh`, `quick-demo.sh`, `DEMO.md`, `docs/T08_S01_completion_summary.md`는 옛 80포트·`/api/v1` 구성을 가정해 새 스택과 맞지 않는다(이전부터 깨져 있었고 이번 범위 밖, 후속 정리).
- CI에는 compose 스모크 잡이 없다.
- `npx` 한 줄 실행은 제공하지 않는다. `mcp-server`는 `private`이고 `bin`이 없다.
