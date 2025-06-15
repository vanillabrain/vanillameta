import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { QueryCacheService, CacheEntry, CacheStats } from './query-cache.service';
import { RedisCacheService, RedisCacheStats } from './redis-cache.service';
import { CustomLoggerService } from '../logger/logger.service';

export interface HybridCacheStats {
  engine: string;
  l1Cache: CacheStats | null;
  l2Cache: RedisCacheStats | null;
  hybridMetrics: {
    l1HitRate: number;
    l2HitRate: number;
    overallHitRate: number;
    l1Size: number;
    l2Size: number;
    promotionCount: number;
    demotionCount: number;
  };
}

@Injectable()
export class HybridCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HybridCacheService.name);
  private readonly promotionMetrics = new Map<string, { promotions: number; demotions: number }>();

  constructor(
    private readonly l1Cache: QueryCacheService,
    private readonly l2Cache: RedisCacheService,
    private readonly customLogger: CustomLoggerService,
  ) {}

  async onModuleInit() {
    this.logger.log('Hybrid cache service initialized');
  }

  async onModuleDestroy() {
    // Cleanup if needed
  }

  /**
   * 캐시에서 쿼리 결과 조회 (L1 -> L2 순서)
   */
  async get(
    engine: string,
    databaseId: string,
    query: string,
    parameters?: any[],
  ): Promise<{ data: any; fields: any[] } | null> {
    const startTime = Date.now();

    try {
      // L1 캐시 (메모리) 먼저 확인
      const l1Result = await this.l1Cache.get(engine, query, parameters);

      if (l1Result) {
        this.customLogger.debug('L1 cache hit', 'HybridCacheService', {
          engine,
          responseTime: Date.now() - startTime,
        });
        return l1Result;
      }

      // L1 미스 시 L2 캐시 (Redis) 확인
      const l2Result = await this.l2Cache.get(engine, databaseId, query, parameters);

      if (l2Result) {
        // L2 히트 시 L1으로 승격 (자주 사용되는 데이터)
        await this.promoteToL1(engine, query, l2Result.data, l2Result.fields, parameters);

        this.customLogger.debug('L2 cache hit, promoted to L1', 'HybridCacheService', {
          engine,
          responseTime: Date.now() - startTime,
        });

        this.updatePromotionStats(engine, 'promotion');
        return l2Result;
      }

      // 모든 캐시 미스
      this.customLogger.debug('Cache miss (L1 + L2)', 'HybridCacheService', {
        engine,
        responseTime: Date.now() - startTime,
      });

      return null;
    } catch (error) {
      this.logger.error('Hybrid cache get error:', error);
      return null;
    }
  }

  /**
   * 쿼리 결과를 캐시에 저장 (L1과 L2 모두)
   */
  async set(
    engine: string,
    databaseId: string,
    query: string,
    data: any,
    fields: any[],
    parameters?: any[],
    options?: {
      l1Only?: boolean;
      l2Only?: boolean;
      ttl?: number;
    },
  ): Promise<void> {
    const { l1Only = false, l2Only = false, ttl } = options || {};

    try {
      // 기본적으로 두 캐시 모두에 저장
      const promises: Promise<void>[] = [];

      if (!l2Only) {
        // L1 캐시에 저장
        promises.push(this.l1Cache.set(engine, query, data, fields, parameters));
      }

      if (!l1Only && this.l2Cache.isConnected()) {
        // L2 캐시에 저장 (Redis 연결된 경우에만)
        promises.push(this.l2Cache.set(engine, databaseId, query, data, fields, parameters, ttl));
      }

      await Promise.allSettled(promises);

      this.customLogger.debug('Data cached in hybrid storage', 'HybridCacheService', {
        engine,
        l1: !l2Only,
        l2: !l1Only && this.l2Cache.isConnected(),
        dataSize: JSON.stringify({ data, fields }).length,
      });
    } catch (error) {
      this.logger.error('Hybrid cache set error:', error);
    }
  }

  /**
   * L2에서 L1으로 데이터 승격
   */
  private async promoteToL1(
    engine: string,
    query: string,
    data: any,
    fields: any[],
    parameters?: any[],
  ): Promise<void> {
    try {
      await this.l1Cache.set(engine, query, data, fields, parameters);
    } catch (error) {
      this.logger.error('Failed to promote data to L1:', error);
    }
  }

  /**
   * 쿼리 기반 캐시 무효화
   */
  async invalidateByQuery(engine: string, query: string): Promise<void> {
    try {
      const promises = [this.l1Cache.invalidateByQuery(engine, query)];

      if (this.l2Cache.isConnected()) {
        // Redis에서는 패턴 기반 무효화 (정확한 매칭 어려움)
        promises.push(
          this.l2Cache.invalidateByEngine(engine).then(() => {
            // void를 반환하도록 변환
          }),
        );
      }

      await Promise.allSettled(promises);

      this.customLogger.info('Cache invalidated by query', 'HybridCacheService', {
        engine,
        query: query.substring(0, 100),
      });
    } catch (error) {
      this.logger.error('Hybrid cache invalidation error:', error);
    }
  }

  /**
   * 엔진별 캐시 무효화
   */
  async invalidateByEngine(engine: string): Promise<void> {
    try {
      const promises: Promise<any>[] = [Promise.resolve(this.l1Cache.clearCache(engine))];

      if (this.l2Cache.isConnected()) {
        promises.push(this.l2Cache.invalidateByEngine(engine));
      }

      await Promise.allSettled(promises);

      this.customLogger.info('Cache invalidated by engine', 'HybridCacheService', {
        engine,
      });
    } catch (error) {
      this.logger.error('Engine cache invalidation error:', error);
    }
  }

  /**
   * 데이터베이스별 캐시 무효화
   */
  async invalidateByDatabase(databaseId: string): Promise<void> {
    try {
      // L1 캐시는 데이터베이스 ID를 직접 추적하지 않으므로 전체 클리어
      this.l1Cache.clearAllCaches();

      if (this.l2Cache.isConnected()) {
        await this.l2Cache.invalidateByDatabase(databaseId);
      }

      this.customLogger.info('Cache invalidated by database', 'HybridCacheService', {
        databaseId,
      });
    } catch (error) {
      this.logger.error('Database cache invalidation error:', error);
    }
  }

  /**
   * 전체 캐시 무효화
   */
  async invalidateAll(): Promise<void> {
    try {
      const promises: Promise<any>[] = [Promise.resolve(this.l1Cache.clearAllCaches())];

      if (this.l2Cache.isConnected()) {
        promises.push(this.l2Cache.invalidateAll());
      }

      await Promise.allSettled(promises);

      this.customLogger.info('All caches invalidated', 'HybridCacheService');
    } catch (error) {
      this.logger.error('Full cache invalidation error:', error);
    }
  }

  /**
   * 하이브리드 캐시 통계 조회
   */
  async getHybridStats(
    engine?: string,
  ): Promise<Map<string, HybridCacheStats> | HybridCacheStats | null> {
    try {
      if (engine) {
        return await this.getEngineHybridStats(engine);
      }

      // 모든 엔진의 하이브리드 통계
      const l1Stats = this.l1Cache.getStats();
      const l2Stats = await this.l2Cache.getStats();
      const allHybridStats = new Map<string, HybridCacheStats>();

      if (l1Stats instanceof Map) {
        for (const [engineName] of l1Stats) {
          const hybridStat = await this.getEngineHybridStats(engineName);
          if (hybridStat) {
            allHybridStats.set(engineName, hybridStat);
          }
        }
      }

      // L2만 있는 엔진들도 포함
      if (l2Stats instanceof Map) {
        for (const [engineName] of l2Stats) {
          if (!allHybridStats.has(engineName)) {
            const hybridStat = await this.getEngineHybridStats(engineName);
            if (hybridStat) {
              allHybridStats.set(engineName, hybridStat);
            }
          }
        }
      }

      return allHybridStats;
    } catch (error) {
      this.logger.error('Error getting hybrid stats:', error);
      return null;
    }
  }

  /**
   * 특정 엔진의 하이브리드 통계 조회
   */
  private async getEngineHybridStats(engine: string): Promise<HybridCacheStats | null> {
    try {
      const l1Stats = this.l1Cache.getStats(engine) as CacheStats | null;
      const l2Stats = (await this.l2Cache.getStats(engine)) as RedisCacheStats | null;
      const promotionStats = this.promotionMetrics.get(engine) || { promotions: 0, demotions: 0 };

      // 하이브리드 메트릭 계산
      const l1HitRate = l1Stats?.hitRate || 0;
      const l2HitRate = l2Stats?.hitRate || 0;
      const overallHitRate = this.calculateOverallHitRate(l1HitRate, l2HitRate);

      return {
        engine,
        l1Cache: l1Stats,
        l2Cache: l2Stats,
        hybridMetrics: {
          l1HitRate,
          l2HitRate,
          overallHitRate,
          l1Size: l1Stats?.totalSize || 0,
          l2Size: l2Stats?.totalSize || 0,
          promotionCount: promotionStats.promotions,
          demotionCount: promotionStats.demotions,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting hybrid stats for engine ${engine}:`, error);
      return null;
    }
  }

  /**
   * 전체 히트율 계산 (L1과 L2 결합)
   */
  private calculateOverallHitRate(l1HitRate: number, l2HitRate: number): number {
    // 가정: L1 미스 시 L2 확인
    // 전체 히트율 = L1 히트율 + (1 - L1 히트율) * L2 히트율
    return l1HitRate + (1 - l1HitRate) * l2HitRate;
  }

  /**
   * 승격/강등 통계 업데이트
   */
  private updatePromotionStats(engine: string, operation: 'promotion' | 'demotion'): void {
    const stats = this.promotionMetrics.get(engine) || { promotions: 0, demotions: 0 };

    if (operation === 'promotion') {
      stats.promotions++;
    } else {
      stats.demotions++;
    }

    this.promotionMetrics.set(engine, stats);
  }

  /**
   * 캐시 워밍업 (자주 사용되는 쿼리를 미리 로드)
   */
  async warmupCache(
    engine: string,
    queries: Array<{
      databaseId: string;
      query: string;
      parameters?: any[];
    }>,
  ): Promise<void> {
    this.logger.log(`Starting cache warmup for engine ${engine} with ${queries.length} queries`);

    for (const queryInfo of queries) {
      try {
        // 캐시에 이미 있는지 확인
        const existing = await this.get(
          engine,
          queryInfo.databaseId,
          queryInfo.query,
          queryInfo.parameters,
        );

        if (!existing) {
          // TODO: 실제 데이터베이스에서 쿼리 실행하여 캐시에 저장
          // 이 부분은 DatasetService와 연동 필요
          this.logger.debug(`Cache warmup: query not cached yet`, {
            engine,
            query: queryInfo.query.substring(0, 100),
          });
        }
      } catch (error) {
        this.logger.error(`Cache warmup failed for query:`, error);
      }
    }

    this.logger.log(`Cache warmup completed for engine ${engine}`);
  }

  /**
   * 캐시 상태 진단
   */
  async getDiagnostics(): Promise<any> {
    try {
      const l1Diagnostics = this.l1Cache.getDiagnostics();
      const l2Diagnostics = await this.l2Cache.getDiagnostics();
      const hybridStats = await this.getHybridStats();

      return {
        timestamp: new Date(),
        l1Cache: l1Diagnostics,
        l2Cache: l2Diagnostics,
        hybridStats,
        promotionMetrics: Object.fromEntries(this.promotionMetrics),
      };
    } catch (error) {
      this.logger.error('Error getting hybrid cache diagnostics:', error);
      return {
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * 캐시 성능 최적화 제안
   */
  async getOptimizationSuggestions(): Promise<any[]> {
    const suggestions = [];

    try {
      const hybridStats = await this.getHybridStats();

      if (hybridStats instanceof Map) {
        for (const [engine, stats] of hybridStats) {
          // L1 히트율이 낮으면 L1 캐시 크기 증가 제안
          if (stats.hybridMetrics.l1HitRate < 0.7) {
            suggestions.push({
              type: 'L1_SIZE_INCREASE',
              engine,
              current: stats.l1Cache?.memoryUsage,
              suggestion: 'L1 캐시 크기를 늘려 히트율을 개선하세요.',
              priority: 'medium',
            });
          }

          // L2 히트율이 낮으면 TTL 조정 제안
          if (stats.hybridMetrics.l2HitRate < 0.8) {
            suggestions.push({
              type: 'L2_TTL_INCREASE',
              engine,
              current: stats.l2Cache?.totalEntries,
              suggestion: 'Redis 캐시 TTL을 늘려 데이터 보존 기간을 연장하세요.',
              priority: 'low',
            });
          }

          // 전체 히트율이 목표치보다 낮으면 캐시 전략 재검토 제안
          if (stats.hybridMetrics.overallHitRate < 0.8) {
            suggestions.push({
              type: 'CACHE_STRATEGY_REVIEW',
              engine,
              current: stats.hybridMetrics.overallHitRate,
              suggestion: '캐시 전략을 재검토하여 히트율을 개선하세요.',
              priority: 'high',
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Error generating optimization suggestions:', error);
    }

    return suggestions;
  }
}
