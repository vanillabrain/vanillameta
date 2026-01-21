import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  DatabaseSpecificOptimizationService,
  CacheConfiguration,
} from './database-specific-optimization.service';
import { CustomLoggerService } from '../logger/logger.service';
import * as crypto from 'crypto';
import { LRUCache } from 'lru-cache';

export interface CacheEntry {
  data: any;
  fields: any[];
  timestamp: Date;
  ttl: number;
  hits: number;
  engine: string;
  queryHash: string;
  size: number; // 데이터 크기 (바이트)
}

export interface CacheStats {
  engine: string;
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  memoryUsage: {
    used: number;
    max: number;
    percentage: number;
  };
  topQueries: Array<{
    queryHash: string;
    hits: number;
    size: number;
    lastAccess: Date;
  }>;
}

export interface CacheInvalidationRule {
  pattern: RegExp;
  description: string;
  invalidateAll: boolean;
  targetTables?: string[];
}

@Injectable()
export class QueryCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(QueryCacheService.name);
  private readonly caches = new Map<string, LRUCache<string, CacheEntry>>();
  private readonly cacheStats = new Map<string, CacheStats>();
  private readonly invalidationRules = new Map<string, CacheInvalidationRule[]>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly optimizationService: DatabaseSpecificOptimizationService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.initializeInvalidationRules();

    // 주기적인 캐시 정리 (10분마다)
    this.cleanupInterval = setInterval(() => {
      this.performCacheCleanup();
    }, 10 * 60 * 1000);
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearAllCaches();
  }

  /**
   * 캐시 무효화 규칙 초기화
   */
  private initializeInvalidationRules(): void {
    // PostgreSQL 무효화 규칙
    this.invalidationRules.set('pg', [
      {
        pattern: /INSERT\s+INTO\s+(\w+)/i,
        description: 'INSERT operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /UPDATE\s+(\w+)/i,
        description: 'UPDATE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /DELETE\s+FROM\s+(\w+)/i,
        description: 'DELETE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /(DROP|ALTER)\s+(TABLE|INDEX)/i,
        description: 'DDL operations invalidate all cache',
        invalidateAll: true,
      },
      {
        pattern: /TRUNCATE\s+TABLE\s+(\w+)/i,
        description: 'TRUNCATE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
    ]);

    // MySQL 무효화 규칙
    this.invalidationRules.set('mysql2', [
      {
        pattern: /INSERT\s+(INTO\s+)?(\w+)/i,
        description: 'INSERT operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$2'],
      },
      {
        pattern: /UPDATE\s+(\w+)/i,
        description: 'UPDATE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /DELETE\s+FROM\s+(\w+)/i,
        description: 'DELETE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /(DROP|ALTER)\s+(TABLE|INDEX)/i,
        description: 'DDL operations invalidate all cache',
        invalidateAll: true,
      },
      {
        pattern: /REPLACE\s+INTO\s+(\w+)/i,
        description: 'REPLACE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
    ]);

    // SQL Server 무효화 규칙
    this.invalidationRules.set('mssql', [
      {
        pattern: /INSERT\s+INTO\s+(\w+)/i,
        description: 'INSERT operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /UPDATE\s+(\w+)/i,
        description: 'UPDATE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /DELETE\s+FROM\s+(\w+)/i,
        description: 'DELETE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /MERGE\s+(\w+)/i,
        description: 'MERGE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /(DROP|ALTER|CREATE)\s+(TABLE|INDEX|VIEW)/i,
        description: 'DDL operations invalidate all cache',
        invalidateAll: true,
      },
    ]);

    // Oracle 무효화 규칙
    this.invalidationRules.set('oracledb', [
      {
        pattern: /INSERT\s+INTO\s+(\w+)/i,
        description: 'INSERT operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /UPDATE\s+(\w+)/i,
        description: 'UPDATE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /DELETE\s+FROM\s+(\w+)/i,
        description: 'DELETE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /(DROP|ALTER|CREATE)\s+(TABLE|INDEX|VIEW|SEQUENCE)/i,
        description: 'DDL operations invalidate all cache',
        invalidateAll: true,
      },
      {
        pattern: /COMMIT|ROLLBACK/i,
        description: 'Transaction operations may affect cache consistency',
        invalidateAll: false,
      },
    ]);

    // BigQuery 무효화 규칙 (주로 읽기 전용이므로 제한적)
    this.invalidationRules.set('bigquery', [
      {
        pattern: /INSERT\s+INTO\s+(\w+)/i,
        description: 'INSERT operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /(CREATE|DROP|ALTER)\s+(TABLE|VIEW)/i,
        description: 'DDL operations invalidate all cache',
        invalidateAll: true,
      },
    ]);

    // Snowflake 무효화 규칙
    this.invalidationRules.set('snowflake', [
      {
        pattern: /INSERT\s+INTO\s+(\w+)/i,
        description: 'INSERT operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /UPDATE\s+(\w+)/i,
        description: 'UPDATE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /DELETE\s+FROM\s+(\w+)/i,
        description: 'DELETE operations invalidate related table queries',
        invalidateAll: false,
        targetTables: ['$1'],
      },
      {
        pattern: /(CREATE|DROP|ALTER)\s+(TABLE|VIEW|STAGE)/i,
        description: 'DDL operations invalidate all cache',
        invalidateAll: true,
      },
    ]);
  }

  /**
   * 엔진별 캐시 초기화
   */
  private initializeCacheForEngine(engine: string): void {
    if (this.caches.has(engine)) return;

    const config = this.optimizationService.getCacheConfig(engine);
    if (!config.enabled) return;

    const cache = new LRUCache<string, CacheEntry>({
      max: config.maxSize,
      ttl: config.ttl * 1000, // 초를 밀리초로 변환
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      // 메모리 사용량 추적을 위한 사이즈 계산
      sizeCalculation: (entry: CacheEntry) => entry.size,
      maxSize: 100 * 1024 * 1024, // 100MB 제한
      dispose: (value: CacheEntry, key: string) => {
        this.updateStatsOnEviction(engine, value);
      },
    });

    this.caches.set(engine, cache);

    // 통계 초기화
    this.cacheStats.set(engine, {
      engine,
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictions: 0,
      memoryUsage: {
        used: 0,
        max: 100 * 1024 * 1024,
        percentage: 0,
      },
      topQueries: [],
    });

    this.customLogger.log('Cache initialized for engine', 'QueryCacheService', {
      engine,
      maxSize: config.maxSize,
      ttl: config.ttl,
    });
  }

  /**
   * 쿼리 해시 생성
   */
  private generateQueryHash(query: string, parameters?: any[]): string {
    const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, ' ');
    const paramString = parameters ? JSON.stringify(parameters) : '';
    return crypto
      .createHash('sha256')
      .update(normalizedQuery + paramString)
      .digest('hex');
  }

  /**
   * 캐시에서 쿼리 결과 조회
   */
  async get(
    engine: string,
    query: string,
    parameters?: any[],
  ): Promise<{ data: any; fields: any[] } | null> {
    this.initializeCacheForEngine(engine);

    const cache = this.caches.get(engine);
    if (!cache) return null;

    const queryHash = this.generateQueryHash(query, parameters);
    const entry = cache.get(queryHash);

    if (entry) {
      // 히트 카운트 증가
      entry.hits++;
      entry.timestamp = new Date();

      // 통계 업데이트
      this.updateStatsOnHit(engine);

      this.customLogger.debug('Cache hit', 'QueryCacheService', {
        engine,
        queryHash: queryHash.substring(0, 8),
        hits: entry.hits,
      });

      return {
        data: entry.data,
        fields: entry.fields,
      };
    }

    // 캐시 미스
    this.updateStatsOnMiss(engine);

    this.customLogger.debug('Cache miss', 'QueryCacheService', {
      engine,
      queryHash: queryHash.substring(0, 8),
    });

    return null;
  }

  /**
   * 쿼리 결과를 캐시에 저장
   */
  async set(
    engine: string,
    query: string,
    data: any,
    fields: any[],
    parameters?: any[],
  ): Promise<void> {
    this.initializeCacheForEngine(engine);

    const cache = this.caches.get(engine);
    if (!cache) return;

    const config = this.optimizationService.getCacheConfig(engine);
    if (!config.enabled) return;

    // 데이터 크기 계산
    const dataSize = this.calculateDataSize(data, fields);

    // 최대 엔트리 크기 제한 (10MB)
    if (dataSize > 10 * 1024 * 1024) {
      this.customLogger.warn('Query result too large for caching', 'QueryCacheService', {
        engine,
        dataSize,
        maxSize: 10 * 1024 * 1024,
      });
      return;
    }

    const queryHash = this.generateQueryHash(query, parameters);
    const entry: CacheEntry = {
      data,
      fields,
      timestamp: new Date(),
      ttl: config.ttl,
      hits: 0,
      engine,
      queryHash,
      size: dataSize,
    };

    cache.set(queryHash, entry);

    // 통계 업데이트
    this.updateStatsOnSet(engine, entry);

    this.customLogger.debug('Query result cached', 'QueryCacheService', {
      engine,
      queryHash: queryHash.substring(0, 8),
      dataSize,
      ttl: config.ttl,
    });
  }

  /**
   * 데이터 크기 계산
   */
  private calculateDataSize(data: any, fields: any[]): number {
    try {
      const jsonString = JSON.stringify({ data, fields });
      return Buffer.byteLength(jsonString, 'utf8');
    } catch (error) {
      // JSON 직렬화 실패 시 대략적인 크기 추정
      return 1024; // 1KB로 추정
    }
  }

  /**
   * 쿼리 기반 캐시 무효화
   */
  async invalidateByQuery(engine: string, query: string): Promise<void> {
    const rules = this.invalidationRules.get(engine);
    if (!rules) return;

    let shouldInvalidateAll = false;
    const tablesToInvalidate = new Set<string>();

    for (const rule of rules) {
      if (rule.pattern.test(query)) {
        if (rule.invalidateAll) {
          shouldInvalidateAll = true;
          break;
        }

        if (rule.targetTables) {
          const matches = query.match(rule.pattern);
          if (matches) {
            for (const tablePattern of rule.targetTables) {
              const tableName = tablePattern.replace(
                /\$(\d+)/,
                (_, index) => matches[parseInt(index)] || '',
              );
              if (tableName && tableName !== tablePattern) {
                tablesToInvalidate.add(tableName.toLowerCase());
              }
            }
          }
        }

        this.customLogger.debug('Cache invalidation rule matched', 'QueryCacheService', {
          engine,
          rule: rule.description,
          query: query.substring(0, 100),
          invalidateAll: rule.invalidateAll,
          targetTables: Array.from(tablesToInvalidate),
        });
      }
    }

    if (shouldInvalidateAll) {
      await this.clearCache(engine);
    } else if (tablesToInvalidate.size > 0) {
      await this.invalidateByTables(engine, Array.from(tablesToInvalidate));
    }
  }

  /**
   * 테이블별 캐시 무효화
   */
  private async invalidateByTables(engine: string, tableNames: string[]): Promise<void> {
    const cache = this.caches.get(engine);
    if (!cache) return;

    let invalidatedCount = 0;
    const tableNamesLower = tableNames.map(name => name.toLowerCase());

    for (const [key, entry] of cache.entries()) {
      // 쿼리에서 테이블명 추출 (간단한 방식)
      const queryLower = entry.data?.query?.toLowerCase() || '';
      const hasTargetTable = tableNamesLower.some(
        tableName =>
          queryLower.includes(`from ${tableName}`) ||
          queryLower.includes(`from \`${tableName}\``) ||
          queryLower.includes(`from "${tableName}"`) ||
          queryLower.includes(`join ${tableName}`) ||
          queryLower.includes(`join \`${tableName}\``) ||
          queryLower.includes(`join "${tableName}"`),
      );

      if (hasTargetTable) {
        cache.delete(key);
        invalidatedCount++;
      }
    }

    this.customLogger.log('Cache invalidated by tables', 'QueryCacheService', {
      engine,
      tables: tableNames,
      invalidatedEntries: invalidatedCount,
    });
  }

  /**
   * 특정 엔진의 전체 캐시 삭제
   */
  async clearCache(engine: string): Promise<void> {
    const cache = this.caches.get(engine);
    if (cache) {
      const entriesCount = cache.size;
      cache.clear();

      // 통계 리셋
      const stats = this.cacheStats.get(engine);
      if (stats) {
        stats.totalEntries = 0;
        stats.totalSize = 0;
        stats.topQueries = [];
        stats.memoryUsage.used = 0;
        stats.memoryUsage.percentage = 0;
      }

      this.customLogger.log('Cache cleared', 'QueryCacheService', {
        engine,
        entriesRemoved: entriesCount,
      });
    }
  }

  /**
   * 모든 캐시 삭제
   */
  clearAllCaches(): void {
    for (const [engine] of this.caches) {
      this.clearCache(engine);
    }
  }

  /**
   * 캐시 통계 업데이트 - 히트
   */
  private updateStatsOnHit(engine: string): void {
    const stats = this.cacheStats.get(engine);
    if (stats) {
      // 히트율 계산을 위한 임시 변수 사용
      const totalRequests = stats.hitRate + stats.missRate || 1;
      stats.hitRate = (stats.hitRate * totalRequests + 1) / (totalRequests + 1);
      stats.missRate = 1 - stats.hitRate;
    }
  }

  /**
   * 캐시 통계 업데이트 - 미스
   */
  private updateStatsOnMiss(engine: string): void {
    const stats = this.cacheStats.get(engine);
    if (stats) {
      const totalRequests = stats.hitRate + stats.missRate || 1;
      stats.missRate = (stats.missRate * totalRequests + 1) / (totalRequests + 1);
      stats.hitRate = 1 - stats.missRate;
    }
  }

  /**
   * 캐시 통계 업데이트 - 저장
   */
  private updateStatsOnSet(engine: string, entry: CacheEntry): void {
    const stats = this.cacheStats.get(engine);
    if (stats) {
      stats.totalEntries++;
      stats.totalSize += entry.size;
      stats.memoryUsage.used = stats.totalSize;
      stats.memoryUsage.percentage = (stats.memoryUsage.used / stats.memoryUsage.max) * 100;
    }
  }

  /**
   * 캐시 통계 업데이트 - 제거
   */
  private updateStatsOnEviction(engine: string, entry: CacheEntry): void {
    const stats = this.cacheStats.get(engine);
    if (stats) {
      stats.evictions++;
      stats.totalEntries = Math.max(0, stats.totalEntries - 1);
      stats.totalSize = Math.max(0, stats.totalSize - entry.size);
      stats.memoryUsage.used = stats.totalSize;
      stats.memoryUsage.percentage = (stats.memoryUsage.used / stats.memoryUsage.max) * 100;
    }
  }

  /**
   * 캐시 통계 반환
   */
  getStats(engine?: string): Map<string, CacheStats> | CacheStats | null {
    if (engine) {
      const stats = this.cacheStats.get(engine);
      if (stats) {
        // Top queries 업데이트
        this.updateTopQueries(engine, stats);
        return stats;
      }
      return null;
    }

    // 모든 엔진의 통계 반환
    const allStats = new Map<string, CacheStats>();
    for (const [engineName, stats] of this.cacheStats) {
      this.updateTopQueries(engineName, stats);
      allStats.set(engineName, stats);
    }
    return allStats;
  }

  /**
   * Top queries 업데이트
   */
  private updateTopQueries(engine: string, stats: CacheStats): void {
    const cache = this.caches.get(engine);
    if (!cache) return;

    const topQueries: Array<{
      queryHash: string;
      hits: number;
      size: number;
      lastAccess: Date;
    }> = [];

    for (const [key, entry] of cache.entries()) {
      topQueries.push({
        queryHash: entry.queryHash.substring(0, 16),
        hits: entry.hits,
        size: entry.size,
        lastAccess: entry.timestamp,
      });
    }

    // 히트 수 기준으로 정렬하고 상위 10개만 유지
    topQueries.sort((a, b) => b.hits - a.hits);
    stats.topQueries = topQueries.slice(0, 10);
  }

  /**
   * 주기적인 캐시 정리
   */
  private performCacheCleanup(): void {
    for (const [engine, cache] of this.caches) {
      const beforeSize = cache.size;

      // LRU 캐시는 자동으로 TTL 처리하므로 별도 정리 불필요
      // 하지만 통계는 업데이트
      const stats = this.cacheStats.get(engine);
      if (stats) {
        stats.totalEntries = cache.size;

        // 실제 메모리 사용량 재계산
        let totalSize = 0;
        for (const [, entry] of cache.entries()) {
          totalSize += entry.size;
        }
        stats.totalSize = totalSize;
        stats.memoryUsage.used = totalSize;
        stats.memoryUsage.percentage = (totalSize / stats.memoryUsage.max) * 100;
      }

      if (beforeSize !== cache.size) {
        this.customLogger.debug('Cache cleanup completed', 'QueryCacheService', {
          engine,
          beforeSize,
          afterSize: cache.size,
          entriesRemoved: beforeSize - cache.size,
        });
      }
    }
  }

  /**
   * 캐시 설정 동적 업데이트
   */
  async updateCacheConfig(engine: string, config: Partial<CacheConfiguration>): Promise<void> {
    const cache = this.caches.get(engine);
    if (!cache) return;

    // 새로운 설정으로 캐시 재생성
    if (config.maxSize || config.ttl) {
      const currentEntries = Array.from(cache.entries());
      cache.clear();

      // 새 설정 적용
      const newCache = new LRUCache<string, CacheEntry>({
        max: config.maxSize || cache.max,
        ttl: (config.ttl || 3600) * 1000,
        updateAgeOnGet: true,
        updateAgeOnHas: true,
        sizeCalculation: (entry: CacheEntry) => entry.size,
        maxSize: 100 * 1024 * 1024,
        dispose: (value: CacheEntry, key: string) => {
          this.updateStatsOnEviction(engine, value);
        },
      });

      // 기존 엔트리 복원 (새 TTL 적용)
      for (const [key, entry] of currentEntries) {
        if (config.ttl) {
          entry.ttl = config.ttl;
        }
        newCache.set(key, entry);
      }

      this.caches.set(engine, newCache);

      this.customLogger.log('Cache configuration updated', 'QueryCacheService', {
        engine,
        newMaxSize: config.maxSize,
        newTtl: config.ttl,
        entriesPreserved: currentEntries.length,
      });
    }
  }

  /**
   * 캐시 진단 정보 반환
   */
  getDiagnostics(): any {
    const diagnostics = {
      timestamp: new Date(),
      engines: {},
      globalStats: {
        totalEngines: this.caches.size,
        totalEntries: 0,
        totalMemoryUsage: 0,
      },
    };

    for (const [engine, cache] of this.caches) {
      const stats = this.cacheStats.get(engine);
      diagnostics.engines[engine] = {
        enabled: true,
        entries: cache.size,
        memoryUsage: stats?.memoryUsage || {},
        hitRate: stats?.hitRate || 0,
        evictions: stats?.evictions || 0,
        lastCleanup: new Date(),
      };

      diagnostics.globalStats.totalEntries += cache.size;
      diagnostics.globalStats.totalMemoryUsage += stats?.memoryUsage.used || 0;
    }

    return diagnostics;
  }
}
