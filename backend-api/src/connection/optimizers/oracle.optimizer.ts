import { Knex } from 'knex';
import { Injectable } from '@nestjs/common';
import {
  IDatabaseOptimizer,
  DatabaseFeature,
  DatabaseError,
  PerformanceHint,
} from './database-optimizer.interface';

/**
 * Oracle Database 최적화 클래스
 */
@Injectable()
export class OracleOptimizer implements IDatabaseOptimizer {
  readonly databaseType = 'oracle';

  /**
   * Oracle에 최적화된 연결 설정
   */
  getOptimizedConnectionConfig(baseConfig: any): Knex.Config {
    const optimizedConfig: Knex.Config = {
      ...baseConfig,
      client: 'oracledb',
      connection: {
        ...baseConfig.connection,
        // Oracle 특화 설정
        connectString: this.buildConnectString(baseConfig.connection),
        poolAlias: 'vanillameta-pool',
        // 연결 옵션
        connectTimeout: 30000, // 30초
        callTimeout: 30000, // 30초
        // 보안 설정
        privilege: undefined, // SYSDBA, SYSOPER 등 (일반적으로 사용하지 않음)
        // 문자셋 설정
        charSet: 'AL32UTF8',
        // 날짜 형식 설정
        dateFormat: 'YYYY-MM-DD HH24:MI:SS',
        // 세션 설정
        initSql: [
          "ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'",
          "ALTER SESSION SET NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF'",
          "ALTER SESSION SET TIME_ZONE = 'Asia/Seoul'",
          "ALTER SESSION SET OPTIMIZER_MODE = ALL_ROWS",
        ],
      },
      pool: {
        min: 0,
        max: parseInt(process.env.ORACLE_POOL_MAX) || 15, // Oracle 권장 연결 수
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 600000, // 10분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false,
        // Oracle 연결 풀 이벤트 처리
        afterCreate: async (conn: any, done: Function) => {
          try {
            // Oracle 세션 최적화 설정
            await conn.execute("ALTER SESSION SET OPTIMIZER_USE_SQL_PLAN_BASELINES = TRUE");
            await conn.execute("ALTER SESSION SET OPTIMIZER_CAPTURE_SQL_PLAN_BASELINES = TRUE");
            await conn.execute("ALTER SESSION SET CURSOR_SHARING = EXACT");
            done(null, conn);
          } catch (err) {
            console.warn(`Oracle session setup warning: ${err.message}`);
            done(err, conn);
          }
        },
      },
      acquireConnectionTimeout: 30000,
      // Oracle 특화 옵션
      options: {
        // 배치 크기 설정
        autoCommit: false, // 명시적 트랜잭션 관리
        maxRows: 1000, // 기본 최대 행 수
        outFormat: 4002, // oracledb.OUT_FORMAT_OBJECT
        // LOB 처리
        fetchAsString: ['CLOB'],
        fetchAsBuffer: ['BLOB'],
        // 커서 설정
        prefetchRows: 100,
      },
    };

    return optimizedConfig;
  }

  /**
   * Oracle 쿼리 최적화
   */
  optimizeQuery(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // Oracle 힌트 추가
    const hints = this.getOptimalHints(queryBuilder);
    if (hints.length > 0) {
      queryBuilder = (queryBuilder as any).hint(hints.join(' '));
    }

    // ROWNUM 최적화 (Oracle 12c 이전 버전 고려)
    if (this.hasLimit(queryBuilder) && this.isOracleOldVersion()) {
      queryBuilder = this.optimizeRownum(queryBuilder);
    }

    // 파티션 프루닝 최적화
    if (this.hasPartitionKey(queryBuilder)) {
      queryBuilder = this.optimizePartitionPruning(queryBuilder);
    }

    // 결과 제한 최적화
    if (!this.hasLimit(queryBuilder)) {
      queryBuilder = queryBuilder.limit(1000); // Oracle 기본 제한
    }

    return queryBuilder;
  }

  /**
   * Oracle 최적 배치 크기
   */
  getBatchSize(): number {
    // Oracle은 배열 DML에 최적화됨
    return parseInt(process.env.ORACLE_BATCH_SIZE) || 1000;
  }

  /**
   * Oracle 지원 기능 확인
   */
  supportsFeature(feature: DatabaseFeature): boolean {
    const supportedFeatures = [
      DatabaseFeature.JSON_OPERATIONS, // Oracle 12c+
      DatabaseFeature.WINDOW_FUNCTIONS,
      DatabaseFeature.CTE,
      DatabaseFeature.PARTITIONING,
      DatabaseFeature.MATERIALIZED_VIEWS,
      DatabaseFeature.STORED_PROCEDURES,
      DatabaseFeature.FULL_TEXT_SEARCH,
      DatabaseFeature.TIME_SERIES,
      DatabaseFeature.UPSERT, // MERGE 문
      DatabaseFeature.BULK_INSERT,
    ];

    return supportedFeatures.includes(feature);
  }

