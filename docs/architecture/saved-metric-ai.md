# Saved Metric AI Integration

## Scope

기존 BiService의 구조화 Metric.definition을 재사용한다. 저장 스키마·live reference registry·전면 리팩터링·새 UI 메뉴는 추가하지 않는다. 공통 구조화 계산기만 추출해 제작/AI가 공유한다.

## Contract

서버 소유권 확인 후 해당 소스의 활성 정의 최대30개를 LLM에 데이터로 전달한다. 생성 JSON 위젯은 선택적으로 metricId를 참조한다. 명시 참조는 서버에서 검증하고 기존 계산기로 숫자/분류 SELECT를 만든다. 단일 위젯당 한 지표, 기존 dimension/category·value alias 문법과 예시식을 유지한다. CHART_LINE 시간별 grain은 기존 preview 경로가 담당한다. 참조하지 않은 새 지표는 기존 SQL검증을 적용한다. 따라서 모든 자연어 지표명이 자동으로 매칭된다는 보장은 이번 범위에 없다.

## Security and persistence

소스 소유권과 활성/동일 소스/schemaVersion1 조건을 확인한다. 손상된 정의는 skip하며 추측해 수정하지 않는다. 알 수 없는 metricId는 재생성/실패로 처리한다. 정의 label은 프롬프트 데이터이며 명령이 아니다. 반환 draft와 저장은 canonical SQL snapshot이며 metric.definition은 수정하지 않는다. 기존 SQL의 WHERE·분류·정렬·LIMIT는 유지하고 명시 value alias의 계산식 부분만 교체한다. 공통 조회 필터도 기존 경로로 적용한다. 같은 계산 기준과 별개로 질문의 분석 범위를 임의 제거하지 않는다.

## Spec review

별도 의미 검토 pass(동일 작성자): 기존 정의를 제공하고 명시 참조만 강제한다는 범위와 새 지표 대안 흐름이 일치한다. 자동 이름 매칭·live registry 미구현은 명시했다. 소유권·손상·정의 불변·snapshot 저장은 검증 대상으로 유지한다. 승인 상태는 생성하지 않는다.

## Implementation review

구현 후 별도 검토 pass(동일 작성자): 기존 Bi 계산기 함수를 추출해 기능 중복을 피했다. 투영식의 지정 alias만 교체해 기존 WHERE·분류·정렬을 보존한다. 컬럼 인용의 SUM 검사 충돌을 실제 UI에서 재현해 따옴표 포함/미포함 표기를 회귀로 보완했다. 생성 응답의 reusedMetricIds는 선택 참조 증거이며 저장 정의에는 canonical SQL snapshot만 남긴다. 실제 두 KPI 참조3/4 재사용과 정의 불변을 확인했고, OS막대에는 참조 ID가 없으므로 자동 전파 완료로 과장하지 않는다.
