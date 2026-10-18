# 기업용 사내 분석·Artifact 요건 설계

2026-10-18 · Draft · 설계/요건 추가만 수행. 사내 분석과 공유에 필요한 FR014~025/NFR005~008의 목표 계약을 정의한다. MK AI 연동 계약/구현은 보류한다. 기존 Rill 의미 계층·Claude식 결과 편집 원칙과 현재 Studio를 재사용한다.

## 사용자와 책임

- 조직 관리자: 직원·그룹·자원별 권한을 관리한다. 데이터 관리자 권한과 구분 가능하게 설계한다.
- 데이터 관리자: 원천 카탈로그·열의 업무 의미·공식 지표 연결·활성 상태와 변경 영향을 관리한다.
- 분석 담당자: 허용 데이터·조건으로 탐색하고 Artifact 초안/게시/보고서를 만든다.
- 수신자: 허용 결과를 조회하거나 명시 허용된 독립 사본을 본인 소스로 재사용한다. 공유 접근과 원본 데이터 권한은 별도다.

## 계층과 경계

```mermaid
flowchart LR
    Identity[조직·직원·그룹] --> Policy[자원 권한 검사]
    Catalog[분석 카탈로그·업무 변수] --> Definition[지표·검증 조건·버전]
    Policy --> Definition
    Definition --> Preview[분포·건수·차트·표]
    Definition --> Artifact[블록 Artifact 초안·게시]
    Definition --> Export[내보내기 작업·파일]
    Artifact --> Distribution[수신자 공유·독립 복사]
    Distribution --> Notification[본인 알림함]
    Export --> Notification
    Artifact --> Dependency[사용처·보관·비활성화]
```

권한은 작업 생성과 데이터 조회 전에 서버가 확인한다. 동일 검증 정의를 미리보기/규모 집계/비교 리포트/export가 사용한다. AI는 설명·조회·변경 제안을 만들며 데이터 권한·정의 유효성을 승인하는 주체가 아니다. 기존 화면에 관리자 메뉴를 추가하는 것만으로 기업 권한을 구현했다고 간주하지 않는다.

## 현재 기반과 새 부족점

| 영역        | 재사용할 기반                        | 새 목표/아직 검증하지 않은 부분                                             |
| ----------- | ------------------------------------ | --------------------------------------------------------------------------- |
| 목록        | UC049 제목/유형/정렬                 | 개인 즐겨찾기/보관·조직/수신자 탐색은 후속                                  |
| 데이터·지표 | Source profile·Metric 정의·의미 제안 | 업무 변수 사전·카탈로그 관리·공식성/변경 영향·날짜/단위 의미                |
| 권한        | 기존 소유자·공유 링크·복제 검증      | 조직/그룹·데이터와 산출물 권한 분리·모든 서버 경로 회수 반영                |
| 조건·AI     | 기존 필터·지표/블록 AI·초안 검증     | 중첩AND/OR 편집·유형별 연산자·AI 조건 차이와 동일 정의의 분포/규모 탐색     |
| 공유        | 게시 snapshot·명시 허용 복제         | 수신자 지정/그룹 관계·알림·권한 회수·중복/재공유·개인 보관과 공유 중지 분리 |
| 출력·운영   | 집계/게시 결과·저장 영수증           | 버전에 고정한 비동기export·전달 권한·만료/중단 상태·감사 이력               |

위 표는 새 설계와 기존 증빙의 범위를 구분한 것이다. 이번 작업에서 제품 코드를 재실행하거나 운영 연결을 검증하지 않았다. 기존 동일 목표는 별도 기능으로 중복 구현하지 않는다.

## 상태·실패 계약

