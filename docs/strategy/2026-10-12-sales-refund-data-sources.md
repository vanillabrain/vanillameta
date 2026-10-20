# 매출·환불 MVP 데이터 확보 조사

2026-10-12. 공개 페이지 검색과 실제 파일 다운로드/원본 품질 검사 결과다. 제품 구현·UI 검증·운영 데이터 수집은 아직 수행하지 않았다. 기존 통과 E2E 및 AI 검사는 반복하지 않았고 Codex gpt-6-luna 설정은 유지했다.

## 결론

Rill 공식 [예제 목록](https://github.com/rilldata/rill-examples)에서 주문·매출·환불 전용 다운로드를 확인하지 못했다. 전체 Rill 생태계에 없다는 단정은 아니다. 기존 auction 샘플은 광고 데이터로 커머스 검증을 대체하지 못한다.

첫 MVP의 주 데이터 후보는 **Analytics Engineering v1.0.0**이다. 실제 원본과 분석용 Parquet를 확보했다. 다만 아래 시간 오류를 검증 실패로 드러내야 하므로, 원본 전체를 정상 운영 데이터로 자동 게시하지 않는다. Cotera는 단일 파일 업로드·간단 데모용 보조 후보다.

| 후보 | 확보/권한 | 적합성 및 한계 |
| --- | --- | --- |
| [Analytics Engineering](https://www.analyticsengineering.com/datasets/ecommerce-sales) | 원본 CSV ZIP 7,945,543 bytes, 분석 Parquet 2,875,742 bytes HTTP200. ZIP LICENSE CC BY 4.0 확인 | 주문10만/상품행237537/결제시도105388/환불7910. 환불 ID·주문/결제 연결·시각·사유, 부분 환불 있음. 아래 시간 오류와 상품 배분 한계 |
| [Cotera](https://cotera.co/datasets/library/sample-ecommerce-orders) | Parquet 1,322,647 bytes HTTP200, CC0 표시 | DuckDB 직접 검사: 5만 주문/20컬럼/order_id 중복0. 전액 환불2005건, 부분 환불0. 환불 발생일·이벤트 ID 없음 |
| [SQLShed](https://sqlshed.com/practice-datasets/ecommerce-orders/) | 페이지는 접근 가능/CC0 표시, 실제 schema 및7개 Parquet 링크 모두403 | 페이지의426024행은 전체7테이블 합계, 주문9만. 링크 발견과 데이터 확보를 구분하며 현재 주 데이터로 선정하지 않음 |
| [UCI Online Retail](https://archive.ics.uci.edu/dataset/352/online+retail) | 공개 XLSX/CC BY 4.0. 이번 실행에서는 다운로드하지 않음 | 실제 소매 거래541909행, InvoiceNo의 C는 cancellation. 결제 환불 성공/원 결제 연결을 입증하지 않으므로 환불 MVP 정답으로 쓰지 않음 |

확보한 두 샘플은 합성 데이터다. 실제 고객 필요성이나 업종 평균 환불률을 증명하는 자료로 쓰지 않는다. CC BY 데이터/변환 파일을 배포할 때 저자·버전·라이선스와 변경 내용을 표시한다.

## 원본 검사 결과와 선택 조건

Analytics Engineering CSV를 Python Decimal로 검사했다. 6개 primary key 중복0, 확인한 고객/상품/주문/결제 외래키 orphan0, 상품행 금액식/주문 subtotal·total 대사 오류0, 주문별 환불액이 성공 결제액을 초과한 건0이다. 부분 환불 주문5217, 다중 결제시도 주문5388, 주문월과 환불월이 다른 이벤트3917을 확인했다.

**중요한 실패:** 환불173건의 refunded_at이 연결된 성공 결제 paid_at보다 빠르다. 전 기간에 걸쳐 존재하며 원인은 확인하지 않았다. 원본을 바꾸거나 조용히 제외하지 않는다. 전체 bundle 게시를 차단하고 오류 행·금액·이유를 안내하는 수집 검증 fixture로 쓴다. 정상 데모는 명시적으로 선택한 정상 주문 및 그 주문의 모든 연결 행으로 파생하고, 선택 규칙·제외 건수·새 SHA256·독립 정답을 기록한 뒤 사용한다. 이 조사에서는 파생본을 만들지 않았다.

원본 전체의 성공 결제 합계 USD63,458,562.67, 환불 합계3,387,902.65, 차감 수취액60,070,660.02는 Decimal 대사 참고값이다. 시간 오류 행도 포함한 원본 금액 합계이며 게시된 정상 대시보드 정답이 아니다. 세금/배송 포함 결제액을 상품 순매출이라고 부르지 않는다. 분석 Parquet의 net_revenue 필드명도 그대로 사업 정의로 채택하지 않는다.

환불에 order_item_id/상품별 환불액·세금/배송 구분이 없다. 상품별 환불률·반품 수량·세금 제외 순매출·이익은 계산 불가로 표시한다. 주문 수준 환불을 여러 상품에 복제하거나 근거 없이 비례 배분하지 않는다. 다회 환불·여러 통화·환불 pending/failed 변형은 이 샘플만으로 검증되지 않으므로 작은 별도 정답 fixture가 필요하다.

## 데모와 실제 고객 데이터 확보 경로

- [Metabase 매출 대시보드](https://www.metabase.com/dashboards/ecommerce-sales): KPI/기간 비교/채널·지역·상품 배치 참고. 페이지는 예시 화면이며 그 숫자의 원본 파일 확보를 확인한 것은 아니다.
- [VizMint 환불 데모](https://vizmint.com/ecommerce-returns-dashboard): 환불액·반품 사유·분모 표시에 대한 공개 참고. 페이지의48행 preview는 집계 수준 자료이며 거래 원장 대체가 아니다. 이번 실행에서 다운로드/라이선스·실제 상호작용은 검증하지 않았다.
- [Shopify generated test data](https://shopify.dev/docs/apps/build/stores/generated-test-data): 개발 스토어의 주문 생성 경로. 독립 주문/환불 다운로드 확보와 구분한다. [현재 매출 정의](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/sales-report)에서 sales reversal은 환불보다 넓고 테스트 주문은 보고서에서 제외되므로, 테스트 보고서가 빈 것을 수집 실패로 오인하지 않는다.
- [Stripe 테스트](https://docs.stripe.com/testing): 부분 환불 및 pending/succeeded/failed 상태 검증용 후속 fixture 경로. 사전 준비된 커머스 데이터셋은 아니며 테스트 모드 보고서/CSV 가용성은 별도 확인한다.
- 파일럿 고객에게는 같은 기간의 주문·성공 결제·환불 export를 비식별 형태로 확보한다. 주문 ID, 이벤트 ID, 각 발생일, 상태, 통화, 금액, 세금/배송 포함 여부를 필수 계약으로 하고 키/날짜가 없는 파일에서 지표를 추정하지 않는다.

## 최소 부담의 다음 개발 순서

1. 정상 파생 샘플과 오류173건 fixture를 분리해 정확한 금액/기간/행 수 정답을 고정한다. 출처와 파생 규칙을 MD에 기록한다.
2. 현 서버 DuckDB/워커를 재사용해 orders/payments/refunds bundle과 필드 매핑을 구현한다. 금액은 DECIMAL/최소 통화단위, 이벤트 ID 중복 제거, FK/상태/시각·금액 대사를 먼저 수행한다. 실패 시 마지막 정상 버전을 유지한다.
3. 성공 결제액·환불액·차감 수취액·결제 완료 주문수·환불 주문 비율부터 만든다. 일별 결제/환불은 각 이벤트 발생일, 주문별 환불률은 주문일 코호트로 분리하고 날짜 기준·세금/배송 포함 여부·분모를 화면에 표시한다. 환불이 다음 달에 발생하는 경우를 반드시 검증한다.
4. 채널·기간 필터, 환불 사유·주문 상세, 실제 gpt-6-luna 생성/수정, desktop/mobile 화면만 새 MD로 검증한다. Rill에도 **이 새 데이터**로 비교용 모델을 만들 수 있지만 기존 광고 샘플 통과를 재실행하지 않는다.

기존 [초기 MVP 계획](2026-10-12-ingestion-sales-mvp-plan.md)의 SQLite 저장/로컬 모델 관련 부분은 당시 조사다. 현재 구현은 서버 DuckDB와 Codex gpt-6-luna이며 본 작업에서 DB 교체·로컬 앱·새 서비스·새 의존성은 추가하지 않았다.

## 증빙

[원본 다운로드 및 검사 폴더](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/sales-refund-data-research): download-manifest*.json의 실제 URL/HTTP/bytes/SHA256, ZIP LICENSE/사전, ae-quality.json, ae-temporal-anomalies.json, parquet-profiles.json, quality-check.py/parquet-check.cjs 및 quality-audit.ipynb. 초기 짧은 URL404와 SQLShed403도 보존한다. 다운로드 성공·품질 검사와 제품 UI 통과는 별도 판정이다.
