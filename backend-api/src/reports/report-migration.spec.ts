import { DataSource } from 'typeorm';
import {
  REPORT_ENTITIES,
  PrivateReport,
  PrivateReportRevision,
  PrivateReportChunk,
} from './report.entity';
import { AddPrivateReports1793260000000 } from '../migrations/1793260000000-add-private-reports';
describe('private report migration', () => {
  it('matches synchronized SQLite metadata and restricts internal deletion without root references', async () => {
    const db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: REPORT_ENTITIES,
    }).initialize();
    const runner = db.createQueryRunner();
    try {
      const migration = new AddPrivateReports1793260000000();
      await migration.up(runner);
      await migration.up(runner);
      const diff = await db.driver.createSchemaBuilder().log();
      expect(diff.upQueries.map(query => query.query)).toEqual([]);
      for (const name of [
        'private_report',
        'private_report_revision',
        'private_report_chunk',
        'private_report_request',
      ]) {
        const table = await runner.getTable(name);
        expect(
          table.foreignKeys.every(
            key =>
              key.referencedTableName.startsWith('private_report') && key.onDelete === 'RESTRICT',
          ),
        ).toBe(true);
      }
      await db.manager.insert(PrivateReport, {
        id: 'r',
        ownerId: 7,
        organizationKey: 0,
        dashboardId: 999,
        sourceId: 999,
        version: 1,
        revision: 'a'.repeat(64),
        title: 'Report',
        updatedAt: 'now',
      });
      await db.manager.insert(PrivateReportRevision, {
        reportId: 'r',
        version: 1,
        ownerId: 7,
        revision: 'a'.repeat(64),
        bytes: 2,
        chunkCount: 1,
      });
      await db.manager.insert(PrivateReportChunk, {
        reportId: 'r',
        version: 1,
        ordinal: 0,
        payload: '{}',
      });
      await expect(db.manager.delete(PrivateReport, { id: 'r' })).rejects.toThrow();
      await expect(
        db.manager.delete(PrivateReportRevision, { reportId: 'r', version: 1 }),
      ).rejects.toThrow();
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
