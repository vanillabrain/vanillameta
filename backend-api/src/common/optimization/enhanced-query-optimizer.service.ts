import { Injectable, Logger } from '@nestjs/common';
import {
  DatabaseSpecificOptimizationService,
  OptimizationResult,
} from './database-specific-optimization.service';
import { QueryCacheService } from './query-cache.service';
import {
  IndexRecommendationService,
  IndexRecommendationReport,
} from './index-recommendation.service';
import { EnhancedConnectionPoolService } from './enhanced-connection-pool.service';
import { QueryAnalyzerService, QueryAnalysis } from '../monitoring/query-analyzer.service';
import { CustomLoggerService } from '../logger/logger.service';
import { Knex } from 'knex';
import { Database } from '../../database/entities/database.entity';

export interface EnhancedQueryAnalysis extends QueryAnalysis {
  // 기존 분석에 추가 정보
  optimizations: {
    appliedRules: string[];
    cacheStatus: 'hit' | 'miss' | 'stored' | 'invalidated';
    poolMetrics: {
      acquisitionTime: number;
      connectionReused: boolean;
    };
    recommendations: {
      indexSuggestions: string[];
      queryRewrite: string;
      performanceGain: number;
    };
  };
  databaseSpecific: {
    engine: string;
    engineVersion?: string;
    optimizationLevel: 'none' | 'basic' | 'advanced' | 'expert';
    engineFeatures: string[];
  };
}

export interface QueryOptimizationSession {
  sessionId: string;
  databaseId: number;
  engine: string;
  startTime: Date;
  totalQueries: number;
  optimizedQueries: number;
  cacheHitRate: number;
  averageSpeedup: number;
  recommendations: {
    applied: number;
    pending: number;
    rejected: number;
  };
}

export interface OptimizationStrategy {
  name: string;
  engine: string;
  priority: 'high' | 'medium' | 'low';
  conditions: Array<{
    type: 'query_pattern' | 'table_size' | 'column_cardinality' | 'execution_time';
    operator: 'gt' | 'lt' | 'eq' | 'contains' | 'matches';
    value: any;
  }>;
  actions: Array<{
    type: 'rewrite_query' | 'add_hint' | 'suggest_index' | 'partition_table' | 'update_statistics';
    parameters: any;
  }>;
  expectedGain: number;
}

@Injectable()
export class EnhancedQueryOptimizerService {
  private readonly logger = new Logger(EnhancedQueryOptimizerService.name);
  private readonly optimizationSessions = new Map<string, QueryOptimizationSession>();
  private readonly customStrategies = new Map<string, OptimizationStrategy[]>();

  constructor(
    private readonly dbOptimizationService: DatabaseSpecificOptimizationService,
    private readonly queryCacheService: QueryCacheService,
    private readonly indexRecommendationService: IndexRecommendationService,
    private readonly connectionPoolService: EnhancedConnectionPoolService,
    private readonly queryAnalyzerService: QueryAnalyzerService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.initializeOptimizationStrategies();
  }

  /**
   * 최적화 전략 초기화
   */
  private initializeOptimizationStrategies(): void {
    // PostgreSQL 전략
    this.customStrategies.set('pg', [
      {
        name: 'large-table-seq-scan-optimization',
        engine: 'pg',
        priority: 'high',
        conditions: [
          { type: 'table_size', operator: 'gt', value: 1000000 },
          { type: 'query_pattern', operator: 'contains', value: 'SELECT * FROM' },
        ],
        actions: [
          { type: 'rewrite_query', parameters: { addLimit: 10000 } },
          { type: 'add_hint', parameters: { hint: 'LIMIT' } },
        ],
        expectedGain: 70,
      },
      {
        name: 'json-column-gin-index',
        engine: 'pg',
        priority: 'medium',
        conditions: [{ type: 'query_pattern', operator: 'matches', value: /->|->>/g }],
        actions: [{ type: 'suggest_index', parameters: { type: 'gin', columns: ['json_column'] } }],
        expectedGain: 60,
      },
    ]);

    // MySQL 전략
    this.customStrategies.set('mysql2', [
      {
        name: 'innodb-optimization',
        engine: 'mysql2',
        priority: 'high',
        conditions: [
          { type: 'execution_time', operator: 'gt', value: 5000 },
          { type: 'query_pattern', operator: 'contains', value: 'ORDER BY' },
        ],
        actions: [
          { type: 'add_hint', parameters: { hint: 'USE INDEX' } },
          { type: 'suggest_index', parameters: { type: 'btree', orderBy: true } },
        ],
        expectedGain: 50,
      },
    ]);

    // SQL Server 전략
    this.customStrategies.set('mssql', [
      {
        name: 'columnstore-for-analytics',
        engine: 'mssql',
        priority: 'medium',
        conditions: [
          { type: 'query_pattern', operator: 'contains', value: 'GROUP BY' },
          { type: 'table_size', operator: 'gt', value: 100000 },
        ],
        actions: [{ type: 'suggest_index', parameters: { type: 'columnstore' } }],
        expectedGain: 80,
      },
    ]);

    // BigQuery 전략
    this.customStrategies.set('bigquery', [
      {
        name: 'partition-pruning',
        engine: 'bigquery',
        priority: 'high',
        conditions: [
          { type: 'query_pattern', operator: 'contains', value: 'SELECT' },
          { type: 'query_pattern', operator: 'contains', value: 'WHERE' },
        ],
        actions: [{ type: 'rewrite_query', parameters: { addPartitionFilter: true } }],
        expectedGain: 90,
      },
    ]);
  }