  /**
   * Oracle 에러 매핑
   */
  mapError(error: any): DatabaseError {
    const oracleErrors: { [key: string]: DatabaseError } = {
      'ORA-00942': {
        code: 'TABLE_NOT_FOUND',
        message: '테이블 또는 뷰가 존재하지 않습니다.',
        severity: 'high',
        retryable: false,
        suggestions: ['테이블명을 확인해주세요.', '스키마 권한을 확인해주세요.'],
      },
      'ORA-01017': {
        code: 'AUTH_FAILED',
        message: 'Oracle 사용자명/비밀번호가 올바르지 않습니다.',
        severity: 'high',
        retryable: false,
        suggestions: ['사용자명과 비밀번호를 확인해주세요.', '계정이 잠겨있는지 확인해주세요.'],
      },
      'ORA-12154': {
        code: 'CONNECTION_FAILED',
        message: 'Oracle TNS 서비스명을 찾을 수 없습니다.',
        severity: 'high',
        retryable: false,
        suggestions: ['연결 문자열을 확인해주세요.', 'Oracle 클라이언트 설정을 확인해주세요.'],
      },
      'ORA-00054': {
        code: 'RESOURCE_BUSY',
        message: '리소스가 사용 중이며 NOWAIT이 지정되어 있습니다.',
        severity: 'medium',
        retryable: true,
        suggestions: ['잠시 후 다시 시도해주세요.', '트랜잭션을 최적화해주세요.'],
      },
      'ORA-01555': {
        code: 'SNAPSHOT_TOO_OLD',
        message: '스냅샷이 너무 오래되었습니다.',
        severity: 'medium',
        retryable: true,
        suggestions: ['쿼리를 다시 실행해주세요.', 'UNDO 테이블스페이스 크기를 확인해주세요.'],
      },
      'ORA-00001': {
        code: 'UNIQUE_CONSTRAINT',
        message: '유니크 제약 조건에 위배됩니다.',
        severity: 'low',
        retryable: false,
        suggestions: ['중복된 값을 확인해주세요.', 'MERGE 문을 사용해주세요.'],
      },
    };

    const errorCode = this.extractOracleErrorCode(error.message || '');
    return oracleErrors[errorCode] || {
      code: 'UNKNOWN_ERROR',
      message: error.message || '알 수 없는 Oracle 오류가 발생했습니다.',
      severity: 'medium',
      retryable: false,
      suggestions: ['쿼리를 확인해주세요.', 'Oracle 오류 코드를 확인해주세요.'],
    };
  }

  /**
   * Oracle 성능 힌트 제공
   */
  getPerformanceHints(): PerformanceHint[] {
    return [
      {
        category: 'indexing',
        priority: 'high',
        description: '인덱스 힌트를 사용하여 옵티마이저를 가이드하세요.',
        implementation: 'SELECT /*+ INDEX(table_name idx_name) */ * FROM table_name;',
      },
      {
        category: 'query',
        priority: 'high',
        description: 'FIRST_ROWS 힌트를 사용하여 첫 번째 결과를 빠르게 반환하세요.',
        implementation: 'SELECT /*+ FIRST_ROWS(10) */ * FROM table_name;',
      },
      {
        category: 'query',
        priority: 'high',
        description: 'MERGE 문을 사용하여 UPSERT를 구현하세요.',
        implementation: 'MERGE INTO target USING source ON (condition) WHEN MATCHED THEN UPDATE WHEN NOT MATCHED THEN INSERT;',
      },
      {
        category: 'configuration',
        priority: 'medium',
        description: '파티셔닝을 사용하여 대용량 테이블을 관리하세요.',
        implementation: 'CREATE TABLE ... PARTITION BY RANGE (date_column);',
      },
      {
        category: 'query',
        priority: 'medium',
        description: 'EXPLAIN PLAN을 사용하여 실행 계획을 분석하세요.',
        implementation: 'EXPLAIN PLAN FOR SELECT ...; SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);',
      },
      {
        category: 'configuration',
        priority: 'medium',
        description: '적절한 SGA와 PGA 크기를 설정하세요.',
        implementation: 'ALTER SYSTEM SET SGA_TARGET = 2G; ALTER SYSTEM SET PGA_AGGREGATE_TARGET = 512M;',
      },
    ];
  }

  /**
   * Oracle 연결 문자열 생성
   */
  private buildConnectString(connectionConfig: any): string {
    if (connectionConfig.connectString) {
      return connectionConfig.connectString;
    }

    const { host, port, serviceName, sid } = connectionConfig;
    
    if (serviceName) {
      return `${host}:${port}/${serviceName}`;
    } else if (sid) {
      return `${host}:${port}:${sid}`;
    } else {
      throw new Error('Oracle connection requires either serviceName or sid');
    }
  }

