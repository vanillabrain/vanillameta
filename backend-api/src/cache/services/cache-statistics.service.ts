import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

interface CacheHitEvent {
  timestamp: Date;
  databaseId: number;
  cacheKey: string;
  userId?: string;
}

interface CacheMissEvent {
  timestamp: Date;
  databaseId: number;
  cacheKey: string;
  userId?: string;
}

interface CacheSetEvent {
  timestamp: Date;
  databaseId: number;
  cacheKey: string;
  resultSize: number;
  ttl: number;
  userId?: string;
}

export interface CacheStatistics {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalSets: number;
  averageExecutionTime: number;
  cacheEfficiency: number;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class CacheStatisticsService {
  private readonly logger = new Logger(CacheStatisticsService.name);

  // 메모리 기반 통계 (실제 운영에서는 Redis나 TimeSeries DB 권장)
  private readonly hitEvents: CacheHitEvent[] = [];
  private readonly missEvents: CacheMissEvent[] = [];
  private readonly setEvents: CacheSetEvent[] = [];

  // 통계 설정
  private readonly statisticsConfig = {
    maxEventHistory: 10000, // 최대 이벤트 보관 수
    cleanupIntervalMs: 300000, // 5분마다 정리
    reportingPeriodHours: 24, // 24시간 기준 리포트
    keyPrefix: 'cache_stats',
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    // 주기적으로 오래된 이벤트 정리
    setInterval(() => {
      this.cleanupOldEvents();
    }, this.statisticsConfig.cleanupIntervalMs);
  }

  /**
   * 캐시 히트 이벤트 기록
   */
  async recordCacheHit(databaseId: number, cacheKey: string, userId?: string): Promise<void> {
    try {
      const event: CacheHitEvent = {
        timestamp: new Date(),
        databaseId,
        cacheKey,
        userId,
      };

      this.hitEvents.push(event);

      // 메모리 사용량 제한
      if (this.hitEvents.length > this.statisticsConfig.maxEventHistory) {
        this.hitEvents.shift();
      }

      // Redis에도 저장 (선택적)
      await this.updateRedisCounters('hits', 1);

      this.logger.debug('Cache hit recorded', {
        databaseId,
        cacheKey: cacheKey.substring(0, 20) + '...',
        userId,
      });
    } catch (error) {
      this.logger.error('Failed to record cache hit', {
        databaseId,
        error: error.message,
      });
    }
  }

  /**
   * 캐시 미스 이벤트 기록
   */
  async recordCacheMiss(databaseId: number, cacheKey: string, userId?: string): Promise<void> {
    try {
      const event: CacheMissEvent = {
        timestamp: new Date(),
        databaseId,
        cacheKey,
        userId,
      };

      this.missEvents.push(event);

      // 메모리 사용량 제한
      if (this.missEvents.length > this.statisticsConfig.maxEventHistory) {
        this.missEvents.shift();
      }

      // Redis에도 저장 (선택적)
      await this.updateRedisCounters('misses', 1);

      this.logger.debug('Cache miss recorded', {
        databaseId,
        cacheKey: cacheKey.substring(0, 20) + '...',
        userId,
      });
    } catch (error) {
      this.logger.error('Failed to record cache miss', {
        databaseId,
        error: error.message,
      });
    }
  }

  /**
   * 캐시 설정 이벤트 기록
   */
  async recordCacheSet(
    databaseId: number,
    cacheKey: string,
    resultSize: number,
    ttl: number,
    userId?: string,
  ): Promise<void> {
    try {
      const event: CacheSetEvent = {
        timestamp: new Date(),
        databaseId,
        cacheKey,
        resultSize,
        ttl,
        userId,
      };

      this.setEvents.push(event);

      // 메모리 사용량 제한
      if (this.setEvents.length > this.statisticsConfig.maxEventHistory) {
        this.setEvents.shift();
      }

      // Redis에도 저장 (선택적)
      await this.updateRedisCounters('sets', 1);

      this.logger.debug('Cache set recorded', {
        databaseId,
        cacheKey: cacheKey.substring(0, 20) + '...',
        resultSize,
        ttl,
        userId,
      });
    } catch (error) {
      this.logger.error('Failed to record cache set', {
        databaseId,
        error: error.message,
      });
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getCacheStatistics(periodHours = 24): Promise<CacheStatistics> {
    try {
      const cutoffTime = new Date(Date.now() - periodHours * 60 * 60 * 1000);

      // 기간 내 이벤트 필터링
      const recentHits = this.hitEvents.filter(event => event.timestamp >= cutoffTime);
      const recentMisses = this.missEvents.filter(event => event.timestamp >= cutoffTime);
      const recentSets = this.setEvents.filter(event => event.timestamp >= cutoffTime);

      const totalHits = recentHits.length;
      const totalMisses = recentMisses.length;
      const totalSets = recentSets.length;
      const totalRequests = totalHits + totalMisses;

      // 히트율 계산
      const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

      // 캐시 효율성 계산 (히트율과 설정 대비 사용률)
      const utilizationRate = totalSets > 0 ? (totalHits / totalSets) * 100 : 0;
      const cacheEfficiency = (hitRate + utilizationRate) / 2;

      // 평균 실행 시간 (실제로는 캐시된 쿼리의 원래 실행 시간을 추적해야 함)
      const averageExecutionTime = this.calculateAverageExecutionTime(recentSets);

      return {
        hitRate: Math.round(hitRate * 100) / 100,
        totalHits,
        totalMisses,
        totalSets,
        averageExecutionTime,
        cacheEfficiency: Math.round(cacheEfficiency * 100) / 100,
        periodStart: cutoffTime,
        periodEnd: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get cache statistics', error);
      return this.getDefaultStatistics();
    }
  }

  /**
   * 데이터베이스별 캐시 통계
   */
  async getDatabaseCacheStatistics(databaseId: number, periodHours = 24): Promise<CacheStatistics> {
    try {
      const cutoffTime = new Date(Date.now() - periodHours * 60 * 60 * 1000);

      // 특정 데이터베이스의 이벤트만 필터링
      const dbHits = this.hitEvents.filter(
        event => event.timestamp >= cutoffTime && event.databaseId === databaseId,
      );
      const dbMisses = this.missEvents.filter(
        event => event.timestamp >= cutoffTime && event.databaseId === databaseId,
      );
      const dbSets = this.setEvents.filter(
        event => event.timestamp >= cutoffTime && event.databaseId === databaseId,
      );

      const totalHits = dbHits.length;
      const totalMisses = dbMisses.length;
      const totalSets = dbSets.length;
      const totalRequests = totalHits + totalMisses;

      const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
      const utilizationRate = totalSets > 0 ? (totalHits / totalSets) * 100 : 0;
      const cacheEfficiency = (hitRate + utilizationRate) / 2;

      const averageExecutionTime = this.calculateAverageExecutionTime(dbSets);

      return {
        hitRate: Math.round(hitRate * 100) / 100,
        totalHits,
        totalMisses,
        totalSets,
        averageExecutionTime,
        cacheEfficiency: Math.round(cacheEfficiency * 100) / 100,
        periodStart: cutoffTime,
        periodEnd: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get database cache statistics', {
        databaseId,
        error: error.message,
      });
      return this.getDefaultStatistics();
    }
  }

  /**
   * 사용자별 캐시 통계
   */
  async getUserCacheStatistics(userId: string, periodHours = 24): Promise<CacheStatistics> {
    try {
      const cutoffTime = new Date(Date.now() - periodHours * 60 * 60 * 1000);

      // 특정 사용자의 이벤트만 필터링
      const userHits = this.hitEvents.filter(
        event => event.timestamp >= cutoffTime && event.userId === userId,
      );
      const userMisses = this.missEvents.filter(
        event => event.timestamp >= cutoffTime && event.userId === userId,
      );
      const userSets = this.setEvents.filter(
        event => event.timestamp >= cutoffTime && event.userId === userId,
      );

      const totalHits = userHits.length;
      const totalMisses = userMisses.length;
      const totalSets = userSets.length;
      const totalRequests = totalHits + totalMisses;

      const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
      const utilizationRate = totalSets > 0 ? (totalHits / totalSets) * 100 : 0;
      const cacheEfficiency = (hitRate + utilizationRate) / 2;

      const averageExecutionTime = this.calculateAverageExecutionTime(userSets);

      return {
        hitRate: Math.round(hitRate * 100) / 100,
        totalHits,
        totalMisses,
        totalSets,
        averageExecutionTime,
        cacheEfficiency: Math.round(cacheEfficiency * 100) / 100,
        periodStart: cutoffTime,
        periodEnd: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get user cache statistics', {
        userId,
        error: error.message,
      });
      return this.getDefaultStatistics();
    }
  }

  /**
   * 캐시 성능 트렌드 분석
   */
  async getCachePerformanceTrend(periodHours = 24): Promise<{
    hourlyStats: Array<{
      hour: string;
      hitRate: number;
      totalRequests: number;
    }>;
    trend: 'improving' | 'stable' | 'declining';
    recommendation: string;
  }> {
    try {
      const cutoffTime = new Date(Date.now() - periodHours * 60 * 60 * 1000);
      const hourlyStats: Array<{ hour: string; hitRate: number; totalRequests: number }> = [];

      // 시간별 통계 계산
      for (let i = 0; i < periodHours; i++) {
        const hourStart = new Date(cutoffTime.getTime() + i * 60 * 60 * 1000);
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

        const hourHits = this.hitEvents.filter(
          event => event.timestamp >= hourStart && event.timestamp < hourEnd,
        ).length;
        const hourMisses = this.missEvents.filter(
          event => event.timestamp >= hourStart && event.timestamp < hourEnd,
        ).length;

        const totalRequests = hourHits + hourMisses;
        const hitRate = totalRequests > 0 ? (hourHits / totalRequests) * 100 : 0;

        hourlyStats.push({
          hour: hourStart.toISOString().substring(0, 13) + ':00',
          hitRate: Math.round(hitRate * 100) / 100,
          totalRequests,
        });
      }

      // 트렌드 분석
      const trend = this.analyzeTrend(hourlyStats);
      const recommendation = this.generateRecommendation(hourlyStats, trend);

      return {
        hourlyStats,
        trend,
        recommendation,
      };
    } catch (error) {
      this.logger.error('Failed to get cache performance trend', error);
      return {
        hourlyStats: [],
        trend: 'stable',
        recommendation: 'Unable to analyze trend due to error',
      };
    }
  }

  /**
   * 메모리 사용량 정보
   */
  getMemoryInfo(): {
    hitEvents: number;
    missEvents: number;
    setEvents: number;
    estimatedMemoryKB: number;
  } {
    const estimatedMemoryKB =
      this.hitEvents.length * 0.1 + // 각 히트 이벤트당 약 100바이트
      this.missEvents.length * 0.1 + // 각 미스 이벤트당 약 100바이트
      this.setEvents.length * 0.2; // 각 설정 이벤트당 약 200바이트

    return {
      hitEvents: this.hitEvents.length,
      missEvents: this.missEvents.length,
      setEvents: this.setEvents.length,
      estimatedMemoryKB: Math.round(estimatedMemoryKB),
    };
  }

  // Private helper methods

  /**
   * Redis 카운터 업데이트
   */
  private async updateRedisCounters(
    type: 'hits' | 'misses' | 'sets',
    increment: number,
  ): Promise<void> {
    try {
      const key = `${this.statisticsConfig.keyPrefix}:${type}:${new Date()
        .toISOString()
        .substring(0, 10)}`;
      // Redis increment 연산 (실제 구현에서는 Redis 클라이언트 직접 사용)
      // await this.redisClient.incr(key);
    } catch (error) {
      // Redis 오류는 무시 (메모리 통계로 폴백)
    }
  }

  /**
   * 평균 실행 시간 계산
   */
  private calculateAverageExecutionTime(setEvents: CacheSetEvent[]): number {
    if (setEvents.length === 0) return 0;

    // 실제로는 캐시 설정 시 원래 쿼리의 실행 시간을 저장해야 함
    // 여기서는 TTL을 기반으로 추정
    const totalEstimatedTime = setEvents.reduce((sum, event) => {
      // TTL이 높을수록 실행 시간이 길었다고 가정
      const estimatedTime = event.ttl * 10; // TTL 10초당 실행시간 1초로 추정
      return sum + estimatedTime;
    }, 0);

    return Math.round(totalEstimatedTime / setEvents.length);
  }

  /**
   * 트렌드 분석
   */
  private analyzeTrend(
    hourlyStats: Array<{ hitRate: number; totalRequests: number }>,
  ): 'improving' | 'stable' | 'declining' {
    if (hourlyStats.length < 3) return 'stable';

    const recentStats = hourlyStats.slice(-3);
    const earlyStats = hourlyStats.slice(0, 3);

    const recentAvg = recentStats.reduce((sum, stat) => sum + stat.hitRate, 0) / recentStats.length;
    const earlyAvg = earlyStats.reduce((sum, stat) => sum + stat.hitRate, 0) / earlyStats.length;

    const improvement = recentAvg - earlyAvg;

    if (improvement > 5) return 'improving';
    if (improvement < -5) return 'declining';
    return 'stable';
  }

  /**
   * 권장사항 생성
   */
  private generateRecommendation(
    hourlyStats: Array<{ hitRate: number; totalRequests: number }>,
    trend: 'improving' | 'stable' | 'declining',
  ): string {
    const avgHitRate =
      hourlyStats.reduce((sum, stat) => sum + stat.hitRate, 0) / hourlyStats.length;
    const totalRequests = hourlyStats.reduce((sum, stat) => sum + stat.totalRequests, 0);

    if (avgHitRate < 50) {
      return 'Cache hit rate is low. Consider increasing TTL or improving cache key generation.';
    } else if (avgHitRate > 80 && trend === 'improving') {
      return 'Excellent cache performance! Current strategy is working well.';
    } else if (trend === 'declining') {
      return 'Cache performance is declining. Review cache invalidation strategy and query patterns.';
    } else if (totalRequests < 100) {
      return 'Low cache usage detected. Consider promoting cache usage in query execution.';
    } else {
      return 'Cache performance is stable and within acceptable range.';
    }
  }

  /**
   * 기본 통계 반환
   */
  private getDefaultStatistics(): CacheStatistics {
    return {
      hitRate: 0,
      totalHits: 0,
      totalMisses: 0,
      totalSets: 0,
      averageExecutionTime: 0,
      cacheEfficiency: 0,
      periodStart: new Date(),
      periodEnd: new Date(),
    };
  }

  /**
   * 오래된 이벤트 정리
   */
  private cleanupOldEvents(): void {
    const cutoffTime = new Date(
      Date.now() - this.statisticsConfig.reportingPeriodHours * 60 * 60 * 1000,
    );

    let cleaned = 0;

    // 히트 이벤트 정리
    const originalHitLength = this.hitEvents.length;
    while (this.hitEvents.length > 0 && this.hitEvents[0].timestamp < cutoffTime) {
      this.hitEvents.shift();
      cleaned++;
    }

    // 미스 이벤트 정리
    const originalMissLength = this.missEvents.length;
    while (this.missEvents.length > 0 && this.missEvents[0].timestamp < cutoffTime) {
      this.missEvents.shift();
      cleaned++;
    }

    // 설정 이벤트 정리
    const originalSetLength = this.setEvents.length;
    while (this.setEvents.length > 0 && this.setEvents[0].timestamp < cutoffTime) {
      this.setEvents.shift();
      cleaned++;
    }

    if (cleaned > 0) {
      this.logger.debug('Cleaned up old cache events', {
        cleanedEvents: cleaned,
        remainingHits: this.hitEvents.length,
        remainingMisses: this.missEvents.length,
        remainingSets: this.setEvents.length,
      });
    }
  }
}
