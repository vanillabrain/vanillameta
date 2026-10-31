import { randomBytes } from 'crypto';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { migrateProd } from './migrate-prod';
import { PostgresBaseline1793500000000 } from '../migrations/postgres/1793500000000-postgres-baseline';

// Explicit opt-in against a throwaway PostgreSQL database; every run uses its own schema.
// Example: VM_MIGRATE_PROD_POSTGRES_PORT=55432 VM_MIGRATE_PROD_POSTGRES_PASSWORD=... npm test -- migrate-prod.postgres
const enabled = Boolean(process.env.VM_MIGRATE_PROD_POSTGRES_PORT);
const suite = enabled ? describe : describe.skip;

class AddMarkerOne1999000000001 implements MigrationInterface {
  name = 'AddMarkerOne1999000000001';
  async up(runner: QueryRunner) {
    await runner.query('CREATE TABLE migrate_prod_marker_one (id INT PRIMARY KEY)');
  }
  async down(runner: QueryRunner) {
    await runner.query('DROP TABLE migrate_prod_marker_one');
  }
}
class AddMarkerTwo1999000000002 implements MigrationInterface {
  name = 'AddMarkerTwo1999000000002';
  async up(runner: QueryRunner) {
    await runner.query('CREATE TABLE migrate_prod_marker_two (id INT PRIMARY KEY)');
  }
  async down(runner: QueryRunner) {
    await runner.query('DROP TABLE migrate_prod_marker_two');
  }
}
const BOTH = [PostgresBaseline1793500000000, AddMarkerOne1999000000001, AddMarkerTwo1999000000002];

