# 여러 지표·차트 편집 — MD 검증

## 범위·독립 정답

SSBI-08의 미검증 여러 위젯 조건과 신규 편집 경로의 SSBI-14만 선택한다. 기존 프로파일·단일 제작·AI 통과 조건은 반복하지 않는다. 같은 소스의 저장 지표를 최대 6개 차트로 추가한다. SQL 차트는 서버 원본 계산을 유지하며 저장 지표로 명시적 전환해야 종류·분류를 바꾼다. 드래그 대신 이름 있는 이동 버튼과 너비·높이 선택으로 편집한다.

기존 6행 `self-service-orders` 소스를 재사용한다. SUM(amount)=150, COUNT(*)=6, COUNT DISTINCT(order_id)=5. 채널별 partner=90/online=30/store=30, 날짜별 2025-01-01..04=10/20/30/90. NULL 1과 중복 주문이 포함된 **검증용 자료**이며 실제 매출 회계 정의와 동일하다고 주장하지 않는다. 새 격리 대시보드를 생성하여 이전 통과 증빙을 보존한다.

## 새 조건·기대 결과

| ID | 실행·기대 결과 | 판정 |
| --- | --- | --- |
| EDIT-01 | 기존 막대에 합계·행 수·고유 주문·날짜 추세 추가, 실제 전체 소스 집계 정답 대조 | PASS |
| EDIT-02 | 숫자/막대/선, 분류, 제목·단위·소수·축약, 절반/전체 너비·3개 높이 변경. 순서 이동 유지, 수정 후 preview 무효화 | PASS |
| EDIT-03 | preview → 저장 → reload. 동일 ID, 순서·크기·표현·지표 snapshot 보존, 새 widget ID 매핑·겹침 없음 | PASS |
| EDIT-04 | SQL 대시보드 원본 계산 보존, 삭제된 지표 snapshot 보존, 다른 소스·사용자·위조 key·잘못된 크기·0/7개 차트 거부 | PASS |
| EDIT-05 | 두 편집 화면 충돌 409: 작성 내용 유지, 오래된 결과 저장 차단, 명시적 reload 확인 | PASS |
| EDIT-06 | preview/save 503 주입 시 내용 유지·오류 안내. 주입 해제 후 실제 재시도 성공 | PASS |
| EDIT-07 | 1440/390 화면에서 가로 overflow 없음·결과 표 내부 스크롤·크기별 차트 영역 일치 | PASS |
| EDIT-08 | DOM 선택 메뉴·라디오·이동·미리보기·저장 실제 키보드, 이동 후 대상 초점과 live 안내. 재로드 대화상자 취소·최신 reload 확인 | PASS |
| EDIT-09 | 변경한 공통 저장의 기본 레이아웃 유지, 불균일 행 packing·CAS rollback, stale preview 무시 관련 회귀 | PASS |

전체 스크린리더 발화는 별도 NOT_RUN이다. native select의 이전 BLOCKED 조건은 다시 실행하지 않으며 이번 편집 메뉴는 DOM 선택 컴포넌트로 검증한다.

## 실행·증빙

