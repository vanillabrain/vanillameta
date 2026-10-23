# 운영 배포 (단일 VM + Docker Compose)

외부 초대 베타용 스택이다. 전략·계획: [docs/strategy/external-beta.md](../docs/strategy/external-beta.md), [docs/plans/external-beta-launch.md](../docs/plans/external-beta-launch.md). 검증 증빙: [docs/testing/external-beta-m0-deploy.md](../docs/testing/external-beta-m0-deploy.md).

```
인터넷 → caddy(80/443, TLS) → web(nginx) → api(:4000) → mysql
                                              ↘ 외부 LLM (egress 네트워크만)
```

- 포트는 caddy만 연다. `app` 네트워크는 `internal`이라 mysql·web·migrate는 바깥으로 나가지 못한다. api만 `egress` 네트워크로 나가며 `egress-guard.sh`가 사설·링크로컬 주소를 막는다.
- **인스턴스는 하나만 둔다.** 게시 티켓·실행 멱등성 등 일부 상태가 프로세스 메모리에 있다.
- API가 앞단 프록시 2개(caddy, web nginx) 뒤에 있으므로 `TRUST_PROXY_HOPS=2`가 compose에 고정돼 있다. 프록시 구성을 바꾸면 이 값을 함께 바꾼다(틀리면 IP 위조 또는 전 사용자 단일 throttle 버킷).

## VM 요구 사항

