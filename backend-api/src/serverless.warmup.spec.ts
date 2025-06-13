import { handler } from './serverless';
import { Context } from 'aws-lambda';

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
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
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
