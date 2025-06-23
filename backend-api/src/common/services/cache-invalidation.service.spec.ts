import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CacheKeyService } from './cache-key.service';

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let redis: Redis;
  let eventEmitter: EventEmitter2;
  let cacheKeyService: CacheKeyService;

  const mockRedis = {
    del: jest.fn(),
    pipeline: jest.fn(),
    scanStream: jest.fn(),
    smembers: jest.fn(),
    flushdb: jest.fn(),
    ttl: jest.fn(),
  };

  const mockPipeline = {
    del: jest.fn(),
    exec: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockCacheKeyService = {
    generateDashboardKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidationService,
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: CacheKeyService,
          useValue: mockCacheKeyService,
        },
      ],
    }).compile();

    service = module.get<CacheInvalidationService>(CacheInvalidationService);
    redis = module.get<Redis>('default_IORedisModuleConnectionToken');
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    cacheKeyService = module.get<CacheKeyService>(CacheKeyService);

    mockRedis.pipeline.mockReturnValue(mockPipeline);
    mockPipeline.del.mockReturnThis();
    mockPipeline.exec.mockResolvedValue([]);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('invalidateByPattern', () => {
    it('should delete keys matching pattern', async () => {
      // Given
      const pattern = 'dashboard:123:*';
      const mockKeys = ['dashboard:123:metadata', 'dashboard:123:widgets'];
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback(mockKeys);
          if (event === 'end') callback();
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      // When
      const result = await service.invalidateByPattern(pattern);

      // Then
      expect(result).toBe(2);
      expect(mockPipeline.del).toHaveBeenCalledWith('dashboard:123:metadata');
      expect(mockPipeline.del).toHaveBeenCalledWith('dashboard:123:widgets');
      expect(mockPipeline.exec).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('cache.invalidated', {
        pattern,
        count: 2,
        timestamp: expect.any(Date),
      });
    });

    it('should return 0 when no keys found', async () => {
      // Given
      const pattern = 'nonexistent:*';
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback([]);
          if (event === 'end') callback();
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      // When
      const result = await service.invalidateByPattern(pattern);

      // Then
      expect(result).toBe(0);
      expect(mockPipeline.exec).not.toHaveBeenCalled();
    });

    it('should handle scan errors', async () => {
      // Given
      const pattern = 'error:*';
      const mockError = new Error('Scan error');
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'error') callback(mockError);
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      // When/Then
      await expect(service.invalidateByPattern(pattern)).rejects.toThrow('Scan error');
    });
  });

  describe('invalidateDashboard', () => {
    it('should invalidate all dashboard-related keys', async () => {
      // Given
      const dashboardId = 123;
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback(['dashboard:123:metadata']);
          if (event === 'end') callback();
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      // When
      await service.invalidateDashboard(dashboardId);

      // Then
      expect(mockRedis.scanStream).toHaveBeenCalledWith({
        match: `dashboard:${dashboardId}:*`,
        count: 100,
      });
      expect(mockRedis.scanStream).toHaveBeenCalledWith({
        match: `*:dashboard:${dashboardId}:*`,
        count: 100,
      });
    });
  });

  describe('invalidateDataset', () => {
    it('should invalidate dataset and related dashboard caches', async () => {
      // Given
      const datasetId = 456;
      const relatedDashboards = ['123', '456'];
      mockRedis.smembers.mockResolvedValue(relatedDashboards);
      
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback([]);
          if (event === 'end') callback();
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      // When
      await service.invalidateDataset(datasetId);

      // Then
      expect(mockRedis.smembers).toHaveBeenCalledWith(`dataset:${datasetId}:dashboards`);
      expect(mockRedis.scanStream).toHaveBeenCalledTimes(6); // 2 for dataset + 4 for dashboards
    });
  });

  describe('invalidateWidget', () => {
    it('should invalidate widget and dashboard metadata', async () => {
      // Given
      const dashboardId = 123;
      const widgetId = 789;
      mockCacheKeyService.generateDashboardKey.mockReturnValue('dashboard:123:metadata');
      mockRedis.del.mockResolvedValue(1);
      
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback([]);
          if (event === 'end') callback();
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      // When
      await service.invalidateWidget(dashboardId, widgetId);

      // Then
      expect(mockCacheKeyService.generateDashboardKey).toHaveBeenCalledWith(dashboardId);
      expect(mockRedis.del).toHaveBeenCalledWith('dashboard:123:metadata');
    });
  });

  describe('invalidateUser', () => {
    it('should invalidate all user-related keys', async () => {
      // Given
      const userId = 111;
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback(['user:111:dashboards']);
          if (event === 'end') callback();
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      // When
      await service.invalidateUser(userId);

      // Then
      expect(mockRedis.scanStream).toHaveBeenCalledWith({
        match: `user:${userId}:*`,
        count: 100,
      });
    });
  });

  describe('event handlers', () => {
    it('should handle dashboard.updated event', async () => {
      // Given
      const payload = { dashboardId: 123 };
      const spy = jest.spyOn(service, 'invalidateDashboard').mockResolvedValue();

      // When
      await service.handleDashboardUpdate(payload);

      // Then
      expect(spy).toHaveBeenCalledWith(123);
    });

    it('should handle dataset.updated event', async () => {
      // Given
      const payload = { datasetId: 456 };
      const spy = jest.spyOn(service, 'invalidateDataset').mockResolvedValue();

      // When
      await service.handleDatasetUpdate(payload);

      // Then
      expect(spy).toHaveBeenCalledWith(456);
    });

    it('should handle widget.updated event', async () => {
      // Given
      const payload = { dashboardId: 123, widgetId: 789 };
      const spy = jest.spyOn(service, 'invalidateWidget').mockResolvedValue();

      // When
      await service.handleWidgetUpdate(payload);

      // Then
      expect(spy).toHaveBeenCalledWith(123, 789);
    });

    it('should handle user.permissions.changed event', async () => {
      // Given
      const payload = { userId: 111 };
      const spy = jest.spyOn(service, 'invalidateUser').mockResolvedValue();

      // When
      await service.handleUserPermissionsChange(payload);

      // Then
      expect(spy).toHaveBeenCalledWith(111);
    });
  });

  describe('flushAll', () => {
    it('should flush all cache data', async () => {
      // When
      await service.flushAll();

      // Then
      expect(mockRedis.flushdb).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('cache.flushed', {
        timestamp: expect.any(Date),
      });
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('should cleanup expired keys', async () => {
      // Given
      const mockKeys = ['key1', 'key2', 'key3'];
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback(mockKeys);
          if (event === 'end') callback();
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.ttl.mockResolvedValueOnce(-1) // key1 expired
        .mockResolvedValueOnce(100) // key2 not expired
        .mockResolvedValueOnce(-2); // key3 expired
      mockRedis.del.mockResolvedValue(1);

      // When
      const result = await service.cleanupExpiredKeys();

      // Then
      expect(result).toBe(2);
      expect(mockRedis.del).toHaveBeenCalledWith('key1');
      expect(mockRedis.del).toHaveBeenCalledWith('key3');
      expect(mockRedis.del).not.toHaveBeenCalledWith('key2');
    });
  });
});