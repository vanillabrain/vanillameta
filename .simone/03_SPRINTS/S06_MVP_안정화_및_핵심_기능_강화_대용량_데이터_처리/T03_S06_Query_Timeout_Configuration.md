---
task_id: T03_S06
sprint_sequence_id: S06
status: open
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
- [ ] 각 데이터베이스 유형별 기본 타임아웃 설정 구현
- [ ] Knex 연결 옵션에 타임아웃 설정 추가
- [ ] 타임아웃 에러 발생 시 사용자 친화적 메시지 반환
- [ ] 환경 변수로 타임아웃 값 설정 가능
- [ ] 타임아웃 관련 로깅 구현

## Subtasks
- [ ] 데이터베이스별 타임아웃 설정 연구 및 최적값 결정
- [ ] ConnectionService에 타임아웃 설정 로직 추가
- [ ] 타임아웃 에러 핸들링 구현
- [ ] 설정 가능한 타임아웃 환경 변수 추가
- [ ] 타임아웃 관련 문서화

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
*(This section is populated as work progresses on the task)*