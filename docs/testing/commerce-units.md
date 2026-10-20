# Commerce 생성 지표 단위 검증 — 2026-10-18

## 범위·계약

P2/P3 Commerce→Studio 고정 연결 소스의 생성 지표를 미리보기 전과 신규 저장의 transaction 전 검사한다. 기존 commerceContext의 owner/duckdb·tag/고정 버전 조건을 통과한 경우만 적용한다. 일반 CSV의 의미를 추론하거나 중앙 지표/모든 편집 API에 전역 단위 정책을 추가하지 않는다. 오류를 자동 통화 변환/정의 덮어쓰기로 해결하지 않는다.

- revenue/refund_amount/net_amount의 SUM/AVG/MIN/MAX/가중평균은 소스 통화를 유지한다. KRW/KRW기호/원, USD/USD기호를 허용하며 KRW 표시 소수는0이다. USD 표시 자릿수는 기존0~6 계약을 유지한다.
- paid_orders/refunded_orders의 집계와 COUNT/COUNT_DISTINCT는 count 또는 건을 사용한다. 평균 건수의 소수 표시를 임의로 금지하지 않는다.
- 같은 단위끼리의 RATIO_SUM은 scale100이면%, scale1이면 빈 단위다. 금액/건수의scale1은 통화 단위이고 역방향/지원 밖의 알려진 단위 조합은 거절한다. 알려지지 않은 열의 차원/단위는 이 검사에서 추측하지 않는다.
- 기존 저장 지표 참조도 유효 정의를 검사하되 ID/버전/정의를 바꾸지 않는다. 잘못된 기존 지표를 선택하면 거절하며 자동 교정하지 않는다. 후속 질문은 부모와 합친 실제 전체 생성안을 검사한다.

단위 오류는 HTTP400의 고정code `STUDIO_COMMERCE_UNIT_MISMATCH`와 한정된currency로 반환한다. 화면은 이 코드에만 고정 안내를 표시하고 임의 서버message를 표시하지 않는다. 파일 오류/그 외400의 기존 안내는 유지한다.

## MD 조건

| ID | 조건 | 결과 |
|---|---|---|
| UNIT-01 | 다른 통화·금액%/건수통화·누락 단위·KRW 소수·잘못된비율 | 미리보기 전 거절·새 dashboard/metric/run 쓰기0 · 단위 PASS |
| UNIT-02 | 정상 KRW/건수/백분율/소수비율·금액/건수 | 정상 미리보기 · 단위 PASS |
| UNIT-03 | KRW/USD의 올바른/다른 통화 저장 지표 재사용 | 정상 참조 유지/오류 거절, 기존 definition 불변 · 단위 PASS |
| UNIT-04 | 저장 전 내부 생성안 단위 이상/문맥 변경 | 저장 전 재검사·쓰기0, 버전 또는 단위 오류로 차단 · 단위 PASS |
| UNIT-05 | 지정 gpt-6-luna 정상 생성→비공개 저장/reload | 13000/2000/11000 KRW·기존#5/6/7·소수0 유지 · 실제 PASS_SELECTED |
| UNIT-06 | 단위 오류 고정코드·390/1440·키보드 실행 | 안전한 안내·질문 유지·미리보기 없음·넘침0 · 합성 응답 UI PASS_SELECTED |

## 검사·실제 흐름

초기 신규12개 검사 중 잘못된 단위8개가 거절되지 않아FAIL, 정상4개PASS였다. 최소 검증 구현·참조 재사용/저장 경계/추가 비율 조합을 보강한 뒤 관련 BE75개 PASS(기존55+신규20)다. 저장 전 검사는 클라이언트가 정의를 보낼 수 있다는 가정이 아니라 내부 캐시 이상을 테스트에서 주입한 방어 검사다. 소스 문맥 변경은 기존 버전 검증 또는 새 단위 검증이 먼저 차단할 수 있어 특정 오류의 실행 순서를 계약으로 삼지 않았다. 모든 경우 쓰기0을 확인했다.

FE 오류 안내는 초기2FAIL→관련8PASS, BE/FE build·FE type·변경lint·diff whitespace PASS다. 전체 루트/기존 Rill/core E2E는 영향 없는 조건을 반복하지 않고 직전 통합 증빙을 재사용했다. 신규 의존성·DB 스키마·모델 설정 변경0이다.

Ego23에서 실제 source4에 통화 문구 없는 질문을 지정Codex gpt-6-luna로1회 요청했다. 금액3개가 기존 지표#5/6/7을 그대로 참조하고13000/2000/11000 KRW로 검증을 통과했다. 키보드Enter 명시 저장→비공개dashboard7→reload/실제GET에서 참조/소수0/suffix KRW와 숫자를 확인했다. 새 지표0·게시0이다. 정상 실행은 단위 검사 로직이 들어간 서버로 수행했고 이후 추가한 고정 오류code는 단위/FE 검사로 대조했다.

오류 UI는 같은 소유 검증 탭의 Axios adapter에서 proposals 응답만400/고정code로 주입했다. 실제 서버나LLM이 잘못된 단위를 생성한 것처럼 보고하지 않는다. 키보드Enter 실행 뒤 요청1개(클라이언트에서 차단)/서버추가요청0·질문 유지·미리보기0·안전한 단위 안내를 확인했다. adapter는 즉시 복원했다.390/1440 모두scrollWidth=innerWidth이고 오류 줄바꿈/주변카드·정상미리보기/저장본 캡처를 직접 검토했다. 단위/기능 PASS_SELECTED와 디자인 PASS_SELECTED를 구분한다. 실기기/전체접근성은 별도다.

## 보존·증빙·한계

기존6개 테이블의 사전 행 해시는 모두 같다. dashboard6→7/StudioState5→6만 증가했고 metric11/database4/Commerce2/publication0 불변이다. 새 비공개7은 검증용으로 보존했다. 실패한 단위 응답을 DB에 저장하지 않는다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-units-20261018/`의 red/green-final·fe-red/fe-green·build/type/lint 로그, `before.json`, `preservation.json`, `saved-api.json`, `preview-layouts.json`, `saved-layouts.json`, `error-layouts.json`, `preview-390.png`, `preview-1440.png`, `saved-reload-390.png`, `saved-reload-1440.png`, `unit-error-390.png`, `unit-error-1440.png`, `manifest.json`.

생성/신규 저장의 좁은 단위 보강이며 기존 Studio 편집 AI·수동 지표 API·일반 CSV의 의미/통화 전체 검증으로 확대하지 않는다. 직접 편집의 표시 재정의·다중통화·임의 계산식 차원 분석·환전·새 고객 데이터는 범위 밖이다. gpt-6-luna/VoiceOver BLOCKED 유지·검증 서버/브라우저 종료. 기준develop-v2 f4c0f632 위 미커밋 변경이며 실제 고객 파일럿 우선순위는 유지한다.
