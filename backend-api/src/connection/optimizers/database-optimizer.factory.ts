import { Injectable } from '@nestjs/common';
import { IDatabaseOptimizer } from './database-optimizer.interface';
import { MySQLOptimizer } from './mysql.optimizer';
import { PostgreSQLOptimizer } from './postgresql.optimizer';
import { BigQueryOptimizer } from './bigquery.optimizer';
import { SnowflakeOptimizer } from './snowflake.optimizer';
import { OracleOptimizer } from './oracle.optimizer';

/**
 * 데이터베이스별 최적화 클래스 팩토리
 */
@Injectable()
export class DatabaseOptimizerFactory {
  private optimizers: Map<string, IDatabaseOptimizer> = new Map();

  constructor(
    private readonly mysqlOptimizer: MySQLOptimizer,
    private readonly postgresqlOptimizer: PostgreSQLOptimizer,
    private readonly bigqueryOptimizer: BigQueryOptimizer,
    private readonly snowflakeOptimizer: SnowflakeOptimizer,
    private readonly oracleOptimizer: OracleOptimizer,
  ) {
    this.initializeOptimizers();
  }

  /**
   * 최적화 클래스 초기화
   */
  private initializeOptimizers(): void {
    // MySQL/MariaDB
    this.optimizers.set('mysql', this.mysqlOptimizer);
    this.optimizers.set('mysql2', this.mysqlOptimizer);
    this.optimizers.set('mariadb', this.mysqlOptimizer);

    // PostgreSQL
    this.optimizers.set('pg', this.postgresqlOptimizer);
    this.optimizers.set('postgres', this.postgresqlOptimizer);
    this.optimizers.set('postgresql', this.postgresqlOptimizer);
    this.optimizers.set('cockroachdb', this.postgresqlOptimizer); // CockroachDB는 PostgreSQL 호환

    // BigQuery
    this.optimizers.set('bigquery', this.bigqueryOptimizer);

    // Snowflake
    this.optimizers.set('snowflake', this.snowflakeOptimizer);

    // Oracle
    this.optimizers.set('oracle', this.oracleOptimizer);
    this.optimizers.set('oracledb', this.oracleOptimizer);
  }

  /**
   * 데이터베이스 타입에 맞는 최적화 클래스 반환
   * @param databaseType 데이터베이스 타입
   * @returns IDatabaseOptimizer 또는 null
   */
  getOptimizer(databaseType: string): IDatabaseOptimizer | null {
    const normalizedType = this.normalizeDatabaseType(databaseType);
    return this.optimizers.get(normalizedType) || null;
  }

  /**
   * 지원되는 데이터베이스 타입 목록 반환
   * @returns 지원되는 데이터베이스 타입 배열
   */
  getSupportedDatabaseTypes(): string[] {
    return Array.from(this.optimizers.keys());
  }

  /**
   * 데이터베이스 타입 지원 여부 확인
   * @param databaseType 데이터베이스 타입
   * @returns 지원 여부
   */
  isSupported(databaseType: string): boolean {
    const normalizedType = this.normalizeDatabaseType(databaseType);
    return this.optimizers.has(normalizedType);
  }

  /**
   * 모든 최적화 클래스의 성능 힌트 수집
   * @param databaseType 특정 데이터베이스 타입 (선택사항)
   * @returns 성능 힌트 배열
   */
  getAllPerformanceHints(databaseType?: string) {
    if (databaseType) {
      const optimizer = this.getOptimizer(databaseType);
      return optimizer ? optimizer.getPerformanceHints() : [];
    }

    const allHints = [];
    for (const optimizer of this.optimizers.values()) {
      const hints = optimizer.getPerformanceHints();
      allHints.push({
        databaseType: optimizer.databaseType,
        hints,
      });
    }
    return allHints;
  }

  /**
   * 데이터베이스별 특화 기능 지원 여부 확인
   * @param databaseType 데이터베이스 타입
   * @param feature 확인할 기능
   * @returns 지원 여부
   */
  supportsFeature(databaseType: string, feature: any): boolean {
    const optimizer = this.getOptimizer(databaseType);
    return optimizer ? optimizer.supportsFeature(feature) : false;
  }

