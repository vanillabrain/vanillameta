import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { QueryCollector } from '../utils/query-collector';
import { QueryAnalyzerService } from '../monitoring/query-analyzer.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueryPerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(QueryPerformanceInterceptor.name);
  private readonly enabled: boolean;
  private readonly autoAnalyzeThreshold: number;

  constructor(
    private readonly queryCollector: QueryCollector,
    private readonly queryAnalyzer: QueryAnalyzerService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('QUERY_PERFORMANCE_MONITORING_ENABLED', true);
    this.autoAnalyzeThreshold = this.configService.get<number>('QUERY_AUTO_ANALYZE_THRESHOLD', 5000);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const startTime = Date.now();

    // 요청 정보에서 쿼리 관련 정보 추출
    const source = `${method} ${url}`;

    return next.handle().pipe(
      tap({
        next: async (data) => {
          const executionTime = Date.now() - startTime;

          // 느린 요청에 대한 자동 분석
          if (executionTime > this.autoAnalyzeThreshold) {
            this.logger.warn({
              message: 'Slow request detected, triggering query analysis',
              source,
              executionTime,
              threshold: this.autoAnalyzeThreshold,
            });

            // 비동기로 쿼리 분석 수행 (응답을 차단하지 않음)
            this.analyzeSlowRequest(source, body).catch((error) => {
              this.logger.error('Failed to analyze slow request', error);
            });
          }
        },
        error: (error) => {
          const executionTime = Date.now() - startTime;
          
          this.logger.error({
            message: 'Request failed',
            source,
            executionTime,
            error: error.message,
          });
        },
      }),
    );
  }

  private async analyzeSlowRequest(source: string, body: any): Promise<void> {
    try {
      // 최근 수집된 쿼리 중 이 요청과 관련된 쿼리 찾기
      const recentQueries = this.queryCollector.getQueries({
        source,
        since: new Date(Date.now() - 60000), // 최근 1분
      });

      if (recentQueries.length === 0) {
        return;
      }

      // 느린 쿼리들에 대한 분석 수행
      const slowQueries = recentQueries.filter(
        (q) => q.executionTime && q.executionTime > 1000,
      );

      for (const query of slowQueries) {
        try {
          const analysis = await this.queryAnalyzer.analyzeQuery(query.query);
          
          if (analysis.optimizationSuggestions && analysis.optimizationSuggestions.length > 0) {
            this.logger.warn({
              message: 'Query optimization opportunities found',
              source: query.source,
              query: query.query.substring(0, 200),
              suggestions: analysis.optimizationSuggestions,
            });
          }
        } catch (error) {
          this.logger.error(`Failed to analyze query: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Error in analyzeSlowRequest', error);
    }
  }
}