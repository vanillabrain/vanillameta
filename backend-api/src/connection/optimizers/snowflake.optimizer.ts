import { Knex } from 'knex';
import { Injectable } from '@nestjs/common';
import {
  IDatabaseOptimizer,
  DatabaseFeature,
  DatabaseError,
  PerformanceHint,
} from './database-optimizer.interface';

/**
 * Snowflake 최적화 클래스
 */
@Injectable()
export class SnowflakeOptimizer implements IDatabaseOptimizer {
  readonly databaseType = 'snowflake';

  /**
   * Snowflake에 최적화된 연결 설정
   */
  getOptimizedConnectionConfig(baseConfig: any): Knex.Config {
    const optimizedConfig: Knex.Config = {
      ...baseConfig,
      client: require('../knex-dialects/snowflake'), // Snowflake dialect
      connection: {
        ...baseConfig.connection,
        account: process.env.SNOWFLAKE_ACCOUNT,
        username: process.env.SNOWFLAKE_USER,
        password: process.env.SNOWFLAKE_PASSWORD,
        warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
        database: process.env.SNOWFLAKE_DATABASE,
        schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
        role: process.env.SNOWFLAKE_ROLE || 'PUBLIC',
        // Snowflake 특화 설정
        application: 'VanillaMeta-BI',
        authenticator: 'SNOWFLAKE', // 또는 'EXTERNALBROWSER', 'OAUTH'
        // 성능 최적화 설정
        clientSessionKeepAlive: true,
        clientSessionKeepAliveHeartbeatFrequency: 3600, // 1시간
        // 시간대 설정
        timezone: 'Asia/Seoul',
      },
      pool: {
        min: 0,
        max: parseInt(process.env.SNOWFLAKE_POOL_MAX) || 10,
        createTimeoutMillis: 60000, // 1분 - Snowflake 초기 연결 시간
        acquireTimeoutMillis: 60000,
        idleTimeoutMillis: 600000, // 10분
        reapIntervalMillis: 30000,
        createRetryIntervalMillis: 1000,
        propagateCreateError: false,
        // Snowflake 연결 풀 이벤트 처리
        afterCreate: async (conn: any, done: Function) => {
          try {
            // Snowflake 세션 설정
            await conn.execute('ALTER SESSION SET TIMEZONE = "Asia/Seoul"');
            await conn.execute('ALTER SESSION SET QUERY_TAG = "VanillaMeta-BI"');
            await conn.execute('ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 300'); // 5분
            done(null, conn);
          } catch (err) {
            console.warn(`Snowflake session setup warning: ${err.message}`);
            done(err, conn);
          }
        },
      },
      acquireConnectionTimeout: 60000,
      // Snowflake 특화 옵션
      options: {
        // 웨어하우스 관리
        autoResume: true,
        autoSuspend: 600, // 10분 후 자동 일시정지
        // 쿼리 최적화
        useCache: true,
        multiStatementCount: 1,
        // 결과 압축
        compressResponse: true,
      },
    };

    return optimizedConfig;
  }

  /**
   * Snowflake 쿼리 최적화
   */
  optimizeQuery(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // Snowflake 쿼리 태그 설정 (모니터링용)
    queryBuilder = queryBuilder.options({
      queryTag: `app:vanillameta,env:${process.env.NODE_ENV},type:${this.getQueryType(queryBuilder)}`,
    });

    // 웨어하우스 크기 최적화
    if (this.isLargeQuery(queryBuilder)) {
      queryBuilder = this.setWarehouseSize(queryBuilder, 'MEDIUM');
    }

    // 클러스터링 키 활용
    if (this.hasClusteringKey(queryBuilder)) {
      queryBuilder = this.optimizeClusteringQuery(queryBuilder);
    }

    // 결과 캐싱 최적화
    queryBuilder = queryBuilder.options({
      useQueryCache: true,
      resultCacheTTL: 3600, // 1시간
    });

    // 결과 제한 최적화
    if (!this.hasLimit(queryBuilder)) {
      queryBuilder = queryBuilder.limit(10000); // Snowflake는 큰 제한 가능
    }

    return queryBuilder;
  }

  /**
   * Snowflake 최적 배치 크기
   */
  getBatchSize(): number {
    // Snowflake는 대용량 배치 처리에 최적화됨
    return parseInt(process.env.SNOWFLAKE_BATCH_SIZE) || 10000;
  }

  /**
   * Snowflake 지원 기능 확인
   */
  supportsFeature(feature: DatabaseFeature): boolean {
    const supportedFeatures = [
      DatabaseFeature.JSON_OPERATIONS,
      DatabaseFeature.ARRAY_OPERATIONS,
      DatabaseFeature.WINDOW_FUNCTIONS,
      DatabaseFeature.CTE,
      DatabaseFeature.PARTITIONING,
      DatabaseFeature.CLUSTERING,
      DatabaseFeature.MATERIALIZED_VIEWS,
      DatabaseFeature.STORED_PROCEDURES,
      DatabaseFeature.TIME_SERIES,
      DatabaseFeature.UPSERT,
      DatabaseFeature.BULK_INSERT,
      DatabaseFeature.STREAMING,
    ];

    return supportedFeatures.includes(feature);
  }

