import { Module } from '@nestjs/common';
import { BaseDatabaseOptimizer } from './base-optimizer';
import { MySQLOptimizer } from './mysql-optimizer';
import { PostgreSQLOptimizer } from './postgresql-optimizer';
import { BigQueryOptimizer } from './bigquery-optimizer';
import { SnowflakeOptimizer } from './snowflake-optimizer';
import { OracleOptimizer } from './oracle-optimizer';
import { SqlServerOptimizer } from './sqlserver-optimizer';
import { DatabaseOptimizerFactory } from './database-optimizer-factory';
import { AdvancedQueryOptimizerService } from './advanced-query-optimizer.service';
import { DatabasePerformanceComparatorService } from './database-performance-comparator.service';

/**
 * 데이터베이스 최적화 모듈
 * 모든 데이터베이스별 최적화 클래스들을 관리하는 모듈
 */
@Module({
  providers: [
    MySQLOptimizer,
    PostgreSQLOptimizer,
    BigQueryOptimizer,
    SnowflakeOptimizer,
    OracleOptimizer,
    SqlServerOptimizer,
    DatabaseOptimizerFactory,
    AdvancedQueryOptimizerService,
    DatabasePerformanceComparatorService,
  ],
  exports: [
    MySQLOptimizer,
    PostgreSQLOptimizer,
    BigQueryOptimizer,
    SnowflakeOptimizer,
    OracleOptimizer,
    SqlServerOptimizer,
    DatabaseOptimizerFactory,
    AdvancedQueryOptimizerService,
    DatabasePerformanceComparatorService,
  ],
})
export class DatabaseOptimizersModule {}

// 편의를 위한 타입 및 클래스 재export
export { BaseDatabaseOptimizer } from './base-optimizer';
export { MySQLOptimizer } from './mysql-optimizer';
export { PostgreSQLOptimizer } from './postgresql-optimizer';
export { BigQueryOptimizer } from './bigquery-optimizer';
export { SnowflakeOptimizer } from './snowflake-optimizer';
export { OracleOptimizer } from './oracle-optimizer';
export { SqlServerOptimizer } from './sqlserver-optimizer';
export { DatabaseOptimizerFactory } from './database-optimizer-factory';
export { AdvancedQueryOptimizerService } from './advanced-query-optimizer.service';
export { DatabasePerformanceComparatorService } from './database-performance-comparator.service';

/**
 * 지원되는 데이터베이스 타입 목록
 */
export const SUPPORTED_DATABASE_TYPES = [
  'mysql',
  'mysql2',
  'mariadb',
  'pg',
  'postgres',
  'postgresql',
  'cockroachdb',
  'oracle',
  'oracledb',
  'mssql',
  'sqlserver',
  'bigquery',
  'snowflake',
] as const;

/**
 * 데이터베이스 타입 별칭 매핑
 */
export const DATABASE_TYPE_ALIASES: Record<string, string> = {
  mysql: 'mysql2',
  mariadb: 'mysql2',
  postgres: 'pg',
  postgresql: 'pg',
  cockroachdb: 'pg',
};

/**
 * 데이터베이스별 기본 최적화 설정
 */
export const DEFAULT_OPTIMIZATION_CONFIG = {
  mysql: {
    batchSize: 1000,
    enableCompression: true,
    enableKeepAlive: true,
    maxConnections: 10,
  },
  postgresql: {
    batchSize: 2000,
    enableSSL: false,
    searchPath: ['public'],
    maxConnections: 20,
  },
  oracle: {
    batchSize: 1000,
    enableArrayInsert: true,
    enableParallel: false,
    maxConnections: 15,
  },
  sqlserver: {
    batchSize: 1000,
    enableBulkInsert: true,
    enableCompression: true,
    maxConnections: 15,
  },
  bigquery: {
    batchSize: 5000,
    maxCostBytes: '1000000000', // 1GB
    useCache: true,
    maxConnections: 5,
  },
  snowflake: {
    batchSize: 10000,
    defaultWarehouse: 'COMPUTE_WH',
    useCache: true,
    maxConnections: 10,
  },
} as const;

/**
 * 환경별 데이터베이스 설정
 */
