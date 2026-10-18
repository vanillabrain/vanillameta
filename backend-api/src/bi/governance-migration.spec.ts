import { DataSource } from 'typeorm';
import { AddBiGovernance1792300003000 } from '../migrations/1792300003000-add-bi-governance';
describe('organization policy migration SQLite', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
    await db.query('CREATE TABLE dashboard (id integer primary key, title text)');
    await db.query("INSERT INTO dashboard VALUES (11, 'Existing')");
  });
  afterEach(async () => {
    await db.destroy();
  });
  it('reapplies without changing existing definitions or active policy state', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddBiGovernance1792300003000();
    try {
      await migration.up(runner);
      expect(await db.query('SELECT * FROM dashboard')).toEqual([
        { id: 11, title: 'Existing', governed: 0 },
      ]);
      await db.query("INSERT INTO bi_organization (ownerId,name) VALUES (1,'Demo')");
      await db.query('UPDATE dashboard SET governed = 1 WHERE id = 11');
      await migration.up(runner);
      expect((await db.query('SELECT * FROM bi_organization'))[0]).toMatchObject({
        ownerId: 1,
        name: 'Demo',
        version: 1,
        active: 1,
      });
      expect((await db.query('SELECT governed FROM dashboard'))[0].governed).toBe(1);
      await expect(migration.down(runner)).rejects.toThrow('Back up organization policies');
      expect(await runner.hasTable('bi_organization')).toBe(true);
      expect((await db.query('SELECT governed FROM dashboard'))[0].governed).toBe(1);
    } finally {
      await runner.release();
    }
  });
  it('only allows an empty unused migration to be rolled back', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddBiGovernance1792300003000();
    try {
      await migration.up(runner);
      await migration.down(runner);
      expect(await runner.hasTable('bi_dashboard_policy')).toBe(false);
      expect(await db.query('SELECT * FROM dashboard')).toEqual([{ id: 11, title: 'Existing' }]);
    } finally {
      await runner.release();
    }
  });
});

describe('condition report receipts migration', () => {
  it('preserves exact threshold/occurrence uniqueness and refuses destructive rollback', async () => {
    const { AddConditionReports1792300004000 } = await import(
      '../migrations/1792300004000-add-condition-reports'
    );
    const db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize(),
      runner = db.createQueryRunner(),
      migration = new AddConditionReports1792300004000();
    try {
      await migration.up(runner);
      await runner.query(
        "INSERT INTO bi_condition_report (id,actorId,organizationId,dashboardId,blockId,viewRevision,payloadDigest,operator,threshold,intervalSeconds,nextAt) VALUES ('j',1,1,1,'b','v','d','gt','1000000000000000.01',60,'2026-01-01')",
      );
      await runner.query(
        "INSERT INTO bi_condition_report_occurrence(id,reportId,scheduledAt,outcome) VALUES('r','j','2026-01-01','failed')",
      );
      await migration.up(runner);
      expect((await runner.query('SELECT threshold FROM bi_condition_report'))[0].threshold).toBe(
        '1000000000000000.01',
      );
      await expect(
        runner.query(
          "INSERT INTO bi_condition_report_occurrence(id,reportId,scheduledAt,outcome) VALUES('r2','j','2026-01-01','failed')",
        ),
      ).rejects.toThrow(/UNIQUE/);
      await expect(migration.down(runner)).rejects.toThrow('Back up scheduled reports');
      expect(
        (await runner.query('SELECT count(*) AS count FROM bi_condition_report_occurrence'))[0]
          .count,
      ).toBe(1);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
