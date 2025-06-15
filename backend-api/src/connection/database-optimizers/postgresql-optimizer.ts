import { Knex } from 'knex';
import { Injectable } from '@nestjs/common';
import { BaseDatabaseOptimizer } from './base-optimizer';

/**
 * PostgreSQL 전용 데이터베이스 최적화
 * PostgreSQL의 고급 기능들을 활용한 최적화 전략 구현
 */
@Injectable()
export class PostgreSQLOptimizer extends BaseDatabaseOptimizer {
  getDatabaseType(): string {
    return 'postgresql';
  }

  /**
   * PostgreSQL 쿼리 최적화
   * @param queryBuilder - Knex 쿼리 빌더
   * @param options - 최적화 옵션
   */
  optimizeQuery(
    queryBuilder: Knex.QueryBuilder,
    options: {
      enableSeqScan?: boolean; // 순차 스캔 활성화/비활성화
      enableIndexScan?: boolean; // 인덱스 스캔 활성화/비활성화
      enableBitmapScan?: boolean; // 비트맵 스캔 활성화/비활성화
      enableHashJoin?: boolean; // 해시 조인 활성화/비활성화
      enableMergeJoin?: boolean; // 머지 조인 활성화/비활성화
      enableNestedLoop?: boolean; // 중첩 루프 활성화/비활성화
      workMem?: string; // 작업 메모리 크기
      enablePartition?: boolean; // 파티션 제거 활성화
      analyze?: boolean; // EXPLAIN ANALYZE 사용 (개발 환경)
    } = {},
  ): Knex.QueryBuilder {
    let optimizedQuery = queryBuilder;

    // 개발 환경에서 쿼리 분석
    if (options.analyze && process.env.NODE_ENV === 'development') {
      optimizedQuery = optimizedQuery.options({ analyze: true });
    }

    // PostgreSQL 특정 설정들을 쿼리 옵션으로 추가
    const pgOptions: any = {};

    if (options.enableSeqScan !== undefined) {
      pgOptions.enable_seqscan = options.enableSeqScan;
    }

    if (options.enableIndexScan !== undefined) {
      pgOptions.enable_indexscan = options.enableIndexScan;
    }

    if (options.enableBitmapScan !== undefined) {
      pgOptions.enable_bitmapscan = options.enableBitmapScan;
    }

    if (options.enableHashJoin !== undefined) {
      pgOptions.enable_hashjoin = options.enableHashJoin;
    }

    if (options.enableMergeJoin !== undefined) {
      pgOptions.enable_mergejoin = options.enableMergeJoin;
    }

    if (options.enableNestedLoop !== undefined) {
      pgOptions.enable_nestloop = options.enableNestedLoop;
    }

    if (options.workMem) {
      pgOptions.work_mem = options.workMem;
    }

    if (options.enablePartition !== undefined) {
      pgOptions.enable_partition_pruning = options.enablePartition;
    }

    if (Object.keys(pgOptions).length > 0) {
      optimizedQuery = optimizedQuery.options({ pg: pgOptions });
    }

    return optimizedQuery;
  }

  /**
   * PostgreSQL 연결 설정 최적화
   * @param baseConfig - 기본 연결 설정
   * @param environment - 환경
   */
  getOptimizedConnectionConfig(baseConfig: any, environment = 'dev'): Knex.Config {
    const poolConfig = this.getBasePoolConfig(environment);
    const timeouts = this.getBaseTimeouts(environment);
    const isProduction = environment === 'prod';
    const isLocal = environment === 'local';

    return {
      client: 'pg',
      connection: {
        ...baseConfig,
        // PostgreSQL 특정 최적화 설정
        ssl: baseConfig.ssl || false,
        connectionTimeoutMillis: timeouts.connectTimeout,
        idleTimeoutMillis: poolConfig.idleTimeoutMillis,
        // 명령문 타임아웃 설정
        statement_timeout: isProduction ? 30000 : 60000, // 30초 or 60초
        idle_in_transaction_session_timeout: 60000, // 트랜잭션 내 유휴 타임아웃
        // 응용 프로그램 이름 설정 (모니터링 용이성)
        application_name: `vanillameta-${environment}`,
        // 시간대 설정
        timezone: 'UTC',
        // 스키마 검색 경로
        options: baseConfig.options || '--search_path=public',
      },
      pool: {
        ...poolConfig,
        // PostgreSQL은 많은 연결을 잘 처리함
        max: isLocal ? 5 : isProduction ? 20 : 10,
        // 연결 생성 후 초기화
        afterCreate: async (conn: any, done: Function) => {
          try {
            // PostgreSQL 세션 최적화 설정
            const optimizationQueries = [
              // 쿼리 플래너 설정
              'SET random_page_cost = 1.1', // SSD 환경 최적화
              "SET effective_cache_size = '256MB'", // 캐시 크기
              "SET work_mem = '4MB'", // 작업 메모리
              "SET maintenance_work_mem = '64MB'", // 유지보수 작업 메모리
              // 검색 경로 설정
              'SET search_path = public',
              // 시간대 설정
              "SET timezone = 'UTC'",
              // 로그 설정 (개발 환경)
              ...(environment === 'development'
                ? [
                    "SET log_statement = 'all'",
                    'SET log_duration = on',
                    'SET log_min_duration_statement = 1000', // 1초 이상 쿼리 로깅
                  ]
                : []),
            ];

            for (const query of optimizationQueries) {
              await conn.query(query);
            }

            this.logger.log('PostgreSQL connection optimized');
            done(null, conn);
          } catch (error) {
            this.logger.error('Failed to optimize PostgreSQL connection', error);
            done(error, conn);
          }
        },
      },
      acquireConnectionTimeout: timeouts.acquireConnectionTimeout,
      // PostgreSQL 전용 설정
      searchPath: ['public'],
      useNullAsDefault: false,
      debug: !isProduction && !isLocal,
    };
  }

