# Docker로 실행하기

VanillaMeta를 명령어 한 줄로 띄워 체험하는 방법이다. 운영 배포는 [`deploy/README.md`](deploy/README.md)를 따른다.

## 한 줄 실행

```bash
docker compose up --build
```

- 필요한 것: Docker Compose v2, 빌드용 메모리(컴파일 힙을 3GB로 잡아 두었으므로 Docker에 4GB 이상을 권한다. 실측하지는 않았다).
- 첫 실행은 이미지 두 개(백엔드, 웹)를 빌드해 10분 넘게 걸릴 수 있다(4 CPU, 캐시 없음에서 9~13분 실측). 다음부터는 캐시를 쓴다.
- 접속: http://localhost:3000, 계정 `guest` / `Admin!@12`.
- 시드 계정 `guest`의 홈은 비어 있다. 시작 카드의 **샘플 대시보드 보기** 버튼으로 매출·환불 샘플을 열 수 있고, 가입할 때 백그라운드로 만들어지는 별도의 시작용 샘플 대시보드는 이 스택에서 확인하지 않았다.
- `docker compose`가 없다는 오류가 나면(예: Colima에 brew로 설치한 독립 실행형 `docker-compose`) 같은 엔진인 `docker-compose up --build`를 쓴다. `scripts/docker-smoke.sh`는 둘 다 찾아 쓴다.

## 구성

| 서비스     | 이미지                                            | 역할                                                                       |
| ---------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| `frontend` | `frontend-web/Dockerfile.prod` (nginx)            | SPA 서빙, `/v1`·`/socket.io`·`/.well-known/oauth-*` 를 backend로 프록시    |
| `backend`  | `backend-api/Dockerfile.prod` (Node 24, non-root) | 부팅 때 스키마 동기화와 데모 계정 시드(멱등) 후 API 기동, 업로드는 `/data` |
| `postgres` | `postgres:17-alpine`                              | 메타데이터 저장소                                                          |
| `redis`    | `redis:7-alpine` (`--profile cache`, 선택)        | 쿼리 결과 캐시                                                             |

브라우저는 3000 포트 하나만 쓴다. backend(4000)와 PostgreSQL(5432)은 호스트에 열지 않으므로 다른 프로그램과 포트가 겹치지 않는다. DB를 직접 보려면 `docker compose exec postgres psql -U vanillameta`.

## MCP와 AI 키

서버 AI를 설정하지 않은 스택에서 로컬 MCP 서버로 확인한 것은 소스 목록·스키마 조회와 파일 업로드이다([검증](docs/testing/docker-quickstart.md)). 분석안 생성(`vm_propose_analysis`)은 서버 AI가 설정되어 있어야 하고, 설정이 없으면 `503`으로 거부된다. 저장 도구(`vm_save_analysis`)도 서버가 만든 제안의 ID만 받으므로(코드 읽기, 실행하지 않음) 외부 AI가 직접 만든 분석을 저장하는 경로는 없다. 즉 서버 AI 없이는 조회와 업로드까지만 된다. 앱 안에 AI 설정 화면은 없고 환경변수로만 설정하며, 쓸 모델은 `AI_MODEL`로 명시한다.

로컬 MCP 서버는 컨테이너가 아니라 PC에서 도는 별도 프로세스이다(Node 24.11 이상 24.x). 4000 포트는 열려 있지 않으므로 [`mcp-server/README.md`](mcp-server/README.md)의 주소 대신 웹 프록시를 쓴다. 실행에서 확인한 값은 환경변수 `VM_API_URL=http://127.0.0.1:3000/v1`, `VM_WEB_URL=http://127.0.0.1:3000`이다. `login.js`에 같은 주소를 `--api-url`, `--web-url`로 주는 것은 권장이며 실행하지 않았다.

