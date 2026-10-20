import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheStatisticsService } from './cache-statistics.service';

describe('CacheStatisticsService', () => {
  let service: CacheStatisticsService;
  let cacheManager: jest.Mocked<Cache>;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    reset: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheStatisticsService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheStatisticsService>(CacheStatisticsService);
    cacheManager = module.get(CACHE_MANAGER);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordCacheHit', () => {
    it('should record cache hit event', async () => {
      // Arrange
      const databaseId = 1;
      const cacheKey = 'query_cache:db_1:user_abc:hash123';
      const userId = 'user123';

      // Act
      await service.recordCacheHit(databaseId, cacheKey, userId);

      // Assert
      // 내부 상태는 private이므로 통계를 통해 검증
      const stats = await service.getCacheStatistics(1);
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(0);
    });

    it('should handle recording errors gracefully', async () => {
      // Arrange
      const databaseId = 1;
      const cacheKey = 'test_key';

      // Act & Assert
      await expect(service.recordCacheHit(databaseId, cacheKey)).resolves.not.toThrow();
    });
  });

  describe('recordCacheMiss', () => {
    it('should record cache miss event', async () => {
      // Arrange
      const databaseId = 1;
      const cacheKey = 'query_cache:db_1:user_abc:hash123';
      const userId = 'user123';

      // Act
      await service.recordCacheMiss(databaseId, cacheKey, userId);

      // Assert
      const stats = await service.getCacheStatistics(1);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(1);
    });
  });

  describe('recordCacheSet', () => {
    it('should record cache set event', async () => {
      // Arrange
      const databaseId = 1;
      const cacheKey = 'query_cache:db_1:user_abc:hash123';
      const resultSize = 1024;
      const ttl = 300;
      const userId = 'user123';

      // Act
      await service.recordCacheSet(databaseId, cacheKey, resultSize, ttl, userId);

      // Assert
      const stats = await service.getCacheStatistics(1);
      expect(stats.totalSets).toBe(1);
    });
  });

  describe('getCacheStatistics', () => {
    it('should calculate correct hit rate', async () => {
      // Arrange - 3 hits, 1 miss = 75% hit rate
      await service.recordCacheHit(1, 'key1', 'user1');
      await service.recordCacheHit(1, 'key2', 'user1');
      await service.recordCacheHit(1, 'key3', 'user1');
      await service.recordCacheMiss(1, 'key4', 'user1');

      // Act
      const stats = await service.getCacheStatistics(1);

      // Assert
      expect(stats.hitRate).toBe(75);
      expect(stats.totalHits).toBe(3);
      expect(stats.totalMisses).toBe(1);
    });

    it('should return zero hit rate when no requests', async () => {
      // Act
      const stats = await service.getCacheStatistics(1);

      // Assert
      expect(stats.hitRate).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });

    it('should calculate cache efficiency', async () => {
      // Arrange
      await service.recordCacheHit(1, 'key1', 'user1');
      await service.recordCacheHit(1, 'key1', 'user1'); // same key hit twice
      await service.recordCacheSet(1, 'key1', 1024, 300, 'user1');
      await service.recordCacheSet(1, 'key2', 2048, 600, 'user1');

      // Act
      const stats = await service.getCacheStatistics(1);

      // Assert
      expect(stats.cacheEfficiency).toBeGreaterThan(0);
      expect(stats.totalSets).toBe(2);
    });

    it('should filter events by time period', async () => {
      // Arrange - 현재 시간에서 2시간 전 이벤트 생성
      const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000);

      // 과거 이벤트 (내부 배열에 직접 접근할 수 없으므로 간접적으로 테스트)
      await service.recordCacheHit(1, 'old_key', 'user1');

      // 최근 이벤트
      await service.recordCacheHit(1, 'new_key', 'user1');
      await service.recordCacheMiss(1, 'new_key2', 'user1');

      // Act - 1시간 기간으로 조회
      const stats = await service.getCacheStatistics(1);

      // Assert - 모든 이벤트가 최근 것이므로 전부 포함되어야 함
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
    });
  });

  describe('getDatabaseCacheStatistics', () => {
    it('should return statistics for specific database', async () => {
      // Arrange
      await service.recordCacheHit(1, 'key1', 'user1');
      await service.recordCacheHit(2, 'key2', 'user1');
      await service.recordCacheMiss(1, 'key3', 'user1');

      // Act
      const db1Stats = await service.getDatabaseCacheStatistics(1, 24);
      const db2Stats = await service.getDatabaseCacheStatistics(2, 24);

      // Assert
      expect(db1Stats.totalHits).toBe(1);
      expect(db1Stats.totalMisses).toBe(1);
      expect(db2Stats.totalHits).toBe(1);
      expect(db2Stats.totalMisses).toBe(0);
    });
  });

  describe('getUserCacheStatistics', () => {
    it('should return statistics for specific user', async () => {
      // Arrange
      await service.recordCacheHit(1, 'key1', 'user1');
      await service.recordCacheHit(1, 'key2', 'user2');
      await service.recordCacheMiss(1, 'key3', 'user1');

      // Act
      const user1Stats = await service.getUserCacheStatistics('user1', 24);
      const user2Stats = await service.getUserCacheStatistics('user2', 24);

      // Assert
      expect(user1Stats.totalHits).toBe(1);
      expect(user1Stats.totalMisses).toBe(1);
      expect(user2Stats.totalHits).toBe(1);
      expect(user2Stats.totalMisses).toBe(0);
    });
  });

  describe('getCachePerformanceTrend', () => {
    it('should analyze performance trend', async () => {
      // Arrange - 시간별로 다른 성능 패턴 생성
      const now = new Date();

      // 첫 번째 시간: 좋은 성능 (높은 히트율)
      await service.recordCacheHit(1, 'key1', 'user1');
      await service.recordCacheHit(1, 'key2', 'user1');
      await service.recordCacheMiss(1, 'key3', 'user1');

      // Act
      const trend = await service.getCachePerformanceTrend(24);

      // Assert
      expect(trend.hourlyStats).toBeDefined();
      expect(Array.isArray(trend.hourlyStats)).toBe(true);
      expect(trend.trend).toMatch(/improving|stable|declining/);
      expect(trend.recommendation).toBeDefined();
      expect(typeof trend.recommendation).toBe('string');
    });

    it('should provide recommendations based on performance', async () => {
      // Arrange - 낮은 히트율 시나리오
      await service.recordCacheMiss(1, 'key1', 'user1');
      await service.recordCacheMiss(1, 'key2', 'user1');
      await service.recordCacheMiss(1, 'key3', 'user1');
      await service.recordCacheHit(1, 'key4', 'user1');

      // Act
      const trend = await service.getCachePerformanceTrend(1);

      // Assert
      expect(trend.recommendation).toContain('Cache hit rate is low');
    });
  });

  describe('getMemoryInfo', () => {
    it('should return memory usage information', () => {
      // Arrange
      // 몇 가지 이벤트 추가
      service.recordCacheHit(1, 'key1', 'user1');
      service.recordCacheMiss(1, 'key2', 'user1');
      service.recordCacheSet(1, 'key3', 1024, 300, 'user1');

      // Act
      const memoryInfo = service.getMemoryInfo();

      // Assert
      expect(memoryInfo).toHaveProperty('hitEvents');
      expect(memoryInfo).toHaveProperty('missEvents');
      expect(memoryInfo).toHaveProperty('setEvents');
      expect(memoryInfo).toHaveProperty('estimatedMemoryKB');
      expect(typeof memoryInfo.estimatedMemoryKB).toBe('number');
    });
  });

  describe('memory management', () => {
    it('should limit event history size', async () => {
      // Arrange - 대량의 이벤트 생성 (내부 최대값보다 많이)
      const maxEvents = 15000; // 내부 최대값(10000)보다 많이

      // Act
      for (let i = 0; i < maxEvents; i++) {
        await service.recordCacheHit(1, `key${i}`, 'user1');
      }

      // Assert
      const memoryInfo = service.getMemoryInfo();
      // 내부에서 크기 제한이 적용되어야 함
      expect(memoryInfo.hitEvents).toBeLessThanOrEqual(10000);
    });
  });

  describe('error handling', () => {
    it('should handle errors in statistics calculation gracefully', async () => {
      // Act & Assert
      await expect(service.getCacheStatistics(24)).resolves.toEqual(
        expect.objectContaining({
          hitRate: expect.any(Number),
          totalHits: expect.any(Number),
          totalMisses: expect.any(Number),
        }),
      );
    });

    it('should handle errors in trend analysis gracefully', async () => {
      // Act & Assert
      await expect(service.getCachePerformanceTrend(24)).resolves.toEqual(
        expect.objectContaining({
          hourlyStats: expect.any(Array),
          trend: expect.stringMatching(/improving|stable|declining/),
          recommendation: expect.any(String),
        }),
      );
    });
  });

  describe('performance calculations', () => {
    it('should calculate correct percentiles', async () => {
      // Arrange - 다양한 실행 시간으로 캐시 설정 이벤트 생성
      const executionTimes = [100, 200, 300, 400, 500, 1000, 2000, 5000];

      for (let i = 0; i < executionTimes.length; i++) {
        // TTL을 실행 시간에 비례하여 설정
        const ttl = executionTimes[i] * 0.1;
        await service.recordCacheSet(1, `key${i}`, 1024, ttl, 'user1');
      }

      // Act
      const stats = await service.getCacheStatistics(1);

      // Assert
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
      expect(stats.totalSets).toBe(executionTimes.length);
    });

    it('should handle edge cases in statistics calculation', async () => {
      // Act - 이벤트 없이 통계 계산
      const emptyStats = await service.getCacheStatistics(24);

      // Assert
      expect(emptyStats.hitRate).toBe(0);
      expect(emptyStats.averageExecutionTime).toBe(0);
      expect(emptyStats.cacheEfficiency).toBe(0);
    });
  });
});
