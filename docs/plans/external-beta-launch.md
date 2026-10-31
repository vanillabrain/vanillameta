# 외부 초대 베타 출시 계획

전략: [docs/strategy/external-beta.md](../strategy/external-beta.md). 모든 작업은 `develop`에서 진행하고, 마일스톤마다 증빙을 `docs/testing/`에 남긴다.

## 마일스톤

| ID  | 내용                                                                                                                                                                                                                                                                                                                                    | 구분        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| M-1 | 전략 전환 기록, 약관·개인정보·삭제 경로                                                                                                                                                                                                                                                                                                 | 출시 게이트 |
| M0  | 운영 기준선: 부팅 가드, 기준선 마이그레이션, SSRF 차단, 이미지, `deploy/`, 배포 워크플로, 백업                                                                                                                                                                                                                                          | 출시 게이트 |
| M1  | 초대 가입(구현·부분 검증: [증빙](../testing/external-beta-m1-access.md)), 쿼터·원장·사용자별 throttle·업로드 상한·공개 링크 만료(구현·테스트 검증, 호출 연결은 M2: [계획](external-beta-m1-quota.md), [증빙](../testing/external-beta-m1-quota.md)), 데이터 격리 증명(구현·부분 검증: [증빙](../testing/external-beta-m1-isolation.md)) | 출시 게이트 |
| M2  | AI SDK 레지스트리, 게이트웨이(쿼터·원장·비용 차단기), NDJSON 스트리밍(구현·배선 검증은 모의 제공자로 대부분 끝남(미실행·부분 항목은 증빙의 "실행하지 않은 것"), **실제 모델은 미검증**: [계획](external-beta-m2-llm.md), [증빙](../testing/external-beta-m2-llm.md))                                                                    | 출시 게이트 |
| M3  | 공유 zod 스펙, 블록 확장(pie/area/scatter/table/markdown/filter)                                                                                                                                                                                                                                                                        | 출시 후     |
| M4  | 채팅 편집 연산(add/remove/replace/changeKind/changeQuery)                                                                                                                                                                                                                                                                               | 출시 후     |
| M5  | 익명 iframe 임베드, 공유 시스템 일원화                                                                                                                                                                                                                                                                                                  | 출시 후     |
| M6  | Rill 경로 훅: 스펙 내보내기, `metricRef`, MCP `vm_get_spec`                                                                                                                                                                                                                                                                             | 지속        |

## M0 세부

