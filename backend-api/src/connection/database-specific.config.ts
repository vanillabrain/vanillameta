import { Knex } from 'knex';

/**
 * 데이터베이스별 특화 설정
 */
export interface DatabaseSpecificConfig {
  connectionConfig: Partial<Knex.Config>;
  performanceSettings: {
    batchSize: number;
    queryTimeout: number;
    connectionTimeout: number;
    maxConnections: number;
  };
  features: {
    supportsJson: boolean;
    supportsArrays: boolean;
    supportsPartitioning: boolean;
    supportsClustering: boolean;
    supportsUpsert: boolean;
    supportsBulkInsert: boolean;
  };
  optimizationHints: {
    preferredJoinType: 'nested_loop' | 'hash' | 'merge' | 'auto';
    indexStrategy: 'btree' | 'gin' | 'gist' | 'hash' | 'auto';
    partitionStrategy: 'range' | 'hash' | 'list' | 'auto' | 'none';
  };
}

/**
 * 환경별 설정
 */
const getEnvironmentMultiplier = (): number => {
  switch (process.env.NODE_ENV) {
    case 'prod':
      return 1.0;
    case 'dev':
      return 0.7;
    case 'local':
      return 0.3;
    default:
      return 0.5;
  }
};

/**
 * Lambda 메모리 크기 기반 연결 수 계산
 */
const calculateMaxConnections = (baseMax: number): number => {
  const envMultiplier = getEnvironmentMultiplier();
  const memoryMB = parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) || 512;
  
  // 메모리 기반 조정 (512MB = 1.0, 1024MB = 1.5, 3008MB = 3.0)
  const memoryMultiplier = Math.min(memoryMB / 512, 3.0);
  
  return Math.ceil(baseMax * envMultiplier * memoryMultiplier);
};

/**
 * MySQL/MariaDB 특화 설정
 */
export const getMySQLConfig = (): DatabaseSpecificConfig => ({
  connectionConfig: {
    client: 'mysql2',
    // @ts-ignore - MySQL specific connection properties
    connection: {
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      multipleStatements: false,
      charset: 'utf8mb4',
      timezone: '+09:00',
      connectTimeout: 30000,
      acquireTimeout: 30000,
      timeout: 30000,
    },
    pool: {
      min: 0,
      max: calculateMaxConnections(10),
      createTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000, // 5분
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
      afterCreate: (conn: any, done: Function) => {
        const queries = [
          'SET SESSION sql_mode="TRADITIONAL"',
          'SET SESSION time_zone="+09:00"',
          'SET SESSION autocommit=1',
          'SET SESSION tx_isolation="READ-COMMITTED"',
        ];
        
        let completed = 0;
        queries.forEach(query => {
          conn.query(query, (err: any) => {
            completed++;
            if (completed === queries.length) {
              done(err, conn);
            }
          });
        });
      },
    },
  },
  performanceSettings: {
    batchSize: parseInt(process.env.MYSQL_BATCH_SIZE) || 1000,
    queryTimeout: 30000,
    connectionTimeout: 30000,
    maxConnections: calculateMaxConnections(10),
  },
  features: {
    supportsJson: true, // MySQL 5.7+
    supportsArrays: false,
    supportsPartitioning: true,
    supportsClustering: false,
    supportsUpsert: true, // INSERT ... ON DUPLICATE KEY UPDATE
    supportsBulkInsert: true,
  },
  optimizationHints: {
    preferredJoinType: 'nested_loop',
    indexStrategy: 'btree',
    partitionStrategy: 'range',
  },
});

/**
 * PostgreSQL 특화 설정
 */
export const getPostgreSQLConfig = (): DatabaseSpecificConfig => ({
  connectionConfig: {
    client: 'pg',
    connection: {
      ssl: process.env.NODE_ENV === 'prod' ? { rejectUnauthorized: false } : false,
      statement_timeout: 30000,
      idle_in_transaction_session_timeout: 60000,
      timezone: 'Asia/Seoul',
      application_name: 'VanillaMeta-BI',
    },
    pool: {
      min: 0,
      max: calculateMaxConnections(20), // PostgreSQL은 더 많은 연결 처리 가능
      createTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
      afterCreate: async (conn: any, done: Function) => {
        try {
          await conn.query('SET timezone TO "Asia/Seoul"');
          await conn.query('SET statement_timeout TO 30000');
          await conn.query('SET idle_in_transaction_session_timeout TO 60000');
          done(null, conn);
        } catch (err) {
          done(err, conn);
        }
      },
    },
    searchPath: ['public'],
  },
  performanceSettings: {
    batchSize: parseInt(process.env.POSTGRESQL_BATCH_SIZE) || 5000,
    queryTimeout: 30000,
    connectionTimeout: 30000,
    maxConnections: calculateMaxConnections(20),
  },
  features: {
    supportsJson: true,
    supportsArrays: true,
    supportsPartitioning: true,
    supportsClustering: false,
    supportsUpsert: true, // INSERT ... ON CONFLICT
    supportsBulkInsert: true,
  },
  optimizationHints: {
    preferredJoinType: 'hash',
    indexStrategy: 'gin', // JSON, 배열에 최적
    partitionStrategy: 'range',
  },
});

