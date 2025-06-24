import { Knex } from 'knex';
import { Injectable } from '@nestjs/common';
import {
  IDatabaseOptimizer,
  DatabaseFeature,
  DatabaseError,
  PerformanceHint,
} from './database-optimizer.interface';

/**
 * MySQL/MariaDB 최적화 클래스
 */
@Injectable()
export class MySQLOptimizer implements IDatabaseOptimizer {
  readonly databaseType = 'mysql';

  /**
   * MySQL에 최적화된 연결 설정
   */
  getOptimizedConnectionConfig(baseConfig: any): Knex.Config {
    const optimizedConfig: Knex.Config = {
      ...baseConfig,
      client: 'mysql2',
      connection: {
        ...baseConfig.connection,
        // MySQL 특화 설정
        supportBigNumbers: true,
        bigNumberStrings: true,
        dateStrings: true,
        multipleStatements: false, // 보안상 단일 구문만 허용
        connectTimeout: 30000,
        acquireTimeout: 30000,
        timeout: 30000,
        // 문자셋 설정
        charset: 'utf8mb4',
        // SSL 설정 (필요시)
        ssl: process.env.NODE_ENV === 'prod' ? {
          rejectUnauthorized: false
        } : undefined,
        // 시간대 설정
        timezone: '+09:00',
      },
      pool: {
        min: 0,
        max: parseInt(process.env.MYSQL_POOL_MAX) || 10,
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000, // 5분
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false,
        // MySQL 연결 풀 이벤트 처리
        afterCreate: (conn: any, done: Function) => {
          // MySQL 세션 변수 설정
          const sessionQueries = [
            'SET SESSION sql_mode="TRADITIONAL"',
            'SET SESSION time_zone="+09:00"',
            'SET SESSION autocommit=1',
            'SET SESSION tx_isolation="READ-COMMITTED"',
          ];

          let completed = 0;
          const total = sessionQueries.length;

          sessionQueries.forEach(query => {
            conn.query(query, (err: any) => {
              if (err) {
                console.warn(`MySQL session setup warning: ${err.message}`);
              }
              completed++;
              if (completed === total) {
                done(err, conn);
              }
            });
          });
        },
      },
      acquireConnectionTimeout: 30000,
      // MySQL 특화 옵션
      migrations: {
        tableName: 'knex_migrations',
        stub: './migrations/migration.stub',
      },
    };

    return optimizedConfig;
  }

  /**
   * MySQL 쿼리 최적화
   */
  optimizeQuery(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    // MySQL STRAIGHT_JOIN 힌트 적용 (필요시)
    if (this.shouldUseStraightJoin(queryBuilder)) {
      queryBuilder = (queryBuilder as any).hint('STRAIGHT_JOIN');
    }

    // MySQL 인덱스 힌트 적용
    const indexHints = this.getIndexHints(queryBuilder);
    if (indexHints.length > 0) {
      indexHints.forEach(hint => {
        queryBuilder = (queryBuilder as any).hint(hint);
      });
    }

    // 결과 제한 최적화
    if (!this.hasLimit(queryBuilder)) {
      queryBuilder = queryBuilder.limit(1000); // 기본 제한
    }

    return queryBuilder;
  }

  /**
   * MySQL 최적 배치 크기
   */
  getBatchSize(): number {
    // MySQL은 일반적으로 1000개 단위가 최적
    return parseInt(process.env.MYSQL_BATCH_SIZE) || 1000;
  }

  /**
   * MySQL 지원 기능 확인
   */
  supportsFeature(feature: DatabaseFeature): boolean {
    const supportedFeatures = [
      DatabaseFeature.JSON_OPERATIONS,
      DatabaseFeature.WINDOW_FUNCTIONS,
      DatabaseFeature.CTE,
      DatabaseFeature.STORED_PROCEDURES,
      DatabaseFeature.FULL_TEXT_SEARCH,
      DatabaseFeature.GEOSPATIAL,
      DatabaseFeature.UPSERT,
      DatabaseFeature.BULK_INSERT,
    ];

    return supportedFeatures.includes(feature);
  }

