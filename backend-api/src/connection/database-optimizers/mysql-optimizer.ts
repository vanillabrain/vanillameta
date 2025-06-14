import { Knex } from 'knex';
import { Injectable } from '@nestjs/common';
import { BaseDatabaseOptimizer } from './base-optimizer';

/**
 * MySQL/MariaDB 전용 데이터베이스 최적화
 * InnoDB 엔진의 특성을 활용한 최적화 전략 구현
 */
@Injectable()
export class MySQLOptimizer extends BaseDatabaseOptimizer {
  getDatabaseType(): string {
    return 'mysql';
  }

  /**
   * MySQL 쿼리 최적화
   * @param queryBuilder - Knex 쿼리 빌더
   * @param options - 최적화 옵션
   */
  optimizeQuery(
    queryBuilder: Knex.QueryBuilder,
    options: {
      useIndex?: string; // 인덱스 힌트
      forceIndex?: string; // 강제 인덱스 사용
      ignoreIndex?: string; // 인덱스 무시
      sqlCalcFoundRows?: boolean; // SQL_CALC_FOUND_ROWS 사용
      straightJoin?: boolean; // STRAIGHT_JOIN 사용
      bufferResult?: boolean; // SQL_BUFFER_RESULT 사용
    } = {},
  ): Knex.QueryBuilder {
    let optimizedQuery = queryBuilder;

    // 인덱스 힌트 적용 - Knex는 hint를 직접 지원하지 않으므로 raw를 사용해야 함
    // 현재는 주석 처리하여 기본 쿼리 최적화만 사용
    // TODO: raw 쿼리로 힌트 구현 필요
    
    // if (options.useIndex) {
    //   // 예: SELECT /*+ USE INDEX (idx_name) */ ...
    // }

    // if (options.forceIndex) {
    //   // 예: SELECT /*+ FORCE INDEX (idx_name) */ ...
    // }

    // if (options.ignoreIndex) {
    //   // 예: SELECT /*+ IGNORE INDEX (idx_name) */ ...
    // }

    // MySQL 특정 옵션들은 raw 쿼리를 통해 구현 필요
    // 현재는 기본 Knex 쿼리 빌더 반환

    return optimizedQuery;
  }

  /**
   * MySQL 연결 설정 최적화
   * @param baseConfig - 기본 연결 설정
   * @param environment - 환경
   */
  getOptimizedConnectionConfig(baseConfig: any, environment = 'dev'): Knex.Config {
    const poolConfig = this.getBasePoolConfig(environment);
    const timeouts = this.getBaseTimeouts(environment);
    const isProduction = environment === 'prod';
    const isLocal = environment === 'local';

    return {
      client: 'mysql2',
      connection: {
        ...baseConfig,
        // MySQL 특정 최적화 설정
        supportBigNumbers: true,
        bigNumberStrings: false, // 숫자는 숫자 타입으로
        dateStrings: false, // 날짜는 Date 객체로
        multipleStatements: false, // 보안상 단일 문장만
        timezone: 'Z', // UTC 사용
        charset: 'utf8mb4',
        // 연결 타임아웃 설정
        connectTimeout: timeouts.connectTimeout,
        acquireTimeout: timeouts.socketTimeout,
        // Keep-alive 설정 (연결 재사용 최적화)
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        // 네트워크 최적화
        compress: isProduction, // 프로덕션에서만 압축 사용
      },
      pool: {
        ...poolConfig,
        // MySQL 특정 풀 설정
        afterCreate: (conn: any, done: Function) => {
          // 연결 생성 후 최적화 설정 적용
          const optimizationQueries = [
            // 세션 변수 최적화
            "SET SESSION sql_mode='TRADITIONAL,NO_AUTO_VALUE_ON_ZERO'",
            'SET SESSION autocommit=1',
            'SET SESSION innodb_lock_wait_timeout=10',
            // 쿼리 캐시 활용 (MySQL 5.7 이하)
            "SET SESSION query_cache_type='ON'",
            // 정렬 최적화
            'SET SESSION sort_buffer_size=2097152', // 2MB
            // 조인 최적화
            'SET SESSION join_buffer_size=1048576', // 1MB
            // 읽기 최적화
            'SET SESSION read_buffer_size=131072', // 128KB
            'SET SESSION read_rnd_buffer_size=262144', // 256KB
          ];

          let completed = 0;
          const total = optimizationQueries.length;

          optimizationQueries.forEach(query => {
            conn.query(query, (err: any) => {
              if (err) {
                this.logger.warn(`Failed to set MySQL optimization: ${query}`, err.message);
              }
              completed++;
              if (completed === total) {
                done(null, conn);
              }
            });
          });
        },
        // beforeDestroy는 Knex 타입에 없으므로 제거
        // 연결 종료는 Knex가 자동으로 처리
      },
      acquireConnectionTimeout: timeouts.acquireConnectionTimeout,
      // MySQL 전용 옵션
      useNullAsDefault: false,
      debug: !isProduction && !isLocal, // 개발 환경에서만 디버그
    };
  }

