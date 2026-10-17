# Studio 매출·환불 추천 질문 — 2026-10-17

## 범위와 계약

P2/P3 첫 소스→자연어 생성의 입력 부담을 줄인다. 기존 Studio 생성 입력창에 공통 shadcn Button을 재사용해 매출·환불 요약 / 주문일별 결제 추세 / 주문 기준 환불률을 표시한다. 추천 클릭은 질문 채우기와 입력창 포커스만 수행하며 사용자가 기존 생성 버튼을 눌러야 AI가 실행된다. 질문은 편집 가능하고 저장·게시도 기존 명시 단계를 유지한다.

소스 프로파일의 numeric/temporal 열과 전체 null 여부로 각각 표시한다. revenue/refund_amount/net_amount가 없으면 요약을 추천하지 않고, ordered_at 시간 열이 없으면 추세를 추천하지 않는다. paid_orders/refunded_orders가 있어야 주문 수 분모를 명시하는 환불률을 추천한다. 이 게이트는 질문 제안이며 계산 의미·권한의 서버 검증을 대체하지 않는다. 임의 amount 열을 매출로 추측하거나 채널 값이 없는 데이터에 채널 분석을 권하지 않는다.

busy/복구/저장 불명확은 기존 locked를 따르고 생성안이 존재하면 추천을 잠가 의도치 않은 교체를 막는다. 직접 질문 편집 경로는 유지한다. 신규 의존성·모델/서버 엔진 변경은 없다. 이전 Commerce 통화 문맥 변경은 같은 미커밋 상태로 유지한다.

## MD 조건

| ID | 동작 | 기대 결과 | 결과 |
|---|---|---|---|
| QUESTION-01 | 열이 있는/없는 소스 | 지원하는 추천만 표시·전체 null 필수 열은 추천 제외 | 컴포넌트 PASS |
| QUESTION-02 | 추천 클릭·Tab/Enter | 질문 입력/수정·입력창 포커스, 자동 생성/저장/게시0 | PASS_SELECTED |
| QUESTION-03 | 주문 기준 환불률 추천→명시 생성/저장/reload | 2주문/1환불/50%·원본 보존 | PASS_SELECTED |
| QUESTION-04 | 390/768/1440·생성안 있음/로딩 | 버튼 정렬/높이/줄바꿈/포커스·잠금·넘침0 | PASS_SELECTED |
| QUESTION-05 | 소스별 빈 입력창 예시 | 매출·환불/광고 필수 열에 맞는 예시, 그 외 중립 안내·자동 전송0 | PASS_SELECTED |
| QUESTION-06 | 질문 작성 후 소스 변경 | 예시는 갱신하고 작성한 질문은 보존 | PASS_SELECTED |

기존 통과 조건은 반복하지 않고 변경한 질문 선택과 대표 새 흐름만 실행한다. gpt-6-luna 유지·VoiceOver BLOCKED 유지. 실제 고객/실휴대폰/운영/전체 키보드 수용은 별도다.


## 실행 결과

Ego15·기존 합성 KRW source4에서 실제 버튼과 키보드 Enter/ShiftTab을 사용했다. 매출 요약→환불률 추천 선택은 입력창에 해당 질문을 넣고 TEXTAREA로 포커스를 보냈으며, 이 시점의 dashboard/StudioState/Commerce 해시와 dashboard/database/metric/publication 개수가 모두 불변이었다(`question-no-write.json`). 자동 API 실행0은 컴포넌트 mock 호출로 확인했으며 이 DB 불변만으로 모든 HTTP 요청0을 주장하지 않는다.

추천 환불률 질문을 별도 생성 버튼으로 실제 Codex gpt-6-luna에 실행했다. paid_orders SUM2·refunded_orders SUM1·RATIO_SUM(refunded_orders/paid_orders)×100=50.00%로 추가 분모 질문 없이 계산했다. 기존 환불률 지표#8 재사용·주문 수 지표2개 신규, 키보드 명시 저장→비공개 dashboard6→reload/실API에서 같은 숫자·단위를 확인했다. 최종 dashboard6/database4/metric11/publication0이다. 원본 dashboard1~5/StudioState·Commerce의 사전 해시가 모두 일치하며 원본 추가 변경0이다.

