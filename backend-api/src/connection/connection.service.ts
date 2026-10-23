import { User } from '../user/entities/user.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { serializeMetadataWork } from '../common/metadata-work';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { CreateDatabaseDto } from '../database/dto/create-database.dto';
import { QueryExecuteDto } from '../database/dto/query-execute.dto';
import { Knex, knex } from 'knex';
import { FieldTypeUtil } from '../utils/field-type.util';
import { Database } from '../database/entities/database.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { SnowflakeDialect } from './knex-dialects/snowflake';
import { CustomLoggerService } from '../common/logger/logger.service';
import { SqlValidationService } from '../common/security/sql-validation.service';
import { QueryAnalyzerService } from '../common/monitoring/query-analyzer.service';
import { QueryCollector } from '../common/utils/query-collector';
import { SlowQueryMonitorService } from '../common/monitoring/slow-query-monitor.service';
import { DatabaseOptimizerFactory } from './database-optimizers/database-optimizer-factory';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Transform, Readable, PassThrough } from 'stream';
import { getDatabaseSpecificConfig } from './database-specific.config';
import { KnexQueryMonitor } from '../common/monitoring/knex-query-monitor';

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { createHash } from 'crypto';
import { decryptConnectionConfig } from '../utils/crypto.util';
import { assertReadOnlyQuery } from '../utils/query-guard.util';
import { Redis } from 'ioredis';
import { DuckDBService } from '../analysis/duckdb.service';
import { ProgressGateway } from '../progress/progress.gateway';
import { AsyncLocalStorage } from 'async_hooks';
import { assertNotLocalFileEngine, assertSourceEngineAllowed } from './source-type-policy';

// eslint-disable-next-line @typescript-eslint/no-var-requires -- knex-bigquery는 타입 선언이 없음
const { BigQueryClient } = require('knex-bigquery');

export const knexConnections = new Map<number, Knex>();

/**
 * 쿼리 결과 캐시 백엔드. REDIS_URL 설정 시 Redis(PX TTL), 아니면 인메모리 Map.
 * 분산 배포에서 인스턴스 간 캐시 공유가 필요하면 REDIS_URL을 사용한다.
 */
interface QueryCache {
  get(key: string): Promise<any | undefined>;
  set(key: string, value: any, ttlMs: number): Promise<void>;
}

class MemoryQueryCache implements QueryCache {
  private store = new Map<string, { value: any; expiresAt: number }>();
  async get(key: string) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }
  async set(key: string, value: any, ttlMs: number) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

class RedisQueryCache implements QueryCache {
  private client: Redis;
  constructor(url: string) {
    this.client = new Redis(url, { maxRetriesPerRequest: 1 });
    this.client.on('error', e => console.warn('[query-cache] redis error:', e.message));
  }
  async get(key: string) {
    try {
      const raw = await this.client.get(`vm:q:${key}`);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined; // Redis 장애 시 캐시 미사용으로 degrade
    }
  }
  async set(key: string, value: any, ttlMs: number) {
    try {
      await this.client.set(`vm:q:${key}`, JSON.stringify(value), 'PX', ttlMs);
    } catch {
      /* 캐시 기록 실패는 무시 */
    }
  }
}

const queryCache: QueryCache = process.env.REDIS_URL
  ? new RedisQueryCache(process.env.REDIS_URL)
  : new MemoryQueryCache();