1. **부팅 가드** — `backend-api/src/config/production-guard.ts`. `NODE_ENV=prod`에서 dev-only/짧은/누락 시크릿 5종, 와일드카드·누락 CORS, `AI_PROVIDER=codex`, `.env.local` 파일, 시드 `guest` 계정이 있으면 부팅을 거부한다(guest 검사는 DB 연결 후). `app.module.ts`가 정확히 `prod`일 때만 `synchronize`를 끄므로 `NODE_ENV=production` 별칭과, 원격 DB에서의 미설정·알 수 없는 값도 거부한다. 값은 메시지에 싣지 않는다. 운영에서 swagger는 `SWAGGER_ENABLED=true`일 때만 연다. 신뢰 프록시 홉 수는 `TRUST_PROXY_HOPS`.
2. **PostgreSQL 빈 DB 부트스트랩** — `backend-api/src/database/migrate-prod.ts`가 PostgreSQL 17 빈 DB를 정본 엔티티로 한 번 초기화하고 참조 데이터를 넣은 뒤 `PostgresBaseline1793500000000`만 기록한다. 기존 MySQL migration을 PostgreSQL에서 실행한 것처럼 꾸미지 않는다. PostgreSQL advisory lock으로 동시 실행을 막고, 테이블은 있는데 baseline 기록이 없는 스키마는 자동 진행하지 않고 거부한다. 이후 PostgreSQL 전용 migration의 `up` 두 번, 위치별 schema diff, 실제 백업 복원은 [PostgreSQL 전환 계획](postgres-metadata-cutover.md)을 따른다. 운영 이미지는 컴파일된 `dist/src/database/migrate-prod.js`를 실행한다.
3. **소스 유형 제한** — `backend-api/src/connection/source-type-policy.ts`. `NODE_ENV=prod`에서 `ALLOWED_SOURCE_TYPES`가 비어 있으면 `file,sample`(업로드 DuckDB·샘플 SQLite)만 허용하고, 그 외 엔진은 생성·수정·연결 테스트·저장된 소스의 쿼리에서 403으로 거부한다(증빙: [external-beta-m0-ssrf.md](../testing/external-beta-m0-ssrf.md)). 컨테이너 네트워크의 사설 IP 송신 차단(compose/호스트 방화벽)과 이미지에서 Oracle Instant Client 제거는 이미지·`deploy/` 단위에서 한다.
4. **이미지(구현·부분 검증: [증빙](../testing/external-beta-m0-images.md))** — `backend-api/Dockerfile.prod`(멀티 스테이지, `npm ci --legacy-peer-deps` → `nest build` → `npm prune --omit=dev`, non-root, Oracle 클라이언트 없음), `frontend-web/Dockerfile.prod` + `nginx.prod.conf`(상대 경로 `/v1`로 빌드, `/v1`·`/socket.io` 프록시, `nginx:1.28-alpine`). `@nestjsplus/knex` peer 충돌은 `--legacy-peer-deps`로 고정했다. `backend-api/docker-compose.yml`은 `NODE_ENV: production`을 쓰므로 운영 compose는 `prod`로 새로 만든다. 이미지는 arm64로만 검증했다. 남은 것: CI(buildx)의 amd64 검증과 `Dockerfile.prod.dockerignore` 적용 확인, 설정만 있고 실행하지 않은 항목(NDJSON 스트리밍, 업로드 413, WebSocket 업그레이드, 프록시를 거친 로그인).
5. **`deploy/`(구현·부분 검증: [증빙](../testing/external-beta-m0-deploy.md), [런북](../../deploy/README.md))** — `docker-compose.prod.yml`(caddy, web, api, migrate, postgres; 백업은 서비스가 아니라 호스트 cron의 `backup.sh`), `.env.prod.example`, `backup.sh`와 복원 훈련(`.duckdb` 열림 확인 포함). 이미지 검토에서 나온 **필수 조건**:
   - 프록시 홉 수를 명시한다. `TRUST_PROXY_HOPS` 기본값은 1이다. Caddy→web nginx→API면 2다. 틀리면 전 사용자가 한 throttle 버킷에 묶이거나(홉이 모자랄 때) IP를 위조할 수 있다(홉이 넘칠 때). 엣지가 `X-Forwarded-For`를 덮어쓰게 하고, `analytics.controller.ts:38`·`events.controller.ts:117`은 `req.ip`를 쓰게 고친다.
   - web nginx의 `X-Forwarded-Proto`는 앞단 TLS 종단이 덮어쓸 때만 맞다. 엣지일 때는 `$scheme`을 쓴다.
   - nginx는 시작 시 `api` 주소를 한 번 해석한다. `resolver 127.0.0.11` + 변수 `proxy_pass`로 재해석하거나 배포 때 `web`을 항상 재시작한다.
   - API 컨테이너는 `init: true`를 쓴다(PID 1 신호 처리와 SIGKILL 방지). 메모리는 `main.ts`가 힙 2560MB를 강제하므로 VM에 약 3GB 이상이 필요하다.
   - 사설 IP 송신 차단, 영속 볼륨 `/data/uploads`, 헬스 기반 `depends_on`.
6. **`.github/workflows/deploy.yml`(구현, 로컬 검증만: [증빙](../testing/external-beta-m0-deploy.md), [런북](../../deploy/README.md))** — GHCR 이미지 → 포스 커맨드 SSH(`release.sh`: 사전 백업, 헬스 확인, 실패 시 이미지 롤백) → 공개 URL 스모크. 실제 GitHub 실행은 미실행이며 시크릿(`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS`)과 변수(`APP_URL`)는 사용자가 등록한다.
7. **문서** — AGENTS.md에 Lambda 폐기와 단일 인스턴스 전제를 기록한다.

## 공유·포크(리믹스) 유스케이스

사용자는 "공유하고, 받은 사람이 포크해서 다시 쓰는 흐름"을 핵심 유스케이스로 지정했다(2026-10-23). 이전 구현 참고: `../skb-taste`(문서 `docs/use_cases/UC-006-share-targeting-projects.md`, `_docs/프로젝트_공유기능_구현계획서.md`).

