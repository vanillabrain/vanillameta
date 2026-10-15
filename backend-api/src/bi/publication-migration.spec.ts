import { DataSource } from 'typeorm';
import { AddDashboardPublications1792040000000 } from '../migrations/1792040000000-add-dashboard-publications';

describe('AddDashboardPublications migration', () => {
  let db: DataSource;
  const migration = () => new AddDashboardPublications1792040000000();
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  });
  afterEach(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  it('creates the table once and keeps existing dashboards untouched', async () => {
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE dashboard (id integer primary key, title text)');
      await runner.query("INSERT INTO dashboard VALUES (12, 'Fixture')");
      await migration().up(runner);
      await migration().up(runner);
      expect(await runner.query('SELECT * FROM dashboard')).toEqual([{ id: 12, title: 'Fixture' }]);
      const columns = (await runner.query('PRAGMA table_info(dashboard_publication)')).map(
        (column: any) => column.name,
      );
      expect(columns).toEqual([
        'dashboardId',
        'uuid',
        'version',
        'dashboardRevision',
        'snapshot',
        'publishedAt',
        'expiresAt',
        'active',
        'requestId',
        'payloadDigest',
        'createdAt',
        'updatedAt',
      ]);
      const indexes = await runner.query("PRAGMA index_list('dashboard_publication')");
      const uniqueNames = indexes
        .filter((row: any) => Number(row.unique) === 1)
        .map((row: any) => row.name);
      expect(uniqueNames.length).toBeGreaterThanOrEqual(1);
      let coversUuid = false;
      for (const name of uniqueNames) {
        const columns = await runner.query(`PRAGMA index_info('${name}')`);
        if (columns.some((column: any) => column.name === 'uuid')) coversUuid = true;
      }
      expect(coversUuid).toBe(true);
    } finally {
      await runner.release();
    }
  });

  it('stores a whole snapshot row and enforces one publication per dashboard', async () => {
    const runner = db.createQueryRunner();
    try {
      await migration().up(runner);
      const snapshot = JSON.stringify({
        schemaVersion: 1,
        widgets: [],
        padding: 'x'.repeat(200000),
      });
      await runner.query(
        'INSERT INTO dashboard_publication (dashboardId, uuid, version, dashboardRevision, snapshot, publishedAt, expiresAt, active, requestId, payloadDigest) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [12, 'uuid-1', 1, 'r'.repeat(64), snapshot, 'now', 'later', 1, 'req-1', 'd'.repeat(64)],
      );
      const stored = await runner.query(
        'SELECT snapshot FROM dashboard_publication WHERE dashboardId = 12',
      );
      expect(stored[0].snapshot).toBe(snapshot);
      await expect(
        runner.query(
          'INSERT INTO dashboard_publication (dashboardId, uuid, version, dashboardRevision, snapshot, publishedAt, expiresAt, active, requestId, payloadDigest) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [12, 'uuid-2', 1, 'r'.repeat(64), snapshot, 'now', 'later', 1, 'req-2', 'd'.repeat(64)],
        ),
      ).rejects.toThrow(/UNIQUE/);
      await expect(
        runner.query(
          'INSERT INTO dashboard_publication (dashboardId, uuid, version, dashboardRevision, snapshot, publishedAt, expiresAt, active, requestId, payloadDigest) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [13, 'uuid-1', 1, 'r'.repeat(64), snapshot, 'now', 'later', 1, 'req-3', 'd'.repeat(64)],
        ),
      ).rejects.toThrow(/UNIQUE/);
    } finally {
      await runner.release();
    }
  });

  it('refuses to drop published rows on rollback and drops an empty table', async () => {
    const runner = db.createQueryRunner();
    try {
      await migration().up(runner);
      await migration().down(runner);
      expect(await runner.hasTable('dashboard_publication')).toBe(false);
      await migration().up(runner);
      await runner.query(
        'INSERT INTO dashboard_publication (dashboardId, uuid, version, dashboardRevision, snapshot, publishedAt, expiresAt, active, requestId, payloadDigest) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [12, 'uuid-1', 1, 'r'.repeat(64), '{}', 'now', 'later', 1, 'req-1', 'd'.repeat(64)],
      );
      await expect(migration().down(runner)).rejects.toThrow(/Back up published snapshots/);
      expect(await runner.hasTable('dashboard_publication')).toBe(true);
    } finally {
      await runner.release();
    }
  });
});
