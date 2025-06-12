import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { SlowQueryMonitorService } from '../monitoring/slow-query-monitor.service';
import { QueryAnalyzerService } from '../monitoring/query-analyzer.service';

export interface RequestWithQuery extends Request {
  queryMetrics?: {
    startTime: number;
    queries: Array<{
      query: string;
      parameters?: any[];
      executionTime: number;
      databaseId?: number;
      databaseEngine?: string;
    }>;
  };
}

@Injectable()
export class SlowQueryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SlowQueryInterceptor.name);

  constructor(
    private readonly slowQueryMonitorService: SlowQueryMonitorService,
    private readonly queryAnalyzerService: QueryAnalyzerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithQuery>();
    const startTime = Date.now();

    // 요청 메타데이터 수집
    const metadata = this.extractRequestMetadata(request);

    // 요청 시작 시점 기록
    request.queryMetrics = {
      startTime,
      queries: [],
    };

    return next.handle().pipe(
      tap({
        next: async () => {
          // 응답 성공 시 쿼리 메트릭 처리
          await this.processQueryMetrics(request, metadata);
        },
        error: async (error) => {
          // 에러 발생 시에도 쿼리 메트릭 처리
          await this.processQueryMetrics(request, metadata, error);
        },
      }),
    );
  }

  /**
   * 요청에서 메타데이터 추출
   */
  private extractRequestMetadata(request: RequestWithQuery) {
    const userAgent = request.get('User-Agent') || '';
    const clientIp = this.getClientIp(request);
    const userId = (request as any).user?.id || (request as any).user?.userId;
    const requestId = request.get('X-Request-ID') || this.generateRequestId();

    return {
      userId,
      requestPath: request.path,
      httpMethod: request.method,
      clientIp,
      userAgent: userAgent.substring(0, 500), // 길이 제한
      requestId,
    };
  }

  /**
   * 클라이언트 IP 추출
   */
  private getClientIp(request: Request): string {
    return (
      request.get('X-Forwarded-For')?.split(',')[0] ||
      request.get('X-Real-IP') ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 쿼리 메트릭 처리
   */
  private async processQueryMetrics(
    request: RequestWithQuery,
    metadata: any,
    error?: any,
  ): Promise<void> {
    if (!request.queryMetrics) return;

    const totalExecutionTime = Date.now() - request.queryMetrics.startTime;

    try {
      // 수집된 쿼리들에 대해 슬로우 쿼리 분석
      for (const queryMetric of request.queryMetrics.queries) {
        if (queryMetric.executionTime >= 1000) { // 1초 이상인 쿼리만 분석
          const analysis = await this.queryAnalyzerService.analyzeQuery(
            queryMetric.query,
            queryMetric.databaseId,
          );

          // 실행 시간 정보 추가
          analysis.executionTime = queryMetric.executionTime;

          // 슬로우 쿼리 로깅
          await this.slowQueryMonitorService.logSlowQuery(analysis, {
            ...metadata,
            databaseId: queryMetric.databaseId,
            databaseEngine: queryMetric.databaseEngine,
            parameters: queryMetric.parameters,
          });
        }
      }

      // 전체 요청 시간이 느린 경우에도 기록
      if (totalExecutionTime >= 5000) { // 5초 이상
        this.logger.warn({
          message: 'Slow request detected',
          requestPath: metadata.requestPath,
          httpMethod: metadata.httpMethod,
          totalExecutionTime,
          queryCount: request.queryMetrics.queries.length,
          userId: metadata.userId,
          requestId: metadata.requestId,
          error: error?.message,
        });
      }
    } catch (analysisError) {
      this.logger.error(
        `Failed to process query metrics: ${analysisError.message}`,
        analysisError.stack,
      );
    }
  }

  /**
   * 쿼리 실행 정보 기록 (외부에서 호출)
   */
  static recordQuery(
    request: RequestWithQuery,
    query: string,
    executionTime: number,
    options: {
      parameters?: any[];
      databaseId?: number;
      databaseEngine?: string;
    } = {},
  ): void {
    if (!request.queryMetrics) {
      request.queryMetrics = {
        startTime: Date.now(),
        queries: [],
      };
    }

    request.queryMetrics.queries.push({
      query: query.substring(0, 1000), // 쿼리 길이 제한
      executionTime,
      parameters: options.parameters,
      databaseId: options.databaseId,
      databaseEngine: options.databaseEngine,
    });
  }
}