- 카탈로그 등록/정의 변경: 관리자·스키마 검사 후 명시 저장. 비활성화는 원본 물리 삭제가 아니다. 연결된 분석/게시의 영향은 따로 확인한다.
- 분석 조건: AI/직접 편집 공통 구조와 타입 검증. 일부 미지원 조건이 포함된 묶음은 기존 초안을 보존하며 전체 거절한다. 사용자가 범위를 줄여 재제안하면 새 묶음으로 검증한다.
- 실행 문맥: sourceRevision·metricVersion·검증 조건·기준/비교 기간·시간대·제외 기준·결과 범위를 연결한다. 샘플 분포를 전체 집계로 표시하지 않는다. 저장과 단순 탐색은 구분한다.
- 공유: 조회 권한 부여와 독립 사본 전달을 선택 단계에서 구분한다. 복사 시 새ID·소유자·소스 권한을 검증한다. 전달 저장과 알림은 별도 결과다. 알림 실패만으로 전달을 되돌리지 않는다.
- 공유 중지: 현재 접근 관계와 향후 받기를 중지한다. 이미 정당하게 만든 수신자 소유 사본/다운로드 파일을 원격 삭제한다고 안내하지 않는다. 재공유는 새 권한·현재 상태로 검사하고 중복 관계를 만들지 않는다.
- export: 접수→실행→완료/실패/취소, 재시작 미확정은 중단/결과확인. 완료는 검증된 파일 메타데이터가 있을 때만 표시한다. 상태 재조회는 새 작업을 만들지 않는다. 오래된 파일·회수된 권한은 전달을 거절한다.
- 보관: 개인 목록 숨김/복원, 조직 자산 비활성화, 영구 삭제는 별도 작업이다. 공유/지표/게시 참조가 있으면 영향 없이 자동 연쇄 삭제하지 않는다.

## 목표 논리 객체 — DB 변경 아님

| 객체                                   | 책임·관계                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Organization / Membership / Group      | 사용자 소속·활성 상태·조직 범위. 기존 로그인 ID와 연결하며 인증 대체를 강제하지 않음 |
| ResourceGrant                          | 주체·조직·자원·허용 동작. 데이터와 Artifact 권한을 따로 표현                         |
| AnalysisCatalog / BusinessVariable     | 허용 원천·업무 표시명·유형/날짜/단위·정의 버전                                       |
| ConditionDefinition / ExecutionContext | 공통 검증 조건과 원천/지표/기간/제외/결과 범위 고정                                  |
| ArtifactDelivery / Notification        | 접근 관계 또는 독립 복사 이력과 별도 수신자 이벤트                                   |
| ExportJob / ResultFile                 | 요청자/동일 요청ID·정의 문맥·상태·결과 범위/만료·접근 경로                           |
| PersonalLibraryState / UsageReference  | 본인 보관/즐겨찾기와 공유 자산의 참조 영향                                           |
| BusinessAuditEvent                     | 행위자·자원ID·버전·시각·결과. 민감한 원본 행/인증 비밀은 비보관                      |

물리 스키마·고유키·데이터 마이그레이션·재시작 처리/저장 방식은 각 구현 단위에서 별도 검증한다. 목표 객체를 기존 테이블/FK처럼 표기하지 않는다.

## 우선순위와 종료 조건

1. UC049 목록 기반/사용자별 보관을 이어가되, 조직·데이터 카탈로그·서버 권한(UC050/051)을 기업 도입의 선행 단위로 설계한다.
2. 공식 지표·변수 의미와 조건/분포/규모 탐색(UC052)을 기존 편집·미리보기에 연결한다.
3. 수신자 전달·알림(UC053), 기간 비교/비동기export(UC054), 보관/사용처 보호(UC055)를 구현 단위로 나눈다.
4. 확정형 게시와 갱신형 게시·템플릿/EIS 조합은 기존 사내 로드맵과 함께 후속 구현한다. 외부 엔진·MK AI 연동을 선행하지 않는다.

형식/추적 종료는 requirements↔UC050~055↔TC050 연결과 출처 대조다. 제품 종료는 [TC050](../test_cases/TC-050-enterprise-analysis.md)의 실제 역할별/동일 정답/화면 검증과 기존 TC005 무회귀다. 성능·가용성·동시 이용자·감사 보존 수치는 실제 데이터/조직 규모를 정한 후 측정·합의한다. 측정 전 성능 수치를 제품의 보장으로 제시하지 않는다.

## 첫 구현 단위: 업무 메타데이터

[UC050 계획](../plans/UC-050.md)은 기존 소유 DuckDB 소스의 실제 열 프로파일과 추가 전용 업무 설명 이력을 연결한다. 원본 열 타입을 변경하지 않고 표시명·설명·단위만 편집한다. 기존 분석·AI 문맥에 자동 적용하지 않으며 별도 공식 승인/관리자 역할을 구현한 것으로 보지 않는다. 조직·분류·활성/영향 검토는 목표로 남긴다. [검증 상태](../testing/source-catalog.md)에서 자동 검사와 실제 화면 미실행을 구분한다.

