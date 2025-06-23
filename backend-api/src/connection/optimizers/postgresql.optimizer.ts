import { Knex } from 'knex';
import { Injectable } from '@nestjs/common';
import {
  IDatabaseOptimizer,
  DatabaseFeature,
  DatabaseError,
  PerformanceHint,
} from './database-optimizer.interface';

/**
 * PostgreSQL 최적화 클래스
 */
@Injectable()
export class PostgreSQLOptimizer implements IDatabaseOptimizer {
  readonly databaseType = 'postgresql';

  /**
   * PostgreSQL에 최적화된 연결 설정
   */
  getOptimizedConnectionConfig(baseConfig: any): Knex.Config {
    const optimizedConfig: Knex.Config = {
      ...baseConfig,
      client: 'pg',
      connection: {
        ...baseConfig.connection,
        // PostgreSQL 특화 설정
        ssl: process.env.NODE_ENV === 'prod' ? { rejectUnauthorized: false } : false,
        statement_timeout: 30000, // 30초
        idle_in_transaction_session_timeout: 60000, // 1분
        timezone: 'Asia/Seoul',
        // 연결 설정
        application_name: 'VanillaMeta-BI',
        // 성능 최적화 설정
        shared_preload_libraries: 'pg_stat_statements',
      },
      pool: {
        min: 0,
        max: parseInt(process.env.POSTGRESQL_POOL_MAX) || 20, // PostgreSQL은 더 많은 연결 처리 가능
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000, // 5분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false,
        // PostgreSQL 연결 풀 이벤트 처리
        afterCreate: async (conn: any, done: Function) => {
          try {
            // PostgreSQL 세션 설정
            await conn.query('SET timezone TO "Asia/Seoul"');
            await conn.query('SET statement_timeout TO 30000');
            await conn.query('SET idle_in_transaction_session_timeout TO 60000');
            // EXPLAIN 최적화를 위한 설정
            await conn.query('SET track_io_timing TO on');
            await conn.query('SET track_functions TO all');
            done(null, conn);
          } catch (err) {
            console.warn(`PostgreSQL session setup warning: ${err.message}`);
            done(err, conn);
          }
        },
      },
      acquireConnectionTimeout: 30000,
      searchPath: ['public'],
      // PostgreSQL 특화 옵션
      migrations: {
        tableName: 'knex_migrations',
        schemaName: 'public',
      },
      // PostGIS 지원 (지리정보 확장)
      postProcessResponse: (result: any, queryContext: any) => {
        // PostGIS 데이터 타입 처리
        if (Array.isArray(result)) {
          return result.map(row => this.processPostGISData(row));
        }
        return this.processPostGISData(result);
      },
    };

    return optimizedConfig;
  }

  /**
   * PostgreSQL 쿼리 최적화
   */
  optimizeQuery(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // PostgreSQL EXPLAIN 분석 활성화 (개발 환경)
    if (process.env.NODE_ENV === 'development') {
      queryBuilder = queryBuilder.options({ explain: true, analyze: true });
    }

    // 윈도우 함수 최적화
    if (this.canUseWindowFunction(queryBuilder)) {
      queryBuilder = this.optimizeWithWindowFunction(queryBuilder);
    }

    // JSON 쿼리 최적화
    if (this.hasJsonOperations(queryBuilder)) {
      queryBuilder = this.optimizeJsonQuery(queryBuilder);
    }

    // 배열 연산 최적화
    if (this.hasArrayOperations(queryBuilder)) {
      queryBuilder = this.optimizeArrayQuery(queryBuilder);
    }

    // 결과 제한 최적화
    if (!this.hasLimit(queryBuilder)) {
      queryBuilder = queryBuilder.limit(1000); // 기본 제한
    }

    return queryBuilder;
  }

  /**
   * PostgreSQL 최적 배치 크기
   */
  getBatchSize(): number {
    // PostgreSQL은 더 큰 배치 처리 가능
    return parseInt(process.env.POSTGRESQL_BATCH_SIZE) || 5000;
  }

  /**
   * PostgreSQL 지원 기능 확인
   */
  supportsFeature(feature: DatabaseFeature): boolean {
    const supportedFeatures = [
      DatabaseFeature.JSON_OPERATIONS,
      DatabaseFeature.ARRAY_OPERATIONS,
      DatabaseFeature.WINDOW_FUNCTIONS,
      DatabaseFeature.CTE,
      DatabaseFeature.MATERIALIZED_VIEWS,
      DatabaseFeature.STORED_PROCEDURES,
      DatabaseFeature.FULL_TEXT_SEARCH,
      DatabaseFeature.GEOSPATIAL,
      DatabaseFeature.TIME_SERIES,
      DatabaseFeature.UPSERT,
      DatabaseFeature.BULK_INSERT,
      DatabaseFeature.STREAMING,
    ];

    return supportedFeatures.includes(feature);
  }

