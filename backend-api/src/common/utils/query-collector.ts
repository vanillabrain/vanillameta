import { Injectable, Logger } from '@nestjs/common';

export interface CollectedQuery {
  query: string;
  params?: any[];
  source: string;
  timestamp: Date;
  executionTime?: number;
}

export interface QueryInfo {
  query: string;
  params?: any[];
  source: string;
  timestamp: Date;
  executionTime?: number;
  success?: boolean;
}

@Injectable()
export class QueryCollector {
  private readonly logger = new Logger(QueryCollector.name);
  private queries: CollectedQuery[] = [];
  private readonly maxQueries = 1000; // 메모리 관리를 위한 최대 쿼리 수

  /**
   * 쿼리 수집
   */
  collect(query: string, source: string, params?: any[], executionTime?: number): void {
    const collectedQuery: CollectedQuery = {
      query,
      params,
      source,
      timestamp: new Date(),
      executionTime,
    };

    this.queries.push(collectedQuery);

    // 메모리 관리: 최대 개수 초과 시 오래된 쿼리 제거
    if (this.queries.length > this.maxQueries) {
      this.queries = this.queries.slice(-this.maxQueries);
    }

    // 느린 쿼리 즉시 로깅
    if (executionTime && executionTime > 1000) {
      this.logger.warn({
        message: 'Slow query collected',
        source,
        executionTime,
        query: query.substring(0, 200),
      });
    }
  }

  /**
   * 수집된 쿼리 조회
   */
  getQueries(filter?: {
    source?: string;
    minExecutionTime?: number;
    since?: Date;
  }): CollectedQuery[] {
    let result = [...this.queries];

    if (filter) {
      if (filter.source) {
        result = result.filter(q => q.source === filter.source);
      }
      if (filter.minExecutionTime) {
        result = result.filter(q => q.executionTime && q.executionTime >= filter.minExecutionTime);
      }
      if (filter.since) {
        result = result.filter(q => q.timestamp >= filter.since);
      }
    }

    return result;
  }

  /**
   * 주요 쿼리 패턴 식별
   */
  identifyPatterns(): Map<string, CollectedQuery[]> {
    const patterns = new Map<string, CollectedQuery[]>();

    for (const query of this.queries) {
      // 쿼리 정규화 (파라미터 제거)
      const normalizedQuery = this.normalizeQuery(query.query);

      if (!patterns.has(normalizedQuery)) {
        patterns.set(normalizedQuery, []);
      }
      patterns.get(normalizedQuery)!.push(query);
    }

    return patterns;
  }

  /**
   * 쿼리 정규화 (파라미터를 ? 로 치환)
   */
  private normalizeQuery(query: string): string {
    // 숫자 리터럴을 ? 로 치환
    let normalized = query.replace(/\b\d+\b/g, '?');

    // 문자열 리터럴을 ? 로 치환
    normalized = normalized.replace(/'[^']*'/g, '?');
    normalized = normalized.replace(/"[^"]*"/g, '?');

    // 공백 정규화
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * 통계 생성
   */
  getStatistics(): {
    totalQueries: number;
    slowQueries: number;
    averageExecutionTime: number;
    queryBySources: Map<string, number>;
    slowestQueries: CollectedQuery[];
  } {
    const slowQueries = this.queries.filter(q => q.executionTime && q.executionTime > 1000);
    const queriesWithTime = this.queries.filter(q => q.executionTime);

    const totalExecutionTime = queriesWithTime.reduce((sum, q) => sum + (q.executionTime || 0), 0);

    const queryBySources = new Map<string, number>();
    for (const query of this.queries) {
      queryBySources.set(query.source, (queryBySources.get(query.source) || 0) + 1);
    }

    const slowestQueries = [...this.queries]
      .filter(q => q.executionTime)
      .sort((a, b) => (b.executionTime || 0) - (a.executionTime || 0))
      .slice(0, 10);

    return {
      totalQueries: this.queries.length,
      slowQueries: slowQueries.length,
      averageExecutionTime:
        queriesWithTime.length > 0 ? totalExecutionTime / queriesWithTime.length : 0,
      queryBySources,
      slowestQueries,
    };
  }

  /**
   * 수집된 쿼리 초기화
   */
  clear(): void {
    this.queries = [];
    this.logger.log('Query collection cleared');
  }
}
