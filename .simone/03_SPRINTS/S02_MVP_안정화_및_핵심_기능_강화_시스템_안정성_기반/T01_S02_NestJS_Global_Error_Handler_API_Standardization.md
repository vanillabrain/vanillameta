---
task_id: T01_S02
sprint_sequence_id: S02
status: open
complexity: Medium
last_updated: 2025-06-15T12:00:00Z
---

# Task: NestJS 전역 에러 핸들러 및 API 에러 표준화

## Description
현재 부분적으로 구현된 HttpExceptionFilter를 확장하여 모든 유형의 에러를 처리할 수 있는 전역 에러 핸들링 시스템을 구축합니다. API 응답 형식을 표준화하여 클라이언트가 일관된 방식으로 에러를 처리할 수 있도록 합니다.

## Goal / Objectives
- 모든 예외 타입을 처리하는 전역 예외 필터 구현
- 표준화된 에러 응답 형식 정의 및 적용
- 에러 타입별 적절한 HTTP 상태 코드 매핑
- 환경별 에러 상세 정보 노출 수준 제어

## Acceptance Criteria
- [ ] HTTP 예외뿐만 아니라 일반 예외도 처리 가능
- [ ] 모든 API 에러가 일관된 JSON 형식으로 응답
- [ ] Correlation ID가 모든 에러 응답에 포함
- [ ] 개발 환경에서는 상세 스택 트레이스 포함
- [ ] 프로덕션 환경에서는 민감한 정보 제외
- [ ] 비즈니스 로직 에러와 시스템 에러 구분

## Subtasks
- [ ] AllExceptionsFilter 클래스 생성 및 구현
- [ ] 표준 에러 응답 DTO 정의
- [ ] 커스텀 비즈니스 예외 클래스 생성
- [ ] main.ts에 전역 필터 등록
- [ ] 에러 타입별 상태 코드 매핑 로직 구현
- [ ] 환경별 에러 상세 정보 필터링
- [ ] 기존 컨트롤러들의 에러 처리 패턴 통일
- [ ] 에러 처리 관련 단위 테스트 작성

## Technical Guidance

### Key interfaces and integration points in the codebase
- **기존 HttpExceptionFilter**: `src/nest-utils/http-exception.filter.ts`
  - 이미 HttpException 처리 및 Correlation ID 통합 구현됨
  - 이를 확장하여 모든 예외 타입 처리 필요

- **Correlation ID Service**: `src/middleware/correlation-id/correlation-id.service.ts`
  - 정적 메서드로 correlation ID 관리
  - AsyncLocalStorage 기반 구현

- **Logger Service**: `src/common/logger/logger.service.ts`
  - Winston 기반 구조화된 JSON 로깅
  - 에러 로깅 시 활용 필요

### Specific imports and module references
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CorrelationIdService } from '../middleware/correlation-id/correlation-id.service';
import { CustomLoggerService } from '../common/logger/logger.service';
```

### Existing patterns to follow
- 응답 형식: `{ success: boolean, code: number, data: any, correlationId: string }`
- 환경 변수 기반 설정: `process.env.NODE_ENV`
- 모듈별 providers 등록 패턴

### Database models or API contracts to work with
- 에러 응답 형식이 프론트엔드 API 헬퍼와 호환되어야 함
- axios 인터셉터가 `success: false` 응답을 처리

### Error handling approach used in similar code
- 현재는 컨트롤러 레벨에서 try-catch로 개별 처리
- 일부 서비스에서 throw new HttpException() 사용
- 통일된 패턴 부재

## Implementation Notes

### Step-by-step implementation approach
1. `src/nest-utils/all-exceptions.filter.ts` 생성
2. 기존 HttpExceptionFilter 로직을 통합하여 확장
3. 일반 Error, ValidationError 등 다양한 예외 타입 처리
4. 환경별 에러 상세 정보 필터링 로직 구현
5. `src/common/dto/error-response.dto.ts`로 표준 응답 형식 정의
6. `src/common/exceptions/` 디렉토리에 비즈니스 예외 클래스 생성
7. `app.module.ts`에 전역 필터 provider 등록
8. 주요 컨트롤러들의 에러 처리 코드 리팩토링

### Key architectural decisions to respect
- NestJS의 의존성 주입 패턴 준수
- 전역 필터는 APP_FILTER 토큰으로 등록
- 기존 Correlation ID 통합 유지

### Testing approach based on existing test patterns
- `*.spec.ts` 파일로 단위 테스트 작성
- `@nestjs/testing`의 TestingModule 사용
- 다양한 예외 시나리오 테스트 케이스 작성

### Performance considerations if relevant
- 에러 발생 시 로깅 오버헤드 최소화
- 스택 트레이스 문자열 처리 최적화
- 순환 참조 방지를 위한 안전한 객체 직렬화

## Output Log
*(This section is populated as work progresses on the task)*

[YYYY-MM-DD HH:MM:SS] Started task
[YYYY-MM-DD HH:MM:SS] Modified files: file1.js, file2.js
[YYYY-MM-DD HH:MM:SS] Completed subtask: Implemented feature X
[YYYY-MM-DD HH:MM:SS] Task completed