# 외부 베타 M0 — `deploy/` 스택 증빙

2026-10-23 · Draft / PASS_SELECTED. [계획](../plans/external-beta-launch.md) M0 5번. 런북: [deploy/README.md](../../deploy/README.md).

## 산출물

`deploy/docker-compose.prod.yml`(caddy, web, api, migrate, mysql; 로그 회전 10MB×5, mysql 버퍼 풀 512M·상한 1.2GB, api 상한 4GB), `Caddyfile`, `.env.prod.example`, `egress-guard.sh` + `vanillameta-egress-guard.service`, `backup.sh`, `restore-drill.sh`, `README.md`. 코드 변경: `analytics.controller.ts`·`events.controller.ts`가 클라이언트 `X-Forwarded-For` 대신 `req.ip`(= `TRUST_PROXY_HOPS` 반영)를 쓴다. `nginx.prod.conf`는 Docker DNS(`127.0.0.11`)로 API 주소를 주기적으로 다시 해석한다.

## 실행 결과 (colima 전용 Linux VM 8GiB, arm64, 컴포즈 v5.1.4, 사용 후 스택·볼륨·시크릿 삭제)

| 검사 | 결과 |
| --- | --- |
| `docker compose config -q`, 필수 변수 누락 시 `:?` 오류 | 유효 |
| `up -d` 의존 순서 | mysql healthy → migrate 종료(0) → api healthy → web healthy → caddy 시작. 최종 api·web·mysql healthy, migrate `exited 0` |
| `https://localhost`(Caddy 내부 CA) | `/v1/health` 200(HTTP/2), SPA `/` 200, `http://`는 308로 https 리디렉션 |
| 게시 포트 | caddy의 80/443만. web·api·mysql은 EXPOSE뿐 |
| 네트워크 격리 | mysql에서 `1.1.1.1:443` 접속 → `Network is unreachable`. api에서 공용 `https://example.com` → 200 |
| 위조 `X-Forwarded-For: 6.6.6.6`을 붙인 공개 이벤트 요청(`POST /v1/analytics/events`) | 저장된 `ipAddress`는 `172.19.0.0`(edge 게이트웨이 `172.19.0.1`의 익명화). 위조 값은 저장되지 않았다. Caddy가 클라이언트의 `X-Forwarded-For`를 직접 버리므로 이 시험은 홉 수 1(Caddy 주소가 저장됐을 것)을 배제할 뿐 홉 수 2를 증명하지 않는다. `events.controller.ts`의 `req.ip` 변경은 단위 테스트로만 확인했다(`/v1/v1/events/track` 경로는 아래 문제로 이 시험에 쓰지 못했다) |
| API 컨테이너 IP가 바뀌는 재생성(`172.18.0.3`→`172.18.0.6`) 뒤 `web` 재시작 없이 | 캐디 경유 `/v1/health` 200 |
| `egress-guard.sh apply` | 적용·멱등(점프 규칙 1개)·`remove`로 완전 제거. api→공용 200 유지, api→mysql 유지. `10.255.255.1`·`169.254.169.254`·`192.168.77.7`·`172.20.5.5` 접속 시도가 모두 시간 초과이고 DROP 규칙의 패킷 카운터가 증가(10/8·169.254/16·172.16/12·192.168/16 각 7), 공용 RETURN 6. 호스트 IP 직접 접속은 적용 전 응답, 적용 후 시간 초과 |
| `egress-guard.sh` DNS 허용 규칙(리뷰 반영) | 업스트림 리졸버 대상 53/udp·tcp RETURN 규칙이 DROP 앞에 생성되고(2개) 198.18/15·224/4·240/4 DROP이 추가됐다. 적용 후 api에서 이름 해석과 공용 HTTPS 모두 성공. 이 VM의 DNS는 컨테이너 네임스페이스가 아니라 호스트에서 전달돼 해당 규칙의 패킷 카운터는 0이었다. 즉 **클라우드 VM(AWS/GCP 리졸버가 사설/링크로컬 대역)에서의 영향은 검증하지 못했다** |
| `backup.sh`(암호화 필수·스트리밍·api 컨테이너 정지) | 암호 파일이 없으면 거부. api **컨테이너만** `docker stop/start`(compose `stop api`는 이 compose v5.1.4에서는 web·caddy를 멈추지 않았지만 버전에 따라 다를 수 있어 컨테이너를 직접 다룬다). 백업 직후 `ps -a`: api running/healthy, web healthy, mysql healthy, caddy running, migrate exited(재실행 없음). `.tar.enc`(권한 600)만 남고 평문 `.tar`·`.partial`·`.work` 없음. 동시 실행은 `flock`으로 거부 |
| `backup.sh` 자가 복구·플래그(최종 리뷰 반영) | api가 멈춘 채(이전 실행이 죽은 상황)이고 `.work.leftover`·`*.partial` 잔여물이 있을 때 `BACKUP_QUIESCE=TRUE`로 실행 → JSON 출력과 `.tar.enc` 생성 확인, api가 running/healthy로 복귀, 잔여물 0. `BACKUP_QUIESCE=off`는 `quiesced:false`. 종료 코드는 `tail` 파이프 때문에 확인하지 못했다(건강 대기 시간 초과 시 종료 코드 6 경로는 시험하지 않았다) |
| `restore-drill.sh`(모든 컬럼 해시, TCP ping) | `{"restored":true,"tables":83,"migrations":53,"users":0,"duckdbFiles":1}`. 50만 행 테이블(약 9MB)의 `.duckdb`를 `bit_xor(hash(COLUMNS(*)))`로 전부 읽었다 |
| 훈련의 부정 경로 | 잘못된 암호 → `bad decrypt`로 실패. 손상된 archive → `tar` 오류로 실패. 유효하지 않은 `.duckdb`(40KB 난수)가 든 백업 → `DRILL FAILED`. 정상 파일의 가운데 8KB를 난수로 덮은 백업(약 9MB 파일의 4MB 지점) → `Corrupt database file: computed checksum ... does not match stored checksum`으로 `DRILL FAILED`(헤더가 아니라 데이터 블록 손상도 잡는다). 첫 실행은 `.duckdb` 파일이 컨테이너 사용자에게 읽히지 않아 `DRILL FAILED`를 내고 스크립트가 권한을 고치도록 수정 |
| `docker stop api` | 0초, 종료 코드 143. `init: true`는 신호를 전달하지만 API에 SIGTERM 핸들러(`enableShutdownHooks`)가 없어 처리 중인 요청·업로드가 끊긴다(알려진 한계. `stop_grace_period: 30s`는 현재 효과 없음) |

