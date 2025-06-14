import { Knex } from 'knex';
import { Injectable } from '@nestjs/common';
import { BaseDatabaseOptimizer } from './base-optimizer';

/**
 * SQL Server 전용 데이터베이스 최적화
 * SQL Server의 고유 기능들을 활용한 최적화 전략 구현
 */
@Injectable()
export class SqlServerOptimizer extends BaseDatabaseOptimizer {
  getDatabaseType(): string {
    return 'sqlserver';
  }

  /**
   * SQL Server 쿼리 최적화
   * @param queryBuilder - Knex 쿼리 빌더
   * @param options - 최적화 옵션
   */
  optimizeQuery(
    queryBuilder: Knex.QueryBuilder,
    options: {
      hint?: string; // SQL Server 힌트
      isolation?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE'; // 격리 수준
      lockTimeout?: number; // 잠금 타임아웃 (밀리초)
      maxDop?: number; // 최대 병렬 처리 정도
      forceIndex?: string; // 강제 인덱스 사용
      includeActualPlan?: boolean; // 실제 실행 계획 포함
    } = {},
  ): Knex.QueryBuilder {
    let optimizedQuery = queryBuilder;

    // SQL Server 힌트 적용 - Knex는 hint를 직접 지원하지 않으므로 주석 처리
    // TODO: raw 쿼리를 사용하여 SQL Server 힌트 구현 필요

    // if (options.hint) {
    //   // 예: SELECT ... WITH (hint)
    // }

    // // 인덱스 힌트
    // if (options.forceIndex) {
    //   // 예: SELECT ... WITH (INDEX(idx_name))
    // }

    // // 격리 수준 설정
    // if (options.isolation) {
    //   const isolationHint = options.isolation === 'READ_UNCOMMITTED' ? 'WITH (NOLOCK)' : '';
    //   // 예: SELECT ... WITH (NOLOCK)
    // }

    // 최대 병렬 처리 정도
    if (options.maxDop) {
      optimizedQuery = optimizedQuery.options({ maxDop: options.maxDop });
    }

    return optimizedQuery;
  }

  /**
   * SQL Server 연결 설정 최적화
   * @param baseConfig - 기본 연결 설정
   * @param environment - 환경
   */
  getOptimizedConnectionConfig(baseConfig: any, environment = 'dev'): Knex.Config {
    const poolConfig = this.getBasePoolConfig(environment);
    const timeouts = this.getBaseTimeouts(environment, 'sqlserver');
    const isProduction = environment === 'prod';

    return {
      client: 'mssql',
      connection: {
        ...baseConfig,
        // SQL Server 특정 설정
        options: {
          ...baseConfig.options,
          // 연결 암호화
          encrypt: isProduction, // 프로덕션에서만 암호화
          trustServerCertificate: !isProduction, // 개발 환경에서만 신뢰
          // 타임아웃 설정
          connectionTimeout: timeouts.connectTimeout,
          requestTimeout: timeouts.socketTimeout,
          // 패킷 크기 최적화
          packetSize: 32768, // 32KB
          // 응용 프로그램 이름
          appName: `vanillameta-${environment}`,
          // 격리 수준
          isolationLevel: 'READ_COMMITTED',
          // 연결 풀 설정
          pool: {
            min: poolConfig.min,
            max: poolConfig.max,
            acquireTimeoutMillis: poolConfig.acquireTimeoutMillis,
            createTimeoutMillis: poolConfig.createTimeoutMillis,
            idleTimeoutMillis: poolConfig.idleTimeoutMillis,
            reapIntervalMillis: poolConfig.reapIntervalMillis,
          },
        },
      },
      pool: {
        ...poolConfig,
        // SQL Server 특정 풀 설정
        afterCreate: async (conn: any, done: Function) => {
          try {
            // 세션 최적화 설정
            const optimizations = [
              // 잠금 타임아웃 설정 (환경 변수 또는 기본값 사용)
              `SET LOCK_TIMEOUT ${timeouts.queryTimeout}`, // 환경별 설정
              // 날짜 형식 설정
              'SET DATEFORMAT ymd',
              // 숫자 반올림 설정
              'SET ARITHABORT ON',
              // 경고 메시지 제어
              'SET ANSI_WARNINGS ON',
              // NULL 값 처리
              'SET ANSI_NULLS ON',
              // 문자열 패딩
              'SET ANSI_PADDING ON',
              // 트랜잭션 격리 수준
              'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
              // 실행 계획 캐싱 최적화
              'SET ARITHABORT ON',
              'SET CONCAT_NULL_YIELDS_NULL ON',
              'SET NUMERIC_ROUNDABORT OFF',
            ];

            for (const sql of optimizations) {
              await this.executeSqlServerQuery(conn, sql);
            }

            this.logger.log('SQL Server session optimized');
            done(null, conn);
          } catch (error) {
            this.logger.error('Failed to optimize SQL Server session', error);
            done(error, conn);
          }
        },
      },
      acquireConnectionTimeout: timeouts.acquireConnectionTimeout,
      useNullAsDefault: false,
      debug: !isProduction,
    };
  }

