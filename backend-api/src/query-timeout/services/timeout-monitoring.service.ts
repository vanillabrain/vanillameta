import { Injectable, Logger } from '@nestjs/common';
import { 
  DatabaseEngine, 
  QueryComplexity 
} from '../dto/timeout-config.dto';
import { 
  TimeoutStatistics, 
  TimeoutMonitoringReport, 
  TimeoutExecutionResult 
} from '../dto/timeout-response.dto';

interface TimeoutEvent {
  timestamp: Date;
  databaseId: number;
  engine: DatabaseEngine;
  query: string;
  executionTimeMs: number;
  timeoutMs: number;
  wasTimedOut: boolean;
  complexity: QueryComplexity;
  errorMessage?: string;
  userId?: string;
}

interface AlertRule {
  id: string;
  name: string;
  condition: (stats: TimeoutStatistics) => boolean;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldownMs: number;
  lastTriggered?: Date;
}

@Injectable()
export class TimeoutMonitoringService {
  private readonly logger = new Logger(TimeoutMonitoringService.name);
  
  // 타임아웃 이벤트 저장 (메모리 기반, 실제로는 시계열 DB 사용 권장)
  private readonly timeoutEvents: TimeoutEvent[] = [];
  private readonly maxEventHistory = 10000; // 최대 이벤트 보관 수
  
  // 알림 규칙
  private readonly alertRules: AlertRule[] = [
    {
      id: 'high_timeout_rate',
      name: 'High Timeout Rate',
      condition: (stats) => stats.timeoutRate > 10, // 10% 초과
      message: 'Timeout rate exceeded 10% for {engine}',
      severity: 'high',
      cooldownMs: 300000, // 5분
    },
    {
      id: 'critical_timeout_rate',
      name: 'Critical Timeout Rate',
      condition: (stats) => stats.timeoutRate > 25, // 25% 초과
      message: 'Critical timeout rate {timeoutRate}% for {engine}',
      severity: 'critical',
      cooldownMs: 180000, // 3분
    },
    {
      id: 'slow_average_execution',
      name: 'Slow Average Execution',
      condition: (stats) => stats.averageExecutionTime > 60000, // 1분 초과
      message: 'Average execution time {averageTime}ms is too high for {engine}',
      severity: 'medium',
      cooldownMs: 600000, // 10분
    },
    {
      id: 'very_slow_p95',
      name: 'Very Slow P95',
      condition: (stats) => stats.p95ExecutionTime > 120000, // 2분 초과
      message: 'P95 execution time {p95Time}ms indicates performance issues for {engine}',
      severity: 'high',
      cooldownMs: 600000, // 10분
    },
    {
      id: 'frequent_timeouts',
      name: 'Frequent Timeouts',
      condition: (stats) => stats.totalQueries > 50 && stats.timeoutCount > 5,
      message: 'Frequent timeouts detected: {timeoutCount} out of {totalQueries} for {engine}',
      severity: 'medium',
      cooldownMs: 900000, // 15분
    },
  ];

  constructor() {
    // 주기적으로 오래된 이벤트 정리
    setInterval(() => {
      this.cleanupOldEvents();
    }, 600000); // 10분마다

    // 주기적으로 알림 확인
    setInterval(() => {
      this.checkAlerts();
    }, 60000); // 1분마다
  }

