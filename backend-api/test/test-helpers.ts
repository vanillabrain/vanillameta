import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';

/**
 * Mock repository factory
 * TypeORM Repository를 모킹하기 위한 팩토리 함수
 */
export const createMockRepository = <T = any>(): Partial<Repository<T>> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orUpdate: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  })) as any,
});

/**
 * Mock JwtService
 * JWT 서비스를 모킹하기 위한 팩토리 함수
 */
export const createMockJwtService = (): Partial<JwtService> => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ userId: 1, email: 'test@example.com' }),
  verifyAsync: jest.fn().mockResolvedValue({ userId: 1, email: 'test@example.com' }),
  decode: jest.fn().mockReturnValue({ userId: 1, email: 'test@example.com' }),
});

/**
 * 엔티티 클래스에 대한 Repository 토큰 생성 헬퍼
 */
export const getRepositoryTokenFor = (entity: any) => getRepositoryToken(entity);

/**
 * 공통 테스트 데이터
 */
export const mockUser = {
  id: 1,
  userId: 'testuser',
  email: 'test@example.com',
  password: 'hashedpassword',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockDashboard = {
  id: 1,
  title: 'Test Dashboard',
  layout: '[]',
  shareId: 1,
  delYn: 'N',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockWidget = {
  id: 1,
  title: 'Test Widget',
  widgetType: 'chart',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockDatabase = {
  id: 1,
  name: 'Test Database',
  host: 'localhost',
  port: 3306,
  username: 'testuser',
  password: 'testpass',
  databaseName: 'testdb',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockDataset = {
  id: 1,
  name: 'Test Dataset',
  query: 'SELECT * FROM test',
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * 공통 서비스 Mock 팩토리
 */
export const createMockService = <T = any>(methods: string[] = []): Partial<T> => {
  const mockService: any = {};
  methods.forEach(method => {
    mockService[method] = jest.fn();
  });
  return mockService;
};

/**
 * 기본 서비스 메서드들에 대한 Mock
 */
export const defaultServiceMethods = [
  'create',
  'findAll',
  'findOne',
  'update',
  'remove',
  'save',
  'delete',
];

/**
 * 환경 변수 Mock 헬퍼
 */
export const mockEnvVars = {
  ACCESS_SECRET: 'test-access-secret',
  REFRESH_SECRET: 'test-refresh-secret',
  URL_ACCESS_SECRET: 'test-url-access-secret',
  NODE_ENV: 'test',
};

/**
 * 테스트 모듈 생성을 위한 공통 provider 설정
 */
export const createTestProviders = (service: any, dependencies: any[] = []) => {
  const providers = [service];

  dependencies.forEach(dep => {
    if (dep.useFactory) {
      providers.push(dep);
    } else if (dep.entity) {
      providers.push({
        provide: getRepositoryToken(dep.entity),
        useValue: createMockRepository(),
      });
    } else if (dep.service) {
      providers.push({
        provide: dep.service,
        useValue: createMockService(dep.methods || defaultServiceMethods),
      });
    }
  });

  return providers;
};

/**
 * Knex 연결 Mock 팩토리
 * ConnectionService에서 사용하는 Knex 연결을 모킹
 */
export const createMockKnexConnection = () => ({
  raw: jest.fn().mockResolvedValue({ rows: [] }),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue([1]),
  update: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  destroy: jest.fn().mockResolvedValue(undefined),
  schema: {
    createTable: jest.fn().mockReturnThis(),
    dropTable: jest.fn().mockReturnThis(),
    hasTable: jest.fn().mockResolvedValue(true),
    hasColumn: jest.fn().mockResolvedValue(true),
  },
  transaction: jest.fn().mockImplementation(callback => {
    const trx = createMockKnexConnection();
    return callback(trx);
  }),
});

/**
 * HTTP Request Mock 팩토리
 * E2E 테스트에서 사용하는 요청 데이터 모킹
 */
export const createMockRequest = (overrides: any = {}) => ({
  user: mockUser,
  headers: {
    authorization: 'Bearer mock-token',
    'content-type': 'application/json',
  },
  body: {},
  params: {},
  query: {},
  ...overrides,
});

/**
 * HTTP Response Mock 팩토리
 */
export const createMockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res;
};

/**
 * Connection 정보 Mock 데이터
 */
export const mockConnectionInfo = {
  mysql: {
    id: 1,
    engine: 'mysql',
    host: 'localhost',
    port: 3306,
    database: 'test_db',
    username: 'test_user',
    password: 'test_pass',
  },
  postgresql: {
    id: 2,
    engine: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    username: 'test_user',
    password: 'test_pass',
  },
  sqlite: {
    id: 3,
    engine: 'sqlite',
    filename: ':memory:',
  },
};

/**
 * 차트 컴포넌트 Mock 데이터
 */
export const mockChartComponent = {
  id: 1,
  name: 'Line Chart',
  type: 'line',
  category: 'basic',
  settings: {
    xAxis: { field: 'date', type: 'category' },
    yAxis: { field: 'value', type: 'value' },
    series: { field: 'value', type: 'line' },
  },
};

/**
 * Widget 설정 Mock 데이터
 */
export const mockWidgetSettings = {
  chartType: 'line',
  title: 'Test Chart',
  xAxis: 'date',
  yAxis: 'value',
  groupBy: null,
  filters: [],
  sorting: { field: 'date', direction: 'asc' },
};

/**
 * 데이터셋 결과 Mock 데이터
 */
export const mockDatasetResult = {
  status: 'SUCCESS',
  data: [
    { date: '2023-01-01', value: 100, category: 'A' },
    { date: '2023-01-02', value: 150, category: 'B' },
    { date: '2023-01-03', value: 200, category: 'A' },
  ],
  metadata: {
    columns: [
      { name: 'date', type: 'string' },
      { name: 'value', type: 'number' },
      { name: 'category', type: 'string' },
    ],
    rowCount: 3,
  },
};

/**
 * 공유 URL Mock 데이터
 */
export const mockShareUrl = {
  id: 1,
  shareId: 'abc123',
  dashboardId: 1,
  expireDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * 에러 상황 Mock 헬퍼
 */
export const mockErrorScenarios = {
  databaseConnectionError: new Error('Connection failed: ECONNREFUSED'),
  unauthorizedError: new Error('Unauthorized access'),
  notFoundError: new Error('Resource not found'),
  validationError: new Error('Validation failed'),
  sqlError: new Error('SQL execution failed'),
};

/**
 * 비동기 작업 Mock 헬퍼
 */
export const createAsyncMock = <T>(result: T, delay = 0) => {
  return jest.fn().mockImplementation(
    () =>
      new Promise(resolve => {
        setTimeout(() => resolve(result), delay);
      }),
  );
};

/**
 * 성능 테스트용 Mock 데이터 생성기
 */
export const generateLargeDataset = (size: number) => {
  return Array.from({ length: size }, (_, index) => ({
    id: index + 1,
    name: `Item ${index + 1}`,
    value: Math.floor(Math.random() * 1000),
    date: new Date(Date.now() - index * 86400000).toISOString().split('T')[0],
    category: ['A', 'B', 'C'][index % 3],
  }));
};

/**
 * 테스트 시간 제한 헬퍼
 */
export const withTimeout = (promise: Promise<any>, timeout = 5000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), timeout)),
  ]);
};

