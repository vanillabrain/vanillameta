import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobQueueMonitoringService } from './job-queue-monitoring.service';
import { JobNotificationService } from './job-notification.service';
import { QueueJob, JobStatus, JobType, JobPriority } from '../entities/queue-job.entity';
import { JobMetrics } from '../entities/job-metrics.entity';

describe('JobQueueMonitoringService', () => {
  let service: JobQueueMonitoringService;
  let jobRepository: jest.Mocked<Repository<QueueJob>>;
  let jobMetricsRepository: jest.Mocked<Repository<JobMetrics>>;
  let jobNotificationService: jest.Mocked<JobNotificationService>;

  const mockJob: QueueJob = {
    id: 'job-123',
    jobType: JobType.QUERY_EXECUTION,
    status: JobStatus.COMPLETED,
    priority: JobPriority.NORMAL,
    userId: 'user-123',
    jobData: JSON.stringify({ query: 'SELECT * FROM users' }),
    result: null,
    errorMessage: null,
    errorStack: null,
    retryCount: 0,
    maxRetries: 3,
    progress: 100,
    scheduledAt: null,
    startedAt: new Date(Date.now() - 5000),
    completedAt: new Date(),
    executionTimeMs: 5000,
    estimatedTimeMs: 30000,
    workerId: 'worker-123',
    metadata: null,
    correlationId: null,
    requiresNotification: false,
    notificationEmail: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isCompleted: true,
    isFailed: false,
    isRunning: false,
    canRetry: false,
    jobDataParsed: { query: 'SELECT * FROM users' },
    resultParsed: null,
    metadataParsed: {},
  };

  const mockMetrics: JobMetrics = {
    id: 'metrics-123',
    metricDate: new Date(),
    jobType: JobType.QUERY_EXECUTION,
    status: JobStatus.COMPLETED,
    priority: JobPriority.NORMAL,
    userId: 'user-123',
    jobCount: 100,
    totalExecutionTimeMs: 1500000,
    avgExecutionTimeMs: 15000,
    minExecutionTimeMs: 5000,
    maxExecutionTimeMs: 30000,
    successCount: 80,
    failureCount: 5,
    retryCount: 10,
    cancelledCount: 5,
    successRate: 94.1,
    totalWaitTimeMs: 200000,
    avgWaitTimeMs: 2000,
    queueLengthPeak: 15,
    avgQueueLength: 8.5,
    memoryUsagePeakMB: 512,
    avgMemoryUsageMB: 256,
    errorCount: 5,
    commonErrors: JSON.stringify({
      'Database connection failed': 3,
      'Timeout exceeded': 2,
    }),
    performanceMetrics: JSON.stringify({
      throughputPerHour: 25,
      cpuUtilization: 45.5,
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
    // Virtual properties
    commonErrorsParsed: {
      'Database connection failed': 3,
      'Timeout exceeded': 2,
    },
    performanceMetricsParsed: {
      throughputPerHour: 25,
      cpuUtilization: 45.5,
    },
    avgExecutionTimeSeconds: 15,
    avgWaitTimeSeconds: 2,
    isHealthy: true,
    performanceGrade: 'B',
  } as JobMetrics;

  beforeEach(async () => {
    const mockJobRepository = {
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockJobMetricsRepository = {
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockJobNotificationService = {
      sendSystemNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobQueueMonitoringService,
        {
          provide: getRepositoryToken(QueueJob),
          useValue: mockJobRepository,
        },
        {
          provide: getRepositoryToken(JobMetrics),
          useValue: mockJobMetricsRepository,
        },
        {
          provide: JobNotificationService,
          useValue: mockJobNotificationService,
        },
      ],
    }).compile();

    service = module.get<JobQueueMonitoringService>(JobQueueMonitoringService);
    jobRepository = module.get(getRepositoryToken(QueueJob));
    jobMetricsRepository = module.get(getRepositoryToken(JobMetrics));
    jobNotificationService = module.get(JobNotificationService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getQueueHealth', () => {
    it('should return comprehensive queue health metrics', async () => {
      // Arrange
      jobRepository.count
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(5) // running
        .mockResolvedValueOnce(80) // completed
        .mockResolvedValueOnce(5); // failed

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          averageTime: '15000',
          averageWait: '2000',
        }),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const health = await service.getQueueHealth();

      // Assert
      expect(health).toEqual({
        status: expect.any(String),
        totalJobs: 100,
        pendingJobs: 10,
        runningJobs: 5,
        completedJobs: 80,
        failedJobs: 5,
        successRate: 94.12,
        averageExecutionTime: 15000,
        averageWaitTime: 2000,
        throughputPerHour: expect.any(Number),
        queueDepth: 15,
        healthScore: expect.any(Number),
        alerts: expect.any(Array),
        lastUpdated: expect.any(Date),
      });
    });

    it('should detect unhealthy queue conditions', async () => {
      // Arrange - High failure rate scenario
      jobRepository.count
        .mockResolvedValueOnce(50) // pending (high backlog)
        .mockResolvedValueOnce(2) // running (low workers)
        .mockResolvedValueOnce(40) // completed
        .mockResolvedValueOnce(20); // failed (high failure rate)

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          averageTime: '60000', // slow execution
          averageWait: '30000', // long wait times
        }),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const health = await service.getQueueHealth();

      // Assert
      expect(health.status).toBe('unhealthy');
      expect(health.healthScore).toBeLessThan(70);
      expect(health.alerts.length).toBeGreaterThan(0);
      expect(health.alerts).toContain(
        expect.objectContaining({
          level: 'error',
          message: expect.stringContaining('높은 실패율'),
        }),
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      jobRepository.count.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getQueueHealth()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics for specified time range', async () => {
      // Arrange
      const hours = 24;
      const mockMetricsData = [
        { ...mockMetrics, timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000) },
        { ...mockMetrics, timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000) },
        { ...mockMetrics, timestamp: new Date() },
      ];

      jobMetricsRepository.find.mockResolvedValue(mockMetricsData);

      // Act
      const metrics = await service.getPerformanceMetrics(hours);

      // Assert
      expect(jobMetricsRepository.find).toHaveBeenCalledWith({
        where: {
          timestamp: expect.any(Object), // MoreThanOrEqual
        },
        order: { timestamp: 'ASC' },
      });

      expect(metrics).toEqual({
        timeRange: `${hours} hours`,
        dataPoints: mockMetricsData,
        summary: {
          averageExecutionTime: expect.any(Number),
          averageSuccessRate: expect.any(Number),
          averageThroughput: expect.any(Number),
          peakThroughput: expect.any(Number),
          totalJobsProcessed: expect.any(Number),
        },
        trends: {
          executionTimeTrend: expect.any(String),
          throughputTrend: expect.any(String),
          errorRateTrend: expect.any(String),
        },
      });
    });

    it('should handle empty metrics data', async () => {
      // Arrange
      jobMetricsRepository.find.mockResolvedValue([]);

      // Act
      const metrics = await service.getPerformanceMetrics(24);

      // Assert
      expect(metrics.dataPoints).toEqual([]);
      expect(metrics.summary.totalJobsProcessed).toBe(0);
    });
  });

  describe('getRealtimeMetrics', () => {
    it('should return current real-time metrics', async () => {
      // Arrange
      const mockSystemMetrics = {
        memoryUsage: process.memoryUsage(),
        cpuUsage: 45.5,
        activeConnections: 8,
      };

      jobRepository.count
        .mockResolvedValueOnce(15) // pending
        .mockResolvedValueOnce(4) // running
        .mockResolvedValueOnce(2); // recently completed

      // Act
      const metrics = await service.getRealtimeMetrics();

      // Assert
      expect(metrics).toEqual({
        timestamp: expect.any(Date),
        queueDepth: 15,
        activeJobs: 4,
        recentlyCompleted: 2,
        systemLoad: {
          memoryUsage: expect.any(Object),
          cpuUsage: expect.any(Number),
          activeConnections: expect.any(Number),
        },
        workerStatus: {
          activeWorkers: expect.any(Number),
          idleWorkers: expect.any(Number),
          busyWorkers: expect.any(Number),
        },
        alerts: expect.any(Array),
      });
    });

    it('should detect system performance issues', async () => {
      // Arrange - High memory usage scenario
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 1024 * 1024 * 1024 * 2, // 2GB
        heapTotal: 1024 * 1024 * 1024,
        heapUsed: 1024 * 1024 * 900, // 900MB used
        external: 1024 * 1024 * 100,
        arrayBuffers: 1024 * 1024 * 50,
      });

      jobRepository.count
        .mockResolvedValueOnce(100) // high queue depth
        .mockResolvedValueOnce(1) // low active jobs
        .mockResolvedValueOnce(0); // no recent completions

      // Act
      const metrics = await service.getRealtimeMetrics();

      // Assert
      // 실시간 메트릭 확인
      expect(metrics).toHaveProperty('lastUpdate');
      expect(metrics).toHaveProperty('queueLength');
      expect(metrics).toHaveProperty('runningJobs');
    });
  });

  describe('getJobTypeMetrics', () => {
    it('should return job type distribution and performance', async () => {
      // Arrange
      const days = 7;
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            jobType: JobType.QUERY_EXECUTION,
            count: '60',
            averageTime: '10000',
            successRate: '0.95',
            totalFailed: '3',
          },
          {
            jobType: JobType.BULK_DATA_EXPORT,
            count: '25',
            averageTime: '45000',
            successRate: '0.88',
            totalFailed: '3',
          },
          {
            jobType: JobType.DASHBOARD_GENERATION,
            count: '15',
            averageTime: '20000',
            successRate: '0.93',
            totalFailed: '1',
          },
        ]),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const metrics = await service.getJobTypeMetrics(days);

      // Assert
      expect(metrics).toEqual({
        timeRange: `${days} days`,
        totalJobs: 100,
        byJobType: {
          [JobType.QUERY_EXECUTION]: {
            count: 60,
            percentage: 60,
            averageExecutionTime: 10000,
            successRate: 95,
            failureCount: 3,
          },
          [JobType.BULK_DATA_EXPORT]: {
            count: 25,
            percentage: 25,
            averageExecutionTime: 45000,
            successRate: 88,
            failureCount: 3,
          },
          [JobType.DASHBOARD_GENERATION]: {
            count: 15,
            percentage: 15,
            averageExecutionTime: 20000,
            successRate: 93,
            failureCount: 1,
          },
        },
        insights: expect.any(Array),
      });
    });

    it('should provide performance insights', async () => {
      // Arrange - Scenario with slow job type
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            jobType: JobType.DATA_MIGRATION,
            count: '10',
            averageTime: '120000', // Very slow (2 minutes)
            successRate: '0.70', // Low success rate
            totalFailed: '3',
          },
        ]),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const metrics = await service.getJobTypeMetrics(7);

      // Assert
      // 타입별 메트릭 확인
      expect(metrics[JobType.QUERY_EXECUTION]).toBeDefined();
      expect(metrics[JobType.QUERY_EXECUTION]).toHaveProperty('totalJobs');
      expect(metrics[JobType.QUERY_EXECUTION]).toHaveProperty('successRate');
    });
  });

  describe('getLongRunningJobs', () => {
    it('should return jobs exceeding threshold', async () => {
      // Arrange
      const thresholdMinutes = 30;
      const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);

      const longRunningJobs = [
        {
          ...mockJob,
          id: 'long-job-1',
          status: JobStatus.RUNNING,
          startedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        },
        {
          ...mockJob,
          id: 'long-job-2',
          status: JobStatus.RUNNING,
          startedAt: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago
        },
      ];

      jobRepository.find.mockResolvedValue(longRunningJobs);

      // Act
      const jobs = await service.getLongRunningJobs(thresholdMinutes);

      // Assert
      expect(jobRepository.find).toHaveBeenCalledWith({
        where: {
          status: JobStatus.RUNNING,
          startedAt: expect.any(Object), // LessThanOrEqual
        },
        order: { startedAt: 'ASC' },
      });

      expect(jobs).toEqual(
        longRunningJobs.map(job => ({
          ...job,
          runningTimeMinutes: expect.any(Number),
          isStuck: expect.any(Boolean),
        })),
      );
    });

    it('should identify potentially stuck jobs', async () => {
      // Arrange
      const stuckJob = {
        ...mockJob,
        id: 'stuck-job',
        status: JobStatus.RUNNING,
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        estimatedTimeMs: 30000, // Expected 30 seconds
      };

      jobRepository.find.mockResolvedValue([stuckJob]);

      // Act
      const jobs = await service.getLongRunningJobs(30);

      // Assert
      expect(jobs[0].isStuck).toBe(true);
      expect(jobs[0].runningTimeMinutes).toBeGreaterThan(100); // 2 hours
    });
  });

  describe('aggregateHourlyMetrics', () => {
    it('should aggregate and save hourly metrics', async () => {
      // Arrange
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);

      jobRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(5) // running
        .mockResolvedValueOnce(80) // completed
        .mockResolvedValueOnce(5); // failed

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          avgExecutionTime: '15000',
          avgWaitTime: '2000',
        }),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockMetrics = { ...mockMetrics };
      jobMetricsRepository.create.mockReturnValue(mockMetrics);
      jobMetricsRepository.save.mockResolvedValue(mockMetrics);

      // Act
      await service.aggregateHourlyMetrics();

      // Assert
      expect(jobMetricsRepository.create).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        totalJobs: 100,
        pendingJobs: 10,
        runningJobs: 5,
        completedJobs: 80,
        failedJobs: 5,
        averageExecutionTime: 15000,
        averageWaitTime: 2000,
        successRate: expect.any(Number),
        throughputPerHour: expect.any(Number),
        peakMemoryUsage: expect.any(Number),
        cpuUtilization: expect.any(Number),
        queueDepth: 15,
        activeWorkers: expect.any(Number),
        jobTypeDistribution: expect.any(String),
      });
      expect(jobMetricsRepository.save).toHaveBeenCalled();
    });

    it('should handle aggregation errors gracefully', async () => {
      // Arrange
      const error = new Error('Metrics calculation failed');
      jobRepository.count.mockRejectedValue(error);

      // Act & Assert
      await expect(service.aggregateHourlyMetrics()).resolves.not.toThrow();
    });
  });

  describe('checkHealthAlerts', () => {
    it('should send alerts for critical conditions', async () => {
      // Arrange - Setup critical conditions
      jobRepository.count
        .mockResolvedValueOnce(200) // very high pending
        .mockResolvedValueOnce(1) // very low running
        .mockResolvedValueOnce(50) // completed
        .mockResolvedValueOnce(50); // high failed

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          averageTime: '120000', // very slow
          averageWait: '60000', // very long wait
        }),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      jobNotificationService.sendSystemNotification.mockResolvedValue(undefined);

      // Act
      await service.checkHealthAlerts();

      // Assert
      expect(jobNotificationService.sendSystemNotification).toHaveBeenCalledWith(
        expect.stringContaining('Critical'),
        expect.any(String),
        'high',
      );
    });

    it('should not send alerts for healthy conditions', async () => {
      // Arrange - Setup healthy conditions
      jobRepository.count
        .mockResolvedValueOnce(10) // normal pending
        .mockResolvedValueOnce(5) // good running
        .mockResolvedValueOnce(90) // high completed
        .mockResolvedValueOnce(2); // low failed

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          averageTime: '10000', // fast
          averageWait: '1000', // short wait
        }),
      };

      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await service.checkHealthAlerts();

      // Assert
      expect(jobNotificationService.sendSystemNotification).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle repository errors in metrics collection', async () => {
      // Arrange
      const error = new Error('Database unavailable');
      jobRepository.count.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getQueueHealth()).rejects.toThrow('Database unavailable');
    });

    it('should handle malformed metrics data', async () => {
      // Arrange
      jobMetricsRepository.find.mockResolvedValue([
        { ...mockMetrics, avgExecutionTimeMs: null },
        { ...mockMetrics, successRate: undefined },
      ]);

      // Act & Assert
      await expect(service.getPerformanceMetrics(24)).resolves.not.toThrow();
    });
  });

  describe('system resource monitoring', () => {
    it('should monitor memory usage correctly', () => {
      // Act
      const memoryMetrics = service.getSystemMemoryMetrics();

      // Assert
      expect(memoryMetrics).toHaveProperty('used');
      expect(memoryMetrics).toHaveProperty('total');
      expect(memoryMetrics).toHaveProperty('percentage');
      expect(memoryMetrics.percentage).toBeGreaterThanOrEqual(0);
      expect(memoryMetrics.percentage).toBeLessThanOrEqual(100);
    });

    it('should calculate queue health score correctly', async () => {
      // Arrange
      const healthData = {
        successRate: 95,
        avgExecutionTime: 15000,
        queueDepth: 10,
        failureRate: 5,
      };

      // Act
      const score = service.calculateHealthScore(healthData);

      // Assert
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(typeof score).toBe('number');
    });
  });
});
