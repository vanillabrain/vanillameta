import { DataSource } from 'typeorm';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardPivotService } from './dashboard-pivot.service';
import { exploreViewRevision } from './explore-view-state';
jest.mock('./bi-explore.service', () => ({ BiExploreService: class {} }));
jest.mock('./explore-view.service', () => ({ ExploreViewService: class {} }));
describe('dashboard Pivot snapshots', () => {
  let db: DataSource,
    service: DashboardPivotService,
    access: any,
    views: any,
    explore: any,
    state: any;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Dashboard],
      synchronize: true,
    }).initialize();
    await db.getRepository(Dashboard).save({
      id: 1,
      title: 'Board',
      analysisDefinition: JSON.stringify({ databaseId: 3 }),
      layout: '[]',
    });
    const catalog: any = {
      sourceId: 3,
      sourceRevision: 'rev',
      measures: [{ id: 1 }],
      dimensions: [
        { column: 'device', type: 'VARCHAR' },
        { column: 'app', type: 'VARCHAR' },
      ],
      temporalColumns: [],
    };
    catalog.viewRevision = exploreViewRevision(catalog);
    state = {
      version: 1,
      mode: 'pivot',
      pivot: { rowDimensions: ['device'], columnDimensions: ['app'] },
      measureIds: [1],
      dimensionColumns: ['device'],
      rankingMeasureId: 1,
      leaderboardSort: { by: 'value', direction: 'desc' },
      filters: [],
      dateRange: null,
      relativePeriod: null,
      trendGrain: 'day',
      comparePrevious: false,
      includeRows: false,
    };
    access = {
      id: (x: any) => Number(x),
      assert: jest.fn(async (_k, _id, actor) => {
        if (actor !== 2) throw new Error('denied');
      }),
    };
    views = {
      load: jest.fn(async () => ({
        data: { id: 7, name: 'Saved Pivot', state, revision: catalog.viewRevision },
      })),
    };
    explore = { catalog: jest.fn(async () => catalog) };
    service = new DashboardPivotService(db.getRepository(Dashboard), access, views, explore);
  });
  afterEach(async () => db.destroy());
  it('copies saved snapshot, restores after service reload and preserves other dashboard definitions', async () => {
    const added = await service.add(1, 2, { sourceId: 3, viewId: 7 });
    state.pivot.rowDimensions = ['app'];
    const fresh = new DashboardPivotService(db.getRepository(Dashboard), access, views, explore);
    const list = await fresh.list(1, 2);
    expect(list.data[0].state.pivot.rowDimensions).toEqual(['device']);
    expect(list.data[0].sourceRevision).toBe('rev');
    await fresh.remove(1, added.data.id, 2);
    expect((await fresh.list(1, 2)).data).toEqual([]);
    expect((await db.getRepository(Dashboard).findOneBy({ id: 1 })).analysisDefinition).toBe(
      JSON.stringify({ databaseId: 3 }),
    );
  });
  it('rejects foreign ownership, other source, non-Pivot and over limit', async () => {
    await expect(service.add(1, 9, { sourceId: 3, viewId: 7 })).rejects.toThrow('denied');
    expect(views.load).not.toHaveBeenCalled();
    await expect(service.add(1, 2, { sourceId: 4, viewId: 7 })).rejects.toThrow('데이터 소스');
    await expect(service.add(1, 2, { sourceId: 3, viewId: 7, sql: 'bad' })).rejects.toThrow();
    state.mode = 'explore';
    await expect(service.add(1, 2, { sourceId: 3, viewId: 7 })).rejects.toThrow('Pivot 보기');
    state.mode = 'pivot';
    for (let i = 0; i < 8; i++) await service.add(1, 2, { sourceId: 3, viewId: 7 });
    await expect(service.add(1, 2, { sourceId: 3, viewId: 7 })).rejects.toThrow('최대 8');
  });
  it('reports changed metric definitions without silently changing snapshots', async () => {
    await service.add(1, 2, { sourceId: 3, viewId: 7 });
    explore.catalog.mockResolvedValue({ ...(await explore.catalog()), viewRevision: 'changed' });
    const list = await service.list(1, 2);
    expect(list.data[0].error).toContain('정의가 변경');
    expect(list.data[0].state).toBeUndefined();
    const row = await db.getRepository(Dashboard).findOneBy({ id: 1 });
    expect(JSON.parse(row.pivotDefinitions)[0].state).toEqual(state);
    await service.remove(1, list.data[0].id, 2);
    expect((await service.list(1, 2)).data).toEqual([]);
  });
});
