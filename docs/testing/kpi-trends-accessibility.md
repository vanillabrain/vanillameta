# KPI 시계열·DESIGN-04 후속 — 2026-10-12

기준 `develop-v2`, 시작 HEAD `d03d47b1` 이후 변경. 기존 완료 케이스를 반복하지 않고 새 시계열 및 미검증 접근성 조건만 선택했다. AI 설정은 Codex `gpt-6-luna` 그대로이며 이번 실행에서 신규 LLM 호출은 하지 않았다.

## MD 조건

- DESIGN-02 추가: 상단 숫자 KPI 안에 동일 원본·동일 필터·동일 계산식의 시계열을 표시한다. 8일 이내는 시간별, 이후 일/주/월별로 집계한다. 요청은 SUM, 평균 입찰가는 SUM(bid_floor)/SUM(has_bid_floor_cnt)를 각 구간에서 다시 계산한다. 시각 좌표는 실제 시간 간격을 사용하며 0을 포함하는 세로축·면적 채움을 제공한다. NULL 구간을 연결하거나 0으로 대체하지 않는다. UTC 시각과 정확한 값은 펼침 표로 확인한다.
- DESIGN-04 추가: desktop1440×900/mobile390×844에서 넘침, 텍스트 대비, 키보드 포커스를 확인한다. 헤더 메뉴·기간 입력·필터·추세 표·공유/AI 수정/삭제 취소 경로를 키보드로 탐색한다. 대화상자는 이름, 상태, 닫기, 포커스 복귀를 확인한다.
- 실제 스크린리더 발화와 탐색은 AX 트리 검사와 별도 조건이다. 다른 페이지 전체, 모든 오류 상태, 모든 브라우저의 WCAG 준수를 이 결과로 선언하지 않는다.

## 환경·증빙

Aside daemon 인증 연결 실패로 승인된 headed Chromium 대체를 사용했다. 프런트 `http://127.0.0.1:3400/dashboard/5`, 실제 preview 요청만 격리 API4681로 전달했다. 원본 DB를 백업한 `trends.db`와 기존 1,391,572행 Parquet/업로드를 재사용했다. 응답 데이터를 가짜 시계열로 바꾸지 않았다. 기존 서버4500/4670은 종료하지 않았다.

