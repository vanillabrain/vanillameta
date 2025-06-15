import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { BatchProcessingService } from './batch-processing.service';
import { ChunkProcessor } from './services/chunk-processor.service';
import { ProgressTracker } from './services/progress-tracker.service';
import { StreamingResponseService } from './services/streaming-response.service';
import { Database } from '../database/entities/database.entity';
import { BatchExecuteDto } from './dto/batch-execute.dto';
import { ResponseStatus } from '../common/enum/response-status.enum';

describe('BatchProcessingService', () => {
  let service: BatchProcessingService;
  let databaseRepository: jest.Mocked<Repository<Database>>;
  let chunkProcessor: jest.Mocked<ChunkProcessor>;
  let progressTracker: jest.Mocked<ProgressTracker>;
  let streamingService: jest.Mocked<StreamingResponseService>;

  const mockDatabase: Database = {
    id: 1,
    name: 'test-db',
    description: 'Test database',
    engine: 'pg',
    type: 'postgresql',
    connectionConfig: '{"host":"localhost","port":5432}',
    timezone: 'UTC',
    createdAt: new Date(),
    updatedAt: new Date(),
    getFullDescription: jest.fn().mockReturnValue('test-db Test database'),
  } as any;

  beforeEach(async () => {
    const mockDatabaseRepository = {
      findOne: jest.fn(),
    };

    const mockChunkProcessor = {
      calculateTotalRows: jest.fn(),
      getDatabaseOptimizedChunkSize: jest.fn(),
      optimizeChunkSize: jest.fn(),
      processChunk: jest.fn(),
    };

    const mockProgressTracker = {
      generateBatchId: jest.fn(),
      startBatch: jest.fn(),
      updateChunkCompleted: jest.fn(),
      completeBatch: jest.fn(),
      failBatch: jest.fn(),
      cancelBatch: jest.fn(),
      getProgress: jest.fn(),
      getAllActiveProgress: jest.fn(),
      getMemoryInfo: jest.fn(),
    };

    const mockStreamingService = {
      initializeStreaming: jest.fn(),
      streamChunk: jest.fn(),
      streamProgress: jest.fn(),
      streamComplete: jest.fn(),
      streamError: jest.fn(),
      isConnectionAlive: jest.fn(),
      sendHeartbeat: jest.fn(),
      getStreamingStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchProcessingService,
        {
          provide: getRepositoryToken(Database),
          useValue: mockDatabaseRepository,
        },
        {
          provide: ChunkProcessor,
          useValue: mockChunkProcessor,
        },
        {
          provide: ProgressTracker,
          useValue: mockProgressTracker,
        },
        {
          provide: StreamingResponseService,
          useValue: mockStreamingService,
        },
      ],
    }).compile();

    service = module.get<BatchProcessingService>(BatchProcessingService);
    databaseRepository = module.get(getRepositoryToken(Database));
    chunkProcessor = module.get(ChunkProcessor);
    progressTracker = module.get(ProgressTracker);
    streamingService = module.get(StreamingResponseService);
  });

  describe('executeBatch', () => {
    const batchDto: BatchExecuteDto = {
      databaseId: 1,
      query: 'SELECT * FROM test_table',
      chunkSize: 1000,
      enableStreaming: false,
    };

    it('should execute batch processing successfully', async () => {
      // Arrange
      const batchId = 'batch_123';
      const mockProgress = {
        batchId,
        status: 'completed' as const,
        totalChunks: 2,
        completedChunks: 2,
        progressPercent: 100,
        estimatedTimeRemaining: 0,
        totalRowsProcessed: 2000,
        totalProcessingTime: 1500,
        averageChunkTime: 750,
        lastChunkCompletedAt: new Date(),
      };

      const mockChunk1 = {
        chunkIndex: 0,
        chunkSize: 1000,
        data: [{ id: 1, name: 'test1' }],
        fields: [{ columnName: 'id', columnType: 'number' }],
        processingTime: 700,
        rowsReturned: 1000,
        startOffset: 0,
        endOffset: 1000,
      };

      const mockChunk2 = {
        chunkIndex: 1,
        chunkSize: 1000,
        data: [{ id: 2, name: 'test2' }],
        fields: [{ columnName: 'id', columnType: 'number' }],
        processingTime: 800,
        rowsReturned: 1000,
        startOffset: 1000,
        endOffset: 2000,
      };

      databaseRepository.findOne.mockResolvedValue(mockDatabase);
      progressTracker.generateBatchId.mockReturnValue(batchId);
      chunkProcessor.calculateTotalRows.mockResolvedValue(2000);
      chunkProcessor.optimizeChunkSize.mockReturnValue(1000);
      chunkProcessor.getDatabaseOptimizedChunkSize.mockReturnValue(1000);
      progressTracker.startBatch.mockReturnValue(mockProgress);
      chunkProcessor.processChunk
        .mockResolvedValueOnce(mockChunk1)
        .mockResolvedValueOnce(mockChunk2);
      progressTracker.updateChunkCompleted.mockReturnValue(mockProgress);
      progressTracker.completeBatch.mockReturnValue(mockProgress);

      // Act
      const result = await service.executeBatch(batchDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.batchId).toBe(batchId);
      expect(result.chunks).toHaveLength(2);
      expect(result.summary.totalRows).toBe(2000);
      expect(databaseRepository.findOne).toHaveBeenCalledWith({
        where: { id: batchDto.databaseId },
      });
      expect(chunkProcessor.processChunk).toHaveBeenCalledTimes(2);
      expect(progressTracker.completeBatch).toHaveBeenCalledWith(batchId);
    });

    it('should throw BadRequestException for non-existent database', async () => {
      // Arrange
      databaseRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.executeBatch(batchDto)).rejects.toThrow(BadRequestException);
      expect(databaseRepository.findOne).toHaveBeenCalledWith({
        where: { id: batchDto.databaseId },
      });
    });

    it('should handle chunk processing failure', async () => {
      // Arrange
      const batchId = 'batch_123';
      const mockProgress = {
        batchId,
        status: 'processing' as const,
        totalChunks: 1,
        completedChunks: 0,
        progressPercent: 0,
        estimatedTimeRemaining: 1000,
        totalRowsProcessed: 0,
        totalProcessingTime: 0,
        averageChunkTime: 0,
        lastChunkCompletedAt: new Date(),
      };

      databaseRepository.findOne.mockResolvedValue(mockDatabase);
      progressTracker.generateBatchId.mockReturnValue(batchId);
      chunkProcessor.calculateTotalRows.mockResolvedValue(1000);
      chunkProcessor.optimizeChunkSize.mockReturnValue(1000);
      chunkProcessor.getDatabaseOptimizedChunkSize.mockReturnValue(1000);
      progressTracker.startBatch.mockReturnValue(mockProgress);
      chunkProcessor.processChunk.mockRejectedValue(new Error('Chunk processing failed'));
      progressTracker.failBatch.mockReturnValue(mockProgress);

      // Act & Assert
      await expect(service.executeBatch(batchDto)).rejects.toThrow(
        'Chunk 0 failed: Chunk processing failed',
      );
      expect(progressTracker.failBatch).toHaveBeenCalledWith(
        batchId,
        'Chunk 0 failed: Chunk processing failed',
      );
    });
  });

  describe('getBatchProgress', () => {
    it('should return batch progress', async () => {
      // Arrange
      const batchId = 'batch_123';
      const mockProgress = {
        batchId,
        status: 'processing' as const,
        totalChunks: 5,
        completedChunks: 3,
        progressPercent: 60,
        estimatedTimeRemaining: 2000,
        totalRowsProcessed: 3000,
        totalProcessingTime: 1500,
        averageChunkTime: 500,
        lastChunkCompletedAt: new Date(),
      };

      progressTracker.getProgress.mockReturnValue(mockProgress);

      // Act
      const result = await service.getBatchProgress(batchId);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data).toBe(mockProgress);
      expect(progressTracker.getProgress).toHaveBeenCalledWith(batchId);
    });

    it('should throw BadRequestException for non-existent batch', async () => {
      // Arrange
      const batchId = 'nonexistent_batch';
      progressTracker.getProgress.mockReturnValue(null);

      // Act & Assert
      await expect(service.getBatchProgress(batchId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelBatch', () => {
    it('should cancel batch successfully', async () => {
      // Arrange
      const batchId = 'batch_123';
      const mockProgress = {
        batchId,
        status: 'cancelled' as const,
        totalChunks: 5,
        completedChunks: 2,
        progressPercent: 40,
        estimatedTimeRemaining: 0,
        totalRowsProcessed: 2000,
        totalProcessingTime: 1000,
        averageChunkTime: 500,
        lastChunkCompletedAt: new Date(),
      };

      progressTracker.cancelBatch.mockReturnValue(mockProgress);

      // Act
      const result = await service.cancelBatch(batchId);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.message).toBe('Batch cancelled successfully');
      expect(result.data).toBe(mockProgress);
      expect(progressTracker.cancelBatch).toHaveBeenCalledWith(batchId);
    });

    it('should throw BadRequestException for non-existent batch', async () => {
      // Arrange
      const batchId = 'nonexistent_batch';
      progressTracker.cancelBatch.mockReturnValue(null);

      // Act & Assert
      await expect(service.cancelBatch(batchId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getActiveBatches', () => {
    it('should return active batches', async () => {
      // Arrange
      const mockActiveBatches = [
        {
          batchId: 'batch_1',
          status: 'processing' as const,
          totalChunks: 5,
          completedChunks: 3,
          progressPercent: 60,
          estimatedTimeRemaining: 2000,
          totalRowsProcessed: 3000,
          totalProcessingTime: 1500,
          averageChunkTime: 500,
          lastChunkCompletedAt: new Date(),
        },
        {
          batchId: 'batch_2',
          status: 'processing' as const,
          totalChunks: 3,
          completedChunks: 1,
          progressPercent: 33,
          estimatedTimeRemaining: 4000,
          totalRowsProcessed: 1000,
          totalProcessingTime: 800,
          averageChunkTime: 800,
          lastChunkCompletedAt: new Date(),
        },
      ];

      progressTracker.getAllActiveProgress.mockReturnValue(mockActiveBatches);

      // Act
      const result = await service.getActiveBatches();

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.count).toBe(2);
      expect(result.data.batches).toBe(mockActiveBatches);
      expect(progressTracker.getAllActiveProgress).toHaveBeenCalled();
    });
  });

  describe('getSystemStatus', () => {
    it('should return system status', async () => {
      // Arrange
      const mockMemoryInfo = {
        activeBatches: 2,
        totalBatches: 5,
        memoryUsageEstimateKB: 1024,
      };

      const mockStreamingStats = {
        activeStreams: 1,
        memoryUsageEstimateKB: 512,
      };

      progressTracker.getMemoryInfo.mockReturnValue(mockMemoryInfo);
      streamingService.getStreamingStats.mockReturnValue(mockStreamingStats);

      // Act
      const result = await service.getSystemStatus();

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.activeBatches).toBe(2);
      expect(result.data.totalBatches).toBe(5);
      expect(result.data.memoryUsageKB).toBe(1536); // 1024 + 512
      expect(result.data.activeStreams).toBe(1);
      expect(result.data.timestamp).toBeDefined();
    });
  });
});
