# VanillaMeta 테스트 작성 가이드라인

## 1. 개요

이 문서는 VanillaMeta 프로젝트에서 일관되고 효과적인 테스트를 작성하기 위한 가이드라인을 제공합니다.

## 2. 일반 원칙

### 테스트 명명 규칙

```typescript
// ❌ 나쁜 예
it('test user creation', () => {});

// ✅ 좋은 예
it('should create a new user with valid data', () => {});
it('should throw BadRequestException when email is invalid', () => {});
```

### AAA 패턴 (Arrange-Act-Assert)

```typescript
it('should update widget title', async () => {
  // Arrange - 테스트 데이터 준비
  const widgetId = 1;
  const newTitle = 'Updated Widget Title';
  const existingWidget = { id: widgetId, title: 'Old Title' };
  
  mockRepository.findOne.mockResolvedValue(existingWidget);
  mockRepository.save.mockResolvedValue({ ...existingWidget, title: newTitle });
  
  // Act - 테스트 대상 실행
  const result = await service.update(widgetId, { title: newTitle });
  
  // Assert - 결과 검증
  expect(result.title).toBe(newTitle);
  expect(mockRepository.save).toHaveBeenCalledWith({ ...existingWidget, title: newTitle });
});
```

### 테스트 격리

```typescript
// 각 테스트는 독립적이어야 함
beforeEach(() => {
  // 테스트 환경 초기화
  jest.clearAllMocks();
  testData = createTestData();
});

afterEach(() => {
  // 테스트 후 정리
  cleanup();
});
```

## 3. 단위 테스트 (Unit Testing)

### Service 테스트

```typescript
describe('WidgetService', () => {
  let service: WidgetService;
  let repository: MockRepository<Widget>;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WidgetService,
        {
          provide: getRepositoryToken(Widget),
          useValue: createMockRepository(),
        },
      ],
    }).compile();
    
    service = module.get<WidgetService>(WidgetService);
    repository = module.get(getRepositoryToken(Widget));
  });
  
  describe('create', () => {
    it('should create a widget successfully', async () => {
      // given
      const createDto: CreateWidgetDto = {
        name: 'Test Widget',
        dashboardId: 1,
        componentType: 'barChart',
      };
      const savedWidget = { id: 1, ...createDto };
      
      repository.save.mockResolvedValue(savedWidget);
      
      // when
      const result = await service.create(createDto);
      
      // then
      expect(result).toEqual(savedWidget);
      expect(repository.save).toHaveBeenCalledWith(createDto);
    });
    
    it('should handle database errors', async () => {
      // given
      const createDto: CreateWidgetDto = { name: 'Test' };
      repository.save.mockRejectedValue(new Error('Database error'));
      
      // when & then
      await expect(service.create(createDto)).rejects.toThrow('Database error');
    });
  });
});
```

### Controller 테스트

```typescript
describe('DashboardController', () => {
  let controller: DashboardController;
  let service: MockType<DashboardService>;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useFactory: () => createMockService(['create', 'findAll', 'findOne']),
        },
      ],
    }).compile();
    
    controller = module.get<DashboardController>(DashboardController);
    service = module.get(DashboardService);
  });
  
  describe('GET /dashboard', () => {
    it('should return an array of dashboards', async () => {
      // given
      const dashboards = [
        { id: 1, title: 'Dashboard 1' },
        { id: 2, title: 'Dashboard 2' },
      ];
      service.findAll.mockResolvedValue(dashboards);
      
      // when
      const result = await controller.findAll({ user: { id: 1 } });
      
      // then
      expect(result).toEqual(dashboards);
      expect(service.findAll).toHaveBeenCalledWith({ userId: 1 });
    });
  });
  
  describe('POST /dashboard', () => {
    it('should create a new dashboard', async () => {
      // given
      const createDto: CreateDashboardDto = {
        title: 'New Dashboard',
        layout: [],
      };
      const createdDashboard = { id: 1, ...createDto };
      service.create.mockResolvedValue(createdDashboard);
      
      // when
      const result = await controller.create(createDto, { user: { id: 1 } });
      
      // then
      expect(result).toEqual(createdDashboard);
      expect(service.create).toHaveBeenCalledWith(createDto, 1);
    });
  });
});
```

