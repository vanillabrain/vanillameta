import { DataSource } from 'typeorm';
import { AddDashboardReusePermissions1792120000000 } from '../migrations/1792120000000-add-dashboard-reuse-permissions';

describe('AddDashboardReusePermissions migration', () => {
  let db: DataSource;
  const migration = () => new AddDashboardReusePermissions1792120000000();
  const columns = async (runner: any, table: string) =>
    (await runner.query(`PRAGMA table_info('${table}')`)).map((column: any) => column.name);
  const createTables = async (runner: any) => {
    await runner.query(
      'CREATE TABLE dashboard_publication (dashboardId integer primary key, uuid varchar, version integer, dashboardRevision varchar, snapshot text, publishedAt varchar, expiresAt varchar, active boolean, requestId varchar, payloadDigest varchar)',
    );
    await runner.query(
      'CREATE TABLE dashboard_share (id integer primary key autoincrement, uuid varchar, shareToken varchar, shareYn varchar, endDate datetime)',
    );
    await runner.query(
      "INSERT INTO dashboard_publication VALUES (12, 'u-1', 1, 'r', '{}', 'now', 'later', 1, 'q', 'd')",
    );
    await runner.query(
      "INSERT INTO dashboard_share (uuid, shareToken, shareYn, endDate) VALUES ('s-1', 't', 'N', null)",
    );
  };

  beforeEach(async () => {
    db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  });
  afterEach(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  it('adds both reuse columns once and preserves existing rows', async () => {
    const runner = db.createQueryRunner();
    try {
      await createTables(runner);
      await migration().up(runner);
      await migration().up(runner);
      expect(await columns(runner, 'dashboard_publication')).toContain('reuseDefinition');
      expect(await columns(runner, 'dashboard_share')).toEqual(
        expect.arrayContaining(['allowReuse', 'reuseVersion']),
      );
      expect(await runner.query('SELECT snapshot FROM dashboard_publication')).toEqual([
        { snapshot: '{}' },
      ]);
      // Existing publications stay reuse disabled; existing shares stay at version 0.
      expect(await runner.query('SELECT reuseDefinition FROM dashboard_publication')).toEqual([
        { reuseDefinition: null },
      ]);
      expect(
        await runner.query('SELECT shareYn, allowReuse, reuseVersion FROM dashboard_share'),
      ).toEqual([{ shareYn: 'N', allowReuse: 0, reuseVersion: 0 }]);
    } finally {
      await runner.release();
    }
  });

  it('is a no-op on a database without the reuse tables', async () => {
    const runner = db.createQueryRunner();
    try {
      await migration().up(runner);
      await migration().down(runner);
    } finally {
      await runner.release();
    }
  });

  it('refuses to drop a stored recipe or an enabled grant', async () => {
    const runner = db.createQueryRunner();
    try {
      await createTables(runner);
      await migration().up(runner);
      await runner.query(
        'UPDATE dashboard_publication SET reuseDefinition = \'{"schemaVersion":1}\'',
      );
      await expect(migration().down(runner)).rejects.toThrow(/Back up reuse recipes/);
      await runner.query('UPDATE dashboard_publication SET reuseDefinition = null');
      await runner.query('UPDATE dashboard_share SET allowReuse = 1');
      await expect(migration().down(runner)).rejects.toThrow(/Back up reuse grants/);
      await runner.query('UPDATE dashboard_share SET allowReuse = 0, reuseVersion = 3');
      await expect(migration().down(runner)).rejects.toThrow(/Back up reuse grants/);
      expect(await columns(runner, 'dashboard_publication')).toContain('reuseDefinition');
      expect(await columns(runner, 'dashboard_share')).toEqual(
        expect.arrayContaining(['allowReuse', 'reuseVersion']),
      );
    } finally {
      await runner.release();
    }
  });

  it('drops only its own columns when nothing was captured', async () => {
    const runner = db.createQueryRunner();
    try {
      await createTables(runner);
      await migration().up(runner);
      await migration().down(runner);
      expect(await columns(runner, 'dashboard_publication')).not.toContain('reuseDefinition');
      expect(await columns(runner, 'dashboard_share')).not.toContain('allowReuse');
      expect(await runner.query('SELECT shareToken FROM dashboard_share')).toEqual([
        { shareToken: 't' },
      ]);
    } finally {
      await runner.release();
    }
  });
});