Aside daemon challenge fetch 실패, 실행되지 않음. 기존 허용된 실제 headed Chromium bridge로 FE 3483/BE 4683, Node 24, 격리 DB를 사용한다. 신규 Playwright suite를 추가하지 않고 MD 절차를 실제 브라우저로 수행한다. 증빙 폴더 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/dashboard-chart-editor/`.

AI 호출은 수동 편집에 필요하지 않으며 0회. 기존 codex/gpt-6-luna 연결 설정을 유지한다.


## 실행 결과 — 2026-10-13

- 대시보드 **20**에 저장 지표 13/15/16을 사용한 숫자 3개, 채널 막대, 날짜 선을 추가·이동했다. 첫 preview의 SUM=150/COUNT=6/DISTINCT=5, 채널 90/30/30, 날짜 10/20/30/90을 독립 정답과 대조했다. 키보드 편집 후에도 동일했다. 주문 수 표시 자릿수를 0으로 바꿔 최종 저장했다.
- 최종 순서: 총 결제액 → 주문 행 수 → 고유 주문 수 → 채널별 결제액 → 일별 결제액. 너비 6/6/6/6/12, 높이 3/5/3/7/5. 저장·reload에서 같은 ID와 정의/단위/소수/축약 옵션 유지. SQLite 조회로 layout ID와 DashboardWidget ID 일치, 겹침 0, v2 snapshot/원래 지표 정의와 차트별 presentation 분리를 확인했다. 축약은 설정 영속과 기존 포맷터 재사용을 확인했고 150을 K/M으로 표시해야 한다고 기대하지 않는다.
- 원본 SQL 대시보드 **21**의 `channel='online'` 합계 30을 그대로 보존하고 새 전체 합계 150을 추가했다. 요청에 위조 SQL을 넣어도 서버 SQL 30을 유지했다. 별도 지표 **23**을 삭제한 대시보드 **22**는 existing fallback/metricAvailable=false로 조회되고 원래 합계 150을 미리보기·저장했다. 이 후속은 삭제 후 **편집** 조건이며 이전 단일 제작 삭제 검사 반복이 아니다.
- 신규 편집 경계: 0/7개, 중복 key, 잘못된 너비, 타 소스 metric, 위조 existing key는 400. 다른 계정 GET/preview/save는 403. 오래된 revision은 409. 미리보기 및 최종 transaction 모두 검사한다.
- 실제 두 화면 충돌: 대시보드 21의 최신 제목 저장 이후 오래된 화면 preview 409. 미저장 제목 유지, preview/save 비활성화. 대화상자 취소는 유지하고 명시적 폐기 후 최신 제목 reload, 오류 안내 제거.
- preview/save 각각 브라우저 네트워크 503 주입. 편집 5개와 제목 유지. preview 실패 시 이전 결과 0개·저장 비활성화. 주입 제거 후 실제 query와 save 성공(20). 실서비스 장애나 자동 복구를 검증했다고 확대하지 않는다.
- 실제 390 키보드: DOM 메뉴 Enter/Home/방향키/Enter로 지표·소수·날짜 선택, 라디오 방향키로 종류/너비/높이/숫자 표시, Tab→Enter 추가, 이동·삭제·preview/save Enter. 추가 6개에서 상한 버튼 disabled, 단일 차트 삭제 disabled. 대시보드 제목→차트 지표→차트 제목→단위→소수→숫자 표시→너비→높이→추가→preview/save Tab 경로 기록. 이동 후 대상 H2 초점·aria-live 순서 안내 유지. 모바일 폭 390=390, 데스크톱 1440=1440.
- 모바일 결과 표를 연 뒤 실제 캔버스/컨테이너는 막대 340×360, 선 340×167로 일치했다. 화면 캡처를 직접 확인했고 표의 90/30/30 및 10/20/30/90도 읽었다.

## 오류 수정·재검증

1. **리뷰·회귀 FAIL → PASS:** 신규 크기 렌더가 새 draft의 layoutSizes와 이전 preview의 여러 widgets를 섞으면 차트 삭제/재조회 중 `.height` 예외가 발생했다. 3개→1개, 새 preview 대기 조건을 회귀로 재현했다. 크기는 해당 결과의 `preview.draft.layoutSizes`에서 읽고 안전한 fallback을 사용하도록 수정했다. 같은 회귀 PASS. 이 오류는 단위 렌더 재현이며 실제 오류 화면 캡처라고 주장하지 않는다. 실패 로그 `renderer-failure-before.log`.
2. **실제 키보드 FAIL → PASS:** 6번째 차트를 키보드로 삭제하면 activeElement가 BODY로 이동했다. 다음 생존 제목, 마지막 삭제 시 이전 제목으로 초점을 돌렸다. 실제 재검증에서 H2 `5번 차트 · 일별 결제액`으로 이동, 3개 삭제 회귀도 PASS. before/after PNG 및 JSON을 보존했다.
3. 구현 중 HMR이 미저장 폼을 다시 초기화해 새 시나리오가 중단됐다. 소스 수정 동결 후 중단된 저장 흐름을 진행했다. 이를 제품 저장 실패나 기존 통과 케이스 반복으로 세지 않는다. 측정 스크립트의 Tab 이름 추출도 radio label 기준으로 바로잡았다.

## 검사·증빙 및 남은 범위

BE 신규 editor 22개 + 영향받은 실제 DuckDB/SQLite 저장·기본 layout·CAS·snapshot 5개 PASS(27개). FE 새 editor 7개와 삭제 초점 3개, 수정한 분석 renderer의 기존 관련 7개와 새 대기 회귀 1개 PASS(고유 18개). BE/FE build, FE typecheck, 변경 파일 lint PASS. 기존 BE 테스트 non-null assertion 경고 4개와 Vite config/Toast UI CSS 경고 유지. 초기 포맷 lint 오류를 수정한 후 재검사했다. 전체 suite/core E2E를 실행했다고 보고하지 않는다. 저장 흐름은 이번 새 실제 브라우저 end-to-end 및 실제 SQLite 트랜잭션 검증으로 확인했으며 기존 통과 core 시나리오 전체는 반복하지 않았다.

증빙 파일:

- `preview-results.json`, `persistence-results.json`, `boundary-results.json`, `sql-preservation.json`, `deleted-definition.json`.
- `keyboard-results.json`, `keyboard-one-chart.json`, `keyboard-delete-before.json`, `mobile-layout.json`, `recovery-results.json`, `conflict-results.json`.
- **최종 성공:** `final-desktop.png`, `final-mobile.png`, `saved-mobile-exact-table.png`, `keyboard-preview-mobile.png`, `keyboard-delete-after.png`, `deleted-definition-preview-mobile.png`.
- 실패/복구: `keyboard-delete-before.png`, `preview-outage-mobile.png`, `save-outage-mobile.png`, `conflict-mobile.png`, `conflict-reloaded-mobile.png`.
- `saved-desktop.png`는 조회 진행 중 캡처이므로 최종 완성 화면으로 쓰지 않는다. 안정화 화면은 `final-desktop.png`이다.

한 DuckDB 파일 소스, 1~6개 숫자/막대/날짜 선 및 기존 지원 SQL 차트 보존 범위다. 다중 소스/원격 DB, 차트 제작 단계 필터 설계, 지표 버전 이력/비율·가중 평균, 모든 레거시 표현, 실제 VoiceOver 발화는 후속이다. 이전 native select BLOCKED와 VoiceOver NOT_RUN을 해소했다고 주장하지 않는다. gpt-6-luna 설정은 유지했고 이 수동 흐름에서 AI 호출은 0회다. 최초 검증은 develop-v2의 작업 변경에서 진행했고, 2026-10-13 후속 요청에 따라 구현과 이 검증 기록을 함께 커밋한다.
