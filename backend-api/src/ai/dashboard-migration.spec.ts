import { DataSource } from 'typeorm';
import { AddDashboardAnalysis1791763200000 } from '../migrations/1791763200000-add-dashboard-analysis';
it('adds the optional definition idempotently and preserves existing metadata rows', async () => {
  const db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  const runner = db.createQueryRunner();
  try {
    await runner.query('CREATE TABLE dashboard (id integer primary key, title text)');
    await runner.query("INSERT INTO dashboard VALUES (1, 'Existing dashboard')");
    const migration = new AddDashboardAnalysis1791763200000();
    await migration.up(runner);
    await migration.up(runner);
    expect(await runner.query('SELECT * FROM dashboard')).toEqual([
      { id: 1, title: 'Existing dashboard', analysisDefinition: null },
    ]);
    await migration.down(runner);
    expect(await runner.query('SELECT * FROM dashboard')).toEqual([
      { id: 1, title: 'Existing dashboard' },
    ]);
  } finally {
    await runner.release();
    await db.destroy();
  }
});
