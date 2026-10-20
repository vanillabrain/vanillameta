# 매출·환불 MVP 운영 범위

Analytics Engineering Ecommerce Sales & Returns v1.0.0의 공개 **합성 데이터**를 사용한다. 실제 고객 매출이라고 표시하지 않는다. 원본 라이선스는 CC BY 4.0이며 파생 파일에도 LICENSE와 출처·변환 규칙을 함께 보관한다.

## 재현 가능한 샘플

공식 출처: https://www.analyticsengineering.com/datasets/ecommerce-sales

```sh
python3 scripts/commerce/prepare-ae-samples.py \
  --source-zip /absolute/path/ae-source-csv.zip \
  --output /absolute/path/commerce-samples
```

외부 증빙 폴더에 원본 ZIP을 보존하고 출력 폴더에 normal/temporal-errors CSV, sample-manifest.json, 독립 Decimal oracle.json을 만든다. 원본·파생 SHA256을 기록한다. 원본 값을 보정하지 않고, 연결 결제보다 환불이 빠른 주문173개의 전체 주문/결제/환불 묶음을 오류 샘플로 분리한다. 정상 샘플은 주문99827/결제시도105209/환불7737행이다. 입력 버전의 오류 수가 다르면 자동 진행하지 않는다.

## 제품과 계산 정의

인증 후 `/commerce`에서 orders/payments/refunds CSV와 선택적 customers CSV를 가져온다. 고객 파일은 채널 연결에 사용한다. 기존 메타데이터 DB에 소유권·게시 버전을 저장하고, 실제 정규화·검증·집계는 기존 서버 DuckDB 워커가 수행한다. 별도 DB 서버·Redis·로컬 앱·브라우저 전체 데이터 분석은 추가하지 않는다.

- 결제액: 성공 결제의 `paid_at` 기준 금액. 실패 결제 시도는 제외한다.
- 환불액: `refunded_at` 기준 환불 금액.
- 차감 수취액: 결제액 − 환불액. USD, 세금·배송이 포함된 현금 흐름이다. 상품 순매출·이익으로 해석하지 않는다.
- 결제 주문 수: 선택한 주문일 코호트 중 성공 결제가 있는 고유 주문 수.
- 환불 주문 비율: 해당 코호트 중 확보된 환불이 있는 고유 주문 수 ÷ 결제 주문 수. 기간 내 환불 이벤트 비율과 다르다. 분모0은 계산 불가다.
- 모든 날짜는 UTC다. 상품별 환불 배분, 세금·배송 환불 분리, 통화 환산은 제공하지 않는다.

AI는 기존 Codex 연결과 `gpt-6-luna`를 유지하며 집계·정의로 제목·설명·차트 제목의 초안을 제안한다. 저장은 명시적 사용자 동작이다. AI가 재무 계산식이나 임의 SQL을 변경하는 기능은 이번 범위에 없다.

## 배포와 저장

새 메타데이터 테이블은 commerce_source/commerce_run이며 마이그레이션을 기존 배포 절차로 적용한다. 하나의 상시 Node 서버와 영속 FILE_UPLOAD_DIR을 사용한다. 워커의 메모리·대기열·작업시간·파일/저장 한도는 기존 환경 설정을 재사용한다. 수집 결과를 파일로 관리하므로 메타데이터와 업로드 디렉터리를 함께 백업해야 한다.

같은 대상의 같은 입력은 중복 게시하지 않는다. 정상 교체는 버전을 전진시키고 오류 수집은 기존 정상 보고서를 유지한다. 운영 확대 전에 게시 이력 파일의 보존 기간·삭제 정책과 백업 복구 훈련을 정해야 한다. 이번 로컬 검증은 운영 SLA나 다중 서버 동시 파일 접근을 입증하지 않는다.

## 검증

신규 MD 기준은 [sales-refund-mvp.md](../testing/sales-refund-mvp.md)다. 과거 통과를 재실행하지 않고 이 기능의 새 데이터·기간·오류 조건만 검증한다. Rill 비교는 같은 파생 샘플로 직접 작성한 참조 YAML을 사용하며 Rill AI 생성 성공으로 보고하지 않는다. 현금 이벤트와 주문 코호트를 한 시간축에 표시하기 위해 Rill에는 금액0의 코호트 행을 추가한다. 이 변환과 해시는 별도로 공개한다.
