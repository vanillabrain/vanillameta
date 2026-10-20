import { DataSource } from 'typeorm';
import { AddStudioExecution1792040000000 } from '../migrations/1792040000000-add-studio-execution';
import { StudioExecution } from './entities/studio-execution.entity';
describe('T7 execution migration', () => {
  it('matches entity metadata, enforces actor/request uniqueness and leaves the legacy save journal untouched', async () => {
    const db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [StudioExecution],
    }).initialize();
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE studio_run (id integer primary key, result text)');
      await runner.query("INSERT INTO studio_run VALUES (1, 'legacy')");
      const migration = new AddStudioExecution1792040000000();
      await migration.up(runner);
      await migration.up(runner);
      const columns = await runner.query('PRAGMA table_info(studio_execution)');
      expect(columns.map(c => c.name).sort()).toEqual(
        db
          .getMetadata(StudioExecution)
          .columns.map(c => c.databaseName)
          .sort(),
      );
      await db.manager.insert(StudioExecution, {
        runId: 'one',
        actorId: 7,
        requestId: 'request',
        dashboardId: 1,
        payloadHash: 'a'.repeat(64),
        status: 'pending',
        state: '{}',
      });
      await expect(
        db.manager.insert(StudioExecution, {
          runId: 'two',
          actorId: 7,
          requestId: 'request',
          dashboardId: 1,
          payloadHash: 'b'.repeat(64),
          status: 'pending',
          state: '{}',
        }),
      ).rejects.toThrow();
      await migration.down(runner);
      expect(await runner.hasTable('studio_execution')).toBe(false);
      expect(await runner.query('SELECT * FROM studio_run')).toEqual([{ id: 1, result: 'legacy' }]);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
