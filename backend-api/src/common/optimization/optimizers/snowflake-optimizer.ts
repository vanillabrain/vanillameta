import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';

export interface SnowflakeOptimizationResult {
  optimizedQuery: string;
  appliedOptimizations: string[];
  warehouseRecommendations: {
    suggestedSize: string;
    reasoning: string;
    estimatedCostImpact: string;
  };
  performance: {
    estimatedImprovementPercent: number;
    clusteringRecommendations: string[];
    cachingStrategy: string[];
  };
}

@Injectable()
export class SnowflakeOptimizer {
  private readonly logger = new Logger(SnowflakeOptimizer.name);

  // Snowflake 웨어하우스 크기별 크레딧 소비
  private readonly warehouseCosts = {
    'X-SMALL': 1,
    SMALL: 2,
    MEDIUM: 4,
    LARGE: 8,
    'X-LARGE': 16,
    '2X-LARGE': 32,
    '3X-LARGE': 64,
    '4X-LARGE': 128,
  };

  /**
   * Snowflake 웨어하우스 관리 최적화
   */
  async executeWithWarehouse(knex: Knex, query: string, warehouseSize = 'SMALL'): Promise<any> {
    try {
      // 웨어하우스 변경
      await knex.raw(`USE WAREHOUSE ${warehouseSize}_WH`);

      this.logger.log('Switched to warehouse for query execution', {
        warehouseSize,
        query: query.substring(0, 100),
      });

      // 쿼리 실행
      const result = await knex.raw(query);

      // 기본 웨어하우스로 복구
      await knex.raw('USE WAREHOUSE DEFAULT_WH');

      return result;
    } catch (error) {
      // 에러 발생 시에도 웨어하우스 복구
      try {
        await knex.raw('USE WAREHOUSE DEFAULT_WH');
      } catch (restoreError) {
        this.logger.error('Failed to restore default warehouse', restoreError.message);
      }
      throw error;
    }
  }

  /**
   * Snowflake 결과 캐싱 최적화
   */
  async queryWithCache(knex: Knex, query: string, cacheTTL = 86400): Promise<any> {
    return knex.raw(query).options({
      resultCacheTTL: cacheTTL, // 24시간
      useResultCache: true,
      maxRetries: 3,
      retryDelayMs: 1000,
    });
  }

  /**
   * Snowflake 연결 최적화 설정
   */
  getConnectionConfig(baseConfig: any): Knex.Config {
    return {
      client: require('../../../connection/knex-dialects/snowflake'),
      connection: {
        ...baseConfig,
        account: process.env.SNOWFLAKE_ACCOUNT || baseConfig.account,
        username: process.env.SNOWFLAKE_USER || baseConfig.username,
        password: process.env.SNOWFLAKE_PASSWORD || baseConfig.password,
        warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
        database: process.env.SNOWFLAKE_DATABASE || baseConfig.database,
        schema: process.env.SNOWFLAKE_SCHEMA || baseConfig.schema || 'PUBLIC',
        role: process.env.SNOWFLAKE_ROLE || 'PUBLIC',
        // Snowflake 전용 옵션
        application: 'VanillaMeta',
        connectTimeout: 60000,
        networkTimeout: 45000,
        queryTimeout: 300000, // 5분
      } as any, // Snowflake 연결 설정은 Knex 표준 타입과 다름
      pool: {
        min: 0,
        max: parseInt(process.env.SNOWFLAKE_POOL_MAX) || 10,
        acquireTimeoutMillis: 60000,
        createTimeoutMillis: 60000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 1800000, // 30분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 500,
        afterCreate: (conn, done) => {
          // Snowflake 세션 설정
          const sessionQueries = [
            `ALTER SESSION SET TIMEZONE = 'UTC'`,
            `ALTER SESSION SET QUERY_TAG = 'app:vanillameta'`,
            `ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 300`,
          ];

          Promise.all(sessionQueries.map(q => conn.execute(q)))
            .then(() => done(null, conn))
            .catch(err => done(err, conn));
        },
      },
    };
  }

  /**
   * Snowflake 쿼리 태그 최적화
   */
  addQueryTags(query: string, tags: Record<string, string> = {}): string {
    const defaultTags = {
      app: 'vanillameta',
      env: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      ...tags,
    };

    const tagString = Object.entries(defaultTags)
      .map(([key, value]) => `${key}:${value}`)
      .join(',');

    return `/* QUERY_TAG='${tagString}' */ ${query}`;
  }

