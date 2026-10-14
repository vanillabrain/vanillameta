# Metric Calculation Update

선택적 Assistant 계산식 변경 dialog를 사용한다. source·metric·analysis 책임은 유지하고 사용자에게 내부 registry/SQL 편집을 요구하지 않는다. 대상 차트를 명시 선택해 이전 참조 없는 AI 분석도 처리한다. 자동 전파는 이번 범위가 아니다.

기존 metricChoices에 검증된 definitionVersion/definition을 반환한다. 버전1만 허용하던 catalog 검사를 양의 정수 버전으로 확장한다. 서버 preview는 저장 분석을 로드해 revision 비교하고, 활성 동일 소스 지표의 버전을 확인한다. 변경 가능한 필드는 aggregation/column/denominatorColumn/weightColumn/scale이며 label/source/format은 기존 정의에서 유지한다. 공통 metricFields/metricExpression으로 컴파일하고 공유 canonical 투영식 교체기로 선택 value alias만 교체한다. 검증된 기존 category alias와 날짜 expression도 유지한다. preview에 현재 필터·기간·grain·비교를 적용한다.

save는 같은 입력을 재컴파일해 SQL/client provenance 위조를 막는다. 기존 AiDashboardService.save의 내부 transaction에 선택 지표 CAS update를 추가한다. 지표 정의 문자열과 버전을 확인하고 실패·분석 충돌·위젯 생성 실패 시 rollback한다. public dashboard-save는 내부 변경 인수를 받을 수 없다. 변경 지표는 legacy aggregation/expression 필드도 동기화한다.

미리보기 이후 입력/조회 조건 변경은 저장을 비활성화한다. 변경 지표와 분석이 함께 저장된다는 문구를 명시한다. Undo 분석만 되돌리기는 이 지표 변경 흐름에 제공하지 않는다. 기존 일반 AI Undo 동작은 그대로다.

별도 의미 검토 pass(동일 작성자): 단일 대상 선택은 현재 SQL snapshot 계약과 호환된다. 두 자원 atomic CAS와 미리보기 전용 비변경 경계를 테스트하며 독립 승인/배포를 주장하지 않는다.

기존 structuredDefinition에 같은 지표 링크가 있으면 선택 항목의 정의/버전 snapshot만 갱신해 제작 화면의 연결을 유지한다. 다른 지표와 연결된 선택 항목은 오래된 링크를 제거하고 다른 항목은 유지한다. 신규 AI 링크 registry는 만들지 않는다.

## Implementation review

별도 검토 pass(동일 작성자): 공개 API는 클라이언트 SQL이나 내부 mutation을 받지 않고 저장 분석·활성 catalog를 다시 조회한다. 기존 save transaction 안에서 문자열 CAS를 적용하고 실패 시 metric rollback을 실제 SQLite로 검증했다. 선택 차트의 SQL projection만 교체하고 다른 차트·source WHERE·정렬을 보존한다. catalog는 양의 definitionVersion을 허용하며, 갱신된 AVG/비율 지표의 명시 참조는 AI 기본 요청 수 SUM 안내보다 우선한다. 참조 없는 요청 수 합계 검증은 유지한다. 일반 Assistant 수정/Undo는 지표 정의를 수정하지 않는다.

반응형 Drawer의 temporary/persistent 전환과 계산식 dialog 생명주기를 분리한다. 폭 변경으로 열린 편집 상태와 미리보기를 초기화하지 않는다. 이를 실제390↔1440와 전환 회귀로 검증한다.
