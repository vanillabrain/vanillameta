# T03: Mock 및 Fixture 정리

## 태스크 정보
- **태스크 ID**: T03_S11
- **스프린트**: S11 - 테스트 인프라 긴급 복구
- **우선순위**: 중간
- **예상 소요 시간**: 1일
- **담당자**: Full Stack Developer

## 개요

테스트 환경에서 사용할 Mock 데이터와 Fixture를 체계적으로 구조화하여 일관되고 재사용 가능한 테스트 데이터 관리 시스템을 구축합니다. 백엔드와 프론트엔드 모두에서 활용할 수 있는 통합된 Mock 데이터 구조를 만들어야 합니다.

## 목표

1. 테스트용 Mock 데이터 구조화
2. Database Mock 설정
3. API Mock 설정
4. 재사용 가능한 Fixture 라이브러리 구축

## 세부 작업 계획

### 1. Mock 데이터 구조 설계
- [ ] 도메인별 Mock 데이터 스키마 정의
- [ ] 공통 Fixture 인터페이스 설계
- [ ] 데이터 팩토리 패턴 구현
- [ ] Mock 데이터 생성 유틸리티 작성

### 2. 백엔드 Database Mock 설정
- [ ] TypeORM 테스트용 In-Memory 데이터베이스 설정
- [ ] Entity별 Mock 데이터 생성기 구현
- [ ] 데이터베이스 시딩 스크립트 작성
- [ ] 테스트 간 데이터 격리 설정

### 3. API Mock 설정
- [ ] MSW (Mock Service Worker) 핸들러 구조화
- [ ] RESTful API 엔드포인트별 Mock 응답 정의
- [ ] 에러 케이스 Mock 시나리오 구성
- [ ] 동적 Mock 데이터 생성 로직

### 4. 프론트엔드 Mock 데이터 통합
- [ ] API 응답 Mock 데이터와 컴포넌트 Props Mock 데이터 연결
- [ ] Redux Store Mock 상태 정의
- [ ] 라우터 Mock 설정
- [ ] 외부 라이브러리 Mock 설정

### 5. Fixture 라이브러리 구축
- [ ] 공통 Fixture 생성 함수 라이브러리
- [ ] 시나리오별 데이터 세트 구성
- [ ] 테스트 케이스별 데이터 변형 유틸리티
- [ ] Mock 데이터 검증 헬퍼 함수

## 기술적 세부사항

### Mock 데이터 구조 예시

#### 공통 인터페이스
```typescript
// shared/types/test-fixtures.ts
export interface MockUser {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockDashboard {
  id: number;
  title: string;
  description?: string;
  userId: number;
  widgets: MockWidget[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockWidget {
  id: number;
  dashboardId: number;
  title: string;
  type: 'chart' | 'table' | 'metric' | 'text';
  config: Record<string, any>;
  position: { x: number; y: number; w: number; h: number };
  createdAt: Date;
  updatedAt: Date;
}
```

#### 데이터 팩토리
```typescript
// shared/test-utils/factories.ts
import { faker } from '@faker-js/faker';

export class MockDataFactory {
  static createUser(overrides: Partial<MockUser> = {}): MockUser {
    return {
      id: faker.number.int({ min: 1, max: 1000 }),
      email: faker.internet.email(),
      username: faker.internet.userName(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: faker.helpers.arrayElement(['admin', 'user', 'viewer']),
      isActive: faker.datatype.boolean(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  static createDashboard(overrides: Partial<MockDashboard> = {}): MockDashboard {
    return {
      id: faker.number.int({ min: 1, max: 1000 }),
      title: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      userId: faker.number.int({ min: 1, max: 100 }),
      widgets: [],
      isPublic: faker.datatype.boolean(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  static createWidget(overrides: Partial<MockWidget> = {}): MockWidget {
    return {
      id: faker.number.int({ min: 1, max: 1000 }),
      dashboardId: faker.number.int({ min: 1, max: 100 }),
      title: faker.lorem.words(2),
      type: faker.helpers.arrayElement(['chart', 'table', 'metric', 'text']),
      config: {
        query: faker.lorem.sentence(),
        visualization: faker.lorem.word()
      },
      position: {
        x: faker.number.int({ min: 0, max: 10 }),
        y: faker.number.int({ min: 0, max: 10 }),
        w: faker.number.int({ min: 2, max: 6 }),
        h: faker.number.int({ min: 2, max: 4 })
      },
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }
}
```

### 백엔드 Database Mock 설정

