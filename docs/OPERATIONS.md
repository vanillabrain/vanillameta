# VanillaMeta 운영 가이드

이 문서는 현재 `develop` 기준 구현 상태와 운영 방법, 그리고 아직 남은 항목을 정리합니다.

## 1. 아키텍처 요약

- **Backend** (`backend-api`): NestJS 9, 메타데이터 저장은 TypeORM(SQLite/MySQL), 고객 데이터소스 조회는 Knex.
  AWS Lambda + API Gateway(Serverless Framework v2, 레이어로 node_modules 분리)로 배포.
- **Frontend** (`frontend-web`): React 18 + Vite 5, MUI 5, ECharts, react-grid-layout. S3/CloudFront 배포.
- **Landing** (`landing-page`): 정적 페이지, S3 배포.

## 2. 로컬 개발 · 테스트

### Backend
```bash
cd backend-api
npm install --legacy-peer-deps
npm run start:local          # NODE_ENV=local → SQLite(sqlite.db)
npm run build                # nest build
npm test                     # unit (jest)
npm run test:e2e             # E2E (SQLite, 외부 DB 불필요)
```
- E2E 는 `test/e2e/` 에 있으며 `.env.test` 의 SQLite 파일을 사용합니다. 외부 DB나 네트워크가 필요 없습니다.
- `test/QTT-*` 통합 스위트는 실제 외부 DB(`test-connect-info.json`)가 필요해 기본 실행에서 제외되어 있습니다.

### Frontend
```bash
cd frontend-web
npm install --legacy-peer-deps
npm start                    # vite dev server (localhost:3000)
npm run build                # vite build → build/
npm test                     # jest (jsdom)
```

### CI
`.github/workflows/ci.yml`
- backend: `build` → `unit` → `test:e2e`
- frontend: `build` → `unit`

## 3. 환경변수

### Backend (`backend-api/.env.*`)
| 변수 | 설명 |
|---|---|
| `NODE_ENV` | `local`(SQLite) / `dev` / `prod` |
| `DB_*` | 메타데이터 MySQL 접속 정보 (local 은 SQLite) |
| `ACCESS_SECRET`, `REFRESH_SECRET` | JWT 서명 키 |
| `URL_ACCESS_SECRET` | 공유 URL 토큰 서명 키 |
| `CONFIG_SECRET_KEY` | 고객 DB 연결정보 암호화 키(미설정 시 `ACCESS_SECRET`) |
| `CORS_ORIGIN` | 허용 origin 목록(콤마 구분) |
| `QUERY_TIMEOUT_MS` | 사용자 쿼리 타임아웃(기본 60000) |
| `QUERY_ALLOW_WRITE` | `true` 면 읽기 전용 가드 비활성(기본 false) |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | rate limit 윈도우(초) / 허용 요청 수 |
| `BODY_LIMIT` | 요청 본문 크기 제한(기본 1mb) |
| `SECRETS_FROM_SSM` | `true` 면 시크릿을 AWS SSM Parameter Store 에서 로드 |
| `SSM_PARAM_PREFIX` | SSM 파라미터 prefix(기본 `/vanillameta/<NODE_ENV>`) |

### Frontend (`frontend-web/.env.*`)
| 변수 | 설명 |
|---|---|
| `VITE_APP_MODE` | 앱 모드 |
| `VITE_API_URL` | 백엔드 API base URL |

> 시크릿: `SECRETS_FROM_SSM=true` 로 부팅하면 `/vanillameta/<stage>/{ACCESS_SECRET,REFRESH_SECRET,URL_ACCESS_SECRET}` 를 SSM(WithDecryption)에서 읽어 주입합니다(런타임 로더 구현됨, `@aws-sdk/client-ssm` 필요). 반면 `serverless.yml` 의 `package.include` 는 아직 `.env*` 를 Lambda 번들에 포함하므로, **번들에서 제거하고 SSM 만 쓰도록 전환하는 것은 미완**(배포 검증 필요).

## 4. 보안

- **비밀번호**: scrypt + 랜덤 salt(`s2:` 포맷). 레거시 무솔트 sha512 는 로그인 시 자동 재해싱.
- **사용자 쿼리**: 읽기 전용 강제(SELECT/WITH/SHOW/EXPLAIN/DESCRIBE), 멀티 스테이트먼트·쓰기 키워드 차단, 타임아웃 적용.
- **식별자**: 테이블/스키마명 화이트리스트 검증.
- **연결정보**: 고객 DB `connectionConfig` 를 AES-256-GCM 으로 암호화 저장.
- **전송/설정**: helmet, 전역 rate limit, CORS 미설정 방어, 요청 크기 제한.
- **에러 위생**: DB 원본 에러 메시지를 클라이언트로 노출하지 않음.

## 5. 접근 제어

- **인증**: JWT(access 6h / refresh 12h), `JwtAuthGuard`.
- **RBAC**: `User.role`(`user`/`admin`), `@Roles()` + `RolesGuard`(DB 조회 기반, 역할 변경 즉시 반영).
  - 관리자 API: `/v1/admin/users`, `/v1/admin/users/:id/role`
- **소유권**: 대시보드(`UserMapping`) 및 공유 URL on/off 는 소유자만 접근(그 외 403). 공유된 대시보드 조회는 비로그인 허용.
- 기본 시드 계정: `guest` (role=admin).

> 소유권: 데이터소스(`Database.ownerId`)와 그에 속한 `dataset`/`widget`(부모 데이터소스 기준)은 소유자 또는 관리자만 접근합니다(그 외 403). 목록은 소유자 것만, 관리자는 전체.

## 6. 감사 로그

- `AuditLog`(append-only) + 전역 `AuditInterceptor`: 쓰기 요청(POST/PUT/PATCH/DELETE)을 행위자/경로/상태코드/IP/`requestId` 와 함께 기록(성공·거부 모두).
- 조회: 관리자 `GET /v1/admin/audit-logs` (최신순, 최대 100건).
- 상관관계: 모든 요청에 `x-request-id` 응답 헤더 부여(클라이언트 값 우선).

## 7. 백업/복구

- 구현됨: 관리자 `GET /v1/admin/backup` — 사용자/대시보드/데이터셋/위젯 메타데이터 스냅샷(JSON, 비밀번호 제외).
- 미구현: **복구(restore)**, 정기 백업 스케줄, 대용량 스트리밍, DB 레벨 스냅샷 연동.

## 8. 런타임/배포

- Lambda 런타임/레이어: `nodejs20.x`. Docker 이미지: `node:20-slim`.
- Serverless Framework 는 아직 v2(backend-api) / v3(layer, frontend) 혼재 → **v3 통일 미완**(배포 검증 필요).

## 9. SLO 초안 (제안)

| 항목 | 목표(제안) | 측정 |
|---|---|---|
| API 가용성 | 99.9% | API Gateway 5xx 비율 |
| API 응답 지연(p95) | < 1s (쿼리 실행 제외) | CloudWatch |
| 쿼리 실행 실패율 | < 1% | `executeQuery` ERROR 로그 |
| 콜드 스타트 비율 | < 5% | Lambda Init Duration |

## 10. 남은 항목 (후속)

- 조직/팀(멀티테넌시) 기반 권한·격리
- SSO/OIDC, 컴플라이언스 대응
- 백업 복구(restore) 및 스케줄링
- 시크릿 관리(SSM/Secrets Manager): 런타임 로더 구현됨, `.env` 번들 제거 및 SSM 파라미터 실제 생성은 미완
- Serverless v3 통일 및 무중단 배포(롤백 전략)
- 부하 테스트 및 성능 회귀 측정
