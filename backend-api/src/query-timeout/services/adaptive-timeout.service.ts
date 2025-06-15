import { Injectable, Logger } from '@nestjs/common';
import { TimeoutConfigurationService } from './timeout-configuration.service';
import { DatabaseEngine, QueryComplexity } from '../dto/timeout-config.dto';
import { TimeoutAnalysisResult } from '../dto/timeout-response.dto';

interface QueryExecutionHistory {
  query: string;
  databaseId: number;
  executionTimes: number[];
  averageTime: number;
  p95Time: number;
  successRate: number;
  lastUpdated: Date;
}

interface AdaptiveTimeoutResult {
  originalTimeoutMs: number;
  adaptedTimeoutMs: number;
  adjustmentReason: string;
  confidenceLevel: number;
  appliedMultiplier: number;
  historicalAverage?: number;
  recommendation: string;
}

@Injectable()
export class AdaptiveTimeoutService {
  private readonly logger = new Logger(AdaptiveTimeoutService.name);
  
  // 쿼리 실행 기록 저장 (메모리 기반, 실제 운영에서는 Redis나 DB 사용 권장)
  private readonly executionHistory = new Map<string, QueryExecutionHistory>();
  
  // 적응 설정
  private readonly adaptiveConfig = {
    minExecutionSamples: 3,          // 적응을 위한 최소 실행 횟수
    maxHistorySize: 50,              // 저장할 최대 실행 기록 수
    confidenceThreshold: 0.7,        // 적응 신뢰도 임계값
    safetyMultiplier: 1.3,          // 안전 계수
    maxAdaptationRatio: 3.0,        // 최대 적응 비율
    minAdaptationRatio: 0.5,        // 최소 적응 비율
    memoryCleanupInterval: 300000,   // 5분마다 메모리 정리
  };

  constructor(
    private readonly timeoutConfigService: TimeoutConfigurationService,
  ) {
    // 주기적으로 오래된 기록 정리
    setInterval(() => {
      this.cleanupOldHistory();
    }, this.adaptiveConfig.memoryCleanupInterval);
  }

  /**
   * 적응형 타임아웃 계산
   */
  async calculateAdaptiveTimeout(
    databaseId: number,
    query: string,
    engine: DatabaseEngine,
    baseTimeoutMs: number,
  ): Promise<AdaptiveTimeoutResult> {
    try {
      const queryHash = this.generateQueryHash(query, databaseId);
      const history = this.executionHistory.get(queryHash);
      
      // 기록이 충분하지 않으면 기본 타임아웃 사용
      if (!history || history.executionTimes.length < this.adaptiveConfig.minExecutionSamples) {
        return {
          originalTimeoutMs: baseTimeoutMs,
          adaptedTimeoutMs: baseTimeoutMs,
          adjustmentReason: 'Insufficient execution history',
          confidenceLevel: 0,
          appliedMultiplier: 1.0,
          recommendation: 'Collecting execution data for future optimization',
        };
      }

      // 통계 분석
      const stats = this.calculateStatistics(history.executionTimes);
      const complexity = this.timeoutConfigService.analyzeQueryComplexity(query);
      
      // 적응 배수 계산
      const adaptationMultiplier = this.calculateAdaptationMultiplier(
        stats,
        baseTimeoutMs,
        complexity,
      );
      
      // 안전 계수 적용
      const safeAdaptationMultiplier = adaptationMultiplier * this.adaptiveConfig.safetyMultiplier;
      
      // 범위 제한
      const limitedMultiplier = Math.min(
        Math.max(safeAdaptationMultiplier, this.adaptiveConfig.minAdaptationRatio),
        this.adaptiveConfig.maxAdaptationRatio,
      );
      
      const adaptedTimeoutMs = Math.round(baseTimeoutMs * limitedMultiplier);
      
      // 신뢰도 계산
      const confidenceLevel = this.calculateConfidenceLevel(history, stats);
      
      // 조정 이유 생성
      const adjustmentReason = this.generateAdjustmentReason(
        adaptationMultiplier,
        stats,
        history.successRate,
      );
      
      // 권장사항 생성
      const recommendation = this.generateRecommendation(
        adaptationMultiplier,
        confidenceLevel,
        stats,
      );

      this.logger.debug('Adaptive timeout calculated', {
        databaseId,
        queryHash: queryHash.substring(0, 8),
        originalTimeout: baseTimeoutMs,
        adaptedTimeout: adaptedTimeoutMs,
        multiplier: limitedMultiplier,
        confidence: confidenceLevel,
        samples: history.executionTimes.length,
      });

      return {
        originalTimeoutMs: baseTimeoutMs,
        adaptedTimeoutMs: adaptedTimeoutMs,
        adjustmentReason,
        confidenceLevel,
        appliedMultiplier: limitedMultiplier,
        historicalAverage: stats.average,
        recommendation,
      };

    } catch (error) {
      this.logger.error('Failed to calculate adaptive timeout', {
        databaseId,
        error: error.message,
      });

      return {
        originalTimeoutMs: baseTimeoutMs,
        adaptedTimeoutMs: baseTimeoutMs,
        adjustmentReason: 'Error in adaptation calculation',
        confidenceLevel: 0,
        appliedMultiplier: 1.0,
        recommendation: 'Using default timeout due to calculation error',
      };
    }
  }

