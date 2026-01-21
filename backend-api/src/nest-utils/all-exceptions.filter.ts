import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError, TypeORMError } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BusinessException } from '../common/exceptions/business.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // 에러 메시지 상수
  private readonly ERROR_MESSAGES = {
    ko: {
      internal_server: '내부 서버 오류가 발생했습니다.',
      validation_failed: '입력 값 검증에 실패했습니다.',
      unauthorized: '인증이 필요합니다.',
      forbidden: '접근 권한이 없습니다.',
      not_found: '요청한 리소스를 찾을 수 없습니다.',
      database_query_failed: '데이터베이스 쿼리 실행에 실패했습니다.',
      database_connection_failed: '데이터베이스 연결에 실패했습니다.',
    },
    en: {
      internal_server: 'Internal server error occurred.',
      validation_failed: 'Input validation failed.',
      unauthorized: 'Authentication required.',
      forbidden: 'Access forbidden.',
      not_found: 'Resource not found.',
      database_query_failed: 'Database query execution failed.',
      database_connection_failed: 'Database connection failed.',
    },
  };

  private getErrorMessage(key: string, lang: string = 'ko'): string {
    const language = lang.toLowerCase().startsWith('en') ? 'en' : 'ko';
    return this.ERROR_MESSAGES[language][key] || this.ERROR_MESSAGES.ko[key];
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Correlation ID 생성 또는 기존 것 사용
    const correlationId = (request.headers['x-correlation-id'] as string) || uuidv4();

    // 언어 감지
    const acceptLanguage = request.headers['accept-language'] as string || 'ko';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = this.getErrorMessage('internal_server', acceptLanguage);
    let errorCode = 'INTERNAL_ERROR';
    let details = null;

    // 비즈니스 예외 처리 (BusinessException 포함)
    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      message = exceptionResponse.message || message;
      errorCode = exceptionResponse.error || errorCode;
    }
    // HTTP 예외 처리
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;

        // Validation 에러 처리 (class-validator)
        if (responseObj.message) {
          if (Array.isArray(responseObj.message)) {
            message = this.getErrorMessage('validation_failed', acceptLanguage);
            details = responseObj.message;
            errorCode = 'VALIDATION_ERROR';
          } else {
            message = responseObj.message;
          }
        }

        // 에러 코드가 있으면 사용
        if (responseObj.error) {
          errorCode = responseObj.error.toUpperCase().replace(/\s+/g, '_');
        }
      }
    }
    // TypeORM 에러 처리
    else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      message = this.getErrorMessage('database_query_failed', acceptLanguage);
      errorCode = 'DATABASE_ERROR';

      // 개발 환경에서만 상세 에러 노출
      if (process.env.NODE_ENV !== 'production') {
        details = {
          query: (exception as any).query,
          parameters: (exception as any).parameters,
          databaseError: exception.message,
        };
      }
    } else if (exception instanceof EntityNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      message = this.getErrorMessage('not_found', acceptLanguage);
      errorCode = 'ENTITY_NOT_FOUND';
    } else if (exception instanceof TypeORMError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = this.getErrorMessage('database_connection_failed', acceptLanguage);
      errorCode = 'DATABASE_ERROR';
    }
    // 일반 에러 처리
    else if (exception instanceof Error) {
      message = exception.message || message;

      // 특정 에러 메시지에 따른 상태 코드 매핑
      if (message.toLowerCase().includes('unauthorized')) {
        status = HttpStatus.UNAUTHORIZED;
        errorCode = 'UNAUTHORIZED';
        message = this.getErrorMessage('unauthorized', acceptLanguage);
      } else if (message.toLowerCase().includes('forbidden')) {
        status = HttpStatus.FORBIDDEN;
        errorCode = 'FORBIDDEN';
        message = this.getErrorMessage('forbidden', acceptLanguage);
      } else if (message.toLowerCase().includes('not found')) {
        status = HttpStatus.NOT_FOUND;
        errorCode = 'NOT_FOUND';
        message = this.getErrorMessage('not_found', acceptLanguage);
      }
    }

    // 에러 로그 기록
    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} - ${status} ${errorCode}: ${message}`,
      exception instanceof Error ? exception.stack : 'No stack trace available',
    );

    // 표준화된 에러 응답
    const errorResponse = {
      success: false,
      code: status,
      errorCode,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // 개발 환경에서만 추가 정보 포함
    if (process.env.NODE_ENV !== 'production') {
      (errorResponse as any).details = details;

      // 스택 트레이스 추가 (Error 인스턴스인 경우만)
      if (exception instanceof Error && exception.stack) {
        (errorResponse as any).stack = exception.stack.split('\n');
      }
    }

    response.status(status).json(errorResponse);
  }
}