## 발견한 문제와 처리

- 복원 훈련이 처음에 `.duckdb`를 열지 못했다. 원인은 `mktemp` 디렉터리 권한(0700)으로 비특권 컨테이너 사용자가 읽지 못한 것이었고 `chmod -R a+rX`로 고쳤다. 훈련이 실패를 제대로 보고하는지는 이 경로로 확인했다.
- 별개로, 이 검증에서 `/v1/v1/events/track`이 `Failed to track events` 오류를 로그에 남겼다(`@Controller('v1/events')`가 전역 프리픽스 `v1`과 겹쳐 경로가 `/v1/v1/events/track`이다). 이번 단위의 범위가 아니라 조사하지 않았다.

## 한계 (미실행·미검증)

- 실제 운영 VM, 실제 DNS와 Let's Encrypt 발급(검증은 `localhost`의 Caddy 내부 CA), amd64 이미지. 이 VM은 arm64다.
- `egress-guard.sh`의 systemd 유닛(재부팅 후 재적용)은 설치·재부팅하지 않았다. Docker 격리 때문에 다른 브릿지의 컨테이너로의 접속은 규칙 없이도 막혀 있어, 규칙의 효과는 패킷 카운터와 호스트 IP 접속 차이로 확인했다.
- api 건강 대기 시간 초과 경로(종료 코드 6), Parquet의 VARIANT/GEOMETRY 열이 든 `.duckdb`의 해시 스캔은 시험하지 않았다.
- `backup.sh`의 S3/R2 업로드(`aws` CLI)와 cron 등록은 실행하지 않았다. `BACKUP_QUIESCE=false`면 백업이 DuckDB 파일이 쓰이는 중에 복사될 수 있다(기본값 true는 api를 멈춘다).
- 파일 가운데가 손상된 `.duckdb`는 훈련이 잡는다(위). 다만 **실제로 쓰는 도중 복사된** 파일은 만들어 보지 않았다. 백업은 api를 멈춘 상태에서 복사하며 `BACKUP_QUIESCE=false`면 그 위험이 돌아온다.
- 백업 암호화는 `openssl enc -aes-256-cbc -pbkdf2 -iter 600000`(무결성 인증이 없다. 내부 `SHA256SUMS`는 우발적 손상만 잡는다). `age`/`gpg` 전환은 후속이다.
- 키 보관: `.env.prod`와 백업 암호를 VM 밖에 두는 절차는 문서화만 했고 별도 보관소는 정해지지 않았다.
- 로그인·쿠키(운영은 `secure` 쿠키), 스트리밍, 업로드 상한, WebSocket 업그레이드를 이 스택을 통해 실행하지 않았다.
- 고아 `uploads/*` 정리와 디스크 경보(백업 디스크 한정 경고 외)는 구현하지 않았다.
- Node 24 이미지 안의 실행이지만 로컬 jest·빌드 결과는 Node 26이다.

## 배포 워크플로 · `release.sh` (2026-10-23, 같은 VM)

