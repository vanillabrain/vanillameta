# Studio 원화 AI 생성·수정·저장 — 2026-10-17

기준 HEAD4795775f + 이전 Commerce KRW 미커밋 변경. 고객 데이터 미제공 상태의 합성 원화 후속 검증이며 [Commerce KRW-01~04](commerce-krw.md) 통과는 재사용한다. gpt-6-luna/Codex와 VoiceOver BLOCKED 유지.

## 입력과 경계

앞선 검증용 주문 K1/K2의 성공 결제·환불을 주문당 한 행으로 정리한 분석 CSV(2행)를 사용한다. 실제 고객 파일·Rill 원본은 아니다. 원본 파일 묶음→Studio 자동 연결 기능으로 혼동하지 않는다. 기간은 주문일 코호트/UTC이며 결제·환불 이벤트 날짜별 현금 흐름과 다르다. 통화 열만으로 자동 추론을 보장하지 않으며 요청에서 KRW/원·소수0자리와 계산 열을 명시한다.

정답: SUM(revenue)=13000, SUM(refund_amount)=2000, SUM(net_amount)=11000, SUM(refunded_orders)/SUM(paid_orders)*100=50%. 금액 환불률2000/13000=15.3846%와 구분한다. 단위는 KRW 또는 원, 금액 소수0자리; 주문 환불률%·소수2자리. 원본과 Commerce 정상 버전은 바꾸지 않는다. 저장은 비공개이며 게시/공유를 실행하지 않는다.

| ID | 동작 | 기대 결과 | 결과 |
| --- | --- | --- | --- |
| KRW-05 | 분석 파일 연결→실제 AI 생성/미리보기 | 원화3개 KPI·주문 환불률과 선택 차트 수치/단위 일치 | PASS_SELECTED |
| KRW-06 | 같은 생성안의 제목만 AI 수정 | 대상 제목만 변경, 금액·통화·비대상 정의 보존 | PASS_SELECTED |
| KRW-07 | 명시 비공개 저장→Studio→reload | 숫자·단위·정의 보존, 새 대시보드1개·게시0 | PASS_SELECTED |
| KRW-09 | 새 생성본 태블릿 기본 배치 | 세로로 쌓은 카드가8칸을 채움·기존 저장 좌표 불변 | PASS_SELECTED |
| KRW-08 | 대표 모바일/키보드·디자인 | 선택한 390/768/1440 상태 넘침0, 기존 토큰/포커스 유지 | PASS_SELECTED |

이번 변경 UI/계산 경계만 확인하며 이전 장애/권한/게시 조건은 반복하지 않는다. 실패 시 실제 상태와 최초 화면을 보존하고 최소 수정 후 같은 조건만 재검증한다. 미실행은 통과로 기록하지 않는다.

## 실제 실행 결과 — Ego12

격리 SQLite·API4560/FE3460, 소스3(합성 주문2행). 원본 orders/payments/refunds로 독립 Decimal 집계한 정답과 분석 CSV의 주문별 값이 일치함을 `oracle.json`에 기록했다. 실제 Codex gpt-6-luna 생성→전체 미리보기→첫 블록 제목만 수정→비공개 dashboard2 저장→reload를 확인했다. 5개 블록은 결제13000·환불2000·차감11000·주문환불률50%·채널별 차감11000이며 금액 단위KRW/소수0자리, 비율%/소수2자리를 실제 API 저장 정의와 DOM에서 확인했다. 화면에서는 `13,000 KRW`, `2,000 KRW`, `11,000 KRW`, `50.00 %`이다.

기존 데이터 재사용을 위해 현재 UI가 요구하는 환불률 분모 선택(결제 완료 주문 수)을 수행했다. 계산식을 질문에 적었더라도 자연어 판별기가 추가 확인을 요청할 수 있으며, 이 회차에서 해당 판별기를 변경하지 않았다. 생성안 후속에서 첫 제목을 `원화 결제 성공액`으로 바꿨고 금액·단위·비대상 블록 표시는 유지됐다. 추가 회귀는 모델이 제목만 요청에 USD/AVG를 반환해도 서버가 부모 KRW/정수 자릿수·계산·비대상 정의를 유지하며 저장 후 두 번 읽기 결과가 같음을 검증한다.

