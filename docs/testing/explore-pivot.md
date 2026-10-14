# Pivot 탐색 검증

기준 codex/self-service-next-20261014 @ db584d6e + 작업 diff. 같은 Rill 원본 Parquet1391572행/source3/user2, bid_floor1..10 범위, UTC2023-09-10~11로 검증한다. 기존 숫자 범위·저장 보기 조건은 재사용하고 신규 교차 집계·축·탐색만 실행한다. AI codex/gpt-6-luna 유지/이번 경로 모델 호출0, VoiceOver BLOCKED 유지.

| ID | 조작 | 기대 결과 |
| --- | --- | --- |
| PIVOT-01 | 행device_type×열app_or_site, 요청SUM/입찰가RATIO_SUM | 독립 Parquet SQL의 모든 셀/행·열/전체 합계 동일. 전체 requests56663800, ratio3.071708773726648±1e-9. 비율 합계는 원본 재집계. 같은 Rill 모델/기간 표 비교 |
| PIVOT-02 | 열 없음→열 추가→행·열 교환→두 행 차원→행/열 필터→Explore전환 | 값/NULL을 구분해 필터, 기존 다른 조건 유지, 겹친 축 선택 차단, 공통 필터/기간/지표 전달. Pivot에서 Explore 조회 중단; 복귀시 원 조건 재조회 |
| PIVOT-03 | NULL·빈결과·COUNT/ratio분모0·큰정수·상위50행/12열·권한/revision/unknown입력 | 결측 조합을0으로 위조하지 않음. 합계에는 숨겨진 그룹도 포함. 응답/렌더 한도 명시. 소유권403/등록되지 않은 입력400/변경버전409 |
| PIVOT-04 | 조회503/재시도·지연 응답 후 축 변경 | 실패한 결과를 성공으로 남기지 않음·이전 조건 응답 무시·최신조건 복구. 새로고침은 기본 탐색으로 복귀하며 저장한 Pivot은 저장 보기에서 명시적으로 복원한다 |
| PIVOT-05 | 1440/390px, Tab/Enter/방향키/스크롤·행필터 | 문서 가로넘침0, 표 내부 스크롤/명시적 레이블·caption·합계·상태/오류. Rill 동일 상태/뷰포트 비교; 전체 스크린리더 판정으로 확대하지 않음 |

행 차원1..2/열 차원0..1/지표1..6의 첫 구현이다. 기존 worker/메타데이터·canonical 지표를 재사용한다. 선택 축은 첫 지표 합계 내림차순,50×12 표시 제한이며 전체 합계는 제한 전 조건이다. 시간버킷 축·계층 펼침·이전기간 Pivot·드래그/정렬 편집·Pivot 공유는 후속. Pivot 저장·재조회와 CSV는 아래 PIVOT-06~08에서 확장 검증한다.

Rill 공식 참조: [Pivot and Flat Tables](https://docs.rilldata.com/guide/dashboards/explore/pivot). 문서의 계층·드래그·시간축까지 구현했다는 뜻은 아니다.

## 실행 결과

2026-10-14 PIVOT-01~05 **PASS_SELECTED_VARIANTS**. 동일 원본의9행/2열/17셀, 모든행·열·전체합계 independent SQL 일치(requests56663800 / ratio3.07170877372671, 허용오차1e-9). Rill 실제56.7M/$3.07·모든표시값과 대조했다. BE13/PivotFE6·SourceExplore전환1, 타입/lint/build PASS.1440/390 overflow0, Tab/Enter/OSnative방향키/표내스크롤·고정행이름·행/열필터·축교환·503복구·50행숨은합계 PASS. 실제HTTP 타소유자500 발견→권한검사먼저수정→403 재검증PASS.

증빙·차이·선택범위: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-explore-20261014/RESULTS.md`. 원시값은VM전셀독립검사/Rill표시값·정의비교로 구분했다. 실제12열초과/지연소스교체UI·운영동시부하·실기기터치는NOT_RUN, VoiceOverBLOCKED 유지. 전체MD완료수130불변. AI codex/gpt-6-luna 유지/모델호출0. 현재워크트리 미커밋작업.


## Pivot 저장·CSV 확장 — 2026-10-14

| ID | 조작 | 기대 결과 |
| --- | --- | --- |
| PIVOT-06 | 현재 Pivot 저장→새로고침→보기 불러오기 | 모드·행1..2·열0..1·지표·필터·기간 복원 후 최신 데이터 조회. 기존 Explore v1 보기 호환. 겹친/미등록/시간 축·Pivot 없는 mode 거부 |
| PIVOT-07 | CSV 다운로드와 실제 파일 파싱 | long-form record_type별 셀/행·열·전체 합계 구분. 숫자는 K/M·단위·추가 반올림 없이 응답값 그대로. 빈 조합은 missing/빈 값, NULL 값은 present/빈 값. 표시 제한은 export_scope에 명시. BOM·CSV escaping·텍스트 수식 무력화, 숫자 음수 유지. 조건 변경/조회중/오류 시 오래된 결과 내보내기 차단 |
| PIVOT-08 | 1440/390px 저장·복원·내보내기, Tab/Enter | 모바일 문서 overflow0, Tab으로 내보내기 도달/Enter 다운로드. 동일 조건 모바일/데스크톱 CSV 스키마·정수 동일, DuckDB 재집계 비율은 기존1e-9 허용오차. VoiceOver 완료로 확대하지 않음 |

CSV는 최대50행×12열 표시 그룹만 내보내며 숨겨진 그룹을 포함하는 전체 합계를 별도 기록한다. 전체 무제한 export·Pivot 위젯 추가·자동 최종보기 복원은 범위 밖이다. 기존 SQL oracle/request totals는 재사용하고 새 CSV 정밀도/복원 조건만 실행한다.


PIVOT-06~08 PASS_SELECTED_VARIANTS (2026-10-14): Aside 실제 저장·새로고침·복원·Enter 다운로드 확인. headed Chromium390×844에서 복원/Tab 내보내기/Enter 다운로드·overflow0. 실제 다운로드17셀 요청값 exact/비율 independent oracle±1e-9. BE신규1·FE CSV/상태/Pivot/SourceExplore47+신규stale export1 PASS, FE타입·변경lint·BE/FEbuild·diffcheck PASS. 기존Explore shape 회귀 발견→mode는Pivot만직렬화→22회귀재검사PASS. 응답 raw 숫자 문자열을CSV에추가반올림없이저장(집계자체의DOUBLE오차는유지). 원시CSV·XHR·캡처·결과: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-saved-export-20261014/RESULTS.md`. 기존PIVOT01~05 전체반복안함. 표시제한CSV/큰정수/escaping은단위선택검사, 실제파일모바일·복원은UI.2행축실브라우저저장/실기기/VoiceOverNOT_RUN/BLOCKED유지. AI설정codex/gpt-6-luna 유지·모델호출0. 미커밋.