export const ENVIRONMENT_CONFIGS = {
  local: {
    maxConnections: 2,
    enableDebug: true,
    enableLogging: true,
    connectionTimeout: 30000,
  },
  dev: {
    maxConnections: 5,
    enableDebug: true,
    enableLogging: true,
    connectionTimeout: 30000,
  },
  prod: {
    maxConnections: 20,
    enableDebug: false,
    enableLogging: false,
    connectionTimeout: 10000,
  },
} as const;

/**
 * 최적화 레벨 정의
 */
export enum OptimizationLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  AGGRESSIVE = 'aggressive',
}

/**
 * 최적화 옵션 인터페이스
 */
export interface DatabaseOptimizationOptions {
  level?: OptimizationLevel;
  enableBatching?: boolean;
  enableCaching?: boolean;
  enableCompression?: boolean;
  customBatchSize?: number;
  customTimeout?: number;
  enableQueryHints?: boolean;
  enablePartitioning?: boolean;
}

/**
 * 유틸리티 함수들
 */
export class DatabaseOptimizerUtils {
  /**
   * 데이터베이스 타입 정규화
   */
  static normalizeDatabaseType(type: string): string {
    const normalized = type.toLowerCase().trim();
    return DATABASE_TYPE_ALIASES[normalized] || normalized;
  }

  /**
   * 환경별 최적화 설정 병합
   */
  static mergeEnvironmentConfig(baseConfig: any, environment = 'dev', databaseType: string): any {
    const envConfig =
      ENVIRONMENT_CONFIGS[environment as keyof typeof ENVIRONMENT_CONFIGS] ||
      ENVIRONMENT_CONFIGS.dev;
    const dbConfig =
      DEFAULT_OPTIMIZATION_CONFIG[databaseType as keyof typeof DEFAULT_OPTIMIZATION_CONFIG] || {};

    return {
      ...baseConfig,
      ...dbConfig,
      ...envConfig,
    };
  }

  /**
   * 최적화 레벨에 따른 설정 조정
   */
  static applyOptimizationLevel(
    config: any,
    level: OptimizationLevel = OptimizationLevel.STANDARD,
  ): any {
    switch (level) {
      case OptimizationLevel.BASIC:
        return {
          ...config,
          enableCaching: false,
          enableCompression: false,
          batchSize: Math.min(config.batchSize || 1000, 500),
        };

      case OptimizationLevel.AGGRESSIVE:
        return {
          ...config,
          enableCaching: true,
          enableCompression: true,
          batchSize: (config.batchSize || 1000) * 2,
          enableQueryHints: true,
          enablePartitioning: true,
        };

      case OptimizationLevel.STANDARD:
      default:
        return config;
    }
  }

  /**
   * 데이터베이스 연결 풀 크기 계산
   */
  static calculatePoolSize(
    environment: string,
    databaseType: string,
    customMax?: number,
  ): { min: number; max: number } {
    const envConfig =
      ENVIRONMENT_CONFIGS[environment as keyof typeof ENVIRONMENT_CONFIGS] ||
      ENVIRONMENT_CONFIGS.dev;
    const dbConfig =
      DEFAULT_OPTIMIZATION_CONFIG[databaseType as keyof typeof DEFAULT_OPTIMIZATION_CONFIG];

    const baseMax = customMax || dbConfig?.maxConnections || envConfig.maxConnections;

    return {
      min: 0, // Lambda 환경에서는 항상 0
      max: Math.max(1, baseMax),
    };
  }

  /**
   * 배치 크기 최적화
   */
  static optimizeBatchSize(
    databaseType: string,
    dataSize: number,
    options?: DatabaseOptimizationOptions,
  ): number {
    const dbConfig =
      DEFAULT_OPTIMIZATION_CONFIG[databaseType as keyof typeof DEFAULT_OPTIMIZATION_CONFIG];
    let batchSize = options?.customBatchSize || dbConfig?.batchSize || 1000;

    // 데이터 크기에 따른 동적 조정
    if (dataSize > 100000) {
      batchSize = Math.min(batchSize * 2, 10000);
    } else if (dataSize < 100) {
      batchSize = Math.min(batchSize, dataSize);
    }

    // 최적화 레벨 적용
    if (options?.level) {
      const levelConfig = this.applyOptimizationLevel({ batchSize }, options.level);
      batchSize = levelConfig.batchSize;
    }

    return Math.max(1, batchSize);
  }
}
