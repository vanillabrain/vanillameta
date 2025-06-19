import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response, Request } from 'express';
import { CorrelationIdService } from '../middleware/correlation-id/correlation-id.service';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const err = exception.getResponse() as
      | string
      | { error: string; statusCode: 400; message: string[] };

    // 현재 요청의 correlation ID 가져오기
    const correlationId = CorrelationIdService.getCorrelationId() || (request as any).correlationId;

    // 응답 헤더에 correlation ID 설정 (미들웨어에서 설정하지 못한 경우를 대비)
    if (correlationId) {
      response.setHeader('X-Correlation-ID', correlationId);
    }

    // let msg = '';
    if (typeof err !== 'string' && err.error === 'Bad Request') {
      return response.status(status).json({
        success: false,
        code: status,
        data: err.message,
        correlationId, // 에러 응답에 correlation ID 포함
      });
    }

    response.status(status).json({
      success: false,
      code: status,
      data: err,
      correlationId, // 에러 응답에 correlation ID 포함
    });
  }
}
