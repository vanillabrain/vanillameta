import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseOptimizerFactory } from './database-optimizer-factory';

/**
 * 고급 쿼리 최적화 서비스
 * 여러 데이터베이스에 걸친 공통 최적화 패턴 및 고급 기능 제공
 */
@Injectable()
export class AdvancedQueryOptimizerService {
  private readonly logger = new Logger(AdvancedQueryOptimizerService.name);

  constructor(private readonly databaseOptimizerFactory: DatabaseOptimizerFactory) {}

  /**
   * 쿼리 성능 프로파일링
   * @param knex - Knex 인스턴스
   * @param query - 분석할 쿼리
   * @param databaseType - 데이터베이스 타입
   */
  async profileQuery(knex: Knex, query: string, databaseType: string): Promise<any> {
    const optimizer = this.databaseOptimizerFactory.getOptimizer(databaseType);
    const startTime = Date.now();

    try {
      // 실행 계획 분석
      let executionPlan = null;
      if (optimizer && typeof (optimizer as any).explainQuery === 'function') {
        executionPlan = await (optimizer as any).explainQuery(knex, query);
      }

      // 실제 쿼리 실행
      const result = await knex.raw(query);
      const executionTime = Date.now() - startTime;

      // 성능 메트릭 수집
      const performanceMetrics = await this.collectPerformanceMetrics(
        knex,
        databaseType,
        executionTime,
      );

      return {
        query,
        databaseType,
        executionTime,
        executionPlan,
        performanceMetrics,
        rowCount: this.extractRowCount(result, databaseType),
        recommendations: await this.generateOptimizationRecommendations(
          query,
          executionTime,
          databaseType,
          executionPlan,
        ),
      };
    } catch (error) {
      this.logger.error('Query profiling failed', error);
      return {
        query,
        databaseType,
        executionTime: Date.now() - startTime,
        error: error.message,
        recommendations: [],
      };
    }
  }

  /**
   * 동적 쿼리 최적화
   * @param knex - Knex 인스턴스
   * @param queryBuilder - 쿼리 빌더
   * @param databaseType - 데이터베이스 타입
   * @param options - 최적화 옵션
   */
  async optimizeQueryDynamic(
    knex: Knex,
    queryBuilder: Knex.QueryBuilder,
    databaseType: string,
    options: {
      expectedRowCount?: number;
      optimizeFor?: 'throughput' | 'latency' | 'resource';
      enableHints?: boolean;
      enableParallel?: boolean;
    } = {},
  ): Promise<Knex.QueryBuilder> {
    const optimizer = this.databaseOptimizerFactory.getOptimizer(databaseType);

    if (!optimizer) {
      this.logger.warn(`No optimizer found for ${databaseType}, returning original query`);
      return queryBuilder;
    }

    try {
      // 데이터베이스별 동적 최적화 옵션 생성
      const optimizationOptions = this.generateOptimizationOptions(
        databaseType,
        options.expectedRowCount,
        options.optimizeFor,
        options.enableHints,
        options.enableParallel,
      );

      // 데이터베이스별 최적화 적용
      const optimizedQuery = optimizer.optimizeQuery(queryBuilder, optimizationOptions);

      this.logger.log(`Applied dynamic optimization for ${databaseType}`, {
        expectedRowCount: options.expectedRowCount,
        optimizeFor: options.optimizeFor,
        optimizationOptions,
      });

      return optimizedQuery;
    } catch (error) {
      this.logger.error(`Dynamic optimization failed for ${databaseType}`, error);
      return queryBuilder;
    }
  }

