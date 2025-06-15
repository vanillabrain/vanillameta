import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Database } from '../database/entities/database.entity';
import { BatchExecuteDto } from './dto/batch-execute.dto';
import { BatchResponseDto, ChunkResult, FieldInfo } from './dto/batch-response.dto';
import { ChunkProcessor } from './services/chunk-processor.service';
import { ProgressTracker } from './services/progress-tracker.service';
import { StreamingResponseService } from './services/streaming-response.service';
import { ResponseStatus } from '../common/enum/response-status.enum';

@Injectable()
export class BatchProcessingService {
  private readonly logger = new Logger(BatchProcessingService.name);

  constructor(
    @InjectRepository(Database)
    private readonly databaseRepository: Repository<Database>,
    private readonly chunkProcessor: ChunkProcessor,
    private readonly progressTracker: ProgressTracker,
    private readonly streamingService: StreamingResponseService,
  ) {}

  /**
   * 배치 처리 실행 (스트리밍 응답)
   */
  async executeBatchStreaming(batchDto: BatchExecuteDto, res: Response): Promise<void> {
    const batchId = batchDto.batchId || this.progressTracker.generateBatchId();
    
    try {
      // 데이터베이스 정보 확인
      const database = await this.databaseRepository.findOne({
        where: { id: batchDto.databaseId },
      });

      if (!database) {
        throw new BadRequestException(`Database not found: ${batchDto.databaseId}`);
      }

      // 스트리밍 응답 초기화
      this.streamingService.initializeStreaming(res, batchId);

      // 배치 처리 시작
      await this.processBatchWithStreaming(batchDto, batchId, database, res);

    } catch (error) {
      this.logger.error('Batch processing failed', {
        batchId,
        error: error.message,
        stack: error.stack,
      });

      this.streamingService.streamError(res, batchId, {
        code: 'BATCH_PROCESSING_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 배치 처리 실행 (일반 응답)
   */
  async executeBatch(batchDto: BatchExecuteDto): Promise<BatchResponseDto> {
    const batchId = batchDto.batchId || this.progressTracker.generateBatchId();
    
    try {
      // 데이터베이스 정보 확인
      const database = await this.databaseRepository.findOne({
        where: { id: batchDto.databaseId },
      });

      if (!database) {
        throw new BadRequestException(`Database not found: ${batchDto.databaseId}`);
      }

      return await this.processBatchNonStreaming(batchDto, batchId, database);

    } catch (error) {
      this.logger.error('Batch processing failed', {
        batchId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * 스트리밍 배치 처리
   */
  private async processBatchWithStreaming(
    batchDto: BatchExecuteDto,
    batchId: string,
    database: Database,
    res: Response,
  ): Promise<void> {
    const startTime = Date.now();
    const allChunks: ChunkResult[] = [];
    let totalRowsProcessed = 0;

    try {
      // 총 레코드 수 계산
      const totalRows = await this.chunkProcessor.calculateTotalRows(
        batchDto.databaseId,
        batchDto.query,
        batchDto.parameters?.map(p => p.value),
      );

      // 청크 크기 최적화
      const optimizedChunkSize = this.chunkProcessor.getDatabaseOptimizedChunkSize(
        database.engine,
        this.chunkProcessor.optimizeChunkSize(totalRows),
      );

      const effectiveChunkSize = batchDto.chunkSize || optimizedChunkSize;
      const maxRows = batchDto.totalLimit || totalRows;
      const totalChunks = Math.ceil(Math.min(maxRows, totalRows) / effectiveChunkSize);

      // 진행 상황 추적 시작
      let progress = this.progressTracker.startBatch(batchId, totalChunks);

      // 초기 진행 상황 스트리밍
      if (batchDto.enableProgressTracking) {
        this.streamingService.streamProgress(res, batchId, progress);
      }

      // 청크별 처리
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        // 연결 상태 확인
        if (!this.streamingService.isConnectionAlive(res)) {
          this.logger.warn('Client disconnected, stopping batch processing', { batchId, chunkIndex });
          this.progressTracker.cancelBatch(batchId);
          break;
        }

        const offset = (batchDto.offset || 0) + (chunkIndex * effectiveChunkSize);

        try {
          // 청크 처리
          const chunk = await this.chunkProcessor.processChunk(
            batchDto.databaseId,
            batchDto.query,
            chunkIndex,
            effectiveChunkSize,
            offset,
            batchDto.parameters?.map(p => p.value),
            batchDto.timeoutMs,
          );

          allChunks.push(chunk);
          totalRowsProcessed += chunk.rowsReturned;

          // 청크 데이터 스트리밍
          this.streamingService.streamChunk(res, batchId, chunk);

          // 진행 상황 업데이트
          progress = this.progressTracker.updateChunkCompleted(
            batchId,
            chunkIndex,
            chunk.rowsReturned,
            chunk.processingTime,
          );

          // 진행 상황 스트리밍 (매 청크마다 또는 특정 간격마다)
          if (batchDto.enableProgressTracking && progress) {
            this.streamingService.streamProgress(res, batchId, progress);
          }

          // 메모리 관리: 오래된 청크는 메모리에서 제거
          if (allChunks.length > 10) {
            allChunks.shift(); // 가장 오래된 청크 제거
          }

          // 하트비트 전송 (장시간 처리 시)
          if (chunkIndex > 0 && chunkIndex % 5 === 0) {
            this.streamingService.sendHeartbeat(res, batchId);
          }

        } catch (chunkError) {
          this.logger.error('Chunk processing failed', {
            batchId,
            chunkIndex,
            error: chunkError.message,
          });

          this.progressTracker.failBatch(batchId, chunkError.message, chunkIndex);
          
          this.streamingService.streamError(res, batchId, {
            code: 'CHUNK_PROCESSING_ERROR',
            message: chunkError.message,
            chunkIndex,
          });
          return;
        }
      }

      // 배치 완료
      progress = this.progressTracker.completeBatch(batchId);
      const totalProcessingTime = Date.now() - startTime;

      // 최종 결과 생성
      const response: BatchResponseDto = {
        status: ResponseStatus.SUCCESS,
        batchId,
        progress,
        summary: {
          totalRows: totalRowsProcessed,
          totalChunks: allChunks.length,
          totalProcessingTime,
          averageRowsPerSecond: Math.round((totalRowsProcessed / totalProcessingTime) * 1000),
          memoryUsageMB: this.estimateMemoryUsage(allChunks),
        },
        metadata: {
          query: batchDto.query,
          databaseId: batchDto.databaseId,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          chunkSize: effectiveChunkSize,
          streamingEnabled: true,
        },
      };

      // 완료 메시지 스트리밍
      this.streamingService.streamComplete(res, response);

    } catch (error) {
      this.progressTracker.failBatch(batchId, error.message);
      throw error;
    }
  }

  /**
   * 비스트리밍 배치 처리
   */
  private async processBatchNonStreaming(
    batchDto: BatchExecuteDto,
    batchId: string,
    database: Database,
  ): Promise<BatchResponseDto> {
    const startTime = Date.now();
    const allChunks: ChunkResult[] = [];
    let totalRowsProcessed = 0;

    try {
      // 총 레코드 수 계산
      const totalRows = await this.chunkProcessor.calculateTotalRows(
        batchDto.databaseId,
        batchDto.query,
        batchDto.parameters?.map(p => p.value),
      );

      // 청크 크기 최적화
      const optimizedChunkSize = this.chunkProcessor.getDatabaseOptimizedChunkSize(
        database.engine,
        this.chunkProcessor.optimizeChunkSize(totalRows),
      );

      const effectiveChunkSize = batchDto.chunkSize || optimizedChunkSize;
      const maxRows = batchDto.totalLimit || totalRows;
      const totalChunks = Math.ceil(Math.min(maxRows, totalRows) / effectiveChunkSize);

      // 진행 상황 추적 시작
      let progress = this.progressTracker.startBatch(batchId, totalChunks);

      // 청크별 처리
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const offset = (batchDto.offset || 0) + (chunkIndex * effectiveChunkSize);

        try {
          const chunk = await this.chunkProcessor.processChunk(
            batchDto.databaseId,
            batchDto.query,
            chunkIndex,
            effectiveChunkSize,
            offset,
            batchDto.parameters?.map(p => p.value),
            batchDto.timeoutMs,
          );

          allChunks.push(chunk);
          totalRowsProcessed += chunk.rowsReturned;

          // 진행 상황 업데이트
          progress = this.progressTracker.updateChunkCompleted(
            batchId,
            chunkIndex,
            chunk.rowsReturned,
            chunk.processingTime,
          );

        } catch (chunkError) {
          this.progressTracker.failBatch(batchId, chunkError.message, chunkIndex);
          throw new Error(`Chunk ${chunkIndex} failed: ${chunkError.message}`);
        }
      }

      // 배치 완료
      progress = this.progressTracker.completeBatch(batchId);
      const totalProcessingTime = Date.now() - startTime;

      // 응답 생성
      const response: BatchResponseDto = {
        status: ResponseStatus.SUCCESS,
        batchId,
        progress,
        chunks: allChunks,
        summary: {
          totalRows: totalRowsProcessed,
          totalChunks: allChunks.length,
          totalProcessingTime,
          averageRowsPerSecond: Math.round((totalRowsProcessed / totalProcessingTime) * 1000),
          memoryUsageMB: this.estimateMemoryUsage(allChunks),
        },
        metadata: {
          query: batchDto.query,
          databaseId: batchDto.databaseId,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          chunkSize: effectiveChunkSize,
          streamingEnabled: false,
        },
      };

      return response;

    } catch (error) {
      this.progressTracker.failBatch(batchId, error.message);
      throw error;
    }
  }

  /**
   * 배치 진행 상황 조회
   */
  async getBatchProgress(batchId: string): Promise<any> {
    const progress = this.progressTracker.getProgress(batchId);
    
    if (!progress) {
      throw new BadRequestException(`Batch not found: ${batchId}`);
    }

    return {
      status: ResponseStatus.SUCCESS,
      data: progress,
    };
  }

  /**
   * 배치 취소
   */
  async cancelBatch(batchId: string): Promise<any> {
    const progress = this.progressTracker.cancelBatch(batchId);
    
    if (!progress) {
      throw new BadRequestException(`Batch not found: ${batchId}`);
    }

    this.logger.log('Batch cancelled', { batchId });

    return {
      status: ResponseStatus.SUCCESS,
      message: 'Batch cancelled successfully',
      data: progress,
    };
  }

  /**
   * 활성 배치 목록 조회
   */
  async getActiveBatches(): Promise<any> {
    const activeBatches = this.progressTracker.getAllActiveProgress();
    
    return {
      status: ResponseStatus.SUCCESS,
      data: {
        count: activeBatches.length,
        batches: activeBatches,
      },
    };
  }

  /**
   * 메모리 사용량 추정
   */
  private estimateMemoryUsage(chunks: ChunkResult[]): number {
    let totalMemoryMB = 0;
    
    chunks.forEach(chunk => {
      const fieldsCount = chunk.fields.length;
      const rowsCount = chunk.rowsReturned;
      // 각 셀당 평균 50바이트 추정
      const chunkMemoryMB = (fieldsCount * rowsCount * 50) / (1024 * 1024);
      totalMemoryMB += chunkMemoryMB;
    });

    return Math.round(totalMemoryMB * 100) / 100;
  }

  /**
   * 시스템 상태 정보
   */
  async getSystemStatus(): Promise<any> {
    const memoryInfo = this.progressTracker.getMemoryInfo();
    const streamingStats = this.streamingService.getStreamingStats();

    return {
      status: ResponseStatus.SUCCESS,
      data: {
        activeBatches: memoryInfo.activeBatches,
        totalBatches: memoryInfo.totalBatches,
        memoryUsageKB: memoryInfo.memoryUsageEstimateKB + streamingStats.memoryUsageEstimateKB,
        activeStreams: streamingStats.activeStreams,
        timestamp: new Date().toISOString(),
      },
    };
  }
}