import { DataSource, QueryRunner } from 'typeorm';
import { AddDashboardRevision1793610000000 } from '../migrations/postgres/1793610000000-add-dashboard-revision';
import { DashboardRevision } from './entities/dashboard-revision.entity';

describe('dashboard revision PostgreSQL migration', () => {
  it('creates the table once and refuses an unreviewed rollback', async () => {
    const created: unknown[] = [];
    const runner = {
      hasTable: jest.fn(async () => false),
      createTable: jest.fn(async (table: unknown) => {
        created.push(table);
      }),
    };
    await new AddDashboardRevision1793610000000().up(runner as unknown as QueryRunner);
    expect(created).toHaveLength(1);
    runner.hasTable.mockResolvedValue(true);
    runner.createTable.mockClear();
    await new AddDashboardRevision1793610000000().up(runner as unknown as QueryRunner);
    expect(runner.createTable).not.toHaveBeenCalled();
    await expect(new AddDashboardRevision1793610000000().down()).rejects.toThrow('backup plan');
  });

  it('builds the schema the entity expects and can be run again', async () => {
    const db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [DashboardRevision],
    }).initialize();
    const runner = db.createQueryRunner();
    try {
      await new AddDashboardRevision1793610000000().up(runner);
      await new AddDashboardRevision1793610000000().up(runner);
      // Nothing is left for the entity to add or change: the migration and the entity agree.
      const diff = await db.driver.createSchemaBuilder().log();
      expect(diff.upQueries.map(query => query.query)).toEqual([]);
      await db.manager.insert(DashboardRevision, {
        revisionId: '00000000-0000-4000-8000-000000000001',
        dashboardId: 1,
        revision: 'r'.repeat(64),
        studioDocument: '{}',
        title: 't',
        layout: '[]',
        actorId: 1,
        operation: 'create',
        authorKind: 'human',
        createdAt: new Date().toISOString(),
      });
      expect(await db.manager.count(DashboardRevision)).toBe(1);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
