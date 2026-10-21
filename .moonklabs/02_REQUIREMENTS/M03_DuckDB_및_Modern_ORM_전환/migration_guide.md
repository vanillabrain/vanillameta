# M03: TypeORM → Drizzle 마이그레이션 가이드

## 1. 엔티티 변환 가이드

### 1.1 기본 엔티티 변환

#### Users 엔티티
```typescript
// TypeORM (현재)
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Dashboard } from './dashboard.entity';

@Entity('users')
export class Users {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  password: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Dashboard, dashboard => dashboard.user)
  dashboards: Dashboard[];
}
```

```typescript
// Drizzle ORM (목표)
import { pgTable, serial, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  password: text('password'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const usersRelations = relations(users, ({ many }) => ({
  dashboards: many(dashboards)
}));

// 타입 추론
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

#### Dashboard 엔티티
```typescript
// TypeORM (현재)
@Entity('dashboards')
export class Dashboard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  config: any;

  @Column()
  userId: number;

  @ManyToOne(() => Users, user => user.dashboards)
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @OneToMany(() => Widget, widget => widget.dashboard)
  widgets: Widget[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

```typescript
// Drizzle ORM (목표)
export const dashboards = pgTable('dashboards', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  config: json('config').$type<DashboardConfig>(),
  userId: integer('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const dashboardsRelations = relations(dashboards, ({ one, many }) => ({
  user: one(users, {
    fields: [dashboards.userId],
    references: [users.id]
  }),
  widgets: many(widgets)
}));

// 타입 정의
export interface DashboardConfig {
  layout?: string;
  theme?: string;
  refreshInterval?: number;
}
```

### 1.2 복잡한 관계 변환

#### Many-to-Many 관계 (Widget Tags)
```typescript
// TypeORM (현재)
@Entity('widgets')
export class Widget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'widget_tags',
    joinColumn: { name: 'widget_id' },
    inverseJoinColumn: { name: 'tag_id' }
  })
  tags: Tag[];
}

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;
}
```

```typescript
// Drizzle ORM (목표)
export const widgets = pgTable('widgets', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  // ... 다른 필드들
});

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique()
});

export const widgetTags = pgTable('widget_tags', {
  widgetId: integer('widget_id').notNull().references(() => widgets.id),
  tagId: integer('tag_id').notNull().references(() => tags.id)
}, (table) => {
  return {
    pk: primaryKey(table.widgetId, table.tagId)
  };
});

export const widgetsRelations = relations(widgets, ({ many }) => ({
  widgetTags: many(widgetTags)
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  widgetTags: many(widgetTags)
}));

export const widgetTagsRelations = relations(widgetTags, ({ one }) => ({
  widget: one(widgets, {
    fields: [widgetTags.widgetId],
    references: [widgets.id]
  }),
  tag: one(tags, {
    fields: [widgetTags.tagId],
    references: [tags.id]
  })
}));
```

### 1.3 커스텀 타입 변환

```typescript
// TypeORM (현재)
export enum WidgetType {
  CHART = 'chart',
  TABLE = 'table',
  METRIC = 'metric'
}

@Entity()
export class Widget {
  @Column({
    type: 'enum',
    enum: WidgetType,
    default: WidgetType.CHART
  })
  type: WidgetType;

  @Column('simple-array')
  permissions: string[];

  @Column('simple-json')
  metadata: { key: string; value: any }[];
}
```

```typescript
// Drizzle ORM (목표)
import { pgEnum } from 'drizzle-orm/pg-core';

export const widgetTypeEnum = pgEnum('widget_type', ['chart', 'table', 'metric']);

export const widgets = pgTable('widgets', {
  type: widgetTypeEnum('type').default('chart').notNull(),
  permissions: text('permissions').array(),
  metadata: json('metadata').$type<Array<{ key: string; value: any }>>()
});
```

## 2. 쿼리 패턴 변환

### 2.1 기본 CRUD 작업

#### CREATE
```typescript
// TypeORM
const user = userRepository.create({
  email: 'user@example.com',
  name: 'John Doe'
});
await userRepository.save(user);

// Drizzle
const [user] = await db
  .insert(users)
  .values({
    email: 'user@example.com',
    name: 'John Doe'
  })
  .returning();
```

#### READ
```typescript
// TypeORM - 단일 조회
const user = await userRepository.findOne({
  where: { id: 1 },
  relations: ['dashboards']
});

// Drizzle - 단일 조회
const user = await db.query.users.findFirst({
  where: eq(users.id, 1),
  with: {
    dashboards: true
  }
});

// TypeORM - 복수 조회
const activeUsers = await userRepository.find({
  where: { active: true },
  order: { createdAt: 'DESC' },
  take: 10,
  skip: 0
});

// Drizzle - 복수 조회
const activeUsers = await db
  .select()
  .from(users)
  .where(eq(users.active, true))
  .orderBy(desc(users.createdAt))
  .limit(10)
  .offset(0);
```

#### UPDATE
```typescript
// TypeORM
await userRepository.update(
  { id: 1 },
  { name: 'Jane Doe', updatedAt: new Date() }
);

// Drizzle
await db
  .update(users)
  .set({ 
    name: 'Jane Doe', 
    updatedAt: new Date() 
  })
  .where(eq(users.id, 1));
```

#### DELETE
```typescript
// TypeORM
await userRepository.delete({ id: 1 });

// Drizzle
await db
  .delete(users)
  .where(eq(users.id, 1));
```

### 2.2 복잡한 쿼리 변환

#### 조인 쿼리
```typescript
// TypeORM
const dashboardsWithWidgets = await dashboardRepository
  .createQueryBuilder('dashboard')
  .leftJoinAndSelect('dashboard.widgets', 'widget')
  .leftJoinAndSelect('dashboard.user', 'user')
  .where('dashboard.userId = :userId', { userId: 1 })
  .andWhere('widget.type = :type', { type: 'chart' })
  .getMany();

// Drizzle
const dashboardsWithWidgets = await db
  .select({
    dashboard: dashboards,
    widget: widgets,
    user: users
  })
  .from(dashboards)
  .leftJoin(widgets, eq(widgets.dashboardId, dashboards.id))
  .leftJoin(users, eq(dashboards.userId, users.id))
  .where(and(
    eq(dashboards.userId, 1),
    eq(widgets.type, 'chart')
  ));
```

#### 집계 쿼리
```typescript
// TypeORM
const stats = await widgetRepository
  .createQueryBuilder('widget')
  .select('widget.type', 'type')
  .addSelect('COUNT(*)', 'count')
  .addSelect('AVG(CAST(widget.config->>\'refreshInterval\' AS INTEGER))', 'avgRefresh')
  .groupBy('widget.type')
  .getRawMany();

// Drizzle
const stats = await db
  .select({
    type: widgets.type,
    count: count(widgets.id),
    avgRefresh: avg(
      sql`CAST(${widgets.config}->>'refreshInterval' AS INTEGER)`
    )
  })
  .from(widgets)
  .groupBy(widgets.type);
```

### 2.3 Raw Query 실행

```typescript
// TypeORM
const result = await entityManager.query(`
  SELECT u.*, COUNT(d.id) as dashboard_count
  FROM users u
  LEFT JOIN dashboards d ON u.id = d.user_id
  GROUP BY u.id
  HAVING COUNT(d.id) > $1
`, [5]);

// Drizzle
const result = await db.execute(sql`
  SELECT u.*, COUNT(d.id) as dashboard_count
  FROM users u
  LEFT JOIN dashboards d ON u.id = d.user_id
  GROUP BY u.id
  HAVING COUNT(d.id) > ${5}
`);
```

### 2.4 트랜잭션 처리

```typescript
// TypeORM
await getManager().transaction(async transactionalEntityManager => {
  const user = await transactionalEntityManager.save(Users, {
    email: 'new@example.com',
    name: 'New User'
  });
  
  await transactionalEntityManager.save(Dashboard, {
    name: 'My Dashboard',
    userId: user.id
  });
});

// Drizzle
await db.transaction(async (tx) => {
  const [user] = await tx
    .insert(users)
    .values({
      email: 'new@example.com',
      name: 'New User'
    })
    .returning();
  
  await tx
    .insert(dashboards)
    .values({
      name: 'My Dashboard',
      userId: user.id
    });
});
```

## 3. 서비스 레이어 변환

### 3.1 Repository 패턴 대체

```typescript
// TypeORM 서비스 (현재)
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>
  ) {}

  async findByEmail(email: string): Promise<Users | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['dashboards']
    });
  }

  async createUser(data: CreateUserDto): Promise<Users> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }
}
```

```typescript
// Drizzle 서비스 (목표)
@Injectable()
export class UserService {
  constructor(
    @Inject('DATABASE') private db: DrizzleDB
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.email, email),
      with: {
        dashboards: true
      }
    });
    return result || null;
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(data)
      .returning();
    return user;
  }
}
```

### 3.2 복잡한 비즈니스 로직

```typescript
// 대시보드 복사 기능
// TypeORM (현재)
async cloneDashboard(dashboardId: number, userId: number): Promise<Dashboard> {
  return getManager().transaction(async manager => {
    const original = await manager.findOne(Dashboard, dashboardId, {
      relations: ['widgets']
    });
    
    if (!original) {
      throw new NotFoundException();
    }

    const newDashboard = manager.create(Dashboard, {
      ...original,
      id: undefined,
      name: `${original.name} (Copy)`,
      userId,
      widgets: []
    });
    
    const savedDashboard = await manager.save(newDashboard);
    
    for (const widget of original.widgets) {
      await manager.save(Widget, {
        ...widget,
        id: undefined,
        dashboardId: savedDashboard.id
      });
    }
    
    return savedDashboard;
  });
}
```

```typescript
// Drizzle (목표)
async cloneDashboard(dashboardId: number, userId: number): Promise<Dashboard> {
  return this.db.transaction(async (tx) => {
    // 원본 조회
    const original = await tx.query.dashboards.findFirst({
      where: eq(dashboards.id, dashboardId),
      with: {
        widgets: true
      }
    });
    
    if (!original) {
      throw new NotFoundException();
    }

    // 대시보드 복사
    const [newDashboard] = await tx
      .insert(dashboards)
      .values({
        name: `${original.name} (Copy)`,
        description: original.description,
        config: original.config,
        userId
      })
      .returning();
    
    // 위젯 복사
    if (original.widgets.length > 0) {
      await tx
        .insert(widgets)
        .values(
          original.widgets.map(widget => ({
            name: widget.name,
            type: widget.type,
            config: widget.config,
            dashboardId: newDashboard.id,
            datasetId: widget.datasetId
          }))
        );
    }
    
    return newDashboard;
  });
}
```

## 4. 마이그레이션 체크리스트

### 4.1 준비 단계
- [ ] Drizzle ORM 및 DuckDB 의존성 설치
- [ ] Drizzle 설정 파일 생성 (`drizzle.config.ts`)
- [ ] 데이터베이스 연결 설정 구현
- [ ] 스키마 디렉토리 구조 생성

### 4.2 스키마 변환
- [ ] 모든 TypeORM 엔티티를 Drizzle 스키마로 변환
  - [ ] users 테이블
  - [ ] dashboards 테이블
  - [ ] widgets 테이블
  - [ ] datasets 테이블
  - [ ] connections 테이블
  - [ ] 기타 테이블들
- [ ] 관계(relations) 정의
- [ ] 인덱스 정의
- [ ] 커스텀 타입 정의

### 4.3 서비스 레이어 변환
- [ ] 기본 CRUD 메서드 변환
  - [ ] UserService
  - [ ] DashboardService
  - [ ] WidgetService
  - [ ] DatasetService
  - [ ] ConnectionService
- [ ] 복잡한 쿼리 최적화
- [ ] 트랜잭션 처리 변환
- [ ] Raw query 실행 부분 변환

### 4.4 테스트 업데이트
- [ ] 단위 테스트 수정
- [ ] 통합 테스트 수정
- [ ] E2E 테스트 검증
- [ ] 성능 테스트 실행

### 4.5 데이터 마이그레이션
- [ ] 마이그레이션 스크립트 작성
- [ ] 테스트 환경에서 마이그레이션 실행
- [ ] 데이터 무결성 검증
- [ ] 성능 벤치마크

### 4.6 배포 준비
- [ ] Docker 이미지 업데이트
- [ ] Lambda 함수 설정 업데이트
- [ ] 환경 변수 설정
- [ ] 롤백 계획 수립

### 4.7 배포 및 모니터링
- [ ] 개발 환경 배포
- [ ] 스테이징 환경 테스트
- [ ] 프로덕션 배포
- [ ] 모니터링 설정
- [ ] 성능 메트릭 확인

## 5. 일반적인 문제 해결

### 5.1 타입 관련 이슈

```typescript
// 문제: TypeORM의 DeepPartial 타입 대체
// TypeORM
update(id: number, data: DeepPartial<User>)

// Drizzle - 직접 타입 정의
type UpdateUser = Partial<Omit<User, 'id' | 'createdAt'>>;
update(id: number, data: UpdateUser)
```

### 5.2 Lazy Loading 대체

```typescript
// TypeORM - Lazy relations
@OneToMany(() => Widget, widget => widget.dashboard)
widgets: Promise<Widget[]>;

// Drizzle - Explicit loading
const dashboardWithWidgets = await db.query.dashboards.findFirst({
  where: eq(dashboards.id, id),
  with: {
    widgets: true  // 명시적으로 로드
  }
});
```

### 5.3 QueryBuilder 대체

```typescript
// 복잡한 동적 쿼리
function buildDynamicQuery(filters: FilterDto) {
  const conditions = [];
  
  if (filters.name) {
    conditions.push(like(widgets.name, `%${filters.name}%`));
  }
  
  if (filters.types?.length) {
    conditions.push(inArray(widgets.type, filters.types));
  }
  
  if (filters.dateFrom) {
    conditions.push(gte(widgets.createdAt, filters.dateFrom));
  }
  
  return db
    .select()
    .from(widgets)
    .where(and(...conditions));
}
```

## 6. 성능 최적화 팁

### 6.1 Select 최적화
```typescript
// 필요한 컬럼만 선택
const users = await db
  .select({
    id: users.id,
    email: users.email,
    dashboardCount: count(dashboards.id)
  })
  .from(users)
  .leftJoin(dashboards, eq(users.id, dashboards.userId))
  .groupBy(users.id);
```

### 6.2 Batch Operations
```typescript
// 대량 삽입
const widgets = Array.from({ length: 1000 }, (_, i) => ({
  name: `Widget ${i}`,
  type: 'chart',
  dashboardId: 1
}));

// 배치로 나누어 삽입
const batchSize = 100;
for (let i = 0; i < widgets.length; i += batchSize) {
  await db
    .insert(widgets)
    .values(widgets.slice(i, i + batchSize));
}
```

### 6.3 인덱스 활용
```typescript
// 스키마에 인덱스 정의
export const widgets = pgTable('widgets', {
  // ... columns
}, (table) => {
  return {
    typeIdx: index('idx_widgets_type').on(table.type),
    userDashboardIdx: index('idx_widgets_user_dashboard')
      .on(table.userId, table.dashboardId)
  };
});
```