- 메모리 8GB 이상(API는 힙 2.5GB + DuckDB 작업자 메모리로 상한 4GB, MySQL 상한 1.2GB), 디스크 40GB 이상, Docker Engine + compose 플러그인.
- 도메인의 **A 레코드만** 이 VM을 가리키게 한다(Let's Encrypt). AAAA를 두면 Docker가 IPv6를 게이트웨이 주소로 보이게 해 모든 IPv6 사용자가 한 요청 한도 버킷에 묶인다. 80/443이 열려 있어야 한다.

## 첫 배포

```bash
cd /opt/vanillameta/deploy
cp .env.prod.example .env.prod && chmod 600 .env.prod   # 모든 값을 채운다(시크릿은 openssl rand -hex 32)
sudo install -d -m 700 /etc/vanillameta && openssl rand -base64 48 | sudo tee /etc/vanillameta/backup.pass >/dev/null && sudo chmod 600 /etc/vanillameta/backup.pass
                                                          # 백업 암호 파일. 없으면 매일 밤 backup.sh가 종료 코드 2로 실패한다. 이 암호는 VM 밖에도 보관한다
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
sudo ./egress-guard.sh apply                              # + vanillameta-egress-guard.service 설치(재부팅 후 재적용)
                                                          # 클라우드 VM 종류마다 DNS 동작이 다르다: apply 뒤 api에서 외부 호스트 이름 해석을 확인한다
docker compose --env-file .env.prod -f docker-compose.prod.yml ps -a   # migrate는 exited(0), 나머지는 healthy
```

`migrate`가 빈 DB를 만들고(엔티티 + 참조 데이터 + 마이그레이션 53건 기록) 이후에는 대기 중인 마이그레이션만 실행한다. 테이블은 있는데 기록이 없는 스키마는 거부하고 비정상 종료하며, 이 경우 `api`는 시작하지 않는다. 운영 가드(`production-guard.ts`)는 약한 시크릿·`CORS_ORIGIN` 누락·`AI_PROVIDER=codex`·`guest` 계정·`QUERY_ALLOW_WRITE=true`면 `api` 부팅을 거부한다.

## 업데이트와 되돌리기

기본 경로는 아래 "배포 워크플로"다. 손으로 할 때는 VM에서 `SSH_ORIGINAL_COMMAND="release <tag>" ./release.sh`(또는 `./release.sh release <tag>`)를 실행한다. `release.sh`는 (1) 직전 태그를 기억하고 (2) 사전 백업을 만들고(실패하면 중단) (3) 이미지를 받고 (4) `up -d`로 `migrate`를 먼저 돌린 뒤 api·web이 healthy가 될 때까지 기다려 `/v1/health`를 확인하고 (5) 실패하면 **직전 태그로 되돌린다**. 되돌림은 이미지만 되돌린다. 이미 적용된 마이그레이션은 되돌리지 않으므로, 스키마를 호환되지 않게 바꾼 릴리스는 사전 백업으로 복원해야 한다.

## 배포 워크플로 (`.github/workflows/deploy.yml`)

`workflow_dispatch` 또는 `v*` 태그 푸시로만 시작한다(일반 푸시로는 배포하지 않는다). `images` 작업이 `backend-api/Dockerfile.prod`, `frontend-web/Dockerfile.prod`를 `linux/amd64`로 빌드해 `ghcr.io/<owner>/vanillameta-{api,web}:<tag>`로 푸시하고(태그 푸시면 그 태그, 아니면 `sha-<12자리>`), `deploy` 작업이 VM에 SSH로 `release.sh`를 실행한 뒤 공개 URL을 확인한다. `deploy` 작업은 `develop` 브랜치나 `v*` 태그에서만 돈다.

**GitHub에 등록할 값** (값은 직접 등록한다. 저장소에 쓰지 않는다)

`DEPLOY_*` 값은 반드시 **`production-beta` 환경 시크릿**으로 등록한다(저장소 시크릿 금지). 저장소 시크릿이면 쓰기 권한이 있는 사람이 워크플로를 고친 브랜치에서 환경 없이 키를 읽을 수 있어 필수 검토자가 아무것도 막지 못한다.

| 종류 | 이름 | 내용 |
| --- | --- | --- |
| environment secret | `DEPLOY_SSH_KEY` | 배포 전용 ed25519 개인키(`ssh-keygen -t ed25519 -f deploy_key -N ""`). 다른 용도로 쓰지 않는다 |
| environment secret | `DEPLOY_HOST`, `DEPLOY_USER` | VM 주소와 배포 계정 |
| environment secret | `DEPLOY_KNOWN_HOSTS` | VM의 호스트 키 줄. 신뢰할 수 있는 경로에서 `ssh-keyscan -t ed25519 <호스트>`로 얻고 지문을 VM에서 `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`로 대조한다 |
| variable | `APP_URL` | 예: `https://app.example.com` (배포 뒤 스모크 테스트와 환경 링크) |
| variable | `DEPLOY_PORT`(선택), `SENTRY_DSN_WEB`(선택) | SSH 포트, 프런트엔드 Sentry DSN(빌드 인자) |

**환경과 태그 규칙** (Settings)
- Environments → `production-beta`: 필수 검토자를 지정하고 **허용 브랜치/태그를 `develop`과 `v*`로 제한**한다.
- Rulesets → 태그 규칙: `v*` 태그는 관리자만 만들 수 있게 한다. 아니면 쓰기 권한이 있는 누구나 `v-아무거나` 태그로 워크플로를 시작할 수 있고 검토자만 남는다.
- 이미지 푸시에는 `GITHUB_TOKEN`의 `packages: write`가 쓰인다. `images` 작업의 `develop`/`v*` 조건은 워크플로를 고치지 않은 실행에만 적용되는 편의이며 보안 경계가 아니다(이 작업은 환경이 없다). VM 접근만 환경이 지킨다. 이미 수동으로 올린 같은 이름의 패키지가 있으면 패키지 설정 → Actions access에 이 저장소를 추가해야 푸시가 된다.

**VM 쪽 준비** (한 번)

```bash
sudo useradd -m -s /bin/bash deploy && sudo usermod -aG docker deploy   # docker 그룹 = 사실상 root. 키를 아래처럼 제한한다
sudo -u deploy install -d -m 700 /home/deploy/.ssh
# 배포 키는 release.sh만 실행할 수 있다(셸·포트 포워딩·에이전트 모두 불가):
echo 'restrict,command="/opt/vanillameta/deploy/release.sh" ssh-ed25519 AAAA... github-deploy' \
  | sudo -u deploy tee /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy: /opt/vanillameta
```

- 워크플로가 레지스트리 토큰(`GITHUB_TOKEN`, 작업이 끝나면 만료)을 SSH 표준 입력으로 보낸다. `release.sh`는 그 토큰을 **임시 도커 설정 디렉터리**에서만 쓰고 끝나면 지운다. VM의 `~/.docker/config.json`은 건드리지 않으므로 장기 토큰이 VM에 남지 않고, 직접 해 둔 `docker login`도 덮어쓰이지 않는다. 호스트에 도커 자격 증명 도우미(`pass`, `secretservice`)가 있어 토큰이 임시 설정 밖에 저장되려 하면 `release.sh`가 로그아웃하고 거부한다.
- 첫 배포(`.env.prod`의 `IMAGE_TAG`가 비어 있을 때)는 사전 백업이 없다. 워크플로 전에 위 "첫 배포" 절차로 스택을 한 번 올리는 것을 권한다.
- Actions가 안 될 때 손으로 릴리스(또는 롤백)하려면 VM의 배포 계정으로 `docker login ghcr.io`를 읽기 권한 PAT로 한 번 해 둔다. 워크플로 경로와 독립이다.
- **워크플로는 VM의 `docker-compose.prod.yml`·`Caddyfile`·`release.sh`를 갱신하지 않는다.** 이미지 계약이 바뀌는 릴리스(새 환경변수, compose 변경)는 먼저 `/opt/vanillameta`의 체크아웃을 `git pull`로 갱신하고 `.env.prod`를 맞춘 뒤 배포한다.
- `deploy` 계정은 `docker` 그룹이라 사실상 root와 같다. 키를 `restrict,command=`로 제한했으니 그 키로는 `release.sh`만 실행되지만, 스크립트와 `authorized_keys`가 그 계정 소유이면 `release.sh`의 버그나 탈취가 곧 VM 장악이 된다. 가능하면 `release.sh`와 `authorized_keys`는 root 소유(644)로 두는 구성을 검토한다(이 경우 `.env.prod`·`.release.lock`·`release.log` 위치를 분리해야 한다. 아직 하지 않았다).
- `release.sh`는 `set -e` 실패나 `kill`로 중단되고 이미지 전환 도중이었다면 직전 태그로 되돌리려 시도한다(복구 트랩). **SSH 연결이 끊기거나 Actions 작업이 취소돼도 스크립트는 멈추지 않을 것으로 본다**(강제 명령에는 PTY가 없어 sshd가 신호를 보내지 않고 스크립트는 HUP/PIPE를 무시한다. 읽는 쪽이 닫힌 경우만 시험했고 실제 SSH 끊김은 시험하지 않았다). 이때 Actions는 실패로 보이지만 VM은 새 태그를 올렸거나 되돌린 상태일 수 있으므로, 결과는 VM의 `deploy/release.log`(시작 시각과 `released <tag>` 또는 `ERROR` 줄이 남는다. 회전하지 않으므로 logrotate를 건다. GNU coreutils의 `tee -p`가 필요하다)와 `docker compose ps`로 확인한다. 연결이 끊긴 상태에서 compose가 올바르게 동작하는지는 시험하지 않았다.

## 백업과 복원 훈련

```bash
# cron: 17 3 * * *  /opt/vanillameta/deploy/backup.sh >> /var/log/vanillameta-backup.log 2>&1
./backup.sh            # api를 잠시 멈추고 mysqldump + uploads 볼륨 → 체크섬 포함 tar를 암호화 파일로 직접 기록(+S3/R2)
BACKUP_PASSPHRASE_FILE=... ./restore-drill.sh /var/backups/vanillameta/vanillameta-<시각>.tar.enc <api 이미지>
```

복원 훈련의 api 이미지는 운영 파일을 쓴 것과 같거나 더 새로운 것이어야 한다(오래된 이미지는 저장소 버전 차이로 실패한다).

- 아카이브는 **항상 암호화**한다(`BACKUP_PASSPHRASE_FILE` 필수). 사용자 계정·비밀번호 해시·암호화된 소스 설정·업로드 데이터가 모두 들어 있다. 평문 **아카이브**는 쓰지 않는다. 작업용 임시 파일(`db.sql.gz`, `uploads.tar.gz`)은 0700 디렉터리에 평문으로 있다가 종료 시 지워지고, 강제 종료로 남은 것은 다음 실행 시작 때 지운다.
- 기본값으로 덤프와 복사 동안 api 컨테이너만 멈춘다(compose 서비스 단위 `stop`은 의존하는 web·caddy까지 멈출 수 있어 컨테이너를 직접 다룬다)(DuckDB는 단일 쓰기 프로세스라 쓰는 중에 복사하면 깨질 수 있다). 중지 시간은 덤프와 복사 시간이며, API에 SIGTERM 핸들러가 없어 **그 시점에 처리 중인 요청·업로드·DuckDB 작업이 끊긴다**(아래 알려진 한계). `BACKUP_QUIESCE=false`로 끌 수 있지만 그러면 복원 훈련으로만 신뢰한다. 배포·업데이트와 겹치지 않게 한다(`flock`으로 백업끼리는 겹치지 않는다).
- 복원 훈련은 운영 스택을 건드리지 않고 임시 MySQL에 덤프를 올린 뒤 모든 `.duckdb` 파일을 읽기 전용으로 열어 **모든 테이블의 모든 컬럼을 해시한다**(`count(*)`는 메타데이터로 답해 찢어진 블록을 못 잡는다). 출시 전에 한 번, 이후 정기적으로 실행한다.

## 키 보관 (복구 가능성의 전제)

복원에는 **`.env.prod`(특히 `CONFIG_SECRET_KEY`: 저장된 소스 비밀번호를 복호화한다)와 백업 암호**가 모두 필요하다. 둘 다 이 VM에만 있으면 VM을 잃을 때 외부 백업을 풀 수 없다. 두 값을 **VM 밖에, 백업 버킷과도 분리된 곳**(예: 팀 비밀 관리자)에 보관하고, 복원 훈련을 그 사본만으로 한 번 해 본다.

## 알려진 한계

- API는 SIGTERM 핸들러(`enableShutdownHooks`)가 없어 `docker stop`이 즉시(종료 코드 143) 끝난다. 배포·재시작 때 처리 중인 요청과 업로드가 끊긴다(`stop_grace_period`는 지금 효과가 없다).
- 부팅 직후 컨테이너가 egress-guard 유닛보다 먼저 올라오는 짧은 시간이 있다. Docker의 nftables 백엔드에는 `DOCKER-USER` 체인이 없어 이 스크립트가 동작하지 않는다.
- 로그는 서비스당 10MB × 5개로 회전하지만 디스크 경보는 백업 디스크 80%/90%뿐이다.

## 아직 이 디렉터리가 하지 않는 것

고아 `uploads/*` 정리, 다중 인스턴스, 메트릭 대시보드, 실제 GitHub에서 워크플로를 한 번도 실행하지 않았다는 점(증빙 문서 참고).