  /**
   * 쿼리 실행 기록 저장
   */
  recordExecution(
    databaseId: number,
    query: string,
    executionTimeMs: number,
    wasSuccessful: boolean,
  ): void {
    try {
      const queryHash = this.generateQueryHash(query, databaseId);
      let history = this.executionHistory.get(queryHash);

      if (!history) {
        history = {
          query: query.substring(0, 200), // 쿼리 일부만 저장
          databaseId,
          executionTimes: [],
          averageTime: 0,
          p95Time: 0,
          successRate: 0,
          lastUpdated: new Date(),
        };
        this.executionHistory.set(queryHash, history);
      }

      // 실행 시간 추가 (성공한 경우만)
      if (wasSuccessful && executionTimeMs > 0) {
        history.executionTimes.push(executionTimeMs);
        
        // 최대 크기 제한
        if (history.executionTimes.length > this.adaptiveConfig.maxHistorySize) {
          history.executionTimes.shift(); // 가장 오래된 기록 제거
        }
        
        // 통계 업데이트
        this.updateHistoryStatistics(history);
      }

      history.lastUpdated = new Date();

      this.logger.debug('Execution recorded', {
        databaseId,
        queryHash: queryHash.substring(0, 8),
        executionTime: executionTimeMs,
        wasSuccessful,
        totalSamples: history.executionTimes.length,
      });

    } catch (error) {
      this.logger.error('Failed to record execution', {
        databaseId,
        error: error.message,
      });
    }
  }

  /**
   * 쿼리 복잡도 기반 타임아웃 분석
   */
  analyzeTimeoutRequirements(
    query: string,
    engine: DatabaseEngine,
    historicalData?: number[],
  ): TimeoutAnalysisResult {
    try {
      const complexity = this.timeoutConfigService.analyzeQueryComplexity(query);
      const analysisFactors = this.extractQueryAnalysisFactors(query);
      
      // 기본 타임아웃 계산
      const baseTimeout = this.timeoutConfigService.calculateRecommendedTimeout(
        engine,
        complexity,
      );
      
      // 과거 데이터가 있으면 적용
      let recommendedTimeout = baseTimeout;
      let confidenceScore = 50; // 기본 신뢰도
      
      if (historicalData && historicalData.length >= this.adaptiveConfig.minExecutionSamples) {
        const stats = this.calculateStatistics(historicalData);
        const adaptationMultiplier = this.calculateAdaptationMultiplier(
          stats,
          baseTimeout,
          complexity,
        );
        
        recommendedTimeout = Math.round(baseTimeout * adaptationMultiplier * this.adaptiveConfig.safetyMultiplier);
        confidenceScore = Math.min(95, 50 + (historicalData.length * 5)); // 샘플 수에 따른 신뢰도
      }
      
      const reasoning = this.generateAnalysisReasoning(
        complexity,
        analysisFactors,
        baseTimeout,
        recommendedTimeout,
      );

      return {
        recommendedTimeoutMs: recommendedTimeout,
        actualComplexity: complexity,
        analysisFactors,
        confidenceScore,
        reasoning,
      };

    } catch (error) {
      this.logger.error('Failed to analyze timeout requirements', {
        error: error.message,
      });

      return {
        recommendedTimeoutMs: 30000,
        actualComplexity: QueryComplexity.SIMPLE,
        analysisFactors: {
          joinCount: 0,
          subqueryCount: 0,
          aggregationCount: 0,
          windowFunctionCount: 0,
        },
        confidenceScore: 0,
        reasoning: ['Analysis failed, using default timeout'],
      };
    }
  }

