---
task_id: T07_S03
sprint_sequence_id: S03
status: open
complexity: Medium
last_updated: 2025-06-12T17:00:00Z
---

# Task: Database-Specific Optimizations

## Description
각 데이터베이스 타입(MySQL, PostgreSQL, Oracle, BigQuery, Snowflake 등)별로 특화된 최적화를 적용합니다. 데이터베이스별 특성을 활용하여 쿼리 성능을 극대화하고, 각 DB의 고유 기능을 활용한 최적화 전략을 구현합니다.

## Goal / Objectives
- 데이터베이스별 특성 분석 및 활용
- DB별 최적화된 쿼리 패턴 구현
- 특화 기능 활용 (파티셔닝, 인덱싱 전략 등)
- 데이터베이스별 연결 설정 최적화

## Acceptance Criteria
- [ ] 각 지원 데이터베이스별 최적화 전략이 문서화됨
- [ ] DB별 특화 쿼리 패턴이 구현됨
- [ ] 데이터베이스별 성능이 20% 이상 개선됨
- [ ] DB별 연결 설정이 최적화됨
- [ ] 데이터베이스별 베스트 프랙티스 가이드 작성

## Subtasks
- [ ] 지원 데이터베이스별 특성 분석
  - [ ] MySQL/MariaDB 최적화
  - [ ] PostgreSQL 최적화
  - [ ] Oracle 최적화
  - [ ] SQL Server 최적화
  - [ ] BigQuery 최적화
  - [ ] Snowflake 최적화
- [ ] DB별 쿼리 최적화 구현
- [ ] 연결 설정 최적화
- [ ] 특화 기능 활용 구현
- [ ] 성능 테스트 및 검증
- [ ] 가이드라인 문서화

## Technical Guidance

### Key interfaces and integration points
- **Connection Service**: `connection/connection.service.ts` - DB 연결 관리
- **Knex Dialects**: `connection/knex-dialects/` - DB별 dialect 구현
- **Database Service**: `database/database.service.ts` - 쿼리 실행
- **Database Type Entity**: DB 타입 정의 및 관리

### Specific imports and module references
```typescript
import * as Knex from 'knex';
import { DatabaseType } from '../database/entities/database_type.entity';
```

### Existing patterns to follow
- Knex를 통한 데이터베이스 추상화
- DB별 dialect 커스터마이징
- 환경 변수를 통한 DB별 설정 관리
- 쿼리 빌더 패턴 활용

### Database models to work with
- **MySQL/MariaDB**: 기본 메타데이터 저장소
- **PostgreSQL**: JSON 타입, 배열 지원
- **Oracle**: 시퀀스, 프로시저 활용
- **BigQuery**: 파티셔닝, 클러스터링
- **Snowflake**: 웨어하우스 크기 조정
- **SQL Server**: 인덱싱 전략

### Error handling approach
- DB별 에러 코드 매핑
- 연결 실패 시 상세 진단
- DB 특화 에러 처리

## Implementation Notes

### Step-by-step implementation approach
1. 각 데이터베이스별 특성 조사
2. DB별 최적화 전략 수립
3. Knex dialect 커스터마이징
4. 쿼리 패턴 최적화
5. 연결 설정 튜닝
6. 성능 측정 및 검증

### Key architectural decisions to respect
- Knex를 통한 DB 추상화 유지
- DB별 특화 기능은 선택적 사용
- 코드 재사용성과 DB 특화의 균형

### Testing approach
- 각 DB별 단위 테스트
- 대용량 데이터 성능 테스트
- DB별 특화 기능 테스트
- 크로스 DB 호환성 테스트

### Performance considerations
- DB별 최적 배치 크기
- 파티셔닝 전략
- 인덱싱 전략
- 쿼리 실행 계획 최적화

