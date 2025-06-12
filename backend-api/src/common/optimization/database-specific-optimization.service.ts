import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { Database } from '../../database/entities/database.entity';

export interface DatabaseOptimizationConfig {
  engine: string;
  connectionPoolConfig: Knex.PoolConfig;
  queryOptimizations: QueryOptimizationRule[];
  cacheConfig: CacheConfiguration;
  indexRecommendations: IndexRecommendation[];
}

export interface QueryOptimizationRule {
  name: string;
  description: string;
  pattern: RegExp;
  replacement: string | ((match: string) => string);
  enabled: boolean;
}

export interface CacheConfiguration {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of cached queries
  keyStrategy: 'query-hash' | 'query-params' | 'custom';
  invalidationPatterns: string[];
}

export interface IndexRecommendation {
  tableName: string;
  columns: string[];
  indexType: 'btree' | 'hash' | 'gin' | 'gist' | 'columnstore' | 'spatial';
  reason: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: number; // Performance improvement percentage
}

export interface OptimizationResult {
  engine: string;
  optimizationsApplied: string[];
  performanceImpact: {
    executionTimeReduction: number;
    memoryUsageReduction: number;
    ioReduction: number;
  };
  recommendations: IndexRecommendation[];
  warnings: string[];
}

@Injectable()
export class DatabaseSpecificOptimizationService {
  private readonly logger = new Logger(DatabaseSpecificOptimizationService.name);
  private readonly optimizationConfigs = new Map<string, DatabaseOptimizationConfig>();

  constructor() {
    this.initializeOptimizationConfigs();
  }