#### TypeORM 테스트 데이터베이스
```typescript
// backend-api/test/database/test-database.ts
import { DataSource } from 'typeorm';
import { User } from '../../src/entities/User';
import { Dashboard } from '../../src/entities/Dashboard';
import { Widget } from '../../src/entities/Widget';

export const createTestDatabase = async (): Promise<DataSource> => {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [User, Dashboard, Widget],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();
  return dataSource;
};

export const seedTestDatabase = async (dataSource: DataSource) => {
  const userRepository = dataSource.getRepository(User);
  const dashboardRepository = dataSource.getRepository(Dashboard);
  const widgetRepository = dataSource.getRepository(Widget);

  // 기본 사용자 생성
  const users = await userRepository.save([
    MockDataFactory.createUser({ email: 'admin@test.com', role: 'admin' }),
    MockDataFactory.createUser({ email: 'user@test.com', role: 'user' }),
  ]);

  // 기본 대시보드 생성
  const dashboards = await dashboardRepository.save([
    MockDataFactory.createDashboard({ userId: users[0].id, title: 'Admin Dashboard' }),
    MockDataFactory.createDashboard({ userId: users[1].id, title: 'User Dashboard' }),
  ]);

  // 기본 위젯 생성
  await widgetRepository.save([
    MockDataFactory.createWidget({ dashboardId: dashboards[0].id, type: 'chart' }),
    MockDataFactory.createWidget({ dashboardId: dashboards[0].id, type: 'table' }),
    MockDataFactory.createWidget({ dashboardId: dashboards[1].id, type: 'metric' }),
  ]);

  return { users, dashboards };
};
```

#### 테스트 헬퍼
```typescript
// backend-api/test/helpers/database-helper.ts
import { DataSource } from 'typeorm';
import { createTestDatabase, seedTestDatabase } from '../database/test-database';

export class DatabaseTestHelper {
  private static instance: DatabaseTestHelper;
  private dataSource: DataSource | null = null;

  static getInstance(): DatabaseTestHelper {
    if (!DatabaseTestHelper.instance) {
      DatabaseTestHelper.instance = new DatabaseTestHelper();
    }
    return DatabaseTestHelper.instance;
  }

  async setupDatabase(): Promise<DataSource> {
    if (this.dataSource) {
      await this.cleanDatabase();
    } else {
      this.dataSource = await createTestDatabase();
    }
    await seedTestDatabase(this.dataSource);
    return this.dataSource;
  }

  async cleanDatabase(): Promise<void> {
    if (!this.dataSource) return;

    const entities = this.dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = this.dataSource.getRepository(entity.name);
      await repository.clear();
    }
  }

  async closeDatabase(): Promise<void> {
    if (this.dataSource) {
      await this.dataSource.destroy();
      this.dataSource = null;
    }
  }
}
```

### 프론트엔드 API Mock 설정

#### MSW 핸들러 구조화
```typescript
// frontend-web/src/mocks/handlers/index.ts
import { authHandlers } from './auth';
import { dashboardHandlers } from './dashboard';
import { widgetHandlers } from './widget';
import { userHandlers } from './user';

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...widgetHandlers,
  ...userHandlers,
];
```

#### Dashboard API Mock
```typescript
// frontend-web/src/mocks/handlers/dashboard.ts
import { rest } from 'msw';
import { MockDataFactory } from '../../../../shared/test-utils/factories';

const mockDashboards = Array.from({ length: 5 }, () => 
  MockDataFactory.createDashboard()
);

export const dashboardHandlers = [
  rest.get('/api/dashboards', (req, res, ctx) => {
    const page = Number(req.url.searchParams.get('page')) || 1;
    const limit = Number(req.url.searchParams.get('limit')) || 10;
    
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return res(
      ctx.status(200),
      ctx.json({
        data: mockDashboards.slice(start, end),
        total: mockDashboards.length,
        page,
        limit
      })
    );
  }),

  rest.get('/api/dashboards/:id', (req, res, ctx) => {
    const { id } = req.params;
    const dashboard = mockDashboards.find(d => d.id === Number(id));
    
    if (!dashboard) {
      return res(ctx.status(404), ctx.json({ message: 'Dashboard not found' }));
    }
    
    return res(ctx.status(200), ctx.json(dashboard));
  }),

  rest.post('/api/dashboards', (req, res, ctx) => {
    const newDashboard = MockDataFactory.createDashboard({
      id: mockDashboards.length + 1,
      ...(req.body as Partial<MockDashboard>)
    });
    
    mockDashboards.push(newDashboard);
    return res(ctx.status(201), ctx.json(newDashboard));
  }),

  rest.put('/api/dashboards/:id', (req, res, ctx) => {
    const { id } = req.params;
    const index = mockDashboards.findIndex(d => d.id === Number(id));
    
    if (index === -1) {
      return res(ctx.status(404), ctx.json({ message: 'Dashboard not found' }));
    }
    
    mockDashboards[index] = {
      ...mockDashboards[index],
      ...(req.body as Partial<MockDashboard>),
      updatedAt: new Date()
    };
    
    return res(ctx.status(200), ctx.json(mockDashboards[index]));
  }),

  rest.delete('/api/dashboards/:id', (req, res, ctx) => {
    const { id } = req.params;
    const index = mockDashboards.findIndex(d => d.id === Number(id));
    
    if (index === -1) {
      return res(ctx.status(404), ctx.json({ message: 'Dashboard not found' }));
    }
    
    mockDashboards.splice(index, 1);
    return res(ctx.status(204));
  }),
];
```

