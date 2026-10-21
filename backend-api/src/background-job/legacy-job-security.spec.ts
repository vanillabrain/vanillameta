import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SourceAccessService } from '../ownership/source-access.service';
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { BackgroundJobService } from './background-job.service';
import { JobStatus, JobType } from './entities/background-job.entity';
import { QueryJobProcessor } from './processors/query-job.processor';
import { BatchService } from '../batch/batch.service';
import { BatchJobStatus, BatchJobType } from '../batch/entities/batch-job.entity';
import { legacyJobActor, assertLegacyActor } from './legacy-job-access';

const actor = { id: 7, userId: 'alice', authVersion: 3 };

describe('legacy job security boundary', () => {
  let current: any;
  let source: any;
  let saved: any;
  let db: DataSource;
  let access: SourceAccessService;
  let jobs: any;
  let results: any;
  let queue: any;
  let service: BackgroundJobService;
  const logger: any = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const dto: any = {
    jobType: JobType.QUERY_EXECUTION,
    title: 'job',
    databaseId: '1',
    query: 'SELECT 1',
  };

  beforeEach(() => {
    current = { ...actor, active: true };
    source = { id: 1, ownerId: 7, catalogActive: true };
    db = {
      options: { type: 'mysql' },
      getRepository: (entity: any) => ({
        findOne: jest.fn(async () => {
          if (entity === User) return current;
          if (entity === Database) return source;
          if (entity === Dataset) return { id: 2, databaseId: 1, query: 'SELECT 1' };
          return null;
        }),
      }),
    } as any;
    access = new SourceAccessService(db);
    jobs = {
      save: jest.fn(async (row: any) => {
        saved = { ...row, id: row.id || 'job-1' };
        return saved;
      }),
      findOne: jest.fn(async ({ where }: any) =>
        saved && (!where.userId || where.userId === saved.userId) ? saved : null,
      ),
      findAndCount: jest.fn(async () => [[saved], 1]),
      update: jest.fn(async (_where: any, changes: any) => {
        if (![JobStatus.CANCELLED, JobStatus.COMPLETED].includes(saved.status))
          Object.assign(saved, changes);
        return { affected: 1 };
      }),
    };
    results = {
      save: jest.fn(async row => ({ ...row, id: 'result-1' })),
      remove: jest.fn(),
      findOne: jest.fn(),
    };
    queue = { add: jest.fn(async () => ({ id: 'queued-1' })), getJob: jest.fn() };
    service = new BackgroundJobService(jobs, results, queue, logger, db, access);
  });

  it.each([
    undefined,
    {},
    { userId: 'alice' },
    { accessKeyData: { ...actor, id: 0 } },
    { shareKeyData: { dashboardId: 1 } },
  ])('rejects absent or nonpersonal actor %j', value => {
    expect(() => legacyJobActor(value)).toThrow(ForbiddenException);
  });

  it('normalizes the real JWT payload without trusting top-level identity', () => {
    expect(legacyJobActor({ userId: 'victim', accessKeyData: actor })).toEqual(actor);
  });

  it.each(['epoch', 'inactive', 'missing'])(
    'denies %s actors before database job reads',
    async mode => {
      if (mode === 'epoch') current.authVersion++;
      if (mode === 'inactive') current.active = false;
      if (mode === 'missing') current = null;
      await expect(service.getJobById('job-1', actor)).rejects.toThrow(ForbiddenException);
      expect(jobs.findOne).not.toHaveBeenCalled();
      await expect(assertLegacyActor(db, actor)).rejects.toThrow();
    },
  );

  it('does not execute or queue SQL for a foreign source or a disabled source', async () => {
    source.ownerId = 8;
    await expect(service.createJob(actor, dto)).rejects.toThrow(ForbiddenException);
    source.ownerId = 7;
    source.catalogActive = false;
    await expect(service.createJob(actor, dto)).rejects.toThrow(ForbiddenException);
    expect(jobs.save).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('requires current read permission even when owner identity matches', async () => {
    const policy: any = { assert: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const protectedService = new BackgroundJobService(
      jobs,
      results,
      queue,
      logger,
      db,
      new SourceAccessService(db, policy),
    );
    await expect(protectedService.createJob(actor, dto)).rejects.toThrow(ForbiddenException);
    expect(policy.assert).toHaveBeenCalledWith('source', 1, 7, 'read', undefined);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('reserves persisted actor, SQL and source keys against caller metadata', async () => {
    await service.createJob(actor, {
      ...dto,
      metadata: { actor: { ...actor, id: 8 }, databaseId: '2', query: 'DROP TABLE x' },
    });
    expect(JSON.parse(saved.metadata)).toMatchObject({ actor, databaseId: '1', query: 'SELECT 1' });
  });

  it('returns 503 without creating a job when Redis is unconfigured', async () => {
    const offline = new BackgroundJobService(jobs, results, undefined, logger, db, access);
    await expect(offline.createJob(actor, dto)).rejects.toThrow(ServiceUnavailableException);
    expect(jobs.save).not.toHaveBeenCalled();
  });

  it('rechecks epoch at queue admission after saving the immutable request', async () => {
    jobs.save.mockImplementation(async row => {
      current.authVersion++;
      return { ...row, id: 'job-1' };
    });
    await expect(service.createJob(actor, dto)).rejects.toThrow(ForbiddenException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not allow a fresh JWT to read or cancel a job admitted under a revoked epoch', async () => {
    await service.createJob(actor, dto);
    current.authVersion++;
    const renewed = { ...actor, authVersion: current.authVersion };
    await expect(service.getJobResult('job-1', renewed)).rejects.toThrow();
    await expect(service.cancelJob('job-1', renewed)).rejects.toThrow();
    expect(results.findOne).not.toHaveBeenCalled();
    expect(queue.getJob).not.toHaveBeenCalled();
  });

  it('does not disclose another user job even with source ownership', async () => {
    await service.createJob(actor, dto);
    saved.userId = 'bob';
    await expect(service.getJobById('job-1', actor)).rejects.toThrow();
    expect(results.findOne).not.toHaveBeenCalled();
  });

  it.each(['epoch', 'source', 'cancel'])(
    'rejects %s revocation during SQL without storing results',
    async mode => {
      await service.createJob(actor, dto);
      const connection: any = {
        executeQuery: jest.fn(async () => {
          if (mode === 'epoch') current.authVersion++;
          if (mode === 'source') source.ownerId = 8;
          if (mode === 'cancel') saved.status = JobStatus.CANCELLED;
          return { datas: [{ secret: 1 }] };
        }),
      };
      const processor = new QueryJobProcessor(
        jobs,
        results,
        {} as any,
        { findOne: jest.fn(async () => source) } as any,
        connection,
        logger,
        service,
      );
      const queued: any = {
        data: { backgroundJobId: 'job-1', databaseId: '999', query: 'SELECT stolen' },
        progress: jest.fn(),
        attemptsMade: 0,
      };
      await expect(processor.handleQueryExecution(queued)).rejects.toThrow();
      expect(connection.executeQuery).toHaveBeenCalledWith({ id: 1, query: 'SELECT 1' });
      expect(results.save).not.toHaveBeenCalled();
      if (mode === 'cancel') expect(saved.status).toBe(JobStatus.CANCELLED);
    },
  );

  it('does not execute jobs already revoked before worker startup', async () => {
    await service.createJob(actor, dto);
    current.active = false;
    const connection: any = { executeQuery: jest.fn() };
    const processor = new QueryJobProcessor(
      jobs,
      results,
      {} as any,
      {} as any,
      connection,
      logger,
      service,
    );
    await expect(
      processor.handleQueryExecution({
        data: { backgroundJobId: 'job-1' },
        attemptsMade: 0,
      } as any),
    ).rejects.toThrow();
    expect(connection.executeQuery).not.toHaveBeenCalled();
  });

  it('keeps the authorized worker functional and stores only its admitted query result', async () => {
    await service.createJob(actor, dto);
    const connection: any = { executeQuery: jest.fn(async () => ({ datas: [{ own: 1 }] })) };
    const processor = new QueryJobProcessor(
      jobs,
      results,
      {} as any,
      { findOne: jest.fn(async () => source) } as any,
      connection,
      logger,
      service,
    );
    await expect(
      processor.handleQueryExecution({
        data: { backgroundJobId: 'job-1' },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any),
    ).resolves.toMatchObject({ success: true, rowCount: 1 });
    expect(saved.status).toBe(JobStatus.COMPLETED);
    expect(results.save).toHaveBeenCalledTimes(1);
  });

  it('rechecks current source rights before disclosing completed result data', async () => {
    await service.createJob(actor, dto);
    saved.status = JobStatus.COMPLETED;
    source.ownerId = 8;
    await expect(service.getJobResultData('job-1', actor)).rejects.toThrow();
    expect(results.findOne).not.toHaveBeenCalled();
  });

  it('scopes batch detail/chunk reads and rejects epoch or source revocation', async () => {
    const row: any = { id: 1, createdBy: 'alice', datasetId: 2, metadata: { actor }, chunks: [] };
    const repo: any = { findOne: jest.fn(async () => row) };
    const batch = new BatchService(
      repo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      logger,
      db,
      access,
    );
    await expect(batch.findOne(1, actor)).resolves.toBe(row);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 1, createdBy: 'alice' },
      relations: ['chunks'],
    });
    row.createdBy = 'bob';
    await expect(batch.findOne(1, actor)).rejects.toThrow();
    row.createdBy = 'alice';
    source.ownerId = 8;
    await expect(batch.findOne(1, actor)).rejects.toThrow();
    source.ownerId = 7;
    current.authVersion++;
    await expect(
      batch.findOne(1, { ...actor, authVersion: current.authVersion }),
    ).rejects.toThrow();
  });

  it('rechecks batch epoch after a chunk SQL finishes', async () => {
    const row: any = {
      id: 1,
      type: BatchJobType.DATASET_QUERY,
      status: BatchJobStatus.PROCESSING,
      createdBy: 'alice',
      datasetId: 2,
      metadata: { actor },
    };
    const repo: any = { findOne: jest.fn(async () => row) };
    const raw = jest.fn(async () => {
      current.authVersion++;
      return [{ secret: 1 }];
    });
    const batch = new BatchService(
      repo,
      {} as any,
      { findOne: jest.fn(async () => ({ databaseId: 1, query: 'SELECT 1' })) } as any,
      {} as any,
      { getKnex: jest.fn(async () => ({ raw })) } as any,
      logger,
      db,
      access,
    );
    await expect(
      (batch as any).processChunkData(row, { startOffset: 0, endOffset: 1 }),
    ).rejects.toThrow(ForbiddenException);
    expect(raw).toHaveBeenCalledTimes(1);
  });
  it('persists cancellation even when Bull refuses to remove an active locked job', async () => {
    await service.createJob(actor, dto);
    saved.status = JobStatus.PROCESSING;
    queue.getJob.mockResolvedValue({ remove: jest.fn().mockRejectedValue(new Error('locked')) });
    await expect(service.cancelJob('job-1', actor)).resolves.toBeUndefined();
    expect(saved.status).toBe(JobStatus.CANCELLED);
  });

  it('rechecks source revocation after reading a stored result', async () => {
    await service.createJob(actor, dto);
    saved.status = JobStatus.COMPLETED;
    results.findOne.mockImplementation(async () => {
      source.ownerId = 8;
      return { id: 'result-1', resultData: 'secret' };
    });
    await expect(service.getJobResult('job-1', actor)).rejects.toThrow(ForbiddenException);
  });

  it('reserves batch actor metadata and checks current source before persistence', async () => {
    const repo: any = { create: jest.fn(value => value), save: jest.fn() };
    const batch = new BatchService(
      repo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      logger,
      db,
      access,
    );
    jest.spyOn(batch as any, 'initializeBatchJob').mockResolvedValue(undefined);
    const request: any = {
      type: BatchJobType.DATASET_QUERY,
      datasetId: 2,
      metadata: { actor: { id: 8 } },
    };
    await batch.createBatchJob(request, actor);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 'alice', metadata: { actor } }),
    );
    repo.save.mockClear();
    source.ownerId = 8;
    await expect(batch.createBatchJob(request, actor)).rejects.toThrow(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each(['source', 'cancel'])('rejects batch %s revocation during chunk SQL', async mode => {
    const row: any = {
      id: 1,
      type: BatchJobType.DATASET_QUERY,
      status: BatchJobStatus.PROCESSING,
      createdBy: 'alice',
      datasetId: 2,
      metadata: { actor },
    };
    const repo: any = { findOne: jest.fn(async () => row) };
    const raw = jest.fn(async () => {
      if (mode === 'source') source.ownerId = 8;
      else row.status = BatchJobStatus.CANCELLED;
      return [{ secret: 1 }];
    });
    const batch = new BatchService(
      repo,
      {} as any,
      { findOne: jest.fn(async () => ({ databaseId: 1, query: 'SELECT 1' })) } as any,
      {} as any,
      { getKnex: jest.fn(async () => ({ raw })) } as any,
      logger,
      db,
      access,
    );
    await expect(
      (batch as any).processChunkData(row, { startOffset: 0, endOffset: 1 }),
    ).rejects.toThrow(ForbiddenException);
    expect(raw).toHaveBeenCalledTimes(1);
  });
  it('does not execute or overwrite a completed job on duplicate delivery', async () => {
    await service.createJob(actor, dto);
    saved.status = JobStatus.COMPLETED;
    const connection: any = { executeQuery: jest.fn() };
    const processor = new QueryJobProcessor(
      jobs,
      results,
      {} as any,
      {} as any,
      connection,
      logger,
      service,
    );
    await expect(
      processor.handleQueryExecution({
        data: { backgroundJobId: 'job-1' },
        attemptsMade: 0,
      } as any),
    ).rejects.toThrow();
    expect(connection.executeQuery).not.toHaveBeenCalled();
    expect(saved.status).toBe(JobStatus.COMPLETED);
  });
});
