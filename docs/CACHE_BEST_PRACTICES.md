# VanillaMeta 캐시 최적화 가이드 및 모범 사례

## 목차
1. [개요](#개요)
2. [캐시 아키텍처 이해](#캐시-아키텍처-이해)
3. [TTL 전략](#ttl-전략)
4. [캐시 키 설계](#캐시-키-설계)
5. [캐시 워밍업](#캐시-워밍업)
6. [모니터링 및 알림](#모니터링-및-알림)
7. [성능 최적화 팁](#성능-최적화-팁)
8. [문제 해결 가이드](#문제-해결-가이드)

## 개요

VanillaMeta의 캐싱 시스템은 L1(메모리)과 L2(Redis)의 하이브리드 구조로 설계되어 있습니다. 이 가이드는 캐시를 효과적으로 활용하여 애플리케이션 성능을 최적화하는 방법을 제공합니다.

## 캐시 아키텍처 이해

### 하이브리드 캐시 구조

```
요청 → L1 캐시 (메모리) → L2 캐시 (Redis) → 데이터베이스
         ↓ Hit              ↓ Hit              ↓ Miss
         응답               응답               쿼리 실행 → 캐시 저장 → 응답
```

### 각 레벨의 특징

| 특성 | L1 캐시 (메모리) | L2 캐시 (Redis) |
|------|-----------------|----------------|
| 속도 | 매우 빠름 (< 1ms) | 빠름 (1-10ms) |
| 용량 | 제한적 (100-1000 항목) | 대용량 (수만 항목) |
| 지속성 | 휘발성 | 영구 저장 가능 |
| 공유 | 프로세스별 독립 | 전체 시스템 공유 |

## TTL 전략

### 데이터 유형별 권장 TTL

```typescript
// 1. 자주 변경되지 않는 메타데이터
const METADATA_TTL = 3600; // 1시간

// 2. 실시간 대시보드 데이터
const REALTIME_TTL = 300; // 5분

// 3. 사용자별 데이터
const USER_DATA_TTL = 900; // 15분

// 4. 정적 리소스
const STATIC_RESOURCE_TTL = 86400; // 24시간
```

### 동적 TTL 설정

```typescript
// 사용 빈도에 따른 동적 TTL
function calculateDynamicTTL(hitRate: number): number {
  if (hitRate > 0.8) return 3600;      // 높은 히트율: 1시간
  if (hitRate > 0.5) return 1800;      // 중간 히트율: 30분
  return 600;                           // 낮은 히트율: 10분
}

// 시간대별 TTL 조정
function getTimeBasedTTL(baseTime: number): number {
  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 18) {       // 업무 시간
    return baseTime * 0.5;              // TTL 50% 감소
  }
  return baseTime;                      // 기본 TTL
}
```

## 캐시 키 설계

### 키 명명 규칙

```typescript
// 패턴: {엔진}:{엔티티}:{식별자}:{버전}
const cacheKey = `dashboard:widget:${widgetId}:v1`;

// 계층적 키 구조
const keys = {
  dashboard: `dashboard:${dashboardId}`,
  widgets: `dashboard_widgets:${dashboardId}`,
  userList: `user_dashboards:${userId}`,
  dataset: `dataset:${datasetId}:${queryHash}`,
};
```

### 버전 관리

```typescript
// 스키마 변경 시 버전 업데이트
const CACHE_VERSION = 'v2';

function generateVersionedKey(baseKey: string): string {
  return `${baseKey}:${CACHE_VERSION}`;
}
```

## 캐시 워밍업

### 스케줄 기반 워밍업

```typescript
// 1. 인기 데이터셋 워밍업 (매일 새벽 3시)
@Cron('0 3 * * *')
async warmupPopularDatasets() {
  const datasets = await this.getPopularDatasets(7, 50);
  for (const dataset of datasets) {
    await this.datasetService.executeCachedQuery(dataset.id, {
      forceRefresh: true,
      customTtl: 7200,
    });
  }
}

// 2. 실시간 대시보드 갱신 (매시간)
@Cron(CronExpression.EVERY_HOUR)
async refreshRealtimeDashboards() {
  const dashboards = await this.getRealtimeDashboards();
  await this.warmupDashboards(dashboards);
}
```

### 수동 워밍업 API

```bash
# 특정 대시보드 워밍업
POST /api/v1/cache/warmup/dashboard/123

# 인기 데이터셋 워밍업
POST /api/v1/cache/warmup/popular
```

## 모니터링 및 알림

### 주요 모니터링 지표

1. **히트율 (Hit Rate)**
   - 목표: > 70%
   - 경고: < 50%
   - 계산: `hits / (hits + misses)`

2. **응답 시간**
   - L1 목표: < 1ms
   - L2 목표: < 10ms
   - 전체 목표: < 50ms

3. **메모리 사용률**
   - 경고: > 80%
   - 위험: > 90%

### 모니터링 API 활용

```bash
# 현재 캐시 상태 확인
GET /api/v1/cache/monitoring/summary

# 성능 리포트 생성
GET /api/v1/cache/monitoring/report?duration=86400000

# 실시간 메트릭 조회
GET /api/v1/cache/monitoring/metrics/current?engine=dashboard
```

### 알림 규칙 설정

```typescript
const alertRules = [
  {
    name: '낮은 캐시 히트율',
    condition: { metric: 'hitRate', operator: 'lt', threshold: 0.7 },
    severity: 'warning',
    channels: ['log', 'slack'],
  },
  {
    name: 'Redis 연결 끊김',
    condition: { metric: 'connectionStatus', operator: 'eq', threshold: 0 },
    severity: 'critical',
    channels: ['log', 'email', 'slack'],
  },
];
```

## 성능 최적화 팁

### 1. 배치 처리

```typescript
// 나쁜 예: 개별 쿼리
for (const id of datasetIds) {
  await this.cacheService.get(id);
}

// 좋은 예: 배치 쿼리
const results = await this.cacheService.mget(datasetIds);
```

### 2. 압축 활용

```typescript
// 큰 데이터는 자동 압축
const cacheOptions = {
  compress: true,           // 자동 압축 활성화
  compressionThreshold: 1024, // 1KB 이상만 압축
};
```

### 3. 캐시 무효화 최적화

```typescript
// 캐스케이드 무효화 신중히 사용
await this.cacheInvalidationService.invalidateDataset(datasetId, {
  immediate: true,
  cascade: false,    // 필요한 경우만 true
  async: true,       // 대량 무효화는 비동기로
});
```

### 4. 연결 풀 관리

```yaml
# Redis 연결 설정
redis:
  maxRetriesPerRequest: 3
  enableReadyCheck: true
  connectTimeout: 10000
  commandTimeout: 5000
  keepAlive: 30000
```

## 문제 해결 가이드

### 낮은 히트율 문제

1. **원인 분석**
   ```bash
   # 캐시 통계 확인
   GET /api/v1/cache/monitoring/metrics/history/dashboard?duration=86400000
   ```

2. **해결 방법**
   - TTL 조정: 자주 사용되는 데이터의 TTL 증가
   - 캐시 워밍업: 인기 데이터 사전 로드
   - 키 패턴 검토: 캐시 키가 너무 세분화되어 있는지 확인

### Redis 연결 문제

1. **진단**
   ```bash
   # Redis 연결 상태 확인
   redis-cli ping
   
   # Redis 메모리 사용량 확인
   redis-cli info memory
   ```

2. **해결 방법**
   - 연결 타임아웃 증가
   - Redis 메모리 정리 (`redis-cli FLUSHDB`)
   - 연결 풀 크기 조정

### 메모리 부족 문제

1. **L1 캐시 최적화**
   ```typescript
   // LRU 정책으로 오래된 항목 자동 제거
   const l1Config = {
     maxSize: 1000,
     sizeCalculation: 'itemCount',
     ttl: 600000, // 10분
   };
   ```

2. **L2 캐시 최적화**
   ```bash
   # Redis 메모리 정책 설정
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

### 성능 저하 문제

1. **병목 지점 파악**
   ```typescript
   // 성능 프로파일링
   const start = Date.now();
   const result = await this.cacheService.get(key);
   const duration = Date.now() - start;
   
   if (duration > 100) {
     this.logger.warn(`Slow cache access: ${duration}ms`);
   }
   ```

2. **최적화 전략**
   - 압축 사용으로 네트워크 대역폭 절약
   - 파이프라이닝으로 Redis 명령 배치 처리
   - 불필요한 캐시 무효화 줄이기

## 모범 사례 체크리스트

- [ ] 적절한 TTL 설정 (데이터 유형별로 다르게)
- [ ] 일관된 캐시 키 명명 규칙 사용
- [ ] 캐시 워밍업 스케줄 구성
- [ ] 모니터링 대시보드 설정
- [ ] 알림 규칙 구성 (Slack, Email)
- [ ] 정기적인 성능 리포트 검토
- [ ] 캐시 무효화 전략 문서화
- [ ] 장애 대응 계획 수립
- [ ] 개발/스테이징 환경에서 캐시 설정 테스트
- [ ] 팀원 교육 및 문서 공유

## 추가 리소스

- [Redis 공식 문서](https://redis.io/documentation)
- [캐싱 전략 패턴](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/Strategies.html)
- [VanillaMeta 캐싱 아키텍처 문서](./REDIS_CACHING_STRATEGY.md)
- [쿼리 결과 캐싱 구현 가이드](./QUERY_RESULT_CACHING_IMPLEMENTATION.md)