# FILE-12~18 현재 DuckDB 잔여 검증 — 2026-10-12

기준 `develop-v2 / 05c46b89` 이후 이번 frontend diff. vanillameta-verify로 미완료 조건을 선택했다. 실제 API4670/Chromium 웹3470, 기존 MVP 격리 metadata.db 및 uploads 재사용. AI는 Codex gpt-6-luna 유지하며 이번 작업에서 호출하지 않았다. 서버 import 코드는 변경하지 않았으며 기존 대용량/쿼터/AI 검증을 반복하지 않았다.

## API — 13개 입력 변형 PASS

| ID | 검증 |
| --- | --- |
| FILE-13 | 기존 oracle.csv를 JSON 및 Parquet으로 변환. 각201/3행/engine duckdb. rowsSql 6열3행 원값과 aggregateSql500 정확히 일치. 메타데이터 파일의 SQLite 헤더 유지 |
| FILE-14 | missing, zero bytes, header-only CSV, malformed JSON, scalar JSON array, corrupt Parquet 각400. 각 시도 전후 데이터소스 ID 목록 동일 |
| FILE-15 | 올바른 CSV 내용의 .txt를400으로 거절, 목록 동일 |
| FILE-16 | BOM·CRLF, `a,b`, `quote "value"`, 실제 newline+서울 값 보존 |
| FILE-17 | A B/A-B/duplicate A B/X/x/9number/Unicode 7열이 안전한 이름으로 유일하며 first~seventh 원값 모두 보존 |
| FILE-18 | heterogeneous JSON의 id/a/b/nullable union, missing/null은 null, alpha/gamma/20/30/yes 보존 |

FILE-13~18은 API 명세다. 스크린샷을 수치 정답 대신 사용하지 않았으며 저장소 밖 api-results.json에서 모든 pass=true를 독립 대조했다.

## FILE-12 — 실제 바이너리 장애 발견·수정·재검증 PASS

처음의 광범위 `.wasm` URL 차단은 Vite `?import&url` 로더 모듈도 차단했다. 서버 저장은 성공했으나 SPA 이동 후 로더 실패가 유지돼, 이 실행을 실제 WASM 초기화 복구 통과로 사용하지 않았다. 해당 JS 모듈 다운로드 실패는 hard reload가 필요한 별도 전달 계층 범위로 남긴다.

정확한 실제 WASM 바이너리 URL(로더 쿼리 제외)을 차단하자 Worker instantiate가 무응답 상태가 됐다. 20초 관찰 뒤에도 처리 중이며 파일 선택/서버 저장이 비활성화돼 FAIL. wasm-hung-before-fix.png에 저장했다.

initializeDuckDbWorker를 추가해 Worker error/messageerror와 15초 무응답 한도를 Promise.race로 처리한다. 타이머와 리스너는 성공/실패 모두 해제하고 기존 catch에서 Worker를 종료한다. 기존 UI catch가 오류를 안내하고 loading을 해제해 서버 저장을 다시 제공한다. 정상 브라우저 분석은 선택 실행으로 유지한다. 느린 기기에서 15초를 넘으면 서버 저장을 이용하며 무한 대기를 허용하지 않는다.

수정 후 같은 바이너리 차단:

1. 엔진 오류 안내 표시, 서버 저장 버튼 재활성화.
2. 차단 유지 중 실제 서버 upload201/3행, DuckDB query500.
3. 차단 제거, 데이터 화면으로 이동 후 파일 분석으로 SPA 복귀. 파일 재선택과 브라우저 분석으로 6열3행 표시, SQL 실행500. 복구 단계에서는 hard reload하지 않음.
4. 관련 회귀4개: 정상 초기화/instantiate 거절/무응답 중 Worker error/시간 초과 후 새 시도 통과. FE typecheck·변경 파일 ESLint·production build 통과. 기존 Vite 설정과 grid CSS minify 경고는 존재하나 빌드 성공.

네트워크 장애 주입으로 pageerror `Failed to fetch` 2건을 원본에 보존했다. 이를 실제 서버 장애나 pageerror0으로 보고하지 않는다. 정상 복구 화면과500은 별도 증빙이다.

## 증빙·정리

폴더 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/file-duckdb-boundaries`:

- api-results.json, expected.json, oracle.csv/json/parquet, edge.csv/collision.csv/heterogeneous.json
- wasm-results.json: 실제 차단 URL, 서버 버튼/저장/집계, 복구 및 원본 pageerror
- wasm-hung-before-fix.png, wasm-failure-after-fix.png, server-save-during-wasm-fault.png
- browser-recovered-three-rows.png, browser-recovered-500.png: 실제 복구 화면. 차트 애니메이션 종료 후 최종 캡처
- cleanup.json: 이번 생성 소스7~14만 삭제200, 기존 자산/서버 유지. 새 UI 자동화 코드는 저장소에 추가하지 않음

전체 MD 완료114 / 부분 완료9 / 미검증0. 다음은 FILE-01 정답 export, WIDGET-01/DASH-01 정답 신규 생성·재조회, NAV-04 일반 dashboard 미저장 취소와 디자인/Rill 잔여 조건이다. 전체 회귀나 출시 준비 완료를 뜻하지 않는다.
