import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { Database } from '../database/entities/database.entity';
import { ExploreViewService } from './explore-view.service';
import { exploreViewRevision, validateExploreViewState } from './explore-view-state';
import { AddPersonalViews1791854000000 } from '../migrations/1791854000000-add-personal-views';
import { AddExploreViews1791941000000 } from '../migrations/1791941000000-add-explore-views';
jest.mock('./bi-explore.service', () => ({ BiExploreService: class {} }));
const catalog = () => ({
  sourceId: 3,
  sourceRevision: 'data1',
  rowCount: '3',
  measures: [
    {
      id: 1,
      label: 'Requests',
      definitionVersion: 1,
      definition: { aggregation: 'SUM', column: 'requests' },
    },
  ],
  dimensions: [
    { column: 'amount', type: 'DOUBLE', numeric: true },
    { column: 'device', type: 'VARCHAR', numeric: false },
    { column: 'day', type: 'TIMESTAMP', temporal: true },
  ],
  temporalColumns: [{ column: 'day', min: '2023-09-09', max: '2023-09-11' }],
});
const state = () => ({
  version: 1,
  measureIds: [1],
  dimensionColumns: ['device'],
  rankingMeasureId: 1,
  filters: [
    { column: 'amount', range: { min: 0, max: 10 } },
    { column: 'device', values: ['A', null] },
  ],
  dateRange: { column: 'day', start: '2023-09-10', end: '2023-09-11', timeZone: 'UTC' },
  relativePeriod: null,
  trendGrain: 'week',
  comparePrevious: true,
  includeRows: true,
  leaderboardSort: { by: 'percentChange', direction: 'asc' },
});
describe('exploration saved views', () => {
  let db: DataSource, service: ExploreViewService, access: any, current: any, explorer: any;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [PersonalView, Database],
      synchronize: true,
    }).initialize();
    await db.getRepository(Database).save({
      id: 3,
      ownerId: 2,
      name: 'source',
      connectionConfig: 'test',
      engine: 'duckdb',
      type: 'FILE',
    });
    current = catalog();
    access = {
      id: (v: any) => {
        const n = Number(v);
        if (!Number.isSafeInteger(n) || n <= 0) throw new Error('invalid id');
        return n;
      },
      assert: jest.fn(async (_kind, id, actor) => {
        const row = await db.getRepository(Database).findOne({ where: { id } });
        if (!row || row.ownerId !== actor) throw new ForbiddenException();
      }),
    };
    explorer = {
      catalog: jest.fn(async () => ({ ...current, viewRevision: exploreViewRevision(current) })),
    };
    service = new ExploreViewService(db.getRepository(PersonalView), access, explorer);
  });
  afterEach(async () => {
    await db.destroy();
  });
  const create = async (name = 'Saved') =>
    service.create('3', 2, { name, state: state(), revision: exploreViewRevision(current) });
  it('persists typed full settings across a new service and keeps dashboard views separate', async () => {
    await db
      .getRepository(PersonalView)
      .save({ dashboardId: 9, userId: 2, name: 'legacy', revision: 'a'.repeat(64), state: '{}' });
    const saved = await create();
    const fresh = new ExploreViewService(db.getRepository(PersonalView), access, explorer);
    expect((await fresh.load(3, saved.data.id, 2)).data.state).toEqual(state());
    expect((await fresh.list(3, 2)).data).toHaveLength(1);
    expect(await db.getRepository(PersonalView).count({ where: { dashboardId: 9 } })).toBe(1);
    expect(Object.keys(saved.data.state).sort()).toEqual(Object.keys(state()).sort());
    await fresh.remove(3, saved.data.id, 2);
    expect((await fresh.list(3, 2)).data).toEqual([]);
    expect(await db.getRepository(PersonalView).count()).toBe(1);
  });
  it('persists Pivot axes across service reload and rejects invalid new settings', async () => {
    const pivot = {
      ...state(),
      mode: 'pivot',
      pivot: { rowDimensions: ['device'], columnDimensions: ['amount'] },
    };
    const saved = await service.create(3, 2, {
      name: 'Pivot',
      revision: exploreViewRevision(current),
      state: pivot,
    });
    const fresh = new ExploreViewService(db.getRepository(PersonalView), access, explorer);
    expect((await fresh.load(3, saved.data.id, 2)).data.state).toEqual(pivot);
    for (const axes of [
      { rowDimensions: [], columnDimensions: [] },
      { rowDimensions: ['device'], columnDimensions: ['device'] },
      { rowDimensions: ['day'], columnDimensions: [] },
      { rowDimensions: ['unknown'], columnDimensions: [] },
    ])
      expect(() => validateExploreViewState({ ...pivot, pivot: axes }, current)).toThrow();
    expect(() => validateExploreViewState({ ...pivot, mode: 'explore' }, current)).toThrow();
    expect(() => validateExploreViewState({ ...pivot, pivot: undefined }, current)).toThrow();
    expect(validateExploreViewState(state(), current)).toEqual(state());
  });
  it('keeps definition revision stable for new rows/bounds and blocks changed definitions without deleting views', async () => {
    const saved = await create();
    const before = exploreViewRevision(current);
    current.sourceRevision = 'data2';
    current.rowCount = '999';
    current.temporalColumns[0].max = '2026-01-01';
    expect(exploreViewRevision(current)).toBe(before);
    expect((await service.load(3, saved.data.id, 2)).data.state).toEqual(state());
    current.measures[0].definition.aggregation = 'AVG';
    await expect(service.load(3, saved.data.id, 2)).rejects.toMatchObject({ status: 409 });
    expect((await service.list(3, 2)).data).toHaveLength(1);
    await service.remove(3, saved.data.id, 2);
  });
  it('rechecks owner on list/create/load/delete and binds IDs to source/user', async () => {
    const saved = await create();
    for (const operation of [
      () => service.list(3, 4),
      () => service.create(3, 4, {}),
      () => service.load(3, saved.data.id, 4),
      () => service.remove(3, saved.data.id, 4),
    ])
      await expect(operation()).rejects.toBeInstanceOf(ForbiddenException);
    await db.getRepository(Database).save({
      id: 4,
      ownerId: 2,
      name: 'other',
      connectionConfig: 'test',
      engine: 'duckdb',
      type: 'FILE',
    });
    await expect(service.load(4, saved.data.id, 2)).rejects.toMatchObject({ status: 404 });
    await expect(service.remove(4, saved.data.id, 2)).rejects.toMatchObject({ status: 404 });
    await db.getRepository(Database).update(3, { ownerId: 4 });
    await expect(service.load(3, saved.data.id, 2)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('serializes 21 concurrent admissions to 20 and recovers after rejected work', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 21 }, (_, i) => create(String(i))),
    );
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(20);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    const list = (await service.list(3, 2)).data;
    expect(list).toHaveLength(20);
    await service.remove(3, list[0].id, 2);
    await expect(create('after')).resolves.toBeDefined();
  });
  it('rejects stale creation and definition races inside admission', async () => {
    await expect(
      service.create(3, 2, { name: 'x', state: state(), revision: 'a'.repeat(64) }),
    ).rejects.toMatchObject({ status: 409 });
    explorer.catalog
      .mockImplementationOnce(async () => ({
        ...current,
        viewRevision: exploreViewRevision(current),
      }))
      .mockImplementationOnce(async () => ({ ...current, viewRevision: 'f'.repeat(64) }));
    await expect(create()).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(PersonalView).count()).toBe(0);
  });
  it.each([
    { filters: undefined },
    { measureIds: [] },
    { measureIds: [999] },
    { rankingMeasureId: 2 },
    { dimensionColumns: ['bad'] },
    { dimensionColumns: ['device', 'device'] },
    { sql: 'SELECT secret' },
    { rows: [] },
    { version: 2 },
    { relativePeriod: { days: 30, column: 'day' } },
    { dateRange: null },
    { dateRange: { column: 'amount', start: '2023-09-10', end: '2023-09-11' } },
    { dateRange: { column: 'day', start: '2023-02-30', end: '2023-09-11' } },
    { dateRange: { column: 'day', start: '2023-09-11', end: '2023-09-10' } },
    { dateRange: { column: 'day', start: '2023-09-10', end: '2023-09-11', timeZone: 'bad' } },
    { filters: [{ column: 'device', range: { min: 1 } }] },
    { filters: [{ column: 'amount', range: { min: 10, max: 1 } }] },
    { comparePrevious: false },
    { leaderboardSort: { by: 'sql', direction: 'desc' } },
    { includeRows: 'true' },
  ])('rejects invalid or non-settings state %j', over => {
    expect(() => validateExploreViewState({ ...state(), ...over }, current)).toThrow();
  });
  it('allows all-time/no-dimensions and one-sided numeric range without comparison', () => {
    expect(
      validateExploreViewState(
        {
          ...state(),
          dateRange: null,
          comparePrevious: false,
          dimensionColumns: [],
          leaderboardSort: { by: 'value', direction: 'desc' },
          filters: [{ column: 'amount', range: { max: 0 } }],
        },
        current,
      ).filters,
    ).toEqual([{ column: 'amount', range: { max: 0 } }]);
  });
  it('migrates old saved rows idempotently and supports a fresh metadata database', async () => {
    const isolated = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
    const runner = isolated.createQueryRunner();
    try {
      await new AddPersonalViews1791854000000().up(runner);
      await runner.query(
        "INSERT INTO personal_view (dashboardId,userId,name,revision,state) VALUES (9,2,'legacy',?,?)",
        ['a'.repeat(64), '{}'],
      );
      const migration = new AddExploreViews1791941000000();
      await migration.up(runner);
      await migration.up(runner);
      expect(
        (await runner.query('SELECT dashboardId,sourceId,name,state FROM personal_view'))[0],
      ).toEqual({ dashboardId: 9, sourceId: null, name: 'legacy', state: '{}' });
      await runner.query(
        "INSERT INTO personal_view (dashboardId,sourceId,userId,name,revision,state) VALUES (NULL,3,2,'new',?,?)",
        ['a'.repeat(64), '{}'],
      );
      expect((await runner.query('SELECT count(*) n FROM personal_view'))[0].n).toBe(2);
    } finally {
      await runner.release();
      await isolated.destroy();
    }
  });
});
