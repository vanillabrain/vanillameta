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
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
sudo ./egress-guard.sh apply                              # + vanillameta-egress-guard.service 설치(재부팅 후 재적용)
                                                          # 클라우드 VM 종류마다 DNS 동작이 다르다: apply 뒤 api에서 외부 호스트 이름 해석을 확인한다
docker compose --env-file .env.prod -f docker-compose.prod.yml ps -a   # migrate는 exited(0), 나머지는 healthy
```

`migrate`가 빈 DB를 만들고(엔티티 + 참조 데이터 + 마이그레이션 53건 기록) 이후에는 대기 중인 마이그레이션만 실행한다. 테이블은 있는데 기록이 없는 스키마는 거부하고 비정상 종료하며, 이 경우 `api`는 시작하지 않는다. 운영 가드(`production-guard.ts`)는 약한 시크릿·`CORS_ORIGIN` 누락·`AI_PROVIDER=codex`·`guest` 계정·`QUERY_ALLOW_WRITE=true`면 `api` 부팅을 거부한다.

## 업데이트와 되돌리기

`.env.prod`의 `IMAGE_TAG`를 바꾸고 `up -d`를 다시 실행한다(`migrate`가 먼저 돈다). 되돌리기는 이전 태그로 `up -d`다. 이미 적용된 마이그레이션은 되돌리지 않으므로, 스키마가 바뀐 릴리스 전에는 `backup.sh`를 먼저 돌린다.

## 백업과 복원 훈련

```bash
# cron: 17 3 * * *  /opt/vanillameta/deploy/backup.sh >> /var/log/vanillameta-backup.log 2>&1
./backup.sh            # api를 잠시 멈추고 mysqldump + uploads 볼륨 → 체크섬 포함 tar를 암호화 파일로 직접 기록(+S3/R2)
BACKUP_PASSPHRASE_FILE=... ./restore-drill.sh /var/backups/vanillameta/vanillameta-<시각>.tar.enc <api 이미지>
```

- 아카이브는 **항상 암호화**한다(`BACKUP_PASSPHRASE_FILE` 필수). 사용자 계정·비밀번호 해시·암호화된 소스 설정·업로드 데이터가 모두 들어 있다. 평문 아카이브는 디스크에 쓰지 않는다.
- 기본값으로 덤프와 복사 동안 api를 멈춘다(DuckDB는 단일 쓰기 프로세스라 쓰는 중에 복사하면 깨질 수 있다). 중지 시간은 덤프와 복사 시간이다. `BACKUP_QUIESCE=false`로 끌 수 있지만 그러면 복원 훈련으로만 신뢰한다. 배포·업데이트와 겹치지 않게 한다(`flock`으로 백업끼리는 겹치지 않는다).
- 복원 훈련은 운영 스택을 건드리지 않고 임시 MySQL에 덤프를 올린 뒤 모든 `.duckdb` 파일을 읽기 전용으로 열어 **모든 테이블을 읽는다**. 출시 전에 한 번, 이후 정기적으로 실행한다.

## 키 보관 (복구 가능성의 전제)

복원에는 **`.env.prod`(특히 `CONFIG_SECRET_KEY`: 저장된 소스 비밀번호를 복호화한다)와 백업 암호**가 모두 필요하다. 둘 다 이 VM에만 있으면 VM을 잃을 때 외부 백업을 풀 수 없다. 두 값을 **VM 밖에, 백업 버킷과도 분리된 곳**(예: 팀 비밀 관리자)에 보관하고, 복원 훈련을 그 사본만으로 한 번 해 본다.

## 알려진 한계

- API는 SIGTERM 핸들러(`enableShutdownHooks`)가 없어 `docker stop`이 즉시(종료 코드 143) 끝난다. 배포·재시작 때 처리 중인 요청과 업로드가 끊긴다(`stop_grace_period`는 지금 효과가 없다).
- 부팅 직후 컨테이너가 egress-guard 유닛보다 먼저 올라오는 짧은 시간이 있다. Docker의 nftables 백엔드에는 `DOCKER-USER` 체인이 없어 이 스크립트가 동작하지 않는다.
- 로그는 서비스당 10MB × 5개로 회전하지만 디스크 경보는 백업 디스크 80%/90%뿐이다.

## 아직 이 디렉터리가 하지 않는 것

고아 `uploads/*` 정리, 다중 인스턴스, 메트릭 대시보드, GHCR 빌드와 SSH 배포 워크플로(다음 단위, 아직 없다. 지금은 이미지를 직접 빌드·푸시해 `IMAGE_TAG`로 지정한다).
