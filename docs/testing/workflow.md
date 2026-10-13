# 개발 검증 운영

## 실행 시점

| 시점                | 실행                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| 파일 저장·작성 중   | 에디터 진단. 전체 테스트/빌드/E2E 자동 실행 없음                                   |
| 의미 있는 수정 완료 | 변경 동작 관련 단위/API 테스트만                                                   |
| 기능 완료           | 필요한 타입/린트/빌드 + 변경된 UI의 Aside 확인                                     |
| 통합/PR 준비        | 전체 빠른 단위 검사 + 영향받는 핵심 E2E                                            |
| 출시 준비           | 기본 핵심 E2E 전체 + 변경된 주요 MD 케이스. 확장 검증은 위험/변경 범위에 따라 선택 |

같은 코드·설정·픽스처·환경에서 이미 통과한 검사는 반복하지 않는다. 관련 변경이 있거나 실패가 해결됐을 때 해당 검사부터 재실행한다. 관련성 판단이 어려우면 영향 범위를 넓힌다. 사용자 지정 검증 범위가 우선한다.

## 변경 범위별 선택

| 변경                        | 최소 검증                                 | 확대 조건                              |
| --------------------------- | ----------------------------------------- | -------------------------------------- |
| 문구/CSS/레이아웃           | 변경 화면 Aside, 필요할 때 관련 lint/type | 공통 레이아웃은 주요 화면 대표 확인    |
| SQL/숫자/파일 파싱          | 관련 단위/API, FILE/DATA/METRIC 명세      | 저장 경로 변경은 full-flow             |
| 데이터셋/위젯/대시보드 저장 | 관련 단위/API + 해당 core E2E + 변경 화면 | 공통 저장 API는 전체 core              |
| 인증/권한/토큰/공통 API     | 관련 회귀 + product-flow, smoke           | 공유 영향은 SHARE 계열 API/Aside       |
| 의존성/런타임 설정          | 빌드/기동 + core                          | 변경 SDK와 관련 확장                   |
| 문서/스킬만                 | 링크/명세 ID/스킬 validation              | 실제 실행 가이드 변경은 대표 실행 확인 |

새 테스트는 재발 위험이 높은 동작에만 추가한다. 각 계산/권한 조합을 UI로 모두 반복하지 않는다. 기존 하위 검증을 먼저 활용한다.

## 명령

루트에서 `npm test`, `npm run build`는 통합 시 빠른 전체 검사이며 일반 저장 훅에 연결하지 않는다. FE 타입은 `npx tsc --noEmit`, lint는 `npx eslint src e2e`. 단위 선택 예: BE `npm test -- --runInBand src/metric/metric.service.spec.ts`, FE `npx vitest run src/utils/util.columns.test.ts`.

`frontend-web`에서:

```sh
# 실행 중 테스트 서버를 재사용: 기본 핵심만 (개발 때는 파일 또는 --grep 선택)
npm run test:e2e -- e2e/full-flow.spec.ts
npm run test:e2e -- e2e/product-flow.spec.ts

# 지정 서버: 준비된 테스트 계정/데이터에 대한 멱등 setup이 실행됨
E2E_EXTERNAL_SERVER=1 E2E_BASE_URL=http://localhost:3100 E2E_API_URL=http://localhost:4100/v1 npm run test:e2e

# 공유 서버/데이터를 쓰고 싶지 않으면 격리 실행 (4200/3200/4400 포트가 비어 있어야 함)
npm run test:e2e:isolated
npm run test:e2e:isolated -- --grep 'CSV'

# 확장: 4개 API 인스턴스 + 로컬 provider 준비 비용이 있으므로 명시적 실행만
npm run test:qa -- --grep 'METRIC-03'
npm run test:qa -- --grep 'WIDGET-06'
npm run test:qa
```

기본 명령은 서버가 없으면 기동하고 있으면 재사용한다. 기존 DB를 공유하므로 테스트 데이터 변경이 허용된 환경에서만 사용한다. 격리 명령은 임시 DB/업로드 경로를 사용하고 완료 후 자신이 만든 프로세스만 종료한다. 다른 서버를 종료하지 않으며 포트가 차 있으면 실패한다. BE 빌드가 최신인지 먼저 확인한다. 출력 runRoot/evidence 경로에 기록과 픽스처를 남겨 실패를 재현할 수 있게 한다.

E2E_HEADED=1이면 실제 Chromium 창으로 실행한다. E2E_EVIDENCE_DIR로 실패 screenshot/trace 경로를 지정한다. 기본값은 /tmp/vanillameta-e2e-results이며 증빙은 필요한 실행 폴더로 옮겨 보존한다. Aside 캡처와 PASS/FAIL/BLOCKED/NOT_RUN 결과도 저장소 밖 실행 폴더에 남긴다. 스크린샷만으로 수치/저장/권한을 통과시키지 않는다.

## 기본과 확장 검증의 관계

기본 8개: smoke 3, CSV 분석과 SQL/차트, CSV→데이터셋 저장, 로그인 실패/성공/로그아웃, 위젯→대시보드→공유/임베드, 탐색·Pivot 보기 저장→재로드→복원→CSV 다운로드→삭제. 각 테스트가 단독 실행 가능하다. 공유 설정 자체의 UI 검증은 별도 SHARE-01 명세로 실행하며 기본은 API로 공유를 준비한다.

이전 기본에서 제외한 기능은 삭제된 검증이 아니다:

| 이전 항목                          | 필요할 때 실행할 경로                                          |
| ---------------------------------- | -------------------------------------------------------------- |
| 회원가입/온보딩                    | MD AUTH-03/04 + qa/ui-journeys                                 |
| 로그인 후 재로드/프로필            | MD AUTH-07/11/12 + qa/ui-journeys                              |
| JSON/Parquet                       | MD FILE-02/03 + qa/ui-journeys                                 |
| 메트릭 생성/평가/삭제              | MD METRIC-01/02 + qa/ui-journeys, 수치 조합은 qa/api-contracts |
| 언어 전환/탐색                     | MD NAV 계열 + qa/ui-journeys                                   |
| 전체 차트 종류                     | MD WIDGET-06 + qa/chart-matrix                                 |
| 공유 설정 UI/철회/만료             | MD SHARE 계열 + qa/ui-journeys/api-contracts                   |
| cache/socket/restart/provider 오류 | MD RELIABILITY/AI + qa/reliability/api-contracts               |

고유 확장 코드에는 실패 재현과 하위 정확성 검증 가치가 있어 보존한다. 앞으로 변화가 잦은 화면의 비슷한 순서를 새 Playwright 코드로 무조건 늘리지 않고 MD/Aside를 우선한다. MD의 케이스 ID/기대 결과가 기준이며 fixtures/oracle.json은 자동 검증용 고정 입력이다. 변경하면 두 정답 관계를 확인한다.

## 결과와 재검사

[검증 현황](status.md)에서 미완료 조건과 증빙을 먼저 확인한다. 완료 케이스는 관련 코드·설정·픽스처 변경이 없으면 재사용하고, 부분 완료 케이스는 남은 조건만 선택한다. 실행 후 해당 ID의 상태·증빙·잔여 조건을 함께 갱신한다.

기능 완료 보고: 변경 범위, 실행 검사/명세 ID, 실제 결과와 증빙, 미실행 범위/이유, 잔여 위험. 실행 시간/커밋/환경을 기록한다. 케이스 중 일부 변형만 검사했다면 케이스 전체 통과로 보고하지 않는다. `qa-catalog-results.mjs <Playwright JSON 경로>`는 MD ID에 실행 결과를 연결하며 선택하지 않은 케이스는 NOT_RUN이다. 선택된 변형만 통과하면 PASS_SELECTED_VARIANTS로 기록하며 케이스의 모든 조건 통과로 확대하지 않는다.

CI의 기존 PR/push 빌드·단위 검사는 유지한다. E2E를 저장 훅이나 모든 push에 새로 연결하지 않는다. 형식적인 검사 숫자를 채우기 위한 전체 반복 실행을 피한다.

## 스킬 사용

저장소 `skills/vanillameta-verify`가 관리 원본이다. 설치·갱신은 이 폴더를 `~/.codex/skills/vanillameta-verify`로 복사한다. 다음 요청부터 `$vanillameta-verify`로 변경 범위에 맞는 검증과 Aside 증빙을 실행한다. 저장 훅이나 주기 실행은 등록하지 않는다.

## 서버 DuckDB 파일 저장

파일 저장·분석 워커 변경은 [server-duckdb.md](server-duckdb.md)의 INGEST-01~04와 영향받는 `full-flow.spec.ts`를 선택한다. 서버 기본 저장은 파일 선택 → 데이터셋으로 저장이며 브라우저 분석은 별도 버튼이다. 메타데이터 DB는 그대로 유지하고 신규 파일만 DuckDB에 저장한다. 운영 전제와 제한: [server-duckdb-operations.md](../strategy/server-duckdb-operations.md).

대시보드는 수치와 시각화 디자인을 각각 검증한다. Rill과 동일 데이터/LLM 질의 비교는 [design-rill-parity.md](design-rill-parity.md)를 사용하고 결과·가시성·상호작용·반응형을 분리 판정한다. 수동 차트 성공을 제품 LLM 성공으로 확대하지 않는다.

Rill 탐색 기능 개발은 [사용자 지정 비교·UI 기준](../strategy/2026-10-14-rill-feature-integration.md#사용자-지정-비교ui-기준--2026-10-14)을 따른다. 기능별 Rill 조작과 같은 조건의 VanillaMeta 조작을 대조하고, 같은 뷰포트/상태 캡처 및 API/XHR 수치 증빙을 남긴다. UI는 Rill의 배치·밀도·컨트롤·상태·탐색 흐름과 유사하게 구현한다. 기존 단위 검증만으로 화면 유사성과 동작 대조를 대체하지 않는다.

## AI 대시보드·공통 필터

신규 `/commerce`의 매출·환불 bundle, 게시·소유권, Codex 설명 편집과 모바일은 [sales-refund-mvp.md](sales-refund-mvp.md)의 COMMERCE-01~08을 사용한다. 원본 CSV의 독립 Decimal oracle로 비교하며 기존 광고 샘플/500행 sales 결과를 대신 사용하지 않는다.

구현/운영 범위는 [ai-dashboard.md](ai-dashboard.md), MD 검증은 [design-rill-parity.md](design-rill-parity.md)의 FILTER-01/AI-DASH-01/02를 사용한다. LLM JSON/SQL 실행 성공과 질문 의미·수치 일치는 별개이며 생성 결과마다 요청한 계산식을 대조한다. 로컬 모델 변경은 실패한 LLM 생성만 재검증하고 파일 저장·이미 통과한 차트 전체를 반복하지 않는다.