증빙 루트: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/kpi-trends-accessibility`.

| 조건 | 결과 | 증빙/한계 |
| --- | --- | --- |
| 일별 초기 형태 비교 | 수정 필요 → 재검증 PASS | 초기 `desktop.png`는 8점·상대 축이라 Rill과 모양이 달랐다. 사용자 지적 후 시간별·0 기준·그라데이션 면적으로 변경. |
| 전체 기간 실제 집계 | PASS | `hourly-preview.json`, `oracle.json`: 두 지표 각각169점, 합계634513000. 원본 Parquet 독립 DuckDB SQL과338개 값 일치. |
| Rill 시계열 형태 | PASS, 한정 비교 | `rill-lines.json`, `rill-shape-comparison.json`: Rill의 실제 SVG 선도 각각169점. 원본 시계열값과 SVG y좌표의 선형 관계 최대 잔차0.000533px 미만(3자리 SVG 좌표 반올림 범위). 수치·곡선 형태 비교이며 픽셀 동일성/독립 Rill 값 API 검증을 뜻하지 않는다. Rill 모델의 현재 날짜 이동은 유지, VM은 원본2023-09-09~16 UTC. |
| 날짜·기기 필터 후 새 추세 | PASS | Mobile/Tablet, 2023-09-10~11. 각48점, 총요청90789400. `filtered-preview.json`, `filtered-oracle.json`:96개 구간값 독립 SQL 일치. 기존 필터 일반 동작의 반복 판정이 아니라 새 추세 적용 검증. |
| 계산식·NULL·미지원 SQL | PASS, 하위 검사 | 실제 DuckDB를 포함한 BE31개: 가중 평균 계산식/WHERE 보존, 바인딩, 요청 날짜 열, NULL 유지, 미지원 SQL에서 KPI 보존. 날짜 없는 소스/240점 초과는 추세 불가 안내하며 숫자를 임의 생성하지 않는다. 해당 안내의 모든 UI 변형은 NOT_RUN. |
| 시간 간격·0 기준·빈 값 | PASS | FE geometry4개: 시간 간격, NULL에서 선/면적 분리, 정상0 유지, 단일점/빈 값, 양수/음수0 기준. DashboardAnalysis 포함 총11개 통과. |
| 모바일 가시성 | PASS | `mobile-hourly.png`, `mobile-hourly-table.png`:390×844, document.scrollWidth390, 두 KPI/추세/표 유지. 표169행의 스크롤 영역에 Tab 진입. |
| 대비 오류 | 수정·재검증 PASS, 측정 범위 한정 | 구분자4.20:1, 모바일 푸터4.317:1 → #656565. 활성 입력 경계 #858585, 키보드 포커스 #1d4ed8. `contrast-before.json`, `contrast-mobile-before.json` 실패 보존. 최종 표 열린 화면390개 텍스트/모바일 텍스트 검사에서 실패0. 입력값/캔버스/모든 상태를 텍스트 TreeWalker 측정으로 대체하지 않는다. |
| 키보드 가시성 | PASS, 대상 화면 | `tab-before.json`의 포커스 outline 없음 → 공통 focus-visible/Mui-focusVisible 2px 적용. `tab-after.json` 40회 Tab, focusVisible 요소 중 outline 없는 항목0. 실제 날짜 입력의 내부 세그먼트는 여러 Tab 정지점이다. |
| 대화상자·표 | 수정·재검증 PASS | 공유 토글 이름·상태, 만료 입력/달력 이름, Escape와 공유 버튼 복귀. 계정 팝업도 대화상자로 변경 후 Escape/원 버튼 복귀. AI 수정 입력→Tab 취소→Escape 복귀(생성/저장0). 삭제 확인의 빈 제목·잘못된 label ID를 보완하고 취소 후 삭제 버튼 복귀(삭제0). 추세 표 Enter 펼침/접힘 및 Tab 스크롤 진입. |
| 헤더·달력 탐색 | PASS, 한정 경로 | 언어/자동새로고침 목록 Enter→Escape, 추가 메뉴/계정 창 탐색. 만료 달력 키보드 열기·닫기. 메뉴 선택·날짜 저장·로그아웃·공유 상태 변경은 수행하지 않았다. |
| 스크린리더 구조 | PASS, AX 관찰만 | `hourly-table-aria.txt`, `mobile-aria.txt`, `calendar-aria.txt`: 추세 IMG 이름/설명, 기간/계산값, 표 caption/열·행 header, 대화상자 이름/토글 상태. |
| 실제 VoiceOver 발화·전체 탐색 | BLOCKED | native UI 도구가 동일 bundle ID의 여러 Chromium 인스턴스 중 실제 검증 창을 선택하지 못했다. 별도 인스턴스 선택·창 목록 확인에도 대상이 signup/시작 창으로 반환됐고 입력 반영도 불안정했다. 발화·읽기 순서·스크린리더와 키보드의 결합은 통과하지 않았다. DESIGN-04는 부분 완료 유지. |

## 변경 및 운영 범위

추세는 preview의 `includeTrends:true`일 때 숫자 카드별 추가 SQL을 실행한다. 생성/저장의 기존 preview에는 추가 스캔을 강제하지 않는다. 현재 화면에는 숫자 카드2개이므로 필터 조회마다 추세 집계2개가 추가된다. 신규 의존성/상시 서비스/Playwright 저장소 테스트 코드는 추가하지 않았다. SVG와 접힌 표는 카드당 최대240점이며 초과를 조용히 잘라 표시하지 않는다. 정확한 시점값은 표에서 제공한다. Rill의 hover·기간 드래그·비교 기간 탐색은 아직 동등 구현이 아니다.

FE 관련11개·BE31개, BE/FE 빌드, FE tsc, 변경 파일 ESLint, git diff --check 통과. 빌드의 기존 Vite 설정/Toast UI CSS 경고는 유지한다. 전체 유닛/E2E 재실행·출시 회귀는 생략했다.
