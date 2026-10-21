# VanillaMeta 테스트 베스트 프랙티스

## 1. 테스트 철학

### 테스트 피라미드

```
         /\
        /E2E\        (10%) - 사용자 시나리오
       /______\
      /        \
     /Integration\   (20%) - 모듈 간 상호작용
    /______________\
   /                \
  /   Unit Tests     \ (70%) - 개별 함수/컴포넌트
 /____________________\
```

### 핵심 원칙

1. **F.I.R.S.T 원칙**
   - **Fast**: 빠르게 실행
   - **Independent**: 독립적 실행
   - **Repeatable**: 반복 가능
   - **Self-Validating**: 자체 검증
   - **Timely**: 적시에 작성

2. **테스트는 문서다**
   - 테스트 코드는 기능의 명세서
   - 읽기 쉽고 이해하기 쉬워야 함

3. **행동 중심 테스트**
   - 구현이 아닌 행동을 테스트
   - 리팩토링에 강한 테스트

## 2. 테스트 작성 모범 사례

### 테스트 구조화

```typescript
describe('WidgetService', () => {
  describe('create method', () => {
    describe('with valid data', () => {
      it('should create a widget successfully', () => {
        // Given - 준비
        // When - 실행
        // Then - 검증
      });
    });
    
    describe('with invalid data', () => {
      it('should throw validation error', () => {
        // 에러 케이스 테스트
      });
    });
  });
});
```

### 명확한 테스트 이름

```typescript
// ❌ 나쁜 예
it('test 1', () => {});
it('works', () => {});
it('should work correctly', () => {});

// ✅ 좋은 예
it('should return user profile when valid token is provided', () => {});
it('should throw UnauthorizedException when token is expired', () => {});
it('should update cache after successful database query', () => {});
```

### 테스트 데이터 관리

```typescript
// ❌ 나쁜 예 - 매직 넘버와 하드코딩된 값
const user = {
  id: 123,
  email: 'test@test.com',
  age: 25
};

// ✅ 좋은 예 - 의미 있는 테스트 데이터
const ADULT_AGE = 18;
const testUser = createTestUser({
  email: 'john.doe@example.com',
  age: ADULT_AGE + 7, // 명확히 성인임을 표현
});
```

## 3. 단위 테스트 베스트 프랙티스

### 의존성 격리

```typescript
// ✅ 좋은 예 - 모든 의존성을 Mock
describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<Repository<User>>;
  let mockEmailService: jest.Mocked<EmailService>;
  
  beforeEach(() => {
    mockRepository = createMockRepository();
    mockEmailService = createMockService(['sendEmail']);
    
    service = new UserService(mockRepository, mockEmailService);
  });
  
  it('should send welcome email after user creation', async () => {
    // Given
    const newUser = { email: 'new@example.com', name: 'New User' };
    mockRepository.save.mockResolvedValue({ id: 1, ...newUser });
    
    // When
    await service.createUser(newUser);
    
    // Then
    expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
      'new@example.com',
      'Welcome to VanillaMeta'
    );
  });
});
```

### 엣지 케이스 테스트

```typescript
describe('calculateDiscount', () => {
  // 정상 케이스
  it('should apply 10% discount for amounts over 100', () => {
    expect(calculateDiscount(150)).toBe(15);
  });
  
  // 엣지 케이스
  it('should handle zero amount', () => {
    expect(calculateDiscount(0)).toBe(0);
  });
  
  it('should handle negative amounts', () => {
    expect(() => calculateDiscount(-10)).toThrow('Invalid amount');
  });
  
  it('should handle maximum safe integer', () => {
    expect(calculateDiscount(Number.MAX_SAFE_INTEGER)).toBeDefined();
  });
  
  it('should handle floating point precision', () => {
    expect(calculateDiscount(100.1)).toBeCloseTo(10.01, 2);
  });
});
```

## 4. 통합 테스트 베스트 프랙티스

### 테스트 데이터베이스 사용

```typescript
// test/setup/database.ts
export async function setupTestDatabase() {
  const connection = await createConnection({
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    entities: ['src/**/*.entity.ts'],
  });
  
  return connection;
}

// 테스트에서 사용
describe('UserRepository Integration', () => {
  let connection: Connection;
  
  beforeAll(async () => {
    connection = await setupTestDatabase();
  });
  
  afterAll(async () => {
    await connection.close();
  });
  
  beforeEach(async () => {
    // 각 테스트 전 데이터 초기화
    await connection.synchronize(true);
  });
});
```

### 트랜잭션 롤백 패턴

```typescript
describe('Order Processing Integration', () => {
  let queryRunner: QueryRunner;
  
  beforeEach(async () => {
    queryRunner = connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
  });
  
  afterEach(async () => {
    // 트랜잭션 롤백으로 데이터 정리
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });
  
  it('should process order with inventory update', async () => {
    // 트랜잭션 내에서 테스트 실행
    const orderRepo = queryRunner.manager.getRepository(Order);
    const inventoryRepo = queryRunner.manager.getRepository(Inventory);
    
    // 테스트 로직...
  });
});
```

