# Rill 기능 검증의 기준 샘플

사용자 지시에 따라 Rill 기반 기능 개발·화면 비교는 `manifest.json`의 실제 데모 원본 Parquet를 기본으로 사용한다. 2026-10-14 원본 다운로드 후 로컬 DuckDB로 1,391,572행·요청634,513,000·평균 Bid Floor를 확인했다. SHA256은 실행별로 확인한다. 원격 파일의 내용이 바뀌면 기존 정답을 그대로 적용하지 말고 새 기준을 기록한다.

로컬 파일: `/tmp/vanillameta-rill-demo/auction_data.parquet`. 일반 파일 연결의 Parquet 저장 경로로 처리한다. 파일은 Git에 넣지 않는다. 재준비 시 manifest의 URL에서 내려받고 checksum을 대조한다. 이 파일을 매출·환불 CSV import에 넣으면 모델이 맞지 않는다. Rill 기능 데모와 커머스 주문/결제/환불 전용 샘플을 구별한다.

Rill 참조 프로젝트: `/Users/drumcap/workspace_vanilla/my-rill-test-project`. `sources/auction_data_raw.yaml`이 같은 URL을 사용한다. `models/auction_data_model.sql`은 `__time`의 최댓값을 현재 시각으로 이동시키고 device_region에서 국가/주를 만든다. 원본 기간과 실행 화면의 이동 기간을 혼동하지 않는다. 비교 시 고정 shift와 동일한 필터·기간을 명시한다. AVG(bid_floor)는 데모의 평균 지표를 대체하지 않는다.

KST/DST 자정·NULL·잘못된 날짜 등 정확성 단위 검사에는 작은 고정 fixture를 유지한다. 일반 기능의 대표 샘플은 Rill 데모 파일을 사용하고 경계 fixture 결과를 데모 파일의 실화면 검증으로 확대하지 않는다.

이번 준비는 원본 파일과 독립 수치 확인이다. 새 VanillaMeta 소스 업로드·대시보드 제작·Rill과 동일 질문/기간 화면 검증은 아직 실행하지 않았다.

## 동적 탐색 검증 후속

2026-10-14 원본 샘플을 격리 서버에 업로드하고 저장 지표를 동적 탐색 화면에 연결했다. 전체·기기 필터·날짜 다중 필터의 수치와 실제 Aside 화면/XHR를 확인했다. [구현과 검증 범위](../../docs/testing/rill-exploration.md). `node samples/rill/verify-oracle.mjs`로 독립 정답과 원본 SHA256을 재생성할 수 있다. 샘플 다운로드만 확인한 위 기록과 이번 화면 검증을 구분한다.
