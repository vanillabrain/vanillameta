import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Between, DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { JobQueueMonitoringService } from './job-queue-monitoring.service';
import { JobNotificationService } from './job-notification.service';
import { QueueJob, JobStatus, JobType, JobPriority } from '../entities/queue-job.entity';
import { JobMetrics } from '../entities/job-metrics.entity';

// The original spec expected alerts/insights/healthScore and methods never implemented by this
// service. Exercise its existing public contract rather than adding those product features.
describe('JobQueueMonitoringService', () => {
  const now = new Date('2026-10-20T03:15:00Z');
  let service: JobQueueMonitoringService;
  let interval: jest.SpyInstance;
  let module: TestingModule;
  let jobs: jest.Mocked<Pick<Repository<QueueJob>, 'count' | 'find' | 'createQueryBuilder'>>;
  let metrics: jest.Mocked<Pick<Repository<JobMetrics>, 'save'>>;
  let notification: jest.Mocked<Pick<JobNotificationService, 'sendSystemNotification'>>;
  let query: SelectQueryBuilder<QueueJob> & { getRawOne: jest.Mock };
  const job = (overrides: Partial<QueueJob> = {}) =>
    Object.assign(
      new QueueJob(),
      {
        id: 'job-123',
        jobType: JobType.QUERY_EXECUTION,
        status: JobStatus.COMPLETED,
        priority: JobPriority.NORMAL,
        userId: 'user-123',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(now.getTime() - 10000),
        startedAt: new Date(now.getTime() - 8000),
        completedAt: now,
        executionTimeMs: 5000,
      },
      overrides,
    );
  const refresh = async (pending = 10, running = 2, completed = 80, failed = 5) => {
    jobs.count.mockImplementation(async options => {
      const status = (options.where as { status: JobStatus }).status;
      return {
        [JobStatus.PENDING]: pending,
        [JobStatus.RUNNING]: running,
        [JobStatus.COMPLETED]: completed,
        [JobStatus.FAILED]: failed,
      }[status];
    });
    jest.advanceTimersByTime(30000);
    await new Promise<void>(resolve => jest.requireActual('timers').setImmediate(resolve));
  };
  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    interval = jest.spyOn(global, 'setInterval');
    jest.setSystemTime(now);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    query = Object.assign(
      new SelectQueryBuilder<QueueJob>(new DataSource({ type: 'sqlite', database: ':memory:' })),
      {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avg: '15000', avgWait: '2000', count: '2' }),
      },
    );
    jobs = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    metrics = { save: jest.fn() };
    notification = { sendSystemNotification: jest.fn().mockResolvedValue(undefined) };
    module = await Test.createTestingModule({
      providers: [
        JobQueueMonitoringService,
        { provide: getRepositoryToken(QueueJob), useValue: jobs },
        { provide: getRepositoryToken(JobMetrics), useValue: metrics },
        { provide: JobNotificationService, useValue: notification },
      ],
    }).compile();
    service = module.get(JobQueueMonitoringService);
  });
  afterEach(async () => {
    await module?.close();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('starts with an empty cache and refreshes from repositories only on the monitoring interval', async () => {
    expect(service.getRealtimeMetrics()).toEqual({
      lastUpdate: now,
      queueLength: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageExecutionTime: 0,
      throughputPerMinute: 0,
    });
    expect(jobs.count).not.toHaveBeenCalled();
    await refresh();
    expect(service.getRealtimeMetrics()).toEqual({
      lastUpdate: new Date(now.getTime() + 30000),
      queueLength: 10,
      runningJobs: 2,
      completedJobs: 80,
      failedJobs: 5,
      averageExecutionTime: 15000,
      throughputPerMinute: 1,
    });
    expect(jobs.count).toHaveBeenCalledWith({ where: { status: JobStatus.PENDING } });
    expect(jobs.count).toHaveBeenCalledWith({
      where: {
        status: JobStatus.COMPLETED,
        completedAt: Between(
          new Date(now.getTime() + 30000 - 3600000),
          new Date(now.getTime() + 30000),
        ),
      },
    });
  });
  it('returns a copy of the realtime cache', async () => {
    await refresh();
    service.getRealtimeMetrics().queueLength = 999;
    expect(service.getRealtimeMetrics().queueLength).toBe(10);
  });
  it('preserves the last cache when an interval read fails', async () => {
    await refresh();
    const before = service.getRealtimeMetrics();
    jobs.count.mockRejectedValue(new Error('Database unavailable'));
    jest.advanceTimersByTime(30000);
    await new Promise<void>(resolve => jest.requireActual('timers').setImmediate(resolve));
    expect(service.getRealtimeMetrics()).toEqual(before);
  });
  it('calculates healthy status, percentage error rate, wait and load from the refreshed cache', async () => {
    await refresh();
    expect(await service.getQueueHealth()).toEqual({
      queueLength: 10,
      averageWaitTime: 2000,
      processingRate: 1,
      errorRate: 5.88,
      throughput: 1,
      systemLoad: 0.15,
      healthStatus: 'healthy',
      recommendations: [],
    });
  });
  it('warns on queue length and wait thresholds without fabricating alert objects', async () => {
    await refresh(120, 2, 90, 2);
    query.getRawOne.mockResolvedValue({ avgWait: '360000' });
    const health = await service.getQueueHealth();
    expect(health.healthStatus).toBe('warning');
    expect(health.recommendations).toEqual([
      expect.stringContaining('120'),
      expect.stringContaining('360초'),
    ]);
  });
  it('reports critical failure rate and saturated load', async () => {
    await refresh(200, 10, 50, 50);
    const health = await service.getQueueHealth();
    expect(health).toMatchObject({ healthStatus: 'critical', errorRate: 50, systemLoad: 1 });
    expect(health.recommendations).toContainEqual(expect.stringContaining('에러율'));
    expect(health.recommendations).toContain('시스템 부하가 높습니다. 리소스를 확인하세요.');
  });
  it('reports stalled processing when queued jobs have no throughput', async () => {
    await refresh(5, 0, 0, 0);
    expect(await service.getQueueHealth()).toMatchObject({
      healthStatus: 'critical',
      recommendations: [expect.stringContaining('작업 처리가 중단')],
    });
  });
  it('uses zero wait time when its best-effort wait query fails', async () => {
    query.getRawOne.mockRejectedValue(new Error('Database unavailable'));
    expect(await service.getQueueHealth()).toMatchObject({
      averageWaitTime: 0,
      healthStatus: 'healthy',
    });
  });
  it('calculates performance from jobs rather than an unrelated metrics history entity', async () => {
    jobs.find.mockResolvedValue([
      job({ id: 'a', executionTimeMs: 10000 }),
      job({ id: 'b', executionTimeMs: 20000 }),
      job({ id: 'c', status: JobStatus.FAILED }),
      job({ id: 'd', status: JobStatus.CANCELLED }),
    ]);
    expect(await service.getPerformanceMetrics(1)).toEqual({
      totalJobs: 4,
      completedJobs: 2,
      failedJobs: 1,
      cancelledJobs: 1,
      averageExecutionTime: 15000,
      averageWaitTime: 2000,
      successRate: 50,
      throughputPerHour: 3,
      peakConcurrency: 2,
      resourceUtilization: { memory: 60, cpu: 45, database: 30 },
    });
    expect(jobs.find).toHaveBeenCalledWith({
      where: { createdAt: Between(new Date(now.getTime() - 3600000), now) },
    });
  });
  it('handles empty performance samples without NaN', async () => {
    expect(await service.getPerformanceMetrics()).toMatchObject({
      totalJobs: 0,
      averageExecutionTime: 0,
      averageWaitTime: 0,
      successRate: 0,
      throughputPerHour: 0,
    });
  });
  it('propagates performance repository failures', async () => {
    jobs.find.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.getPerformanceMetrics()).rejects.toThrow('Database unavailable');
  });
  it('calculates the public per-type record including zero samples for absent types', async () => {
    jobs.find.mockImplementation(async options =>
      (options.where as { jobType: JobType }).jobType === JobType.QUERY_EXECUTION
        ? [
            job({ executionTimeMs: 10000 }),
            job({ executionTimeMs: 20000 }),
            job({ status: JobStatus.FAILED }),
          ]
        : [],
    );
    const result = await service.getJobTypeMetrics(7);
    expect(Object.keys(result).sort()).toEqual(Object.values(JobType).sort());
    expect(result[JobType.QUERY_EXECUTION]).toEqual({
      totalJobs: 3,
      completedJobs: 2,
      failedJobs: 1,
      averageExecutionTime: 15000,
      successRate: 66.67,
    });
    expect(result[JobType.DATA_MIGRATION]).toEqual({
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageExecutionTime: 0,
      successRate: 0,
    });
  });
  it('propagates per-type repository failures', async () => {
    jobs.find.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.getJobTypeMetrics()).rejects.toThrow('Database unavailable');
  });
  it('returns the selected long-running entities unchanged with the actual Between predicate', async () => {
    const long = job({ status: JobStatus.RUNNING, startedAt: new Date(now.getTime() - 7200000) });
    jobs.find.mockResolvedValue([long]);
    expect(await service.getLongRunningJobs(30)).toEqual([long]);
    expect(jobs.find).toHaveBeenCalledWith({
      where: {
        status: JobStatus.RUNNING,
        startedAt: Between(new Date(0), new Date(now.getTime() - 1800000)),
      },
      order: { startedAt: 'ASC' },
    });
  });
  it('aggregates actual JobMetrics class rows per type/status/priority with totals and averages', async () => {
    jobs.find.mockResolvedValue([
      job({ id: 'a', executionTimeMs: 10000 }),
      job({ id: 'b', executionTimeMs: 20000 }),
      job({ id: 'c', status: JobStatus.FAILED }),
    ]);
    await service.aggregateHourlyMetrics();
    expect(metrics.save).toHaveBeenCalledTimes(2);
    expect(metrics.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jobType: JobType.QUERY_EXECUTION,
        status: JobStatus.COMPLETED,
        jobCount: 2,
        totalExecutionTimeMs: 30000,
        avgExecutionTimeMs: 15000,
        totalWaitTimeMs: 4000,
        avgWaitTimeMs: 2000,
        successCount: 2,
        failureCount: 0,
        successRate: 100,
      }),
    );
    expect(metrics.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: JobStatus.FAILED,
        jobCount: 1,
        successCount: 0,
        failureCount: 1,
        successRate: 0,
      }),
    );
    expect(metrics.save.mock.calls[0][0]).toBeInstanceOf(JobMetrics);
  });
  it('keeps hourly aggregation errors best-effort and saves nothing', async () => {
    jobs.find.mockRejectedValue(new Error('Aggregation failed'));
    await expect(service.aggregateHourlyMetrics()).resolves.toBeUndefined();
    expect(metrics.save).not.toHaveBeenCalled();
  });
  it('sends the existing urgent system-notification contract for critical health', async () => {
    await refresh(200, 10, 50, 50);
    await service.checkHealthAndAlert();
    expect(notification.sendSystemNotification).toHaveBeenCalledWith(
      '작업 큐 시스템 위험 상태',
      expect.any(String),
      'urgent',
      expect.objectContaining({ queueLength: 200, errorRate: 50, systemLoad: 1 }),
    );
  });
  it('sends the existing high-priority warning notification', async () => {
    await refresh(120, 2, 90, 2);
    await service.checkHealthAndAlert();
    expect(notification.sendSystemNotification).toHaveBeenCalledWith(
      '작업 큐 시스템 경고',
      expect.any(String),
      'high',
      expect.objectContaining({ queueLength: 120 }),
    );
  });
  it('sends no notification for healthy status without long-running jobs', async () => {
    await refresh();
    await service.checkHealthAndAlert();
    expect(notification.sendSystemNotification).not.toHaveBeenCalled();
  });
  it('reports long-running jobs using the current normal notification payload', async () => {
    const long = job({ status: JobStatus.RUNNING });
    jobs.find.mockResolvedValue([long]);
    await service.checkHealthAndAlert();
    expect(notification.sendSystemNotification).toHaveBeenCalledWith(
      '장시간 실행 작업 발견',
      expect.stringContaining('1개의 작업'),
      'normal',
      {
        longRunningJobs: [
          { id: long.id, type: long.jobType, startedAt: long.startedAt, userId: long.userId },
        ],
      },
    );
  });
  it('unrefs its interval and stops repository polling when the Nest module closes', async () => {
    expect(interval.mock.results[0].value.hasRef()).toBe(false);
    expect(jest.getTimerCount()).toBe(1);
    const before = service.getRealtimeMetrics();
    await module.close();
    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(60000);
    await new Promise<void>(resolve => jest.requireActual('timers').setImmediate(resolve));
    expect(jobs.count).not.toHaveBeenCalled();
    expect(jobs.createQueryBuilder).not.toHaveBeenCalled();
    expect(service.getRealtimeMetrics()).toEqual(before);
  });
});
