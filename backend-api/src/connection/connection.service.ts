import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDatabaseDto } from '../database/dto/create-database.dto';
import { QueryExecuteDto } from '../database/dto/query-execute.dto';
import { Knex, knex } from 'knex';
import { FieldTypeUtil } from '../utils/field-type.util';
import { Database } from '../database/entities/database.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { SnowflakeDialect } from './knex-dialects/snowflake';
import { createHash } from 'crypto';
import { decryptConnectionConfig } from '../utils/crypto.util';
import { assertReadOnlyQuery } from '../utils/query-guard.util';
import { Redis } from 'ioredis';
import { DuckDBService } from '../analysis/duckdb.service';
import { ProgressGateway } from '../progress/progress.gateway';
import { AsyncLocalStorage } from 'async_hooks';

// eslint-disable-next-line @typescript-eslint/no-var-requires -- knex-bigquery는 타입 선언이 없음
const { BigQueryClient } = require('knex-bigquery');

const knexConnections = new Map<number, Knex>();

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
  private readonly duckDBSnapshots = new AsyncLocalStorage<Map<number, Record<string, any>>>();

  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    private readonly progressGateway: ProgressGateway,
    private readonly duckdbService?: DuckDBService,
  ) {}

  /**
   * Knex 객체 생성 후 pool에 추가
   * @param id
   * @param options
   */
  addKnex(id: number, options: Knex.Config) {
    if (!this.hasKnex(id)) {
      knexConnections.set(id, knex(options));
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
    return JSON.parse(decryptConnectionConfig(one.connectionConfig));
  }

  /** Pin the selected immutable file for every query in this async operation. */
  async withDuckDBSnapshot<T>(id: number, callback: () => T | Promise<T>): Promise<T> {
    const databaseId = this.validateId(id);
    const snapshots = this.duckDBSnapshots.getStore();
    if (snapshots?.has(databaseId)) return callback();
    const config = await this.getConnectionConfig(databaseId);
    if (config.client !== 'duckdb') throw new BadRequestException('not a DuckDB source');
    const pinned = new Map(snapshots);
    pinned.set(databaseId, config);
    return this.duckDBSnapshots.run(pinned, callback);
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

    if (createDatabaseDto.engine === 'cockroachdb') {
      const connectioninfo = createDatabaseDto.connectionConfig;
      const cockroach_url = `postgresql://${connectioninfo['user']}:${connectioninfo['password']}@${connectioninfo['host']}:${connectioninfo['port']}/${connectioninfo['database']}?sslmode=verify-full&options=--cluster%3Dvanillameta-cockroach-3010`;
      connectioninfo['connectionString'] = cockroach_url;
    }

    const connectionConfig = {
      client: engine,
      connection: createDatabaseDto.connectionConfig,
      useNullAsDefault: true,
    };

    // createDatabaseDto.connectionConfig = JSON.stringify(connectionConfig);
    // console.log(createDatabaseDto)
    let _knex: Knex;
    let returnObj = {};
    try {
      _knex = knex(connectionConfig as Knex.Config);
    } catch (e) {
      console.log('knex not connected');
      console.error(e);
      return { status: ResponseStatus.ERROR, message: 'knex not connected' };
    }

    const testQuery = createDatabaseDto.engine == 'oracledb' ? 'SELECT 1 FROM DUAL' : 'SELECT 1';

    try {
      await _knex.raw(testQuery);
      returnObj = { status: ResponseStatus.SUCCESS, data: { message: 'success' } };
    } catch (e) {
      console.log(e);
      returnObj = { status: ResponseStatus.ERROR, message: e.sqlMessage };
    } finally {
      await _knex.destroy();
    }

    return returnObj;
  }

  /**
   * 쿼리 실행. QUERY_CACHE_TTL_MS>0 이면 동일 (db, 쿼리) 결과를 TTL 캐시
   * @param queryExecuteDto
   */
  async executeQuery(queryExecuteDto: QueryExecuteDto, clientId?: string) {
    queryExecuteDto = { ...queryExecuteDto, id: this.validateId(queryExecuteDto.id) };
    const cacheTtl = parseInt(process.env.QUERY_CACHE_TTL_MS) || 0;
    if (cacheTtl <= 0) return this.runQuery(queryExecuteDto, clientId);

    assertReadOnlyQuery(queryExecuteDto.query);
    const stored = await this.databaseRepository.findOne({ where: { id: queryExecuteDto.id } });
    if (!stored) throw new NotFoundException('database not found');
    const configHash = createHash('sha256').update(stored.connectionConfig).digest('hex');
    const cacheKey = `${queryExecuteDto.id}:${configHash}:${createHash('sha256')
      .update(queryExecuteDto.query)
      .digest('hex')}`;
    const hit = await queryCache.get(cacheKey);
    if (hit !== undefined) return hit;

    const result = await this.runQuery(queryExecuteDto, clientId);
    if (result.status === ResponseStatus.SUCCESS) {
      await queryCache.set(cacheKey, result, cacheTtl);
    }
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

    let datas = [];
    const fields = [];
    const resultObj = { status: null, message: null, datas: [], fields: [] };
    try {
      const timeoutMs = parseInt(process.env.QUERY_TIMEOUT_MS) || 60000;
      let rawQuery = knex.raw(queryExecuteDto.query);
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
    } catch (e) {
      resultObj.status = ResponseStatus.ERROR;
      if (e.sqlMessage) resultObj.message = e.sqlMessage;
      else if (e.message) resultObj.message = e.message; // bigquery
      console.log(e);
    }

    return resultObj;
  }
}