  /**
   * Snowflake 클러스터링 키 최적화
   */
  optimizeClusteringKeys(query: string): SnowflakeOptimizationResult {
    const optimizedQuery = query;
    const appliedOptimizations: string[] = [];
    const clusteringRecommendations: string[] = [];

    // WHERE 절 분석하여 클러스터링 키 추천
    const whereMatch = query.match(/WHERE\s+([^GROUP|ORDER|LIMIT|;]+)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];

      // 자주 사용되는 필터 컬럼 추출
      const filterColumns = this.extractFilterColumns(whereClause);

      if (filterColumns.length > 0) {
        clusteringRecommendations.push(
          `Consider clustering table by: ${filterColumns.slice(0, 3).join(', ')}`,
        );
        appliedOptimizations.push('Clustering key analysis performed');
      }
    }

    // JOIN 조건 분석
    const joinMatches = query.match(/JOIN\s+\w+\s+ON\s+([^WHERE|GROUP|ORDER]+)/gi);
    if (joinMatches) {
      joinMatches.forEach(joinCondition => {
        const joinColumns = this.extractJoinColumns(joinCondition);
        if (joinColumns.length > 0) {
          clusteringRecommendations.push(
            `Consider clustering joined tables by: ${joinColumns.join(', ')}`,
          );
        }
      });
      appliedOptimizations.push('JOIN condition clustering analysis performed');
    }

