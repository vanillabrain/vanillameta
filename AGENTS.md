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

## E2E (Playwright)

```bash
cd frontend-web
npx playwright test                    # 전체 (webServer가 FE·BE 자동 기동)
npx playwright test e2e/product-flow.spec.ts --project=chromium --workers=1
```

- `e2e/global-setup.ts`가 실행 전에 자동 프로비저닝한다 (멱등):
  - 백엔드 헬스 체크 → 테스트 계정(`e2etester`/`Test1234!`) 가입 → 로그인
  - `component` 시드 없으면 `backend-api`에서 `npm run seed` 실행
  - `sales` 데이터 소스 없으면 생성된 CSV를 `/v1/database/upload`로 업로드
  - 파일 분석 픽스처(CSV/JSON/Parquet)를 `e2e/fixtures/generated/`에 생성
- 환경변수: `E2E_API_URL`, `E2E_USER_ID`, `E2E_PASSWORD`
- 스펙:
  - `smoke.spec.ts` — 백엔드 없는 최소 스모크
  - `full-flow.spec.ts` — 파일 분석(CSV/JSON/Parquet) → SQL → 차트 → 데이터셋 저장
  - `product-flow.spec.ts` — 회원가입/로그인/메트릭/위젯/대시보드/공유/임베드/로그아웃 (serial)

## 주의사항

- 비밀번호 정책: 대소문자+숫자+특수문자 8자 이상 (클라이언트에서 먼저 검증)
- react-alert 확인 다이얼로그: `DialogActions` 첫 버튼이 액션(확인/OK), 마지막이 Cancel — E2E에서 순서 주의
- `waitForURL`은 `\/widget` 같은 부분 매칭이 `/widget/create`에도 걸리므로 `$` 앵커 사용

## develop-v2 개발 검증

- 루트에서 `npm run build`, `npm test` 실행. FE 타입은 `frontend-web`에서 `npx tsc --noEmit`.
- 기준 패키지 관리자는 npm. `pnpm-lock.yaml`은 이번 통합에서 갱신하지 않았으므로 pnpm 설치·배포는 미검증.
- `NODE_ENV=local` 백엔드는 `.env.dev`를 읽는다. `SQLITE_PATH`, `FILE_UPLOAD_DIR`로 로컬 DB·업로드 경로를 분리할 수 있다.
- 자동 seed는 local 환경에서 사용자 테이블이 비어 있을 때만 실행한다. 기존 사용자가 있으면 초기화를 건너뛴다.
- Swagger JSON은 자동으로 추적 파일을 덮어쓰지 않는다. 내보내기가 필요하면 `SWAGGER_SPEC_PATH`에 출력 경로를 지정한다.
- Oracle/ODBC는 선택적 드라이버이며, 대상 OS의 네이티브 라이브러리 준비와 별도 연결 검증이 필요하다.
