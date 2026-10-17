jest.mock('./bi.service', () => ({ BiService: class {} }));
import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { SourceCatalogService } from './source-catalog.service';
import { AddSourceCatalog1792300000000 } from '../migrations/1792300000000-add-source-catalog';

describe('UC050 owned source business metadata', () => {
  let db: DataSource, service: SourceCatalogService, access: any, bi: any;
  const profile = () => ({
    sourceId: 3,
    name: 'Orders',
    supported: true,
    dataVersion: 'data-v1',
    columns: [
      { name: 'amount', type: 'DOUBLE' },
      { name: 'day', type: 'DATE' },
    ],
    preview: [{ secret: 'must not return' }],
  });
  const body = () => ({
    sourceId: 3,
    sourceRevision: 'data-v1',
    version: 0,
    label: '매출',
    description: '결제 기준',
    columns: [
      { column: 'amount', label: '금액', description: '총 결제', unit: '원' },
      { column: 'day', label: '결제일', description: '', unit: '' },
    ],
  });
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [SourceCatalogEntry],
      synchronize: false,
    }).initialize();
    const runner = db.createQueryRunner();
    await new AddSourceCatalog1792300000000().up(runner);
    await new AddSourceCatalog1792300000000().up(runner);
    await runner.release();
    access = {
      actor: v => v,
      id: v => Number(v),
      assert: jest.fn(async (_kind, _id, actor) => {
        if (actor !== 7) throw new ForbiddenException();
      }),
    };
    bi = { profile: jest.fn(async () => profile()) };
    service = new SourceCatalogService(db, access, bi);
  });
  afterEach(async () => db?.destroy());
  it('reads actual schema without rows, credentials or writes', async () => {
    const data = await service.read({ sourceId: 3 }, 7);
    expect(data).toMatchObject({
      sourceId: 3,
      version: 0,
      label: 'Orders',
      sourceRevision: 'data-v1',
      schemaChanged: false,
    });
    expect(data.columns[0]).toMatchObject({ column: 'amount', type: 'DOUBLE' });
    expect(JSON.stringify(data)).not.toContain('must not return');
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
  });
  it('saves immutable attributed versions and reads saved metadata after service restart', async () => {
    await service.save(body(), 7);
    const restarted = new SourceCatalogService(db, access, bi);
    const data = await restarted.read({ sourceId: 3 }, 7);
    expect(data).toMatchObject({ version: 1, label: '매출', description: '결제 기준' });
    expect(data.columns[0]).toMatchObject({ label: '금액', unit: '원', type: 'DOUBLE' });
    await restarted.save({ ...body(), version: 1, label: '수정' }, 7);
    const entries = await db.getRepository(SourceCatalogEntry).find({ order: { version: 'ASC' } });
    expect(entries.map(e => [e.version, e.actorId])).toEqual([
      [1, 7],
      [2, 7],
    ]);
    expect(entries[0].metadata).toContain('매출');
  });
  it('rejects other users before profiling or writing', async () => {
    await expect(service.read({ sourceId: 3 }, 8)).rejects.toThrow(ForbiddenException);
    await expect(service.save(body(), 8)).rejects.toThrow(ForbiddenException);
    expect(bi.profile).not.toHaveBeenCalled();
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
  });
  it('rejects stale source and stale metadata without another write', async () => {
    await expect(service.save({ ...body(), sourceRevision: 'old' }, 7)).rejects.toMatchObject({
      status: 409,
    });
    await service.save(body(), 7);
    await expect(service.save(body(), 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(1);
  });
  it.each([
    { label: '' },
    { label: 'x'.repeat(101) },
    { description: 'x'.repeat(1001) },
    { version: -1 },
    { columns: [] },
    { ownerId: 8 },
    { columns: [{ column: 'injected', label: 'a', description: '', unit: '' }, body().columns[1]] },
    { columns: [{ ...body().columns[0], type: 'VARCHAR' }, body().columns[1]] },
    { columns: [{ ...body().columns[0], unit: 'x'.repeat(25) }, body().columns[1]] },
    {
      columns: [
        { ...body().columns[0], label: 'Ａ' },
        { ...body().columns[1], label: 'a' },
      ],
    },
  ])('rejects invalid metadata with no write: %j', async change => {
    await expect(service.save({ ...body(), ...change }, 7)).rejects.toMatchObject({ status: 400 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
  });
  it('blocks structural changes while keeping previous definitions', async () => {
    await service.save(body(), 7);
    bi.profile.mockResolvedValue({ ...profile(), columns: [{ name: 'amount', type: 'VARCHAR' }] });
    expect(await service.read({ sourceId: 3 }, 7)).toMatchObject({
      schemaChanged: true,
      version: 1,
    });
    await expect(service.save({ ...body(), version: 1 }, 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(1);
  });
  it('allows exactly one concurrent writer of the same version', async () => {
    const other = new SourceCatalogService(db, access, bi);
    const results = await Promise.allSettled([
      service.save(body(), 7),
      other.save({ ...body(), label: '다른 탭' }, 7),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(1);
  });
  it('rejects a source replaced while preparing the save', async () => {
    bi.profile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce({ ...profile(), dataVersion: 'replaced' });
    await expect(service.save(body(), 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
  });
  it.each(['not-json', '[]', '{"columns":null}'])(
    'rejects unreadable saved history without overwriting: %s',
    async metadata => {
      await service.save(body(), 7);
      await db.getRepository(SourceCatalogEntry).update({ sourceId: 3, version: 1 }, { metadata });
      await expect(service.read({ sourceId: 3 }, 7)).rejects.toMatchObject({ status: 409 });
      await expect(service.save({ ...body(), version: 1 }, 7)).rejects.toMatchObject({
        status: 409,
      });
      expect(await db.getRepository(SourceCatalogEntry).count()).toBe(1);
    },
  );
  it('rejects unsupported sources and unknown read options', async () => {
    await expect(service.read({ sourceId: 3, ownerId: 7 }, 7)).rejects.toMatchObject({
      status: 400,
    });
    bi.profile.mockResolvedValue({ ...profile(), supported: false });
    await expect(service.read({ sourceId: 3 }, 7)).rejects.toMatchObject({ status: 400 });
  });
});
