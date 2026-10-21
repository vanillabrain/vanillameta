import { safeRouteTemplate } from '../utils/safe-route-template';
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BusinessMetricsService } from '../monitoring/business-metrics.service';
import { Request, Response } from 'express';

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTimeInterceptor.name);

  constructor(private readonly businessMetrics: BusinessMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method } = request;
    const path = safeRouteTemplate(request);
    const startTime = Date.now();

    // 요청 시작 로깅
    this.logger.debug(`[${method}] ${path} - Request started`);

    return next.handle().pipe(
      tap({
        next: data => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;

          // 응답 시간 로깅
          this.logger.debug(`[${method}] ${path} - Response: ${statusCode} (${responseTime}ms)`);

          // 메트릭 기록
          this.recordMetrics(path, method, statusCode, responseTime).catch(error => {
            this.logger.error('Failed to record response metrics', error);
          });
        },
        error: error => {
          const responseTime = Date.now() - startTime;
          const statusCode = error.status || 500;

          // 에러 로깅
          this.logger.error(`[${method}] ${path} - Error: ${statusCode} (${responseTime}ms)`, {
            error: error.message,
            stack: error.stack,
          });

          // 에러 메트릭 기록
          this.recordMetrics(path, method, statusCode, responseTime).catch(err => {
            this.logger.error('Failed to record error metrics', err);
          });
        },
      }),
    );
  }

  private async recordMetrics(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
  ): Promise<void> {
    await this.businessMetrics.recordApiUsage(endpoint, method, statusCode, responseTime);
  }
}
