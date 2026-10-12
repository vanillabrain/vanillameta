# Rill / VanillaMeta 디자인·LLM 결과 비교

## 비교 조건

동일 SHA256 Rill auction_data.parquet 1,391,572행, 전체 기간, 필터 없음, desktop1440×900. Rill 모델은 원본 날짜를 현재로 이동하므로 기간 명시/총량을 비교하며 원본 날짜 동일성은 별도다. 기존 저장/집계 검증은 관련 변경 없으면 재사용한다. 새 화면 캡처는 이번 실행으로 남긴다. 화면 반올림과 실제 집계값을 분리한다.

공통 질문:

> Using all available data, report total requests and average bid floor calculated as SUM(bid_floor)/SUM(has_bid_floor_cnt), then list requests by device_type sorted descending. Show a horizontal bar chart with all nine device labels and explain the calculation and time range. Do not change existing dashboards.

## DESIGN-01 — 데이터·질문·결과 일치

- 실제 제품 LLM 입력창에 위 질문을 입력한다. 미설정/지원하지 않는 작업을 수동 결과로 대체해 PASS하지 않는다.
- 기대: total634513000, avg5.5712386765263995±1e-9, 기기9개 기존 oracle와 일치. 설명에 전체기간/분모/필터 명시. 숫자 UI와 SQL/API 정답을 대조.

## DESIGN-02 — 읽기 화면

- 기대: 총 요청/평균 KPI, 기기별 내림차순 가로 막대, 9개 이름을 hover 없이 읽을 수 있음, 0기준 축, 단위·정밀도 일관성. 좁은 항목도 값 확인 가능.
- desktop1440×900에서 주요 정보가 보이고 차트가 절반 화면만 차지하며 나머지가 의미 없이 비어 있지 않음.
- 동일 기간과 필터 상태를 식별할 수 있음. 미제공 요소는 FAIL로 기록한다. 픽셀/색상 복제보다 작업 완료와 가시성을 비교한다.

## DESIGN-03 — 탐색/편집 UX

- 기대: 동일 화면에서 차원 필터 적용/해제, KPI·차트 갱신, 자연어 결과 확인·수정·취소. 제품에 없는 기능은 NOT_IMPLEMENTED.
- Rill 필터 Mobile/Tablet의 요청307763000 확인. VanillaMeta 동등 대시보드 필터 유무 확인.

## DESIGN-04 — 반응형·접근성 관찰

- 390×844에서 layout overflow/잘린 범주/KPI/핵심 버튼 관찰. 키보드 focus/명칭/차트 표 대체수단은 확인 범위별 기록.
- screenshot만으로 WCAG 준수를 선언하지 않음. 측정하지 않은 대비/스크린리더/전체 키보드 접근은 NOT_RUN.
- 키보드 선택 관찰: 기기 선택에 focus → Enter로 목록 열기 → Home으로 첫 항목 → Space로 선택 → Escape로 닫기. 선택 상태와 focus 복귀를 확인한다. 초기화·데이터 표·AI 편집은 Enter로 실행하고 편집창은 Escape로 닫는다. 표는 9개 기기 행을 포함해야 한다. 차트 리사이즈/애니메이션 완료 후 캡처한다.

### 2026-10-12 선택 관찰 결과

