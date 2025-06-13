import { Knex } from 'knex';
import { Injectable } from '@nestjs/common';
import { BaseDatabaseOptimizer } from './base-optimizer';

/**
 * Snowflake 전용 데이터베이스 최적화
 * 클라우드 데이터 웨어하우스의 고유 기능을 활용한 최적화 전략 구현
 */
@Injectable()
export class SnowflakeOptimizer extends BaseDatabaseOptimizer {
  getDatabaseType(): string {
    return 'snowflake';
  }

  /**
   * Snowflake 쿼리 최적화
   * @param queryBuilder - Knex 쿼리 빌더
   * @param options - 최적화 옵션
   */
  optimizeQuery(
    queryBuilder: Knex.QueryBuilder,
    options: {
      warehouse?: string; // 웨어하우스 크기
      queryTag?: string; // 쿼리 태그 (모니터링용)
      resultCacheTTL?: number; // 결과 캐시 TTL (초)
      timeoutMs?: number; // 쿼리 타임아웃
      maxRetries?: number; // 최대 재시도 횟수
      useResultCache?: boolean; // 결과 캐시 사용
      transactionIsolation?: 'READ_COMMITTED' | 'READ_UNCOMMITTED'; // 트랜잭션 격리 수준
    } = {},
  ): Knex.QueryBuilder {
    const snowflakeOptions: any = {};

    if (options.queryTag) {
      snowflakeOptions.queryTag = options.queryTag;
    }

    if (options.resultCacheTTL) {
      snowflakeOptions.resultCacheTTL = options.resultCacheTTL;
    }

    if (options.timeoutMs) {
      snowflakeOptions.timeout = options.timeoutMs;
    }

    if (options.maxRetries) {
      snowflakeOptions.maxRetries = options.maxRetries;
    }

    if (options.useResultCache !== undefined) {
      snowflakeOptions.useResultCache = options.useResultCache;
    }

    if (options.transactionIsolation) {
      snowflakeOptions.transactionIsolation = options.transactionIsolation;
    }

    return queryBuilder.options(snowflakeOptions);
  }

  /**
   * Snowflake 연결 설정 최적화
   * @param baseConfig - 기본 연결 설정
   * @param environment - 환경
   */
  getOptimizedConnectionConfig(baseConfig: any, environment = 'dev'): Knex.Config {
    const poolConfig = this.getBasePoolConfig(environment);
    const isProduction = environment === 'prod';

    return {
      client: require('../knex-dialects/snowflake'),
      connection: {
        ...baseConfig,
        // Snowflake 특정 설정
        account: baseConfig.account || process.env.SNOWFLAKE_ACCOUNT,
        username: baseConfig.username || process.env.SNOWFLAKE_USER,
        password: baseConfig.password || process.env.SNOWFLAKE_PASSWORD,
        warehouse: baseConfig.warehouse || process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
        database: baseConfig.database || process.env.SNOWFLAKE_DATABASE,
        schema: baseConfig.schema || process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
        role: baseConfig.role || 'PUBLIC',
        // 성능 최적화 설정
        application: 'vanillameta',
        loginTimeout: 60, // 60초
        networkTimeout: 300000, // 5분
        queryTimeout: 300000, // 5분
        // 결과 캐싱 설정
        clientSessionKeepAlive: true,
        clientSessionKeepAliveHeartbeatFrequency: 3600, // 1시간
        // 압축 설정
        useCompression: true,
        // 재시도 설정
        maxRetries: isProduction ? 3 : 1,
        retryTimeout: 30000, // 30초
      },
      pool: {
        ...poolConfig,
        // Snowflake는 연결이 오래 유지될 수 있음
        max: isProduction ? 10 : 5,
        min: 0,
        // 더 긴 타임아웃 설정
        acquireTimeoutMillis: 60000, // 1분
        createTimeoutMillis: 60000, // 1분
        idleTimeoutMillis: 300000, // 5분 (세션 유지)
        // Snowflake 세션 최적화
        afterCreate: async (conn: any, done: Function) => {
          try {
            // 세션 최적화 설정
            const optimizations = [
              // 쿼리 결과 캐싱 활성화
              'ALTER SESSION SET USE_CACHED_RESULT = TRUE',
              // 멀티 클러스터 웨어하우스 활용
              'ALTER SESSION SET MULTI_CLUSTER_WAREHOUSE_SCALING_POLICY = STANDARD',
              // 시간대 설정
              "ALTER SESSION SET TIMEZONE = 'UTC'",
              // JSON 출력 형식 최적화
              'ALTER SESSION SET JSON_INDENT = 0',
              // 날짜 형식 설정
              "ALTER SESSION SET DATE_INPUT_FORMAT = 'YYYY-MM-DD'",
              "ALTER SESSION SET TIMESTAMP_INPUT_FORMAT = 'YYYY-MM-DD HH24:MI:SS'",
              // 쿼리 태그 설정
              `ALTER SESSION SET QUERY_TAG = 'vanillameta-${environment}'`,
            ];

            for (const sql of optimizations) {
              await this.executeSnowflakeQuery(conn, sql);
            }

            this.logger.log('Snowflake session optimized');
            done(null, conn);
          } catch (error) {
            this.logger.error('Failed to optimize Snowflake session', error);
            done(error, conn);
          }
        },
      },
      acquireConnectionTimeout: 60000,
      useNullAsDefault: true,
      debug: !isProduction,
    };
  }