  /**
   * 데이터베이스별 최적화 설정 초기화
   */
  private initializeOptimizationConfigs(): void {
    // PostgreSQL 최적화 설정
    this.optimizationConfigs.set('pg', {
      engine: 'pg',
      connectionPoolConfig: {
        min: 0,
        max: parseInt(process.env.PG_POOL_MAX) || 5,
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 600000, // 10분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false,
      },
      queryOptimizations: [
        {
          name: 'limit-optimization',
          description: 'LIMIT 쿼리 최적화',
          pattern: /SELECT\s+.*\s+FROM\s+.*\s+ORDER\s+BY\s+.*\s+LIMIT\s+\d+/i,
          replacement: (match) => {
            // PostgreSQL의 경우 인덱스 스캔 힌트 추가
            return match.replace(/SELECT/i, 'SELECT /*+ IndexScan */');
          },
          enabled: true,
        },
        {
          name: 'join-optimization',
          description: 'JOIN 쿼리 최적화',
          pattern: /SELECT\s+.*\s+FROM\s+.*\s+JOIN\s+.*\s+ON\s+.*/i,
          replacement: (match) => {
            // PostgreSQL의 경우 적절한 JOIN 순서 힌트
            return match.replace(/JOIN/i, 'JOIN /*+ NestLoop */');
          },
          enabled: false, // 기본적으로 비활성화
        },
      ],
      cacheConfig: {
        enabled: true,
        ttl: 3600, // 1시간
        maxSize: 1000,
        keyStrategy: 'query-hash',
        invalidationPatterns: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER'],
      },
      indexRecommendations: [],
    });

    // MySQL 최적화 설정
    this.optimizationConfigs.set('mysql2', {
      engine: 'mysql2',
      connectionPoolConfig: {
        min: 0,
        max: parseInt(process.env.MYSQL_POOL_MAX) || 3,
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000, // 5분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false,
      },
      queryOptimizations: [
        {
          name: 'force-index',
          description: 'MySQL 강제 인덱스 사용',
          pattern: /SELECT\s+.*\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=/i,
          replacement: (match) => {
            const matches = match.match(/FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=/i);
            if (matches) {
              const [, tableName, columnName] = matches;
              return match.replace(
                `FROM ${tableName}`,
                `FROM ${tableName} FORCE INDEX (idx_${columnName})`
              );
            }
            return match;
          },
          enabled: false,
        },
        {
          name: 'limit-optimization',
          description: 'MySQL LIMIT 최적화',
          pattern: /SELECT\s+.*\s+FROM\s+.*\s+ORDER\s+BY\s+.*\s+LIMIT\s+(\d+)/i,
          replacement: (match) => {
            // MySQL의 경우 큰 LIMIT은 성능에 영향
            const limitMatch = match.match(/LIMIT\s+(\d+)/i);
            if (limitMatch && parseInt(limitMatch[1]) > 10000) {
              return match.replace(/LIMIT\s+\d+/i, 'LIMIT 10000');
            }
            return match;
          },
          enabled: true,
        },
      ],
      cacheConfig: {
        enabled: true,
        ttl: 1800, // 30분
        maxSize: 500,
        keyStrategy: 'query-hash',
        invalidationPatterns: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER'],
      },
      indexRecommendations: [],
    });

    // SQL Server 최적화 설정
    this.optimizationConfigs.set('mssql', {
      engine: 'mssql',
      connectionPoolConfig: {
        min: 0,
        max: parseInt(process.env.MSSQL_POOL_MAX) || 4,
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false,
      },
      queryOptimizations: [
        {
          name: 'nolock-hint',
          description: 'SQL Server NOLOCK 힌트',
          pattern: /SELECT\s+.*\s+FROM\s+(\w+)\s+(?!WITH)/i,
          replacement: (match) => {
            return match.replace(/FROM\s+(\w+)/i, 'FROM $1 WITH (NOLOCK)');
          },
          enabled: false, // 데이터 일관성 문제로 기본 비활성화
        },
        {
          name: 'columnstore-hint',
          description: 'SQL Server Columnstore 힌트',
          pattern: /SELECT\s+.*\s+FROM\s+.*\s+GROUP\s+BY\s+.*/i,
          replacement: (match) => {
            return match.replace(/SELECT/i, 'SELECT /*+ USE COLUMNSTORE */');
          },
          enabled: true,
        },
      ],
      cacheConfig: {
        enabled: true,
        ttl: 2700, // 45분
        maxSize: 800,
        keyStrategy: 'query-hash',
        invalidationPatterns: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER'],
      },
      indexRecommendations: [],
    });

    // Oracle 최적화 설정
    this.optimizationConfigs.set('oracledb', {
      engine: 'oracledb',
      connectionPoolConfig: {
        min: 1, // Oracle은 최소 1개 연결 유지
        max: parseInt(process.env.ORACLE_POOL_MAX) || 4,
        createTimeoutMillis: 60000, // Oracle 연결은 더 오래 걸림
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 900000, // 15분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
        propagateCreateError: false,
      },
      queryOptimizations: [
        {
          name: 'first-rows-hint',
          description: 'Oracle FIRST_ROWS 힌트',
          pattern: /SELECT\s+.*\s+FROM\s+.*\s+WHERE\s+.*\s+ORDER\s+BY\s+.*\s+ROWNUM\s*<=\s*\d+/i,
          replacement: (match) => {
            return match.replace(/SELECT/i, 'SELECT /*+ FIRST_ROWS */');
          },
          enabled: true,
        },
        {
          name: 'parallel-hint',
          description: 'Oracle 병렬 처리 힌트',
          pattern: /SELECT\s+.*\s+FROM\s+.*\s+GROUP\s+BY\s+.*/i,
          replacement: (match) => {
            return match.replace(/SELECT/i, 'SELECT /*+ PARALLEL(4) */');
          },
          enabled: false, // 리소스 사용량 고려하여 기본 비활성화
        },
      ],
      cacheConfig: {
        enabled: true,
        ttl: 3600, // 1시간
        maxSize: 600,
        keyStrategy: 'query-hash',
        invalidationPatterns: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER'],
      },
      indexRecommendations: [],
    });

    // BigQuery 최적화 설정
    this.optimizationConfigs.set('bigquery', {
      engine: 'bigquery',
      connectionPoolConfig: {
        min: 0,
        max: parseInt(process.env.BIGQUERY_POOL_MAX) || 2,
        createTimeoutMillis: 60000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 1800000, // 30분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 500,
        propagateCreateError: false,
      },
      queryOptimizations: [
        {
          name: 'partition-pruning',
          description: 'BigQuery 파티션 프루닝',
          pattern: /SELECT\s+.*\s+FROM\s+.*\s+WHERE\s+(?!.*_PARTITIONTIME)/i,
          replacement: (match) => {
            // 파티션 필터가 없는 경우 경고
            return match; // 실제 변환은 복잡하므로 로깅만
          },
          enabled: true,
        },
        {
          name: 'select-optimization',
          description: 'BigQuery SELECT 최적화',
          pattern: /SELECT\s+\*\s+FROM\s+.*/i,
          replacement: (match) => {
            // SELECT * 사용 시 경고 (BigQuery는 컬럼 기반 과금)
            return match;
          },
          enabled: true,
        },
      ],
      cacheConfig: {
        enabled: true,
        ttl: 7200, // 2시간 (BigQuery 결과는 상대적으로 안정적)
        maxSize: 300,
        keyStrategy: 'query-hash',
        invalidationPatterns: [],
      },
      indexRecommendations: [],
    });

    // Snowflake 최적화 설정
    this.optimizationConfigs.set('snowflake', {
      engine: 'snowflake',
      connectionPoolConfig: {
        min: 0,
        max: parseInt(process.env.SNOWFLAKE_POOL_MAX) || 3,
        createTimeoutMillis: 60000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 1800000, // 30분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 500,
        propagateCreateError: false,
      },
      queryOptimizations: [
        {
          name: 'warehouse-optimization',
          description: 'Snowflake 웨어하우스 최적화',
          pattern: /SELECT\s+.*\s+FROM\s+.*\s+GROUP\s+BY\s+.*/i,
          replacement: (match) => {
            // 복잡한 집계 쿼리의 경우 더 큰 웨어하우스 권장
            return match;
          },
          enabled: true,
        },
        {
          name: 'clustering-hint',
          description: 'Snowflake 클러스터링 힌트',
          pattern: /SELECT\s+.*\s+FROM\s+.*\s+WHERE\s+.*\s+ORDER\s+BY\s+.*/i,
          replacement: (match) => {
            // 클러스터링 키 사용 권장
            return match;
          },
          enabled: true,
        },
      ],
      cacheConfig: {
        enabled: true,
        ttl: 3600, // 1시간
        maxSize: 400,
        keyStrategy: 'query-hash',
        invalidationPatterns: [],
      },
      indexRecommendations: [],
    });

    this.logger.log('Database-specific optimization configurations initialized');
  }

