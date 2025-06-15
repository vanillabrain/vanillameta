import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 비즈니스 로직 예외 기본 클래스
 */
export class BusinessException extends HttpException {
  constructor(
    message: string,
    errorCode: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        message,
        error: errorCode,
      },
      statusCode,
    );
  }
}

/**
 * 엔티티를 찾을 수 없을 때 발생하는 예외
 */
export class EntityNotFoundException extends BusinessException {
  constructor(entity: string, id?: string | number) {
    const message = id
      ? `${entity} with id ${id} not found`
      : `${entity} not found`;
    super(message, 'ENTITY_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}

/**
 * 중복된 데이터가 있을 때 발생하는 예외
 */
export class DuplicateException extends BusinessException {
  constructor(entity: string, field: string, value: string) {
    super(
      `${entity} with ${field} '${value}' already exists`,
      'DUPLICATE_ENTITY',
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * 권한이 없을 때 발생하는 예외
 */
export class UnauthorizedException extends BusinessException {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
  }
}

/**
 * 접근이 금지된 리소스에 접근할 때 발생하는 예외
 */
export class ForbiddenException extends BusinessException {
  constructor(resource: string) {
    super(
      `Access to ${resource} is forbidden`,
      'FORBIDDEN',
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * 데이터 유효성 검증 실패 예외
 */
export class ValidationException extends BusinessException {
  constructor(errors: any[]) {
    super('Validation failed', 'VALIDATION_ERROR', HttpStatus.BAD_REQUEST);
  }
}

/**
 * 데이터베이스 연결 실패 예외
 */
export class DatabaseConnectionException extends BusinessException {
  constructor(databaseName: string) {
    super(
      `Failed to connect to database: ${databaseName}`,
      'DATABASE_CONNECTION_ERROR',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * 쿼리 실행 실패 예외
 */
export class QueryExecutionException extends BusinessException {
  constructor(message: string) {
    super(
      `Query execution failed: ${message}`,
      'QUERY_EXECUTION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * 외부 서비스 호출 실패 예외
 */
export class ExternalServiceException extends BusinessException {
  constructor(serviceName: string, message: string) {
    super(
      `External service ${serviceName} failed: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * 파일 처리 관련 예외
 */
export class FileProcessingException extends BusinessException {
  constructor(message: string) {
    super(
      `File processing failed: ${message}`,
      'FILE_PROCESSING_ERROR',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * 토큰 관련 예외
 */
export class TokenException extends BusinessException {
  constructor(message: string = 'Invalid or expired token') {
    super(message, 'TOKEN_ERROR', HttpStatus.UNAUTHORIZED);
  }
}

/**
 * 비즈니스 로직 제약 조건 위반 예외
 */
export class BusinessRuleException extends BusinessException {
  constructor(rule: string) {
    super(
      `Business rule violated: ${rule}`,
      'BUSINESS_RULE_VIOLATION',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}