  /**
   * PostgreSQL 에러 매핑
   */
  mapError(error: any): DatabaseError {
    const postgresErrors: { [key: string]: DatabaseError } = {
      '28P01': {
        code: 'AUTH_FAILED',
        message: 'PostgreSQL 인증에 실패했습니다.',
        severity: 'high',
        retryable: false,
        suggestions: ['사용자 이름과 비밀번호를 확인해주세요.', 'pg_hba.conf 설정을 확인해주세요.'],
      },
      '3D000': {
        code: 'DATABASE_NOT_FOUND',
        message: '데이터베이스를 찾을 수 없습니다.',
        severity: 'high',
        retryable: false,
        suggestions: ['데이터베이스 이름을 확인해주세요.', 'PostgreSQL 서버에 데이터베이스가 존재하는지 확인해주세요.'],
      },
      '40P01': {
        code: 'DEADLOCK_DETECTED',
        message: '데드락이 감지되었습니다.',
        severity: 'medium',
        retryable: true,
        suggestions: ['트랜잭션을 다시 시도해주세요.', '트랜잭션 순서를 최적화해주세요.'],
      },
      '53300': {
        code: 'CONNECTION_LIMIT',
        message: '최대 연결 수를 초과했습니다.',
        severity: 'high',
        retryable: true,
        suggestions: ['잠시 후 다시 시도해주세요.', 'max_connections 설정을 확인해주세요.'],
      },
      '42P07': {
        code: 'TABLE_EXISTS',
        message: '테이블이 이미 존재합니다.',
        severity: 'low',
        retryable: false,
        suggestions: ['IF NOT EXISTS 구문을 사용하세요.'],
      },
      '25P02': {
        code: 'TRANSACTION_ERROR',
        message: '트랜잭션이 중단된 상태입니다.',
        severity: 'medium',
        retryable: true,
        suggestions: ['트랜잭션을 롤백하고 다시 시작해주세요.'],
      },
    };

    const errorCode = error.code;
    return postgresErrors[errorCode] || {
      code: 'UNKNOWN_ERROR',
      message: error.message || '알 수 없는 오류가 발생했습니다.',
      severity: 'medium',
      retryable: false,
      suggestions: ['쿼리를 확인해주세요.', '데이터베이스 연결을 확인해주세요.'],
    };
  }

  /**
   * PostgreSQL 성능 힌트 제공
   */
  getPerformanceHints(): PerformanceHint[] {
    return [
      {
        category: 'indexing',
        priority: 'high',
        description: 'JSON 컬럼에 GIN 인덱스를 생성하세요.',
        implementation: 'CREATE INDEX CONCURRENTLY idx_json_data ON table_name USING GIN (json_column);',
      },
      {
        category: 'indexing',
        priority: 'high',
        description: '배열 컬럼에 GIN 인덱스를 생성하세요.',
        implementation: 'CREATE INDEX CONCURRENTLY idx_array_data ON table_name USING GIN (array_column);',
      },
      {
        category: 'query',
        priority: 'high',
        description: 'CTE(Common Table Expression)를 활용하여 복잡한 쿼리를 단순화하세요.',
        implementation: 'WITH cte AS (SELECT ...) SELECT * FROM cte;',
      },
      {
        category: 'configuration',
        priority: 'high',
        description: 'shared_buffers를 메모리의 25%로 설정하세요.',
        implementation: 'shared_buffers = 25% of RAM',
      },
      {
        category: 'query',
        priority: 'medium',
        description: 'EXPLAIN ANALYZE를 사용하여 쿼리 성능을 분석하세요.',
        implementation: 'EXPLAIN (ANALYZE, BUFFERS) SELECT ...;',
      },
      {
        category: 'indexing',
        priority: 'medium',
        description: '부분 인덱스를 사용하여 인덱스 크기를 줄이세요.',
        implementation: 'CREATE INDEX idx_active_users ON users (email) WHERE active = true;',
      },
    ];
  }

  /**
   * 윈도우 함수 사용 가능 여부 확인
   */
  private canUseWindowFunction(queryBuilder: Knex.QueryBuilder): boolean {
    const sql = queryBuilder.toString();
    return sql.includes('ORDER BY') && sql.includes('LIMIT');
  }