  /**
   * 특정 데이터베이스 엔진에 대한 최적화 설정 반환
   */
  getOptimizationConfig(engine: string): DatabaseOptimizationConfig | null {
    return this.optimizationConfigs.get(engine) || null;
  }

  /**
   * 쿼리에 대한 데이터베이스별 최적화 적용
   */
  optimizeQuery(query: string, engine: string): { optimizedQuery: string; appliedOptimizations: string[] } {
    const config = this.getOptimizationConfig(engine);
    if (!config) {
      return { optimizedQuery: query, appliedOptimizations: [] };
    }

    let optimizedQuery = query;
    const appliedOptimizations: string[] = [];

    for (const rule of config.queryOptimizations) {
      if (!rule.enabled) continue;

      if (rule.pattern.test(optimizedQuery)) {
        try {
          if (typeof rule.replacement === 'string') {
            optimizedQuery = optimizedQuery.replace(rule.pattern, rule.replacement);
          } else {
            optimizedQuery = rule.replacement(optimizedQuery);
          }
          appliedOptimizations.push(rule.name);
          
          this.logger.debug(`Applied optimization rule: ${rule.name}`, {
            engine,
            rule: rule.name,
            description: rule.description,
          });
        } catch (error) {
          this.logger.warn(`Failed to apply optimization rule: ${rule.name}`, {
            engine,
            error: error.message,
            query: query.substring(0, 100),
          });
        }
      }
    }

    return { optimizedQuery, appliedOptimizations };
  }

  /**
   * 연결 풀 설정 최적화
   */
  getOptimizedPoolConfig(engine: string, isProduction: boolean = false): Knex.PoolConfig {
    const config = this.getOptimizationConfig(engine);
    if (!config) {
      // 기본 설정 반환
      return {
        min: 0,
        max: 3,
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000,
        reapIntervalMillis: 1000,
      };
    }

    const poolConfig = { ...config.connectionPoolConfig };

    // 프로덕션 환경에서는 더 보수적인 설정
    if (isProduction) {
      poolConfig.max = Math.min(poolConfig.max || 3, 5);
      poolConfig.idleTimeoutMillis = (poolConfig.idleTimeoutMillis || 300000) * 0.8;
    }

    // Lambda 환경에서는 더 작은 풀 크기
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      poolConfig.max = Math.min(poolConfig.max || 3, 2);
      poolConfig.min = 0;
      poolConfig.idleTimeoutMillis = 60000; // 1분
    }