  /**
   * 실행 기록 통계 조회
   */
  getExecutionStatistics(): {
    totalQueries: number;
    averageExecutionTime: number;
    adaptationRate: number;
    memoryUsageKB: number;
  } {
    const totalQueries = this.executionHistory.size;
    let totalExecutionTime = 0;
    let totalSamples = 0;
    let adaptedQueries = 0;

    for (const history of this.executionHistory.values()) {
      totalExecutionTime += history.averageTime * history.executionTimes.length;
      totalSamples += history.executionTimes.length;
      
      if (history.executionTimes.length >= this.adaptiveConfig.minExecutionSamples) {
        adaptedQueries++;
      }
    }

    // 메모리 사용량 추정 (대략적)
    const memoryUsageKB = totalQueries * 2; // 각 기록당 약 2KB

    return {
      totalQueries,
      averageExecutionTime: totalSamples > 0 ? totalExecutionTime / totalSamples : 0,
      adaptationRate: totalQueries > 0 ? (adaptedQueries / totalQueries) * 100 : 0,
      memoryUsageKB,
    };
  }

  // Private helper methods

  private generateQueryHash(query: string, databaseId: number): string {
    // 쿼리를 정규화하고 해시 생성 (간단한 구현)
    const normalizedQuery = query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\d+/g, '?') // 숫자를 ?로 치환
      .replace(/'[^']*'/g, '?') // 문자열을 ?로 치환
      .trim();
    
