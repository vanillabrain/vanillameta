# SSBI-02·03·08 후속 — 139만 행 구조화 제작

2026-10-13, 기준 `84b6d369` + 아래 모바일 숫자 축 수정. 기존 편집 EDIT-01~09 및 파일 워커 INGEST-01~04 결과는 재사용한다. 이번에는 새 프로파일/저장 지표/편집 경로에 아직 적용하지 않은 대용량 Rill 변형을 선택했다. 기존 owner NULL 소스3를 변경하지 않고 검증 계정에 원본 Parquet를 새 소스22로 저장했다.

입력: Rill OpenRTB 광고 경매 샘플 `auction_data.parquet` 39,015,650 bytes. 매출·환불 자료가 아니다. SHA256 `7549d18b0294932802407f6bd851a807ff88ba1406b2958bbd8b4c261a4ee157`. 원본을 별도 메모리 DuckDB로 직접 읽어 계산하고 제품 API·화면과 대조했다. 제품 워커의 결과를 독립 정답으로 다시 쓰지 않았다. 이전 Rill 비교의 정답·프로젝트 지표 정의는 재사용했고 Rill UI/AI는 반복하지 않았다.

| 조건 | 절차·기대 | 결과 |
| --- | --- | --- |
| LARGE-01 / SSBI-02 | 실제 내 파일→SQL 없이 제작. 전체1391572행/표본5행/컬럼·NULL·날짜 구분 | PASS: 21열, app_site_cat NULL152575, __time 2023-09-09~16 |
| LARGE-02 / SSBI-03 | 실제 화면 SUM 정의 저장→미리보기→대시보드 저장/reload. compact 표시와 원값 구분 | PASS: 지표24/대시보드23, 634.5M 표시, 정확값634513000 |
| LARGE-03 / SSBI-03·08 | 같은 지표 기기별 막대와 COUNT 행수 추가. 9기기·1391572행·snapshot/정확값·모바일 대조 | FAIL→PASS: 모바일 축 밀집 수정. 지표25 COUNT(*)=1391572, 1.4M 표시. 저장 후3차트·순서·6/6/12 너비·3/3/7 높이 유지 |
| LARGE-04 / SSBI-03 | 가중 평균과 행 평균을 구분하고 미지원 정의를 성공으로 치환하지 않음 | 부분 완료: 공식 구분 PASS, 구조화 가중 평균 정의 NOT_IMPLEMENTED, 요청400 |

## 수치·저장 증거

전체 요청634513000과 원본 집계 행수1391572는 다른 지표다. 기기별 요청은 Mobile/Tablet307763000, Personal Computer173308000, Set Top Box[NR1]105976600, Connected TV27207600, Tablet15435200, Phone2343800, Not Available1530400, Games Console931400, Connected Device17000. 미리보기·저장 재조회·정확값 표 모두9개 정답과 일치한다.

저장 snapshot v2는 소스22의 전체 dataVersion과 지표24/25/24·표현을 보존한다. 별도 editor 재조회에서도 세 차트의 제목/종류/순서/크기가 같다. 각 KPI 시간별169점 합계도634513000/1391572와 일치했다. 시간별 개별 값 전체의 독립 대조를 추가 수행했다고 보고하지 않는다.

Rill `auction_metrics.yaml` 평균은 `SUM(bid_floor)/SUM(has_bid_floor_cnt)`다. 원본 직접 계산5.571238676526887, 이전 Rill 정답5.5712386765263995는 오차1e-9 안에서 같다. UI에서 별도 진단 지표26 `원본 행 평균 Bid Floor · 가중 아님`을 저장한 `AVG(bid_floor)` 결과7.106603021628408은 직접 계산7.106603021633042와 일치하지만 가중 평균을 대체하지 못한다. UI6집계/WEIGHTED_AVG 실제400을 확인했다. 이 지표는3차트 대시보드에 추가하지 않았다. 원본 날짜는2023년이며 Rill의 날짜 이동 화면과 같다고 주장하지 않는다.