/**
 * 테스트 재시도 헬퍼
 */
export const retryTest = async (testFn: () => Promise<any>, maxRetries = 3) => {
  let lastError: Error;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await testFn();
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries - 1) throw lastError;
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
};

/**
 * 테스트 격리를 위한 데이터베이스 정리 헬퍼
 */
export const cleanupTestData = async (repositories: any[]) => {
  for (const repo of repositories) {
    if (repo && typeof repo.clear === 'function') {
      await repo.clear();
    }
  }
};

/**
 * 메모리 사용량 측정 헬퍼
 */
export const measureMemoryUsage = () => {
  const used = process.memoryUsage();
  return {
    rss: Math.round((used.rss / 1024 / 1024) * 100) / 100, // MB
    heapTotal: Math.round((used.heapTotal / 1024 / 1024) * 100) / 100, // MB
    heapUsed: Math.round((used.heapUsed / 1024 / 1024) * 100) / 100, // MB
    external: Math.round((used.external / 1024 / 1024) * 100) / 100, // MB
  };
};

/**
 * Logger Mock 팩토리
 * CustomLoggerService를 모킹하기 위한 팩토리 함수
 */
export const createMockLogger = () => ({
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn(),
});

/**
 * Configuration Mock 팩토리
 * ConfigService를 모킹하기 위한 팩토리 함수
 */
export const createMockConfigService = (config: Record<string, any> = {}) => ({
  get: jest.fn((key: string) => config[key] || `mock-${key}`),
  getOrThrow: jest.fn((key: string) => config[key] || `mock-${key}`),
});

/**
 * Cache Mock 팩토리
 * Cache Manager를 모킹하기 위한 팩토리 함수
 */
export const createMockCacheManager = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  reset: jest.fn(),
  wrap: jest.fn(),
  store: {
    keys: jest.fn(),
    ttl: jest.fn(),
  },
});

/**
 * EventEmitter Mock 팩토리
 * EventEmitter2를 모킹하기 위한 팩토리 함수
 */
export const createMockEventEmitter = () => ({
  emit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  listeners: jest.fn().mockReturnValue([]),
  listenerCount: jest.fn().mockReturnValue(0),
});