### Utility/Helper 테스트

```typescript
describe('ValidationHelper', () => {
  describe('isValidEmail', () => {
    it.each([
      ['user@example.com', true],
      ['test.user+tag@domain.co.kr', true],
      ['invalid.email', false],
      ['@example.com', false],
      ['user@', false],
      ['', false],
    ])('should validate email "%s" as %s', (email, expected) => {
      expect(ValidationHelper.isValidEmail(email)).toBe(expected);
    });
  });
  
  describe('sanitizeSQL', () => {
    it('should remove dangerous SQL keywords', () => {
      const input = "SELECT * FROM users WHERE id = 1; DROP TABLE users;";
      const expected = "SELECT * FROM users WHERE id = 1";
      
      expect(ValidationHelper.sanitizeSQL(input)).toBe(expected);
    });
  });
});
```

## 4. 통합 테스트 (Integration Testing)

### Repository 테스트

```typescript
describe('UserRepository (Integration)', () => {
  let repository: Repository<User>;
  let connection: Connection;
  
  beforeAll(async () => {
    connection = await createTestConnection();
    repository = connection.getRepository(User);
  });
  
  afterAll(async () => {
    await connection.close();
  });
  
  beforeEach(async () => {
    await connection.synchronize(true); // 테이블 재생성
  });
  
  it('should save and retrieve a user', async () => {
    // given
    const user = repository.create({
      email: 'test@example.com',
      name: 'Test User',
    });
    
    // when
    await repository.save(user);
    const found = await repository.findOne({ where: { email: user.email } });
    
    // then
    expect(found).toBeDefined();
    expect(found.email).toBe(user.email);
    expect(found.id).toBeDefined();
  });
  
  it('should enforce unique email constraint', async () => {
    // given
    const email = 'duplicate@example.com';
    await repository.save({ email, name: 'User 1' });
    
    // when & then
    await expect(
      repository.save({ email, name: 'User 2' })
    ).rejects.toThrow(/duplicate/i);
  });
});
```

### API 통합 테스트

```typescript
describe('Widget API (Integration)', () => {
  let app: INestApplication;
  let authToken: string;
  
  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
    
    // 인증 토큰 획득
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ userId: 'testuser', password: 'testpass' });
    
    authToken = loginResponse.body.accessToken;
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  describe('POST /api/widget', () => {
    it('should create a widget with valid data', async () => {
      const createDto = {
        name: 'Integration Test Widget',
        dashboardId: 1,
        componentType: 'lineChart',
        chartOptions: { type: 'line' },
      };
      
      const response = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);
      
      expect(response.body).toMatchObject({
        status: 'SUCCESS',
        data: expect.objectContaining({
          id: expect.any(Number),
          name: createDto.name,
        }),
      });
    });
    
    it('should reject unauthorized requests', async () => {
      await request(app.getHttpServer())
        .post('/api/widget')
        .send({ name: 'Unauthorized Widget' })
        .expect(401);
    });
  });
});
```

## 5. E2E 테스트 (End-to-End Testing)

### 사용자 시나리오 테스트

