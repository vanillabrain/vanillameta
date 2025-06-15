import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobQueueService } from './job-queue.service';
import { QueueJob, JobStatus, JobType, JobPriority } from './entities/queue-job.entity';
import { JobResult } from './entities/job-result.entity';
import { JobSchedulerService } from './services/job-scheduler.service';
import { JobStatusTrackerService } from './services/job-status-tracker.service';
import { JobRetryService } from './services/job-retry.service';
import { JobNotificationService } from './services/job-notification.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobQueryDto } from './dto/job-query.dto';
import { UpdateJobStatusDto } from './dto/job-status.dto';

describe('JobQueueService', () => {
  let service: JobQueueService;
  let jobRepository: jest.Mocked<Repository<QueueJob>>;
  let jobResultRepository: jest.Mocked<Repository<JobResult>>;
  let jobSchedulerService: jest.Mocked<JobSchedulerService>;
  let jobStatusTrackerService: jest.Mocked<JobStatusTrackerService>;
  let jobRetryService: jest.Mocked<JobRetryService>;
  let jobNotificationService: jest.Mocked<JobNotificationService>;

  const mockJob: QueueJob = {
    id: 'job-123',
    jobType: JobType.QUERY_EXECUTION,
    status: JobStatus.PENDING,
    priority: JobPriority.NORMAL,
    userId: 'user-123',
    jobData: JSON.stringify({ query: 'SELECT * FROM users' }),
    result: null,
    errorMessage: null,
    errorStack: null,
    retryCount: 0,
    maxRetries: 3,
    progress: 0,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    executionTimeMs: null,
    estimatedTimeMs: 30000,
    workerId: null,
    metadata: null,
    correlationId: null,
    requiresNotification: false,
    notificationEmail: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isCompleted: false,
    isFailed: false,
    isRunning: false,
    canRetry: true,
    jobDataParsed: { query: 'SELECT * FROM users' },
    resultParsed: null,
    metadataParsed: {},
  };

  beforeEach(async () => {
    const mockJobRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockJobResultRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockJobSchedulerService = {
      scheduleJob: jest.fn(),
      removeJob: jest.fn(),
    };

    const mockJobStatusTrackerService = {
      recordStatusChange: jest.fn(),
    };

    const mockJobRetryService = {
      scheduleRetry: jest.fn(),
      retryJob: jest.fn(),
      bulkRetry: jest.fn(),
    };

    const mockJobNotificationService = {
      sendJobCompletionNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobQueueService,
        {
          provide: getRepositoryToken(QueueJob),
          useValue: mockJobRepository,
        },
        {
          provide: getRepositoryToken(JobResult),
          useValue: mockJobResultRepository,
        },
        {
          provide: JobSchedulerService,
          useValue: mockJobSchedulerService,
        },
        {
          provide: JobStatusTrackerService,
          useValue: mockJobStatusTrackerService,
        },
        {
          provide: JobRetryService,
          useValue: mockJobRetryService,
        },
        {
          provide: JobNotificationService,
          useValue: mockJobNotificationService,
        },
      ],
    }).compile();

    service = module.get<JobQueueService>(JobQueueService);
    jobRepository = module.get(getRepositoryToken(QueueJob));
    jobResultRepository = module.get(getRepositoryToken(JobResult));
    jobSchedulerService = module.get(JobSchedulerService);
    jobStatusTrackerService = module.get(JobStatusTrackerService);
    jobRetryService = module.get(JobRetryService);
    jobNotificationService = module.get(JobNotificationService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createJob', () => {
    it('should create a new job successfully', async () => {
      // Arrange
      const createJobDto: CreateJobDto = {
        jobType: JobType.QUERY_EXECUTION,
        jobData: { query: 'SELECT * FROM users', databaseId: 1 },
        priority: JobPriority.NORMAL,
        maxRetries: 3,
      };

      const savedJob = { ...mockJob };
      jobRepository.save.mockResolvedValue(savedJob);
      jobSchedulerService.scheduleJob.mockResolvedValue(undefined);
      jobStatusTrackerService.recordStatusChange.mockResolvedValue(undefined);

      // Act
      const result = await service.createJob(createJobDto, 'user-123');

      // Assert
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: JobType.QUERY_EXECUTION,
          userId: 'user-123',
          priority: JobPriority.NORMAL,
          maxRetries: 3,
        })
      );
      expect(jobSchedulerService.scheduleJob).toHaveBeenCalledWith(savedJob);
      expect(jobStatusTrackerService.recordStatusChange).toHaveBeenCalled();
      expect(result).toEqual(savedJob);
    });

    it('should handle scheduled jobs', async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 60000); // 1 minute later
      const createJobDto: CreateJobDto = {
        jobType: JobType.QUERY_EXECUTION,
        jobData: { query: 'SELECT * FROM users' },
        scheduledAt: futureDate.toISOString(),
      };

      const savedJob = { ...mockJob, scheduledAt: futureDate };
      jobRepository.save.mockResolvedValue(savedJob);

      // Act
      const result = await service.createJob(createJobDto, 'user-123');

      // Assert
      expect(result.scheduledAt).toEqual(futureDate);
    });

    it('should reject past scheduled times', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      const createJobDto: CreateJobDto = {
        jobType: JobType.QUERY_EXECUTION,
        jobData: { query: 'SELECT * FROM users' },
        scheduledAt: pastDate.toISOString(),
      };

      // Act & Assert
      await expect(service.createJob(createJobDto, 'user-123')).rejects.toThrow(
        'Scheduled time must be in the future'
      );
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status successfully', async () => {
      // Arrange
      const updateDto: UpdateJobStatusDto = {
        status: JobStatus.RUNNING,
        progress: 50,
        workerId: 'worker-123',
      };

      const existingJob = { ...mockJob };
      const updatedJob = { ...mockJob, status: JobStatus.RUNNING, progress: 50, workerId: 'worker-123' };
      
      jobRepository.findOne.mockResolvedValue(existingJob);
      jobRepository.save.mockResolvedValue(updatedJob);
      jobStatusTrackerService.recordStatusChange.mockResolvedValue(undefined);

      // Act
      const result = await service.updateJobStatus('job-123', updateDto, 'user-123');

      // Assert
      expect(jobRepository.findOne).toHaveBeenCalledWith({ where: { id: 'job-123' } });
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.RUNNING,
          progress: 50,
          workerId: 'worker-123',
        })
      );
      expect(result.status).toBe(JobStatus.RUNNING);
    });

    it('should handle job completion', async () => {
      // Arrange
      const updateDto: UpdateJobStatusDto = {
        status: JobStatus.COMPLETED,
        progress: 100,
      };

      const runningJob = { 
        ...mockJob, 
        status: JobStatus.RUNNING, 
        startedAt: new Date(Date.now() - 30000) // Started 30 seconds ago
      };
      
      jobRepository.findOne.mockResolvedValue(runningJob);
      jobRepository.save.mockResolvedValue({ ...runningJob, status: JobStatus.COMPLETED });

      // Act
      const result = await service.updateJobStatus('job-123', updateDto);

      // Assert
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.COMPLETED,
          completedAt: expect.any(Date),
          executionTimeMs: expect.any(Number),
        })
      );
    });

    it('should handle job failure and schedule retry', async () => {
      // Arrange
      const updateDto: UpdateJobStatusDto = {
        status: JobStatus.FAILED,
        errorMessage: 'Database connection failed',
      };

      const runningJob = { ...mockJob, status: JobStatus.RUNNING, retryCount: 0, maxRetries: 3 };
      jobRepository.findOne.mockResolvedValue(runningJob);
      jobRepository.save.mockResolvedValue({ ...runningJob, status: JobStatus.FAILED });
      jobRetryService.scheduleRetry.mockResolvedValue(undefined);

      // Act
      await service.updateJobStatus('job-123', updateDto);

      // Assert
      expect(jobRetryService.scheduleRetry).toHaveBeenCalledWith(
        expect.objectContaining({ status: JobStatus.FAILED })
      );
    });

    it('should send notification for completed job', async () => {
      // Arrange
      const updateDto: UpdateJobStatusDto = {
        status: JobStatus.COMPLETED,
      };

      const job = { ...mockJob, requiresNotification: true };
      jobRepository.findOne.mockResolvedValue(job);
      jobRepository.save.mockResolvedValue({ ...job, status: JobStatus.COMPLETED });
      jobNotificationService.sendJobCompletionNotification.mockResolvedValue(undefined);

      // Act
      await service.updateJobStatus('job-123', updateDto);

      // Assert
      expect(jobNotificationService.sendJobCompletionNotification).toHaveBeenCalled();
    });

    it('should throw error for invalid status transition', async () => {
      // Arrange
      const updateDto: UpdateJobStatusDto = {
        status: JobStatus.RUNNING,
      };

      const completedJob = { ...mockJob, status: JobStatus.COMPLETED };
      jobRepository.findOne.mockResolvedValue(completedJob);

      // Act & Assert
      await expect(service.updateJobStatus('job-123', updateDto)).rejects.toThrow(
        'Invalid status transition'
      );
    });
  });

  describe('getJobs', () => {
    it('should return paginated job list', async () => {
      // Arrange
      const queryDto: JobQueryDto = {
        page: 1,
        limit: 10,
        status: JobStatus.PENDING,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
        getMany: jest.fn().mockResolvedValue([mockJob]),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getJobs(queryDto, 'user-123');

      // Assert
      expect(result.total).toBe(5);
      expect(result.jobs).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should filter jobs by user', async () => {
      // Arrange
      const queryDto: JobQueryDto = {};
      
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await service.getJobs(queryDto, 'user-123');

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('job.userId = :userId', { userId: 'user-123' });
    });
  });

  describe('getJob', () => {
    it('should return job by id', async () => {
      // Arrange
      jobRepository.findOne.mockResolvedValue(mockJob);

      // Act
      const result = await service.getJob('job-123', 'user-123');

      // Assert
      expect(jobRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'job-123', userId: 'user-123' },
        relations: ['jobResult'],
      });
      expect(result).toEqual(mockJob);
    });

    it('should throw error if job not found', async () => {
      // Arrange
      jobRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getJob('job-123', 'user-123')).rejects.toThrow(
        'Job not found: job-123'
      );
    });
  });

  describe('cancelJob', () => {
    it('should cancel pending job', async () => {
      // Arrange
      const pendingJob = { ...mockJob, status: JobStatus.PENDING };
      jobRepository.findOne.mockResolvedValue(pendingJob);
      jobRepository.save.mockResolvedValue({ ...pendingJob, status: JobStatus.CANCELLED });
      jobSchedulerService.removeJob.mockResolvedValue(undefined);

      // Act
      await service.cancelJob('job-123', 'User requested cancellation', 'user-123');

      // Assert
      expect(jobSchedulerService.removeJob).toHaveBeenCalledWith('job-123');
    });

    it('should not cancel completed job', async () => {
      // Arrange
      const completedJob = { ...mockJob, status: JobStatus.COMPLETED };
      jobRepository.findOne.mockResolvedValue(completedJob);

      // Act & Assert
      await expect(
        service.cancelJob('job-123', 'Cannot cancel', 'user-123')
      ).rejects.toThrow('Cannot cancel completed or already cancelled job');
    });
  });

  describe('getNextJob', () => {
    it('should return next pending job', async () => {
      // Arrange
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockJob),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      jobRepository.save.mockResolvedValue({ ...mockJob, status: JobStatus.RUNNING });

      // Act
      const result = await service.getNextJob('worker-123');

      // Assert
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('job.status = :status', { status: JobStatus.PENDING });
      expect(result).toBeDefined();
    });

    it('should return null if no jobs available', async () => {
      // Arrange
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getNextJob('worker-123');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('retryJob', () => {
    it('should retry failed job', async () => {
      // Arrange
      const failedJob = { ...mockJob, status: JobStatus.FAILED, retryCount: 1, maxRetries: 3 };
      jobRepository.findOne.mockResolvedValue(failedJob);
      jobRetryService.retryJob.mockResolvedValue(undefined);

      // Act
      await service.retryJob('job-123', 'user-123');

      // Assert
      expect(jobRetryService.retryJob).toHaveBeenCalledWith(failedJob);
    });

    it('should not retry job that cannot be retried', async () => {
      // Arrange
      const jobAtMaxRetries = { ...mockJob, status: JobStatus.FAILED, retryCount: 3, maxRetries: 3, canRetry: false };
      jobRepository.findOne.mockResolvedValue(jobAtMaxRetries);

      // Act & Assert
      await expect(service.retryJob('job-123', 'user-123')).rejects.toThrow(
        'Job cannot be retried'
      );
    });
  });
});