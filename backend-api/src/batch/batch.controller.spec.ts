import { Test, TestingModule } from '@nestjs/testing';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { CreateBatchJobDto } from './dto/create-batch-job.dto';
import { BatchJobResponseDto } from './dto/batch-job-response.dto';
import { BatchJobType, BatchJobStatus } from './entities/batch-job.entity';

describe('BatchController', () => {
  let controller: BatchController;
  let service: BatchService;

  const mockBatchService = {
    createBatchJob: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    restartBatchJob: jest.fn(),
    cancelBatchJob: jest.fn(),
  };

  const mockUser = {
    sub: 'test-user-id',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchController],
      providers: [
        {
          provide: BatchService,
          useValue: mockBatchService,
        },
      ],
    }).compile();

    controller = module.get<BatchController>(BatchController);
    service = module.get<BatchService>(BatchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBatchJob', () => {
    it('배치 작업을 생성하고 응답 DTO를 반환해야 함', async () => {
      const createDto: CreateBatchJobDto = {
        type: BatchJobType.DATASET_QUERY,
        datasetId: 1,
        chunkSize: 1000,
      };

      const mockBatchJob = {
        id: 1,
        type: BatchJobType.DATASET_QUERY,
        status: BatchJobStatus.PENDING,
        totalRecords: 0,
        processedRecords: 0,
        chunkSize: 1000,
        totalChunks: 0,
        completedChunks: 0,
        failedChunks: 0,
        datasetId: 1,
        createdBy: mockUser.sub,
        createdAt: new Date(),
        updatedAt: new Date(),
        get progress() {
          return 0;
        },
        get estimatedTimeRemaining() {
          return null;
        },
      };

      mockBatchService.createBatchJob.mockResolvedValue(mockBatchJob);

      const result = await controller.createBatchJob(createDto, mockUser);

      expect(result).toBeInstanceOf(BatchJobResponseDto);
      expect(result.id).toBe(1);
      expect(result.type).toBe(BatchJobType.DATASET_QUERY);
      expect(mockBatchService.createBatchJob).toHaveBeenCalledWith(createDto, mockUser.sub);
    });
  });

  describe('findAllBatchJobs', () => {
    it('사용자의 모든 배치 작업을 반환해야 함', async () => {
      const mockBatchJobs = [
        {
          id: 1,
          type: BatchJobType.DATASET_QUERY,
          status: BatchJobStatus.COMPLETED,
          totalRecords: 1000,
          processedRecords: 1000,
          get progress() {
            return 100;
          },
          get estimatedTimeRemaining() {
            return null;
          },
        },
        {
          id: 2,
          type: BatchJobType.WIDGET_DATA,
          status: BatchJobStatus.PROCESSING,
          totalRecords: 500,
          processedRecords: 250,
          get progress() {
            return 50;
          },
          get estimatedTimeRemaining() {
            return 5000;
          },
        },
      ];

      mockBatchService.findAll.mockResolvedValue(mockBatchJobs);

      const result = await controller.findAllBatchJobs(mockUser);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(BatchJobResponseDto);
      expect(result[0].progress).toBe(100);
      expect(result[1].progress).toBe(50);
      expect(mockBatchService.findAll).toHaveBeenCalledWith(mockUser.sub);
    });
  });

  describe('findOneBatchJob', () => {
    it('특정 배치 작업을 반환해야 함', async () => {
      const mockBatchJob = {
        id: 1,
        type: BatchJobType.DATASET_QUERY,
        status: BatchJobStatus.PROCESSING,
        totalRecords: 1000,
        processedRecords: 500,
        chunks: [],
        get progress() {
          return 50;
        },
        get estimatedTimeRemaining() {
          return 10000;
        },
      };

      mockBatchService.findOne.mockResolvedValue(mockBatchJob);

      const result = await controller.findOneBatchJob(1);

      expect(result).toBeInstanceOf(BatchJobResponseDto);
      expect(result.id).toBe(1);
      expect(result.progress).toBe(50);
      expect(result.estimatedTimeRemaining).toBe(10000);
    });
  });

  describe('findBatchChunks', () => {
    it('배치 작업의 청크 목록을 반환해야 함', async () => {
      const mockBatchJob = {
        id: 1,
        chunks: [
          {
            id: 1,
            sequence: 0,
            status: 'completed',
            startOffset: 0,
            endOffset: 1000,
            recordCount: 1000,
            processedCount: 1000,
            retryCount: 0,
            get progress() {
              return 100;
            },
            get processingTime() {
              return 5000;
            },
          },
          {
            id: 2,
            sequence: 1,
            status: 'processing',
            startOffset: 1000,
            endOffset: 2000,
            recordCount: 1000,
            processedCount: 500,
            retryCount: 0,
            get progress() {
              return 50;
            },
            get processingTime() {
              return null;
            },
          },
        ],
      };

      mockBatchService.findOne.mockResolvedValue(mockBatchJob);

      const result = await controller.findBatchChunks(1);

      expect(result).toHaveLength(2);
      expect(result[0].progress).toBe(100);
      expect(result[0].processingTime).toBe(5000);
      expect(result[1].progress).toBe(50);
      expect(result[1].processingTime).toBeNull();
    });
  });

  describe('restartBatchJob', () => {
    it('배치 작업을 재시작하고 업데이트된 정보를 반환해야 함', async () => {
      const mockRestartedJob = {
        id: 1,
        type: BatchJobType.DATASET_QUERY,
        status: BatchJobStatus.PROCESSING,
        totalRecords: 1000,
        processedRecords: 0,
        failedChunks: 0,
        get progress() {
          return 0;
        },
        get estimatedTimeRemaining() {
          return null;
        },
      };

      mockBatchService.restartBatchJob.mockResolvedValue(mockRestartedJob);

      const result = await controller.restartBatchJob(1, mockUser);

      expect(result).toBeInstanceOf(BatchJobResponseDto);
      expect(result.status).toBe(BatchJobStatus.PROCESSING);
      expect(result.processedRecords).toBe(0);
      expect(mockBatchService.restartBatchJob).toHaveBeenCalledWith(1, mockUser.sub);
    });
  });

  describe('cancelBatchJob', () => {
    it('배치 작업을 취소하고 업데이트된 정보를 반환해야 함', async () => {
      const mockCancelledJob = {
        id: 1,
        type: BatchJobType.DATASET_QUERY,
        status: BatchJobStatus.CANCELLED,
        totalRecords: 1000,
        processedRecords: 600,
        get progress() {
          return 60;
        },
        get estimatedTimeRemaining() {
          return null;
        },
      };

      mockBatchService.cancelBatchJob.mockResolvedValue(mockCancelledJob);

      const result = await controller.cancelBatchJob(1, mockUser);

      expect(result).toBeInstanceOf(BatchJobResponseDto);
      expect(result.status).toBe(BatchJobStatus.CANCELLED);
      expect(result.progress).toBe(60);
      expect(mockBatchService.cancelBatchJob).toHaveBeenCalledWith(1, mockUser.sub);
    });
  });
});
