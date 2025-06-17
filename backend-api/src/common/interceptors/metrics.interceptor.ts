import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IntegratedMetricsService } from '../monitoring/integrated-metrics.service';
import { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly metricsService: IntegratedMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    
    const startTime = Date.now();
    const method = request.method;
    const path = request.route?.path || request.path;
    const userId = (request as any).user?.id;

    // Lambda 콜드 스타트 확인
    const isColdStart = !(global as any).lambdaWarmUp;
    if (isColdStart) {
      (global as any).lambdaWarmUp = true;
    }

    return next.handle().pipe(
      tap(async () => {
        const responseTime = Date.now() - startTime;
        const statusCode = response.statusCode;

        // API 메트릭 기록
        await this.metricsService.recordApiRequest(
          method,
          path,
          statusCode,
          responseTime,
          userId,
        );

        // Lambda 메트릭 기록
        if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
          const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024; // MB
          await this.metricsService.recordLambdaMetrics(
            isColdStart,
            memoryUsed,
            responseTime,
          );
        }

        // 느린 요청 로깅
        if (responseTime > 5000) {
          this.logger.warn('Slow API request detected', {
            method,
            path,
            responseTime,
            statusCode,
            userId,
          });
        }
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const statusCode = error instanceof HttpException ? error.getStatus() : 500;

        // 에러 메트릭 기록
        this.metricsService.recordApiRequest(
          method,
          path,
          statusCode,
          responseTime,
          userId,
        ).catch((metricsError) => {
          this.logger.error('Failed to record error metrics', metricsError);
        });

        // 에러 로깅
        this.logger.error('API request failed', {
          method,
          path,
          statusCode,
          responseTime,
          error: error.message,
          stack: error.stack,
          userId,
        });

        return throwError(() => error);
      }),
    );
  }
}