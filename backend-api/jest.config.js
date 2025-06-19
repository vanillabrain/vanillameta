module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
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
  testTimeout: 10000,
  maxWorkers: 2,
  // 캐시 활성화로 테스트 속도 향상
  cache: true,
  // 테스트 실행 순서 최적화
  // testSequencer: '<rootDir>/test/custom-sequencer.js',
  // 느린 테스트 감지
  slowTestThreshold: 5,
  // 메모리 누수 방지
  detectOpenHandles: true,
  forceExit: true,
  // 병렬 실행 최적화
  maxConcurrency: 10,
  // 테스트 환경 변수
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },
  // 글로벌 설정
  globals: {
    'ts-jest': {
      tsconfig: {
        allowJs: true,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    },
  },
  // 무시할 패턴
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/test/fixtures/',
  ],
  // 커버리지 임계값
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85,
    },
  },
  // 리포터 설정
  reporters: ['default'],
};