  /**
   * Oracle 최적 힌트 생성
   */
  private getOptimalHints(queryBuilder: Knex.QueryBuilder): string[] {
    const hints: string[] = [];
    const sql = queryBuilder.toString().toUpperCase();

    // 조인이 있는 경우
    if (sql.includes('JOIN')) {
      hints.push('/*+ USE_NL */'); // Nested Loop Join
    }

    // ORDER BY가 있는 경우
    if (sql.includes('ORDER BY')) {
      hints.push('/*+ FIRST_ROWS(100) */');
    }

    // GROUP BY가 있는 경우
    if (sql.includes('GROUP BY')) {
      hints.push('/*+ USE_HASH */');
    }

    // WHERE 절이 있는 경우
    if (sql.includes('WHERE')) {
      hints.push('/*+ INDEX_FFS */'); // Index Fast Full Scan
    }

    return hints;
  }

  /**
   * Oracle 구버전 여부 확인
   */
  private isOracleOldVersion(): boolean {
    // 실제로는 연결된 Oracle 버전을 확인해야 함
    // 여기서는 환경 변수로 간단히 처리
    return process.env.ORACLE_VERSION && parseInt(process.env.ORACLE_VERSION) < 12;
  }

  /**
   * ROWNUM 최적화 (Oracle 12c 이전)
   */
  private optimizeRownum(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // 서브쿼리로 감싸서 ROWNUM 최적화
    return queryBuilder.whereRaw('ROWNUM <= ?', [1000]);
  }

  /**
   * 파티션 키 존재 여부 확인
   */
  private hasPartitionKey(queryBuilder: Knex.QueryBuilder): boolean {
    const sql = queryBuilder.toString();
    return sql.includes('created_at') || sql.includes('partition_date');
  }

  /**
   * 파티션 프루닝 최적화
   */
  private optimizePartitionPruning(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // 파티션 키를 이용한 WHERE 절 최적화
    return (queryBuilder as any).hint('/*+ PARTITION */');
  }

  /**
   * LIMIT 절 존재 여부 확인
   */
  private hasLimit(queryBuilder: Knex.QueryBuilder): boolean {
    const sql = queryBuilder.toString();
    return sql.includes('LIMIT') || sql.includes('ROWNUM');
  }

  /**
   * Oracle 에러 코드 추출
   */
  private extractOracleErrorCode(message: string): string {
    const match = message.match(/ORA-\d{5}/);
    return match ? match[0] : '';
  }

  /**
   * Oracle MERGE (UPSERT) 구현
   */
  async merge(
    knex: Knex,
    targetTable: string,
    sourceData: any[],
    matchColumns: string[],
    updateColumns: string[]
  ): Promise<void> {
    if (sourceData.length === 0) return;

    const allColumns = Object.keys(sourceData[0]);
    const insertColumns = allColumns.filter(col => !matchColumns.includes(col));
    
    // 임시 테이블 생성 및 데이터 삽입
    const tempTable = `temp_${targetTable}_${Date.now()}`;
    
    try {
      // 임시 테이블 생성
      await knex.schema.createTable(tempTable, table => {
        allColumns.forEach(col => {
          table.text(col);
        });
      });

      // 데이터 삽입
      await knex(tempTable).insert(sourceData);

      // MERGE 실행
      const matchCondition = matchColumns
        .map(col => `target.${col} = source.${col}`)
        .join(' AND ');
      
      const updateClause = updateColumns
        .map(col => `target.${col} = source.${col}`)
        .join(', ');
      
      const insertClause = `(${allColumns.join(', ')}) VALUES (${allColumns.map(col => `source.${col}`).join(', ')})`;

      const mergeQuery = `
        MERGE INTO ${targetTable} target
        USING ${tempTable} source
        ON (${matchCondition})
        WHEN MATCHED THEN
          UPDATE SET ${updateClause}
        WHEN NOT MATCHED THEN
          INSERT ${insertClause}
      `;

      await knex.raw(mergeQuery);
    } finally {
      // 임시 테이블 삭제
      await knex.schema.dropTableIfExists(tempTable);
    }
  }

  /**
   * Oracle 배열 DML (FORALL)
   */
  async bulkInsert(
    knex: Knex,
    tableName: string,
    data: any[]
  ): Promise<void> {
    const chunkSize = this.getBatchSize();
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      // Oracle의 배열 DML 활용
      await knex(tableName).insert(chunk);
    }
  }

  /**
   * Oracle 실행 계획 조회
   */
  async getExecutionPlan(knex: Knex, query: string): Promise<any> {
    // EXPLAIN PLAN 실행
    await knex.raw(`EXPLAIN PLAN FOR ${query}`);
    
    // 실행 계획 조회
    const result = await knex.raw(`
      SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY('PLAN_TABLE', NULL, 'ALL'))
    `);
    
    return result;
  }

  /**
   * Oracle 세션 통계 조회
   */
  async getSessionStats(knex: Knex): Promise<any> {
    return knex.raw(`
      SELECT s.sid, s.serial#, s.username, s.status, s.machine, s.program,
             st.name, st.value
      FROM v$session s, v$sesstat st, v$statname sn
      WHERE s.sid = st.sid
        AND st.statistic# = sn.statistic#
        AND s.username IS NOT NULL
        AND sn.name IN ('logical reads', 'physical reads', 'db block gets', 'consistent gets')
      ORDER BY s.sid, sn.name
    `);
  }
}