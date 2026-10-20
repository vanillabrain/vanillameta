import { DataSource } from 'typeorm';
import { AddBiDefinitions1791853000000 } from '../migrations/1791853000000-add-bi-definitions';

describe('AddBiDefinitions migration', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  });
  afterEach(async () => {
    await db.destroy();
  });

  it('preserves legacy rows with NULL definitions and is idempotent without erasing snapshots', async () => {
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE metric (id integer primary key, name text UNIQUE)');
      await runner.query('CREATE TABLE dashboard (id integer primary key, title text)');
      await runner.query("INSERT INTO metric VALUES (1, 'legacy')");
      await runner.query("INSERT INTO dashboard VALUES (2, 'Existing dashboard')");
      const migration = new AddBiDefinitions1791853000000();
      await migration.up(runner);
      await migration.up(runner);
      expect(await runner.query('SELECT * FROM metric')).toEqual([
        { id: 1, name: 'legacy', definition: null },
      ]);
      expect(await runner.query('SELECT * FROM dashboard')).toEqual([
        { id: 2, title: 'Existing dashboard', structuredDefinition: null },
      ]);
      await runner.query('UPDATE metric SET definition = ?', ['{"schemaVersion":1}']);
      await runner.query('UPDATE dashboard SET structuredDefinition = ?', [
        '{"kind":"structured-bi"}',
      ]);
      await migration.up(runner);
      expect((await runner.query('SELECT definition FROM metric'))[0].definition).toBe(
        '{"schemaVersion":1}',
      );
      expect(
        (await runner.query('SELECT structuredDefinition FROM dashboard'))[0].structuredDefinition,
      ).toBe('{"kind":"structured-bi"}');
    } finally {
      await runner.release();
    }
  });

  it('handles a fresh database without tables, then adds nullable columns when tables exist', async () => {
    const runner = db.createQueryRunner();
    try {
      const migration = new AddBiDefinitions1791853000000();
      await migration.up(runner);
      expect(await runner.hasTable('metric')).toBe(false);
      expect(await runner.hasTable('dashboard')).toBe(false);
      await runner.query('CREATE TABLE metric (id integer primary key)');
      await runner.query('CREATE TABLE dashboard (id integer primary key)');
      await migration.up(runner);
      await runner.query('INSERT INTO metric (id) VALUES (1)');
      await runner.query('INSERT INTO dashboard (id) VALUES (1)');
      expect(await runner.query('SELECT * FROM metric')).toEqual([{ id: 1, definition: null }]);
      expect(await runner.query('SELECT * FROM dashboard')).toEqual([
        { id: 1, structuredDefinition: null },
      ]);
    } finally {
      await runner.release();
    }
  });
});
