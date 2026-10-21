import { JobRetryService } from './job-retry.service';
import { JobStatusTrackerService } from './job-status-tracker.service';
import { QueueJob, JobType, JobStatus } from '../entities/queue-job.entity';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

describe('JobRetryService supported contract', () => {
  let service: JobRetryService;
  let repo: jest.Mocked<
    Pick<Repository<QueueJob>, 'update' | 'find' | 'findOne' | 'createQueryBuilder'>
  >;
  let tracker: jest.Mocked<Pick<JobStatusTrackerService, 'recordStatusChange'>>;
  let query: SelectQueryBuilder<QueueJob> & { getMany: jest.Mock };
  const now = new Date('2026-10-20T00:00:00Z');
  const job = (overrides: Partial<QueueJob> = {}) =>
    Object.assign(
      new QueueJob(),
      {
        id: 'job',
        jobType: JobType.QUERY_EXECUTION,
        status: JobStatus.FAILED,
        retryCount: 0,
        maxRetries: 3,
      },
      overrides,
    );
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    jest.setSystemTime(now);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    query = Object.assign(
      new SelectQueryBuilder<QueueJob>(new DataSource({ type: 'sqlite', database: ':memory:' })),
      {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      },
    );
    repo = {
      update: jest.fn().mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] }),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    tracker = { recordStatusChange: jest.fn().mockResolvedValue(undefined) };
    service = new JobRetryService(
      repo as unknown as Repository<QueueJob>,
      tracker as unknown as JobStatusTrackerService,
    );
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it.each([
    [JobType.QUERY_EXECUTION, 2, 4500, 'connection timeout'],
    [JobType.BULK_DATA_EXPORT, 2, 120000, 'network'],
    [JobType.DASHBOARD_GENERATION, 1, 18000, 'temporary'],
    [JobType.DATA_MIGRATION, 1, 150000, 'network'],
    [JobType.CACHE_WARMUP, 2, 11250, 'syntax error'],
    [JobType.REPORT_GENERATION, 2, 60000, 'network'],
  ])(
    'schedules the existing %s strategy through persisted retry time',
    async (type, retryCount, delay, message) => {
      await service.scheduleRetry(
        job({ jobType: type, retryCount, maxRetries: 10 }),
        new Error(message),
      );
      expect(repo.update).toHaveBeenCalledWith(
        'job',
        expect.objectContaining({
          status: JobStatus.RETRY,
          retryCount: retryCount + 1,
          scheduledAt: new Date(now.getTime() + delay),
          errorMessage: message,
        }),
      );
      expect(tracker.recordStatusChange).toHaveBeenCalledWith(
        'job',
        JobStatus.RETRY,
        JobStatus.FAILED,
        expect.any(String),
        expect.objectContaining({
          retryDelay: delay,
          retryAt: new Date(now.getTime() + delay).toISOString(),
        }),
      );
    },
  );
  it.each([
    [JobType.QUERY_EXECUTION, 'syntax error'],
    [JobType.BULK_DATA_EXPORT, 'out of memory'],
    [JobType.DATA_MIGRATION, 'duplicate constraint'],
  ])('permanently fails non-retriable %s errors', async (type, message) => {
    await service.scheduleRetry(job({ jobType: type }), new Error(message));
    expect(repo.update).toHaveBeenCalledWith(
      'job',
      expect.objectContaining({ status: JobStatus.FAILED, completedAt: now }),
    );
    expect(tracker.recordStatusChange).toHaveBeenCalledWith(
      'job',
      JobStatus.FAILED,
      JobStatus.FAILED,
      expect.stringContaining('Permanently failed'),
      { permanentFailure: true },
    );
  });
  it('does not schedule an exhausted job using its real canRetry getter', async () => {
    await service.scheduleRetry(job({ retryCount: 3 }));
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('falls back to permanent failure when scheduling storage fails', async () => {
    repo.update.mockRejectedValueOnce(new Error('offline'));
    await service.scheduleRetry(job(), new Error('connection'));
    expect(repo.update).toHaveBeenLastCalledWith(
      'job',
      expect.objectContaining({ status: JobStatus.FAILED }),
    );
    expect(tracker.recordStatusChange).toHaveBeenCalledWith(
      'job',
      JobStatus.FAILED,
      JobStatus.FAILED,
      expect.stringContaining('offline'),
      { permanentFailure: true },
    );
  });
  it('manual retry clears execution state and records the transition', async () => {
    await service.retryJob(job());
    expect(repo.update).toHaveBeenCalledWith(
      'job',
      expect.objectContaining({
        status: JobStatus.PENDING,
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
        executionTimeMs: null,
        workerId: null,
        progress: 0,
      }),
    );
    expect(tracker.recordStatusChange).toHaveBeenCalledWith(
      'job',
      JobStatus.PENDING,
      JobStatus.RETRY,
      'Job manually retried',
      { manualRetry: true },
    );
  });
  it('rejects manual retry of a completed or exhausted job', async () => {
    await expect(service.retryJob(job({ status: JobStatus.COMPLETED }))).rejects.toThrow(
      'cannot be retried',
    );
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('propagates manual retry storage errors', async () => {
    repo.update.mockRejectedValue(new Error('offline'));
    await expect(service.retryJob(job())).rejects.toThrow('offline');
  });
  it('returns per-id success and failure without aborting the bulk operation', async () => {
    repo.findOne
      .mockResolvedValueOnce(job({ id: 'ok' }))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(job({ id: 'full', retryCount: 3 }))
      .mockRejectedValueOnce(new Error('offline'));
    expect(await service.bulkRetry(['ok', 'missing', 'full', 'broken'])).toEqual({
      successful: ['ok'],
      failed: [
        { jobId: 'missing', error: 'Job not found' },
        { jobId: 'full', error: 'Job cannot be retried' },
        { jobId: 'broken', error: 'offline' },
      ],
    });
  });
  it('aggregates retry counts, outcomes and categorized failure reasons', async () => {
    query.getMany.mockResolvedValue([
      job({ status: JobStatus.COMPLETED, retryCount: 2 }),
      job({ retryCount: 1, errorMessage: 'connection timeout' }),
      job({ retryCount: 3, errorMessage: 'unauthorized' }),
    ]);
    expect(await service.getRetryStatistics()).toMatchObject({
      totalRetries: 6,
      successfulRetries: 1,
      failedRetries: 2,
      averageRetryCount: 2,
      retrySuccessRate: 33.33,
      commonFailureReasons: [
        { reason: 'Timeout', count: 1 },
        { reason: 'Permission Error', count: 1 },
      ],
    });
  });
  it('handles no retry samples', async () => {
    expect(await service.getRetryStatistics()).toMatchObject({
      totalRetries: 0,
      averageRetryCount: 0,
      retrySuccessRate: 0,
      commonFailureReasons: [],
    });
  });
  it('propagates retry-statistics errors', async () => {
    query.getMany.mockRejectedValue(new Error('offline'));
    await expect(service.getRetryStatistics()).rejects.toThrow('offline');
  });
  it('queries the bounded failed-job list and propagates query failure', async () => {
    repo.find.mockResolvedValue([job()]);
    expect(await service.getRetriableJobs()).toHaveLength(1);
    expect(repo.find).toHaveBeenCalledWith({
      where: { status: JobStatus.FAILED },
      order: { updatedAt: 'DESC' },
      take: 100,
    });
    repo.find.mockRejectedValue(new Error('offline'));
    await expect(service.getRetriableJobs()).rejects.toThrow('offline');
  });
  it('keeps updateRetryConfig as its existing log-only API', async () => {
    await expect(
      service.updateRetryConfig(JobType.QUERY_EXECUTION, { maxRetries: 5 }),
    ).resolves.toBeUndefined();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
