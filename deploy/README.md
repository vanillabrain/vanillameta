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

- 메모리 6GB 이상(API가 힙 2.5GB를 쓴다. compose는 API에 3.5GB 상한을 둔다), 디스크 40GB 이상, Docker Engine + compose 플러그인.
- 도메인의 A 레코드가 이 VM을 가리켜야 한다(Let's Encrypt). 80/443이 열려 있어야 한다.

## 첫 배포

```bash
cd /opt/vanillameta/deploy
cp .env.prod.example .env.prod && chmod 600 .env.prod   # 모든 값을 채운다(시크릿은 openssl rand -hex 32)
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
sudo ./egress-guard.sh apply                              # + vanillameta-egress-guard.service 설치(재부팅 후 재적용)
docker compose --env-file .env.prod -f docker-compose.prod.yml ps -a   # migrate는 exited(0), 나머지는 healthy
```

`migrate`가 빈 DB를 만들고(엔티티 + 참조 데이터 + 마이그레이션 53건 기록) 이후에는 대기 중인 마이그레이션만 실행한다. 테이블은 있는데 기록이 없는 스키마는 거부하고 비정상 종료하며, 이 경우 `api`는 시작하지 않는다. 운영 가드(`production-guard.ts`)는 약한 시크릿·`CORS_ORIGIN` 누락·`AI_PROVIDER=codex`·`guest` 계정·`QUERY_ALLOW_WRITE=true`면 `api` 부팅을 거부한다.

## 업데이트와 되돌리기

`.env.prod`의 `IMAGE_TAG`를 바꾸고 `up -d`를 다시 실행한다(`migrate`가 먼저 돈다). 되돌리기는 이전 태그로 `up -d`다. 이미 적용된 마이그레이션은 되돌리지 않으므로, 스키마가 바뀐 릴리스 전에는 `backup.sh`를 먼저 돌린다.

## 백업과 복원 훈련

```bash
# cron: 17 3 * * *  /opt/vanillameta/deploy/backup.sh >> /var/log/vanillameta-backup.log 2>&1
./backup.sh                                   # mysqldump + uploads 볼륨 → 체크섬 포함 tar(+암호화, +S3/R2)
BACKUP_PASSPHRASE_FILE=... ./restore-drill.sh /var/backups/vanillameta/vanillameta-<시각>.tar.enc <api 이미지>
```

복원 훈련은 운영 스택을 건드리지 않고 임시 MySQL에 덤프를 올린 뒤 모든 `.duckdb` 파일을 읽기 전용으로 연다. 출시 전에 한 번, 이후 정기적으로 실행한다. 백업은 DuckDB 파일이 쓰이는 중에 복사될 수 있으므로 한적한 시간에 돌리고, 훈련 통과로만 신뢰한다.

## 아직 이 디렉터리가 하지 않는 것

고아 `uploads/*` 정리, 디스크 사용량 경보(백업 디스크 80% 경고·90% 거부만 있다), 다중 인스턴스, 메트릭 대시보드. 워크플로(GHCR 빌드·SSH 배포)는 `.github/workflows/deploy.yml`.
