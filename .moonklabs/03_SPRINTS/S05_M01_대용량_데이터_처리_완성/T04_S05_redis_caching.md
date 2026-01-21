# T04: Redis 쿼리 캐싱 레이어 구현

## 📋 작업 개요
- **작업 ID**: T04_S05
- **작업명**: Redis 쿼리 캐싱 레이어 구현
- **소요 시간**: 3일
- **담당 팀**: Backend Team

## 🎯 작업 목표
대용량 쿼리 결과를 효율적으로 캐싱하고 관리하는 Redis 기반 캐싱 레이어를 구현합니다.

## 📝 상세 작업 내용

### 1. 캐싱 전략 설계

#### 1.1 캐시 키 구조
```typescript
// 캐시 키 생성 전략
export class CacheKeyBuilder {
  static buildQueryCacheKey(params: {
    dataSourceId: string;
    query: string;
    parameters?: Record<string, any>;
    userId?: string;
  }): string {
    const queryHash = crypto
      .createHash('sha256')
      .update(params.query)
      .update(JSON.stringify(params.parameters || {}))
      .digest('hex');
    
    const segments = [
      'query',
      params.dataSourceId,
      queryHash.substring(0, 16),
      params.userId || 'public'
    ];
    
    return segments.join(':');
  }
  
  static buildResultCacheKey(queryId: string, page?: number): string {
    return page ? `result:${queryId}:page:${page}` : `result:${queryId}`;
  }
  
  static buildMetadataCacheKey(queryId: string): string {
    return `metadata:${queryId}`;
  }
}
```

#### 1.2 캐시 정책
```typescript
interface CachePolicy {
  ttl: number;              // Time to Live (초)
  maxSize?: number;         // 최대 크기 (bytes)
  compression?: boolean;    // 압축 여부
  evictionPolicy: 'LRU' | 'LFU' | 'TTL';
  refreshStrategy?: 'lazy' | 'eager';
}

// 데이터 타입별 캐시 정책
export const CACHE_POLICIES: Record<string, CachePolicy> = {
  QUERY_RESULT: {
    ttl: 3600,              // 1시간
    maxSize: 10 * 1024 * 1024, // 10MB
    compression: true,
    evictionPolicy: 'LRU',
    refreshStrategy: 'lazy'
  },
  DASHBOARD_DATA: {
    ttl: 300,               // 5분
    maxSize: 5 * 1024 * 1024,  // 5MB
    compression: false,
    evictionPolicy: 'TTL',
    refreshStrategy: 'eager'
  },
  USER_PREFERENCE: {
    ttl: 86400,             // 24시간
    evictionPolicy: 'LFU'
  }
};
```

### 2. Redis 캐시 서비스

#### 2.1 기본 캐시 서비스
```typescript
// src/modules/cache/services/redis-cache.service.ts
@Injectable()
export class RedisCacheService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly compressionService: CompressionService,
    private readonly metricsService: MetricsService
  ) {}
  
  async get<T>(key: string, options?: GetOptions): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const value = await this.redis.get(key);
      
      if (!value) {
        this.metricsService.recordCacheMiss(key);
        return null;
      }
      
      this.metricsService.recordCacheHit(key);
      
      // 압축 해제
      const decompressed = options?.compressed 
        ? await this.compressionService.decompress(value)
        : value;
      
      return JSON.parse(decompressed);
    } catch (error) {
      this.metricsService.recordCacheError(key, error);
      throw error;
    } finally {
      this.metricsService.recordLatency('cache.get', Date.now() - startTime);
    }
  }
  
  async set<T>(
    key: string, 
    value: T, 
    options?: SetOptions
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      let serialized = JSON.stringify(value);
      
      // 크기 확인
      if (options?.maxSize && Buffer.byteLength(serialized) > options.maxSize) {
        throw new Error(`Value exceeds max size: ${options.maxSize}`);
      }
      
      // 압축
      if (options?.compress) {
        serialized = await this.compressionService.compress(serialized);
      }
      
      // TTL과 함께 저장
      if (options?.ttl) {
        await this.redis.setex(key, options.ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      
      this.metricsService.recordCacheWrite(key, Buffer.byteLength(serialized));
    } catch (error) {
      this.metricsService.recordCacheError(key, error);
      throw error;
    } finally {
      this.metricsService.recordLatency('cache.set', Date.now() - startTime);
    }
  }
  
  async delete(pattern: string): Promise<number> {
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) return 0;
    
    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.del(key));
    
    await pipeline.exec();
    
    this.metricsService.recordCacheEviction(pattern, keys.length);
    
    return keys.length;
  }
}
```