/**
 * BigQuery 특화 설정
 */
export const getBigQueryConfig = (): DatabaseSpecificConfig => ({
  connectionConfig: {
    client: require('knex-bigquery'),
    // @ts-ignore - BigQuery specific connection properties
    connection: {
      projectId: process.env.BIGQUERY_PROJECT_ID,
      keyFilename: process.env.BIGQUERY_KEY_FILE,
      location: process.env.BIGQUERY_LOCATION || 'US',
      maximumBillingTier: parseInt(process.env.BIGQUERY_MAX_BILLING_TIER) || 1,
      useLegacySql: false,
      useQueryCache: true,
    },
    pool: {
      min: 0,
      max: calculateMaxConnections(5), // BigQuery는 API 제한
      createTimeoutMillis: 60000,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 600000, // 10분
      reapIntervalMillis: 30000,
      createRetryIntervalMillis: 1000,
      propagateCreateError: false,
    },
    options: {
      priority: 'INTERACTIVE',
      maximumBytesBilled: process.env.BIGQUERY_MAX_BYTES_BILLED || '1000000000',
      useLegacySql: false,
      useQueryCache: true,
      allowLargeResults: true,
      flattenResults: false,
    },
  },
  performanceSettings: {
    batchSize: parseInt(process.env.BIGQUERY_BATCH_SIZE) || 1000,
    queryTimeout: 300000, // 5분
    connectionTimeout: 60000,
    maxConnections: calculateMaxConnections(5),
  },
  features: {
    supportsJson: true,
    supportsArrays: true,
    supportsPartitioning: true,
    supportsClustering: true,
    supportsUpsert: false, // MERGE 사용
    supportsBulkInsert: true,
  },
  optimizationHints: {
    preferredJoinType: 'hash',
    indexStrategy: 'auto', // BigQuery는 자동 최적화
    partitionStrategy: 'range', // 날짜 기반 파티셔닝
  },
});

/**
 * Snowflake 특화 설정
 */
export const getSnowflakeConfig = (): DatabaseSpecificConfig => ({
  connectionConfig: {
    client: require('../knex-dialects/snowflake'),
    // @ts-ignore - Snowflake specific connection properties
    connection: {
      account: process.env.SNOWFLAKE_ACCOUNT,
      username: process.env.SNOWFLAKE_USER,
      password: process.env.SNOWFLAKE_PASSWORD,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
      database: process.env.SNOWFLAKE_DATABASE,
      schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
      role: process.env.SNOWFLAKE_ROLE || 'PUBLIC',
      application: 'VanillaMeta-BI',
      clientSessionKeepAlive: true,
      clientSessionKeepAliveHeartbeatFrequency: 3600,
      timezone: 'Asia/Seoul',
    },
    pool: {
      min: 0,
      max: calculateMaxConnections(10),
      createTimeoutMillis: 60000,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 600000, // 10분
      reapIntervalMillis: 30000,
      createRetryIntervalMillis: 1000,
      propagateCreateError: false,
    },
    options: {
      autoResume: true,
      autoSuspend: 600, // 10분
      useCache: true,
      compressResponse: true,
    },
  },
  performanceSettings: {
    batchSize: parseInt(process.env.SNOWFLAKE_BATCH_SIZE) || 10000,
    queryTimeout: 300000, // 5분
    connectionTimeout: 60000,
    maxConnections: calculateMaxConnections(10),
  },
  features: {
    supportsJson: true,
    supportsArrays: true,
    supportsPartitioning: true,
    supportsClustering: true,
    supportsUpsert: true, // MERGE
    supportsBulkInsert: true,
  },
  optimizationHints: {
    preferredJoinType: 'hash',
    indexStrategy: 'auto', // Snowflake는 자동 클러스터링
    partitionStrategy: 'auto',
  },
});

/**
 * Oracle 특화 설정
 */