/**
 * Queue Mock 팩토리
 * Bull Queue를 모킹하기 위한 팩토리 함수
 */
export const createMockQueue = () => ({
  add: jest.fn().mockResolvedValue({ id: 'job-id', data: {} }),
  process: jest.fn(),
  getJob: jest.fn(),
  getJobs: jest.fn().mockResolvedValue([]),
  getActive: jest.fn().mockResolvedValue([]),
  getWaiting: jest.fn().mockResolvedValue([]),
  getCompleted: jest.fn().mockResolvedValue([]),
  getFailed: jest.fn().mockResolvedValue([]),
  pause: jest.fn(),
  resume: jest.fn(),
  clean: jest.fn(),
  close: jest.fn(),
});

/**
 * 대량 데이터 테스트용 Mock 엔티티 생성기
 */
export const createMockEntities = {
  users: (count: number) => Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    userId: `user${i + 1}`,
    email: `user${i + 1}@example.com`,
    password: 'hashedpassword',
    createdAt: new Date(Date.now() - i * 86400000),
    updatedAt: new Date(),
  })),

  dashboards: (count: number) => Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Dashboard ${i + 1}`,
    layout: JSON.stringify([{ i: `widget${i}`, x: 0, y: 0, w: 4, h: 4 }]),
    shareId: i + 1,
    delYn: 'N',
    createdAt: new Date(Date.now() - i * 86400000),
    updatedAt: new Date(),
  })),

  widgets: (count: number) => Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Widget ${i + 1}`,
    description: `Test widget ${i + 1}`,
    databaseId: (i % 3) + 1,
    componentId: (i % 10) + 1,
    datasetType: 'dataset',
    datasetId: i + 1,
    tableName: `table_${i + 1}`,
    option: JSON.stringify({ type: 'line', data: [i, i * 2, i * 3] }),
    delYn: 'N',
    createdAt: new Date(Date.now() - i * 86400000),
    updatedAt: new Date(),
  })),

  connections: (count: number) => Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Connection ${i + 1}`,
    engine: ['mysql', 'postgresql', 'sqlite'][i % 3],
    host: 'localhost',
    port: [3306, 5432, 0][i % 3],
    database: `test_db_${i + 1}`,
    username: `user${i + 1}`,
    password: 'encrypted_password',
    createdAt: new Date(Date.now() - i * 86400000),
    updatedAt: new Date(),
  })),
};

/**
 * 성능 테스트 헬퍼
 */
export const performanceHelpers = {
  /**
   * 함수 실행 시간 측정
   */
  measureExecutionTime: async <T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> => {
    const startTime = Date.now();
    const result = await fn();
    const executionTime = Date.now() - startTime;
    return { result, executionTime };
  },

  /**
   * 메모리 사용량 증가 측정
   */
  measureMemoryIncrease: async <T>(fn: () => Promise<T>): Promise<{ result: T; memoryIncrease: number }> => {
    const beforeMemory = measureMemoryUsage();
    const result = await fn();
    const afterMemory = measureMemoryUsage();
    const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
    return { result, memoryIncrease };
  },

  /**
   * 동시 실행 성능 측정
   */
  measureConcurrentExecution: async <T>(
    operations: (() => Promise<T>)[],
    concurrencyLimit = 10
  ): Promise<{ results: T[]; totalExecutionTime: number; averageTime: number }> => {
    const startTime = Date.now();
    
    // 배치 단위로 실행
    const results: T[] = [];
    for (let i = 0; i < operations.length; i += concurrencyLimit) {
      const batch = operations.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }
    
    const totalExecutionTime = Date.now() - startTime;
    const averageTime = totalExecutionTime / operations.length;
    
    return { results, totalExecutionTime, averageTime };
  },
};

/**
 * 데이터베이스 트랜잭션 Mock 헬퍼
 */
export const createMockQueryRunner = () => ({
  manager: {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  },
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  isTransactionActive: false,
});

/**
 * E2E 테스트용 App Mock 팩토리
 */
export const createMockApp = () => ({
  getHttpServer: jest.fn().mockReturnValue({
    listen: jest.fn(),
    close: jest.fn(),
  }),
  init: jest.fn(),
  close: jest.fn(),
  get: jest.fn(),
  use: jest.fn(),
  useGlobalPipes: jest.fn(),
  useGlobalFilters: jest.fn(),
  useGlobalInterceptors: jest.fn(),
  useGlobalGuards: jest.fn(),
  setGlobalPrefix: jest.fn(),
  enableCors: jest.fn(),
});

/**
 * 날짜 관련 테스트 헬퍼
 */
export const dateHelpers = {
  /**
   * 특정 날짜로 Date.now() Mock
   */
  mockDateNow: (date: Date) => {
    const originalDateNow = Date.now;
    Date.now = jest.fn(() => date.getTime());
    return () => { Date.now = originalDateNow; };
  },

  /**
   * 날짜 범위 생성
   */
  createDateRange: (startDate: Date, days: number) => {
    return Array.from({ length: days }, (_, i) => 
      new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
    );
  },

  /**
   * 랜덤 날짜 생성
   */
  randomDate: (start: Date, end: Date) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  },
};

/**
 * 보안 테스트 헬퍼
 */
export const securityHelpers = {
  /**
   * SQL 인젝션 테스트 패턴
   */
  sqlInjectionPatterns: [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin' --",
    "' UNION SELECT * FROM users --",
    "'; DELETE FROM * --",
  ],

  /**
   * XSS 테스트 패턴
   */
  xssPatterns: [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<svg onload=alert("XSS")>',
  ],

  /**
   * 유효하지 않은 JWT 토큰 생성
   */
  createInvalidJWT: () => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnZhbGlkIjp0cnVlfQ.invalid',
};

/**
 * 성능 테스트 임계값
 */
export const performanceThresholds = {
  apiResponseTime: 200, // ms
  dbQueryTime: 100, // ms
  memoryUsageIncrease: 50, // MB
  concurrentUsers: 100,
  testTimeout: 5000, // ms
};

/**
 * 테스트 데이터 빌더 패턴
 */
export class TestDataBuilder<T> {
  private data: Partial<T> = {};

  with<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this;
  }

  withMany(data: Partial<T>): this {
    this.data = { ...this.data, ...data };
    return this;
  }

  build(): T {
    return this.data as T;
  }

  buildMany(count: number, customizer?: (index: number) => Partial<T>): T[] {
    return Array.from({ length: count }, (_, i) => ({
      ...this.data,
      ...(customizer ? customizer(i) : {}),
    })) as T[];
  }
}

/**
 * 테스트 시나리오 헬퍼
 */
export const scenarioHelpers = {
  /**
   * 인증된 사용자 시나리오 설정
   */
  setupAuthenticatedUser: (userId = 1, email = 'test@example.com') => ({
    user: { id: userId, email, userId: `user${userId}` },
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    headers: { authorization: 'Bearer mock-access-token' },
  }),

  /**
   * 데이터베이스 연결 시나리오 설정
   */
  setupDatabaseConnection: (engine = 'mysql') => ({
    connection: mockConnectionInfo[engine],
    mockConnection: createMockKnexConnection(),
  }),

  /**
   * 대시보드 생성 시나리오 설정
   */
  setupDashboardScenario: (userId = 1) => ({
    user: mockUser,
    dashboard: { ...mockDashboard, userId },
    widgets: [mockWidget],
    shareUrl: mockShareUrl,
  }),
};

/**
 * 테스트 assertion 헬퍼
 */
export const assertHelpers = {
  /**
   * API 응답 구조 검증
   */
  assertApiResponse: (response: any, expectedStatus = 'SUCCESS') => {
    expect(response).toHaveProperty('status', expectedStatus);
    if (expectedStatus === 'SUCCESS') {
      expect(response).toHaveProperty('data');
    } else {
      expect(response).toHaveProperty('message');
    }
  },

  /**
   * 페이지네이션 응답 검증
   */
  assertPaginatedResponse: (response: any) => {
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('total');
    expect(response).toHaveProperty('page');
    expect(response).toHaveProperty('limit');
    expect(Array.isArray(response.data)).toBe(true);
  },

  /**
   * 에러 응답 검증
   */
  assertErrorResponse: (response: any, expectedStatus: number) => {
    expect(response).toHaveProperty('statusCode', expectedStatus);
    expect(response).toHaveProperty('message');
    expect(response).toHaveProperty('error');
  },
};

/**
 * 통합 테스트 헬퍼
 */
export const integrationHelpers = {
  /**
   * 전체 인증 플로우 테스트
   */
  testAuthFlow: async (authService: any, userRepo: any) => {
    const user = await authService.validateUser('testuser', 'testpass');
    const accessToken = await authService.generateAccessToken(user);
    const refreshToken = await authService.generateRefreshToken(user);
    await authService.setRefreshKey(`Bearer ${refreshToken}`, user.id);
    return { user, accessToken, refreshToken };
  },

  /**
   * 대시보드 CRUD 플로우 테스트
   */
  testDashboardCRUD: async (dashboardService: any, userId: number) => {
    const created = await dashboardService.create({ title: 'Test Dashboard', userId });
    const updated = await dashboardService.update(created.id, { title: 'Updated Dashboard' });
    const found = await dashboardService.findOne(created.id);
    await dashboardService.remove(created.id);
    return { created, updated, found };
  },
};