### Redux Store Mock
```typescript
// frontend-web/src/test-utils/mock-store.ts
import { configureStore } from '@reduxjs/toolkit';
import { MockDataFactory } from '../../../shared/test-utils/factories';

export const createMockStore = (initialState = {}) => {
  const mockState = {
    auth: {
      user: MockDataFactory.createUser(),
      token: 'mock-token',
      isAuthenticated: true,
      loading: false,
      error: null
    },
    dashboard: {
      dashboards: Array.from({ length: 3 }, () => MockDataFactory.createDashboard()),
      currentDashboard: null,
      loading: false,
      error: null
    },
    widget: {
      widgets: Array.from({ length: 5 }, () => MockDataFactory.createWidget()),
      loading: false,
      error: null
    },
    ...initialState
  };

  return configureStore({
    reducer: {
      auth: (state = mockState.auth) => state,
      dashboard: (state = mockState.dashboard) => state,
      widget: (state = mockState.widget) => state,
    },
    preloadedState: mockState
  });
};
```

## 시나리오별 데이터 세트

### 인증 관련 시나리오
```typescript
// shared/test-utils/scenarios/auth.ts
export const authScenarios = {
  adminUser: () => MockDataFactory.createUser({ 
    role: 'admin', 
    email: 'admin@test.com' 
  }),
  
  regularUser: () => MockDataFactory.createUser({ 
    role: 'user', 
    email: 'user@test.com' 
  }),
  
  inactiveUser: () => MockDataFactory.createUser({ 
    isActive: false 
  }),
  
  userWithManyDashboards: () => {
    const user = MockDataFactory.createUser();
    const dashboards = Array.from({ length: 10 }, () => 
      MockDataFactory.createDashboard({ userId: user.id })
    );
    return { user, dashboards };
  }
};
```

### 대시보드 관련 시나리오
```typescript
// shared/test-utils/scenarios/dashboard.ts
export const dashboardScenarios = {
  emptyDashboard: () => MockDataFactory.createDashboard({ 
    widgets: [] 
  }),
  
  fullDashboard: () => {
    const dashboard = MockDataFactory.createDashboard();
    dashboard.widgets = Array.from({ length: 6 }, () =>
      MockDataFactory.createWidget({ dashboardId: dashboard.id })
    );
    return dashboard;
  },
  
  publicDashboard: () => MockDataFactory.createDashboard({ 
    isPublic: true 
  }),
  
  privateDashboard: () => MockDataFactory.createDashboard({ 
    isPublic: false 
  })
};
```

## 검증 방법

1. **Mock 데이터 일관성 검증**
   ```bash
   # 백엔드 테스트
   cd backend-api
   yarn test test/mock-data.spec.ts
   
   # 프론트엔드 테스트
   cd frontend-web
   npm test src/mocks/__tests__/
   ```

2. **MSW 핸들러 테스트**
   ```bash
   npm test src/mocks/handlers/__tests__/
   ```

3. **데이터베이스 Mock 테스트**
   ```bash
   yarn test test/database/
   ```

## 성공 기준

- [ ] 모든 도메인 엔티티에 대한 Mock 데이터 팩토리 구현
- [ ] 백엔드 In-Memory 데이터베이스 설정 완료
- [ ] MSW API Mock 핸들러 구현 완료
- [ ] 시나리오별 테스트 데이터 세트 구성 완료
- [ ] Mock 데이터 검증 테스트 통과

## 관련 파일

### 생성할 파일
```
shared/
├── types/test-fixtures.ts
├── test-utils/
│   ├── factories.ts
│   └── scenarios/
│       ├── auth.ts
│       ├── dashboard.ts
│       └── widget.ts

backend-api/
├── test/
│   ├── database/
│   │   └── test-database.ts
│   └── helpers/
│       └── database-helper.ts

frontend-web/
├── src/
│   ├── mocks/
│   │   ├── handlers/
│   │   │   ├── index.ts
│   │   │   ├── auth.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── widget.ts
│   │   │   └── user.ts
│   │   └── __tests__/
│   └── test-utils/
│       └── mock-store.ts
```

### 의존성 추가
```json
{
  "devDependencies": {
    "@faker-js/faker": "^8.0.0",
    "msw": "^1.2.0"
  }
}
```

## 다음 태스크 연결

이 태스크 완료 후:
- T01, T02에서 Mock 데이터를 활용한 테스트 케이스 작성
- T05에서 실제 비즈니스 로직 테스트에 Mock 데이터 활용
- CI/CD 파이프라인에서 Mock 데이터를 사용한 통합 테스트 실행