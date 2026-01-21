import { Test, TestingModule } from '@nestjs/testing';
import { MetricsInterceptor } from './metrics.interceptor';
import { IntegratedMetricsService } from '../monitoring/integrated-metrics.service';
import { ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let metricsService: IntegratedMetricsService;

  const mockMetricsService = {
    recordApiRequest: jest.fn().mockResolvedValue(undefined),
    recordLambdaMetrics: jest.fn().mockResolvedValue(undefined),
  };

  const mockExecutionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        method: 'GET',
        route: { path: '/api/users/:id' },
        path: '/api/users/123',
        user: { id: 'user123' },
      }),
      getResponse: jest.fn().mockReturnValue({
        statusCode: 200,
      }),
    }),
  } as unknown as ExecutionContext;

  const mockCallHandler = {
    handle: jest.fn(),
  } as CallHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsInterceptor,
        {
          provide: IntegratedMetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    interceptor = module.get<MetricsInterceptor>(MetricsInterceptor);
    metricsService = module.get<IntegratedMetricsService>(IntegratedMetricsService);

    jest.clearAllMocks();
    // Reset global lambda warm up flag
    delete (global as any).lambdaWarmUp;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should record metrics for successful requests', async () => {
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      // Subscribe to trigger the interceptor
      await new Promise((resolve) => {
        result$.subscribe({
          next: (value) => {
            expect(value).toEqual({ data: 'test' });
            resolve(undefined);
          },
        });
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(metricsService.recordApiRequest).toHaveBeenCalledWith(
        'GET',
        '/api/users/:id',
        200,
        expect.any(Number),
        'user123',
      );
    });

    it('should record metrics for error responses', async () => {
      const error = new HttpException('Bad Request', 400);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      // Subscribe and expect error
      await expect(
        new Promise((resolve, reject) => {
          result$.subscribe({
            next: resolve,
            error: reject,
          });
        }),
      ).rejects.toThrow(error);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(metricsService.recordApiRequest).toHaveBeenCalledWith(
        'GET',
        '/api/users/:id',
        400,
        expect.any(Number),
        'user123',
      );
    });

    it('should handle non-HttpException errors', async () => {
      const error = new Error('Internal Error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      // Subscribe and expect error
      await expect(
        new Promise((resolve, reject) => {
          result$.subscribe({
            next: resolve,
            error: reject,
          });
        }),
      ).rejects.toThrow(error);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(metricsService.recordApiRequest).toHaveBeenCalledWith(
        'GET',
        '/api/users/:id',
        500,
        expect.any(Number),
        'user123',
      );
    });

    it('should track cold starts', async () => {
      // First request should be cold start
      expect((global as any).lambdaWarmUp).toBeUndefined();
      
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }));
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      await new Promise((resolve) => {
        result$.subscribe({
          next: () => resolve(undefined),
        });
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(metricsService.recordLambdaMetrics).toHaveBeenCalledWith(
        true, // cold start
        expect.any(Number),
        expect.any(Number),
      );

      expect((global as any).lambdaWarmUp).toBe(true);

      // Second request should not be cold start
      jest.clearAllMocks();
      
      const result2$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      await new Promise((resolve) => {
        result2$.subscribe({
          next: () => resolve(undefined),
        });
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(metricsService.recordLambdaMetrics).toHaveBeenCalledWith(
        false, // not cold start
        expect.any(Number),
        expect.any(Number),
      );

      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    });

    it('should handle requests without user', async () => {
      const contextWithoutUser = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            route: { path: '/api/health' },
            path: '/api/health',
            // no user property
          }),
          getResponse: jest.fn().mockReturnValue({
            statusCode: 200,
          }),
        }),
      } as unknown as ExecutionContext;

      mockCallHandler.handle.mockReturnValue(of({ status: 'ok' }));

      const result$ = interceptor.intercept(contextWithoutUser, mockCallHandler);

      await new Promise((resolve) => {
        result$.subscribe({
          next: () => resolve(undefined),
        });
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(metricsService.recordApiRequest).toHaveBeenCalledWith(
        'GET',
        '/api/health',
        200,
        expect.any(Number),
        undefined,
      );
    });

    it('should handle requests without route', async () => {
      const contextWithoutRoute = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            path: '/api/test',
            // no route property
          }),
          getResponse: jest.fn().mockReturnValue({
            statusCode: 200,
          }),
        }),
      } as unknown as ExecutionContext;

      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }));

      const result$ = interceptor.intercept(contextWithoutRoute, mockCallHandler);

      await new Promise((resolve) => {
        result$.subscribe({
          next: () => resolve(undefined),
        });
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(metricsService.recordApiRequest).toHaveBeenCalledWith(
        'GET',
        '/api/test',
        200,
        expect.any(Number),
        undefined,
      );
    });
  });
});