[UC050 이력 후속](../testing/source-catalog-history.md)은 기존 추가 전용 `source_catalog_entry`에서 소유권 검사 후20건 요약과 정확한 두 버전의 업무 필드 차이를 읽는다. 실제 데이터 프로파일/원본 행 조회·새 스키마/자동 복원 없이 편집 초안과 분리한다. 이력 비교는 지표/대시보드 사용처의 변경 영향 검토와 다른 기능이다.

[UC050 저장 전 미리보기](../testing/source-catalog-preview.md)는 save의 권한/버전/업무 필드 검증과 이력 비교의 차이 계산을 공유하며 쓰기 없이 정규화한 draft를 반환한다. UI의 동의는 그 draft에만 연결하고 입력이 바뀌면 폐기한다. 기존 save API 호환성과 저장 직전 검증/CAS는 유지한다. 원본/분석 전파와 공식 승인·사용처 영향 검토는 추가하지 않는다.

[UC050 직접 사용처 조회](../testing/source-catalog-usage.md)는 소스 소유권을 먼저 확인하고 Metric.databaseId/useYn와 Dashboard.analysisDefinition.databaseId·UserMapping/삭제 상태·기존 dashboard 권한으로 읽는다. ID/표시명만 반환하고 본인 분석 후보의20개 커서 구간을 명시한다. 새 물리 모델은 없으며 일반 위젯/게시/독립 사본 전체 의존 그래프·변경 영향 계산과 구분한다.

[UC050 Studio 조회](../testing/studio-source-catalog.md)는 Studio 생성/재사용 공용 선택기에서 기존 catalog/read의 소유권 검사를 재사용한다. sourceId/현재 profile.dataVersion·실제 열명/형식과 응답을 대조한 읽기 전용 설명이며 질문/LLM 문맥 자동 삽입과 계산/표시 이름 변경은 하지 않는다. 소스 snapshot key로 읽기 수명을 분리하고 질문 입력 재렌더는 재조회하지 않는다. 새 API/DB 스키마/의존성은 없다.

[UC050 Studio 소스 검색](../testing/studio-source-search.md)은 기존 GET /bi/sources의 명시 catalog=1에 한해 ownerId 제한과 최신 이력 MAX(version) LEFT JOIN 한 쿼리로 표시명/버전만 더한다. 기본 소비자에는 id/name/engine만 유지한다. 전체 이력·원본 프로파일/행·연결정보를 반환하지 않고, 손상 최신 표시명은 원본으로 되돌리되 과거 정상 이름을 자동 선택하지 않는다. 목록 업무 이름은 탐색 참고이며 선택 후 기존 현재 버전/열 검사를 대체하지 않는다.

[StudioMetricPicker](../testing/studio-metric-picker.md)는 StudioCreate의 기존 `/bi/metrics` 응답과 체크 선택을 표시·검색한다. 서버 권한/계산/저장 API는 변경하지 않는다. 소스별 key로 검색 수명을 분리하고 검색/상세보기는 부모 콜백 없이 읽기만 한다. 체크 변경은 기존 proposal 무효화/selectedMetricIds 전달을 유지한다. 표시 상세는 구조화 필드 whitelist이며 SQL·연결정보/원본 행과 공식 승인 상태는 출력하지 않는다.

[StudioMetricBasis](../testing/studio-metric-basis.md)는 선택기와 생성 미리보기의 계산 기준 whitelist/누락 표현을 공유한다. 미리보기는 서버 고정 proposal.semanticProposal[].metric만 사용하며 현재 catalog를 재조회하지 않는다. 구조화 필드 표시와 숫자/차트의 실제 preview 응답·접미사 책임은 분리한다. 원본/저장 요청·SQL/LLM·BE/API/DB 모델은 변경하지 않는다.

[저장 분석 metricBasis](../testing/studio-saved-metric-basis.md)는 권한 보호 Studio GET의 definitions.entries optional 투영이다. 이미 읽은 structured snapshot의 source/key/metric/version과 블록 참조만 대조하고 계산 기준 whitelist를 반환한다. 현재 Metric을 basis용으로 조회하지 않는다. Inspector는 현재 선택/종류·참조에 맞는 저장 entry만 표시하고 활성 AI preview override에는 표시하지 않는다. 편집 문서/초안 보관/저장 요청/SQL/게시에는 새 메타데이터를 추가하지 않는다.

## UC051 조직·직원 첫 단위

