import { randomBytes } from 'crypto';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { migrateProd } from './migrate-prod';

// Explicit opt-in against a throwaway MySQL server; every run works in its own child schema.
// Example: VM_MIGRATE_PROD_MYSQL_PORT=33999 VM_MIGRATE_PROD_MYSQL_PASSWORD=... npm test -- migrate-prod.mysql
const enabled = Boolean(process.env.VM_MIGRATE_PROD_MYSQL_PORT);
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
const BOTH = [AddMarkerOne1999000000001, AddMarkerTwo1999000000002];

suite('migrateProd on an empty and an existing MySQL schema', () => {
  jest.setTimeout(120000);
  const schemas: string[] = [];
  let admin: DataSource;

  const connection = (database?: string) => ({
    type: 'mysql' as const,
    host: process.env.VM_MIGRATE_PROD_MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.VM_MIGRATE_PROD_MYSQL_PORT),
    username: process.env.VM_MIGRATE_PROD_MYSQL_USER || 'root',
    password: process.env.VM_MIGRATE_PROD_MYSQL_PASSWORD,
    database,
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
    await admin.query(`CREATE DATABASE \`${schema}\``);
    return schema;
  }

  const tablesOf = async (schema: string) =>
    (
      await admin.query(
        'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ?',
        [schema],
      )
    ).map((row: { name: string }) => row.name);

  beforeAll(async () => {
    admin = await new DataSource(connection()).initialize();
  });

  afterAll(async () => {
    for (const schema of schemas) await admin.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    await admin?.destroy();
  });

  it('initialises an empty database once: schema, reference data, no demo user, migrations recorded', async () => {
    const db = await connect(await newSchema(), BOTH);
    try {
      expect(await migrateProd(db)).toEqual({ mode: 'bootstrapped', recordedMigrations: 2 });

      const [{ components }] = await db.query('SELECT COUNT(*) AS components FROM component');
      const [{ types }] = await db.query('SELECT COUNT(*) AS types FROM databaseType');
      const [{ users }] = await db.query('SELECT COUNT(*) AS users FROM `user`');
      expect(Number(components)).toBeGreaterThan(0);
      expect(Number(types)).toBeGreaterThan(0);
      expect(Number(users)).toBe(0);
      // Faked migrations are recorded, never executed.
      expect(await db.query("SHOW TABLES LIKE 'migrate_prod_marker_%'")).toEqual([]);

      expect(await migrateProd(db)).toEqual({ mode: 'migrated', ranMigrations: 0 });
    } finally {
      await db.destroy();
    }
  });

  it('only runs pending migrations on a database that already has tables', async () => {
    const schema = await newSchema();
    const first = await connect(schema, [AddMarkerOne1999000000001]);
    try {
      await migrateProd(first);
    } finally {
      await first.destroy();
    }

    const second = await connect(schema, BOTH);
    try {
      expect(await migrateProd(second)).toEqual({ mode: 'migrated', ranMigrations: 1 });
      expect(await second.query("SHOW TABLES LIKE 'migrate_prod_marker_two'")).toHaveLength(1);
      // Existing data is not synchronized away or re-seeded.
      const [{ components }] = await second.query('SELECT COUNT(*) AS components FROM component');
      await second.query('DELETE FROM component LIMIT 1');
      await migrateProd(second);
      const [{ after }] = await second.query('SELECT COUNT(*) AS after FROM component');
      expect(Number(after)).toBe(Number(components) - 1);
    } finally {
      await second.destroy();
    }
  });

  it('refuses a schema that has tables but no migration history, and changes nothing', async () => {
    const schema = await newSchema();
    await admin.query(`CREATE TABLE \`${schema}\`.foreign_app_table (id INT PRIMARY KEY)`);
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
      await db.synchronize(); // what a first run leaves behind when it crashes before recording
      await db.query(
        'CREATE TABLE migrations (id INT AUTO_INCREMENT PRIMARY KEY, timestamp BIGINT NOT NULL, name VARCHAR(255) NOT NULL)',
      );
      await expect(migrateProd(db)).rejects.toThrow(/no recorded migrations/);
      const [{ components }] = await db.query('SELECT COUNT(*) AS components FROM component');
      expect(Number(components)).toBe(0); // reference data was never seeded and is not guessed at
    } finally {
      await db.destroy();
    }
  });

  it('leaves no partial migration history when recording fails midway', async () => {
    // The second record cannot be stored (name longer than the column), as if the process died.
    class Unrecordable1999000000003 implements MigrationInterface {
      name = 'U'.repeat(300) + '1999000000003';
      async up() {
        // never executed: the migration is only recorded
      }
      async down() {
        // never executed
      }
    }
    const schema = await newSchema();
    const db = await connect(schema, [AddMarkerOne1999000000001, Unrecordable1999000000003]);
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
      expect(Number(count)).toBe(2);
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
      await holder.query('SELECT GET_LOCK(?, 1)', [`vanillameta_migrate_prod:${schema}`]);
      await expect(migrateProd(db, { lockTimeoutSeconds: 1 })).rejects.toThrow(/holds the lock/);
      expect(await tablesOf(schema)).toEqual([]);
    } finally {
      await holder.query('SELECT RELEASE_LOCK(?)', [`vanillameta_migrate_prod:${schema}`]);
      await holder.release();
      await db.destroy();
    }
  });
});
