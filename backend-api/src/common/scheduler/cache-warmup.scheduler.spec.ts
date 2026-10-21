import { ForbiddenException } from '@nestjs/common';
import { CacheWarmupScheduler } from './cache-warmup.scheduler';

jest.mock('../../dataset/dataset.service', () => ({ DatasetService: class {} }));
jest.mock('../../dashboard/dashboard.service', () => ({ DashboardService: class {} }));
jest.mock('../../dashboard/dashboard-cache.service', () => ({ DashboardCacheService: class {} }));
jest.mock('../../ownership/source-access.service', () => ({ SourceAccessService: class {} }));

describe('CacheWarmupScheduler owner boundaries', () => {
  let scheduler: CacheWarmupScheduler;
  let executeCachedQuery: jest.Mock;
  let access: any;
  let manager: any;
  let dashboardService: any;
  let widgetRepository: any;

  beforeEach(() => {
    manager = { findOne: jest.fn().mockResolvedValue({ id: 7, active: true }) };
    executeCachedQuery = jest.fn().mockResolvedValue({ status: 'SUCCESS' });
    access = {
      actor: jest.fn(actor => {
        if (!Number.isSafeInteger(actor) || actor <= 0) throw new ForbiddenException();
        return actor;
      }),
      assert: jest.fn().mockResolvedValue(undefined),
      dashboard: jest.fn().mockResolvedValue(undefined),
    };
    dashboardService = { findOne: jest.fn().mockResolvedValue({ status: 'SUCCESS', data: {} }) };
    const builder: any = {};
    for (const method of ['innerJoin', 'where', 'andWhere', 'select']) {
      builder[method] = jest.fn().mockReturnValue(builder);
    }
    builder.getMany = jest.fn().mockResolvedValue([{ datasetId: 11 }, { datasetId: 11 }]);
    widgetRepository = { createQueryBuilder: jest.fn().mockReturnValue(builder) };
    scheduler = new CacheWarmupScheduler(
      { manager } as any,
      { manager } as any,
      widgetRepository,
      { executeCachedQuery } as any,
      dashboardService,
      {} as any,
      { log: jest.fn(), debug: jest.fn() } as any,
      access,
    );
    jest.spyOn((scheduler as any).logger, 'error').mockImplementation(() => undefined);
  });

  it('requires the current dataset owner before querying', async () => {
    await scheduler.warmupDataset(11, 300, 7);
    expect(access.assert).toHaveBeenCalledWith('dataset', 11, 7, 'owner');
    expect(access.assert.mock.invocationCallOrder[0]).toBeLessThan(
      executeCachedQuery.mock.invocationCallOrder[0],
    );
    expect(executeCachedQuery).toHaveBeenCalledWith(11, { forceRefresh: true, customTtl: 300 });
  });

  it.each(['missing actor', 'inactive actor', 'ownership revoked'])(
    'does not execute with %s',
    async failure => {
      if (failure === 'inactive actor') manager.findOne.mockResolvedValue(null);
      if (failure === 'ownership revoked')
        access.assert.mockRejectedValue(new ForbiddenException());
      await expect(
        scheduler.warmupDataset(11, undefined, failure === 'missing actor' ? undefined : 7),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(executeCachedQuery).not.toHaveBeenCalled();
    },
  );

  it('passes the actor to dashboard reads and warms each mapped dataset once', async () => {
    await scheduler.warmupDashboard(21, 7);
    expect(access.dashboard).toHaveBeenCalledWith(21, 7, 'owner');
    expect(dashboardService.findOne).toHaveBeenCalledWith(21, 7);
    expect(widgetRepository.createQueryBuilder().where).toHaveBeenCalledWith(
      'link.dashboardId = :dashboardId',
      { dashboardId: 21 },
    );
    expect(executeCachedQuery).toHaveBeenCalledTimes(1);
  });

  it('does not read dashboard contents or run SQL after owner denial', async () => {
    access.dashboard.mockRejectedValue(new ForbiddenException());
    await expect(scheduler.warmupDashboard(21, 7)).rejects.toBeInstanceOf(ForbiddenException);
    expect(dashboardService.findOne).not.toHaveBeenCalled();
    expect(executeCachedQuery).not.toHaveBeenCalled();
  });
});
