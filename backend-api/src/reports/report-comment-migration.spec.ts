import { randomUUID } from 'crypto';
import { DataSource, Table, TableColumn } from 'typeorm';
import { AddArtifactComments1793560000000 } from '../migrations/postgres/1793560000000-add-artifact-comments';
import { AddDashboardCommentAnchor1793580000000 } from '../migrations/postgres/1793580000000-add-dashboard-comment-anchor';
import { AddArtifactCommentNotification1793590000000 } from '../migrations/postgres/1793590000000-add-artifact-comment-notification';
import { AddCommentThreadVisibility1793600000000 } from '../migrations/postgres/1793600000000-add-comment-thread-visibility';
import {
  REPORT_COMMENT_ENTITIES,
  ArtifactComment,
  ArtifactCommentThread,
} from './report-comment.entity';

const TABLES = [
  'artifact_comment_thread',
  'artifact_comment',
  'artifact_suggestion',
  'artifact_comment_receipt',
];

describe('artifact comment PostgreSQL migration', () => {
  it('creates the four tables in FK order with named indexes and RESTRICT FKs', async () => {
    const tables: Table[] = [];
    const runner = {
      hasTable: jest.fn(async () => false),
      createTable: jest.fn(async (table: Table) => {
        tables.push(table);
      }),
    };
    await new AddArtifactComments1793560000000().up(runner as never);
    expect(tables.map(table => table.name)).toEqual(TABLES);
    const [thread, comment, suggestion, receipt] = tables;
    expect(thread.indices.map(index => [index.name, index.columnNames])).toEqual([
      ['IDX_artifact_comment_thread_artifact', ['artifactKind', 'artifactId', 'version']],
    ]);
    expect(comment.indices.map(index => [index.name, index.columnNames])).toEqual([
      ['IDX_artifact_comment_threadId', ['threadId']],
    ]);
    expect(suggestion.indices.map(index => [index.name, index.columnNames])).toEqual([
      ['IDX_artifact_suggestion_artifact', ['artifactId', 'status']],
    ]);
    for (const [table, name] of [
      [comment, 'FK_artifact_comment_thread'],
      [suggestion, 'FK_artifact_suggestion_thread'],
    ] as const)
      expect(
        table.foreignKeys.map(key => [
          key.name,
          key.columnNames,
          key.referencedTableName,
          key.referencedColumnNames,
          key.onDelete,
        ]),
      ).toEqual([[name, ['threadId'], 'artifact_comment_thread', ['id'], 'RESTRICT']]);
    expect(receipt.columns.filter(column => column.isPrimary).map(column => column.name)).toEqual([
      'actorId',
      'organizationKey',
      'requestId',
    ]);
    expect(
      tables
        .flatMap(table => table.columns)
        .every(column => ['varchar', 'integer', 'text'].includes(column.type)),
    ).toBe(true);
  });
  it('leaves existing tables untouched and refuses an unreviewed rollback', async () => {
    const runner = {
      hasTable: jest.fn(async () => true),
      hasColumn: jest.fn(async () => true),
      createTable: jest.fn(),
      addColumn: jest.fn(),
    };
    await new AddArtifactComments1793560000000().up(runner as never);
    expect(runner.hasTable).toHaveBeenCalledTimes(5);
    expect(runner.createTable).not.toHaveBeenCalled();
    expect(runner.addColumn).not.toHaveBeenCalled();
    await expect(new AddArtifactComments1793560000000().down()).rejects.toThrow('backup plan');
  });
  it('adds nullable AI provenance columns to existing share receipts only when missing', async () => {
    const added: Array<[string, TableColumn]> = [];
    const runner = {
      hasTable: jest.fn(async (name: string) => name === 'private_report_delivery_receipt'),
      hasColumn: jest.fn(async () => false),
      createTable: jest.fn(),
      addColumn: jest.fn(async (table: string, column: TableColumn) => {
        added.push([table, column]);
      }),
    };
    await new AddArtifactComments1793560000000().up(runner as never);
    expect(
      added.map(([table, column]) => [
        table,
        column.name,
        column.type,
        column.length,
        column.isNullable,
      ]),
    ).toEqual([
      ['private_report_delivery_receipt', 'aiGrantId', 'varchar', '36', true],
      ['private_report_delivery_receipt', 'aiClientName', 'varchar', '100', true],
    ]);
  });
  it('matches the synchronized entities exactly (run twice on SQLite) and restricts deletes', async () => {
    const db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: REPORT_COMMENT_ENTITIES,
    }).initialize();
    const runner = db.createQueryRunner();
    try {
      for (const migration of [
        new AddArtifactComments1793560000000(),
        new AddDashboardCommentAnchor1793580000000(),
        new AddArtifactCommentNotification1793590000000(),
        new AddCommentThreadVisibility1793600000000(),
      ]) {
        await migration.up(runner);
        await migration.up(runner);
      }
      const diff = await db.driver.createSchemaBuilder().log();
      expect(diff.upQueries.map(query => query.query)).toEqual([]);
      for (const name of TABLES) {
        const table = await runner.getTable(name);
        expect(
          table.foreignKeys.every(
            key =>
              key.referencedTableName === 'artifact_comment_thread' && key.onDelete === 'RESTRICT',
          ),
        ).toBe(true);
      }
      await db.manager.query('PRAGMA foreign_keys = ON');
      await db.manager.insert(ArtifactCommentThread, {
        id: 't',
        artifactKind: 'report',
        artifactId: 'r',
        version: 1,
        anchorKind: 'whole',
        status: 'open',
        statusVersion: 0,
        createdBy: 7,
        authorKind: 'user',
        createdAt: 'now',
      });
      await db.manager.insert(ArtifactComment, {
        id: 'c',
        threadId: 't',
        authorId: 7,
        authorKind: 'user',
        body: 'hi',
        createdAt: 'now',
      });
      await expect(db.manager.delete(ArtifactCommentThread, { id: 't' })).rejects.toThrow();
      await expect(
        db.manager.insert(ArtifactComment, {
          id: 'orphan',
          threadId: 'missing',
          authorId: 7,
          authorKind: 'user',
          body: 'x',
          createdAt: 'now',
        }),
      ).rejects.toThrow();
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
  // Opt-in against PostgreSQL 17, e.g. VM_REPORT_COMMENT_POSTGRES_PORT=55491.
  (process.env.VM_REPORT_COMMENT_POSTGRES_PORT ? it : it.skip)(
    'matches the synchronized entities exactly on PostgreSQL (run twice)',
    async () => {
      const connection = {
        type: 'postgres' as const,
        host: process.env.VM_REPORT_COMMENT_POSTGRES_HOST || '127.0.0.1',
        port: Number(process.env.VM_REPORT_COMMENT_POSTGRES_PORT),
        username: process.env.VM_REPORT_COMMENT_POSTGRES_USER || 'postgres',
        password: process.env.VM_REPORT_COMMENT_POSTGRES_PASSWORD,
        database: process.env.VM_REPORT_COMMENT_POSTGRES_DB || 'postgres',
      };
      const schema = 'vm_comment_migration_' + randomUUID().replace(/-/g, '').slice(0, 16);
      const admin = await new DataSource(connection).initialize();
      await admin.query(`CREATE SCHEMA "${schema}"`);
      const db = await new DataSource({
        ...connection,
        schema,
        entities: REPORT_COMMENT_ENTITIES,
      }).initialize();
      const runner = db.createQueryRunner();
      try {
        for (const migration of [
          new AddArtifactComments1793560000000(),
          new AddDashboardCommentAnchor1793580000000(),
          new AddArtifactCommentNotification1793590000000(),
          new AddCommentThreadVisibility1793600000000(),
        ]) {
          await migration.up(runner);
          await migration.up(runner);
        }
        const diff = await db.driver.createSchemaBuilder().log();
        expect(diff.upQueries.map(query => query.query)).toEqual([]);
        const columns = await db.query(
          `SELECT table_name, column_name, data_type, character_maximum_length, is_nullable
             FROM information_schema.columns WHERE table_schema = $1 ORDER BY table_name, ordinal_position`,
          [schema],
        );
        expect(new Set(columns.map(row => row.table_name))).toEqual(
          new Set([...TABLES, 'artifact_comment_notification']),
        );
        expect(
          columns.every(row => ['character varying', 'integer', 'text'].includes(row.data_type)),
        ).toBe(true);
        const keys = await db.query(
          `SELECT conname, confdeltype FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE n.nspname = $1 AND contype = 'f' ORDER BY conname`,
          [schema],
        );
        expect(keys).toEqual([
          { conname: 'FK_artifact_comment_thread', confdeltype: 'r' },
          { conname: 'FK_artifact_suggestion_thread', confdeltype: 'r' },
        ]);
      } finally {
        await runner.release();
        await db.destroy();
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
        await admin.destroy();
      }
    },
  );
});
