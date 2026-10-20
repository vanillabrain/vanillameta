# 데이터 암호·필터 소유권 잔여 검증 — 2026-10-12

기준 `develop-v2 / 38f42b36` 이후 이번 DatabaseService diff. `vanillameta-verify`로 DATA-08 실제 암호 연결과 FILTER-01 타계정 조건만 실행했다. 기존 Rill 수치/필터/복구, 인증 통과는 재사용했다. AI 연결은 Codex `gpt-6-luna` 유지. 이번에는 모델 호출 없음; 타계정 draft 요청은 owner 검사에서 먼저403으로 거절됐다.

환경: API4670 / 실제 Chromium 웹3470, 기존 MVP 격리 메타데이터. 새 로컬 PostgreSQL은 설치된 바이너리로 전용 pgdata/127.0.0.1:55439에 생성했다. SCRAM 암호 인증: 잘못된 암호는 인증 실패, 정상 암호는 실제 uploaded_data 3행의 합계500. SQLite에 무시되는 password 필드를 넣는 방식으로 대체하지 않았다.

## DATA-08 — PASS, 발견 오류 수정

- 최초 실제 POST `/database` 201 응답에 입력한 암호가 반환됨: `before-fix.json`의 secretReturned=true. 해당 원문 암호는 증빙 JSON에 기록하지 않았다. PostgreSQL 목록/info/detail의 단순 password 제거는 이미 동작했다.
- 추가 회귀에서 credential을 포함한 connectionString은 생성/목록/info/detail 응답에 남음: 수정 전4개 실패, 수정 후4개 통과.
- DatabaseService의 공개 connectionConfig에서 password/connectionString을 복사 과정에서 제거한다. 내부 복호화/암호화 저장과 실제 연결 설정은 유지한다. 새 의존성 없음.
- 수정 후 실제 생성201, 목록/info/detail200, 수정200 모두 암호 문자열 미포함. 상세 uploaded_data 테이블 목록과 쿼리500, 수정 후 재쿼리500 정상. 실제 UI 연결 편집에서 Host/User/Schema는 보이고 Password는 빈 입력. 데이터 화면에서 PostgreSQL uploaded_data 목록 표시.
- 실제 API PostgreSQL 검증과 credential URL 회귀를 구분한다. CockroachDB 실제 원격 연결은 실행하지 않았다.

## FILTER-01 — PASS, 기존 통과 조건 재사용

- 소유권 검사 전용 DuckDB fixture(device/requests 2행)로 소유자 대시보드5 생성. 합계42는 fixture 준비 확인이며 Rill 정답 검증을 다시 실행한 것이 아니다.
- 다른 테스트 계정의 GET analysis, POST filtered preview, rename save, draft 요청 모두403 `not dashboard owner`. UI 대시보드 접근 시 조회 실패 안내와 빈 본문, 원 이름/수치 노출 없음.
- 소유자의 analysis 재조회200, 초안 JSON 전후 동일. dashboard/dashboard_widget/widget/dataset/user_mapping 전체 행의 정렬 해시 전후 동일. API 거절 뒤 원 대시보드 실제 화면의 제목·필터·42를 확인했다.
- dashboardId를 지정한 기존 대시보드 소유권 계약의 검사다. 독립 새 초안과 전역 데이터소스의 테넌트 설계 전체를 검증한 것으로 확대하지 않는다.

## 검사·증빙

관련 회귀4 PASS, backend build PASS, 변경2파일 ESLint PASS, diff check PASS. 공개 응답만 변경했으므로 전체 E2E/파일 업로드/Rill/AI를 반복하지 않았다. 브라우저 pageerror0. 초기 fixture의 type `pg`는 UI 타입 코드가 아니어서 정상 `postgres` 코드의 별도 UI fixture로 수정했다. 제품 버그로 분류하지 않는다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/data-filter-boundary`.

- `before-fix.json`, `after-fix.json`, `postgres-auth.json`: 비밀값 대신 노출 여부, 실제 HTTP·암호 인증·집계 기록.
- `filter-owner-checks.json`, `owner-draft-before/after.json`, `owner-assets-before/after.json`:403 및 원 자산 보존.
- `connection-before-fix.png`: 연결 편집 화면 맥락. API 암호 노출 자체의 증거는 JSON의 노출 판정이며 화면에서 암호가 보였다는 뜻이 아니다.
- `connection-after-fix.png`, `postgres-tables-after-fix.png`, `owner-filter-dashboard.png`, `foreign-dashboard-blocked.png`: 실제 브라우저 캡처.
- `page-errors.json`: 이번 관찰까지 제품 pageerror0.

원본 암호/키/pgdata는 전용 비공개 파일에만 두며 저장소에 추가하지 않는다. 검증 종료 후 이번 작업의 PostgreSQL 소스3/5/6과 전용 PostgreSQL 프로세스만 정리한다. 소유권 fixture는 격리 메타데이터에 남겨 재현할 수 있다.

전체 MD 완료107 / 부분 완료16 / 미검증0. 다음은 FILE-12~18의 현재 DuckDB 경로 잔여 조건이다. 부분 완료가 남아 있으며 출시용 전체 회귀/운영 검증 완료는 아니다.
