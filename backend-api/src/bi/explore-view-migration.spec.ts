import { DataSource } from 'typeorm';
import { AddExploreViews1791855000000 } from '../migrations/1791855000000-add-explore-views';

describe('AddExploreViews migration', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  });
  afterEach(async () => {
    await db.destroy();
  });

  it('creates explore_view idempotently and preserves the existing personal_view data', async () => {
    const runner = db.createQueryRunner();
    try {
      await runner.query(
        'CREATE TABLE personal_view (id integer primary key, dashboardId integer, userId integer, name text, revision text, state text)',
      );
      const legacy = JSON.stringify({ version: 1, filters: [], dateRange: null });
      await runner.query(
        'INSERT INTO personal_view (id,dashboardId,userId,name,revision,state) VALUES (?,?,?,?,?,?)',
        [7, 26, 5, 'Saved', 'rev', legacy],
      );
      const migration = new AddExploreViews1791855000000();
      await migration.up(runner);
      await migration.up(runner);
      expect(await runner.hasTable('explore_view')).toBe(true);
      expect(await runner.query('SELECT * FROM personal_view')).toEqual([
        { id: 7, dashboardId: 26, userId: 5, name: 'Saved', revision: 'rev', state: legacy },
      ]);
      await runner.query(
        'INSERT INTO explore_view (sourceId,userId,name,sourceRevision,measureVersions,state) VALUES (?,?,?,?,?,?)',
        [1, 10, 'Mine', 'rev', '{"1":1}', legacy],
      );
      await migration.up(runner);
      expect((await runner.query('SELECT name FROM explore_view'))[0].name).toBe('Mine');
    } finally {
      await runner.release();
    }
  });

  it('creates the table on a fresh database and stays idempotent', async () => {
    const runner = db.createQueryRunner();
    try {
      const migration = new AddExploreViews1791855000000();
      await migration.up(runner);
      expect(await runner.hasTable('explore_view')).toBe(true);
      await migration.up(runner);
      expect(await runner.hasTable('explore_view')).toBe(true);
    } finally {
      await runner.release();
    }
  });
});
