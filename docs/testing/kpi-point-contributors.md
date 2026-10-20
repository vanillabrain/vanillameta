# KPI 미니 시계열 시점별 집계 입력 행

후속: [previous-point-contributors.md](previous-point-contributors.md)에서 이전 기간 KPI/시간 차트 시점 상세의 새 조건을 구현·검증했다. 아래 이전 기간 NOT_RUN은 당시 기록이며 이 후속의 선택 범위에서 해소했다.

기존 CONTRIB/TIME의 통과 조건은 반복하지 않는다. 이번 선택 범위는 숫자 지표 아래 미니 시계열의 개별 시점 원본 행 상세다. AI 제공자·모델은 Codex `gpt-6-luna`를 유지하며 수동 탐색에는 모델 호출이 필요하지 않다.

## 계약

시점 상세는 공통 필터·기간을 바꾸지 않는다. 저장된 KPI SQL의 WHERE와 집계 입력 조건, 실제 표시한 시간 컬럼·UTC 집계 단위·시점 목록, 현재 공통 필터·기간의 교집합으로 조회한다. 서버가 동일 추세 SQL을 다시 구성하며 클라이언트가 임의 기간이나 SQL을 제공하지 않는다. 파일·저장 정의·표시 시점 목록의 버전을 매 페이지 확인한다.

값이 NULL인 시점도 입력 조건을 증명할 수 있으면 표에서 조회한다. 가중 평균은 분자·분모 입력의 합집합이며 값 NULL인 행이 분모에만 참여할 수 있다. SUM 값이 NULL이고 비NULL 입력이 없다면 상세는 0행이다. 시계열의 기존 클릭/Enter 기간 필터 동작과 원본 행 버튼은 각각 유지한다.

## 선택 명세

| ID | 입력·기대 결과 | 상태 |
| --- | --- | --- |
| KPI-INPUT-01 | 13행 CSV의 정상 WHERE·online 필터, 시간별 SUM·가중 평균·환불 비율 입력을 별도 Decimal oracle과 대조. 0/음수/중복 보존, NULL 결과 시점의 분모 전용 행과 빈 SUM 상세 구분 | PASS_SELECTED_VARIANTS |
| KPI-INPUT-02 | 일·월요일 시작 주·월, 공통 기간에 잘린 버킷 및 자동 집계. 시점 원본을 열어도 공통 필터/기간·저장 정의 유지 | PASS_SELECTED_VARIANTS |
| KPI-INPUT-03 | 시점·컬럼·입도·hash 위조/오래된 정의·파일·혼합 요청 거부, 실패에서 이전 행 제거·재시도/새로 조회, 페이지와 응답 문맥 확인 | PASS_SELECTED_VARIANTS |
| KPI-INPUT-04 | 실제 1440/390 화면, 미니 차트 방향키로 시점 이동→별도 원본 버튼, 정확값 표의 NULL 시점 Space, 상세 Tab·내부 스크롤·Escape 초점 복귀, 문서 overflow 없음 | PASS_SELECTED_VARIANTS |

## 환경·증빙

Node24, FE3483/API4683, 기존 metadata DB·DuckDB 워커를 재사용한다. Aside guide/guide repl 뒤 실제 연결을 확인했으나 daemon 인증 challenge가 실패했고 실행되지 않았다. 앞서 허용된 headed Chromium 대체 검증으로 진행한다.

