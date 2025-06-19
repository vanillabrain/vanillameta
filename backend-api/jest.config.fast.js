// 빠른 테스트 실행을 위한 Jest 설정
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  // 단위 테스트만 실행 (통합 테스트 제외)
  testMatch: [
    '**/*.service.spec.ts',
    '**/*.controller.spec.ts',
    '!**/*.integration.spec.ts',
    '!**/test/**',
    '!**/QTT-*/**',
    '!**/performance/**',
    '!**/security/**',
  ],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      isolatedModules: true, // 타입 체크 비활성화로 속도 향상
    }],
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
  testTimeout: 5000, // 타임아웃 단축
  maxWorkers: '50%', // CPU의 50%만 사용
  cache: true,
  cacheDirectory: '.jest-cache',
  // 병렬 실행 최적화
  maxConcurrency: 5,
  // 메모리 최적화
  detectOpenHandles: false,
  forceExit: true,
  // 테스트 실행 순서 (빠른 테스트 먼저)
  testSequencer: '<rootDir>/test/fast-sequencer.js',
  // 불필요한 기능 비활성화
  collectCoverage: false,
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
  // 글로벌 설정
  globals: {
    'ts-jest': {
      tsconfig: {
        allowJs: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        // 타입 체크 비활성화
        isolatedModules: true,
      },
    },
  },
};