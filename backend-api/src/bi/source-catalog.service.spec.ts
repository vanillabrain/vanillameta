import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
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
      entities: [SourceCatalogEntry, Database, User, EnterpriseMembership],
      synchronize: false,
    }).initialize();
    const runner = db.createQueryRunner();
    await new AddSourceCatalog1792300000000().up(runner);
    await new AddSourceCatalog1792300000000().up(runner);
    await runner.release();
    await db.synchronize();
    await db.manager.save(User, {
      id: 7,
      userId: 'catalog-owner',
      email: 'catalog-owner@example.invalid',
      password: 'fixture',
      active: true,
      authVersion: 0,
    });
    await db.manager.save(Database, {
      id: 3,
      name: 'Orders',
      ownerId: 7,
      engine: 'duckdb',
      type: 'duckdb',
      connectionConfig: '{}',
    });
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
  it('UC055 refuses a history append when Source is deleted after SQL preparation', async () => {
    const prepare = (service as any).prepare.bind(service);
    jest.spyOn(service as any, 'prepare').mockImplementation(async (...args: any[]) => {
      const result = await prepare(...args);
      await db.manager.delete(Database, 3);
      return result;
    });
    await expect(service.save(body(), 7)).rejects.toMatchObject({ status: 403 });
    expect(await db.manager.count(SourceCatalogEntry)).toBe(0);
  });
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
  it('lists saved versions and compares only changed business fields without writes or source queries', async () => {
    await service.save(body(), 7);
    await service.save(
      {
        ...body(),
        version: 1,
        label: '순매출',
        columns: [{ ...body().columns[0], unit: 'KRW' }, body().columns[1]],
      },
      7,
    );
    bi.profile.mockClear();
    const history = await service.history({ sourceId: 3 }, 7);
    expect(history.entries.map(e => e.version)).toEqual([2, 1]);
    expect(history.nextBeforeVersion).toBeNull();
    expect(history.entries[0]).toMatchObject({ label: '순매출', unreadable: false });
    const result = await service.compare({ sourceId: 3, fromVersion: 1, toVersion: 2 }, 7);
    expect(result).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      schemaChanged: false,
      dataChanged: false,
      changes: [
        { column: null, field: 'label', before: '매출', after: '순매출' },
        { column: 'amount', field: 'unit', before: '원', after: 'KRW' },
      ],
    });
    expect(JSON.stringify(history)).not.toMatch(
      /schemaRevision|sourceRevision|metadata|must not return/,
    );
    expect(bi.profile).not.toHaveBeenCalled();
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(2);
  });
  it('paginates older versions without including a new head in the second page', async () => {
    for (let version = 0; version < 22; version++) await service.save({ ...body(), version }, 7);
    const first = await service.history({ sourceId: 3 }, 7);
    expect(first.entries).toHaveLength(20);
    expect(first.nextBeforeVersion).toBe(3);
    await service.save({ ...body(), version: 22 }, 7);
    const second = await service.history(
      { sourceId: 3, beforeVersion: first.nextBeforeVersion },
      7,
    );
    expect(second.entries.map(e => e.version)).toEqual([2, 1]);
    expect(second.nextBeforeVersion).toBeNull();
  });
  it('returns empty history without inventing version zero', async () => {
    expect(await service.history({ sourceId: 3 }, 7)).toEqual({
      sourceId: 3,
      entries: [],
      nextBeforeVersion: null,
    });
    await expect(
      service.compare({ sourceId: 3, fromVersion: 1, toVersion: 2 }, 7),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('isolates unreadable history while allowing other healthy version comparisons', async () => {
    for (let version = 0; version < 3; version++) await service.save({ ...body(), version }, 7);
    await db
      .getRepository(SourceCatalogEntry)
      .update({ sourceId: 3, version: 3 }, { metadata: 'broken' });
    expect((await service.history({ sourceId: 3 }, 7)).entries[0]).toMatchObject({
      version: 3,
      label: null,
      unreadable: true,
    });
    expect(
      (await service.compare({ sourceId: 3, fromVersion: 1, toVersion: 2 }, 7)).changes,
    ).toEqual([]);
    await expect(
      service.compare({ sourceId: 3, fromVersion: 1, toVersion: 3 }, 7),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(3);
  });
  it('detects added and removed columns and stored source changes', async () => {
    await service.save(body(), 7);
    const first = await db.getRepository(SourceCatalogEntry).findOneBy({ sourceId: 3, version: 1 });
    const metadata = JSON.parse(first.metadata);
    metadata.columns = [{ column: 'new', label: '새 열', description: '', unit: '' }];
    await db.getRepository(SourceCatalogEntry).insert({
      ...first,
      version: 2,
      metadata: JSON.stringify(metadata),
      schemaRevision: 'changed',
      sourceRevision: 'changed',
    });
    const result = await service.compare({ sourceId: 3, fromVersion: 1, toVersion: 2 }, 7);
    expect(result).toMatchObject({ schemaChanged: true, dataChanged: true });
    expect(result.changes).toEqual(
      expect.arrayContaining([
        { column: 'amount', field: 'unit', before: '원', after: null },
        { column: 'new', field: 'label', before: null, after: '새 열' },
      ]),
    );
  });
  it('scopes every history read and exact comparison to the owned source', async () => {
    await service.save(body(), 7);
    await expect(service.history({ sourceId: 3 }, 8)).rejects.toThrow(ForbiddenException);
    await expect(service.compare({ sourceId: 3, fromVersion: 1, toVersion: 2 }, 8)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.compare({ sourceId: 4, fromVersion: 1, toVersion: 2 }, 7),
    ).rejects.toMatchObject({ status: 404 });
  });
  it.each([
    { fromVersion: 0, toVersion: 1 },
    { fromVersion: 2, toVersion: 1 },
    { fromVersion: 1, toVersion: 1 },
    { fromVersion: '1', toVersion: 2 },
    { fromVersion: 1, toVersion: 2, ownerId: 9 },
  ])('rejects invalid compare inputs: %j', async value => {
    await expect(service.compare({ sourceId: 3, ...value }, 7)).rejects.toMatchObject({
      status: 400,
    });
  });
  it.each([0, -1, '2', 1.5])('rejects invalid history cursors: %j', async beforeVersion => {
    await expect(service.history({ sourceId: 3, beforeVersion }, 7)).rejects.toMatchObject({
      status: 400,
    });
  });
  it('compares the final storable integer version while rejecting larger cursors', async () => {
    await service.save(body(), 7);
    const first = await db.getRepository(SourceCatalogEntry).findOneBy({ sourceId: 3, version: 1 });
    await db.getRepository(SourceCatalogEntry).insert({ ...first, version: 2147483647 });
    expect(
      (await service.compare({ sourceId: 3, fromVersion: 1, toVersion: 2147483647 }, 7)).changes,
    ).toEqual([]);
    await expect(
      service.history({ sourceId: 3, beforeVersion: 2147483648 }, 7),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('previews normalized initial changes without writing anything', async () => {
    const preview = await service.preview({ ...body(), label: '  매출  ' }, 7);
    expect(preview.draft).toMatchObject({ sourceId: 3, version: 0, label: '매출' });
    expect(preview.changes).toContainEqual({
      column: null,
      field: 'label',
      before: 'Orders',
      after: '매출',
    });
    expect(preview.changes).toContainEqual({
      column: 'amount',
      field: 'unit',
      before: '',
      after: '원',
    });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
    expect(JSON.stringify(preview)).not.toContain('must not return');
  });
  it('compares a proposal with the saved metadata and returns no differences for normalized no-op', async () => {
    await service.save(body(), 7);
    const before = await db.getRepository(SourceCatalogEntry).find();
    const same = await service.preview({ ...body(), version: 1, label: '  매출 ' }, 7);
    expect(same.changes).toEqual([]);
    const updated = await service.preview({ ...body(), version: 1, description: '새 정의' }, 7);
    expect(updated.changes).toEqual([
      { column: null, field: 'description', before: '결제 기준', after: '새 정의' },
    ]);
    expect(await db.getRepository(SourceCatalogEntry).find()).toEqual(before);
  });
  it('rejects unauthorized, invalid and stale previews without writes', async () => {
    await expect(service.preview(body(), 8)).rejects.toThrow(ForbiddenException);
    await expect(service.preview({ ...body(), label: '' }, 7)).rejects.toMatchObject({
      status: 400,
    });
    await expect(service.preview({ ...body(), sourceRevision: 'old' }, 7)).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
  });
  it('does not let preview bypass a later competing save', async () => {
    const preview = await service.preview(body(), 7);
    await service.save({ ...body(), label: '다른 저장' }, 7);
    await expect(service.save(preview.draft, 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(1);
    expect((await service.read({ sourceId: 3 }, 7)).label).toBe('다른 저장');
  });
  it('uses the exact unsaved read projection as the preview baseline', async () => {
    const baseline = await service.read({ sourceId: 3 }, 7);
    const preview = await service.preview(
      {
        sourceId: baseline.sourceId,
        sourceRevision: baseline.sourceRevision,
        version: baseline.version,
        label: baseline.label,
        description: baseline.description,
        columns: baseline.columns.map(({ column, label, description, unit }) => ({
          column,
          label,
          description,
          unit,
        })),
      },
      7,
    );
    expect(preview.changes).toEqual([]);
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
  });
  it('previews, saves and compares declared semantics without mutating old history', async () => {
    const declared = {
      ...body(),
      columns: [
        { ...body().columns[0], businessType: 'number', dateFormat: '', classification: ' Ａ ' },
        {
          ...body().columns[1],
          businessType: 'date',
          dateFormat: 'native',
          classification: '결제',
        },
      ],
    };
    const preview = await service.preview(declared, 7);
    expect(preview.draft.columns[0]).toMatchObject({ businessType: 'number', classification: 'A' });
    expect(preview.changes).toContainEqual({
      column: 'day',
      field: 'dateFormat',
      before: '',
      after: 'native',
    });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
    await service.save(preview.draft, 7);
    // An older client submits only original fields: it must not erase the declaration.
    await service.save({ ...body(), version: 1, label: '구형 편집' }, 7);
    const read = await new SourceCatalogService(db, access, bi).read({ sourceId: 3 }, 7);
    expect(read.columns[1]).toMatchObject({
      businessType: 'date',
      dateFormat: 'native',
      classification: '결제',
    });
    expect(
      (await service.compare({ sourceId: 3, fromVersion: 1, toVersion: 2 }, 7)).changes,
    ).toEqual([{ column: null, field: 'label', before: '매출', after: '구형 편집' }]);
    const reset = {
      ...body(),
      version: 2,
      columns: body().columns.map(c => ({
        ...c,
        businessType: 'auto',
        dateFormat: '',
        classification: '',
      })),
    };
    const resetPreview = await service.preview(reset, 7);
    expect(resetPreview.changes).toContainEqual({
      column: 'day',
      field: 'businessType',
      before: 'date',
      after: 'auto',
    });
    await service.save(resetPreview.draft, 7);
    expect((await service.read({ sourceId: 3 }, 7)).columns[1].businessType).toBe('auto');
    expect(
      JSON.parse(
        (await db.getRepository(SourceCatalogEntry).findOneBy({ sourceId: 3, version: 1 }))
          .metadata,
      ).columns[1].businessType,
    ).toBe('date');
  });
  it('rejects corrupt new stored semantics instead of dropping them', async () => {
    await service.save(body(), 7);
    const row = await db.getRepository(SourceCatalogEntry).findOneBy({ sourceId: 3, version: 1 });
    const metadata = JSON.parse(row.metadata);
    metadata.columns[0].businessType = 'date';
    metadata.columns[0].dateFormat = 'bad';
    await db
      .getRepository(SourceCatalogEntry)
      .update({ sourceId: 3, version: 1 }, { metadata: JSON.stringify(metadata) });
    await expect(service.read({ sourceId: 3 }, 7)).rejects.toMatchObject({ status: 409 });
    await expect(service.save({ ...body(), version: 1 }, 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(1);
  });
  it('blocks a syntactically valid but schema-incompatible stored declaration', async () => {
    await service.save(body(), 7);
    const row = await db.getRepository(SourceCatalogEntry).findOneBy({ sourceId: 3, version: 1 });
    const metadata = JSON.parse(row.metadata);
    metadata.columns[0].businessType = 'date';
    metadata.columns[0].dateFormat = 'native';
    await db
      .getRepository(SourceCatalogEntry)
      .update({ sourceId: 3, version: 1 }, { metadata: JSON.stringify(metadata) });
    await expect(service.read({ sourceId: 3 }, 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(1);
  });
  it('rejects oversized metadata before performing a full date scan', async () => {
    bi.profile.mockResolvedValue({
      ...profile(),
      columns: Array.from({ length: 128 }, (_, i) => ({ name: 'c' + i, type: 'VARCHAR' })),
    });
    bi.validateBusinessDates = jest.fn();
    const oversized = {
      ...body(),
      columns: Array.from({ length: 128 }, (_, i) => ({
        column: 'c' + i,
        label: 'c' + i,
        description: 'x'.repeat(1000),
        unit: '',
        businessType: i === 0 ? 'date' : 'auto',
        dateFormat: i === 0 ? 'YYYYMMDD' : '',
        classification: '',
      })),
    };
    await expect(service.preview(oversized, 7)).rejects.toMatchObject({ status: 400 });
    expect(bi.validateBusinessDates).not.toHaveBeenCalled();
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
  });
});
