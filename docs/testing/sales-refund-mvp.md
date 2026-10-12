# 매출·환불 MVP 신규 MD 명세

입력: Analytics Engineering Ecommerce Sales & Returns v1.0.0(CC BY4.0)에서 주문 묶음 단위로 파생한 정상 CSV orders/payments/refunds/customers. 원본 변경 없이 refund-before-payment 주문173개와 그 연결 행을 제외한다. 정상99827 orders/105209 payments/7737 refunds. 오류173개 주문 묶음은 별도 보존한다.

증빙 루트: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/sales-refund-mvp`. source/파생 SHA256·선택 규칙은 sample-manifest.json, 독립 Python Decimal 정답은 oracle.json. USD/UTC, 세금·배송 포함 결제/환불액. 임의 통화 환산·환불 상품 배분 없음. 제품 결과를 정답으로 만들지 않는다.

## COMMERCE-01 — 실제 UI 정상 bundle 저장·영속화

- 실제 화면에서 이름·orders/payments/refunds/customer 파일 선택→서버 검증·게시.
- 동일 기존 DuckDB 워커 사용, 메타데이터 DB 유지. 파일3개와 customer 선택 여부를 분명히 표시한다.
- 99827 주문/105209 결제시도/7737 환불, 성공 결제액63355735.41/환불3325529.62/차감수취액60030205.79, 결제 완료 주문96851/환불 주문7737. 환불 주문비율7737÷96851×100=7.9885597464145956%.
- 재조회·reload 후 같은 ID/version·정확한 값. 보고서는 공개 synthetic fixture의 출처/통화/날짜·계산 기준을 설명한다. 서로 다른 정답 픽스처의 기존 통과는 반복하지 않는다.

## COMMERCE-02 — 오류 bundle 차단·마지막 정상 보존

- 기존 정상 프로젝트에 temporal-errors bundle 업로드. refund-before-payment173건을 제어된 오류·행 식별자/건수로 안내.
- 새 활성 버전/성공 안내 없음, 로딩 종료, 이전 정상 ID/version/집계 그대로 유지. 오류 파일을 임의 수정하거나 제외하지 않음.
- 중복 이벤트 ID, orphan/금액 초과 및 필수 파일 누락은 관련 하위 검증. 해당 입력 거절 후 정상 요청 사용 가능.

## COMMERCE-03 — 같은 파일 반복·교체

- 같은 이름/대상 프로젝트에 같은 bundle 반복 업로드: 새 버전·중복 금액 없음.
- 올바른 다른 작은 bundle로 교체 시 같은 프로젝트 ID의 버전 전진·새 정의/정답 표시, 기존 파일 보존. 뒤늦은 이전 요청이 새 버전을 덮어쓰지 않음(관련 하위 조건).

## COMMERCE-04 — 날짜·채널·빈 결과

- UTC 2025-09-01~09-30 inclusive: 결제1708961.79/환불81369.40/차감1627592.39. 주문일 코호트 결제 주문2700/환불 주문208, 비율208÷2700×100.
- 같은 기간 paid_search: 결제485798.57/환불19151.96/차감466646.61. 코호트721/58, 비율58÷721×100. 채널별/일별 합계를 독립 oracle와 대조.
- 초기화 전체 기간 복귀. 부분/역순/존재하지 않는 날짜는 요청·게시 차단/이전 결과 범위 유지.
- 2026-01: 금액0/주문0/비율 계산불가, 이전 차트 성공값 미노출. 금액 흐름은 각 event_at, 환불 주문비율은 주문일 코호트+bundle에 확보된 환불이라는 차이를 표시한다.

## COMMERCE-05 — 소유권과 직접 URL

- 새 소유 계정 프로젝트의 list/report/import replacement/presentation/AI에 타계정 접근 거절 및 원본 불변. 익명 API401/UI 로그인 이동.
- 파일 경로·원본 고객 정보·키를 API/AI/화면에 노출하지 않음. unknown ID는 제어된 오류/탐색 복구.

## COMMERCE-06 — 같은 데이터 Rill 결과·탐색 UX

- 동일 정상 원본 CSV와 그 SHA256을 기반으로 비교용 Rill 모델 구성(변환 규칙 공개). 광고 데이터를 매출로 재명명하지 않음.
- Rill 실제 desktop1440×900에서 전체 기간과 Sep2025/paid_search 선택. 전체/필터 정답과 화면 단위·반올림을 독립 대조. Rill의 API/SQL 정확값과 숫자 표시를 분리.
- KPI/날짜·채널 필터/일별 추이/채널 내림차순/읽을 수 있는 이름/표·통화·범위/재로드를 비교. 기능 차이와 조작 단계를 기록하며 픽셀 유사도/완전 UX 동등성을 근거 없이 주장하지 않음.
- 직접 작성한 Rill YAML은 참조 구성으로 표기, Rill 내장 AI 생성 성공으로 보고하지 않음.

## COMMERCE-07 — 실제 gpt-6-luna 설명·제목 편집

- 자연어: `대시보드 제목을 매출·환불 운영 현황으로 바꾸고, 세금·배송 포함 차감 수취액과 주문일 코호트 환불률의 차이를 설명해 줘. 금액과 계산식은 변경하지 마.`
- 기존 AI_PROVIDER=codex 및 명시 URL/catalog, 모델gpt-6-luna만 사용. 집계·정의만 전달하며 고객 원본 행은 전달하지 않음.
- 실제 AI 결과 preview→취소하면 원본 불변. 같은 편집 preview→명시저장→같은 ID·reload 문구 지속. 모델 실패는 제어 오류/버튼 복구, 자동 다른 모델 대체 없음.
- MVP AI는 제목·설명·차트 제목 편집 범위다. 일반 SQL/지표·재무 계산 변경 또는 Rill AI와 동일 생성 능력으로 확대하지 않는다.

## COMMERCE-08 — 모바일·시각화·오류 복구

- 실제 headed Chromium390×844: 파일/프로젝트 선택, KPI·통화·긴 제목/채널, 날짜·필터/초기화, 데이터 표, AI preview·취소 조작. document 가로 overflow 없음, 표는 내부 스크롤.
- desktop1440×900과 모바일 캡처, pageerror/라벨·핵심 버튼 이름 확인. loading/조회 실패에서 이전 결과를 현재 조건으로 표시하지 않음; 정상 재시도 회복.
- 화면 반올림과 원본 정확액을 각각 확인. 대비/스크린리더/WCAG 전체는 관찰 범위 밖이면 NOT_RUN으로 명시.

## 실행 결과

2026-10-12, `develop-v2` HEAD `8e4efa81` 이후 작업 diff에서 아래 범위를 실제 검증했다. API4670/웹3470/Rill9010의 격리 환경이며 기존 실행 중 서버와 기존 사용자 데이터는 초기화하지 않았다. Aside가 실행 중이지 않아 사전에 허용된 headed Chromium으로 실제 화면을 조작했다. 새 자동 Playwright E2E 파일은 저장소에 추가하지 않았다.

| ID | 상태 | 실제 확인과 증빙 파일 |
| --- | --- | --- |
| COMMERCE-01 | PASS | 화면 CSV4개 선택→저장99827/105209/7737, 전체 정확액·일별1096일/채널 대조, ID1/v1·reload. vm-normal-responses.json, vm-oracle-comparison.json, commerce-final-1440.png |
| COMMERCE-02 | PASS | 실제 오류 bundle400/173건·10개 예시·정상v1 유지. 중복/orphan/과다환불/필수컬럼·파일 거절, 정리 후 복구. vm-validation-responses.json, api-checks.json, storage-checks.json, commerce-173-errors-1440.png |
| COMMERCE-03 | PASS | UI에서 프로젝트2 교체v3→v4, 같은 파일 noop/v4 유지. 서로 다른 동시 입력은 하나201/하나409·버전1회 전진, 이전 게시 파일 보존. vm-complete-responses.json, storage-checks.json, commerce-ui-noop-1440.png |
| COMMERCE-04 | PASS | 실제 날짜·paid_search 선택, Sep30일·채널 정확액/코호트 정답. 빈 결과0/null/—, 역순 UI 요청0, 부분/없는 날짜/없는 채널 API400. vm-filter-responses.json, vm-channel-empty-comparison.json, commerce-empty-1440.png, commerce-mobile-date-error-390.png |
| COMMERCE-05 | PASS | 소유 목록 격리, 타계정 report/교체/표현/AI403, 익명401·UI 로그인 이동, unknown404·프로젝트 선택 복귀. 고객 원본행은 AI에 보내지 않으며 확인한 응답에 저장 경로 없음. api-checks.json, commerce-unknown-mobile-390.png |
| COMMERCE-06 | PASS(참조 구성 범위) | 실제 Rill 전체/Sep/paid_search의 금액·주문·비율·일별을 독립 oracle와 비교. rill-oracle-comparison.json, rill-daily-comparison.json, rill-provenance.json, rill-september-1440.png, rill-paid-search-1440.png |
| COMMERCE-07 | PASS(표현 편집 범위) | 실제 Codex gpt-6-luna 요청·응답, 초안 취소 원본 유지, 저장·reload 제목 유지·금액/버전 불변. UI503 주입 안내·버튼 회복 후 실제 모델 정상 응답. verification-receipt.json, vm-complete-responses.json, commerce-mobile-ai-final-390.png, commerce-mobile-ai-error-390.png |
| COMMERCE-08 | PASS(명시 조작 범위) | 실제390×844 파일/프로젝트 선택·날짜/채널·KPI·표·AI취소/저장, document390=viewport390, pageerror0. 축/숫자 겹침 수정 후 재확인. commerce-mobile-file-selection-390.png, commerce-mobile-kpi-390.png, commerce-mobile-table-390.png, commerce-mobile-chart-final-390.png, browser-page-errors.json |

금액 전체: 결제 **63,355,735.41 USD**, 환불 **3,325,529.62 USD**, 차감 수취액 **60,030,205.79 USD**. Sep2025는 **1,708,961.79 / 81,369.40 / 1,627,592.39**, Sep paid_search는 **485,798.57 / 19,151.96 / 466,646.61**다. 주문일 코호트는 각각 **96851/7737**, **2700/208**, **721/58**이다. 화면 비율은 7.99%/7.70%/8.04%로 반올림한다. 현금 흐름과 상품 순매출을 구분했다.

### 발견·수정과 재검증

- 신규 Commerce 인증 DI 누락: 기존 userinfo200인데 신규commerce401. 모듈 JwtModule/guard 등록 후 같은 토큰commerce200·UI 업로드 성공. commerce-auth-before-fix.png 보존.
- UTC 표의 날짜가 시스템 +09로 표시됨: SQL의 명시 UTC 출력으로 2025-12-31T23:59:03Z 재확인.
- NULL/빈 키·중복 고객키·소수센트·주문 총액 불일치: 워커 검증 추가. 173 오류 수는 보존하고 공개 예시는10개로 제한.
- 임시 업로드 파일 잔존: 원본은 게시 UUID 폴더로 복사하고 성공·실패·조기 거절 모두 incoming 정리. 새8개 저장/동시 조건 통과, incoming0·게시 원본 보존. 이전 격리 실행의 알려진20개 파일은 해시 확인 후 증빙 폴더 legacy-staging-before-fix로 보존.
- 빈 코호트 비율은 null/—, 전체 채널 선택지를 필터 후에도 유지. 합계 센트 정수 계산·소수 문자열, 종료일 다음 날 배타 경계. 표현 저장은 해당 컬럼만 변경해 동시 게시 덮어쓰기 방지.
- AI가 금액 차트 제목에 환불률을 넣음: 실제 차트의3시리즈 정보를 전달해 수정·실모델 재확인. 데이터 범위 밖 평생 환불 이력으로 표현하지 않도록 제한. 사람의 초안 확인·저장을 유지하며 자연어 품질을 보장하지 않는다.
- 모바일 금액 축/막대 끝 라벨과 날짜 끝 라벨 잘림: 축 compact·겹침 방지, 정확값 툴팁/내부 스크롤 표. 파일 미리보기의 잘못된 전체 행 추정도 제거.

### Rill UX 비교와 한계

Rill은 compact KPI+sparkline, 고급 시간 범위/비교 기간·동적 dimension 필터를 제공한다. VanillaMeta는 CSV4개를 화면에서 바로 검증·교체하고 정확한 USD 금액6개, 날짜·채널 Apply, 결제/환불/차감3개 추이, 환불 사유·주문 표, AI 표현 초안/명시저장을 제공한다. 모바일은2열 KPI와 내부 스크롤 표로 페이지 넘침을 막는다. 수치·핵심 탐색 행동의 비교이며 픽셀 유사도·완전 UX 동등성 통과가 아니다. Rill YAML은 직접 작성했고 내장 AI 생성은 실행하지 않았다.

### 실행 검사와 생략

변경 대상 워커9개/Commerce7개 단위 조건, 최초24개 HTTP 조건과 저장 수정 후8개 추가 조건, BE/FE build, FE 타입·대상 lint, diff check가 통과했다. 진단/스크립트/이미지는 저장소 밖 증빙 루트에 보관하고 재현용 샘플 생성기는 scripts/commerce/prepare-ae-samples.py로 관리한다. verification-receipt.json에 코드 해시·실행 환경·저장 후 정확값을 남겼다.

요청 모델은 기존 CLI 연결의 `gpt-6-luna`이며 로컬 LLM/다른 모델 fallback은 추가하지 않았다. 모델 지정·실응답과 제공자 내부 모델 라우팅의 독립 attestation은 구분한다.503은 신규 UI 오류 경로 검증을 위한 명시적 주입이며 실제 Codex 장애가 아니다. 이전 제공자 장애 검증은 관련 변경 없이 재사용했다.

기존 통과 케이스·전체 출시 회귀, 운영 백업 복원/강제 crash/SLA, Rill 내장 AI, 전체 WCAG·스크린리더는 이번에 실행하지 않았다. 신규8개 명세의 한정 범위 완료이며 전체123개 출시 검증 완료를 의미하지 않는다.
