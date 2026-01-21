---
task_id: T01_S02
sprint_sequence_id: S02
status: open
complexity: Medium
last_updated: 2025-06-22T12:00:00Z
---

# Task: NestJS 전역 에러 핸들러 및 API 에러 표준화

## Description
NestJS 애플리케이션의 전역 에러 처리 시스템을 개선하고 모든 API 응답에 대한 에러 형식을 표준화합니다. 기존 AllExceptionsFilter를 확장하여 더 포괄적인 에러 처리와 일관된 응답 형식을 제공합니다.

## Goal / Objectives
- 모든 예외를 포착하는 전역 에러 핸들러 구현
- 표준화된 에러 응답 형식 정의 및 적용
- 에러 코드 체계 확립
- 적절한 HTTP 상태 코드 매핑
- 다국어 에러 메시지 지원 강화

## Acceptance Criteria
- [ ] 모든 API 에러가 표준화된 JSON 형식으로 응답
- [ ] Correlation ID가 모든 에러 응답에 포함
- [ ] 에러 코드가 체계적으로 정의되고 문서화됨
- [ ] 개발/운영 환경에 따른 에러 상세 정보 노출 제어
- [ ] i18n을 통한 다국어 에러 메시지 지원
- [ ] 에러 핸들러에 대한 단위 테스트 작성 완료

## Subtasks
- [ ] 기존 AllExceptionsFilter 분석 및 개선점 도출
- [ ] 표준 에러 응답 인터페이스 정의
- [ ] 에러 코드 체계 및 열거형 정의
- [ ] BusinessException 클래스 확장
- [ ] 데이터베이스 관련 에러 처리 강화
- [ ] 인증/인가 에러 처리 개선
- [ ] Validation 에러 메시지 포맷팅 개선
- [ ] 에러 로깅 메커니즘 강화
- [ ] 단위 테스트 및 통합 테스트 작성

## Technical Guide

### Key Interfaces and Integration Points
- `/backend-api/src/nest-utils/all-exceptions.filter.ts` - 기존 전역 예외 필터
- `/backend-api/src/common/exceptions/business.exception.ts` - 비즈니스 예외 클래스
- `/backend-api/src/main.ts` - 애플리케이션 부트스트랩 (필터 등록)
- `nestjs-i18n` - 다국어 지원 라이브러리

### Existing Patterns to Follow
- NestJS ExceptionFilter 인터페이스 구현 패턴
- i18n 서비스를 통한 다국어 메시지 처리
- Correlation ID 헤더 처리 (x-correlation-id)
- 환경 변수를 통한 개발/운영 환경 구분

### Error Handling Approach
- TypeORM 에러 (QueryFailedError, EntityNotFoundError) 처리
- HTTP 예외 처리 (HttpException 및 하위 클래스)
- 비즈니스 로직 예외 처리 (BusinessException)
- 일반 JavaScript 에러 처리

## Implementation Notes

### Step-by-Step Implementation Approach
1. 에러 응답 표준 인터페이스 정의 (IErrorResponse)
2. 에러 코드 열거형 생성 (ErrorCode enum)
3. AllExceptionsFilter 리팩토링
4. BusinessException 클래스 개선
5. 에러 메시지 다국어 파일 업데이트
6. 각 모듈의 에러 처리 통합
7. 테스트 코드 작성

### Architecture Decisions to Respect
- Serverless 환경을 고려한 stateless 에러 처리
- 로깅은 CloudWatch와 통합
- 성능을 위해 에러 처리 로직은 최소화

### Testing Approach
- 각 에러 타입별 단위 테스트
- E2E 테스트를 통한 실제 API 에러 응답 검증
- 다국어 에러 메시지 테스트
- 개발/운영 환경별 응답 차이 테스트

## Output Log
*(This section is populated as work progresses on the task)*