  /**
   * Snowflake 에러 매핑
   */
  mapError(error: any): DatabaseError {
    const snowflakeErrors: { [key: string]: DatabaseError } = {
      '250001': {
        code: 'AUTH_FAILED',
        message: 'Snowflake 인증에 실패했습니다.',
        severity: 'high',
        retryable: false,
        suggestions: ['사용자 이름과 비밀번호를 확인해주세요.', 'Snowflake 계정이 활성화되어 있는지 확인해주세요.'],
      },
      '002003': {
        code: 'DATABASE_NOT_FOUND',
        message: 'Snowflake 데이터베이스를 찾을 수 없습니다.',
        severity: 'high',
        retryable: false,
        suggestions: ['데이터베이스 이름을 확인해주세요.', 'USE DATABASE 권한이 있는지 확인해주세요.'],
      },
      '002023': {
        code: 'WAREHOUSE_NOT_FOUND',
        message: 'Snowflake 웨어하우스를 찾을 수 없습니다.',
        severity: 'high',
        retryable: false,
        suggestions: ['웨어하우스 이름을 확인해주세요.', 'USAGE 권한이 있는지 확인해주세요.'],
      },
      '605': {
        code: 'WAREHOUSE_SUSPENDED',
        message: 'Snowflake 웨어하우스가 일시정지되었습니다.',
        severity: 'medium',
        retryable: true,
        suggestions: ['웨어하우스가 자동으로 재시작됩니다.', '웨어하우스를 수동으로 시작할 수 있습니다.'],
      },
      '1003': {
        code: 'QUERY_TIMEOUT',
        message: '쿼리 실행 시간이 초과되었습니다.',
        severity: 'medium',
        retryable: true,
        suggestions: ['쿼리를 최적화해주세요.', '더 큰 웨어하우스를 사용해주세요.'],
      },
      '1304': {
        code: 'RESOURCE_LIMIT_EXCEEDED',
        message: '리소스 제한을 초과했습니다.',
        severity: 'high',
        retryable: true,
        suggestions: ['웨어하우스 크기를 늘려주세요.', '쿼리를 작은 단위로 나누어 실행해주세요.'],
      },
    };

    const errorCode = error.code?.toString();
    return snowflakeErrors[errorCode] || {
      code: 'UNKNOWN_ERROR',
      message: error.message || '알 수 없는 Snowflake 오류가 발생했습니다.',
      severity: 'medium',
      retryable: false,
      suggestions: ['쿼리를 확인해주세요.', 'Snowflake 콘솔에서 상세 오류를 확인해주세요.'],
    };
  }

  /**
   * Snowflake 성능 힌트 제공
   */
  getPerformanceHints(): PerformanceHint[] {
    return [
      {
        category: 'configuration',
        priority: 'high',
        description: '클러스터링 키를 설정하여 쿼리 성능을 향상시키세요.',
        implementation: 'ALTER TABLE table_name CLUSTER BY (column1, column2);',
      },
      {
        category: 'query',
        priority: 'high',
        description: '적절한 웨어하우스 크기를 선택하세요.',
        implementation: 'USE WAREHOUSE LARGE_WH; -- 복잡한 쿼리용',
      },
      {
        category: 'configuration',
        priority: 'high',
        description: '자동 클러스터링을 활성화하세요.',
        implementation: 'ALTER TABLE table_name RESUME RECLUSTER;',
      },
      {
        category: 'query',
        priority: 'medium',
        description: '결과 캐싱을 활용하세요.',
        implementation: 'ALTER SESSION SET USE_CACHED_RESULT = TRUE;',
      },
      {
        category: 'query',
        priority: 'medium',
        description: 'COPY INTO 명령으로 대용량 데이터를 로드하세요.',
        implementation: 'COPY INTO table FROM @stage/path FILE_FORMAT = (TYPE = CSV);',
      },
      {
        category: 'configuration',
        priority: 'medium',
        description: '웨어하우스 자동 일시정지를 설정하세요.',
        implementation: 'ALTER WAREHOUSE warehouse_name SET AUTO_SUSPEND = 60;',
      },
    ];
  }

  /**
   * 쿼리 타입 추출
   */
  private getQueryType(queryBuilder: Knex.QueryBuilder): string {
    const sql = queryBuilder.toString().toUpperCase();
    if (sql.startsWith('SELECT')) return 'select';
    if (sql.startsWith('INSERT')) return 'insert';
    if (sql.startsWith('UPDATE')) return 'update';
    if (sql.startsWith('DELETE')) return 'delete';
    if (sql.startsWith('MERGE')) return 'merge';
    return 'other';
  }