  /**
   * PostgreSQL 배치 삽입 최적화 (COPY 또는 배치 INSERT 사용)
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
      useUpsert?: boolean; // INSERT ... ON CONFLICT 사용
      conflictColumns?: string[]; // 충돌 컬럼
      updateColumns?: string[]; // 업데이트할 컬럼
      useCopy?: boolean; // COPY 명령 사용 (매우 빠름)
    } = {},
  ): Promise<any> {
    const chunkSize = options.chunkSize || 2000; // PostgreSQL은 더 큰 배치 처리 가능
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    this.logger.log(`PostgreSQL batch insert: ${data.length} records in ${chunks.length} chunks`);

    // COPY 명령 사용 (가장 빠른 방법)
    if (options.useCopy && data.length > 1000) {
      try {
        return await this.copyInsert(knex, tableName, data);
      } catch (error) {
        this.logger.warn('COPY insert failed, falling back to batch insert', error);
      }
    }

    // 일반 배치 INSERT
    for (const chunk of chunks) {
      try {
        let queryBuilder = knex(tableName);

        if (options.useUpsert && options.conflictColumns) {
          // INSERT ... ON CONFLICT DO UPDATE
          const conflict = knex.table(tableName).insert(chunk).onConflict(options.conflictColumns);

          if (options.updateColumns) {
            const updateData = options.updateColumns.reduce((acc, col) => {
              acc[col] = knex.raw(`EXCLUDED.${col}`);
              return acc;
            }, {} as any);
            queryBuilder = conflict.merge(updateData);
          } else {
            queryBuilder = conflict.ignore();
          }
        } else {
          queryBuilder = queryBuilder.insert(chunk);
        }

        const result = await queryBuilder;
        results.push(result);

        // 대용량 처리 시 메모리 압박 방지
        if (chunks.length > 10) {
          await new Promise(resolve => setImmediate(resolve));
        }
      } catch (error) {
        this.logger.error(`PostgreSQL batch insert failed for chunk`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * PostgreSQL 배치 업데이트 최적화
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

    this.logger.log(`PostgreSQL batch update: ${data.length} records in ${chunks.length} chunks`);

    for (const chunk of chunks) {
      try {
        // INSERT ... ON CONFLICT DO UPDATE 방식 사용
        const result = await knex(tableName).insert(chunk).onConflict(keyColumns).merge();

        results.push(result);
      } catch (error) {
        this.logger.error(`PostgreSQL batch update failed for chunk`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * PostgreSQL COPY 명령을 사용한 고속 삽입
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param data - 삽입할 데이터 배열
   */
  private async copyInsert(knex: Knex, tableName: string, data: any[]): Promise<any> {
    if (data.length === 0) return [];

    const columns = Object.keys(data[0]);
    const copyQuery = `COPY ${tableName} (${columns.join(', ')}) FROM STDIN WITH CSV`;

    // CSV 형식으로 데이터 변환
    const csvData = data
      .map(row =>
        columns
          .map(col => {
            const value = row[col];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
            return String(value);
          })
          .join(','),
      )
      .join('\n');

    return knex.raw(copyQuery, [csvData]);
  }

  /**
   * PostgreSQL JSON 필드 최적화 쿼리
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param jsonColumn - JSON 컬럼명
   * @param jsonPath - JSON 경로
   * @param value - 찾을 값
   */
  async queryJsonField(
    knex: Knex,
    tableName: string,
    jsonColumn: string,
    jsonPath: string,
    value: any,
  ): Promise<any> {
    return knex(tableName)
      .select('*')
      .whereRaw(`${jsonColumn}->>'${jsonPath}' = ?`, [value])
      .orderByRaw(`${jsonColumn}->>'created_at'`);
  }

