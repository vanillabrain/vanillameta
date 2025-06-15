import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { QueryCacheService } from './query-cache.service';
import { CacheStatisticsService } from './cache-statistics.service';
import { QueryExecuteDto } from '../../database/dto/query-execute.dto';
import { ResponseStatus } from '../../common/enum/response-status.enum';

describe('QueryCacheService', () => {
  let service: QueryCacheService;
  let cacheManager: jest.Mocked<Cache>;
  let statisticsService: jest.Mocked<CacheStatisticsService>;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    reset: jest.fn(),
  };

  const mockStatisticsService = {
    recordCacheHit: jest.fn(),
    recordCacheMiss: jest.fn(),
    recordCacheSet: jest.fn(),
    getCacheStatistics: jest.fn(),
    getMemoryInfo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryCacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: CacheStatisticsService,
          useValue: mockStatisticsService,
        },
      ],
    }).compile();

    service = module.get<QueryCacheService>(QueryCacheService);
    cacheManager = module.get(CACHE_MANAGER);
    statisticsService = module.get(CacheStatisticsService);

    // 모든 모의 객체 초기화
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCachedQuery', () => {
    const mockQueryDto: QueryExecuteDto = {
      id: 1,
      query: 'SELECT * FROM users',
      parameters: [],
    };

    it('should return cached result when cache hit occurs', async () => {
      // Arrange
      const mockCachedResult = {
        data: [{ id: 1, name: 'John' }],
        fields: [{ columnName: 'id', columnType: 'number' }],
        executionTime: 1500,
        cachedAt: new Date(),
        databaseEngine: 'pg',
        queryHash: 'hash123',
      };

      cacheManager.get.mockResolvedValue(mockCachedResult);
      statisticsService.recordCacheHit.mockResolvedValue();

      // Act
      const result = await service.getCachedQuery(mockQueryDto, 'user123');

      // Assert
      expect(result).toEqual(mockCachedResult);
      expect(cacheManager.get).toHaveBeenCalledWith(expect.stringContaining('query_cache:db_1'));
      expect(statisticsService.recordCacheHit).toHaveBeenCalledWith(
        1,
        expect.stringContaining('query_cache:db_1'),
        'user123',
      );
      expect(statisticsService.recordCacheMiss).not.toHaveBeenCalled();
    });

    it('should return null and record cache miss when no cached result', async () => {
      // Arrange
      cacheManager.get.mockResolvedValue(null);
      statisticsService.recordCacheMiss.mockResolvedValue();

      // Act
      const result = await service.getCachedQuery(mockQueryDto, 'user123');

      // Assert
      expect(result).toBeNull();
      expect(cacheManager.get).toHaveBeenCalledWith(expect.stringContaining('query_cache:db_1'));
      expect(statisticsService.recordCacheMiss).toHaveBeenCalledWith(
        1,
        expect.stringContaining('query_cache:db_1'),
        'user123',
      );
      expect(statisticsService.recordCacheHit).not.toHaveBeenCalled();
    });

    it('should handle cache lookup errors gracefully', async () => {
      // Arrange
      cacheManager.get.mockRejectedValue(new Error('Cache connection failed'));

      // Act
      const result = await service.getCachedQuery(mockQueryDto, 'user123');

      // Assert
      expect(result).toBeNull();
      expect(statisticsService.recordCacheHit).not.toHaveBeenCalled();
      expect(statisticsService.recordCacheMiss).not.toHaveBeenCalled();
    });

    it('should generate different cache keys for different users', async () => {
      // Arrange
      cacheManager.get.mockResolvedValue(null);

      // Act
      await service.getCachedQuery(mockQueryDto, 'user1');
      await service.getCachedQuery(mockQueryDto, 'user2');

      // Assert
      const calls = cacheManager.get.mock.calls;
      expect(calls[0][0]).toContain('user_');
      expect(calls[1][0]).toContain('user_');
      expect(calls[0][0]).not.toEqual(calls[1][0]);
    });
  });

  describe('setCachedQuery', () => {
    const mockQueryDto: QueryExecuteDto = {
      id: 1,
      query: 'SELECT * FROM users WHERE active = true',
      parameters: [],
    };

    const mockResultData = {
      status: ResponseStatus.SUCCESS,
      message: 'success',
      datas: [{ id: 1, name: 'John', active: true }],
      fields: [
        { columnName: 'id', columnType: 'number' },
        { columnName: 'name', columnType: 'string' },
        { columnName: 'active', columnType: 'boolean' },
      ],
    };

    it('should cache successful query results', async () => {
      // Arrange
      const executionTime = 2500;
      const databaseEngine = 'pg';
      const userId = 'user123';

      cacheManager.set.mockResolvedValue();
      statisticsService.recordCacheSet.mockResolvedValue();

      // Act
      await service.setCachedQuery(mockQueryDto, mockResultData, executionTime, databaseEngine, userId);

      // Assert
      expect(cacheManager.set).toHaveBeenCalledTimes(2); // 결과와 메타데이터
      expect(statisticsService.recordCacheSet).toHaveBeenCalledWith(
        1,
        expect.stringContaining('query_cache:db_1'),
        expect.any(Number), // result size
        expect.any(Number), // TTL
        userId,
      );
    });

    it('should not cache failed query results', async () => {
      // Arrange
      const failedResultData = {
        ...mockResultData,
        status: ResponseStatus.ERROR,
        message: 'Query failed',
        datas: [],
      };

      // Act
      await service.setCachedQuery(mockQueryDto, failedResultData, 1000, 'pg', 'user123');

      // Assert
      expect(cacheManager.set).not.toHaveBeenCalled();
      expect(statisticsService.recordCacheSet).not.toHaveBeenCalled();
    });

    it('should not cache results that are too large', async () => {
      // Arrange
      const largeResultData = {
        ...mockResultData,
        datas: new Array(100000).fill({ id: 1, name: 'Test', data: 'x'.repeat(1000) }),
      };

      // Act
      await service.setCachedQuery(mockQueryDto, largeResultData, 1000, 'pg', 'user123');

      // Assert
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should calculate appropriate TTL based on query complexity', async () => {
      // Arrange
      const simpleQuery = { ...mockQueryDto, query: 'SELECT COUNT(*) FROM users' };
      const complexQuery = { 
        ...mockQueryDto, 
        query: 'SELECT u.*, COUNT(o.id) FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.id' 
      };

      cacheManager.set.mockResolvedValue();
      statisticsService.recordCacheSet.mockResolvedValue();

      // Act
      await service.setCachedQuery(simpleQuery, mockResultData, 1000, 'pg', 'user123');
      await service.setCachedQuery(complexQuery, mockResultData, 5000, 'pg', 'user123');

      // Assert
      expect(cacheManager.set).toHaveBeenCalledTimes(4); // 2 queries × 2 calls each (result + metadata)
      
      // 복잡한 쿼리가 더 긴 TTL을 가져야 함
      const simpleTTL = cacheManager.set.mock.calls[0][2];
      const complexTTL = cacheManager.set.mock.calls[2][2];
      expect(complexTTL).toBeGreaterThan(simpleTTL);
    });

    it('should handle cache storage errors gracefully', async () => {
      // Arrange
      cacheManager.set.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert - 에러가 던져지지 않아야 함
      await expect(
        service.setCachedQuery(mockQueryDto, mockResultData, 1000, 'pg', 'user123')
      ).resolves.not.toThrow();
    });
  });

  describe('invalidateDatabaseCache', () => {
    it('should invalidate all cache entries for a database', async () => {
      // Arrange
      const databaseId = 1;
      cacheManager.reset.mockResolvedValue();

      // Act
      await service.invalidateDatabaseCache(databaseId);

      // Assert
      expect(cacheManager.reset).toHaveBeenCalled();
    });

    it('should handle invalidation errors gracefully', async () => {
      // Arrange
      const databaseId = 1;
      cacheManager.reset.mockRejectedValue(new Error('Invalidation failed'));

      // Act & Assert
      await expect(service.invalidateDatabaseCache(databaseId)).resolves.not.toThrow();
    });
  });

  describe('getCacheStatistics', () => {
    it('should return cache statistics from statistics service', async () => {
      // Arrange
      const mockStats = {
        hitRate: 75.5,
        totalHits: 1500,
        totalMisses: 500,
        totalSets: 800,
        averageExecutionTime: 2500,
        cacheEfficiency: 85.2,
        periodStart: new Date('2023-01-01T00:00:00Z'),
        periodEnd: new Date('2023-01-01T23:59:59Z'),
      };

      statisticsService.getCacheStatistics.mockResolvedValue(mockStats);

      // Act
      const result = await service.getCacheStatistics();

      // Assert
      expect(result).toEqual(mockStats);
      expect(statisticsService.getCacheStatistics).toHaveBeenCalled();
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent cache keys for same query and user', async () => {
      // Arrange
      const queryDto: QueryExecuteDto = {
        id: 1,
        query: 'SELECT * FROM users WHERE id = ?',
        parameters: [{ type: 'number', value: '123' }],
      };

      cacheManager.get.mockResolvedValue(null);

      // Act
      await service.getCachedQuery(queryDto, 'user123');
      await service.getCachedQuery(queryDto, 'user123');

      // Assert
      const calls = cacheManager.get.mock.calls;
      expect(calls[0][0]).toEqual(calls[1][0]);
    });

    it('should generate different cache keys for different parameters', async () => {
      // Arrange
      const baseQuery = 'SELECT * FROM users WHERE id = ?';
      const queryDto1: QueryExecuteDto = {
        id: 1,
        query: baseQuery,
        parameters: [{ type: 'number', value: '123' }],
      };
      const queryDto2: QueryExecuteDto = {
        id: 1,
        query: baseQuery,
        parameters: [{ type: 'number', value: '456' }],
      };

      cacheManager.get.mockResolvedValue(null);

      // Act
      await service.getCachedQuery(queryDto1, 'user123');
      await service.getCachedQuery(queryDto2, 'user123');

      // Assert
      const calls = cacheManager.get.mock.calls;
      expect(calls[0][0]).not.toEqual(calls[1][0]);
    });

    it('should normalize queries for consistent cache keys', async () => {
      // Arrange
      const queryDto1: QueryExecuteDto = {
        id: 1,
        query: 'SELECT * FROM users WHERE name = \'John\'',
        parameters: [],
      };
      const queryDto2: QueryExecuteDto = {
        id: 1,
        query: 'SELECT * FROM users WHERE name = \'Jane\'',
        parameters: [],
      };

      cacheManager.get.mockResolvedValue(null);

      // Act
      await service.getCachedQuery(queryDto1, 'user123');
      await service.getCachedQuery(queryDto2, 'user123');

      // Assert
      const calls = cacheManager.get.mock.calls;
      // 정규화된 쿼리는 문자열 리터럴이 ?로 대체되므로 같은 키를 생성해야 함
      expect(calls[0][0]).toEqual(calls[1][0]);
    });
  });

  describe('query complexity analysis', () => {
    it('should correctly identify simple queries', async () => {
      // Arrange
      const simpleQuery = { 
        id: 1, 
        query: 'SELECT * FROM users', 
        parameters: [] 
      };
      const resultData = {
        status: ResponseStatus.SUCCESS,
        message: 'success',
        datas: [{ id: 1 }],
        fields: [{ columnName: 'id', columnType: 'number' }],
      };

      cacheManager.set.mockResolvedValue();
      statisticsService.recordCacheSet.mockResolvedValue();

      // Act
      await service.setCachedQuery(simpleQuery, resultData, 1000, 'pg', 'user123');

      // Assert
      expect(cacheManager.set).toHaveBeenCalled();
      // TTL이 기본값(300초) 주변이어야 함
      const ttl = cacheManager.set.mock.calls[0][2];
      expect(ttl).toBeGreaterThan(250);
      expect(ttl).toBeLessThan(400);
    });

    it('should correctly identify complex queries', async () => {
      // Arrange
      const complexQuery = { 
        id: 1, 
        query: `
          WITH user_stats AS (
            SELECT u.id, COUNT(o.id) as order_count,
                   AVG(o.total) OVER (PARTITION BY u.department) as avg_total
            FROM users u 
            LEFT JOIN orders o ON u.id = o.user_id 
            LEFT JOIN departments d ON u.dept_id = d.id
            WHERE u.created_at > '2023-01-01'
            GROUP BY u.id, u.department
          )
          SELECT * FROM user_stats WHERE order_count > 5
        `, 
        parameters: [] 
      };
      const resultData = {
        status: ResponseStatus.SUCCESS,
        message: 'success',
        datas: [{ id: 1 }],
        fields: [{ columnName: 'id', columnType: 'number' }],
      };

      cacheManager.set.mockResolvedValue();
      statisticsService.recordCacheSet.mockResolvedValue();

      // Act
      await service.setCachedQuery(complexQuery, resultData, 5000, 'pg', 'user123');

      // Assert
      expect(cacheManager.set).toHaveBeenCalled();
      // 복잡한 쿼리는 더 긴 TTL을 가져야 함
      const ttl = cacheManager.set.mock.calls[0][2];
      expect(ttl).toBeGreaterThan(1000); // 적어도 기본값보다 큰 값
    });

    it('should correctly identify batch queries', async () => {
      // Arrange
      const batchQuery = { 
        id: 1, 
        query: 'INSERT INTO users_backup SELECT * FROM users LIMIT 10000', 
        parameters: [] 
      };
      const resultData = {
        status: ResponseStatus.SUCCESS,
        message: 'success',
        datas: [],
        fields: [],
      };

      cacheManager.set.mockResolvedValue();
      statisticsService.recordCacheSet.mockResolvedValue();

      // Act
      await service.setCachedQuery(batchQuery, resultData, 10000, 'pg', 'user123');

      // Assert
      expect(cacheManager.set).toHaveBeenCalled();
      // 배치 쿼리는 가장 긴 TTL을 가져야 함
      const ttl = cacheManager.set.mock.calls[0][2];
      expect(ttl).toBeGreaterThan(3000); // 배치 TTL은 1시간(3600초)에 근접
    });
  });

  describe('memory management', () => {
    it('should return memory information', async () => {
      // Arrange
      const mockMemoryInfo = {
        usedMemory: 1024,
        totalKeys: 150,
        averageKeySize: 6.8,
      };

      // Act
      const result = await service.getCacheMemoryInfo();

      // Assert
      expect(result).toEqual(mockMemoryInfo);
    });
  });
});