import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { BaseDatabaseOptimizer } from './base-optimizer';
import { MySQLOptimizer } from './mysql-optimizer';
import { PostgreSQLOptimizer } from './postgresql-optimizer';
import { BigQueryOptimizer } from './bigquery-optimizer';
import { SnowflakeOptimizer } from './snowflake-optimizer';
import { OracleOptimizer } from './oracle-optimizer';
import { SqlServerOptimizer } from './sqlserver-optimizer';

/**
 * 데이터베이스별 최적화 팩토리
 * 각 데이터베이스 타입에 맞는 최적화 클래스를 제공하는 중앙 관리 시스템
 */
@Injectable()
export class DatabaseOptimizerFactory {
  private readonly logger = new Logger(DatabaseOptimizerFactory.name);
  private readonly optimizers = new Map<string, BaseDatabaseOptimizer>();

  constructor(
    private readonly mysqlOptimizer: MySQLOptimizer,
    private readonly postgresqlOptimizer: PostgreSQLOptimizer,
    private readonly bigqueryOptimizer: BigQueryOptimizer,
    private readonly snowflakeOptimizer: SnowflakeOptimizer,
    private readonly oracleOptimizer: OracleOptimizer,
    private readonly sqlServerOptimizer: SqlServerOptimizer,
  ) {
    this.initializeOptimizers();
  }

  /**
   * 최적화 클래스들 초기화
   */
  private initializeOptimizers(): void {
    // MySQL/MariaDB 최적화
    this.optimizers.set('mysql', this.mysqlOptimizer);
    this.optimizers.set('mysql2', this.mysqlOptimizer);
    this.optimizers.set('mariadb', this.mysqlOptimizer);

    // PostgreSQL 최적화
    this.optimizers.set('pg', this.postgresqlOptimizer);
    this.optimizers.set('postgres', this.postgresqlOptimizer);
    this.optimizers.set('postgresql', this.postgresqlOptimizer);
    this.optimizers.set('cockroachdb', this.postgresqlOptimizer); // CockroachDB는 PostgreSQL 호환

    // Oracle 최적화
    this.optimizers.set('oracle', this.oracleOptimizer);
    this.optimizers.set('oracledb', this.oracleOptimizer);

    // SQL Server 최적화
    this.optimizers.set('mssql', this.sqlServerOptimizer);
    this.optimizers.set('sqlserver', this.sqlServerOptimizer);

    // BigQuery 최적화
    this.optimizers.set('bigquery', this.bigqueryOptimizer);

    // Snowflake 최적화
    this.optimizers.set('snowflake', this.snowflakeOptimizer);

    this.logger.log(`Initialized ${this.optimizers.size} database optimizers`);
  }

  /**
   * 데이터베이스 타입에 맞는 최적화 클래스 반환
   * @param databaseType - 데이터베이스 타입
   */
  getOptimizer(databaseType: string): BaseDatabaseOptimizer | null {
    const normalizedType = this.normalizeDatabaseType(databaseType);
    const optimizer = this.optimizers.get(normalizedType);

    if (!optimizer) {
      this.logger.warn(`No optimizer found for database type: ${databaseType}`);
      return null;
    }

    return optimizer;
  }

  /**
   * 지원되는 데이터베이스 타입 목록 반환
   */
  getSupportedDatabaseTypes(): string[] {
    return Array.from(this.optimizers.keys());
  }

  /**
   * 데이터베이스 타입이 지원되는지 확인
   * @param databaseType - 데이터베이스 타입
   */
  isSupported(databaseType: string): boolean {
    const normalizedType = this.normalizeDatabaseType(databaseType);
    return this.optimizers.has(normalizedType);
  }

