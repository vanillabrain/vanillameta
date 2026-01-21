# M02 기술적 접근 방법

## 1. 성능 병목점 분석

### 1.1 현재 성능 병목점 식별

#### 백엔드 병목점
1. **Lambda 콜드 스타트 (현재 3-5초)**
   - 원인: 큰 번들 크기 (150MB+), 많은 의존성
   - 영향: 첫 요청 시 긴 대기 시간
   - 측정: X-Ray 트레이싱으로 초기화 시간 분석

2. **데이터베이스 쿼리 성능**
   - 원인: 인덱스 부재, N+1 쿼리, 대용량 조인
   - 영향: 위젯 데이터 로딩 지연
   - 측정: RDS Performance Insights

3. **API 응답 크기**
   - 원인: 압축 미사용, 과도한 데이터 전송
   - 영향: 네트워크 지연
   - 측정: CloudWatch 메트릭

#### 프론트엔드 병목점
1. **번들 크기 (현재 5MB+)**
   - 원인: ECharts 전체 임포트, 미사용 코드
   - 영향: 초기 로딩 시간 증가
   - 측정: Webpack Bundle Analyzer

2. **차트 렌더링 성능**
   - 원인: 동시 다중 차트 렌더링, 리렌더링
   - 영향: UI 응답성 저하
   - 측정: React DevTools Profiler

3. **메모리 누수**
   - 원인: 이벤트 리스너 미제거, 차트 인스턴스 누적
   - 영향: 장시간 사용 시 성능 저하
   - 측정: Chrome DevTools Memory Profiler

### 1.2 성능 측정 도구 설정

```typescript
// 성능 모니터링 설정
interface PerformanceMetrics {
  // 백엔드 메트릭
  lambdaDuration: number;
  coldStartDuration: number;
  dbQueryTime: number;
  apiResponseTime: number;
  
  // 프론트엔드 메트릭
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  tti: number; // Time to Interactive
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
}

// 커스텀 성능 모니터링 클래스
class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  
  startMeasure(name: string): void {
    performance.mark(`${name}-start`);
  }
  
  endMeasure(name: string): void {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
  }
  
  reportToAPM(metrics: PerformanceMetrics): void {
    // CloudWatch 또는 X-Ray로 전송
  }
}
```

## 2. 최적화 전략

### 2.1 Lambda 콜드 스타트 최적화

#### 번들 크기 최소화
```javascript
// webpack.config.js
module.exports = {
  optimization: {
    usedExports: true,
    sideEffects: false,
    minimize: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10
        }
      }
    }
  },
  externals: {
    // AWS SDK는 Lambda 런타임에 포함
    'aws-sdk': 'aws-sdk'
  }
};
```

#### Lambda 레이어 최적화
```yaml
# serverless.yml
layers:
  nodeModules:
    path: lambda-layer
    name: ${self:service}-${self:provider.stage}-node-modules
    description: Node modules layer
    compatibleRuntimes:
      - nodejs18.x
    retain: true

functions:
  api:
    handler: dist/serverless.handler
    layers:
      - {Ref: NodeModulesLambdaLayer}
    reservedConcurrencyLimit: 100
    provisionedConcurrencyConfig:
      provisioned: 10
```

#### 초기화 최적화
```typescript
// 지연 로딩으로 초기화 시간 단축
class LazyModuleLoader {
  private modules: Map<string, any> = new Map();
  
  async getModule(name: string): Promise<any> {
    if (!this.modules.has(name)) {
      const module = await import(name);
      this.modules.set(name, module);
    }
    return this.modules.get(name);
  }
}

// 전역 객체 재사용
let dbConnection: Connection;
let redisClient: RedisClient;

export const handler = async (event: APIGatewayEvent) => {
  // 연결 재사용
  if (!dbConnection) {
    dbConnection = await createConnection();
  }
  
  if (!redisClient) {
    redisClient = await createRedisClient();
  }
  
  // 요청 처리
};
```

### 2.2 데이터베이스 최적화

