# 외부 베타 M0 — 소스 유형 제한(SSRF 차단) 증빙

2026-10-23 · Draft / PASS_SELECTED. [계획](../plans/external-beta-launch.md) M0 3번.

## 문제

사용자가 데이터 소스의 `engine`과 `connectionConfig.host/port`를 정하면 서버가 그 호스트로 소켓을 연다(MySQL·PG·MSSQL·Oracle은 knex, ClickHouse·Trino·Databricks는 `fetch`). 공유 VM에서는 내부망과 클라우드 메타데이터 서비스(`169.254.169.254`)에 닿는다. 연결 테스트(`POST /database/test`)는 저장 없이 즉시 소켓을 연다.

## 해결

`backend-api/src/connection/source-type-policy.ts`.

- `NODE_ENV=prod`에서 `ALLOWED_SOURCE_TYPES`가 비어 있으면 `file,sample`만 허용한다. 다른 환경은 변수를 지정하지 않으면 제한이 없다(기존 개발 흐름 유지).
- 항목은 `file`(duckdb), `sample`(sqlite·sqlite3·better-sqlite3), 엔진 이름(예: `pg`), `*`(제한 해제)다. 엔진은 대소문자·공백을 무시한다.
- 적용 지점: `DatabaseService.webConfig`(생성·수정), `ConnectionService.testConnection`·`testDatabase`(연결 테스트는 로컬 파일 엔진도 거부: 사용자가 서버 경로를 `filename`으로 줄 수 있다), `getConnectionConfig`. 마지막은 knex 생성과 ClickHouse·Trino·Databricks 실행이 모두 거치는 곳이라, 제한 이전에 저장된 네트워크 소스도 쿼리·소켓 열기 전에 막는다.

## 검증 (로컬, Node 26)

| 검사 | 결과 |
| --- | --- |
| `src/connection` 전체 + `database.service.spec.ts` (신규 `source-type-policy.spec.ts` 6, `source-type-restriction.spec.ts` 14) | 9 suites, 92 tests PASS |
| prod 기본값에서 mysql2·pg·mssql·oracledb·clickhouse·trino·databricks 연결 테스트 | 403, `fetch` 미호출 |
| prod에서 네트워크 소스 생성, duckdb·sqlite·sqlite3 `filename` 연결 테스트 | 403 |
| 제한 이전에 저장된 clickhouse 소스의 `getKnex`·쿼리 실행 | 403, `fetch` 미호출 |
| 저장된 업로드(duckdb) 소스 | 설정 조회 성공 |
| `ALLOWED_SOURCE_TYPES=file,sample,clickhouse` | clickhouse 연결 테스트가 다시 `fetch`를 호출 |
| eslint(변경 파일 에러 0, 기존 경고 5), `tsc --noEmit` | PASS |

## 한계

- 이 제한은 애플리케이션 계층이다. 사설 IP 송신 차단은 `deploy/` compose와 호스트 방화벽에서 따로 구현하고 증빙해야 한다(미실행).
- `AI_API_BASE_URL`·웹훅 URL은 사용자 입력이 아니라 환경 변수이므로 이 단위에 포함하지 않았다.
- 실제 운영 VM에서 확인한 것이 아니다.
