import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Metric, MetricAggregation } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { SourceCatalogUsageService } from './source-catalog-usage.service';

describe('UC050 source usage authorization and bounded reads', () => {
  let db: DataSource, service: SourceCatalogUsageService, access: SourceAccessService;
  const metric = (id: number, databaseId = 3, useYn = 'Y') => ({
    id,
    databaseId,
    name: `metric-${id}`,
    tableName: 'uploaded_data',
    aggregation: MetricAggregation.SUM,
    expression: 'amount',
    useYn,
    definition: JSON.stringify({ label: `지표 ${id}`, sql: 'private SQL must not leak' }),
  });
  const analysis = async (id: number, owner = 7, sourceId = 3, delYn = 'N') => {
    await db.getRepository(Dashboard).save({
      id,
      title: `분석 ${id}`,
      delYn,
      analysisDefinition: JSON.stringify({
        databaseId: sourceId,
        widgets: [{ sql: 'private SQL must not leak' }],
      }),
    });
    await db.getRepository(UserMapping).save({ dashboardId: id, userInfoId: owner });
  };
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Database, Dashboard, DashboardWidget, UserMapping, Metric],
      synchronize: true,
    }).initialize();
    await db.getRepository(Database).save(
      [3, 4, 5].map(id => ({
        id,
        ownerId: id === 5 ? 8 : 7,
        name: `source-${id}`,
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: 'private credentials',
      })),
    );
    access = new SourceAccessService(db);
    service = new SourceCatalogUsageService(db, access);
  });
  afterEach(async () => db?.destroy());
  it('returns only active metrics on the owned source without definitions or writes', async () => {
    await db.getRepository(Metric).save([metric(1), metric(2, 4), metric(3, 3, 'N'), metric(4, 5)]);
    const before = await db.getRepository(Metric).find();
    const result = await service.list({ sourceId: 3, kind: 'metrics' }, 7);
    expect(result).toEqual({
      sourceId: 3,
      kind: 'metrics',
      entries: [{ id: 1, title: '지표 1' }],
      nextAfterId: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/SQL|credentials|definition|expression/);
    expect(await db.getRepository(Metric).find()).toEqual(before);
  });
  it('finds only active owned analyses with exact source references', async () => {
    await analysis(1);
    await analysis(2, 8);
    await analysis(3, 7, 4);
    await analysis(4, 7, 3, 'Y');
    await analysis(5, 7, 5);
    await analysis(6);
    await db.getRepository(Dashboard).update(6, { analysisDefinition: '{invalid' });
    const before = await db.getRepository(Dashboard).find();
    expect(await service.list({ sourceId: 3, kind: 'analyses' }, 7)).toEqual({
      sourceId: 3,
      kind: 'analyses',
      entries: [{ id: 1, title: '분석 1' }],
      nextAfterId: null,
    });
    expect(await db.getRepository(Dashboard).find()).toEqual(before);
  });
  it('rechecks source ownership and rejects invalid inputs', async () => {
    await expect(service.list({ sourceId: 3, kind: 'metrics' }, 8)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.list({ sourceId: 5, kind: 'analyses' }, 7)).rejects.toMatchObject({
      status: 403,
    });
    for (const input of [
      { kind: 'all' },
      { kind: 'metrics', ownerId: 8 },
      { kind: 'metrics', afterId: 0 },
      { kind: 'analyses', afterId: '2' },
    ])
      await expect(service.list({ sourceId: 3, ...input }, 7)).rejects.toMatchObject({
        status: 400,
      });
  });
  it('keeps the analysis cursor when the first candidate page has no matching source', async () => {
    for (let id = 1; id <= 21; id++) await analysis(id, 7, id === 21 ? 3 : 4);
    await db.getRepository(UserMapping).save({ dashboardId: 1, userInfoId: 7 });
    const first = await service.list({ sourceId: 3, kind: 'analyses' }, 7);
    expect(first).toMatchObject({ entries: [], nextAfterId: 20 });
    const next = await service.list(
      { sourceId: 3, kind: 'analyses', afterId: first.nextAfterId },
      7,
    );
    expect(next).toMatchObject({ entries: [{ id: 21, title: '분석 21' }], nextAfterId: null });
  });
  it('uses metric keyset pagination and tolerates unreadable metric descriptions', async () => {
    await db.getRepository(Metric).save(Array.from({ length: 21 }, (_, i) => metric(i + 1)));
    await db.getRepository(Metric).update(1, { definition: '{invalid' });
    const first = await service.list({ sourceId: 3, kind: 'metrics' }, 7);
    expect(first.entries).toHaveLength(20);
    expect(first.entries[0]).toEqual({ id: 1, title: 'metric-1' });
    expect(first.nextAfterId).toBe(20);
    expect(
      (await service.list({ sourceId: 3, kind: 'metrics', afterId: 20 }, 7)).entries.map(e => e.id),
    ).toEqual([21]);
  });
  it('omits an analysis denied by the current resource check without hiding healthy results', async () => {
    await analysis(1);
    await analysis(2);
    const original = access.assert.bind(access);
    jest.spyOn(access, 'assert').mockImplementation(async (kind, id, actor) => {
      if (kind === 'dashboard' && id === 1) throw new ForbiddenException();
      return original(kind, id, actor);
    });
    expect((await service.list({ sourceId: 3, kind: 'analyses' }, 7)).entries).toEqual([
      { id: 2, title: '분석 2' },
    ]);
  });
  it('does not swallow unexpected permission-store errors as empty results', async () => {
    await analysis(1);
    const original = access.assert.bind(access);
    jest.spyOn(access, 'assert').mockImplementation(async (kind, id, actor) => {
      if (kind === 'dashboard') throw new Error('store unavailable');
      return original(kind, id, actor);
    });
    await expect(service.list({ sourceId: 3, kind: 'analyses' }, 7)).rejects.toThrow(
      'store unavailable',
    );
  });
});