#### 쿼리 최적화
```typescript
// 쿼리 빌더 최적화
class OptimizedQueryBuilder {
  private queryCache: Map<string, string> = new Map();
  
  buildQuery(params: QueryParams): string {
    const cacheKey = this.getCacheKey(params);
    
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey)!;
    }
    
    // 쿼리 최적화 규칙 적용
    let query = this.baseQuery;
    
    // 1. 필요한 컬럼만 선택
    query = this.selectOnlyRequiredColumns(query, params);
    
    // 2. 인덱스 힌트 추가
    query = this.addIndexHints(query, params);
    
    // 3. 조인 순서 최적화
    query = this.optimizeJoinOrder(query, params);
    
    this.queryCache.set(cacheKey, query);
    return query;
  }
}
```

#### 캐싱 전략
```typescript
// 다층 캐싱 전략
class MultiLevelCache {
  private l1Cache: Map<string, any> = new Map(); // 메모리 캐시
  private l2Cache: RedisClient; // Redis 캐시
  private l3Cache: S3Client; // S3 캐시 (대용량 데이터)
  
  async get(key: string): Promise<any> {
    // L1 캐시 확인
    if (this.l1Cache.has(key)) {
      return this.l1Cache.get(key);
    }
    
    // L2 캐시 확인
    const redisValue = await this.l2Cache.get(key);
    if (redisValue) {
      this.l1Cache.set(key, redisValue);
      return redisValue;
    }
    
    // L3 캐시 확인
    const s3Value = await this.l3Cache.getObject(key);
    if (s3Value) {
      await this.l2Cache.set(key, s3Value, 3600);
      this.l1Cache.set(key, s3Value);
      return s3Value;
    }
    
    return null;
  }
}
```

#### 연결 풀 최적화
```typescript
// RDS Proxy 설정
const dbConfig = {
  host: process.env.RDS_PROXY_ENDPOINT,
  port: 3306,
  connectionLimit: 100,
  queueLimit: 0,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// 연결 재사용 전략
class ConnectionManager {
  private pools: Map<string, Pool> = new Map();
  
  async getConnection(tenantId: string): Promise<Connection> {
    if (!this.pools.has(tenantId)) {
      const pool = await this.createPool(tenantId);
      this.pools.set(tenantId, pool);
    }
    
    return this.pools.get(tenantId)!.getConnection();
  }
}
```

### 2.3 프론트엔드 최적화

#### 코드 스플리팅 전략
```typescript
// 라우트 기반 코드 스플리팅
const routes = [
  {
    path: '/dashboard',
    component: lazy(() => import('./pages/Dashboard'))
  },
  {
    path: '/widget',
    component: lazy(() => import('./pages/Widget'))
  },
  {
    path: '/data',
    component: lazy(() => import('./pages/Data'))
  }
];

// 차트 타입별 동적 임포트
const ChartLoader = {
  async load(type: string): Promise<any> {
    switch(type) {
      case 'line':
        return import('./charts/LineChart');
      case 'bar':
        return import('./charts/BarChart');
      case 'pie':
        return import('./charts/PieChart');
      // ... 50+ 차트 타입
    }
  }
};
```

#### 렌더링 최적화
```typescript
// React 18 Concurrent Features 활용
import { startTransition, useDeferredValue, useTransition } from 'react';

const DashboardGrid: React.FC = () => {
  const [isPending, startTransition] = useTransition();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  
  // 무거운 렌더링 작업을 낮은 우선순위로 처리
  const handleAddWidget = (widget: Widget) => {
    startTransition(() => {
      setWidgets([...widgets, widget]);
    });
  };
  
  // Virtual Scrolling으로 대량 위젯 처리
  return (
    <VirtualGrid
      items={widgets}
      renderItem={(widget) => (
        <WidgetContainer key={widget.id} widget={widget} />
      )}
      itemHeight={300}
      itemWidth={400}
    />
  );
};
```

