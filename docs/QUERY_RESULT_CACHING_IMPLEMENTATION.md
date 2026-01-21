# VanillaMeta 쿼리 결과 캐싱 구현

## 1. 개요

VanillaMeta의 쿼리 결과 캐싱 시스템 구현 상태 및 개선 사항을 문서화합니다.

### 현재 구현 상태

- **Hybrid Cache System**: L1(메모리) + L2(Redis) 2계층 캐싱
- **Query Cache Service**: 메모리 기반 LRU 캐시
- **Redis Cache Service**: Redis 기반 분산 캐시
- **Dataset Service**: 캐시 통합 쿼리 실행

## 2. 구현된 기능

### 2.1 하이브리드 캐싱 아키텍처

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │ ──▶ │ Dataset API  │ ──▶ │ Hybrid Cache│
└─────────────┘     └──────────────┘     └─────────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                    ▼                         ▼
                            ┌─────────────┐           ┌─────────────┐
                            │  L1 Cache   │           │  L2 Cache   │
                            │  (Memory)   │           │   (Redis)   │
                            └─────────────┘           └─────────────┘
```

### 2.2 캐시 키 생성 전략

```typescript
// L1 캐시 키 (메모리)
const l1Key = this.generateCacheKey(engine, query, parameters);
// 예: "mysql:SELECT * FROM users WHERE id = ?:[1]"

// L2 캐시 키 (Redis)
const l2Key = `query:${engine}:${databaseId}:${queryHash}`;
// 예: "query:mysql:1:a3f5b2c1d4e5f6"
```

### 2.3 캐시 히트/미스 플로우

```typescript
async executeCachedQuery(datasetId: number) {
  // 1. L1 캐시 확인
  const l1Result = await hybridCache.get(engine, dbId, query);
  if (l1Result) return { data: l1Result, cache: { hit: true, source: 'l1' } };
  
  // 2. L2 캐시 확인
  const l2Result = await redisCache.get(engine, dbId, query);
  if (l2Result) {
    // L1으로 프로모션
    await l1Cache.set(engine, query, l2Result);
    return { data: l2Result, cache: { hit: true, source: 'l2' } };
  }
  
  // 3. DB 쿼리 실행
  const dbResult = await connection.executeQuery(query);
  
  // 4. 두 캐시에 저장
  await Promise.all([
    l1Cache.set(engine, query, dbResult),
    l2Cache.set(engine, dbId, query, dbResult)
  ]);
  
  return { data: dbResult, cache: { hit: false, source: 'database' } };
}
```

## 3. API 엔드포인트

### 3.1 캐시된 쿼리 실행

```http
GET /api/dataset/:id/cached?forceRefresh=false&ttl=3600
```

**응답 예시:**
```json
{
  "status": "SUCCESS",
  "data": [...],
  "fields": [...],
  "cache": {
    "hit": true,
    "source": "l1",
    "responseTime": 15
  }
}
```

### 3.2 캐시 무효화

```http
DELETE /api/dataset/:id/cache
```

### 3.3 캐시 통계 조회

```http
GET /api/dataset/:id/cache/stats
```

## 4. 캐시 성능 최적화

### 4.1 메모리 캐시 (L1) 최적화

```typescript
// QueryCacheService 설정
export class QueryCacheService {
  private readonly caches = new Map<string, LRUCache<string, CacheEntry>>();
  
  constructor() {
    // 엔진별 캐시 설정
    this.initializeCache('mysql', {
      max: 1000,              // 최대 1000개 항목
      maxSize: 100 * 1024 * 1024, // 100MB
      ttl: 5 * 60 * 1000,    // 5분 TTL
      updateAgeOnGet: true,  // 접근 시 TTL 갱신
    });
  }
}
```

### 4.2 Redis 캐시 (L2) 최적화

```typescript
// RedisCacheService 설정
private readonly DEFAULT_TTL = 3600; // 1시간
private readonly MAX_KEY_LENGTH = 1024;
private readonly COMPRESSION_THRESHOLD = 1024; // 1KB 이상 압축