  /**
   * MySQL 에러 매핑
   */
  mapError(error: any): DatabaseError {
    const mysqlErrors: { [key: string]: DatabaseError } = {
      'ER_ACCESS_DENIED_ERROR': {
        code: 'AUTH_FAILED',
        message: '데이터베이스 인증에 실패했습니다.',
        severity: 'high',
        retryable: false,
        suggestions: ['연결 정보를 확인해주세요.', 'MySQL 사용자 권한을 확인해주세요.'],
      },
      'ER_BAD_DB_ERROR': {
        code: 'DATABASE_NOT_FOUND',
        message: '데이터베이스를 찾을 수 없습니다.',
        severity: 'high',
        retryable: false,
        suggestions: ['데이터베이스 이름을 확인해주세요.', 'MySQL 서버에 데이터베이스가 존재하는지 확인해주세요.'],
      },
      'ER_LOCK_WAIT_TIMEOUT': {
        code: 'LOCK_TIMEOUT',
        message: '잠금 대기 시간이 초과되었습니다.',
        severity: 'medium',
        retryable: true,
        suggestions: ['잠시 후 다시 시도해주세요.', '트랜잭션 시간을 줄여주세요.'],
      },
      'ER_TOO_MANY_CONNECTIONS': {
        code: 'CONNECTION_LIMIT',
        message: '최대 연결 수를 초과했습니다.',
        severity: 'high',
        retryable: true,
        suggestions: ['잠시 후 다시 시도해주세요.', 'MySQL max_connections 설정을 확인해주세요.'],
      },
      'ER_TABLE_EXISTS_ERROR': {
        code: 'TABLE_EXISTS',
        message: '테이블이 이미 존재합니다.',
        severity: 'low',
        retryable: false,
        suggestions: ['IF NOT EXISTS 구문을 사용하세요.'],
      },
    };

    const errorCode = error.code || error.errno;
    return mysqlErrors[errorCode] || {
      code: 'UNKNOWN_ERROR',
      message: error.message || '알 수 없는 오류가 발생했습니다.',
      severity: 'medium',
      retryable: false,
      suggestions: ['쿼리를 확인해주세요.', '데이터베이스 연결을 확인해주세요.'],
    };
  }

  /**
   * MySQL 성능 힌트 제공
   */
  getPerformanceHints(): PerformanceHint[] {
    return [
      {
        category: 'indexing',
        priority: 'high',
        description: 'WHERE 절에 사용되는 컬럼에 인덱스를 생성하세요.',
        implementation: 'CREATE INDEX idx_column_name ON table_name(column_name);',
      },
      {
        category: 'query',
        priority: 'high',
        description: 'SELECT * 대신 필요한 컬럼만 지정하세요.',
        implementation: 'SELECT col1, col2 FROM table_name WHERE condition;',
      },
      {
        category: 'connection',
        priority: 'medium',
        description: '연결 풀 크기를 적절히 조정하세요.',
        implementation: 'pool: { min: 0, max: 10 }',
      },
      {
        category: 'configuration',
        priority: 'medium',
        description: 'InnoDB 버퍼 풀 크기를 메모리의 70-80%로 설정하세요.',
        implementation: 'innodb_buffer_pool_size = 70% of RAM',
      },
      {
        category: 'query',
        priority: 'medium',
        description: 'JOIN 시 작은 테이블을 먼저 배치하세요.',
        implementation: 'SELECT * FROM small_table JOIN large_table ON condition;',
      },
    ];
  }

  /**
   * STRAIGHT_JOIN 사용 여부 판단
   */
  private shouldUseStraightJoin(queryBuilder: Knex.QueryBuilder): boolean {
    // 복잡한 JOIN이 있을 때만 사용
    const sql = queryBuilder.toString();
    const joinCount = (sql.match(/JOIN/gi) || []).length;
    return joinCount >= 3;
  }

  /**
   * 인덱스 힌트 생성
   */
  private getIndexHints(queryBuilder: Knex.QueryBuilder): string[] {
    const hints: string[] = [];
    const sql = queryBuilder.toString();
    
    // WHERE 절에서 자주 사용되는 패턴에 대한 힌트
    if (sql.includes('WHERE') && sql.includes('ORDER BY')) {
      hints.push('USE INDEX FOR ORDER BY (idx_created_at)');
    }
    
    if (sql.includes('GROUP BY')) {
      hints.push('USE INDEX FOR GROUP BY (idx_group_column)');
    }

    return hints;
  }

  /**
   * LIMIT 절 존재 여부 확인
   */
  private hasLimit(queryBuilder: Knex.QueryBuilder): boolean {
    const sql = queryBuilder.toString();
    return sql.includes('LIMIT');
  }

  /**
   * MySQL 배치 삽입 최적화
   */
  async optimizedBatchInsert(
    knex: Knex,
    tableName: string,
    data: any[],
    options: { chunkSize?: number; ignore?: boolean } = {}
  ): Promise<void> {
    const chunkSize = options.chunkSize || this.getBatchSize();
    const ignore = options.ignore || false;
    
    // 데이터를 청크로 분할
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      try {
        if (ignore) {
          // INSERT IGNORE 사용
          await knex.raw(`INSERT IGNORE INTO ${tableName} (${Object.keys(chunk[0]).join(', ')}) VALUES ?`, [
            chunk.map(row => Object.values(row))
          ]);
        } else {
          await knex(tableName).insert(chunk);
        }
      } catch (error) {
        console.error(`Batch insert failed for chunk ${i / chunkSize + 1}:`, error);
        throw error;
      }
    }
  }

  /**
   * MySQL UPSERT 구현
   */
  async upsert(
    knex: Knex,
    tableName: string,
    data: any,
    conflictColumns: string[]
  ): Promise<void> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const updateClause = columns
      .filter(col => !conflictColumns.includes(col))
      .map(col => `${col} = VALUES(${col})`)
      .join(', ');

    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${columns.map(() => '?').join(', ')})
      ON DUPLICATE KEY UPDATE ${updateClause}
    `;

    await knex.raw(sql, values);
  }
}