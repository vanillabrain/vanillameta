import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BusinessMetricsService } from '../monitoring/business-metrics.service';

@Injectable()
export class QueryPerformanceMetricsInterceptor implements NestInterceptor {
  constructor(private readonly businessMetrics: BusinessMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const queryStartTime = Date.now();

    // 쿼리 실행 전 메타데이터 설정
    request.queryMetadata = {
      startTime: queryStartTime,
      databaseId: request.body?.databaseId || 'unknown',
      queryType: this.detectQueryType(request.body?.query || ''),
    };

    return next.handle().pipe(
      tap(async response => {
        const duration = Date.now() - queryStartTime;
        const metadata = request.queryMetadata;

        // 쿼리 성능 메트릭 기록
        if (metadata && response?.data) {
          const rowCount = Array.isArray(response.data) ? response.data.length : 0;

          await this.businessMetrics.recordQueryPerformance(
            metadata.databaseId,
            metadata.queryType,
            duration / 1000, // 초 단위로 변환
            rowCount,
          );

          // 쿼리 실행 메트릭
          const complexity = this.calculateQueryComplexity(duration, rowCount);
          await this.businessMetrics.recordQueryExecution(
            this.getDatabaseType(metadata.databaseId),
            complexity,
          );

          // 사용자 활동 기록
          if (request.user?.id) {
            await this.businessMetrics.recordUserActivity(
              request.user.id,
              'query_executed',
              'dataset',
              {
                databaseType: this.getDatabaseType(metadata.databaseId),
                queryComplexity: complexity,
                duration,
                rowCount,
              },
            );
          }
        }
      }),
    );
  }

  /**
   * 쿼리 타입 감지
   */
  private detectQueryType(query: string): string {
    const normalizedQuery = query.trim().toUpperCase();

    if (normalizedQuery.startsWith('SELECT')) {
      if (normalizedQuery.includes('JOIN')) {
        return 'SELECT_JOIN';
      }
      if (normalizedQuery.includes('GROUP BY')) {
        return 'SELECT_AGGREGATE';
      }
      return 'SELECT_SIMPLE';
    }

    if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
    if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
    if (normalizedQuery.startsWith('DELETE')) return 'DELETE';

    return 'OTHER';
  }

  /**
   * 데이터베이스 타입 추출
   */
  private getDatabaseType(databaseId: string): string {
    // 실제 구현에서는 데이터베이스 연결 정보에서 타입을 가져와야 함
    // 여기서는 간단한 매핑 예시
    const dbTypeMap: Record<string, string> = {
      mysql: 'mysql',
      postgresql: 'postgresql',
      oracle: 'oracle',
      sqlserver: 'sqlserver',
      bigquery: 'bigquery',
    };

    for (const [key, value] of Object.entries(dbTypeMap)) {
      if (databaseId.toLowerCase().includes(key)) {
        return value;
      }
    }

    return 'unknown';
  }

  /**
   * 쿼리 복잡도 계산
   */
  private calculateQueryComplexity(
    duration: number,
    rowCount: number,
  ): 'simple' | 'moderate' | 'complex' {
    if (duration < 50 && rowCount < 100) {
      return 'simple';
    } else if (duration < 200 && rowCount < 1000) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }
}
