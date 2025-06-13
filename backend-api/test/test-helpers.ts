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
