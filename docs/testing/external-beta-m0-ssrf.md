# 외부 베타 M0 — 소스 유형 제한(SSRF 차단) 증빙

2026-10-23 · Draft / PASS_SELECTED. [계획](../plans/external-beta-launch.md) M0 3번.

## 문제

사용자가 데이터 소스의 `engine`과 `connectionConfig.host/port`를 정하면 서버가 그 호스트로 소켓을 연다(MySQL·PG·MSSQL·Oracle은 knex, ClickHouse·Trino·Databricks는 `fetch`). 공유 VM에서는 내부망과 클라우드 메타데이터 서비스(`169.254.169.254`)에 닿는다. 연결 테스트(`POST /database/test`)는 저장 없이 즉시 소켓을 연다.

## 해결

`backend-api/src/connection/source-type-policy.ts`.

- `NODE_ENV=prod`에서 `ALLOWED_SOURCE_TYPES`가 비어 있으면 `file,sample`만 허용한다. 다른 환경은 변수를 지정하지 않으면 제한이 없다(기존 개발 흐름 유지).
- 항목은 `file`(duckdb), `sample`(sqlite·sqlite3·better-sqlite3), 엔진 이름(예: `pg`), `*`(제한 해제)다. 엔진은 대소문자·공백을 무시한다.
- 적용 지점: `DatabaseService.webConfig`(생성·수정), `ConnectionService.testConnection`·`testDatabase`(연결 테스트는 로컬 파일 엔진도 거부: 사용자가 서버 경로를 `filename`으로 줄 수 있다), `getConnectionConfig`, `QueryAnalyzerService.analyzeExternalQuery`(운영자 전용 `LegacyOperationsGuard` 뒤지만 `getConnectionConfig`를 거치지 않고 직접 `knex()`를 만들어 같은 검사를 추가). `getConnectionConfig`는 사용자 경로의 knex 생성과 ClickHouse·Trino·Databricks 실행이 모두 거치는 곳이라, 제한 이전에 저장된 네트워크 소스도 쿼리·소켓 열기 전에 막는다.

로컬 파일 엔진은 소켓을 열지 않으므로 항상 허용한다. `file`·`sample` 항목은 의도 표기일 뿐 동작을 바꾸지 않는다. 소스 유형 정책은 `NODE_ENV=production` 별칭도 prod로 취급한다(부팅 가드는 이 별칭 자체를 거부하고, 다른 코드는 정확히 `prod`만 비교한다). 운영 부팅 가드는 `QUERY_ALLOW_WRITE=true`(읽기 전용 쿼리 가드 해제)도 거부한다.

## 검증 (로컬, Node 26)

| 검사 | 결과 |
| --- | --- |
| `src/connection`·`src/config`·`src/common/monitoring` 전체 (신규 `source-type-policy.spec.ts` 7, `source-type-restriction.spec.ts` 14, `production-guard.spec.ts`에 `QUERY_ALLOW_WRITE` 1, `query-analyzer.service.spec.ts`에 prod 거부 1) | `src/connection`·`src/config`·`src/common/monitoring` 20 suites 209 tests PASS(analyzer 스펙 추가 전). 분석기 스펙 추가 후 `query-analyzer`·`src/connection`·`src/config` 11 suites 122 tests PASS |
| prod에서 쿼리 분석기가 mysql2 소스를 받으면 | `ForbiddenException`, `knex` 미호출 |
| `NODE_ENV=PRODUCTION`, `QUERY_ALLOW_WRITE=true` | 정책이 prod로 취급, 가드가 거부 |
| prod 기본값에서 mysql2·pg·mssql·oracledb·clickhouse·trino·databricks 연결 테스트 | 403, `fetch` 미호출 |
| prod에서 네트워크 소스 생성, duckdb·sqlite·sqlite3 `filename` 연결 테스트 | 403 |
| 제한 이전에 저장된 clickhouse 소스의 `getKnex`·쿼리 실행 | 403, `fetch` 미호출 |
| 저장된 업로드(duckdb) 소스 | 설정 조회 성공 |
| `ALLOWED_SOURCE_TYPES=file,sample,clickhouse` | clickhouse 연결 테스트가 다시 `fetch`를 호출 |
| eslint(변경 파일 에러 0, 기존 경고 5), `tsc --noEmit` | PASS |

## 한계

- **엔진을 `ALLOWED_SOURCE_TYPES`에 올리면 SSRF 노출이 되돌아온다**: `fetch`의 리디렉션 추적, Trino 서버가 주는 `nextUri` 추적, BigQuery `keyFilename`(서버 경로)이 그대로 남는다. 엔진을 열기 전에 사설 주소 송신 차단을 먼저 한다.
- 프런트엔드가 운영에서도 네트워크 DB 유형을 보여 주므로 선택하면 403이 난다(UX. `findAllDatabaseTypes`에서 거르는 일은 남아 있다).
- 제한 이전의 네트워크 소스가 남은 DB에서는 `isDuckDB` 등 `getConnectionConfig`를 거치는 호출 지점이 403을 받을 수 있다. 새 베타 DB에는 그런 행이 없다.
- 이 제한은 애플리케이션 계층이다. 사설 IP 송신 차단은 `deploy/` compose와 호스트 방화벽에서 따로 구현하고 증빙해야 한다(미실행).
- `AI_API_BASE_URL`·웹훅 URL은 사용자 입력이 아니라 환경 변수이므로 이 단위에 포함하지 않았다.
- 실제 운영 VM에서 확인한 것이 아니다.