  /**
   * 대용량 쿼리 여부 확인
   */
  private isLargeQuery(queryBuilder: Knex.QueryBuilder): boolean {
    const sql = queryBuilder.toString();
    return sql.includes('JOIN') && sql.includes('GROUP BY') && sql.includes('ORDER BY');
  }

  /**
   * 웨어하우스 크기 설정
   */
  private setWarehouseSize(queryBuilder: Knex.QueryBuilder, size: string): Knex.QueryBuilder {
    return queryBuilder.options({
      warehouseSize: size,
      autoResume: true,
    });
  }

  /**
   * 클러스터링 키 존재 여부 확인
   */
  private hasClusteringKey(queryBuilder: Knex.QueryBuilder): boolean {
    const sql = queryBuilder.toString();
    return sql.includes('WHERE') && (sql.includes('created_at') || sql.includes('user_id'));
  }

  /**
   * 클러스터링 쿼리 최적화
   */
  private optimizeClusteringQuery(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // 클러스터링 키 순서로 정렬
    return queryBuilder.orderBy(['created_at', 'user_id']);
  }

  /**
   * LIMIT 절 존재 여부 확인
   */
  private hasLimit(queryBuilder: Knex.QueryBuilder): boolean {
    const sql = queryBuilder.toString();
    return sql.includes('LIMIT');
  }

  /**
   * Snowflake 웨어하우스 크기별 쿼리 실행
   */
  async executeWithWarehouse(
    knex: Knex,
    query: string,
    warehouseSize: 'XSMALL' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE' = 'SMALL'
  ): Promise<any> {
    // 웨어하우스 전환
    await knex.raw(`USE WAREHOUSE ${warehouseSize}_WH`);
    
    try {
      const result = await knex.raw(query);
      return result;
    } finally {
      // 기본 웨어하우스로 복원
      await knex.raw('USE WAREHOUSE DEFAULT_WH');
    }
  }

  /**
   * Snowflake MERGE (UPSERT) 구현
   */
  async merge(
    knex: Knex,
    targetTable: string,
    sourceTable: string,
    matchCondition: string,
    updateColumns: string[],
    insertColumns: string[]
  ): Promise<void> {
    const updateClause = updateColumns
      .map(col => `${col} = source.${col}`)
      .join(', ');
    
    const insertClause = `(${insertColumns.join(', ')}) VALUES (${insertColumns.map(col => `source.${col}`).join(', ')})`;

    const mergeQuery = `
      MERGE INTO ${targetTable} AS target
      USING ${sourceTable} AS source
      ON ${matchCondition}
      WHEN MATCHED THEN
        UPDATE SET ${updateClause}
      WHEN NOT MATCHED THEN
        INSERT ${insertClause}
    `;

    await knex.raw(mergeQuery);
  }

  /**
   * Snowflake COPY INTO 구현
   */
  async copyInto(
    knex: Knex,
    tableName: string,
    stagePath: string,
    fileFormat: {
      type: 'CSV' | 'JSON' | 'PARQUET' | 'AVRO';
      compression?: 'GZIP' | 'AUTO';
      fieldDelimiter?: string;
      skipHeader?: number;
    }
  ): Promise<void> {
    const formatOptions = Object.entries(fileFormat)
      .map(([key, value]) => `${key.toUpperCase()} = ${value}`)
      .join(' ');

    const copyQuery = `
      COPY INTO ${tableName}
      FROM ${stagePath}
      FILE_FORMAT = (${formatOptions})
      ON_ERROR = 'CONTINUE'
    `;

    await knex.raw(copyQuery);
  }

  /**
   * Snowflake 클러스터링 정보 조회
   */
  async getClusteringInfo(knex: Knex, tableName: string): Promise<any> {
    const query = `
      SELECT SYSTEM$CLUSTERING_INFORMATION('${tableName}') AS clustering_info
    `;
    
    const result = await knex.raw(query);
    return JSON.parse(result[0]?.clustering_info || '{}');
  }

  /**
   * Snowflake 쿼리 프로파일 조회
   */
  async getQueryProfile(knex: Knex, queryId: string): Promise<any> {
    const query = `
      SELECT *
      FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY())
      WHERE QUERY_ID = '${queryId}'
    `;
    
    return knex.raw(query);
  }

  /**
   * Snowflake 웨어하우스 사용량 조회
   */
  async getWarehouseUsage(
    knex: Knex,
    warehouseName: string,
    startDate: string,
    endDate: string
  ): Promise<any> {
    const query = `
      SELECT *
      FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
      WHERE WAREHOUSE_NAME = '${warehouseName}'
        AND START_TIME >= '${startDate}'
        AND START_TIME <= '${endDate}'
      ORDER BY START_TIME DESC
    `;
    
    return knex.raw(query);
  }
}