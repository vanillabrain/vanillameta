# T03_S03: TypeORM 쿼리 최적화

## 태스크 개요
- **ID**: T03_S03
- **제목**: TypeORM 쿼리 최적화
- **우선순위**: High
- **복잡도**: Medium
- **예상 소요 시간**: 3일

## 태스크 목표
TypeORM의 고급 기능을 활용하여 쿼리 성능을 최적화하고, 불필요한 데이터 로딩을 방지하여 애플리케이션의 전반적인 성능을 향상시킵니다.

## 구현 범위

### 1. 선택적 필드 로딩
- 필요한 컬럼만 SELECT
- 대용량 필드 지연 로딩
- DTO 기반 프로젝션

### 2. 쿼리 빌더 최적화
- 복잡한 조인 최적화
- 서브쿼리 효율화
- Raw SQL 통합

### 3. 캐싱 전략
- Query Result Cache
- Entity Cache
- Second Level Cache

## 기술적 세부사항

### 선택적 필드 로딩 구현
```typescript
// backend-api/src/modules/dashboard/dashboard.service.ts

// ❌ 모든 필드를 로딩하는 비효율적인 방법
async getDashboardsFull(): Promise<Dashboard[]> {
  return await this.dashboardRepository.find();
}

// ✅ 필요한 필드만 선택하는 최적화된 방법
async getDashboardsSummary(): Promise<DashboardSummaryDto[]> {
  return await this.dashboardRepository
    .createQueryBuilder('dashboard')
    .select([
      'dashboard.id',
      'dashboard.name',
      'dashboard.createdAt',
      'dashboard.updatedAt'
    ])
    .where('dashboard.isActive = :isActive', { isActive: true })
    .getMany();
}

// ✅ Raw 쿼리를 통한 DTO 프로젝션
async getDashboardsProjection(): Promise<DashboardProjection[]> {
  return await this.dashboardRepository
    .createQueryBuilder('dashboard')
    .select('dashboard.id', 'id')
    .addSelect('dashboard.name', 'name')
    .addSelect('COUNT(widget.id)', 'widgetCount')
    .leftJoin('dashboard.widgets', 'widget')
    .groupBy('dashboard.id')
    .getRawMany();
}
```

### Lazy Loading 전략
```typescript
// backend-api/src/entities/dashboard.entity.ts
@Entity()
export class Dashboard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Lazy loading for heavy content
  @Column({ type: 'text', nullable: true })
  @Lazy()
  configuration: Promise<string>;

  // Lazy relations
  @OneToMany(() => Widget, widget => widget.dashboard, { lazy: true })
  widgets: Promise<Widget[]>;

  // Eager loading for frequently accessed data
  @ManyToOne(() => User, { eager: true })
  owner: User;
}

// 사용 예시
async function loadDashboardWithLazyData(id: string): Promise<Dashboard> {
  const dashboard = await dashboardRepository.findOne({ where: { id } });
  
  // configuration은 접근 시에만 로드됨
  if (needsConfiguration) {
    const config = await dashboard.configuration;
  }
  
  return dashboard;
}
```

### Query Builder 고급 최적화
```typescript
// backend-api/src/common/query/query-optimizer.ts
export class QueryOptimizer {
  // 페이지네이션 최적화
  async optimizedPagination<T>(
    qb: SelectQueryBuilder<T>,
    page: number,
    limit: number
  ): Promise<PaginatedResult<T>> {
    // 전체 카운트를 위한 별도 쿼리 (SELECT 절 제거)
    const countQb = qb.clone();
    countQb.select('COUNT(DISTINCT ' + qb.alias + '.id)', 'count');
    countQb.orderBy(); // ORDER BY 제거로 성능 향상
    
    const { count } = await countQb.getRawOne();
    
    // 실제 데이터 쿼리
    const items = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    
    return {
      items,
      total: parseInt(count),
      page,
      limit,
      pages: Math.ceil(count / limit)
    };
  }

  // 배치 로딩 최적화
  async batchLoad<T>(
    repository: Repository<T>,
    ids: string[],
    batchSize: number = 1000
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const items = await repository
        .createQueryBuilder()
        .whereInIds(batch)
        .getMany();
      results.push(...items);
    }
    
    return results;
  }
}
```

