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

    const { method, url, path } = request;
    const startTime = Date.now();

    // 요청 시작 로깅
    this.logger.debug(`[${method}] ${url} - Request started`);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;

          // 응답 시간 로깅
          this.logger.debug(`[${method}] ${url} - Response: ${statusCode} (${responseTime}ms)`);

          // 메트릭 기록
          this.recordMetrics(path, method, statusCode, responseTime).catch((error) => {
            this.logger.error('Failed to record response metrics', error);
          });
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          const statusCode = error.status || 500;

          // 에러 로깅
          this.logger.error(`[${method}] ${url} - Error: ${statusCode} (${responseTime}ms)`, {
            error: error.message,
            stack: error.stack,
          });

          // 에러 메트릭 기록
          this.recordMetrics(path, method, statusCode, responseTime).catch((err) => {
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
    // 정규화된 엔드포인트 경로 생성 (파라미터 제거)
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    // API 사용량 메트릭 기록
    await this.businessMetrics.recordApiUsage(normalizedEndpoint, method, statusCode, responseTime);
  }

  private normalizeEndpoint(endpoint: string): string {
    // URL 파라미터를 일반화
    return endpoint
      .replace(/\/\d+/g, '/:id') // 숫자 ID를 :id로 변경
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // UUID를 :uuid로 변경
      .replace(/\?.*$/, ''); // 쿼리 파라미터 제거
  }
}