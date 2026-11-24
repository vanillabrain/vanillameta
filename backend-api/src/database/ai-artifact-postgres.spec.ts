import { randomBytes } from 'crypto';
import { DataSource, MigrationInterface } from 'typeorm';
import { migrateProd } from './migrate-prod';
import { PostgresBaseline1793500000000 } from '../migrations/postgres/1793500000000-postgres-baseline';
import { AddDocumentSummary1793520000000 } from '../migrations/postgres/1793520000000-add-document-summary';
import { AddDocumentProvider1793530000000 } from '../migrations/postgres/1793530000000-add-document-provider';
import { AddDocumentShare1793540000000 } from '../migrations/postgres/1793540000000-add-document-share';
import { AddAiArtifact1793550000000 } from '../migrations/postgres/1793550000000-add-ai-artifact';

// Opt-in against a throwaway PostgreSQL, same switches as migrate-prod.postgres.spec.ts.
// METADATA_DB_TYPE=postgres VM_MIGRATE_PROD_POSTGRES_PORT=55432 VM_MIGRATE_PROD_POSTGRES_PASSWORD=... npm test -- ai-artifact-postgres
const enabled = Boolean(process.env.VM_MIGRATE_PROD_POSTGRES_PORT);
const suite = enabled ? describe : describe.skip;

const BEFORE = [
  PostgresBaseline1793500000000,
  AddDocumentSummary1793520000000,
  AddDocumentProvider1793530000000,
  AddDocumentShare1793540000000,
];
const AFTER = [...BEFORE, AddAiArtifact1793550000000];

suite(
  'ai_artifact on PostgreSQL: empty database and database from before the table existed',
  () => {
    jest.setTimeout(180000);
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
      ...(schema ? { schema, extra: { options: `-c search_path=${schema},public` } } : {}),
    });
    const connect = (schema: string, migrations: Array<new () => MigrationInterface>) =>
      new DataSource({
        ...connection(schema),
        uuidExtension: 'pgcrypto' as const,
        entities: [__dirname + '/../**/*.entity.ts'],
        migrations,
        synchronize: false,
      }).initialize();
    const newSchema = async () => {
      const schema = 'vm_ai_artifact_' + randomBytes(8).toString('hex');
      schemas.push(schema);
      await admin.query(`CREATE SCHEMA "${schema}"`);
      return schema;
    };
    const shape = async (db: DataSource) => ({
      columns: await db.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'ai_artifact'
        ORDER BY column_name`,
      ),
      indexes: (
        await db.query(
          `SELECT indexname FROM pg_indexes
          WHERE schemaname = current_schema() AND tablename = 'ai_artifact'
          ORDER BY indexname`,
        )
      ).map((row: { indexname: string }) => row.indexname),
    });
    const oldDatabase = async (schema: string) => {
      const old = await connect(schema, BEFORE);
      try {
        await migrateProd(old);
        await old.query('DROP TABLE ai_artifact');
      } finally {
        await old.destroy();
      }
    };

    beforeAll(async () => {
      admin = await new DataSource(connection()).initialize();
    });
    afterAll(async () => {
      for (const schema of schemas) await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin?.destroy();
    });

    it('builds the same table from the migration as entity synchronisation does on an empty database', async () => {
      const empty = await connect(await newSchema(), AFTER);
      const schema = await newSchema();
      await oldDatabase(schema);
      const upgraded = await connect(schema, AFTER);
      try {
        expect(await migrateProd(empty)).toEqual({ mode: 'bootstrapped', recordedMigrations: 5 });
        expect(await migrateProd(upgraded)).toEqual({ mode: 'migrated', ranMigrations: 1 });
        const fromEntity = await shape(empty);
        const fromMigration = await shape(upgraded);
        expect(fromMigration.columns).toHaveLength(10);
        expect(fromMigration).toEqual(fromEntity);
      } finally {
        await empty.destroy();
        await upgraded.destroy();
      }
    });

    it('keeps artifacts and runs the migration exactly once on an existing database', async () => {
      const schema = await newSchema();
      await oldDatabase(schema);
      const upgraded = await connect(schema, AFTER);
      try {
        expect(await migrateProd(upgraded)).toEqual({ mode: 'migrated', ranMigrations: 1 });
        await upgraded.query(
          `INSERT INTO ai_artifact (id, "ownerId", kind, title, content, revision, "createdAt", "updatedAt")
         VALUES ('11111111-1111-4111-8111-111111111111', 1, 'document', 'kept', '{"markdown":"x"}', 1, 'now', 'now')`,
        );
        expect(await migrateProd(upgraded)).toEqual({ mode: 'migrated', ranMigrations: 0 });
        expect(await upgraded.query('SELECT title FROM ai_artifact')).toEqual([{ title: 'kept' }]);
        const [{ count }] = await upgraded.query(
          "SELECT COUNT(*) AS count FROM migrations WHERE name LIKE 'AddAiArtifact%'",
        );
        expect(Number(count)).toBe(1);
      } finally {
        await upgraded.destroy();
      }
    });
  },
);
