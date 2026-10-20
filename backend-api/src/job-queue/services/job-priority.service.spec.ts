import { JobPriorityService } from './job-priority.service';
import { QueueJob, JobPriority, JobType, JobStatus } from '../entities/queue-job.entity';
import { Repository } from 'typeorm';

describe('JobPriorityService supported contract', () => {
  let service: JobPriorityService;
  let repo: jest.Mocked<Pick<Repository<QueueJob>, 'find' | 'findOne' | 'count' | 'update'>>;
  const now = new Date('2026-10-18T00:00:00Z'); // Sunday, outside weekday boost in every timezone.
  const job = (overrides: Partial<QueueJob> = {}) =>
    Object.assign(
      new QueueJob(),
      {
        id: 'job',
        jobType: JobType.QUERY_EXECUTION,
        status: JobStatus.PENDING,
        priority: JobPriority.NORMAL,
        retryCount: 0,
        maxRetries: 3,
        createdAt: now,
        estimatedTimeMs: 20000,
        userId: 'user',
      },
      overrides,
    );
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    jest.setSystemTime(now);
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    };
    service = new JobPriorityService(repo as unknown as Repository<QueueJob>);
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it('computes dynamic score and factors using the actual asynchronous API', async () => {
    const result = await service.calculateDynamicPriority(job());
    expect(result).toEqual({
      finalPriority: JobPriority.NORMAL,
      score: 3.3,
      factors: {
        basePriority: 2,
        age: 0,
        retry: 0,
        jobType: 1,
        systemLoad: 1,
        userType: 1,
        rules: 0.8,
      },
      appliedRules: ['Quick Queries'],
    });
    expect(repo.count).toHaveBeenCalledWith({ where: { status: JobStatus.RUNNING } });
  });
  it('accounts for base priority, capped age and retries', async () => {
    const standard = await service.calculateDynamicPriority(job());
    const result = await service.calculateDynamicPriority(
      job({
        priority: JobPriority.URGENT,
        createdAt: new Date(now.getTime() - 86400000),
        retryCount: 5,
      }),
    );
    expect(result.factors).toMatchObject({ basePriority: 4, age: 2, retry: 2 });
    expect(result.score).toBeGreaterThan(standard.score);
    expect(result.finalPriority).toBe(JobPriority.URGENT);
    expect(result.appliedRules).toContain('Retry Priority Boost');
  });
  it('uses a safe load fallback on repository errors', async () => {
    repo.count.mockRejectedValue(new Error('offline'));
    expect((await service.calculateDynamicPriority(job())).factors.systemLoad).toBe(0.5);
  });
  it('falls back to the original priority if calculation data is invalid', async () => {
    const input = job({ createdAt: null });
    expect(await service.calculateDynamicPriority(input)).toEqual({
      finalPriority: input.priority,
      score: 2,
      factors: {},
      appliedRules: [],
    });
  });
  it('adds, applies, removes and ignores a disabled custom rule', async () => {
    const id = service.addPriorityRule({
      name: 'Specific user',
      condition: { userId: ['user'] },
      priority: JobPriority.HIGH,
      enabled: true,
      weight: 30,
    });
    expect((await service.calculateDynamicPriority(job())).appliedRules).toContain('Specific user');
    expect(
      (await service.calculateDynamicPriority(job({ userId: 'other' }))).appliedRules,
    ).not.toContain('Specific user');
    expect(service.removePriorityRule(id)).toBe(true);
    expect(service.removePriorityRule(id)).toBe(false);
    service.addPriorityRule({
      name: 'Disabled',
      condition: {},
      priority: JobPriority.URGENT,
      enabled: false,
      weight: 100,
    });
    expect((await service.calculateDynamicPriority(job())).appliedRules).not.toContain('Disabled');
  });
  it('updates only pending jobs whose computed priority changes', async () => {
    repo.findOne.mockResolvedValue(job({ priority: JobPriority.LOW }));
    await service.updateJobPriority('job');
    expect(repo.update).toHaveBeenCalledWith('job', {
      priority: JobPriority.NORMAL,
      updatedAt: now,
    });
  });
  it.each([null, job({ status: JobStatus.COMPLETED }), job()])(
    'does not rewrite absent, finished or unchanged jobs %#',
    async input => {
      repo.findOne.mockResolvedValue(input);
      await service.updateJobPriority('job');
      expect(repo.update).not.toHaveBeenCalled();
    },
  );
  it('keeps individual priority update errors best-effort', async () => {
    repo.findOne.mockRejectedValue(new Error('offline'));
    await expect(service.updateJobPriority('job')).resolves.toBeUndefined();
  });
  it('counts bulk updates and failures independently', async () => {
    repo.find.mockResolvedValue([
      job({ id: 'a', priority: JobPriority.LOW }),
      job({ id: 'b', priority: JobPriority.LOW }),
      job({ id: 'c' }),
    ]);
    repo.update
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });
    expect(await service.recalculateAllPriorities()).toEqual({
      processed: 3,
      updated: 1,
      errors: 1,
    });
    expect(repo.find).toHaveBeenCalledWith({ where: { status: JobStatus.PENDING }, take: 1000 });
  });
  it('reports a bulk query failure without inventing processed rows', async () => {
    repo.find.mockRejectedValue(new Error('offline'));
    expect(await service.recalculateAllPriorities()).toEqual({
      processed: 0,
      updated: 0,
      errors: 1,
    });
  });
  it('returns distribution and wait averages without fabricated change/rule history', async () => {
    repo.find.mockResolvedValue([
      job({ priority: JobPriority.HIGH, startedAt: new Date(now.getTime() + 2000) }),
      job({ priority: JobPriority.HIGH, startedAt: new Date(now.getTime() + 4000) }),
      job(),
    ]);
    const result = await service.getPriorityStatistics();
    expect(result).toMatchObject({ totalJobs: 3, priorityChanges: 0, topAppliedRules: [] });
    expect(result.priorityDistribution[JobPriority.HIGH]).toBe(2);
    expect(result.averageWaitTimeByPriority[JobPriority.HIGH]).toBe(3000);
    expect(result.averageWaitTimeByPriority[JobPriority.LOW]).toBe(0);
  });
  it('propagates statistics query errors', async () => {
    repo.find.mockRejectedValue(new Error('offline'));
    await expect(service.getPriorityStatistics()).rejects.toThrow('offline');
  });
});
