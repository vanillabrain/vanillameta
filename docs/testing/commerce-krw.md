# 매출·환불 단일 통화 KRW 지원 — 2026-10-17

## 범위와 계약

고객 파일이 미제공된 상태에서 합성 KRW 파일로 기존 Commerce 수집·보고서 경계를 보강한다. 실제 고객 검증(PILOT-01~07)은 NOT_RUN이다. 파일 묶음은 USD 또는 KRW 한 통화만 허용하며 환전·다중 통화 합산은 제외한다. 통화는 게시된 DuckDB 주문 테이블에서 읽고 필터 범위나 프로젝트 이름으로 추측하지 않는다.

기존 저장 스케일100·BigInt 집계·API 소수2자리 문자열을 유지한다. KRW 입력은 정수 원만 허용하되 12000.00처럼 값이 정수인 표기는 허용한다. 원화 소수의 반올림 수용은 금지한다. 주문 구성 금액·성공/실패 결제·환불 모두 검증하며 혼합 통화는 정상 테이블 게시 전에 거절한다. UI KPI·표·툴팁은 원화 소수0자리, 축은 기존 compact 표기를 유지한다. AI 설명 요청의 통화도 실제 보고서 단위를 전달한다. Studio의 범용 통화 추론·AI 생성 전체 수용을 이 결과로 주장하지 않는다.

정답: 주문 K1 subtotal10000+tax1000+shipping1000=12000, K2=1000. 성공 결제13000, 환불2000, 차감수취11000, 주문2/환불주문1=50%. UTC 결제일 2025-01-01, 환불일 2025-01-02. 고객/실매출이 아닌 합성 검증 전용이다.

## MD 조건

| ID | 동작 | 기대 결과 | 결과 |
| --- | --- | --- | --- |
| KRW-01 | 정상 원화 CSV 업로드→보고서→reload | 결제13000·환불2000·차감11000·환불주문율50%, KRW/₩·소수0자리, 신규 프로젝트1 | PASS_SELECTED |
| KRW-02 | 주문·결제·환불 소수 원화와 혼합USD/KRW | 명시 오류·정상 데이터 미교체, 원화로 둔갑/반올림 없음 | PASS_SELECTED |
| KRW-03 | API·AI 전달 단위 | KRW 유지·기존 USD 보존, 원본 행을 AI 설명에 전송하지 않음 | PASS_SELECTED |
| KRW-04 | 390/768/1440·키보드 필터 및 표 | 숫자/단위·버튼·포커스 가시성, 문서 가로 넘침0, 표는 내부 스크롤 | PASS_SELECTED |

초기 회귀 RED: 신규5개 실패·기존24개 통과. 선택 importer/service/Commerce UI만 실행하고 관련 없는 기존 PASS는 재사용한다. gpt-6-luna 설정·VoiceOver BLOCKED는 유지하며 실제 LLM 호출은 이번 단위 전달 검사와 구분한다.

## 실행 결과

기준 HEAD `4795775f` 위 미커밋 변경. Ego space11, 격리 SQLite/로컬 API4560·FE3460, 합성 프로젝트1. 정상 가져오기 succeeded1·실패 교체 rejected3, 정상 버전1·ready·프로젝트1개 유지. API 독립 정답과 화면·reload 수치가 일치했다. 환불일만 선택하면 결제0·환불2000·차감-2000, 주문일 코호트0/0의 환불률은 `—`이며 금액 비율로 대체하지 않는다.

