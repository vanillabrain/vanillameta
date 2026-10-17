# 환불 없는 기간의 Commerce 수입 — 2026-10-17

P2 첫 고객 파일 준비의 누락 조건을 합성 데이터로 확인했다. 실제 고객 검증은 PILOT-01~07 NOT_RUN을 유지한다. 기존 DuckDB 워커·보고서를 재사용하며 제품 구현/모델/저장 스키마는 변경하지 않는다. 고객 CSV는 선택하지 않고 필수 헤더만 있는 환불 CSV를 사용했다. 환불 파일 자체를 생략하거나0바이트 파일을 지원한다는 뜻은 아니다.

## MD 조건

| ID | 입력/동작 | 기대 결과 | 결과 |
|---|---|---|---|
| EMPTY-01 | 2주문·2성공결제·헤더 전용 환불·고객 파일 생략 | 일반/분석용 수입 성공·행 수2/2/0·환불 합계0 | PASS_SELECTED |
| EMPTY-02 | 실제 파일 선택→키보드 Enter 수입→새로고침 | 결제13000·환불0·차감13000 KRW, 결제주문2/환불주문0/비율0% | PASS_SELECTED |
| EMPTY-03 | 빈 사유/고객 미지정 채널·390/1440 | 환불 내역 없음·Unassigned·문서 넘침0 | PASS_SELECTED |
| EMPTY-04 | 새 프로젝트로 수입 | 기존 프로젝트/대시보드/지표/게시 원본 불변 | PASS_SELECTED |

## 실행과 정확성

일반 Commerce용/Studio 분석 projection용2개 회귀만 추가·실행해2 PASS·기존21개 SKIP했다. 분석 projection의 SUM(revenue)=13000.00/refund_amount=0.00/net_amount=13000.00·paid_orders2/refunded_orders0을 독립 상수 정답과 대조했다. 일반 테이블은 commerce_refunds0행·성공 결제 최소 단위1300000을 확인했다. 제품 수정 없이 통과했으므로 RED 실패를 인위적으로 만들지 않았다. 새 회귀 파일 lint PASS·diff whitespace PASS이며 제품 코드가 같아 직전 build/type·기존 검사 결과는 재사용했다.

Ego21 실제 Commerce에서 합성 orders/payments/refunds를 각각 파일 선택창으로 선택했다. 환불 미리보기0행을 확인한 뒤 CSV 가져오기 버튼에 focus/Enter로 새 프로젝트2를 저장했다. 검증 통과2/2/0·보고서→reload→실제 GET 보고서의 금액13000/0/13000·건수2/0·비율0을 확인했다. 환불 사유는 빈 배열/내역 없음, 고객 파일 부재의 채널은Unassigned다. 이 과정은 API 응답 주입이 아닌 기존 격리 서버의 실제 수입이다. AI 생성/게시/Studio 새 소스 연결은 이번 조건에 필요하지 않아 실행하지 않았다.

기능 PASS_SELECTED와 디자인 PASS_SELECTED를 구분한다.390/1440 모두 실제 innerWidth=scrollWidth이고 원화 단위·0.00%·빈 사유 안내·주변 카드가 표시된다. 최근 주문 표는 기존 내부 가로 스크롤을 유지한다. 캡처를 직접 검토했다. 기존 차트 반응형 전체/네이티브 선택창 방향키·전체 키보드를 새로 통과시킨 것으로 확대하지 않는다.

## 보존·증빙·제한

commerce_source만1→2로 증가했다. 사전 존재했던6개 테이블 모든 행 해시는 동일하다. dashboard6·studio_state5·metric11·database4·publication0 불변이며 새 합성 프로젝트2만 비공개로 보존했다. 고정 정답과 파일 SHA256·API 결과를 기록했다. 브라우저·검증 서버는 종료하며 gpt-6-luna/VoiceOver BLOCKED 유지다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-empty-refunds-20261017/`의 CSV3개·`api-report.json`·`report.txt`·`before.json`·`preservation.json`·`layouts.json`·`test.log`·`lint.log`·`manifest.json`, `refund-file-390.png`, `zero-refund-kpi-390.png`, `zero-refund-reload-1440.png`, `empty-reasons-390.png`.

관찰상의 오류: 초기 main 대기는 해당 레이아웃에main이 없어 실패했으므로 실제 snapshot으로 컨트롤을 찾았다. API 정답 대조는 제품과 같은data 봉투를 해제한 뒤 수행했다. 둘 다 제품 실패로 집계하지 않는다. 실제 고객 파일/담당자 정답·수용/실휴대폰·운영 전체 조건은 여전히 NOT_RUN이다. 변경은 회귀와 문서이며 미커밋 상태다.


## 업로드 보고서 출처 문구 후속 — 2026-10-17 / Ego22

EMPTY-03의 화면에서 발견한 오인 여지를 수정했다. 기존 footer는 업로드 프로젝트 설명에 이어 “검증 샘플 출처”를 붙여 현재 파일도 Analytics Engineering 출처인 것처럼 읽힐 수 있었다. 서버에는 확정된 출처 구분 필드가 없어 이름/URL/sampleType으로 소스를 추측하지 않았다. 현재 프로젝트/서버 집계 설명과 “기본 제공 샘플의 원본·라이선스”를 별도 문단으로 분리하고 기존 저작자/CC BY4.0·링크를 보존했다. 출처를 자동 판정하거나 권한을 검증하는 기능을 추가한 것은 아니다.

문구/국소 마크업만 수정했다. 실제 기존 프로젝트2의390/1440px에서2개 문단·12px 보조 글자·링크 href 유지·scrollWidth=innerWidth를 확인하고 캡처를 직접 검토했다. 프로그램 focus로 링크에 접근했지만 focus-visible=false였으므로 전체 키보드/가시 포커스 통과로 보고하지 않는다. 기존 키보드 동작·숫자·저장 결과는 재사용한다. 기능(문구/링크 보존)·디자인 PASS_SELECTED, 변경 파일 lint·diff whitespace PASS다. 낮은 영향의 문구 변경이므로 새 단위 테스트·전체 build/type/LLM 실행은 하지 않았다.

기존6개 테이블 전체 행 사전/사후 해시가 같고 저장/게시0이다. 증빙은 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-attribution-20261017/`의 `attribution-390.png`, `attribution-1440.png`, `layouts.json`, `before.json`, `unchanged.json`, `lint.log`, `manifest.json`이다. 실제 외부 페이지를 열어 원본/라이선스를 새로 검증한 것은 아니며 기존 제공 링크를 유지했다. Ego22와 전용 서버 종료·gpt-6-luna/VoiceOver BLOCKED 유지, 이번 변경도 미커밋이다.
