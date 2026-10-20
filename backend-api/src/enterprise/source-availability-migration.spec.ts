import { DataSource } from 'typeorm';
import { AddSourceAvailability1792420000000 } from '../migrations/1792420000000-add-source-availability';

describe('UC050 availability additive migration', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  });
  afterEach(async () => {
    await db.destroy();
  });
  it('preserves legacy source ownership/config and adds active defaults idempotently', async () => {
    await db.query(
      'CREATE TABLE "database" (id integer PRIMARY KEY, ownerId integer, connectionConfig text)',
    );
    await db.query('INSERT INTO "database" VALUES (1,7,?), (2,NULL,?)', [
      'encrypted-placeholder',
      'legacy-locked',
    ]);
    const runner = db.createQueryRunner(),
      migration = new AddSourceAvailability1792420000000();
    await migration.up(runner);
    await migration.up(runner);
    expect(await db.query('SELECT * FROM "database" ORDER BY id')).toEqual([
      {
        id: 1,
        ownerId: 7,
        connectionConfig: 'encrypted-placeholder',
        catalogActive: 1,
        catalogVersion: 0,
      },
      {
        id: 2,
        ownerId: null,
        connectionConfig: 'legacy-locked',
        catalogActive: 1,
        catalogVersion: 0,
      },
    ]);
    await db.query('UPDATE "database" SET catalogActive=0,catalogVersion=3 WHERE id=1');
    await migration.up(runner);
    expect(
      (await db.query('SELECT catalogActive,catalogVersion FROM "database" WHERE id=1'))[0],
    ).toEqual({ catalogActive: 0, catalogVersion: 3 });
    await runner.release();
  });
  it('handles an empty database and refuses destructive rollback', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddSourceAvailability1792420000000();
    await migration.up(runner);
    expect(await runner.hasTable('database')).toBe(false);
    await expect(migration.down()).rejects.toThrow('backup');
    await runner.release();
  });
});
