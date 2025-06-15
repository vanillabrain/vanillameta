import { Injectable, Logger } from '@nestjs/common';
import { BatchProgress } from '../dto/batch-response.dto';

@Injectable()
export class ProgressTracker {
  private readonly logger = new Logger(ProgressTracker.name);
  private readonly progressMap = new Map<string, BatchProgress>();

  /**
   * 배치 작업 시작
   */
  startBatch(batchId: string, totalChunks: number): BatchProgress {
    const progress: BatchProgress = {
      batchId,
      status: 'processing',
      totalChunks,
      completedChunks: 0,
      progressPercent: 0,
      estimatedTimeRemaining: 0,
      totalRowsProcessed: 0,
      totalProcessingTime: 0,
      averageChunkTime: 0,
      lastChunkCompletedAt: new Date(),
      errorMessages: [],
    };

    this.progressMap.set(batchId, progress);

    this.logger.log('Batch processing started', {
      batchId,
      totalChunks,
    });

    return progress;
  }

  /**
   * 청크 완료 업데이트
   */
  updateChunkCompleted(
    batchId: string,
    chunkIndex: number,
    rowsProcessed: number,
    processingTime: number,
  ): BatchProgress | null {
    const progress = this.progressMap.get(batchId);
    if (!progress) {
      this.logger.warn('Progress not found for batch', { batchId, chunkIndex });
      return null;
    }

    progress.completedChunks += 1;
    progress.totalRowsProcessed += rowsProcessed;
    progress.totalProcessingTime += processingTime;
    progress.averageChunkTime = progress.totalProcessingTime / progress.completedChunks;
    progress.progressPercent = Math.round((progress.completedChunks / progress.totalChunks) * 100);
    progress.lastChunkCompletedAt = new Date();

    // 남은 시간 추정
    const remainingChunks = progress.totalChunks - progress.completedChunks;
    progress.estimatedTimeRemaining = Math.round(remainingChunks * progress.averageChunkTime);

    this.logger.debug('Chunk completed', {
      batchId,
      chunkIndex,
      completedChunks: progress.completedChunks,
      totalChunks: progress.totalChunks,
      progressPercent: progress.progressPercent,
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
    });

    return progress;
  }

  /**
   * 배치 완료
   */
  completeBatch(batchId: string): BatchProgress | null {
    const progress = this.progressMap.get(batchId);
    if (!progress) {
      this.logger.warn('Progress not found for batch completion', { batchId });
      return null;
    }

    progress.status = 'completed';
    progress.progressPercent = 100;
    progress.estimatedTimeRemaining = 0;

    this.logger.log('Batch processing completed', {
      batchId,
      totalChunks: progress.totalChunks,
      totalRowsProcessed: progress.totalRowsProcessed,
      totalProcessingTime: progress.totalProcessingTime,
      averageChunkTime: progress.averageChunkTime,
    });

    // 완료된 작업은 일정 시간 후 메모리에서 제거
    setTimeout(() => {
      this.progressMap.delete(batchId);
      this.logger.debug('Removed completed batch from memory', { batchId });
    }, 300000); // 5분 후 제거

    return progress;
  }

  /**
   * 배치 실패
   */
  failBatch(batchId: string, errorMessage: string, chunkIndex?: number): BatchProgress | null {
    const progress = this.progressMap.get(batchId);
    if (!progress) {
      this.logger.warn('Progress not found for batch failure', { batchId });
      return null;
    }

    progress.status = 'failed';
    if (!progress.errorMessages) {
      progress.errorMessages = [];
    }
    progress.errorMessages.push(errorMessage);

    this.logger.error('Batch processing failed', {
      batchId,
      chunkIndex,
      errorMessage,
      completedChunks: progress.completedChunks,
      totalChunks: progress.totalChunks,
    });

    // 실패한 작업도 일정 시간 후 메모리에서 제거
    setTimeout(() => {
      this.progressMap.delete(batchId);
      this.logger.debug('Removed failed batch from memory', { batchId });
    }, 600000); // 10분 후 제거

    return progress;
  }

  /**
   * 배치 취소
   */
  cancelBatch(batchId: string): BatchProgress | null {
    const progress = this.progressMap.get(batchId);
    if (!progress) {
      this.logger.warn('Progress not found for batch cancellation', { batchId });
      return null;
    }

    progress.status = 'cancelled';

    this.logger.log('Batch processing cancelled', {
      batchId,
      completedChunks: progress.completedChunks,
      totalChunks: progress.totalChunks,
    });

    return progress;
  }

  /**
   * 진행 상황 조회
   */
  getProgress(batchId: string): BatchProgress | null {
    return this.progressMap.get(batchId);
  }

  /**
   * 모든 활성 배치 조회
   */
  getAllActiveProgress(): BatchProgress[] {
    return Array.from(this.progressMap.values()).filter(
      progress => progress.status === 'processing',
    );
  }

  /**
   * 배치 ID 생성
   */
  generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 메모리 정리 (긴급상황용)
   */
  clearCompletedBatches(): number {
    const beforeSize = this.progressMap.size;

    for (const [batchId, progress] of this.progressMap.entries()) {
      if (progress.status === 'completed' || progress.status === 'failed') {
        this.progressMap.delete(batchId);
      }
    }

    const clearedCount = beforeSize - this.progressMap.size;
    this.logger.log('Cleared completed batches from memory', {
      clearedCount,
      remainingCount: this.progressMap.size,
    });

    return clearedCount;
  }

  /**
   * 메모리 사용량 정보
   */
  getMemoryInfo(): {
    activeBatches: number;
    totalBatches: number;
    memoryUsageEstimateKB: number;
  } {
    const totalBatches = this.progressMap.size;
    const activeBatches = this.getAllActiveProgress().length;

    // 대략적인 메모리 사용량 추정 (각 배치 정보당 약 1KB)
    const memoryUsageEstimateKB = totalBatches * 1;

    return {
      activeBatches,
      totalBatches,
      memoryUsageEstimateKB,
    };
  }
}