### Database-specific optimization examples
```typescript
// MySQL/MariaDB Optimizations
class MySQLOptimizer {
  // Use INDEX hints for MySQL
  optimizeQuery(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
    return queryBuilder
      .hint('USE INDEX (idx_created_at)')
      .options({ sql_mode: 'TRADITIONAL' });
  }

  // Batch insert optimization
  async batchInsert(data: any[], tableName: string) {
    const chunkSize = 1000; // MySQL optimal batch size
    const chunks = this.chunkArray(data, chunkSize);
    
    for (const chunk of chunks) {
      await this.knex(tableName)
        .insert(chunk)
        .options({ ignore: true }); // INSERT IGNORE
    }
  }

  // Connection optimization
  getConnectionConfig() {
    return {
      client: 'mysql2',
      connection: {
        ...baseConfig,
        supportBigNumbers: true,
        bigNumberStrings: true,
        dateStrings: true,
        multipleStatements: true,
      },
      pool: {
        min: 0,
        max: 10,
        afterCreate: (conn, done) => {
          conn.query('SET SESSION sql_mode="TRADITIONAL"', (err) => {
            done(err, conn);
          });
        },
      },
    };
  }
}

// PostgreSQL Optimizations
class PostgreSQLOptimizer {
  // Use PostgreSQL specific features
  async optimizeJsonQuery(tableName: string, jsonColumn: string, jsonPath: string) {
    return this.knex(tableName)
      .select('*')
      .whereRaw(`${jsonColumn}->>'${jsonPath}' = ?`, ['value'])
      .orderBy(this.knex.raw(`${jsonColumn}->>'created_at'`));
  }

  // Array operations
  async arrayContains(tableName: string, arrayColumn: string, values: string[]) {
    return this.knex(tableName)
      .whereRaw(`${arrayColumn} && ARRAY[?]::varchar[]`, [values]);
  }

  // Connection optimization
  getConnectionConfig() {
    return {
      client: 'pg',
      connection: {
        ...baseConfig,
        ssl: { rejectUnauthorized: false },
        statement_timeout: 30000,
        idle_in_transaction_session_timeout: 60000,
      },
      pool: {
        min: 0,
        max: 20, // PostgreSQL handles more connections well
      },
      searchPath: ['public'],
    };
  }
}

// BigQuery Optimizations
class BigQueryOptimizer {
  // Partitioning optimization
  async createPartitionedTable(dataset: string, table: string) {
    const query = `
      CREATE TABLE IF NOT EXISTS \`${dataset}.${table}\`
      PARTITION BY DATE(created_at)
      CLUSTER BY user_id, status
      AS SELECT * FROM \`${dataset}.${table}_temp\`
    `;
    return this.executeBigQuery(query);
  }

  // Cost-effective query
  async queryWithCostControl(query: string) {
    return this.knex.raw(query)
      .options({
        maximumBytesBilled: '1000000000', // 1GB limit
        useQueryCache: true,
        priority: 'INTERACTIVE',
      });
  }

  // Connection optimization
  getConnectionConfig() {
    return {
      client: require('./knex-dialects/bigquery'),
      connection: {
        projectId: process.env.BIGQUERY_PROJECT_ID,
        keyFilename: process.env.BIGQUERY_KEY_FILE,
        location: 'US',
      },
      pool: {
        min: 0,
        max: 5, // BigQuery has API rate limits
      },
    };
  }
}

// Snowflake Optimizations
class SnowflakeOptimizer {
  // Warehouse management
  async executeWithWarehouse(query: string, warehouseSize: string = 'SMALL') {
    await this.knex.raw(`USE WAREHOUSE ${warehouseSize}_WH`);
    const result = await this.knex.raw(query);
    await this.knex.raw('USE WAREHOUSE DEFAULT_WH'); // Switch back
    return result;
  }

  // Result caching
  async queryWithCache(query: string) {
    return this.knex.raw(query)
      .options({
        resultCacheTTL: 86400, // 24 hours
        maxRetries: 3,
      });
  }

  // Connection optimization
  getConnectionConfig() {
    return {
      client: require('./knex-dialects/snowflake'),
      connection: {
        account: process.env.SNOWFLAKE_ACCOUNT,
        username: process.env.SNOWFLAKE_USER,
        password: process.env.SNOWFLAKE_PASSWORD,
        warehouse: 'COMPUTE_WH',
        database: process.env.SNOWFLAKE_DATABASE,
        schema: process.env.SNOWFLAKE_SCHEMA,
        role: 'PUBLIC',
      },
      pool: {
        min: 0,
        max: 10,
        acquireTimeoutMillis: 60000,
      },
    };
  }
}

// Database-specific query builder
export class DatabaseSpecificQueryBuilder {
  constructor(private readonly databaseType: string) {}

  buildOptimizedQuery(baseQuery: Knex.QueryBuilder): Knex.QueryBuilder {
    switch (this.databaseType.toLowerCase()) {
      case 'mysql':
      case 'mariadb':
        return new MySQLOptimizer().optimizeQuery(baseQuery);
      
      case 'postgresql':
      case 'postgres':
        return this.addPostgreSQLOptimizations(baseQuery);
      
      case 'oracle':
        return this.addOracleOptimizations(baseQuery);
      
      case 'bigquery':
        return this.addBigQueryOptimizations(baseQuery);
      
      case 'snowflake':
        return this.addSnowflakeOptimizations(baseQuery);
      
      default:
        return baseQuery;
    }
  }

  private addPostgreSQLOptimizations(query: Knex.QueryBuilder): Knex.QueryBuilder {
    // Add EXPLAIN ANALYZE in dev mode
    if (process.env.NODE_ENV === 'development') {
      return query.options({ analyze: true });
    }
    return query;
  }

  private addOracleOptimizations(query: Knex.QueryBuilder): Knex.QueryBuilder {
    // Oracle specific hints
    return query.hint('/*+ FIRST_ROWS(10) */');
  }

  private addBigQueryOptimizations(query: Knex.QueryBuilder): Knex.QueryBuilder {
    // BigQuery specific options
    return query.options({
      useLegacySql: false,
      maximumBillingTier: 1,
    });
  }

  private addSnowflakeOptimizations(query: Knex.QueryBuilder): Knex.QueryBuilder {
    // Snowflake query tags for monitoring
    return query.options({
      queryTag: `app:vanillameta,env:${process.env.NODE_ENV}`,
    });
  }
}
```

## Output Log
*(This section is populated as work progresses on the task)*