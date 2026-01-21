import { Knex } from 'knex';
import { Injectable } from '@nestjs/common';
import { BaseDatabaseOptimizer } from './base-optimizer';

/**
 * BigQuery 전용 데이터베이스 최적화
 * 클라우드 데이터 웨어하우스의 특성을 활용한 최적화 전략 구현
 */
@Injectable()
export class BigQueryOptimizer extends BaseDatabaseOptimizer {
  getDatabaseType(): string {
    return 'bigquery';
  }

  /**
   * BigQuery 쿼리 최적화
   * @param queryBuilder - Knex 쿼리 빌더
   * @param options - 최적화 옵션
   */
  optimizeQuery(
    queryBuilder: Knex.QueryBuilder,
    options: {
      maximumBytesBilled?: string; // 최대 과금 바이트 수
      useQueryCache?: boolean; // 쿼리 캐시 사용
      useLegacySql?: boolean; // 레거시 SQL 사용 여부
      priority?: 'INTERACTIVE' | 'BATCH'; // 쿼리 우선순위
      labels?: Record<string, string>; // 쿼리 라벨
      maximumBillingTier?: number; // 최대 과금 티어
      partitionFilter?: boolean; // 파티션 필터 강제 사용
      requirePartitionFilter?: boolean; // 파티션 필터 필수
    } = {},
  ): Knex.QueryBuilder {
    const bqOptions: any = {
      useLegacySql: options.useLegacySql || false, // 기본적으로 표준 SQL 사용
      useQueryCache: options.useQueryCache !== false, // 기본적으로 캐시 사용
      priority: options.priority || 'INTERACTIVE',
    };

    if (options.maximumBytesBilled) {
      bqOptions.maximumBytesBilled = options.maximumBytesBilled;
    }

    if (options.labels) {
      bqOptions.labels = options.labels;
    }

    if (options.maximumBillingTier) {
      bqOptions.maximumBillingTier = options.maximumBillingTier;
    }

    if (options.requirePartitionFilter) {
      bqOptions.requirePartitionFilter = true;
    }

    return queryBuilder.options(bqOptions);
  }

  /**
   * BigQuery 연결 설정 최적화
   * @param baseConfig - 기본 연결 설정
   * @param environment - 환경
   */
  getOptimizedConnectionConfig(baseConfig: any, environment = 'dev'): Knex.Config {
    const poolConfig = this.getBasePoolConfig(environment);
    const isProduction = environment === 'prod';

    return {
      client: require('../knex-dialects/bigquery'),
      connection: {
        ...baseConfig,
        // BigQuery 특정 설정
        projectId: baseConfig.projectId || process.env.BIGQUERY_PROJECT_ID,
        keyFilename: baseConfig.keyFilename || process.env.BIGQUERY_KEY_FILE,
        location: baseConfig.location || 'US', // 기본 위치
        // 자동 재시도 설정
        autoRetry: true,
        maxRetries: isProduction ? 3 : 1,
        retryDelayMultiplier: 2,
        totalTimeout: 300000, // 5분
        // BigQuery API 설정
        maxResults: 10000, // 기본 최대 결과 수
        timeoutMs: 300000, // 5분 타임아웃
      },
      pool: {
        ...poolConfig,
        // BigQuery는 API 호출 기반이므로 연결 수 제한
        max: isProduction ? 5 : 2,
        min: 0,
        // 더 긴 타임아웃 설정 (BigQuery는 느릴 수 있음)
        acquireTimeoutMillis: 300000, // 5분
        createTimeoutMillis: 60000, // 1분
        idleTimeoutMillis: 600000, // 10분
      },
      acquireConnectionTimeout: 300000,
      useNullAsDefault: true,
      debug: !isProduction,
    };
  }