```typescript
describe('Dashboard Creation Flow (E2E)', () => {
  let app: INestApplication;
  let userToken: string;
  let userId: number;
  
  beforeAll(async () => {
    app = await setupTestApp();
    const { token, id } = await createTestUser(app);
    userToken = token;
    userId = id;
  });
  
  it('should complete full dashboard creation flow', async () => {
    // Step 1: 데이터베이스 연결 생성
    const dbResponse = await request(app.getHttpServer())
      .post('/api/database')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'E2E Test Database',
        engine: 'mysql',
        connectionConfig: {
          host: 'localhost',
          port: 3306,
          user: 'test',
          password: 'test',
          database: 'testdb',
        },
      })
      .expect(201);
    
    const databaseId = dbResponse.body.data.id;
    
    // Step 2: 데이터셋 생성
    const datasetResponse = await request(app.getHttpServer())
      .post('/api/dataset')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Sales Data',
        databaseId,
        query: 'SELECT * FROM sales WHERE year = 2024',
      })
      .expect(201);
    
    const datasetId = datasetResponse.body.data.id;
    
    // Step 3: 대시보드 생성
    const dashboardResponse = await request(app.getHttpServer())
      .post('/api/dashboard')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'E2E Test Dashboard',
        description: 'Complete flow test',
        layout: [],
      })
      .expect(201);
    
    const dashboardId = dashboardResponse.body.data.id;
    
    // Step 4: 위젯 추가
    const widgetResponse = await request(app.getHttpServer())
      .post('/api/widget')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Sales Chart',
        dashboardId,
        datasetId,
        componentType: 'barChart',
        chartOptions: {
          type: 'bar',
          title: { text: 'Sales by Month' },
        },
      })
      .expect(201);
    
    // Step 5: 완성된 대시보드 조회
    const finalDashboard = await request(app.getHttpServer())
      .get(`/api/dashboard/${dashboardId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    
    expect(finalDashboard.body.data).toMatchObject({
      id: dashboardId,
      title: 'E2E Test Dashboard',
      widgets: expect.arrayContaining([
        expect.objectContaining({
          name: 'Sales Chart',
        }),
      ]),
    });
  });
});
```

## 6. 성능 테스트

### 응답 시간 테스트

```typescript
describe('Performance Tests', () => {
  it('should respond within acceptable time', async () => {
    const startTime = Date.now();
    
    await service.processLargeDataset(testData);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // 1초 이내
  });
  
  it('should handle concurrent requests efficiently', async () => {
    const concurrentRequests = 100;
    const promises = Array.from({ length: concurrentRequests }, (_, i) =>
      service.create({ name: `Concurrent Test ${i}` })
    );
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    expect(results).toHaveLength(concurrentRequests);
    expect(duration).toBeLessThan(5000); // 5초 이내
  });
});
```

### 메모리 사용 테스트

```typescript
describe('Memory Usage Tests', () => {
  it('should not leak memory during repeated operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // 반복 작업 수행
    for (let i = 0; i < 1000; i++) {
      await service.processData(generateTestData());
    }
    
    // 가비지 컬렉션 강제 실행
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB 이하
  });
});
```

## 7. 테스트 더블 (Test Doubles)

### Mock 생성 헬퍼

```typescript
// test/helpers/mock.helper.ts
export function createMockRepository<T = any>(): MockRepository<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getOne: jest.fn(),
    })),
  };
}

