import { ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { encryptConnectionConfig } from '../utils/crypto.util';
import { ConnectionService } from './connection.service';

describe('network source types are closed when ALLOWED_SOURCE_TYPES excludes them', () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    ALLOWED_SOURCE_TYPES: process.env.ALLOWED_SOURCE_TYPES,
    CONFIG_SECRET_KEY: process.env.CONFIG_SECRET_KEY,
  };
  const fetchMock = jest.fn();
  const repository = { findOne: jest.fn() } as any;
  let connections: ConnectionService;

  beforeAll(() => {
    process.env.CONFIG_SECRET_KEY = 'test-secret';
    global.fetch = fetchMock;
    connections = new ConnectionService(repository, { emitTo: jest.fn() } as any);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'prod';
    delete process.env.ALLOWED_SOURCE_TYPES;
  });

  afterAll(() => {
    for (const [name, value] of Object.entries(previous))
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  });

  const target = { host: '169.254.169.254', port: 80, user: 'u', password: 'p' };

  it.each(['mysql2', 'pg', 'mssql', 'oracledb', 'clickhouse', 'trino', 'databricks'])(
    'rejects testing a %s connection before any socket opens',
    async engine => {
      await expect(
        connections.testConnection({ engine, connectionConfig: target } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(['duckdb', 'sqlite3', 'sqlite'])(
    'rejects a connection test that names a server file for %s',
    async engine => {
      await expect(
        connections.testConnection({
          engine,
          connectionConfig: { filename: '/etc/passwd' },
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('rejects creating a network source', async () => {
    const databases = new DatabaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      databases.create({ name: 'x', engine: 'mysql2', connectionConfig: target } as any, 1, 0),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects querying a network source that was saved before the restriction', async () => {
    repository.findOne.mockResolvedValue({
      engine: 'clickhouse',
      connectionConfig: encryptConnectionConfig(
        JSON.stringify({ client: 'clickhouse', connection: target }),
      ),
    });
    await expect(connections.getKnex(5)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      (connections as any).runQueryInner({ id: 5, query: 'select 1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still serves a saved uploaded file source', async () => {
    repository.findOne.mockResolvedValue({
      engine: 'duckdb',
      connectionConfig: encryptConnectionConfig(
        JSON.stringify({ client: 'duckdb', connection: { filename: '/tmp/x.duckdb' } }),
      ),
    });
    await expect((connections as any).getConnectionConfig(6)).resolves.toMatchObject({
      client: 'duckdb',
    });
  });

  it('opens a network engine again when it is listed', async () => {
    process.env.ALLOWED_SOURCE_TYPES = 'file,sample,clickhouse';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ meta: [], data: [] }) });
    await expect(
      connections.testConnection({ engine: 'clickhouse', connectionConfig: target } as any),
    ).resolves.toMatchObject({ status: expect.anything() });
    expect(fetchMock).toHaveBeenCalled();
  });
});
