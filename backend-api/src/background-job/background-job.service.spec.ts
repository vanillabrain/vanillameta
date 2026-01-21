import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { BackgroundJobService } from './background-job.service';
import { BackgroundJob, JobStatus, JobType } from './entities/background-job.entity';
import { JobResult, ResultStorageType } from './entities/job-result.entity';
import { CustomLoggerService } from '../common/logger/logger.service';
type LoggerService = CustomLoggerService;
import { CreateBackgroundJobDto } from './dto/create-background-job.dto';
import { NotFoundException } from '@nestjs/common';

describe('BackgroundJobService', () => {
  let service: BackgroundJobService;
  let backgroundJobRepository: Repository<BackgroundJob>;
  let jobResultRepository: Repository<JobResult>;
  let queryQueue: Queue;
  let logger: LoggerService;

  const mockBackgroundJobRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockJobResultRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockQueryQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackgroundJobService,
        {
          provide: getRepositoryToken(BackgroundJob),
          useValue: mockBackgroundJobRepository,
        },
        {
          provide: getRepositoryToken(JobResult),
          useValue: mockJobResultRepository,
        },
        {
          provide: getQueueToken('query-execution'),
          useValue: mockQueryQueue,
        },
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<BackgroundJobService>(BackgroundJobService);
    backgroundJobRepository = module.get<Repository<BackgroundJob>>(
      getRepositoryToken(BackgroundJob),
    );
    jobResultRepository = module.get<Repository<JobResult>>(getRepositoryToken(JobResult));
    queryQueue = module.get<Queue>(getQueueToken('query-execution'));
    logger = module.get<LoggerService>(CustomLoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    it('should create a background job and add it to the queue', async () => {
      const userId = 'user123';
      const createJobDto: CreateBackgroundJobDto = {
        jobType: JobType.QUERY_EXECUTION,
        title: 'Test Query Job',
        description: 'Test description',
        datasetId: 'dataset123',
        databaseId: 'database123',
        query: 'SELECT * FROM users',
      };

      const savedJob = {
        id: 'job123',
        userId,
        jobType: createJobDto.jobType,
        title: createJobDto.title,
        description: createJobDto.description,
        status: JobStatus.PENDING,
        progress: 0,
        metadata: {
          datasetId: createJobDto.datasetId,
          databaseId: createJobDto.databaseId,
          query: createJobDto.query,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const queueJob = { id: 'queue123' };

      mockBackgroundJobRepository.save.mockResolvedValueOnce(savedJob);
      mockQueryQueue.add.mockResolvedValueOnce(queueJob);
      mockBackgroundJobRepository.save.mockResolvedValueOnce({
        ...savedJob,
        queueJobId: queueJob.id,
      });

      const result = await service.createJob(userId, createJobDto);

      expect(result).toMatchObject({
        id: savedJob.id,
        jobType: savedJob.jobType,
        status: savedJob.status,
        title: savedJob.title,
        progress: 0,
      });

      expect(mockBackgroundJobRepository.save).toHaveBeenCalledTimes(2);
      expect(mockQueryQueue.add).toHaveBeenCalledWith({
        backgroundJobId: savedJob.id,
        userId,
        query: createJobDto.query,
        databaseId: createJobDto.databaseId,
        datasetId: createJobDto.datasetId,
        parameters: undefined,
      });
    });
  });

  describe('getJobById', () => {
    it('should return a job by id', async () => {
      const jobId = 'job123';
      const userId = 'user123';
      const job = {
        id: jobId,
        userId,
        jobType: JobType.QUERY_EXECUTION,
        status: JobStatus.COMPLETED,
        title: 'Test Job',
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobResult: {
          id: 'result123',
          resultSizeBytes: 1000,
          rowCount: 10,
        },
      };

      mockBackgroundJobRepository.findOne.mockResolvedValueOnce(job);

      const result = await service.getJobById(jobId, userId);

      expect(result).toMatchObject({
        id: job.id,
        status: job.status,
        hasResult: true,
        resultSizeBytes: 1000,
        rowCount: 10,
      });

      expect(mockBackgroundJobRepository.findOne).toHaveBeenCalledWith({
        where: { id: jobId, userId },
        relations: ['jobResult'],
      });
    });

    it('should throw NotFoundException if job not found', async () => {
      mockBackgroundJobRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getJobById('notfound', 'user123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelJob', () => {
    it('should cancel a pending job', async () => {
      const jobId = 'job123';
      const userId = 'user123';
      const job = {
        id: jobId,
        userId,
        status: JobStatus.PENDING,
        queueJobId: 'queue123',
      };

      const queueJob = {
        remove: jest.fn(),
      };

      mockBackgroundJobRepository.findOne.mockResolvedValueOnce(job);
      mockQueryQueue.getJob.mockResolvedValueOnce(queueJob);
      mockBackgroundJobRepository.save.mockResolvedValueOnce({
        ...job,
        status: JobStatus.CANCELLED,
      });

      await service.cancelJob(jobId, userId);

      expect(queueJob.remove).toHaveBeenCalled();
      expect(mockBackgroundJobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.CANCELLED,
        }),
      );
    });

    it('should throw error if job cannot be cancelled', async () => {
      const job = {
        id: 'job123',
        userId: 'user123',
        status: JobStatus.COMPLETED,
      };

      mockBackgroundJobRepository.findOne.mockResolvedValueOnce(job);

      await expect(service.cancelJob('job123', 'user123')).rejects.toThrow(
        'Cannot cancel job in completed status',
      );
    });
  });

  describe('cleanupExpiredResults', () => {
    it('should remove expired job results', async () => {
      const expiredResults = [
        {
          id: 'result1',
          storageType: ResultStorageType.DATABASE,
          expiresAt: new Date('2023-01-01'),
        },
        {
          id: 'result2',
          storageType: ResultStorageType.DATABASE,
          expiresAt: new Date('2023-01-02'),
        },
      ];

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(expiredResults),
      };

      mockJobResultRepository.createQueryBuilder.mockReturnValueOnce(queryBuilder);
      mockJobResultRepository.remove.mockResolvedValue(undefined);

      const count = await service.cleanupExpiredResults();

      expect(count).toBe(2);
      expect(mockJobResultRepository.remove).toHaveBeenCalledTimes(2);
      expect(mockJobResultRepository.remove).toHaveBeenCalledWith(expiredResults[0]);
      expect(mockJobResultRepository.remove).toHaveBeenCalledWith(expiredResults[1]);
    });
  });
});