export function createMockService(methods: string[]): any {
  return methods.reduce((acc, method) => {
    acc[method] = jest.fn();
    return acc;
  }, {});
}
```

### Stub 데이터

```typescript
// test/fixtures/widget.fixture.ts
export const widgetFixtures = {
  barChart: {
    id: 1,
    name: 'Sales Bar Chart',
    componentType: 'barChart',
    chartOptions: {
      type: 'bar',
      xAxis: { type: 'category' },
      yAxis: { type: 'value' },
    },
  },
  lineChart: {
    id: 2,
    name: 'Trend Line Chart',
    componentType: 'lineChart',
    chartOptions: {
      type: 'line',
      smooth: true,
    },
  },
};
```

## 8. 테스트 데이터 관리

### Factory 패턴

```typescript
// test/factories/user.factory.ts
export class UserFactory {
  static build(overrides?: Partial<User>): User {
    return {
      id: faker.datatype.number(),
      email: faker.internet.email(),
      name: faker.name.fullName(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }
  
  static buildList(count: number, overrides?: Partial<User>): User[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }
}
```

### 테스트 데이터 정리

```typescript
describe('Test with cleanup', () => {
  const createdIds: number[] = [];
  
  afterEach(async () => {
    // 생성된 데이터 정리
    if (createdIds.length > 0) {
      await repository.delete(createdIds);
      createdIds.length = 0;
    }
  });
  
  it('should create and track test data', async () => {
    const result = await service.create({ name: 'Test' });
    createdIds.push(result.id);
    
    expect(result).toBeDefined();
  });
});
```

## 9. 비동기 테스트

### Promise 기반 테스트

```typescript
// ❌ 나쁜 예 - done 콜백 사용
it('should handle async operation', (done) => {
  service.asyncOperation().then(result => {
    expect(result).toBe('success');
    done();
  });
});

// ✅ 좋은 예 - async/await 사용
it('should handle async operation', async () => {
  const result = await service.asyncOperation();
  expect(result).toBe('success');
});
```

### 타임아웃 처리

```typescript
it('should timeout long operations', async () => {
  await expect(
    service.longRunningOperation()
  ).rejects.toThrow('Operation timed out');
}, 10000); // 10초 타임아웃
```

## 10. 테스트 커버리지

### 커버리지 목표
- 전체: 85% 이상
- 핵심 모듈: 95% 이상
- 새 코드: 90% 이상

### 커버리지 제외

```typescript
/* istanbul ignore next */
private handleUnexpectedError(error: Error): void {
  // 예외적인 에러 처리 로직
  console.error('Unexpected error:', error);
}

// 또는 파일 단위 제외
/* istanbul ignore file */
```

## 11. 베스트 프랙티스

### DO's ✅

1. **명확한 테스트 이름 사용**
   ```typescript
   it('should return 404 when user does not exist', () => {});
   ```

2. **하나의 테스트에서 하나만 검증**
   ```typescript
   // 각 동작을 별도 테스트로 분리
   it('should create user', () => {});
   it('should send welcome email', () => {});
   ```

3. **테스트 데이터는 명시적으로**
   ```typescript
   const testUser = {
     email: 'test@example.com', // 명확한 테스트 데이터
     name: 'Test User',
   };
   ```

4. **엣지 케이스 테스트**
   ```typescript
   it('should handle empty array', () => {});
   it('should handle null values', () => {});
   it('should handle maximum length input', () => {});
   ```

### DON'Ts ❌

1. **테스트 간 의존성 만들지 않기**
   ```typescript
   // ❌ 나쁜 예
   it('test 1', () => { globalVar = 'value'; });
   it('test 2', () => { expect(globalVar).toBe('value'); });
   ```

2. **구현 세부사항 테스트 피하기**
   ```typescript
   // ❌ 내부 구현에 의존
   expect(service._privateMethod()).toBe(true);
   
   // ✅ 공개 인터페이스 테스트
   expect(service.publicMethod()).toBe(true);
   ```

3. **과도한 Mocking 피하기**
   ```typescript
   // ❌ 모든 것을 Mock
   // ✅ 필요한 부분만 Mock하고 나머지는 실제 사용
   ```

## 12. 문제 해결

### 일반적인 문제들

**1. 간헐적 실패 (Flaky Tests)**
```typescript
// 문제: 타이밍에 의존하는 테스트
// 해결: 명시적 대기 또는 이벤트 기반 테스트
await waitFor(() => {
  expect(element).toBeVisible();
});
```

**2. 느린 테스트**
```typescript
// 문제: 실제 데이터베이스 사용
// 해결: In-memory DB 또는 Mock 사용
```

**3. 복잡한 Setup**
```typescript
// 문제: 반복적인 설정 코드
// 해결: 헬퍼 함수 또는 beforeEach 활용
```

## 13. 참고 자료

- [Jest Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles/)
- [NestJS Testing Guide](https://docs.nestjs.com/fundamentals/testing)
- [Test Patterns](https://martinfowler.com/articles/mocksArentStubs.html)