  /**
   * BigQuery 배치 삽입 최적화 (스트리밍 삽입 사용)
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
      insertId?: string; // 중복 방지용 삽입 ID
      ignoreUnknownValues?: boolean; // 알 수 없는 필드 무시
      skipInvalidRows?: boolean; // 잘못된 행 건너뛰기
      templateSuffix?: string; // 테이블 템플릿 접미사
      useStreaming?: boolean; // 스트리밍 삽입 사용
    } = {},
  ): Promise<any> {
    // BigQuery는 배치 크기가 클 수 있음 (최대 10MB 또는 10,000행)
    const chunkSize = options.chunkSize || 5000;
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    this.logger.log(`BigQuery batch insert: ${data.length} records in ${chunks.length} chunks`);

    for (const chunk of chunks) {
      try {
        const insertOptions: any = {};

        if (options.insertId) {
          insertOptions.insertId = `${options.insertId}_${Date.now()}`;
        }

        if (options.ignoreUnknownValues) {
          insertOptions.ignoreUnknownValues = true;
        }

        if (options.skipInvalidRows) {
          insertOptions.skipInvalidRows = true;
        }

        if (options.templateSuffix) {
          insertOptions.templateSuffix = options.templateSuffix;
        }

        let queryBuilder = knex(tableName).insert(chunk);

        if (Object.keys(insertOptions).length > 0) {
          queryBuilder = queryBuilder.options(insertOptions);
        }

        const result = await queryBuilder;
        results.push(result);

        // BigQuery API 호출 제한 고려하여 잠시 대기
        if (chunks.length > 5) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        this.logger.error(`BigQuery batch insert failed for chunk`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * BigQuery 배치 업데이트 최적화 (MERGE 문 사용)
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
    const chunkSize = 1000;
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    this.logger.log(`BigQuery batch update: ${data.length} records in ${chunks.length} chunks`);

    for (const chunk of chunks) {
      try {
        // BigQuery MERGE 문을 사용한 UPSERT
        const mergeQuery = this.buildMergeQuery(tableName, chunk, keyColumns);
        const result = await knex.raw(mergeQuery);
        results.push(result);
      } catch (error) {
        this.logger.error(`BigQuery batch update failed for chunk`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * BigQuery MERGE 쿼리 생성
   * @param tableName - 대상 테이블명
   * @param data - 데이터 배열
   * @param keyColumns - 키 컬럼들
   */
  private buildMergeQuery(tableName: string, data: any[], keyColumns: string[]): string {
    if (data.length === 0) return '';

    const columns = Object.keys(data[0]);
    const sourceData = data
      .map(row => `(${columns.map(col => this.formatValueForBigQuery(row[col])).join(', ')})`)
      .join(',\n    ');

    const columnDefs = columns.map(col => `${col} STRING`).join(', ');
    const keyConditions = keyColumns.map(col => `target.${col} = source.${col}`).join(' AND ');
    const updateSet = columns
      .filter(col => !keyColumns.includes(col))
      .map(col => `${col} = source.${col}`)
      .join(', ');
    const insertColumns = columns.join(', ');
    const insertValues = columns.map(col => `source.${col}`).join(', ');

    return `
      MERGE \`${tableName}\` AS target
      USING (
        SELECT * FROM UNNEST([
          STRUCT<${columnDefs}>(
            ${sourceData}
          )
        ])
      ) AS source
      ON ${keyConditions}
      WHEN MATCHED THEN
        UPDATE SET ${updateSet}
      WHEN NOT MATCHED THEN
        INSERT (${insertColumns}) VALUES (${insertValues})
    `;
  }

  /**
   * BigQuery 값 포맷팅
   * @param value - 포맷할 값
   */
  private formatValueForBigQuery(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    if (value instanceof Date) {
      return `"${value.toISOString()}"`;
    }
    return String(value);
  }

  /**
   * BigQuery 파티션 테이블 생성
   * @param knex - Knex 인스턴스
   * @param dataset - 데이터셋명
   * @param table - 테이블명
   * @param partitionField - 파티션 필드
   * @param partitionType - 파티션 타입
   * @param clusterFields - 클러스터 필드들
   */
  async createPartitionedTable(
    knex: Knex,
    dataset: string,
    table: string,
    partitionField: string,
    partitionType: 'DAY' | 'HOUR' | 'MONTH' | 'YEAR' = 'DAY',
    clusterFields?: string[],
  ): Promise<any> {
    let query = `
      CREATE TABLE IF NOT EXISTS \`${dataset}.${table}\`
      PARTITION BY ${partitionType}(${partitionField})
    `;

    if (clusterFields && clusterFields.length > 0) {
      query += `\n      CLUSTER BY ${clusterFields.join(', ')}`;
    }

    query += `\n      AS SELECT * FROM \`${dataset}.${table}_temp\` WHERE FALSE`;

    this.logger.log(`Creating partitioned BigQuery table: ${dataset}.${table}`);
    return knex.raw(query);
  }

  /**
   * BigQuery 비용 효율적인 쿼리 실행
   * @param knex - Knex 인스턴스
   * @param query - 실행할 쿼리
   * @param maxCostBytes - 최대 비용 (바이트)
   */
  async queryWithCostControl(
    knex: Knex,
    query: string,
    maxCostBytes = '1000000000', // 1GB
  ): Promise<any> {
    return knex.raw(query).options({
      maximumBytesBilled: maxCostBytes,
      useQueryCache: true,
      priority: 'INTERACTIVE',
      labels: {
        environment: process.env.NODE_ENV || 'dev',
        service: 'vanillameta',
      },
    });
  }

