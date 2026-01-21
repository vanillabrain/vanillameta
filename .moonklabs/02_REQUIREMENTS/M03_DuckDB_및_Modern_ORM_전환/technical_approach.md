# M03: 기술적 접근 방법

## 1. ORM 선택 분석

### 1.1 Drizzle ORM (권장 ✅)

#### 장점
- **DuckDB 공식 지원**: 네이티브 어댑터 제공
- **TypeScript First**: 컴파일 타임 타입 안정성
- **SQL-like API**: SQL에 가까운 직관적인 문법
- **Raw Query 우수**: `db.execute()` 로 간편한 실행
- **경량**: 번들 크기 작음
- **성능**: 최소한의 추상화로 빠른 실행

#### 단점
- 상대적으로 새로운 ORM (2022년 출시)
- 일부 고급 기능 부족
- 커뮤니티 규모가 작음

#### 코드 예시
```typescript
// 스키마 정의
import { pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// 쿼리 실행
const activeUsers = await db
  .select()
  .from(users)
  .where(eq(users.active, true));

// Raw Query
const result = await db.execute(sql`
  SELECT u.*, COUNT(d.id) as dashboard_count
  FROM users u
  LEFT JOIN dashboards d ON u.id = d.user_id
  GROUP BY u.id
`);
```

### 1.2 Kysely (대안)

#### 장점
- **Type-safe 쿼리 빌더**: 완전한 타입 추론
- **DuckDB 지원**: 커뮤니티 어댑터 존재
- **유연성**: 쿼리 빌더와 raw SQL 균형

#### 단점
- 스키마 정의가 번거로움
- 마이그레이션 도구 별도 필요
- ORM보다는 쿼리 빌더에 가까움

### 1.3 Prisma (비권장)

#### 장점
- 가장 큰 커뮤니티
- 훌륭한 개발자 경험
- 강력한 마이그레이션 도구

#### 단점
- **DuckDB 미지원**: 커뮤니티 어댑터만 존재
- Raw query 실행이 불편
- 무거운 추상화 레이어
- 빌드 시간 증가

### 1.4 최종 권장: Drizzle ORM

**선택 이유:**
1. DuckDB 공식 지원으로 안정성 보장
2. Raw query 실행이 매우 간편
3. TypeScript 지원 우수
4. 가벼운 추상화로 성능 최적화
5. SQL에 가까운 API로 학습 곡선 낮음

## 2. DuckDB 설정 방법

### 2.1 개발 환경 설정

```typescript
// src/infrastructure/database/duckdb.config.ts
import { Database } from 'duckdb';
import { drizzle } from 'drizzle-orm/duckdb';

export interface DuckDBConfig {
  path: string;
  memory_limit?: string;
  threads?: number;
  access_mode?: 'READ_WRITE' | 'READ_ONLY';
}

export function createDuckDBConnection(config: DuckDBConfig) {
  const db = new Database(config.path, {
    memory_limit: config.memory_limit || '256MB',
    threads: config.threads || 4,
    access_mode: config.access_mode || 'READ_WRITE'
  });

  // 초기 설정
  db.run(`
    SET memory_limit='${config.memory_limit || '256MB'}';
    SET threads=${config.threads || 4};
    SET preserve_insertion_order=false;
    SET enable_progress_bar=false;
  `);

  return drizzle(db);
}
```

### 2.2 환경별 설정

```typescript
// src/infrastructure/database/config.ts
export const duckdbConfig = {
  local: {
    path: './data/vanillameta.duckdb',
    memory_limit: '512MB',
    threads: 8
  },
  development: {
    path: process.env.DUCKDB_PATH || '/app/data/vanillameta.duckdb',
    memory_limit: '256MB',
    threads: 4
  },
  production: {
    path: '/mnt/efs/duckdb/vanillameta.duckdb',
    memory_limit: '256MB',
    threads: 4,
    access_mode: 'READ_WRITE'
  }
};
```

## 3. 마이그레이션 단계별 계획

### Phase 1: 환경 준비 (3일)

#### Day 1: 개발 환경 설정
```bash
# 의존성 설치
yarn add drizzle-orm duckdb @duckdb/node
yarn add -D drizzle-kit @types/duckdb

# 프로젝트 구조 생성
mkdir -p src/infrastructure/drizzle/{schema,migrations}
```

#### Day 2: Drizzle 설정
```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/infrastructure/drizzle/schema/*',
  out: './src/infrastructure/drizzle/migrations',
  driver: 'duckdb',
  dbCredentials: {
    path: process.env.DUCKDB_PATH || './data/vanillameta.duckdb'
  }
} satisfies Config;
```

#### Day 3: PoC 및 성능 테스트
- 간단한 CRUD 작업 구현
- 성능 벤치마크 실행
- 문제점 파악 및 해결

