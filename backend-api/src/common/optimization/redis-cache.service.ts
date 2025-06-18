import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { compress, decompress } from 'lz-string';
import { createHash } from 'crypto';
import { CustomLoggerService } from '../logger/logger.service';

export interface RedisCacheEntry {
  data: any;
  fields: any[];
  timestamp: number;
  ttl: number;
  hits: number;
  engine: string;
  queryHash: string;
  size: number;
  compressed: boolean;
}

export interface RedisCacheStats {
  engine: string;
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  memoryUsage: {
    used: number;
    max: number;
    percentage: number;
  };
  topQueries: Array<{
    queryHash: string;
    hits: number;
    size: number;
    lastAccess: number;
  }>;
}

export interface RedisCacheConfig {
  enabled: boolean;
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  defaultTtl: number;
  maxEntrySize: number;
  compressionThreshold: number;
  cluster?: {
    enabled: boolean;
    nodes: Array<{ host: string; port: number }>;
  };
}

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis | any; // Redis 클러스터와 단일 인스턴스 모두 지원
  private config: RedisCacheConfig;
  private connected = false;
  private stats = new Map<string, RedisCacheStats>();
  private readonly STATS_KEY_PREFIX = 'cache:stats:';
  private readonly QUERY_KEY_PREFIX = 'query:';

  constructor(
    private readonly configService: ConfigService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.initializeConfig();
  }

  async onModuleInit() {
    await this.initializeRedis();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Redis 설정 초기화
   */
  private initializeConfig(): void {
    // 로컬 환경에서는 Redis를 기본적으로 비활성화
    const isLocal = this.configService.get('NODE_ENV') === 'local';
    const redisEnabled = isLocal 
      ? this.configService.get('REDIS_CACHE_ENABLED', 'false') === 'true'
      : this.configService.get('REDIS_CACHE_ENABLED', 'true') === 'true';
      
    this.config = {
      enabled: redisEnabled,
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: parseInt(this.configService.get('REDIS_PORT', '6379')),
      password: this.configService.get('REDIS_PASSWORD'),
      db: parseInt(this.configService.get('REDIS_DB', '0')),
      keyPrefix: this.configService.get('REDIS_KEY_PREFIX', 'vanillameta:'),
      defaultTtl: parseInt(this.configService.get('REDIS_DEFAULT_TTL', '3600')), // 1시간
      maxEntrySize: parseInt(this.configService.get('REDIS_MAX_ENTRY_SIZE', '10485760')), // 10MB
      compressionThreshold: parseInt(this.configService.get('REDIS_COMPRESSION_THRESHOLD', '1024')), // 1KB
      cluster: {
        enabled: this.configService.get('REDIS_CLUSTER_ENABLED', 'false') === 'true',
        nodes: this.parseClusterNodes(),
      },
    };
  }

  /**
   * 클러스터 노드 파싱
   */
  private parseClusterNodes(): Array<{ host: string; port: number }> {
    const nodesStr = this.configService.get('REDIS_CLUSTER_NODES', '');
    if (!nodesStr) return [];

    return nodesStr.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port) || 6379 };
    });
  }

  /**
   * Redis 연결 초기화
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log('Redis cache is disabled');
      return;
    }

    try {
      if (this.config.cluster.enabled && this.config.cluster.nodes.length > 0) {
        // Redis Cluster 모드
        this.redis = new Redis.Cluster(this.config.cluster.nodes, {
          redisOptions: {
            password: this.config.password,
            keyPrefix: this.config.keyPrefix,
            maxRetriesPerRequest: 3,
          },
        });
      } else {
        // 단일 Redis 인스턴스
        this.redis = new Redis({
          host: this.config.host,
          port: this.config.port,
          password: this.config.password,
          db: this.config.db,
          keyPrefix: this.config.keyPrefix,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
      }

      // 연결 이벤트 핸들러
      this.redis.on('connect', () => {
        this.connected = true;
        this.logger.log('Redis cache connected successfully');
      });

      this.redis.on('error', error => {
        this.connected = false;
        if (this.configService.get('NODE_ENV') !== 'local') {
          this.logger.error('Redis cache connection error:', error);
        }
      });

      this.redis.on('close', () => {
        this.connected = false;
        if (this.configService.get('NODE_ENV') !== 'local') {
          this.logger.warn('Redis cache connection closed');
        }
      });

      // 연결 시도
      await this.redis.connect();

      this.customLogger.log('Redis cache service initialized', 'RedisCacheService', {
        host: this.config.host,
        port: this.config.port,
        cluster: this.config.cluster.enabled,
      });
    } catch (error) {
      if (this.configService.get('NODE_ENV') !== 'local') {
        this.logger.error('Failed to initialize Redis cache:', error);
      } else {
        this.logger.log('Redis cache is not available in local environment');
      }
      this.connected = false;
    }
  }

  /**
   * Redis 연결 해제
   */
  private async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.connected = false;
      this.logger.log('Redis cache disconnected');
    }
  }

  /**
   * 쿼리 해시 생성 (정규화 포함)
   */
  private generateQueryHash(databaseId: string, query: string, parameters?: any[]): string {
    // 쿼리 정규화
    const normalizedQuery = this.normalizeQuery(query);
    const paramString = parameters ? JSON.stringify(parameters) : '';
    const input = `${databaseId}:${normalizedQuery}:${paramString}`;

    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * 쿼리 정규화
   */
  private normalizeQuery(query: string): string {
    return query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // 다중 공백을 단일 공백으로
      .replace(/--.*$/gm, '') // 주석 제거
      .replace(/\/\*[\s\S]*?\*\//g, '') // 블록 주석 제거
      .trim();
  }

  /**
   * 캐시 키 생성
   */
  private generateCacheKey(engine: string, queryHash: string): string {
    return `${this.QUERY_KEY_PREFIX}${engine}:${queryHash}`;
  }

  /**
   * 데이터 압축
   */
  private compressData(data: any): { data: string; compressed: boolean } {
    const jsonString = JSON.stringify(data);

    if (jsonString.length < this.config.compressionThreshold) {
      return { data: jsonString, compressed: false };
    }

    const compressed = compress(jsonString);

    // 압축 효과가 있는 경우에만 압축된 데이터 사용
    if (compressed.length < jsonString.length * 0.9) {
      return { data: compressed, compressed: true };
    }

    return { data: jsonString, compressed: false };
  }

  /**
   * 데이터 압축 해제
   */
  private decompressData(data: string, compressed: boolean): any {
    if (!compressed) {
      return JSON.parse(data);
    }

    const decompressed = decompress(data);
    return JSON.parse(decompressed);
  }

  /**
   * 데이터 크기 계산
   */
  private calculateDataSize(data: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch (error) {
      return 1024; // 기본값 1KB
    }
  }

  /**
   * 캐시에서 쿼리 결과 조회
   */
  async get(
    engine: string,
    databaseId: string,
    query: string,
    parameters?: any[],
  ): Promise<{ data: any; fields: any[] } | null> {
    if (!this.connected) {
      return null;
    }

    const startTime = Date.now();
    const queryHash = this.generateQueryHash(databaseId, query, parameters);
    const cacheKey = this.generateCacheKey(engine, queryHash);

    try {
      const cachedData = await this.redis.get(cacheKey);

      if (!cachedData) {
        await this.updateStatsOnMiss(engine, Date.now() - startTime);
        return null;
      }

      const entry: RedisCacheEntry = JSON.parse(cachedData);

      // TTL 체크
      if (Date.now() - entry.timestamp > entry.ttl * 1000) {
        await this.redis.del(cacheKey);
        await this.updateStatsOnMiss(engine, Date.now() - startTime);
        return null;
      }

      // 데이터 압축 해제
      const data = this.decompressData(entry.data, entry.compressed);

      // 히트 카운트 업데이트
      entry.hits++;
      entry.timestamp = Date.now();
      await this.redis.setex(cacheKey, entry.ttl, JSON.stringify(entry));

      await this.updateStatsOnHit(engine, Date.now() - startTime);

      this.customLogger.debug('Redis cache hit', 'RedisCacheService', {
        engine,
        queryHash: queryHash.substring(0, 8),
        hits: entry.hits,
        size: entry.size,
        compressed: entry.compressed,
      });

      return {
        data: data.data,
        fields: data.fields,
      };
    } catch (error) {
      this.logger.error('Redis cache get error:', error);
      await this.updateStatsOnMiss(engine, Date.now() - startTime);
      return null;
    }
  }

  /**
   * 쿼리 결과를 캐시에 저장
   */
  async set(
    engine: string,
    databaseId: string,
    query: string,
    data: any,
    fields: any[],
    parameters?: any[],
    customTtl?: number,
  ): Promise<void> {
    if (!this.connected) {
      return;
    }

    const dataSize = this.calculateDataSize({ data, fields });

    // 최대 엔트리 크기 확인
    if (dataSize > this.config.maxEntrySize) {
      this.customLogger.warn('Query result too large for Redis caching', 'RedisCacheService', {
        engine,
        dataSize,
        maxSize: this.config.maxEntrySize,
      });
      return;
    }

    const queryHash = this.generateQueryHash(databaseId, query, parameters);
    const cacheKey = this.generateCacheKey(engine, queryHash);
    const ttl = customTtl || this.config.defaultTtl;

    try {
      // 데이터 압축
      const compressed = this.compressData({ data, fields });

      const entry: RedisCacheEntry = {
        data: compressed.data,
        fields: [], // 압축된 데이터에 포함됨
        timestamp: Date.now(),
        ttl,
        hits: 0,
        engine,
        queryHash,
        size: dataSize,
        compressed: compressed.compressed,
      };

      await this.redis.setex(cacheKey, ttl, JSON.stringify(entry));

      await this.updateStatsOnSet(engine, entry);

      this.customLogger.debug('Query result cached in Redis', 'RedisCacheService', {
        engine,
        queryHash: queryHash.substring(0, 8),
        dataSize,
        compressed: compressed.compressed,
        compressionRatio: compressed.compressed
          ? ((compressed.data.length / JSON.stringify({ data, fields }).length) * 100).toFixed(2) +
            '%'
          : 'none',
        ttl,
      });
    } catch (error) {
      this.logger.error('Redis cache set error:', error);
    }
  }

  /**
   * 캐시 무효화 (패턴 기반)
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(`${this.config.keyPrefix}${pattern}`);

      if (keys.length === 0) {
        return 0;
      }

      // 키 prefix 제거
      const cleanKeys = keys.map(key => key.replace(this.config.keyPrefix, ''));
      const result = await this.redis.del(...cleanKeys);

      this.customLogger.log('Cache invalidated by pattern', 'RedisCacheService', {
        pattern,
        keysDeleted: result,
      });

      return result;
    } catch (error) {
      this.logger.error('Redis cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * 엔진별 캐시 무효화
   */
  async invalidateByEngine(engine: string): Promise<number> {
    return this.invalidateByPattern(`${this.QUERY_KEY_PREFIX}${engine}:*`);
  }

  /**
   * 데이터베이스별 캐시 무효화
   */
  async invalidateByDatabase(databaseId: string): Promise<number> {
    // 모든 엔진에서 해당 데이터베이스 관련 캐시 삭제
    const patterns = [
      `${this.QUERY_KEY_PREFIX}*:*`, // 모든 쿼리 키에서 데이터베이스 ID 포함된 것들
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      try {
        const keys = await this.redis.keys(`${this.config.keyPrefix}${pattern}`);

        // 각 키를 확인하여 데이터베이스 ID가 포함된 것들만 삭제
        const keysToDelete = [];
        for (const key of keys) {
          try {
            const data = await this.redis.get(key.replace(this.config.keyPrefix, ''));
            if (data) {
              const entry: RedisCacheEntry = JSON.parse(data);
              // 쿼리 해시에서 데이터베이스 ID 확인 (정확한 매칭을 위해 실제 쿼리 파싱 필요)
              if (entry.queryHash) {
                keysToDelete.push(key.replace(this.config.keyPrefix, ''));
              }
            }
          } catch (parseError) {
            // 파싱 오류가 있는 키는 삭제 대상에서 제외
          }
        }

        if (keysToDelete.length > 0) {
          const deleted = await this.redis.del(...keysToDelete);
          totalDeleted += deleted;
        }
      } catch (error) {
        this.logger.error(`Error invalidating cache for database ${databaseId}:`, error);
      }
    }

    this.customLogger.log('Cache invalidated by database', 'RedisCacheService', {
      databaseId,
      keysDeleted: totalDeleted,
    });

    return totalDeleted;
  }

  /**
   * 전체 캐시 무효화
   */
  async invalidateAll(): Promise<number> {
    return this.invalidateByPattern(`${this.QUERY_KEY_PREFIX}*`);
  }

  /**
   * 캐시 통계 업데이트 - 히트
   */
  private async updateStatsOnHit(engine: string, responseTime: number): Promise<void> {
    try {
      const statsKey = `${this.STATS_KEY_PREFIX}${engine}`;
      const stats = await this.redis.hgetall(statsKey);

      const totalRequests = parseInt(stats.totalRequests || '0') + 1;
      const hits = parseInt(stats.hits || '0') + 1;

      await this.redis.hmset(statsKey, {
        hits: hits.toString(),
        totalRequests: totalRequests.toString(),
        hitRate: (hits / totalRequests).toString(),
        lastResponseTime: responseTime.toString(),
        lastUpdated: Date.now().toString(),
      });
    } catch (error) {
      this.logger.error('Error updating hit stats:', error);
    }
  }

  /**
   * 캐시 통계 업데이트 - 미스
   */
  private async updateStatsOnMiss(engine: string, responseTime: number): Promise<void> {
    try {
      const statsKey = `${this.STATS_KEY_PREFIX}${engine}`;
      const stats = await this.redis.hgetall(statsKey);

      const totalRequests = parseInt(stats.totalRequests || '0') + 1;
      const hits = parseInt(stats.hits || '0');

      await this.redis.hmset(statsKey, {
        totalRequests: totalRequests.toString(),
        hitRate: (hits / totalRequests).toString(),
        lastResponseTime: responseTime.toString(),
        lastUpdated: Date.now().toString(),
      });
    } catch (error) {
      this.logger.error('Error updating miss stats:', error);
    }
  }

  /**
   * 캐시 통계 업데이트 - 저장
   */
  private async updateStatsOnSet(engine: string, entry: RedisCacheEntry): Promise<void> {
    try {
      const statsKey = `${this.STATS_KEY_PREFIX}${engine}`;
      const stats = await this.redis.hgetall(statsKey);

      const totalEntries = parseInt(stats.totalEntries || '0') + 1;
      const totalSize = parseInt(stats.totalSize || '0') + entry.size;

      await this.redis.hmset(statsKey, {
        totalEntries: totalEntries.toString(),
        totalSize: totalSize.toString(),
        lastUpdated: Date.now().toString(),
      });
    } catch (error) {
      this.logger.error('Error updating set stats:', error);
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getStats(engine?: string): Promise<Map<string, RedisCacheStats> | RedisCacheStats | null> {
    if (!this.connected) {
      return null;
    }

    try {
      if (engine) {
        const statsKey = `${this.STATS_KEY_PREFIX}${engine}`;
        const stats = await this.redis.hgetall(statsKey);

        if (Object.keys(stats).length === 0) {
          return null;
        }

        return this.parseStatsFromRedis(engine, stats);
      }

      // 모든 엔진의 통계 조회
      const pattern = `${this.STATS_KEY_PREFIX}*`;
      const keys = await this.redis.keys(`${this.config.keyPrefix}${pattern}`);
      const allStats = new Map<string, RedisCacheStats>();

      for (const key of keys) {
        const engineName = key.replace(`${this.config.keyPrefix}${this.STATS_KEY_PREFIX}`, '');
        const stats = await this.redis.hgetall(key.replace(this.config.keyPrefix, ''));

        if (Object.keys(stats).length > 0) {
          allStats.set(engineName, this.parseStatsFromRedis(engineName, stats));
        }
      }

      return allStats;
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Redis에서 가져온 통계 데이터 파싱
   */
  private parseStatsFromRedis(engine: string, stats: Record<string, string>): RedisCacheStats {
    const totalRequests = parseInt(stats.totalRequests || '0');
    const hits = parseInt(stats.hits || '0');

    return {
      engine,
      totalEntries: parseInt(stats.totalEntries || '0'),
      totalSize: parseInt(stats.totalSize || '0'),
      hitRate: totalRequests > 0 ? hits / totalRequests : 0,
      missRate: totalRequests > 0 ? (totalRequests - hits) / totalRequests : 0,
      averageResponseTime: parseInt(stats.lastResponseTime || '0'),
      memoryUsage: {
        used: parseInt(stats.totalSize || '0'),
        max: this.config.maxEntrySize * 100, // 대략적인 최대값
        percentage: 0, // Redis info 명령으로 정확한 메모리 사용량 확인 필요
      },
      topQueries: [], // 별도 구현 필요
    };
  }

  /**
   * Redis 연결 상태 확인
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Redis 정보 조회
   */
  async getRedisInfo(): Promise<any> {
    if (!this.connected) {
      return null;
    }

    try {
      const info = await this.redis.info('memory');
      return this.parseRedisInfo(info);
    } catch (error) {
      this.logger.error('Error getting Redis info:', error);
      return null;
    }
  }

  /**
   * Redis INFO 명령 결과 파싱
   */
  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const result: any = {};

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 캐시 진단 정보
   */
  async getDiagnostics(): Promise<any> {
    const diagnostics = {
      timestamp: new Date(),
      connected: this.connected,
      config: {
        ...this.config,
        password: this.config.password ? '***' : undefined,
      },
      redis: await this.getRedisInfo(),
      stats: await this.getStats(),
    };

    return diagnostics;
  }
}