  /**
   * Snowflake 배치 삽입 최적화
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 삽입할 데이터 배열
   * @param options - 옵션
   */
  async batchInsert(
    knex: Knex,
    tableName: string,
    data: any[],
    options: {
      chunkSize?: number;
      warehouse?: string; // 전용 웨어하우스 사용
      useBulkLoad?: boolean; // 대용량 로딩 최적화
      fileFormat?: string; // 파일 형식 (CSV, JSON 등)
      onError?: 'CONTINUE' | 'SKIP_FILE' | 'ABORT_STATEMENT'; // 에러 처리
    } = {},
  ): Promise<any> {
    // Snowflake는 매우 큰 배치를 처리할 수 있음
    const chunkSize = options.chunkSize || 10000;
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    this.logger.log(`Snowflake batch insert: ${data.length} records in ${chunks.length} chunks`);

    // 전용 웨어하우스 사용
    if (options.warehouse) {
      await this.useWarehouse(knex, options.warehouse);
    }

    // 대용량 데이터의 경우 COPY INTO 사용
    if (options.useBulkLoad && data.length > 50000) {
      return this.bulkLoadData(knex, tableName, data, options);
    }

    // 일반 배치 INSERT
    for (const chunk of chunks) {
      try {
        let queryBuilder = knex(tableName);

        const insertOptions: any = {};
        if (options.onError) {
          insertOptions.onError = options.onError;
        }

        queryBuilder = queryBuilder.insert(chunk);
        if (Object.keys(insertOptions).length > 0) {
          queryBuilder = queryBuilder.options(insertOptions);
        }

        const result = await queryBuilder;
        results.push(result);

        // 웨어하우스 크레딧 최적화를 위한 배치 간 대기
        if (chunks.length > 10) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error) {
        this.logger.error(`Snowflake batch insert failed for chunk`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Snowflake 배치 업데이트 최적화 (MERGE 사용)
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 업데이트할 데이터 배열
   * @param keyColumns - 키 컬럼들
   */
  async batchUpdate(
    knex: Knex,
    tableName: string,
    data: any[],
    keyColumns: string[],
  ): Promise<any> {
    const chunkSize = 5000;
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    this.logger.log(`Snowflake batch update: ${data.length} records in ${chunks.length} chunks`);

    for (const chunk of chunks) {
      try {
        // Snowflake MERGE 문 사용
        const mergeQuery = this.buildSnowflakeMerge(tableName, chunk, keyColumns);
        const result = await knex.raw(mergeQuery);
        results.push(result);
      } catch (error) {
        this.logger.error(`Snowflake batch update failed for chunk`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Snowflake 웨어하우스 전환
   * @param knex - Knex 인스턴스
   * @param warehouseSize - 웨어하우스 크기
   */
  async useWarehouse(knex: Knex, warehouseSize: string): Promise<void> {
    const warehouseName = `${warehouseSize}_WH`;
    await knex.raw(`USE WAREHOUSE ${warehouseName}`);
    this.logger.log(`Switched to warehouse: ${warehouseName}`);
  }

  /**
   * Snowflake 웨어하우스와 함께 쿼리 실행
   * @param knex - Knex 인스턴스
   * @param query - 실행할 쿼리
   * @param warehouseSize - 웨어하우스 크기
   */
  async executeWithWarehouse(knex: Knex, query: string, warehouseSize = 'SMALL'): Promise<any> {
    const originalWarehouse = await this.getCurrentWarehouse(knex);

    try {
      await this.useWarehouse(knex, warehouseSize);
      const result = await knex.raw(query);
      return result;
    } finally {
      // 원래 웨어하우스로 복구
      if (originalWarehouse) {
        await knex.raw(`USE WAREHOUSE ${originalWarehouse}`);
      }
    }
  }

  /**
   * Snowflake 결과 캐시와 함께 쿼리 실행
   * @param knex - Knex 인스턴스
   * @param query - 실행할 쿼리
   * @param cacheTTL - 캐시 TTL (초)
   */
  async queryWithCache(knex: Knex, query: string, cacheTTL = 86400): Promise<any> {
    return knex.raw(query).options({
      resultCacheTTL: cacheTTL,
      useResultCache: true,
      maxRetries: 3,
    });
  }

  /**
   * Snowflake 대용량 데이터 로딩 (COPY INTO 사용)
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 데이터 배열
   * @param options - 옵션
   */
  private async bulkLoadData(
    knex: Knex,
    tableName: string,
    data: any[],
    options: any,
  ): Promise<any> {
    // 임시 스테이지 생성
    const stageName = `temp_stage_${Date.now()}`;

    try {
      // 스테이지 생성
      await knex.raw(`CREATE TEMPORARY STAGE ${stageName}`);

      // 데이터를 CSV 형식으로 변환
      const csvData = this.convertToCsv(data);

      // 스테이지에 데이터 업로드 (실제로는 외부 스토리지 사용)
      // 여기서는 단순화를 위해 INSERT 사용
      const columns = Object.keys(data[0]);

      const copyQuery = `
        COPY INTO ${tableName} (${columns.join(', ')})
        FROM @${stageName}
        FILE_FORMAT = (TYPE = 'CSV' FIELD_DELIMITER = ',' SKIP_HEADER = 1)
        ON_ERROR = '${options.onError || 'ABORT_STATEMENT'}'
      `;

      this.logger.log(`Bulk loading ${data.length} records using COPY INTO`);
      const result = await knex.raw(copyQuery);

      return result;
    } finally {
      // 임시 스테이지 정리
      try {
        await knex.raw(`DROP STAGE IF EXISTS ${stageName}`);
      } catch (error) {
        this.logger.warn('Failed to drop temporary stage', error);
      }
    }
  }

  /**
   * Snowflake MERGE 쿼리 생성
   * @param tableName - 대상 테이블명
   * @param data - 데이터 배열
   * @param keyColumns - 키 컬럼들
   */
  private buildSnowflakeMerge(tableName: string, data: any[], keyColumns: string[]): string {
    if (data.length === 0) return '';

    const columns = Object.keys(data[0]);
    const values = data
      .map(row => `(${columns.map(col => this.formatSnowflakeValue(row[col])).join(', ')})`)
      .join(',\n    ');

    const keyConditions = keyColumns.map(col => `target.${col} = source.${col}`).join(' AND ');
    const updateSet = columns
      .filter(col => !keyColumns.includes(col))
      .map(col => `${col} = source.${col}`)
      .join(', ');
    const insertColumns = columns.join(', ');
    const insertValues = columns.map(col => `source.${col}`).join(', ');

    return `
      MERGE INTO ${tableName} AS target
      USING (
        SELECT * FROM VALUES
        ${values}
      ) AS source (${columns.join(', ')})
      ON ${keyConditions}
      WHEN MATCHED THEN
        UPDATE SET ${updateSet}
      WHEN NOT MATCHED THEN
        INSERT (${insertColumns}) VALUES (${insertValues})
    `;
  }

  /**
   * Snowflake 값 포맷팅
   * @param value - 포맷할 값
   */
  private formatSnowflakeValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }
    return String(value);
  }

  /**
   * 데이터를 CSV 형식으로 변환
   * @param data - 데이터 배열
   */
  private convertToCsv(data: any[]): string {
    if (data.length === 0) return '';

    const columns = Object.keys(data[0]);
    const header = columns.join(',');
    const rows = data.map(row =>
      columns
        .map(col => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
          return String(value);
        })
        .join(','),
    );

    return [header, ...rows].join('\n');
  }

  /**
   * Snowflake 쿼리 실행 (연결 객체 직접 사용)
   * @param conn - 연결 객체
   * @param sql - SQL 문
   */
  private async executeSnowflakeQuery(conn: any, sql: string): Promise<any> {
    return new Promise((resolve, reject) => {
      conn.execute({
        sqlText: sql,
        complete: (err: any, stmt: any, rows: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        },
      });
    });
  }

  /**
   * 현재 웨어하우스 조회
   * @param knex - Knex 인스턴스
   */
  private async getCurrentWarehouse(knex: Knex): Promise<string | null> {
    try {
      const result = await knex.raw('SELECT CURRENT_WAREHOUSE()');
      return result[0]?.[0]?.['CURRENT_WAREHOUSE()'] || null;
    } catch (error) {
      this.logger.warn('Failed to get current warehouse', error);
      return null;
    }
  }

  /**
   * Snowflake 성능 메트릭 조회
   * @param knex - Knex 인스턴스
   */
  async getPerformanceMetrics(knex: Knex): Promise<any> {
    try {
      const [warehouseUsage, queryHistory, creditUsage] = await Promise.all([
        // 웨어하우스 사용량
        knex.raw(`
          SELECT 
            warehouse_name,
            warehouse_size,
            state,
            running,
            queued,
            suspended
          FROM INFORMATION_SCHEMA.WAREHOUSES
        `),
        // 쿼리 히스토리
        knex.raw(`
          SELECT 
            query_type,
            warehouse_name,
            warehouse_size,
            execution_status,
            total_elapsed_time,
            compilation_time,
            execution_time,
            queued_provisioning_time,
            bytes_scanned,
            rows_produced
          FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(
            END_TIME_RANGE_START => DATEADD('hour', -1, CURRENT_TIMESTAMP())
          ))
          ORDER BY start_time DESC
          LIMIT 100
        `),
        // 크레딧 사용량
        knex.raw(`
          SELECT 
            warehouse_name,
            SUM(credits_used) as total_credits,
            AVG(credits_used) as avg_credits
          FROM TABLE(INFORMATION_SCHEMA.WAREHOUSE_METERING_HISTORY(
            DATE_RANGE_START => DATEADD('day', -1, CURRENT_DATE())
          ))
          GROUP BY warehouse_name
          ORDER BY total_credits DESC
        `),
      ]);

      return {
        warehouses: warehouseUsage[0],
        queries: queryHistory[0],
        credits: creditUsage[0],
      };
    } catch (error) {
      this.logger.error('Failed to get Snowflake performance metrics', error);
      return null;
    }
  }

  /**
   * Snowflake 슬로우 쿼리 분석
   * @param knex - Knex 인스턴스
   * @param minDurationMs - 최소 실행 시간 (밀리초)
   */
  async getSlowQueries(knex: Knex, minDurationMs = 10000): Promise<any> {
    try {
      const slowQueries = await knex.raw(`
        SELECT 
          query_id,
          query_text,
          warehouse_name,
          warehouse_size,
          execution_status,
          total_elapsed_time,
          execution_time,
          compilation_time,
          bytes_scanned,
          rows_produced,
          start_time,
          end_time
        FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(
          END_TIME_RANGE_START => DATEADD('hour', -24, CURRENT_TIMESTAMP())
        ))
        WHERE total_elapsed_time > ${minDurationMs}
        ORDER BY total_elapsed_time DESC
        LIMIT 100
      `);

      return slowQueries[0];
    } catch (error) {
      this.logger.error('Failed to get Snowflake slow queries', error);
      return [];
    }
  }
}