- KRW-01: 실제 파일 선택→키보드 Enter 업로드→저장/조회/reload, 전체 기간·환불일 결과 PASS.
- KRW-02: 주문/결제/환불 소수 원화·USD/KRW 혼합·빈 통화/미지원 통화 회귀 PASS. 실제 UI에서는 혼합과 소수 결제 파일 교체 실패·이전 정상 보고서 보존을 확인했다. USD 정밀도/이벤트 날짜·코호트 검사는 기존 importer/service 중 영향 범위만 재검증했다.
- KRW-03: 실제 API 통화/수치 PASS. AI stub에 전달한 chart.unit/definitions.currency가 KRW이고 USD 고정 지시가 없음을 확인했다. 실제 LLM 생성/수정은 NOT_RUN이며 gpt-6-luna 설정을 변경하지 않았다.
- KRW-04: 최종 코드 390/768/1440px 문서 가로 넘침0·숫자/단위·일반 컨트롤36px/14px 유지. 네이티브 날짜 입력은 연/월/일 구간 방향키 입력→Enter 적용/초기화, Tab 포커스·원화 표 펼침/방향키 스크롤을 확인했다. 표 영역308px/내용500px, 방향키 scrollLeft 증가 및 보라색 포커스 링을 실측했다. 실제 기기·전체 키보드/VoiceOver는 미검증/BLOCKED를 유지한다.

발견/수정: (1) HTTP400의 통화 원인을 일반 파일 오류로 숨기던 안내를 고정 오류 코드에 따른 안전한 문구로 보완(원본 row/detail 노출 없음). (2) 빈/미지원 통화를 혼합 통화로 잘못 분류하는 조건을 수정. (3) 중첩 Table 래퍼가 가로 스크롤을 소유해 포커스된 region 방향키가 작동하지 않던 문제를 이 화면의 표3개에 국소 수정. 수정 뒤 같은390px에서 실제 방향키 이동·포커스 링을 재확인했다.

검증 도구 관찰: 초기 date fill은 네이티브 날짜 입력에 적용되지 않았고, 첫 role=status는 빈 상태 영역이었다. 실제 날짜 구간 키보드 입력과 올바른 표시 범위를 확인해 해소했다. Ego CDP 폭은 실행 사이 초기화되므로 최종 캡처는 각 실행 안에서 폭을 다시 지정·실측했다. 이 관찰을 제품 실패나 모바일 PASS로 잘못 집계하지 않았다.

선택 BE32/FE27·BE/FE build·FE type·변경 파일 lint·diff whitespace PASS. 전체 테스트/core E2E는 이번에 실행하지 않았고 관련 없는 직전 결과를 재사용했다. 숫자/기능 PASS_SELECTED와 디자인 PASS_SELECTED를 분리하며, 사람이 전체 제품을 수용한 결과로 확대하지 않는다.

## 증빙

저장소 밖 경로: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-krw-20261017/`.

- `api-oracle.json`: 실제 보고서와 독립 정답·정상 버전/작업 상태, 합성 CSV SHA256.
- `final-layouts.json`, `mobile-keyboard-table.json`, `final-ui-snapshot.txt`: 실제 폭·포커스·숫자.
- `krw-1440-overview-final.png`, `krw-768-overview-final.png`, `krw-390-kpi-final.png`, `krw-390-table-keyboard.png`: 최종 대표 화면을 직접 열어 검토했다.
- `mixed-error-before.png` → `krw-mixed-error-390.png`·`krw-fraction-error-390.png`: 원인 안내 수정 전/후.
- `refund-day-snapshot.txt`, `krw-refund-day-keyboard.png`: 환불일 범위의 음수 결과.
- `red.log`·`green.log`·`fe.log`·각 build/type/lint 로그: 선택 검증 결과. `manifest.json`은 최종 diff hash와 테스트 범위를 기록한다.

미완료: 실제 고객 파일·업무 정답/담당자 수용, [Studio의 명시 원화 생성/제목 수정/저장](studio-krw.md)은 후속에서 확인했으며 범용 통화 추론·원화 설명 문장 전체는 미검증, 다중통화/환율, 이 변경의 MySQL/실휴대폰/전체 접근성. 서버/브라우저 검증 자원은 종료하고 비공개 격리 DB와 합성 파일만 보존한다.