저장2의390/768/1440에서 문서 가로 넘침0, 모바일 설정 버튼 Enter→소수0자리 확인→Escape 닫기를 실행했다. 선택 상태·보라색 포커스·기존36px/도구32px 토큰을 확인했다. 기능·원화 수치 PASS_SELECTED. 키보드는 해당 컨트롤만 확인했으며 전체 접근성을 완료로 올리지 않는다.

### 발견한 태블릿 공백과 수정

초기 `importStudio`는 태블릿에서 블록을 모두 x0으로 쌓으면서 데스크톱 너비만 비례 축소해 반 폭 카드/빈 오른쪽 영역을 만들었다(`saved-studio-768.png`). 파생되는 세로 배치의 너비를 해당 열 수로 채우도록 수정했다. 데스크톱 좌표·입력 객체·이미 저장된 Studio 문서는 변경하지 않는다. 실제 배치 저장/read 경로의 기존 회귀도 선택 실행했다.

수정 영향만 확인하기 위해 같은 소스에서 금액 KPI2개인 최소 새 제안을 실제 gpt-6-luna로 생성해 dashboard3에 비공개 저장/reload했다. 768px에서 카드720px/8칸,390px에서358px/1칸,1440px에서689px의2열을 실측했다. 새 저장본3의 디자인 PASS_SELECTED, 기존 저장본2의 태블릿 반 폭은 사용자 저장 좌표 보존을 위해 자동 변경하지 않았다. 문서 해시로 기존2가 유지됨을 확인했으며 원본1과 Commerce 정상 버전도 그대로다.

최종 API/DB: dashboard 총3(시작1+검증2개), metric4, Studio state2, publication0. 두 번째 생성은 같은 계산 지표를 재사용해 지표 중복 증가0. 추가 게시/공유는 실행하지 않았다.

## 검사와 증빙

- 신규 원화 제목 보존 회귀1 PASS, 배치 회귀는 기존 반 폭 RED→수정 후 PASS. 관련3 suite 총72개 PASS(`studio-legacy`, `studio-creation.service`, `studio.service`), BE build·변경 파일 lint·diff whitespace PASS.
- FE 제품 코드는 이번 회차에 수정하지 않아 직전 Commerce 검사·FE type/lint/build를 재사용한다. 전체 테스트/core E2E·관련 없는 기존 PASS는 반복하지 않았다.
- 실제 화면 직접 검토: `saved-studio-1440.png`, `saved-studio-390-kpi.png`, `settings-keyboard-390.png`, 태블릿 전후 `saved-studio-768.png` → `tablet-fix-768.png`, 수정 후 `tablet-fix-390.png`·`tablet-fix-1440.png`.
- 숫자·상태: `oracle.json`, `api-result.json`, `generation-snapshot.txt`, `refined-snapshot.txt`, `saved-reload-snapshot.txt`, `tablet-fix-layouts.json`, `layouts.json`. 최종 diff와 파일 해시는 `manifest.json`.
- 증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-krw-20261017/`. 실제 브라우저·전용 서버는 종료했고 비공개 검증 DB/합성 파일은 보존했다.

실행 도구 한계: 첫 화면 포인터 클릭이 전환되지 않아 같은 버튼의 실제 키보드 Enter로 진행했다. 비동기 렌더 직후 refs/이전 화면 또는 부정확한 대기 문구로 생긴 도구 시간 초과는 현재 DOM을 다시 읽어 해소했으며 제품 장애로 집계하지 않았다. 화면 폭은 각 캡처 실행 안에서 직접 지정·실측했다.

## 남은 조건

고객 파일·고객 업무 수용, Commerce 파일 묶음→Studio 자동 연결은 [후속 BRIDGE 검증](commerce-studio-bridge.md)에서 선택 확인했다. 남은 범위는 currency 열에서의 자동 통화 추론/혼합통화 분석 차단, 모든 차트 툴팁·큰 금액/다른 통화·다른 자연어·원화 게시 전체 변형, 운영MySQL·실휴대폰·전체 키보드/VoiceOver는 이 회차로 완료되지 않는다. gpt-6-luna 유지, VoiceOver BLOCKED 유지. 기존 저장본의 태블릿 좌표 일괄 변경은 하지 않는다.
