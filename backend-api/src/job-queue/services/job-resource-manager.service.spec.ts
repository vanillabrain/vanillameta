import { JobResourceManagerService } from './job-resource-manager.service';
import { QueueJob, JobType } from '../entities/queue-job.entity';
import { Repository } from 'typeorm';

describe('JobResourceManagerService supported allocation contract', () => {
  let service: JobResourceManagerService;
  let interval: jest.SpyInstance;
  let repo: jest.Mocked<Pick<Repository<QueueJob>, 'count'>>;
  const now = new Date('2026-10-20T00:00:00Z');
  const job = (overrides: Partial<QueueJob> = {}) =>
    Object.assign(
      new QueueJob(),
      {
        id: 'job',
        jobType: JobType.QUERY_EXECUTION,
        retryCount: 0,
        estimatedTimeMs: 300000,
        metadata: null,
      },
      overrides,
    );
  const flush = () =>
    new Promise<void>(resolve => jest.requireActual('timers').setImmediate(resolve));
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    interval = jest.spyOn(global, 'setInterval');
    jest.setSystemTime(now);
    repo = { count: jest.fn().mockResolvedValue(0) };
    service = new JobResourceManagerService(repo as unknown as Repository<QueueJob>);
  });
  afterEach(() => {
    service?.onModuleDestroy();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('initializes the existing four pools with zero use and bounded capacity', () => {
    const usage = service.getResourceUsage();
    expect(usage.totalAllocations).toBe(0);
    expect(Object.fromEntries(usage.pools.map(p => [p.id, p.maxCapacity]))).toEqual({
      cpu: 4,
      memory: 3000,
      database: 20,
      network: 1000,
    });
    for (const p of usage.pools)
      expect(p).toMatchObject({
        currentUsage: 0,
        reservedCapacity: 0,
        availableCapacity: p.maxCapacity,
        queuedJobs: [],
      });
  });
  it('allocates the documented query requirements and release time', async () => {
    expect(await service.allocateResources(job())).toEqual({
      success: true,
      allocation: {
        jobId: 'job',
        allocatedResources: { cpu: 0.2, memory: 128, database: 1, network: 10, duration: 300000 },
        allocatedAt: now,
        estimatedReleaseAt: new Date(now.getTime() + 300000),
      },
    });
    expect(service.getResourceUsage().totalAllocations).toBe(1);
    expect(service.getResourceUsage().utilizationRates.cpu).toBe(5);
  });
  it.each([
    [JobType.BULK_DATA_EXPORT, 0.5, 512, 2, 100],
    [JobType.DASHBOARD_GENERATION, 0.3, 256, 3, 50],
    [JobType.DATA_MIGRATION, 0.8, 1024, 4, 200],
    [JobType.CACHE_WARMUP, 0.4, 256, 2, 30],
    [JobType.REPORT_GENERATION, 0.6, 512, 2, 80],
  ])('uses actual per-type requirements for %s', async (type, cpu, memory, database, network) => {
    const result = await service.allocateResources(job({ jobType: type }));
    expect(result).toMatchObject({
      success: true,
      allocation: { allocatedResources: { cpu, memory, database, network } },
    });
  });
  it('derives adjustments from real parsed metadata, runtime and retry values', async () => {
    const result = await service.allocateResources(
      job({
        metadata: JSON.stringify({ dataSize: 100 * 1024 * 1024 }),
        estimatedTimeMs: 600000,
        retryCount: 1,
      }),
    );
    expect(result.allocation.allocatedResources.cpu).toBeCloseTo(0.36);
    expect(result.allocation.allocatedResources.memory).toBe(240);
  });
  it('refuses exhausted resources without partially adding an allocation', async () => {
    for (let i = 0; i < 5; i++)
      expect(
        (await service.allocateResources(job({ id: String(i), jobType: JobType.BULK_DATA_EXPORT })))
          .success,
      ).toBe(true);
    const result = await service.allocateResources(
      job({ id: 'overflow', jobType: JobType.BULK_DATA_EXPORT }),
    );
    expect(result).toMatchObject({
      success: false,
      reason: expect.stringContaining('Insufficient memory'),
      waitTime: 300000,
    });
    expect(service.getResourceUsage().totalAllocations).toBe(5);
  });
  it('releases every allocated resource and tolerates repeated/unknown releases', async () => {
    await service.allocateResources(job());
    await service.releaseResources('job');
    await service.releaseResources('job');
    await service.releaseResources('unknown');
    const usage = service.getResourceUsage();
    expect(usage.totalAllocations).toBe(0);
    for (const p of usage.pools) expect(p.currentUsage).toBe(0);
  });
  it('reserves capacity, refuses oversubscription and unreserves at its timer', async () => {
    expect(await service.reserveResources('reserved', { cpu: 3, memory: 2000 }, 1000)).toBe(true);
    expect(await service.reserveResources('overflow', { cpu: 2 }, 1000)).toBe(false);
    expect(service.getResourceUsage().pools.find(p => p.id === 'cpu')).toMatchObject({
      reservedCapacity: 3,
      availableCapacity: 1,
      currentUsage: 0,
    });
    jest.advanceTimersByTime(1000);
    expect(service.getResourceUsage().pools.find(p => p.id === 'cpu')).toMatchObject({
      reservedCapacity: 0,
      availableCapacity: 4,
    });
  });
  it('reports actual low-utilization recommendations and high-utilization bottlenecks', async () => {
    expect(service.getOptimizationRecommendations()).toMatchObject({
      potentialSavings: { cpu: 3.2, memory: 2400, database: 16, network: 800 },
      bottlenecks: [],
    });
    for (let i = 0; i < 5; i++)
      await service.allocateResources(job({ id: String(i), jobType: JobType.BULK_DATA_EXPORT }));
    await service.allocateResources(job({ id: 'extra', jobType: JobType.DASHBOARD_GENERATION }));
    expect(service.getOptimizationRecommendations().bottlenecks).toContainEqual(
      expect.stringContaining('Memory Pool'),
    );
  });
  it('identifies allocation age without mutating internal private maps', async () => {
    await service.allocateResources(job());
    jest.setSystemTime(new Date(now.getTime() + 1800001));
    expect(service.getOptimizationRecommendations().recommendations).toContainEqual(
      expect.stringContaining('1개의 장시간 실행 작업'),
    );
  });
  it('updates estimated CPU from repository counts only on the monitoring interval', async () => {
    repo.count.mockResolvedValue(2);
    jest.advanceTimersByTime(30000);
    await flush();
    const pool = service.getResourceUsage().pools.find(p => p.id === 'cpu');
    expect(pool.currentUsage).toBeCloseTo(0.6);
    expect(repo.count).toHaveBeenCalledTimes(1);
  });
  it('releases expired allocations from the actual monitoring callback', async () => {
    await service.allocateResources(job({ estimatedTimeMs: 1000 }));
    jest.advanceTimersByTime(30000);
    await flush();
    expect(service.getResourceUsage().totalAllocations).toBe(0);
    expect(service.getResourceUsage().pools.find(p => p.id === 'memory').currentUsage).toBe(0);
  });
  it('contains periodic repository errors and preserves bounded pools', async () => {
    repo.count.mockRejectedValue(new Error('offline'));
    jest.advanceTimersByTime(30000);
    await flush();
    expect(service.getResourceUsage().totalAllocations).toBe(0);
    for (const p of service.getResourceUsage().pools)
      expect(p.availableCapacity).toBeGreaterThanOrEqual(0);
  });
  it('returns allocation failure rather than throwing for invalid parsed metadata', async () => {
    const result = await service.allocateResources(job({ metadata: 'null' }));
    expect(result).toEqual({ success: false, reason: 'Resource allocation error' });
    expect(service.getResourceUsage().totalAllocations).toBe(0);
  });
  it('unrefs monitoring and reservation timers and cancels callbacks on teardown', async () => {
    expect(interval.mock.results[0].value.hasRef()).toBe(false);
    const timeout = jest.spyOn(global, 'setTimeout');
    expect(await service.reserveResources('reserved', { cpu: 1 }, 60000)).toBe(true);
    expect(timeout.mock.results[0].value.hasRef()).toBe(false);
    expect(jest.getTimerCount()).toBe(2);
    const before = JSON.stringify(service.getResourceUsage());
    service.onModuleDestroy();
    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(120000);
    await flush();
    expect(repo.count).not.toHaveBeenCalled();
    expect(JSON.stringify(service.getResourceUsage())).toBe(before);
  });
});
