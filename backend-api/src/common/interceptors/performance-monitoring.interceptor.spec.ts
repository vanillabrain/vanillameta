import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { PerformanceMonitoringInterceptor } from './performance-monitoring.interceptor';
import { PerformanceMetricsService } from '../services/performance-metrics.service';

describe('PerformanceMonitoringInterceptor', () => {
  let interceptor: PerformanceMonitoringInterceptor;
  let metricsService: jest.Mocked<PerformanceMetricsService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(async () => {
    // Mock 객체 생성
    mockRequest = {
      method: 'GET',
      url: '/api/dashboards/123',
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '192.168.1.1',
      },
      params: { id: '123' },
      query: { limit: '10' },
      body: {},
      ip: '127.0.0.1',
    };

    mockResponse = {
      statusCode: 200,
      setHeader: jest.fn(),
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn(),
    } as any;

    // 모듈 생성
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceMonitoringInterceptor,
        {
          provide: PerformanceMetricsService,
          useValue: {
            recordRequestMetrics: jest.fn(),
            recordErrorMetrics: jest.fn(),
            updateActiveRequests: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<PerformanceMonitoringInterceptor>(
      PerformanceMonitoringInterceptor,
    );
    metricsService = module.get(PerformanceMetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('성공적인 요청을 모니터링해야 함', (done) => {
      const mockData = { result: 'success' };
      mockCallHandler.handle.mockReturnValue(of(mockData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(mockData);
          
          // 메트릭 서비스 호출 확인
          expect(metricsService.updateActiveRequests).toHaveBeenCalledTimes(2);
          expect(metricsService.recordRequestMetrics).toHaveBeenCalledWith(
            expect.objectContaining({
              method: 'GET',
              url: '/api/dashboards/123',
              statusCode: 200,
              endpoint: '/api/dashboards/:id',
            }),
          );
          
          // 응답 헤더 설정 확인
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'X-Response-Time',
            expect.stringMatching(/^\d+ms$/),
          );
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'X-Request-Id',
            expect.any(String),
          );
          
          done();
        },
      });
    });

    it('에러 발생 시 에러 메트릭을 기록해야 함', (done) => {
      const mockError = new Error('Test error');
      (mockError as any).status = 500;
      mockCallHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (error) => {
          expect(error).toBe(mockError);
          
          // 에러 메트릭 서비스 호출 확인
          expect(metricsService.updateActiveRequests).toHaveBeenCalledTimes(2);
          expect(metricsService.recordErrorMetrics).toHaveBeenCalledWith(
            expect.objectContaining({
              method: 'GET',
              url: '/api/dashboards/123',
              statusCode: 500,
              error: 'Test error',
              endpoint: '/api/dashboards/:id',
            }),
          );
          
          done();
        },
      });
    });

    it('URL에서 엔드포인트 패턴을 올바르게 추출해야 함', (done) => {
      // 숫자 ID가 포함된 URL
      mockRequest.url = '/api/users/12345/posts/67890';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.recordRequestMetrics).toHaveBeenCalledWith(
            expect.objectContaining({
              endpoint: '/api/users/:id/posts/:id',
            }),
          );
          done();
        },
      });
    });

    it('UUID가 포함된 URL을 올바르게 처리해야 함', (done) => {
      // UUID가 포함된 URL
      mockRequest.url = '/api/resources/550e8400-e29b-41d4-a716-446655440000';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.recordRequestMetrics).toHaveBeenCalledWith(
            expect.objectContaining({
              endpoint: '/api/resources/:uuid',
            }),
          );
          done();
        },
      });
    });

    it('쿼리 파라미터를 제거해야 함', (done) => {
      mockRequest.url = '/api/dashboards?page=1&limit=10&sort=name';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.recordRequestMetrics).toHaveBeenCalledWith(
            expect.objectContaining({
              endpoint: '/api/dashboards',
            }),
          );
          done();
        },
      });
    });

    it('응답 크기를 계산해야 함', (done) => {
      const largeData = {
        items: Array(100).fill({ id: 1, name: 'test', description: 'A test item' }),
      };
      mockCallHandler.handle.mockReturnValue(of(largeData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const call = metricsService.recordRequestMetrics.mock.calls[0][0];
          expect(call).toBeDefined();
          done();
        },
      });
    });

    it('느린 API 응답에 대해 경고를 로그해야 함', (done) => {
      mockCallHandler.handle.mockReturnValue(of({ result: 'success' }));
      
      // 로거 스파이 설정
      const loggerSpy = jest.spyOn((interceptor as any).logger, 'warn');

      // Date.now()를 모킹하여 1초 이상의 응답 시간 시뮬레이션
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 1000 : 2001; // 1001ms 응답 시간
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(loggerSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              message: 'Slow API response detected',
              responseTime: 1001,
              threshold: 1000,
            }),
          );
          
          Date.now = originalDateNow;
          done();
        },
      });
    });

    it('메모리 사용량 변화를 추적해야 함', (done) => {
      const initialMemory = {
        rss: 100000000,
        heapTotal: 50000000,
        heapUsed: 30000000,
        external: 5000000,
        arrayBuffers: 1000000,
      };

      const finalMemory = {
        rss: 110000000,
        heapTotal: 50000000,
        heapUsed: 35000000,
        external: 6000000,
        arrayBuffers: 1200000,
      };

      let memoryCallCount = 0;
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        memoryCallCount++;
        return memoryCallCount === 1 ? initialMemory : finalMemory;
      });

      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.recordRequestMetrics).toHaveBeenCalledWith(
            expect.objectContaining({
              memoryDelta: {
                heapUsed: 5000000,
                external: 1000000,
                arrayBuffers: 200000,
              },
            }),
          );
          done();
        },
      });
    });

    it('CPU 사용률을 기록해야 함', (done) => {
      const cpuUsage = { user: 100000, system: 50000 };
      jest.spyOn(process, 'cpuUsage').mockReturnValue(cpuUsage);

      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.recordRequestMetrics).toHaveBeenCalledWith(
            expect.objectContaining({
              cpuUsage,
            }),
          );
          done();
        },
      });
    });

    it('동시 요청 수를 추적해야 함', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          // 시작 시 증가, 종료 시 감소
          expect(metricsService.updateActiveRequests).toHaveBeenCalledTimes(2);
          expect(metricsService.updateActiveRequests).toHaveBeenNthCalledWith(1, 1);
          expect(metricsService.updateActiveRequests).toHaveBeenNthCalledWith(2, 0);
          done();
        },
      });
    });

    it('에러 발생 시에도 동시 요청 수를 감소시켜야 함', (done) => {
      mockCallHandler.handle.mockReturnValue(throwError(() => new Error('Test')));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          expect(metricsService.updateActiveRequests).toHaveBeenCalledTimes(2);
          expect(metricsService.updateActiveRequests).toHaveBeenNthCalledWith(1, 1);
          expect(metricsService.updateActiveRequests).toHaveBeenNthCalledWith(2, 0);
          done();
        },
      });
    });
  });
});