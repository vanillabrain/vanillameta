const baseConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/lambda.ts',
    '!src/serverless.ts',
  ],
  coverageDirectory: './coverage',
  cache: true,
  detectOpenHandles: true,
  forceExit: true,
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: {
        allowJs: true,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    }],
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/test/fixtures/',
  ],
  reporters: ['default'],
};

module.exports = {
  ...baseConfig,
  // 기본 설정: 단위 테스트
  testMatch: ['**/*.spec.ts', '!**/test/e2e/**', '!**/test/performance/**'],
  testTimeout: 10000,
  maxWorkers: 2,
  maxConcurrency: 10,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85,
    },
  },
  // 프로젝트별 설정
  projects: [
    {
      ...baseConfig,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      testTimeout: 5000,
    },
    {
      ...baseConfig,
      displayName: 'integration', 
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
      testTimeout: 15000,
    },
    {
      ...baseConfig,
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
      testTimeout: 30000,
      maxWorkers: 1,
    }
  ]
};