import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    if (status >= 500 && process.env.SENTRY_DSN) {
      void import('@sentry/nestjs').then(Sentry => Sentry.captureException(exception));
    }
    const err = exception.getResponse() as
      string | { error: string; statusCode: 400; message: string[] };
    // let msg = '';
    if (typeof err !== 'string' && err.error === 'Bad Request') {
      return response.status(status).json({
        success: false,
        code: status,
        data: err.message,
      });
    }

    response.status(status).json({
      success: false,
      code: status,
      data: err,
    });
  }
}