- **skb-taste에서 확인한 것**: 포크가 아니라 "공유 = 수신자 소유 독립 사본"이다. 개별 내부 사용자에게만 공유(링크·조직·공개·권한 등급 없음), 사본에 `original_project_id`·`shared_from_user_id` 한 단계 출처만 남기고 원본 변경은 전파하지 않는다. 사본은 같은 `tableId`를 참조한다(데이터 스냅샷 없음). 알려진 결함: 취소 후 재공유가 유니크 키에 막힘, 취소하면 수신자 사본을 하드 삭제, 원본 삭제 시 출처가 NULL, 수신자 서버 검증 없음. 체크아웃에는 프런트엔드(빈 서브모듈)가 없어 UI는 문서로만 확인했고, 테스트 케이스는 모두 `not_run`이다.
- **VanillaMeta에 있는 것(2026-10-25 실행 검증 결과는 [shared-fork-verification.md](../testing/shared-fork-verification.md))**: Studio 게시 리믹스(`studio-remix*`)와 사내 받은 자료 복제(`UC-053`). 소유자의 명시 `allowCopy`, 수신자의 **본인 소스·열에 다시 연결**, 전체 미리보기, 새 비공개 사본의 원자 저장, 원본·기존 사본 보존, 허용 회수 후 새 복제 거절을 이미 갖는다. 실제 두·세 사용자 실행에서 게시→복제→독립 편집→회수·원본 삭제 후 사본 생존→재공유가 모두 동작했다. 다만 **사본에서 원본으로 가는 계보가 없고**, 링크 경로에는 받은 목록·소유자의 수신자 목록·알림이 없으며, 독립성·회수·재공유는 서비스 수준 자동 테스트(`backend-api/src/dashboard-studio/studio-fork-journey.spec.ts`, 16개)가 단언하지만 아직 실행해 확인하지 않았고, 실제 스택 재실행과 게시→복제 e2e, TC-003 전체 여정은 없다.
- **베타 출시에 필요한 일**: (1) 외부 사용자 간 공유→포크 전체 여정을 운영 URL에서 실행해 증빙한다(공개 링크 → 로그인 → 내 소스(업로드/샘플) 연결 → 저장). (2) 출처 표시(원본 제목·작성자)와 포크 수/목록을 게시 화면에 노출할지 결정한다(검증 결과: 현재 계보 필드가 없어 설계부터 필요하다). (3) skb-taste의 승인 대기 정책과 달리 재공유 허용·사본 보존은 이미 그렇게 동작한다(승인 필요). 원본 삭제 시 출처 보존은 계보 자체가 없어 해당 없다. (4) M5의 공유 일원화는 이 흐름을 깨지 않는 범위에서만 한다. 조건: Studio 링크 복제(`studio/publications/:token/remix*`)와 조직 수신 복제(`studio/received/:ref/remix*`)를 읽기 전용으로 바꾸거나 리다이렉트하지 않는다. 일원화 전후로 [shared-fork-verification.md](../testing/shared-fork-verification.md)의 F1~F3을 다시 실행한다.

## 사용자 준비 항목

VM 호스트, 도메인·DNS(예: `app.vanillameta.net`), 시크릿, LLM API 키, 백업 저장소(R2/S3), SSH 배포 키, 약관·개인정보 문구 검토.

## 검증

- 단위·API: 변경 범위만. 백엔드 `npm test`, `npm run build`. 프론트엔드 `npm run test`, `npx tsc --noEmit`, `npx eslint src e2e`.
- M0: 빈 PostgreSQL 17 bootstrap·재실행, 가드 거부 사례, 실제 VM compose 기동, PostgreSQL 복원 훈련.
- M1: 사용자 A/B 격리(source, 업로드, 게시 관리, 실행 결과), 쿼터 경계, 초대 E2E.
- M2: 게이트웨이 단위 테스트(SDK는 `jest.mock`; `MockLanguageModel`은 쓰지 못했다: `docs/plans/external-beta-m2-llm.md` 정정 참조), 실제 LLM 1개 제공자 전체 여정, 실제 브라우저 스트리밍·취소(390/768/1440).
- 화면: 운영 구성 스택에서 전 화면을 열어 캡처하고 복제 여정까지 확인했다([증빙](../testing/external-beta-ui-screens.md)). 실제 모델로 끝까지 실행한 Studio AI 생성 증빙 없음(M2의 남은 게이트: 제공자·모델·키·예산 결정 필요), 막힌 DB 유형의 무음 실패, 공개 링크 두 종류·만료 기본값은 출시 전에 해결할 항목이다.
- 미실행은 통과로 보고하지 않는다.