#### 차트 렌더링 최적화
```typescript
// ECharts 인스턴스 풀링
class ChartInstancePool {
  private pool: EChartsInstance[] = [];
  private inUse: Set<EChartsInstance> = new Set();
  
  acquire(container: HTMLElement): EChartsInstance {
    let instance = this.pool.pop();
    
    if (!instance) {
      instance = echarts.init(container, null, {
        renderer: 'canvas', // SVG 대신 Canvas 사용
        useDirtyRect: true  // 부분 렌더링 활성화
      });
    }
    
    this.inUse.add(instance);
    return instance;
  }
  
  release(instance: EChartsInstance): void {
    instance.clear();
    this.inUse.delete(instance);
    this.pool.push(instance);
  }
}

// 차트 옵션 메모이제이션
const useChartOptions = (data: any[], type: string) => {
  return useMemo(() => {
    return generateChartOptions(data, type);
  }, [data, type]);
};
```

### 2.4 API 응답 최적화

#### 압축 및 스트리밍
```typescript
// 응답 압축 미들웨어
import compression from 'compression';

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // 압축 레벨 (1-9)
}));

// 대용량 데이터 스트리밍
@Get('dataset/:id/stream')
async streamDataset(@Param('id') id: string, @Res() res: Response) {
  const stream = this.datasetService.createReadStream(id);
  
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  stream.pipe(res);
}
```

#### GraphQL 도입 검토
```typescript
// GraphQL 스키마 정의
const typeDefs = gql`
  type Dashboard {
    id: ID!
    name: String!
    widgets: [Widget!]!
  }
  
  type Widget {
    id: ID!
    type: String!
    data: JSON
    # 필요한 필드만 요청 가능
  }
  
  type Query {
    dashboard(id: ID!): Dashboard
    dashboards(limit: Int, offset: Int): [Dashboard!]!
  }
`;

// DataLoader로 N+1 문제 해결
const widgetLoader = new DataLoader(async (widgetIds: string[]) => {
  const widgets = await Widget.findByIds(widgetIds);
  return widgetIds.map(id => widgets.find(w => w.id === id));
});
```

## 3. 아키텍처 개선 계획

### 3.1 마이크로서비스 전환 검토

```yaml
# 서비스 분리 계획
services:
  - name: auth-service
    runtime: nodejs18.x
    memory: 512MB
    
  - name: dashboard-service
    runtime: nodejs18.x
    memory: 1024MB
    
  - name: query-service
    runtime: nodejs18.x
    memory: 3008MB
    
  - name: chart-service
    runtime: nodejs18.x
    memory: 2048MB
```

### 3.2 이벤트 기반 아키텍처

```typescript
// EventBridge 통합
class EventBusService {
  private eventBridge: EventBridge;
  
  async publishEvent(event: DomainEvent): Promise<void> {
    await this.eventBridge.putEvents({
      Entries: [{
        Source: 'vanillameta.api',
        DetailType: event.type,
        Detail: JSON.stringify(event.payload),
        EventBusName: 'vanillameta-events'
      }]
    }).promise();
  }
}

// 비동기 처리 핸들러
export const asyncHandler = async (event: EventBridgeEvent) => {
  switch(event['detail-type']) {
    case 'DASHBOARD_CREATED':
      await generateThumbnail(event.detail);
      break;
    case 'QUERY_EXECUTED':
      await cacheQueryResult(event.detail);
      break;
  }
};
```

### 3.3 엣지 컴퓨팅 활용

```typescript
// CloudFront Functions로 요청 최적화
function handler(event) {
  const request = event.request;
  const headers = request.headers;
  
  // 1. 캐시 키 정규화
  const cacheKey = normalizeQueryString(request.querystring);
  
  // 2. 지역별 라우팅
  const region = headers['cloudfront-viewer-country'];
  if (region) {
    request.uri = `/${region}${request.uri}`;
  }
  
  // 3. WebP 지원 확인
  if (headers.accept && headers.accept.value.includes('webp')) {
    request.uri = request.uri.replace(/\.(jpg|png)$/, '.webp');
  }
  
  return request;
}
```

