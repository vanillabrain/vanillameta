# VanillaMeta Redis 캐싱 전략 설계

## 1. 개요

VanillaMeta의 성능 향상을 위한 Redis 기반 캐싱 전략 설계 문서입니다.

### 주요 목표

- **응답 시간 단축**: API 응답 시간 70% 감소 (현재 평균 500ms → 150ms)
- **데이터베이스 부하 감소**: DB 쿼리 횟수 80% 감소
- **사용자 경험 개선**: 대시보드 로딩 시간 최소화
- **비용 효율성**: 데이터베이스 연산 비용 절감

## 2. 캐싱 아키텍처

### 전체 구조

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Client    │ ───▶ │   Backend   │ ───▶ │    Redis    │
│  (React)    │      │  (NestJS)   │      │   Cluster   │
└─────────────┘      └─────────────┘      └─────────────┘
                            │                      │
                            ▼                      ▼
                     ┌─────────────┐      ┌─────────────┐
                     │   Database  │      │  Monitoring │
                     │   (MySQL)   │      │ (CloudWatch)│
                     └─────────────┘      └─────────────┘
```

### Redis 클러스터 구성

- **환경별 구성**:
  - 개발: Redis 단일 인스턴스 (로컬)
  - 스테이징: Redis 단일 인스턴스 (AWS ElastiCache)
  - 프로덕션: Redis 클러스터 (3 마스터, 3 슬레이브)

- **메모리 할당**:
  - 개발: 1GB
  - 스테이징: 4GB
  - 프로덕션: 16GB (확장 가능)

## 3. 캐싱 대상 및 전략

### 3.1 쿼리 결과 캐싱

#### 대상
- 데이터셋 쿼리 결과
- 복잡한 집계 쿼리
- 자주 사용되는 필터 조합

#### 캐시 키 패턴
```typescript
// 데이터셋 쿼리 결과
`dataset:${datasetId}:query:${queryHash}:filters:${filterHash}`

// 집계 쿼리
`aggregate:${dashboardId}:${widgetId}:${aggregationType}:${dateRange}`

// 사용자별 데이터
`user:${userId}:dataset:${datasetId}:${queryHash}`
```

#### TTL 전략
```typescript
const TTL_CONFIG = {
  DATASET_QUERY: 3600,        // 1시간
  AGGREGATE_QUERY: 1800,      // 30분
  USER_SPECIFIC: 900,         // 15분
  REAL_TIME_DATA: 60,         // 1분
  STATIC_DATA: 86400,         // 24시간
};
```

### 3.2 대시보드 데이터 캐싱

#### 대상
- 대시보드 메타데이터
- 위젯 구성 정보
- 레이아웃 데이터
- 공유 URL 데이터

#### 캐시 키 패턴
```typescript
// 대시보드 메타데이터
`dashboard:${dashboardId}:metadata`

// 위젯 데이터
`dashboard:${dashboardId}:widget:${widgetId}`

// 공유 대시보드
`share:${shareId}:dashboard`

// 사용자 대시보드 목록
`user:${userId}:dashboards:list:${page}:${limit}`
```

#### 캐싱 로직
```typescript
@Injectable()
export class DashboardCacheService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly dashboardService: DashboardService,
  ) {}

  async getDashboard(dashboardId: number): Promise<Dashboard> {
    const cacheKey = `dashboard:${dashboardId}:metadata`;
    
    // 캐시 확인
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // DB에서 조회
    const dashboard = await this.dashboardService.findOne(dashboardId);
    
    // 캐시 저장
    await this.redis.setex(
      cacheKey,
      TTL_CONFIG.DASHBOARD_METADATA,
      JSON.stringify(dashboard),
    );
    
    return dashboard;
  }
}
```

### 3.3 사용자 세션 캐싱

#### 대상
- JWT 토큰 블랙리스트
- 사용자 권한 정보
- 활성 세션 정보

#### 캐시 키 패턴
```typescript
// JWT 블랙리스트
`jwt:blacklist:${jti}`

// 사용자 권한
`user:${userId}:permissions`