  /**
   * 포괄적인 쿼리 최적화 실행
   */
  async optimizeQuery(
    knexInstance: Knex,
    database: Database,
    query: string,
    parameters?: any[],
    sessionId?: string,
  ): Promise<{
    optimizedQuery: string;
    analysis: EnhancedQueryAnalysis;
    cacheResult?: { data: any; fields: any[] };
    recommendations: string[];
  }> {
    const startTime = Date.now();
    const engine = database.engine;
    const databaseId = database.id;

    // 1. 세션 관리
    const session = this.getOrCreateSession(sessionId, databaseId, engine);
    session.totalQueries++;

    // 2. 캐시 확인
    const cachedResult = await this.queryCacheService.get(engine, query, parameters);
    if (cachedResult) {
      session.cacheHitRate =
        (session.cacheHitRate * (session.totalQueries - 1) + 1) / session.totalQueries;

      this.customLogger.info('Query served from cache', 'EnhancedQueryOptimizerService', {
        databaseId,
        engine,
        sessionId: session.sessionId,
        cacheHit: true,
      });

      return {
        optimizedQuery: query,
        analysis: await this.createEnhancedAnalysis(query, engine, { cacheStatus: 'hit' }),
        cacheResult: cachedResult,
        recommendations: [],
      };
    }

    // 3. 연결 풀 최적화 적용
    const poolStartTime = Date.now();
    const poolMetrics = {
      acquisitionTime: 0,
      connectionReused: this.connectionPoolService.hasConnection(databaseId),
    };

    try {
      // 4. 데이터베이스별 쿼리 최적화 적용
      const { optimizedQuery, appliedOptimizations } = this.dbOptimizationService.optimizeQuery(
        query,
        engine,
      );

      // 5. 고급 최적화 전략 적용
      const advancedOptimizations = await this.applyAdvancedOptimizations(
        optimizedQuery,
        engine,
        knexInstance,
        database,
      );

      // 6. 쿼리 분석 실행
      const baseAnalysis = await this.queryAnalyzerService.analyzeQuery(optimizedQuery, databaseId);

      // 7. 향상된 분석 생성
      poolMetrics.acquisitionTime = Date.now() - poolStartTime;
      const enhancedAnalysis = await this.createEnhancedAnalysis(optimizedQuery, engine, {
        appliedRules: [...appliedOptimizations, ...advancedOptimizations.appliedRules],
        cacheStatus: 'miss',
        poolMetrics,
        baseAnalysis,
      });

      // 8. 인덱스 추천 (비동기)
      this.generateIndexRecommendationsAsync(knexInstance, engine, database.name, [optimizedQuery]);

      // 9. 세션 통계 업데이트
      session.optimizedQueries++;
      const executionTime = Date.now() - startTime;
      const speedup = baseAnalysis.executionTime
        ? Math.max(1, baseAnalysis.executionTime / executionTime)
        : 1;
      session.averageSpeedup =
        (session.averageSpeedup * (session.optimizedQueries - 1) + speedup) /
        session.optimizedQueries;

      this.customLogger.info('Query optimization completed', 'EnhancedQueryOptimizerService', {
        databaseId,
        engine,
        sessionId: session.sessionId,
        originalQueryLength: query.length,
        optimizedQueryLength: advancedOptimizations.finalQuery.length,
        appliedOptimizations: enhancedAnalysis.optimizations.appliedRules,
        executionTime,
        speedup,
      });

      return {
        optimizedQuery: advancedOptimizations.finalQuery,
        analysis: enhancedAnalysis,
        recommendations: advancedOptimizations.recommendations,
      };
    } catch (error) {
      this.logger.error(`Query optimization failed for database ${databaseId}`, error.stack);

      // 실패 시 원본 쿼리와 기본 분석 반환
      return {
        optimizedQuery: query,
        analysis: await this.createEnhancedAnalysis(query, engine, {
          cacheStatus: 'miss',
          poolMetrics,
          error: error.message,
        }),
        recommendations: [`Optimization failed: ${error.message}`],
      };
    }
  }