    // 간단한 해시 함수 (실제로는 crypto 사용 권장)
    let hash = 0;
    const str = `${databaseId}_${normalizedQuery}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    return `query_${Math.abs(hash).toString(36)}`;
  }

  private calculateStatistics(executionTimes: number[]): {
    average: number;
    median: number;
    p95: number;
    p99: number;
    standardDeviation: number;
    variance: number;
  } {
    const sorted = [...executionTimes].sort((a, b) => a - b);
    const length = sorted.length;
    
    const average = sorted.reduce((sum, time) => sum + time, 0) / length;
    const median = length % 2 === 0 
      ? (sorted[length / 2 - 1] + sorted[length / 2]) / 2
      : sorted[Math.floor(length / 2)];
    
    const p95Index = Math.ceil(length * 0.95) - 1;
    const p99Index = Math.ceil(length * 0.99) - 1;
    const p95 = sorted[Math.min(p95Index, length - 1)];
    const p99 = sorted[Math.min(p99Index, length - 1)];
    
    const variance = sorted.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / length;
    const standardDeviation = Math.sqrt(variance);
    
    return { average, median, p95, p99, standardDeviation, variance };
  }

  private calculateAdaptationMultiplier(
    stats: { average: number; p95: number; standardDeviation: number },
    baseTimeoutMs: number,
    complexity: QueryComplexity,
  ): number {
    // P95 기반 적응 (안정적인 성능 보장)
    let multiplier = (stats.p95 + stats.standardDeviation) / baseTimeoutMs;
    
    // 복잡도별 조정
    switch (complexity) {
      case QueryComplexity.SIMPLE:
        multiplier *= 0.8; // 단순 쿼리는 보수적
        break;
      case QueryComplexity.MEDIUM:
        multiplier *= 1.0; // 기본값
        break;
      case QueryComplexity.COMPLEX:
        multiplier *= 1.2; // 복잡한 쿼리는 여유있게
        break;
      case QueryComplexity.BATCH:
        multiplier *= 1.5; // 배치는 가장 여유있게
        break;
    }
    
    return multiplier;
  }

  private calculateConfidenceLevel(
    history: QueryExecutionHistory,
    stats: { standardDeviation: number; average: number },
  ): number {
    const sampleSize = history.executionTimes.length;
    const coefficientOfVariation = stats.standardDeviation / stats.average;
    
    // 샘플 크기 기반 신뢰도 (최대 70%)
    let confidence = Math.min(70, (sampleSize / this.adaptiveConfig.maxHistorySize) * 70);
    
    // 변동성 기반 조정 (변동성이 낮을수록 신뢰도 증가)
    const variabilityPenalty = Math.min(30, coefficientOfVariation * 100);
    confidence -= variabilityPenalty;
    
    // 성공률 기반 조정
    confidence *= history.successRate;
    
    return Math.max(0, Math.min(100, confidence));
  }

  private updateHistoryStatistics(history: QueryExecutionHistory): void {
    const stats = this.calculateStatistics(history.executionTimes);
    history.averageTime = stats.average;
    history.p95Time = stats.p95;
    
    // 성공률은 별도 추적 필요 (현재는 추가된 모든 기록이 성공으로 가정)
    history.successRate = 1.0;
  }

  private extractQueryAnalysisFactors(query: string): {
    joinCount: number;
    subqueryCount: number;
    aggregationCount: number;
    windowFunctionCount: number;
    estimatedRows?: number;
  } {
    const normalizedQuery = query.toLowerCase();
    
    return {
      joinCount: (normalizedQuery.match(/\s+join\s+/g) || []).length,
      subqueryCount: (normalizedQuery.match(/\(/g) || []).length,
      aggregationCount: (normalizedQuery.match(/\b(count|sum|avg|max|min)\s*\(/g) || []).length,
      windowFunctionCount: (normalizedQuery.match(/\bover\s*\(/g) || []).length,
    };
  }

  private generateAdjustmentReason(
    multiplier: number,
    stats: { average: number; p95: number },
    successRate: number,
  ): string {
    if (multiplier > 1.5) {
      return 'Increased timeout based on historically slow execution times';
    } else if (multiplier < 0.8) {
      return 'Decreased timeout based on consistently fast execution';
    } else if (successRate < 0.9) {
      return 'Conservative timeout due to historical failures';
    } else {
      return 'Moderate adjustment based on execution history';
    }
  }

  private generateRecommendation(
    multiplier: number,
    confidence: number,
    stats: { standardDeviation: number; average: number },
  ): string {
    if (confidence < 50) {
      return 'Collect more execution data to improve timeout accuracy';
    } else if (stats.standardDeviation / stats.average > 0.5) {
      return 'High execution time variability detected - consider query optimization';
    } else if (multiplier > 2.0) {
      return 'Query consistently slow - investigate performance issues';
    } else {
      return 'Timeout optimization is working effectively';
    }
  }

  private generateAnalysisReasoning(
    complexity: QueryComplexity,
    factors: any,
    baseTimeout: number,
    recommendedTimeout: number,
  ): string[] {
    const reasons: string[] = [];
    
    reasons.push(`Query complexity: ${complexity}`);
    
    if (factors.joinCount > 0) {
      reasons.push(`${factors.joinCount} JOIN operations detected`);
    }
    
    if (factors.subqueryCount > 0) {
      reasons.push(`${factors.subqueryCount} subqueries found`);
    }
    
    if (factors.aggregationCount > 0) {
      reasons.push(`${factors.aggregationCount} aggregation functions`);
    }
    
    if (factors.windowFunctionCount > 0) {
      reasons.push(`${factors.windowFunctionCount} window functions (high complexity)`);
    }
    
    if (recommendedTimeout !== baseTimeout) {
      const change = recommendedTimeout > baseTimeout ? 'increased' : 'decreased';
      reasons.push(`Timeout ${change} based on historical performance`);
    }
    
    return reasons;
  }

  private cleanupOldHistory(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24시간 전
    let cleanedCount = 0;

    for (const [key, history] of this.executionHistory.entries()) {
      if (history.lastUpdated < cutoffTime) {
        this.executionHistory.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up old execution history', {
        cleanedCount,
        remainingCount: this.executionHistory.size,
      });
    }
  }
}