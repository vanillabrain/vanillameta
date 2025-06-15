import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { MySQLOptimizer } from './optimizers/mysql-optimizer';
import { PostgreSQLOptimizer } from './optimizers/postgresql-optimizer';
import { BigQueryOptimizer } from './optimizers/bigquery-optimizer';
import { SnowflakeOptimizer } from './optimizers/snowflake-optimizer';

export interface DatabaseOptimizationResult {
  originalQuery: string;
  optimizedQuery: string;
  appliedOptimizations: string[];
  databaseEngine: string;
  performance: {
    estimatedImprovementPercent: number;
    recommendations: string[];
    warnings: string[];
  };
  cost?: {
    estimatedCostUSD?: number;
    estimatedBytesProcessed?: number;
    costOptimizationTips?: string[];
  };
}

export interface QueryContext {
  databaseEngine: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL' | 'UNKNOWN';
  estimatedRowCount?: number;
  tableNames?: string[];
  isAnalytical?: boolean;
  userId?: string;
}

@Injectable()
export class DatabaseSpecificQueryBuilder {
  private readonly logger = new Logger(DatabaseSpecificQueryBuilder.name);

  constructor(
    private readonly mysqlOptimizer: MySQLOptimizer,
    private readonly postgresqlOptimizer: PostgreSQLOptimizer,
    private readonly bigqueryOptimizer: BigQueryOptimizer,
    private readonly snowflakeOptimizer: SnowflakeOptimizer,
  ) {}

  /**
   * 데이터베이스별 최적화된 쿼리 빌드
   */
  async buildOptimizedQuery(
    baseQuery: Knex.QueryBuilder | string,
    context: QueryContext,
  ): Promise<DatabaseOptimizationResult> {
    const queryString = typeof baseQuery === 'string' ? baseQuery : baseQuery.toString();
    const databaseEngine = context.databaseEngine.toLowerCase();

    this.logger.debug('Building optimized query', {
      databaseEngine,
      queryType: context.queryType,
      queryLength: queryString.length,
      userId: context.userId,
    });

    try {
      const result = await this.optimizeForDatabase(queryString, context);
      
      this.logger.log('Query optimization completed', {
        databaseEngine,
        originalLength: queryString.length,
        optimizedLength: result.optimizedQuery.length,
        optimizationsCount: result.appliedOptimizations.length,
        estimatedImprovement: result.performance.estimatedImprovementPercent,
      });

      return result;
    } catch (error) {
      this.logger.error('Query optimization failed', error.stack, {
        databaseEngine,
        queryType: context.queryType,
        error: error.message,
      });

      // 최적화 실패 시 원본 쿼리 반환
      return {
        originalQuery: queryString,
        optimizedQuery: queryString,
        appliedOptimizations: [],
        databaseEngine,
        performance: {
          estimatedImprovementPercent: 0,
          recommendations: [],
          warnings: [`Optimization failed: ${error.message}`],
        },
      };
    }
  }

  /**
   * 데이터베이스별 쿼리 최적화 실행
   */
  private async optimizeForDatabase(
    query: string,
    context: QueryContext,
  ): Promise<DatabaseOptimizationResult> {
    const databaseEngine = context.databaseEngine.toLowerCase();
    
    switch (databaseEngine) {
      case 'mysql':
      case 'mysql2':
      case 'mariadb':
        return this.optimizeForMySQL(query, context);
      
      case 'postgresql':
      case 'postgres':
      case 'pg':
      case 'cockroachdb':
        return this.optimizeForPostgreSQL(query, context);
      
      case 'bigquery':
        return this.optimizeForBigQuery(query, context);
      
      case 'snowflake':
        return this.optimizeForSnowflake(query, context);
      
      case 'oracle':
      case 'oracledb':
        return this.optimizeForOracle(query, context);
      
      case 'mssql':
      case 'sqlserver':
        return this.optimizeForSQLServer(query, context);
      
      default:
        return this.getDefaultOptimization(query, context);
    }
  }