export const getOracleConfig = (): DatabaseSpecificConfig => ({
  connectionConfig: {
    client: 'oracledb',
    // @ts-ignore - Oracle specific connection properties
    connection: {
      connectTimeout: 30000,
      callTimeout: 30000,
      poolAlias: 'vanillameta-pool',
    },
    pool: {
      min: 0,
      max: calculateMaxConnections(15),
      createTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 600000, // 10분
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
    },
    options: {
      autoCommit: false,
      maxRows: 1000,
      outFormat: 4002, // OBJECT format
      fetchAsString: ['CLOB'],
      fetchAsBuffer: ['BLOB'],
      prefetchRows: 100,
    },
  },
  performanceSettings: {
    batchSize: parseInt(process.env.ORACLE_BATCH_SIZE) || 1000,
    queryTimeout: 30000,
    connectionTimeout: 30000,
    maxConnections: calculateMaxConnections(15),
  },
  features: {
    supportsJson: true, // Oracle 12c+
    supportsArrays: false,
    supportsPartitioning: true,
    supportsClustering: false,
    supportsUpsert: true, // MERGE
    supportsBulkInsert: true,
  },
  optimizationHints: {
    preferredJoinType: 'nested_loop',
    indexStrategy: 'btree',
    partitionStrategy: 'range',
  },
});

/**
 * 데이터베이스별 설정 팩토리
 */
export const getDatabaseSpecificConfig = (databaseType: string): DatabaseSpecificConfig | null => {
  const normalizedType = databaseType?.toLowerCase().trim();
  
  switch (normalizedType) {
    case 'mysql':
    case 'mysql2':
    case 'mariadb':
      return getMySQLConfig();
    
    case 'pg':
    case 'postgres':
    case 'postgresql':
    case 'cockroachdb':
      return getPostgreSQLConfig();
    
    case 'bigquery':
      return getBigQueryConfig();
    
    case 'snowflake':
      return getSnowflakeConfig();
    
    case 'oracle':
    case 'oracledb':
      return getOracleConfig();
    
    default:
      return null;
  }
};

/**
 * 모든 지원 데이터베이스 타입 반환
 */
export const getSupportedDatabaseTypes = (): string[] => [
  'mysql', 'mysql2', 'mariadb',
  'pg', 'postgres', 'postgresql', 'cockroachdb',
  'bigquery',
  'snowflake',
  'oracle', 'oracledb',
];

/**
 * 데이터베이스별 성능 벤치마크 정보
 */
export const getDatabaseBenchmarks = () => ({
  mysql: {
    averageConnectionTime: 50, // ms
    queriesPerSecond: 5000,
    optimalBatchSize: 1000,
    memoryPerConnection: 2, // MB
  },
  postgresql: {
    averageConnectionTime: 80, // ms
    queriesPerSecond: 8000,
    optimalBatchSize: 5000,
    memoryPerConnection: 3, // MB
  },
  bigquery: {
    averageConnectionTime: 1000, // ms
    queriesPerSecond: 100, // API 제한
    optimalBatchSize: 1000,
    memoryPerConnection: 1, // API 기반
  },
  snowflake: {
    averageConnectionTime: 800, // ms
    queriesPerSecond: 500,
    optimalBatchSize: 10000,
    memoryPerConnection: 2, // MB
  },
  oracle: {
    averageConnectionTime: 100, // ms
    queriesPerSecond: 4000,
    optimalBatchSize: 1000,
    memoryPerConnection: 4, // MB
  },
});

/**
 * 환경별 최적화 설정
 */
export const getEnvironmentOptimizations = () => {
  const env = process.env.NODE_ENV || 'development';
  
  return {
    local: {
      poolSize: 0.3,
      queryTimeout: 10000, // 10초
      connectionTimeout: 10000,
      batchSize: 0.1,
      enableLogging: true,
      enableProfiling: true,
    },
    dev: {
      poolSize: 0.7,
      queryTimeout: 30000, // 30초
      connectionTimeout: 30000,
      batchSize: 0.5,
      enableLogging: true,
      enableProfiling: true,
    },
    prod: {
      poolSize: 1.0,
      queryTimeout: 30000, // 30초
      connectionTimeout: 30000,
      batchSize: 1.0,
      enableLogging: false,
      enableProfiling: false,
    },
  }[env] || {
    poolSize: 0.5,
    queryTimeout: 30000,
    connectionTimeout: 30000,
    batchSize: 0.5,
    enableLogging: true,
    enableProfiling: false,
  };
};