  /**
   * 연결 설정 최적화
   * @param databaseType - 데이터베이스 타입
   * @param baseConfig - 기본 연결 설정
   * @param environment - 환경
   */
  getOptimizedConnectionConfig(
    databaseType: string,
    baseConfig: any,
    environment = 'dev',
  ): Knex.Config {
    const optimizer = this.getOptimizer(databaseType);

    if (!optimizer) {
      this.logger.warn(`Using default connection config for unsupported database: ${databaseType}`);
      return this.getDefaultConnectionConfig(databaseType, baseConfig, environment);
    }

    try {
      const optimizedConfig = optimizer.getOptimizedConnectionConfig(baseConfig, environment);
      this.logger.log(
        `Applied ${databaseType} connection optimizations for ${environment} environment`,
      );
      return optimizedConfig;
    } catch (error) {
      this.logger.error(`Failed to optimize connection config for ${databaseType}`, error);
      return this.getDefaultConnectionConfig(databaseType, baseConfig, environment);
    }
  }

  /**
   * 쿼리 최적화 적용
   * @param databaseType - 데이터베이스 타입
   * @param queryBuilder - Knex 쿼리 빌더
   * @param options - 최적화 옵션
   */
  optimizeQuery(
    databaseType: string,
    queryBuilder: Knex.QueryBuilder,
    options: any = {},
  ): Knex.QueryBuilder {
    const optimizer = this.getOptimizer(databaseType);

    if (!optimizer) {
      this.logger.debug(`No query optimization available for database: ${databaseType}`);
      return queryBuilder;
    }

    try {
      const optimizedQuery = optimizer.optimizeQuery(queryBuilder, options);
      this.logger.debug(`Applied ${databaseType} query optimizations`);
      return optimizedQuery;
    } catch (error) {
      this.logger.error(`Failed to optimize query for ${databaseType}`, error);
      return queryBuilder;
    }
  }

  /**
   * 배치 삽입 최적화
   * @param databaseType - 데이터베이스 타입
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 삽입할 데이터 배열
   * @param options - 최적화 옵션
   */
  async batchInsert(
    databaseType: string,
    knex: Knex,
    tableName: string,
    data: any[],
    options: any = {},
  ): Promise<any> {
    const optimizer = this.getOptimizer(databaseType);

    if (!optimizer) {
      this.logger.warn(`Using default batch insert for unsupported database: ${databaseType}`);
      return this.defaultBatchInsert(knex, tableName, data, options);
    }

    try {
      const result = await optimizer.batchInsert(knex, tableName, data, options);
      this.logger.log(
        `Completed optimized batch insert for ${databaseType}: ${data.length} records`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Optimized batch insert failed for ${databaseType}, falling back to default`,
        error,
      );
      return this.defaultBatchInsert(knex, tableName, data, options);
    }
  }

  /**
   * 배치 업데이트 최적화
   * @param databaseType - 데이터베이스 타입
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 업데이트할 데이터 배열
   * @param keyColumns - 키 컬럼들
   * @param options - 최적화 옵션
   */
  async batchUpdate(
    databaseType: string,
    knex: Knex,
    tableName: string,
    data: any[],
    keyColumns: string[],
    options: any = {},
  ): Promise<any> {
    const optimizer = this.getOptimizer(databaseType);

    if (!optimizer) {
      this.logger.warn(`Using default batch update for unsupported database: ${databaseType}`);
      return this.defaultBatchUpdate(knex, tableName, data, keyColumns);
    }

    try {
      const result = await optimizer.batchUpdate(knex, tableName, data, keyColumns);
      this.logger.log(
        `Completed optimized batch update for ${databaseType}: ${data.length} records`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Optimized batch update failed for ${databaseType}, falling back to default`,
        error,
      );
      return this.defaultBatchUpdate(knex, tableName, data, keyColumns);
    }
  }

