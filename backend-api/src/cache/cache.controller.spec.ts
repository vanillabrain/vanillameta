import { Test, TestingModule } from '@nestjs/testing';
import { CacheController } from './cache.controller';
import { QueryCacheService } from './services/query-cache.service';
import { CacheStatisticsService } from './services/cache-statistics.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { ResponseStatus } from '../common/enum/response-status.enum';

describe('CacheController', () => {
  let controller: CacheController;
  let cacheService: jest.Mocked<QueryCacheService>;
  let statisticsService: jest.Mocked<CacheStatisticsService>;
  let invalidationService: jest.Mocked<CacheInvalidationService>;

  const mockUser = {
    userId: 'user123',
    email: 'test@example.com',
  };

  const mockStatistics = {
    hitRate: 75.5,
    totalHits: 1500,
    totalMisses: 500,
    totalSets: 800,
    averageExecutionTime: 2500,
    cacheEfficiency: 85.2,
    periodStart: new Date('2023-01-01T00:00:00Z'),
    periodEnd: new Date('2023-01-01T23:59:59Z'),
  };

  const mockMemoryInfo = {
    hitEvents: 1000,
    missEvents: 200,
    setEvents: 600,
    estimatedMemoryKB: 2048,
  };

  beforeEach(async () => {
    const mockCacheService = {
      getCacheStatistics: jest.fn(),
      getCacheMemoryInfo: jest.fn(),
    };

    const mockStatisticsService = {
      getCacheStatistics: jest.fn(),
      getDatabaseCacheStatistics: jest.fn(),
      getUserCacheStatistics: jest.fn(),
      getCachePerformanceTrend: jest.fn(),
      getMemoryInfo: jest.fn(),
    };

    const mockInvalidationService = {
      invalidateByPattern: jest.fn(),
      invalidateDatabaseCache: jest.fn(),
      invalidateUserCache: jest.fn(),
      invalidateByTableChange: jest.fn(),
      addInvalidationRule: jest.fn(),
      getInvalidationRules: jest.fn(),
      removeInvalidationRule: jest.fn(),
      getInvalidationHistory: jest.fn(),
      getInvalidationStatistics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CacheController],
      providers: [
        {
          provide: QueryCacheService,
          useValue: mockCacheService,
        },
        {
          provide: CacheStatisticsService,
          useValue: mockStatisticsService,
        },
        {
          provide: CacheInvalidationService,
          useValue: mockInvalidationService,
        },
      ],
    }).compile();

    controller = module.get<CacheController>(CacheController);
    cacheService = module.get(QueryCacheService);
    statisticsService = module.get(CacheStatisticsService);
    invalidationService = module.get(CacheInvalidationService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCacheStatistics', () => {
    it('should return cache statistics successfully', async () => {
      // Arrange
      statisticsService.getCacheStatistics.mockResolvedValue(mockStatistics);
      statisticsService.getMemoryInfo.mockReturnValue(mockMemoryInfo);

      // Act
      const result = await controller.getCacheStatistics(24);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.statistics).toEqual(mockStatistics);
      expect(result.data.memoryInfo).toEqual(mockMemoryInfo);
      expect(result.data.periodHours).toBe(24);
      expect(statisticsService.getCacheStatistics).toHaveBeenCalledWith(24);
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      statisticsService.getCacheStatistics.mockRejectedValue(new Error('Service unavailable'));

      // Act
      const result = await controller.getCacheStatistics();

      // Assert
      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toContain('Failed to get cache statistics');
    });

    it('should use default period when not specified', async () => {
      // Arrange
      statisticsService.getCacheStatistics.mockResolvedValue(mockStatistics);
      statisticsService.getMemoryInfo.mockReturnValue(mockMemoryInfo);

      // Act
      await controller.getCacheStatistics();

      // Assert
      expect(statisticsService.getCacheStatistics).toHaveBeenCalledWith(24);
    });
  });

  describe('getDatabaseCacheStatistics', () => {
    it('should return database-specific statistics', async () => {
      // Arrange
      const databaseId = 1;
      const periodHours = 12;
      statisticsService.getDatabaseCacheStatistics.mockResolvedValue(mockStatistics);

      // Act
      const result = await controller.getDatabaseCacheStatistics(databaseId, periodHours);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.statistics).toEqual(mockStatistics);
      expect(result.data.databaseId).toBe(databaseId);
      expect(result.data.periodHours).toBe(periodHours);
      expect(statisticsService.getDatabaseCacheStatistics).toHaveBeenCalledWith(
        databaseId,
        periodHours,
      );
    });
  });

  describe('getUserCacheStatistics', () => {
    it('should return user-specific statistics', async () => {
      // Arrange
      const periodHours = 6;
      statisticsService.getUserCacheStatistics.mockResolvedValue(mockStatistics);

      // Act
      const result = await controller.getUserCacheStatistics(mockUser, periodHours);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.statistics).toEqual(mockStatistics);
      expect(result.data.userId).toBe(mockUser.userId);
      expect(result.data.periodHours).toBe(periodHours);
      expect(statisticsService.getUserCacheStatistics).toHaveBeenCalledWith(
        mockUser.userId,
        periodHours,
      );
    });
  });

  describe('getCachePerformanceTrend', () => {
    it('should return performance trend data', async () => {
      // Arrange
      const mockTrend = {
        hourlyStats: [
          { hour: '2023-01-01T00:00', hitRate: 75, totalRequests: 100 },
          { hour: '2023-01-01T01:00', hitRate: 80, totalRequests: 120 },
        ],
        trend: 'improving' as const,
        recommendation: 'Cache performance is improving',
      };
      statisticsService.getCachePerformanceTrend.mockResolvedValue(mockTrend);

      // Act
      const result = await controller.getCachePerformanceTrend(24);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data).toEqual(mockTrend);
      expect(statisticsService.getCachePerformanceTrend).toHaveBeenCalledWith(24);
    });
  });

  describe('invalidateByPattern', () => {
    it('should invalidate cache by pattern successfully', async () => {
      // Arrange
      const body = { pattern: '*:users:*', reason: 'User data update' };
      const invalidatedKeys = ['key1', 'key2', 'key3'];
      invalidationService.invalidateByPattern.mockResolvedValue(invalidatedKeys);

      // Act
      const result = await controller.invalidateByPattern(body, mockUser);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.invalidatedKeys).toEqual(invalidatedKeys);
      expect(result.data.invalidatedCount).toBe(3);
      expect(result.data.pattern).toBe(body.pattern);
      expect(result.data.executedBy).toBe(mockUser.userId);
      expect(invalidationService.invalidateByPattern).toHaveBeenCalledWith(
        body.pattern,
        body.reason,
      );
    });

    it('should use default reason when not provided', async () => {
      // Arrange
      const body = { pattern: '*:test:*' };
      invalidationService.invalidateByPattern.mockResolvedValue(['key1']);

      // Act
      await controller.invalidateByPattern(body, mockUser);

      // Assert
      expect(invalidationService.invalidateByPattern).toHaveBeenCalledWith(
        body.pattern,
        `Manual invalidation by user ${mockUser.userId}`,
      );
    });

    it('should handle invalidation errors', async () => {
      // Arrange
      const body = { pattern: '*:error:*' };
      invalidationService.invalidateByPattern.mockRejectedValue(new Error('Invalidation failed'));

      // Act
      const result = await controller.invalidateByPattern(body, mockUser);

      // Assert
      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toContain('Failed to invalidate cache');
    });
  });

  describe('invalidateDatabaseCache', () => {
    it('should invalidate database cache successfully', async () => {
      // Arrange
      const databaseId = 1;
      const body = { reason: 'Schema update' };
      const invalidatedKeys = ['db1_key1', 'db1_key2'];
      invalidationService.invalidateDatabaseCache.mockResolvedValue(invalidatedKeys);

      // Act
      const result = await controller.invalidateDatabaseCache(databaseId, body, mockUser);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.invalidatedKeys).toEqual(invalidatedKeys);
      expect(result.data.invalidatedCount).toBe(2);
      expect(result.data.databaseId).toBe(databaseId);
      expect(result.data.executedBy).toBe(mockUser.userId);
      expect(invalidationService.invalidateDatabaseCache).toHaveBeenCalledWith(
        databaseId,
        body.reason,
      );
    });
  });

  describe('invalidateUserCache', () => {
    it('should invalidate user cache successfully', async () => {
      // Arrange
      const body = { userId: 'target_user', reason: 'User profile update' };
      const invalidatedKeys = ['user_key1', 'user_key2'];
      invalidationService.invalidateUserCache.mockResolvedValue(invalidatedKeys);

      // Act
      const result = await controller.invalidateUserCache(body, mockUser);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.invalidatedKeys).toEqual(invalidatedKeys);
      expect(result.data.targetUserId).toBe(body.userId);
      expect(result.data.executedBy).toBe(mockUser.userId);
      expect(invalidationService.invalidateUserCache).toHaveBeenCalledWith(
        body.userId,
        body.reason,
      );
    });

    it('should use current user when target user not specified', async () => {
      // Arrange
      const body = { reason: 'Self cache clear' };
      invalidationService.invalidateUserCache.mockResolvedValue(['key1']);

      // Act
      const result = await controller.invalidateUserCache(body, mockUser);

      // Assert
      expect(result.data.targetUserId).toBe(mockUser.userId);
      expect(invalidationService.invalidateUserCache).toHaveBeenCalledWith(
        mockUser.userId,
        body.reason,
      );
    });
  });

  describe('invalidateByTableChange', () => {
    it('should invalidate cache by table change', async () => {
      // Arrange
      const body = {
        tableName: 'users',
        changeType: 'UPDATE' as const,
        reason: 'User table updated',
      };
      const invalidatedKeys = ['table_key1', 'table_key2'];
      invalidationService.invalidateByTableChange.mockResolvedValue(invalidatedKeys);

      // Act
      const result = await controller.invalidateByTableChange(body, mockUser);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.invalidatedKeys).toEqual(invalidatedKeys);
      expect(result.data.tableName).toBe(body.tableName);
      expect(result.data.changeType).toBe(body.changeType);
      expect(result.data.executedBy).toBe(mockUser.userId);
      expect(invalidationService.invalidateByTableChange).toHaveBeenCalledWith(
        body.tableName,
        body.changeType,
      );
    });
  });

  describe('addInvalidationRule', () => {
    it('should add invalidation rule successfully', async () => {
      // Arrange
      const body = {
        pattern: '*:products:*',
        condition: 'time_based' as const,
        intervalMinutes: 60,
        priority: 'high' as const,
        description: 'Product cache invalidation',
      };
      const ruleId = 'rule_123';
      invalidationService.addInvalidationRule.mockResolvedValue(ruleId);

      // Act
      const result = await controller.addInvalidationRule(body, mockUser);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.ruleId).toBe(ruleId);
      expect(result.data.rule).toEqual(body);
      expect(result.data.createdBy).toBe(mockUser.userId);
      expect(invalidationService.addInvalidationRule).toHaveBeenCalledWith({
        ...body,
        description: `${body.description} (Created by ${mockUser.userId})`,
      });
    });
  });

  describe('getInvalidationRules', () => {
    it('should return invalidation rules', async () => {
      // Arrange
      const mockRules = [
        {
          id: 'rule1',
          pattern: '*:users:*',
          condition: 'time_based' as const,
          priority: 'high' as const,
          description: 'User cache rule',
          enabled: true,
          createdAt: new Date(),
        },
      ];
      invalidationService.getInvalidationRules.mockReturnValue(mockRules);

      // Act
      const result = await controller.getInvalidationRules();

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.rules).toEqual(mockRules);
      expect(result.data.totalRules).toBe(1);
    });
  });

  describe('removeInvalidationRule', () => {
    it('should remove invalidation rule successfully', async () => {
      // Arrange
      const ruleId = 'rule_123';
      invalidationService.removeInvalidationRule.mockResolvedValue();

      // Act
      const result = await controller.removeInvalidationRule(ruleId, mockUser);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.ruleId).toBe(ruleId);
      expect(result.data.deletedBy).toBe(mockUser.userId);
      expect(invalidationService.removeInvalidationRule).toHaveBeenCalledWith(ruleId);
    });
  });

  describe('getInvalidationHistory', () => {
    it('should return invalidation history', async () => {
      // Arrange
      const mockHistory = [
        {
          id: 'event1',
          ruleId: 'rule1',
          pattern: '*:users:*',
          invalidatedKeys: ['key1', 'key2'],
          invalidatedCount: 2,
          reason: 'Test invalidation',
          timestamp: new Date(),
          executionTimeMs: 150,
          success: true,
        },
      ];
      invalidationService.getInvalidationHistory.mockReturnValue(mockHistory);

      // Act
      const result = await controller.getInvalidationHistory(50);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.history).toEqual(mockHistory);
      expect(result.data.totalEvents).toBe(1);
      expect(result.data.limit).toBe(50);
      expect(invalidationService.getInvalidationHistory).toHaveBeenCalledWith(50);
    });
  });

  describe('getInvalidationStatistics', () => {
    it('should return invalidation statistics', async () => {
      // Arrange
      const mockStats = {
        totalRules: 5,
        activeRules: 3,
        totalInvalidations: 150,
        averageInvalidationTime: 200,
        mostActivePattern: '*:users:*',
      };
      invalidationService.getInvalidationStatistics.mockReturnValue(mockStats);

      // Act
      const result = await controller.getInvalidationStatistics();

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data).toEqual(mockStats);
    });
  });

  describe('getCacheDashboard', () => {
    it('should return comprehensive cache dashboard data', async () => {
      // Arrange
      const mockTrend = {
        hourlyStats: [],
        trend: 'stable' as const,
        recommendation: 'Cache is performing well',
      };
      const mockInvalidationStats = {
        totalRules: 3,
        activeRules: 2,
        totalInvalidations: 50,
        averageInvalidationTime: 100,
        mostActivePattern: '*:users:*',
      };
      const mockHistory = [];

      statisticsService.getCacheStatistics.mockResolvedValue(mockStatistics);
      statisticsService.getMemoryInfo.mockReturnValue(mockMemoryInfo);
      statisticsService.getCachePerformanceTrend.mockResolvedValue(mockTrend);
      invalidationService.getInvalidationStatistics.mockReturnValue(mockInvalidationStats);
      invalidationService.getInvalidationHistory.mockReturnValue(mockHistory);

      // Act
      const result = await controller.getCacheDashboard(24);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.overview).toBeDefined();
      expect(result.data.statistics).toEqual(mockStatistics);
      expect(result.data.memoryInfo).toEqual(mockMemoryInfo);
      expect(result.data.trend).toEqual(mockTrend);
      expect(result.data.invalidationStats).toEqual(mockInvalidationStats);
      expect(result.data.recentInvalidations).toEqual(mockHistory);
      expect(result.data.periodHours).toBe(24);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all metrics are good', async () => {
      // Arrange
      const goodStats = { ...mockStatistics, hitRate: 85 };
      const lowMemoryInfo = { ...mockMemoryInfo, estimatedMemoryKB: 1024 };
      const goodInvalidationStats = {
        totalRules: 3,
        activeRules: 2,
        totalInvalidations: 50,
        averageInvalidationTime: 100,
        mostActivePattern: '*:users:*',
      };

      statisticsService.getMemoryInfo.mockReturnValue(lowMemoryInfo);
      statisticsService.getCacheStatistics.mockResolvedValue(goodStats);
      invalidationService.getInvalidationStatistics.mockReturnValue(goodInvalidationStats);

      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.healthStatus).toBe('healthy');
      expect(result.data.issues).toHaveLength(0);
    });

    it('should return degraded status when hit rate is low', async () => {
      // Arrange
      const poorStats = { ...mockStatistics, hitRate: 25 };

      statisticsService.getMemoryInfo.mockReturnValue(mockMemoryInfo);
      statisticsService.getCacheStatistics.mockResolvedValue(poorStats);
      invalidationService.getInvalidationStatistics.mockReturnValue({
        totalRules: 3,
        activeRules: 2,
        totalInvalidations: 50,
        averageInvalidationTime: 1000,
        mostActivePattern: '*:users:*',
      });

      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.healthStatus).toBe('degraded');
      expect(result.data.issues).toContain('Low cache hit rate');
    });

    it('should return degraded status when memory usage is high', async () => {
      // Arrange
      const highMemoryInfo = { ...mockMemoryInfo, estimatedMemoryKB: 60000 };

      statisticsService.getMemoryInfo.mockReturnValue(highMemoryInfo);
      statisticsService.getCacheStatistics.mockResolvedValue(mockStatistics);
      invalidationService.getInvalidationStatistics.mockReturnValue({
        totalRules: 3,
        activeRules: 2,
        totalInvalidations: 50,
        averageInvalidationTime: 1000,
        mostActivePattern: '*:users:*',
      });

      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.healthStatus).toBe('degraded');
      expect(result.data.issues).toContain('High memory usage');
    });

    it('should handle health check errors', async () => {
      // Arrange
      statisticsService.getCacheStatistics.mockRejectedValue(new Error('Health check failed'));

      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.data.healthStatus).toBe('unhealthy');
      expect(result.data.issues).toContain('Health check system failure');
    });
  });
});