[UC051 계획](../plans/UC-051.md)과 [증빙](../testing/enterprise-membership.md)의 조직/직원 물리 모델을 추가한다. EnterpriseOrganization의 version CAS가 직원 변경을 직렬화하고 EnterpriseMembership은 계정당 한 조직만 허용한다. EnterpriseEnrollment는 미소속 본인이 발급한15분 일회용 코드 해시이며 명시 동의 없는 계정 편입을 막는다. EnterpriseAuditEvent는 성공한 조직/직원 변경의 actor/자원/버전/시각만 저장한다. User.active/authVersion과 기존 jwtId를 사용해 비활성·재활성 후 예전 bearer/refresh를 거절한다. 기존 개인 자원 소유권은 유지하며 조직 admin이 다른 직원의 데이터에 자동 접근하지 않는다. 자원별 grant/그룹·수신자 전달은 별도 후속이다.

## UC051 자원별 동작 권한

[권한 연결 설계](../plans/UC-051-resource-access.md)·[선택 검증](../testing/enterprise-resource-access.md)은 별도 grant의 read/edit/publish/export와 실제 actor를 사용한다. 소유자 매핑/소스 ownerId를 수신자로 바꾸지 않으며 대시보드 권한은 연결 소스로 전이하지 않는다. 기존 기본 owner-only 경계는 유지하고 명시 action 호출에만 grant를 사용한다. 개인 실행 기록은 actor 소유를 유지하며 게시자 publish 회수 시 공개 읽기도 재검사한다. 새 산출물의 소유권으로 읽기 grant를 게시/export 권한으로 바꾸는 우회를 금지한다. 정책 목록은 활성 사용자·동일 조직·현재 자원 소유자를 DB join으로 재확인하고 프로파일 캐시에 사용자별 권한을 섞지 않는다. UI 제어와 실제 화면·운영 수용은 별도다.

[UC050 업무 변수](../plans/UC-050-variable-semantics.md)는 기존 업무 메타데이터 이력에 업무 유형·고정 날짜 형식·분류 문자열을 확장한다. 실제 문자열 날짜는 허용 형식으로 파싱한 뒤 같은 형식의 문자열과 왕복 대조하여 전체 값의 유효성을 검사한다. DuckDB [날짜 형식 함수](https://duckdb.org/docs/current/sql/functions/dateformat)는 try_strptime 실패의 NULL 처리와 strftime의 포맷을 정의한다. 정확한 패딩/공백 거절은 그 함수를 조합한 VM 검증 규칙이며 실제 DuckDB 테스트로 확인한다. 입력 형식은 SQL 자유 입력이 아니고 실제 열 식별자는 기존 quoteColumn으로 인용한다. 원본 값·SQL은 검증 응답에 반환하지 않는다. 기존 분석/AI 계산 자동 적용·조직 공통 분류/활성 상태의 전체 보호 경로는 후속이다.

[UC050 소스 활성 상태](../plans/UC-050-source-availability.md)는 별도 관리 경로를 통해 재활성을 허용하고 일반 SourceAccess의 모든 동작과 dashboard/widget/source 연결 검사에서 비활성을 차단한다. 기존 공개 게시도 현재 게시자와 원 소스 권한 검사에 이 상태를 적용한다. 관리 API는 데이터 프로파일을 읽지 않으며 최소 상태/버전만 반환한다. 비활성화는 물리 삭제/승인 취소·전체 영향 그래프가 아니다.

## SQLite 메타데이터 작업 조정

[UC051 설계](../plans/UC-051-sqlite-coordination.md)의 DataSource별 공통 큐는 SQLite의 단일 연결에서 독립 transaction이 다른 요청의 savepoint로 중첩되는 것을 막는다. 같은 작업의 기다리는 하위 호출은 살아 있는 AsyncLocalStorage lease를 재사용하고 종료 후 비동기 문맥은 새 작업으로 기다린다. 이것은 권한 승인이 아니며 기존 actor/grant·manager·CAS/isolation/영수증을 유지한다. 선택 권한/인증·Studio get/prepare·기존 게시 state/publicResult는 읽기 전체를 조정한다. 원시 Repository 단일 쓰기와 그 밖의 조회는 후속이며 MySQL은 기존 DB lock 의미를 유지한다. 새 모델/스키마/제품 UI 변경은 없다. [검증 범위](../testing/sqlite-coordination.md)는 전체 운영 경합 보장이 아니다.
