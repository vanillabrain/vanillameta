import { CacheInvalidationService } from './cache-invalidation.service';
import { DatasetType } from '../enum/dataset-type.enum';
import { DashboardWidget } from '../../dashboard/dashboard-widget/entities/dashboard-widget.entity';

jest.mock(
  '@nestjs/event-emitter',
  () => ({ EventEmitter2: class {}, OnEvent: () => () => undefined }),
  { virtual: true },
);
jest.mock('../../dataset/dataset.service', () => ({ DatasetService: class {} }));
jest.mock('../../dashboard/dashboard-cache.service', () => ({ DashboardCacheService: class {} }));
jest.mock('../../ownership/source-access.service', () => ({ SourceAccessService: class {} }));

describe('CacheInvalidationService dashboard-widget mappings', () => {
  let service: CacheInvalidationService;
  let widgets: any;
  let datasetService: any;
  let dashboards: any;
  let access: any;
  beforeEach(() => {
    jest.spyOn(global, 'setInterval').mockImplementation(() => ({} as any));
    widgets = {
      find: jest.fn(),
      manager: { find: jest.fn(), findOne: jest.fn().mockResolvedValue({ id: 7 }) },
    };
    datasetService = { invalidateDatasetCache: jest.fn() };
    dashboards = { invalidateDashboard: jest.fn() };
    access = { actor: jest.fn(actor => actor), assert: jest.fn().mockResolvedValue(undefined) };
    service = new CacheInvalidationService(
      {} as any,
      datasetService,
      dashboards,
      { log: jest.fn() } as any,
      { emit: jest.fn() } as any,
      widgets,
      {} as any,
      access,
    );
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  const cascade = { cascade: true, immediate: true, async: false };

  it('invalidates every dashboard mapped to dataset widgets without duplicate work', async () => {
    widgets.find.mockResolvedValue([{ id: 8 }, { id: 9 }]);
    widgets.manager.find.mockResolvedValue([
      { dashboardId: 21 },
      { dashboardId: 22 },
      { dashboardId: 21 },
    ]);
    await service.invalidateDataset(11, cascade);
    expect(widgets.manager.find).toHaveBeenCalledWith(DashboardWidget, expect.any(Object));
    expect(dashboards.invalidateDashboard.mock.calls).toEqual([[21], [22]]);
  });

  it('does not scan unrelated dashboard links when a dataset has no widgets', async () => {
    widgets.find.mockResolvedValue([]);
    await service.invalidateDataset(11, cascade);
    expect(widgets.manager.find).not.toHaveBeenCalled();
    expect(dashboards.invalidateDashboard).not.toHaveBeenCalled();
  });

  it('loads dashboard widgets through mapping IDs before invalidating datasets', async () => {
    widgets.manager.find.mockResolvedValue([{ widgetId: 8 }, { widgetId: 9 }]);
    widgets.find.mockResolvedValue([
      { datasetId: 11, datasetType: DatasetType.DATASET },
      { datasetId: 11, datasetType: DatasetType.DATASET },
      { datasetId: 12, datasetType: DatasetType.TABLE },
    ]);
    await service.invalidateDashboard(21, cascade);
    expect(widgets.manager.find).toHaveBeenCalledWith(DashboardWidget, {
      where: { dashboardId: 21 },
    });
    expect(widgets.find.mock.calls[0][0].where.id.value).toEqual([8, 9]);
    expect(datasetService.invalidateDatasetCache.mock.calls).toEqual([[11]]);
  });

  it('rechecks the queued actor and blocks invalidation after ownership revocation', async () => {
    jest.spyOn(service as any, 'processQueue').mockResolvedValue(undefined);
    await service.invalidateDataset(11, { ...cascade, async: true, actor: 7 });
    const queued = (service as any).invalidationQueue[0];
    expect(queued.policy.actor).toBe(7);
    access.assert.mockRejectedValue(new Error('owner revoked'));
    await expect((service as any).processInvalidationEvent(queued)).rejects.toThrow(
      'owner revoked',
    );
    expect(datasetService.invalidateDatasetCache).not.toHaveBeenCalled();
  });
});
