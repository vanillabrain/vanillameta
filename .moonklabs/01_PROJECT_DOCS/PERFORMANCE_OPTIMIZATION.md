# VanillaMeta 성능 최적화 가이드

## 목차
1. [개요](#개요)
2. [현재 성능 병목점](#현재-성능-병목점)
3. [백엔드 최적화 전략](#백엔드-최적화-전략)
4. [프론트엔드 최적화 전략](#프론트엔드-최적화-전략)
5. [데이터베이스 최적화](#데이터베이스-최적화)
6. [캐싱 전략](#캐싱-전략)
7. [모니터링 방법](#모니터링-방법)
8. [성능 테스트](#성능-테스트)

## 개요

VanillaMeta는 대용량 데이터를 실시간으로 처리하고 시각화하는 BI 도구로서, 성능 최적화가 매우 중요합니다. 이 문서는 시스템 전반의 성능을 향상시키기 위한 전략과 구체적인 구현 방법을 제공합니다.

### 성능 목표
- **API 응답 시간**: 95% 요청이 200ms 이내
- **대시보드 로딩**: 3초 이내
- **쿼리 실행**: 대부분의 쿼리 5초 이내
- **동시 사용자**: 1000명 이상 지원

## 현재 성능 병목점

### 1. Lambda 콜드 스타트
- **문제**: 첫 요청 시 3-5초 지연
- **영향**: 사용자 경험 저하
- **발생 빈도**: 5분 이상 유휴 후

### 2. 대용량 쿼리 처리
- **문제**: 100만 건 이상 데이터 처리 시 타임아웃
- **영향**: 대시보드 로딩 실패
- **주요 원인**: 메모리 부족, 비효율적인 쿼리

### 3. N+1 쿼리 문제
- **문제**: 관계형 데이터 로딩 시 과도한 쿼리 발생
- **영향**: API 응답 시간 증가
- **발생 위치**: 대시보드, 위젯 목록 조회

### 4. 프론트엔드 번들 크기
- **문제**: 초기 번들 크기 2MB 이상
- **영향**: 초기 로딩 시간 증가
- **주요 원인**: 차트 라이브러리, 미사용 코드

## 백엔드 최적화 전략

### 1. Lambda 콜드 스타트 최적화

#### 워밍업 전략
```yaml
# serverless.yml
custom:
  warmup:
    enabled: true
    role: IamRoleLambdaExecution
    events:
      - schedule: 'rate(5 minutes)'
    timeout: 20
    prewarm: true
    concurrency: 5

functions:
  api:
    handler: dist/serverless.handler
    warmup:
      enabled: true
      payload:
        source: 'serverless-plugin-warmup'
```

#### 번들 크기 최적화
```javascript
// webpack.config.js
module.exports = {
  mode: 'production',
  target: 'node',
  externals: [
    nodeExternals({
      // Lambda Layer에 있는 모듈은 번들에서 제외
      allowlist: ['source-map-support/register']
    })
  ],
  optimization: {
    minimize: true,
    // Tree shaking 활성화
    usedExports: true,
    sideEffects: false
  }
};
```

#### 메모리 할당 최적화
```typescript
// lambda-memory-optimizer.ts
export class LambdaMemoryOptimizer {
  static async findOptimalMemory(functionName: string) {
    const memorySizes = [512, 768, 1024, 1536, 2048];
    const results = [];

    for (const memory of memorySizes) {
      const performance = await this.testPerformance(functionName, memory);
      results.push({
        memory,
        avgDuration: performance.avgDuration,
        cost: this.calculateCost(memory, performance.avgDuration)
      });
    }

    // 비용 대비 성능 최적점 찾기
    return results.reduce((optimal, current) => {
      const performanceGain = optimal.avgDuration - current.avgDuration;
      const costIncrease = current.cost - optimal.cost;
      
      // 10% 성능 향상에 20% 이상 비용 증가는 제외
      if (performanceGain / optimal.avgDuration > 0.1 && 
          costIncrease / optimal.cost < 0.2) {
        return current;
      }
      return optimal;
    });
  }
}
```

### 2. 쿼리 최적화

#### 쿼리 분석 및 최적화
```typescript
// query-optimizer.service.ts
@Injectable()
export class QueryOptimizerService {
  async optimizeQuery(sql: string, dbType: string): Promise<string> {
    let optimizedSql = sql;

    // 1. EXPLAIN 분석
    const explainResult = await this.analyzeQuery(sql, dbType);
    
    // 2. 인덱스 힌트 추가
    if (this.needsIndexHint(explainResult)) {
      optimizedSql = this.addIndexHints(optimizedSql, explainResult);
    }

    // 3. 서브쿼리 최적화
    optimizedSql = this.optimizeSubqueries(optimizedSql);

    // 4. JOIN 순서 최적화
    optimizedSql = this.optimizeJoinOrder(optimizedSql);

    // 5. 불필요한 컬럼 제거
    optimizedSql = this.removeUnusedColumns(optimizedSql);

    return optimizedSql;
  }

  private optimizeSubqueries(sql: string): string {
    // EXISTS로 변환 가능한 IN 서브쿼리 찾기
    const inSubqueryPattern = /WHERE\s+\w+\s+IN\s*\((SELECT[\s\S]+?)\)/gi;
    
    return sql.replace(inSubqueryPattern, (match, subquery) => {
      // IN을 EXISTS로 변환
      return `WHERE EXISTS (${subquery} AND ...correlation condition...)`;
    });
  }

  private addIndexHints(sql: string, explainResult: any): string {
    const hints = [];
    
    for (const table of explainResult.tables) {
      if (table.accessType === 'ALL' && table.possibleKeys.length > 0) {
        hints.push(`USE INDEX (${table.possibleKeys[0]})`);
      }
    }

    // MySQL 스타일 인덱스 힌트 추가
    return sql.replace(/FROM\s+(\w+)/gi, (match, tableName, index) => {
      const hint = hints.find(h => h.includes(tableName));
      return hint ? `FROM ${tableName} ${hint}` : match;
    });
  }
}
```

#### 페이지네이션 최적화
```typescript
// cursor-pagination.service.ts
@Injectable()
export class CursorPaginationService {
  async paginate<T>(
    queryBuilder: SelectQueryBuilder<T>,
    options: PaginationOptions
  ): Promise<PaginationResult<T>> {
    const { limit = 20, cursor, orderBy = 'id' } = options;

    // 커서 기반 페이지네이션 (오프셋 대신 사용)
    if (cursor) {
      const decodedCursor = this.decodeCursor(cursor);
      queryBuilder.where(`${orderBy} > :cursor`, { cursor: decodedCursor });
    }

    // 인덱스 활용을 위한 정렬
    queryBuilder
      .orderBy(orderBy, 'ASC')
      .limit(limit + 1); // 다음 페이지 존재 여부 확인용

    const items = await queryBuilder.getMany();
    const hasNextPage = items.length > limit;
    
    if (hasNextPage) {
      items.pop(); // 추가로 가져온 항목 제거
    }

    const nextCursor = hasNextPage 
      ? this.encodeCursor(items[items.length - 1][orderBy])
      : null;

    return {
      items,
      nextCursor,
      hasNextPage
    };
  }

  private encodeCursor(value: any): string {
    return Buffer.from(JSON.stringify(value)).toString('base64');
  }

  private decodeCursor(cursor: string): any {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  }
}
```

### 3. N+1 쿼리 해결

#### DataLoader 패턴 구현
```typescript
// dataloader.factory.ts
@Injectable()
export class DataLoaderFactory {
  createLoader<K, V>(
    batchLoadFn: (keys: K[]) => Promise<V[]>
  ): DataLoader<K, V> {
    return new DataLoader(batchLoadFn, {
      cache: true,
      maxBatchSize: 100
    });
  }
}

// widget.service.ts
@Injectable()
export class WidgetService {
  private widgetLoader: DataLoader<string, Widget>;

  constructor(
    @InjectRepository(Widget) private widgetRepo: Repository<Widget>,
    private dataLoaderFactory: DataLoaderFactory
  ) {
    this.widgetLoader = this.dataLoaderFactory.createLoader(
      async (ids: string[]) => {
        const widgets = await this.widgetRepo.findByIds(ids);
        return ids.map(id => widgets.find(w => w.id === id));
      }
    );
  }

  async getWidget(id: string): Promise<Widget> {
    return this.widgetLoader.load(id);
  }

  async getDashboardWithWidgets(dashboardId: string) {
    const dashboard = await this.dashboardRepo.findOne(dashboardId);
    
    // N+1 방지: 배치로 위젯 로드
    const widgets = await Promise.all(
      dashboard.widgetIds.map(id => this.widgetLoader.load(id))
    );

    return { ...dashboard, widgets };
  }
}
```

### 4. 스트리밍 응답

#### 대용량 데이터 스트리밍
```typescript
// streaming.service.ts
@Injectable()
export class StreamingService {
  async streamQueryResults(
    queryRunner: QueryRunner,
    sql: string,
    response: Response
  ) {
    response.setHeader('Content-Type', 'application/x-ndjson');
    response.setHeader('Transfer-Encoding', 'chunked');

    const stream = queryRunner.stream(sql);
    let rowCount = 0;
    let buffer = [];
    const bufferSize = 100;

    stream.on('data', (row) => {
      buffer.push(JSON.stringify(row));
      rowCount++;

      if (buffer.length >= bufferSize) {
        response.write(buffer.join('\n') + '\n');
        buffer = [];
      }
    });

    stream.on('end', () => {
      if (buffer.length > 0) {
        response.write(buffer.join('\n') + '\n');
      }
      
      // 메타데이터 전송
      response.write(JSON.stringify({
        _meta: {
          rowCount,
          completed: true
        }
      }));
      
      response.end();
    });

    stream.on('error', (error) => {
      response.write(JSON.stringify({
        _error: error.message
      }));
      response.end();
    });
  }
}
```

## 프론트엔드 최적화 전략

### 1. 번들 최적화

#### 코드 스플리팅
```typescript
// router/index.tsx
import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoadingSpinner from '@/components/LoadingSpinner';

// 동적 임포트로 코드 스플리팅
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const WidgetEditor = lazy(() => import('@/pages/Widget/Editor'));
const DataSource = lazy(() => import('@/pages/Data/DataSource'));

export const AppRouter = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/widget/*" element={<WidgetEditor />} />
        <Route path="/data/*" element={<DataSource />} />
      </Routes>
    </Suspense>
  );
};
```

#### 차트 라이브러리 최적화
```typescript
// widget/ChartLoader.tsx
import { lazy, memo } from 'react';

// 차트 타입별 동적 로딩
const chartComponents = {
  line: lazy(() => import('./modules/LineChart')),
  bar: lazy(() => import('./modules/BarChart')),
  pie: lazy(() => import('./modules/PieChart')),
  scatter: lazy(() => import('./modules/ScatterChart')),
  // ... 50+ 차트 타입
};

export const ChartLoader = memo(({ type, ...props }) => {
  const ChartComponent = chartComponents[type];
  
  if (!ChartComponent) {
    return <div>Unsupported chart type: {type}</div>;
  }

  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ChartComponent {...props} />
    </Suspense>
  );
});

// ECharts 트리 쉐이킹
// echarts-loader.ts
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// 필요한 컴포넌트만 등록
echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export default echarts;
```

### 2. 렌더링 최적화

#### React.memo와 useMemo 활용
```typescript
// components/DashboardGrid.tsx
import React, { memo, useMemo, useCallback } from 'react';
import GridLayout from 'react-grid-layout';

interface DashboardGridProps {
  widgets: Widget[];
  layout: Layout[];
  onLayoutChange: (layout: Layout[]) => void;
}

export const DashboardGrid = memo<DashboardGridProps>(({
  widgets,
  layout,
  onLayoutChange
}) => {
  // 레이아웃 계산 메모이제이션
  const optimizedLayout = useMemo(() => {
    return layout.map(item => ({
      ...item,
      minW: 2,
      minH: 2,
      maxW: 12
    }));
  }, [layout]);

  // 콜백 메모이제이션
  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    // 실제 변경이 있을 때만 업데이트
    const hasChanged = !isEqual(layout, newLayout);
    if (hasChanged) {
      onLayoutChange(newLayout);
    }
  }, [layout, onLayoutChange]);

  // 위젯 렌더링 최적화
  const renderWidget = useCallback((widget: Widget) => {
    return (
      <div key={widget.id} data-grid={getLayoutItem(widget.id)}>
        <WidgetContainer widget={widget} />
      </div>
    );
  }, []);

  return (
    <GridLayout
      layout={optimizedLayout}
      onLayoutChange={handleLayoutChange}
      cols={12}
      rowHeight={60}
      width={1200}
    >
      {widgets.map(renderWidget)}
    </GridLayout>
  );
}, (prevProps, nextProps) => {
  // 커스텀 비교 함수
  return (
    isEqual(prevProps.widgets, nextProps.widgets) &&
    isEqual(prevProps.layout, nextProps.layout)
  );
});
```

#### 가상 스크롤링
```typescript
// components/VirtualList.tsx
import { VariableSizeList } from 'react-window';

export const VirtualDataTable = ({ data, columns }) => {
  const Row = ({ index, style }) => (
    <div style={style} className="table-row">
      {columns.map(col => (
        <div key={col.key} className="table-cell">
          {data[index][col.key]}
        </div>
      ))}
    </div>
  );

  return (
    <VariableSizeList
      height={600}
      itemCount={data.length}
      itemSize={() => 50} // 행 높이
      width="100%"
    >
      {Row}
    </VariableSizeList>
  );
};
```

### 3. 리소스 최적화

#### 이미지 및 폰트 최적화
```typescript
// utils/imageOptimizer.ts
export const optimizeImage = (url: string, options: ImageOptions = {}) => {
  const { width, height, quality = 85 } = options;
  
  // CDN을 통한 이미지 최적화
  const params = new URLSearchParams({
    w: width?.toString(),
    h: height?.toString(),
    q: quality.toString(),
    fm: 'webp', // WebP 포맷 사용
    fit: 'cover'
  });

  return `${CDN_URL}/optimize?url=${encodeURIComponent(url)}&${params}`;
};

// 폰트 서브셋 생성
// font-subset.css
@font-face {
  font-family: 'Pretendard';
  src: url('/fonts/Pretendard-subset.woff2') format('woff2');
  font-display: swap; /* FOUT 방지 */
  unicode-range: U+AC00-D7AF; /* 한글 범위만 */
}
```

### 4. 상태 관리 최적화

#### Context 분리
```typescript
// contexts/OptimizedAuthContext.tsx
// 인증 상태와 사용자 정보를 분리하여 불필요한 리렌더링 방지

const AuthStateContext = createContext(null);
const UserDataContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({ isAuthenticated: false });
  const [userData, setUserData] = useState(null);

  // 인증 상태만 변경되는 경우
  const login = useCallback(async (credentials) => {
    const { token, user } = await authService.login(credentials);
    setAuthState({ isAuthenticated: true, token });
    setUserData(user);
  }, []);

  return (
    <AuthStateContext.Provider value={authState}>
      <UserDataContext.Provider value={userData}>
        {children}
      </UserDataContext.Provider>
    </AuthStateContext.Provider>
  );
};

// 필요한 컨텍스트만 구독
export const useAuthState = () => useContext(AuthStateContext);
export const useUserData = () => useContext(UserDataContext);
```

## 데이터베이스 최적화

### 1. 인덱스 전략

#### 복합 인덱스 설계
```sql
-- 자주 사용되는 쿼리 패턴에 맞춘 인덱스
CREATE INDEX idx_dashboard_user_created 
  ON dashboard(user_id, created_at DESC);

CREATE INDEX idx_widget_dashboard_type 
  ON widget(dashboard_id, widget_type);

-- 커버링 인덱스로 성능 향상
CREATE INDEX idx_dataset_covering 
  ON dataset(database_id, is_deleted, created_at) 
  INCLUDE (name, sql_query);

-- 부분 인덱스로 저장 공간 절약
CREATE INDEX idx_active_users 
  ON users(email) 
  WHERE is_active = true;
```

#### 인덱스 사용 모니터링
```typescript
// index-monitor.service.ts
@Injectable()
export class IndexMonitorService {
  async analyzeIndexUsage() {
    const unusedIndexes = await this.queryRunner.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
      ORDER BY schemaname, tablename;
    `);

    const recommendations = [];
    
    for (const index of unusedIndexes) {
      recommendations.push({
        action: 'DROP_INDEX',
        reason: 'Unused index consuming storage',
        sql: `DROP INDEX ${index.indexname};`
      });
    }

    return recommendations;
  }

  async suggestNewIndexes() {
    // 느린 쿼리 분석
    const slowQueries = await this.getSlowQueries();
    const suggestions = [];

    for (const query of slowQueries) {
      const missingIndexes = await this.analyzeMissingIndexes(query);
      suggestions.push(...missingIndexes);
    }

    return suggestions;
  }
}
```

### 2. 쿼리 실행 계획 최적화

#### 쿼리 플래너 힌트
```typescript
// query-hints.service.ts
export class QueryHintsService {
  applyHints(sql: string, dbType: string): string {
    switch (dbType) {
      case 'postgresql':
        return this.applyPostgreSQLHints(sql);
      case 'mysql':
        return this.applyMySQLHints(sql);
      default:
        return sql;
    }
  }

  private applyPostgreSQLHints(sql: string): string {
    // 병렬 쿼리 활성화
    return `
      SET max_parallel_workers_per_gather = 4;
      SET parallel_setup_cost = 100;
      SET parallel_tuple_cost = 0.01;
      ${sql}
    `;
  }

  private applyMySQLHints(sql: string): string {
    // 조인 버퍼 크기 증가
    return `
      SET SESSION join_buffer_size = 262144;
      SET SESSION sort_buffer_size = 262144;
      ${sql}
    `;
  }
}
```

### 3. 파티셔닝

#### 시계열 데이터 파티셔닝
```sql
-- 월별 파티셔닝
CREATE TABLE analytics_events (
  id BIGSERIAL,
  user_id VARCHAR(36),
  event_type VARCHAR(50),
  created_at TIMESTAMP,
  data JSONB
) PARTITION BY RANGE (created_at);

-- 자동 파티션 생성
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  start_date date;
  end_date date;
  partition_name text;
BEGIN
  start_date := date_trunc('month', CURRENT_DATE);
  end_date := start_date + interval '1 month';
  partition_name := 'analytics_events_' || to_char(start_date, 'YYYY_MM');
  
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I 
    PARTITION OF analytics_events 
    FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;

-- 매월 자동 실행
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT create_monthly_partition()');
```

## 캐싱 전략

### 1. 다층 캐싱 구조

```typescript
// cache-layers.service.ts
@Injectable()
export class CacheLayersService {
  constructor(
    private memoryCache: MemoryCacheService,
    private redisCache: RedisCacheService,
    private cdnCache: CdnCacheService,
  ) {}

  async get(key: string): Promise<any> {
    // L1: 메모리 캐시 (가장 빠름)
    let value = await this.memoryCache.get(key);
    if (value) return value;

    // L2: Redis 캐시
    value = await this.redisCache.get(key);
    if (value) {
      // 메모리 캐시에 복사
      await this.memoryCache.set(key, value, 300); // 5분
      return value;
    }

    // L3: CDN 캐시 (정적 자원)
    if (this.isStaticResource(key)) {
      value = await this.cdnCache.get(key);
      if (value) {
        // 하위 캐시에 복사
        await this.redisCache.set(key, value, 3600); // 1시간
        await this.memoryCache.set(key, value, 300);
        return value;
      }
    }

    return null;
  }

  async set(key: string, value: any, options: CacheOptions = {}) {
    const { ttl = 3600, layers = ['memory', 'redis'] } = options;

    const promises = [];
    
    if (layers.includes('memory')) {
      promises.push(this.memoryCache.set(key, value, Math.min(ttl, 300)));
    }
    
    if (layers.includes('redis')) {
      promises.push(this.redisCache.set(key, value, ttl));
    }
    
    if (layers.includes('cdn') && this.isStaticResource(key)) {
      promises.push(this.cdnCache.set(key, value, ttl * 24)); // CDN은 더 오래
    }

    await Promise.all(promises);
  }
}
```

### 2. 쿼리 결과 캐싱

```typescript
// query-cache.service.ts
@Injectable()
export class QueryCacheService {
  private readonly defaultTTL = 300; // 5분

  async executeWithCache(
    sql: string,
    params: any[],
    options: QueryCacheOptions = {}
  ): Promise<any> {
    // 캐시 키 생성
    const cacheKey = this.generateCacheKey(sql, params);
    
    // 캐시 확인
    const cached = await this.cacheService.get(cacheKey);
    if (cached && !options.forceRefresh) {
      return cached;
    }

    // 쿼리 실행
    const result = await this.queryRunner.query(sql, params);
    
    // 캐싱 가능한지 확인
    if (this.isCacheable(sql, result, options)) {
      const ttl = this.calculateTTL(sql, options);
      await this.cacheService.set(cacheKey, result, { ttl });
    }

    return result;
  }

  private generateCacheKey(sql: string, params: any[]): string {
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ').trim();
    const hash = crypto
      .createHash('sha256')
      .update(normalizedSql + JSON.stringify(params))
      .digest('hex');
    
    return `query:${hash}`;
  }

  private calculateTTL(sql: string, options: QueryCacheOptions): number {
    // 집계 쿼리는 더 오래 캐싱
    if (sql.includes('COUNT(') || sql.includes('SUM(')) {
      return options.ttl || 1800; // 30분
    }
    
    // 실시간성이 중요한 데이터는 짧게
    if (sql.includes('real_time') || sql.includes('current_')) {
      return options.ttl || 60; // 1분
    }
    
    return options.ttl || this.defaultTTL;
  }
}
```

### 3. 캐시 무효화 전략

```typescript
// cache-invalidation.service.ts
@Injectable()
export class CacheInvalidationService {
  private invalidationRules = new Map<string, string[]>();

  constructor() {
    // 테이블별 관련 캐시 패턴 정의
    this.invalidationRules.set('dashboard', [
      'dashboard:*',
      'user:*:dashboards',
      'widget:*'
    ]);
    
    this.invalidationRules.set('widget', [
      'widget:*',
      'dashboard:*:widgets',
      'dataset:*:usage'
    ]);
  }

  async invalidate(entity: string, operation: string, id?: string) {
    const patterns = this.invalidationRules.get(entity) || [];
    
    for (const pattern of patterns) {
      const keys = await this.findKeys(pattern, id);
      
      if (keys.length > 0) {
        await this.cacheService.del(...keys);
        
        // 로깅
        this.logger.log(`Invalidated ${keys.length} cache keys for ${entity}:${operation}`);
      }
    }

    // 이벤트 발행 (다른 서비스에 알림)
    await this.eventEmitter.emit('cache.invalidated', {
      entity,
      operation,
      id,
      patterns
    });
  }

  private async findKeys(pattern: string, id?: string): Promise<string[]> {
    // ID가 있으면 패턴에서 치환
    const searchPattern = id 
      ? pattern.replace('*', id)
      : pattern;
    
    return this.redisService.keys(searchPattern);
  }
}
```

## 모니터링 방법

### 1. APM (Application Performance Monitoring)

#### CloudWatch 커스텀 메트릭
```typescript
// metrics.service.ts
@Injectable()
export class MetricsService {
  private cloudWatch: AWS.CloudWatch;

  async recordMetric(
    metricName: string,
    value: number,
    unit: string = 'Count',
    dimensions?: Record<string, string>
  ) {
    const params = {
      Namespace: 'VanillaMeta/Performance',
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
        Dimensions: Object.entries(dimensions || {}).map(([Name, Value]) => ({
          Name,
          Value
        }))
      }]
    };

    await this.cloudWatch.putMetricData(params).promise();
  }

  // 실제 사용 예시
  async trackApiPerformance(
    endpoint: string,
    duration: number,
    statusCode: number
  ) {
    await Promise.all([
      this.recordMetric('APIResponseTime', duration, 'Milliseconds', {
        Endpoint: endpoint,
        StatusCode: statusCode.toString()
      }),
      this.recordMetric('APICallCount', 1, 'Count', {
        Endpoint: endpoint
      })
    ]);
  }
}
```

### 2. 실시간 대시보드

#### Grafana 설정
```json
{
  "dashboard": {
    "title": "VanillaMeta Performance Dashboard",
    "panels": [
      {
        "title": "API Response Time",
        "targets": [{
          "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)",
          "legendFormat": "95th percentile"
        }]
      },
      {
        "title": "Lambda Cold Starts",
        "targets": [{
          "expr": "rate(lambda_cold_starts_total[5m])",
          "legendFormat": "Cold starts per minute"
        }]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [{
          "expr": "rate(cache_hits_total[5m]) / rate(cache_requests_total[5m]) * 100",
          "legendFormat": "Hit rate %"
        }]
      },
      {
        "title": "Database Query Time",
        "targets": [{
          "expr": "histogram_quantile(0.99, db_query_duration_seconds_bucket)",
          "legendFormat": "99th percentile"
        }]
      }
    ]
  }
}
```

### 3. 성능 알림

#### CloudWatch 알람
```yaml
# cloudformation/performance-alarms.yml
Resources:
  HighAPILatencyAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: VanillaMeta-High-API-Latency
      MetricName: APIResponseTime
      Namespace: VanillaMeta/Performance
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 1000
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref SNSTopic

  LowCacheHitRateAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: VanillaMeta-Low-Cache-Hit-Rate
      MetricName: CacheHitRate
      Namespace: VanillaMeta/Performance
      Statistic: Average
      Period: 300
      EvaluationPeriods: 3
      Threshold: 70
      ComparisonOperator: LessThanThreshold
```

## 성능 테스트

### 1. 부하 테스트

#### K6 스크립트
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // 램프업
    { duration: '5m', target: 100 }, // 유지
    { duration: '2m', target: 200 }, // 스케일업
    { duration: '5m', target: 200 }, // 유지
    { duration: '2m', target: 0 },   // 램프다운
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% 요청이 500ms 이내
    http_req_failed: ['rate<0.1'],    // 에러율 10% 미만
  },
};

export default function() {
  const token = login();
  
  // 대시보드 목록 조회
  const dashboards = http.get(`${BASE_URL}/dashboard`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  check(dashboards, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  // 대시보드 상세 조회
  if (dashboards.json('data').length > 0) {
    const dashboardId = dashboards.json('data')[0].id;
    const detail = http.get(`${BASE_URL}/dashboard/${dashboardId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    check(detail, {
      'dashboard loaded': (r) => r.status === 200,
    });
  }
  
  sleep(1);
}
```

### 2. 성능 벤치마크

#### 자동화된 성능 테스트
```typescript
// performance-benchmark.spec.ts
describe('Performance Benchmarks', () => {
  let benchmarkResults = [];

  afterAll(() => {
    // 결과 저장
    fs.writeFileSync(
      'benchmark-results.json',
      JSON.stringify(benchmarkResults, null, 2)
    );
  });

  it('should handle 1000 concurrent dashboard requests', async () => {
    const start = Date.now();
    
    const promises = Array(1000).fill(null).map(() => 
      request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${token}`)
    );
    
    const results = await Promise.all(promises);
    const duration = Date.now() - start;
    
    const successCount = results.filter(r => r.status === 200).length;
    const avgResponseTime = duration / 1000;
    
    benchmarkResults.push({
      test: 'concurrent_dashboard_requests',
      concurrency: 1000,
      duration,
      successRate: successCount / 1000,
      avgResponseTime
    });
    
    expect(successCount).toBeGreaterThan(950); // 95% 성공률
    expect(avgResponseTime).toBeLessThan(200); // 평균 200ms 이내
  });

  it('should process large dataset efficiently', async () => {
    const largeDatasetSql = 'SELECT * FROM large_table LIMIT 100000';
    
    const start = Date.now();
    const response = await request(app.getHttpServer())
      .post('/database/query')
      .send({ sql: largeDatasetSql })
      .set('Authorization', `Bearer ${token}`);
    
    const duration = Date.now() - start;
    
    benchmarkResults.push({
      test: 'large_dataset_query',
      rowCount: 100000,
      duration,
      memoryUsed: process.memoryUsage().heapUsed
    });
    
    expect(duration).toBeLessThan(5000); // 5초 이내
    expect(response.status).toBe(200);
  });
});
```

### 3. 지속적인 성능 모니터링

#### 성능 회귀 감지
```typescript
// performance-regression.service.ts
@Injectable()
export class PerformanceRegressionService {
  async checkRegression(currentMetrics: PerformanceMetrics) {
    const baseline = await this.getBaseline();
    const regressions = [];

    // API 응답 시간 비교
    if (currentMetrics.avgResponseTime > baseline.avgResponseTime * 1.2) {
      regressions.push({
        metric: 'API Response Time',
        baseline: baseline.avgResponseTime,
        current: currentMetrics.avgResponseTime,
        degradation: `${((currentMetrics.avgResponseTime / baseline.avgResponseTime - 1) * 100).toFixed(1)}%`
      });
    }

    // 메모리 사용량 비교
    if (currentMetrics.memoryUsage > baseline.memoryUsage * 1.3) {
      regressions.push({
        metric: 'Memory Usage',
        baseline: baseline.memoryUsage,
        current: currentMetrics.memoryUsage,
        degradation: `${((currentMetrics.memoryUsage / baseline.memoryUsage - 1) * 100).toFixed(1)}%`
      });
    }

    if (regressions.length > 0) {
      await this.notifyTeam(regressions);
      throw new Error('Performance regression detected');
    }
  }
}
```

## 성능 최적화 체크리스트

### 백엔드
- [ ] Lambda 워밍업 설정
- [ ] 메모리 크기 최적화
- [ ] 번들 크기 최소화
- [ ] N+1 쿼리 제거
- [ ] 데이터베이스 인덱스 최적화
- [ ] 쿼리 결과 캐싱
- [ ] 커넥션 풀 설정
- [ ] 스트리밍 응답 구현

### 프론트엔드
- [ ] 코드 스플리팅
- [ ] 동적 임포트
- [ ] 이미지 최적화
- [ ] 폰트 서브셋
- [ ] 메모이제이션
- [ ] 가상 스크롤
- [ ] 서비스 워커 캐싱
- [ ] 번들 분석

### 인프라
- [ ] CDN 설정
- [ ] Gzip 압축
- [ ] HTTP/2 활성화
- [ ] 캐시 헤더 설정
- [ ] 로드 밸런싱
- [ ] 오토 스케일링
- [ ] 모니터링 대시보드
- [ ] 성능 알림