# Commerce 소스의 AI 분석 기준 자동 전달 — 2026-10-17

## 범위·계약

P2/P3 첫 소스→질문 생성에서 통화/날짜 설명의 반복 입력을 줄인다. Commerce→Studio가 만든 비공개 고정 버전 소스에만 서버가 검증한 `analysisContext`를 전달한다. 소스 권한 확인 뒤 owner/engine·origin project/version/digest·내부 tag·현재 파일과 단일 fileVersion의 일치를 확인한다. 일반 CSV 통화 추측/혼합 통화 변환·기존 지표 단위 덮어쓰기·별도 저장 경로·새 의존성은 추가하지 않는다.

전달값은 currency(KRW/USD), UTC, ordered_at 주문일 코호트, 전체 기간, 주문별 성공 결제/보관 환불 집계와 주문당 한 행이라는 의미다. 경로·설정·내부 원본 프로젝트 ID/digest/행 데이터는 새 문맥에 넣지 않는다. 기존 sourceId/열·저장 지표 payload는 유지한다. 질문 원문을 수정하지 않는다. KRW0/USD2는 모델 생성 지침이며 모든 모델 응답의 단위를 결정적으로 강제하는 별도 컴파일러 검증을 추가한 것은 아니다. 환불률 분모 선택 gate·미지원 열 거절·저장 지표 canonical 참조를 유지한다. Commerce 이벤트 기간/채널 필터는 자동 전달하지 않는다.

## MD 조건

| ID | 동작 | 기대 결과 | 결과 |
|---|---|---|---|
| CONTEXT-01 | 고정 KRW/USD 연결 소스로 생성 | currency/주문일/UTC/전체 범위 문맥·원 질문 보존·민감 구성 제외 | 단위 PASS |
| CONTEXT-02 | 일반 파일/교체 파일·환불률 분모 미확인 | 통화 추측0·교체 파일에 문맥0·분모 질문 때 모델 호출0 | 단위 PASS |
| CONTEXT-03 | 통화/UTC를 적지 않은 실제 질문 | 13000/2000/11000/평균6500 KRW와 ordered_at 추세 제안 | PASS_SELECTED |
| CONTEXT-04 | 명시 저장/reload·3폭/키보드 | 단위/날짜/정답 유지·원본 불변·넘침0 | PASS_SELECTED |

통과한 Commerce 연결/권한/기존 오류/다른 Rill 조건은 재사용한다. 이번 단위 테스트는 문맥 누락의 RED2 → 구현 후55 PASS. 실제 LLM·화면 결과는 후속 실행에 기록한다. 모델 gpt-6-luna·VoiceOver BLOCKED를 유지한다. 운영/고객/실휴대폰·전체 자연어 수용은 별도다.


## 실제 실행과 수정

Ego14, 합성 KRW Commerce 연결 source4에서 아래 질문을 실제 Codex gpt-6-luna로 실행했다. 통화·소수·UTC·열 이름을 질문에 추가하지 않았고 저장 지표 체크도 선택하지 않았다.

> 결제 성공액, 환불액, 차감 수취액, 주문당 평균 결제 성공액 KPI 4개와 주문일별 결제 성공액 추세를 보여 줘. 제목은 자동 기준 매출 환불 분석으로 해 줘. 저장과 게시는 하지 마.

첫 응답은 주문당 평균에 주문 ID가 필요하다고 잘못 재질문했다. 서버 문맥에 `grain: one row per order`와 전체 주문의 AVG(revenue) 의미(미결제0 포함)를 명시했다. 같은 질문 재실행에서 새 평균 지표 AVG(revenue)/6,500 KRW와 SUM3개 13,000/2,000/11,000 KRW, ordered_at 추세 2025-01-01 UTC/13,000을 반환했다. 기존 SUM 지표 #5/6/7을 재사용하고 평균만 새로 생성했다. 환불률 분모를 추측하도록 완화하지 않았다.

실제 키보드 Enter로 저장5→Studio→reload 후 API와 화면의5블록/모두KRW0·전체기간 일치. 원본 dashboard1~4/StudioState 및 Commerce 전체 행은 사전에 같은 직렬화로 기록한 해시와 일치했다. metadata Database4 불변·dashboard4→5·metric8→9·publication0, 공개 동작0이다. 브라우저는 종료했고 검증 생성본5는 로컬 비공개로 보존했다.

디자인은 실제1440/768/390 캡처를 직접 검토했으며 document.scrollWidth가 각각1440/768/390으로 가로 넘침0이다. 모바일 평균 설정 버튼 Tab/ShiftTab 포커스도 캡처했다. FE 제품 코드는 변경하지 않아 기존 type/lint/build 결과를 재사용한다. 단일 날짜 점 가시성의 원인과 게시 렌더러 보완은 [표시 후속](commerce-display.md)에 기록했다. 이번 작업은 차트 렌더러 변경이나 모든 시간 집계 UX 완료를 뜻하지 않는다.

관련 BE55 PASS(초기 문맥 누락2 FAIL→구현→grain 후 최종55 PASS), BE build/lint·diff whitespace PASS. 통화 USD 문맥은 단위 테스트이며 실제 USD 모델 재실행은 하지 않았다. 전체 단위/core E2E·기존 통과 조건은 반복하지 않았다. 모델 응답 단위의 강제 컴파일 검증·통화 변환·다른 자연어/실고객/운영/실휴대폰·VoiceOver는 미완료다.

증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-ai-context-20261017/`.
`before.json`, `api-final.json`, `preview.txt`, `saved-reload.txt`, `layouts.json`, `average-first-clarification.png/txt`, `preview-save-keyboard.png`, `saved-1440.png`, `saved-768.png`, `saved-390.png`, `saved-390-average-keyboard.png`, `tests-red.log`, `tests-green.log`, `build.log`, `lint.log`, `manifest.json`.

기준 develop-v2 `2ef07437` + 이번 미커밋 변경. gpt-6-luna 유지·VoiceOver BLOCKED 유지. 이 문맥은 고정된 연결 버전의 기준이며 원본 Commerce에 새 버전이 생겨도 기존 분석 소스를 자동 교체하지 않는다.