| 검사 | 결과 |
| --- | --- |
| `actionlint`(rhysd/actionlint 컨테이너) `deploy.yml` | 통과(처음엔 미사용 변수 `i` 경고 1건 → 수정). 액션은 커밋 SHA로 고정(`checkout` v7.0.1, `setup-buildx` v4.4.1, `login` v4.6.0, `build-push` v7.4.0) |
| `shellcheck`(koalaman/shellcheck) `backup.sh`, `restore-drill.sh`, `egress-guard.sh`, `release.sh` | `backup.sh`의 SC2016 정보 1건(컨테이너 안에서 확장되는 변수라 의도된 것, 주석으로 명시). 그 외 지적 없음 |
| 로컬 레지스트리(`registry:2`)를 쓴 `release.sh` | 잘못된 입력(`release ../etc`, `release t2 bad;user`, `deploy t2`, 태그 없음) 모두 거부 |
| `release t2`(t1에서) | 사전 백업 1건 생성 → pull → `up -d` → api·web healthy → `{"released":"t2","previous":"t1"}`, `IMAGE_TAG=t2` |
| 존재하지 않는 태그 / 일부 이미지만 있는 태그 | `pull failed; still on t2`, 종료 코드 1, `IMAGE_TAG`와 실행 중인 스택 불변 |
| 기동 직후 죽는 api 이미지(`t3`) | `did not become healthy` → `rolling back to t2` → `rolled back to t2; t3 was NOT released`, 종료 코드 1. 이후 api·web `t2` healthy, `https://localhost/v1/health` 200 |
| 동시에 두 번 실행 | `another release is running` |

| 레지스트리 로그인 경로(`RELEASE_REGISTRY=localhost:5000`, 임시 토큰, 사용자 `github-actions[bot]`) | 임시 `DOCKER_CONFIG`로 로그인하고 compose 플러그인을 계속 찾았으며(심볼릭 링크) `{"released":"t2",...}` 성공. VM의 실제 `~/.docker/config.json` 불변, 임시 디렉터리 잔존 0. 레지스트리 사용자만 있고 토큰이 없으면 `registry user given but no token on stdin`으로 거부 |
| 전환 도중 중단(SIGTERM), 레지스트리 사용자 없이 | 지속적으로 healthy가 되지 않는 이미지(`t4`)로 릴리스 중 `IMAGE_TAG=t4` 상태에서 프로세스에 SIGTERM → `interrupted: restoring t2`, 이후 `IMAGE_TAG=t2`, api·web healthy, 공개 200 (종료 코드 143). 이 시험은 운영자 `DOCKER_CONFIG`를 쓴 경우라 임시 설정 삭제 순서 버그(리뷰 B1)는 드러나지 않았다 |
| 전환 도중 중단(SIGTERM), **레지스트리 사용자 있이**(임시 설정 사용) | `rm -rf` 순서를 복구 뒤로 옮긴 코드로 `IMAGE_TAG=t4` 상태에서 SIGTERM → `interrupted: restoring t1` → `IMAGE_TAG=t1`, api·web healthy, 공개 200, 임시 디렉터리 잔존 0. 이 VM의 compose는 시스템 플러그인 경로(`/usr/libexec/docker/cli-plugins`)에도 있어 순서 버그가 실제로 증상을 냈을지는 이 환경에서 재현할 수 없다(순서 수정은 코드 검토에 근거) |
| 읽는 쪽이 닫힘(`./release.sh 2>&1 \| head -1`) | 릴리스는 끝까지 진행돼 `IMAGE_TAG=t1`, api·web healthy. 단계 기록은 VM의 `release.log`에 남음(stdout JSON은 닫힌 파이프로 유실). 실제 SSH 연결 끊김·Actions 취소는 시험하지 않았다 |
| 레지스트리 토큰 저장 확인(`config.json`에 `auth`가 있어야 함) | 로컬 레지스트리 로그인에서 통과. 자격 증명 도우미가 있는 호스트에서 거부되는 경로는 시험하지 않았다 |
| 기동 직후 죽는 이미지(`t3`) 재검증 | 변경된 코드로도 `rolled back to t2`, 종료 코드 1, 공개 200 |
| `actionlint`, `shellcheck`(`backup.sh`·`restore-drill.sh`·`egress-guard.sh`·`release.sh`) 재실행 | 둘 다 지적 없음(`SC2016` 지시자, `SC2329` 지시자 포함) |

**관찰**: 중단된 릴리스의 자식 프로세스(`docker compose`)가 잠금 파일 기술자를 상속해 끝날 때까지 새 릴리스를 `another release is running`으로 막는다. 의도한 직렬화로 보이지만 중단 직후 곧바로 재시도하면 잠시 거부될 수 있다.

**한계 (미실행)**: `DEPLOY_*`가 환경 시크릿이고 환경이 `develop`/`v*`만 허용하는지(GitHub 설정)는 확인할 수 없다. 실제 GitHub Actions 실행(GHCR 푸시, `GITHUB_TOKEN`으로 `docker login`, 환경 승인, SSH 포스 커맨드, 호스트 키 고정, 공개 URL 스모크)은 한 번도 하지 않았다. `amd64` 빌드, `gha` 캐시 동작, 워크플로 권한 범위, 실제 `authorized_keys`의 `restrict,command=` 강제 실행과 stdin 토큰 전달, 레지스트리 로그인 경로는 실제 GHCR 로그인은 검증하지 못했다(로컬 레지스트리로 대체). `release.sh`의 롤백은 이미지만 되돌리며 이미 실행된 마이그레이션은 되돌리지 않는다. 사전 백업은 api를 잠시 멈춘다.

