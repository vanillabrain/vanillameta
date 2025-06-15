import { ResponseStatus } from '../../common/enum/response-status.enum';

export interface FieldInfo {
  columnName: string;
  columnType: string;
}

export interface ChunkResult {
  chunkIndex: number;
  chunkSize: number;
  data: any[];
  fields: FieldInfo[];
  processingTime: number;
  rowsReturned: number;
  startOffset: number;
  endOffset: number;
}

export interface BatchProgress {
  batchId: string;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  totalChunks: number;
  completedChunks: number;
  progressPercent: number;
  estimatedTimeRemaining: number; // milliseconds
  totalRowsProcessed: number;
  totalProcessingTime: number;
  averageChunkTime: number;
  lastChunkCompletedAt: Date;
  errorMessages?: string[];
}

export interface BatchResponseDto {
  status: ResponseStatus;
  message?: string;
  batchId: string;
  progress: BatchProgress;
  chunks?: ChunkResult[];
  summary?: {
    totalRows: number;
    totalChunks: number;
    totalProcessingTime: number;
    averageRowsPerSecond: number;
    memoryUsageMB: number;
    cacheHitRate?: number;
  };
  metadata?: {
    query: string;
    databaseId: number;
    startedAt: Date;
    completedAt?: Date;
    chunkSize: number;
    streamingEnabled: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
    failedChunkIndex?: number;
  };
}

export interface StreamingChunkResponseDto {
  type: 'chunk' | 'progress' | 'complete' | 'error';
  batchId: string;
  chunk?: ChunkResult;
  progress?: BatchProgress;
  error?: {
    code: string;
    message: string;
    chunkIndex?: number;
  };
  final?: {
    summary: BatchResponseDto['summary'];
    metadata: BatchResponseDto['metadata'];
  };
}