### Phase 2: 스키마 마이그레이션 (5일)

#### Day 4-5: 엔티티 변환
```typescript
// TypeORM (현재)
@Entity('users')
export class Users {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Dashboard, dashboard => dashboard.user)
  dashboards: Dashboard[];
}

// Drizzle ORM (목표)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const usersRelations = relations(users, ({ many }) => ({
  dashboards: many(dashboards)
}));
```

#### Day 6-7: 복잡한 관계 처리
- Many-to-Many 관계 변환
- 복합 인덱스 정의
- 커스텀 타입 매핑

#### Day 8: 마이그레이션 스크립트 생성
```bash
# 초기 마이그레이션 생성
yarn drizzle-kit generate:duckdb

# 마이그레이션 실행
yarn drizzle-kit push:duckdb
```

### Phase 3: 서비스 레이어 마이그레이션 (7일)

#### Day 9-11: 기본 CRUD 서비스
```typescript
// src/modules/users/users.service.ts (Drizzle 버전)
import { Injectable } from '@nestjs/common';
import { db } from '@/infrastructure/database';
import { users } from '@/infrastructure/drizzle/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
  async findOne(id: number) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return result[0];
  }

  async findAll() {
    return db.select().from(users);
  }

  async create(data: CreateUserDto) {
    const result = await db
      .insert(users)
      .values(data)
      .returning();
    
    return result[0];
  }

  async update(id: number, data: UpdateUserDto) {
    const result = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    
    return result[0];
  }

  async remove(id: number) {
    await db
      .delete(users)
      .where(eq(users.id, id));
  }
}
```

#### Day 12-14: 복잡한 쿼리 최적화
```typescript
// 대시보드 통계 쿼리
async getDashboardStats(userId: number) {
  return db.execute(sql`
    WITH dashboard_metrics AS (
      SELECT 
        d.id,
        d.name,
        COUNT(DISTINCT w.id) as widget_count,
        MAX(w.updated_at) as last_updated,
        COUNT(DISTINCT ds.id) as dataset_count
      FROM dashboards d
      LEFT JOIN widgets w ON d.id = w.dashboard_id
      LEFT JOIN datasets ds ON w.dataset_id = ds.id
      WHERE d.user_id = ${userId}
      GROUP BY d.id, d.name
    )
    SELECT 
      dm.*,
      RANK() OVER (ORDER BY widget_count DESC) as popularity_rank
    FROM dashboard_metrics dm
    ORDER BY last_updated DESC
  `);
}
```

#### Day 15: Raw Query 헬퍼 구현
```typescript
// src/infrastructure/database/query-helpers.ts
export class QueryHelpers {
  static async executeRaw<T>(query: string, params?: any[]): Promise<T[]> {
    return db.execute(sql.raw(query, params));
  }

  static async transaction<T>(
    callback: (tx: Transaction) => Promise<T>
  ): Promise<T> {
    return db.transaction(callback);
  }

  static buildDynamicQuery(
    baseQuery: string,
    conditions: Record<string, any>
  ): string {
    // 동적 쿼리 빌더 구현
  }
}
```

### Phase 4: 테스트 및 검증 (3일)

#### Day 16: 단위 테스트 작성
```typescript
// users.service.spec.ts
describe('UsersService (Drizzle)', () => {
  let service: UsersService;
  let db: DrizzleDB;

  beforeEach(async () => {
    // 테스트 DB 설정
    db = createDuckDBConnection({
      path: ':memory:',
      memory_limit: '128MB'
    });

    // 스키마 생성
    await db.execute(sql`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  it('should create a user', async () => {
    const user = await service.create({
      email: 'test@example.com',
      name: 'Test User'
    });

    expect(user).toHaveProperty('id');
    expect(user.email).toBe('test@example.com');
  });
});
```

#### Day 17: 통합 테스트
- E2E 테스트 실행
- API 응답 검증
- 성능 측정

#### Day 18: 데이터 마이그레이션
```typescript
// scripts/migrate-data.ts
async function migrateData() {
  const sqlite = new SQLiteDB('./data/old.sqlite');
  const duckdb = createDuckDBConnection({
    path: './data/new.duckdb'
  });

  // 1. 스키마 생성
  await createSchema(duckdb);

  // 2. 데이터 복사
  const tables = ['users', 'dashboards', 'widgets', 'datasets'];
  
  for (const table of tables) {
    console.log(`Migrating ${table}...`);
    
    const data = await sqlite.all(`SELECT * FROM ${table}`);
    const batchSize = 1000;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await duckdb.insert(table).values(batch);
    }
    
    console.log(`Migrated ${data.length} rows`);
  }

  // 3. 검증
  await validateMigration(sqlite, duckdb);
}
```

## 4. Docker 및 Lambda 설정

### 4.1 Docker 설정

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

# DuckDB 빌드 의존성
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# 의존성 설치
COPY package*.json yarn.lock ./
RUN yarn install --frozen-lockfile

# 소스 코드 복사 및 빌드
COPY . .
RUN yarn build

# Production 이미지
FROM node:18-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Production 의존성만 설치
COPY package*.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

# 빌드된 코드 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# DuckDB 데이터 디렉토리
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV DUCKDB_PATH=/app/data/vanillameta.duckdb

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### 4.2 Lambda 설정

```typescript
// serverless.yml
service: vanillameta-api

