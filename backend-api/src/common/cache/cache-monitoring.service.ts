import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { HybridCacheService } from '../optimization/hybrid-cache.service';
import { RedisCacheService } from '../optimization/redis-cache.service';
import { L1CacheService } from '../optimization/l1-cache.service';
import { CustomLoggerService } from '../logger/logger.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

/**
 * 캐시 메트릭 인터페이스
 */
export interface CacheMetrics {
  timestamp: number;
  engine: string;
  l1: {
    hitRate: number;
    missRate: number;
    totalHits: number;
    totalMisses: number;
    size: number;
    maxSize: number;
    memoryUsage: number;
    evictions: number;
  };
  l2: {
    hitRate: number;
    missRate: number;
    totalHits: number;
    totalMisses: number;
    keyCount: number;
    memoryUsage: number;
    evictions: number;
    connectionStatus: 'connected' | 'disconnected' | 'error';
    latency: {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };
  overall: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
    cacheEfficiency: number;
    avgResponseTime: number;
  };
}

/**
 * 캐시 성능 임계값
 */
export interface CacheThresholds {
  minHitRate: number;
  maxMemoryUsage: number;
  maxLatency: number;
  maxEvictionRate: number;
}

/**
 * 캐시 모니터링 이벤트
 */
export interface CacheMonitoringEvent {
  type: 'performance' | 'health' | 'alert';
  severity: 'info' | 'warning' | 'error' | 'critical';
  engine: string;
  metrics?: Partial<CacheMetrics>;
  message: string;
  timestamp: number;
}

/**
 * 캐시 모니터링 서비스
 * 실시간 캐시 성능 모니터링 및 메트릭 수집
 */
@Injectable()
export class CacheMonitoringService {
  private readonly logger = new Logger(CacheMonitoringService.name);
  private metricsHistory: Map<string, CacheMetrics[]> = new Map();
  private readonly MAX_HISTORY_SIZE = 1440; // 24시간 (1분 간격)

  private readonly DEFAULT_THRESHOLDS: CacheThresholds = {
    minHitRate: 0.7, // 70% 이상
    maxMemoryUsage: 0.9, // 90% 이하
    maxLatency: 100, // 100ms 이하
    maxEvictionRate: 0.1, // 10% 이하
  };

  private performanceTracking = new Map<
    string,
    {
      requests: number;
      hits: number;
      misses: number;
      totalLatency: number;
      lastReset: number;
    }
  >();

  constructor(
    private readonly hybridCache: HybridCacheService,
    private readonly redisCache: RedisCacheService,
    private readonly l1Cache: L1CacheService,
    private readonly customLogger: CustomLoggerService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.initializeTracking();
  }

  /**
   * 성능 추적 초기화
   */
  private initializeTracking() {
    const engines = ['dashboard', 'dataset', 'widget'];
    engines.forEach(engine => {
      this.performanceTracking.set(engine, {
        requests: 0,
        hits: 0,
        misses: 0,
        totalLatency: 0,
        lastReset: Date.now(),
      });
    });
  }

  /**
   * 캐시 요청 추적
   */
  @OnEvent('cache.request')
  async trackCacheRequest(payload: {
    engine: string;
    hit: boolean;
    source: 'l1' | 'l2' | 'miss';
    latency: number;
  }) {
    const tracking = this.performanceTracking.get(payload.engine);
    if (tracking) {
      tracking.requests++;
      if (payload.hit) {
        tracking.hits++;
      } else {
        tracking.misses++;
      }
      tracking.totalLatency += payload.latency;
    }
  }

