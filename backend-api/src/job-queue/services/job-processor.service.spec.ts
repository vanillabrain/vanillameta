import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobProcessorService } from './job-processor.service';
import { QueueJob, JobStatus, JobType, JobPriority } from '../entities/queue-job.entity';
import { JobResult } from '../entities/job-result.entity';
import { ConnectionService } from '../../connection/connection.service';
import { DatabaseService } from '../../database/database.service';
import { BatchProcessingService } from '../../batch-processing/batch-processing.service';

describe('JobProcessorService', () => {
  let service: JobProcessorService;
  let jobRepository: jest.Mocked<Repository<QueueJob>>;
  let jobResultRepository: jest.Mocked<Repository<JobResult>>;
  let connectionService: jest.Mocked<ConnectionService>;
  let databaseService: jest.Mocked<DatabaseService>;
  let batchProcessingService: jest.Mocked<BatchProcessingService>;

  const mockJob: QueueJob = {
    id: 'job-123',
    jobType: JobType.QUERY_EXECUTION,
    status: JobStatus.PENDING,
    priority: JobPriority.NORMAL,
    userId: 'user-123',
    jobData: JSON.stringify({ 
      query: 'SELECT * FROM users',
      databaseId: 1,
      limit: 100
    }),
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
    jobDataParsed: { 
      query: 'SELECT * FROM users',
      databaseId: 1,
      limit: 100
    },
    resultParsed: null,
    metadataParsed: {},
  };

  const mockQueryResult = {
    data: [
      { id: 1, name: 'User 1', email: 'user1@example.com' },
      { id: 2, name: 'User 2', email: 'user2@example.com' },
    ],
    total: 2,
    columns: ['id', 'name', 'email'],
    executionTime: 150,
  };

  beforeEach(async () => {
    const mockJobRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const mockJobResultRepository = {
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockConnectionService = {
      getConnectionConfig: jest.fn(),
      testConnection: jest.fn(),
    };

    const mockDatabaseService = {
      executeQuery: jest.fn(),
      getTableSchema: jest.fn(),
      getTableColumns: jest.fn(),
    };

    const mockBatchProcessingService = {
      processBatchQuery: jest.fn(),
      exportDataInBatches: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobProcessorService,
        {
          provide: getRepositoryToken(QueueJob),
          useValue: mockJobRepository,
        },
        {
          provide: getRepositoryToken(JobResult),
          useValue: mockJobResultRepository,
        },
        {
          provide: ConnectionService,
          useValue: mockConnectionService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: BatchProcessingService,
          useValue: mockBatchProcessingService,
        },
      ],
    }).compile();

    service = module.get<JobProcessorService>(JobProcessorService);
    jobRepository = module.get(getRepositoryToken(QueueJob));
    jobResultRepository = module.get(getRepositoryToken(JobResult));
    connectionService = module.get(ConnectionService);
    databaseService = module.get(DatabaseService);
    batchProcessingService = module.get(BatchProcessingService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processJob', () => {
    beforeEach(() => {
      jobRepository.save.mockResolvedValue(mockJob);
      jobResultRepository.create.mockReturnValue({} as any);
      jobResultRepository.save.mockResolvedValue({} as any);
    });

    it('should process QUERY_EXECUTION job successfully', async () => {
      // Arrange
      const job = { ...mockJob, jobType: JobType.QUERY_EXECUTION };
      
      connectionService.getConnectionConfig.mockResolvedValue({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'test',
        password: 'test',
        database: 'testdb',
      } as any);

      databaseService.executeQuery.mockResolvedValue(mockQueryResult);

      // Act
      await service.processJob(job);

      // Assert
      expect(connectionService.getConnectionConfig).toHaveBeenCalledWith(1);
      expect(databaseService.executeQuery).toHaveBeenCalledWith(
        expect.any(Object), // connection config
        'SELECT * FROM users',
        expect.any(Object)  // options
      );
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.COMPLETED,
          progress: 100,
          executionTimeMs: expect.any(Number),
        })
      );
    });

    it('should process BULK_DATA_EXPORT job successfully', async () => {
      // Arrange
      const exportJob = { 
        ...mockJob, 
        jobType: JobType.BULK_DATA_EXPORT,
        jobData: JSON.stringify({
          query: 'SELECT * FROM large_table',
          databaseId: 1,
          format: 'csv',
          chunkSize: 1000,
        })
      };

      connectionService.getConnectionConfig.mockResolvedValue({
        type: 'mysql',
        host: 'localhost',
      } as any);

      batchProcessingService.exportDataInBatches.mockResolvedValue({
        totalRows: 5000,
        exportedRows: 5000,
        filePath: '/tmp/export_123.csv',
        fileSize: 1024000,
      });

      // Act
      await service.processJob(exportJob);

      // Assert
      expect(batchProcessingService.exportDataInBatches).toHaveBeenCalledWith(
        expect.any(Object), // connection config
        'SELECT * FROM large_table',
        expect.objectContaining({
          format: 'csv',
          chunkSize: 1000,
        })
      );
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.COMPLETED,
          progress: 100,
        })
      );
    });

    it('should process DASHBOARD_GENERATION job successfully', async () => {
      // Arrange
      const dashboardJob = { 
        ...mockJob, 
        jobType: JobType.DASHBOARD_GENERATION,
        jobData: JSON.stringify({
          dashboardId: 'dash-123',
          widgetQueries: [
            { widgetId: 'widget-1', query: 'SELECT COUNT(*) FROM users' },
            { widgetId: 'widget-2', query: 'SELECT AVG(age) FROM users' },
          ],
          databaseId: 1,
        })
      };

      connectionService.getConnectionConfig.mockResolvedValue({
        type: 'postgresql',
        host: 'localhost',
      } as any);

      databaseService.executeQuery
        .mockResolvedValueOnce({ data: [{ count: 100 }], total: 1 })
        .mockResolvedValueOnce({ data: [{ avg: 25.5 }], total: 1 });

      // Act
      await service.processJob(dashboardJob);

      // Assert
      expect(databaseService.executeQuery).toHaveBeenCalledTimes(2);
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.COMPLETED,
          progress: 100,
        })
      );
    });

    it('should handle job processing errors', async () => {
      // Arrange
      const job = { ...mockJob };
      const error = new Error('Database connection failed');

      connectionService.getConnectionConfig.mockRejectedValue(error);

      // Act
      await service.processJob(job);

      // Assert
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.FAILED,
          errorMessage: 'Database connection failed',
          errorStack: expect.any(String),
        })
      );
    });

    it('should update job progress during processing', async () => {
      // Arrange
      const job = { ...mockJob, jobType: JobType.DATA_MIGRATION };

      connectionService.getConnectionConfig.mockResolvedValue({
        type: 'mysql',
        host: 'localhost',
      } as any);

      // Mock progress updates
      let progressCallback: (progress: number) => void;
      databaseService.executeQuery.mockImplementation(async (config, query, options) => {
        progressCallback = options.onProgress;
        // Simulate progress updates
        setTimeout(() => progressCallback(25), 10);
        setTimeout(() => progressCallback(50), 20);
        setTimeout(() => progressCallback(75), 30);
        return mockQueryResult;
      });

      // Act
      await service.processJob(job);

      // Assert - Progress updates should be called
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: expect.any(Number),
        })
      );
    });

    it('should handle timeout during job processing', async () => {
      // Arrange
      const job = { ...mockJob, estimatedTimeMs: 1000 }; // 1 second timeout
      
      connectionService.getConnectionConfig.mockResolvedValue({
        type: 'mysql',
        host: 'localhost',
      } as any);

      // Mock a long-running query
      databaseService.executeQuery.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockQueryResult), 2000))
      );

      // Act
      await service.processJob(job);

      // Assert
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.FAILED,
          errorMessage: expect.stringContaining('timeout'),
        })
      );
    });

    it('should validate job data before processing', async () => {
      // Arrange
      const invalidJob = { 
        ...mockJob, 
        jobData: JSON.stringify({ /* missing required fields */ })
      };

      // Act
      await service.processJob(invalidJob);

      // Assert
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: JobStatus.FAILED,
          errorMessage: expect.stringContaining('Invalid job data'),
        })
      );
    });
  });

  describe('processor registration', () => {
    it('should register all job type processors', () => {
      // Act
      const processorTypes = service.getRegisteredProcessorTypes();

      // Assert
      expect(processorTypes).toContain(JobType.QUERY_EXECUTION);
      expect(processorTypes).toContain(JobType.BULK_DATA_EXPORT);
      expect(processorTypes).toContain(JobType.DASHBOARD_GENERATION);
      expect(processorTypes).toContain(JobType.DATA_MIGRATION);
      expect(processorTypes).toContain(JobType.CACHE_WARMUP);
      expect(processorTypes).toContain(JobType.REPORT_GENERATION);
    });

    it('should throw error for unsupported job type', async () => {
      // Arrange
      const unsupportedJob = { 
        ...mockJob, 
        jobType: 'UNSUPPORTED_TYPE' as JobType
      };

      // Act & Assert
      await expect(service.processJob(unsupportedJob)).rejects.toThrow(
        'No processor found for job type: UNSUPPORTED_TYPE'
      );
    });
  });

  describe('result storage', () => {
    beforeEach(() => {
      connectionService.getConnectionConfig.mockResolvedValue({
        type: 'mysql',
        host: 'localhost',
      } as any);
      databaseService.executeQuery.mockResolvedValue(mockQueryResult);
      jobRepository.save.mockResolvedValue(mockJob);
    });

    it('should store job result for successful execution', async () => {
      // Arrange
      const job = { ...mockJob };
      const mockJobResult = {
        id: 'result-123',
        jobId: job.id,
        resultData: JSON.stringify(mockQueryResult),
      };

      jobResultRepository.create.mockReturnValue(mockJobResult as any);
      jobResultRepository.save.mockResolvedValue(mockJobResult as any);

      // Act
      await service.processJob(job);

      // Assert
      expect(jobResultRepository.create).toHaveBeenCalledWith({
        jobId: job.id,
        resultData: JSON.stringify(mockQueryResult),
        metadata: expect.any(String),
        createdAt: expect.any(Date),
      });
      expect(jobResultRepository.save).toHaveBeenCalled();
    });

    it('should not store result for failed job', async () => {
      // Arrange
      const job = { ...mockJob };
      databaseService.executeQuery.mockRejectedValue(new Error('Query failed'));

      // Act
      await service.processJob(job);

      // Assert
      expect(jobResultRepository.create).not.toHaveBeenCalled();
      expect(jobResultRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('performance metrics', () => {
    it('should calculate and store execution metrics', async () => {
      // Arrange
      const job = { ...mockJob };
      
      connectionService.getConnectionConfig.mockResolvedValue({
        type: 'mysql',
        host: 'localhost',
      } as any);
      databaseService.executeQuery.mockResolvedValue(mockQueryResult);

      const startTime = Date.now();

      // Act
      await service.processJob(job);

      // Assert
      const endTime = Date.now();
      expect(jobRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          executionTimeMs: expect.any(Number),
          startedAt: expect.any(Date),
          completedAt: expect.any(Date),
        })
      );

      // Verify execution time is reasonable
      const savedJob = jobRepository.save.mock.calls[jobRepository.save.mock.calls.length - 1][0];
      expect(savedJob.executionTimeMs).toBeGreaterThan(0);
      expect(savedJob.executionTimeMs).toBeLessThan(endTime - startTime + 100); // Allow some tolerance
    });
  });
});