### 복잡한 조인 최적화
```typescript
// backend-api/src/modules/analytics/analytics.service.ts
export class AnalyticsService {
  // 서브쿼리를 활용한 최적화
  async getTopPerformingDashboards(workspaceId: string): Promise<any[]> {
    return await this.connection
      .createQueryBuilder()
      .select('dashboard.*')
      .addSelect('stats.viewCount')
      .addSelect('stats.avgLoadTime')
      .from('dashboard', 'dashboard')
      .innerJoin(
        qb => qb
          .select('dashboard_id')
          .addSelect('COUNT(*)', 'viewCount')
          .addSelect('AVG(load_time)', 'avgLoadTime')
          .from('dashboard_view', 'view')
          .where('view.created_at > :date', { date: thirtyDaysAgo })
          .groupBy('dashboard_id'),
        'stats',
        'stats.dashboard_id = dashboard.id'
      )
      .where('dashboard.workspace_id = :workspaceId', { workspaceId })
      .orderBy('stats.viewCount', 'DESC')
      .limit(10)
      .getRawMany();
  }

  // WITH 절 활용 (PostgreSQL)
  async getComplexAnalytics(): Promise<any[]> {
    return await this.connection.query(`
      WITH active_users AS (
        SELECT user_id, COUNT(*) as activity_count
        FROM user_activity
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY user_id
      ),
      dashboard_stats AS (
        SELECT dashboard_id, COUNT(*) as widget_count
        FROM widget
        GROUP BY dashboard_id
      )
      SELECT 
        d.*,
        au.activity_count,
        ds.widget_count
      FROM dashboard d
      LEFT JOIN active_users au ON au.user_id = d.user_id
      LEFT JOIN dashboard_stats ds ON ds.dashboard_id = d.id
      WHERE d.is_active = true
    `);
  }
}
```

### TypeORM 캐싱 구현
```typescript
// backend-api/src/config/database.config.ts
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  // ... 기타 설정
  cache: {
    type: 'redis',
    options: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      ttl: 3600 // 1시간
    }
  }
};

// 쿼리 레벨 캐싱
export class CachedDashboardService {
  async getCachedDashboards(workspaceId: string): Promise<Dashboard[]> {
    return await this.dashboardRepository
      .createQueryBuilder('dashboard')
      .where('dashboard.workspaceId = :workspaceId', { workspaceId })
      .cache(`dashboards:${workspaceId}`, 300000) // 5분 캐시
      .getMany();
  }

  // 캐시 무효화
  async invalidateDashboardCache(workspaceId: string): Promise<void> {
    await this.connection.queryResultCache.remove([
      `dashboards:${workspaceId}`
    ]);
  }
}
```

### 트랜잭션 최적화
```typescript
// backend-api/src/common/decorators/optimized-transaction.decorator.ts
export function OptimizedTransaction(isolationLevel?: IsolationLevel) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const queryRunner = this.connection.createQueryRunner();
      
      // 연결 및 트랜잭션 시작
      await queryRunner.connect();
      await queryRunner.startTransaction(isolationLevel);
      
      try {
        // 트랜잭션 내에서 실행
        const result = await originalMethod.apply(this, [...args, queryRunner]);
        
        // 커밋
        await queryRunner.commitTransaction();
        return result;
      } catch (error) {
        // 롤백
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        // 연결 해제
        await queryRunner.release();
      }
    };

    return descriptor;
  };
}

// 사용 예시
export class DashboardService {
  @OptimizedTransaction('READ COMMITTED')
  async createDashboardWithWidgets(data: CreateDashboardDto, queryRunner?: QueryRunner): Promise<Dashboard> {
    const dashboard = await queryRunner.manager.save(Dashboard, data.dashboard);
    
    const widgets = data.widgets.map(w => ({ ...w, dashboardId: dashboard.id }));
    await queryRunner.manager.save(Widget, widgets);
    
    return dashboard;
  }
}
```

## 구현 단계

### 1단계: 현재 쿼리 분석
```bash
# TypeORM 쿼리 로깅 활성화
export TYPEORM_LOGGING=true
export TYPEORM_LOGGER=advanced-console

# 쿼리 분석 스크립트 실행
yarn analyze:typeorm-queries
```

