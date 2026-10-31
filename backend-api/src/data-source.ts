import { config } from 'dotenv';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { DataSource, DataSourceOptions, MigrationInterface } from 'typeorm';
import { metadataDatabaseConfig, metadataDatabaseType } from './common/metadata-database';
import { MCP_OAUTH_ENTITIES } from './mcp-oauth/mcp-oauth.entities';

config();

// TypeORM treats every export of a globbed module as a migration, including
// shared constraint names/helpers. Load only timestamped files and up/down classes.
const migrationDirectory =
  metadataDatabaseType() === 'postgres'
    ? join(__dirname, 'migrations', 'postgres')
    : join(__dirname, 'migrations');
const loadMigration = createRequire(__filename);
const migrations = readdirSync(migrationDirectory)
  .filter(file => /^\d{13}-.+\.(ts|js)$/.test(file) && !file.endsWith('.d.ts'))
  .sort()
  .flatMap(file => Object.values(loadMigration(join(migrationDirectory, file))))
  .filter(
    (value): value is new () => MigrationInterface =>
      typeof value === 'function' &&
      typeof value.prototype?.up === 'function' &&
      typeof value.prototype?.down === 'function',
  );

const dataSourceOptions = {
  ...metadataDatabaseConfig(),
  // *.entities.ts files are not matched by the *.entity glob; MCP OAuth lives in one of them and
  // the production bootstrap synchronises this exact list, so it must be explicit.
  entities: [...MCP_OAUTH_ENTITIES, __dirname + '/**/*.entity{.ts,.js}'],
  migrations,
  // CLI migrations must be the only schema writer, including when NODE_ENV is omitted.
  synchronize: false,
  logging: process.env.NODE_ENV != 'prod',
} as DataSourceOptions;

export default new DataSource(dataSourceOptions);
