# 셀프서비스 BI 단계0 — 권한·호환 계약 점검

2026-10-13, 제품 기준 `8995c93f`. [개발 계획](2026-10-13-self-service-bi-plan.md)의 2A 전에 수행한 점검이다. **점검은 완료했고 일반 소스/지표 소유권 보강은 아직 구현되지 않았다.** 로그인된 사용자를 같은 인스턴스의 신뢰된 구성원으로 취급하는 기존 계약을 다중 고객 격리로 설명하지 않는다.

## 실제 확인

FE3483/API4683, 분리된 테스트 DB·업로드 볼륨, Node24. 새 검증 파일 `category,amount`의 A10/A20/B30, 행수3·SUM60·범주별 A30/B30. 계정A가 파일과 지표를 만들고 별도 계정B의 API/브라우저에서 접근했다. 기존 통과 케이스·139만 행 집계는 반복하지 않았다. gpt-6-luna 설정 유지, AI 호출0(이름이 /ai인 preview는 서버 집계이며 모델 호출이 아니다).

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/self-service-contract-audit/`의 `sum-three.csv`, `resources.json`, `access-checks.json`, `cross-account-metric-desktop.png`. 소스13/지표11은 이번에 생성한 합성 검증 자원이며 보존했다. 다른 기존 자원은 변경하지 않았다. Aside 대신 기존 허용된 headed Chromium 브리지를 재사용했다.

| B 계정 요청 | 개인 소유 계약의 기대 | 실제 | 판정 |
| --- | --- | --- | --- |
| GET /database/info/13 | 타인 소스 거부 | HTTP200 / SUCCESS | OWNERSHIP_GAP |
| POST /database/execute, source13 | 타인 소스 쿼리 거부 | HTTP201 / SUM60, count3 | OWNERSHIP_GAP |
| GET /metric/11 | 타인 지표 거부 | HTTP200 / SUCCESS | OWNERSHIP_GAP |
| POST /metric/11/evaluate | 타인 지표 평가 거부 | HTTP201 / value60 | OWNERSHIP_GAP |
| POST /ai/dashboard-preview, source13, dashboardId 없음 | 타인 소스 미리보기 거부 | HTTP201 / value60 | OWNERSHIP_GAP |

브라우저B의 지표 목록에 A의 새 지표가 표시되며 평가 버튼을 Enter로 실행하면60이 나온다. 수치 계산은 맞지만 개인 소유 권한 검증 PASS가 아니다. 기존 단일 인스턴스의 공유 계약과 앞으로 요구할 개인 소유 계약을 구분한다. SSBI-04의 신규 개인 소유 기대 조건은 FAIL이며 기존130개 기능 카탈로그가 이 격리를 증명한다는 뜻은 아니다.

## 접근 행렬 — 현재 구현

실행 항목 외는 정적 코드 감사다. 아래 "인증만"은 로그인 검사는 있지만 자원 소유자 필터가 없다는 뜻이다. 임의의 기존 자원 수정·삭제는 실행하지 않았다.

| 자원 | 목록 | 단건 / 평가 | 생성 / 참조 / 수정 / 삭제 | 공유 | 근거 |
| --- | --- | --- | --- | --- | --- |
| 일반 Database | 인증만, 전역 find | info/detail/data/execute가 ID 기준 | 업로드/생성에 actor 저장 없음, update/remove 소유 검사 없음 | 독립 공유 계약 없음 | database.controller/service, Database entity |
| Dataset | 인증만, 전역 find | ID 기준, 생성/변경 시 source 소유 검사 없음 | 요청 databaseId/query 실행 및 저장, ID update/delete | 대시보드 공유의 참조 대상 | dataset.controller/service, Dataset entity |
| Metric | 인증만, 전역 find | ID 조회/evaluate, source 소유 검사 없음 | 전역 unique name, soft-delete 행 재활성화도 전역; update/delete actor 없음 | 독립 공유 없음 | metric.controller/service, Metric entity |
| Widget/TableQuery | 인증만인 경로 / source 기반 | 위젯·source·dataset 계보 소유 검사 필요 | 대시보드 layout 검증은 위젯 ID 존재 여부 확인이며 소유 검사 아님 | 공개 대시보드 경로에서 읽음 | widget.controller/service, dashboard.service.validateLayout |
| Dashboard | UserMapping 사용자 범위 | get에서 assertOwner | create mapping, put/delete assertOwner. 참조 widget 계보는 미격리 | 별도 token/만료/철회 검사를 거친 findShared | dashboard.controller/service, share-url.service |
| AI dashboard | saved analysis의 dashboard owner 확인 | preview의 dashboardId 유무와 별개로 source 권한 없음 | save의 dashboard owner 확인만으로 source/dataset/widget 소유를 보장하지 못함 | 공개 토큰의 권한과 섞지 않음 | ai-dashboard.service.owner/schema/preview/save |
| Commerce | ownerId 범위 | ownerId 기반 source/report | actor를 인증 문맥에서 받고 소유 확인 | 이번 Commerce 범위에 일반 공유 없음 | commerce.controller/service, CommerceSource entity |
| Saved view | 구현 없음 | 구현 없음 | 구현 없음 | 구현 없음 | 현재 저장은 Dashboard.analysisDefinition; 개인 bookmark 엔티티 아님 |

메타데이터 비밀번호/connectionString 제거는 이미 있지만 이것은 권한을 대체하지 않는다. 로컬 경로/원본 데이터와 AI 문맥의 최소 공개 범위는 새 profile/진단 응답에서 따로 제한한다. 공개 공유를 보호된 소스의 일반 ID 쿼리 허가로 해석하지 않는다.

## 확정한 보강 순서

1. **소유권 저장·접근 경계부터 보강한다.** 일반 Database/Metric/Dataset/Widget/TableQuery의 서버 관리 owner 관계를 기존 메타데이터 DB에 추가하는 명시적 migration을 사용한다. actor는 JWT의 숫자 사용자ID만 받는다. DTO·connectionConfig·analysisDefinition의 owner 값을 신뢰하지 않는다. 기존 전역 경로까지 actor를 전달해 목록/단건/평가/쿼리/수정/삭제/참조를 검사한다. 새 제작 endpoint만 보호하는 우회는 금지한다.
2. **레거시를 먼저 dry-run 분류한다.** owner 없는 행을 첫 요청자에게 귀속하거나 모든 사용자에게 기본 공개하지 않는다. 명시적 owner 이관표와 dashboard→widget→dataset/table→source, metric→source 계보를 검사한다. 한 소유자라고 확인된 자원은 backup 후 트랜잭션으로 이관한다. 복수 사용자 참조/고아/알 수 없는 seed는 자동 이관하지 않고 제한된 legacy 인스턴스에 보존한다. 사용자 대시보드 mapping만으로 공유 source의 소유자를 추정하지 않는다. 기존 IDs/SQL/파일은 임의 삭제·재생성하지 않는다.
3. **공개 샘플/템플릿 예외를 명시한다.** Component/DatabaseType 같은 정적 카탈로그와 공개 샘플 데이터는 서버가 식별한 읽기 전용 자원만 예외로 허용한다. 일반 고객 업로드를 이름이나 UI의 sample query로 공개 샘플로 판정하지 않는다. 샘플 provisioning이 생성한 사용자 자산도 소유 관계를 저장한다.
4. **기존 이름/정의 계약을 보존한다.** 기존 Metric.name 전역 unique를 synchronize로 갑자기 바꾸지 않는다. 2A의 신규 지표는 내부 고유 키와 사용자 표시명을 구분하는 방향으로 추가 migration을 준비한다. legacy 이름·삭제행 재활성화는 기존 소유 범위가 명시된 경우만 허용한다. 향후 owner+name unique 이관은 별도 migration으로 검사한다.
5. **집계 경계를 모델 호출에서 분리한다.** ai-dashboard의 schema/preview/save를 공통 집계·저장 서비스로 재사용한다. 단일 CSV, 숫자 컬럼 SUM, KPI 또는 범주 막대만 서버가 compile한다. 클라이언트 SQL/임의 함수/외부 파일/추정 통화 변환은 이 경로에 없다. AI는 같은 경계를 호출하며 gpt-6-luna 그대로 유지한다.
6. **2A UI를 붙이고 선택 검증한다.** 파일 서버 저장 → profile 확인 → 숫자 컬럼·지표 이름 → KPI/막대 → 미리보기 → 명시 저장 → reload. 숫자 컬럼이 없거나 범주/필수 필드가 맞지 않으면 안내한다. AI 없이 완료하고 모바일·키보드 증빙을 남긴다. 위 권한 보강 전에 이를 개인 소유 제작 완료로 출시하지 않는다.

운영은 기존 계획대로 단일 상시 서버+worker+영속 볼륨이다. 고객 파일럿은 회사별 별도 인스턴스·DB·볼륨·자격증명으로 격리한다. 일반 소스 계보 권한이 완료되기 전 한 인스턴스에 서로 다른 고객을 받지 않는다. 이 문서가 현재 배포에 격리를 추가하거나 사용자 역할을 새로 부여한 것은 아니다.

## 최소 profile / 정의 / 저장 계약

| 경계 | 2A 계약 |
| --- | --- |
| Source profile | 권한 확인 뒤 sourceId/kind/ready/dataVersion/전체 rows/column name+native type/날짜 범위/capabilities. 로컬 filename·연결문자열 제외. previewRows와 전체 검증을 구분. imported manifest의 불변 버전 식별을 사용하고 metadata updatedAt을 데이터 hash로 대체하지 않음 |
| Metric snapshot | schemaVersion1, metricId/definitionVersion1, SUM 대상 컬럼, displayName/단위·소수·표시 방식, 검증된 source/table. decimalPlaces/K/M은 표시만 변경. 범주 차원은 별도 역할. 미래 가중 평균/비율은2B이며 임의 AVG로 대체하지 않음 |
| Draft/result | structured/legacy discriminator, 실제 source/dataVersion, 검증된 snapshot 및 hash. 쿼리 결과 정확값과 UI 표시값 분리. 숫자 유형이라고 Decimal/BigInt를 무조건 Number로 강제하지 않음 |
| Saved dashboard | 기존 analysisDefinition에 검증된 정의 snapshot/version 보존. 수정 시 expectedRevision/CAS 재사용. legacy raw SQL은 version0 경로 보존. source/column 변경은 broken 안내와 명시 재검사; 지표 변경으로 기존 저장 식을 조용히 치환하지 않음 |
| Read-only sharing | 기존 token·만료·철회 정책 + 허용된 대시보드에 결합된 데이터만 읽기. 전역 소스 조회권·수정권을 주지 않음. 소유 일반 경로와 별도 actor/scope로 검증 |

현재 `validateDraft`는 SQL widget 형식만 보존하므로 새 snapshot 필드를 FE에만 붙이면 저장 시 사라진다. BE validator/schema·저장·재조회까지 함께 바꿔야 한다. 기존 DuckDB worker는 안전 범위 밖 BigInt와 Decimal을 문자열로 보존한다. 구조화 지표도 이 정책을 유지하고 돈의 집계에 표시 반올림을 넣지 않는다. 날짜 없음은 시계열 불가이며 가짜 현재 날짜를 넣지 않는다. 이 profile/snapshot 계약은 다음 구현의 기준이지 현재 제공되는 응답이라고 주장하지 않는다.

## baseline과 검증 비용

139만 행 실검증은 재사용한다: 2026-10-12의 `server-duckdb-1391572/RESULTS.md` 및 `api-oracle-results.json`. 원본39,015,650 bytes, DuckDB46,673,920 bytes, 업로드 약1,379ms, 전체 집계77.113ms, 기기 집계14.599ms. 당시 API4500/UI3400·HEAD37859772+diff의 단일 실행 관찰이며 현재 Node24의 성능 보증이나 통계적 benchmark가 아니다. requests634513000·평균5.5712386765263995±1e-9 정답은 그대로 유지한다.

다음 보강은 관련 owner/참조/마이그레이션 회귀를 먼저 실행한다. 공통 API 권한 변경은 기존 core의 인증·저장·공유 영향까지 선택 확대하고 출시 때 전체 gate를 검사한다. 일반 코드 저장마다 E2E를 돌리지 않는다. 신규 source13/metric11은 재검증용으로 유지하며 개인정보·비밀번호·토큰은 이 문서/결과 JSON에 넣지 않았다.

## 독립 검토

기존 계획 검토 담당 에이전트가 읽기 전용으로 별도 감사했다. 일반 source/dataset/metric/widget 인증-only, 대시보드 참조 위젯의 존재-only 검증, editable config owner 위조 및 신규 endpoint만 보호하는 우회를 동일하게 지적했다. 원격 자료나 새 라이브러리를 추가하지 않았다.

완료: 접근 행렬, 실제 교차 접근 재현, legacy/버전/집계 호환 전략, 기존 성능 기준선의 출처 기록. 남음: owner migration·공통 권한 구현 및 재검증, source profile, SQL 없는2A 제작 UI, 실제 저장 snapshot. 개인 소유권은 미해결이며 이 감사로 PASS 처리하지 않는다.


## 후속 구현·재검증

[소스 소유권 검증](../testing/source-ownership.md)에서 Database owner 추가·공통 기존 API 경계·사용자별 신규 샘플·NULL legacy 잠금과 인벤토리를 구현했다. 최초 교차 접근 FAIL은 새 fixture A/B로 수정·재검증했으며 선택 조건 PASS. 기존 데이터 소유자는 추정 배정하지 않았다. 전체 SSBI-04/운영 SaaS와 저장 보기 완료로 확대하지 않는다.