  /**
   * 데이터베이스별 최적 배치 크기 반환
   * @param databaseType 데이터베이스 타입
   * @returns 배치 크기
   */
  getBatchSize(databaseType: string): number {
    const optimizer = this.getOptimizer(databaseType);
    return optimizer ? optimizer.getBatchSize() : 1000; // 기본값
  }

  /**
   * 데이터베이스 타입 정규화
   * @param databaseType 원본 데이터베이스 타입
   * @returns 정규화된 데이터베이스 타입
   */
  private normalizeDatabaseType(databaseType: string): string {
    if (!databaseType) return '';
    
    const type = databaseType.toLowerCase().trim();
    
    // 타입 매핑
    const typeMapping: { [key: string]: string } = {
      'mysql2': 'mysql',
      'mariadb': 'mysql',
      'postgres': 'postgresql',
      'pg': 'postgresql',
      'cockroach': 'cockroachdb',
      'oracledb': 'oracle',
      'ora': 'oracle',
      'mssql': 'sqlserver',
      'sqlserver': 'sqlserver',
      'sqlite': 'sqlite3',
      'sqlite3': 'sqlite3',
    };

    return typeMapping[type] || type;
  }

  /**
   * 데이터베이스별 연결 설정 최적화 적용
   * @param databaseType 데이터베이스 타입
   * @param baseConfig 기본 연결 설정
   * @returns 최적화된 연결 설정
   */
  getOptimizedConnectionConfig(databaseType: string, baseConfig: any): any {
    const optimizer = this.getOptimizer(databaseType);
    
    if (optimizer) {
      return optimizer.getOptimizedConnectionConfig(baseConfig);
    }

    // 기본 최적화 설정
    return {
      ...baseConfig,
      pool: {
        min: 0,
        max: 10,
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false,
        ...baseConfig.pool,
      },
      acquireConnectionTimeout: 30000,
    };
  }

  /**
   * 데이터베이스별 에러 매핑
   * @param databaseType 데이터베이스 타입
   * @param error 원본 에러
   * @returns 매핑된 에러 정보
   */
  mapError(databaseType: string, error: any) {
    const optimizer = this.getOptimizer(databaseType);
    
    if (optimizer) {
      return optimizer.mapError(error);
    }

    // 기본 에러 매핑
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || '알 수 없는 데이터베이스 오류가 발생했습니다.',
      severity: 'medium' as const,
      retryable: false,
      suggestions: ['연결 설정을 확인해주세요.', '쿼리를 확인해주세요.'],
    };
  }

  /**
   * 새로운 최적화 클래스 등록
   * @param databaseType 데이터베이스 타입
   * @param optimizer 최적화 클래스 인스턴스
   */
  registerOptimizer(databaseType: string, optimizer: IDatabaseOptimizer): void {
    const normalizedType = this.normalizeDatabaseType(databaseType);
    this.optimizers.set(normalizedType, optimizer);
  }

  /**
   * 최적화 클래스 제거
   * @param databaseType 데이터베이스 타입
   */
  unregisterOptimizer(databaseType: string): void {
    const normalizedType = this.normalizeDatabaseType(databaseType);
    this.optimizers.delete(normalizedType);
  }

  /**
   * 데이터베이스별 최적화 통계 수집
   * @returns 최적화 통계
   */
  getOptimizationStats() {
    const stats = {
      totalOptimizers: this.optimizers.size,
      supportedDatabases: this.getSupportedDatabaseTypes(),
      optimizersByCategory: {
        relational: ['mysql', 'postgresql', 'oracle', 'cockroachdb'],
        analytical: ['bigquery', 'snowflake'],
        nosql: [],
        inmemory: [],
      },
      featureSupport: {},
    };

    // 각 옵티마이저별 기능 지원 현황 수집
    for (const [dbType, optimizer] of this.optimizers.entries()) {
      stats.featureSupport[dbType] = {
        hints: optimizer.getPerformanceHints().length,
        batchSize: optimizer.getBatchSize(),
        databaseType: optimizer.databaseType,
      };
    }

    return stats;
  }
}