  /**
   * 1분마다 메트릭 수집
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics() {
    const engines = ['dashboard', 'dataset', 'widget'];

    for (const engine of engines) {
      try {
        const metrics = await this.getEngineMetrics(engine);
        this.addToHistory(engine, metrics);

        // 임계값 체크
        await this.checkThresholds(engine, metrics);

        // 메트릭 이벤트 발생
        this.eventEmitter.emit('cache.metrics.collected', {
          engine,
          metrics,
          timestamp: Date.now(),
        });
      } catch (error) {
        this.logger.error(`Failed to collect metrics for ${engine}:`, error);
      }
    }
  }

  /**
   * 엔진별 메트릭 수집
   */
  private async getEngineMetrics(engine: string): Promise<CacheMetrics> {
    const tracking = this.performanceTracking.get(engine) || {
      requests: 0,
      hits: 0,
      misses: 0,
      totalLatency: 0,
      lastReset: Date.now(),
    };

    // L1 캐시 통계
    const l1Stats = await this.l1Cache.getStats(engine);

    // L2 캐시 통계
    const l2Stats = await this.getRedisStats(engine);

    // Redis 연결 상태 및 지연 시간
    const redisInfo = await this.getRedisInfo();

    // 전체 통계 계산
    const totalRequests = tracking.requests || 1; // 0으로 나누기 방지
    const hitRate = totalRequests > 0 ? tracking.hits / totalRequests : 0;
    const avgResponseTime = totalRequests > 0 ? tracking.totalLatency / totalRequests : 0;

    const metrics: CacheMetrics = {
      timestamp: Date.now(),
      engine,
      l1: {
        hitRate: l1Stats.hitRate || 0,
        missRate: 1 - (l1Stats.hitRate || 0),
        totalHits: l1Stats.hits || 0,
        totalMisses: l1Stats.misses || 0,
        size: l1Stats.size || 0,
        maxSize: l1Stats.maxSize || 1000,
        memoryUsage: l1Stats.memoryUsage || 0,
        evictions: l1Stats.evictions || 0,
      },
      l2: {
        hitRate: l2Stats.hitRate || 0,
        missRate: 1 - (l2Stats.hitRate || 0),
        totalHits: l2Stats.hits || 0,
        totalMisses: l2Stats.misses || 0,
        keyCount: l2Stats.keyCount || 0,
        memoryUsage: redisInfo.memoryUsage || 0,
        evictions: l2Stats.evictions || 0,
        connectionStatus: redisInfo.connected ? 'connected' : 'disconnected',
        latency: redisInfo.latency,
      },
      overall: {
        hitRate,
        missRate: 1 - hitRate,
        totalRequests,
        cacheEfficiency: this.calculateEfficiency(hitRate, avgResponseTime),
        avgResponseTime,
      },
    };

    // 추적 정보 리셋 (1시간마다)
    if (Date.now() - tracking.lastReset > 3600000) {
      this.performanceTracking.set(engine, {
        requests: 0,
        hits: 0,
        misses: 0,
        totalLatency: 0,
        lastReset: Date.now(),
      });
    }

    return metrics;
  }

  /**
   * Redis 통계 조회
   */
  private async getRedisStats(engine: string): Promise<any> {
    try {
      // Redis INFO 명령으로 통계 조회
      const info = await this.redis.info('stats');
      const memory = await this.redis.info('memory');

      // 키 패턴으로 엔진별 키 수 조회
      const keys = await this.redis.keys(`${engine}:*`);

      return {
        hitRate: 0.8, // TODO: 실제 히트율 계산
        hits: parseInt(this.parseRedisInfo(info, 'keyspace_hits') || '0'),
        misses: parseInt(this.parseRedisInfo(info, 'keyspace_misses') || '0'),
        keyCount: keys.length,
        evictions: parseInt(this.parseRedisInfo(info, 'evicted_keys') || '0'),
      };
    } catch (error) {
      this.logger.error('Failed to get Redis stats:', error);
      return {
        hitRate: 0,
        hits: 0,
        misses: 0,
        keyCount: 0,
        evictions: 0,
      };
    }
  }

  /**
   * Redis 정보 파싱
   */
  private parseRedisInfo(info: string, key: string): string | null {
    const regex = new RegExp(`${key}:(\\d+)`);
    const match = info.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Redis 연결 정보 조회
   */
  private async getRedisInfo(): Promise<{
    connected: boolean;
    memoryUsage: number;
    latency: {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
  }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      const memory = await this.redis.info('memory');
      const usedMemory = parseInt(this.parseRedisInfo(memory, 'used_memory') || '0');

      return {
        connected: true,
        memoryUsage: usedMemory,
        latency: {
          avg: latency,
          p50: latency,
          p95: latency * 1.5,
          p99: latency * 2,
        },
      };
    } catch (error) {
      return {
        connected: false,
        memoryUsage: 0,
        latency: {
          avg: 0,
          p50: 0,
          p95: 0,
          p99: 0,
        },
      };
    }
  }

  /**
   * 캐시 효율성 계산
   */
  private calculateEfficiency(hitRate: number, avgResponseTime: number): number {
    // 히트율과 응답 시간을 기반으로 효율성 점수 계산 (0-100)
    const hitScore = hitRate * 70; // 70% 가중치
    const latencyScore = Math.max(0, 30 - avgResponseTime / 10); // 30% 가중치
    return Math.min(100, hitScore + latencyScore);
  }

  /**
   * 메트릭 히스토리 추가
   */
  private addToHistory(engine: string, metrics: CacheMetrics) {
    if (!this.metricsHistory.has(engine)) {
      this.metricsHistory.set(engine, []);
    }

    const history = this.metricsHistory.get(engine)!;
    history.push(metrics);

    // 최대 크기 유지
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
  }

