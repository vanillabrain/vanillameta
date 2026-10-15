# VanillaMeta — 개발자/에이전트 가이드

## 세션 시작 핵심 지침

- **최상위 목표:** 프롬프트로 대시보드 생성·수정·저장·게시를 이어가고, 반응형 블록 편집과 복제·소스 교체·재사용까지 완성한다. [제품 목표](docs/strategy/prompt-to-dashboard.md)가 우선순위의 기준이며 [통합 설계](docs/architecture/prompt-to-dashboard.md), [UC-005/계획](docs/plans/UC-005.md)에 구현·검증 계약이 있다. UC-001~004와 Rill 작업은 이 전체 여정을 지원하는 기반이다.
- **방향 유지:** 새 작업은 P1~P5/FR/수용 기준과 연결하고 부족점·최소 변경·검증·종료 조건을 기록한다. 블록 ID·공통 AI 초안·복제/undo·화면 폭별 좌표 편집은 구현했으며 최신 [UC-009 증빙](docs/testing/responsive-block-layout.md)은 단위/실LLM/API PASS, 실제 UI BLOCKED다. [UC-010](docs/testing/pointer-block-layout.md)의 포인터 drag/resize 연결·키보드 편집은 컴포넌트/API PASS이며 실제 키보드·저장·새로고침과390/768/1440 대표 화면을 확인했다. [Ego 후속 증빙](docs/testing/pointer-block-layout.md#ego-실제-포인터-후속--2026-10-15)에서 분석22의 데스크톱/390px 모바일 배치 실제 마우스 drag/resize→미리보기→저장→reload→좌표 재조회와390/768/1440 저장 화면·컨트롤 정렬을 확인했다. [Ego 터치 후속](docs/testing/pointer-block-layout.md#ego-모바일-터치겹침경계-후속--2026-10-15)은390px Chromium 터치 에뮬레이션 drag/resize·겹침/좌상우 경계·최소/최대 너비·undo/redo→저장→reload를 확인했다. 작은 가로 차트의 축 라벨 공간 문제도 수정했다. 실제 휴대폰/멀티터치는 미검증이다. 이전 data: 오류 탭의 프로토콜 거절을 전체 브라우저 차단으로 일반화하지 말고 정상 HTTP 연결 상태를 확인한다. [UC-011](docs/testing/ai-block-layout.md)의 선택 블록 AI 배치 변경은 단위/실LLM/UI 저장·새로고침을 확인했다. 목적을 배치로 선택한 요청만 선택 폭에 적용한다. [연속 편집 회귀](docs/testing/block-editor-continuity.md)는 복제→직접→내용 AI→배치 AI→4단계 undo/redo→저장·새로고침을 확인했다. 과거 추가 모바일 차단 후 사용자 지정 Ego에서 [모바일 연속 편집 후속](docs/testing/block-editor-continuity.md#ego-모바일-후속--2026-10-15)을 수행해 복제→직접 제목→내용 AI→한 칸 배치 AI→4단계undo/redo→저장/reload와 비대상 정의/배치 불변을 확인했다. 실패 후 이전 성공 안내가 남는 오류도 수정했다. 임의 좌표 배치 문장의 unsupported 반환·실제 휴대폰은 남아 있다. P1 실제 터치/모든 경계 변형 gate는 Open이며, [UC-012 설계](docs/architecture/semantic-creation.md)는 P2 지표·원본 열 차원·분석의 제안/재사용·원자 저장 계약이다(Draft). [계획 A](docs/plans/UC-012.md)의 쓰기 없는 구조화 제안/미리보기 API는 단위90개·실LLM/API·Rill Parquet 수치 및 미리보기 DB 내용 불변을 확인했다([증빙](docs/testing/semantic-proposal.md)). [계획 B](docs/testing/semantic-creation-save.md)의 원자 저장·영수증 재시도·지표 링크는 단위/SQLite134개와 실제 API 검증을 완료했다. [C 기존 질문 UI 연결](docs/testing/semantic-creation-ui.md)은 FE60개·type/lint/build·실LLM/API 저장·재조회 PASS다. 생성은 구조화 API, 기존 수정은 종전 경로를 유지한다. 과거 Aside 차단 후 사용자가 명시 승인하고 Ego를 지정했다. Ego 실제 질문→미리보기→분석22 저장→새로고침/XHR·390/768/1440 대표 화면·Rill 수치/화면 비교를 확인했다. 저장 화면 부모 크기 덮어쓰기를 제거해 주요 버튼28px/입력32px를 실측했다. 운영 MySQL·모바일 오류/로딩 전체 상태·P1 실제 터치·제품 전체 수용은 미검증이다. 분석12의 공개 Rill 데이터 임시 익명 공유는 사용자 명시 허용 후 API 조회/기간갱신/중지를 검증했고 현재 중지 상태다. 지표를 먼저 저장해 미리보기를 만들지 않는다. 전체 여정에 직접 기여하지 않는 Rill 기능 고도화로 우선순위를 바꾸지 않는다.
- **P3 현재:** [UC013 의도](docs/testing/auto-block-intent.md)·[UC014 명시저장](docs/testing/prompt-save.md)·[UC015 대상](docs/testing/prompt-target.md)·[UC016 다중변경](docs/testing/batch-block-edit.md)을 구현했다. [UC017 복구](docs/testing/editor-recovery.md)는409/저장결과불명확에서초안·질문을보존하고읽기상태확인→동일저장확인또는최신본과제한병합→전체재미리보기/저장으로연결한다. 같은단위충돌은명시적으로내변경을선택하며비대상최신변경은유지한다. Ego실제2탭409·commit후본문유실/GET추가쓰기0·미전달/조회503복구·실제Codex시작후취소/종료·같은질문재시도/save/reload와390/768/1440패널28/32px·넘침0을확인했다. 구조변경자동병합·브라우저reload후영구초안·모든지표활성변형·운영/실기기·게시·전체P3/TC005는미완료다. 게시 연결은 아래 UC019를 따르며 P3 잔여 복구 경계와 전체 수용은 Open이다.
- **P4 현재:** [UC018 게시](docs/testing/publication-snapshot.md)는 저장본 전체기간/필터없음/UTC의 집계snapshot 미리보기→명시링크게시·재게시·중지다. SQL/원본/토큰 공개없이 숫자+추세·차트·논리배치를보존하고 활성재게시URL유지/중지·만료후새URL·마지막요청재시도/버전CAS를구현했다. BE125/FE31·type/lint/build, Ego분석12 게시→저장제목수정에도게시본불변→재게시→중지404→새URL재개/옛URL404→최종중지와390/768/1440을확인했다. 기존live공유는별도이며분석12는공유N/새게시activefalse다. SQLite1MiB/MySQL60KiB추가한도,안전집계증명기의240그룹제한을따른다. 운영MySQL/실휴대폰·계정수신자·전체P4/TC005는미완료다. [UC019 질문 게시](docs/testing/prompt-publication.md)는 명시 저장+게시 질문을 검증 초안 저장→같은 revision의 게시 미리보기→명시 링크 게시로 연결한다. BE142/FE97·type/lint/build, Ego 실제 질문/저장/미리보기/게시/reload·추가쓰기0·부정 게시 질문의 저장만 실행·버전 불일치 차단·390/768/1440을 확인했다. 저장 실패·취소는 이동하지 않고 미리보기 실패는 저장을 보존한다. 원격 shadcn UI(3e6c5ab4)를 보존해 통합한 뒤 BE250/FE102·type/lint/build와 Ego 추가 공간38에서 같은 실제 여정을 재검증했다. 새 UI 기본 버튼/입력36px·도구32px, 입력16/14px와 질문/날짜행 정렬·넘침0을 확인했다. 루트 전체 BE1617/FE981·build도 통과했다. 분석12는 원복·게시version9중지/익명404다. 다음은 P4/P5 복제·소스 교체·재사용 여정의 부족점 확인이며 전체 TC005 수용은 Open이다.
- **P5 현재:** [UC020 재사용](docs/testing/dashboard-reuse.md)은 소유 저장본 복제→DuckDB 소스/열 연결→전체 미리보기→원자 저장→새로고침이다. 새 대시보드/블록 ID·비공개 복사본과 모든 폭 배치를 보존하고 원본·지표·게시를 유지한다. ticket/requestId 재시도·SQLite rollback/권한/revision·Ego 분석12→23 및 새 소스 oracle·390/768/1440 정렬/넘침0을 확인했다. 공유 수신자 remix·질문 복제·운영MySQL·다른 생성 흐름과 SQLite 동시 경합·실휴대폰·전체P5/TC005는 Open이다. 검증 복사본23/소스23·24는 로컬 비공개로 보존했다. 다음은 공유/게시본 재사용의 권한 경계를 좁게 설계한다.
- **P5 공유/게시 후속:** [UC021](docs/testing/shared-dashboard-reuse.md)은 소유자 명시 허용·수신자 로그인·본인 파일 소스로 재사용한다. 공유는 현재 저장 정의, 게시는 private 고정 recipe를 사용한다. 새 API는 원본 SQL/소스/결과를 반환하지 않지만 허용한 계산식·필터 조건은 저장 복사본 소유자가 편집할 수 있음을 UI에 명시한다. 기존 live 공유는 제한 위젯 읽기 토큰을 유지하고 저장 SQL 정의는 응답에서 제거했다. Ego 두 계정 공유25/게시26 저장·reload, 소스27 oracle·403/401·중지404/내복사본200/영수증재확인·390/768/1440을 확인했다. 임시 링크·grant는 중지했다. 운영MySQL/실휴대폰/전체TC005는 Open이며 다음은 복사본AI편집→게시 통합 여정 점검이다.
- **복사본 통합 현재:** [UC022](docs/testing/copy-ai-publication.md)은 수신자 복사본26/source27의 AI 계산식2배/별도 제목 수정→전체 미리보기→명시 저장/게시 준비→같은 링크 버전1/2→소유·익명 reload를 Ego44에서 확인했다. 원본23·복사본25·비대상 정의/ID/모든 폭 배치 보존, 신규 제품 코드 없이 회귀1개 추가·BE166/FE104·type/lint/build PASS다. 게시 링크는 최종 중지했다. 실제 GET403/401와 서버 변경 거절 회귀는 확인했고 타 계정 변경 POST 실제 실행은 자동 승인 검토 거절로 NOT_RUN이다. 소유390/767/1440·익명390/768/1440을 실측했다. 최신 shadcn UI Kit의 일반36px/도구32px/입력36px를 따른다. 운영/실휴대폰·임의 자연어/미지원 AI식 게시 복구·전체TC005는 Open이며 다음은 전체 여정과 남은 gate의 선택 검증이다.
- **TC005 최신 통합:** [전체 여정/UC023 증빙](docs/testing/dashboard-lifecycle.md)을 우선한다. Ego45·전체 Rill1,391,572행/source28에서 생성/지표19재사용/Dimension→직접·AI·모바일 touch emulation 편집→저장/게시→다른 계정 새 소스31 복사본29→재게시/중지의 주 여정과 선택 오류를 검증했다. 생성 후 저장 질문이 새 제안으로 처리되는 공백은 [UC023](docs/architecture/creation-lifecycle.md)의 frozen proposal/digest 후속 질문과 신규 저장 revision handoff로 보완했다. receipt replay는 과거 revision을 증명하지 않아 게시 수동 미리보기를 요구한다. 실제 공개 금지는 명시한 게시 준비까지 취소하지 않는다. 전체BE1681/FE1017·root build·core E2E8개 PASS. owner390/768/1440, 수신자·익명390/769/1440 실측·넘침0이며 실제 휴대폰/운영MySQL·모든 자연어/경합·기존 거절된 타 계정 변경POST·사람 제품 수용은 Open이다. 과거 각 문서의 전체TC005 not_run은 역사적 상태이며 최신 검증 범위는 이 증빙을 따른다.
- **제품 계약:** 고객에게 모드/내부 구조 선택을 기본 선행 단계로 요구하지 않는다. AI와 직접 편집은 같은 블록 정의·배치를 수정하고, 기존 비대상 블록을 유지한다. Source·Measure·Dimension·Block·Dashboard·Publication 책임은 분리한다. 초안과 게시 버전, 원본과 복제본을 구분한다. 목표 전체 완료의 기준은 TC-005 실제 여정이며 주 여정 실행과 전체 수용·운영 gate는 최신 통합 증빙에서 구분한다.

- 매 세션 시작·재개 시 이 요약과 현재 브랜치·변경 사항·선택 P 단계/UC/BR·작업에 필요한 파일만 먼저 확인한다. 전체 이력과 상세 설계 문서는 반복해서 읽지 않고 필요한 부분만 추가로 불러온다. 사용자의 최신 지시를 우선한다.
- DuckDB Measure·Dimension·탐색·Pivot·보기 저장의 기존 상태는 [Rill 통합 계획](docs/strategy/2026-10-14-rill-feature-integration.md)을 참고한다. 이 문서의 과거 다음 작업보다 제품 목표의 P1~P5를 우선한다. 탐색 화면은 Rill과 비교하고 대화/블록/게시 경험까지 Rill 화면으로 제한하지 않는다.
- Rill 공식 데모 데이터를 기준으로 기능과 UI를 항상 비교한다. 유사한 탐색 UI를 구현하고, 같은 조건의 수치·API/XHR·실제 화면으로 검증하며 미확인은 명시한다.
- 분석 UI는 [UI Kit](docs/design/analysis-ui-kit.md)의 토큰·국소 테마·공통 선택 버튼을 먼저 재사용한다. 부모 화면에서 버튼 최소 높이를 강제하거나 화면별 크기 예외를 중첩하지 않고 실제 크기·밀도·상태를 확인한다.
- UI 요소 추가·수정 전 [검증 스킬의 디자인·레이아웃 회귀 기준](skills/vanillameta-verify/SKILL.md#ui-컴포넌트-디자인레이아웃-회귀)을 적용한다. 작업 중과 완료 시 크기·높이·정렬·간격·레이아웃·폰트 및 주변 요소의 틀어짐을 실제 화면으로 확인하고 기능/디자인 결과를 분리한다.
- 지표·분석 요청의 의미와 UI/저장 상태를 특정 엔진의 SQL·드라이버 실행과 구분한다. 이 경계는 현재 변경 범위에서 유지한다.
- BigQuery·AWS Athena 연결은 고객 수요가 확인된 향후 단계로 미룬다. 미래 확장만을 위한 범용 엔진 프레임워크나 전면 리팩터링을 현재 완료 조건에 추가하지 않는다.
- 외부 엔진을 실제로 설계·구현할 때만 [외부 분석 엔진 도입 지침](docs/strategy/2026-10-14-rill-feature-integration.md#외부-분석-엔진-도입-지침--사용자-합의-2026-10-14)의 상세 기준을 확인한다.

- AI 생성의 저장 지표 재사용은 [UC-002](docs/use_cases/UC-002-reuse-saved-metric.md)를 따른다. 동일 소스의 활성 구조화 정의만 제공하고 명시 참조의 계산식은 기존 제작 계산기로 적용한다. Assistant 수정 모드의 차트 선택 시 저장 지표를 지정하면 서버가 해당 차트에만 계산식을 강제하고 미리보기에 재사용을 표시한다. 분석에는 SQL snapshot을 저장하며 live 참조·자동 이름 매칭 완전 보장은 후속 범위다.

- 저장 지표 계산식 변경은 [UC-003](docs/use_cases/UC-003-update-metric-calculation.md)을 따른다. Assistant에서 지표·차트를 명시 선택하고 변경 미리보기 후 두 버전을 확인하여 지표와 선택 분석을 atomic 저장한다. 기본 단일 저장은 다른 분석의 snapshot을 유지한다. 지표 버전은 양의 정수이며 기존 제작 링크의 선택 snapshot도 갱신한다.
- 같은 지표의 일괄 반영은 [UC-004](docs/use_cases/UC-004-batch-metric-update.md)를 따른다. 영향 확인 → 연결된 소유 분석 최대10개 선택 → 전체 미리보기 → atomic 저장이며 지표 버전은 한 번 증가한다. 명시 연결 없는 이전 분석은 자동 추측하지 않고, 계산식 저장으로 연결을 기록한다. 차트 배치와 미선택 분석은 유지한다.

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
- 관련 단위/API → 기능 완료 시 변경 화면(현재 사용자 지정 Ego) → 통합 시 핵심 E2E → 출시 시 범위 확대 순으로 선택한다.
- 같은 코드/환경/픽스처에서 확인한 결과는 관련 변경이 없으면 재사용한다. 미실행은 통과로 보고하지 않는다.
- 상세 기준과 명령: [docs/testing/workflow.md](docs/testing/workflow.md).
- MD 시나리오/기대 결과: [docs/testing/cases.md](docs/testing/cases.md).
- 이 프로젝트 검증에는 `$vanillameta-verify`를 사용한다. 설치 전에는 [skills/vanillameta-verify/SKILL.md](skills/vanillameta-verify/SKILL.md)를 직접 읽는다.
- 기본 Playwright: `cd frontend-web && npm run test:e2e` (핵심 8개). 파일/`--grep` 선택으로 필요한 것만 실행한다.
- 격리 실행: `npm run test:e2e:isolated`. 확장 QA는 `npm run test:qa -- --grep '케이스 ID'`로 명시적으로 실행한다.
- UI 검증은 사용자 최신 지정 브라우저(현재 `ego-browser`) 실제 화면으로 수행하고 핵심/실패 캡처를 저장소 밖 증빙 폴더에 남긴다.

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
- 이 환경의 검증은 `AI_CODEX_BASE_URL=http://127.0.0.1:10100/v1`, `AI_CODEX_MODEL_CATALOG=/Users/moonklabs/.codex/opencodex-catalog.json`을 함께 지정한다. 전역 설정을 제외한 CLI 호출에도 필요한 연결·카탈로그만 명시적으로 전달한다. 다른 호스트에서는 이 경로를 복사하지 말고 실제 설치 설정을 확인한다. 실행 예와 확인된 증빙은 `docs/testing/ai-dashboard.md` 참조.

## VanillaMeta GitHub 작업 계정

- 사용자 지정(2026-10-14): VanillaMeta의 GitHub 조회·커밋 push·PR 작업은 `drumcap` 계정을 사용한다.
- GitHub CLI 작업 전 활성 계정을 확인하고 필요하면 `gh auth switch --hostname github.com --user drumcap`으로 전환한다. Git의 인증 계정도 동일한지 확인한다.
- 커밋 작성자 이름·이메일은 GitHub 인증 계정과 별개이므로 기존 Git author 설정을 임의로 변경하지 않는다.
