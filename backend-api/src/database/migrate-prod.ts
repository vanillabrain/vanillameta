import { DataSource } from 'typeorm';
import CreateInitialData from './seeds/create-initial-data';

export type MigrateProdResult =
  | { mode: 'bootstrapped'; recordedMigrations: number }
  | { mode: 'migrated'; ranMigrations: number };

/**
 * Production schema entry point.
 *
 * The migration history cannot build an empty database (the first migration inserts into a table
 * that only entity synchronization creates). An empty database is therefore initialised once from
 * the entities plus reference data, and every existing migration is recorded as already applied.
 * A database that already has tables only receives pending migrations; it is never synchronized.
 */
export async function migrateProd(dataSource: DataSource): Promise<MigrateProdResult> {
  const runner = dataSource.createQueryRunner();
  let tables: unknown[];
  try {
    tables = await runner.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()',
    );
  } finally {
    await runner.release();
  }

  if (tables.length === 0) {
    await dataSource.synchronize();
    await new CreateInitialData().seedReferenceData(dataSource);
    await dataSource.runMigrations({ fake: true, transaction: 'none' });
    // `fake` runs report no executed migrations, so count what was recorded instead.
    const [{ count }] = await dataSource.query('SELECT COUNT(*) AS count FROM migrations');
    return { mode: 'bootstrapped', recordedMigrations: Number(count) };
  }

  const ran = await dataSource.runMigrations({ transaction: 'each' });
  return { mode: 'migrated', ranMigrations: ran.length };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'prod')
    throw new Error('migrate-prod only runs with NODE_ENV=prod (it may synchronize an empty database)');
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
