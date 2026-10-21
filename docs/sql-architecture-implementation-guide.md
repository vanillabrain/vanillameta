# VanillaMeta SQL 아키텍처 구현 가이드

## 목차
1. [프로젝트 구조](#프로젝트-구조)
2. [단계별 구현 가이드](#단계별-구현-가이드)
3. [코드 예제](#코드-예제)
4. [마이그레이션 전략](#마이그레이션-전략)
5. [테스트 전략](#테스트-전략)
6. [모니터링 및 디버깅](#모니터링-및-디버깅)

## 프로젝트 구조

### 새로운 폴더 구조
```
backend-api/
├── src/
│   ├── database/
│   │   ├── adapters/
│   │   │   ├── base/
│   │   │   │   ├── database.adapter.ts
│   │   │   │   └── database.adapter.interface.ts
│   │   │   ├── postgresql/
│   │   │   │   ├── postgresql.adapter.ts
│   │   │   │   └── postgresql.types.ts
│   │   │   ├── mysql/
│   │   │   │   ├── mysql.adapter.ts
│   │   │   │   └── mysql.types.ts
│   │   │   ├── bigquery/
│   │   │   │   ├── bigquery.adapter.ts
│   │   │   │   └── bigquery.types.ts
│   │   │   └── adapter.factory.ts
│   │   ├── connection/
│   │   │   ├── connection.manager.ts
│   │   │   ├── connection.pool.ts
│   │   │   └── connection.monitor.ts
│   │   ├── query/
│   │   │   ├── query.builder.service.ts
│   │   │   ├── query.optimizer.ts
│   │   │   ├── query.executor.ts
│   │   │   └── query.types.ts
│   │   └── cache/
│   │       ├── cache.service.ts
│   │       ├── cache.strategy.ts
│   │       └── cache.types.ts
│   ├── modules/
│   │   ├── dataset/
│   │   │   ├── dataset.service.v2.ts  // 새로운 구현
│   │   │   └── dataset.service.ts     // 기존 유지
│   │   └── widget/
│   │       ├── widget.service.v2.ts   // 새로운 구현
│   │       └── widget.service.ts      // 기존 유지
│   └── common/
│       ├── decorators/
│       │   ├── cache.decorator.ts
│       │   └── transaction.decorator.ts
│       └── interceptors/
│           ├── query-logging.interceptor.ts
│           └── performance.interceptor.ts
```

## 단계별 구현 가이드

### Phase 1: 기초 설정 (Week 1)

#### 1.1 패키지 설치
```bash
# Kysely 및 관련 패키지
npm install kysely @kysely/mysql @kysely/postgres

# 캐싱을 위한 Redis
npm install ioredis @types/ioredis

# 모니터링 도구
npm install prom-client @types/prom-client

# 유틸리티
npm install p-queue lodash.memoize
```

#### 1.2 환경 설정
```typescript
// config/database.config.ts
export interface DatabaseEnvironmentConfig {
  kysely: {
    logLevel: 'query' | 'error' | 'warn' | 'info'
    defaultTimeout: number
    retryAttempts: number
  }
  cache: {
    enabled: boolean
    defaultTTL: number
    redis: {
      host: string
      port: number
      password?: string
    }
  }
  pool: {
    min: number
    max: number
    acquireTimeout: number
    idleTimeout: number
  }
}
```

### Phase 2: 어댑터 구현 (Week 2-3)

#### 2.1 Base Adapter Interface
```typescript
// adapters/base/database.adapter.interface.ts
import { Kysely, CompiledQuery } from 'kysely'

export interface IDatabaseAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  getDb(): Kysely<any>
  executeQuery<T>(query: CompiledQuery): Promise<QueryResult<T>>
  executeRaw<T>(sql: string, params?: any[]): Promise<QueryResult<T>>
  transaction<T>(callback: (trx: Kysely<any>) => Promise<T>): Promise<T>
  healthCheck(): Promise<boolean>
}

export interface QueryResult<T> {
  rows: T[]
  fields: FieldMetadata[]
  rowCount: number
  executionTime: number
}

export interface FieldMetadata {
  name: string
  dataType: string
  nullable: boolean
  maxLength?: number
}
```

#### 2.2 PostgreSQL Adapter 구현
```typescript
// adapters/postgresql/postgresql.adapter.ts
import { Kysely, PostgresDialect, CompiledQuery } from 'kysely'
import { Pool } from 'pg'
import { IDatabaseAdapter, QueryResult } from '../base/database.adapter.interface'

export class PostgreSQLAdapter implements IDatabaseAdapter {
  private db: Kysely<any>
  private pool: Pool
  private config: PostgreSQLConfig

  constructor(config: PostgreSQLConfig) {
    this.config = config
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.poolSize || 10,
      idleTimeoutMillis: config.idleTimeout || 30000
    })
  }

  async connect(): Promise<void> {
    this.db = new Kysely<any>({
      dialect: new PostgresDialect({
        pool: this.pool
      }),
      log: this.config.logLevel ? [this.config.logLevel] : undefined
    })
    
    // Test connection
    await this.db.selectFrom('pg_stat_activity').select('pid').limit(1).execute()
  }

  async disconnect(): Promise<void> {
    await this.db.destroy()
    await this.pool.end()
  }

  getDb(): Kysely<any> {
    if (!this.db) {
      throw new Error('Database not connected')
    }
    return this.db
  }

  async executeQuery<T>(query: CompiledQuery): Promise<QueryResult<T>> {
    const startTime = Date.now()
    
    try {
      const result = await this.pool.query(query.sql, query.parameters)
      
      return {
        rows: result.rows,
        fields: result.fields.map(field => ({
          name: field.name,
          dataType: this.mapDataType(field.dataTypeID),
          nullable: field.nullable
        })),
        rowCount: result.rowCount || 0,
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      throw new DatabaseError('Query execution failed', error)
    }
  }

  async executeRaw<T>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const startTime = Date.now()
    
    try {
      const result = await this.pool.query(sql, params)
      
      return {
        rows: result.rows,
        fields: result.fields.map(field => ({
          name: field.name,
          dataType: this.mapDataType(field.dataTypeID),
          nullable: field.nullable
        })),
        rowCount: result.rowCount || 0,
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      throw new DatabaseError('Raw query execution failed', error)
    }
  }

  async transaction<T>(callback: (trx: Kysely<any>) => Promise<T>): Promise<T> {
    return await this.db.transaction().execute(callback)
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  private mapDataType(oid: number): string {
    // PostgreSQL OID to type mapping
    const typeMap: Record<number, string> = {
      16: 'boolean',
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      25: 'text',
      700: 'float',
      701: 'double',
      1082: 'date',
      1114: 'timestamp',
      1184: 'timestamptz',
      1043: 'varchar',
      3802: 'jsonb'
    }
    return typeMap[oid] || 'unknown'
  }
}
```

### Phase 3: Connection Manager (Week 3-4)

#### 3.1 Connection Manager 구현
```typescript
// connection/connection.manager.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { IDatabaseAdapter } from '../adapters/base/database.adapter.interface'
import { AdapterFactory } from '../adapters/adapter.factory'
import { ConnectionPool } from './connection.pool'
import { ConnectionMonitor } from './connection.monitor'

@Injectable()
export class ConnectionManager implements OnModuleDestroy {
  private connections = new Map<number, ManagedConnection>()
  private pools = new Map<number, ConnectionPool>()
  private monitor: ConnectionMonitor

  constructor(
    private adapterFactory: AdapterFactory,
    monitor: ConnectionMonitor
  ) {
    this.monitor = monitor
  }

  async createConnection(config: DatabaseConfig): Promise<ManagedConnection> {
    if (this.connections.has(config.id)) {
      return this.connections.get(config.id)!
    }

    const adapter = this.adapterFactory.create(config)
    await adapter.connect()

    const pool = new ConnectionPool(adapter, config.poolConfig)
    const connection: ManagedConnection = {
      id: config.id,
      adapter,
      pool,
      config,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 0
    }

    this.connections.set(config.id, connection)
    this.pools.set(config.id, pool)
    
    // Start monitoring
    this.monitor.startMonitoring(config.id, connection)

    return connection
  }

  async getConnection(id: number): Promise<IDatabaseAdapter> {
    const connection = this.connections.get(id)
    if (!connection) {
      throw new Error(`Connection ${id} not found`)
    }

    connection.lastUsedAt = new Date()
    connection.useCount++

    return connection.pool.acquire()
  }

  async releaseConnection(id: number, adapter: IDatabaseAdapter): Promise<void> {
    const pool = this.pools.get(id)
    if (!pool) {
      throw new Error(`Pool ${id} not found`)
    }

    await pool.release(adapter)
  }

  async destroyConnection(id: number): Promise<void> {
    const connection = this.connections.get(id)
    if (!connection) {
      return
    }

    this.monitor.stopMonitoring(id)
    await connection.pool.drain()
    await connection.adapter.disconnect()
    
    this.connections.delete(id)
    this.pools.delete(id)
  }

  async onModuleDestroy(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map(id => 
      this.destroyConnection(id)
    )
    await Promise.all(promises)
  }

  getPoolStats(id: number): PoolStats {
    const pool = this.pools.get(id)
    if (!pool) {
      throw new Error(`Pool ${id} not found`)
    }

    return pool.getStats()
  }

  async healthCheck(id: number): Promise<HealthStatus> {
    const connection = this.connections.get(id)
    if (!connection) {
      return {
        status: 'unhealthy',
        message: 'Connection not found',
        lastCheck: new Date()
      }
    }

    try {
      const startTime = Date.now()
      const isHealthy = await connection.adapter.healthCheck()
      const latency = Date.now() - startTime

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        latency,
        lastCheck: new Date(),
        poolStats: this.getPoolStats(id)
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        lastCheck: new Date()
      }
    }
  }
}

interface ManagedConnection {
  id: number
  adapter: IDatabaseAdapter
  pool: ConnectionPool
  config: DatabaseConfig
  createdAt: Date
  lastUsedAt: Date
  useCount: number
}
```

### Phase 4: Query Builder Service (Week 4-5)

#### 4.1 Query Builder Service 구현
```typescript
// query/query.builder.service.ts
import { Injectable } from '@nestjs/common'
import { Kysely, sql, CompiledQuery } from 'kysely'
import { ConnectionManager } from '../connection/connection.manager'
import { CacheService } from '../cache/cache.service'
import { QueryOptimizer } from './query.optimizer'
import { QueryExecutor } from './query.executor'

@Injectable()
export class QueryBuilderService {
  constructor(
    private connectionManager: ConnectionManager,
    private cacheService: CacheService,
    private optimizer: QueryOptimizer,
    private executor: QueryExecutor
  ) {}

  /**
   * Raw SQL 실행 - VanillaMeta의 핵심 기능
   * 사용자가 SQL 에디터에서 작성한 쿼리를 직접 실행
   */
  async executeRawSQL<T = any>(config: RawSQLConfig): Promise<QueryResult<T>> {
    const { databaseId, query: userQuery, parameters = [], cacheTTL } = config
    
    // Get connection
    const adapter = await this.connectionManager.getConnection(databaseId)
    const db = adapter.getDb()
    
    try {
      // Check cache if enabled
      const cacheKey = this.generateRawSQLCacheKey(databaseId, userQuery, parameters)
      if (cacheTTL && cacheTTL > 0) {
        const cachedResult = await this.cacheService.get<QueryResult<T>>(cacheKey)
        if (cachedResult) {
          return { ...cachedResult, cached: true }
        }
      }
      
      // Execute raw SQL using Kysely's sql template tag
      // This provides SQL injection protection through parameter binding
      const startTime = Date.now()
      let result
      
      if (parameters.length > 0) {
        // With parameters - build parameterized query
        const parameterizedQuery = this.buildParameterizedQuery(userQuery, parameters)
        result = await sql`${parameterizedQuery}`.execute(db)
      } else {
        // Without parameters - direct execution
        result = await sql`${userQuery}`.execute(db)
      }
      
      // Extract metadata
      const fields = await this.extractFieldMetadata(result, adapter)
      
      const queryResult: QueryResult<T> = {
        rows: result.rows as T[],
        fields,
        rowCount: result.numAffectedRows ?? result.rows.length,
        executionTime: Date.now() - startTime,
        cached: false
      }
      
      // Cache result if needed
      if (cacheTTL && cacheTTL > 0) {
        await this.cacheService.set(cacheKey, queryResult, { ttl: cacheTTL })
      }
      
      return queryResult
    } catch (error) {
      // Enhanced error handling for user queries
      throw this.enhanceQueryError(error, userQuery, databaseId)
    } finally {
      await this.connectionManager.releaseConnection(databaseId, adapter)
    }
  }

  /**
   * Dataset 쿼리 실행 - 저장된 쿼리 실행
   */
  async executeDatasetQuery<T = any>(config: DatasetQueryConfig): Promise<QueryResult<T>> {
    const { datasetId, parameters = [], cacheTTL = 300 } = config
    
    // Load dataset from database
    const dataset = await this.loadDataset(datasetId)
    
    // Execute using raw SQL with dataset's saved query
    return this.executeRawSQL<T>({
      databaseId: dataset.databaseId,
      query: dataset.query,
      parameters,
      cacheTTL
    })
  }

  async select<T>(config: SelectConfig): Promise<QueryResult<T>> {
    const { databaseId, table, columns, where, joins, orderBy, limit, offset } = config
    
    // Get connection
    const adapter = await this.connectionManager.getConnection(databaseId)
    const db = adapter.getDb()
    
    // Build query
    let query = db.selectFrom(table)
    
    // Select columns
    if (columns && columns.length > 0) {
      query = query.select(columns)
    } else {
      query = query.selectAll()
    }
    
    // Apply joins
    if (joins) {
      for (const join of joins) {
        switch (join.type) {
          case 'inner':
            query = query.innerJoin(join.table, join.on[0], join.on[1], join.on[2])
            break
          case 'left':
            query = query.leftJoin(join.table, join.on[0], join.on[1], join.on[2])
            break
          case 'right':
            query = query.rightJoin(join.table, join.on[0], join.on[1], join.on[2])
            break
        }
      }
    }
    
    // Apply where conditions
    if (where) {
      query = this.applyWhereConditions(query, where)
    }
    
    // Apply ordering
    if (orderBy) {
      for (const order of orderBy) {
        query = query.orderBy(order.column, order.direction)
      }
    }
    
    // Apply pagination
    if (limit) {
      query = query.limit(limit)
    }
    if (offset) {
      query = query.offset(offset)
    }
    
    // Compile and optimize
    const compiledQuery = query.compile()
    const optimizedQuery = await this.optimizer.optimize(compiledQuery, adapter)
    
    // Check cache
    const cacheKey = this.generateCacheKey(databaseId, optimizedQuery)
    const cachedResult = await this.cacheService.get<QueryResult<T>>(cacheKey)
    
    if (cachedResult) {
      return { ...cachedResult, cached: true }
    }
    
    // Execute query
    const result = await this.executor.execute<T>(optimizedQuery, adapter)
    
    // Cache result
    await this.cacheService.set(cacheKey, result, {
      ttl: config.cacheTTL || 300 // 5 minutes default
    })
    
    // Release connection
    await this.connectionManager.releaseConnection(databaseId, adapter)
    
    return result
  }

  async raw<T>(config: RawQueryConfig): Promise<QueryResult<T>> {
    const { databaseId, sql: rawSql, params, cacheTTL } = config
    
    // Get connection
    const adapter = await this.connectionManager.getConnection(databaseId)
    
    try {
      // Check cache
      const cacheKey = this.generateRawCacheKey(databaseId, rawSql, params)
      const cachedResult = await this.cacheService.get<QueryResult<T>>(cacheKey)
      
      if (cachedResult) {
        return { ...cachedResult, cached: true }
      }
      
      // Execute raw query
      const result = await adapter.executeRaw<T>(rawSql, params)
      
      // Cache result if needed
      if (cacheTTL && cacheTTL > 0) {
        await this.cacheService.set(cacheKey, result, { ttl: cacheTTL })
      }
      
      return result
    } finally {
      await this.connectionManager.releaseConnection(databaseId, adapter)
    }
  }

  async transaction<T>(
    databaseId: number,
    callback: (trx: Kysely<any>) => Promise<T>
  ): Promise<T> {
    const adapter = await this.connectionManager.getConnection(databaseId)
    
    try {
      return await adapter.transaction(callback)
    } finally {
      await this.connectionManager.releaseConnection(databaseId, adapter)
    }
  }

  private applyWhereConditions(query: any, conditions: WhereCondition[]): any {
    for (const condition of conditions) {
      switch (condition.operator) {
        case 'eq':
          query = query.where(condition.column, '=', condition.value)
          break
        case 'neq':
          query = query.where(condition.column, '!=', condition.value)
          break
        case 'gt':
          query = query.where(condition.column, '>', condition.value)
          break
        case 'gte':
          query = query.where(condition.column, '>=', condition.value)
          break
        case 'lt':
          query = query.where(condition.column, '<', condition.value)
          break
        case 'lte':
          query = query.where(condition.column, '<=', condition.value)
          break
        case 'like':
          query = query.where(condition.column, 'like', condition.value)
          break
        case 'in':
          query = query.where(condition.column, 'in', condition.value)
          break
        case 'between':
          query = query.where(condition.column, 'between', condition.value)
          break
        case 'isNull':
          query = query.where(condition.column, 'is', null)
          break
        case 'isNotNull':
          query = query.where(condition.column, 'is not', null)
          break
      }
    }
    return query
  }

  private generateCacheKey(databaseId: number, query: CompiledQuery): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${databaseId}:${query.sql}:${JSON.stringify(query.parameters)}`)
      .digest('hex')
    return `query:${hash}`
  }

  private generateRawCacheKey(databaseId: number, sql: string, params?: any[]): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${databaseId}:${sql}:${JSON.stringify(params || [])}`)
      .digest('hex')
    return `raw:${hash}`
  }
}

// Types
interface SelectConfig {
  databaseId: number
  table: string
  columns?: string[]
  where?: WhereCondition[]
  joins?: JoinConfig[]
  orderBy?: OrderByConfig[]
  limit?: number
  offset?: number
  cacheTTL?: number
}

interface WhereCondition {
  column: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between' | 'isNull' | 'isNotNull'
  value?: any
}

interface JoinConfig {
  type: 'inner' | 'left' | 'right'
  table: string
  on: [string, string, string] // [leftColumn, operator, rightColumn]
}

interface OrderByConfig {
  column: string
  direction: 'asc' | 'desc'
}

interface RawQueryConfig {
  databaseId: number
  sql: string
  params?: any[]
  cacheTTL?: number
}
```

### Phase 5: 캐싱 시스템 (Week 5-6)

#### 5.1 Cache Service 구현
```typescript
// cache/cache.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'
import { CacheOptions, CacheEntry, CacheInfo } from './cache.types'
import { compress, decompress } from 'lz-string'

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  }

  constructor(private config: CacheConfig) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      keyPrefix: 'vanillameta:',
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    })
  }

  async onModuleInit(): Promise<void> {
    await this.redis.ping()
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit()
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key)
      
      if (!value) {
        this.stats.misses++
        return null
      }
      
      this.stats.hits++
      
      // Decompress if needed
      const data = value.startsWith('LZ:') 
        ? decompress(value.substring(3))
        : value
      
      return JSON.parse(data)
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || this.config.defaultTTL
      let data = JSON.stringify(value)
      
      // Compress if large
      if (data.length > 1024 && options?.compress !== false) {
        data = 'LZ:' + compress(data)
      }
      
      if (ttl > 0) {
        await this.redis.setex(key, ttl, data)
      } else {
        await this.redis.set(key, data)
      }
      
      // Tag support
      if (options?.tags && options.tags.length > 0) {
        await this.tagKey(key, options.tags)
      }
      
      this.stats.sets++
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error)
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key)
      this.stats.deletes++
      return result === 1
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error)
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key)
      return result === 1
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error)
      return false
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.mget(...keys)
      
      return values.map((value, index) => {
        if (!value) {
          this.stats.misses++
          return null
        }
        
        this.stats.hits++
        
        try {
          const data = value.startsWith('LZ:')
            ? decompress(value.substring(3))
            : value
          return JSON.parse(data)
        } catch {
          return null
        }
      })
    } catch (error) {
      console.error('Cache mget error:', error)
      return keys.map(() => null)
    }
  }

  async mset<T>(entries: CacheEntry<T>[]): Promise<void> {
    const pipeline = this.redis.pipeline()
    
    for (const entry of entries) {
      const ttl = entry.options?.ttl || this.config.defaultTTL
      let data = JSON.stringify(entry.value)
      
      if (data.length > 1024 && entry.options?.compress !== false) {
        data = 'LZ:' + compress(data)
      }
      
      if (ttl > 0) {
        pipeline.setex(entry.key, ttl, data)
      } else {
        pipeline.set(entry.key, data)
      }
      
      if (entry.options?.tags) {
        for (const tag of entry.options.tags) {
          pipeline.sadd(`tag:${tag}`, entry.key)
        }
      }
    }
    
    await pipeline.exec()
    this.stats.sets += entries.length
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      // Use SCAN for production-safe key retrieval
      const keys: string[] = []
      let cursor = '0'
      
      do {
        const [newCursor, foundKeys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        )
        cursor = newCursor
        keys.push(...foundKeys)
      } while (cursor !== '0')
      
      return keys
    } catch (error) {
      console.error('Cache keys error:', error)
      return []
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern)
      
      if (keys.length === 0) {
        return 0
      }
      
      const result = await this.redis.del(...keys)
      this.stats.deletes += result
      return result
    } catch (error) {
      console.error('Cache deletePattern error:', error)
      return 0
    }
  }

  async deleteByTag(tag: string): Promise<number> {
    try {
      const keys = await this.redis.smembers(`tag:${tag}`)
      
      if (keys.length === 0) {
        return 0
      }
      
      const pipeline = this.redis.pipeline()
      
      for (const key of keys) {
        pipeline.del(key)
      }
      pipeline.del(`tag:${tag}`)
      
      await pipeline.exec()
      this.stats.deletes += keys.length
      return keys.length
    } catch (error) {
      console.error('Cache deleteByTag error:', error)
      return 0
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb()
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  async size(): Promise<number> {
    try {
      return await this.redis.dbsize()
    } catch (error) {
      console.error('Cache size error:', error)
      return 0
    }
  }

  async info(): Promise<CacheInfo> {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      size: await this.size(),
      memory: await this.getMemoryUsage()
    }
  }

  private async tagKey(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline()
    
    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key)
    }
    
    await pipeline.exec()
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      const info = await this.redis.info('memory')
      const match = info.match(/used_memory:(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    } catch {
      return 0
    }
  }
}
```

## 마이그레이션 전략

### 1. 점진적 마이그레이션

#### 1.1 Feature Flag 설정
```typescript
// config/feature-flags.ts
export enum FeatureFlag {
  USE_KYSELY_CONNECTION = 'use_kysely_connection',
  USE_QUERY_CACHE = 'use_query_cache',
  USE_QUERY_OPTIMIZER = 'use_query_optimizer'
}

@Injectable()
export class FeatureFlagService {
  private flags = new Map<string, boolean>([
    [FeatureFlag.USE_KYSELY_CONNECTION, false],
    [FeatureFlag.USE_QUERY_CACHE, false],
    [FeatureFlag.USE_QUERY_OPTIMIZER, false]
  ])

  isEnabled(flag: FeatureFlag): boolean {
    return this.flags.get(flag) || false
  }

  enable(flag: FeatureFlag): void {
    this.flags.set(flag, true)
  }

  disable(flag: FeatureFlag): void {
    this.flags.set(flag, false)
  }
}
```

#### 1.2 서비스 래퍼
```typescript
// dataset/dataset.service.wrapper.ts
@Injectable()
export class DatasetServiceWrapper {
  constructor(
    private legacyService: DatasetService,
    private v2Service: DatasetServiceV2,
    private featureFlags: FeatureFlagService
  ) {}

  async create(dto: CreateDatasetDto): Promise<any> {
    if (this.featureFlags.isEnabled(FeatureFlag.USE_KYSELY_CONNECTION)) {
      return this.v2Service.create(dto)
    }
    return this.legacyService.create(dto)
  }

  async findAll(): Promise<any> {
    if (this.featureFlags.isEnabled(FeatureFlag.USE_KYSELY_CONNECTION)) {
      return this.v2Service.findAll()
    }
    return this.legacyService.findAll()
  }

  // ... 다른 메서드들
}
```

### 2. 데이터베이스별 마이그레이션 순서

1. **Phase 1**: PostgreSQL, MySQL (Week 1-2)
   - 가장 많이 사용되는 데이터베이스
   - Kysely 공식 지원

2. **Phase 2**: SQLite, SQL Server (Week 3)
   - 중간 복잡도
   - 부분적 Kysely 지원

3. **Phase 3**: BigQuery, Snowflake (Week 4-5)
   - 클라우드 데이터베이스
   - 커스텀 어댑터 필요

4. **Phase 4**: Oracle, CockroachDB, Redshift (Week 6)
   - 특수 케이스
   - 완전 커스텀 구현

## 테스트 전략

### 1. 단위 테스트

```typescript
// tests/unit/query-builder.service.spec.ts
describe('QueryBuilderService', () => {
  let service: QueryBuilderService
  let connectionManager: MockConnectionManager
  let cacheService: MockCacheService

  beforeEach(() => {
    connectionManager = new MockConnectionManager()
    cacheService = new MockCacheService()
    service = new QueryBuilderService(
      connectionManager,
      cacheService,
      new QueryOptimizer(),
      new QueryExecutor()
    )
  })

  describe('select', () => {
    it('should build simple select query', async () => {
      const config: SelectConfig = {
        databaseId: 1,
        table: 'users',
        columns: ['id', 'name', 'email']
      }

      const result = await service.select(config)

      expect(result.rows).toHaveLength(3)
      expect(result.fields).toEqual([
        { name: 'id', dataType: 'integer', nullable: false },
        { name: 'name', dataType: 'varchar', nullable: false },
        { name: 'email', dataType: 'varchar', nullable: false }
      ])
    })

    it('should use cache when available', async () => {
      const config: SelectConfig = {
        databaseId: 1,
        table: 'users',
        cacheTTL: 300
      }

      // First call
      await service.select(config)
      
      // Second call should hit cache
      const result = await service.select(config)

      expect(result.cached).toBe(true)
      expect(cacheService.getCallCount).toBe(2)
      expect(cacheService.setCallCount).toBe(1)
    })
  })
})
```

### 2. 통합 테스트

```typescript
// tests/integration/postgresql.adapter.spec.ts
describe('PostgreSQLAdapter Integration', () => {
  let adapter: PostgreSQLAdapter
  let testDb: Kysely<TestDatabase>

  beforeAll(async () => {
    adapter = new PostgreSQLAdapter({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test'
    })
    
    await adapter.connect()
    testDb = adapter.getDb()
    
    // Setup test schema
    await testDb.schema
      .createTable('test_users')
      .addColumn('id', 'serial', col => col.primaryKey())
      .addColumn('name', 'varchar(255)', col => col.notNull())
      .addColumn('email', 'varchar(255)', col => col.unique())
      .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .execute()
  })

  afterAll(async () => {
    await testDb.schema.dropTable('test_users').execute()
    await adapter.disconnect()
  })

  it('should execute select query', async () => {
    // Insert test data
    await testDb
      .insertInto('test_users')
      .values([
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'jane@example.com' }
      ])
      .execute()

    // Test select
    const query = testDb
      .selectFrom('test_users')
      .select(['id', 'name', 'email'])
      .where('name', 'like', '%John%')
      .compile()

    const result = await adapter.executeQuery(query)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].name).toBe('John Doe')
    expect(result.executionTime).toBeLessThan(100)
  })

  it('should handle transactions', async () => {
    const result = await adapter.transaction(async (trx) => {
      await trx
        .insertInto('test_users')
        .values({ name: 'Transaction Test', email: 'tx@example.com' })
        .execute()

      const users = await trx
        .selectFrom('test_users')
        .select('id')
        .where('email', '=', 'tx@example.com')
        .execute()

      return users[0]
    })

    expect(result).toBeDefined()
    expect(result.id).toBeGreaterThan(0)
  })
})
```

### 3. 성능 테스트

```typescript
// tests/performance/benchmark.spec.ts
describe('Performance Benchmarks', () => {
  let legacyService: DatasetService
  let v2Service: DatasetServiceV2

  beforeAll(async () => {
    // Setup services
  })

  it('should improve query performance', async () => {
    const iterations = 100
    const query = 'SELECT * FROM large_table WHERE status = ? LIMIT 1000'

    // Legacy benchmark
    const legacyStart = Date.now()
    for (let i = 0; i < iterations; i++) {
      await legacyService.executeQuery({
        id: 1,
        query,
        params: ['active']
      })
    }
    const legacyTime = Date.now() - legacyStart

    // V2 benchmark
    const v2Start = Date.now()
    for (let i = 0; i < iterations; i++) {
      await v2Service.executeQuery({
        databaseId: 1,
        sql: query,
        params: ['active']
      })
    }
    const v2Time = Date.now() - v2Start

    console.log(`Legacy: ${legacyTime}ms, V2: ${v2Time}ms`)
    console.log(`Improvement: ${((legacyTime - v2Time) / legacyTime * 100).toFixed(2)}%`)

    expect(v2Time).toBeLessThan(legacyTime * 0.7) // Expect 30% improvement
  })
})
```

## 모니터링 및 디버깅

### 1. 쿼리 로깅

```typescript
// interceptors/query-logging.interceptor.ts
@Injectable()
export class QueryLoggingInterceptor implements NestInterceptor {
  private logger = new Logger('QueryLogging')

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const method = context.getHandler().name
    const className = context.getClass().name

    return next.handle().pipe(
      tap({
        next: (data) => {
          if (data?.query && data?.executionTime) {
            this.logger.log({
              className,
              method,
              query: data.query.substring(0, 100),
              executionTime: data.executionTime,
              cached: data.cached || false,
              userId: request.user?.id
            })
          }
        },
        error: (error) => {
          this.logger.error({
            className,
            method,
            error: error.message,
            stack: error.stack,
            userId: request.user?.id
          })
        }
      })
    )
  }
}
```

### 2. 성능 메트릭

```typescript
// monitoring/metrics.service.ts
import { Injectable } from '@nestjs/common'
import { register, Counter, Histogram, Gauge } from 'prom-client'

@Injectable()
export class MetricsService {
  private queryCounter: Counter<string>
  private queryDuration: Histogram<string>
  private connectionPoolSize: Gauge<string>
  private cacheHitRate: Gauge<string>

  constructor() {
    this.queryCounter = new Counter({
      name: 'db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['database', 'operation', 'status']
    })

    this.queryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['database', 'operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
    })

    this.connectionPoolSize = new Gauge({
      name: 'db_connection_pool_size',
      help: 'Current size of connection pool',
      labelNames: ['database', 'state']
    })

    this.cacheHitRate = new Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate',
      labelNames: ['cache_type']
    })

    register.registerMetric(this.queryCounter)
    register.registerMetric(this.queryDuration)
    register.registerMetric(this.connectionPoolSize)
    register.registerMetric(this.cacheHitRate)
  }

  recordQuery(database: string, operation: string, duration: number, status: 'success' | 'error') {
    this.queryCounter.inc({ database, operation, status })
    this.queryDuration.observe({ database, operation }, duration / 1000)
  }

  updateConnectionPool(database: string, active: number, idle: number, waiting: number) {
    this.connectionPoolSize.set({ database, state: 'active' }, active)
    this.connectionPoolSize.set({ database, state: 'idle' }, idle)
    this.connectionPoolSize.set({ database, state: 'waiting' }, waiting)
  }

  updateCacheHitRate(hitRate: number) {
    this.cacheHitRate.set({ cache_type: 'query' }, hitRate)
  }

  getMetrics(): Promise<string> {
    return register.metrics()
  }
}
```

### 3. 디버깅 도구

```typescript
// debug/query-debugger.ts
@Injectable()
export class QueryDebugger {
  private debugMode = process.env.NODE_ENV === 'development'

  async explainQuery(adapter: IDatabaseAdapter, query: CompiledQuery): Promise<ExplainResult> {
    if (!this.debugMode) {
      throw new Error('Query debugging is only available in development mode')
    }

    const explainQuery = `EXPLAIN ANALYZE ${query.sql}`
    const result = await adapter.executeRaw(explainQuery, query.parameters)

    return this.parseExplainResult(result.rows)
  }

  async profileQuery(adapter: IDatabaseAdapter, query: CompiledQuery): Promise<ProfileResult> {
    const iterations = 10
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint()
      await adapter.executeQuery(query)
      const end = process.hrtime.bigint()
      times.push(Number(end - start) / 1_000_000) // Convert to ms
    }

    return {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b) / times.length,
      median: this.median(times),
      p95: this.percentile(times, 95),
      p99: this.percentile(times, 99)
    }
  }

  private parseExplainResult(rows: any[]): ExplainResult {
    // Database-specific parsing logic
    return {
      plan: rows,
      estimatedCost: 0,
      actualTime: 0,
      buffers: {
        shared: { hit: 0, read: 0 },
        local: { hit: 0, read: 0 }
      }
    }
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[index]
  }
}
```

## 체크리스트

### Pre-Migration
- [ ] 현재 시스템 백업
- [ ] 성능 베이스라인 측정
- [ ] 의존성 분석 완료
- [ ] 테스트 환경 구축

### Migration Phase 1
- [ ] Kysely 설치 및 설정
- [ ] PostgreSQL 어댑터 구현
- [ ] MySQL 어댑터 구현
- [ ] Connection Manager 구현
- [ ] 기본 테스트 통과

### Migration Phase 2
- [ ] Query Builder Service 구현
- [ ] Cache Service 구현
- [ ] Feature Flag 시스템 구축
- [ ] DatasetService V2 구현
- [ ] 통합 테스트 통과

### Migration Phase 3
- [ ] 추가 데이터베이스 어댑터
- [ ] Query Optimizer 구현
- [ ] 모니터링 시스템 구축
- [ ] 성능 테스트 완료

### Post-Migration
- [ ] 레거시 코드 제거
- [ ] 문서 업데이트
- [ ] 팀 교육 완료
- [ ] 프로덕션 배포

## 결론

이 구현 가이드는 VanillaMeta의 SQL 처리 시스템을 Kysely 기반으로 전환하는 상세한 로드맵을 제공합니다. 점진적 마이그레이션 전략을 통해 리스크를 최소화하면서도 즉각적인 성능 향상을 달성할 수 있습니다.