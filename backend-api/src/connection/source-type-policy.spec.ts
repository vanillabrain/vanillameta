import { ForbiddenException } from '@nestjs/common';
import {
  allowedSourceEngines,
  assertSourceEngineAllowed,
  isSourceEngineAllowed,
} from './source-type-policy';

const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;

describe('source type policy', () => {
  it('is unrestricted outside prod unless configured', () => {
    expect(allowedSourceEngines(env({ NODE_ENV: 'development' }))).toBeNull();
    expect(isSourceEngineAllowed('mysql2', env({ NODE_ENV: 'test' }))).toBe(true);
  });

  it('allows only uploads and the sample in prod by default', () => {
    const prod = env({ NODE_ENV: 'prod' });
    for (const engine of ['mysql2', 'pg', 'oracledb', 'mssql', 'clickhouse', 'trino', 'databricks'])
      expect(isSourceEngineAllowed(engine, prod)).toBe(false);
    expect(isSourceEngineAllowed('duckdb', prod)).toBe(true);
    expect(isSourceEngineAllowed('sqlite3', prod)).toBe(true);
  });

  it('ignores case and surrounding whitespace in the engine', () => {
    expect(isSourceEngineAllowed(' MySQL2 ', env({ NODE_ENV: 'prod' }))).toBe(false);
    expect(isSourceEngineAllowed(undefined, env({ NODE_ENV: 'prod' }))).toBe(false);
  });

  it('opens named engines and the wildcard explicitly', () => {
    const prod = env({ NODE_ENV: 'prod', ALLOWED_SOURCE_TYPES: 'file, sample, PG' });
    expect(isSourceEngineAllowed('pg', prod)).toBe(true);
    expect(isSourceEngineAllowed('mysql2', prod)).toBe(false);
    expect(
      isSourceEngineAllowed('mysql2', env({ NODE_ENV: 'prod', ALLOWED_SOURCE_TYPES: '*' })),
    ).toBe(true);
  });

  it('restricts a non-prod environment when configured', () => {
    expect(
      isSourceEngineAllowed('mysql2', env({ NODE_ENV: 'dev', ALLOWED_SOURCE_TYPES: 'file' })),
    ).toBe(false);
  });

  it('throws Forbidden for a blocked engine', () => {
    expect(() => assertSourceEngineAllowed('trino', env({ NODE_ENV: 'prod' }))).toThrow(
      ForbiddenException,
    );
  });
});
