# 백엔드 테스트 가이드라인

## 개요

이 문서는 VanillaMeta 백엔드 API의 테스트 작성 및 실행에 대한 가이드라인을 제공합니다.

## 테스트 구조

```
backend-api/
├── src/
│   └── **/*.spec.ts          # 단위 테스트 (각 모듈과 함께 위치)
├── test/
│   ├── test-helpers.ts       # 공통 테스트 유틸리티
│   ├── *.e2e-spec.ts        # E2E 테스트
│   └── QTT-*/               # 비즈니스 로직 통합 테스트
```

## 테스트 유형

### 1. 단위 테스트 (Unit Tests)

각 서비스, 컨트롤러, 유틸리티 함수에 대한 격리된 테스트

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockRepository: Partial<Repository<Entity>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: createTestProviders(ServiceName, [
        { entity: Entity },
        { service: DependentService, methods: ['method1', 'method2'] }
      ])
    }).compile();

    service = module.get<ServiceName>(ServiceName);
    mockRepository = module.get(getRepositoryToken(Entity));
  });

  describe('businessMethod', () => {
    it('should handle success case', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue(mockEntity);
      
      // Act
      const result = await service.businessMethod(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });

    it('should handle error case', async () => {
      // Arrange
      mockRepository.findOne.mockRejectedValue(new Error('Database error'));
      
      // Act & Assert
      await expect(service.businessMethod(input)).rejects.toThrow('Database error');
    });
  });
});
```

### 2. E2E 테스트 (End-to-End Tests)

전체 애플리케이션 플로우를 테스트

```typescript
describe('Feature Flow (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 인증 설정
    authToken = await getAuthToken(app);
  });

  it('/api/endpoint (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/endpoint')
      .set('Authorization', `Bearer ${authToken}`)
      .send(testData)
      .expect(201)
      .expect((res) => {
        assertApiResponse(res.body);
        expect(res.body.data).toHaveProperty('expectedProperty');
      });
  });
});
```

### 3. 통합 테스트 (Integration Tests)

외부 서비스나 데이터베이스와의 연동 테스트

```typescript
describe('QTT-XXX: Feature Integration', () => {
  it('should integrate with external service', async () => {
    const result = await service.callExternalAPI(params);
    expect(result.status).toBe('SUCCESS');
  });
});
```

## 테스트 헬퍼 활용

### 1. Mock 생성

```typescript
// Repository Mock
const mockRepository = createMockRepository();

// Service Mock
const mockService = createMockService(['method1', 'method2']);

// JWT Service Mock
const mockJwtService = createMockJwtService();

// Knex Connection Mock
const mockConnection = createMockKnexConnection();
```

### 2. 테스트 데이터 빌더

```typescript
const builder = new TestDataBuilder<Dashboard>();
const dashboards = builder
  .with('title', 'Test Dashboard')
  .with('layout', '[{"i":"widget1","x":0,"y":0,"w":4,"h":4}]')
  .buildMany(10, (i) => ({ id: i + 1 }));
```

### 3. 시나리오 헬퍼

```typescript
// 인증된 사용자 시나리오
const { user, accessToken, headers } = scenarioHelpers.setupAuthenticatedUser();

// 데이터베이스 연결 시나리오
const { connection, mockConnection } = scenarioHelpers.setupDatabaseConnection('mysql');

// 대시보드 시나리오
const { user, dashboard, widgets, shareUrl } = scenarioHelpers.setupDashboardScenario();
```

### 4. Assertion 헬퍼

```typescript
// API 응답 검증
assertHelpers.assertApiResponse(response, 'SUCCESS');

// 페이지네이션 응답 검증
assertHelpers.assertPaginatedResponse(response);

// 에러 응답 검증
assertHelpers.assertErrorResponse(response, 400);
```

### 5. 보안 테스트

```typescript
// SQL 인젝션 테스트
for (const pattern of securityHelpers.sqlInjectionPatterns) {
  const result = await service.create({ title: pattern });
  expect(result).not.toThrow(); // ORM이 적절히 이스케이프 처리
}