  /**
   * SQL Server 배치 삽입 최적화 (BULK INSERT 사용)
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
      useBulkInsert?: boolean; // BULK INSERT 사용
      enableIdentityInsert?: boolean; // IDENTITY_INSERT 활성화
      checkConstraints?: boolean; // 제약 조건 검사
      fireTriggers?: boolean; // 트리거 실행
      keepNulls?: boolean; // NULL 값 유지
    } = {},
  ): Promise<any> {
    const chunkSize = options.chunkSize || 1000;
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    this.logger.log(`SQL Server batch insert: ${data.length} records in ${chunks.length} chunks`);

    // IDENTITY_INSERT 활성화
    if (options.enableIdentityInsert) {
      await knex.raw(`SET IDENTITY_INSERT ${tableName} ON`);
    }

    try {
      for (const chunk of chunks) {
        try {
          let queryBuilder = knex(tableName);

          // BULK INSERT 옵션 설정
          if (options.useBulkInsert) {
            const bulkOptions: any = {};

            if (options.checkConstraints === false) {
              bulkOptions.checkConstraints = false;
            }

            if (options.fireTriggers === false) {
              bulkOptions.fireTriggers = false;
            }

            if (options.keepNulls) {
              bulkOptions.keepNulls = true;
            }

            queryBuilder = queryBuilder.insert(chunk).options(bulkOptions);
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
          this.logger.error(`SQL Server batch insert failed for chunk`, error);
          throw error;
        }
      }
    } finally {
      // IDENTITY_INSERT 비활성화
      if (options.enableIdentityInsert) {
        await knex.raw(`SET IDENTITY_INSERT ${tableName} OFF`);
      }
    }

    return results;
  }

  /**
   * SQL Server 배치 업데이트 최적화 (MERGE 사용)
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

    this.logger.log(`SQL Server batch update: ${data.length} records in ${chunks.length} chunks`);

    for (const chunk of chunks) {
      try {
        // SQL Server MERGE 문 생성
        const mergeQuery = this.buildSqlServerMerge(tableName, chunk, keyColumns);
        const result = await knex.raw(mergeQuery);
        results.push(result);
      } catch (error) {
        this.logger.error(`SQL Server batch update failed for chunk`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * SQL Server MERGE 쿼리 생성
   * @param tableName - 대상 테이블명
   * @param data - 데이터 배열
   * @param keyColumns - 키 컬럼들
   */
  private buildSqlServerMerge(tableName: string, data: any[], keyColumns: string[]): string {
    if (data.length === 0) return '';

    const columns = Object.keys(data[0]);
    const sourceData = data
      .map(row => `(${columns.map(col => this.formatSqlServerValue(row[col])).join(', ')})`)
      .join(',\n    ');

    const columnDefs = columns.map(col => `${col} NVARCHAR(MAX)`).join(', ');
    const keyConditions = keyColumns.map(col => `target.${col} = source.${col}`).join(' AND ');
    const updateSet = columns
      .filter(col => !keyColumns.includes(col))
      .map(col => `${col} = source.${col}`)
      .join(', ');
    const insertColumns = columns.join(', ');
    const insertValues = columns.map(col => `source.${col}`).join(', ');

    return `
      MERGE ${tableName} AS target
      USING (
        VALUES ${sourceData}
      ) AS source (${columns.join(', ')})
      ON ${keyConditions}
      WHEN MATCHED THEN
        UPDATE SET ${updateSet}
      WHEN NOT MATCHED THEN
        INSERT (${insertColumns}) VALUES (${insertValues});
    `;
  }