## 5. E2E 테스트 베스트 프랙티스

### 테스트 시나리오 설계

```typescript
describe('User Journey: Dashboard Creation', () => {
  let app: INestApplication;
  let authToken: string;
  
  beforeAll(async () => {
    app = await bootstrapTestApp();
    authToken = await authenticateTestUser(app);
  });
  
  it('should complete dashboard creation flow', async () => {
    // Step 1: Create database connection
    const dbId = await createTestDatabase(app, authToken);
    
    // Step 2: Create dataset
    const datasetId = await createTestDataset(app, authToken, dbId);
    
    // Step 3: Create dashboard
    const dashboardId = await createTestDashboard(app, authToken);
    
    // Step 4: Add widget
    const widgetId = await addTestWidget(app, authToken, {
      dashboardId,
      datasetId,
    });
    
    // Step 5: Verify complete dashboard
    const dashboard = await getDashboard(app, authToken, dashboardId);
    
    expect(dashboard).toMatchObject({
      id: dashboardId,
      widgets: expect.arrayContaining([
        expect.objectContaining({ id: widgetId })
      ]),
    });
  });
});
```

### 테스트 데이터 정리

```typescript
class E2ETestContext {
  private cleanupTasks: Array<() => Promise<void>> = [];
  
  async createDashboard(data: CreateDashboardDto): Promise<number> {
    const dashboard = await this.api.createDashboard(data);
    
    // 정리 작업 등록
    this.cleanupTasks.push(async () => {
      await this.api.deleteDashboard(dashboard.id);
    });
    
    return dashboard.id;
  }
  
  async cleanup(): Promise<void> {
    // 역순으로 정리 (의존성 고려)
    for (const task of this.cleanupTasks.reverse()) {
      try {
        await task();
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
    this.cleanupTasks = [];
  }
}
```

## 6. 성능 테스트 베스트 프랙티스

### 성능 벤치마크

```typescript
describe('Performance Benchmarks', () => {
  const PERFORMANCE_THRESHOLDS = {
    widgetCreation: 100, // ms
    dataQuery: 500, // ms
    dashboardLoad: 1000, // ms
  };
  
  it('should create widget within performance threshold', async () => {
    const startTime = performance.now();
    
    await service.createWidget(testData);
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.widgetCreation);
    
    // 성능 추적을 위한 로깅
    console.log(`Widget creation took ${duration.toFixed(2)}ms`);
  });
});
```

### 메모리 프로파일링

```typescript
describe('Memory Usage Tests', () => {
  function getMemoryUsage(): number {
    if (global.gc) global.gc(); // 가비지 컬렉션 강제 실행
    return process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }
  
  it('should not leak memory during bulk operations', async () => {
    const initialMemory = getMemoryUsage();
    const iterations = 1000;
    
    for (let i = 0; i < iterations; i++) {
      const data = generateLargeDataset();
      await service.processData(data);
      // 데이터가 적절히 정리되는지 확인
    }
    
    const finalMemory = getMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;
    
    console.log(`Memory increased by ${memoryIncrease.toFixed(2)}MB`);
    expect(memoryIncrease).toBeLessThan(50); // 50MB 미만 증가
  });
});
```

## 7. 모킹 베스트 프랙티스

### 스마트 모킹

```typescript
// ❌ 나쁜 예 - 과도한 모킹
jest.mock('../entire-module');

// ✅ 좋은 예 - 필요한 부분만 모킹
const mockSendEmail = jest.fn();
jest.mock('../email/email.service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendEmail: mockSendEmail,
  })),
}));
```

### 모킹 검증

```typescript
describe('NotificationService', () => {
  it('should send email with correct parameters', async () => {
    // Given
    const mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue({ messageId: '123' }),
    };
    
    const service = new NotificationService(mockEmailService);
    
    // When
    await service.notifyUser('user@example.com', 'Test Message');
    
    // Then - 상세한 검증
    expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: expect.stringContaining('Notification'),
      body: expect.stringContaining('Test Message'),
      priority: 'normal',
    });
    
    // 호출 순서 검증도 가능
    expect(mockEmailService.sendEmail).toHaveBeenNthCalledWith(1, 
      expect.objectContaining({ to: 'user@example.com' })
    );
  });
});
```

## 8. 비동기 테스트 베스트 프랙티스

### Promise 처리

```typescript
// ❌ 나쁜 예
it('should handle async operation', (done) => {
  service.asyncMethod().then(result => {
    expect(result).toBe('success');
    done();
  });
});

// ✅ 좋은 예
it('should handle async operation', async () => {
  const result = await service.asyncMethod();
  expect(result).toBe('success');
});

// ✅ 에러 처리
it('should handle async errors', async () => {
  await expect(service.failingAsyncMethod()).rejects.toThrow('Expected error');
});
```

### 타임아웃 처리

