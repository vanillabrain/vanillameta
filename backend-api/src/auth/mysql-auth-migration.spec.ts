import { DataSource, Table } from 'typeorm';
import { FixMysqlAuthColumns1792130000000 } from '../migrations/1792130000000-fix-mysql-auth-columns';

it('upgrades legacy auth columns twice without losing timestamps or tokens', async () => {
  const db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  const runner = db.createQueryRunner();
  try {
    await runner.createTable(
      new Table({
        name: 'user',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );
    await runner.createTable(
      new Table({
        name: 'refresh_token',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true },
          { name: 'refreshToken', type: 'varchar', length: '255' },
        ],
      }),
    );
    await runner.query("INSERT INTO user VALUES (1, '2026-10-15 12:00:00', '2026-10-16 12:00:00')");
    await runner.query("INSERT INTO refresh_token VALUES (1, 'legacy-token')");
    const before = await runner.query('SELECT * FROM user');
    const migration = new FixMysqlAuthColumns1792130000000();
    await migration.up(runner);
    await migration.up(runner);
    expect(await runner.query('SELECT * FROM user')).toEqual(before);
    expect(await runner.query('SELECT * FROM refresh_token')).toEqual([
      { id: 1, refreshToken: 'legacy-token' },
    ]);
    const type = (await runner.getTable('refresh_token')).findColumnByName('refreshToken').type;
    expect(type).toBe(db.options.type === 'sqlite' ? 'varchar' : 'text');
    await runner.manager.insert('refresh_token', { id: 2, refreshToken: 'x'.repeat(400) });
    expect((await runner.query('SELECT * FROM refresh_token')).length).toBe(2);
    await expect(migration.down()).rejects.toThrow('backup review');
  } finally {
    await runner.release();
    await db.destroy();
  }
});
