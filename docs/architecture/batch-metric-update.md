# Batch Metric Update

UC-003 계산식 dialog에 명시적인 영향 확인 버튼을 추가한다. 소유 UserMapping을 통해 Dashboard를 찾고 recognized structured-bi v1/structured-bi-dashboard v2/metric-linked-analysis v1의 sourceId와 metricId 연결만 사용한다. 삭제·다른 소스·연결 없는 분석은 포함하지 않는다. 현재 수동 선택 차트는 포함한다. raw AI의 UC-003 명시 저장부터 metric-linked-analysis JSON 연결을 기록해 이후 발견할 수 있게 한다. 기존 AI 생성에는 링크가 없었으므로 자동 backfill/SQL 추측은 하지 않는다.

impact는 읽기만 수행하고 각 대상의 revision, linked widget indices/titles/version을 반환한다. 사용자는 현재 분석을 포함한 최대10개를 선택한다. batch-preview/save는 대상 ID/revision만 받으며 대상 index와 SQL은 저장 연결에서 재확인한다. 각 대상에서 동일 지표의 모든 연결 차트에 canonical 계산을 적용하고 snapshot만 갱신한다. 현재 필터/기간/grain/compare는 동일 소스의 모든 preview에 적용하며 저장 SQL에는 고정하지 않는다.

기존 AiDashboardService.save의 persist callback에 내부 EntityManager를 선택적으로 전달해 같은 transaction을 공유한다. 지표 CAS는 첫 분석 저장에서 한 번 수행하고, 나머지는 같은 manager의 분석 CAS/위젯 저장을 실행한다. 버전 검사·permission·preview 실패는 쓰기 전 또는 같은 transaction rollback으로 처리한다. 공개 API에서 manager/mutation을 받지 않는다.

기존 single-preview/save 응답은 유지한다. batch-preview도 현재 분석의 기존 응답을 유지하면서 analyses[]에 각 대상 preview와 linked indices를 추가한다. 추가 결과는 접힌 영역에 차트별로 보여준다. 입력·선택 변경은 signature stale guard를 공유한다. 모바일 Drawer 전환과 dialog 상태는 분리한다.

별도 의미 검토 pass(동일 작성자): 저장 연결에만 근거하므로 false positive를 피하며 미연결 제외를 UI에서 안내한다. 최대10개 일괄 실행과 선택 대상 전부의 CAS/rollback을 검증한다. 독립 승인/배포를 주장하지 않는다.

계산식 단일/일괄 저장은 기존 DashboardWidget 순서의 layout geometry를 새 widget ID로 매핑한다. x/y/w/h 및 추가 제약은 유지하고, 매핑이 불완전하면 transaction을 rollback한다. 새 차트 제작의 기본 배치는 기존 경로를 유지한다. 알려진 다른 지표 연결은 미연결 개수에 포함하지 않는다.

검증 결과와 한계: [실행 증빙](../testing/batch-metric-update.md). UC-004 문서와 구현의 별도 의미 검토에서 BR-001 저장 연결, BR-002 미리보기 대상 일치/상태 전환, BR-003 전체 rollback 및 배치 보존을 대조했다. 독립 리뷰는 미실행이다.
