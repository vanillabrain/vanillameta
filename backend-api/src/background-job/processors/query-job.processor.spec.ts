import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import { QueryJobProcessor } from './query-job.processor';
import { BackgroundJob, JobStatus } from '../entities/background-job.entity';
import { JobResult, ResultStorageType } from '../entities/job-result.entity';
import { DatasetService } from '../../dataset/dataset.service';
import { DatabaseService } from '../../database/database.service';
import { ConnectionService } from '../../connection/connection.service';
import { CustomLoggerService } from '../../common/logger/logger.service';
type LoggerService = CustomLoggerService;

describe('QueryJobProcessor', () => {
  let processor: QueryJobProcessor;
  let backgroundJobRepository: Repository<BackgroundJob>;
  let jobResultRepository: Repository<JobResult>;
  let datasetService: DatasetService;
  let databaseService: DatabaseService;
  let connectionService: ConnectionService;
  let logger: LoggerService;

  const mockBackgroundJobRepository = {
    update: jest.fn(),
  };

  const mockJobResultRepository = {
    save: jest.fn(),
  };

  const mockDatasetService = {};

  const mockDatabaseService = {
    findOne: jest.fn(),
  };

  const mockConnectionService = {
    executeQuery: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryJobProcessor,
        {
          provide: getRepositoryToken(BackgroundJob),
          useValue: mockBackgroundJobRepository,
        },
        {
          provide: getRepositoryToken(JobResult),
          useValue: mockJobResultRepository,
        },
        {
          provide: DatasetService,
          useValue: mockDatasetService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: ConnectionService,
          useValue: mockConnectionService,
        },
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    processor = module.get<QueryJobProcessor>(QueryJobProcessor);
    backgroundJobRepository = module.get<Repository<BackgroundJob>>(
      getRepositoryToken(BackgroundJob),
    );
    jobResultRepository = module.get<Repository<JobResult>>(getRepositoryToken(JobResult));
    datasetService = module.get<DatasetService>(DatasetService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    connectionService = module.get<ConnectionService>(ConnectionService);
    logger = module.get<LoggerService>(CustomLoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleQueryExecution', () => {
    const mockJob: Partial<Job> = {
      data: {
        backgroundJobId: 'job123',
        userId: 'user123',
        query: 'SELECT * FROM users',
        databaseId: 'database123',
      },
      attemptsMade: 1,
      progress: jest.fn(),
    };

    it('should successfully execute a query and store results', async () => {
      const database = { id: 'database123', name: 'Test DB' };
      const queryResult = {
        data: [
          { id: 1, name: 'User 1' },
          { id: 2, name: 'User 2' },
        ],
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'name', type: 'string' },
        ],
        executionTime: 100,
      };

      const savedResult = {
        id: 'result123',
        backgroundJobId: 'job123',
        rowCount: 2,
        resultSizeBytes: 200,
        storageType: ResultStorageType.DATABASE,
      };

      mockDatabaseService.findOne.mockResolvedValueOnce(database);
      mockConnectionService.executeQuery.mockResolvedValueOnce(queryResult);
      mockJobResultRepository.save.mockResolvedValueOnce(savedResult);

      const result = await processor.handleQueryExecution(mockJob as Job);

      expect(result).toMatchObject({
        success: true,
        resultId: savedResult.id,
        rowCount: savedResult.rowCount,
      });

      // Verify status updates
      expect(mockBackgroundJobRepository.update).toHaveBeenCalledWith(
        'job123',
        expect.objectContaining({
          status: JobStatus.PROCESSING,
          startedAt: expect.any(Date),
          progress: 10,
        }),
      );

      expect(mockBackgroundJobRepository.update).toHaveBeenLastCalledWith(
        'job123',
        expect.objectContaining({
          status: JobStatus.COMPLETED,
          completedAt: expect.any(Date),
          progress: 100,
        }),
      );

      // Verify progress updates
      expect(mockJob.progress).toHaveBeenCalledWith(20);
      expect(mockJob.progress).toHaveBeenCalledWith(30);
      expect(mockJob.progress).toHaveBeenCalledWith(70);
      expect(mockJob.progress).toHaveBeenCalledWith(80);
      expect(mockJob.progress).toHaveBeenCalledWith(90);
    });

    it('should handle query execution failure', async () => {
      const error = new Error('Database connection failed');

      mockDatabaseService.findOne.mockRejectedValueOnce(error);

      await expect(processor.handleQueryExecution(mockJob as Job)).rejects.toThrow(error);

      expect(mockBackgroundJobRepository.update).toHaveBeenLastCalledWith(
        'job123',
        expect.objectContaining({
          status: JobStatus.FAILED,
          errorMessage: error.message,
          attemptCount: 1,
        }),
      );
    });

    it('should compress large results before storing', async () => {
      const largeData = Array(1000).fill({ id: 1, data: 'x'.repeat(1000) });
      const queryResult = {
        data: largeData,
        columns: [{ name: 'id', type: 'integer' }],
        executionTime: 100,
      };

      mockDatabaseService.findOne.mockResolvedValueOnce({ id: 'database123' });
      mockConnectionService.executeQuery.mockResolvedValueOnce(queryResult);
      mockJobResultRepository.save.mockImplementation(result => Promise.resolve(result));

      await processor.handleQueryExecution(mockJob as Job);

      expect(mockJobResultRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isCompressed: true,
          compressionType: 'lz-string',
          storageType: ResultStorageType.DATABASE,
        }),
      );
    });

    it('should handle database not found error', async () => {
      mockDatabaseService.findOne.mockResolvedValueOnce(null);

      await expect(processor.handleQueryExecution(mockJob as Job)).rejects.toThrow(
        'Database not found: database123',
      );
    });
  });
});