async set(
  engine: string,
  databaseId: string,
  query: string,
  data: any,
  fields: any[],
  parameters?: any[],
  ttl?: number,
): Promise<void> {
  const key = this.generateCacheKey(engine, databaseId, query, parameters);
  const value = { data, fields, timestamp: Date.now() };
  
  // 대용량 데이터 압축
  const serialized = JSON.stringify(value);
  const compressed = serialized.length > this.COMPRESSION_THRESHOLD
    ? await this.compress(serialized)
    : serialized;
    
  await this.redis.setex(key, ttl || this.DEFAULT_TTL, compressed);
}
```

## 5. 캐시 무효화 전략

### 5.1 즉시 무효화

```typescript
// 데이터셋 업데이트 시
async update(id: number, updateDto: UpdateDatasetDto) {
  const result = await this.datasetRepository.save(updateDto);
  
  // 캐시 무효화
  await this.invalidateDatasetCache(id);
  
  return result;
}
```

### 5.2 패턴 기반 무효화

```typescript
// 데이터베이스별 모든 캐시 무효화
async invalidateDatabaseCache(databaseId: number) {
  const pattern = `query:*:${databaseId}:*`;
  const keys = await this.redis.keys(pattern);
  
  if (keys.length > 0) {
    await this.redis.del(...keys);
  }
}
```

## 6. 모니터링 및 메트릭

### 6.1 캐시 통계 수집

```typescript
interface CacheStats {
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  totalSize: number;
  entryCount: number;
  memoryUsage: number;
  evictionCount: number;
  averageGetTime: number;
  averageSetTime: number;
}
```

### 6.2 하이브리드 캐시 메트릭

```typescript
interface HybridCacheStats {
  engine: string;
  l1Cache: CacheStats;
  l2Cache: RedisCacheStats;
  hybridMetrics: {
    l1HitRate: number;
    l2HitRate: number;
    overallHitRate: number;
    l1Size: number;
    l2Size: number;
    promotionCount: number;  // L2 → L1 승격 횟수
    demotionCount: number;   // L1 → L2 강등 횟수
  };
}
```

## 7. 구현 개선 사항

### 7.1 쿼리 파라미터 지원 개선

```typescript
// 현재: 파라미터가 캐시 키에 포함되지만 완전히 활용되지 않음
// 개선안: 파라미터별 개별 캐싱
async executeCachedQuery(
  datasetId: number,
  parameters?: Record<string, any>
) {
  // 파라미터 정규화
  const normalizedParams = this.normalizeParameters(parameters);
  
  // 파라미터 포함 캐시 키 생성
  const cacheKey = this.generateParameterizedCacheKey(
    datasetId,
    normalizedParams
  );
  
  return this.hybridCache.get(engine, dbId, query, normalizedParams);
}
```

### 7.2 캐시 워밍업 스케줄러

```typescript
@Injectable()
export class CacheWarmupScheduler {
  constructor(
    private readonly datasetService: DatasetService,
    private readonly dashboardService: DashboardService,
  ) {}

  // 매일 새벽 3시 인기 데이터셋 캐시 워밍
  @Cron('0 3 * * *')
  async warmupPopularDatasets() {
    // 최근 7일간 가장 많이 사용된 데이터셋 조회
    const popularDatasets = await this.getPopularDatasets(7, 50);
    
    // 병렬로 캐시 워밍
    await Promise.allSettled(
      popularDatasets.map(dataset =>
        this.datasetService.executeCachedQuery(dataset.id, {
          forceRefresh: true
        })
      )
    );
  }

