# 외부 베타 M0 — `deploy/` 스택 증빙

2026-10-23 · Draft / PASS_SELECTED. [계획](../plans/external-beta-launch.md) M0 5번. 런북: [deploy/README.md](../../deploy/README.md).

## 산출물

`deploy/docker-compose.prod.yml`(caddy, web, api, migrate, mysql), `Caddyfile`, `.env.prod.example`, `egress-guard.sh` + `vanillameta-egress-guard.service`, `backup.sh`, `restore-drill.sh`, `README.md`. 코드 변경: `analytics.controller.ts`·`events.controller.ts`가 클라이언트 `X-Forwarded-For` 대신 `req.ip`(= `TRUST_PROXY_HOPS` 반영)를 쓴다. `nginx.prod.conf`는 Docker DNS(`127.0.0.11`)로 API 주소를 주기적으로 다시 해석한다.

## 실행 결과 (colima 전용 Linux VM 8GiB, arm64, 컴포즈 v5.1.4, 사용 후 스택·볼륨·시크릿 삭제)

| 검사 | 결과 |
| --- | --- |
| `docker compose config -q`, 필수 변수 누락 시 `:?` 오류 | 유효 |
| `up -d` 의존 순서 | mysql healthy → migrate 종료(0) → api healthy → web healthy → caddy 시작. 최종 api·web·mysql healthy, migrate `exited 0` |
| `https://localhost`(Caddy 내부 CA) | `/v1/health` 200(HTTP/2), SPA `/` 200, `http://`는 308로 https 리디렉션 |
| 게시 포트 | caddy의 80/443만. web·api·mysql은 EXPOSE뿐 |
| 네트워크 격리 | mysql에서 `1.1.1.1:443` 접속 → `Network is unreachable`. api에서 공용 `https://example.com` → 200 |
| 위조 `X-Forwarded-For: 6.6.6.6`을 붙인 공개 이벤트 요청 | 저장된 `ipAddress`는 `172.19.0.0`(edge 게이트웨이 `172.19.0.1`의 익명화). 위조 값은 무시됨(홉 수 2) |
| API 컨테이너 IP가 바뀌는 재생성(`172.18.0.3`→`172.18.0.6`) 뒤 `web` 재시작 없이 | 캐디 경유 `/v1/health` 200 |
| `egress-guard.sh apply` | 적용·멱등(점프 규칙 1개)·`remove`로 완전 제거. api→공용 200 유지, api→mysql 유지. `10.255.255.1`·`169.254.169.254`·`192.168.77.7`·`172.20.5.5` 접속 시도가 모두 시간 초과이고 DROP 규칙의 패킷 카운터가 증가(10/8·169.254/16·172.16/12·192.168/16 각 7), 공용 RETURN 6. 호스트 IP 직접 접속은 적용 전 응답, 적용 후 시간 초과 |
| `backup.sh`(암호화) | `.tar.enc` 30,752 bytes, JSON 결과 출력 |
| `restore-drill.sh` | `{"restored":true,"tables":83,"migrations":53,"users":0,"duckdbFiles":1}`. 업로드한 `.duckdb`를 읽기 전용으로 열었다 |
| 훈련의 부정 경로 | 잘못된 암호 → `bad decrypt`로 실패. 손상된 archive → `tar` 오류로 실패. 첫 실행은 `.duckdb` 파일이 컨테이너 사용자에게 읽히지 않아 `DRILL FAILED`를 내고 스크립트가 권한을 고치도록 수정 |
| `docker stop api` | 0초, 종료 코드 143(`init: true`가 SIGTERM을 전달) |

## 발견한 문제와 처리

- 복원 훈련이 처음에 `.duckdb`를 열지 못했다. 원인은 `mktemp` 디렉터리 권한(0700)으로 비특권 컨테이너 사용자가 읽지 못한 것이었고 `chmod -R a+rX`로 고쳤다. 훈련이 실패를 제대로 보고하는지는 이 경로로 확인했다.
- 별개로, 이 검증에서 `/v1/v1/events/track`이 `Failed to track events` 오류를 로그에 남겼다(`@Controller('v1/events')`가 전역 프리픽스 `v1`과 겹쳐 경로가 `/v1/v1/events/track`이다). 이번 단위의 범위가 아니라 조사하지 않았다.

## 한계 (미실행·미검증)

- 실제 운영 VM, 실제 DNS와 Let's Encrypt 발급(검증은 `localhost`의 Caddy 내부 CA), amd64 이미지. 이 VM은 arm64다.
- `egress-guard.sh`의 systemd 유닛(재부팅 후 재적용)은 설치·재부팅하지 않았다. Docker 격리 때문에 다른 브릿지의 컨테이너로의 접속은 규칙 없이도 막혀 있어, 규칙의 효과는 패킷 카운터와 호스트 IP 접속 차이로 확인했다.
- `backup.sh`의 S3/R2 업로드(`aws` CLI)와 cron 등록은 실행하지 않았다. 백업은 DuckDB 파일이 쓰이는 중에 복사될 수 있다. 이번 훈련은 쓰기가 없는 파일 1개였다.
- 부정 경로로 "열리지 않는 `.duckdb`"(손상 파일)를 넣어 훈련이 실패하는지는 확인하지 않았다(권한 문제로 실패하는 경로만 확인).
- 로그인·쿠키(운영은 `secure` 쿠키), 스트리밍, 업로드 상한, WebSocket 업그레이드를 이 스택을 통해 실행하지 않았다.
- 고아 `uploads/*` 정리와 디스크 경보(백업 디스크 한정 경고 외)는 구현하지 않았다.
- Node 24 이미지 안의 실행이지만 로컬 jest·빌드 결과는 Node 26이다.
