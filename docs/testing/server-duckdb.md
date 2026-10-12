# 서버 DuckDB · 워커 MVP 검증

기존 TypeORM 메타데이터 DB 유지. 파일 선택 후 **데이터셋으로 저장**으로 서버에 업로드한다. 브라우저 분석을 먼저 실행하지 않는다. 원본은 Rill `rill-openrtb-prog-ads`의 `auction_data.parquet`이며 주문/환불 데이터가 아니다.

## INGEST-01 — 전체 파일 저장

- 입력: 같은 Rill 샘플 1,391,572행.
- 동작: Aside 파일 분석 → 파일 선택 → 데이터셋으로 저장. 서버 응답/manifest/메타데이터 확인.
- 기대: 응답 rows=1391572, engine=duckdb, 원본+data.duckdb+import.json 보존, TypeORM 메타데이터에 소스 등록. 브라우저 WASM 선행 처리 없음.

## INGEST-02 — 전체 집계와 영속화

- SQL: `SELECT count(*) AS rows, sum(bid_request_cnt) AS requests, sum(bid_floor)/sum(has_bid_floor_cnt) AS avg_floor FROM uploaded_data`
- 기대: rows=1391572, requests=634513000, avg_floor=5.5712386765263995 (절대오차 <1e-9).
- SQL: `SELECT device_type, sum(bid_request_cnt) AS requests FROM uploaded_data GROUP BY device_type ORDER BY requests DESC`
- 기대: Mobile/Tablet=307763000, Personal Computer=173308000, Set Top Box[NR1]=105976600, Connected TV=27207600, Tablet=15435200, Phone=2343800, Not Available=1530400, Games Console=931400, Connected Device=17000.
- 저장 후 재조회 및 서버 재시작 뒤 동일 집계. 메타데이터 암호화 키는 동일하게 유지한다.

## INGEST-03 — 저장된 데이터셋 → 위젯 → 대시보드

- 동작: 위 기기별 집계 데이터셋을 UI로 저장. 위젯/대시보드를 UI로 생성하고 다시 열기.
- 기대: 9개 기기별 값이 같은 순서/수치로 표시되고 reload 후 유지. 차트 캡처와 재조회 수치를 함께 증빙.

## INGEST-04 — 자원 제한과 복구

- 동작: 읽기 전용/외부파일 접근/다중문장 차단, 결과행/바이트 상한, 긴 쿼리 timeout, 업로드 저장 quota, 삭제 직렬화 검사.
- 기대: controlled error, 후속 정상 count 성공. 전체 저장행에 임의 100000행 상한 없음. API 응답 기본 10000행/8MiB; 무제한 SELECT *는 실패하며 aggregate는 전체 행 대상으로 수행.
- 범위: 하위 테스트/API. 전체 다중 사용자/전역 디스크 quota/강제 프로세스 종료 복구는 별도 운영 검증이며 통과로 확대하지 않는다.
