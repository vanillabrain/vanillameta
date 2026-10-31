export type MetadataDatabaseType = 'sqlite' | 'postgres';

export function metadataDatabaseType(env: NodeJS.ProcessEnv = process.env): MetadataDatabaseType {
  return env.NODE_ENV === 'local' ? 'sqlite' : 'postgres';
}

export function metadataDatabaseConfig(env: NodeJS.ProcessEnv = process.env) {
  if (metadataDatabaseType(env) === 'sqlite')
    return {
      type: 'sqlite' as const,
      database: env.SQLITE_PATH || 'sqlite.db',
    };

  const port = Number(env.DB_PORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('DB_PORT must be an integer between 1 and 65535');
  const max = Number(env.DB_CONNECTION_LIMIT || 10);
  if (!Number.isInteger(max) || max < 1)
    throw new Error('DB_CONNECTION_LIMIT must be a positive integer');

  return {
    type: 'postgres' as const,
    host: env.DB_HOST || '127.0.0.1',
    port,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    uuidExtension: 'pgcrypto' as const,
    ssl:
      env.DB_SSL === 'true'
        ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
    extra: {
      max,
      connectionTimeoutMillis: 30_000,
      idleTimeoutMillis: 300_000,
      keepAlive: true,
      application_name: 'VanillaMeta',
      options: '-c timezone=UTC',
    },
  };
}
