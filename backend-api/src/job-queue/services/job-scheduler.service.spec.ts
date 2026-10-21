import { JobSchedulerService } from './job-scheduler.service';
import { JobProcessorService } from './job-processor.service';
import { QueueJob, JobStatus, JobPriority, JobType } from '../entities/queue-job.entity';
import { LessThanOrEqual, Repository } from 'typeorm';

describe('JobSchedulerService supported public/timer behavior', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  let service: JobSchedulerService;
  let interval: jest.SpyInstance;
  let repo: jest.Mocked<Pick<Repository<QueueJob>, 'find' | 'findOne' | 'count' | 'update'>>;
  let processor: jest.Mocked<Pick<JobProcessorService, 'processJob'>>;
  const job = (overrides: Partial<QueueJob> = {}) =>
    Object.assign(
      new QueueJob(),
      {
        id: 'job',
        jobType: JobType.QUERY_EXECUTION,
        status: JobStatus.PENDING,
        priority: JobPriority.NORMAL,
        createdAt: now,
        retryCount: 0,
        maxRetries: 3,
      },
      overrides,
    );
  const flush = () =>
    new Promise<void>(resolve => jest.requireActual('timers').setImmediate(resolve));
  const tick = async (ms = 5000) => {
    jest.advanceTimersByTime(ms);
    await flush();
  };
  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    interval = jest.spyOn(global, 'setInterval');
    jest.setSystemTime(now);
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(job()),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    };
    processor = { processJob: jest.fn().mockResolvedValue(undefined) };
    service = new JobSchedulerService(
      repo as unknown as Repository<QueueJob>,
      processor as unknown as JobProcessorService,
    );
    await flush(); // Let the constructor's existing asynchronous bootstrap complete.
  });
  afterEach(() => {
    service?.onModuleDestroy();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('loads pending/retry jobs on startup without immediately processing them', () => {
    expect(repo.find).toHaveBeenCalledWith({
      where: [{ status: JobStatus.PENDING }, { status: JobStatus.RETRY }],
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
    expect(service.getSchedulerStatus()).toMatchObject({
      queueLength: 0,
      scheduledJobsCount: 0,
      isProcessing: false,
      config: { batchSize: 5, maxConcurrentJobs: 10 },
    });
    expect(processor.processJob).not.toHaveBeenCalled();
  });
  it('deduplicates queued IDs and processes only on its interval', async () => {
    await service.scheduleJob(job());
    await service.scheduleJob(job());
    expect(service.getSchedulerStatus()).toMatchObject({ queueLength: 1, scheduledJobsCount: 1 });
    await tick();
    expect(processor.processJob).toHaveBeenCalledTimes(1);
    expect(service.getSchedulerStatus()).toMatchObject({
      queueLength: 0,
      scheduledJobsCount: 0,
      isProcessing: false,
    });
  });
  it('holds future jobs until their scheduled timer activates them', async () => {
    await service.scheduleJob(job({ scheduledAt: new Date(now.getTime() + 12000) }));
    expect(service.getSchedulerStatus()).toMatchObject({ queueLength: 0, scheduledJobsCount: 1 });
    await tick(10000);
    expect(processor.processJob).not.toHaveBeenCalled();
    await tick(2000);
    expect(service.getSchedulerStatus().queueLength).toBe(1);
    await tick(3000);
    expect(processor.processJob).toHaveBeenCalledTimes(1);
  });
  it('removed delayed jobs are not reinserted by their timer', async () => {
    await service.scheduleJob(job({ scheduledAt: new Date(now.getTime() + 12000) }));
    await service.removeJob('job');
    await tick(15000);
    expect(service.getSchedulerStatus()).toMatchObject({ queueLength: 0, scheduledJobsCount: 0 });
    expect(processor.processJob).not.toHaveBeenCalled();
  });
  it('orders jobs by supported priority score with age adjustment', async () => {
    const entries = [
      job({ id: 'normal' }),
      job({ id: 'urgent', priority: JobPriority.URGENT }),
      job({ id: 'old', priority: JobPriority.LOW, createdAt: new Date(now.getTime() - 7200000) }),
    ];
    repo.findOne.mockImplementation(async options =>
      entries.find(j => j.id === (options.where as { id: string }).id),
    );
    for (const entry of entries) await service.scheduleJob(entry);
    await tick();
    expect(processor.processJob.mock.calls.map(([j]) => j.id)).toEqual(['urgent', 'old', 'normal']);
  });
  it('honors available slots and configured batch size', async () => {
    service.updateConfig({ maxConcurrentJobs: 3, batchSize: 1 });
    repo.count.mockResolvedValue(2);
    const a = job({ id: 'a' }),
      b = job({ id: 'b' });
    await service.scheduleJob(a);
    await service.scheduleJob(b);
    repo.findOne.mockResolvedValue(a);
    await tick();
    expect(processor.processJob).toHaveBeenCalledTimes(1);
    expect(service.getSchedulerStatus().queueLength).toBe(1);
  });
  it('fails closed on running-count read failure and retries a later interval', async () => {
    await service.scheduleJob(job());
    repo.count.mockRejectedValueOnce(new Error('offline'));
    await tick();
    expect(processor.processJob).not.toHaveBeenCalled();
    expect(service.getSchedulerStatus().queueLength).toBe(1);
    await tick();
    expect(processor.processJob).toHaveBeenCalledTimes(1);
  });
  it('does not enter a second processing batch while a processor is pending', async () => {
    let finish: () => void;
    processor.processJob.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    await service.scheduleJob(job());
    await tick();
    expect(service.getSchedulerStatus().isProcessing).toBe(true);
    await tick();
    expect(processor.processJob).toHaveBeenCalledTimes(1);
    finish();
    await flush();
    expect(service.getSchedulerStatus().isProcessing).toBe(false);
  });
  it.each([null, job({ status: JobStatus.CANCELLED })])(
    'skips absent or no-longer-pending DB jobs %#',
    async current => {
      repo.findOne.mockResolvedValue(current);
      await service.scheduleJob(job());
      await tick();
      expect(processor.processJob).not.toHaveBeenCalled();
      expect(service.getSchedulerStatus().scheduledJobsCount).toBe(0);
    },
  );
  it('records processor failure and lets the scheduler continue', async () => {
    processor.processJob.mockRejectedValueOnce(new Error('processor failed'));
    await service.scheduleJob(job());
    await tick();
    expect(repo.update).toHaveBeenCalledWith(
      'job',
      expect.objectContaining({
        status: JobStatus.FAILED,
        errorMessage: 'processor failed',
        completedAt: expect.any(Date),
      }),
    );
    expect(service.getSchedulerStatus().isProcessing).toBe(false);
  });
  it('keeps failure-record write errors contained', async () => {
    processor.processJob.mockRejectedValue(new Error('processor failed'));
    repo.update.mockRejectedValue(new Error('offline'));
    await service.scheduleJob(job());
    await expect(tick()).resolves.toBeUndefined();
    expect(service.getSchedulerStatus().isProcessing).toBe(false);
  });
  it('activates the public scheduled-job query without duplicating IDs', async () => {
    repo.find.mockResolvedValue([job()]);
    await service.activateScheduledJobs();
    await service.activateScheduledJobs();
    expect(repo.find).toHaveBeenLastCalledWith({
      where: { status: JobStatus.PENDING, scheduledAt: LessThanOrEqual(now) },
      take: 100,
    });
    expect(service.getSchedulerStatus().queueLength).toBe(1);
  });
  it('marks zombie rows failed at the supported thirty-minute cutoff', async () => {
    repo.find.mockResolvedValue([job({ status: JobStatus.RUNNING })]);
    await service.cleanupZombieJobs();
    expect(repo.find).toHaveBeenLastCalledWith({
      where: {
        status: JobStatus.RUNNING,
        startedAt: LessThanOrEqual(new Date(now.getTime() - 1800000)),
      },
    });
    expect(repo.update).toHaveBeenCalledWith('job', {
      status: JobStatus.FAILED,
      errorMessage: 'Job timed out (zombie process cleanup)',
      completedAt: now,
    });
  });
  it('keeps activation and zombie query failures best-effort', async () => {
    repo.find.mockRejectedValue(new Error('offline'));
    await expect(service.activateScheduledJobs()).resolves.toBeUndefined();
    await expect(service.cleanupZombieJobs()).resolves.toBeUndefined();
  });
  it('unrefs processing and delayed timers and clears both idempotently on teardown', async () => {
    expect(interval.mock.results[0].value.hasRef()).toBe(false);
    const timeout = jest.spyOn(global, 'setTimeout');
    await service.scheduleJob(job({ id: 'queued' }));
    await service.scheduleJob(job({ id: 'future', scheduledAt: new Date(now.getTime() + 12000) }));
    expect(timeout.mock.results[0].value.hasRef()).toBe(false);
    expect(jest.getTimerCount()).toBe(2);
    service.onModuleDestroy();
    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    await tick(20000);
    expect(processor.processJob).not.toHaveBeenCalled();
    expect(repo.count).not.toHaveBeenCalled();
    expect(service.getSchedulerStatus()).toMatchObject({ queueLength: 1, scheduledJobsCount: 2 });
  });
  it('does not resurrect timers or queued jobs when bootstrap resolves after teardown', async () => {
    service.onModuleDestroy();
    let finish: (jobs: QueueJob[]) => void;
    repo.find.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    service = new JobSchedulerService(
      repo as unknown as Repository<QueueJob>,
      processor as unknown as JobProcessorService,
    );
    service.onModuleDestroy();
    finish([job({ scheduledAt: new Date(now.getTime() + 12000) })]);
    await flush();
    expect(jest.getTimerCount()).toBe(0);
    expect(service.getSchedulerStatus()).toMatchObject({ queueLength: 0, scheduledJobsCount: 0 });
    expect(processor.processJob).not.toHaveBeenCalled();
  });
});
