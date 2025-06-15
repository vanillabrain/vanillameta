import { ResponseStatus } from '../../common/enum/response-status.enum';
import { QueryComplexity, DatabaseEngine } from './timeout-config.dto';

export interface TimeoutAnalysisResult {
  recommendedTimeoutMs: number;
  actualComplexity: QueryComplexity;
  analysisFactors: {
    joinCount: number;
    subqueryCount: number;
    aggregationCount: number;
    windowFunctionCount: number;
    estimatedRows?: number;
  };
  confidenceScore: number; // 0-100
  reasoning: string[];
}

export interface TimeoutExecutionResult {
  success: boolean;
  executionTimeMs: number;
  timeoutMs: number;
  wasTimedOut: boolean;
  query: string;
  databaseEngine: DatabaseEngine;
  complexity: QueryComplexity;
  metadata?: {
    rowsAffected?: number;
    memoryUsedMB?: number;
    cpuTimeMs?: number;
  };
  errorMessage?: string;
}

export interface TimeoutStatistics {
  engine: DatabaseEngine;
  totalQueries: number;
  timeoutCount: number;
  timeoutRate: number;
  averageExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  optimalTimeoutSuggestion: number;
}

export interface TimeoutMonitoringReport {
  reportPeriod: {
    startTime: Date;
    endTime: Date;
  };
  summary: {
    totalQueries: number;
    totalTimeouts: number;
    overallTimeoutRate: number;
    averageExecutionTime: number;
    savedTimeFromOptimization: number;
  };
  byEngine: TimeoutStatistics[];
  byComplexity: {
    complexity: QueryComplexity;
    averageTime: number;
    timeoutRate: number;
    recommendedTimeout: number;
  }[];
  recommendations: string[];
  alertsTriggered: string[];
}

export class TimeoutConfigResponseDto {
  status: ResponseStatus;
  message?: string;
  data?: {
    currentConfig?: {
      engine: DatabaseEngine;
      defaultTimeoutMs: number;
      batchTimeoutMs: number;
      adaptiveEnabled: boolean;
      monitoringEnabled: boolean;
    };
    rules?: Array<{
      engine: DatabaseEngine;
      complexity: QueryComplexity;
      timeoutMs: number;
      description: string;
    }>;
    statistics?: TimeoutStatistics[];
    analysis?: TimeoutAnalysisResult;
    executionResult?: TimeoutExecutionResult;
    monitoringReport?: TimeoutMonitoringReport;
  };
}

export class AdaptiveTimeoutResponseDto {
  status: ResponseStatus;
  message?: string;
  data?: {
    originalTimeoutMs: number;
    adaptedTimeoutMs: number;
    adjustmentReason: string;
    confidenceLevel: number;
    appliedMultiplier: number;
    historicalAverage?: number;
    recommendation: string;
  };
}