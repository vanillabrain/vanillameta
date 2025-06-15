import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobRetryService } from './job-retry.service';
import { JobSchedulerService } from './job-scheduler.service';
import { JobStatusTrackerService } from './job-status-tracker.service';
import { QueueJob, JobStatus, JobType, JobPriority } from '../entities/queue-job.entity';

describe('JobRetryService', () => {
  let service: JobRetryService;
  let jobRepository: jest.Mocked<Repository<QueueJob>>;
  let jobSchedulerService: jest.Mocked<JobSchedulerService>;
  let jobStatusTrackerService: jest.Mocked<JobStatusTrackerService>;

  const mockJob: QueueJob = {
    id: 'job-123',
    jobType: JobType.QUERY_EXECUTION,
    status: JobStatus.FAILED,
    priority: JobPriority.NORMAL,
    userId: 'user-123',
    jobData: JSON.stringify({ query: 'SELECT * FROM users' }),
    result: null,
    errorMessage: 'Database connection failed',
    errorStack: 'Error stack trace',
    retryCount: 1,
    maxRetries: 3,
    progress: 0,
    scheduledAt: null,
    startedAt: new Date(),
    completedAt: null,
    executionTimeMs: null,
    estimatedTimeMs: 30000,
    workerId: 'worker-123',
    metadata: null,
    correlationId: null,
    requiresNotification: false,
    notificationEmail: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isCompleted: false,
    isFailed: true,
    isRunning: false,
    canRetry: true,
    jobDataParsed: { query: 'SELECT * FROM users' },
    resultParsed: null,
    metadataParsed: {},
  };

  beforeEach(async () => {
    const mockJobRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockJobSchedulerService = {
      scheduleJob: jest.fn(),
    };

    const mockJobStatusTrackerService = {
      recordStatusChange: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobRetryService,
        {
          provide: getRepositoryToken(QueueJob),
          useValue: mockJobRepository,
        },
        {
          provide: JobSchedulerService,
          useValue: mockJobSchedulerService,
        },
        {
          provide: JobStatusTrackerService,
          useValue: mockJobStatusTrackerService,
        },
      ],
    }).compile();

    service = module.get<JobRetryService>(JobRetryService);
    jobRepository = module.get(getRepositoryToken(QueueJob));
    jobSchedulerService = module.get(JobSchedulerService);
    jobStatusTrackerService = module.get(JobStatusTrackerService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduleRetry', () => {
    it('should schedule retry for failed job within retry limit', async () => {
      // Arrange
      const failedJob = { ...mockJob, retryCount: 1, maxRetries: 3 };
      const retryDelay = 5000; // 5 seconds

      jobRepository.save.mockResolvedValue({
        ...failedJob,
        status: JobStatus.RETRY,
        scheduledAt: new Date(Date.now() + retryDelay),
      });
      jobSchedulerService.scheduleJob.mockResolvedValue(undefined);
      jobStatusTrackerService.recordStatusChange.mockResolvedValue(undefined);

      // Act
      await service.scheduleRetry(failedJob);

      // Assert
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.RETRY,
          scheduledAt: expect.any(Date),
          errorMessage: failedJob.errorMessage,
        })
      );
      expect(jobSchedulerService.scheduleJob).toHaveBeenCalled();
      expect(jobStatusTrackerService.recordStatusChange).toHaveBeenCalledWith(
        failedJob.id,
        JobStatus.FAILED,
        JobStatus.RETRY,
        'JobRetryService',
        expect.stringContaining('Scheduled retry'),
        expect.any(Object)
      );
    });

    it('should not retry job that exceeded max retries', async () => {
      // Arrange
      const exhaustedJob = { ...mockJob, retryCount: 3, maxRetries: 3 };

      jobRepository.save.mockResolvedValue({
        ...exhaustedJob,
        status: JobStatus.FAILED,
      });

      // Act
      await service.scheduleRetry(exhaustedJob);

      // Assert
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.FAILED,
          // scheduledAt should not be set
        })
      );
      expect(jobSchedulerService.scheduleJob).not.toHaveBeenCalled();
    });

    it('should calculate exponential backoff delay', async () => {
      // Arrange
      const jobs = [
        { ...mockJob, retryCount: 1, jobType: JobType.QUERY_EXECUTION },
        { ...mockJob, retryCount: 2, jobType: JobType.QUERY_EXECUTION },
        { ...mockJob, retryCount: 3, jobType: JobType.QUERY_EXECUTION },
      ];

      const delays: number[] = [];
      jobRepository.save.mockImplementation((job) => {
        const scheduledAt = job.scheduledAt;
        if (scheduledAt) {
          delays.push(scheduledAt.getTime() - Date.now());
        }
        return Promise.resolve(job);
      });

      // Act
      for (const job of jobs) {
        await service.scheduleRetry(job);
      }

      // Assert
      expect(delays).toHaveLength(3);
      expect(delays[1]).toBeGreaterThan(delays[0]); // Second retry should have longer delay
      expect(delays[2]).toBeGreaterThan(delays[1]); // Third retry should have even longer delay
    });

    it('should use different retry strategies for different job types', async () => {
      // Arrange
      const queryJob = { ...mockJob, jobType: JobType.QUERY_EXECUTION, retryCount: 1 };
      const bulkExportJob = { ...mockJob, jobType: JobType.BULK_DATA_EXPORT, retryCount: 1 };

      const delays: Record<string, number> = {};
      jobRepository.save.mockImplementation((job) => {
        const scheduledAt = job.scheduledAt;
        if (scheduledAt) {
          delays[job.jobType] = scheduledAt.getTime() - Date.now();
        }
        return Promise.resolve(job);
      });

      // Act
      await service.scheduleRetry(queryJob);
      await service.scheduleRetry(bulkExportJob);

      // Assert
      expect(delays[JobType.QUERY_EXECUTION]).toBeDefined();
      expect(delays[JobType.BULK_DATA_EXPORT]).toBeDefined();
      // Bulk export jobs should have longer retry delays
      expect(delays[JobType.BULK_DATA_EXPORT]).toBeGreaterThan(delays[JobType.QUERY_EXECUTION]);
    });

    it('should handle error during retry scheduling', async () => {
      // Arrange
      const failedJob = { ...mockJob };
      const error = new Error('Scheduler unavailable');
      
      jobRepository.save.mockResolvedValue(failedJob);
      jobSchedulerService.scheduleJob.mockRejectedValue(error);

      // Act & Assert
      await expect(service.scheduleRetry(failedJob)).rejects.toThrow('Scheduler unavailable');
    });
  });

  describe('retryJob', () => {
    it('should retry job immediately', async () => {
      // Arrange
      const failedJob = { ...mockJob, status: JobStatus.FAILED, retryCount: 1 };

      jobRepository.save.mockResolvedValue({
        ...failedJob,
        status: JobStatus.PENDING,
        retryCount: 2,
      });

      // Act
      await service.retryJob(failedJob);

      // Assert
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.PENDING,
          retryCount: 2,
          scheduledAt: null, // Immediate retry
          errorMessage: null,
          errorStack: null,
          workerId: null,
        })
      );
      expect(jobStatusTrackerService.recordStatusChange).toHaveBeenCalledWith(
        failedJob.id,
        JobStatus.FAILED,
        JobStatus.PENDING,
        'JobRetryService',
        'Manual retry triggered',
        expect.any(Object)
      );
    });

    it('should throw error if job cannot be retried', async () => {
      // Arrange
      const exhaustedJob = { ...mockJob, retryCount: 3, maxRetries: 3, canRetry: false };

      // Act & Assert
      await expect(service.retryJob(exhaustedJob)).rejects.toThrow(
        'Job cannot be retried: exceeded maximum retry attempts'
      );
    });

    it('should not retry completed job', async () => {
      // Arrange
      const completedJob = { ...mockJob, status: JobStatus.COMPLETED };

      // Act & Assert
      await expect(service.retryJob(completedJob)).rejects.toThrow(
        'Job cannot be retried: job is not in a failed state'
      );
    });
  });

  describe('bulkRetry', () => {
    it('should retry multiple jobs successfully', async () => {
      // Arrange
      const jobIds = ['job-1', 'job-2', 'job-3'];
      const jobs = jobIds.map((id, index) => ({
        ...mockJob,
        id,
        status: JobStatus.FAILED,
        retryCount: index,
      }));

      jobRepository.findOne
        .mockResolvedValueOnce(jobs[0])
        .mockResolvedValueOnce(jobs[1])
        .mockResolvedValueOnce(jobs[2]);

      jobRepository.save.mockImplementation((job) => Promise.resolve(job));

      // Act
      const result = await service.bulkRetry(jobIds, 'Bulk retry requested');

      // Assert
      expect(result.successful).toEqual(jobIds);
      expect(result.failed).toEqual([]);
      expect(jobRepository.findOne).toHaveBeenCalledTimes(3);
      expect(jobRepository.save).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in bulk retry', async () => {
      // Arrange
      const jobIds = ['job-1', 'job-2', 'job-3'];
      const jobs = [
        { ...mockJob, id: 'job-1', status: JobStatus.FAILED, retryCount: 1 },
        { ...mockJob, id: 'job-2', status: JobStatus.COMPLETED }, // Cannot retry
        { ...mockJob, id: 'job-3', status: JobStatus.FAILED, retryCount: 3, maxRetries: 3 }, // Exceeded retries
      ];

      jobRepository.findOne
        .mockResolvedValueOnce(jobs[0])
        .mockResolvedValueOnce(jobs[1])
        .mockResolvedValueOnce(jobs[2]);

      jobRepository.save.mockImplementation((job) => Promise.resolve(job));

      // Act
      const result = await service.bulkRetry(jobIds, 'Bulk retry requested');

      // Assert
      expect(result.successful).toEqual(['job-1']);
      expect(result.failed).toEqual([
        { jobId: 'job-2', error: 'Job cannot be retried: job is not in a failed state' },
        { jobId: 'job-3', error: 'Job cannot be retried: exceeded maximum retry attempts' },
      ]);
    });

    it('should handle non-existent jobs in bulk retry', async () => {
      // Arrange
      const jobIds = ['job-1', 'job-2'];
      
      jobRepository.findOne
        .mockResolvedValueOnce({ ...mockJob, id: 'job-1' })
        .mockResolvedValueOnce(null); // Job not found

      jobRepository.save.mockImplementation((job) => Promise.resolve(job));

      // Act
      const result = await service.bulkRetry(jobIds, 'Bulk retry');

      // Assert
      expect(result.successful).toEqual(['job-1']);
      expect(result.failed).toEqual([
        { jobId: 'job-2', error: 'Job not found: job-2' },
      ]);
    });
  });

  describe('getRetryStatistics', () => {
    it('should return retry statistics for time period', async () => {
      // Arrange
      const days = 7;
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { 
            jobType: JobType.QUERY_EXECUTION,
            retryCount: '1',
            averageRetries: '1.5',
            successRate: '0.75',
            count: '10'
          },
          { 
            jobType: JobType.BULK_DATA_EXPORT,
            retryCount: '2',
            averageRetries: '2.2',
            successRate: '0.60',
            count: '5'
          },
        ]),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getRetryStatistics(days);

      // Assert
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('job.jobType', 'jobType');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('AVG(job.retryCount)', 'averageRetries');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'job.createdAt >= :fromDate',
        { fromDate: expect.any(Date) }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('job.retryCount > 0');
      
      expect(result).toEqual({
        totalJobsWithRetries: 15,
        byJobType: {
          [JobType.QUERY_EXECUTION]: {
            averageRetries: 1.5,
            successRate: 75,
            totalJobs: 10,
          },
          [JobType.BULK_DATA_EXPORT]: {
            averageRetries: 2.2,
            successRate: 60,
            totalJobs: 5,
          },
        },
        overallSuccessRate: expect.any(Number),
      });
    });

    it('should handle empty statistics', async () => {
      // Arrange
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getRetryStatistics(7);

      // Assert
      expect(result).toEqual({
        totalJobsWithRetries: 0,
        byJobType: {},
        overallSuccessRate: 0,
      });
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate correct delay for different job types', () => {
      // Test delays for different retry counts and job types
      const testCases = [
        { jobType: JobType.QUERY_EXECUTION, retryCount: 1, expectedMinDelay: 1000 },
        { jobType: JobType.QUERY_EXECUTION, retryCount: 2, expectedMinDelay: 2000 },
        { jobType: JobType.BULK_DATA_EXPORT, retryCount: 1, expectedMinDelay: 5000 },
        { jobType: JobType.DATA_MIGRATION, retryCount: 1, expectedMinDelay: 10000 },
      ];

      testCases.forEach(({ jobType, retryCount, expectedMinDelay }) => {
        const delay = service.calculateRetryDelay(retryCount, jobType);
        expect(delay).toBeGreaterThanOrEqual(expectedMinDelay);
        expect(delay).toBeLessThanOrEqual(expectedMinDelay * 2); // Max jitter factor
      });
    });

    it('should respect maximum delay limits', () => {
      // Very high retry count should not exceed maximum delay
      const delay = service.calculateRetryDelay(10, JobType.QUERY_EXECUTION);
      expect(delay).toBeLessThanOrEqual(300000); // 5 minutes max
    });
  });

  describe('error handling', () => {
    it('should handle database errors during retry', async () => {
      // Arrange
      const failedJob = { ...mockJob };
      const error = new Error('Database connection failed');
      
      jobRepository.save.mockRejectedValue(error);

      // Act & Assert
      await expect(service.retryJob(failedJob)).rejects.toThrow('Database connection failed');
    });

    it('should handle scheduler errors gracefully', async () => {
      // Arrange
      const failedJob = { ...mockJob };
      const error = new Error('Scheduler service unavailable');
      
      jobRepository.save.mockResolvedValue(failedJob);
      jobSchedulerService.scheduleJob.mockRejectedValue(error);

      // Act & Assert
      await expect(service.scheduleRetry(failedJob)).rejects.toThrow('Scheduler service unavailable');
    });
  });

  describe('retry strategy configuration', () => {
    it('should use correct retry strategies for each job type', () => {
      const strategies = service.getRetryStrategies();
      
      expect(strategies).toHaveProperty(JobType.QUERY_EXECUTION);
      expect(strategies).toHaveProperty(JobType.BULK_DATA_EXPORT);
      expect(strategies).toHaveProperty(JobType.DASHBOARD_GENERATION);
      expect(strategies).toHaveProperty(JobType.DATA_MIGRATION);
      expect(strategies).toHaveProperty(JobType.CACHE_WARMUP);
      expect(strategies).toHaveProperty(JobType.REPORT_GENERATION);

      // Each strategy should have required properties
      Object.values(strategies).forEach(strategy => {
        expect(strategy).toHaveProperty('baseDelay');
        expect(strategy).toHaveProperty('maxDelay');
        expect(strategy).toHaveProperty('backoffMultiplier');
        expect(strategy).toHaveProperty('jitterFactor');
      });
    });
  });
});