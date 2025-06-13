import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { QueryAnalyzerService } from '../monitoring/query-analyzer.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueryPerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(QueryPerformanceInterceptor.name);
  private readonly isEnabled: boolean;
  private readonly slowQueryThreshold: number;

  constructor(
    private readonly queryAnalyzerService: QueryAnalyzerService,
    private readonly configService: ConfigService,
  ) {
    this.isEnabled = this.configService.get('QUERY_PERFORMANCE_MONITORING', 'true') === 'true';
    this.slowQueryThreshold = parseInt(this.configService.get('SLOW_QUERY_THRESHOLD', '1000'), 10);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.isEnabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const executionTime = Date.now() - startTime;

          // 느린 API 엔드포인트 로깅
          if (executionTime > this.slowQueryThreshold) {
            this.logger.warn({
              message: 'Slow API endpoint detected',
              method,
              url,
              executionTime,
              threshold: this.slowQueryThreshold,
            });

            // 쿼리 분석 트리거 (비동기로 처리하여 응답 지연 방지)
            this.analyzeSlowEndpoint(method, url).catch(error => {
              this.logger.error(`Failed to analyze slow endpoint: ${error.message}`);
            });
          }
        },
        error: error => {
          const executionTime = Date.now() - startTime;
          this.logger.error({
            message: 'API endpoint error',
            method,
            url,
            executionTime,
            error: error.message,
          });
        },
      }),
    );
  }

  private async analyzeSlowEndpoint(method: string, url: string): Promise<void> {
    // 특정 엔드포인트에 대한 쿼리 분석 로직
    // 실제 구현에서는 엔드포인트별로 실행되는 쿼리를 추적하여 분석
    this.logger.debug(`Analyzing slow endpoint: ${method} ${url}`);
  }
}
