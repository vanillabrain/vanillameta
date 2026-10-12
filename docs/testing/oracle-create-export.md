# Oracle CSV export·위젯·대시보드 신규 생성 — 2026-10-12

기준 `develop-v2` / `ebfc3005`, 제품 코드 변경 없음. `vanillameta-verify`의 MD 잔여 조건만 실제 headed Chromium에서 실행했다. Aside daemon을 사용할 수 없는 기존 환경의 허용된 대체 브라우저를 재사용했다. URL은 FE `http://127.0.0.1:3470`, API `http://127.0.0.1:4670/v1`, viewport 1440×900이다. Codex `gpt-6-luna` 연결 설정은 유지했고 이번 수동 생성/내보내기에 AI 호출은 필요하지 않았다.

## 결과

| ID | 결과 | 새로 확인한 조건 |
| --- | --- | --- |
| FILE-01 | PASS | 기존 동일 oracle의 브라우저 3행6열/500 분석 증빙을 재사용했다. 그 분석이 열린 세션에서 현재 `SELECT SUM(amount) AS total FROM uploaded_data` 결과를 CSV로 다운로드했다. UTF-8 BOM을 해석한 CSV가 정확히 `[["total"],["500"]]`이므로 현재 결과와 일치한다. |
| WIDGET-01 | PASS | 실제 UI에서 oracle 소스15 / uploaded_data → 숫자판 → amount / 합계 선택, 확인 대화상자를 통해 신규 저장201. 위젯104의 fresh GET200과 페이지 새로고침 후 제목 및500 확인. 저장 응답과 조회의 option 동일, BOARD_NUMERIC 유지. |
| DASH-01 | PASS | 실제 UI에서 새 대시보드에 위젯104만 선택하고 `oracle_dashboard_500` 생성201. fresh GET200 및 새로고침 후 제목/500 확인. 생성과 재조회 layout이 정확히 `[{"w":6,"h":5,"x":0,"y":0,"i":"104"}]`, widgets는104 하나다. |

원본은 `frontend-web/e2e/fixtures/oracle.json`의 3행6열 CSV다. 신규 서버 저장은 DuckDB 소스15(3행), 후속 실제 원본 조회는 amount 100/250/150, 합계500과6열을 확인했다. 위젯의 TABLE 형식 datasetId51은 table_query 참조다. 이 값을 `/dataset/51`로 조회한 보조 점검은 ERROR(해당 SQL 데이터셋 없음)를 반환했으며 저장 실패가 아니다. 올바른 TABLE 소스 조회 및 위젯/대시보드 실제 데이터 로딩으로 검증했다. 해당 보조 조회도 원본 JSON에 보존했다.

새 pageerror 0. 기존 WASM 장애 주입에서 남은2건은 이번 오류로 세지 않았고 삭제하지 않았다. 초반 차트 카드의 두 줄 문구를 하나의 문자열로 찾은 조작은 locator timeout이었으며 화면의 개별 `숫자판` 텍스트 선택으로 계속했다. 제품 기능 오류는 발견되지 않아 제품 수정/전체 테스트·빌드는 실행하지 않았다. 이미 통과한 편집·삭제·차트·AI 조건은 반복하지 않았다.

## 증빙

원본 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/oracle-create-export`.

- `export-total.csv`: 실제 다운로드 파일.
- `ui-events.json`: 실제 UI 생성/재조회 응답(인증 헤더 제외).
- `fresh-source.json`: 원본 조회 및 table_query ID 보조 조회 기록.
- `verification-receipt.json`: CSV 파싱·option·widget ID/layout 비교 PASS.
- `export-500.png`, `widget-created-500.png`, `dashboard-created-500.png`: 실제 화면 캡처.
- 기존 분석 증빙: `../file-duckdb-boundaries/browser-recovered-three-rows.png`, `browser-recovered-500.png`, `api-results.json`.

소스15·위젯104·대시보드6은 격리된 로컬 검증 DB에 재현 가능한 샘플로 유지했다. 공유는 비활성이다. 새 E2E 코드는 저장소에 추가하지 않았다. 이번에 다룬 세 ID만 완료로 올렸고 NAV-04와 디자인/AI 비교 등 총6개 잔여 ID의 판정은 바꾸지 않았다.