  /**
   * 고급 최적화 전략 적용
   */
  private async applyAdvancedOptimizations(
    query: string,
    engine: string,
    knexInstance: Knex,
    database: Database,
  ): Promise<{
    finalQuery: string;
    appliedRules: string[];
    recommendations: string[];
  }> {
    let finalQuery = query;
    const appliedRules: string[] = [];
    const recommendations: string[] = [];

    const strategies = this.customStrategies.get(engine) || [];

    for (const strategy of strategies) {
      try {
        // 조건 확인
        const conditionsMet = await this.evaluateStrategyConditions(
          strategy.conditions,
          query,
          knexInstance,
          database,
        );

        if (conditionsMet) {
          // 액션 적용
          const result = await this.applyStrategyActions(
            strategy.actions,
            finalQuery,
            engine,
            database,
          );

          finalQuery = result.modifiedQuery;
          appliedRules.push(strategy.name);
          recommendations.push(...result.recommendations);

          this.customLogger.debug(
            'Advanced optimization strategy applied',
            'EnhancedQueryOptimizerService',
            {
              strategy: strategy.name,
              engine,
              priority: strategy.priority,
              expectedGain: strategy.expectedGain,
            },
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to apply strategy ${strategy.name}: ${error.message}`);
      }
    }

    return { finalQuery, appliedRules, recommendations };
  }

  /**
   * 전략 조건 평가
   */
  private async evaluateStrategyConditions(
    conditions: OptimizationStrategy['conditions'],
    query: string,
    knexInstance: Knex,
    database: Database,
  ): Promise<boolean> {
    for (const condition of conditions) {
      try {
        let satisfied = false;

        switch (condition.type) {
          case 'query_pattern':
            if (condition.operator === 'contains') {
              satisfied = query.toLowerCase().includes(condition.value.toLowerCase());
            } else if (condition.operator === 'matches') {
              satisfied = condition.value.test(query);
            }
            break;

          case 'table_size':
            // 테이블 크기는 간단한 예시로 구현
            satisfied = true; // 실제로는 테이블 통계 조회 필요
            break;

          case 'execution_time':
            // 실행 시간은 이전 분석 결과에서 가져와야 함
            satisfied = true; // 임시
            break;

          case 'column_cardinality':
            // 컬럼 카디널리티 확인
            satisfied = true; // 임시
            break;
        }

        if (!satisfied) {
          return false;
        }
      } catch (error) {
        this.logger.debug(`Failed to evaluate condition: ${error.message}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 전략 액션 적용
   */
  private async applyStrategyActions(
    actions: OptimizationStrategy['actions'],
    query: string,
    engine: string,
    database: Database,
  ): Promise<{
    modifiedQuery: string;
    recommendations: string[];
  }> {
    let modifiedQuery = query;
    const recommendations: string[] = [];

    for (const action of actions) {
      switch (action.type) {
        case 'rewrite_query':
          modifiedQuery = this.rewriteQuery(modifiedQuery, action.parameters);
          break;

        case 'add_hint':
          modifiedQuery = this.addQueryHint(modifiedQuery, action.parameters.hint, engine);
          break;

        case 'suggest_index':
          recommendations.push(
            `Consider creating ${action.parameters.type} index on affected columns`,
          );
          break;

        case 'partition_table':
          recommendations.push(`Consider partitioning table for better performance`);
          break;

        case 'update_statistics':
          recommendations.push(`Update table statistics for better query planning`);
          break;
      }
    }

    return { modifiedQuery, recommendations };
  }

  /**
   * 쿼리 재작성
   */
  private rewriteQuery(query: string, parameters: any): string {
    let rewritten = query;

    if (parameters.addLimit && !query.toLowerCase().includes('limit')) {
      rewritten += ` LIMIT ${parameters.addLimit}`;
    }

    if (parameters.addPartitionFilter) {
      // BigQuery 파티션 필터 추가 로직
      const dateColumn = '_PARTITIONTIME';
      if (!query.toLowerCase().includes(dateColumn.toLowerCase())) {
        const whereIndex = query.toLowerCase().indexOf('where');
        if (whereIndex !== -1) {
          const beforeWhere = query.substring(0, whereIndex + 5);
          const afterWhere = query.substring(whereIndex + 5);
          rewritten = `${beforeWhere} ${dateColumn} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AND${afterWhere}`;
        }
      }
    }

    return rewritten;
  }

  /**
   * 쿼리 힌트 추가
   */
  private addQueryHint(query: string, hint: string, engine: string): string {
    switch (engine) {
      case 'mysql2':
        if (hint === 'USE INDEX') {
          return query.replace(/FROM\s+(\w+)/i, 'FROM $1 USE INDEX (PRIMARY)');
        }
        break;

      case 'mssql':
        if (hint === 'NOLOCK') {
          return query.replace(/FROM\s+(\w+)/i, 'FROM $1 WITH (NOLOCK)');
        }
        break;

      case 'oracledb':
        if (hint === 'FIRST_ROWS') {
          return query.replace(/SELECT/i, 'SELECT /*+ FIRST_ROWS */');
        }
        break;
    }

    return query;
  }

  /**
   * 향상된 분석 생성
   */
  private async createEnhancedAnalysis(
    query: string,
    engine: string,
    context: any,
  ): Promise<EnhancedQueryAnalysis> {
    const baseAnalysis = context.baseAnalysis || {
      query: query.substring(0, 200),
      warnings: [],
      optimizationSuggestions: [],
    };

    const engineFeatures = this.getEngineFeatures(engine);

    return {
      ...baseAnalysis,
      optimizations: {
        appliedRules: context.appliedRules || [],
        cacheStatus: context.cacheStatus || 'miss',
        poolMetrics: context.poolMetrics || { acquisitionTime: 0, connectionReused: false },
        recommendations: {
          indexSuggestions: [],
          queryRewrite: query,
          performanceGain: 0,
        },
      },
      databaseSpecific: {
        engine,
        engineVersion: await this.getEngineVersion(engine),
        optimizationLevel: this.determineOptimizationLevel(context.appliedRules?.length || 0),
        engineFeatures,
      },
    };
  }

  /**
   * 엔진별 기능 목록 반환
   */
  private getEngineFeatures(engine: string): string[] {
    const features = {
      pg: [
        'Advanced indexing (GIN, GIST)',
        'JSON operations',
        'Window functions',
        'CTEs',
        'Parallel query',
      ],
      mysql2: ['InnoDB storage engine', 'Partitioning', 'Full-text indexing', 'JSON support'],
      mssql: ['Columnstore indexes', 'In-memory OLTP', 'Query store', 'Adaptive query processing'],
      oracledb: ['Advanced analytics', 'Partitioning', 'Parallel execution', 'Result cache'],
      bigquery: ['Columnar storage', 'Automatic partitioning', 'Machine learning', 'Serverless'],
      snowflake: ['Multi-cluster', 'Time travel', 'Zero-copy cloning', 'Automatic scaling'],
    };

    return features[engine] || [];
  }

  /**
   * 엔진 버전 조회
   */
  private async getEngineVersion(engine: string): Promise<string> {
    // 실제 구현에서는 데이터베이스에서 버전 정보를 조회
    const versions = {
      pg: '13.x',
      mysql2: '8.x',
      mssql: '2019',
      oracledb: '19c',
      bigquery: 'Latest',
      snowflake: 'Latest',
    };

    return versions[engine] || 'Unknown';
  }

  /**
   * 최적화 수준 결정
   */
  private determineOptimizationLevel(
    appliedRulesCount: number,
  ): 'none' | 'basic' | 'advanced' | 'expert' {
    if (appliedRulesCount === 0) return 'none';
    if (appliedRulesCount <= 2) return 'basic';
    if (appliedRulesCount <= 5) return 'advanced';
    return 'expert';
  }

  /**
   * 세션 가져오기 또는 생성
   */
  private getOrCreateSession(
    sessionId: string | undefined,
    databaseId: number,
    engine: string,
  ): QueryOptimizationSession {
    const id = sessionId || `session_${databaseId}_${Date.now()}`;

    if (!this.optimizationSessions.has(id)) {
      this.optimizationSessions.set(id, {
        sessionId: id,
        databaseId,
        engine,
        startTime: new Date(),
        totalQueries: 0,
        optimizedQueries: 0,
        cacheHitRate: 0,
        averageSpeedup: 1,
        recommendations: {
          applied: 0,
          pending: 0,
          rejected: 0,
        },
      });
    }

    return this.optimizationSessions.get(id)!;
  }

  /**
   * 비동기 인덱스 추천 생성
   */
  private async generateIndexRecommendationsAsync(
    knexInstance: Knex,
    engine: string,
    tableName: string,
    queryPatterns: string[],
  ): Promise<void> {
    try {
      setImmediate(async () => {
        try {
          const report = await this.indexRecommendationService.analyzeAndRecommend(
            knexInstance,
            engine,
            tableName,
            queryPatterns,
          );

          if (report.recommendations.length > 0) {
            this.customLogger.info(
              'Index recommendations generated',
              'EnhancedQueryOptimizerService',
              {
                tableName,
                engine,
                recommendationsCount: report.recommendations.length,
                estimatedSpeedup: report.performanceImpact.estimatedQuerySpeedup,
              },
            );
          }
        } catch (error) {
          this.logger.debug(`Failed to generate index recommendations: ${error.message}`);
        }
      });
    } catch (error) {
      this.logger.debug(`Failed to initiate index recommendation generation: ${error.message}`);
    }
  }

  /**
   * 최적화 세션 통계 반환
   */
  getSessionStats(
    sessionId?: string,
  ): Map<string, QueryOptimizationSession> | QueryOptimizationSession | null {
    if (sessionId) {
      return this.optimizationSessions.get(sessionId) || null;
    }
    return new Map(this.optimizationSessions);
  }

  /**
   * 종합 최적화 보고서 생성
   */
  async generateOptimizationReport(databaseId: number): Promise<{
    database: { id: number; engine: string };
    sessions: QueryOptimizationSession[];
    overallStats: {
      totalQueries: number;
      averageCacheHitRate: number;
      averageSpeedup: number;
      topOptimizations: Array<{ rule: string; frequency: number }>;
    };
    recommendations: {
      immediate: string[];
      shortTerm: string[];
      longTerm: string[];
    };
  }> {
    const sessions = Array.from(this.optimizationSessions.values()).filter(
      session => session.databaseId === databaseId,
    );

    const totalQueries = sessions.reduce((sum, s) => sum + s.totalQueries, 0);
    const averageCacheHitRate =
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.cacheHitRate, 0) / sessions.length
        : 0;
    const averageSpeedup =
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.averageSpeedup, 0) / sessions.length
        : 1;

    return {
      database: { id: databaseId, engine: sessions[0]?.engine || 'unknown' },
      sessions,
      overallStats: {
        totalQueries,
        averageCacheHitRate,
        averageSpeedup,
        topOptimizations: [], // 실제로는 최적화 규칙 빈도 분석 필요
      },
      recommendations: {
        immediate: [
          'Enable query caching for frequently accessed data',
          'Add indexes for commonly filtered columns',
        ],
        shortTerm: [
          'Implement connection pooling optimization',
          'Review and optimize slow queries',
        ],
        longTerm: [
          'Consider database partitioning for large tables',
          'Implement read replicas for read-heavy workloads',
        ],
      },
    };
  }

  /**
   * 캐시된 결과 저장
   */
  async storeQueryResult(
    engine: string,
    query: string,
    data: any,
    fields: any[],
    parameters?: any[],
  ): Promise<void> {
    await this.queryCacheService.set(engine, query, data, fields, parameters);
  }

  /**
   * 쿼리 기반 캐시 무효화
   */
  async invalidateCache(engine: string, query: string): Promise<void> {
    await this.queryCacheService.invalidateByQuery(engine, query);
  }
}
