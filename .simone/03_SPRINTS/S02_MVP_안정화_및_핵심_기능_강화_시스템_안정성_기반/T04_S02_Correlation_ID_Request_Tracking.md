---
task_id: T04_S02
sprint_sequence_id: S02
status: open
complexity: Low
last_updated: 2025-06-12T15:00:00Z
---

# Task: Correlation ID를 통한 요청 추적 구현

## Description
현재 시스템에서는 하나의 요청이 여러 서비스를 거치며 생성하는 로그들을 연결하기 어렵습니다. 이 태스크는 각 요청에 고유한 Correlation ID를 부여하여 전체 요청 흐름을 추적할 수 있는 시스템을 구축합니다.

## Goal / Objectives
- 모든 HTTP 요청에 고유한 Correlation ID 부여
- 요청 관련 모든 로그에 Correlation ID 포함
- 프론트엔드-백엔드 간 ID 전파
- CloudWatch에서 요청 전체 흐름 추적 가능

## Acceptance Criteria
- [ ] 모든 요청에 자동으로 Correlation ID 생성/할당
- [ ] 로그에 Correlation ID가 포함됨
- [ ] API 응답 헤더에 Correlation ID 반환
- [ ] 프론트엔드에서 생성한 ID 수용 가능
- [ ] 에러 응답에도 Correlation ID 포함

## Subtasks
- [ ] Correlation ID 미들웨어 생성
- [ ] 요청 컨텍스트 저장 메커니즘 구현
- [ ] 로거 서비스에 Correlation ID 통합
- [ ] HTTP 응답 헤더에 ID 추가
- [ ] 프론트엔드 API 클라이언트 수정
- [ ] 테스트 및 문서화

## Technical Guidance

### Key interfaces and integration points in the codebase
- `src/middleware/` - 미들웨어 추가 위치
- `src/main.ts` - 글로벌 미들웨어 등록
- `src/helpers/api.js` (프론트엔드) - 요청 헤더 추가
- 로거 서비스와의 통합 필요

### Specific imports and module references
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
```

### Existing patterns to follow
- 기존 미들웨어 구현 패턴 (userLoggerMiddleware 참고)
- Request 객체 확장 패턴
- 미들웨어 등록 방식

### Database models or API contracts to work with
- HTTP 헤더: `X-Correlation-ID`
- 로그 구조에 correlationId 필드 추가

### Error handling approach used in similar code
- 미들웨어에서 next() 호출 패턴
- 에러 발생 시에도 ID 유지

## Implementation Notes

### Step-by-step implementation approach
1. Correlation ID 생성 미들웨어 구현
2. Request 객체에 ID 저장 (타입 확장)
3. 로거 서비스에서 자동으로 ID 포함
4. 응답 헤더에 ID 추가
5. 프론트엔드 axios 인터셉터 수정
6. 전체 플로우 테스트

### Key architectural decisions to respect
- UUID v4 사용 (충돌 가능성 최소화)
- 헤더 이름은 업계 표준 준수
- 성능 오버헤드 최소화

### Testing approach based on existing test patterns
- 미들웨어 단위 테스트
- E2E 테스트로 전체 흐름 검증
- 로그 출력 검증

### Performance considerations if relevant
- UUID 생성은 요청당 1회만
- 메모리 누수 방지 (요청 컨텍스트 정리)

## Output Log
*(This section is populated as work progresses on the task)*