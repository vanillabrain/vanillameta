# VanillaMeta — 개발자/에이전트 가이드

## 로컬 실행

- **Backend**: `cd backend-api && npm run start:local` → http://localhost:4000 (SQLite `sqlite.db`, API prefix `/v1`)
- **Frontend**: `cd frontend-web && npm start` → http://localhost:3000
- **DB 시드**: `cd backend-api && npm run seed` — 멱등(`orIgnore`), component/databaseType/template/user 초기 데이터 삽입

## 테스트

- **Backend 유닛**: `cd backend-api && npm test` (test/ 하위 QTT 레거시 통합 스펙은 제외 — 실 DB 접속정보 필요)
- **Backend 빌드**: `npm run build` (nest build). `tsc --noEmit`은 test/ 픽스처 때문에 실패하므로 build 기준으로 검증
- **Frontend 유닛**: `cd frontend-web && npm run test` (vitest)
- **Frontend 타입/린트**: `npx tsc --noEmit`, `npx eslint src e2e`

## 변경 범위에 따른 검증

- 파일 저장/일반 수정마다 전체 테스트·빌드·E2E를 실행하지 않는다.
- 관련 단위/API → 기능 완료 시 변경 화면 Aside → 통합 시 핵심 E2E → 출시 시 범위 확대 순으로 선택한다.
- 같은 코드/환경/픽스처에서 확인한 결과는 관련 변경이 없으면 재사용한다. 미실행은 통과로 보고하지 않는다.
- 상세 기준과 명령: [docs/testing/workflow.md](docs/testing/workflow.md).
- MD 시나리오/기대 결과: [docs/testing/cases.md](docs/testing/cases.md).
- 이 프로젝트 검증에는 `$vanillameta-verify`를 사용한다. 설치 전에는 [skills/vanillameta-verify/SKILL.md](skills/vanillameta-verify/SKILL.md)를 직접 읽는다.
- 기본 Playwright: `cd frontend-web && npm run test:e2e` (핵심 7개). 파일/`--grep` 선택으로 필요한 것만 실행한다.
- 격리 실행: `npm run test:e2e:isolated`. 확장 QA는 `npm run test:qa -- --grep '케이스 ID'`로 명시적으로 실행한다.
- UI 검증은 `aside-browser` 실제 화면으로 수행하고 핵심/실패 캡처를 저장소 밖 증빙 폴더에 남긴다.

## 주의사항

- 비밀번호 정책: 대소문자+숫자+특수문자 8자 이상 (클라이언트에서 먼저 검증)
- react-alert 확인 다이얼로그: `DialogActions` 첫 버튼이 액션(확인/OK), 마지막이 Cancel — E2E에서 순서 주의
- `waitForURL`은 `\/widget` 같은 부분 매칭이 `/widget/create`에도 걸리므로 `$` 앵커 사용

## develop-v2 개발 검증

- 통합/출시 검증에서 루트 `npm run build`, `npm test`를 실행한다. 기능 개발 중에는 위 변경 범위 기준으로 선택한다. FE 타입은 `frontend-web`에서 `npx tsc --noEmit`.
- 기준 패키지 관리자는 npm. `pnpm-lock.yaml`은 이번 통합에서 갱신하지 않았으므로 pnpm 설치·배포는 미검증.
- `NODE_ENV=local` 백엔드는 `.env.dev`를 읽는다. `SQLITE_PATH`, `FILE_UPLOAD_DIR`로 로컬 DB·업로드 경로를 분리할 수 있다.
- 자동 seed는 local 환경에서 사용자 테이블이 비어 있을 때만 실행한다. 기존 사용자가 있으면 초기화를 건너뛴다.
- Swagger JSON은 자동으로 추적 파일을 덮어쓰지 않는다. 내보내기가 필요하면 `SWAGGER_SPEC_PATH`에 출력 경로를 지정한다.
- Oracle/ODBC는 선택적 드라이버이며, 대상 OS의 네이티브 라이브러리 준비와 별도 연결 검증이 필요하다.

## 서버 파일 분석 MVP

- 신규 CSV/JSON/Parquet 저장은 서버 DuckDB worker_thread를 사용하며 메타데이터 DB와 기존 SQLite 소스는 유지한다.
- 단일 상시 Node 서버 + 영속 FILE_UPLOAD_DIR을 사용한다. 운영 설정/백업/미지원 범위는 `docs/strategy/server-duckdb-operations.md`, MD 검증은 `docs/testing/server-duckdb.md` 참조.
- 파일 선택 후 서버 저장은 바로 실행하고 브라우저 WASM 분석은 명시적 선택으로만 실행한다.

## AI 개발 검증 제공자

- 로컬 LLM(Ollama 등)은 사용하지 않는다. 로컬 코딩 에이전트(Codex 등)를 호출하며 현재 기본 지정 모델은 ChatGPT `gpt-6-luna`이다. `AI_PROVIDER=codex`는 기존 CLI 로그인 사용. 모델 지원/로그인 오류 시 다른 모델로 자동 대체하거나 성공으로 보고하지 않는다.
- 이 환경의 검증은 `AI_CODEX_BASE_URL=http://127.0.0.1:10100/v1`, `AI_CODEX_MODEL_CATALOG=/Users/moonklabs/.codex/opencodex-catalog.json`을 함께 지정한다. 전역 설정을 제외한 CLI 호출에도 필요한 연결·카탈로그만 명시적으로 전달한다. 다른 호스트에서는 이 경로를 복사하지 말고 실제 설치 설정을 확인한다. 실행 예와 확인된 증빙은 `docs/testing/ai-dashboard.md` 참조.
