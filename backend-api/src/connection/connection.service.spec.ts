import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { ConnectionService } from './connection.service';
import { ResponseStatus } from '../common/enum/response-status.enum';

describe('ConnectionService HTTP engines', () => {
  let service: ConnectionService;
  const fetchMock = jest.fn();
  const databaseRepository = { findOne: jest.fn() } as any;
  const progressGateway = { emitTo: jest.fn() } as any;

  beforeAll(() => {
    service = new ConnectionService(databaseRepository, progressGateway);
    global.fetch = fetchMock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const jsonResponse = (body: any, ok = true) =>
    ({
      ok,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as any);

  describe('executeClickHouse', () => {
    const config = {
      connection: { host: 'ch.local', user: 'u', password: 'p', database: 'db' },
    };

    it('FORMAT JSON 결과를 datas/fields로 변환한다', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          meta: [{ name: 'a' }, { name: 'b' }],
          data: [{ a: 1, b: 'x' }],
        }),
      );
      const res = await (service as any).executeClickHouse(config, 'SELECT 1');
      expect(res.status).toBe(ResponseStatus.SUCCESS);
      expect(res.datas).toEqual([{ a: 1, b: 'x' }]);
      expect(res.fields).toHaveLength(2);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('http://ch.local:8123');
      expect(init.headers['X-ClickHouse-User']).toBe('u');
      expect(String(init.body)).toContain('FORMAT JSON');
    });

    it('secure이면 https를 사용한다', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ meta: [], data: [] }));
      await (service as any).executeClickHouse(
        { connection: { ...config.connection, secure: true } },
        'SELECT 1',
      );
      expect(fetchMock.mock.calls[0][0]).toContain('https://');
    });

    it('HTTP 에러를 ERROR로 반환한다', async () => {
      fetchMock.mockResolvedValue(jsonResponse('error', false));
      const res = await (service as any).executeClickHouse(config, 'SELECT 1');
      expect(res.status).toBe(ResponseStatus.ERROR);
    });
  });

  describe('executeTrino', () => {
    const config = {
      connection: { host: 'trino.local', user: 'u', password: 'p', database: 'hive' },
    };

    it('nextUri 페이지네이션을 따라가며 결과를 누적한다', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ nextUri: 'http://trino.local/v1/statement/1/2' }))
        .mockResolvedValueOnce(
          jsonResponse({
            columns: [{ name: 'a' }, { name: 'b' }],
            data: [[1, 'x']],
          }),
        );
      const res = await (service as any).executeTrino(config, 'SELECT 1');
      expect(res.status).toBe(ResponseStatus.SUCCESS);
      expect(res.datas).toEqual([{ a: 1, b: 'x' }]);
      expect(res.fields).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe('http://trino.local:8080/v1/statement');
      expect(fetchMock.mock.calls[1][0]).toBe('http://trino.local/v1/statement/1/2');
    });

    it('json.error를 ERROR로 반환한다', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'syntax error' } }));
      const res = await (service as any).executeTrino(config, 'SELEC');
      expect(res.status).toBe(ResponseStatus.ERROR);
      expect(res.message).toBe('syntax error');
    });
  });

  describe('executeDatabricks', () => {
    const config = {
      connection: {
        host: 'dbc-abc.cloud.databricks.com',
        password: 'token123',
        database: 'wh-1',
      },
    };

    it('SUCCEEDED 결과의 data_array를 객체 행으로 변환한다', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          statement_id: 'st-1',
          status: { state: 'SUCCEEDED' },
          manifest: { schema: { columns: [{ name: 'a' }, { name: 'b' }] } },
          result: { data_array: [['1', 'x']] },
        }),
      );
      const res = await (service as any).executeDatabricks(config, 'SELECT 1');
      expect(res.status).toBe(ResponseStatus.SUCCESS);
      expect(res.datas).toEqual([{ a: '1', b: 'x' }]);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://dbc-abc.cloud.databricks.com/api/2.0/sql/statements');
      expect(init.headers.Authorization).toBe('Bearer token123');
    });

    it('FAILED 상태를 ERROR로 반환한다', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          statement_id: 'st-2',
          status: { state: 'FAILED', error: { message: 'table not found' } },
        }),
      );
      const res = await (service as any).executeDatabricks(config, 'SELECT 1');
      expect(res.status).toBe(ResponseStatus.ERROR);
      expect(res.message).toBe('table not found');
    });

    it('필수 설정이 없으면 ERROR를 반환한다', async () => {
      const res = await (service as any).executeDatabricks({ connection: {} }, 'SELECT 1');
      expect(res.status).toBe(ResponseStatus.ERROR);
    });
  });

  describe('executeQuery 라우팅', () => {
    it('clickhouse connectionConfig는 HTTP 실행기로 라우팅된다', async () => {
      databaseRepository.findOne.mockResolvedValue({
        connectionConfig: 'plain-text-will-throw',
      });
      // 암호화 복호화가 실패하므로 여기선 runQuery 라우팅을 직접 검증하지 않고
      // testConnection 분기만 확인한다
      fetchMock.mockResolvedValue(jsonResponse({ meta: [], data: [] }));
      const res: any = await service.testConnection({
        engine: 'clickhouse',
        connectionConfig: { host: 'h', user: 'u' },
      } as any);
      expect(res.status).toBe(ResponseStatus.SUCCESS);
    });

    it('trino/databricks testConnection 분기도 동작한다', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ columns: [], data: [] }));
      const trino: any = await service.testConnection({
        engine: 'trino',
        connectionConfig: { host: 'h', user: 'u' },
      } as any);
      expect(trino.status).toBe(ResponseStatus.SUCCESS);

      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          status: { state: 'SUCCEEDED' },
          manifest: { schema: { columns: [] } },
          result: { data_array: [] },
        }),
      );
      const databricks: any = await service.testConnection({
        engine: 'databricks',
        connectionConfig: { host: 'h', password: 't', database: 'w' },
      } as any);
      expect(databricks.status).toBe(ResponseStatus.SUCCESS);
    });
  });
});