// XSS 테스트
for (const pattern of securityHelpers.xssPatterns) {
  const result = await service.create({ content: pattern });
  expect(result.data.content).toBe(pattern); // 저장은 되지만 렌더링 시 이스케이프
}
```

### 6. 성능 테스트

```typescript
// 실행 시간 측정
const { result, executionTime } = await performanceHelpers.measureExecutionTime(
  async () => await service.heavyOperation()
);
expect(executionTime).toBeLessThan(performanceThresholds.apiResponseTime);

// 메모리 사용량 측정
const { result, memoryIncrease } = await performanceHelpers.measureMemoryIncrease(
  async () => await service.memoryIntensiveOperation()
);
expect(memoryIncrease).toBeLessThan(performanceThresholds.memoryUsageIncrease);

// 동시 실행 측정
const operations = Array(100).fill(null).map(() => async () => await service.operation());
const { results, totalExecutionTime, averageTime } = 
  await performanceHelpers.measureConcurrentExecution(operations, 10);
expect(averageTime).toBeLessThan(performanceThresholds.apiResponseTime);
```

## 테스트 작성 Best Practices

### 1. 테스트 구조

- **Arrange-Act-Assert (AAA) 패턴** 사용
- 각 테스트는 독립적이어야 함
- 테스트 이름은 명확하고 설명적이어야 함

### 2. Mock 사용

- 외부 의존성은 모두 Mock 처리
- Mock은 실제 동작과 유사하게 구성
- 필요한 메서드만 Mock

### 3. 에러 케이스

- 성공 케이스뿐만 아니라 실패 케이스도 테스트
- 경계값, null, undefined 등 엣지 케이스 포함
- 예외 상황에 대한 적절한 처리 확인

### 4. 테스트 데이터

- 테스트 데이터는 명확하고 의미 있게 작성
- 매직 넘버 사용 지양
- 테스트 데이터 빌더 패턴 활용

### 5. 성능 고려사항

- 테스트 실행 시간 5분 이내 유지
- 불필요한 대기 시간 제거
- 병렬 실행 가능하도록 구성

## 테스트 실행

### 단위 테스트

```bash
# 모든 단위 테스트 실행
yarn test

# 특정 파일/패턴 테스트
yarn test auth.service.spec.ts
yarn test --testNamePattern="should create"

# 감시 모드
yarn test:watch

# 커버리지 리포트
yarn test:cov
```

### E2E 테스트

```bash
# 모든 E2E 테스트 실행
yarn test:e2e

# 특정 E2E 테스트
yarn test:e2e dashboard-flow
```

### 디버깅

```bash
# 디버그 모드로 테스트 실행
yarn test:debug
```

## 테스트 커버리지 목표

- **전체 커버리지**: 80% 이상
- **핵심 비즈니스 로직**: 90% 이상
- **유틸리티 함수**: 100%
- **에러 핸들링**: 모든 에러 케이스 포함

## CI/CD 통합

모든 테스트는 GitHub Actions를 통해 자동으로 실행됩니다:

1. Pull Request 생성 시 자동 실행
2. 테스트 실패 시 머지 차단
3. 커버리지 리포트 자동 생성

## 트러블슈팅

### 테스트 실패 시

1. 에러 메시지 확인
2. 관련 로그 확인
3. Mock 설정 검증
4. 테스트 격리 확인

### 메모리 이슈

1. `beforeEach`에서 Mock 초기화
2. `afterEach`에서 리소스 정리
3. 대량 데이터 테스트 시 청크 단위 처리

### 타이밍 이슈

1. `async/await` 올바른 사용 확인
2. Promise 체이닝 검증
3. 필요시 명시적 대기 추가

## 참고 자료

- [Jest 공식 문서](https://jestjs.io/docs/getting-started)
- [NestJS 테스팅 가이드](https://docs.nestjs.com/fundamentals/testing)
- [Supertest 문서](https://github.com/visionmedia/supertest)