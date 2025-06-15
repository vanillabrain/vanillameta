import { Knex } from 'knex';
import { Injectable } from '@nestjs/common';
import { BaseDatabaseOptimizer } from './base-optimizer';

/**
 * Oracle 전용 데이터베이스 최적화
 * Oracle의 고급 기능들을 활용한 최적화 전략 구현
 */
@Injectable()
export class OracleOptimizer extends BaseDatabaseOptimizer {
  getDatabaseType(): string {
    return 'oracle';
  }

  /**
   * Oracle 쿼리 최적화
   * @param queryBuilder - Knex 쿼리 빌더
   * @param options - 최적화 옵션
   */
  optimizeQuery(
    queryBuilder: Knex.QueryBuilder,
    options: {
      hint?: string; // Oracle 힌트
      parallelDegree?: number; // 병렬 처리 정도
      optimizerMode?: 'FIRST_ROWS' | 'ALL_ROWS'; // 옵티마이저 모드
      enablePlan?: boolean; // 실행 계획 분석
    } = {},
  ): Knex.QueryBuilder {
    let optimizedQuery = queryBuilder;

    // Oracle 힌트 적용 (현재는 지원하지 않음)
    if (options.hint) {
      // Oracle hint는 raw SQL로 처리해야 함
    }

    // 병렬 처리 힌트
    if (options.parallelDegree && options.parallelDegree > 1) {
      // PARALLEL hint는 Oracle 전용
    }

    // 옵티마이저 모드 힌트
    if (options.optimizerMode) {
      // Optimizer mode hint는 Oracle 전용
    }

    return optimizedQuery;
  }

