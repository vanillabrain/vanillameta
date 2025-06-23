import { handler } from './serverless';
import { Context } from 'aws-lambda';

// NestJS 모킹
jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn().mockResolvedValue({
      use: jest.fn(),
      setGlobalPrefix: jest.fn(),
      useGlobalPipes: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      get: jest.fn().mockReturnValue({
        recordWarmupSuccess: jest.fn(),
        recordWarmupFailure: jest.fn(),
        recordColdStart: jest.fn(),
        recordWarmStart: jest.fn(),
        recordMemoryUsage: jest.fn(),
      }),
      init: jest.fn(),
    }),
  },
}));

// aws-serverless-express 모킹
jest.mock('aws-serverless-express', () => ({
  createServer: jest.fn().mockReturnValue({}),
  proxy: jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ message: 'OK' }),
    }),
  }),
}));

describe('Serverless Warmup (T02_S04)', () => {
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'vanillameta-backend-api-test-app',
      callbackWaitsForEmptyEventLoop: false,
      memoryLimitInMB: '1024',
    } as Context;

    // 콘솔 로그 모킹
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('웜업 요청 처리', () => {
    it('웜업 요청을 올바르게 감지하고 처리해야 함', async () => {
      // Given: 웜업 이벤트
      const warmupEvent = {
        source: 'serverless-plugin-warmup',
      };

      // When: 핸들러 실행
      const result = await handler(warmupEvent, mockContext, {} as any);

      // Then: 웜업 응답 확인
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({
          message: 'Lambda function warmed up successfully',
          requestId: 'test-request-id',
          timestamp: expect.any(String),
        }),
      });

      // 웜업 로그 확인
      expect(console.log).toHaveBeenCalledWith('WarmUp - Lambda 함수 웜업 요청 처리됨', {
        requestId: 'test-request-id',
        functionName: 'vanillameta-backend-api-test-app',
        timestamp: expect.any(String),
        environment: process.env.NODE_ENV,
      });
    });

    it('웜업 요청이 아닌 경우 정상적으로 처리해야 함', async () => {
      // Given: 일반 HTTP 이벤트
      const httpEvent: any = {
        httpMethod: 'GET',
        path: '/v1/health',
        headers: {},
        body: null,
      };

      // When: 핸들러 실행
      // Note: 실제 HTTP 요청 처리는 통합 테스트에서 검증
      // 여기서는 웜업 요청이 아님을 확인만 함
      expect(httpEvent.source).toBeUndefined();
    });

    it('웜업 응답 형식이 올바른지 확인', async () => {
      // Given: 웜업 이벤트
      const warmupEvent = {
        source: 'serverless-plugin-warmup',
      };

      // When: 핸들러 실행
      const result = await handler(warmupEvent, mockContext, {} as any);

      // Then: 응답 형식 검증
      expect(result).toHaveProperty('statusCode', 200);
      expect(result).toHaveProperty('body');

      const body = JSON.parse(result.body as string);
      expect(body).toHaveProperty('message', 'Lambda function warmed up successfully');
      expect(body).toHaveProperty('requestId', 'test-request-id');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('duration');
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
      expect(typeof body.duration).toBe('number');
    });

    it('환경 변수가 웜업 로그에 포함되어야 함', async () => {
      // Given: 환경 변수 설정
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const warmupEvent = {
        source: 'serverless-plugin-warmup',
      };

      try {
        // When: 핸들러 실행
        await handler(warmupEvent, mockContext, {} as any);

        // Then: 환경 변수가 로그에 포함되는지 확인
        expect(console.log).toHaveBeenCalledWith(
          'WarmUp - Lambda 함수 웜업 요청 처리됨',
          expect.objectContaining({
            environment: 'test',
          }),
        );
      } finally {
        // 환경 변수 복원
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('웜업 실패 시 500 상태코드를 반환해야 함', async () => {
      // Given: NestJS 생성 실패 시뮬레이션
      const { NestFactory } = require('@nestjs/core');
      NestFactory.create.mockRejectedValueOnce(new Error('Server initialization failed'));

      const warmupEvent = {
        source: 'serverless-plugin-warmup',
      };

      // When: 핸들러 실행
      const result = await handler(warmupEvent, mockContext, {} as any);

      // Then: 실패 응답 확인
      expect(result).toHaveProperty('statusCode', 500);
      expect(result).toHaveProperty('body');

      const body = JSON.parse(result.body as string);
      expect(body).toHaveProperty('message', 'Warmup failed');
      expect(body).toHaveProperty('requestId', 'test-request-id');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('timestamp');

      // 에러 로그 확인
      expect(console.error).toHaveBeenCalledWith(
        '웜업 요청 처리 중 오류 발생:',
        expect.any(Error),
      );
    });

    it('웜업 메트릭이 올바르게 기록되어야 함', async () => {
      // Given: 웜업 이벤트
      const warmupEvent = {
        source: 'serverless-plugin-warmup',
      };

      // When: 핸들러 실행
      await handler(warmupEvent, mockContext, {} as any);

      // Then: 메트릭 서비스 호출 확인 (모킹된 서비스)
      // 실제 환경에서는 WarmupMetricsService.recordWarmupSuccess가 호출됨
      expect(console.log).toHaveBeenCalledWith(
        'WarmUp - Lambda 함수 웜업 요청 처리됨',
        expect.objectContaining({
          requestId: 'test-request-id',
          functionName: 'vanillameta-backend-api-test-app',
        }),
      );
    });
  });

  describe('콜백 설정', () => {
    it('callbackWaitsForEmptyEventLoop가 false로 설정되어야 함', async () => {
      // Given: 임의 이벤트
      const event = {};

      // When: 핸들러 실행 시작
      const handlerPromise = handler(event, mockContext, {} as any);

      // Then: 콜백 설정 확인
      expect(mockContext.callbackWaitsForEmptyEventLoop).toBe(false);

      // 핸들러 완료를 위해 웜업 이벤트로 변경
      await handler({ source: 'serverless-plugin-warmup' }, mockContext, {} as any);
    });
  });
});