#### 2.2 쿼리 캐시 서비스
```typescript
// src/modules/cache/services/query-cache.service.ts
@Injectable()
export class QueryCacheService {
  constructor(
    private readonly cacheService: RedisCacheService,
    private readonly cacheKeyBuilder: CacheKeyBuilder,
    private readonly configService: ConfigService
  ) {}
  
  async getCachedQueryResult(
    queryParams: QueryParams
  ): Promise<CachedQueryResult | null> {
    const cacheKey = CacheKeyBuilder.buildQueryCacheKey(queryParams);
    
    // 메타데이터 확인
    const metadata = await this.cacheService.get<QueryMetadata>(
      `${cacheKey}:meta`
    );
    
    if (!metadata) return null;
    
    // 유효성 검증
    if (this.isExpired(metadata)) {
      await this.invalidate(cacheKey);
      return null;
    }
    
    // 결과 데이터 조회
    const result = await this.cacheService.get<QueryResult>(cacheKey, {
      compressed: metadata.compressed
    });
    
    return {
      metadata,
      result,
      cacheKey,
      hitRate: await this.calculateHitRate(cacheKey)
    };
  }
  
  async cacheQueryResult(
    queryParams: QueryParams,
    result: QueryResult,
    options?: CacheOptions
  ): Promise<void> {
    const cacheKey = CacheKeyBuilder.buildQueryCacheKey(queryParams);
    const policy = CACHE_POLICIES.QUERY_RESULT;
    
    // 메타데이터 생성
    const metadata: QueryMetadata = {
      queryId: queryParams.queryId,
      dataSourceId: queryParams.dataSourceId,
      rowCount: result.rows.length,
      size: this.calculateSize(result),
      compressed: policy.compression,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + policy.ttl * 1000),
      checksum: this.generateChecksum(result)
    };
    
    // 메타데이터 저장
    await this.cacheService.set(
      `${cacheKey}:meta`,
      metadata,
      { ttl: policy.ttl }
    );
    
    // 결과 저장
    await this.cacheService.set(cacheKey, result, {
      ttl: policy.ttl,
      compress: policy.compression,
      maxSize: policy.maxSize
    });
    
    // 관련 캐시 키 추적
    await this.trackRelatedKeys(queryParams.dataSourceId, cacheKey);
  }
  
  private async trackRelatedKeys(
    dataSourceId: string,
    cacheKey: string
  ): Promise<void> {
    const trackingKey = `tracking:datasource:${dataSourceId}`;
    await this.cacheService.redis.sadd(trackingKey, cacheKey);
    await this.cacheService.redis.expire(trackingKey, 86400); // 24시간
  }
}
```

### 3. 캐시 무효화 전략