    return poolConfig;
  }

  /**
   * 캐시 설정 반환
   */
  getCacheConfig(engine: string): CacheConfiguration {
    const config = this.getOptimizationConfig(engine);
    return config?.cacheConfig || {
      enabled: false,
      ttl: 3600,
      maxSize: 100,
      keyStrategy: 'query-hash',
      invalidationPatterns: [],
    };
  }

  /**
   * 데이터베이스별 인덱스 추천
   */
  async generateIndexRecommendations(
    engine: string,
    tableAnalysis: any,
    queryPatterns: string[]
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    try {
      switch (engine) {
        case 'pg':
          recommendations.push(...this.generatePostgreSQLIndexRecommendations(tableAnalysis, queryPatterns));
          break;
        case 'mysql2':
          recommendations.push(...this.generateMySQLIndexRecommendations(tableAnalysis, queryPatterns));
          break;
        case 'mssql':
          recommendations.push(...this.generateSQLServerIndexRecommendations(tableAnalysis, queryPatterns));
          break;
        case 'oracledb':
          recommendations.push(...this.generateOracleIndexRecommendations(tableAnalysis, queryPatterns));
          break;
        default:
          this.logger.warn(`Index recommendations not supported for engine: ${engine}`);
      }
    } catch (error) {
      this.logger.error(`Failed to generate index recommendations for ${engine}`, error.stack);
    }

    return recommendations;
  }

  /**
   * PostgreSQL 인덱스 추천
   */
  private generatePostgreSQLIndexRecommendations(
    tableAnalysis: any,
    queryPatterns: string[]
  ): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // WHERE 절에서 자주 사용되는 컬럼 분석
    const whereColumns = this.extractWhereColumns(queryPatterns);
    for (const [tableName, columns] of whereColumns.entries()) {
      recommendations.push({
        tableName,
        columns: Array.from(columns),
        indexType: 'btree',
        reason: 'Frequently used in WHERE clauses',
        priority: 'high',
        estimatedImpact: 70,
      });
    }

    // JSON 컬럼에 대한 GIN 인덱스 추천
    const jsonColumns = this.extractJsonColumns(queryPatterns);
    for (const [tableName, columns] of jsonColumns.entries()) {
      recommendations.push({
        tableName,
        columns: Array.from(columns),
        indexType: 'gin',
        reason: 'JSON column operations detected',
        priority: 'medium',
        estimatedImpact: 60,
      });
    }

    // 전문 검색을 위한 GIN 인덱스
    const textSearchColumns = this.extractTextSearchColumns(queryPatterns);
    for (const [tableName, columns] of textSearchColumns.entries()) {
      recommendations.push({
        tableName,
        columns: Array.from(columns),
        indexType: 'gin',
        reason: 'Full-text search operations detected',
        priority: 'medium',
        estimatedImpact: 80,
      });
    }

    return recommendations;
  }

  /**
   * MySQL 인덱스 추천
   */
  private generateMySQLIndexRecommendations(
    tableAnalysis: any,
    queryPatterns: string[]
  ): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // 복합 인덱스 추천
    const compositeIndexCandidates = this.extractCompositeIndexCandidates(queryPatterns);
    for (const [tableName, columnGroups] of compositeIndexCandidates.entries()) {
      for (const columns of columnGroups) {
        recommendations.push({
          tableName,
          columns,
          indexType: 'btree',
          reason: 'Composite index for multi-column WHERE conditions',
          priority: 'high',
          estimatedImpact: 75,
        });
      }
    }

    // ORDER BY 절에 대한 인덱스 추천
    const orderByColumns = this.extractOrderByColumns(queryPatterns);
    for (const [tableName, columns] of orderByColumns.entries()) {
      recommendations.push({
        tableName,
        columns: Array.from(columns),
        indexType: 'btree',
        reason: 'Frequently used in ORDER BY clauses',
        priority: 'medium',
        estimatedImpact: 50,
      });
    }

    return recommendations;
  }

  /**
   * SQL Server 인덱스 추천
   */
  private generateSQLServerIndexRecommendations(
    tableAnalysis: any,
    queryPatterns: string[]
  ): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // Columnstore 인덱스 추천 (분석 쿼리용)
    const analyticalTables = this.extractAnalyticalTables(queryPatterns);
    for (const tableName of analyticalTables) {
      recommendations.push({
        tableName,
        columns: ['*'], // Columnstore는 모든 컬럼
        indexType: 'columnstore',
        reason: 'Table used in analytical queries with aggregations',
        priority: 'medium',
        estimatedImpact: 85,
      });
    }

    // 커버링 인덱스 추천
    const coveringIndexCandidates = this.extractCoveringIndexCandidates(queryPatterns);
    for (const [tableName, indexInfo] of coveringIndexCandidates.entries()) {
      recommendations.push({
        tableName,
        columns: indexInfo.keyColumns.concat(indexInfo.includeColumns),
        indexType: 'btree',
        reason: 'Covering index to avoid key lookups',
        priority: 'high',
        estimatedImpact: 65,
      });
    }

    return recommendations;
  }

  /**
   * Oracle 인덱스 추천
   */
  private generateOracleIndexRecommendations(
    tableAnalysis: any,
    queryPatterns: string[]
  ): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // 함수 기반 인덱스 추천
    const functionBasedIndexCandidates = this.extractFunctionBasedIndexCandidates(queryPatterns);
    for (const [tableName, functions] of functionBasedIndexCandidates.entries()) {
      for (const func of functions) {
        recommendations.push({
          tableName,
          columns: [func],
          indexType: 'btree',
          reason: 'Function-based index for computed columns',
          priority: 'medium',
          estimatedImpact: 60,
        });
      }
    }

    // 비트맵 인덱스 추천 (낮은 카디널리티 컬럼)
    const lowCardinalityColumns = this.extractLowCardinalityColumns(queryPatterns);
    for (const [tableName, columns] of lowCardinalityColumns.entries()) {
      recommendations.push({
        tableName,
        columns: Array.from(columns),
        indexType: 'btree', // Oracle bitmap index는 Knex에서 직접 지원하지 않음
        reason: 'Low cardinality column suitable for bitmap index',
        priority: 'low',
        estimatedImpact: 40,
      });
    }

    return recommendations;
  }

  // 헬퍼 메서드들 (WHERE 절 컬럼 추출 등)
  private extractWhereColumns(queryPatterns: string[]): Map<string, Set<string>> {
    const whereColumns = new Map<string, Set<string>>();
    
    for (const query of queryPatterns) {
      // 간단한 정규식으로 WHERE 절의 컬럼 추출
      const whereMatch = query.match(/FROM\s+(\w+).*?WHERE\s+(\w+)/i);
      if (whereMatch) {
        const [, tableName, columnName] = whereMatch;
        if (!whereColumns.has(tableName)) {
          whereColumns.set(tableName, new Set());
        }
        whereColumns.get(tableName)!.add(columnName);
      }
    }
    
    return whereColumns;
  }

  private extractJsonColumns(queryPatterns: string[]): Map<string, Set<string>> {
    const jsonColumns = new Map<string, Set<string>>();
    
    for (const query of queryPatterns) {
      // JSON 연산자 사용 패턴 감지
      const jsonMatch = query.match(/(\w+)\s*->>?\s*'(\w+)'/g);
      if (jsonMatch) {
        // 테이블명 추출은 더 복잡한 로직 필요
        // 여기서는 간단히 구현
      }
    }
    
    return jsonColumns;
  }

  private extractTextSearchColumns(queryPatterns: string[]): Map<string, Set<string>> {
    // 전문 검색 패턴 감지 로직
    return new Map();
  }

  private extractCompositeIndexCandidates(queryPatterns: string[]): Map<string, string[][]> {
    // 복합 인덱스 후보 추출 로직
    return new Map();
  }

  private extractOrderByColumns(queryPatterns: string[]): Map<string, Set<string>> {
    // ORDER BY 절 컬럼 추출 로직
    return new Map();
  }

  private extractAnalyticalTables(queryPatterns: string[]): Set<string> {
    // 분석 쿼리에 사용되는 테이블 추출
    return new Set();
  }

  private extractCoveringIndexCandidates(queryPatterns: string[]): Map<string, { keyColumns: string[]; includeColumns: string[] }> {
    // 커버링 인덱스 후보 추출 로직
    return new Map();
  }

  private extractFunctionBasedIndexCandidates(queryPatterns: string[]): Map<string, Set<string>> {
    // 함수 기반 인덱스 후보 추출 로직
    return new Map();
  }

  private extractLowCardinalityColumns(queryPatterns: string[]): Map<string, Set<string>> {
    // 낮은 카디널리티 컬럼 추출 로직
    return new Map();
  }

  /**
   * 전체 최적화 실행
   */
  async executeOptimizations(
    database: Database,
    queryPatterns: string[]
  ): Promise<OptimizationResult> {
    const engine = database.engine;
    const config = this.getOptimizationConfig(engine);
    
    if (!config) {
      return {
        engine,
        optimizationsApplied: [],
        performanceImpact: {
          executionTimeReduction: 0,
          memoryUsageReduction: 0,
          ioReduction: 0,
        },
        recommendations: [],
        warnings: [`Optimizations not available for engine: ${engine}`],
      };
    }

    const result: OptimizationResult = {
      engine,
      optimizationsApplied: [],
      performanceImpact: {
        executionTimeReduction: 0,
        memoryUsageReduction: 0,
        ioReduction: 0,
      },
      recommendations: [],
      warnings: [],
    };

    try {
      // 1. 쿼리 최적화 적용
      for (const query of queryPatterns) {
        const { appliedOptimizations } = this.optimizeQuery(query, engine);
        result.optimizationsApplied.push(...appliedOptimizations);
      }

      // 2. 인덱스 추천 생성
      result.recommendations = await this.generateIndexRecommendations(
        engine,
        {},
        queryPatterns
      );

      // 3. 성능 영향 추정
      result.performanceImpact = this.estimatePerformanceImpact(
        result.optimizationsApplied,
        result.recommendations
      );

      this.logger.log(`Optimizations executed for ${engine}`, {
        engine,
        optimizationsCount: result.optimizationsApplied.length,
        recommendationsCount: result.recommendations.length,
        estimatedImprovement: result.performanceImpact.executionTimeReduction,
      });

    } catch (error) {
      this.logger.error(`Failed to execute optimizations for ${engine}`, error.stack);
      result.warnings.push(`Optimization execution failed: ${error.message}`);
    }

    return result;
  }

  /**
   * 성능 영향 추정
   */
  private estimatePerformanceImpact(
    appliedOptimizations: string[],
    recommendations: IndexRecommendation[]
  ): { executionTimeReduction: number; memoryUsageReduction: number; ioReduction: number } {
    let executionTimeReduction = 0;
    let memoryUsageReduction = 0;
    let ioReduction = 0;

    // 쿼리 최적화의 영향
    executionTimeReduction += appliedOptimizations.length * 5; // 최적화당 5% 개선 가정

    // 인덱스 추천의 영향
    for (const recommendation of recommendations) {
      if (recommendation.priority === 'high') {
        executionTimeReduction += recommendation.estimatedImpact * 0.8;
        ioReduction += recommendation.estimatedImpact * 0.6;
      } else if (recommendation.priority === 'medium') {
        executionTimeReduction += recommendation.estimatedImpact * 0.5;
        ioReduction += recommendation.estimatedImpact * 0.4;
      } else {
        executionTimeReduction += recommendation.estimatedImpact * 0.3;
        ioReduction += recommendation.estimatedImpact * 0.2;
      }
    }

    // 메모리 사용량 개선 (연결 풀 최적화 등)
    memoryUsageReduction = Math.min(executionTimeReduction * 0.3, 30);

    return {
      executionTimeReduction: Math.min(executionTimeReduction, 80), // 최대 80% 개선
      memoryUsageReduction: Math.min(memoryUsageReduction, 50), // 최대 50% 개선
      ioReduction: Math.min(ioReduction, 70), // 최대 70% 개선
    };
  }
}