- DESIGN-04 키보드 항목: 최초 Space 선택 FAIL → MUI Select의 Space 억제에 대한 해당 목록 보완 → 실제 Chromium 재검증 PASS. 초기화, 9행 표 열기, AI 편집 열기/Escape 닫기 PASS. 전체 접근성 준수는 NOT_RUN.
- DESIGN-02 평균 통화 단위: 실제 gpt-6-luna 수정 요청으로 `$5.57` 저장·reload PASS. SQL·KPI·가로 막대 구성 유지. 전체 디자인 케이스 통과로 확대하지 않는다.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/codex-luna-connection/RESULTS.md`. 기존 통과 모바일/날짜 필터/집계 케이스는 관련 변경 없어 재사용.

## 수동 참조 구성 재검증

- 읽기 화면 비교에는 요청 KPI(0자리), 가중 평균 KPI(2자리), 기기별 가로막대를 사용한다. 기본 12열에서 KPI 각각 w6/h2, 차트 w12/h5로 배치한다. 데이터셋은 전체 요청/가중 평균과 기기별 집계를 분리한다.
- 수동/API 픽스처로 구성했다면 LLM 자동 생성 성공과 구분한다. 실제 브라우저에서 저장 후 reload, 범주 9개와 축 단위 확인, 데이터 표 보기/숨기기와 정확값 확인을 기록한다.
- 같은 데이터에서도 UI 반올림은 원본 값과 다를 수 있다. 숫자 KPI의 원본 title/ARIA와 데이터 표를 확인한다. 모바일 배치 단위검사는 실제 모바일 화면 확인을 대체하지 않는다.

## FILTER-01 — 공통 차원 필터

- 같은 Rill 원본으로 기기 `Mobile/Tablet` 선택: 요청 KPI307763000, 기기 막대1개, 모든 위젯에 동일 원본 범위 적용. 가중 평균은 필터된 원본에서 SUM(bid_floor)/SUM(has_bid_floor_cnt), 전체 평균을 재사용하지 않는다.
- 초기화로 전체 범위 복귀. 빨리 연속 변경하면 마지막 요청 결과만 반영. 조회 실패는 이전 결과를 현재 필터 결과로 오인하지 않게 표시한다.
- 컬럼/값/쿼리 검증, 다른 사용자 대시보드 수정 거절. 기존 통과 집계는 반복하지 않고 새 필터 집계만 고정 정답과 대조한다.

## AI-DASH-01 — 생성·수정·저장·취소

- 질문으로 초안 생성: SQL·설명·차트 미리보기 후 명시적으로 저장. 생성 자체는 저장하지 않는다.
- 수정 질문으로 초안 변경, 취소하면 원본 유지. 저장하면 같은 대시보드 ID를 유지하고 reload 후 변경 유지.
- 미설정/LLM 오류/잘못된 SQL/결과 필드 불일치는 제어된 오류. mock 제공자 검사는 실LLM 비교 성공이 아니다.
- 같은 질문과 수정 요청 `Rename the dashboard to Auction device analysis and show requests by device as a horizontal bar chart, keeping the two KPIs.`로 결과·단계·취소/저장 차이를 기록한다.

## AI-DASH-02 — 모바일 브라우저

- 실제 Chromium390×844: 공통 필터 선택/해제, AI 편집 열기·취소, KPI·긴 범주명·표 확인, 가로 document overflow 없음. 키보드/스크린리더 전체 준수는 별도다.
- Aside가 viewport 변경을 지원하지 않으면 기존 Playwright Chromium을 대안으로 사용하고, 실행별 증빙 스크립트로 남긴다. 사용한 브라우저/실제 viewport를 명시한다.

## FILTER-02 — UTC 날짜 범위·다중 선택

- Rill 모델의 현재 날짜 이동을 피하기 위해 비교 전용 raw 모델/metrics/canvas를 사용한다. 원본 SHA256/행수는 기존 결과 재사용. 원본 `__time` UTC 2023-09-09~2023-09-16.
- 날짜 2023-09-10~2023-09-11 양끝 날짜 포함, device_type Mobile/Tablet + Personal Computer. 기대 요청138055400, 가중평균4.633939385003283±1e-9, 기기별90789400/47266000 내림차순. 독립 원본Parquet SQL과 제품API를 대조.
- 같은 컬럼 선택은 OR, 날짜와 컬럼 간 AND. 날짜 편집만으로 조회하지 않고 적용 후 KPI/막대 갱신. 초기화로 날짜·모든선택 제거. 종료일 다음날00:00은 제외. 잘못된 날짜/역순/부분입력은 제어된오류이며 이전 결과의 범위표시는 유지.
- 실제desktop1440×900/mobile390×844에서 날짜입력·적용, 2개기기선택/해제, 선택값/기간표시, 데이터표/긴범주명, document가로넘침 여부 확인. Rill도 동일 기간·기기를 실제UI에서 선택하고 KPI반올림/범주와 비교. 불가능하면 BLOCKED로 기록하며 수동SQL 결과로 Rill UI PASS를 대체하지 않는다.

## AI-AGENT-01 — 로컬 Codex 실행

- 로컬LLM 사용하지 않음. AI_PROVIDER=codex, 설치된Codex CLI/기존ChatGPT로그인, 모델gpt-6-luna. 동일질문으로 생성·미리보기. 키/원본행은 전달하지 않음.
- 모델/로그인 불가, 타임아웃, 빈출력은 오류이며 다른 모델로 자동대체하지 않는다. 실제Codex 결과의 계산식·수치를 고정정답과 비교하고 출력/화면증빙을 남긴다. 단위mock 성공은 실제에이전트 성공으로 보고하지 않는다.