#### 3.1 무효화 서비스
```typescript
// src/modules/cache/services/cache-invalidation.service.ts
@Injectable()
export class CacheInvalidationService {
  constructor(
    private readonly cacheService: RedisCacheService,
    private readonly eventEmitter: EventEmitter2
  ) {}
  
  // 데이터소스 변경 시 관련 캐시 무효화
  async invalidateDataSourceCache(dataSourceId: string): Promise<void> {
    const pattern = `query:${dataSourceId}:*`;
    const deletedCount = await this.cacheService.delete(pattern);
    
    this.eventEmitter.emit('cache.invalidated', {
      type: 'datasource',
      dataSourceId,
      deletedCount
    });
  }
  
  // 테이블 데이터 변경 시 관련 캐시 무효화
  async invalidateTableCache(
    dataSourceId: string,
    tableName: string
  ): Promise<void> {
    // 관련 쿼리 캐시 키 조회
    const trackingKey = `tracking:table:${dataSourceId}:${tableName}`;
    const relatedKeys = await this.cacheService.redis.smembers(trackingKey);
    
    if (relatedKeys.length > 0) {
      const pipeline = this.cacheService.redis.pipeline();
      relatedKeys.forEach(key => pipeline.del(key));
      await pipeline.exec();
    }
    
    this.eventEmitter.emit('cache.invalidated', {
      type: 'table',
      dataSourceId,
      tableName,
      deletedCount: relatedKeys.length
    });
  }
  
  // 시간 기반 무효화
  async invalidateExpiredCache(): Promise<void> {
    const cursor = '0';
    const pattern = 'query:*:meta';
    
    // SCAN을 사용하여 메모리 효율적으로 처리
    const stream = this.cacheService.redis.scanStream({
      match: pattern,
      count: 100
    });
    
    stream.on('data', async (keys: string[]) => {
      for (const key of keys) {
        const metadata = await this.cacheService.get<QueryMetadata>(key);
        
        if (metadata && this.isExpired(metadata)) {
          const queryKey = key.replace(':meta', '');
          await this.cacheService.delete(queryKey);
          await this.cacheService.delete(key);
        }
      }
    });
  }
}
```

#### 3.2 무효화 이벤트 리스너
```typescript
@Injectable()
export class CacheInvalidationListener {
  @OnEvent('datasource.updated')
  async handleDataSourceUpdate(event: DataSourceUpdateEvent): Promise<void> {
    await this.invalidationService.invalidateDataSourceCache(
      event.dataSourceId
    );
  }
  
  @OnEvent('table.data.changed')
  async handleTableDataChange(event: TableDataChangeEvent): Promise<void> {
    await this.invalidationService.invalidateTableCache(
      event.dataSourceId,
      event.tableName
    );
  }
  
  @Cron('0 */10 * * * *') // 10분마다
  async cleanupExpiredCache(): Promise<void> {
    await this.invalidationService.invalidateExpiredCache();
  }
}
```

### 4. 대용량 데이터 캐싱

#### 4.1 청크 기반 캐싱
```typescript
export class ChunkedCacheService {
  private readonly CHUNK_SIZE = 1000; // 1000 rows per chunk
  
  async cacheInChunks(
    baseKey: string,
    data: any[],
    options: CacheOptions
  ): Promise<void> {
    const chunks = this.splitIntoChunks(data, this.CHUNK_SIZE);
    const metadata: ChunkedCacheMetadata = {
      totalChunks: chunks.length,
      totalItems: data.length,
      chunkSize: this.CHUNK_SIZE,
      createdAt: new Date()
    };
    
    // 메타데이터 저장
    await this.cacheService.set(
      `${baseKey}:chunked:meta`,
      metadata,
      options
    );
    
    // 각 청크 병렬 저장
    await Promise.all(
      chunks.map((chunk, index) =>
        this.cacheService.set(
          `${baseKey}:chunk:${index}`,
          chunk,
          options
        )
      )
    );
  }
  
  async getFromChunks<T>(baseKey: string): Promise<T[] | null> {
    const metadata = await this.cacheService.get<ChunkedCacheMetadata>(
      `${baseKey}:chunked:meta`
    );
    
    if (!metadata) return null;
    
    // 모든 청크 병렬 조회
    const chunks = await Promise.all(
      Array.from({ length: metadata.totalChunks }, (_, i) =>
        this.cacheService.get<T[]>(`${baseKey}:chunk:${i}`)
      )
    );
    
    // 청크 병합
    return chunks.flat();
  }
}
```

### 5. 캐시 워밍 및 프리페칭