  /**
   * 윈도우 함수로 최적화
   */
  private optimizeWithWindowFunction(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // ROW_NUMBER()를 활용한 페이지네이션 최적화
    return queryBuilder.select(
      '*',
      queryBuilder.client.raw('ROW_NUMBER() OVER (ORDER BY created_at DESC) as row_num')
    );
  }

  /**
   * JSON 연산 존재 여부 확인
   */
  private hasJsonOperations(queryBuilder: Knex.QueryBuilder): boolean {
    const sql = queryBuilder.toString();
    return sql.includes('->') || sql.includes('->>') || sql.includes('@>');
  }

  /**
   * JSON 쿼리 최적화
   */
  private optimizeJsonQuery(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // JSONB 연산자 최적화 힌트 추가
    return (queryBuilder as any).hint('/*+ USE_NL(t1 t2) */');
  }

  /**
   * 배열 연산 존재 여부 확인
   */
  private hasArrayOperations(queryBuilder: Knex.QueryBuilder): boolean {
    const sql = queryBuilder.toString();
    return sql.includes('&&') || sql.includes('@>') || sql.includes('<@');
  }

  /**
   * 배열 쿼리 최적화
   */
  private optimizeArrayQuery(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // GIN 인덱스 사용 힌트
    return (queryBuilder as any).hint('/*+ GIN_INDEX */');
  }

  /**
   * LIMIT 절 존재 여부 확인
   */
  private hasLimit(queryBuilder: Knex.QueryBuilder): boolean {
    const sql = queryBuilder.toString();
    return sql.includes('LIMIT');
  }

  /**
   * PostGIS 데이터 처리
   */
  private processPostGISData(row: any): any {
    if (!row || typeof row !== 'object') return row;

    // PostGIS geometry/geography 타입 처리
    Object.keys(row).forEach(key => {
      const value = row[key];
      if (typeof value === 'string' && value.startsWith('POINT(')) {
        // WKT 형식의 지리 데이터 파싱
        row[key] = this.parseWKT(value);
      }
    });

    return row;
  }

  /**
   * WKT(Well-Known Text) 파싱
   */
  private parseWKT(wkt: string): any {
    if (wkt.startsWith('POINT(')) {
      const coords = wkt.replace('POINT(', '').replace(')', '').split(' ');
      return {
        type: 'Point',
        coordinates: [parseFloat(coords[0]), parseFloat(coords[1])],
      };
    }
    return wkt;
  }

  /**
   * PostgreSQL JSON 연산 최적화
   */
  async optimizedJsonQuery(
    knex: Knex,
    tableName: string,
    jsonColumn: string,
    jsonPath: string,
    value: any
  ): Promise<any[]> {
    return knex(tableName)
      .select('*')
      .whereRaw(`${jsonColumn}->>'${jsonPath}' = ?`, [value])
      .orderBy(knex.raw(`${jsonColumn}->>'created_at'`) as any);
  }

  /**
   * PostgreSQL 배열 연산 최적화
   */
  async optimizedArrayQuery(
    knex: Knex,
    tableName: string,
    arrayColumn: string,
    values: string[]
  ): Promise<any[]> {
    return knex(tableName)
      .whereRaw(`${arrayColumn} && ARRAY[?]::varchar[]`, [values]);
  }

  /**
   * PostgreSQL UPSERT 구현
   */
  async upsert(
    knex: Knex,
    tableName: string,
    data: any,
    conflictColumns: string[]
  ): Promise<void> {
    const columns = Object.keys(data);
    const updateColumns = columns.filter(col => !conflictColumns.includes(col));
    
    const updateClause = updateColumns
      .map(col => `${col} = EXCLUDED.${col}`)
      .join(', ');

    await knex(tableName)
      .insert(data)
      .onConflict(conflictColumns)
      .merge(updateColumns);
  }

  /**
   * PostgreSQL 배치 COPY 연산
   */
  async copyFromArray(
    knex: Knex,
    tableName: string,
    data: any[]
  ): Promise<void> {
    if (data.length === 0) return;

    const columns = Object.keys(data[0]);
    const csvData = data.map(row => 
      columns.map(col => row[col] || '').join('\t')
    ).join('\n');

    // COPY 명령 사용 (대용량 데이터에 최적)
    await knex.raw(`
      COPY ${tableName} (${columns.join(', ')}) 
      FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '')
    `, [csvData]);
  }
}