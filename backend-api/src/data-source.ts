import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { DataSource, DataSourceOptions, MigrationInterface } from 'typeorm';

config();

const configService = new ConfigService();
const configNodeenv = configService.get<string>('NODE_ENV');
// TypeORM treats every export of a globbed module as a migration, including
// shared constraint names/helpers. Load only timestamped files and up/down classes.
const migrationDirectory = join(__dirname, 'migrations');
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
  type: configNodeenv == 'local' ? 'sqlite' : 'mysql',
  host: configService.get<string>('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database:
    configNodeenv == 'local'
      ? process.env.SQLITE_PATH || 'sqlite.db'
      : configService.get<string>('DB_NAME'),
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations,
  // CLI migrations must be the only schema writer, including when NODE_ENV is omitted.
  synchronize: false,
  logging: configNodeenv != 'prod',
  ...(configNodeenv !== 'local' && {
    extra: {
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 5,
      connectTimeout: 30000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      waitForConnections: true,
      queueLimit: 0,
    },
  }),
} as DataSourceOptions;

export default new DataSource(dataSourceOptions);