  /**
   * MySQL 최적화
   */
  private optimizeForMySQL(query: string, context: QueryContext): DatabaseOptimizationResult {
    const appliedOptimizations: string[] = [];
    let optimizedQuery = query;

    try {
      // 1. MySQL 집계 쿼리 최적화
      if (context.queryType === 'SELECT' && /GROUP\s+BY|COUNT|SUM|AVG/i.test(query)) {
        const aggregationResult = this.mysqlOptimizer.optimizeAggregationQuery(query);
        optimizedQuery = aggregationResult.optimizedQuery;
        appliedOptimizations.push(...aggregationResult.appliedOptimizations);
      }

      // 2. MySQL JSON 쿼리 최적화
      if (/->|JSON_EXTRACT/i.test(query)) {
        optimizedQuery = this.mysqlOptimizer.optimizeJsonQuery(optimizedQuery);
        appliedOptimizations.push('JSON query optimization applied');
      }

      // 3. 페이지네이션 최적화
      const limitMatch = query.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
      if (limitMatch) {
        const limit = parseInt(limitMatch[1]);
        const offset = parseInt(limitMatch[2] || '0');
        optimizedQuery = this.mysqlOptimizer.optimizePagination(optimizedQuery, offset, limit);
        appliedOptimizations.push('Pagination optimization applied');
      }

      // 4. 쿼리 분석 및 권장사항
      const analysis = this.mysqlOptimizer.analyzeQuery(optimizedQuery);
      
      return {
        originalQuery: query,
        optimizedQuery,
        appliedOptimizations,
        databaseEngine: 'mysql',
        performance: {
          estimatedImprovementPercent: appliedOptimizations.length * 15,
          recommendations: analysis.recommendations,
          warnings: analysis.complexity === 'high' ? ['High complexity query detected'] : [],
        },
      };
    } catch (error) {
      this.logger.warn('MySQL optimization error', error.message);
      return this.getDefaultOptimization(query, context);
    }
  }

