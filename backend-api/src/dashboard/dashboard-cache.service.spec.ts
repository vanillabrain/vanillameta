import { Test, TestingModule } from '@nestjs/testing';
import { DashboardCacheService } from './dashboard-cache.service';
import { HybridCacheService } from '../common/optimization/hybrid-cache.service';
import { CustomLoggerService } from '../common/logger/logger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Dashboard } from './entities/dashboard.entity';

describe('DashboardCacheService', () => {
  let service: DashboardCacheService;
  let hybridCacheService: jest.Mocked<HybridCacheService>;
  let customLoggerService: jest.Mocked<CustomLoggerService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockDashboard: Dashboard = {
    id: 1,
    title: 'Test Dashboard',
    layout: '[{"i":"widget1","x":0,"y":0,"w":4,"h":4}]',
    shareId: 1,
    delYn: 'N',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Dashboard;

  const mockWidgets = [
    { id: 1, name: 'Widget 1', dashboardId: 1 },
    { id: 2, name: 'Widget 2', dashboardId: 1 },
  ];

  const mockShareInfo = {
    id: 1,
    uuid: 'test-uuid-123',
    shareStatus: 'public',
  };

  beforeEach(async () => {
    const mockHybridCacheService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      invalidateByQuery: jest.fn().mockResolvedValue(undefined),
      getHybridStats: jest.fn().mockResolvedValue(null),
    };

    const mockCustomLoggerService = {
      debug: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardCacheService,
        {
          provide: HybridCacheService,
          useValue: mockHybridCacheService,
        },
        {
          provide: CustomLoggerService,
          useValue: mockCustomLoggerService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<DashboardCacheService>(DashboardCacheService);
    hybridCacheService = module.get(HybridCacheService);
    customLoggerService = module.get(CustomLoggerService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cacheDashboard', () => {
    it('should cache dashboard with widgets and share info', async () => {
      await service.cacheDashboard(mockDashboard, mockWidgets, mockShareInfo);

      expect(hybridCacheService.set).toHaveBeenCalledWith(
        'dashboard',
        '1',
        'dashboard:1',
        expect.objectContaining({
          dashboard: mockDashboard,
          widgets: mockWidgets,
          shareInfo: mockShareInfo,
          cachedAt: expect.any(Number),
          ttl: 3600,
        }),
        [],
        undefined,
        { ttl: 3600 },
      );

      expect(customLoggerService.debug).toHaveBeenCalledWith(
        'Dashboard cached successfully',
        'DashboardCacheService',
        expect.objectContaining({
          dashboardId: 1,
          hasWidgets: true,
          hasShareInfo: true,
          ttl: 3600,
        }),
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith('dashboard.cached', {
        dashboardId: 1,
        timestamp: expect.any(Number),
      });
    });

    it('should cache dashboard with custom TTL', async () => {
      const customTtl = 7200;
      await service.cacheDashboard(mockDashboard, undefined, undefined, customTtl);

      expect(hybridCacheService.set).toHaveBeenCalledWith(
        'dashboard',
        '1',
        'dashboard:1',
        expect.objectContaining({
          ttl: customTtl,
        }),
        [],
        undefined,
        { ttl: customTtl },
      );
    });

    it('should handle caching errors gracefully', async () => {
      hybridCacheService.set.mockRejectedValueOnce(new Error('Cache error'));

      await service.cacheDashboard(mockDashboard);

      expect(hybridCacheService.set).toHaveBeenCalled();
      // Should not throw error
    });
  });

  describe('getCachedDashboard', () => {
    it('should return cached dashboard when found', async () => {
      const cachedData = {
        data: {
          dashboard: mockDashboard,
          widgets: mockWidgets,
          shareInfo: mockShareInfo,
          cachedAt: Date.now(),
          ttl: 3600,
        },
      };

      hybridCacheService.get.mockResolvedValueOnce(cachedData);

      const result = await service.getCachedDashboard(1);

      expect(result).toEqual(cachedData.data);
      expect(hybridCacheService.get).toHaveBeenCalledWith('dashboard', '1', 'dashboard:1');
      expect(customLoggerService.debug).toHaveBeenCalledWith(
        'Dashboard cache hit',
        'DashboardCacheService',
        expect.objectContaining({
          dashboardId: 1,
        }),
      );
    });

    it('should return null when cache miss', async () => {
      hybridCacheService.get.mockResolvedValueOnce(null);

      const result = await service.getCachedDashboard(1);

      expect(result).toBeNull();
    });

    it('should handle errors and return null', async () => {
      hybridCacheService.get.mockRejectedValueOnce(new Error('Cache error'));

      const result = await service.getCachedDashboard(1);

      expect(result).toBeNull();
    });
  });

  describe('cacheUserDashboardList', () => {
    it('should cache user dashboard list', async () => {
      const dashboards = [mockDashboard];
      const userId = 123;

      await service.cacheUserDashboardList(userId, dashboards);

      expect(hybridCacheService.set).toHaveBeenCalledWith(
        'dashboard',
        'user_123',
        'user_dashboards:123',
        dashboards,
        [],
        undefined,
        { ttl: 300 },
      );

      expect(customLoggerService.debug).toHaveBeenCalledWith(
        'User dashboard list cached',
        'DashboardCacheService',
        expect.objectContaining({
          userId: 123,
          dashboardCount: 1,
          ttl: 300,
        }),
      );
    });
  });

  describe('getCachedUserDashboardList', () => {
    it('should return cached user dashboard list', async () => {
      const dashboards = [mockDashboard];
      hybridCacheService.get.mockResolvedValueOnce({ data: dashboards });

      const result = await service.getCachedUserDashboardList(123);

      expect(result).toEqual(dashboards);
      expect(hybridCacheService.get).toHaveBeenCalledWith(
        'dashboard',
        'user_123',
        'user_dashboards:123',
      );
    });
  });

  describe('cacheSharedDashboard', () => {
    it('should cache shared dashboard', async () => {
      const shareId = 'test-share-id';

      await service.cacheSharedDashboard(shareId, mockDashboard);

      expect(hybridCacheService.set).toHaveBeenCalledWith(
        'dashboard',
        'share_test-share-id',
        'shared_dashboard:test-share-id',
        mockDashboard,
        [],
        undefined,
        { ttl: 7200 },
      );
    });
  });

  describe('invalidateDashboard', () => {
    it('should invalidate dashboard and widget caches', async () => {
      await service.invalidateDashboard(1);

      expect(hybridCacheService.invalidateByQuery).toHaveBeenCalledTimes(2);
      expect(hybridCacheService.invalidateByQuery).toHaveBeenCalledWith(
        'dashboard',
        'dashboard:1',
      );
      expect(hybridCacheService.invalidateByQuery).toHaveBeenCalledWith(
        'dashboard',
        'dashboard_widgets:1',
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith('dashboard.cache.invalidated', {
        dashboardId: 1,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('invalidateUserDashboardList', () => {
    it('should invalidate user dashboard list cache', async () => {
      await service.invalidateUserDashboardList(123);

      expect(hybridCacheService.invalidateByQuery).toHaveBeenCalledWith(
        'dashboard',
        'user_dashboards:123',
      );
    });
  });

  describe('invalidateAllDashboardCaches', () => {
    it('should invalidate all dashboard related caches', async () => {
      await service.invalidateAllDashboardCaches(1, 123);

      // Should invalidate dashboard cache
      expect(hybridCacheService.invalidateByQuery).toHaveBeenCalledWith(
        'dashboard',
        'dashboard:1',
      );

      // Should invalidate widget cache
      expect(hybridCacheService.invalidateByQuery).toHaveBeenCalledWith(
        'dashboard',
        'dashboard_widgets:1',
      );

      // Should invalidate user dashboard list cache
      expect(hybridCacheService.invalidateByQuery).toHaveBeenCalledWith(
        'dashboard',
        'user_dashboards:123',
      );
    });

    it('should work without userId', async () => {
      await service.invalidateAllDashboardCaches(1);

      // Should still invalidate dashboard and widget caches
      expect(hybridCacheService.invalidateByQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const mockStats = {
        engine: 'dashboard',
        l1Cache: { hitRate: 0.85 },
        l2Cache: { hitRate: 0.75 },
      };

      hybridCacheService.getHybridStats.mockResolvedValueOnce(mockStats);

      const result = await service.getCacheStats();

      expect(result).toEqual(mockStats);
      expect(hybridCacheService.getHybridStats).toHaveBeenCalledWith('dashboard');
    });

    it('should handle errors and return null', async () => {
      hybridCacheService.getHybridStats.mockRejectedValueOnce(new Error('Stats error'));

      const result = await service.getCacheStats();

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle dashboard with null shareId', async () => {
      const dashboardWithoutShare = { ...mockDashboard, shareId: null };

      await service.cacheDashboard(dashboardWithoutShare);

      expect(hybridCacheService.set).toHaveBeenCalled();
    });

    it('should handle empty widget list', async () => {
      await service.cacheDashboardWidgets(1, []);

      expect(hybridCacheService.set).toHaveBeenCalledWith(
        'dashboard',
        'widgets_1',
        'dashboard_widgets:1',
        [],
        [],
        undefined,
        { ttl: 3600 },
      );
    });

    it('should handle numeric and string shareIds', async () => {
      await service.cacheSharedDashboard(123, mockDashboard);
      await service.cacheSharedDashboard('abc-123', mockDashboard);

      expect(hybridCacheService.set).toHaveBeenCalledTimes(2);
    });
  });
});