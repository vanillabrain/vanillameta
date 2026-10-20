# 공통 필터·AI 대시보드 MVP 운영

- 메타데이터 DB 유지. 파일 분석은 기존 서버 DuckDB/worker를 재사용. 새로운 서비스·큐·패키지 없음.
- 현재 범위: 업로드된 단일 DuckDB 소스, 최대6개 위젯, KPI/가로·세로막대/선차트, 최대5개 다중값 차원 필터(각50개), UTC 일 단위 날짜 범위. 같은 컬럼 선택은 OR, 컬럼·날짜 간 AND. 공유 화면 필터는 이번 MVP 범위 밖이다.
- 목록의 AI 대시보드 만들기 → 소스/질문 → 서버 검증된 미리보기 → 저장. 읽기 화면 AI로 수정 → 수정 미리보기 → 취소 또는 명시적 저장. 원본 위젯을 다른 대시보드와 공유해도 편집 저장은 독립 위젯을 만든다.
- source CTE에 필터를 먼저 적용한 뒤 모든 위젯을 집계. 값은 파라미터 바인딩, 컬럼은 스키마 확인. dimension값은3분 캐시. SQL은 제한된 SELECT 문법이며 관계/파일 함수/쓰기 쿼리는 거절.
- 소유자 검사, 메타데이터 트랜잭션 저장. 분석 정의는 dashboard.analysisDefinition의 nullable text. prod는 synchronize가 꺼져 있으므로 배포 전 AddDashboardAnalysis1791763200000 마이그레이션 적용 필요. 이번 실행은 로컬SQLite만 검증했으며 운영DB마이그레이션은 미실행.
- 편집 저장 시 과거 위젯/데이터셋은 다른 대시보드 참조 보호를 위해 보존. 반복 편집의 고아 자원 정리는 후속 운영 항목.
- 현재 개발/검증 AI는 로컬 코딩 에이전트 방식: AI_PROVIDER=codex, 설치된 Codex CLI와 기존 ChatGPT 로그인, gpt-6-luna 고정. Ollama 등 로컬 LLM은 사용하지 않는다. 임시 read-only 작업 폴더에 스키마·질문만 전달하고 타임아웃180초/동시2개/출력64KiB로 제한. 다른 모델로 자동 대체하지 않는다. API 제공자 기존 경로는 호환용으로 유지.
- Codex CLI 호출은 사용자 전역 설정을 제외한다. 현재 환경의 OpenCodex 연결은 `AI_CODEX_BASE_URL=http://127.0.0.1:10100/v1`, `AI_CODEX_MODEL_CATALOG=/Users/drumcap/.codex/opencodex-catalog.json`으로 필요한 설정만 전달한다. 모델은 계속 gpt-6-luna로 고정한다. 전역 설정/모델/로그인 변경 없음.
- 2026-10-12 최초 unsupported(400)는 `--ignore-user-config`가 연결 주소·카탈로그를 제거해 기본 ChatGPT 경로로 요청한 결과였다. 기존 OpenCodex 경로를 명시한 동일 모델 probe는 성공했다. WebSocket426 시 CLI가 같은 모델 HTTP 전송으로 전환한다. 제품 생성·수정 검증 결과는 실행별 증빙 참조.
- 날짜 입력은 적용 버튼으로 집계하고 시작·종료일 UTC 양끝 날짜 포함(종료일 다음날00:00 제외). DuckDB 세션 UTC 고정. 필터는 조회 상태이며 저장된 대시보드 정의/공유 링크에 지속하지 않음. min/max 정보는3분 캐시.
- 새 AI 흐름은 원본행을 모델에 전송하지 않고 스키마·질문·초안만 전달. 구조화JSON+쿼리 실행검증, 실패시1회보정. SQL실행성공이 사용자의 의미/계산식을 항상 보장하지 않으므로 미리보기의 SQL·수치 검증은 필요.
- 스키마에 `*_request_cnt`/`*_request_count`가 있으면 요청 수 초안은 해당 컬럼의 SUM을 사용하도록 안내·검사한다. COUNT(\*)나 다른 카운터를 요청 수로 표시하면 보정을 요청하고, 재실패하면 저장 가능한 초안을 반환하지 않는다. 이 제한된 검사는 모든 지표의 의미를 검증하는 기능은 아니다.
- MD케이스 FILTER-01/AI-DASH-01/02: design-rill-parity.md. 이전통과사례 반복없이 영향받는 실패만 재실행.

- 신규 검증 FILTER-02/AI-AGENT-01은 design-rill-parity.md 참조. 기존 전체 회귀를 반복하지 않는다.

## 기존 로컬 서버에서 AI 사용

API를 `NODE_ENV=local`로 실행하면 `backend-api/.env.local`을 먼저 읽고 `.env.dev`를 기본값으로 사용한다. 셸 환경변수가 가장 우선한다. `.env.local`은 Git 추적에서 제외되며 실제 파일은 유지한다. 설정 예와 기존 서버 질문·저장·새로고침 검증은 [existing-ai-edit.md](existing-ai-edit.md)를 참조한다. 설정 변경 후 API를 재시작한다.
