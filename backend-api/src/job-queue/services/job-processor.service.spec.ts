jest.mock('../../connection/connection.service', () => ({ ConnectionService: class {} }));
jest.mock('../../database/database.service', () => ({ DatabaseService: class {} }));
import { JobProcessorService } from './job-processor.service';
import { JobStatusTrackerService } from './job-status-tracker.service';
import { ConnectionService } from '../../connection/connection.service';
import { DatabaseService } from '../../database/database.service';
import { QueueJob, JobType, JobStatus } from '../entities/queue-job.entity';
import { JobResult, ResultType } from '../entities/job-result.entity';
import { Repository } from 'typeorm';

describe('JobProcessorService supported execution contract', () => {
  let service: JobProcessorService;
  let jobs: jest.Mocked<Pick<Repository<QueueJob>, 'update'>>;
  let results: jest.Mocked<Pick<Repository<JobResult>, 'save'>>;
  let tracker: jest.Mocked<Pick<JobStatusTrackerService, 'recordStatusChange'>>;
  let connection: { executeQuery: jest.Mock };
  const now = new Date('2026-10-20T00:00:00Z');
  const job = (
    type = JobType.QUERY_EXECUTION,
    data: object = { databaseId: 1, query: 'SELECT 1', parameters: [1] },
  ) =>
    Object.assign(new QueueJob(), {
      id: 'job',
      jobType: type,
      userId: 'synthetic-user',
      jobData: JSON.stringify(data),
    });
  const flush = () =>
    new Promise<void>(resolve => jest.requireActual('timers').setImmediate(resolve));
  const saved = () => results.save.mock.calls[0][0] as JobResult;
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    jest.setSystemTime(now);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    jobs = { update: jest.fn().mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] }) };
    results = { save: jest.fn() };
    tracker = { recordStatusChange: jest.fn().mockResolvedValue(undefined) };
    connection = {
      executeQuery: jest
        .fn()
        .mockResolvedValue({ datas: [{ value: 1 }, { value: 2 }], fields: ['value'] }),
    };
    service = new JobProcessorService(
      jobs as unknown as Repository<QueueJob>,
      results as unknown as Repository<JobResult>,
      tracker as unknown as JobStatusTrackerService,
      connection as unknown as ConnectionService,
      {} as DatabaseService,
    );
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it('executes a query through its dependency, stores a real result entity and completes the job', async () => {
    await service.processJob(job());
    expect(connection.executeQuery).toHaveBeenCalledWith(
      { id: 1, query: 'SELECT 1', parameters: [1] },
      'synthetic-user',
    );
    expect(jobs.update).toHaveBeenNthCalledWith(
      1,
      'job',
      expect.objectContaining({
        status: JobStatus.RUNNING,
        startedAt: now,
        workerId: expect.any(String),
      }),
    );
    expect(saved()).toBeInstanceOf(JobResult);
    expect(saved()).toMatchObject({ jobId: 'job', resultType: ResultType.QUERY_RESULT });
    expect(saved().resultDataParsed).toMatchObject({
      rowCount: 2,
      queryResult: { datas: [{ value: 1 }, { value: 2 }] },
    });
    expect(jobs.update).toHaveBeenLastCalledWith(
      'job',
      expect.objectContaining({
        status: JobStatus.COMPLETED,
        progress: 100,
        executionTimeMs: 0,
        completedAt: now,
      }),
    );
    expect(tracker.recordStatusChange).toHaveBeenLastCalledWith(
      'job',
      JobStatus.COMPLETED,
      null,
      'Job completed',
      expect.objectContaining({ progress: 100 }),
    );
    expect(jest.getTimerCount()).toBe(0);
  });
  it('rejects missing query parameters, records failure and never queries or saves a result', async () => {
    await expect(service.processJob(job(JobType.QUERY_EXECUTION, {}))).rejects.toThrow(
      'Missing required parameters',
    );
    expect(connection.executeQuery).not.toHaveBeenCalled();
    expect(results.save).not.toHaveBeenCalled();
    expect(jobs.update).toHaveBeenLastCalledWith(
      'job',
      expect.objectContaining({
        status: JobStatus.FAILED,
        errorMessage: 'Missing required parameters: query, databaseId',
      }),
    );
    expect(tracker.recordStatusChange).toHaveBeenLastCalledWith(
      'job',
      JobStatus.FAILED,
      JobStatus.RUNNING,
      'Job execution failed',
      expect.objectContaining({ errorType: 'Error' }),
    );
  });
  it('records and rethrows execution errors', async () => {
    connection.executeQuery.mockRejectedValue(new Error('query offline'));
    await expect(service.processJob(job())).rejects.toThrow('query offline');
    expect(results.save).not.toHaveBeenCalled();
    expect(jobs.update).toHaveBeenLastCalledWith(
      'job',
      expect.objectContaining({ status: JobStatus.FAILED, errorMessage: 'query offline' }),
    );
  });
  it('records an initial RUNNING write failure without executing the processor', async () => {
    jobs.update.mockRejectedValueOnce(new Error('write offline'));
    await expect(service.processJob(job())).rejects.toThrow('write offline');
    expect(connection.executeQuery).not.toHaveBeenCalled();
    expect(jobs.update).toHaveBeenLastCalledWith(
      'job',
      expect.objectContaining({ status: JobStatus.FAILED }),
    );
  });
  it('retains the existing best-effort result-storage behavior', async () => {
    results.save.mockRejectedValue(new Error('result store offline'));
    await expect(service.processJob(job())).resolves.toBeUndefined();
    expect(jobs.update).toHaveBeenLastCalledWith(
      'job',
      expect.objectContaining({ status: JobStatus.COMPLETED }),
    );
  });
  it('stores bulk export metadata using the existing placeholder URL without performing an upload', async () => {
    await service.processJob(
      job(JobType.BULK_DATA_EXPORT, { databaseId: 1, query: 'SELECT 1', format: 'xlsx' }),
    );
    expect(connection.executeQuery).toHaveBeenCalledTimes(1);
    expect(saved()).toMatchObject({
      resultType: ResultType.FILE_DOWNLOAD,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      expiresAt: new Date(now.getTime() + 86400000),
    });
    expect(saved().downloadUrl).toMatch(/^https:\/\/s3\.example\.com\/exports\/export_job_/);
    expect(saved().resultDataParsed.rowCount).toBe(2);
  });
  it('generates stored dashboard data by querying each requested widget', async () => {
    await service.processJob(
      job(JobType.DASHBOARD_GENERATION, {
        dashboardId: 10,
        widgets: [
          { widgetId: 'a', databaseId: 1, query: 'SELECT 1', chartType: 'number' },
          { widgetId: 'b', databaseId: 2, query: 'SELECT 2', chartType: 'column' },
        ],
      }),
    );
    expect(connection.executeQuery).toHaveBeenCalledTimes(2);
    expect(saved().resultType).toBe(ResultType.DASHBOARD_DATA);
    expect(saved().resultDataParsed.dashboardData).toMatchObject({
      dashboardId: 10,
      totalWidgets: 2,
      widgets: [
        expect.objectContaining({ widgetId: 'a', data: [{ value: 1 }, { value: 2 }] }),
        expect.objectContaining({ widgetId: 'b' }),
      ],
    });
  });
  it('migrates source rows through bounded target query batches', async () => {
    connection.executeQuery
      .mockResolvedValueOnce({ datas: [{ n: 1 }, { n: 2 }, { n: 3 }] })
      .mockResolvedValue({ datas: [] });
    await service.processJob(
      job(JobType.DATA_MIGRATION, {
        sourceDatabaseId: 1,
        sourceQuery: 'SELECT n',
        targetDatabaseId: 2,
        targetQuery: 'INSERT n',
        batchSize: 2,
      }),
    );
    expect(connection.executeQuery).toHaveBeenNthCalledWith(
      2,
      { id: 2, query: 'INSERT n', parameters: [{ n: 1 }, { n: 2 }] },
      'synthetic-user',
    );
    expect(connection.executeQuery).toHaveBeenNthCalledWith(
      3,
      { id: 2, query: 'INSERT n', parameters: [{ n: 3 }] },
      'synthetic-user',
    );
    expect(saved().resultDataParsed.migrationResult).toMatchObject({
      totalRows: 3,
      migratedRows: 3,
      batchSize: 2,
    });
  });
  it('reports a failed migration target write rather than completing', async () => {
    connection.executeQuery
      .mockResolvedValueOnce({ datas: [{ n: 1 }] })
      .mockRejectedValueOnce(new Error('target offline'));
    await expect(
      service.processJob(
        job(JobType.DATA_MIGRATION, {
          sourceDatabaseId: 1,
          sourceQuery: 'SELECT n',
          targetDatabaseId: 2,
          targetQuery: 'INSERT n',
        }),
      ),
    ).rejects.toThrow('target offline');
    expect(results.save).not.toHaveBeenCalled();
  });
  it('continues cache warmup after individual query failures and preserves per-query outcomes', async () => {
    connection.executeQuery
      .mockRejectedValueOnce(new Error('cache query offline'))
      .mockResolvedValueOnce({ datas: [] });
    await service.processJob(
      job(JobType.CACHE_WARMUP, {
        queries: [
          { databaseId: 1, query: 'bad' },
          { databaseId: 1, query: 'good' },
        ],
      }),
    );
    expect(saved().resultDataParsed.warmupResult).toMatchObject({
      totalQueries: 2,
      successfulQueries: 1,
      failedQueries: 1,
      queries: [
        expect.objectContaining({ status: 'failed', error: 'cache query offline' }),
        expect.objectContaining({ status: 'success' }),
      ],
    });
    expect(jobs.update).toHaveBeenLastCalledWith(
      'job',
      expect.objectContaining({ status: JobStatus.COMPLETED }),
    );
  });
  it('generates report section data with the existing report result type', async () => {
    await service.processJob(
      job(JobType.REPORT_GENERATION, {
        reportType: 'summary',
        sections: [{ sectionId: 's', title: 'Synthetic', databaseId: 1, query: 'SELECT 1' }],
      }),
    );
    expect(saved().resultType).toBe(ResultType.REPORT_URL);
    expect(saved().resultDataParsed.reportData).toEqual([
      expect.objectContaining({
        sectionId: 's',
        title: 'Synthetic',
        data: [{ value: 1 }, { value: 2 }],
      }),
    ]);
    expect(saved().resultDataParsed.reportUrl).toBe('https://reports.example.com/reports/job.pdf');
  });
  it('updates progress while an actual processor dependency is pending and clears the success timer', async () => {
    let finish: (value: unknown) => void;
    connection.executeQuery.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const running = service.processJob(job());
    await flush();
    jest.advanceTimersByTime(5000);
    await flush();
    expect(jobs.update).toHaveBeenCalledWith('job', {
      progress: 5,
      updatedAt: new Date(now.getTime() + 5000),
    });
    finish({ datas: [] });
    await running;
    expect(jest.getTimerCount()).toBe(0);
  });
});
