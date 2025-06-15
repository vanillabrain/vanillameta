import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobStatusTrackerService } from './job-status-tracker.service';
import { QueueJob, JobStatus, JobType, JobPriority } from '../entities/queue-job.entity';
import { JobStatusHistory } from '../entities/job-status-history.entity';

describe('JobStatusTrackerService', () => {
  let service: JobStatusTrackerService;
  let jobRepository: jest.Mocked<Repository<QueueJob>>;
  let jobStatusHistoryRepository: jest.Mocked<Repository<JobStatusHistory>>;

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

  const mockStatusHistory: JobStatusHistory = {
    id: 'history-123',
    jobId: 'job-123',
    previousStatus: JobStatus.PENDING,
    newStatus: JobStatus.RUNNING,
    changedBy: 'worker-123',
    reason: 'Job started processing',
    metadata: JSON.stringify({ workerId: 'worker-123' }),
    timestamp: new Date(),
    job: mockJob,
    metadataParsed: { workerId: 'worker-123' },
  };

  beforeEach(async () => {
    const mockJobRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockJobStatusHistoryRepository = {
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobStatusTrackerService,
        {
          provide: getRepositoryToken(QueueJob),
          useValue: mockJobRepository,
        },
        {
          provide: getRepositoryToken(JobStatusHistory),
          useValue: mockJobStatusHistoryRepository,
        },
      ],
    }).compile();

    service = module.get<JobStatusTrackerService>(JobStatusTrackerService);
    jobRepository = module.get(getRepositoryToken(QueueJob));
    jobStatusHistoryRepository = module.get(getRepositoryToken(JobStatusHistory));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordStatusChange', () => {
    it('should record status change successfully', async () => {
      // Arrange
      const previousStatus = JobStatus.PENDING;
      const newStatus = JobStatus.RUNNING;
      const changedBy = 'worker-123';
      const reason = 'Job started processing';
      const metadata = { workerId: 'worker-123', startTime: new Date() };

      const createdHistory = { ...mockStatusHistory };
      jobStatusHistoryRepository.create.mockReturnValue(createdHistory);
      jobStatusHistoryRepository.save.mockResolvedValue(createdHistory);

      // Act
      await service.recordStatusChange(
        mockJob.id,
        previousStatus,
        newStatus,
        changedBy,
        reason,
        metadata
      );

      // Assert
      expect(jobStatusHistoryRepository.create).toHaveBeenCalledWith({
        jobId: mockJob.id,
        previousStatus,
        newStatus,
        changedBy,
        reason,
        metadata: JSON.stringify(metadata),
        timestamp: expect.any(Date),
      });
      expect(jobStatusHistoryRepository.save).toHaveBeenCalledWith(createdHistory);
    });

    it('should handle metadata as undefined', async () => {
      // Arrange
      const previousStatus = JobStatus.PENDING;
      const newStatus = JobStatus.RUNNING;
      const changedBy = 'worker-123';

      jobStatusHistoryRepository.create.mockReturnValue(mockStatusHistory);
      jobStatusHistoryRepository.save.mockResolvedValue(mockStatusHistory);

      // Act
      await service.recordStatusChange(
        mockJob.id,
        previousStatus,
        newStatus,
        changedBy
      );

      // Assert
      expect(jobStatusHistoryRepository.create).toHaveBeenCalledWith({
        jobId: mockJob.id,
        previousStatus,
        newStatus,
        changedBy,
        reason: undefined,
        metadata: null,
        timestamp: expect.any(Date),
      });
    });

    it('should handle database save errors', async () => {
      // Arrange
      const error = new Error('Database save failed');
      jobStatusHistoryRepository.create.mockReturnValue(mockStatusHistory);
      jobStatusHistoryRepository.save.mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.recordStatusChange(
          mockJob.id,
          JobStatus.PENDING,
          JobStatus.RUNNING,
          'worker-123'
        )
      ).rejects.toThrow('Database save failed');
    });
  });

  describe('getJobStatusHistory', () => {
    it('should return paginated status history', async () => {
      // Arrange
      const jobId = 'job-123';
      const limit = 10;
      const mockHistory = [
        { ...mockStatusHistory, id: 'history-1' },
        { ...mockStatusHistory, id: 'history-2' },
        { ...mockStatusHistory, id: 'history-3' },
      ];

      jobStatusHistoryRepository.find.mockResolvedValue(mockHistory);

      // Act
      const result = await service.getJobStatusHistory(jobId, limit);

      // Assert
      expect(jobStatusHistoryRepository.find).toHaveBeenCalledWith({
        where: { jobId },
        order: { timestamp: 'DESC' },
        take: limit,
      });
      expect(result).toEqual(mockHistory);
    });

    it('should handle empty history', async () => {
      // Arrange
      const jobId = 'job-123';
      jobStatusHistoryRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getJobStatusHistory(jobId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should apply default limit when not specified', async () => {
      // Arrange
      const jobId = 'job-123';
      jobStatusHistoryRepository.find.mockResolvedValue([]);

      // Act
      await service.getJobStatusHistory(jobId);

      // Assert
      expect(jobStatusHistoryRepository.find).toHaveBeenCalledWith({
        where: { jobId },
        order: { timestamp: 'DESC' },
        take: 50, // default limit
      });
    });
  });

  describe('getStatusStatistics', () => {
    it('should return status statistics for time range', async () => {
      // Arrange
      const hours = 24;
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { newStatus: JobStatus.COMPLETED, count: '15' },
          { newStatus: JobStatus.FAILED, count: '3' },
          { newStatus: JobStatus.RUNNING, count: '5' },
        ]),
      };

      jobStatusHistoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getStatusStatistics(hours);

      // Assert
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('history.newStatus', 'newStatus');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('COUNT(*)', 'count');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'history.timestamp >= :fromDate',
        { fromDate: expect.any(Date) }
      );
      expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith('history.newStatus');
      
      expect(result).toEqual({
        [JobStatus.COMPLETED]: 15,
        [JobStatus.FAILED]: 3,
        [JobStatus.RUNNING]: 5,
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

      jobStatusHistoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getStatusStatistics(24);

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('getJobTransitionHistory', () => {
    it('should return job transition timeline', async () => {
      // Arrange
      const jobId = 'job-123';
      const mockTransitions = [
        {
          ...mockStatusHistory,
          previousStatus: JobStatus.PENDING,
          newStatus: JobStatus.RUNNING,
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
        {
          ...mockStatusHistory,
          previousStatus: JobStatus.RUNNING,
          newStatus: JobStatus.COMPLETED,
          timestamp: new Date('2024-01-01T10:05:00Z'),
        },
      ];

      jobStatusHistoryRepository.find.mockResolvedValue(mockTransitions);

      // Act
      const result = await service.getJobTransitionHistory(jobId);

      // Assert
      expect(jobStatusHistoryRepository.find).toHaveBeenCalledWith({
        where: { jobId },
        order: { timestamp: 'ASC' },
      });
      expect(result).toEqual(mockTransitions);
    });
  });

  describe('getFailureAnalysis', () => {
    it('should analyze failure patterns', async () => {
      // Arrange
      const days = 7;
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            reason: 'Database connection failed',
            count: '5',
            jobType: JobType.QUERY_EXECUTION,
          },
          {
            reason: 'Query timeout',
            count: '3',
            jobType: JobType.BULK_DATA_EXPORT,
          },
        ]),
      };

      jobStatusHistoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getFailureAnalysis(days);

      // Assert
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('history.reason', 'reason');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('COUNT(*)', 'count');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('job.jobType', 'jobType');
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith('history.job', 'job');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('history.newStatus = :status', { status: JobStatus.FAILED });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'history.timestamp >= :fromDate',
        { fromDate: expect.any(Date) }
      );
      
      expect(result).toEqual([
        {
          reason: 'Database connection failed',
          count: 5,
          jobType: JobType.QUERY_EXECUTION,
        },
        {
          reason: 'Query timeout',
          count: 3,
          jobType: JobType.BULK_DATA_EXPORT,
        },
      ]);
    });
  });

  describe('getStatusChangeFrequency', () => {
    it('should calculate status change frequency', async () => {
      // Arrange
      const jobId = 'job-123';
      const mockHistory = [
        {
          ...mockStatusHistory,
          previousStatus: JobStatus.PENDING,
          newStatus: JobStatus.RUNNING,
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
        {
          ...mockStatusHistory,
          previousStatus: JobStatus.RUNNING,
          newStatus: JobStatus.FAILED,
          timestamp: new Date('2024-01-01T10:03:00Z'),
        },
        {
          ...mockStatusHistory,
          previousStatus: JobStatus.FAILED,
          newStatus: JobStatus.RETRY,
          timestamp: new Date('2024-01-01T10:05:00Z'),
        },
        {
          ...mockStatusHistory,
          previousStatus: JobStatus.RETRY,
          newStatus: JobStatus.RUNNING,
          timestamp: new Date('2024-01-01T10:07:00Z'),
        },
        {
          ...mockStatusHistory,
          previousStatus: JobStatus.RUNNING,
          newStatus: JobStatus.COMPLETED,
          timestamp: new Date('2024-01-01T10:12:00Z'),
        },
      ];

      jobStatusHistoryRepository.find.mockResolvedValue(mockHistory);

      // Act
      const result = await service.getStatusChangeFrequency(jobId);

      // Assert
      expect(result).toEqual({
        totalChanges: 5,
        averageTimeBetweenChanges: expect.any(Number),
        transitions: {
          [`${JobStatus.PENDING}->${JobStatus.RUNNING}`]: 1,
          [`${JobStatus.RUNNING}->${JobStatus.FAILED}`]: 1,
          [`${JobStatus.FAILED}->${JobStatus.RETRY}`]: 1,
          [`${JobStatus.RETRY}->${JobStatus.RUNNING}`]: 1,
          [`${JobStatus.RUNNING}->${JobStatus.COMPLETED}`]: 1,
        },
        timeline: mockHistory,
      });
    });

    it('should handle single status change', async () => {
      // Arrange
      const jobId = 'job-123';
      const singleHistory = [mockStatusHistory];

      jobStatusHistoryRepository.find.mockResolvedValue(singleHistory);

      // Act
      const result = await service.getStatusChangeFrequency(jobId);

      // Assert
      expect(result.totalChanges).toBe(1);
      expect(result.averageTimeBetweenChanges).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      jobStatusHistoryRepository.find.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getJobStatusHistory('job-123')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle query builder errors', async () => {
      // Arrange
      const error = new Error('Query execution failed');
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockRejectedValue(error),
      };

      jobStatusHistoryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(service.getStatusStatistics(24)).rejects.toThrow(
        'Query execution failed'
      );
    });
  });

  describe('performance', () => {
    it('should limit history results to prevent memory issues', async () => {
      // Arrange
      const jobId = 'job-123';
      const largeLimit = 10000;

      // Act
      await service.getJobStatusHistory(jobId, largeLimit);

      // Assert
      expect(jobStatusHistoryRepository.find).toHaveBeenCalledWith({
        where: { jobId },
        order: { timestamp: 'DESC' },
        take: 1000, // Should be capped at maximum limit
      });
    });
  });
});