  /**
   * 임계값 체크 및 알림
   */
  private async checkThresholds(engine: string, metrics: CacheMetrics) {
    const thresholds = this.DEFAULT_THRESHOLDS;
    const alerts: CacheMonitoringEvent[] = [];

    // 히트율 체크
    if (metrics.overall.hitRate < thresholds.minHitRate) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        engine,
        message: `캐시 히트율이 ${(metrics.overall.hitRate * 100).toFixed(1)}%로 임계값(${
          thresholds.minHitRate * 100
        }%) 미만입니다.`,
        timestamp: Date.now(),
        metrics,
      });
    }

    // 메모리 사용량 체크
    const l1MemoryUsage = metrics.l1.memoryUsage / (metrics.l1.maxSize * 1024 * 1024); // MB 단위 가정
    if (l1MemoryUsage > thresholds.maxMemoryUsage) {
      alerts.push({
        type: 'health',
        severity: 'warning',
        engine,
        message: `L1 캐시 메모리 사용률이 ${(l1MemoryUsage * 100).toFixed(1)}%로 임계값(${
          thresholds.maxMemoryUsage * 100
        }%)을 초과했습니다.`,
        timestamp: Date.now(),
        metrics,
      });
    }

    // 지연 시간 체크
    if (metrics.l2.latency.avg > thresholds.maxLatency) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        engine,
        message: `Redis 평균 지연 시간이 ${metrics.l2.latency.avg}ms로 임계값(${thresholds.maxLatency}ms)을 초과했습니다.`,
        timestamp: Date.now(),
        metrics,
      });
    }

    // Redis 연결 체크
    if (metrics.l2.connectionStatus !== 'connected') {
      alerts.push({
        type: 'health',
        severity: 'critical',
        engine,
        message: 'Redis 연결이 끊어졌습니다.',
        timestamp: Date.now(),
        metrics,
      });
    }

    // 알림 발생
    for (const alert of alerts) {
      this.eventEmitter.emit('cache.alert', alert);
      this.customLogger.warn(alert.message, 'CacheMonitoringService', {
        engine,
        severity: alert.severity,
        metrics: alert.metrics,
      });
    }
  }

  /**
   * 현재 메트릭 조회
   */
  async getCurrentMetrics(engine?: string): Promise<CacheMetrics | CacheMetrics[]> {
    if (engine) {
      return await this.getEngineMetrics(engine);
    }

    const engines = ['dashboard', 'dataset', 'widget'];
    const metrics = await Promise.all(engines.map(eng => this.getEngineMetrics(eng)));

    return metrics;
  }

  /**
   * 메트릭 히스토리 조회
   */
  getMetricsHistory(engine: string, duration?: number): CacheMetrics[] {
    const history = this.metricsHistory.get(engine) || [];

    if (!duration) {
      return history;
    }

    const since = Date.now() - duration;
    return history.filter(m => m.timestamp >= since);
  }

  /**
   * 캐시 상태 요약
   */
  async getCacheSummary(): Promise<{
    engines: Array<{
      name: string;
      status: 'healthy' | 'warning' | 'critical';
      hitRate: number;
      efficiency: number;
      issues: string[];
    }>;
    overall: {
      status: 'healthy' | 'warning' | 'critical';
      avgHitRate: number;
      avgEfficiency: number;
      totalRequests: number;
    };
  }> {
    const engines = ['dashboard', 'dataset', 'widget'];
    const engineSummaries = await Promise.all(
      engines.map(async engine => {
        const metrics = await this.getEngineMetrics(engine);
        const issues: string[] = [];

        // 문제 확인
        if (metrics.overall.hitRate < this.DEFAULT_THRESHOLDS.minHitRate) {
          issues.push('낮은 히트율');
        }
        if (metrics.l2.connectionStatus !== 'connected') {
          issues.push('Redis 연결 문제');
        }
        if (metrics.l2.latency.avg > this.DEFAULT_THRESHOLDS.maxLatency) {
          issues.push('높은 지연 시간');
        }

        const status =
          issues.length === 0
            ? 'healthy'
            : issues.some(i => i.includes('연결'))
            ? 'critical'
            : 'warning';

        return {
          name: engine,
          status,
          hitRate: metrics.overall.hitRate,
          efficiency: metrics.overall.cacheEfficiency,
          issues,
        };
      }),
    );

    // 전체 요약
    const totalRequests = engineSummaries.reduce((sum, e) => {
      const tracking = this.performanceTracking.get(e.name);
      return sum + (tracking?.requests || 0);
    }, 0);

    const avgHitRate = engineSummaries.reduce((sum, e) => sum + e.hitRate, 0) / engines.length;
    const avgEfficiency =
      engineSummaries.reduce((sum, e) => sum + e.efficiency, 0) / engines.length;

    const overallStatus = engineSummaries.some(e => e.status === 'critical')
      ? 'critical'
      : engineSummaries.some(e => e.status === 'warning')
      ? 'warning'
      : 'healthy';

    return {
      engines: engineSummaries,
      overall: {
        status: overallStatus,
        avgHitRate,
        avgEfficiency,
        totalRequests,
      },
    };
  }

  /**
   * 캐시 성능 리포트 생성
   */
  async generatePerformanceReport(duration = 86400000): Promise<{
    period: {
      start: Date;
      end: Date;
    };
    summary: {
      avgHitRate: number;
      totalRequests: number;
      totalHits: number;
      totalMisses: number;
      avgResponseTime: number;
      peakUsageTime: Date;
    };
    engines: Array<{
      name: string;
      performance: {
        hitRate: number;
        avgLatency: number;
        peakLatency: number;
      };
      recommendations: string[];
    }>;
  }> {
    const endTime = Date.now();
    const startTime = endTime - duration;
    const engines = ['dashboard', 'dataset', 'widget'];

    const engineReports = await Promise.all(
      engines.map(async engine => {
        const history = this.getMetricsHistory(engine, duration);

        if (history.length === 0) {
          return {
            name: engine,
            performance: {
              hitRate: 0,
              avgLatency: 0,
              peakLatency: 0,
            },
            recommendations: ['데이터 부족으로 분석 불가'],
          };
        }

        // 성능 통계 계산
        const avgHitRate = history.reduce((sum, m) => sum + m.overall.hitRate, 0) / history.length;
        const avgLatency =
          history.reduce((sum, m) => sum + m.overall.avgResponseTime, 0) / history.length;
        const peakLatency = Math.max(...history.map(m => m.overall.avgResponseTime));

        // 권장 사항 생성
        const recommendations: string[] = [];
        if (avgHitRate < 0.7) {
          recommendations.push('캐시 워밍업 전략 개선 필요');
          recommendations.push('TTL 설정 검토 필요');
        }
        if (peakLatency > 200) {
          recommendations.push('Redis 성능 최적화 필요');
          recommendations.push('쿼리 패턴 분석 권장');
        }

        return {
          name: engine,
          performance: {
            hitRate: avgHitRate,
            avgLatency,
            peakLatency,
          },
          recommendations,
        };
      }),
    );

    // 전체 요약 계산
    const allHistories = engines.flatMap(engine => this.getMetricsHistory(engine, duration));

    const totalRequests = allHistories.reduce((sum, m) => sum + m.overall.totalRequests, 0);
    const totalHits = allHistories.reduce(
      (sum, m) => sum + m.overall.totalRequests * m.overall.hitRate,
      0,
    );
    const totalMisses = totalRequests - totalHits;
    const avgHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    const avgResponseTime =
      allHistories.reduce((sum, m) => sum + m.overall.avgResponseTime, 0) /
      (allHistories.length || 1);

    // 피크 사용 시간 찾기
    const peakMetric = allHistories.reduce(
      (peak, m) => (m.overall.totalRequests > (peak?.overall.totalRequests || 0) ? m : peak),
      allHistories[0],
    );

    return {
      period: {
        start: new Date(startTime),
        end: new Date(endTime),
      },
      summary: {
        avgHitRate,
        totalRequests,
        totalHits,
        totalMisses,
        avgResponseTime,
        peakUsageTime: new Date(peakMetric?.timestamp || Date.now()),
      },
      engines: engineReports,
    };
  }

  /**
   * 캐시 설정 권장사항 생성
   */
  async generateRecommendations(): Promise<{
    ttl: Record<string, number>;
    memoryAllocation: Record<string, number>;
    warmupStrategy: string[];
  }> {
    const engines = ['dashboard', 'dataset', 'widget'];
    const recommendations = {
      ttl: {} as Record<string, number>,
      memoryAllocation: {} as Record<string, number>,
      warmupStrategy: [] as string[],
    };

    for (const engine of engines) {
      const history = this.getMetricsHistory(engine, 86400000); // 24시간

      if (history.length === 0) continue;

      // TTL 권장사항
      const avgHitRate = history.reduce((sum, m) => sum + m.overall.hitRate, 0) / history.length;
      if (avgHitRate < 0.5) {
        recommendations.ttl[engine] = 300; // 5분
      } else if (avgHitRate < 0.7) {
        recommendations.ttl[engine] = 900; // 15분
      } else {
        recommendations.ttl[engine] = 3600; // 1시간
      }

      // 메모리 할당 권장사항
      const avgSize = history.reduce((sum, m) => sum + m.l1.size, 0) / history.length;
      recommendations.memoryAllocation[engine] = Math.ceil(avgSize * 1.5); // 50% 여유
    }

    // 워밍업 전략 권장사항
    recommendations.warmupStrategy = [
      '매일 새벽 3시 인기 데이터셋 워밍업',
      '1시간마다 실시간 대시보드 갱신',
      '주 1회 사용하지 않는 캐시 정리',
    ];

    return recommendations;
  }
}