  /**
   * 데이터베이스별 성능 메트릭 수집
   * @param databaseType - 데이터베이스 타입
   * @param knex - Knex 인스턴스
   */
  async getPerformanceMetrics(databaseType: string, knex: Knex): Promise<any> {
    const optimizer = this.getOptimizer(databaseType);

    if (!optimizer || typeof (optimizer as any).getPerformanceMetrics !== 'function') {
      this.logger.debug(`Performance metrics not available for database: ${databaseType}`);
      return null;
    }

    try {
      const metrics = await (optimizer as any).getPerformanceMetrics(knex);
      this.logger.debug(`Collected performance metrics for ${databaseType}`);
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to collect performance metrics for ${databaseType}`, error);
      return null;
    }
  }

  /**
   * 데이터베이스별 슬로우 쿼리 분석
   * @param databaseType - 데이터베이스 타입
   * @param knex - Knex 인스턴스
   * @param minDuration - 최소 실행 시간
   */
  async getSlowQueries(databaseType: string, knex: Knex, minDuration = 1000): Promise<any[]> {
    const optimizer = this.getOptimizer(databaseType);

    if (!optimizer || typeof (optimizer as any).getSlowQueries !== 'function') {
      this.logger.debug(`Slow query analysis not available for database: ${databaseType}`);
      return [];
    }

    try {
      const slowQueries = await (optimizer as any).getSlowQueries(knex, minDuration);
      this.logger.debug(
        `Analyzed slow queries for ${databaseType}: ${slowQueries?.length || 0} found`,
      );
      return slowQueries || [];
    } catch (error) {
      this.logger.error(`Failed to analyze slow queries for ${databaseType}`, error);
      return [];
    }
  }

  /**
   * 데이터베이스 타입 정규화
   * @param databaseType - 원본 데이터베이스 타입
   */
  private normalizeDatabaseType(databaseType: string): string {
    if (!databaseType) return 'unknown';

    return databaseType.toLowerCase().trim();
  }

  /**
   * 기본 연결 설정 반환
   * @param databaseType - 데이터베이스 타입
   * @param baseConfig - 기본 설정
   * @param environment - 환경
   */
  private getDefaultConnectionConfig(
    databaseType: string,
    baseConfig: any,
    environment: string,
  ): Knex.Config {
    const isProduction = environment === 'prod';

    return {
      client: databaseType,
      connection: baseConfig,
      pool: {
        min: 0,
        max: isProduction ? 10 : 5,
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
      },
      acquireConnectionTimeout: 30000,
      useNullAsDefault: true,
      debug: !isProduction,
    };
  }

  /**
   * 기본 배치 삽입
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 데이터 배열
   * @param options - 옵션
   */
  private async defaultBatchInsert(
    knex: Knex,
    tableName: string,
    data: any[],
    options: any,
  ): Promise<any> {
    const chunkSize = options.chunkSize || 1000;
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    for (const chunk of chunks) {
      const result = await knex(tableName).insert(chunk);
      results.push(result);
    }

    return results;
  }

  /**
   * 기본 배치 업데이트
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 데이터 배열
   * @param keyColumns - 키 컬럼들
   */
  private async defaultBatchUpdate(
    knex: Knex,
    tableName: string,
    data: any[],
    keyColumns: string[],
  ): Promise<any> {
    const chunkSize = 500;
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    for (const chunk of chunks) {
      try {
        const result = await knex(tableName).insert(chunk).onConflict(keyColumns).merge();
        results.push(result);
      } catch (error) {
        // 일부 DB에서 onConflict가 지원되지 않을 수 있음
        this.logger.warn('onConflict not supported, skipping batch update');
        break;
      }
    }

    return results;
  }

  /**
   * 배열 청크 분할
   * @param array - 분할할 배열
   * @param chunkSize - 청크 크기
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 최적화 통계 수집
   */
  getOptimizationStats(): {
    supportedDatabases: string[];
    totalOptimizers: number;
    optimizerTypes: Record<string, string>;
  } {
    const stats = {
      supportedDatabases: this.getSupportedDatabaseTypes(),
      totalOptimizers: this.optimizers.size,
      optimizerTypes: {} as Record<string, string>,
    };

    this.optimizers.forEach((optimizer, dbType) => {
      stats.optimizerTypes[dbType] = optimizer.constructor.name;
    });

    return stats;
  }
}