  /**
   * MySQL 배치 삽입 최적화
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
      useReplace?: boolean; // REPLACE INTO 사용
      useIgnore?: boolean; // INSERT IGNORE 사용
      onDuplicateKeyUpdate?: Record<string, any>; // ON DUPLICATE KEY UPDATE
    } = {},
  ): Promise<any> {
    const chunkSize = options.chunkSize || 1000; // MySQL 최적 배치 크기
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    this.logger.log(`MySQL batch insert: ${data.length} records in ${chunks.length} chunks`);

    for (const chunk of chunks) {
      try {
        let queryBuilder = knex(tableName);

        if (options.useReplace) {
          // REPLACE INTO 사용
          queryBuilder = queryBuilder.insert(chunk).options({ replace: true });
        } else if (options.useIgnore) {
          // INSERT IGNORE 사용
          queryBuilder = queryBuilder.insert(chunk).options({ ignore: true });
        } else if (options.onDuplicateKeyUpdate) {
          // ON DUPLICATE KEY UPDATE 사용
          queryBuilder = queryBuilder
            .insert(chunk)
            .onConflict()
            .merge(options.onDuplicateKeyUpdate);
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
        this.logger.error(`MySQL batch insert failed for chunk`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * MySQL 배치 업데이트 최적화
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
    const chunkSize = 500; // 업데이트는 더 작은 청크 사용
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    this.logger.log(`MySQL batch update: ${data.length} records in ${chunks.length} chunks`);

    for (const chunk of chunks) {
      try {
        // INSERT ... ON DUPLICATE KEY UPDATE 방식 사용
        const result = await knex(tableName).insert(chunk).onConflict(keyColumns).merge();

        results.push(result);
      } catch (error) {
        this.logger.error(`MySQL batch update failed for chunk`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * MySQL EXPLAIN 분석
   * @param knex - Knex 인스턴스
   * @param query - 분석할 쿼리
   */
  async explainQuery(knex: Knex, query: string): Promise<any> {
    try {
      const explainResult = await knex.raw(`EXPLAIN FORMAT=JSON ${query}`);
      return explainResult[0][0]['EXPLAIN'];
    } catch (error) {
      this.logger.error('MySQL EXPLAIN failed', error);
      // 일반 EXPLAIN으로 폴백
      try {
        return await knex.raw(`EXPLAIN ${query}`);
      } catch (fallbackError) {
        this.logger.error('MySQL EXPLAIN fallback failed', fallbackError);
        return null;
      }
    }
  }

  /**
   * MySQL 성능 스키마 조회
   * @param knex - Knex 인스턴스
   */
  async getPerformanceMetrics(knex: Knex): Promise<any> {
    try {
      const [connectionStats, queryStats, indexUsage, tableStats] = await Promise.all([
        // 연결 통계
        knex.raw(`
          SELECT 
            VARIABLE_NAME, 
            VARIABLE_VALUE 
          FROM performance_schema.global_status 
          WHERE VARIABLE_NAME IN (
            'Connections', 'Aborted_connects', 'Max_used_connections'
          )
        `),
        // 쿼리 통계
        knex.raw(`
          SELECT 
            EVENT_NAME,
            COUNT_STAR as count,
            AVG_TIMER_WAIT/1000000000 as avg_time_ms,
            SUM_TIMER_WAIT/1000000000 as total_time_ms
          FROM performance_schema.events_statements_summary_global_by_event_name 
          ORDER BY total_time_ms DESC 
          LIMIT 10
        `),
        // 인덱스 사용률
        knex.raw(`
          SELECT 
            object_schema,
            object_name,
            index_name,
            count_read,
            count_insert,
            count_update,
            count_delete
          FROM performance_schema.table_io_waits_summary_by_index_usage
          WHERE object_schema NOT IN ('mysql', 'performance_schema', 'information_schema')
          ORDER BY count_read DESC
          LIMIT 20
        `),
        // 테이블 통계
        knex.raw(`
          SELECT 
            object_schema,
            object_name,
            count_read,
            count_write,
            count_fetch,
            count_insert,
            count_update,
            count_delete
          FROM performance_schema.table_io_waits_summary_by_table
          WHERE object_schema NOT IN ('mysql', 'performance_schema', 'information_schema')
          ORDER BY count_read DESC
          LIMIT 20
        `),
      ]);

      return {
        connections: connectionStats[0],
        queries: queryStats[0],
        indexes: indexUsage[0],
        tables: tableStats[0],
      };
    } catch (error) {
      this.logger.error('Failed to get MySQL performance metrics', error);
      return null;
    }
  }

  /**
   * MySQL 슬로우 쿼리 분석
   * @param knex - Knex 인스턴스
   * @param minDuration - 최소 실행 시간 (초)
   */
  async getSlowQueries(knex: Knex, minDuration = 1): Promise<any> {
    try {
      const slowQueries = await knex.raw(
        `
        SELECT 
          digest_text as query,
          count_star as exec_count,
          avg_timer_wait/1000000000 as avg_time_seconds,
          max_timer_wait/1000000000 as max_time_seconds,
          sum_timer_wait/1000000000 as total_time_seconds,
          sum_rows_examined as total_rows_examined,
          sum_rows_sent as total_rows_sent,
          first_seen,
          last_seen
        FROM performance_schema.events_statements_summary_by_digest
        WHERE avg_timer_wait/1000000000 > ?
        ORDER BY avg_timer_wait DESC
        LIMIT 50
      `,
        [minDuration],
      );

      return slowQueries[0];
    } catch (error) {
      this.logger.error('Failed to get MySQL slow queries', error);
      return [];
    }
  }
}