  /**
   * SQL Server 값 포맷팅
   * @param value - 포맷할 값
   */
  private formatSqlServerValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `N'${value.replace(/'/g, "''")}'`;
    }
    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }
    return String(value);
  }

  /**
   * SQL Server 쿼리 실행 (연결 객체 직접 사용)
   * @param conn - 연결 객체
   * @param sql - SQL 문
   */
  private async executeSqlServerQuery(conn: any, sql: string): Promise<any> {
    return new Promise((resolve, reject) => {
      conn.request().query(sql, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * SQL Server 실행 계획 분석
   * @param knex - Knex 인스턴스
   * @param query - 분석할 쿼리
   */
  async explainQuery(knex: Knex, query: string): Promise<any> {
    try {
      // 실행 계획 활성화
      await knex.raw('SET SHOWPLAN_ALL ON');

      const explainResult = await knex.raw(query);

      // 실행 계획 비활성화
      await knex.raw('SET SHOWPLAN_ALL OFF');

      return explainResult[0];
    } catch (error) {
      this.logger.error('SQL Server execution plan failed', error);
      // 실행 계획 비활성화 (정리)
      try {
        await knex.raw('SET SHOWPLAN_ALL OFF');
      } catch (cleanupError) {
        this.logger.warn('Failed to cleanup execution plan setting', cleanupError);
      }
      return null;
    }
  }

  /**
   * SQL Server 성능 통계 조회
   * @param knex - Knex 인스턴스
   */
  async getPerformanceMetrics(knex: Knex): Promise<any> {
    try {
      const [connectionStats, waitStats, indexStats, queryStats] = await Promise.all([
        // 연결 통계
        knex.raw(`
          SELECT 
            @@CONNECTIONS as total_connections,
            @@CPU_BUSY as cpu_busy,
            @@IDLE as idle_time,
            @@IO_BUSY as io_busy,
            @@PACKET_ERRORS as packet_errors,
            @@PACK_RECEIVED as packets_received,
            @@PACK_SENT as packets_sent
        `),
        // 대기 통계
        knex.raw(`
          SELECT TOP 20
            wait_type,
            waiting_tasks_count,
            wait_time_ms,
            max_wait_time_ms,
            signal_wait_time_ms
          FROM sys.dm_os_wait_stats
          WHERE wait_type NOT IN ('CLR_SEMAPHORE', 'LAZYWRITER_SLEEP', 'RESOURCE_QUEUE', 'SQLTRACE_BUFFER_FLUSH')
          ORDER BY wait_time_ms DESC
        `),
        // 인덱스 사용률
        knex.raw(`
          SELECT 
            DB_NAME(ius.database_id) as database_name,
            OBJECT_NAME(ius.object_id) as table_name,
            i.name as index_name,
            ius.user_seeks,
            ius.user_scans,
            ius.user_lookups,
            ius.user_updates
          FROM sys.dm_db_index_usage_stats ius
          INNER JOIN sys.indexes i ON ius.object_id = i.object_id AND ius.index_id = i.index_id
          WHERE ius.database_id = DB_ID()
          ORDER BY ius.user_seeks + ius.user_scans + ius.user_lookups DESC
        `),
        // 쿼리 통계 (SQL Server 2016+)
        knex
          .raw(
            `
          SELECT TOP 20
            qs.sql_handle,
            qs.execution_count,
            qs.total_elapsed_time,
            qs.avg_elapsed_time,
            qs.total_cpu_time,
            qs.avg_cpu_time,
            qs.total_logical_reads,
            qs.avg_logical_reads,
            st.text
          FROM sys.dm_exec_query_stats qs
          CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
          ORDER BY qs.avg_elapsed_time DESC
        `,
          )
          .catch(() => ({ recordset: [] })), // 오래된 버전에서는 사용 불가
      ]);

      return {
        connections: connectionStats.recordset[0],
        waits: waitStats.recordset,
        indexes: indexStats.recordset,
        queries: queryStats.recordset || [],
      };
    } catch (error) {
      this.logger.error('Failed to get SQL Server performance metrics', error);
      return null;
    }
  }

  /**
   * SQL Server 슬로우 쿼리 분석
   * @param knex - Knex 인스턴스
   * @param minDurationMs - 최소 실행 시간 (밀리초)
   */
  async getSlowQueries(knex: Knex, minDurationMs = 1000): Promise<any> {
    try {
      const slowQueries = await knex.raw(
        `
        SELECT TOP 50
          qs.sql_handle,
          qs.execution_count,
          qs.total_elapsed_time / 1000 as total_elapsed_time_ms,
          qs.avg_elapsed_time / 1000 as avg_elapsed_time_ms,
          qs.max_elapsed_time / 1000 as max_elapsed_time_ms,
          qs.total_cpu_time / 1000 as total_cpu_time_ms,
          qs.avg_cpu_time / 1000 as avg_cpu_time_ms,
          qs.total_logical_reads,
          qs.avg_logical_reads,
          qs.total_physical_reads,
          qs.avg_physical_reads,
          qs.creation_time,
          qs.last_execution_time,
          SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
            ((CASE qs.statement_end_offset
              WHEN -1 THEN DATALENGTH(st.text)
              ELSE qs.statement_end_offset
            END - qs.statement_start_offset)/2) + 1) AS statement_text
        FROM sys.dm_exec_query_stats qs
        CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
        WHERE qs.avg_elapsed_time / 1000 > ?
        ORDER BY qs.avg_elapsed_time DESC
      `,
        [minDurationMs],
      );

      return slowQueries.recordset;
    } catch (error) {
      this.logger.error('Failed to get SQL Server slow queries', error);
      return [];
    }
  }

  /**
   * SQL Server 인덱스 조각화 분석
   * @param knex - Knex 인스턴스
   */
  async getIndexFragmentation(knex: Knex): Promise<any> {
    try {
      const fragmentation = await knex.raw(`
        SELECT 
          DB_NAME(ips.database_id) as database_name,
          OBJECT_NAME(ips.object_id) as table_name,
          i.name as index_name,
          ips.avg_fragmentation_in_percent,
          ips.fragment_count,
          ips.page_count,
          ips.avg_page_space_used_in_percent
        FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
        INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
        WHERE ips.avg_fragmentation_in_percent > 10
        AND ips.page_count > 100
        ORDER BY ips.avg_fragmentation_in_percent DESC
      `);

      return fragmentation.recordset;
    } catch (error) {
      this.logger.error('Failed to get SQL Server index fragmentation', error);
      return [];
    }
  }
}