provider:
  name: aws
  runtime: nodejs18.x
  region: ap-northeast-2
  memorySize: 256
  timeout: 30
  environment:
    NODE_ENV: production
    DUCKDB_PATH: /mnt/efs/duckdb/vanillameta.duckdb
    DUCKDB_MEMORY_LIMIT: 256MB

functions:
  api:
    handler: dist/serverless.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
    fileSystemConfig:
      localMountPath: /mnt/efs
      arn: ${env:EFS_ARN}
    layers:
      - ${env:LAMBDA_LAYER_ARN}

plugins:
  - serverless-plugin-optimize
  - serverless-offline

custom:
  optimize:
    external: ['duckdb', '@duckdb/node']
```

### 4.3 Lambda Layer 생성

```bash
# scripts/create-lambda-layer.sh
#!/bin/bash

# Layer 디렉토리 생성
mkdir -p lambda-layer/nodejs

# 필요한 네이티브 의존성 복사
cp -r node_modules/duckdb lambda-layer/nodejs/
cp -r node_modules/@duckdb lambda-layer/nodejs/

# Layer ZIP 생성
cd lambda-layer
zip -r ../duckdb-layer.zip .

# S3 업로드 및 Layer 생성
aws s3 cp ../duckdb-layer.zip s3://vanillameta-layers/
aws lambda publish-layer-version \
  --layer-name vanillameta-duckdb \
  --content S3Bucket=vanillameta-layers,S3Key=duckdb-layer.zip \
  --compatible-runtimes nodejs18.x
```

## 5. 코드 예시

### 5.1 복잡한 대시보드 쿼리

```typescript
// src/modules/dashboard/dashboard.service.ts
async getDetailedDashboard(dashboardId: number) {
  // Drizzle ORM with DuckDB 최적화
  const result = await db.execute(sql`
    WITH RECURSIVE
    -- 위젯 계층 구조
    widget_hierarchy AS (
      SELECT 
        w.id,
        w.parent_id,
        w.name,
        w.type,
        w.config,
        1 as level,
        ARRAY[w.id] as path
      FROM widgets w
      WHERE w.dashboard_id = ${dashboardId} AND w.parent_id IS NULL
      
      UNION ALL
      
      SELECT 
        w.id,
        w.parent_id,
        w.name,
        w.type,
        w.config,
        wh.level + 1,
        wh.path || w.id
      FROM widgets w
      JOIN widget_hierarchy wh ON w.parent_id = wh.id
    ),
    -- 위젯별 데이터 집계
    widget_metrics AS (
      SELECT 
        w.id,
        COUNT(DISTINCT wd.id) as data_points,
        MAX(wd.created_at) as last_updated,
        SUM(wd.value) as total_value,
        AVG(wd.value) as avg_value
      FROM widget_hierarchy w
      LEFT JOIN widget_data wd ON w.id = wd.widget_id
      GROUP BY w.id
    )
    -- 최종 결과 조합
    SELECT 
      d.id,
      d.name,
      d.description,
      d.config,
      JSON_GROUP_ARRAY(
        JSON_OBJECT(
          'id', wh.id,
          'name', wh.name,
          'type', wh.type,
          'level', wh.level,
          'path', wh.path,
          'metrics', JSON_OBJECT(
            'dataPoints', wm.data_points,
            'lastUpdated', wm.last_updated,
            'totalValue', wm.total_value,
            'avgValue', wm.avg_value
          )
        )
      ) as widgets
    FROM dashboards d
    LEFT JOIN widget_hierarchy wh ON true
    LEFT JOIN widget_metrics wm ON wh.id = wm.id
    WHERE d.id = ${dashboardId}
    GROUP BY d.id, d.name, d.description, d.config
  `);

  return result[0];
}
```

### 5.2 동적 필터링 with Type Safety

```typescript
// src/modules/widget/widget.service.ts
interface WidgetFilter {
  type?: string[];
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  userId?: number;
}