@Injectable()
export class ConnectionService {
  private readonly request?: Request;
  private readonly duckDBSnapshots = new AsyncLocalStorage<Map<number, Record<string, any>>>();

  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    private readonly progressGateway: ProgressGateway,
    private readonly duckdbService?: DuckDBService,
    @Optional() private readonly logger?: CustomLoggerService,
    @Optional() private readonly sqlValidationService?: SqlValidationService,
    @Optional() private readonly queryAnalyzerService?: QueryAnalyzerService,
    @Optional() private readonly queryCollector: QueryCollector = new QueryCollector(),
    @Optional() private readonly slowQueryMonitorService?: SlowQueryMonitorService,
    @Optional() private readonly databaseOptimizerFactory?: DatabaseOptimizerFactory,
    @Optional() private readonly knexQueryMonitor?: KnexQueryMonitor,
    @Optional() private readonly sourceAccess?: SourceAccessService,
  ) {}

  /**
   * Knex 객체 생성 후 pool에 추가
   * @param id - 데이터베이스 ID
   * @param options - Knex 설정 옵션
   */
  addKnex(id: number, options: Knex.Config) {
    if (!this.hasKnex(id)) {
      const environment = process.env.NODE_ENV || 'dev';
      const databaseType = typeof options.client === 'string' ? options.client : 'unknown';

      // 데이터베이스별 특화 설정 적용
      const dbSpecificConfig = getDatabaseSpecificConfig(databaseType);
      const optimizer = this.databaseOptimizerFactory?.getOptimizer(databaseType);

      // 기본 최적화된 설정 + DB별 특화 설정 결합
      let optimizedOptions: Knex.Config = {
        ...options,
        pool: {
          min: 0, // Lambda에서는 0으로 시작
          max: parseInt(process.env.KNEX_POOL_MAX) || 3, // 기본값
          createTimeoutMillis: 30000,
          acquireTimeoutMillis: 30000,
          idleTimeoutMillis: 30000,
          reapIntervalMillis: 1000,
          createRetryIntervalMillis: 100,
          propagateCreateError: false,
        },
        acquireConnectionTimeout: 30000,
      };

      // DB별 특화 설정이 있으면 적용
      if (dbSpecificConfig) {
        optimizedOptions = {
          ...optimizedOptions,
          ...dbSpecificConfig.connectionConfig,
          // 연결 풀 설정 병합
          pool: {
            ...optimizedOptions.pool,
            ...dbSpecificConfig.connectionConfig.pool,
            // Lambda 환경에서는 최대 연결 수 제한
            max: Math.min(
              dbSpecificConfig.performanceSettings.maxConnections,
              parseInt(process.env.KNEX_POOL_MAX) || 3,
            ),
          },
          // 연결 설정 병합
          connection: {
            ...((dbSpecificConfig.connectionConfig.connection as any) || {}),
            ...((options.connection as any) || {}),
          },
        };

        this.logger?.info('Applied database-specific optimizations', 'ConnectionService', {
          databaseId: id,
          databaseType,
          batchSize: dbSpecificConfig.performanceSettings.batchSize,
          maxConnections: dbSpecificConfig.performanceSettings.maxConnections,
          features: dbSpecificConfig.features,
        });
      }

      // 옵티마이저를 통한 추가 최적화
      if (optimizer) {
        const optimized = optimizer.getOptimizedConnectionConfig(
          optimizedOptions.connection,
          environment,
        );
        optimizedOptions = {
          ...optimizedOptions,
          ...optimized,
          pool: {
            ...optimizedOptions.pool,
            ...optimized.pool,
            max: Math.min(
              optimizedOptions.pool.max,
              optimized.pool?.max ?? optimizedOptions.pool.max,
            ),
          },
        };

        this.logger?.info('Applied optimizer-specific configurations', 'ConnectionService', {
          databaseId: id,
          optimizerType: optimizer.getDatabaseType(),
        });
      }

      this.logger?.info(
        'Creating Knex connection with database-specific optimizations',
        'ConnectionService',
        {
          databaseId: id,
          databaseType,
          environment,
          client: options.client,
          optimized: this.databaseOptimizerFactory?.isSupported(databaseType),
          poolSettings: optimizedOptions.pool,
          hasOptimizer: !!optimizer,
          hasDbSpecificConfig: !!dbSpecificConfig,
        },
      );

      const knexInstance = knex(optimizedOptions);
      knexConnections.set(id, knexInstance);

      // Knex 쿼리 모니터링 연결
      this.knexQueryMonitor?.attachToKnex(knexInstance, id, databaseType);

      // 최적화 통계 로깅
      const stats = this.databaseOptimizerFactory?.getOptimizationStats();
      this.logger?.debug('Database optimization stats', 'ConnectionService', stats);
    }
  }

  /**
   * Knex 객체 pool에서 삭제
   * @param id
   */
  async removeKnex(id: number) {
    const old = knexConnections.get(id);
    knexConnections.delete(id);
    if (old) await old.destroy();
  }

  /**
   * Knex 객체 pool 안에 존재 유무
   * @param id
   */
  hasKnex(id: number): boolean {
    return knexConnections.has(id);
  }

  /**
   * Knex 객체 가져오기 - 만약 없으면 가져오기
   * @param id
   */
  async getKnex(id: number | string): Promise<Knex> {
    id = this.validateId(id);
    const knexConfig = await this.getConnectionConfig(id);
    if (!this.hasKnex(id)) {
      if (knexConfig['client'] == 'bigquery') {
        knexConfig['client'] = BigQueryClient;
      } else if (knexConfig['client'] == 'snowflake') {
        knexConfig['client'] = SnowflakeDialect;
      }
      this.addKnex(id, knexConfig as Knex.Config);
    }
    return knexConnections.get(id);
  }

  /**
   * 데이터베이스 연결 설정 복호화 조회
   */
  private async getConnectionConfig(id: number | string) {
    const databaseId = this.validateId(id);
    const snapshot = this.duckDBSnapshots.getStore()?.get(databaseId);
    if (snapshot) return snapshot;
    const one = await this.databaseRepository.findOne({ where: { id: databaseId } });
    if (!one) throw new NotFoundException('database not found');
    // Sources saved before a restriction was set must not open sockets either.
    const config = JSON.parse(decryptConnectionConfig(one.connectionConfig));
    assertSourceEngineAllowed(config?.client ?? one.engine);
    return config;
  }

  /** UC052: capture committed configuration without retaining the metadata lease during SQL.
   * Always read fresh metadata, even inside an older pinned snapshot. The returned capability
   * stays internal; callers must authorize before capture and recheck before returning results.
   */
  async captureDuckDBSnapshot(id: number) {
    const databaseId = this.validateId(id);
    const config = await serializeMetadataWork(
      this.databaseRepository.manager.connection,
      async () => {
        const source = await this.databaseRepository.findOne({ where: { id: databaseId } });
        if (!source) throw new NotFoundException('database not found');
        const value = JSON.parse(decryptConnectionConfig(source.connectionConfig));
        if (value.client !== 'duckdb') throw new BadRequestException('not a DuckDB source');
        return value;
      },
    );
    const pinned = new Map(this.duckDBSnapshots.getStore());
    pinned.set(databaseId, config);
    return {
      run: <T>(callback: () => Promise<T>): Promise<T> =>
        this.duckDBSnapshots.run(pinned, callback),
    };
  }

  /** Pin the selected immutable file for every query in this async operation. */
  async withDuckDBSnapshot<T>(id: number, callback: () => T | Promise<T>): Promise<T> {
    const databaseId = this.validateId(id);
    const snapshots = this.duckDBSnapshots.getStore();
    if (snapshots?.has(databaseId)) return callback();
    // A preview must not pin a connection change that another SQLite transaction rolls back.
    // Callers authorize after the capture, so a source that does not exist must look exactly like one the
    // caller may not use (SourceAccessService answers 403 for both); otherwise 404 vs 403 reveals which ids exist.
    const capture = await this.captureDuckDBSnapshot(databaseId).catch(error => {
      if (error instanceof NotFoundException) throw new ForbiddenException('data access denied');
      throw error;
    });
    return capture.run(async () => callback());
  }

  /** Opaque revision of the selected file; respects any active snapshot. */
  async duckDBVersion(id: number): Promise<string> {
    const config = await this.getConnectionConfig(id);
    if (config.client !== 'duckdb') throw new BadRequestException('not a DuckDB source');
    return createHash('sha256').update(config.connection.filename).digest('hex');
  }

  async isDuckDB(id: number) {
    return (await this.getConnectionConfig(id)).client === 'duckdb';
  }

  async queryDuckDB(id: number, sql: string, bindings: any[] = []) {
    const config = await this.getConnectionConfig(id);
    if (config.client !== 'duckdb') throw new BadRequestException('not a DuckDB source');
    return this.duckdbService.query(config.connection.filename, sql, bindings);
  }

  private validateId(id: unknown): number {
    const normalized =
      typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : NaN;
    if (!Number.isSafeInteger(normalized) || normalized <= 0) {
      throw new BadRequestException('invalid database id');
    }
    return normalized;
  }

  /**
   * ClickHouse는 네이티브 드라이버 대신 HTTP 인터페이스(포트 8123)로 실행한다.
   * connectionConfig: { client: 'clickhouse', connection: { host, port, user, password, database, secure? } }
   */
  private async executeClickHouse(connectionConfig: any, query: string) {
    const conn = connectionConfig.connection;
    const protocol = conn.secure ? 'https' : 'http';
    const url = `${protocol}://${conn.host}:${conn.port || 8123}/?database=${encodeURIComponent(
      conn.database || 'default',
    )}`;

    const controller = new AbortController();
    const timeoutMs = parseInt(process.env.QUERY_TIMEOUT_MS) || 60000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-ClickHouse-User': conn.user || 'default',
          'X-ClickHouse-Key': conn.password || '',
        },
        body: `${query}\nFORMAT JSON`,
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text();
        return { status: ResponseStatus.ERROR, message: body.slice(0, 500), datas: [], fields: [] };
      }
      const json = await response.json();
      const datas = json.data ?? [];
      const fields = (json.meta ?? []).map((m: any) => ({
        columnName: m.name,
        columnType: FieldTypeUtil.FieldType(datas.slice(0, 100).map((r: any) => r[m.name])),
      }));
      return { status: ResponseStatus.SUCCESS, message: 'success', datas, fields };
    } catch (e) {
      console.log(e);
      return {
        status: ResponseStatus.ERROR,
        message: e.message || 'clickhouse query failed',
        datas: [],
        fields: [],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Trino는 네이티브 드라이버 대신 HTTP 인터페이스(포트 8080)로 실행한다.
   * POST /v1/statement 후 nextUri를 따라가며 결과를 누적한다.
   * connectionConfig: { client: 'trino', connection: { host, port, user, password, database(catalog), schema?, secure? } }
   */
  private async executeTrino(connectionConfig: any, query: string) {
    const conn = connectionConfig.connection;
    const protocol = conn.secure ? 'https' : 'http';
    const baseUrl = `${protocol}://${conn.host}:${conn.port || 8080}`;
    const headers: Record<string, string> = {
      'X-Trino-User': conn.user || 'trino',
    };
    if (conn.database) headers['X-Trino-Catalog'] = conn.database;
    if (conn.schema) headers['X-Trino-Schema'] = conn.schema;
    if (conn.password) {
      headers['Authorization'] =
        'Basic ' + Buffer.from(`${conn.user || 'trino'}:${conn.password}`).toString('base64');
    }

    const timeoutMs = parseInt(process.env.QUERY_TIMEOUT_MS) || 60000;
    const deadline = Date.now() + timeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const datas: any[] = [];
    const fields = [];
    try {
      let nextUri: string | null = `${baseUrl}/v1/statement`;
      let method = 'POST';
      let body: string | undefined = query;
      let columns: any[] = null;
      for (let i = 0; nextUri && i < 200; i++) {
        if (Date.now() > deadline) throw new Error('trino query timeout');
        const response = await fetch(nextUri, {
          method,
          headers,
          body,
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok || json.error) {
          return {
            status: ResponseStatus.ERROR,
            message: (json.error?.message || json.message || 'trino query failed').slice(0, 500),
            datas: [],
            fields: [],
          };
        }
        if (json.columns && !columns) columns = json.columns;
        if (json.data) datas.push(...json.data);
        nextUri = json.nextUri || null;
        method = 'GET';
        body = undefined;
      }
      if (!columns) {
        return { status: ResponseStatus.SUCCESS, message: 'success', datas: [], fields: [] };
      }
      // trino data는 컬럼 순서의 배열 — 객체 행으로 변환
      const names = columns.map((c: any) => c.name);
      const rows = datas.map(r => Object.fromEntries(names.map((n, i) => [n, r[i]])));
      for (const name of names) {
        fields.push({
          columnName: name,
          columnType: FieldTypeUtil.FieldType(rows.slice(0, 100).map(r => r[name])),
        });
      }
      return { status: ResponseStatus.SUCCESS, message: 'success', datas: rows, fields };
    } catch (e) {
      console.log(e);
      return {
        status: ResponseStatus.ERROR,
        message: e.message || 'trino query failed',
        datas: [],
        fields: [],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Databricks SQL은 Statement Execution API(HTTPS 443)로 실행한다.
   * POST /api/2.0/sql/statements → status.state가 SUCCEEDED일 때까지 result GET 폴링.
   * connectionConfig: { client: 'databricks', connection: { host, token|password, warehouseId|database, catalog?, schema? } }
   */
  private async executeDatabricks(connectionConfig: any, query: string) {
    const conn = connectionConfig.connection;
    const host = (conn.host || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const token = conn.token || conn.password;
    const warehouseId = conn.warehouseId || conn.database;
    if (!host || !token || !warehouseId) {
      return {
        status: ResponseStatus.ERROR,
        message: 'host, token, warehouseId는 필수입니다.',
        datas: [],
        fields: [],
      };
    }
    const baseUrl = `https://${host}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const timeoutMs = parseInt(process.env.QUERY_TIMEOUT_MS) || 60000;
    const deadline = Date.now() + timeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const createRes = await fetch(`${baseUrl}/api/2.0/sql/statements`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          statement: query,
          warehouse_id: warehouseId,
          catalog: conn.catalog,
          schema: conn.schema,
          wait_timeout: '30s',
          disposition: 'INLINE',
          format: 'JSON_ARRAY',
        }),
        signal: controller.signal,
      });
      let json = await createRes.json();
      const statementId = json.statement_id;

      // PENDING/RUNNING이면 폴링
      for (let i = 0; i < 120 && statementId; i++) {
        const state = json.status?.state;
        if (
          state === 'SUCCEEDED' ||
          state === 'FAILED' ||
          state === 'CANCELED' ||
          state === 'CLOSED'
        )
          break;
        if (Date.now() > deadline) throw new Error('databricks query timeout');
        await new Promise(r => setTimeout(r, 1000));
        const pollRes = await fetch(`${baseUrl}/api/2.0/sql/statements/${statementId}`, {
          headers,
          signal: controller.signal,
        });
        json = await pollRes.json();
      }

      if (json.status?.state !== 'SUCCEEDED') {
        const msg =
          json.status?.error?.message || json.message || `query ${json.status?.state || 'failed'}`;
        return {
          status: ResponseStatus.ERROR,
          message: String(msg).slice(0, 500),
          datas: [],
          fields: [],
        };
      }

      // INLINE JSON_ARRAY: result.data_array + manifest.schema.columns
      const columns = json.manifest?.schema?.columns ?? [];
      const rawData = json.result?.data_array ?? [];
      const names = columns.map((c: any) => c.name);
      const datas = rawData.map(r => Object.fromEntries(names.map((n, i) => [n, r[i]])));
      const fields = names.map(name => ({
        columnName: name,
        columnType: FieldTypeUtil.FieldType(datas.slice(0, 100).map(r => r[name])),
      }));
      return { status: ResponseStatus.SUCCESS, message: 'success', datas, fields };
    } catch (e) {
      console.log(e);
      return {
        status: ResponseStatus.ERROR,
        message: e.message || 'databricks query failed',
        datas: [],
        fields: [],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 데이터베이스 연결 테스트
   * @param createDatabaseDto
   */
  async testConnection(createDatabaseDto: CreateDatabaseDto) {
    assertSourceEngineAllowed(createDatabaseDto.engine);
    assertNotLocalFileEngine(createDatabaseDto.engine);
    if (['clickhouse', 'trino', 'databricks'].includes(createDatabaseDto.engine)) {
      const executors = {
        clickhouse: this.executeClickHouse,
        trino: this.executeTrino,
        databricks: this.executeDatabricks,
      };
      const executor = executors[createDatabaseDto.engine];
      const result = await executor.call(
        this,
        { connection: createDatabaseDto.connectionConfig },
        'SELECT 1',
      );
      if (result.status === ResponseStatus.SUCCESS) {
        return { status: ResponseStatus.SUCCESS, data: { message: 'success' } };
      }
      return { status: ResponseStatus.ERROR, message: result.message };
    }

    let engine: any = createDatabaseDto.engine;
    switch (createDatabaseDto.engine) {
      case 'bigquery':
        engine = BigQueryClient;
        break;
      case 'snowflake':
        engine = SnowflakeDialect;
        break;
    }

    // Parse connectionConfig if it's a string
    let parsedConnectionConfig: any = createDatabaseDto.connectionConfig;
    if (typeof parsedConnectionConfig === 'string') {
      try {
        parsedConnectionConfig = JSON.parse(parsedConnectionConfig);
      } catch (error) {
        parsedConnectionConfig = {};
      }
    }

    if (createDatabaseDto.engine === 'cockroachdb') {
      // URL 인코딩을 통한 보안 강화
      const user = encodeURIComponent(parsedConnectionConfig['user'] || '');
      const password = encodeURIComponent(parsedConnectionConfig['password'] || '');
      const host = encodeURIComponent(parsedConnectionConfig['host'] || 'localhost');
      const port = parsedConnectionConfig['port'] || 26257;
      const database = encodeURIComponent(parsedConnectionConfig['database'] || 'defaultdb');

      const cockroach_url = `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=verify-full&options=--cluster%3Dvanillameta-cockroach-3010`;
      parsedConnectionConfig['connectionString'] = cockroach_url;
    }

    // 데이터베이스별 최적화된 연결 설정 적용
    const environment = process.env.NODE_ENV || 'dev';
    const optimizedConfig = this.databaseOptimizerFactory?.getOptimizedConnectionConfig(
      createDatabaseDto.engine,
      parsedConnectionConfig,
      environment,
    );

    const connectionConfig: Knex.Config = {
      client: engine,
      connection: parsedConnectionConfig,
      useNullAsDefault: true,
      // 테스트 연결을 위한 최소한의 풀 설정 (최적화된 설정 기반)
      pool: {
        ...optimizedConfig?.pool,
        min: 0,
        max: 1, // 테스트용이므로 1개만
        createTimeoutMillis: 10000, // 10초 - 테스트용이므로 짧게
        acquireTimeoutMillis: 10000,
        idleTimeoutMillis: 0, // 즉시 정리
        reapIntervalMillis: 500,
      },
      acquireConnectionTimeout: 10000,
      // 다른 최적화 설정들 적용 (타임아웃 제외)
      debug: optimizedConfig?.debug,
    };

    // createDatabaseDto.connectionConfig = JSON.stringify(connectionConfig);
    // console.log(createDatabaseDto)
    let _knex: Knex;
    let returnObj: { status: ResponseStatus; message?: string; data?: { message: string } } = {
      status: ResponseStatus.ERROR,
    };
    try {
      _knex = knex(connectionConfig as Knex.Config);
    } catch (e) {
      this.logger?.error('Failed to create Knex connection', e.stack, 'ConnectionService', {
        engine: createDatabaseDto.engine,
        connectionConfig:
          typeof createDatabaseDto.connectionConfig === 'string'
            ? 'string-config'
            : createDatabaseDto.connectionConfig,
      });
      return { status: ResponseStatus.ERROR, message: 'knex not connected' };
    }

    const testQuery = createDatabaseDto.engine == 'oracledb' ? 'SELECT 1 FROM DUAL' : 'SELECT 1';

    try {
      await _knex.raw(testQuery);
      returnObj = { status: ResponseStatus.SUCCESS, data: { message: 'success' } };
    } catch (e) {
      this.logger?.error('Database connection test failed', e.stack, 'ConnectionService', {
        engine: createDatabaseDto.engine,
        testQuery: testQuery,
        sqlMessage: e.sqlMessage,
        errorMessage: e.message,
      });
      // 보안: SQL 에러 메시지를 일반화하여 DB 구조 정보 노출 방지
      let safeErrorMessage = '데이터베이스 연결 테스트에 실패했습니다.';

      // 일반적인 연결 오류에 대해서만 구체적인 메시지 제공
      if (e.message?.includes('ECONNREFUSED')) {
        safeErrorMessage = '데이터베이스 서버에 연결할 수 없습니다.';
      } else if (e.message?.includes('ETIMEDOUT')) {
        safeErrorMessage = '연결 시간이 초과되었습니다.';
      } else if (e.message?.includes('Access denied') || e.message?.includes('authentication')) {
        safeErrorMessage = '인증에 실패했습니다. 사용자명과 비밀번호를 확인해주세요.';
      } else if (e.message?.includes('Unknown database')) {
        safeErrorMessage = '데이터베이스를 찾을 수 없습니다.';
      }

      returnObj = { status: ResponseStatus.ERROR, message: safeErrorMessage };
    } finally {
      await _knex.destroy();
    }

    return returnObj;
  }

  /**
   * 쿼리 실행. QUERY_CACHE_TTL_MS>0 이면 동일 (db, 쿼리) 결과를 TTL 캐시
   * @param queryExecuteDto
   * @param userId 사용자 ID (보안 로깅용)
   */
  /** Only an explicit verified request context can opt into shared result caching. */
  async executeQuery(
    queryExecuteDto: QueryExecuteDto,
    clientId?: string,
    authorization?: { actor: number; epoch: number },
  ) {
    queryExecuteDto = { ...queryExecuteDto, id: this.validateId(queryExecuteDto.id) };
    const cacheTtl = parseInt(process.env.QUERY_CACHE_TTL_MS) || 0;
    if (cacheTtl <= 0 || queryExecuteDto.parameters?.length || !authorization || !this.sourceAccess)
      return this.runQuery(queryExecuteDto, clientId);

    assertReadOnlyQuery(queryExecuteDto.query);
    const currentBasis = () =>
      serializeMetadataWork(this.databaseRepository.manager.connection, async () => {
        const { actor, epoch } = authorization;
        if (!Number.isSafeInteger(actor) || actor <= 0 || !Number.isSafeInteger(epoch) || epoch < 0)
          throw new UnauthorizedException('Current actor required.');
        const user = await this.databaseRepository.manager.findOne(User, { where: { id: actor } });
        if (!user || user.active !== true || user.authVersion !== epoch)
          throw new UnauthorizedException('Current actor required.');
        await this.sourceAccess.assert('database', queryExecuteDto.id, actor, 'owner');
        const stored = await this.databaseRepository.findOne({ where: { id: queryExecuteDto.id } });
        if (!stored) throw new NotFoundException('database not found');
        if (stored.ownerId !== actor || stored.catalogActive === false)
          throw new ForbiddenException('Source ownership required.');
        return createHash('sha256')
          .update(
            JSON.stringify([
              actor,
              epoch,
              stored.id,
              stored.ownerId,
              stored.catalogVersion,
              stored.connectionConfig,
            ]),
          )
          .digest('hex');
      });
    const basis = await currentBasis();
    const cacheKey = `${queryExecuteDto.id}:${basis}:${createHash('sha256')
      .update(queryExecuteDto.query)
      .digest('hex')}`;
    const hit = await queryCache.get(cacheKey);
    if (hit !== undefined) {
      if ((await currentBasis()) !== basis) throw new ConflictException('Source changed.');
      return hit;
    }
    const result = await this.runQuery(queryExecuteDto, clientId);
    if ((await currentBasis()) !== basis) throw new ConflictException('Source changed.');
    if (result.status === ResponseStatus.SUCCESS) await queryCache.set(cacheKey, result, cacheTtl);
    return result;
  }

  private async runQuery(queryExecuteDto: QueryExecuteDto, clientId?: string) {
    assertReadOnlyQuery(queryExecuteDto.query);
    const startedAt = Date.now();
    const emit = (phase: string, extra: Record<string, unknown> = {}) =>
      this.progressGateway.emitTo(clientId, 'query:progress', {
        phase,
        elapsedMs: Date.now() - startedAt,
        ...extra,
      });
    emit('running');
    // 장기 실행 쿼리용 진행 틱 (2s 간격)
    const ticker = clientId ? setInterval(() => emit('running'), 2000) : null;
    try {
      const result = await this.runQueryInner(queryExecuteDto);
      emit(result.status === ResponseStatus.SUCCESS ? 'success' : 'error', {
        rows: result?.datas?.length ?? 0,
      });
      return result;
    } catch (e) {
      emit('error', { message: e?.message });
      throw e;
    } finally {
      if (ticker) clearInterval(ticker);
    }
  }

  private async runQueryInner(queryExecuteDto: QueryExecuteDto) {
    // HTTP 인터페이스 엔진(knex 미지원) 분기
    const connectionConfig = await this.getConnectionConfig(queryExecuteDto.id);
    if (connectionConfig?.client === 'duckdb') {
      try {
        const result = await this.duckdbService.query(
          connectionConfig.connection.filename,
          queryExecuteDto.query,
        );
        return { status: ResponseStatus.SUCCESS, message: 'success', ...result };
      } catch (error) {
        return { status: ResponseStatus.ERROR, message: error.message, datas: [], fields: [] };
      }
    }
    if (connectionConfig?.client === 'clickhouse') {
      return this.executeClickHouse(connectionConfig, queryExecuteDto.query);
    }
    if (connectionConfig?.client === 'trino') {
      return this.executeTrino(connectionConfig, queryExecuteDto.query);
    }
    if (connectionConfig?.client === 'databricks') {
      return this.executeDatabricks(connectionConfig, queryExecuteDto.query);
    }

    const knex = await this.getKnex(queryExecuteDto.id);

    // 데이터베이스별 최적화 적용
    const databaseType = knex.client.config.client;
    const optimizer = this.databaseOptimizerFactory?.getOptimizer(databaseType);
    const dbSpecificConfig = getDatabaseSpecificConfig(databaseType);

    let datas = [];
    const fields = [];
    const resultObj = { status: null, message: null, datas: [], fields: [] };
    const startTime = Date.now();
    const sanitizedQuery = queryExecuteDto.query;

    try {
      const timeoutMs = parseInt(process.env.QUERY_TIMEOUT_MS) || 60000;
      const bindings = queryExecuteDto.parameters?.map(param => {
        if (param.type === 'number') {
          const value = Number(param.value);
          if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
            throw new BadRequestException(`Invalid numeric parameter: ${param.name}`);
          return value;
        }
        if (param.type === 'date') {
          const value = new Date(param.value);
          if (
            !Number.isFinite(value.getTime()) ||
            value.getFullYear() < 1900 ||
            value.getFullYear() > 2100
          )
            throw new BadRequestException(`Invalid date parameter: ${param.name}`);
          return value;
        }
        if (param.type === 'boolean') return param.value === 'true' || param.value === '1';
        if (typeof param.value === 'string' && param.value.length > 1000)
          throw new BadRequestException(`Parameter too long: ${param.name}`);
        return param.value;
      });
      let rawQuery = bindings?.length
        ? knex.raw(queryExecuteDto.query, bindings)
        : knex.raw(queryExecuteDto.query);
      try {
        // 일부 드라이버(sqlite, bigquery 등)는 timeout 미지원
        rawQuery = rawQuery.timeout(timeoutMs) as any;
      } catch {
        // timeout 미지원 드라이버는 그대로 실행
      }
      const queryRes = await rawQuery;
      // bigquery, snowflake
      if (typeof knex.client.config.client === 'function') {
        switch (knex.client.config.client.name) {
          case 'SnowflakeDialect':
            if (queryRes && queryRes.rows && queryRes.rows.length > 0) {
              datas = queryRes.rows;
              const tempFields = Object.keys(queryRes.rows[0]);
              tempFields.map(field => {
                const length = [];
                const maxCnt = queryRes.rows.length > 100 ? 100 : queryRes.rows.length;
                for (let i = 0; i < maxCnt; i++) {
                  length.push(queryRes.rows[i][field]);
                }
                const fieldInfo = {
                  columnName: field,
                  columnType: FieldTypeUtil.FieldType(length),
                };
                fields.push(fieldInfo);
              });
            }
            break;
          case 'BigQueryClient':
            if (queryRes && queryRes.length > 0) {
              datas = queryRes;
              const tempFields = Object.keys(queryRes[0]);

              tempFields.map(field => {
                const length = [];
                const maxCnt = queryRes.length > 100 ? 100 : queryRes.length;
                for (let i = 0; i < maxCnt; i++) {
                  length.push(queryRes[i][field]);
                }
                const fieldInfo = {
                  columnName: field,
                  columnType: FieldTypeUtil.FieldType(length),
                };
                fields.push(fieldInfo);
              });
            }
            break;
        }
      } else {
        switch (knex.client.config.client) {
          case 'mysql2':
            if (queryRes && queryRes[0].length > 0) {
              datas = queryRes[0];
              const tempFields = queryRes[1];
              tempFields.map(field => {
                const fieldInfo = {
                  columnName: field.name,
                  columnType: FieldTypeUtil.mysqlFieldType(field.columnType),
                };
                fields.push(fieldInfo);
              });
            }
            break;

          case 'cockroachdb':
          case 'pg':
            if (queryRes && queryRes.rows && queryRes.rows.length > 0) {
              datas = queryRes.rows;
              const tempFields = queryRes.fields;
              tempFields.map(field => {
                const length = [];
                const maxCnt = queryRes.rows.length > 100 ? 100 : queryRes.rows.length;
                for (let i = 0; i < maxCnt; i++) {
                  length.push(queryRes.rows[i][field.name]);
                }
                const fieldInfo = {
                  columnName: field.name,
                  columnType: FieldTypeUtil.FieldType(length),
                };
                fields.push(fieldInfo);
              });
            }
            break;

          // case 'sqlite3':
          // case 'mssql':
          // case 'oracledb':
          default:
            if (queryRes && queryRes.length > 0) {
              datas = queryRes;
              const tempFields = Object.keys(queryRes[0]);

              tempFields.map(field => {
                const length = [];
                const maxCnt = queryRes.length > 100 ? 100 : queryRes.length;
                for (let i = 0; i < maxCnt; i++) {
                  length.push(queryRes[i][field]);
                }
                const fieldInfo = {
                  columnName: field,
                  columnType: FieldTypeUtil.FieldType(length),
                };
                fields.push(fieldInfo);
              });
            }
            break;
        }
      }

      resultObj.status = ResponseStatus.SUCCESS;
      resultObj.message = 'success';
      resultObj.datas = datas;
      resultObj.fields = fields;

      // 실행 시간 측정 및 쿼리 수집
      const executionTime = Date.now() - startTime;
      this.queryCollector.collect(
        sanitizedQuery,
        `database-${queryExecuteDto.id}`,
        queryExecuteDto.parameters?.map(p => p.value),
        executionTime,
      );

      // 슬로우 쿼리 모니터링
      await this.recordSlowQueryMetrics(
        sanitizedQuery,
        executionTime,
        queryExecuteDto,
        undefined,
        datas.length,
      );
    } catch (e) {
      const executionTime = Date.now() - startTime;
      resultObj.status = ResponseStatus.ERROR;

      // 타임아웃 에러 감지 및 사용자 친화적 메시지 제공
      const timeoutMessage = this.detectTimeoutError(e, executionTime);
      if (timeoutMessage) {
        resultObj.message = timeoutMessage;
      } else {
        // 보안: SQL 에러 메시지를 일반화하여 DB 구조 정보 노출 방지
        const errorMsg = e.sqlMessage || e.message || '';

        // 일반적인 SQL 오류를 사용자 친화적 메시지로 변환
        if (errorMsg.includes('syntax error') || errorMsg.includes('Syntax error')) {
          resultObj.message = '쿼리 구문에 오류가 있습니다.';
        } else if (errorMsg.includes('does not exist') || errorMsg.includes("doesn't exist")) {
          resultObj.message = '요청한 리소스를 찾을 수 없습니다.';
        } else if (errorMsg.includes('permission denied') || errorMsg.includes('Access denied')) {
          resultObj.message = '권한이 없습니다.';
        } else if (errorMsg.includes('duplicate key') || errorMsg.includes('Duplicate entry')) {
          resultObj.message = '중복된 데이터가 존재합니다.';
        } else if (errorMsg.includes('foreign key') || errorMsg.includes('Cannot delete')) {
          resultObj.message = '참조 무결성 제약으로 인해 작업을 수행할 수 없습니다.';
        } else if (errorMsg.includes('connection') || errorMsg.includes("Can't connect")) {
          resultObj.message = '데이터베이스 연결에 실패했습니다.';
        } else {
          // 기타 모든 SQL 에러는 일반적인 메시지로 대체
          resultObj.message = '쿼리 실행 중 오류가 발생했습니다.';
        }
      }

      this.logger?.error('Query execution failed', e.stack, 'ConnectionService', {
        databaseId: queryExecuteDto.id,
        query: queryExecuteDto.query?.substring(0, 200) + '...', // 긴 쿼리는 일부만 로깅
        sqlMessage: e.sqlMessage,
        errorMessage: e.message,
        executionTime,
        isTimeout: !!timeoutMessage,
      });

      // 실패한 쿼리도 수집
      this.queryCollector.collect(
        queryExecuteDto.query,
        `database-${queryExecuteDto.id}-error`,
        queryExecuteDto.parameters?.map(p => p.value),
        executionTime,
      );
    }

    return resultObj;
  }

  /**
   * 슬로우 쿼리 메트릭 기록
   */
  private async recordSlowQueryMetrics(
    query: string,
    executionTime: number,
    queryExecuteDto: QueryExecuteDto,
    userId?: string,
    rowCount?: number,
  ): Promise<void> {
    try {
      // 슬로우 쿼리 임계값 확인 (1초 이상)
      if (executionTime >= 1000) {
        // 쿼리 분석 실행
        const analysis = await this.queryAnalyzerService?.analyzeQuery(query, queryExecuteDto.id);
        analysis.executionTime = executionTime;
        analysis.rowsReturned = rowCount;

        // 데이터베이스 정보 조회
        const database = await this.databaseRepository.findOne({
          where: { id: queryExecuteDto.id },
        });

        // 요청 메타데이터 추출
        const metadata = this.extractRequestMetadata(userId);

        // 슬로우 쿼리 로깅
        await this.slowQueryMonitorService.logSlowQuery(analysis, {
          databaseId: queryExecuteDto.id,
          databaseEngine: database?.engine,
          userId,
          requestPath: metadata.requestPath,
          httpMethod: metadata.httpMethod,
          clientIp: metadata.clientIp,
          userAgent: metadata.userAgent,
          requestId: metadata.requestId,
          parameters: queryExecuteDto.parameters?.map(p => p.value),
        });

        // 기존 로깅도 유지
        this.logger?.warn('Slow query detected', 'ConnectionService', {
          databaseId: queryExecuteDto.id,
          executionTime,
          query: query.substring(0, 200),
          rowCount,
          userId,
          requestId: metadata.requestId,
        });
      }
    } catch (error) {
      this.logger?.error('Failed to record slow query metrics', error.stack, 'ConnectionService', {
        databaseId: queryExecuteDto.id,
        executionTime,
        error: error.message,
      });
    }
  }

  /**
   * 요청 메타데이터 추출
   */
  private extractRequestMetadata(userId?: string) {
    const userAgent = this.request?.get?.('User-Agent') || '';
    const clientIp = this.getClientIp();
    const requestId = this.request?.get?.('X-Request-ID') || this.generateRequestId();

    return {
      userId,
      requestPath: this.request?.path || '/api/unknown',
      httpMethod: this.request?.method || 'UNKNOWN',
      clientIp,
      userAgent: userAgent.substring(0, 500), // 길이 제한
      requestId,
    };
  }

  /**
   * 클라이언트 IP 추출
   */
  private getClientIp(): string {
    if (!this.request) return 'unknown';

    return (
      this.request.get?.('X-Forwarded-For')?.split(',')[0] ||
      this.request.get?.('X-Real-IP') ||
      this.request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 타임아웃 에러 감지 및 사용자 친화적 메시지 반환
   * @param error - 발생한 에러 객체
   * @param executionTime - 실행 시간 (ms)
   * @returns 타임아웃 관련 메시지 또는 null
   */
  private detectTimeoutError(error: any, executionTime: number): string | null {
    const errorMessage = error.message?.toLowerCase() || '';
    const sqlMessage = error.sqlMessage?.toLowerCase() || '';
    const errorCode = error.code || error.errno || '';

    // 실행 시간 기반 타임아웃 감지 (25초 이상)
    const isLongRunning = executionTime >= 25000;

    // MySQL/MariaDB 타임아웃 에러
    if (
      errorCode === 'ER_QUERY_TIMEOUT' ||
      errorMessage.includes('query timeout') ||
      errorMessage.includes('max_execution_time') ||
      sqlMessage.includes('query execution was interrupted')
    ) {
      return '쿼리 실행 시간이 25초를 초과하여 중단되었습니다. 쿼리를 최적화하거나 필터 조건을 추가해 주세요.';
    }

    // PostgreSQL 타임아웃 에러
    if (
      errorMessage.includes('statement timeout') ||
      errorMessage.includes('canceling statement due to statement timeout') ||
      errorCode === '57014'
    ) {
      return '쿼리 실행 시간이 허용된 시간을 초과했습니다. 더 구체적인 조건으로 데이터를 필터링해 주세요.';
    }

    // Oracle 타임아웃 에러
    if (
      errorCode === 'ORA-01013' ||
      errorMessage.includes('user requested cancel') ||
      errorMessage.includes('ora-01013')
    ) {
      return '쿼리 실행이 시간 초과로 인해 취소되었습니다. 쿼리 조건을 더 구체적으로 설정해 주세요.';
    }

    // SQL Server 타임아웃 에러
    if (
      errorCode === 'EREQUEST' ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('execution timeout expired') ||
      sqlMessage.includes('timeout period elapsed')
    ) {
      return '쿼리 실행 시간이 초과되었습니다. 검색 범위를 줄이거나 인덱스가 있는 컬럼으로 필터링해 주세요.';
    }

    // BigQuery 타임아웃 에러
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('job exceeded rate limits') ||
      errorMessage.includes('query exceeded resource limits')
    ) {
      return 'BigQuery 쿼리 실행 시간이 초과되었습니다. 더 작은 데이터 범위로 쿼리를 실행해 주세요.';
    }

    // Snowflake 타임아웃 에러
    if (
      errorMessage.includes('statement reached its timeout') ||
      errorMessage.includes('query timeout') ||
      errorCode === '604'
    ) {
      return 'Snowflake 쿼리 실행 시간이 초과되었습니다. 더 효율적인 쿼리로 수정하거나 데이터 범위를 줄여주세요.';
    }

    // 연결 타임아웃 에러
    if (
      errorMessage.includes('connection timeout') ||
      errorMessage.includes('connect timeout') ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ECONNRESET'
    ) {
      return '데이터베이스 연결 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
    }

    // 일반적인 타임아웃 키워드 기반 감지
    if ((errorMessage.includes('timeout') || sqlMessage.includes('timeout')) && isLongRunning) {
      return '쿼리 실행 시간이 허용 시간을 초과했습니다. 쿼리를 단순화하거나 데이터 범위를 제한해 주세요.';
    }

    // Lambda 함수 타임아웃 근처 (28초 이상)
    if (executionTime >= 28000) {
      return '쿼리 실행 시간이 시스템 한계에 근접했습니다. 더 구체적인 조건으로 데이터를 필터링해 주세요.';
    }

    return null;
  }

  /**
   * 비동기 쿼리 분석
   */
  private async analyzeQueryAsync(query: string, databaseId: number): Promise<void> {
    try {
      // 비동기로 쿼리 분석 실행 (응답 지연 방지)
      setImmediate(async () => {
        try {
          const analysis = await this.queryAnalyzerService?.analyzeQuery(query, databaseId);

          if (analysis.optimizationSuggestions && analysis.optimizationSuggestions.length > 0) {
            this.logger?.info('Query optimization opportunities found', 'ConnectionService', {
              databaseId,
              query: query.substring(0, 100),
              suggestions: analysis.optimizationSuggestions,
              scanType: analysis.scanType,
              indexUsed: analysis.indexUsed,
            });
          }
        } catch (error) {
          this.logger?.debug(`Query analysis failed: ${error.message}`, 'ConnectionService');
        }
      });
    } catch (error) {
      // 분석 실패는 무시 (메인 쿼리 실행에 영향 없음)
      this.logger?.debug(
        `Failed to initiate query analysis: ${error.message}`,
        'ConnectionService',
      );
    }
  }

  private streamDuckDBResult(
    queryExecuteDto: QueryExecuteDto,
    filename: string,
    userId: string | undefined,
    chunkSize: number,
  ): Readable {
    const out = new PassThrough();
    const startTime = Date.now();
    void (async () => {
      try {
        const result = await this.duckdbService.query(filename, queryExecuteDto.query);
        const rows: any[] = result?.datas ?? [];
        out.write(JSON.stringify({ type: 'fields', data: result?.fields ?? [] }) + '\n');
        for (let i = 0; i < rows.length; i += chunkSize)
          out.write(JSON.stringify({ type: 'data', data: rows.slice(i, i + chunkSize) }) + '\n');
        out.end(
          JSON.stringify({
            type: 'complete',
            rowCount: rows.length,
            executionTime: Date.now() - startTime,
          }) + '\n',
        );
      } catch (error) {
        this.logger?.warn('DuckDB streaming query failed', 'ConnectionService', {
          databaseId: queryExecuteDto.id,
          userId,
          error: error?.message,
        });
        out.end(
          JSON.stringify({ type: 'error', error: error?.message || 'Query execution error' }) +
            '\n',
        );
      }
    })().catch(() => undefined);
    return out;
  }

  /**
   * 스트리밍 쿼리 실행
   * @param queryExecuteDto 쿼리 실행 DTO
   * @param userId 사용자 ID (보안 로깅용)
   * @param chunkSize 청크 크기 (기본값: 1000)
   * @returns 스트림 객체와 메타데이터
   */
  async executeStreamingQuery(
    queryExecuteDto: QueryExecuteDto,
    userId?: string,
    chunkSize = 1000,
  ): Promise<{
    stream: Readable;
    fields?: any[];
    error?: string;
  }> {
    // 1. SQL 보안 검증
    assertReadOnlyQuery(queryExecuteDto.query);
    const validationResult = this.sqlValidationService.validateQuery(
      queryExecuteDto.query,
      {
        allowDDL: false,
        allowDML: false,
        allowMultipleStatements: false,
        maxQueryLength: 10000,
        // 스트리밍에서는 LIMIT 제한 없음
      },
      userId,
    );

    if (!validationResult.isValid) {
      const errorMessage = this.sqlValidationService.formatValidationError(validationResult);
      this.logger?.warn('SQL validation failed for streaming query', 'ConnectionService', {
        userId,
        query: queryExecuteDto.query.substring(0, 200),
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        riskLevel: validationResult.riskLevel,
      });

      throw new ForbiddenException(`SQL validation failed: ${errorMessage}`);
    }

    // 2. 보안 감사 로그
    this.logger?.info('Streaming SQL query execution approved', 'ConnectionService', {
      userId,
      databaseId: queryExecuteDto.id,
      queryLength: queryExecuteDto.query.length,
      riskLevel: validationResult.riskLevel,
      chunkSize,
    });

    // DuckDB sources (uploaded files) have no knex client. Their result is already bounded by
    // ANALYSIS_MAX_RESULT_ROWS (a larger result is an error, never a silent cut), so it is sent in
    // the same NDJSON frames from the finished result.
    const sourceConfig = await this.getConnectionConfig(queryExecuteDto.id);
    if (sourceConfig?.client === 'duckdb')
      return {
        stream: this.streamDuckDBResult(
          queryExecuteDto,
          sourceConfig.connection.filename,
          userId,
          chunkSize,
        ),
      };

    const knexInstance = await this.getKnex(queryExecuteDto.id);
    const startTime = Date.now();

    // PassThrough 스트림 생성 (Transform 스트림의 한 종류)
    const outputStream = new PassThrough({
      objectMode: false, // NDJSON 포맷을 위해 string mode 사용
    });

    // 필드 정보를 저장할 변수
    let fields = [];
    let firstChunk = true;
    let rowCount = 0;
    let errorOccurred = false;

    try {
      const sanitizedQuery = validationResult.sanitizedQuery || queryExecuteDto.query;

      // 쿼리 실행 계획 분석 (비동기)
      this.analyzeQueryAsync(sanitizedQuery, queryExecuteDto.id);

      // 데이터베이스 타입 확인
      const clientType =
        typeof knexInstance.client.config.client === 'function'
          ? knexInstance.client.config.client.name
          : knexInstance.client.config.client;

      // 데이터베이스별 스트림 설정 최적화
      const streamOptions = this.getStreamOptionsForDatabase(clientType);

      // Knex 스트림 생성
      const queryStream = knexInstance
        .raw(sanitizedQuery)
        .stream(streamOptions) as unknown as NodeJS.ReadableStream;

      // 데이터베이스별 스트림 처리를 위한 Transform 스트림
      const transformStream = new Transform({
        objectMode: true,
        transform: (chunk, encoding, callback) => {
          try {
            // 데이터베이스별 청크 처리
            const processedChunk = this.processChunkByDatabase(chunk, clientType);

            if (!processedChunk) {
              callback();
              return;
            }

            rowCount++;

            // 첫 번째 청크에서 필드 정보 추출
            if (firstChunk && processedChunk) {
              firstChunk = false;

              fields = this.extractFieldsFromChunk(processedChunk, clientType);

              // 필드 정보를 첫 번째 라인으로 전송
              outputStream.push(JSON.stringify({ type: 'fields', data: fields }) + '\n');
            }

            // 데이터 행을 NDJSON 형식으로 변환
            outputStream.push(JSON.stringify({ type: 'data', data: processedChunk }) + '\n');

            // 진행상황 로깅 (매 10000행마다)
            if (rowCount % 10000 === 0) {
              this.logger?.info('Streaming query progress', 'ConnectionService', {
                databaseId: queryExecuteDto.id,
                rowsProcessed: rowCount,
                elapsedTime: Date.now() - startTime,
                databaseType: clientType,
              });
            }

            callback();
          } catch (error) {
            callback(error);
          }
        },
      });

      // 스트림 파이프라인 설정
      queryStream
        .pipe(transformStream)
        .on('error', error => {
          errorOccurred = true;
          this.logger?.error('Stream transformation error', error.stack, 'ConnectionService', {
            databaseId: queryExecuteDto.id,
            rowsProcessed: rowCount,
            error: error.message,
          });

          // 에러 정보를 스트림에 전송
          outputStream.push(
            JSON.stringify({
              type: 'error',
              error: error.message || 'Stream transformation error',
            }) + '\n',
          );
          outputStream.end();
        })
        .on('finish', async () => {
          if (!errorOccurred) {
            const executionTime = Date.now() - startTime;

            // 완료 정보 전송
            outputStream.push(
              JSON.stringify({
                type: 'complete',
                rowCount,
                executionTime,
              }) + '\n',
            );

            // 스트림 종료
            outputStream.end();

            // 쿼리 수집 및 슬로우 쿼리 모니터링
            this.queryCollector.collect(
              sanitizedQuery,
              `database-${queryExecuteDto.id}-stream`,
              queryExecuteDto.parameters?.map(p => p.value),
              executionTime,
            );

            await this.recordSlowQueryMetrics(
              sanitizedQuery,
              executionTime,
              queryExecuteDto,
              userId,
              rowCount,
            );

            this.logger?.info('Streaming query completed', 'ConnectionService', {
              databaseId: queryExecuteDto.id,
              rowCount,
              executionTime,
              throughput: Math.round((rowCount / executionTime) * 1000) + ' rows/sec',
            });
          }
        });

      // 쿼리 스트림 에러 처리
      queryStream.on('error', error => {
        errorOccurred = true;
        const executionTime = Date.now() - startTime;

        // 타임아웃 에러 감지
        const timeoutMessage = this.detectTimeoutError(error, executionTime);
        const errorMessage =
          timeoutMessage || error.sqlMessage || error.message || 'Query execution error';

        this.logger?.error('Query stream error', error.stack, 'ConnectionService', {
          databaseId: queryExecuteDto.id,
          error: error.message,
          sqlMessage: error.sqlMessage,
          executionTime,
          isTimeout: !!timeoutMessage,
        });

        outputStream.push(
          JSON.stringify({
            type: 'error',
            error: errorMessage,
          }) + '\n',
        );
        outputStream.end();
      });

      return {
        stream: outputStream,
        fields,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // 타임아웃 에러 감지
      const timeoutMessage = this.detectTimeoutError(error, executionTime);
      const errorMessage =
        timeoutMessage || error.message || 'Failed to initialize streaming query';

      this.logger?.error('Failed to initialize streaming query', error.stack, 'ConnectionService', {
        databaseId: queryExecuteDto.id,
        query: queryExecuteDto.query?.substring(0, 200),
        error: error.message,
        executionTime,
        isTimeout: !!timeoutMessage,
      });

      // 에러가 발생한 경우에도 스트림 반환 (에러 정보 포함)
      outputStream.push(
        JSON.stringify({
          type: 'error',
          error: errorMessage,
        }) + '\n',
      );
      outputStream.end();

      return {
        stream: outputStream,
        error: errorMessage,
      };
    }
  }

  /**
   * 첫 번째 데이터 청크에서 필드 정보 추출
   */
  private extractFieldsFromChunk(chunk: any, clientType: string): any[] {
    const fields = [];

    if (!chunk || typeof chunk !== 'object') {
      return fields;
    }

    // 객체의 키를 필드로 사용
    const fieldNames = Object.keys(chunk);

    fieldNames.forEach(fieldName => {
      fields.push({
        columnName: fieldName,
        columnType: FieldTypeUtil.FieldType([chunk[fieldName]]),
      });
    });

    return fields;
  }

  /**
   * 데이터베이스별 스트림 옵션 반환
   */
  private getStreamOptionsForDatabase(clientType: string): any {
    switch (clientType) {
      case 'mysql2':
        return {
          highWaterMark: 16 * 1024, // 16KB 청크
          objectMode: true,
        };

      case 'pg':
      case 'cockroachdb':
        return {
          highWaterMark: 64 * 1024, // 64KB 청크 (PostgreSQL은 더 큰 청크 처리 가능)
          objectMode: true,
        };

      case 'oracledb':
        return {
          highWaterMark: 32 * 1024, // 32KB 청크
          objectMode: true,
          fetchArraySize: 1000, // Oracle 특정 옵션
        };

      case 'sqlite3':
        return {
          highWaterMark: 8 * 1024, // 8KB 청크 (SQLite는 작은 청크가 효율적)
          objectMode: true,
        };

      case 'mssql':
        return {
          highWaterMark: 32 * 1024, // 32KB 청크
          objectMode: true,
        };

      case 'BigQueryClient':
      case 'SnowflakeDialect':
        return {
          highWaterMark: 128 * 1024, // 128KB 청크 (클라우드 DB는 큰 청크 가능)
          objectMode: true,
        };

      default:
        return {
          highWaterMark: 16 * 1024, // 기본값 16KB
          objectMode: true,
        };
    }
  }

  /**
   * 데이터베이스별 청크 처리
   */
  private processChunkByDatabase(chunk: any, clientType: string): any {
    // 데이터베이스별 특수 처리
    switch (clientType) {
      case 'mysql2':
      case 'pg':
      case 'cockroachdb':
        // PostgreSQL 계열은 chunk가 이미 row 객체
        return chunk;

      case 'oracledb':
        // Oracle은 배열 형태로 올 수 있음
        if (Array.isArray(chunk)) {
          // 첫 번째 row가 컬럼명일 수 있으므로 확인 필요
          return chunk;
        }
        return chunk;

      case 'BigQueryClient':
      case 'SnowflakeDialect':
        // 클라우드 DB들은 특수한 포맷을 가질 수 있음
        return chunk;

      default:
        return chunk;
    }
  }

  /**
   * 데이터베이스 연결 테스트
   * @param createDatabaseDto
   */
  async testDatabase(createDatabaseDto: CreateDatabaseDto) {
    assertSourceEngineAllowed(createDatabaseDto.engine);
    assertNotLocalFileEngine(createDatabaseDto.engine);
    try {
      // ConnectionConfig 파싱
      let parsedConnectionConfig: any = createDatabaseDto.connectionConfig;
      if (typeof parsedConnectionConfig === 'string') {
        try {
          parsedConnectionConfig = JSON.parse(parsedConnectionConfig);
        } catch (e) {
          return {
            status: ResponseStatus.ERROR,
            message: 'Invalid connection configuration format',
          };
        }
      }

      // SQLite 특별 처리
      let connectionConfig;
      if (createDatabaseDto.engine === 'sqlite' || createDatabaseDto.engine === 'better-sqlite3') {
        connectionConfig = {
          client: createDatabaseDto.engine,
          connection: {
            filename: parsedConnectionConfig.database || './demo.db',
          },
          useNullAsDefault: true,
        };
      } else {
        connectionConfig = {
          client: createDatabaseDto.engine,
          connection: parsedConnectionConfig,
          useNullAsDefault: true,
        };
      }

      // 테스트용 Knex 인스턴스 생성
      const testKnex = knex(connectionConfig);

      // 간단한 연결 테스트 쿼리 실행
      let testQuery: string;
      switch (createDatabaseDto.engine) {
        case 'mysql2':
          testQuery = 'SELECT 1 as test';
          break;
        case 'pg':
        case 'cockroachdb':
          testQuery = 'SELECT 1 as test';
          break;
        case 'sqlite':
        case 'sqlite3':
        case 'better-sqlite3':
          testQuery = 'SELECT 1 as test';
          break;
        case 'mssql':
          testQuery = 'SELECT 1 as test';
          break;
        case 'oracledb':
          testQuery = 'SELECT 1 as test FROM dual';
          break;
        default:
          testQuery = 'SELECT 1 as test';
          break;
      }

      // 타임아웃 설정으로 테스트 실행
      const result = await Promise.race([
        testKnex.raw(testQuery),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000),
        ),
      ]);

      // 연결 정리
      await testKnex.destroy();

      return {
        status: ResponseStatus.SUCCESS,
        message: 'Database connection test successful',
        data: { connectionTest: 'passed' },
      };
    } catch (error) {
      this.logger?.error('Database connection test failed', error.stack, 'ConnectionService', {
        engine: createDatabaseDto.engine,
        error: error.message,
      });

      return {
        status: ResponseStatus.ERROR,
        message: `Database connection failed: ${error.message}`,
      };
    }
  }
}
