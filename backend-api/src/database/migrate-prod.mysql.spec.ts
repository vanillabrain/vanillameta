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

  async function openSchema(migrations: Array<new () => MigrationInterface>) {
    const schema = 'vm_migrate_prod_' + randomBytes(8).toString('hex');
    schemas.push(schema);
    await admin.query(`CREATE DATABASE \`${schema}\``);
    const dataSource = new DataSource({
      ...connection(schema),
      entities: [__dirname + '/../**/*.entity.ts'],
      migrations,
      synchronize: false,
    });
    await dataSource.initialize();
    return dataSource;
  }

  beforeAll(async () => {
    admin = await new DataSource(connection()).initialize();
  });

  afterAll(async () => {
    for (const schema of schemas) await admin.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    await admin?.destroy();
  });

  it('initialises an empty database once: schema, reference data, no demo user, migrations recorded', async () => {
    const db = await openSchema([AddMarkerOne1999000000001, AddMarkerTwo1999000000002]);
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
    const first = await openSchema([AddMarkerOne1999000000001]);
    const schema = schemas[schemas.length - 1];
    try {
      await migrateProd(first);
    } finally {
      await first.destroy();
    }

    const second = new DataSource({
      ...connection(schema),
      entities: [__dirname + '/../**/*.entity.ts'],
      migrations: [AddMarkerOne1999000000001, AddMarkerTwo1999000000002],
      synchronize: false,
    });
    await second.initialize();
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
});
