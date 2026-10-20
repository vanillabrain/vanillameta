import { DataSource, QueryRunner } from 'typeorm';
import { AddDashboardStudio1792030000000 } from '../migrations/1792030000000-add-dashboard-studio';
import { StudioRun } from './entities/studio-run.entity';
import { StudioState } from './entities/studio-state.entity';

type SqliteColumn = { name: string; type: string; notnull: number; pk: number };

const columnInfo = (runner: QueryRunner, table: string): Promise<SqliteColumn[]> =>
  runner.query('PRAGMA table_info(' + table + ')');

const columnNames = (columns: { name: string }[]): string[] =>
  columns.map(column => column.name).sort();

const entityColumnNames = (columns: { databaseName: string }[]): string[] =>
  columns.map(column => column.databaseName).sort();

const declaredType = (columns: SqliteColumn[], name: string): string =>
  (columns.find(column => column.name === name)?.type ?? '').toLowerCase();

describe('AddDashboardStudio migration', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  });
  afterEach(async () => {
    await db.destroy();
  });

  it('creates studio_state and studio_run idempotently with the agreed columns', async () => {
    const runner = db.createQueryRunner();
    try {
      const migration = new AddDashboardStudio1792030000000();
      await migration.up(runner);
      await migration.up(runner);
      expect(await runner.hasTable('studio_state')).toBe(true);
      expect(await runner.hasTable('studio_run')).toBe(true);
      expect(columnNames(await columnInfo(runner, 'studio_state'))).toEqual([
        'createdAt',
        'dashboardId',
        'document',
        'legacyRevision',
        'updatedAt',
      ]);
      expect(columnNames(await columnInfo(runner, 'studio_run'))).toEqual([
        'actorId',
        'createdAt',
        'id',
        'payloadHash',
        'requestId',
        'result',
        'updatedAt',
      ]);
      const state = await columnInfo(runner, 'studio_state');
      expect(state.find(column => column.name === 'dashboardId')).toMatchObject({ pk: 1 });
      expect(state.find(column => column.name === 'document')).toMatchObject({ notnull: 1 });
      expect(state.find(column => column.name === 'legacyRevision')).toMatchObject({ notnull: 1 });
      expect(declaredType(state, 'document')).toBe('text');
      expect(declaredType(state, 'legacyRevision')).toBe('varchar(64)');
      const run = await columnInfo(runner, 'studio_run');
      expect(run.find(column => column.name === 'id')).toMatchObject({ pk: 1 });
      expect(run.find(column => column.name === 'requestId')).toMatchObject({ notnull: 1 });
      expect(run.find(column => column.name === 'payloadHash')).toMatchObject({ notnull: 1 });
      expect(run.find(column => column.name === 'result')).toMatchObject({ notnull: 0 });
      expect(declaredType(run, 'requestId')).toBe('varchar(128)');
      expect(declaredType(run, 'payloadHash')).toBe('varchar(64)');
      expect(declaredType(run, 'result')).toBe('text');
    } finally {
      await runner.release();
    }
  });

  it('keeps existing dashboard rows and down drops only the studio tables', async () => {
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE dashboard (id integer primary key, title text)');
      await runner.query(
        'CREATE TABLE personal_view (id integer primary key, dashboardId integer, userId integer, name text, revision text, state text)',
      );
      await runner.query('INSERT INTO dashboard (id,title) VALUES (?,?)', [
        26,
        'Existing dashboard',
      ]);
      await runner.query(
        'INSERT INTO personal_view (id,dashboardId,userId,name,revision,state) VALUES (?,?,?,?,?,?)',
        [7, 26, 5, 'Saved', 'rev', JSON.stringify({ version: 1 })],
      );
      const migration = new AddDashboardStudio1792030000000();
      await migration.up(runner);
      await runner.query(
        'INSERT INTO studio_state (dashboardId,document,legacyRevision) VALUES (?,?,?)',
        [26, '{"schemaVersion":1}', 'rev'],
      );
      expect(await runner.query('SELECT * FROM dashboard')).toEqual([
        { id: 26, title: 'Existing dashboard' },
      ]);
      expect(await runner.query('SELECT dashboardId,legacyRevision FROM studio_state')).toEqual([
        { dashboardId: 26, legacyRevision: 'rev' },
      ]);
      await migration.down(runner);
      expect(await runner.hasTable('studio_state')).toBe(false);
      expect(await runner.hasTable('studio_run')).toBe(false);
      expect(await runner.query('SELECT * FROM dashboard')).toEqual([
        { id: 26, title: 'Existing dashboard' },
      ]);
      expect((await runner.query('SELECT name FROM personal_view'))[0].name).toBe('Saved');
    } finally {
      await runner.release();
    }
  });

  it('keeps one save per actor and request and stores no credential or raw row columns', async () => {
    const runner = db.createQueryRunner();
    try {
      const migration = new AddDashboardStudio1792030000000();
      await migration.up(runner);
      await runner.query(
        'INSERT INTO studio_run (actorId,requestId,payloadHash,result) VALUES (?,?,?,?)',
        [5, 'req-1', 'a'.repeat(64), '{"document":{}}'],
      );
      await expect(
        runner.query('INSERT INTO studio_run (actorId,requestId,payloadHash) VALUES (?,?,?)', [
          5,
          'req-1',
          'b'.repeat(64),
        ]),
      ).rejects.toThrow();
      await runner.query('INSERT INTO studio_run (actorId,requestId,payloadHash) VALUES (?,?,?)', [
        5,
        'req-2',
        'b'.repeat(64),
      ]);
      expect(await runner.query('SELECT COUNT(*) AS total FROM studio_run')).toEqual([
        { total: 2 },
      ]);
      const names = columnNames(await columnInfo(runner, 'studio_run')).join(',');
      expect(names).not.toMatch(/password|secret|token|credential|raw/i);
      const indices = (await runner.query('PRAGMA index_list(studio_run)')) as { name: string }[];
      expect(indices.map(index => index.name)).toContain('IDX_studio_run_actor_request');
    } finally {
      await runner.release();
    }
  });
});

describe('Studio entities', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [StudioState, StudioRun],
    }).initialize();
  });
  afterEach(async () => {
    await db.destroy();
  });

  it('matches the migrated tables, columns and unique save index', async () => {
    const runner = db.createQueryRunner();
    try {
      await new AddDashboardStudio1792030000000().up(runner);
      const state = db.getMetadata(StudioState);
      const run = db.getMetadata(StudioRun);
      expect(state.tableName).toBe('studio_state');
      expect(run.tableName).toBe('studio_run');
      expect(entityColumnNames(state.columns)).toEqual(
        columnNames(await columnInfo(runner, 'studio_state')),
      );
      expect(entityColumnNames(run.columns)).toEqual(
        columnNames(await columnInfo(runner, 'studio_run')),
      );
      expect(
        run.indices
          .filter(index => index.isUnique)
          .map(index => index.columns.map(column => column.databaseName).join(',')),
      ).toEqual(['actorId,requestId']);
    } finally {
      await runner.release();
    }
  });
});