증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/kpi-point-contributors/`. 기존 13행 CSV를 입력으로 재사용하되 시점별 새 정답을 독립 계산한다. 검증용 새 소스·대시보드만 정리하며 원래 source24/dashboard26은 변경하지 않는다.

이전 기간 원본 상세·복잡한 SQL 계보·대용량 상세 성능·실제 VoiceOver·Rill/LLM 생성은 NOT_RUN이다. 기존 MD 카탈로그의 완료 집계를 늘리거나 전체 출시 회귀로 확대하지 않는다.


## 실제 결과 — 2026-10-13

KPI-INPUT-01~04의 선택 변형은 **PASS_SELECTED_VARIANTS**다. Python Decimal·UTC 달력으로 계산한 시점별 새 정답과 실제 API14조건이 수치·row_id·시점 응답 문맥 모두 일치했다. online+02-29 10시 SUM190/5행(id1,2,4,11,12), 가중290/6=48.333…/5행, 환불9/190/5행, 양수 COUNT_IF3/3행이다. 0·음수·같은 금액의 물리 중복을 보존했다. 11시 SUM/가중/비율의 값은 NULL이다. SUM은 비NULL 입력0행, 가중은 SUM(weight)에만 참여하는 id3/1행, 비율은 SUM(refund)에만 참여하는 id3/1행으로 구분한다.

10:30~11:00 종료 미포함으로 잘린 시간은 SUM90/3행(id2,11,12), 가중190/5=38/같은3행이다. 02-29의 일·02-26 시작 주·02-01 시작 월은 공통 02-29 범위 안의 입력만 반환한다. 주별 가중 입력은 id1,2,3,4,11,12/6행, 월별 비율도 같은6행이다. 날짜가 없는 자동 입도는 전체 소스 통계로 재구성해 시간별이 되며, 날짜가 있는 자동 입도와 함께 정확한 시점을 대조했다. 시간별은 기존 UI의 ‘자동’이 선택하는 입도이고 명시 선택은 일·주·월이다.

실제1440 화면에서 가중 미니 차트 ArrowRight→NULL 시점→Tab→독립 원본 버튼→Enter로 분모 전용1행을 확인했다. Escape 뒤 정확한 실행 버튼으로 초점이 복귀했고 channel=online·02-29 공통 기간은 유지됐다. 390 화면의 펼친 데이터 표에서 Tab5회(표 영역·첫 기간·첫 원본·다음 기간·다음 원본)→Space로 NULL 시점의1행을 열었다. 버튼 최소44px, 상세 Tab7회 대화상자 내부 유지·Escape 원래 표 버튼 복귀를 확인했다. SUM의 같은 NULL 시점은0행 상세다. 주별 시점도 현재 기간과 교차한6행이며 공통 날짜가 주 시작으로 바뀌지 않는다.

모바일 문서 scrollWidth/viewport는390/390, 시점 표는324/324다. 상세 표는client308/scroll828이며 이름 있는 영역에 초점을 두고 ArrowRight로 내부 scrollLeft7을 확인했다. 최초 모바일 측정은 키보드 스크롤 직후 애니메이션·Tab 이동 때문에0이었다. 미완료 스크롤 조건만 주별 상세에서 다시 확인했으며 이미 통과한 NULL 시점 열기·키보드 동작을 반복하지 않았다. 캡처로 레이아웃과 라벨도 확인했다.

실제 API 거부10조건: 현재 없는 시점·다른 입도/컬럼·시점 목록 hash·파일 버전·정의 버전 불일치는409, category/상위 hash를 섞거나 임의 SQL 키·잘못된 UTC 날짜를 보낸 요청은400이다. 페이지마다 hash 확인·소유권·동시 snapshot/정의·240점 제한·자동 입도 변경 및 프런트 응답 문맥/늦은 응답 차단은 관련 하위 검사로 확인했다. 오류 화면에서 이전 원본 행은0개다. 브라우저 route fixture503→재시도는 실제 서버에서 같은 주별 시점6행으로 복구됐다. 검증용 dashboard34의 설명을 다른 요청으로 변경한 실제409→저장 정의 GET→새 preview→같은 시점 상세6행도 복구됐다. 503은 실제 서버 장애 재현이 아니다.

원래 source24/dashboard26의 정의 revision `5cec6eb632a8b9c884ebf4c184a4961776885d1c00f38f677987d2fc5f0f9806`은 변하지 않았다. 기존 소스의 새 KPI 시점 상세도 실제 원본1행/amount10을 확인해 브라우저에 원래 대시보드를 남겼다. 검증용 dashboard34/source29만 API200/SUCCESS로 삭제하고 전용 탭도 닫았다. 입력 CSV·독립 정답·캡처는 보존했다.

## 검사·한계

BE 신규20+영향받는 기존191=211, FE 신규50(상태/상세40·미니 차트10)+영향받는 기존25=75, **고유 선택 검사286개 PASS**다. 반복 실행은 고유 수에 더하지 않았다. BE nest build·변경 파일 lint, FE 타입·변경 파일 lint·최종 production build, diff/문서 링크 확인 PASS. 정확한 명령과 hash는 `fe-verification.json`, `metric-trend-verification.json` 및 상위 evidence 폴더의 `kpi-trend-contribution-backend-verification.json`에 있다. FE 기존 Vite CommonJS/Toast UI CSS 경고와 BE 기존 테스트 non-null assertion 경고4개는 남아 있다. 최종 독립 검토는 정적 검토이며 브라우저 증빙을 대신하지 않는다.

이번 새 경로에서 제품 오류는 발견되지 않았다. API 검증 스크립트가 명시 hour를 보내 기존 계약의400을 받은 것은 자동 입도를 사용하도록 수정했다. 최초 화면 읽기는 존재하지 않는 main 역할 locator 때문에 timeout이 났고 실제 body 접근성 트리로 수정했다. FE409 검사에서도 숫자 위젯을 유지하지 않은 테스트 fixture만 수정했다. 이들은 제품 수정으로 계산하지 않는다.

기존 MD/E2E 통과 케이스·Rill139만 행·LLM 생성·VoiceOver·이전 기간 상세·복잡한 SQL·대용량 상세 성능은 NOT_RUN이다. 모델 호출0, Codex gpt-6-luna 설정·metadata DB·서버 DuckDB worker를 유지했다. 집계 입력의 의미·지원 제한은 [aggregate-contributors.md](aggregate-contributors.md)를 따른다. 이번 보강은 KPI 현재 추세 시점에 한정하며 과거 비교 시점 원본 상세는 남아 있다.

## 증빙

`contributions.csv`, `oracle.json`, `fixture.json`, `api-oracle.json`, `api-rejections.json`, `desktop.json`, `mobile-keyboard.json`, `week-mobile.json`, `recovery.json`, `cleanup-original.json`에 입력·기대값·실제 결과·정리 기록이 있다. 대표 캡처는 `active-null-point-desktop.png`, `null-denominator-desktop.png`, `point-table-mobile.png`, `null-denominator-mobile.png`, `empty-sum-mobile.png`, `clipped-week-mobile.png`, `point-query-error-mobile.png`, `point-query-recovered-mobile.png`, `point-definition-conflict-mobile.png`, `point-definition-recovered-mobile.png`, `existing-kpi-point-desktop.png`이다. `verification-results.json`은 최종 커밋·파일/증빙 hash·검증 범위·미실행·정리 결과를 기록한다.
