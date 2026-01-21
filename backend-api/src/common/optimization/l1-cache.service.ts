import { Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { CustomLoggerService } from '../logger/logger.service';

/**
 * L1 캐시 통계
 */
export interface L1CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  memoryUsage: number;
  evictions: number;
}

/**
 * L1 캐시 서비스 (메모리 캐시)
 * LRU 정책을 사용하여 메모리 효율적으로 관리
 */
@Injectable()
export class L1CacheService {
  private caches: Map<string, LRUCache<string, any>> = new Map();
  private stats: Map<string, L1CacheStats> = new Map();

  private readonly DEFAULT_CONFIG = {
    max: 1000,
    ttl: 600000, // 10분
    updateAgeOnGet: true,
    updateAgeOnHas: true,
  };

  constructor(private readonly logger: CustomLoggerService) {
    this.initializeEngines();
  }

  /**
   * 엔진별 캐시 초기화
   */
  private initializeEngines() {
    const engines = ['dashboard', 'dataset', 'widget'];

    engines.forEach(engine => {
      const cache = new LRUCache<string, any>({
        ...this.DEFAULT_CONFIG,
        dispose: (value, key) => {
          this.incrementEvictions(engine);
        },
      });

      this.caches.set(engine, cache);
      this.stats.set(engine, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        maxSize: this.DEFAULT_CONFIG.max,
        memoryUsage: 0,
        evictions: 0,
      });
    });
  }

  /**
   * 캐시에서 값 조회
   */
  async get(engine: string, key: string): Promise<any | null> {
    const cache = this.caches.get(engine);
    if (!cache) {
      this.logger.error(`Unknown cache engine: ${engine}`, 'L1CacheService');
      return null;
    }

    const value = cache.get(key);

    if (value !== undefined) {
      this.incrementHits(engine);
      return value;
    } else {
      this.incrementMisses(engine);
      return null;
    }
  }

  /**
   * 캐시에 값 저장
   */
  async set(engine: string, key: string, value: any, ttl?: number): Promise<void> {
    const cache = this.caches.get(engine);
    if (!cache) {
      this.logger.error(`Unknown cache engine: ${engine}`, 'L1CacheService');
      return;
    }

    const options = ttl ? { ttl: ttl * 1000 } : undefined;
    cache.set(key, value, options);

    this.updateStats(engine);
  }

  /**
   * 캐시에서 값 삭제
   */
  async delete(engine: string, key: string): Promise<void> {
    const cache = this.caches.get(engine);
    if (!cache) {
      return;
    }

    cache.delete(key);
    this.updateStats(engine);
  }

  /**
   * 엔진의 모든 캐시 삭제
   */
  async clear(engine: string): Promise<void> {
    const cache = this.caches.get(engine);
    if (!cache) {
      return;
    }

    cache.clear();
    this.resetStats(engine);
  }

  /**
   * 패턴과 일치하는 키 삭제
   */
  async deleteByPattern(engine: string, pattern: string): Promise<number> {
    const cache = this.caches.get(engine);
    if (!cache) {
      return 0;
    }

    let deletedCount = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));

    for (const key of cache.keys()) {
      if (regex.test(key)) {
        cache.delete(key);
        deletedCount++;
      }
    }

    this.updateStats(engine);
    return deletedCount;
  }

  /**
   * 캐시 통계 조회
   */
  async getStats(engine: string): Promise<L1CacheStats> {
    const stats = this.stats.get(engine);
    const cache = this.caches.get(engine);

    if (!stats || !cache) {
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        maxSize: 0,
        memoryUsage: 0,
        evictions: 0,
      };
    }

    // 메모리 사용량 추정 (대략적인 계산)
    const memoryUsage = this.estimateMemoryUsage(cache);

    return {
      ...stats,
      size: cache.size,
      memoryUsage,
      hitRate: this.calculateHitRate(stats),
    };
  }

  /**
   * 히트 수 증가
   */
  private incrementHits(engine: string) {
    const stats = this.stats.get(engine);
    if (stats) {
      stats.hits++;
    }
  }

  /**
   * 미스 수 증가
   */
  private incrementMisses(engine: string) {
    const stats = this.stats.get(engine);
    if (stats) {
      stats.misses++;
    }
  }

  /**
   * 제거 수 증가
   */
  private incrementEvictions(engine: string) {
    const stats = this.stats.get(engine);
    if (stats) {
      stats.evictions++;
    }
  }

  /**
   * 통계 업데이트
   */
  private updateStats(engine: string) {
    const stats = this.stats.get(engine);
    const cache = this.caches.get(engine);

    if (stats && cache) {
      stats.size = cache.size;
      stats.hitRate = this.calculateHitRate(stats);
    }
  }

  /**
   * 통계 리셋
   */
  private resetStats(engine: string) {
    const stats = this.stats.get(engine);
    if (stats) {
      stats.hits = 0;
      stats.misses = 0;
      stats.hitRate = 0;
      stats.size = 0;
      stats.evictions = 0;
    }
  }

  /**
   * 히트율 계산
   */
  private calculateHitRate(stats: L1CacheStats): number {
    const total = stats.hits + stats.misses;
    return total > 0 ? stats.hits / total : 0;
  }

  /**
   * 메모리 사용량 추정
   */
  private estimateMemoryUsage(cache: LRUCache<string, any>): number {
    let totalSize = 0;

    for (const [key, value] of cache.entries()) {
      // 키 크기
      totalSize += key.length * 2; // UTF-16

      // 값 크기 (JSON 문자열로 변환하여 추정)
      try {
        const valueStr = JSON.stringify(value);
        totalSize += valueStr.length * 2;
      } catch {
        // JSON 변환 실패 시 기본값
        totalSize += 1024;
      }
    }

    return totalSize;
  }

  /**
   * 모든 엔진의 통계 조회
   */
  async getAllStats(): Promise<Record<string, L1CacheStats>> {
    const allStats: Record<string, L1CacheStats> = {};

    for (const [engine, _] of this.caches) {
      allStats[engine] = await this.getStats(engine);
    }

    return allStats;
  }

  /**
   * 캐시 상태 확인
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    engines: Array<{
      name: string;
      size: number;
      maxSize: number;
      hitRate: number;
    }>;
  }> {
    const engines = [];
    let healthy = true;

    for (const [engine, cache] of this.caches) {
      const stats = await this.getStats(engine);

      engines.push({
        name: engine,
        size: cache.size,
        maxSize: this.DEFAULT_CONFIG.max,
        hitRate: stats.hitRate,
      });

      // 메모리 사용률이 90% 이상이면 unhealthy
      if (cache.size / this.DEFAULT_CONFIG.max > 0.9) {
        healthy = false;
      }
    }

    return { healthy, engines };
  }
}