  /**
   * 쿼리 실행 결과 기록
   */
  recordExecution(result: TimeoutExecutionResult, userId?: string): void {
    try {
      const event: TimeoutEvent = {
        timestamp: new Date(),
        databaseId: result.databaseEngine === DatabaseEngine.SQLITE ? 0 : 1, // 임시 매핑
        engine: result.databaseEngine,
        query: result.query.substring(0, 500), // 쿼리 일부만 저장
        executionTimeMs: result.executionTimeMs,
        timeoutMs: result.timeoutMs,
        wasTimedOut: result.wasTimedOut,
        complexity: result.complexity,
        errorMessage: result.errorMessage,
        userId,
      };

      this.timeoutEvents.push(event);

      // 최대 크기 제한
      if (this.timeoutEvents.length > this.maxEventHistory) {
        this.timeoutEvents.shift(); // 가장 오래된 이벤트 제거
      }

      // 타임아웃 발생 시 즉시 로깅
      if (result.wasTimedOut) {
        this.logger.warn('Query timeout detected', {
          engine: result.databaseEngine,
          complexity: result.complexity,
          executionTime: result.executionTimeMs,
          timeoutMs: result.timeoutMs,
          query: result.query.substring(0, 100),
          userId,
        });
      }

      this.logger.debug('Execution recorded for monitoring', {
        engine: result.databaseEngine,
        executionTime: result.executionTimeMs,
        wasTimedOut: result.wasTimedOut,
        totalEvents: this.timeoutEvents.length,
      });

    } catch (error) {
      this.logger.error('Failed to record execution for monitoring', {
        error: error.message,
      });
    }
  }

  /**
   * 데이터베이스 엔진별 통계 생성
   */
  generateStatistics(
    engine: DatabaseEngine,
    periodHours: number = 24,
  ): TimeoutStatistics {
    const cutoffTime = new Date(Date.now() - (periodHours * 60 * 60 * 1000));
    const relevantEvents = this.timeoutEvents.filter(
      event => event.engine === engine && event.timestamp > cutoffTime,
    );

    if (relevantEvents.length === 0) {
      return {
        engine,
        totalQueries: 0,
        timeoutCount: 0,
        timeoutRate: 0,
        averageExecutionTime: 0,
        p95ExecutionTime: 0,
        p99ExecutionTime: 0,
        optimalTimeoutSuggestion: 30000,
      };
    }

    const executionTimes = relevantEvents.map(event => event.executionTimeMs);
    const timeoutCount = relevantEvents.filter(event => event.wasTimedOut).length;
    const sortedTimes = [...executionTimes].sort((a, b) => a - b);

    const totalQueries = relevantEvents.length;
    const timeoutRate = (timeoutCount / totalQueries) * 100;
    const averageExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / totalQueries;
    
    const p95Index = Math.ceil(sortedTimes.length * 0.95) - 1;
    const p99Index = Math.ceil(sortedTimes.length * 0.99) - 1;
    const p95ExecutionTime = sortedTimes[Math.min(p95Index, sortedTimes.length - 1)] || 0;
    const p99ExecutionTime = sortedTimes[Math.min(p99Index, sortedTimes.length - 1)] || 0;

    // 최적 타임아웃 제안 (P95 + 안전 마진)
    const optimalTimeoutSuggestion = Math.max(
      p95ExecutionTime * 1.5, // P95의 1.5배
      averageExecutionTime * 2, // 평균의 2배
      30000, // 최소 30초
    );

    return {
      engine,
      totalQueries,
      timeoutCount,
      timeoutRate,
      averageExecutionTime,
      p95ExecutionTime,
      p99ExecutionTime,
      optimalTimeoutSuggestion: Math.round(optimalTimeoutSuggestion),
    };
  }

  /**
   * 종합 모니터링 리포트 생성
   */
  generateMonitoringReport(periodHours: number = 24): TimeoutMonitoringReport {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (periodHours * 60 * 60 * 1000));
    