// 활성 세션
`session:${sessionId}`
```

## 4. 캐시 무효화 전략

### 4.1 즉시 무효화 (Immediate Invalidation)

```typescript
@Injectable()
export class CacheInvalidationService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  // 대시보드 업데이트 시
  async invalidateDashboard(dashboardId: number): Promise<void> {
    const pattern = `dashboard:${dashboardId}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    
    // 관련 사용자 캐시도 무효화
    await this.invalidateUserDashboardLists(dashboardId);
  }

  // 데이터셋 업데이트 시
  async invalidateDataset(datasetId: number): Promise<void> {
    const patterns = [
      `dataset:${datasetId}:*`,
      `*:dataset:${datasetId}:*`,
    ];
    
    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}
```

### 4.2 지연 무효화 (Lazy Invalidation)

```typescript
// 버전 기반 캐시 무효화
interface VersionedCache<T> {
  data: T;
  version: number;
  timestamp: number;
}

async getVersionedData<T>(
  key: string,
  version: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await this.redis.get(key);
  
  if (cached) {
    const versionedCache: VersionedCache<T> = JSON.parse(cached);
    
    // 버전이 일치하면 캐시 반환
    if (versionedCache.version === version) {
      return versionedCache.data;
    }
  }
  
  // 새 데이터 조회 및 캐싱
  const data = await fetcher();
  const versionedData: VersionedCache<T> = {
    data,
    version,
    timestamp: Date.now(),
  };
  
  await this.redis.setex(
    key,
    TTL_CONFIG.DEFAULT,
    JSON.stringify(versionedData),
  );
  
  return data;
}
```

### 4.3 이벤트 기반 무효화

```typescript
@Injectable()
export class CacheEventHandler {
  constructor(
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('dashboard.updated')
  async handleDashboardUpdate(payload: DashboardUpdateEvent) {
    await this.cacheInvalidation.invalidateDashboard(payload.dashboardId);
  }

  @OnEvent('dataset.updated')
  async handleDatasetUpdate(payload: DatasetUpdateEvent) {
    await this.cacheInvalidation.invalidateDataset(payload.datasetId);
  }

  @OnEvent('widget.updated')
  async handleWidgetUpdate(payload: WidgetUpdateEvent) {
    await this.cacheInvalidation.invalidateWidget(
      payload.dashboardId,
      payload.widgetId,
    );
  }
}
```

## 5. 캐시 워밍 (Cache Warming)

### 5.1 시작 시 캐시 워밍

```typescript
@Injectable()
export class CacheWarmingService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly dashboardService: DashboardService,
  ) {}

  async warmupPopularDashboards(): Promise<void> {
    // 인기 대시보드 조회
    const popularDashboards = await this.dashboardService.findPopular({
      limit: 20,
      days: 7,
    });
    
    // 병렬로 캐시 워밍
    await Promise.all(
      popularDashboards.map(dashboard =>
        this.warmupDashboard(dashboard.id),
      ),
    );
  }

  private async warmupDashboard(dashboardId: number): Promise<void> {
    // 대시보드 메타데이터 캐싱
    const dashboard = await this.dashboardService.findOne(dashboardId);
    await this.redis.setex(
      `dashboard:${dashboardId}:metadata`,
      TTL_CONFIG.DASHBOARD_METADATA,
      JSON.stringify(dashboard),
    );
    
    // 위젯 데이터 캐싱
    for (const widget of dashboard.widgets) {
      await this.warmupWidget(dashboardId, widget.id);
    }
  }
}
```

### 5.2 스케줄 기반 캐시 갱신

```typescript
@Injectable()
export class CacheRefreshScheduler {
  private readonly logger = new Logger(CacheRefreshScheduler.name);

  constructor(
    private readonly cacheWarmingService: CacheWarmingService,
  ) {}

  // 매일 새벽 3시에 인기 대시보드 캐시 갱신
  @Cron('0 3 * * *')
  async refreshPopularDashboards() {
    this.logger.log('Starting cache refresh for popular dashboards');
    await this.cacheWarmingService.warmupPopularDashboards();
    this.logger.log('Cache refresh completed');
  }

  // 매시간 자주 사용되는 데이터셋 캐시 갱신
  @Cron('0 * * * *')
  async refreshFrequentDatasets() {
    this.logger.log('Starting cache refresh for frequent datasets');
    await this.cacheWarmingService.warmupFrequentDatasets();
    this.logger.log('Dataset cache refresh completed');
  }
}
```

## 6. 캐시 모니터링 및 메트릭

### 6.1 주요 모니터링 지표

```typescript
interface CacheMetrics {
  hitRate: number;           // 캐시 히트율
  missRate: number;          // 캐시 미스율
  evictionRate: number;      // 캐시 제거율
  memoryUsage: number;       // 메모리 사용률
  keyCount: number;          // 전체 키 개수
  avgResponseTime: number;   // 평균 응답 시간
  errorRate: number;         // 에러율
}
```

### 6.2 메트릭 수집 구현

```typescript
@Injectable()
export class CacheMetricsService {
  private metrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    responseTimes: [],
  };

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly cloudWatch: CloudWatchService,
  ) {}

  async recordCacheHit(key: string, responseTime: number): Promise<void> {
    this.metrics.hits++;
    this.metrics.responseTimes.push(responseTime);
    
    // CloudWatch로 메트릭 전송
    await this.cloudWatch.putMetric({
      Namespace: 'VanillaMeta/Cache',
      MetricData: [
        {
          MetricName: 'CacheHit',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'CacheKey', Value: this.getCacheKeyPrefix(key) },
          ],
        },
        {
          MetricName: 'ResponseTime',
          Value: responseTime,
          Unit: 'Milliseconds',
        },
      ],
    });
  }

  async getMetrics(): Promise<CacheMetrics> {
    const info = await this.redis.info('stats');
    const memoryInfo = await this.redis.info('memory');
    
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? this.metrics.hits / total : 0;
    
    return {
      hitRate: hitRate * 100,
      missRate: (1 - hitRate) * 100,
      evictionRate: this.parseEvictionRate(info),
      memoryUsage: this.parseMemoryUsage(memoryInfo),
      keyCount: await this.redis.dbsize(),
      avgResponseTime: this.calculateAvgResponseTime(),
      errorRate: this.metrics.errors / total * 100,
    };
  }
}
```

### 6.3 모니터링 대시보드 구성

```yaml
# CloudWatch 대시보드 위젯
widgets:
  - type: line
    title: "Cache Hit Rate"
    metrics:
      - namespace: VanillaMeta/Cache
        name: CacheHitRate
        stat: Average
        period: 300

  - type: number
    title: "Current Memory Usage"
    metrics:
      - namespace: VanillaMeta/Cache
        name: MemoryUsage
        stat: Latest

  - type: line
    title: "Response Time"
    metrics:
      - namespace: VanillaMeta/Cache
        name: ResponseTime
        stat: Average
        period: 60

  - type: line
    title: "Cache Operations"
    metrics:
      - namespace: VanillaMeta/Cache
        name: CacheHit
        stat: Sum
        period: 300
      - namespace: VanillaMeta/Cache
        name: CacheMiss
        stat: Sum
        period: 300
```

## 7. 성능 최적화 전략

### 7.1 파이프라이닝

```typescript
async batchGet(keys: string[]): Promise<any[]> {
  const pipeline = this.redis.pipeline();
  
  keys.forEach(key => {
    pipeline.get(key);
  });
  
  const results = await pipeline.exec();
  return results.map(([err, result]) => {
    if (err) throw err;
    return result ? JSON.parse(result) : null;
  });
}
```

### 7.2 압축

```typescript
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

async setCacheWithCompression(
  key: string,
  data: any,
  ttl: number,
): Promise<void> {
  const json = JSON.stringify(data);
  
  // 1KB 이상의 데이터는 압축
  if (json.length > 1024) {
    const compressed = await gzip(json);
    await this.redis.setex(
      `${key}:gz`,
      ttl,
      compressed.toString('base64'),
    );
  } else {
    await this.redis.setex(key, ttl, json);
  }
}
```

### 7.3 연결 풀 최적화

```typescript
// Redis 연결 설정
const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  
  // 연결 풀 설정
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  
  // 성능 최적화
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  
  // 재연결 전략
  retryStrategy: (times: number) => {
    if (times > 3) {
      return null; // 재연결 중지
    }
    return Math.min(times * 100, 3000);
  },
};
```

## 8. 장애 대응 전략

### 8.1 Circuit Breaker 패턴

```typescript
@Injectable()
export class RedisCacheService {
  private circuitBreaker: CircuitBreaker;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.circuitBreaker = new CircuitBreaker(
      this.getCacheData.bind(this),
      {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      },
    );
    
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened - Redis unavailable');
    });
  }

  async get(key: string): Promise<any> {
    try {
      return await this.circuitBreaker.fire(key);
    } catch (error) {
      // 캐시 실패 시 null 반환 (DB로 폴백)
      this.logger.error(`Cache get failed: ${error.message}`);
      return null;
    }
  }
}
```

### 8.2 Fallback 메커니즘

```typescript
async getWithFallback<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number; fallbackToDb?: boolean },
): Promise<T> {
  try {
    // 1차: Redis 캐시 확인
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    this.logger.warn(`Redis error: ${error.message}`);
  }

  // 2차: 로컬 메모리 캐시 확인
  const localCached = this.localCache.get(key);
  if (localCached) {
    return localCached;
  }

  // 3차: DB에서 조회
  const data = await fetcher();
  
  // 비동기로 캐시 저장 (실패해도 무시)
  this.setCacheAsync(key, data, options?.ttl);
  
  return data;
}
```

## 9. 보안 고려사항

### 9.1 데이터 암호화

```typescript
import * as crypto from 'crypto';

class SecureCacheService {
  private algorithm = 'aes-256-gcm';
  private key = Buffer.from(process.env.CACHE_ENCRYPTION_KEY, 'hex');

  async setSecure(key: string, data: any, ttl: number): Promise<void> {
    const json = JSON.stringify(data);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    const combined = JSON.stringify({
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    });
    
    await this.redis.setex(key, ttl, combined);
  }
}
```

### 9.2 접근 제어

```typescript
// 사용자별 캐시 키 네임스페이스
function getUserCacheKey(userId: number, resource: string): string {
  return `user:${userId}:${resource}`;
}

// 권한 검증 데코레이터
export function CacheAuth(permission: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const userId = args[0];
      const hasPermission = await checkUserPermission(userId, permission);
      
      if (!hasPermission) {
        throw new ForbiddenException('Cache access denied');
      }
      
      return method.apply(this, args);
    };
  };
}
```

## 10. 구현 로드맵

### Phase 1: 기본 캐싱 (1주)
- [ ] Redis 인프라 설정
- [ ] 기본 캐싱 서비스 구현
- [ ] 대시보드 메타데이터 캐싱

### Phase 2: 쿼리 캐싱 (2주)
- [ ] 쿼리 결과 캐싱 구현
- [ ] 캐시 무효화 로직
- [ ] 캐시 키 전략 구현

### Phase 3: 고급 기능 (2주)
- [ ] 캐시 워밍 구현
- [ ] 모니터링 대시보드
- [ ] 성능 최적화

### Phase 4: 운영 준비 (1주)
- [ ] 장애 대응 메커니즘
- [ ] 보안 강화
- [ ] 문서화 및 교육

## 11. 예상 성과

### 성능 개선
- API 응답 시간: 500ms → 150ms (70% 개선)
- 대시보드 로딩: 3초 → 0.8초 (73% 개선)
- 동시 사용자 처리: 1,000 → 5,000 (5배 증가)

### 비용 절감
- DB 읽기 연산: 80% 감소
- 월간 DB 비용: $2,000 → $800 (60% 절감)
- Lambda 실행 시간: 50% 감소

### 사용자 경험
- 페이지 전환 시간 단축
- 실시간 데이터 업데이트
- 안정적인 서비스 제공

---

**작성일**: 2025-01-21  
**작성자**: VanillaMeta Backend Team  
**버전**: 1.0.0