  /**
   * BigQuery 쿼리 예상 비용 조회
   * @param knex - Knex 인스턴스
   * @param query - 분석할 쿼리
   */
  async getQueryCost(knex: Knex, query: string): Promise<any> {
    try {
      const dryRunResult = await knex.raw(query).options({
        dryRun: true,
      });

      return {
        bytesProcessed: dryRunResult.totalBytesProcessed,
        estimatedCostUSD:
          (parseInt(dryRunResult.totalBytesProcessed) / 1024 / 1024 / 1024 / 1024) * 5, // $5 per TB
      };
    } catch (error) {
      this.logger.error('Failed to get BigQuery cost estimate', error);
      return null;
    }
  }

  /**
   * BigQuery 테이블 메타데이터 조회
   * @param knex - Knex 인스턉스
   * @param dataset - 데이터셋명
   * @param table - 테이블명
   */
  async getTableMetadata(knex: Knex, dataset: string, table: string): Promise<any> {
    try {
      const metadataQuery = `
        SELECT
          table_name,
          table_type,
          creation_time,
          size_bytes,
          row_count,
          partition_expiration_ms,
          clustering_ordinal_position,
          clustering_column_name
        FROM \`${dataset}\`.INFORMATION_SCHEMA.TABLES
        LEFT JOIN \`${dataset}\`.INFORMATION_SCHEMA.CLUSTERING_COLUMNS USING (table_name)
        WHERE table_name = '${table}'
      `;

      const result = await knex.raw(metadataQuery);
      return result[0];
    } catch (error) {
      this.logger.error('Failed to get BigQuery table metadata', error);
      return null;
    }
  }

  /**
   * BigQuery 슬롯 사용량 모니터링
   * @param knex - Knex 인스턴스
   * @param projectId - 프로젝트 ID
   */
  async getSlotUsage(knex: Knex, projectId: string): Promise<any> {
    try {
      // BigQuery 정보 스키마에서 슬롯 사용량 조회
      const slotQuery = `
        SELECT
          reservation_name,
          slot_capacity,
          assigned_slots,
          idle_slots,
          pending_queries,
          running_queries
        FROM \`${projectId}\`.region-us.INFORMATION_SCHEMA.RESERVATIONS_BY_PROJECT
        WHERE project_id = '${projectId}'
      `;

      const result = await knex.raw(slotQuery);
      return result[0];
    } catch (error) {
      this.logger.error('Failed to get BigQuery slot usage', error);
      return null;
    }
  }

  /**
   * BigQuery 슬로우 쿼리 분석
   * @param knex - Knex 인스턴스
   * @param projectId - 프로젝트 ID
   * @param minDurationMs - 최소 실행 시간 (밀리초)
   */
  async getSlowQueries(knex: Knex, projectId: string, minDurationMs = 10000): Promise<any> {
    try {
      const slowQuerySql = `
        SELECT
          job_id,
          query,
          total_bytes_processed,
          total_bytes_billed,
          total_slot_ms,
          creation_time,
          start_time,
          end_time,
          TIMESTAMP_DIFF(end_time, start_time, MILLISECOND) as duration_ms,
          error_result.reason as error_reason,
          error_result.message as error_message
        FROM \`${projectId}\`.region-us.INFORMATION_SCHEMA.JOBS_BY_PROJECT
        WHERE
          creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
          AND job_type = 'QUERY'
          AND TIMESTAMP_DIFF(end_time, start_time, MILLISECOND) > ${minDurationMs}
        ORDER BY duration_ms DESC
        LIMIT 100
      `;

      const result = await knex.raw(slowQuerySql);
      return result[0];
    } catch (error) {
      this.logger.error('Failed to get BigQuery slow queries', error);
      return [];
    }
  }

  /**
   * BigQuery 파티션 최적화 쿼리
   * @param knex - Knex 인스턴스
   * @param tableName - 파티션된 테이블명
   * @param partitionDate - 파티션 날짜
   */
  async queryPartition(
    knex: Knex,
    tableName: string,
    partitionDate: string,
  ): Promise<Knex.QueryBuilder> {
    // 파티션 제거를 위해 _PARTITIONDATE 또는 _PARTITIONTIME 필터 추가
    return knex(tableName).whereRaw('_PARTITIONDATE = ?', [partitionDate]);
  }
}
