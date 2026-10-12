# 공통 필터·AI 대시보드 MVP 운영

- 메타데이터 DB 유지. 파일 분석은 기존 서버 DuckDB/worker를 재사용. 새로운 서비스·큐·패키지 없음.
- 현재 범위: 업로드된 단일 DuckDB 소스, 최대6개 위젯, KPI/가로·세로막대/선차트, 최대5개 단일값 차원 필터, 전체 기간. 날짜 범위·다중값·공유 화면 필터는 이번 MVP 범위 밖이다.
- 목록의 AI 대시보드 만들기 → 소스/질문 → 서버 검증된 미리보기 → 저장. 읽기 화면 AI로 수정 → 수정 미리보기 → 취소 또는 명시적 저장. 원본 위젯을 다른 대시보드와 공유해도 편집 저장은 독립 위젯을 만든다.
- source CTE에 필터를 먼저 적용한 뒤 모든 위젯을 집계. 값은 파라미터 바인딩, 컬럼은 스키마 확인. dimension값은3분 캐시. SQL은 제한된 SELECT 문법이며 관계/파일 함수/쓰기 쿼리는 거절.
- 소유자 검사, 메타데이터 트랜잭션 저장. 분석 정의는 dashboard.analysisDefinition의 nullable text. prod는 synchronize가 꺼져 있으므로 배포 전 AddDashboardAnalysis1791763200000 마이그레이션 적용 필요. 이번 실행은 로컬SQLite만 검증했으며 운영DB마이그레이션은 미실행.
- 편집 저장 시 과거 위젯/데이터셋은 다른 대시보드 참조 보호를 위해 보존. 반복 편집의 고아 자원 정리는 후속 운영 항목.
- AI는 기존 OpenAI호환 제공자 사용. 로컬Ollama: AI_API_BASE_URL=http://127.0.0.1:11434/v1, AI_API_KEY=local-ollama(로컬placeholder), AI_MODEL=qwen3.5:latest, AI_TIMEOUT_MS=180000, AI_REASONING_EFFORT=none. 설치모델 재사용. 기본모델설정을 전역 변경하지 않음.
- 새 AI 흐름은 원본행을 모델에 전송하지 않고 스키마·질문·초안만 전달. 구조화JSON+쿼리 실행검증, 실패시1회보정. SQL실행성공이 사용자의 의미/계산식을 항상 보장하지 않으므로 미리보기의 SQL·수치 검증은 필요.
- 스키마에 `*_request_cnt`/`*_request_count`가 있으면 요청 수 초안은 해당 컬럼의 SUM을 사용하도록 안내·검사한다. COUNT(*)나 다른 카운터를 요청 수로 표시하면 보정을 요청하고, 재실패하면 저장 가능한 초안을 반환하지 않는다. 이 제한된 검사는 모든 지표의 의미를 검증하는 기능은 아니다.
- MD케이스 FILTER-01/AI-DASH-01/02: design-rill-parity.md. 이전통과사례 반복없이 영향받는 실패만 재실행.