  // 매시간 실시간 대시보드 데이터 갱신
  @Cron('0 * * * *')
  async refreshRealtimeDashboards() {
    const realtimeDashboards = await this.dashboardService.findRealtime();
    
    for (const dashboard of realtimeDashboards) {
      const widgetDatasets = await this.getWidgetDatasets(dashboard.id);
      
      await Promise.allSettled(
        widgetDatasets.map(datasetId =>
          this.datasetService.executeCachedQuery(datasetId, {
            forceRefresh: true,
            customTtl: 300 // 5분 TTL
          })
        )
      );
    }
  }
}
```

### 7.3 캐시 압축 개선

```typescript
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class CompressionService {
  async compressData(data: any): Promise<Buffer> {
    const json = JSON.stringify(data);
    
    // 1KB 이상만 압축
    if (json.length < 1024) {
      return Buffer.from(json);
    }
    
    const compressed = await gzip(json);
    
    // 압축률이 10% 미만이면 원본 사용
    if (compressed.length > json.length * 0.9) {
      return Buffer.from(json);
    }
    
    return compressed;
  }
  
  async decompressData(buffer: Buffer): Promise<any> {
    // gzip 매직 넘버 확인
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      const decompressed = await gunzip(buffer);
      return JSON.parse(decompressed.toString());
    }
    
    return JSON.parse(buffer.toString());
  }
}
```

### 7.4 캐시 분할 (Sharding)

```typescript
class ShardedCacheService {
  private readonly shards: Map<number, Redis>;
  private readonly shardCount = 4;
  
  private getShardKey(key: string): number {
    // 일관된 해싱을 사용한 샤드 선택
    const hash = crypto.createHash('md5').update(key).digest();
    return hash.readUInt32BE(0) % this.shardCount;
  }
  
  async get(key: string): Promise<any> {
    const shardId = this.getShardKey(key);
    const shard = this.shards.get(shardId);
    
    return shard.get(key);
  }
  
  async set(key: string, value: any, ttl: number): Promise<void> {
    const shardId = this.getShardKey(key);
    const shard = this.shards.get(shardId);
    
    await shard.setex(key, ttl, value);
  }
}
```

## 8. 성능 벤치마크

### 8.1 현재 성능

| 작업 | L1 히트 | L2 히트 | DB 쿼리 |
|------|---------|---------|---------|
| 응답 시간 | 5-15ms | 20-50ms | 200-500ms |
| 처리량 | 10,000 req/s | 5,000 req/s | 100 req/s |

### 8.2 예상 개선 효과

- **캐시 히트율**: 85% → 95% (워밍업 추가)
- **평균 응답 시간**: 150ms → 50ms
- **DB 부하 감소**: 80% → 95%

## 9. 에러 처리 및 복구

### 9.1 캐시 실패 시 폴백

```typescript
async executeCachedQuery(id: number, options?: CacheOptions) {
  try {
    // 캐시 시도
    const cached = await this.hybridCache.get(...);
    if (cached) return cached;
  } catch (cacheError) {
    this.logger.warn('Cache error, falling back to DB', cacheError);
  }
  
  // DB 직접 쿼리
  const result = await this.executeDirectQuery(id);
  
  // 비동기로 캐시 복구 시도
  this.recoverCache(id, result).catch(err => 
    this.logger.error('Cache recovery failed', err)
  );
  
  return result;
}
```

### 9.2 Redis 연결 복구

```typescript
class RedisCacheService {
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  
  private setupRedisEvents() {
    this.redis.on('error', (err) => {
      this.logger.error('Redis error:', err);
      this.handleConnectionError();
    });
    
    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
      this.reconnectAttempts = 0;
    });
  }
  
  private async handleConnectionError() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      // L1 캐시만으로 동작
      this.isConnected = false;
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    setTimeout(() => {
      this.logger.log(`Reconnection attempt ${this.reconnectAttempts}`);
      this.redis.connect();
    }, delay);
  }
}
```

## 10. 향후 개선 계획

### 10.1 단기 (1개월)
- [ ] 쿼리 파라미터 기반 캐싱 완전 구현
- [ ] 캐시 워밍업 스케줄러 배포
- [ ] 압축 알고리즘 최적화

### 10.2 중기 (3개월)
- [ ] 캐시 샤딩 구현
- [ ] 실시간 캐시 분석 대시보드
- [ ] 예측 기반 캐시 프리페칭

### 10.3 장기 (6개월)
- [ ] 분산 캐시 클러스터 구축
- [ ] 머신러닝 기반 TTL 최적화
- [ ] 멀티 리전 캐시 동기화

---

**작성일**: 2025-01-21  
**작성자**: VanillaMeta Backend Team  
**버전**: 1.0.0