#### 5.1 캐시 워밍 서비스
```typescript
@Injectable()
export class CacheWarmingService {
  constructor(
    private readonly queryService: QueryService,
    private readonly cacheService: QueryCacheService,
    private readonly analyticsService: AnalyticsService
  ) {}
  
  @Cron('0 0 6 * * *') // 매일 오전 6시
  async warmPopularQueries(): Promise<void> {
    // 인기 쿼리 조회
    const popularQueries = await this.analyticsService.getPopularQueries({
      limit: 50,
      period: '7d'
    });
    
    for (const query of popularQueries) {
      try {
        // 캐시 확인
        const cached = await this.cacheService.getCachedQueryResult(query);
        
        if (!cached) {
          // 쿼리 실행 및 캐싱
          const result = await this.queryService.execute(query);
          await this.cacheService.cacheQueryResult(query, result);
        }
      } catch (error) {
        logger.error(`Cache warming failed for query ${query.queryId}`, error);
      }
    }
  }
  
  // 예측 기반 프리페칭
  async prefetchRelatedQueries(currentQuery: QueryParams): Promise<void> {
    const relatedQueries = await this.analyticsService.predictNextQueries(
      currentQuery
    );
    
    // 백그라운드에서 비동기 프리페칭
    setImmediate(async () => {
      for (const query of relatedQueries) {
        try {
          await this.warmQuery(query);
        } catch (error) {
          // 프리페칭 실패는 조용히 처리
        }
      }
    });
  }
}
```

### 6. 캐시 모니터링

#### 6.1 캐시 메트릭
```typescript
export class CacheMetricsService {
  async getMetrics(): Promise<CacheMetrics> {
    const info = await this.redis.info('memory');
    const keyspace = await this.redis.info('keyspace');
    
    return {
      memoryUsage: this.parseMemoryUsage(info),
      hitRate: await this.calculateGlobalHitRate(),
      missRate: await this.calculateGlobalMissRate(),
      evictionRate: await this.getEvictionRate(),
      keyCount: this.parseKeyCount(keyspace),
      avgTTL: await this.calculateAverageTTL(),
      topKeys: await this.getTopKeys()
    };
  }
  
  async getKeyMetrics(pattern: string): Promise<KeyMetrics> {
    const keys = await this.redis.keys(pattern);
    
    const metrics = await Promise.all(
      keys.map(async key => ({
        key,
        size: await this.redis.memory('USAGE', key),
        ttl: await this.redis.ttl(key),
        type: await this.redis.type(key)
      }))
    );
    
    return {
      pattern,
      count: keys.length,
      totalSize: metrics.reduce((sum, m) => sum + (m.size || 0), 0),
      avgSize: metrics.reduce((sum, m) => sum + (m.size || 0), 0) / keys.length,
      details: metrics
    };
  }
}
```

## 🔧 기술 스택
- Redis (Cluster Mode)
- ioredis
- compression (zlib/gzip)
- node-cron
- Redis Streams (옵션)

## ✅ 완료 조건
- [ ] 캐시 히트율 80% 이상 달성
- [ ] 쿼리 응답 시간 50% 단축
- [ ] 자동 캐시 무효화 구현
- [ ] 청크 기반 대용량 데이터 캐싱
- [ ] 캐시 워밍 및 프리페칭
- [ ] 실시간 캐시 메트릭 모니터링
- [ ] 캐시 크기 제한 및 eviction 정책
- [ ] 압축을 통한 메모리 효율화

## 📊 성능 목표
- 캐시 조회 지연: < 5ms
- 캐시 쓰기 지연: < 20ms
- 메모리 사용률: < 80%
- 캐시 히트율: > 80%

## 🧪 테스트 계획
1. 단위 테스트
   - 캐시 키 생성 로직
   - 압축/해제 기능
   - 무효화 로직

2. 통합 테스트
   - 전체 캐싱 플로우
   - 무효화 이벤트 처리
   - 청크 기반 캐싱

3. 성능 테스트
   - 대용량 데이터 캐싱
   - 동시성 테스트
   - 메모리 사용량 모니터링

## 📚 참고 자료
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Redis Memory Optimization](https://redis.io/docs/manual/memory-optimization/)