  /**
   * Oracle 연결 설정 최적화
   * @param baseConfig - 기본 연결 설정
   * @param environment - 환경
   */
  getOptimizedConnectionConfig(baseConfig: any, environment = 'dev'): Knex.Config {
    const poolConfig = this.getBasePoolConfig(environment);
    const timeouts = this.getBaseTimeouts(environment);
    const isProduction = environment === 'prod';

    return {
      client: 'oracledb',
      connection: {
        ...baseConfig,
        // Oracle 특정 설정
        connectTimeout: timeouts.connectTimeout,
        // 연결 풀 설정
        poolMin: poolConfig.min,
        poolMax: poolConfig.max,
        poolPingInterval: 60, // 60초마다 연결 확인
        poolTimeout: 60, // 60초 타임아웃
        // 결과 집합 옵션
        fetchArraySize: 10000, // 배치 크기
        maxRows: 0, // 무제한
        // 세션 설정
        enableStatistics: isProduction,
        events: isProduction, // 프로덕션에서만 이벤트 활성화
      },
      pool: {
        ...poolConfig,
        // Oracle 특정 풀 설정
        afterCreate: async (conn: any, done: Function) => {
          try {
            // 세션 최적화 설정
            const optimizations = [
              // 옵티마이저 설정
              'ALTER SESSION SET optimizer_mode = ALL_ROWS',
              // 정렬 영역 크기
              'ALTER SESSION SET sort_area_size = 1048576', // 1MB
              // 해시 영역 크기
              'ALTER SESSION SET hash_area_size = 1048576', // 1MB
              // 날짜 형식 설정
              "ALTER SESSION SET nls_date_format = 'YYYY-MM-DD HH24:MI:SS'",
              "ALTER SESSION SET nls_timestamp_format = 'YYYY-MM-DD HH24:MI:SS.FF'",
              // 세션 통계 활성화
              'ALTER SESSION SET statistics_level = TYPICAL',
            ];

            for (const sql of optimizations) {
              await this.executeOracleQuery(conn, sql);
            }

            this.logger.log('Oracle session optimized');
            done(null, conn);
          } catch (error) {
            this.logger.error('Failed to optimize Oracle session', error);
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
   * Oracle 배치 삽입 최적화 (Array Insert 사용)
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
      useArrayInsert?: boolean; // Array Insert 사용
      enableParallel?: boolean; // 병렬 삽입
      commitFrequency?: number; // 커밋 빈도
    } = {},
  ): Promise<any> {
    const chunkSize = options.chunkSize || 1000;
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    this.logger.log(`Oracle batch insert: ${data.length} records in ${chunks.length} chunks`);

    // 병렬 삽입 힌트 사용
    if (options.enableParallel) {
      await knex.raw('ALTER SESSION ENABLE PARALLEL DML');
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {
        let queryBuilder = knex(tableName);

        // Array Insert 사용 (Oracle 특화)
        if (options.useArrayInsert) {
          queryBuilder = queryBuilder.insert(chunk).options({
            arrayInsert: true,
            autoCommit: false,
          });
        } else {
          queryBuilder = queryBuilder.insert(chunk);
        }

        const result = await queryBuilder;
        results.push(result);

        // 커밋 빈도에 따라 중간 커밋
        if (options.commitFrequency && (i + 1) % options.commitFrequency === 0) {
          await knex.raw('COMMIT');
        }

        // 대용량 처리 시 메모리 압박 방지
        if (chunks.length > 10) {
          await new Promise(resolve => setImmediate(resolve));
        }
      } catch (error) {
        this.logger.error(`Oracle batch insert failed for chunk ${i}`, error);
        await knex.raw('ROLLBACK');
        throw error;
      }
    }

    // 최종 커밋
    await knex.raw('COMMIT');

    if (options.enableParallel) {
      await knex.raw('ALTER SESSION DISABLE PARALLEL DML');
    }

    return results;
  }

  /**
   * Oracle 배치 업데이트 최적화 (MERGE 사용)
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
    const chunkSize = 500; // Oracle MERGE는 상대적으로 작은 청크 사용
    const chunks = this.chunkArray(data, chunkSize);
    const results = [];

    this.logger.log(`Oracle batch update: ${data.length} records in ${chunks.length} chunks`);

    for (const chunk of chunks) {
      try {
        // Oracle MERGE 문 생성
        const mergeQuery = this.buildOracleMerge(tableName, chunk, keyColumns);
        const result = await knex.raw(mergeQuery);
        results.push(result);
      } catch (error) {
        this.logger.error(`Oracle batch update failed for chunk`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Oracle MERGE 쿼리 생성
   * @param tableName - 대상 테이블명
   * @param data - 데이터 배열
   * @param keyColumns - 키 컬럼들
   */
  private buildOracleMerge(tableName: string, data: any[], keyColumns: string[]): string {
    if (data.length === 0) return '';

    const columns = Object.keys(data[0]);
    const sourceData = data
      .map(
        (row, index) =>
          `SELECT ${columns
            .map(col => `${this.formatOracleValue(row[col])} AS ${col}`)
            .join(', ')} FROM DUAL${index === data.length - 1 ? '' : ' UNION ALL'}`,
      )
      .join('\n    ');

    const keyConditions = keyColumns.map(col => `target.${col} = source.${col}`).join(' AND ');
    const updateSet = columns
      .filter(col => !keyColumns.includes(col))
      .map(col => `${col} = source.${col}`)
      .join(', ');
    const insertColumns = columns.join(', ');
    const insertValues = columns.map(col => `source.${col}`).join(', ');

    return `
      MERGE INTO ${tableName} target
      USING (
        ${sourceData}
      ) source
      ON (${keyConditions})
      WHEN MATCHED THEN
        UPDATE SET ${updateSet}
      WHEN NOT MATCHED THEN
        INSERT (${insertColumns}) VALUES (${insertValues})
    `;
  }

  /**
   * Oracle 값 포맷팅
   * @param value - 포맷할 값
   */
  private formatOracleValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (value instanceof Date) {
      return `TO_TIMESTAMP('${value.toISOString()}', 'YYYY-MM-DD"T"HH24:MI:SS.FF"Z"')`;
    }
    return String(value);
  }

  /**
   * Oracle 쿼리 실행 (연결 객체 직접 사용)
   * @param conn - 연결 객체
   * @param sql - SQL 문
   */
  private async executeOracleQuery(conn: any, sql: string): Promise<any> {
    return new Promise((resolve, reject) => {
      conn.execute(sql, [], { autoCommit: true }, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Oracle EXPLAIN PLAN 분석
   * @param knex - Knex 인스턴스
   * @param query - 분석할 쿼리
   */
  async explainQuery(knex: Knex, query: string): Promise<any> {
    try {
      // EXPLAIN PLAN 생성
      await knex.raw(`EXPLAIN PLAN FOR ${query}`);

      // 실행 계획 조회
      const explainResult = await knex.raw(`
        SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY())
      `);

      return explainResult[0];
    } catch (error) {
      this.logger.error('Oracle EXPLAIN PLAN failed', error);
      return null;
    }
  }

  /**
   * Oracle 성능 통계 조회
   * @param knex - Knex 인스턴스
   */
  async getPerformanceMetrics(knex: Knex): Promise<any> {
    try {
      const [sessionStats, waitEvents, sqlStats, systemStats] = await Promise.all([
        // 세션 통계
        knex.raw(`
          SELECT name, value 
          FROM v$sesstat s, v$statname n 
          WHERE s.statistic# = n.statistic# 
          AND s.sid = SYS_CONTEXT('USERENV', 'SID')
          AND name IN ('physical reads', 'logical reads', 'execute count')
        `),
        // 대기 이벤트
        knex.raw(`
          SELECT event, total_waits, time_waited 
          FROM v$session_event 
          WHERE sid = SYS_CONTEXT('USERENV', 'SID')
          ORDER BY time_waited DESC
        `),
        // SQL 통계
        knex.raw(`
          SELECT sql_text, executions, elapsed_time, cpu_time
          FROM v$sql 
          WHERE parsing_user_id = USER_ID
          ORDER BY elapsed_time DESC
          FETCH FIRST 20 ROWS ONLY
        `),
        // 시스템 통계
        knex.raw(`
          SELECT name, value 
          FROM v$sysstat 
          WHERE name IN ('user commits', 'user rollbacks', 'parse count (total)')
        `),
      ]);

      return {
        session: sessionStats[0],
        waits: waitEvents[0],
        sql: sqlStats[0],
        system: systemStats[0],
      };
    } catch (error) {
      this.logger.error('Failed to get Oracle performance metrics', error);
      return null;
    }
  }

  /**
   * Oracle 슬로우 쿼리 분석
   * @param knex - Knex 인스턴스
   * @param minDurationMs - 최소 실행 시간 (밀리초)
   */
  async getSlowQueries(knex: Knex, minDurationMs = 1000): Promise<any> {
    try {
      const slowQueries = await knex.raw(
        `
        SELECT 
          sql_text,
          executions,
          elapsed_time/1000000 as elapsed_time_seconds,
          cpu_time/1000000 as cpu_time_seconds,
          disk_reads,
          buffer_gets,
          rows_processed,
          first_load_time,
          last_load_time
        FROM v$sql
        WHERE elapsed_time/1000000 > :minDuration
        AND parsing_user_id = USER_ID
        ORDER BY elapsed_time DESC
        FETCH FIRST 50 ROWS ONLY
      `,
        [minDurationMs / 1000],
      );

      return slowQueries[0];
    } catch (error) {
      this.logger.error('Failed to get Oracle slow queries', error);
      return [];
    }
  }
}
