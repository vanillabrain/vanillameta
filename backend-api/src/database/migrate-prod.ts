import { DataSource, QueryRunner } from 'typeorm';
import CreateInitialData from './seeds/create-initial-data';

export type MigrateProdResult =
  | { mode: 'bootstrapped'; recordedMigrations: number }
  | { mode: 'migrated'; ranMigrations: number };

export interface MigrateProdOptions {
  /** How long to wait for another migrate run on the same schema before failing. */
  lockTimeoutSeconds?: number;
}

/**
 * Production schema entry point.
 *
 * The migration history cannot build an empty database (the first migration inserts into a table
 * that only entity synchronization creates). An empty database is therefore initialised once from
 * the entities plus reference data, and every existing migration is recorded as already applied.
 * A database that already has tables only receives pending migrations; it is never synchronized.
 *
 * Safety rules:
 * - Runs are serialised with a MySQL named lock, so two containers cannot both initialise.
 * - Tables without a populated `migrations` table mean a half-built or foreign schema (a crash
 *   after synchronization, or DB_NAME pointing at another application). That is refused rather
 *   than migrated, because running every migration against a synchronized schema would fail or
 *   corrupt it and the reference data would never be seeded.
 */
export async function migrateProd(
  dataSource: DataSource,
  options: MigrateProdOptions = {},
): Promise<MigrateProdResult> {
  const runner = dataSource.createQueryRunner();
  let lockName: string | undefined;
  try {
    const schema = await currentSchema(dataSource, runner);
    lockName = `vanillameta_migrate_prod:${schema}`;
    const [{ granted }] = await runner.query('SELECT GET_LOCK(?, ?) AS granted', [
      lockName,
      options.lockTimeoutSeconds ?? 60,
    ]);
    if (Number(granted) !== 1) {
      lockName = undefined;
      throw new Error(`Another migrate-prod run holds the lock for schema "${schema}"`);
    }

    const tables: Array<Record<string, string>> = await runner.query(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()',
    );
    if (tables.length === 0) return await bootstrap(dataSource);

    const recorded = await recordedMigrationCount(runner, tables);
    if (recorded === 0)
      throw new Error(
        `Schema "${schema}" has ${tables.length} tables but no recorded migrations. It is either ` +
          'half-initialised by a failed first run or belongs to something else. Refusing to ' +
          'migrate it; inspect it, then empty the schema and run again if it is a failed bootstrap.',
      );

    const ran = await dataSource.runMigrations({ transaction: 'each' });
    return { mode: 'migrated', ranMigrations: ran.length };
  } finally {
    if (lockName) await runner.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
    await runner.release();
  }
}

/** The schema the connection is really using; it must be the one configured for this data source. */
async function currentSchema(dataSource: DataSource, runner: QueryRunner): Promise<string> {
  const [{ schema }] = await runner.query('SELECT DATABASE() AS `schema`');
  if (!schema) throw new Error('The connection has no database selected');
  const configured = dataSource.options.database;
  if (typeof configured === 'string' && configured !== schema)
    throw new Error(`Connected to "${schema}" but "${configured}" is configured`);
  return schema;
}

async function recordedMigrationCount(
  runner: QueryRunner,
  tables: Array<Record<string, string>>,
): Promise<number> {
  if (!tables.some(table => table.name === 'migrations')) return 0;
  const [{ count }] = await runner.query('SELECT COUNT(*) AS count FROM migrations');
  return Number(count);
}

async function bootstrap(dataSource: DataSource): Promise<MigrateProdResult> {
  await dataSource.synchronize();
  await new CreateInitialData().seedReferenceData(dataSource);
  await dataSource.runMigrations({ fake: true, transaction: 'none' });
  // `fake` runs report no executed migrations, so count what was recorded instead.
  const [{ count }] = await dataSource.query('SELECT COUNT(*) AS count FROM migrations');
  return { mode: 'bootstrapped', recordedMigrations: Number(count) };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'prod')
    throw new Error(
      'migrate-prod only runs with NODE_ENV=prod (it may synchronize an empty database)',
    );
  // Imported lazily so that unit tests of migrateProd do not open a connection.
  const { default: dataSource } = await import('../data-source');
  await dataSource.initialize();
  try {
    console.log(JSON.stringify(await migrateProd(dataSource)));
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
