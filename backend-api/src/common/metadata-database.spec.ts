import { metadataDatabaseConfig, metadataDatabaseType } from './metadata-database';

describe('metadata database configuration', () => {
  it('uses SQLite only for local development', () => {
    expect(metadataDatabaseType({ NODE_ENV: 'local' })).toBe('sqlite');
    expect(metadataDatabaseConfig({ NODE_ENV: 'local', SQLITE_PATH: '/tmp/meta.db' })).toEqual({
      type: 'sqlite',
      database: '/tmp/meta.db',
    });
  });

  it.each([undefined, 'dev', 'test', 'prod'])('uses PostgreSQL for %s', nodeEnv => {
    const config = metadataDatabaseConfig({
      NODE_ENV: nodeEnv,
      DB_HOST: 'db.internal',
      DB_PORT: '6543',
      DB_USERNAME: 'app',
      DB_PASSWORD: 'secret',
      DB_NAME: 'vanillameta',
      DB_CONNECTION_LIMIT: '12',
      DB_SSL: 'true',
    });
    expect(config).toMatchObject({
      type: 'postgres',
      host: 'db.internal',
      port: 6543,
      username: 'app',
      password: 'secret',
      database: 'vanillameta',
      ssl: { rejectUnauthorized: true },
      extra: { max: 12, application_name: 'VanillaMeta' },
    });
  });

  it('validates port and pool limits before opening a connection', () => {
    expect(() => metadataDatabaseConfig({ NODE_ENV: 'prod', DB_PORT: 'not-a-port' })).toThrow(
      'DB_PORT',
    );
    expect(() =>
      metadataDatabaseConfig({ NODE_ENV: 'prod', DB_PORT: '5432', DB_CONNECTION_LIMIT: '0' }),
    ).toThrow('DB_CONNECTION_LIMIT');
  });
});
