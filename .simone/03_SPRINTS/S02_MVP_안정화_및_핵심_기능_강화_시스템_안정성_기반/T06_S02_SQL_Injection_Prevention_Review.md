---
task_id: T06_S02
sprint_sequence_id: S02
status: open
complexity: Medium
last_updated: 2025-06-12T15:00:00Z
---

# Task: SQL 인젝션 방지 로직 검토 및 강화

## Description
VanillaMeta는 사용자가 직접 SQL을 작성하여 다양한 데이터베이스에 쿼리를 실행하는 시스템입니다. 현재 Knex.js를 사용하여 기본적인 보호를 제공하지만, 사용자 입력 SQL에 대한 추가적인 검증과 보안 강화가 필요합니다.

## Goal / Objectives
- 사용자 입력 SQL의 안전성 검증 강화
- 위험한 SQL 패턴 탐지 및 차단
- 파라미터화된 쿼리 사용 확대
- 데이터베이스별 보안 모범 사례 적용

## Acceptance Criteria
- [ ] SQL 인젝션 패턴 검증 로직 구현
- [ ] 위험한 SQL 명령어 화이트리스트/블랙리스트 적용
- [ ] 모든 동적 쿼리가 파라미터화됨
- [ ] SQL 검증 실패 시 명확한 에러 메시지 제공
- [ ] 보안 감사 로그 구현

## Subtasks
- [ ] 현재 SQL 실행 로직 보안 감사
- [ ] SQL 패턴 검증 서비스 구현
- [ ] 위험 명령어 필터링 시스템 구축
- [ ] 파라미터 바인딩 강화
- [ ] 데이터베이스별 보안 설정 적용
- [ ] 보안 테스트 케이스 작성

## Technical Guidance

### Key interfaces and integration points in the codebase
- `src/connection/connection.service.ts` - Knex 연결 관리
- `src/database/database.service.ts` - 쿼리 실행 로직
- `src/dataset/dataset.service.ts` - 사용자 SQL 저장
- `src/widget/table-query/table-query.service.ts` - 테이블 쿼리

### Specific imports and module references
```typescript
import * as knex from 'knex';
import { Injectable } from '@nestjs/common';
```

### Existing patterns to follow
- Knex.js 쿼리 빌더 사용
- DTO 검증 패턴 (class-validator)
- 서비스 계층에서 검증 수행

### Database models or API contracts to work with
- `dataset.entity.ts` - SQL 쿼리 저장
- `query-execute.dto.ts` - 쿼리 실행 DTO
- 다중 데이터베이스 타입 지원 필요

### Error handling approach used in similar code
- 서비스에서 예외 throw
- 컨트롤러에서 HTTP 예외로 변환

## Implementation Notes

### Step-by-step implementation approach
1. SQL 검증 유틸리티 클래스 생성
2. 위험 패턴 정규식 및 규칙 정의
3. 쿼리 실행 전 검증 미들웨어 추가
4. 파라미터 바인딩 헬퍼 함수 구현
5. 각 데이터베이스 타입별 보안 설정
6. 포괄적인 보안 테스트 작성

### Key architectural decisions to respect
- 사용자의 정당한 쿼리는 차단하지 않음
- 성능 영향 최소화
- 명확한 에러 메시지로 UX 유지

### Testing approach based on existing test patterns
- 알려진 SQL 인젝션 패턴 테스트
- 정상 쿼리 통과 확인
- 각 데이터베이스별 테스트

### Performance considerations if relevant
- 정규식 검증의 성능 최적화
- 캐싱 가능한 검증 결과는 캐싱

## Output Log
*(This section is populated as work progresses on the task)*