    const relevantEvents = this.timeoutEvents.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime,
    );

    // 전체 요약
    const totalQueries = relevantEvents.length;
    const totalTimeouts = relevantEvents.filter(event => event.wasTimedOut).length;
    const overallTimeoutRate = totalQueries > 0 ? (totalTimeouts / totalQueries) * 100 : 0;
    
    const allExecutionTimes = relevantEvents.map(event => event.executionTimeMs);
    const averageExecutionTime = allExecutionTimes.length > 0 
      ? allExecutionTimes.reduce((sum, time) => sum + time, 0) / allExecutionTimes.length 
      : 0;

    // 최적화로 절약된 시간 추정 (타임아웃된 쿼리들의 시간 절약)
    const savedTimeFromOptimization = relevantEvents
      .filter(event => event.wasTimedOut)
      .reduce((total, event) => total + Math.max(0, event.timeoutMs - event.executionTimeMs), 0);

    // 엔진별 통계
    const engines = [...new Set(relevantEvents.map(event => event.engine))];
    const byEngine = engines.map(engine => this.generateStatistics(engine, periodHours));

    // 복잡도별 통계
    const complexities = Object.values(QueryComplexity);
    const byComplexity = complexities.map(complexity => {
      const complexityEvents = relevantEvents.filter(event => event.complexity === complexity);
      const avgTime = complexityEvents.length > 0
        ? complexityEvents.reduce((sum, event) => sum + event.executionTimeMs, 0) / complexityEvents.length
        : 0;
      const timeouts = complexityEvents.filter(event => event.wasTimedOut).length;
      const timeoutRate = complexityEvents.length > 0 ? (timeouts / complexityEvents.length) * 100 : 0;
      
      return {
        complexity,
        averageTime: avgTime,
        timeoutRate,
        recommendedTimeout: Math.round(avgTime * 2.5), // 평균의 2.5배
      };
    });

    // 권장사항 생성
    const recommendations = this.generateRecommendations(byEngine, byComplexity);

    // 트리거된 알림
    const alertsTriggered = this.getRecentAlerts(periodHours);

    return {
      reportPeriod: { startTime, endTime },
      summary: {
        totalQueries,
        totalTimeouts,
        overallTimeoutRate,
        averageExecutionTime,
        savedTimeFromOptimization,
      },
      byEngine,
      byComplexity,
      recommendations,
      alertsTriggered,
    };
  }

  /**
   * 실시간 알림 확인
   */
  private checkAlerts(): void {
    try {
      const engines = Object.values(DatabaseEngine);
      
      for (const engine of engines) {
        const stats = this.generateStatistics(engine, 1); // 최근 1시간
        
        for (const rule of this.alertRules) {
          if (this.shouldTriggerAlert(rule, stats)) {
            this.triggerAlert(rule, stats);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to check alerts', {
        error: error.message,
      });
    }
  }

  /**
   * 알림 트리거 여부 확인
   */
  private shouldTriggerAlert(rule: AlertRule, stats: TimeoutStatistics): boolean {
    // 최소 쿼리 수 확인 (노이즈 방지)
    if (stats.totalQueries < 5) {
      return false;
    }

    // 쿨다운 확인
    if (rule.lastTriggered && 
        Date.now() - rule.lastTriggered.getTime() < rule.cooldownMs) {
      return false;
    }

    // 조건 확인
    return rule.condition(stats);
  }

  /**
   * 알림 트리거
   */
  private triggerAlert(rule: AlertRule, stats: TimeoutStatistics): void {
    const message = rule.message
      .replace('{engine}', stats.engine)
      .replace('{timeoutRate}', stats.timeoutRate.toFixed(1))
      .replace('{averageTime}', stats.averageExecutionTime.toFixed(0))
      .replace('{p95Time}', stats.p95ExecutionTime.toFixed(0))
      .replace('{timeoutCount}', stats.timeoutCount.toString())
      .replace('{totalQueries}', stats.totalQueries.toString());

    const logLevel = rule.severity === 'critical' ? 'error' 
                   : rule.severity === 'high' ? 'warn' 
                   : 'log';

    this.logger[logLevel](`TIMEOUT ALERT: ${rule.name}`, {
      rule: rule.id,
      severity: rule.severity,
      message,
      engine: stats.engine,
      stats,
    });

    // 알림 트리거 시간 업데이트
    rule.lastTriggered = new Date();
  }

  /**
   * 권장사항 생성
   */
  private generateRecommendations(
    byEngine: TimeoutStatistics[],
    byComplexity: any[],
  ): string[] {
    const recommendations: string[] = [];

    // 높은 타임아웃율 엔진
    const highTimeoutEngines = byEngine.filter(stats => stats.timeoutRate > 5);
    if (highTimeoutEngines.length > 0) {
      recommendations.push(
        `Consider increasing timeout for: ${highTimeoutEngines.map(e => e.engine).join(', ')}`
      );
    }

    // 느린 평균 실행 시간
    const slowEngines = byEngine.filter(stats => stats.averageExecutionTime > 30000);
    if (slowEngines.length > 0) {
      recommendations.push(
        `Performance optimization needed for: ${slowEngines.map(e => e.engine).join(', ')}`
      );
    }

    // 복잡도별 권장사항
    const slowComplexities = byComplexity.filter(c => c.averageTime > 60000);
    if (slowComplexities.length > 0) {
      recommendations.push(
        `Review query optimization for ${slowComplexities.map(c => c.complexity).join(', ')} queries`
      );
    }

    // 일반 권장사항
    if (recommendations.length === 0) {
      recommendations.push('Timeout configuration appears to be working well');
    }

    return recommendations;
  }

  /**
   * 최근 알림 조회
   */
  private getRecentAlerts(periodHours: number): string[] {
    const cutoffTime = new Date(Date.now() - (periodHours * 60 * 60 * 1000));
    
    return this.alertRules
      .filter(rule => rule.lastTriggered && rule.lastTriggered > cutoffTime)
      .map(rule => `${rule.name} (${rule.severity})`)
      .slice(0, 10); // 최대 10개만 반환
  }

  /**
   * 오래된 이벤트 정리
   */
  private cleanupOldEvents(): void {
    const cutoffTime = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7일 전
    const initialLength = this.timeoutEvents.length;
    
    // 오래된 이벤트 제거
    let index = 0;
    while (index < this.timeoutEvents.length) {
      if (this.timeoutEvents[index].timestamp < cutoffTime) {
        this.timeoutEvents.splice(index, 1);
      } else {
        index++;
      }
    }

    const cleanedCount = initialLength - this.timeoutEvents.length;
    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up old timeout events', {
        cleanedCount,
        remainingCount: this.timeoutEvents.length,
      });
    }
  }

  /**
   * 메모리 사용량 정보
   */
  getMemoryInfo(): {
    eventCount: number;
    memoryUsageEstimateKB: number;
    oldestEventAge: number;
    newestEventAge: number;
  } {
    const eventCount = this.timeoutEvents.length;
    const memoryUsageEstimateKB = eventCount * 0.5; // 각 이벤트당 약 0.5KB
    
    const now = Date.now();
    const oldestEventAge = eventCount > 0 
      ? now - this.timeoutEvents[0].timestamp.getTime() 
      : 0;
    const newestEventAge = eventCount > 0 
      ? now - this.timeoutEvents[eventCount - 1].timestamp.getTime() 
      : 0;

    return {
      eventCount,
      memoryUsageEstimateKB,
      oldestEventAge,
      newestEventAge,
    };
  }

  /**
   * 특정 기간 동안의 타임아웃 트렌드 조회
   */
  getTimeoutTrend(engine: DatabaseEngine, periodHours: number = 24): {
    hourly: Array<{
      hour: string;
      totalQueries: number;
      timeouts: number;
      timeoutRate: number;
    }>;
  } {
    const cutoffTime = new Date(Date.now() - (periodHours * 60 * 60 * 1000));
    const relevantEvents = this.timeoutEvents.filter(
      event => event.engine === engine && event.timestamp > cutoffTime,
    );

    // 시간별 그룹화
    const hourlyData = new Map<string, { total: number; timeouts: number }>();
    
    relevantEvents.forEach(event => {
      const hour = new Date(event.timestamp.getTime())
        .toISOString()
        .substring(0, 13); // YYYY-MM-DDTHH 형식
      
      const existing = hourlyData.get(hour) || { total: 0, timeouts: 0 };
      existing.total++;
      if (event.wasTimedOut) {
        existing.timeouts++;
      }
      hourlyData.set(hour, existing);
    });

    // 결과 변환
    const hourly = Array.from(hourlyData.entries())
      .map(([hour, data]) => ({
        hour,
        totalQueries: data.total,
        timeouts: data.timeouts,
        timeoutRate: data.total > 0 ? (data.timeouts / data.total) * 100 : 0,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return { hourly };
  }
}