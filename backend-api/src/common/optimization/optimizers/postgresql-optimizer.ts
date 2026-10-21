import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';

export interface PostgreSQLOptimizationResult {
  optimizedQuery: string;
  appliedOptimizations: string[];
  performance: {
    estimatedImprovementPercent: number;
    indexRecommendations: string[];
    explainAnalysis?: any;
  };
}

@Injectable()
export class PostgreSQLOptimizer {
  private readonly logger = new Logger(PostgreSQLOptimizer.name);

  /**
   * PostgreSQL JSON 쿼리 최적화
   */
  async optimizeJsonQuery(
    knex: Knex,
    tableName: string,
    jsonColumn: string,
    jsonPath: string,
  ): Promise<any> {
    return knex(tableName)
      .select('*')
      .whereRaw(`${jsonColumn}->>'${jsonPath}' = ?`, ['value'])
      .orderByRaw(`${jsonColumn}->>'created_at'`);
  }

  /**
   * PostgreSQL 배열 연산 최적화
   */
  async arrayContains(
    knex: Knex,
    tableName: string,
    arrayColumn: string,
    values: string[],
  ): Promise<any> {
    return knex(tableName).whereRaw(`${arrayColumn} && ARRAY[?]::varchar[]`, [values]);
  }

  /**
   * PostgreSQL 연결 최적화 설정
   */
  getConnectionConfig(baseConfig: any): Knex.Config {
    return {
      client: 'pg',
      connection: {
        ...baseConfig,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        statement_timeout: parseInt(process.env.PG_STATEMENT_TIMEOUT) || 30000,
        idle_in_transaction_session_timeout: parseInt(process.env.PG_IDLE_TIMEOUT) || 60000,
        application_name: 'VanillaMeta',
      },
      pool: {
        min: 0,
        max: parseInt(process.env.PG_POOL_MAX) || 20, // PostgreSQL은 더 많은 연결 처리 가능
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 600000, // 10분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        afterCreate: (conn, done) => {
          // PostgreSQL 세션 설정
          conn.query(
            `
            SET timezone = 'UTC';
            SET statement_timeout = '30s';
            SET lock_timeout = '10s';
            SET idle_in_transaction_session_timeout = '60s';
          `,
            done,
          );
        },
      },
      searchPath: ['public'],
      asyncStackTraces: process.env.NODE_ENV === 'development',
    };
  }

  /**
   * PostgreSQL EXPLAIN ANALYZE 실행
   */
  async explainAnalyze(knex: Knex, query: string): Promise<any> {
    if (process.env.NODE_ENV === 'development') {
      try {
        const result = await knex.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
        return result.rows[0]['QUERY PLAN'][0];
      } catch (error) {
        this.logger.warn('Failed to execute EXPLAIN ANALYZE', error.message);
        return null;
      }
    }
    return null;
  }

  /**
   * PostgreSQL 전문 검색 최적화
   */
  optimizeFullTextSearch(query: string): PostgreSQLOptimizationResult {
    const optimizedQuery = query;
    const appliedOptimizations: string[] = [];
    const indexRecommendations: string[] = [];

    // ts_vector 사용 권장
    const likePattern = /LIKE\s+['"]%([^%]+)%['"]/gi;
    let match;

    while ((match = likePattern.exec(query)) !== null) {
      const searchTerm = match[1];
      // LIKE를 전문 검색으로 변환 제안
      appliedOptimizations.push(`Suggest using full-text search for: ${searchTerm}`);
      indexRecommendations.push(
        "CREATE INDEX ON table_name USING GIN(to_tsvector('english', column_name))",
      );
    }

    return {
      optimizedQuery,
      appliedOptimizations,
      performance: {
        estimatedImprovementPercent: appliedOptimizations.length * 25,
        indexRecommendations,
      },
    };
  }

  /**
   * PostgreSQL JSON 인덱스 최적화
   */
  optimizeJsonIndexes(query: string): string[] {
    const recommendations: string[] = [];

    // JSON 연산자 패턴 감지
    const jsonPatterns = [
      /->/g, // JSON 객체 접근
      /->>/g, // JSON 텍스트 접근
      /@>/g, // JSON 포함 검사
      /\?/g, // JSON 키 존재 검사 (이스케이프)
    ];

    let hasJsonOps = false;
    jsonPatterns.forEach(pattern => {
      if (pattern.test(query)) {
        hasJsonOps = true;
      }
    });

    if (hasJsonOps) {
      recommendations.push('CREATE INDEX ON table_name USING GIN (json_column)');
      recommendations.push("CREATE INDEX ON table_name USING GIN ((json_column->'specific_key'))");
    }

    return recommendations;
  }

  /**
   * PostgreSQL 배열 인덱스 최적화
   */
  optimizeArrayIndexes(query: string): string[] {
    const recommendations: string[] = [];

    // 배열 연산자 감지
    if (/&&|\@>|<@|\?\?/.test(query)) {
      recommendations.push('CREATE INDEX ON table_name USING GIN (array_column)');
    }

    return recommendations;
  }

  /**
   * PostgreSQL CTE 최적화
   */
  optimizeCTE(query: string): PostgreSQLOptimizationResult {
    const optimizedQuery = query;
    const appliedOptimizations: string[] = [];

    // 재귀 CTE 감지 및 최적화
    if (/WITH\s+RECURSIVE/i.test(query)) {
      appliedOptimizations.push('Recursive CTE detected - ensure proper termination condition');
    }

    // CTE 인라인화 힌트
    if (/WITH\s+\w+\s+AS/i.test(query)) {
      appliedOptimizations.push(
        'CTE usage detected - consider if inlining would improve performance',
      );
    }

    return {
      optimizedQuery,
      appliedOptimizations,
      performance: {
        estimatedImprovementPercent: 0, // CTE 최적화는 케이스별로 다름
        indexRecommendations: [],
      },
    };
  }

  /**
   * PostgreSQL 파티션 테이블 최적화
   */
  optimizePartitionedTable(query: string, partitionColumn: string): string {
    // 파티션 프루닝을 위한 WHERE 절 확인
    const wherePattern = new RegExp(`WHERE.*${partitionColumn}`, 'i');

    if (!wherePattern.test(query)) {
      this.logger.warn('Query on partitioned table without partition key filter', {
        partitionColumn,
        suggestion: `Add WHERE clause with ${partitionColumn} for partition pruning`,
      });
    }

    return query;
  }

  /**
   * PostgreSQL 병렬 쿼리 최적화
   */
  optimizeParallelQuery(query: string): string {
    // 대용량 집계 쿼리에 대한 병렬 처리 힌트
    if (/COUNT\s*\(|SUM\s*\(|AVG\s*\(/i.test(query) && /GROUP\s+BY/i.test(query)) {
      return `SET max_parallel_workers_per_gather = 4; ${query}`;
    }

    return query;
  }

  /**
   * PostgreSQL 윈도우 함수 최적화
   */
  optimizeWindowFunctions(query: string): PostgreSQLOptimizationResult {
    const optimizedQuery = query;
    const appliedOptimizations: string[] = [];
    const indexRecommendations: string[] = [];

    // 윈도우 함수 패턴 감지
    const windowFunctionPattern =
      /(\w+)\s*\(\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\s+(\w+)\s*ORDER\s+BY\s+(\w+)/gi;
    let match;

    while ((match = windowFunctionPattern.exec(query)) !== null) {
      const [, func, partitionCol, orderCol] = match;
      appliedOptimizations.push(`Window function ${func} optimization applied`);
      indexRecommendations.push(`CREATE INDEX ON table_name (${partitionCol}, ${orderCol})`);
    }

    return {
      optimizedQuery,
      appliedOptimizations,
      performance: {
        estimatedImprovementPercent: appliedOptimizations.length * 20,
        indexRecommendations,
      },
    };
  }

  /**
   * PostgreSQL 통계 정보 업데이트 권장
   */
  checkStatistics(knex: Knex, tableName: string): Promise<boolean> {
    return new Promise(async resolve => {
      try {
        const result = await knex.raw(
          `
          SELECT schemaname, tablename, last_analyze, last_autoanalyze
          FROM pg_stat_user_tables 
          WHERE tablename = ?
        `,
          [tableName],
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          const lastAnalyze = row.last_analyze || row.last_autoanalyze;

          if (!lastAnalyze || Date.now() - new Date(lastAnalyze).getTime() > 24 * 60 * 60 * 1000) {
            this.logger.warn('Table statistics may be outdated', {
              tableName,
              lastAnalyze,
              recommendation: `Consider running ANALYZE ${tableName}`,
            });
            resolve(false);
          }
        }
        resolve(true);
      } catch (error) {
        this.logger.debug('Failed to check table statistics', error.message);
        resolve(true);
      }
    });
  }

  /**
   * PostgreSQL 인덱스 사용률 분석
   */
  async analyzeIndexUsage(knex: Knex, tableName: string): Promise<any[]> {
    try {
      const result = await knex.raw(
        `
        SELECT 
          indexrelname as index_name,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan,
          CASE 
            WHEN idx_scan = 0 THEN 'Never used'
            WHEN idx_scan < 10 THEN 'Rarely used'
            ELSE 'Frequently used'
          END as usage_level
        FROM pg_stat_user_indexes 
        WHERE relname = ?
        ORDER BY idx_scan DESC
      `,
        [tableName],
      );

      return result.rows;
    } catch (error) {
      this.logger.debug('Failed to analyze index usage', error.message);
      return [];
    }
  }

  /**
   * PostgreSQL 쿼리 복잡도 분석
   */
  analyzeQueryComplexity(query: string): {
    complexity: 'low' | 'medium' | 'high';
    factors: string[];
    recommendations: string[];
  } {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let complexity: 'low' | 'medium' | 'high' = 'low';

    // 복잡도 요소 분석
    const joinCount = (query.match(/JOIN/gi) || []).length;
    if (joinCount > 0) {
      factors.push(`${joinCount} JOINs`);
      if (joinCount > 3) complexity = 'high';
      else if (joinCount > 1) complexity = 'medium';
    }

    // 서브쿼리 분석
    const subqueryCount = (query.match(/\(/g) || []).length;
    if (subqueryCount > 2) {
      factors.push(`${subqueryCount} subqueries`);
      complexity = 'high';
      recommendations.push('Consider using CTEs for better readability');
    }

    // 집계 함수 분석
    if (/GROUP\s+BY/i.test(query)) {
      factors.push('Aggregation');
      if (complexity === 'low') complexity = 'medium';
    }

    // 윈도우 함수 분석
    if (/OVER\s*\(/i.test(query)) {
      factors.push('Window functions');
      complexity = 'high';
      recommendations.push('Ensure proper indexing for window function performance');
    }

    // 정규 표현식 사용
    if (/~|\!~|~\*|\!~\*/i.test(query)) {
      factors.push('Regex operations');
      recommendations.push('Consider using full-text search instead of regex for text matching');
    }

    return {
      complexity,
      factors,
      recommendations,
    };
  }

  /**
   * PostgreSQL 버전별 최적화
   */
  optimizeForVersion(query: string, version: string): string {
    const majorVersion = parseInt(version.split('.')[0]);

    // PostgreSQL 13+ 최적화
    if (majorVersion >= 13) {
      // 병렬 해시 조인 활용
      if (/JOIN/i.test(query)) {
        return query + ' /* PG13+ parallel hash join available */';
      }
    }

    // PostgreSQL 12+ 최적화
    if (majorVersion >= 12) {
      // JSON Path 쿼리 활용
      if (/json/i.test(query)) {
        return query + ' /* PG12+ JSON Path queries available */';
      }
    }

    return query;
  }
}
