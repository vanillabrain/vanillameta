import { DataSource } from 'typeorm';
import { AddStudioPublication1792050000000 } from '../migrations/1792050000000-add-studio-publication';
import { AddStudioRemix1792060000000 } from '../migrations/1792060000000-add-studio-remix';
import { StudioPublication } from './entities/studio-publication.entity';
import { StudioRemixRequest } from './entities/studio-remix.entity';
describe('T9 forward and rollback migration', () => {
  it('keeps historical publications template-null, journals actor/request uniquely and migrates idempotently', async () => {
    const db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [StudioPublication, StudioRemixRequest],
    }).initialize();
    const runner = db.createQueryRunner();
    try {
      const publication = new AddStudioPublication1792050000000(),
        migration = new AddStudioRemix1792060000000();
      await publication.up(runner);
      await runner.query(
        `INSERT INTO studio_publication (token,actorId,dashboardId,sourceId,version,visibility,allowRemix,asOf,dataVersion,snapshot)
        VALUES (?,7,1,1,1,'link',1,?,?,?)`,
        ['b'.repeat(64), new Date().toISOString(), 'd'.repeat(64), '{}'],
      );
      await migration.up(runner);
      await migration.up(runner);
      const row = await db.manager.findOne(StudioPublication, { where: { token: 'b'.repeat(64) } });
      expect(row.allowRemix).toBe(true);
      expect(row.remixTemplate).toBeNull();
      await db.manager.insert(StudioRemixRequest, {
        actorId: 8,
        requestId: 'request',
        payloadHash: 'a'.repeat(64),
        result: '{}',
      });
      await expect(
        db.manager.insert(StudioRemixRequest, {
          actorId: 8,
          requestId: 'request',
          payloadHash: 'a'.repeat(64),
          result: '{}',
        }),
      ).rejects.toThrow();
      await db.manager.insert(StudioRemixRequest, {
        actorId: 9,
        requestId: 'request',
        payloadHash: 'a'.repeat(64),
        result: '{}',
      });
      await migration.down(runner);
      await migration.down(runner);
      expect(await runner.hasTable('studio_remix_request')).toBe(false);
      expect(await runner.hasColumn('studio_publication', 'remixTemplate')).toBe(false);
      expect((await runner.query('SELECT snapshot FROM studio_publication'))[0].snapshot).toBe(
        '{}',
      );
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
