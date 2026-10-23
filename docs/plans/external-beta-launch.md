# 외부 초대 베타 출시 계획

전략: [docs/strategy/external-beta.md](../strategy/external-beta.md). 모든 작업은 `develop`에서 진행하고, 마일스톤마다 증빙을 `docs/testing/`에 남긴다.

## 마일스톤

| ID | 내용 | 구분 |
| --- | --- | --- |
| M-1 | 전략 전환 기록, 약관·개인정보·삭제 경로 | 출시 게이트 |
| M0 | 운영 기준선: 부팅 가드, 기준선 마이그레이션, SSRF 차단, 이미지, `deploy/`, 배포 워크플로, 백업 | 출시 게이트 |
| M1 | 초대 가입, 쿼터·원장, 사용자별 throttle, 데이터 격리 증명, 공개 링크 노출 통제 | 출시 게이트 |
| M2 | AI SDK 레지스트리, 게이트웨이(쿼터·원장·비용 차단기), SSE 스트리밍 | 출시 게이트 |
| M3 | 공유 zod 스펙, 블록 확장(pie/area/scatter/table/markdown/filter) | 출시 후 |
| M4 | 채팅 편집 연산(add/remove/replace/changeKind/changeQuery) | 출시 후 |
| M5 | 익명 iframe 임베드, 공유 시스템 일원화 | 출시 후 |
| M6 | Rill 경로 훅: 스펙 내보내기, `metricRef`, MCP `vm_get_spec` | 지속 |

## M0 세부

1. **부팅 가드** — `backend-api/src/config/production-guard.ts`. `NODE_ENV=prod`에서 dev-only/짧은/누락 시크릿 5종, 와일드카드·누락 CORS, `AI_PROVIDER=codex`, 시드 `guest` 계정이 있으면 DB 연결 후라도 부팅을 거부한다. 값은 메시지에 싣지 않는다. 운영에서 swagger는 `SWAGGER_ENABLED=true`일 때만 연다. 신뢰 프록시 홉 수는 `TRUST_PROXY_HOPS`.
2. **기준선 마이그레이션** — 빈 MySQL을 마이그레이션만으로 구성할 수 없다(첫 마이그레이션이 `synchronize`로만 생기는 `databaseType`에 INSERT). 엔티티에서 기준선 마이그레이션과 필수 참조 데이터 마이그레이션을 만들고, 빈 MySQL `migration:run` 결과를 `synchronize` 스키마와 diff해 증명한다. 운영 이미지는 컴파일된 `dist/src/data-source.js`로 `migration:run:prod`를 실행한다.
3. **소스 유형 제한** — `ALLOWED_SOURCE_TYPES=file,sample`. 컨테이너에서 사설 IP 송신을 차단한다. Oracle Instant Client를 이미지에서 제거한다.
4. **이미지** — 백엔드 multi-stage `npm ci --omit=dev`, 프론트엔드 상대경로 `/api` 빌드.
5. **`deploy/`** — `docker-compose.prod.yml`(proxy, web, api, migrate, mysql, backup), `.env.prod.example`, `backup.sh`와 복원 훈련(`.duckdb` 열림 확인 포함).
6. **`.github/workflows/deploy.yml`** — GHCR 이미지 → SSH 배포 → `/health` 스모크.
7. **문서** — AGENTS.md에 Lambda 폐기와 단일 인스턴스 전제를 기록한다.

## 사용자 준비 항목

VM 호스트, 도메인·DNS(예: `app.vanillameta.net`), 시크릿, LLM API 키, 백업 저장소(R2/S3), SSH 배포 키, 약관·개인정보 문구 검토.

## 검증

- 단위·API: 변경 범위만. 백엔드 `npm test`, `npm run build`. 프론트엔드 `npm run test`, `npx tsc --noEmit`, `npx eslint src e2e`.
- M0: 빈 MySQL 마이그레이션 diff, 가드 거부 사례, 실제 VM compose 기동, 복원 훈련.
- M1: 사용자 A/B 격리(source, 업로드, 게시 관리, 실행 결과), 쿼터 경계, 초대 E2E.
- M2: `MockLanguageModelV3` 단위, 실제 LLM 1개 제공자 전체 여정, 실제 브라우저 스트리밍·취소(390/768/1440).
- 미실행은 통과로 보고하지 않는다.
