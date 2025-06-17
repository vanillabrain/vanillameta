import { Injectable } from '@nestjs/common';
import { BusinessMetricsService } from '../monitoring/business-metrics.service';
import { QueryCollector, QueryInfo } from '../utils/query-collector';

@Injectable()
export class QueryPerformanceMetricsInterceptor {
  private lastReportTime = Date.now();
  private readonly reportInterval = 60000; // 1분마다 리포트

  constructor(
    private readonly businessMetrics: BusinessMetricsService,
    private readonly queryCollector: QueryCollector,
  ) {
    // 주기적으로 쿼리 성능 메트릭 리포트
    this.startPeriodicReporting();
  }

  private startPeriodicReporting(): void {
    setInterval(() => {
      this.reportQueryMetrics().catch((error) => {
        console.error('Failed to report query metrics:', error);
      });
    }, this.reportInterval);
  }

  private async reportQueryMetrics(): Promise<void> {
    const queries = this.queryCollector.getQueries({
      since: new Date(this.lastReportTime),
    });

    if (queries.length === 0) {
      return;
    }

    // 쿼리 타입별로 그룹화
    const queryGroups = this.groupQueriesByType(queries);

    // 각 그룹별로 메트릭 리포트
    for (const [queryType, groupQueries] of Object.entries(queryGroups)) {
      await this.reportQueryGroupMetrics(queryType, groupQueries);
    }

    // 캐시 적중률 계산 및 리포트
    await this.reportCacheMetrics(queries);

    this.lastReportTime = Date.now();
  }

  private groupQueriesByType(queries: QueryInfo[]): Record<string, QueryInfo[]> {
    const groups: Record<string, QueryInfo[]> = {};

    queries.forEach((query) => {
      const queryType = this.extractQueryType(query.query);
      if (!groups[queryType]) {
        groups[queryType] = [];
      }
      groups[queryType].push(query);
    });

    return groups;
  }

  private extractQueryType(query: string): string {
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

    if (normalizedQuery.startsWith('INSERT')) {
      return 'INSERT';
    }

    if (normalizedQuery.startsWith('UPDATE')) {
      return 'UPDATE';
    }

    if (normalizedQuery.startsWith('DELETE')) {
      return 'DELETE';
    }

    return 'OTHER';
  }

  private async reportQueryGroupMetrics(
    queryType: string,
    queries: QueryInfo[],
  ): Promise<void> {
    // 실행 시간 통계
    const executionTimes = queries
      .filter((q) => q.executionTime !== undefined)
      .map((q) => q.executionTime!);

    if (executionTimes.length === 0) {
      return;
    }

    // 평균 실행 시간
    const avgExecutionTime =
      executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;

    // 성공/실패 카운트
    const successCount = queries.filter((q) => q.success).length;
    const errorCount = queries.filter((q) => !q.success).length;

    // 데이터베이스 타입별 분류
    const databaseTypes = new Set(queries.map((q) => q.source?.split(' ')[0] || 'unknown'));

    for (const dbType of databaseTypes) {
      const dbQueries = queries.filter((q) => (q.source?.split(' ')[0] || 'unknown') === dbType);
      
      // 각 쿼리에 대해 메트릭 기록
      for (const query of dbQueries) {
        if (query.executionTime !== undefined) {
          await this.businessMetrics.recordQueryExecution(
            queryType,
            query.executionTime,
            query.success !== false,
            dbType,
          );
        }
      }
    }
  }

  private async reportCacheMetrics(queries: QueryInfo[]): Promise<void> {
    // 캐시 가능한 쿼리 (SELECT)만 필터링
    const selectQueries = queries.filter((q) =>
      q.query.trim().toUpperCase().startsWith('SELECT'),
    );

    if (selectQueries.length === 0) {
      return;
    }

    // 캐시 히트/미스 시뮬레이션 (실제 구현에서는 캐시 시스템과 통합)
    for (const query of selectQueries) {
      // 쿼리 해시나 특정 패턴으로 캐시 여부 판단
      const isCached = this.checkIfCached(query);
      await this.businessMetrics.recordQueryCacheMetrics(
        isCached,
        this.extractQueryType(query.query),
      );
    }
  }

  private checkIfCached(query: QueryInfo): boolean {
    // 실제 구현에서는 Redis나 메모리 캐시를 체크
    // 여기서는 예시로 실행 시간이 매우 빠른 경우를 캐시 히트로 간주
    return query.executionTime !== undefined && query.executionTime < 10;
  }

  /**
   * 대시보드 로딩 시간 추적
   */
  async trackDashboardLoad(dashboardId: string, loadTime: number, userId?: string): Promise<void> {
    await this.businessMetrics.recordDashboardLoadTime(dashboardId, loadTime, userId);
  }

  /**
   * 위젯 렌더링 시간 추적
   */
  async trackWidgetRender(
    widgetId: string,
    widgetType: string,
    renderTime: number,
  ): Promise<void> {
    await this.businessMetrics.recordWidgetRenderTime(widgetId, widgetType, renderTime);
  }

  /**
   * 데이터 새로고침 추적
   */
  async trackDataRefresh(
    datasetId: string,
    success: boolean,
    duration?: number,
  ): Promise<void> {
    await this.businessMetrics.recordDataRefreshResult(success, datasetId, duration);
  }
}