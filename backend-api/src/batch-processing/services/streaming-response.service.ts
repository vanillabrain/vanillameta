import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import {
  StreamingChunkResponseDto,
  ChunkResult,
  BatchProgress,
  BatchResponseDto,
} from '../dto/batch-response.dto';

@Injectable()
export class StreamingResponseService {
  private readonly logger = new Logger(StreamingResponseService.name);

  /**
   * 스트리밍 응답 초기화
   */
  initializeStreaming(res: Response, batchId: string): void {
    // Server-Sent Events 헤더 설정
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // 연결 확인을 위한 초기 메시지
    this.sendEvent(res, 'init', {
      type: 'init',
      batchId,
      message: 'Batch processing started',
      timestamp: new Date().toISOString(),
    });

    this.logger.debug('Streaming response initialized', { batchId });
  }

  /**
   * 청크 데이터 스트리밍
   */
  streamChunk(res: Response, batchId: string, chunk: ChunkResult): void {
    const streamData: StreamingChunkResponseDto = {
      type: 'chunk',
      batchId,
      chunk,
    };

    this.sendEvent(res, 'chunk', streamData);

    this.logger.debug('Chunk streamed', {
      batchId,
      chunkIndex: chunk.chunkIndex,
      rowsReturned: chunk.rowsReturned,
    });
  }

  /**
   * 진행 상황 스트리밍
   */
  streamProgress(res: Response, batchId: string, progress: BatchProgress): void {
    const streamData: StreamingChunkResponseDto = {
      type: 'progress',
      batchId,
      progress,
    };

    this.sendEvent(res, 'progress', streamData);

    this.logger.debug('Progress streamed', {
      batchId,
      progressPercent: progress.progressPercent,
      completedChunks: progress.completedChunks,
    });
  }

  /**
   * 완료 메시지 스트리밍
   */
  streamComplete(res: Response, response: BatchResponseDto): void {
    const streamData: StreamingChunkResponseDto = {
      type: 'complete',
      batchId: response.batchId,
      final: {
        summary: response.summary,
        metadata: response.metadata,
      },
    };

    this.sendEvent(res, 'complete', streamData);

    // 스트림 종료
    res.write('event: end\n');
    res.write('data: {}\n\n');
    res.end();

    this.logger.log('Batch processing completed and streamed', {
      batchId: response.batchId,
      totalRows: response.summary?.totalRows,
      totalProcessingTime: response.summary?.totalProcessingTime,
    });
  }

  /**
   * 에러 메시지 스트리밍
   */
  streamError(res: Response, batchId: string, error: any): void {
    const streamData: StreamingChunkResponseDto = {
      type: 'error',
      batchId,
      error: {
        code: error.code || 'BATCH_PROCESSING_ERROR',
        message: error.message || 'An error occurred during batch processing',
        chunkIndex: error.chunkIndex,
      },
    };

    this.sendEvent(res, 'error', streamData);

    // 에러 발생 시 스트림 종료
    res.write('event: end\n');
    res.write('data: {}\n\n');
    res.end();

    this.logger.error('Error streamed and connection closed', {
      batchId,
      error: error.message,
      chunkIndex: error.chunkIndex,
    });
  }

  /**
   * Server-Sent Events 메시지 전송
   */
  private sendEvent(res: Response, eventType: string, data: any): void {
    try {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      this.logger.error('Failed to send SSE event', {
        eventType,
        error: error.message,
      });
    }
  }

  /**
   * 연결 상태 확인 (클라이언트가 연결을 끊었는지 확인)
   */
  isConnectionAlive(res: Response): boolean {
    // Express Response는 Node.js Stream을 기반으로 하므로 writableEnded를 확인
    return res.writable && !res.writableEnded;
  }

  /**
   * 하트비트 전송 (장시간 처리 시 연결 유지)
   */
  sendHeartbeat(res: Response, batchId: string): void {
    if (this.isConnectionAlive(res)) {
      this.sendEvent(res, 'heartbeat', {
        batchId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 배치 처리 취소 응답
   */
  streamCancellation(res: Response, batchId: string, reason: string): void {
    const streamData: StreamingChunkResponseDto = {
      type: 'error',
      batchId,
      error: {
        code: 'BATCH_CANCELLED',
        message: `Batch processing cancelled: ${reason}`,
      },
    };

    this.sendEvent(res, 'cancelled', streamData);

    res.write('event: end\n');
    res.write('data: {}\n\n');
    res.end();

    this.logger.log('Batch processing cancelled and streamed', {
      batchId,
      reason,
    });
  }

  /**
   * 청크 데이터 압축 (대용량 데이터 최적화)
   */
  compressChunkData(
    chunk: ChunkResult,
    compressionLevel: 'none' | 'light' | 'aggressive' = 'light',
  ): ChunkResult {
    if (compressionLevel === 'none') {
      return chunk;
    }

    const compressedChunk = { ...chunk };

    if (compressionLevel === 'light') {
      // 경량 압축: 필드 정보는 첫 번째 청크에만 포함
      if (chunk.chunkIndex > 0) {
        compressedChunk.fields = []; // 필드 정보 제거
      }
    } else if (compressionLevel === 'aggressive') {
      // 강력한 압축: 불필요한 메타데이터 제거
      delete compressedChunk.processingTime;
      if (chunk.chunkIndex > 0) {
        compressedChunk.fields = [];
      }
    }

    return compressedChunk;
  }

  /**
   * 배치 처리 상태를 위한 폴링 응답 (스트리밍 비지원 클라이언트용)
   */
  createPollingResponse(progress: BatchProgress, chunks?: ChunkResult[]): any {
    return {
      batchId: progress.batchId,
      status: progress.status,
      progress: {
        percent: progress.progressPercent,
        completedChunks: progress.completedChunks,
        totalChunks: progress.totalChunks,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
      },
      chunks: chunks || [],
      hasMore: progress.status === 'processing',
    };
  }

  /**
   * 메모리 사용량 모니터링을 위한 스트림 정보
   */
  getStreamingStats(): {
    activeStreams: number;
    memoryUsageEstimateKB: number;
  } {
    // 실제 구현에서는 활성 스트림을 추적해야 함
    // 여기서는 기본 구조만 제공
    return {
      activeStreams: 0,
      memoryUsageEstimateKB: 0,
    };
  }
}