async findWidgetsWithFilter(filter: WidgetFilter) {
  const conditions = [];
  
  if (filter.type?.length) {
    conditions.push(inArray(widgets.type, filter.type));
  }
  
  if (filter.tags?.length) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM widget_tags wt 
        WHERE wt.widget_id = ${widgets.id} 
        AND wt.tag IN (${sql.join(filter.tags, sql`, `)})
      )`
    );
  }
  
  if (filter.dateRange) {
    conditions.push(
      and(
        gte(widgets.createdAt, filter.dateRange.start),
        lte(widgets.createdAt, filter.dateRange.end)
      )
    );
  }
  
  if (filter.userId) {
    conditions.push(eq(widgets.userId, filter.userId));
  }

  return db
    .select({
      widget: widgets,
      dashboard: dashboards,
      dataset: datasets
    })
    .from(widgets)
    .leftJoin(dashboards, eq(widgets.dashboardId, dashboards.id))
    .leftJoin(datasets, eq(widgets.datasetId, datasets.id))
    .where(and(...conditions))
    .orderBy(desc(widgets.createdAt));
}
```

### 5.3 트랜잭션 처리

```typescript
// src/modules/dashboard/dashboard.service.ts
async cloneDashboard(dashboardId: number, userId: number) {
  return db.transaction(async (tx) => {
    // 1. 원본 대시보드 조회
    const [original] = await tx
      .select()
      .from(dashboards)
      .where(eq(dashboards.id, dashboardId));
    
    if (!original) {
      throw new NotFoundException('Dashboard not found');
    }

    // 2. 새 대시보드 생성
    const [newDashboard] = await tx
      .insert(dashboards)
      .values({
        ...original,
        id: undefined,
        name: `${original.name} (Copy)`,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // 3. 위젯 복사
    const originalWidgets = await tx
      .select()
      .from(widgets)
      .where(eq(widgets.dashboardId, dashboardId));

    if (originalWidgets.length > 0) {
      await tx
        .insert(widgets)
        .values(
          originalWidgets.map(widget => ({
            ...widget,
            id: undefined,
            dashboardId: newDashboard.id,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        );
    }

    return newDashboard;
  });
}
```

## 6. 성능 최적화 팁

### 6.1 DuckDB 특화 최적화

```typescript
// 컬럼 프로젝션 최적화
const optimizedQuery = sql`
  SELECT 
    -- 필요한 컬럼만 선택
    id, name, type, config->>'chartType' as chart_type
  FROM widgets
  WHERE dashboard_id = ${dashboardId}
  -- DuckDB는 FILTER 절 최적화가 뛰어남
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
`;

// 파티션 활용
const partitionedQuery = sql`
  SELECT * FROM widgets
  WHERE year(created_at) = 2024
  AND month(created_at) = 1
  -- DuckDB는 자동으로 파티션 프루닝 수행
`;
```

### 6.2 연결 풀 관리

```typescript
// src/infrastructure/database/connection-pool.ts
class DuckDBConnectionPool {
  private connections: Map<string, DrizzleDB> = new Map();
  
  getConnection(config: DuckDBConfig): DrizzleDB {
    const key = `${config.path}:${config.access_mode}`;
    
    if (!this.connections.has(key)) {
      const db = createDuckDBConnection(config);
      this.connections.set(key, db);
    }
    
    return this.connections.get(key)!;
  }
  
  async closeAll() {
    for (const [key, db] of this.connections) {
      await db.close();
      this.connections.delete(key);
    }
  }
}

export const dbPool = new DuckDBConnectionPool();
```

## 7. 모니터링 및 디버깅

### 7.1 쿼리 프로파일링

```typescript
// src/infrastructure/database/profiler.ts
export async function profileQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = process.hrtime.bigint();
  
  try {
    // DuckDB 프로파일링 활성화
    await db.execute(sql`PRAGMA enable_profiling`);
    
    const result = await queryFn();
    
    // 프로파일 결과 조회
    const profile = await db.execute(sql`
      SELECT * FROM duckdb_profiling_info() 
      WHERE query_name = ${queryName}
    `);
    
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // ms
    
    // CloudWatch 메트릭 전송
    await sendMetric('QueryExecutionTime', duration, {
      QueryName: queryName,
      RowCount: profile[0]?.row_count || 0
    });
    
    return result;
  } finally {
    await db.execute(sql`PRAGMA disable_profiling`);
  }
}
```

### 7.2 에러 처리

```typescript
// src/infrastructure/database/error-handler.ts
export class DuckDBErrorHandler {
  static handle(error: any): never {
    if (error.message?.includes('constraint')) {
      throw new ConflictException('Database constraint violation');
    }
    
    if (error.message?.includes('no such table')) {
      throw new InternalServerErrorException('Database schema error');
    }
    
    if (error.message?.includes('out of memory')) {
      throw new ServiceUnavailableException('Database memory limit exceeded');
    }
    
    throw new InternalServerErrorException('Database operation failed');
  }
}
```