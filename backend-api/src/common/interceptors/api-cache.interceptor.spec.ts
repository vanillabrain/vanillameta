import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError, firstValueFrom } from 'rxjs';
import Redis from 'ioredis';
import { ApiCacheInterceptor } from './api-cache.interceptor';
import { CacheKeyService } from '../services/cache-key.service';
import { CacheMetricsService } from '../services/cache-metrics.service';
import { CacheConfig } from '../decorators/cache-config.decorator';

describe('ApiCacheInterceptor', () => {
  let interceptor: ApiCacheInterceptor;
  let redis: Redis;
  let reflector: Reflector;
  let cacheKeyService: CacheKeyService;
  let cacheMetricsService: CacheMetricsService;

  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockCacheKeyService = {
    generateKey: jest.fn(),
  };

  const mockCacheMetricsService = {
    recordCacheHit: jest.fn(),
    recordCacheMiss: jest.fn(),
    recordCacheError: jest.fn(),
  };

  const mockExecutionContext = {
    switchToHttp: jest.fn().mockReturnThis(),
    getRequest: jest.fn(),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  };

  const mockCallHandler = {
    handle: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiCacheInterceptor,
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: CacheKeyService,
          useValue: mockCacheKeyService,
        },
        {
          provide: CacheMetricsService,
          useValue: mockCacheMetricsService,
        },
      ],
    }).compile();

    interceptor = module.get<ApiCacheInterceptor>(ApiCacheInterceptor);
    redis = module.get<Redis>('default_IORedisModuleConnectionToken');
    reflector = module.get<Reflector>(Reflector);
    cacheKeyService = module.get<CacheKeyService>(CacheKeyService);
    cacheMetricsService = module.get<CacheMetricsService>(CacheMetricsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    const mockRequest = {
      method: 'GET',
      path: '/api/dashboards/1',
      query: {},
      headers: {},
    };

    const mockCacheConfig: CacheConfig = {
      ttl: 300,
      prefix: 'test',
    };

    beforeEach(() => {
      mockExecutionContext.getRequest.mockReturnValue(mockRequest);
      mockReflector.getAllAndOverride.mockReturnValue(mockCacheConfig);
      mockCacheKeyService.generateKey.mockReturnValue('test:get:/api/dashboards/1');
    });

    it('should return cached data on cache hit', async () => {
      // Given
      const cachedData = { id: 1, name: 'Test Dashboard' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      // When
      const result = await interceptor.intercept(
        mockExecutionContext as any,
        mockCallHandler as any,
      );

      // Then
      expect(mockRedis.get).toHaveBeenCalledWith('test:get:/api/dashboards/1');
      expect(mockCacheMetricsService.recordCacheHit).toHaveBeenCalled();
      expect(mockCallHandler.handle).not.toHaveBeenCalled();

      const emittedValue = await result.toPromise();
      expect(emittedValue).toEqual(cachedData);
    });

    it('should call handler and cache response on cache miss', async () => {
      // Given
      const responseData = { id: 1, name: 'Test Dashboard' };
      mockRedis.get.mockResolvedValue(null);
      mockCallHandler.handle.mockReturnValue(of(responseData));

      // When
      const result = await interceptor.intercept(
        mockExecutionContext as any,
        mockCallHandler as any,
      );

      // Then
      expect(mockRedis.get).toHaveBeenCalledWith('test:get:/api/dashboards/1');
      expect(mockCacheMetricsService.recordCacheMiss).toHaveBeenCalled();
      expect(mockCallHandler.handle).toHaveBeenCalled();

      const emittedValue = await result.toPromise();
      expect(emittedValue).toEqual(responseData);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:get:/api/dashboards/1',
        300,
        JSON.stringify(responseData),
      );
    });

    it('should skip caching when disabled', async () => {
      // Given
      mockReflector.getAllAndOverride.mockReturnValue({ disabled: true });

      // When
      const result = await interceptor.intercept(
        mockExecutionContext as any,
        mockCallHandler as any,
      );

      // Then
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should skip caching for non-GET methods', async () => {
      // Given
      mockExecutionContext.getRequest.mockReturnValue({
        ...mockRequest,
        method: 'POST',
      });

      // When
      await interceptor.intercept(
        mockExecutionContext as any,
        mockCallHandler as any,
      );

      // Then
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      // Given
      const responseData = { id: 1, name: 'Test Dashboard' };
      mockRedis.get.mockRejectedValue(new Error('Redis connection error'));
      mockCallHandler.handle.mockReturnValue(of(responseData));

      // When
      const result = await interceptor.intercept(
        mockExecutionContext as any,
        mockCallHandler as any,
      );

      // Then
      expect(mockCallHandler.handle).toHaveBeenCalled();
      const emittedValue = await result.toPromise();
      expect(emittedValue).toEqual(responseData);
    });

    it('should handle cache write errors gracefully', async () => {
      // Given
      const responseData = { id: 1, name: 'Test Dashboard' };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockRejectedValue(new Error('Redis write error'));
      mockCallHandler.handle.mockReturnValue(of(responseData));

      // When
      const result = await interceptor.intercept(
        mockExecutionContext as any,
        mockCallHandler as any,
      );

      // Then
      const emittedValue = await result.toPromise();
      expect(emittedValue).toEqual(responseData);
      expect(mockCacheMetricsService.recordCacheError).toHaveBeenCalled();
    });

    it('should use dynamic TTL when provided', async () => {
      // Given
      const dynamicTTL = jest.fn().mockReturnValue(600);
      mockReflector.getAllAndOverride.mockReturnValue({
        ...mockCacheConfig,
        dynamicTTL,
      });
      mockRedis.get.mockResolvedValue(null);
      mockCallHandler.handle.mockReturnValue(of({ data: 'test' }));

      // When
      await firstValueFrom(interceptor.intercept(
        mockExecutionContext as any,
        mockCallHandler as any,
      ));

      // Then
      expect(dynamicTTL).toHaveBeenCalledWith(mockRequest);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:get:/api/dashboards/1',
        600,
        expect.any(String),
      );
    });

    it('should include user ID in cache key when userSpecific is true', async () => {
      // Given
      const userRequest = {
        ...mockRequest,
        user: { id: 123 },
      };
      mockExecutionContext.getRequest.mockReturnValue(userRequest);
      mockReflector.getAllAndOverride.mockReturnValue({
        ...mockCacheConfig,
        userSpecific: true,
      });
      mockCacheKeyService.generateKey.mockReturnValue('test:user:123:get:/api/dashboards/1');

      // When
      await interceptor.intercept(
        mockExecutionContext as any,
        mockCallHandler as any,
      );

      // Then
      expect(mockCacheKeyService.generateKey).toHaveBeenCalledWith(
        userRequest,
        expect.objectContaining({ userSpecific: true }),
      );
    });
  });
});