### 2단계: 선택적 로딩 구현
```typescript
// backend-api/src/common/dto/field-selection.dto.ts
export class FieldSelectionDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relations?: string[];
}

// 동적 필드 선택 서비스
export class DynamicFieldService {
  buildQueryWithFields<T>(
    qb: SelectQueryBuilder<T>,
    fields: string[],
    alias: string
  ): SelectQueryBuilder<T> {
    if (fields && fields.length > 0) {
      const selections = fields.map(field => `${alias}.${field}`);
      qb.select(selections);
    }
    
    return qb;
  }
}
```

### 3단계: 쿼리 최적화 적용
```typescript
// 각 모듈별 최적화 적용
const modules = [
  'dashboard',
  'widget',
  'query',
  'connection',
  'workspace'
];

for (const module of modules) {
  // 1. Repository 메소드 최적화
  await optimizeRepositoryMethods(module);
  
  // 2. Service 레이어 쿼리 최적화
  await optimizeServiceQueries(module);
  
  // 3. 캐싱 전략 적용
  await applyCachingStrategy(module);
  
  // 4. 성능 테스트
  await runPerformanceTests(module);
}
```

## 검증 및 모니터링

### 쿼리 성능 메트릭
```typescript
// backend-api/src/common/metrics/query-metrics.ts
export class QueryMetrics {
  private metrics: Map<string, QueryPerformance> = new Map();

  recordQuery(
    queryName: string,
    executionTime: number,
    rowCount: number
  ): void {
    const existing = this.metrics.get(queryName) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      minTime: Infinity
    };

    existing.count++;
    existing.totalTime += executionTime;
    existing.avgTime = existing.totalTime / existing.count;
    existing.maxTime = Math.max(existing.maxTime, executionTime);
    existing.minTime = Math.min(existing.minTime, executionTime);

    this.metrics.set(queryName, existing);
  }

  getReport(): QueryPerformanceReport {
    return Array.from(this.metrics.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.avgTime - a.avgTime);
  }
}
```

### 최적화 효과 측정
```typescript
// backend-api/test/performance/typeorm-optimization.spec.ts
describe('TypeORM Query Optimization', () => {
  it('should reduce query execution time by 50%', async () => {
    const before = await measureQueryPerformance('getDashboards', originalMethod);
    const after = await measureQueryPerformance('getDashboards', optimizedMethod);
    
    expect(after.avgTime).toBeLessThan(before.avgTime * 0.5);
    expect(after.memoryUsage).toBeLessThan(before.memoryUsage);
  });
});
```

## 주의사항

### 과도한 최적화 방지
- 코드 가독성과 성능의 균형
- 프로파일링 기반 최적화
- 조기 최적화 지양

### 데이터베이스별 차이
```typescript
// MySQL 특화 최적화
if (databaseType === 'mysql') {
  qb.useIndex('idx_dashboard_workspace_created');
}

// PostgreSQL 특화 최적화
if (databaseType === 'postgres') {
  qb.setHint('enable_hashjoin', 'off');
}
```

### 메모리 관리
```typescript
// 스트리밍을 통한 대용량 데이터 처리
async function* streamLargeDataset(): AsyncGenerator<Dashboard[]> {
  const batchSize = 100;
  let offset = 0;
  
  while (true) {
    const batch = await this.dashboardRepository
      .createQueryBuilder()
      .skip(offset)
      .take(batchSize)
      .getMany();
    
    if (batch.length === 0) break;
    
    yield batch;
    offset += batchSize;
  }
}
```

## 완료 조건
- [ ] 모든 주요 쿼리의 선택적 필드 로딩 구현
- [ ] Lazy Loading 전략 적용 완료
- [ ] Query Builder 최적화 패턴 문서화
- [ ] 캐싱 전략 구현 및 검증
- [ ] 쿼리 실행 시간 50% 이상 개선
- [ ] 메모리 사용량 30% 이상 감소
- [ ] 성능 모니터링 대시보드 구축

## 참고 자료
- [TypeORM Performance Guide](https://typeorm.io/select-query-builder#performance)
- [Query Optimization Patterns](https://github.com/typeorm/typeorm/blob/master/docs/select-query-builder.md)
- [Database Query Optimization](https://use-the-index-luke.com/)
- [TypeORM Caching](https://typeorm.io/caching)