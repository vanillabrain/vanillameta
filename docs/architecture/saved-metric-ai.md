# Saved Metric AI Integration

## Scope

기존 BiService의 구조화 Metric.definition을 재사용한다. 저장 스키마·live reference registry·전면 리팩터링·새 탐색 메뉴는 추가하지 않는다. Assistant 안의 선택적 지표 입력만 추가한다. 공통 구조화 계산기만 추출해 제작/AI가 공유한다.

## Contract

서버 소유권 확인 후 해당 소스의 활성 정의 최대30개를 LLM에 데이터로 전달한다. 생성 JSON 위젯은 선택적으로 metricId를 참조한다. 명시 참조는 서버에서 검증하고 기존 계산기로 숫자/분류 SELECT를 만든다. 단일 위젯당 한 지표, 기존 dimension/category·value alias 문법과 예시식을 유지한다. CHART_LINE 시간별 grain은 기존 preview 경로가 담당한다. 참조하지 않은 새 지표는 기존 SQL검증을 적용한다. 따라서 모든 자연어 지표명이 자동으로 매칭된다는 보장은 이번 범위에 없다.

## Security and persistence

소스 소유권과 활성/동일 소스/schemaVersion1 조건을 확인한다. 손상된 정의는 skip하며 추측해 수정하지 않는다. 알 수 없는 metricId는 재생성/실패로 처리한다. 정의 label은 프롬프트 데이터이며 명령이 아니다. 반환 draft와 저장은 canonical SQL snapshot이며 metric.definition은 수정하지 않는다. 기존 SQL의 WHERE·분류·정렬·LIMIT는 유지하고 명시 value alias의 계산식 부분만 교체한다. 공통 조회 필터도 기존 경로로 적용한다. 같은 계산 기준과 별개로 질문의 분석 범위를 임의 제거하지 않는다.

## Spec review

별도 의미 검토 pass(동일 작성자): 기존 정의를 제공하고 명시 참조만 강제한다는 범위와 새 지표 대안 흐름이 일치한다. 자동 이름 매칭·live registry 미구현은 명시했다. 소유권·손상·정의 불변·snapshot 저장은 검증 대상으로 유지한다. 승인 상태는 생성하지 않는다.

## Implementation review

구현 후 별도 검토 pass(동일 작성자): 기존 Bi 계산기 함수를 추출해 기능 중복을 피했다. 투영식의 지정 alias만 교체해 기존 WHERE·분류·정렬을 보존한다. 컬럼 인용의 SUM 검사 충돌을 실제 UI에서 재현해 따옴표 포함/미포함 표기를 회귀로 보완했다. 생성 응답의 reusedMetricIds는 선택 참조 증거이며 저장 정의에는 canonical SQL snapshot만 남긴다. 실제 두 KPI 참조3/4 재사용과 정의 불변을 확인했고, OS막대에는 참조 ID가 없으므로 자동 전파 완료로 과장하지 않는다.

## Explicit selection extension

Assistant 수정 모드에서 차트를 선택한 경우에만 선택적 저장 지표 입력을 노출한다. 선택하지 않으면 기존 자연어 생성 흐름을 유지한다. selectedMetricId는 소유권 확인한 활성 catalog의 ID여야 하고 selectedWidget/currentDraft가 필요하다. AI는 선택 대상과 같은 제목의 위젯 하나만 반환한다. 서버는 선택 ID를 강제하여 canonical 계산식을 적용하고 원래 배열의 선택 위치에만 합성한다. 다른 차트와 대시보드 제목은 그대로 유지한다. 대상 불일치·복수 출력은 재생성/실패 처리한다.

미리보기는 서버가 검증한 widgetIndex/metricId/label을 표시한다. 이 표시는 이번 생성의 재사용 증거이며 저장 후 SQL snapshot으로 유지된다. live 연결이나 새로고침 후 지표 링크는 주장하지 않는다. 선택 변경은 미리보기를 stale 처리한다. 목록 로드 실패는 안내하며 기존 자연어 수정은 사용 가능하다.

검증: 참조 누락/상충에도 명시 선택 우선, 잘못된 선택 거부, 다른 위젯 보존, 상태 변경 시 저장 차단, 실제 선택→질문→미리보기→저장→새로고침 및 데스크톱/390px 크기 확인.

## Explicit selection implementation review

별도 검토 pass(동일 작성자): 선택 대상은 제목/단일 결과 계약으로 확인하고 서버에서 원래 배열에 합성해 다른 위젯을 보존한다. 누락 또는 상충 metricId는 선택 ID로 대체한다. 새 catalog GET은 기존 소스 권한 가드에 포함하고 공유/외부/legacy 접근을 차단한다. 정의가 없는 경우와 목록 실패는 자연어 수정 흐름을 유지한다. 선택 변경의 stale guard와 generation provenance 전달은 실제 transport 회귀에서 확인했다. 지표 삭제/수정이 생성 이후 일어나도 기존 저장 SQL snapshot은 독립적으로 유지된다. 목표 차트의 제목 변경은 명시 지표 선택 모드에서 지원하지 않으며 선택 해제 후 일반 수정으로 진행한다.
