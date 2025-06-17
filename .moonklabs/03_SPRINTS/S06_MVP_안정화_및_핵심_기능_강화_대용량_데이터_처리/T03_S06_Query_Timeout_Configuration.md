---
task_id: T03_S06
sprint_sequence_id: S06
status: completed
complexity: Low
last_updated: 2025-06-14T19:00:00Z
---

# Task: 쿼리 타임아웃 설정 및 관리

## Description
데이터베이스별로 적절한 쿼리 타임아웃을 설정하여 장시간 실행되는 쿼리로 인한 시스템 블로킹을 방지합니다. 현재는 타임아웃 설정이 없어 무한정 대기하거나 Lambda 타임아웃에 의해 강제 종료되는 문제가 있습니다.

## Goal / Objectives
- 데이터베이스 유형별 적절한 타임아웃 설정
- 타임아웃 발생 시 명확한 에러 메시지 제공
- 관리자가 타임아웃 값을 조정할 수 있는 구조 구현

## Acceptance Criteria
- [x] 각 데이터베이스 유형별 기본 타임아웃 설정 구현
- [x] Knex 연결 옵션에 타임아웃 설정 추가
- [x] 타임아웃 에러 발생 시 사용자 친화적 메시지 반환
- [x] 환경 변수로 타임아웃 값 설정 가능
- [x] 타임아웃 관련 로깅 구현

## Subtasks
- [x] 데이터베이스별 타임아웃 설정 연구 및 최적값 결정
- [x] ConnectionService에 타임아웃 설정 로직 추가
- [x] 타임아웃 에러 핸들링 구현
- [x] 설정 가능한 타임아웃 환경 변수 추가
- [x] 타임아웃 관련 문서화

## Technical Guidance

### Key Interfaces and Integration Points
- `src/connection/connection.service.ts` - Knex 연결 관리
- `src/connection/database-optimizers/` - DB별 최적화 클래스
- `src/common/nest-utils/http-exception.filter.ts` - 에러 처리
- `src/database/database.service.ts` - DB 연결 설정

### Specific Imports and Module References
```typescript
// Knex configuration
import { Knex } from 'knex';
// Database specific timeouts
import { Client as PgClient } from 'pg';
import { createConnection as createMySQLConnection } from 'mysql2';
// Error handling
import { HttpException } from '@nestjs/common';
```

### Existing Patterns to Follow
- database-optimizers 디렉토리의 DB별 최적화 패턴
- ConnectionService의 getKnexConfig() 메서드 구조
- 환경 변수는 ConfigService를 통해 접근

### Database Models and API Contracts
- Database 엔티티의 connection_options 필드 활용
- 타임아웃 설정을 connection_options JSON에 포함

## Implementation Notes

### Step-by-Step Implementation Approach
1. 각 데이터베이스 optimizer 클래스에 타임아웃 설정 추가
2. Knex 설정 객체에 pool 및 쿼리 타임아웃 옵션 추가
3. 타임아웃 에러 감지 및 커스텀 에러 생성
4. 환경 변수 정의 및 ConfigService 통합
5. 타임아웃 발생 시 로깅 추가

### Key Architectural Decisions
- 기본 타임아웃: 25초 (Lambda 30초 한계 고려)
- DB별 권장 타임아웃: PostgreSQL(25s), MySQL(20s), BigQuery(60s)
- statement_timeout, query_timeout 등 DB별 특화 설정 활용

### Testing Approach
- 단위 테스트: 타임아웃 설정 값 검증
- 통합 테스트: 실제 장시간 쿼리로 타임아웃 동작 확인
- 각 지원 DB에 대한 타임아웃 테스트

### Performance Considerations
- 타임아웃이 너무 짧으면 정상 쿼리도 실패
- 타임아웃이 너무 길면 시스템 응답성 저하
- 쿼리 복잡도에 따른 동적 타임아웃 고려

## Output Log

### 구현 완료 사항 (2025-06-14)

#### 1. 데이터베이스별 타임아웃 설정 구현
- **MySQL**: `max_execution_time` 설정으로 쿼리 타임아웃 적용 (기본값: 25초)
- **PostgreSQL**: `statement_timeout` 설정으로 명령문 타임아웃 적용 (기본값: 25초/60초)
- **Oracle**: `ddl_lock_timeout` 설정으로 DDL 잠금 타임아웃 적용
- **SQL Server**: `LOCK_TIMEOUT` 설정으로 잠금 타임아웃 적용
- **BigQuery**: 기존 5분 타임아웃 유지 (클라우드 웨어하우스 특성)
- **Snowflake**: 기존 5분 타임아웃 유지 (클라우드 웨어하우스 특성)

#### 2. 타임아웃 에러 감지 및 사용자 친화적 메시지 제공
- `ConnectionService.detectTimeoutError()` 메서드 구현
- 데이터베이스별 타임아웃 에러 코드 및 메시지 패턴 감지
- 한국어 사용자 친화적 에러 메시지 제공
- 스트리밍 쿼리에서도 동일한 타임아웃 처리 적용

#### 3. 환경 변수 기반 타임아웃 설정
- 데이터베이스별 환경 변수 지원: `MYSQL_QUERY_TIMEOUT`, `POSTGRESQL_QUERY_TIMEOUT` 등
- 일반 환경 변수 지원: `DB_QUERY_TIMEOUT`, `DB_CONNECT_TIMEOUT` 등
- 우선순위: 데이터베이스별 > 일반 > 기본값

#### 4. Lambda 환경 고려사항
- 프로덕션 환경에서 25초 기본 타임아웃 (Lambda 30초 제한 고려)
- 개발 환경에서 60초 타임아웃으로 설정
- 클라우드 데이터베이스(BigQuery, Snowflake)는 5분 타임아웃 유지

### 환경 변수 예시
```bash
# 전체 데이터베이스 공통 설정
DB_QUERY_TIMEOUT=30000         # 30초
DB_CONNECT_TIMEOUT=10000       # 10초
DB_SOCKET_TIMEOUT=60000        # 60초

# 데이터베이스별 개별 설정 (우선 적용)
MYSQL_QUERY_TIMEOUT=25000      # MySQL 25초
POSTGRESQL_QUERY_TIMEOUT=30000 # PostgreSQL 30초
ORACLE_QUERY_TIMEOUT=25000     # Oracle 25초
SQLSERVER_QUERY_TIMEOUT=30000  # SQL Server 30초
```

### 타임아웃 에러 메시지 예시
- **MySQL**: "쿼리 실행 시간이 25초를 초과하여 중단되었습니다. 쿼리를 최적화하거나 필터 조건을 추가해 주세요."
- **PostgreSQL**: "쿼리 실행 시간이 허용된 시간을 초과했습니다. 더 구체적인 조건으로 데이터를 필터링해 주세요."
- **일반 타임아웃**: "쿼리 실행 시간이 허용 시간을 초과했습니다. 쿼리를 단순화하거나 데이터 범위를 제한해 주세요."

### 기술적 개선사항
- 각 데이터베이스 optimizer에서 환경 변수 기반 타임아웃 설정 지원
- ConnectionService에서 실행 시간 기반 타임아웃 감지 로직 추가
- 스트리밍 쿼리와 일반 쿼리 모두에서 일관된 타임아웃 처리