    return {
      optimizedQuery,
      appliedOptimizations,
      warehouseRecommendations: this.analyzeWarehouseRequirements(query),
      performance: {
        estimatedImprovementPercent: clusteringRecommendations.length * 20,
        clusteringRecommendations,
        cachingStrategy: this.generateCachingStrategy(query),
      },
    };
  }

  /**
   * Snowflake 웨어하우스 크기 권장
   */
  analyzeWarehouseRequirements(query: string): {
    suggestedSize: string;
    reasoning: string;
    estimatedCostImpact: string;
  } {
    let suggestedSize = 'SMALL';
    let reasoning = 'Simple query suitable for small warehouse';

    // 복잡도 분석
    const joinCount = (query.match(/JOIN/gi) || []).length;
    const aggregationCount = (query.match(/GROUP\s+BY|COUNT|SUM|AVG|MAX|MIN/gi) || []).length;
    const windowFunctionCount = (query.match(/OVER\s*\(/gi) || []).length;
    const subqueryCount = (query.match(/\(/g) || []).length;

    let complexityScore = 0;
    complexityScore += joinCount * 2;
    complexityScore += aggregationCount * 1.5;
    complexityScore += windowFunctionCount * 3;
    complexityScore += subqueryCount * 1;

    if (complexityScore <= 5) {
      suggestedSize = 'SMALL';
      reasoning = 'Low complexity query';
    } else if (complexityScore <= 15) {
      suggestedSize = 'MEDIUM';
      reasoning = 'Medium complexity with joins/aggregations';
    } else if (complexityScore <= 30) {
      suggestedSize = 'LARGE';
      reasoning = 'High complexity with multiple operations';
    } else {
      suggestedSize = 'X-LARGE';
      reasoning = 'Very complex query with heavy computations';
    }

    // 대용량 데이터 처리 감지
    if (/DISTINCT|UNION|EXCEPT|INTERSECT/i.test(query)) {
      const currentCost = this.warehouseCosts[suggestedSize];
      const upgradedSize = this.getNextWarehouseSize(suggestedSize);
      suggestedSize = upgradedSize;
      reasoning += ' + large data operations detected';
    }

    const estimatedCostImpact = `${this.warehouseCosts[suggestedSize]} credits/hour`;

    return {
      suggestedSize,
      reasoning,
      estimatedCostImpact,
    };
  }

  /**
   * Snowflake 캐싱 전략 생성
   */
  generateCachingStrategy(query: string): string[] {
    const strategies: string[] = [];

    // Result Cache 권장
    if (/SELECT/i.test(query) && !/INSERT|UPDATE|DELETE/i.test(query)) {
      strategies.push('Enable result cache for repeated SELECT queries');
    }

    // Warehouse Cache 권장
    if (/GROUP\s+BY|ORDER\s+BY|JOIN/i.test(query)) {
      strategies.push('Keep warehouse running for related queries to utilize warehouse cache');
    }

    // Metadata Cache 권장
    if (/INFORMATION_SCHEMA|SHOW/i.test(query)) {
      strategies.push('Metadata queries automatically use metadata cache');
    }

    return strategies;
  }

  /**
   * Snowflake Time Travel 최적화
   */
  optimizeTimeTravel(query: string): string {
    // Time Travel 쿼리 최적화
    if (/AT\s*\(|BEFORE\s*\(/i.test(query)) {
      this.logger.log('Time Travel query detected', {
        recommendation: 'Time Travel queries may be slower and more expensive',
        suggestion: 'Consider materializing historical data if frequently accessed',
      });
    }

    return query;
  }

  /**
   * Snowflake 제로카피 클론 권장
   */
  recommendZeroCopyClone(tableName: string): string[] {
    const recommendations: string[] = [];

    recommendations.push(`CREATE TABLE ${tableName}_clone CLONE ${tableName}`);
    recommendations.push('Use zero-copy cloning for testing and development');
    recommendations.push('Clones share storage until modified, reducing costs');

    return recommendations;
  }

  /**
   * Snowflake 스트림과 태스크 최적화
   */
  optimizeStreamsAndTasks(query: string): string[] {
    const recommendations: string[] = [];

    // CDC 패턴 감지
    if (/INSERT|UPDATE|DELETE/i.test(query)) {
      recommendations.push('Consider using Snowflake Streams for change data capture');
      recommendations.push('Use Tasks for automated processing of streamed changes');
    }

    return recommendations;
  }

  /**
   * Snowflake 압축 및 파일 형식 최적화
   */
  optimizeFileFormat(fileType = 'PARQUET'): string[] {
    const recommendations: string[] = [];

    switch (fileType.toUpperCase()) {
      case 'PARQUET':
        recommendations.push('Parquet format provides excellent compression and performance');
        recommendations.push('Use columnar compression for analytical workloads');
        break;
      case 'JSON':
        recommendations.push('Consider using VARIANT data type for semi-structured data');
        recommendations.push('Use FLATTEN function to convert JSON arrays to rows');
        break;
      case 'CSV':
        recommendations.push('Consider converting CSV to Parquet for better performance');
        recommendations.push('Use COPY command with file format options');
        break;
    }

    return recommendations;
  }

  /**
   * Snowflake 보안 최적화
   */
  optimizeSecurity(query: string): string[] {
    const recommendations: string[] = [];

    // 민감한 데이터 접근 패턴 감지
    if (/PASSWORD|SSN|CREDIT_CARD|EMAIL/i.test(query)) {
      recommendations.push('Consider using Dynamic Data Masking for sensitive columns');
      recommendations.push('Implement Row Level Security for data access control');
      recommendations.push('Use column-level security for PII data');
    }

    return recommendations;
  }

  /**
   * Snowflake 쿼리 복잡도 분석
   */
  analyzeQueryComplexity(query: string): {
    complexity: 'low' | 'medium' | 'high';
    factors: string[];
    optimizationSuggestions: string[];
  } {
    const factors: string[] = [];
    const optimizationSuggestions: string[] = [];
    let complexity: 'low' | 'medium' | 'high' = 'low';

    // 복잡도 요소 분석
    const joinCount = (query.match(/JOIN/gi) || []).length;
    if (joinCount > 0) {
      factors.push(`${joinCount} JOINs`);
      if (joinCount > 3) complexity = 'high';
      else if (joinCount > 1) complexity = 'medium';
    }

    // 윈도우 함수
    if (/OVER\s*\(/i.test(query)) {
      factors.push('Window functions');
      complexity = 'high';
      optimizationSuggestions.push('Window functions benefit from clustering');
    }

    // 재귀 CTE
    if (/WITH\s+RECURSIVE/i.test(query)) {
      factors.push('Recursive CTE');
      complexity = 'high';
      optimizationSuggestions.push('Consider iterative processing for large datasets');
    }

    // PIVOT/UNPIVOT
    if (/PIVOT|UNPIVOT/i.test(query)) {
      factors.push('PIVOT/UNPIVOT operations');
      complexity = 'medium';
      optimizationSuggestions.push('PIVOT operations may benefit from larger warehouse');
    }

    return {
      complexity,
      factors,
      optimizationSuggestions,
    };
  }

  // 헬퍼 메서드들
  private extractFilterColumns(whereClause: string): string[] {
    const columns: string[] = [];

    // 간단한 필터 컬럼 추출 (실제로는 더 정교한 파싱 필요)
    const columnMatches = whereClause.match(/(\w+)\s*[=<>!]/g);
    if (columnMatches) {
      columnMatches.forEach(match => {
        const column = match.replace(/\s*[=<>!].*/, '').trim();
        if (column && !columns.includes(column)) {
          columns.push(column);
        }
      });
    }

    return columns;
  }

  private extractJoinColumns(joinCondition: string): string[] {
    const columns: string[] = [];

    // JOIN 조건에서 컬럼 추출
    const matches = joinCondition.match(/(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/);
    if (matches) {
      columns.push(matches[2], matches[4]);
    }

    return columns;
  }

  private getNextWarehouseSize(currentSize: string): string {
    const sizes = Object.keys(this.warehouseCosts);
    const currentIndex = sizes.indexOf(currentSize);

    if (currentIndex < sizes.length - 1) {
      return sizes[currentIndex + 1];
    }

    return currentSize;
  }
}
