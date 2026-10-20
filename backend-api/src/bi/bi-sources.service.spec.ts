jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DataSource } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiService } from './bi.service';
import { BiController } from './bi.controller';
describe('UC050 owned source discovery summaries', () => {
  let db: DataSource, service: BiService;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Database, SourceCatalogEntry],
      synchronize: true,
    }).initialize();
    await db.getRepository(Database).save(
      [3, 4, 5, 6].map(id => ({
        id,
        name: 'source-' + id,
        engine: 'duckdb',
        ownerId: id === 5 ? 8 : id === 6 ? null : 7,
        type: 'file',
        connectionConfig: 'private-connection',
      })),
    );
    service = new BiService(db, new SourceAccessService(db), {} as any, {} as any);
  });
  afterEach(async () => db?.destroy());
  const entry = (sourceId: number, version: number, metadata: string) =>
    db
      .getRepository(SourceCatalogEntry)
      .save({ sourceId, version, actorId: 7, sourceRevision: 'r', schemaRevision: 's', metadata });
  it('keeps default response compatible, omitting connection config', async () => {
    expect(await service.sources(7)).toEqual([
      { id: 3, name: 'source-3', engine: 'duckdb' },
      { id: 4, name: 'source-4', engine: 'duckdb' },
    ]);
  });
  it('returns only the latest owned label/version and original identity, without metadata or writes', async () => {
    await entry(3, 1, JSON.stringify({ label: 'old' }));
    await entry(
      3,
      2,
      JSON.stringify({
        label: ' 매출 ',
        description: 'private-description',
        columns: [{ secret: 'private-column' }],
      }),
    );
    await entry(5, 1, JSON.stringify({ label: 'other-owner' }));
    await entry(6, 1, JSON.stringify({ label: 'legacy-owner' }));
    const count = await db.getRepository(SourceCatalogEntry).count();
    const data = await service.sources(7, true);
    expect(data).toEqual([
      { id: 3, name: 'source-3', engine: 'duckdb', catalogLabel: '매출', catalogVersion: 2 },
      { id: 4, name: 'source-4', engine: 'duckdb' },
    ]);
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(count);
    expect(JSON.stringify(data)).not.toMatch(/private|other-owner|legacy-owner/);
  });
  it.each([
    '{bad',
    'null',
    '{}',
    '{"label":7}',
    '{"label":" "}',
    JSON.stringify({ label: 'a'.repeat(101) }),
  ])('falls back to original for malformed latest label %s', async metadata => {
    await entry(3, 1, JSON.stringify({ label: 'old-valid' }));
    await entry(3, 2, metadata);
    expect((await service.sources(7, true))[0]).toEqual({
      id: 3,
      name: 'source-3',
      engine: 'duckdb',
    });
  });
  it('respects changed ownership and validates actor', async () => {
    await entry(3, 1, JSON.stringify({ label: 'moved' }));
    await db.getRepository(Database).update(3, { ownerId: 8 });
    expect(await service.sources(7, true)).toEqual([{ id: 4, name: 'source-4', engine: 'duckdb' }]);
    await expect(service.sources(0, true)).rejects.toMatchObject({ status: 403 });
  });
  it('uses a single bounded projection query without loading all history', async () => {
    await entry(3, 1, JSON.stringify({ label: 'a' }));
    const query = jest.spyOn(db.driver, 'createQueryRunner');
    await service.sources(7, true);
    expect(query).toHaveBeenCalledTimes(1);
    query.mockRestore();
  });
  it('controller opts in explicitly and rejects malformed catalog flags', async () => {
    const bi = { sources: jest.fn(async () => []) };
    const controller = new BiController(bi as any);
    const req = { user: { accessKeyData: { id: 7 } } };
    await controller.sources(req, '1');
    expect(bi.sources).toHaveBeenLastCalledWith(7, true);
    await controller.sources(req);
    expect(bi.sources).toHaveBeenLastCalledWith(7, false);
    await expect(controller.sources(req, 'false')).rejects.toMatchObject({ status: 400 });
  });
});
