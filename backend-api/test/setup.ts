// Test setup file for global configurations
import 'reflect-metadata';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.ACCESS_SECRET = 'test-access-secret';
process.env.REFRESH_SECRET = 'test-refresh-secret';
process.env.URL_ACCESS_SECRET = 'test-url-access-secret';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.REDIS_DB = '0';

// Increase test timeout for slower operations
jest.setTimeout(30000);

// Global mocks
global.console.warn = jest.fn();
global.console.error = jest.fn();

// Mock date for consistent test results
const mockDate = new Date('2025-06-17T12:00:00.000Z');
const realDate = Date;
global.Date = jest.fn((...args: any[]) => {
  if (args.length) {
    return new (realDate as any)(...args);
  }
  return mockDate;
}) as any;
global.Date.now = jest.fn(() => mockDate.getTime());
global.Date.parse = realDate.parse;
global.Date.UTC = realDate.UTC;

// Clean up after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  // Don't restore all mocks as it breaks our global mocks
});

// Suppress specific warnings
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    args[0]?.includes?.('AWS SDK') ||
    args[0]?.includes?.('maintenance mode') ||
    args[0]?.includes?.('deprecated')
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

// Improved error formatting
const originalError = console.error;
console.error = (...args: any[]) => {
  if (
    args[0]?.includes?.('Cannot log after tests are done') ||
    args[0]?.includes?.('Warning: An update to')
  ) {
    return;
  }
  originalError.apply(console, args);
};

// Mock TypeORM connection
jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    createConnection: jest.fn().mockResolvedValue({
      close: jest.fn(),
      getRepository: jest.fn(),
    }),
  };
});

// Mock Knex
jest.mock('knex', () => {
  return jest.fn(() => ({
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
      const trx = {
        raw: jest.fn().mockResolvedValue({ rows: [] }),
        commit: jest.fn(),
        rollback: jest.fn(),
      };
      return callback(trx);
    }),
  }));
});

// Mock Redis (if used)
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    disconnect: jest.fn(),
  }));
});

// Mock Bull Queue
jest.mock('bull', () => {
  return jest.fn().mockImplementation((name: string) => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    getJobs: jest.fn().mockResolvedValue([]),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }),
    clean: jest.fn().mockResolvedValue([]),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    empty: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  }));
});

// Mock @nestjs/bull
jest.mock('@nestjs/bull', () => ({
  ...jest.requireActual('@nestjs/bull'),
  BullModule: {
    forRoot: jest.fn().mockReturnValue({
      module: class MockBullModule {},
      providers: [],
      exports: [],
    }),
    registerQueue: jest.fn().mockReturnValue({
      module: class MockBullQueueModule {},
      providers: [],
      exports: [],
    }),
  },
  InjectQueue: jest.fn().mockImplementation((queueName: string) => {
    return (target: any, propertyKey: string, parameterIndex: number) => {
      // Mock decorator
    };
  }),
}));

// Mock cache-manager
jest.mock('cache-manager', () => ({
  caching: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    reset: jest.fn(),
    wrap: jest.fn().mockImplementation(async (key, fn) => fn()),
  }),
  multiCaching: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    reset: jest.fn(),
    wrap: jest.fn().mockImplementation(async (key, fn) => fn()),
  }),
}));

// Mock @nestjs/cache-manager
jest.mock('@nestjs/cache-manager', () => ({
  CacheModule: {
    register: jest.fn().mockReturnValue({
      module: class MockCacheModule {},
      providers: [],
      exports: [],
    }),
    forRoot: jest.fn().mockReturnValue({
      module: class MockCacheModule {},
      providers: [],
      exports: [],
    }),
  },
  CACHE_MANAGER: 'CACHE_MANAGER',
}));

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Location: 'https://mock-s3-url.com/file' }),
    }),
    deleteObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    }),
  })),
  SES: jest.fn(() => ({
    sendEmail: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ MessageId: 'mock-message-id' }),
    }),
  })),
  CloudWatch: jest.fn(() => ({
    putMetricData: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    }),
  })),
}));

// Performance monitoring
let testStartTime: number;

beforeEach(() => {
  testStartTime = realDate.now();
});

afterEach(() => {
  const testEndTime = realDate.now();
  const testDuration = testEndTime - testStartTime;
  
  if (testDuration > 5000) {
    console.warn(`Slow test detected: ${expect.getState().currentTestName} took ${testDuration}ms`);
  }
});

// Memory leak detection
let initialMemory: NodeJS.MemoryUsage;

beforeAll(() => {
  initialMemory = process.memoryUsage();
});

afterAll(() => {
  const finalMemory = process.memoryUsage();
  const memoryDiff = finalMemory.heapUsed - initialMemory.heapUsed;
  
  if (memoryDiff > 100 * 1024 * 1024) { // 100MB
    console.warn(`Potential memory leak detected: ${(memoryDiff / 1024 / 1024).toFixed(2)}MB increase`);
  }
});

// Custom matchers
expect.extend({
  toBeSuccessResponse(received) {
    const pass = received?.status === 'SUCCESS';
    return {
      pass,
      message: () =>
        pass
          ? `expected response not to be successful`
          : `expected response to be successful, but got status: ${received?.status}`,
    };
  },
  toBeErrorResponse(received) {
    const pass = received?.status === 'ERROR';
    return {
      pass,
      message: () =>
        pass
          ? `expected response not to be an error`
          : `expected response to be an error, but got status: ${received?.status}`,
    };
  },
});

// TypeScript type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeSuccessResponse(): R;
      toBeErrorResponse(): R;
    }
  }
}