## 4. 측정 및 검증 방법

### 4.1 성능 테스트 자동화

```typescript
// K6 성능 테스트 스크립트
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // 100 사용자까지 증가
    { duration: '5m', target: 100 }, // 100 사용자 유지
    { duration: '2m', target: 500 }, // 500 사용자까지 증가
    { duration: '5m', target: 500 }, // 500 사용자 유지
    { duration: '2m', target: 1000 }, // 1000 사용자까지 증가
    { duration: '5m', target: 1000 }, // 1000 사용자 유지
    { duration: '5m', target: 0 }, // 0으로 감소
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%가 500ms 이하
    http_req_failed: ['rate<0.1'], // 에러율 10% 미만
  },
};

export default function() {
  // 시나리오 1: 대시보드 목록 조회
  const dashboardList = http.get(`${BASE_URL}/api/v1/dashboards`);
  check(dashboardList, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  sleep(1);
  
  // 시나리오 2: 위젯 데이터 조회
  const widgetData = http.get(`${BASE_URL}/api/v1/widgets/1/data`);
  check(widgetData, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### 4.2 실시간 모니터링 대시보드

```typescript
// CloudWatch 커스텀 메트릭
class MetricsCollector {
  async recordMetric(name: string, value: number, unit: string): Promise<void> {
    await cloudWatch.putMetricData({
      Namespace: 'VanillaMeta/Performance',
      MetricData: [{
        MetricName: name,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
        Dimensions: [
          { Name: 'Environment', Value: process.env.NODE_ENV },
          { Name: 'Service', Value: 'API' }
        ]
      }]
    }).promise();
  }
}

// 실시간 대시보드 설정
const dashboardConfig = {
  widgets: [
    {
      type: 'line',
      properties: {
        metrics: [
          ['VanillaMeta/Performance', 'APIResponseTime', { stat: 'Average' }],
          ['.', '.', { stat: 'p95' }],
          ['.', '.', { stat: 'p99' }]
        ],
        period: 300,
        stat: 'Average',
        region: 'ap-northeast-2',
        title: 'API Response Time'
      }
    }
  ]
};
```

### 4.3 A/B 테스트 프레임워크

```typescript
// 기능 플래그 기반 A/B 테스트
class ABTestManager {
  async getVariant(userId: string, experimentId: string): Promise<string> {
    const hash = this.hashUserId(userId, experimentId);
    const percentage = hash % 100;
    
    const experiment = await this.getExperiment(experimentId);
    
    for (const variant of experiment.variants) {
      if (percentage < variant.weight) {
        return variant.name;
      }
    }
    
    return 'control';
  }
  
  async trackEvent(userId: string, experimentId: string, event: string): Promise<void> {
    await this.analytics.track({
      userId,
      event,
      properties: {
        experimentId,
        variant: await this.getVariant(userId, experimentId)
      }
    });
  }
}
```

## 5. 단계별 구현 계획

### Phase 1: 기반 구축 (Week 1-2)
- APM 도구 설정 (X-Ray, CloudWatch)
- 성능 베이스라인 측정
- 모니터링 대시보드 구축

### Phase 2: 백엔드 최적화 (Week 3-6)
- Lambda 콜드 스타트 개선
- 데이터베이스 쿼리 최적화
- 캐싱 전략 구현
- API 응답 압축

### Phase 3: 프론트엔드 최적화 (Week 7-10)
- 번들 크기 최적화
- 코드 스플리팅 구현
- 차트 렌더링 개선
- 가상 스크롤링 도입

### Phase 4: 인프라 개선 (Week 11-12)
- CDN 설정 최적화
- 엣지 컴퓨팅 도입
- 자동 스케일링 구성

### Phase 5: 검증 및 배포 (Week 13-14)
- 부하 테스트 수행
- A/B 테스트 실행
- 점진적 롤아웃
- 성능 리포트 작성