describe('preserved main query hooks on the current core', () => {
  it('binds main parameters without rewriting SQL and does not cross-cache parameter values', async () => {
    const prior = process.env.QUERY_CACHE_TTL_MS;
    process.env.QUERY_CACHE_TTL_MS = '60000';
    const raw = jest.fn().mockResolvedValue([[{ amount: 2 }], []]);
    const collector = { collect: jest.fn() };
    const service = new ConnectionService(
      {} as any,
      { emitTo: jest.fn() } as any,
      undefined,
      undefined,
      undefined,
      undefined,
      collector as any,
    );
    jest
      .spyOn(service as any, 'getConnectionConfig')
      .mockResolvedValue({ client: 'mysql2' } as any);
    jest.spyOn(service, 'getKnex').mockResolvedValue({
      client: { config: { client: 'mysql2' } },
      raw,
    } as any);
    try {
      for (const value of ['2', '3']) {
        const result = await service.executeQuery({
          id: 7,
          query: 'SELECT ? AS amount',
          parameters: [{ name: 'amount', type: 'number', value }],
        });
        expect(result.status).toBe(ResponseStatus.SUCCESS);
      }
      expect(raw.mock.calls).toEqual([
        ['SELECT ? AS amount', [2]],
        ['SELECT ? AS amount', [3]],
      ]);
      expect(collector.collect).toHaveBeenCalledTimes(2);
    } finally {
      if (prior === undefined) delete process.env.QUERY_CACHE_TTL_MS;
      else process.env.QUERY_CACHE_TTL_MS = prior;
    }
  });

  it('keeps entity compatibility paths bound to the current canonical constructors', async () => {
    const canonicalToken = await import('../auth/entites/refresh_token.entity');
    const mainToken = await import('../auth/entities/refresh_token.entity');
    const canonicalTable = await import('../widget/tabel-query/entity/table-query.entity');
    const mainTable = await import('../widget/table-query/entity/table-query.entity');
    expect(mainToken.RefreshToken).toBe(canonicalToken.RefreshToken);
    expect(mainTable.TableQuery).toBe(canonicalTable.TableQuery);
    expect(
      getMetadataArgsStorage().indices.some(
        index =>
          index.target === canonicalTable.TableQuery &&
          index.name === 'IDX_TABLE_QUERY_DATABASE_ID',
      ),
    ).toBe(true);
  });
});

