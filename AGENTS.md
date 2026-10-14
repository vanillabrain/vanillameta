# VanillaMeta — 개발자/에이전트 가이드

## 세션 시작 핵심 지침

- 사용자 합의: 내부는 데이터 소스·지표 정의·분석 화면의 책임을 Rill처럼 구분하고, 고객 화면은 질문·결과·저장 중심으로 단순하게 유지한다. 자세한 설계는 [단순 분석 설계](docs/architecture/simple-analysis.md), AIWF 범위는 [UC-001](docs/use_cases/UC-001-review-and-save-analysis.md)에서 확인한다. 숫자 KPI와 시계열은 미리보기·저장 화면에서 함께 보여주며 보조 설정은 필요할 때 펼친다. 미래 구조만을 위한 전면 리팩터링은 하지 않는다.

- 매 세션 시작·재개 시 이 요약과 현재 브랜치·변경 사항·작업에 필요한 파일만 먼저 확인한다. 전체 이력과 상세 설계 문서는 반복해서 읽지 않고 필요한 부분만 추가로 불러온다. 사용자의 최신 지시를 우선한다.
- 현재 우선순위는 DuckDB 기반 Measure·Dimension·동적 필터·기간 비교·원본 탐색·Pivot과 탐색 보기 저장/복원·내보내기다. 진행 상황과 다음 작업은 [Rill 통합 계획](docs/strategy/2026-10-14-rill-feature-integration.md)에서 해당 부분만 확인한다.
- Rill 공식 데모 데이터를 기준으로 기능과 UI를 항상 비교한다. 유사한 탐색 UI를 구현하고, 같은 조건의 수치·API/XHR·실제 화면으로 검증하며 미확인은 명시한다.
- 분석 UI는 [UI Kit](docs/design/analysis-ui-kit.md)의 토큰·국소 테마·공통 선택 버튼을 먼저 재사용한다. 부모 화면에서 버튼 최소 높이를 강제하거나 화면별 크기 예외를 중첩하지 않고 실제 크기·밀도·상태를 확인한다.
- UI 요소 추가·수정 전 [검증 스킬의 디자인·레이아웃 회귀 기준](skills/vanillameta-verify/SKILL.md#ui-컴포넌트-디자인레이아웃-회귀)을 적용한다. 작업 중과 완료 시 크기·높이·정렬·간격·레이아웃·폰트 및 주변 요소의 틀어짐을 실제 화면으로 확인하고 기능/디자인 결과를 분리한다.
- 지표·분석 요청의 의미와 UI/저장 상태를 특정 엔진의 SQL·드라이버 실행과 구분한다. 이 경계는 현재 변경 범위에서 유지한다.
- BigQuery·AWS Athena 연결은 고객 수요가 확인된 향후 단계로 미룬다. 미래 확장만을 위한 범용 엔진 프레임워크나 전면 리팩터링을 현재 완료 조건에 추가하지 않는다.
- 외부 엔진을 실제로 설계·구현할 때만 [외부 분석 엔진 도입 지침](docs/strategy/2026-10-14-rill-feature-integration.md#외부-분석-엔진-도입-지침--사용자-합의-2026-10-14)의 상세 기준을 확인한다.

- AI 생성의 저장 지표 재사용은 [UC-002](docs/use_cases/UC-002-reuse-saved-metric.md)를 따른다. 동일 소스의 활성 구조화 정의만 제공하고 명시 참조의 계산식은 기존 제작 계산기로 적용한다. Assistant 수정 모드의 차트 선택 시 저장 지표를 지정하면 서버가 해당 차트에만 계산식을 강제하고 미리보기에 재사용을 표시한다. 분석에는 SQL snapshot을 저장하며 live 참조·자동 이름 매칭 완전 보장은 후속 범위다.

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
- 기본 Playwright: `cd frontend-web && npm run test:e2e` (핵심 8개). 파일/`--grep` 선택으로 필요한 것만 실행한다.
- 격리 실행: `npm run test:e2e:isolated`. 확장 QA는 `npm run test:qa -- --grep '케이스 ID'`로 명시적으로 실행한다.
- UI 검증은 `aside-browser` 실제 화면으로 수행하고 핵심/실패 캡처를 저장소 밖 증빙 폴더에 남긴다.

## 주의사항

- 비밀번호 정책: 대소문자+숫자+특수문자 8자 이상 (클라이언트에서 먼저 검증)
- react-alert 확인 다이얼로그: `DialogActions` 첫 버튼이 액션(확인/OK), 마지막이 Cancel — E2E에서 순서 주의
- `waitForURL`은 `\/widget` 같은 부분 매칭이 `/widget/create`에도 걸리므로 `$` 앵커 사용

## develop-v2 개발 검증

- 통합/출시 검증에서 루트 `npm run build`, `npm test`를 실행한다. 기능 개발 중에는 위 변경 범위 기준으로 선택한다. FE 타입은 `frontend-web`에서 `npx tsc --noEmit`.
- 기준 패키지 관리자는 npm. `pnpm-lock.yaml`은 이번 통합에서 갱신하지 않았으므로 pnpm 설치·배포는 미검증.
- `NODE_ENV=local` 백엔드는 `.env.local` → `.env.dev` 순으로 읽으며 명시한 셸 환경변수가 우선한다. Codex AI 연결은 추적하지 않는 `.env.local`에 설정한다. `SQLITE_PATH`, `FILE_UPLOAD_DIR`로 로컬 DB·업로드 경로를 분리할 수 있다.
- 자동 seed는 local 환경에서 사용자 테이블이 비어 있을 때만 실행한다. 기존 사용자가 있으면 초기화를 건너뛴다.
- Swagger JSON은 자동으로 추적 파일을 덮어쓰지 않는다. 내보내기가 필요하면 `SWAGGER_SPEC_PATH`에 출력 경로를 지정한다.
- Oracle/ODBC는 선택적 드라이버이며, 대상 OS의 네이티브 라이브러리 준비와 별도 연결 검증이 필요하다.

## 서버 파일 분석 MVP

- 신규 CSV/JSON/Parquet 저장은 서버 DuckDB worker_thread를 사용하며 메타데이터 DB와 기존 SQLite 소스는 유지한다.
- 단일 상시 Node 서버 + 영속 FILE_UPLOAD_DIR을 사용한다. 운영 설정/백업/미지원 범위는 `docs/strategy/server-duckdb-operations.md`, MD 검증은 `docs/testing/server-duckdb.md` 참조.
- 파일 선택 후 서버 저장은 바로 실행하고 브라우저 WASM 분석은 명시적 선택으로만 실행한다.

## AI 개발 검증 제공자

- 로컬 LLM(Ollama 등)은 사용하지 않는다. 로컬 코딩 에이전트(Codex 등)를 호출하며 현재 기본 지정 모델은 ChatGPT `gpt-6-luna`이다. `AI_PROVIDER=codex`는 기존 CLI 로그인 사용. 모델 지원/로그인 오류 시 다른 모델로 자동 대체하거나 성공으로 보고하지 않는다.
- 이 환경의 검증은 `AI_CODEX_BASE_URL=http://127.0.0.1:10100/v1`, `AI_CODEX_MODEL_CATALOG=/Users/drumcap/.codex/opencodex-catalog.json`을 함께 지정한다. 전역 설정을 제외한 CLI 호출에도 필요한 연결·카탈로그만 명시적으로 전달한다. 다른 호스트에서는 이 경로를 복사하지 말고 실제 설치 설정을 확인한다. 실행 예와 확인된 증빙은 `docs/testing/ai-dashboard.md` 참조.