```typescript
describe('Timeout Handling', () => {
  // 긴 작업을 위한 커스텀 타임아웃
  it('should complete long operation', async () => {
    const result = await service.longRunningOperation();
    expect(result).toBeDefined();
  }, 30000); // 30초 타임아웃
  
  // 타임아웃 테스트
  it('should timeout after specified duration', async () => {
    const timeoutPromise = withTimeout(
      service.veryLongOperation(),
      5000 // 5초 타임아웃
    );
    
    await expect(timeoutPromise).rejects.toThrow('Operation timed out');
  });
});
```

## 9. 테스트 유지보수

### 테스트 리팩토링

```typescript
// Before - 중복된 설정 코드
it('test 1', () => {
  const user = { id: 1, name: 'Test' };
  const dashboard = { id: 1, userId: 1 };
  // 테스트 로직
});

it('test 2', () => {
  const user = { id: 1, name: 'Test' };
  const dashboard = { id: 1, userId: 1 };
  // 다른 테스트 로직
});

// After - 헬퍼 함수 사용
const createTestContext = () => ({
  user: createTestUser(),
  dashboard: createTestDashboard(),
});

it('test 1', () => {
  const { user, dashboard } = createTestContext();
  // 테스트 로직
});
```

### 테스트 안정성

```typescript
// 불안정한 테스트 방지
describe('Stable Tests', () => {
  // ❌ 나쁜 예 - 시간에 의존
  it('should create with current timestamp', () => {
    const result = service.create();
    expect(result.createdAt).toBe(new Date());
  });
  
  // ✅ 좋은 예 - 시간 모킹
  it('should create with current timestamp', () => {
    const mockDate = new Date('2024-01-01');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    
    const result = service.create();
    expect(result.createdAt).toEqual(mockDate);
  });
  
  // ❌ 나쁜 예 - 순서에 의존
  it('should return sorted results', () => {
    const results = service.getAll();
    expect(results[0].id).toBe(1);
  });
  
  // ✅ 좋은 예 - 명시적 정렬 확인
  it('should return sorted results', () => {
    const results = service.getAll();
    const ids = results.map(r => r.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
```

## 10. 안티패턴 피하기

### 피해야 할 패턴들

```typescript
// ❌ 테스트 내 조건문
it('should maybe do something', () => {
  const result = service.method();
  if (result) {
    expect(result).toBe('value');
  }
  // 항상 통과하는 의미없는 테스트
});

// ❌ 과도한 Setup
beforeEach(() => {
  // 200줄의 설정 코드...
  // 대부분의 테스트에서 필요하지 않은 설정
});

// ❌ 하나의 테스트에서 너무 많은 검증
it('should do everything', () => {
  const result = service.complexMethod();
  expect(result.property1).toBe('value1');
  expect(result.property2).toBe('value2');
  // ... 20개 더 검증
});

// ❌ 구현 세부사항 테스트
it('should call private method', () => {
  service.publicMethod();
  expect(service['_privateMethod']).toHaveBeenCalled();
});
```

### 올바른 패턴

```typescript
// ✅ 명확한 단일 목적
it('should return success status when operation completes', () => {
  const result = service.method();
  expect(result.status).toBe('success');
});

// ✅ 필요한 만큼만 Setup
beforeEach(() => {
  mockRepository = createMockRepository();
  service = new Service(mockRepository);
});

// ✅ 관련된 검증만 그룹화
describe('response structure', () => {
  let response: ApiResponse;
  
  beforeEach(() => {
    response = service.getResponse();
  });
  
  it('should have success status', () => {
    expect(response.status).toBe('success');
  });
  
  it('should include timestamp', () => {
    expect(response.timestamp).toBeInstanceOf(Date);
  });
});

// ✅ 공개 인터페이스 테스트
it('should transform data correctly', () => {
  const input = { raw: 'data' };
  const output = service.transform(input);
  expect(output).toEqual({ formatted: 'DATA' });
});
```

## 11. 지속적인 개선

### 테스트 메트릭 추적

```yaml
# .github/workflows/test-metrics.yml
- name: Collect Test Metrics
  run: |
    echo "Total Tests: $(jest --listTests | wc -l)"
    echo "Test Execution Time: ${{ steps.test.outputs.time }}"
    echo "Coverage: ${{ steps.coverage.outputs.percentage }}%"
    echo "Flaky Tests: $(grep -c 'retry' test-results.json)"
```

### 테스트 리뷰 체크리스트

- [ ] 테스트 이름이 명확한가?
- [ ] AAA 패턴을 따르는가?
- [ ] 엣지 케이스를 다루는가?
- [ ] 의존성이 적절히 모킹되었는가?
- [ ] 테스트가 독립적으로 실행되는가?
- [ ] 실패 시 명확한 에러 메시지를 제공하는가?
- [ ] 성능에 영향을 주지 않는가?
- [ ] 유지보수가 쉬운가?

## 12. 참고 자료

- [Kent C. Dodds - Testing JavaScript](https://testingjavascript.com/)
- [Google Testing Blog](https://testing.googleblog.com/)
- [Martin Fowler - Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html)
- [Jest Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Testing Library Philosophy](https://testing-library.com/docs/guiding-principles/)