suite('migrateProd on an empty and an existing PostgreSQL schema', () => {
  jest.setTimeout(120000);
  const schemas: string[] = [];
  let admin: DataSource;
  const database = process.env.VM_MIGRATE_PROD_POSTGRES_DB || 'postgres';

  const connection = (schema?: string) => ({
    type: 'postgres' as const,
    host: process.env.VM_MIGRATE_PROD_POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.VM_MIGRATE_PROD_POSTGRES_PORT),
    username: process.env.VM_MIGRATE_PROD_POSTGRES_USER || 'postgres',
    password: process.env.VM_MIGRATE_PROD_POSTGRES_PASSWORD,
    database,
    ...(schema ? { schema } : {}),
  });

  async function connect(schema: string, migrations: Array<new () => MigrationInterface>) {
    const dataSource = new DataSource({
      ...connection(schema),
      entities: [__dirname + '/../**/*.entity.ts'],
      migrations,
      synchronize: false,
    });
    return dataSource.initialize();
  }

  async function newSchema() {
    const schema = 'vm_migrate_prod_' + randomBytes(8).toString('hex');
    schemas.push(schema);
    await admin.query(`CREATE SCHEMA "${schema}"`);
    return schema;
  }

  const tablesOf = async (schema: string) =>
    (
      await admin.query(
        "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'",
        [schema],
      )
    ).map((row: { name: string }) => row.name);

  beforeAll(async () => {
    admin = await new DataSource(connection()).initialize();
  });

  afterAll(async () => {
    for (const schema of schemas) await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin?.destroy();
  });

  it('initialises an empty database once: schema, reference data, no demo user, migrations recorded', async () => {
    const db = await connect(await newSchema(), BOTH);
    try {
      expect(await migrateProd(db)).toEqual({ mode: 'bootstrapped', recordedMigrations: 3 });

      const [{ components }] = await db.query('SELECT COUNT(*) AS components FROM component');
      const [{ types }] = await db.query('SELECT COUNT(*) AS types FROM "databaseType"');
      const [{ users }] = await db.query('SELECT COUNT(*) AS users FROM "user"');
      expect(Number(components)).toBeGreaterThan(0);
      expect(Number(types)).toBeGreaterThan(0);
      expect(Number(users)).toBe(0);
      expect(
        await db.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name LIKE 'migrate_prod_marker_%'",
        ),
      ).toEqual([]);

      expect(await migrateProd(db)).toEqual({ mode: 'migrated', ranMigrations: 0 });
    } finally {
      await db.destroy();
    }
  });

  it('only runs pending migrations on a database that already has tables', async () => {
    const schema = await newSchema();
    const first = await connect(schema, [PostgresBaseline1793500000000, AddMarkerOne1999000000001]);
    try {
      await migrateProd(first);
    } finally {
      await first.destroy();
    }

    const second = await connect(schema, BOTH);
    try {
      expect(await migrateProd(second)).toEqual({ mode: 'migrated', ranMigrations: 1 });
      expect(
        await second.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'migrate_prod_marker_two'",
        ),
      ).toHaveLength(1);
      const [{ components }] = await second.query('SELECT COUNT(*) AS components FROM component');
      await second.query(
        'DELETE FROM component WHERE ctid IN (SELECT ctid FROM component LIMIT 1)',
      );
      await migrateProd(second);
      const [{ after }] = await second.query('SELECT COUNT(*) AS after FROM component');
      expect(Number(after)).toBe(Number(components) - 1);
    } finally {
      await second.destroy();
    }
  });

  it('refuses a schema that has tables but no migration history, and changes nothing', async () => {
    const schema = await newSchema();
    await admin.query(`CREATE TABLE "${schema}".foreign_app_table (id INT PRIMARY KEY)`);
    const db = await connect(schema, BOTH);
    try {
      await expect(migrateProd(db)).rejects.toThrow(/no recorded migrations/);
      expect(await tablesOf(schema)).toEqual(['foreign_app_table']);
    } finally {
      await db.destroy();
    }
  });

  it('refuses a half-initialised schema whose migrations table is empty', async () => {
    const schema = await newSchema();
    const db = await connect(schema, BOTH);
    try {
      await db.synchronize();
      await db.query(
        'CREATE TABLE migrations (id SERIAL PRIMARY KEY, timestamp BIGINT NOT NULL, name VARCHAR(255) NOT NULL)',
      );
      await expect(migrateProd(db)).rejects.toThrow(/no recorded migrations/);
      const [{ components }] = await db.query('SELECT COUNT(*) AS components FROM component');
      expect(Number(components)).toBe(0);
    } finally {
      await db.destroy();
    }
  });

  it('leaves no partial migration history when recording fails midway', async () => {
    class Unrecordable1999000000003 implements MigrationInterface {
      name = 'U'.repeat(300) + '1999000000003';
      async up() {
        // The failure occurs while the migration name is recorded.
      }
      async down() {
        // The migration is never applied.
      }
    }
    const db = await connect(await newSchema(), [
      AddMarkerOne1999000000001,
      Unrecordable1999000000003,
    ]);
    try {
      await expect(migrateProd(db)).rejects.toThrow();
      const [{ count }] = await db.query('SELECT COUNT(*) AS count FROM migrations');
      expect(Number(count)).toBe(0);
      await expect(migrateProd(db)).rejects.toThrow(/no recorded migrations/);
    } finally {
      await db.destroy();
    }
  });

  it('lets exactly one of two concurrent runs initialise the schema', async () => {
    const schema = await newSchema();
    const a = await connect(schema, BOTH);
    const b = await connect(schema, BOTH);
    try {
      const results = await Promise.all([migrateProd(a), migrateProd(b)]);
      expect(results.map(result => result.mode).sort()).toEqual(['bootstrapped', 'migrated']);
      const [{ count }] = await a.query('SELECT COUNT(*) AS count FROM migrations');
      expect(Number(count)).toBe(3);
    } finally {
      await a.destroy();
      await b.destroy();
    }
  });

  it('fails instead of waiting forever when another run holds the lock', async () => {
    const schema = await newSchema();
    const holder = admin.createQueryRunner();
    const db = await connect(schema, BOTH);
    try {
      await holder.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
        `vanillameta_migrate_prod:${schema}`,
      ]);
      await expect(migrateProd(db, { lockTimeoutSeconds: 1 })).rejects.toThrow(/holds the lock/);
      expect(await tablesOf(schema)).toEqual([]);
    } finally {
      await holder.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
        `vanillameta_migrate_prod:${schema}`,
      ]);
      await holder.release();
      await db.destroy();
    }
  });
});