  /**
   * PostgreSQL 배열 연산 최적화
   * @param knex - Knex 인스턴스
   * @param tableName - 테이블명
   * @param arrayColumn - 배열 컬럼명
   * @param values - 찾을 값들
   */
  async queryArrayContains(
    knex: Knex,
    tableName: string,
    arrayColumn: string,
    values: string[],
  ): Promise<any> {
    return knex(tableName).whereRaw(`${arrayColumn} && ARRAY[?]::varchar[]`, [values]);
  }

  /**
   * PostgreSQL EXPLAIN ANALYZE
   * @param knex - Knex 인스턴스
   * @param query - 분석할 쿼리
   */
  async explainQuery(knex: Knex, query: string): Promise<any> {
    try {
      const explainResult = await knex.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
      return explainResult.rows[0]['QUERY PLAN'];
    } catch (error) {
      this.logger.error('PostgreSQL EXPLAIN failed', error);
      // 간단한 EXPLAIN으로 폴백
      try {
        return await knex.raw(`EXPLAIN ${query}`);
      } catch (fallbackError) {
        this.logger.error('PostgreSQL EXPLAIN fallback failed', fallbackError);
        return null;
      }
    }
  }

  /**
   * PostgreSQL 성능 통계 조회
   * @param knex - Knex 인스턴스
   */
  async getPerformanceMetrics(knex: Knex): Promise<any> {
    try {
      const [connectionStats, tableStats, indexStats, queryStats] = await Promise.all([
        // 연결 통계
        knex.raw(`
          SELECT 
            numbackends as active_connections,
            xact_commit as committed_transactions,
            xact_rollback as rolled_back_transactions,
            blks_read as blocks_read,
            blks_hit as blocks_hit,
            tup_returned as tuples_returned,
            tup_fetched as tuples_fetched,
            tup_inserted as tuples_inserted,
            tup_updated as tuples_updated,
            tup_deleted as tuples_deleted
          FROM pg_stat_database 
          WHERE datname = current_database()
        `),
        // 테이블 통계
        knex.raw(`
          SELECT 
            schemaname,
            tablename,
            seq_scan,
            seq_tup_read,
            idx_scan,
            idx_tup_fetch,
            n_tup_ins,
            n_tup_upd,
            n_tup_del,
            n_live_tup,
            n_dead_tup
          FROM pg_stat_user_tables
          ORDER BY seq_scan + idx_scan DESC
          LIMIT 20
        `),
        // 인덱스 통계
        knex.raw(`
          SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch
          FROM pg_stat_user_indexes
          ORDER BY idx_scan DESC
          LIMIT 20
        `),
        // 쿼리 통계 (pg_stat_statements 필요)
        knex
          .raw(
            `
          SELECT 
            query,
            calls,
            total_time,
            mean_time,
            rows,
            100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
          FROM pg_stat_statements
          ORDER BY total_time DESC
          LIMIT 20
        `,
          )
          .catch(() => ({ rows: [] })), // pg_stat_statements가 없으면 빈 배열
      ]);

      return {
        database: connectionStats.rows[0],
        tables: tableStats.rows,
        indexes: indexStats.rows,
        queries: queryStats.rows || [],
      };
    } catch (error) {
      this.logger.error('Failed to get PostgreSQL performance metrics', error);
      return null;
    }
  }

  /**
   * PostgreSQL 슬로우 쿼리 분석
   * @param knex - Knex 인스턴스
   * @param minDuration - 최소 실행 시간 (ms)
   */
  async getSlowQueries(knex: Knex, minDuration = 1000): Promise<any> {
    try {
      const slowQueries = await knex.raw(
        `
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          max_time,
          rows,
          100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
        FROM pg_stat_statements
        WHERE mean_time > ?
        ORDER BY mean_time DESC
        LIMIT 50
      `,
        [minDuration],
      );

      return slowQueries.rows;
    } catch (error) {
      this.logger.error('Failed to get PostgreSQL slow queries', error);
      return [];
    }
  }

  /**
   * PostgreSQL 테이블 파티셔닝 지원
   * @param knex - Knex 인스턴스
   * @param tableName - 파티션된 테이블명
   * @param partitionColumn - 파티션 컬럼
   * @param partitionValue - 파티션 값
   */
  async queryPartition(
    knex: Knex,
    tableName: string,
    partitionColumn: string,
    partitionValue: any,
  ): Promise<any> {
    // 파티션 제거 최적화를 위해 WHERE 절에 파티션 컬럼 조건 추가
    return knex(tableName).where(partitionColumn, partitionValue);
  }
}