  /**
   * PostgreSQL 최적화
   */
  private async optimizeForPostgreSQL(query: string, context: QueryContext): Promise<DatabaseOptimizationResult> {
    const appliedOptimizations: string[] = [];
    let optimizedQuery = query;

    try {
      // 1. 전문 검색 최적화
      if (/LIKE.*%.*%|ILIKE/i.test(query)) {
        const fullTextResult = this.postgresqlOptimizer.optimizeFullTextSearch(query);
        optimizedQuery = fullTextResult.optimizedQuery;
        appliedOptimizations.push(...fullTextResult.appliedOptimizations);
      }

      // 2. CTE 최적화
      if (/WITH\s+/i.test(query)) {
        const cteResult = this.postgresqlOptimizer.optimizeCTE(query);
        optimizedQuery = cteResult.optimizedQuery;
        appliedOptimizations.push(...cteResult.appliedOptimizations);
      }

      // 3. 윈도우 함수 최적화
      if (/OVER\s*\(/i.test(query)) {
        const windowResult = this.postgresqlOptimizer.optimizeWindowFunctions(query);
        optimizedQuery = windowResult.optimizedQuery;
        appliedOptimizations.push(...windowResult.appliedOptimizations);
      }

      // 4. 쿼리 복잡도 분석
      const complexity = this.postgresqlOptimizer.analyzeQueryComplexity(query);

      return {
        originalQuery: query,
        optimizedQuery,
        appliedOptimizations,
        databaseEngine: 'postgresql',
        performance: {
          estimatedImprovementPercent: appliedOptimizations.length * 18,
          recommendations: complexity.recommendations,
          warnings: complexity.complexity === 'high' ? ['Complex query - consider optimization'] : [],
        },
      };
    } catch (error) {
      this.logger.warn('PostgreSQL optimization error', error.message);
      return this.getDefaultOptimization(query, context);
    }
  }

  /**
   * BigQuery 최적화
   */
  private optimizeForBigQuery(query: string, context: QueryContext): DatabaseOptimizationResult {
    const appliedOptimizations: string[] = [];
    let optimizedQuery = query;

    try {
      // 1. SELECT * 최적화
      const selectStarResult = this.bigqueryOptimizer.optimizeSelectStar(query);
      optimizedQuery = selectStarResult.optimizedQuery;
      appliedOptimizations.push(...selectStarResult.appliedOptimizations);

      // 2. 파티션 프루닝 최적화
      const partitionResult = this.bigqueryOptimizer.optimizePartitionPruning(optimizedQuery);
      optimizedQuery = partitionResult.optimizedQuery;
      appliedOptimizations.push(...partitionResult.appliedOptimizations);

      // 3. JOIN 최적화
      if (/JOIN/i.test(query)) {
        const joinResult = this.bigqueryOptimizer.optimizeJoins(optimizedQuery);
        optimizedQuery = joinResult.optimizedQuery;
        appliedOptimizations.push(...joinResult.appliedOptimizations);
      }

      // 4. 집계 최적화
      if (/GROUP\s+BY|COUNT|SUM|AVG/i.test(query)) {
        const aggregationResult = this.bigqueryOptimizer.optimizeAggregation(optimizedQuery);
        optimizedQuery = aggregationResult.optimizedQuery;
        appliedOptimizations.push(...aggregationResult.appliedOptimizations);
      }

      // 5. 날짜 함수 최적화
      optimizedQuery = this.bigqueryOptimizer.optimizeDateFunctions(optimizedQuery);

      // 6. 비용 추정
      const costEstimate = this.bigqueryOptimizer.estimateQueryCost(optimizedQuery);
      
      // 7. 쿼리 복잡도 분석
      const complexity = this.bigqueryOptimizer.analyzeQueryComplexity(optimizedQuery);

      return {
        originalQuery: query,
        optimizedQuery,
        appliedOptimizations,
        databaseEngine: 'bigquery',
        performance: {
          estimatedImprovementPercent: appliedOptimizations.length * 20,
          recommendations: complexity.slotRecommendations,
          warnings: costEstimate.estimatedCostUSD > 10 ? ['High cost query detected'] : [],
        },
        cost: {
          estimatedCostUSD: costEstimate.estimatedCostUSD,
          estimatedBytesProcessed: costEstimate.estimatedBytesProcessed,
          costOptimizationTips: [
            'Use column selection instead of SELECT *',
            'Add partition filters to reduce data processed',
            'Consider materializing frequently used aggregations',
          ],
        },
      };
    } catch (error) {
      this.logger.warn('BigQuery optimization error', error.message);
      return this.getDefaultOptimization(query, context);
    }
  }

  /**
   * Snowflake 최적화
   */
  private optimizeForSnowflake(query: string, context: QueryContext): DatabaseOptimizationResult {
    const appliedOptimizations: string[] = [];
    let optimizedQuery = query;

    try {
      // 1. 쿼리 태그 추가
      optimizedQuery = this.snowflakeOptimizer.addQueryTags(optimizedQuery, {
        user: context.userId || 'unknown',
        queryType: context.queryType,
      });
      appliedOptimizations.push('Query tags added for monitoring');

      // 2. 클러스터링 키 최적화
      const clusteringResult = this.snowflakeOptimizer.optimizeClusteringKeys(optimizedQuery);
      optimizedQuery = clusteringResult.optimizedQuery;
      appliedOptimizations.push(...clusteringResult.appliedOptimizations);

      // 3. Time Travel 최적화
      optimizedQuery = this.snowflakeOptimizer.optimizeTimeTravel(optimizedQuery);

      // 4. 웨어하우스 권장사항
      const warehouseRecommendations = this.snowflakeOptimizer.analyzeWarehouseRequirements(optimizedQuery);
      
      // 5. 쿼리 복잡도 분석
      const complexity = this.snowflakeOptimizer.analyzeQueryComplexity(optimizedQuery);

      return {
        originalQuery: query,
        optimizedQuery,
        appliedOptimizations,
        databaseEngine: 'snowflake',
        performance: {
          estimatedImprovementPercent: appliedOptimizations.length * 22,
          recommendations: [
            `Recommended warehouse size: ${warehouseRecommendations.suggestedSize}`,
            ...complexity.optimizationSuggestions,
            ...clusteringResult.performance.clusteringRecommendations,
          ],
          warnings: complexity.complexity === 'high' ? ['Complex query - consider larger warehouse'] : [],
        },
        cost: {
          costOptimizationTips: [
            `Use ${warehouseRecommendations.suggestedSize} warehouse (${warehouseRecommendations.estimatedCostImpact})`,
            'Enable result caching for repeated queries',
            'Consider clustering tables for better performance',
          ],
        },
      };
    } catch (error) {
      this.logger.warn('Snowflake optimization error', error.message);
      return this.getDefaultOptimization(query, context);
    }
  }

  /**
   * Oracle 최적화
   */
  private optimizeForOracle(query: string, context: QueryContext): DatabaseOptimizationResult {
    const appliedOptimizations: string[] = [];
    let optimizedQuery = query;

    // Oracle 힌트 추가
    if (/SELECT.*FROM.*WHERE.*ORDER.*ROWNUM/i.test(query)) {
      optimizedQuery = query.replace(/SELECT/i, 'SELECT /*+ FIRST_ROWS */');
      appliedOptimizations.push('FIRST_ROWS hint added for Oracle');
    }

    // 병렬 처리 힌트 (집계 쿼리의 경우)
    if (/GROUP\s+BY/i.test(query) && context.isAnalytical) {
      optimizedQuery = optimizedQuery.replace(/SELECT/i, 'SELECT /*+ PARALLEL(4) */');
      appliedOptimizations.push('Parallel processing hint added for Oracle');
    }

    return {
      originalQuery: query,
      optimizedQuery,
      appliedOptimizations,
      databaseEngine: 'oracle',
      performance: {
        estimatedImprovementPercent: appliedOptimizations.length * 12,
        recommendations: [
          'Consider using Oracle-specific functions for better performance',
          'Use bind variables to improve cursor sharing',
        ],
        warnings: [],
      },
    };
  }

  /**
   * SQL Server 최적화
   */
  private optimizeForSQLServer(query: string, context: QueryContext): DatabaseOptimizationResult {
    const appliedOptimizations: string[] = [];
    let optimizedQuery = query;

    // Columnstore 힌트 (집계 쿼리의 경우)
    if (/GROUP\s+BY/i.test(query)) {
      optimizedQuery = query.replace(/SELECT/i, 'SELECT /*+ USE COLUMNSTORE */');
      appliedOptimizations.push('Columnstore hint added for SQL Server');
    }

    // NOLOCK 힌트 (읽기 전용 쿼리의 경우)
    if (context.queryType === 'SELECT' && !context.isAnalytical) {
      const fromPattern = /FROM\s+(\w+)(?!\s+WITH)/i;
      if (fromPattern.test(query)) {
        optimizedQuery = optimizedQuery.replace(fromPattern, 'FROM $1 WITH (NOLOCK)');
        appliedOptimizations.push('NOLOCK hint added for SQL Server');
      }
    }

    return {
      originalQuery: query,
      optimizedQuery,
      appliedOptimizations,
      databaseEngine: 'sqlserver',
      performance: {
        estimatedImprovementPercent: appliedOptimizations.length * 10,
        recommendations: [
          'Consider using columnstore indexes for analytical queries',
          'Use appropriate isolation levels for transactional consistency',
        ],
        warnings: appliedOptimizations.includes('NOLOCK hint added') ? 
          ['NOLOCK may read uncommitted data'] : [],
      },
    };
  }

  /**
   * 기본 최적화 (지원되지 않는 데이터베이스)
   */
  private getDefaultOptimization(query: string, context: QueryContext): DatabaseOptimizationResult {
    return {
      originalQuery: query,
      optimizedQuery: query,
      appliedOptimizations: [],
      databaseEngine: context.databaseEngine,
      performance: {
        estimatedImprovementPercent: 0,
        recommendations: [
          'Database-specific optimizations not available for this engine',
          'Consider using standard SQL optimization techniques',
        ],
        warnings: [`Optimization not supported for ${context.databaseEngine}`],
      },
    };
  }

  /**
   * 쿼리 타입 감지
   */
  detectQueryType(query: string): QueryContext['queryType'] {
    const upperQuery = query.trim().toUpperCase();
    
    if (upperQuery.startsWith('SELECT')) return 'SELECT';
    if (upperQuery.startsWith('INSERT')) return 'INSERT';
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
    if (upperQuery.startsWith('DELETE')) return 'DELETE';
    if (/^(CREATE|ALTER|DROP)\s/i.test(upperQuery)) return 'DDL';
    
    return 'UNKNOWN';
  }

  /**
   * 테이블명 추출
   */
  extractTableNames(query: string): string[] {
    const tableNames: string[] = [];
    
    // FROM 절에서 테이블명 추출
    const fromMatches = query.match(/FROM\s+(\w+)/gi);
    if (fromMatches) {
      fromMatches.forEach(match => {
        const tableName = match.replace(/FROM\s+/i, '').trim();
        if (tableName && !tableNames.includes(tableName)) {
          tableNames.push(tableName);
        }
      });
    }

    // JOIN 절에서 테이블명 추출
    const joinMatches = query.match(/JOIN\s+(\w+)/gi);
    if (joinMatches) {
      joinMatches.forEach(match => {
        const tableName = match.replace(/JOIN\s+/i, '').trim();
        if (tableName && !tableNames.includes(tableName)) {
          tableNames.push(tableName);
        }
      });
    }

    return tableNames;
  }

  /**
   * 분석 쿼리 여부 판단
   */
  isAnalyticalQuery(query: string): boolean {
    const analyticalPatterns = [
      /GROUP\s+BY/i,
      /COUNT\s*\(/i,
      /SUM\s*\(/i,
      /AVG\s*\(/i,
      /MAX\s*\(/i,
      /MIN\s*\(/i,
      /OVER\s*\(/i, // Window functions
      /WITH\s+/i,   // CTEs
    ];

    return analyticalPatterns.some(pattern => pattern.test(query));
  }
}