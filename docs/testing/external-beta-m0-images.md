# 외부 베타 M0 — 운영 이미지 증빙

2026-10-23 · Draft / PASS_SELECTED. [계획](../plans/external-beta-launch.md) M0 4번.

## 산출물

- `backend-api/Dockerfile.prod`: 멀티 스테이지. 빌드 단계에서 `npm ci --legacy-peer-deps`(`@nestjsplus/knex` peer 충돌 때문) → `nest build` → `npm prune --omit=dev`. 런타임은 `node:24-bookworm-slim`, `USER node`, `NODE_ENV=prod`, `FILE_UPLOAD_DIR=/data/uploads`, `CLOUDWATCH_METRICS_ENABLED=false`, `/v1/health` 헬스체크. Oracle Instant Client·`unixodbc`는 넣지 않는다(네트워크 소스가 닫혀 있다).
- `frontend-web/Dockerfile.prod` + `nginx.prod.conf`: SPA를 `REACT_APP_API_URL=/v1`(상대 경로)로 빌드해 어느 도메인에서도 같은 이미지를 쓴다. nginx가 `/v1/`과 `/socket.io/`를 `API_UPSTREAM`(기본 `api:4000`)으로 프록시한다. `/v1/`은 `proxy_buffering off`(NDJSON·이후 SSE), 업로드 상한 110MB, `/healthz`. 빌드 인자 `REACT_APP_MODE=prod`(로그인 화면의 가입 링크 숨김), `REACT_APP_SENTRY_DSN`(`index.tsx`가 이미 지원).
- `frontend-web/src/helpers/socket.ts`: 상대 API URL에서 `new URL('/v1')`이 예외를 내던 것을 `new URL(apiUrl, window.location.origin)`로 수정(`socket.test.ts` 3 tests).
- 기존 `Dockerfile`·`Dockerfile.dev`와 dev compose는 건드리지 않았다.

## 실행 결과 (colima 전용 VM, arm64, 8GiB, 사용 후 컨테이너·네트워크·시크릿 파일 삭제)

| 검사 | 결과 |
| --- | --- |
| 백엔드 이미지 빌드 | 성공, 1.25GB. `odbc`는 설치되지 않았고 `oracledb` 패키지는 들어 있으나 Instant Client(`/opt/oracle`)는 없다 |
| 이미지 내부 | 사용자 `node`, `sqlite3`·`@duckdb/node-api` 로드 성공, `/app`은 `dist node_modules package.json`뿐(`.env*` 없음) |
| 빈 MySQL 8.4에서 `node dist/src/database/migrate-prod.js` | `{"mode":"bootstrapped","recordedMigrations":53}`, 재실행 `{"mode":"migrated","ranMigrations":0}` |
| 컨테이너 기동(운영 가드 통과 환경, 시드 `guest` 없음) | `/v1/health` 200, 재시작 0, 헬스 healthy |
| `POST /v1/login`(없는 경로), `/v1/api-docs` | 404 (운영에서 swagger 닫힘), 보호 API는 401 |
| 웹 이미지 빌드·기동 | healthy. `/healthz`·`/v1/health`(프록시)·`/organizations/*`(CSP `frame-ancestors 'self'`)·SPA 경로 모두 200, `/socket.io/` 폴링 핸드셰이크 성공 |
| 번들 | `baseURL:"/v1"`, `localhost:4000` 0건 |
| `socket.test.ts` | 3 tests PASS. `audit`이 `new URL(apiUrl)`로 되돌리면 상대 경로 케이스가 `Invalid URL`로 실패함을 확인. `frontend-web` 전체 205 files 3309 tests PASS, `tsc`·eslint 통과 |
| 웹 이미지 `nginx:1.28-alpine`(1.28.3), `nginx -t` | 통과. `/index.html`·SPA 폴백은 `Cache-Control: no-cache`, `/organizations/*`은 `no-store` + `Referrer-Policy` |
| 백엔드 이미지 ENV | `FILE_UPLOAD_MAX_BYTES=104857600`(nginx 110MB보다 작게), `CLOUDWATCH_METRICS_ENABLED=false` |

## 발견한 문제와 처리

- `npm run build`는 스펙까지 `tsc --noEmit`으로 검사하는데 `events.controller.spec.ts`가 `../../../frontend-web`을 import해 백엔드 단독 빌드 컨텍스트에서 실패한다. 이미지는 `tsconfig.build.json`(스펙 제외)을 쓰는 `nest build`만 실행한다. 스펙 타입 검사는 CI 몫이다.
- TypeScript 컴파일이 기본 힙과 2GiB VM에서 메모리 부족(`heap out of memory`, 힙 1.7GB 지정 시 커널 OOM)으로 죽는다. `BUILD_HEAP_MB`(기본 3072) 빌드 인자를 두었고, 최소 약 4GiB 이상 메모리의 빌더가 필요하다.
- 운영에서 `CloudWatchMetricsService`가 기본 활성이라 AWS 자격 증명이 없는 VM에서 주기적으로 ERROR를 남긴다. 이미지 기본값을 `CLOUDWATCH_METRICS_ENABLED=false`로 했다.
- `dist/src/i18n`이 빌드 결과에 없다(`i18n.module.ts`가 `__dirname/../../i18n`을 가리킨다). 컨테이너는 정상 기동·응답하고 `I18nContext` 사용은 제거된 상태라 영향이 없다고 보지만, 번역 기능을 되살리면 `nest-cli.json` assets에 추가해야 한다.

## 한계 (미실행·미검증)

- **설정만 있고 실행하지 않은 것**: `proxy_buffering off`로 NDJSON이 즉시 흐르는지, 업로드 한도(nginx 110MB / API 100MiB)에서 413이 어떻게 보이는지, WebSocket **업그레이드**(클라이언트는 websocket을 먼저 시도한다. 확인한 것은 폴링 핸드셰이크뿐). 
- **로그인 흐름**: 프록시를 거친 로그인은 실행하지 않았다. 운영 쿠키는 `secure`라 HTTP인 이 검증 환경에서는 불가능하다. HTTPS 프록시가 붙은 `deploy/` 환경에서 확인한다.
- `backend-api/Dockerfile.prod.dockerignore`(BuildKit 전용)는 이 VM에 buildx가 없어 적용 여부를 확인하지 못했다. 빌드 스테이지에 `.env.dev`·`.env.docker`·`.env.ci`가 복사될 수 있고(최종 이미지에는 없음), CI에서 BuildKit으로 확인한다.

- 이미지는 arm64로 빌드했다. 운영 VM의 아키텍처가 amd64면 CI(buildx)에서 따로 빌드·검증해야 한다(`sqlite3`·`@duckdb/node-bindings` 플랫폼 바이너리 포함). 미실행.
- Node 24 이미지에서의 검증이지만 로컬 jest·build 결과는 Node 26이다.
- 컨테이너 사설 IP 송신 차단, TLS(HTTPS 프록시), 영속 볼륨·백업, 실제 LLM 호출은 `deploy/` 단위에서 한다. 미실행.
