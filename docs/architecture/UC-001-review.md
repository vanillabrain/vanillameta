# UC-001 Spec Review

2026-10-14 별도 의미 검토 pass(작성자 본인 수행, 독립 리뷰 아님).

- 요구사항·UC·TC의 숫자/시계열 대응, 명시 저장·취소/실패 보존, 보조 설정 접기/재개방이 일치한다.
- 현재 widgets 저장 정의와 미래 독립 지표 레지스트리를 구분했다. 신규 DB/엔진 리팩터링이 이번 범위에 섞이지 않았다.
- 시계열 제공 불가 대안은 KPI를 숨기지 않으며 현재 결과만 보여준다. 미리보기에서 저장 화면과 같은 드릴다운까지 지원한다고 주장하지 않는다.
- CLI pin은 내용 digest, Tested는 검사 상태일 뿐 이해관계자 승인·운영 배포와 구분한다. 명세 상태는 Reviewed로 시작한다.
- 구조 lint: strict/no-baseline 0 errors / 0 warnings. 열린 의미 warning 없음. 의미 검토는 비결정적이며 별도 인간 수락은 미기록.

## Implementation synchronization review

구현 후 별도 비교 pass: 생성/수정 패널 모두 기존 MetricTrend를 사용하고, 생성 요청에 includeTrends를 추가했다. AnalysisUiProvider 국소 적용으로 기존 Assistant 부모 버튼 높이 예외를 제거했다. 설정·저장 보기·집계 원본 확인은 native details로 접지만 구성 요소를 유지한다.

실제 저장/reload의 평균 추세 SVG에8.5e-14 좌표 오차가 관찰되어 NFR-002를 상대1e-9로 명확히 했다. 정수 KPI는 정확히 같으며 화면 금액·추세 요약도 같다. 사용자가 요구한 의미를 바꾸지 않는 수치 허용 기준이다. 빈 질문 라벨 겹침은 shrink로 수정했다. UC는 Tested로 갱신하되 TC는 수동 시나리오이므로 Reviewed를 유지한다. 독립 metrics layer·모바일 물리 기기·VoiceOver·Rill 날짜축 동등성을 구현/검증 완료로 기록하지 않는다.