기능 PASS_SELECTED와 디자인 PASS_SELECTED를 구분한다. 추천 버튼은390/768/1440 모두 높이36px/글자14px·gap8px이며 모바일은 두 줄로 감싼다. 입력·포커스 링·생성 후 잠금을 실제 화면과 DOM으로 확인했다. 3폭 document.scrollWidth는 각각390/768/1440과 일치했고 저장본도 3폭 넘침0이다. screenshot을 직접 검토했다. 저장본 건수 단위는 모델이 반환한 영어 `count`로 보존하며 한국어 `건` 표시 통일은 후속 문구 개선이다. 데이터별 placeholder 문구 개선도 별도다.

초기 추천 UI 부재 테스트1 FAIL→구현 뒤23 PASS→전체 null 필수 열 회귀 추가 후 최종24 PASS. FE type/변경 lint/build·diff whitespace PASS. BE 제품 코드는 이번에 수정하지 않아 직전 Commerce context55·build/lint 결과를 재사용한다. 전체 suite/core E2E·기존 Rill/Commerce PASS는 반복하지 않았다. 실제 LLM은 환불률 추천1개를 실행했으며 다른 두 추천의 실LLM 전체 변형을 실행한 것으로 확대하지 않는다.

대표 증빙: `questions-1440.png`, `questions-768-detail.png`, `questions-390.png`, `question-keyboard-390.png`, `question-filled.txt`, `preview.txt`, `saved-reload.txt`, `saved-1440.png`, `saved-768.png`, `saved-390.png`, `layouts.json`, `saved-layouts.json`, `api-final.json`, `before.json`, `question-no-write.json`, 선택 검사 로그·`manifest.json`.

브라우저 기기 폭은 실행 호출마다 지정했다. 첫 tablet 캡처는 추천 영역이 화면 아래였으므로 `questions-768-detail.png`에 실제768px 영역을 추가했다. 비활성 버튼은 pointer-events:none 때문에 hover가 실패해 상태를 다시 읽고 관찰용 스크롤로 캡처했으며 이를 제품 동작 오류로 집계하지 않는다. Ego 작업 공간은 종료하고 검증 전용 서버만 정리했다. 기준develop-v2 `2ef07437` + 미커밋 변경. gpt-6-luna·VoiceOver BLOCKED 유지, 고객/실휴대폰/전체 접근성/운영 gate는 미완료다.


## 입력 예시 후속 — 2026-10-17

매출·환불 소스에도 광고 질문을 표시하던 placeholder를 수정했다. 지원하는 추천이 있으면 첫 추천 질문을, 전체 null이 아닌 숫자형 광고 필수 열 3개가 있으면 기존 광고 예시를, 그 외에는 중립적인 입력 안내를 표시한다. 질문 값·생성·저장·모델 설정은 변경하지 않는다.

새 조건만 선택해 RED 4 FAIL → GREEN 4 PASS를 확인했고 기존24개는 건너뛰었다. 매출·광고·일반 열의 예시 분기와 소스 변경 시 질문 보존·예시 자동 전송0을 검사했다. FE type/변경 lint/build·diff 검사 PASS다. BE 변경이 없어 직전 결과를 재사용하며 기존 생성·저장·실LLM 케이스는 반복하지 않았다.

Ego18에서 실제 source4의 매출·환불 예시를390/768/1440px로 확인했다. 각 scrollWidth가 viewport와 같고 예시 줄바꿈·입력 크기·주변 정렬이 정상이다. 질문을 작성한 뒤 source3으로 바꿔도 질문이 보존됐고390px에서 Tab→ShiftTab으로 입력창의 가시 포커스 복귀를 확인했다. 두 실제 소스 모두 매출 열이 있으므로 광고/일반 소스 전환의 실제 UI 검증으로 확대하지 않는다. DB6개 테이블 전체 행의 사전·사후 해시가 동일하다. 신규 AI 생성·저장·게시는 실행하지 않았다.

기능/디자인 모두 PASS_SELECTED다. 증빙은 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-placeholder-20261017/`의 `example-390.png`, `example-768.png`, `example-1440.png`, `question-kept-keyboard-390.png`, `layouts.json`, `source-switch.json`, `db-unchanged.json`과 검사 로그다. 브라우저 작업공간을 종료하고 검증 전용 서버를 정리했다. 기준develop-v2 `2ef07437` + 미커밋 변경, gpt-6-luna·VoiceOver BLOCKED 유지. 실제 휴대폰·전체 접근성·운영·고객 수용은 별도다.