  /**
   * 쿼리 캐싱 전략 적용
   * @param knex - Knex 인스턴스
   * @param query - 쿼리
   * @param databaseType - 데이터베이스 타입
   * @param cacheTTL - 캐시 TTL (초)
   */
  async applyCachingStrategy(
    knex: Knex,
    query: string,
    databaseType: string,
    cacheTTL = 3600,
  ): Promise<any> {
    const optimizer = this.databaseOptimizerFactory.getOptimizer(databaseType);

    // 데이터베이스별 캐싱 전략
    switch (databaseType.toLowerCase()) {
      case 'bigquery':
        // BigQuery 결과 캐싱
        return knex.raw(query).options({
          useQueryCache: true,
          labels: { cache_strategy: 'aggressive' },
        });

      case 'snowflake':
        // Snowflake 결과 캐싱
        if (optimizer && typeof (optimizer as any).queryWithCache === 'function') {
          return (optimizer as any).queryWithCache(knex, query, cacheTTL);
        }
        break;

      case 'postgresql':
      case 'mysql':
      case 'mysql2':
        // 관계형 DB는 애플리케이션 레벨 캐싱 권장
        this.logger.log(`Applied application-level caching strategy for ${databaseType}`);
        break;

      default:
        this.logger.debug(`No specific caching strategy for ${databaseType}`);
    }

    return knex.raw(query);
  }

  /**
   * 배치 처리 최적화
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 데이터 배열
   * @param operation - 작업 타입
   * @param databaseType - 데이터베이스 타입
   */
  async optimizeBatchOperation(
    knex: Knex,
    tableName: string,
    data: any[],
    operation: 'insert' | 'update' | 'upsert',
    databaseType: string,
  ): Promise<any> {
    const optimizer = this.databaseOptimizerFactory.getOptimizer(databaseType);

    if (!optimizer) {
      this.logger.warn(`No optimizer found for ${databaseType}, using default batch operation`);
      return this.defaultBatchOperation(knex, tableName, data, operation);
    }

    try {
      // 데이터 크기에 따른 최적 배치 크기 계산
      const optimalChunkSize = this.calculateOptimalChunkSize(databaseType, data.length);

      // 데이터베이스별 배치 처리 옵션
      const batchOptions = this.generateBatchOptions(databaseType, data.length, operation);

      switch (operation) {
        case 'insert':
          return optimizer.batchInsert(knex, tableName, data, {
            chunkSize: optimalChunkSize,
            ...batchOptions,
          });

        case 'update':
        case 'upsert':
          // 키 컬럼 자동 감지
          const keyColumns = this.detectKeyColumns(data);
          return optimizer.batchUpdate(knex, tableName, data, keyColumns);

        default:
          throw new Error(`Unsupported batch operation: ${operation}`);
      }
    } catch (error) {
      this.logger.error(`Batch operation optimization failed for ${databaseType}`, error);
      throw error;
    }
  }

  /**
   * 연결 풀 최적화
   * @param databaseType - 데이터베이스 타입
   * @param baseConfig - 기본 설정
   * @param workloadType - 워크로드 타입
   */
  optimizeConnectionPool(
    databaseType: string,
    baseConfig: any,
    workloadType: 'oltp' | 'olap' | 'mixed' = 'mixed',
  ): any {
    const optimizer = this.databaseOptimizerFactory.getOptimizer(databaseType);

    if (!optimizer) {
      return baseConfig;
    }

    // 워크로드별 연결 풀 설정
    const workloadOptimizations = this.getWorkloadOptimizations(workloadType);

    // 데이터베이스별 최적화된 연결 설정 적용
    const optimizedConfig = optimizer.getOptimizedConnectionConfig(
      baseConfig,
      process.env.NODE_ENV || 'dev',
    );

    // 워크로드별 추가 최적화
    if (optimizedConfig.pool) {
      optimizedConfig.pool = {
        ...optimizedConfig.pool,
        ...workloadOptimizations.pool,
      };
    }

    this.logger.log(`Optimized connection pool for ${databaseType} with ${workloadType} workload`);

    return optimizedConfig;
  }