## 발견·수정·재검증

390px 막대의 숫자 축이 `50M100M150M…`처럼 밀집했다. 최초 실패 `dashboard-mobile-settled.png`를 보존했다. 공통 LineChart 숫자 축에 겹침 숨김을 적용하고 가로 막대의 차트 폭480px 이하에서2분할·오른쪽 여백28px로 조정했다. 넓어지면5분할/기존 여백으로 복원한다. 범주9개·SQL·정확값은 유지했다. 설치된 ECharts media/axis 구현 및 [공식 axis 문서](https://echarts.apache.org/handbook/en/concepts/axis/)를 확인했다.

실제390px 재조회 후0/200M/400M 간격·끝 여백과 정확값 표를 확인했다. 문서 폭390=viewport390. 같은 탭을1440px로 넓혀 숫자 축 밀도가 복원되고 문서 폭1440=viewport1440이었다. 최종 성공은 `bar-mobile-after.png`, `dashboard-mobile-after.png`, `dashboard-desktop-after.png`. 최초 `dashboard-mobile.png`는 응답 대기 중 화면으로 완료 증거가 아니다.

키보드: 지표 저장·결과 미리보기·편집 순서 이동/미리보기/저장 및 모바일 표 열기는 초점을 맞춰 Enter로 실행했다. native select는 selectOption으로 선택했다. 기존 native popup BLOCKED·VoiceOver NOT_RUN은 반복하지 않고 유지하며 전체 키보드 완료로 확대하지 않는다.

신규 축 회귀1개 PASS(선택 실행에서 기존 resize1개 skipped): 기기·정확값 series/tooltip 보존, 좁은/넓은 옵션 복원 계약. 최종 코드로 FE 타입/변경 파일 lint/FE build PASS. 기존 Vite config·Toast UI CSS 경고 유지. 이전 편집45개 검사·BE build는 관련 변경 없는 범위에서 재사용했고 전체 E2E는 반복하지 않았다. BE/AI 설정 변경 없음, 모델 호출0.

## 실행·증빙

FE `http://127.0.0.1:3483`, API `http://127.0.0.1:4683/v1`, Node24·격리 assistant24.db·기존 DuckDB worker. Aside daemon auth challenge fetch 실패로 기존 허용된 실제 headed Chromium bridge를 재사용했다. AI는 codex/gpt-6-luna와 기존 base URL/catalog 설정을 유지했다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/structured-rill-139m/`:

- `verification-results.json`: 코드SHA·선택 검사·수치 assert·제한.
- `profile.json`, `independent-oracle.json`: 전체 프로파일과 원본 직접 정답.
- `editor-preview.json`, `saved-preview-with-trends.json`, `saved-editor.json`, `saved-snapshot.json`: 결과·재조회·정의/배치 보존.
- `row-average-preview.json`, `weighted-unsupported.json`: 공식과 지원 범위.
- `profile-desktop.png`, `sum-preview-desktop.png`, `editor-preview-desktop.png`, `exact-devices-desktop.png`, `exact-devices-mobile.png`, `row-average-not-weighted.png`: 실제 화면.

인증정보는 기록하지 않았다. 신규 자동 UI suite는 추가하지 않았다.

## 남은 우선순위

1. P1 SSBI-03 가중 평균·비율 지표 정의: 분자/분모·0/NULL·지표 의미를 저장하는 계약이 필요하다. 기본6집계 검증과 별도다.
2. P1 파일 갱신·매핑/저장 보기: 버전 교체·열 변경/삭제·기존 대시보드 호환은 후속이다.
3. P1 접근성 잔여: native 메뉴 실제 선택·VoiceOver 발화는 기존 제한이 남아 있다.

SSBI-02/03/08/14 전체는 부분 완료다. 원격/다중 소스·제작 단계 필터 등을 완료로 바꾸지 않으며 기존130개 카탈로그 집계는 유지한다.
