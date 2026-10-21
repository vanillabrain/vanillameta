// Enhanced test setup file for optimized test execution
import 'reflect-metadata';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Global test configuration
global.jest = require('jest');

// Enhanced environment setup for testing
process.env.NODE_ENV = 'test';
process.env.ACCESS_SECRET = 'test-access-secret-enhanced';
process.env.REFRESH_SECRET = 'test-refresh-secret-enhanced';
process.env.URL_ACCESS_SECRET = 'test-url-access-secret-enhanced';

// Database configuration for testing
process.env.DB_TYPE = 'sqlite';
process.env.DB_DATABASE = ':memory:';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_LOGGING = 'false';

// Knex pool configuration for tests
process.env.KNEX_POOL_MIN = '0';
process.env.KNEX_POOL_MAX = '2';

// Performance optimization for tests
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

// Global test helpers
global.testConfig = {
  timeout: {
    unit: 10000, // 10 seconds for unit tests
    integration: 30000, // 30 seconds for integration tests
    e2e: 60000, // 60 seconds for E2E tests
    performance: 120000, // 2 minutes for performance tests
  },
  database: {
    maxConnections: 5,
    connectionTimeout: 5000,
  },
  security: {
    maxPayloadSize: '1mb',
    rateLimitWindow: 60000,
    rateLimitMax: 100,
  },
};

// Memory leak detection
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Suppress known warnings in test environment
console.warn = (...args: any[]) => {
  const message = args.join(' ');

  // Filter out known test warnings
  if (
    message.includes('ExperimentalWarning') ||
    message.includes('DeprecationWarning') ||
    message.includes('MaxListenersExceededWarning')
  ) {
    return;
  }

  originalConsoleWarn.apply(console, args);
};

console.error = (...args: any[]) => {
  const message = args.join(' ');

  // Filter out known test errors that are expected
  if (
    message.includes('Connection refused') ||
    message.includes('ECONNREFUSED') ||
    message.includes('Test timeout')
  ) {
    return;
  }

  originalConsoleError.apply(console, args);
};

// Global test utilities
global.testUtils = {
  /**
   * 비동기 작업 대기 헬퍼
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * 메모리 사용량 측정
   */
  measureMemory: () => {
    const used = process.memoryUsage();
    return {
      rss: Math.round((used.rss / 1024 / 1024) * 100) / 100,
      heapTotal: Math.round((used.heapTotal / 1024 / 1024) * 100) / 100,
      heapUsed: Math.round((used.heapUsed / 1024 / 1024) * 100) / 100,
      external: Math.round((used.external / 1024 / 1024) * 100) / 100,
    };
  },

  /**
   * 테스트 실행 시간 측정
   */
  measureTime: async (fn: () => Promise<any>) => {
    const start = Date.now();
    const result = await fn();
    const end = Date.now();
    return { result, duration: end - start };
  },

  /**
   * 무작위 테스트 데이터 생성
   */
  generateTestData: {
    user: (overrides = {}) => ({
      userId: `user_${Math.random().toString(36).substr(2, 9)}`,
      email: `test_${Math.random().toString(36).substr(2, 5)}@example.com`,
      password: 'testpassword123',
      name: `Test User ${Math.random().toString(36).substr(2, 5)}`,
      ...overrides,
    }),

    widget: (overrides = {}) => ({
      title: `Test Widget ${Math.random().toString(36).substr(2, 5)}`,
      description: `Test widget description ${Math.random().toString(36).substr(2, 10)}`,
      databaseId: 1,
      componentId: 1,
      datasetType: 'DATASET',
      datasetId: 1,
      option: {
        type: 'line',
        title: { text: 'Test Chart' },
        series: [{ data: [10, 20, 30], type: 'line' }],
      },
      ...overrides,
    }),

    dashboard: (overrides = {}) => ({
      title: `Test Dashboard ${Math.random().toString(36).substr(2, 5)}`,
      layout: [
        {
          i: '1',
          x: 0,
          y: 0,
          w: 4,
          h: 4,
        },
      ],
      ...overrides,
    }),
  },

  /**
   * 큰 데이터셋 생성 (성능 테스트용)
   */
  generateLargeDataset: (size: number) => {
    return Array.from({ length: size }, (_, index) => ({
      id: index + 1,
      name: `Item ${index + 1}`,
      value: Math.floor(Math.random() * 1000),
      date: new Date(Date.now() - index * 86400000).toISOString().split('T')[0],
      category: ['A', 'B', 'C'][index % 3],
    }));
  },
};

// Performance monitoring for tests
let testStartTime: number;
let testCount = 0;
let totalTestTime = 0;

const originalTest = global.test;
global.test = (name: string, fn: jest.ProvidesCallback, timeout?: number) => {
  return originalTest(
    name,
    async (...args) => {
      testStartTime = Date.now();
      testCount++;

      try {
        await fn(...args);
      } finally {
        const testEndTime = Date.now();
        const testDuration = testEndTime - testStartTime;
        totalTestTime += testDuration;

        // 느린 테스트 경고 (10초 이상)
        if (testDuration > 10000) {
          console.warn(`⚠️  Slow test detected: "${name}" took ${testDuration}ms`);
        }
      }
    },
    timeout,
  );
};

// Global test cleanup
let isCleanupScheduled = false;

const scheduleCleanup = () => {
  if (!isCleanupScheduled) {
    isCleanupScheduled = true;

    process.on('exit', () => {
      console.log(`\n📊 Test Execution Summary:`);
      console.log(`   Total tests: ${testCount}`);
      console.log(`   Total time: ${totalTestTime}ms`);
      console.log(`   Average time per test: ${Math.round(totalTestTime / testCount)}ms`);

      const finalMemory = global.testUtils.measureMemory();
      console.log(`   Final memory usage: ${finalMemory.heapUsed}MB`);
    });
  }
};

scheduleCleanup();

// Enhanced error handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
});

// Database connection pool monitoring
const connectionPools = new Map();

global.testUtils.monitorConnections = {
  register: (poolName: string, pool: any) => {
    connectionPools.set(poolName, pool);
  },

  getStatus: () => {
    const status: any = {};
    for (const [name, pool] of connectionPools) {
      if (pool && typeof pool.numUsed === 'function') {
        status[name] = {
          used: pool.numUsed(),
          free: pool.numFree(),
          pending: pool.numPendingAcquires(),
          pendingValidations: pool.numPendingValidations(),
        };
      }
    }
    return status;
  },

  cleanup: async () => {
    for (const [name, pool] of connectionPools) {
      if (pool && typeof pool.destroy === 'function') {
        try {
          await pool.destroy();
          console.log(`✅ Destroyed connection pool: ${name}`);
        } catch (error) {
          console.warn(`⚠️  Failed to destroy pool ${name}:`, error);
        }
      }
    }
    connectionPools.clear();
  },
};

// Test environment validation
const validateTestEnvironment = () => {
  const requiredEnvVars = ['NODE_ENV', 'ACCESS_SECRET', 'REFRESH_SECRET', 'URL_ACCESS_SECRET'];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Invalid NODE_ENV: expected 'test', got '${process.env.NODE_ENV}'`);
  }
};

// Run validation
validateTestEnvironment();

console.log('🚀 Enhanced test environment initialized');
console.log(`   Node version: ${process.version}`);
console.log(`   Platform: ${process.platform}`);
console.log(`   Memory limit: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
console.log(`   Worker ID: ${process.env.JEST_WORKER_ID || 'main'}`);
