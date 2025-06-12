---
task_id: T01_S01
sprint_sequence_id: S01
status: open
complexity: Medium
last_updated: 2025-06-12T09:00:00Z
---

# Task: T01_S01_Add_Missing_Test_Config_Files

## Description
QTT-001 테스트 스위트가 실패하고 있는 문제를 해결합니다. 현재 `test-connect-info.json` 파일이 누락되어 있어 외부 데이터베이스 연결 테스트를 실행할 수 없습니다. 이 파일은 다양한 데이터베이스 엔진(MySQL, PostgreSQL, Oracle, BigQuery, Snowflake 등)에 대한 테스트 연결 정보를 포함해야 합니다.

VanillaMeta 백엔드 API는 10개의 서로 다른 데이터베이스 엔진을 지원하므로, 각 엔진별로 적절한 테스트 연결 설정이 필요합니다.

## Goal / Objectives
QTT-001 테스트가 성공적으로 실행될 수 있도록 누락된 테스트 설정 파일을 생성하고 구성합니다.

- 누락된 `test-connect-info.json` 파일 생성
- 10개 데이터베이스 엔진별 연결 설정 구조 정의
- ConnectionService.testConnection() 메서드와 호환되는 설정 형식 사용
- 테스트 실행 가능한 상태로 복구

## Acceptance Criteria
다음 조건들이 모두 충족되어야 작업이 완료된 것으로 간주됩니다:

- [ ] `/workspace/vanillameta/backend-api/test-connect-info.json` 파일이 생성됨
- [ ] 파일이 10개 데이터베이스 엔진의 연결 설정을 포함함 (mysql, maria, pg, oracle, cockroach, redshift, bigquery, sqlite, mssql, snowflake)
- [ ] 각 데이터베이스 설정이 ConnectionService.testConnection() 메서드와 호환됨
- [ ] QTT-001 테스트가 컴파일 오류 없이 실행됨 (연결 실패는 허용, 파일 누락 오류는 불허용)
- [ ] 모든 데이터베이스 엔진별 연결 설정 구조가 CreateDatabaseDto 형식을 따름

## Subtasks
작업을 완료하기 위한 세부 단계들:

- [ ] QTT-001-01.spec.ts 파일 분석하여 test-connect-info.json 사용 패턴 파악
- [ ] ConnectionService.testConnection() 메서드 분석하여 필요한 연결 설정 형식 확인
- [ ] CreateDatabaseDto 구조 분석하여 각 데이터베이스별 필수 필드 파악
- [ ] 10개 데이터베이스 엔진별 연결 설정 구조 설계
- [ ] test-connect-info.json 파일 생성 및 각 엔진별 설정 구현
- [ ] QTT-001 테스트 실행하여 파일 로딩 및 구조 검증
- [ ] 필요시 추가 테스트 설정 파일들 확인 및 생성

## Technical Guidance

### 파일 위치
- 생성할 파일: `/workspace/vanillameta/backend-api/test-connect-info.json`
- 참조 파일: `/workspace/vanillameta/backend-api/test/QTT-001/QTT-001-01.spec.ts` (line 10)

### 코드베이스 분석 결과

#### 1. 테스트에서 사용되는 데이터베이스 엔진들:
```javascript
const dbName = [
  ['QTT-001-01', 'mysql'],
  ['QTT-001-02', 'maria'],
  ['QTT-001-03', 'pg'],
  ['QTT-001-04', 'oracle'],
  ['QTT-001-05', 'cockroach'],
  ['QTT-001-06', 'redshift'],
  ['QTT-001-07', 'bigquery'],
  ['QTT-001-08', 'sqlite'],
  ['QTT-001-09', 'mssql'],
  ['QTT-001-10', 'snowflake'],
];
```

#### 2. CreateDatabaseDto 구조 (필수 필드들):
```typescript
{
  name: string;           // 데이터베이스 이름
  description?: string;   // 상세 설명 (선택)
  connectionConfig: any;  // 연결 설정 객체
  engine: string;         // 데이터베이스 엔진
  type?: string;          // 데이터베이스 구분 (선택)
  timezone?: string;      // 타임존 (선택)
}
```

#### 3. ConnectionService에서 특별 처리되는 엔진들:
- `bigquery`: BigQueryClient로 변환
- `snowflake`: SnowflakeDialect로 변환
- `cockroachdb`: 특별한 연결 문자열 형식 필요

#### 4. 각 데이터베이스별 connectionConfig 필드 구조:

**표준 관계형 DB (mysql, maria, pg, mssql, oracle):**
```json
{
  "host": "hostname",
  "port": number,
  "user": "username", 
  "password": "password",
  "database": "database_name"
}
```

**SQLite:**
```json
{
  "filename": ":memory:" // 또는 파일 경로
}
```

**BigQuery:**
```json
{
  "projectId": "project_id",
  "keyFilename": "path_to_key_file"
}
```

**Snowflake:**
```json
{
  "account": "account_identifier",
  "username": "username",
  "password": "password", 
  "database": "database_name",
  "warehouse": "warehouse_name"
}
```

**CockroachDB:**
```json
{
  "host": "hostname",
  "port": number,
  "user": "username",
  "password": "password", 
  "database": "database_name"
}
```

### Implementation Notes

1. **Mock/Dummy 데이터 사용**: 실제 데이터베이스에 연결할 필요는 없으므로, 각 엔진별로 형식에 맞는 더미 연결 정보를 사용

2. **테스트 목적**: 연결 성공보다는 설정 형식이 올바른지, ConnectionService가 각 엔진을 인식하는지가 중요

3. **보안 고려사항**: 실제 자격 증명 대신 플레이스홀더 값 사용

4. **JSON 구조**: 최상위 레벨에서 각 엔진명을 키로 하는 객체 구조

## Output Log
*(이 섹션은 작업 진행 시 업데이트됩니다)*

[2025-06-12 09:00:00] Task 생성됨