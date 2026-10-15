import { DataSource } from 'typeorm';
import { AddStudioPublication1792050000000 } from '../migrations/1792050000000-add-studio-publication';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
describe('T8 publication migration', () => {
  it('creates idempotently, supports entity writes with actor/request uniqueness and reverts idempotently', async () => {
    const db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [StudioPublication, StudioPublicationRequest],
    }).initialize();
    const runner = db.createQueryRunner();
    try {
      const migration = new AddStudioPublication1792050000000();
      await migration.up(runner);
      await migration.up(runner);
      await db.manager.insert(StudioPublication, {
        token: 'f'.repeat(64),
        actorId: 7,
        dashboardId: 1,
        sourceId: 1,
        version: 1,
        visibility: 'private',
        allowRemix: false,
        expiresAt: null,
        revokedAt: null,
        asOf: new Date().toISOString(),
        dataVersion: 'e'.repeat(64),
        snapshot: '{}',
      });
      expect(
        (await db.manager.findOne(StudioPublication, { where: { token: 'f'.repeat(64) } }))
          .allowRemix,
      ).toBe(false);
      await db.manager.insert(StudioPublicationRequest, {
        actorId: 7,
        requestId: 'one',
        payloadHash: 'a'.repeat(64),
        result: '{}',
      });
      await expect(
        db.manager.insert(StudioPublicationRequest, {
          actorId: 7,
          requestId: 'one',
          payloadHash: 'a'.repeat(64),
          result: '{}',
        }),
      ).rejects.toThrow();
      await migration.down(runner);
      await migration.down(runner);
      expect(await runner.hasTable('studio_publication')).toBe(false);
      expect(await runner.hasTable('studio_publication_request')).toBe(false);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