  /**
   * 성능 메트릭 수집
   */
  private async collectPerformanceMetrics(
    knex: Knex,
    databaseType: string,
    executionTime: number,
  ): Promise<any> {
    try {
      const performanceMetrics = await this.databaseOptimizerFactory.getPerformanceMetrics(
        databaseType,
        knex,
      );

      return {
        executionTime,
        databaseSpecific: performanceMetrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn('Failed to collect performance metrics', error);
      return { executionTime };
    }
  }

  /**
   * 최적화 권장사항 생성
   */
  private async generateOptimizationRecommendations(
    query: string,
    executionTime: number,
    databaseType: string,
    executionPlan?: any,
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // 실행 시간 기반 권장사항
    if (executionTime > 5000) {
      recommendations.push('쿼리 실행 시간이 5초를 초과합니다. 인덱스 추가를 고려하세요.');
    }

    if (executionTime > 10000) {
      recommendations.push('매우 느린 쿼리입니다. 쿼리 구조를 재검토하세요.');
    }

    // 쿼리 패턴 기반 권장사항
    if (query.toLowerCase().includes('select *')) {
      recommendations.push('SELECT * 사용을 피하고 필요한 컬럼만 선택하세요.');
    }

    if (query.toLowerCase().includes('order by') && !query.toLowerCase().includes('limit')) {
      recommendations.push('ORDER BY 사용 시 LIMIT를 함께 사용하는 것을 고려하세요.');
    }

    // 데이터베이스별 권장사항
    switch (databaseType.toLowerCase()) {
      case 'bigquery':
        if (
          query.toLowerCase().includes('join') &&
          !query.toLowerCase().includes('_partitiondate')
        ) {
          recommendations.push(
            'BigQuery에서 파티션 테이블 조인 시 _PARTITIONDATE 필터를 사용하세요.',
          );
        }
        break;

      case 'snowflake':
        if (executionTime > 3000) {
          recommendations.push('Snowflake에서 느린 쿼리는 더 큰 웨어하우스 사용을 고려하세요.');
        }
        break;

      case 'postgresql':
        if (query.toLowerCase().includes('ilike')) {
          recommendations.push(
            'PostgreSQL에서 ILIKE 대신 GIN 인덱스와 함께 텍스트 검색을 사용하세요.',
          );
        }
        break;
    }

    return recommendations;
  }

  /**
   * 데이터베이스별 최적화 옵션 생성
   */
  private generateOptimizationOptions(
    databaseType: string,
    expectedRowCount?: number,
    optimizeFor?: string,
    enableHints?: boolean,
    enableParallel?: boolean,
  ): any {
    const options: any = {};

    switch (databaseType.toLowerCase()) {
      case 'mysql':
      case 'mysql2':
        if (enableHints && expectedRowCount) {
          options.sqlCalcFoundRows = expectedRowCount > 1000;
        }
        break;

      case 'postgresql':
        if (enableParallel && expectedRowCount && expectedRowCount > 10000) {
          options.enableHashJoin = true;
          options.workMem = '8MB';
        }
        if (optimizeFor === 'latency') {
          options.enableSeqScan = false;
        }
        break;

      case 'oracle':
        if (enableHints) {
          if (expectedRowCount && expectedRowCount < 100) {
            options.optimizerMode = 'FIRST_ROWS';
          } else {
            options.optimizerMode = 'ALL_ROWS';
          }
        }
        if (enableParallel && expectedRowCount && expectedRowCount > 50000) {
          options.parallelDegree = 4;
        }
        break;

      case 'sqlserver':
        if (enableHints && optimizeFor === 'latency') {
          options.noLock = true;
        }
        if (enableParallel) {
          options.maxDop = 4;
        }
        break;

      case 'bigquery':
        if (optimizeFor === 'resource') {
          options.maximumBytesBilled = '100000000'; // 100MB limit
        }
        options.useQueryCache = true;
        break;

      case 'snowflake':
        if (expectedRowCount && expectedRowCount > 100000) {
          options.warehouse = 'LARGE';
        }
        options.useResultCache = true;
        break;
    }

    return options;
  }

  /**
   * 최적 배치 크기 계산
   */
  private calculateOptimalChunkSize(databaseType: string, dataLength: number): number {
    switch (databaseType.toLowerCase()) {
      case 'mysql':
      case 'mysql2':
        return Math.min(1000, Math.max(100, Math.floor(dataLength / 10)));

      case 'postgresql':
        return Math.min(2000, Math.max(500, Math.floor(dataLength / 5)));

      case 'oracle':
        return Math.min(1000, Math.max(200, Math.floor(dataLength / 8)));

      case 'sqlserver':
        return Math.min(1000, Math.max(100, Math.floor(dataLength / 10)));

      case 'bigquery':
        return Math.min(5000, Math.max(1000, Math.floor(dataLength / 3)));

      case 'snowflake':
        return Math.min(10000, Math.max(1000, Math.floor(dataLength / 2)));

      default:
        return Math.min(1000, Math.max(100, Math.floor(dataLength / 10)));
    }
  }

  /**
   * 배치 옵션 생성
   */
  private generateBatchOptions(databaseType: string, dataLength: number, operation: string): any {
    const options: any = {};

    switch (databaseType.toLowerCase()) {
      case 'mysql':
      case 'mysql2':
        if (operation === 'insert' && dataLength > 10000) {
          options.useIgnore = true; // 중복 무시
        }
        break;

      case 'postgresql':
        if (operation === 'insert' && dataLength > 50000) {
          options.useCopy = true; // COPY 명령 사용
        }
        if (operation === 'upsert') {
          options.useUpsert = true;
        }
        break;

      case 'oracle':
        if (dataLength > 5000) {
          options.useArrayInsert = true;
          options.enableParallel = true;
          options.commitFrequency = 10; // 10개 청크마다 커밋
        }
        break;

      case 'sqlserver':
        if (dataLength > 10000) {
          options.useBulkInsert = true;
          options.checkConstraints = false; // 성능 향상을 위해 제약 조건 검사 비활성화
        }
        break;

      case 'bigquery':
        options.skipInvalidRows = true;
        options.ignoreUnknownValues = true;
        break;

      case 'snowflake':
        if (dataLength > 50000) {
          options.useBulkLoad = true;
          options.warehouse = 'LARGE';
        }
        break;
    }

    return options;
  }

  /**
   * 워크로드별 최적화 설정
   */
  private getWorkloadOptimizations(workloadType: string): any {
    switch (workloadType) {
      case 'oltp':
        return {
          pool: {
            min: 2,
            max: 10,
            acquireTimeoutMillis: 5000,
            idleTimeoutMillis: 10000,
          },
        };

      case 'olap':
        return {
          pool: {
            min: 0,
            max: 5,
            acquireTimeoutMillis: 30000,
            idleTimeoutMillis: 60000,
          },
        };

      case 'mixed':
      default:
        return {
          pool: {
            min: 1,
            max: 8,
            acquireTimeoutMillis: 15000,
            idleTimeoutMillis: 30000,
          },
        };
    }
  }

  /**
   * 행 수 추출
   */
  private extractRowCount(result: any, databaseType: string): number {
    try {
      switch (databaseType.toLowerCase()) {
        case 'mysql':
        case 'mysql2':
          return result[0]?.length || 0;

        case 'postgresql':
          return result.rows?.length || 0;

        case 'oracle':
        case 'sqlserver':
          return result?.length || 0;

        case 'bigquery':
        case 'snowflake':
          return Array.isArray(result) ? result.length : 0;

        default:
          return Array.isArray(result) ? result.length : 0;
      }
    } catch (error) {
      this.logger.warn('Failed to extract row count', error);
      return 0;
    }
  }

  /**
   * 키 컬럼 자동 감지
   */
  private detectKeyColumns(data: any[]): string[] {
    if (!data || data.length === 0) return [];

    const columns = Object.keys(data[0]);
    const keyColumns: string[] = [];

    // 일반적인 키 컬럼명 패턴
    const keyPatterns = ['id', 'key', 'pk', '_id', 'uuid'];

    for (const column of columns) {
      const lowerColumn = column.toLowerCase();
      if (keyPatterns.some(pattern => lowerColumn.includes(pattern))) {
        keyColumns.push(column);
      }
    }

    // 키 컬럼이 없으면 첫 번째 컬럼을 키로 사용
    if (keyColumns.length === 0 && columns.length > 0) {
      keyColumns.push(columns[0]);
    }

    return keyColumns;
  }

  /**
   * 기본 배치 작업
   */
  private async defaultBatchOperation(
    knex: Knex,
    tableName: string,
    data: any[],
    operation: string,
  ): Promise<any> {
    const chunkSize = 1000;
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    for (const chunk of chunks) {
      switch (operation) {
        case 'insert':
          const result = await knex(tableName).insert(chunk);
          results.push(result);
          break;

        case 'update':
        case 'upsert':
          // 기본적으로 upsert 지원하는 DB가 많지 않으므로 insert로 대체
          const upsertResult = await knex(tableName).insert(chunk);
          results.push(upsertResult);
          break;
      }
    }

    return results;
  }

  /**
   * 배열 청크 분할
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