MCP 분석 대상은 DuckDB 소스(CSV·JSON·Parquet 업로드 등)이다. 외부 DB는 연결 저장은 되지만 `unsupported`로 표시된다. 또 knex 기반 외부 DB의 연결 테스트는 `Tarn: invalid opt.idleTimeoutMillis 0` 오류로 실패한다(알려진 결함, 미수정. PostgreSQL은 실행으로 확인했고 다른 엔진은 코드 읽기 추정). 원격 MCP(`/v1/mcp`)는 이 compose에 설정이 없어 시험하지 않았다.

## 자주 쓰는 명령

```bash
docker compose up --build -d      # 백그라운드 실행
docker compose logs -f backend    # 로그 (dev 모드라 SQL이 모두 출력되어 시끄럽다)
docker compose down               # 종료 (데이터 유지)
docker compose down -v            # 종료 + DB·업로드 초기화
scripts/docker-smoke.sh           # 빌드→기동→프록시→로그인까지 자동 확인 후 정리
KEEP=1 scripts/docker-smoke.sh    # 확인 후 스택을 남겨 직접 열어 보기
```

## 설정

변수는 모두 기본값이 있다. 바꾸려면 [`.env.example`](.env.example)을 `.env`로 복사한다.

- 웹 포트: `VM_WEB_PORT=8080`과 `CORS_ORIGIN=http://localhost:8080`을 함께 바꾼다.
- 외부 접속: 기본은 `127.0.0.1`만 연다. 이 스택은 인터넷 공개용이 아니다. dev 모드는 `GET /v1/`이 데모 계정을 알려 주고 회원가입도 열려 있으며 `guest` 비밀번호를 바꾸는 화면도 없다. 신뢰하는 LAN에서만 `VM_BIND=0.0.0.0`을 쓰고, 그때도 `dev-only-*` 비밀값 5개는 처음 띄우기 전에 바꾼다. `CONFIG_SECRET_KEY`는 저장된 연결 정보를 암호화하므로 나중에 바꾸면 기존 데이터를 읽지 못해 `docker compose down -v`가 필요하다. 공개 배포는 [`deploy/`](deploy/README.md)를 쓴다.
- AI 어시스턴트: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`(필요하면 `AI_API_BASE_URL`). 비워 두면 AI 기능만 꺼진다.
- 캐시: `.env`에 `REDIS_URL=redis://redis:6379`와 `COMPOSE_PROFILES=cache`를 함께 넣고 `docker compose up --build`. `REDIS_URL`은 쿼리 결과 캐시와 백그라운드 작업 큐(Bull)를 함께 켠다. `REDIS_URL`만 넣고 프로필을 켜지 않으면 존재하지 않는 `redis` 호스트에 연결하려 해 로그에 오류가 쌓인다.

## 알아 둘 점

- 이 스택은 `NODE_ENV=dev`다. 스키마를 동기화로 만들기 때문에 마이그레이션 기록이 없고, `migrate-prod`로 운영에 승격할 수 없다. 쓰고 버리는 체험용이다.
- 운영 이미지가 `NODE_ENV=prod`면 `guest` 시드 행이 있는 DB의 부팅을 거부한다. 체험 스택의 볼륨을 운영에 재사용하지 않는다.
- 첫 빌드에서 `JavaScript heap out of memory`가 나면 Docker 메모리를 4GB 이상으로 올린다.
- 예전 이미지(root 실행)가 만든 `vanillameta-data` 볼륨은 더 이상 쓰지 않는다. 이 스택의 업로드 볼륨 이름은 `uploads`이며 `docker volume rm <프로젝트>_vanillameta-data`로 지워도 된다.
- `npx` 한 줄 실행은 제공하지 않는다. 앱이 서버와 PostgreSQL을 함께 요구한다. MCP 서버(`mcp-server/`)는 별도 로컬 프로세스이며 아직 npm에 게시하지 않았다.

## 개발 모드

소스 핫 리로드가 필요하면 컨테이너 대신 직접 실행한다. [README의 Local development](README.md#local-development)와 [AGENTS.md](AGENTS.md)를 따른다.