describe('current authority before an actual shared query-cache hit', () => {
  let db: DataSource, service: ConnectionService;
  let run: jest.SpyInstance;
  const prior = process.env.QUERY_CACHE_TTL_MS;
  let sequence = 0;
  let input: { id: number; query: string };

  beforeEach(async () => {
    process.env.QUERY_CACHE_TTL_MS = '60000';
    input = { id: 951, query: `SELECT amount FROM cache_authority_fixture_${++sequence}` };
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [Database, User],
    }).initialize();
    await db.manager.insert(
      User,
      [7, 8].map(id => ({
        id,
        userId: `cache-owner-${id}`,
        email: `cache-${id}@example.invalid`,
        password: 'unused',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(Database, {
      id: 951,
      name: 'Cache authority',
      engine: 'duckdb',
      type: 'duckdb',
      ownerId: 7,
      catalogActive: true,
      catalogVersion: 0,
      connectionConfig: JSON.stringify({ client: 'duckdb', fileVersions: [{ id: 'initial' }] }),
    });
    service = new ConnectionService(db.getRepository(Database), { emitTo: jest.fn() } as any);
    Object.assign(service as any, { sourceAccess: new SourceAccessService(db) });
    run = jest
      .spyOn(service as any, 'runQuery')
      .mockResolvedValue({ status: ResponseStatus.SUCCESS, datas: [{ amount: 600 }] });
  });
  afterEach(async () => {
    await db?.destroy();
    if (prior === undefined) delete process.env.QUERY_CACHE_TTL_MS;
    else process.env.QUERY_CACHE_TTL_MS = prior;
  });
  it('rejects the former owner and stale JWT after a populated hit, while the new owner recomputes', async () => {
    await service.executeQuery(input, undefined, { actor: 7, epoch: 0 });
    await service.executeQuery(input, undefined, { actor: 7, epoch: 0 });
    expect(run).toHaveBeenCalledTimes(1);
    await db.manager.update(Database, 951, { ownerId: 8, catalogVersion: 1 });
    await expect(
      service.executeQuery(input, undefined, { actor: 7, epoch: 0 }),
    ).rejects.toMatchObject({ status: 403 });
    await service.executeQuery(input, undefined, { actor: 8, epoch: 0 });
    expect(run).toHaveBeenCalledTimes(2);
    await db.manager.update(User, 8, { authVersion: 1 });
    await expect(
      service.executeQuery(input, undefined, { actor: 8, epoch: 0 }),
    ).rejects.toMatchObject({ status: 401 });
    expect(run).toHaveBeenCalledTimes(2);
  });
  it('invalidates the key when the registered file version changes and blocks inactive sources', async () => {
    await service.executeQuery(input, undefined, { actor: 7, epoch: 0 });
    await db.manager.update(Database, 951, {
      connectionConfig: JSON.stringify({ client: 'duckdb', fileVersions: [{ id: 'replacement' }] }),
    });
    await service.executeQuery(input, undefined, { actor: 7, epoch: 0 });
    expect(run).toHaveBeenCalledTimes(2);
    await db.manager.update(Database, 951, { catalogActive: false });
    await expect(
      service.executeQuery(input, undefined, { actor: 7, epoch: 0 }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('does not use a shared cache when no verified actor context was explicitly supplied', async () => {
    await service.executeQuery(input);
    await service.executeQuery(input);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
