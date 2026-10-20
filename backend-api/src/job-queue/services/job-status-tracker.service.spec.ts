import { JobStatusTrackerService } from './job-status-tracker.service';
import { QueueJob, JobStatus } from '../entities/queue-job.entity';
import { JobStatusHistory } from '../entities/job-status-history.entity';
import { Between, DataSource, Repository, SelectQueryBuilder } from 'typeorm';

describe('JobStatusTrackerService supported contract', () => {
  let service: JobStatusTrackerService;
  let history: jest.Mocked<
    Pick<Repository<JobStatusHistory>, 'save' | 'find' | 'createQueryBuilder'>
  >;
  let jobs: jest.Mocked<
    Pick<Repository<QueueJob>, 'findOne' | 'find' | 'update' | 'createQueryBuilder'>
  >;
  let query: SelectQueryBuilder<JobStatusHistory> & { getMany: jest.Mock; execute: jest.Mock };
  let counts: SelectQueryBuilder<QueueJob> & { getRawMany: jest.Mock };
  const now = new Date('2026-10-20T01:00:00Z');
  const change = (overrides: Partial<JobStatusHistory> = {}) =>
    Object.assign(
      new JobStatusHistory(),
      {
        id: 'change',
        jobId: 'job',
        status: JobStatus.COMPLETED,
        previousStatus: JobStatus.RUNNING,
        executionTimeMs: 1000,
        createdAt: now,
      },
      overrides,
    );
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    jest.setSystemTime(now);
    query = Object.assign(
      new SelectQueryBuilder<JobStatusHistory>(
        new DataSource({ type: 'sqlite', database: ':memory:' }),
      ),
      {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      },
    );
    counts = Object.assign(
      new SelectQueryBuilder<QueueJob>(new DataSource({ type: 'sqlite', database: ':memory:' })),
      {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      },
    );
    history = {
      save: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    jobs = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(counts),
    };
    service = new JobStatusTrackerService(
      history as unknown as Repository<JobStatusHistory>,
      jobs as unknown as Repository<QueueJob>,
    );
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  it('persists a real history entity and then exposes its event with details and actor separated', async () => {
    await service.recordStatusChange(
      'job',
      JobStatus.RUNNING,
      JobStatus.PENDING,
      'Picked up',
      { workerId: 'worker' },
      'actor',
      25,
    );
    expect(history.save).toHaveBeenCalledWith(expect.any(JobStatusHistory));
    const saved = history.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      jobId: 'job',
      status: JobStatus.RUNNING,
      previousStatus: JobStatus.PENDING,
      details: '{"workerId":"worker"}',
      changedBy: 'actor',
      progress: 25,
      createdAt: now,
    });
    expect(service.getRecentStatusEvents()).toEqual([
      {
        jobId: 'job',
        status: JobStatus.RUNNING,
        previousStatus: JobStatus.PENDING,
        reason: 'Picked up',
        details: { workerId: 'worker' },
        changedBy: 'actor',
        timestamp: now,
      },
    ]);
  });
  it('propagates persistence failure without adding a successful memory event', async () => {
    history.save.mockRejectedValue(new Error('offline'));
    await expect(service.recordStatusChange('job', JobStatus.RUNNING)).rejects.toThrow('offline');
    expect(service.getRecentStatusEvents()).toEqual([]);
  });
  it('returns newest-first bounded and per-job memory events', async () => {
    await service.recordStatusChange('a', JobStatus.PENDING);
    await service.recordStatusChange('b', JobStatus.RUNNING);
    await service.recordStatusChange('a', JobStatus.COMPLETED);
    expect(service.getRecentStatusEvents(2).map(e => e.jobId)).toEqual(['a', 'b']);
    expect(service.getJobStatusEvents('a', 1).map(e => e.status)).toEqual([JobStatus.COMPLETED]);
  });
  it('bounds its retained event stream at 1000 events', async () => {
    for (let i = 0; i < 1002; i++) await service.recordStatusChange(String(i), JobStatus.PENDING);
    const events = service.getRecentStatusEvents(2000);
    expect(events).toHaveLength(1000);
    expect(events[0].jobId).toBe('1001');
    expect(events.at(-1).jobId).toBe('2');
  });
  it('reads bounded history from the repository and propagates failures', async () => {
    history.find.mockResolvedValue([change()]);
    expect(await service.getJobStatusHistory('job', 10)).toEqual([change()]);
    expect(history.find).toHaveBeenCalledWith({
      where: { jobId: 'job' },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    history.find.mockRejectedValue(new Error('offline'));
    await expect(service.getJobStatusHistory('job')).rejects.toThrow('offline');
  });
  it('records changed progress using the current argument order before updating the job', async () => {
    jobs.findOne.mockResolvedValue(
      Object.assign(new QueueJob(), { id: 'job', status: JobStatus.RUNNING, progress: 20 }),
    );
    await service.trackJobProgress('job', 50, { workerId: 'w' }, 'actor');
    expect(history.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.RUNNING,
        previousStatus: JobStatus.RUNNING,
        changedBy: 'actor',
        progress: 50,
        details: JSON.stringify({ workerId: 'w', progressChange: { from: 20, to: 50 } }),
      }),
    );
    expect(jobs.update).toHaveBeenCalledWith('job', { progress: 50, updatedAt: now });
  });
  it('does not record unchanged progress', async () => {
    jobs.findOne.mockResolvedValue(Object.assign(new QueueJob(), { progress: 20 }));
    await service.trackJobProgress('job', 20);
    expect(history.save).not.toHaveBeenCalled();
    expect(jobs.update).not.toHaveBeenCalled();
  });
  it('rejects progress for missing jobs and propagates update failures', async () => {
    jobs.findOne.mockResolvedValue(null);
    await expect(service.trackJobProgress('missing', 10)).rejects.toThrow('Job not found');
    jobs.findOne.mockResolvedValue(
      Object.assign(new QueueJob(), { status: JobStatus.RUNNING, progress: 0 }),
    );
    jobs.update.mockRejectedValue(new Error('offline'));
    await expect(service.trackJobProgress('job', 10)).rejects.toThrow('offline');
  });
  it('calculates status totals, hourly timeline and transition averages from real history rows', async () => {
    query.getMany.mockResolvedValue([
      change({ executionTimeMs: 1000 }),
      change({ executionTimeMs: 3000 }),
      change({
        status: JobStatus.FAILED,
        previousStatus: JobStatus.RUNNING,
        executionTimeMs: 5000,
      }),
    ]);
    const start = new Date(now.getTime() - 3600000);
    const result = await service.getStatusChangeStatistics(start, now, ['job']);
    expect(result.totalChanges).toBe(3);
    expect(result.statusBreakdown[JobStatus.COMPLETED]).toBe(2);
    expect(result.timelineData).toHaveLength(1);
    expect(result.timelineData[0].hour).toBe('2026-10-20T01:00:00Z');
    expect(result.averageProgressTime).toEqual({
      'running->completed': 2000,
      'running->failed': 5000,
    });
    expect(query.andWhere).toHaveBeenCalledWith('history.jobId IN (:...jobIds)', {
      jobIds: ['job'],
    });
  });
  it('returns zero samples and propagates history-statistics query failure', async () => {
    expect(await service.getStatusChangeStatistics(now, now)).toMatchObject({
      totalChanges: 0,
      timelineData: [],
      averageProgressTime: {},
    });
    query.getMany.mockRejectedValue(new Error('offline'));
    await expect(service.getStatusChangeStatistics(now, now)).rejects.toThrow('offline');
  });
  it('converts grouped database counts and fills missing statuses with zero', async () => {
    counts.getRawMany.mockResolvedValue([
      { status: JobStatus.PENDING, count: '3' },
      { status: JobStatus.FAILED, count: '2' },
    ]);
    expect(await service.getJobCountsByStatus()).toEqual({
      pending: 3,
      running: 0,
      completed: 0,
      failed: 2,
      cancelled: 0,
      retry: 0,
    });
    counts.getRawMany.mockRejectedValue(new Error('offline'));
    await expect(service.getJobCountsByStatus()).rejects.toThrow('offline');
  });
  it('uses the existing Between threshold and returns long-running entities unchanged', async () => {
    const long = Object.assign(new QueueJob(), { id: 'long', status: JobStatus.RUNNING });
    jobs.find.mockResolvedValue([long]);
    expect(await service.getLongRunningJobs(30)).toEqual([long]);
    expect(jobs.find).toHaveBeenCalledWith({
      where: {
        status: JobStatus.RUNNING,
        startedAt: Between(new Date(0), new Date(now.getTime() - 1800000)),
      },
      order: { startedAt: 'ASC' },
    });
    jobs.find.mockRejectedValue(new Error('offline'));
    await expect(service.getLongRunningJobs()).rejects.toThrow('offline');
  });
  it('analyzes transition durations with supported slow-transition recommendations', async () => {
    query.getMany.mockResolvedValue([
      change({ executionTimeMs: 400000 }),
      change({ executionTimeMs: 600000 }),
    ]);
    expect(await service.analyzeStatusTransitionTimes(['job'])).toEqual({
      transitions: [
        {
          fromStatus: JobStatus.RUNNING,
          toStatus: JobStatus.COMPLETED,
          averageTimeMs: 500000,
          minTimeMs: 400000,
          maxTimeMs: 600000,
          count: 2,
        },
      ],
      recommendations: [expect.stringContaining('500초')],
    });
    query.getMany.mockRejectedValue(new Error('offline'));
    await expect(service.analyzeStatusTransitionTimes()).rejects.toThrow('offline');
  });
  it('deletes only history before the requested retention cutoff and reports affected rows', async () => {
    expect(await service.cleanupOldStatusHistory(10)).toBe(3);
    expect(query.where).toHaveBeenCalledWith('createdAt < :cutoffDate', {
      cutoffDate: new Date(now.getTime() - 10 * 86400000),
    });
    query.execute.mockResolvedValue({ affected: undefined });
    expect(await service.cleanupOldStatusHistory()).toBe(0);
    query.execute.mockRejectedValue(new Error('offline'));
    await expect(service.cleanupOldStatusHistory()).rejects.toThrow('offline');
  });
});
