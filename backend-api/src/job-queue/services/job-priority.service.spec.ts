import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPriorityService } from './job-priority.service';
import { QueueJob, JobStatus, JobType, JobPriority } from '../entities/queue-job.entity';

describe('JobPriorityService', () => {
  let service: JobPriorityService;
  let jobRepository: jest.Mocked<Repository<QueueJob>>;

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
    metadata: JSON.stringify({ size: 'medium', userTier: 'premium' }),
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
    metadataParsed: { size: 'medium', userTier: 'premium' },
  };

  beforeEach(async () => {
    const mockJobRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobPriorityService,
        {
          provide: getRepositoryToken(QueueJob),
          useValue: mockJobRepository,
        },
      ],
    }).compile();

    service = module.get<JobPriorityService>(JobPriorityService);
    jobRepository = module.get(getRepositoryToken(QueueJob));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateJobPriority', () => {
    it('should calculate priority for standard job', () => {
      // Arrange
      const job = { ...mockJob, priority: JobPriority.NORMAL };

      // Act
      const priority = service.calculateJobPriority(job);

      // Assert
      expect(priority).toBeDefined();
      expect(typeof priority).toBe('number');
      expect(priority).toBeGreaterThan(0);
    });

    it('should give higher priority to URGENT jobs', () => {
      // Arrange
      const urgentJob = { ...mockJob, priority: JobPriority.URGENT };
      const normalJob = { ...mockJob, priority: JobPriority.NORMAL };

      // Act
      const urgentPriority = service.calculateJobPriority(urgentJob);
      const normalPriority = service.calculateJobPriority(normalJob);

      // Assert
      expect(urgentPriority).toBeGreaterThan(normalPriority);
    });

    it('should prioritize older jobs (age factor)', () => {
      // Arrange
      const oldJob = {
        ...mockJob,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      };
      const newJob = {
        ...mockJob,
        createdAt: new Date(), // Just created
      };

      // Act
      const oldJobPriority = service.calculateJobPriority(oldJob);
      const newJobPriority = service.calculateJobPriority(newJob);

      // Assert
      expect(oldJobPriority).toBeGreaterThan(newJobPriority);
    });

    it('should consider retry jobs as higher priority', () => {
      // Arrange
      const retryJob = { ...mockJob, retryCount: 2 };
      const newJob = { ...mockJob, retryCount: 0 };

      // Act
      const retryPriority = service.calculateJobPriority(retryJob);
      const newPriority = service.calculateJobPriority(newJob);

      // Assert
      expect(retryPriority).toBeGreaterThan(newPriority);
    });

    it('should consider job type complexity', () => {
      // Arrange
      const complexJob = { ...mockJob, jobType: JobType.DATA_MIGRATION };
      const simpleJob = { ...mockJob, jobType: JobType.QUERY_EXECUTION };

      // Act
      const complexPriority = service.calculateJobPriority(complexJob);
      const simplePriority = service.calculateJobPriority(simpleJob);

      // Assert - More complex jobs might get different priority treatment
      expect(typeof complexPriority).toBe('number');
      expect(typeof simplePriority).toBe('number');
    });

    it('should consider user tier from metadata', () => {
      // Arrange
      const premiumUserJob = {
        ...mockJob,
        metadata: JSON.stringify({ userTier: 'premium' }),
        metadataParsed: { userTier: 'premium' },
      };
      const basicUserJob = {
        ...mockJob,
        metadata: JSON.stringify({ userTier: 'basic' }),
        metadataParsed: { userTier: 'basic' },
      };

      // Act
      const premiumPriority = service.calculateJobPriority(premiumUserJob);
      const basicPriority = service.calculateJobPriority(basicUserJob);

      // Assert
      expect(premiumPriority).toBeGreaterThanOrEqual(basicPriority);
    });

    it('should handle jobs with no metadata', () => {
      // Arrange
      const jobWithoutMetadata = {
        ...mockJob,
        metadata: null,
        metadataParsed: {},
      };

      // Act & Assert
      expect(() => service.calculateJobPriority(jobWithoutMetadata)).not.toThrow();
    });
  });

  describe('updateJobPriority', () => {
    it('should update single job priority', async () => {
      // Arrange
      const job = { ...mockJob };
      const newPriority = JobPriority.HIGH;

      jobRepository.findOne.mockResolvedValue(job);
      jobRepository.save.mockResolvedValue({ ...job, priority: newPriority });

      // Act
      await service.updateJobPriority(job.id, newPriority, 'Manual priority update');

      // Assert
      expect(jobRepository.findOne).toHaveBeenCalledWith({ where: { id: job.id } });
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: newPriority,
        }),
      );
    });

    it('should throw error if job not found', async () => {
      // Arrange
      jobRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateJobPriority('non-existent-job', JobPriority.HIGH)).rejects.toThrow(
        'Job not found: non-existent-job',
      );
    });

    it('should not update completed jobs', async () => {
      // Arrange
      const completedJob = { ...mockJob, status: JobStatus.COMPLETED };
      jobRepository.findOne.mockResolvedValue(completedJob);

      // Act & Assert
      await expect(service.updateJobPriority(completedJob.id, JobPriority.HIGH)).rejects.toThrow(
        'Cannot update priority of completed or cancelled job',
      );
    });

    it('should not update cancelled jobs', async () => {
      // Arrange
      const cancelledJob = { ...mockJob, status: JobStatus.CANCELLED };
      jobRepository.findOne.mockResolvedValue(cancelledJob);

      // Act & Assert
      await expect(service.updateJobPriority(cancelledJob.id, JobPriority.HIGH)).rejects.toThrow(
        'Cannot update priority of completed or cancelled job',
      );
    });
  });

  describe('recalculateAllPriorities', () => {
    it('should recalculate priorities for all pending jobs', async () => {
      // Arrange
      const pendingJobs = [
        { ...mockJob, id: 'job-1', priority: JobPriority.LOW },
        { ...mockJob, id: 'job-2', priority: JobPriority.NORMAL },
        { ...mockJob, id: 'job-3', priority: JobPriority.HIGH },
      ];

      jobRepository.find.mockResolvedValue(pendingJobs);
      jobRepository.save.mockImplementation(job => Promise.resolve(job));

      // Act
      const result = await service.recalculateAllPriorities();

      // Assert
      expect(jobRepository.find).toHaveBeenCalledWith({
        where: { status: JobStatus.PENDING },
      });
      expect(jobRepository.save).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        totalProcessed: 3,
        updated: 3,
        errors: 0,
        summary: {
          [JobPriority.LOW]: expect.any(Number),
          [JobPriority.NORMAL]: expect.any(Number),
          [JobPriority.HIGH]: expect.any(Number),
          [JobPriority.URGENT]: expect.any(Number),
        },
      });
    });

    it('should handle empty job list', async () => {
      // Arrange
      jobRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.recalculateAllPriorities();

      // Assert
      expect(result.totalProcessed).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should handle individual job update errors', async () => {
      // Arrange
      const pendingJobs = [
        { ...mockJob, id: 'job-1' },
        { ...mockJob, id: 'job-2' },
      ];

      jobRepository.find.mockResolvedValue(pendingJobs);
      jobRepository.save
        .mockResolvedValueOnce(pendingJobs[0]) // First save succeeds
        .mockRejectedValueOnce(new Error('Database error')); // Second save fails

      // Act
      const result = await service.recalculateAllPriorities();

      // Assert
      expect(result.totalProcessed).toBe(2);
      expect(result.updated).toBe(1);
      expect(result.errors).toBe(1);
    });
  });

  describe('getPriorityStatistics', () => {
    it('should return priority distribution statistics', async () => {
      // Arrange
      const days = 7;
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { priority: JobPriority.LOW, count: '5', averageTime: '45000' },
          { priority: JobPriority.NORMAL, count: '20', averageTime: '30000' },
          { priority: JobPriority.HIGH, count: '8', averageTime: '15000' },
          { priority: JobPriority.URGENT, count: '2', averageTime: '5000' },
        ]),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getPriorityStatistics(days);

      // Assert
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('job.priority', 'priority');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('COUNT(*)', 'count');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'AVG(job.executionTimeMs)',
        'averageTime',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('job.createdAt >= :fromDate', {
        fromDate: expect.any(Date),
      });
      expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith('job.priority');

      expect(result).toEqual({
        distribution: {
          [JobPriority.LOW]: { count: 5, percentage: expect.any(Number) },
          [JobPriority.NORMAL]: { count: 20, percentage: expect.any(Number) },
          [JobPriority.HIGH]: { count: 8, percentage: expect.any(Number) },
          [JobPriority.URGENT]: { count: 2, percentage: expect.any(Number) },
        },
        averageExecutionTimes: {
          [JobPriority.LOW]: 45000,
          [JobPriority.NORMAL]: 30000,
          [JobPriority.HIGH]: 15000,
          [JobPriority.URGENT]: 5000,
        },
        totalJobs: 35,
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
      const result = await service.getPriorityStatistics(7);

      // Assert
      expect(result).toEqual({
        distribution: {},
        averageExecutionTimes: {},
        totalJobs: 0,
      });
    });
  });

  describe('getPriorityQueueStatus', () => {
    it('should return current priority queue status', async () => {
      // Arrange
      const mockCounts = [
        { priority: JobPriority.URGENT, status: JobStatus.PENDING, count: '2' },
        { priority: JobPriority.HIGH, status: JobStatus.PENDING, count: '5' },
        { priority: JobPriority.NORMAL, status: JobStatus.PENDING, count: '15' },
        { priority: JobPriority.LOW, status: JobStatus.PENDING, count: '8' },
        { priority: JobPriority.NORMAL, status: JobStatus.RUNNING, count: '3' },
      ];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockCounts),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getPriorityQueueStatus();

      // Assert
      expect(result).toEqual({
        pendingByPriority: {
          [JobPriority.URGENT]: 2,
          [JobPriority.HIGH]: 5,
          [JobPriority.NORMAL]: 15,
          [JobPriority.LOW]: 8,
        },
        runningByPriority: {
          [JobPriority.NORMAL]: 3,
        },
        totalPending: 30,
        totalRunning: 3,
        priorityBreakdown: expect.any(Array),
      });
    });
  });

  describe('getJobsByPriority', () => {
    it('should return jobs filtered by priority', async () => {
      // Arrange
      const priority = JobPriority.HIGH;
      const limit = 10;
      const highPriorityJobs = [
        { ...mockJob, id: 'job-1', priority: JobPriority.HIGH },
        { ...mockJob, id: 'job-2', priority: JobPriority.HIGH },
      ];

      jobRepository.find.mockResolvedValue(highPriorityJobs);

      // Act
      const result = await service.getJobsByPriority(priority, limit);

      // Assert
      expect(jobRepository.find).toHaveBeenCalledWith({
        where: {
          priority: priority,
          status: JobStatus.PENDING,
        },
        order: { createdAt: 'ASC' },
        take: limit,
      });
      expect(result).toEqual(highPriorityJobs);
    });

    it('should apply default limit when not specified', async () => {
      // Arrange
      const priority = JobPriority.NORMAL;
      jobRepository.find.mockResolvedValue([]);

      // Act
      await service.getJobsByPriority(priority);

      // Assert
      expect(jobRepository.find).toHaveBeenCalledWith({
        where: {
          priority: priority,
          status: JobStatus.PENDING,
        },
        order: { createdAt: 'ASC' },
        take: 50, // default limit
      });
    });
  });

  describe('priority calculation algorithms', () => {
    it('should use correct base priority values', () => {
      const priorities = service.getPriorityBaseValues();

      expect(priorities[JobPriority.LOW]).toBeLessThan(priorities[JobPriority.NORMAL]);
      expect(priorities[JobPriority.NORMAL]).toBeLessThan(priorities[JobPriority.HIGH]);
      expect(priorities[JobPriority.HIGH]).toBeLessThan(priorities[JobPriority.URGENT]);
    });

    it('should apply age factor correctly', () => {
      // Arrange
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const oldJob = {
        ...mockJob,
        createdAt: new Date(baseTime.getTime() - 60 * 60 * 1000), // 1 hour ago
      };
      const newJob = {
        ...mockJob,
        createdAt: baseTime,
      };

      // Act
      const oldJobFactor = service.calculateAgeFactor(oldJob);
      const newJobFactor = service.calculateAgeFactor(newJob);

      // Assert
      expect(oldJobFactor).toBeGreaterThan(newJobFactor);
      expect(oldJobFactor).toBeGreaterThan(1);
      expect(newJobFactor).toBe(1);
    });

    it('should apply retry bonus correctly', () => {
      // Arrange
      const normalJob = { ...mockJob, retryCount: 0 };
      const retryJob = { ...mockJob, retryCount: 2 };

      // Act
      const normalBonus = service.calculateRetryBonus(normalJob);
      const retryBonus = service.calculateRetryBonus(retryJob);

      // Assert
      expect(retryBonus).toBeGreaterThan(normalBonus);
      expect(normalBonus).toBe(1);
    });

    it('should apply user tier multiplier', () => {
      // Arrange
      const basicUser = {
        ...mockJob,
        metadataParsed: { userTier: 'basic' },
      };
      const premiumUser = {
        ...mockJob,
        metadataParsed: { userTier: 'premium' },
      };

      // Act
      const basicMultiplier = service.calculateUserTierMultiplier(basicUser);
      const premiumMultiplier = service.calculateUserTierMultiplier(premiumUser);

      // Assert
      expect(premiumMultiplier).toBeGreaterThanOrEqual(basicMultiplier);
    });
  });

  describe('error handling', () => {
    it('should handle database errors in priority calculation', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      jobRepository.find.mockRejectedValue(error);

      // Act & Assert
      await expect(service.recalculateAllPriorities()).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle malformed job data gracefully', () => {
      // Arrange
      const malformedJob = { ...mockJob, createdAt: null } as any;

      // Act & Assert
      expect(() => service.calculateJobPriority(malformedJob)).not.toThrow();
    });

    it('should handle invalid priority values', async () => {
      // Arrange
      const job = { ...mockJob };
      const invalidPriority = 'INVALID' as any;

      jobRepository.findOne.mockResolvedValue(job);

      // Act & Assert
      await expect(service.updateJobPriority(job.id, invalidPriority)).rejects.toThrow();
    });
  });
});
