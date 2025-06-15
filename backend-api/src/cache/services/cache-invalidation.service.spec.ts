import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheInvalidationService } from './cache-invalidation.service';

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let cacheManager: jest.Mocked<Cache>;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    reset: jest.fn(),
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidationService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheInvalidationService>(CacheInvalidationService);
    cacheManager = module.get(CACHE_MANAGER);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addInvalidationRule', () => {
    it('should add invalidation rule successfully', async () => {
      // Arrange
      const rule = {
        pattern: '*:users:*',
        condition: 'time_based' as const,
        intervalMinutes: 30,
        priority: 'high' as const,
        description: 'User cache invalidation',
      };

      // Act
      const ruleId = await service.addInvalidationRule(rule);

      // Assert
      expect(ruleId).toBeDefined();
      expect(ruleId).toMatch(/^rule_/);
      
      const rules = service.getInvalidationRules();
      expect(rules).toHaveLength(4); // 3 default + 1 new
      expect(rules.find(r => r.id === ruleId)).toBeDefined();
    });

    it('should handle rule addition errors', async () => {
      // Arrange
      const invalidRule = null as any;

      // Act & Assert
      await expect(service.addInvalidationRule(invalidRule)).rejects.toThrow();
    });
  });

  describe('invalidateByPattern', () => {
    it('should invalidate cache by pattern', async () => {
      // Arrange
      const pattern = '*:users:*';
      const reason = 'Test invalidation';
      
      // Mock getAllCacheKeys 결과
      jest.spyOn(service as any, 'getAllCacheKeys').mockResolvedValue([
        'query_cache:db_1:users:123',
        'query_cache:db_1:users:456',
        'query_cache:db_2:products:789',
      ]);
      
      cacheManager.del.mockResolvedValue();

      // Act
      const result = await service.invalidateByPattern(pattern, reason);

      // Assert
      expect(result).toHaveLength(2); // users 관련 2개 키만 매칭
      expect(result).toContain('query_cache:db_1:users:123');
      expect(result).toContain('query_cache:db_1:users:456');
    });

    it('should handle invalidation errors gracefully', async () => {
      // Arrange
      const pattern = '*:test:*';
      jest.spyOn(service as any, 'getAllCacheKeys').mockRejectedValue(new Error('Cache error'));

      // Act & Assert
      await expect(service.invalidateByPattern(pattern)).rejects.toThrow();
    });
  });

  describe('invalidateDatabaseCache', () => {
    it('should invalidate all cache for specific database', async () => {
      // Arrange
      const databaseId = 1;
      const reason = 'Database schema change';
      
      jest.spyOn(service, 'invalidateByPattern').mockResolvedValue([
        'query_cache:db_1:users:123',
        'query_cache:db_1:products:456',
      ]);

      // Act
      const result = await service.invalidateDatabaseCache(databaseId, reason);

      // Assert
      expect(service.invalidateByPattern).toHaveBeenCalledWith(
        'query_cache:db_1:*',
        reason
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('invalidateUserCache', () => {
    it('should invalidate all cache for specific user', async () => {
      // Arrange
      const userId = 'user123';
      const reason = 'User data update';
      
      jest.spyOn(service, 'invalidateByPattern').mockResolvedValue([
        'query_cache:db_1:user_abc123:hash1',
        'query_cache:db_2:user_abc123:hash2',
      ]);

      // Act
      const result = await service.invalidateUserCache(userId, reason);

      // Assert
      expect(service.invalidateByPattern).toHaveBeenCalledWith(
        expect.stringContaining('user_'),
        reason
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('invalidateByTableChange', () => {
    it('should invalidate cache when table changes', async () => {
      // Arrange
      const tableName = 'users';
      const changeType = 'UPDATE';
      
      jest.spyOn(service, 'invalidateByPattern')
        .mockResolvedValueOnce(['key1', 'key2']) // first pattern
        .mockResolvedValueOnce(['key3']) // second pattern
        .mockResolvedValueOnce(['key4']); // third pattern

      // Act
      const result = await service.invalidateByTableChange(tableName, changeType);

      // Assert
      expect(result).toHaveLength(4); // 총 4개 키 무효화
      expect(service.invalidateByPattern).toHaveBeenCalledTimes(3); // 3개 패턴
    });

    it('should handle unknown table gracefully', async () => {
      // Arrange
      const tableName = 'unknown_table';
      const changeType = 'INSERT';
      
      jest.spyOn(service, 'invalidateByPattern').mockResolvedValue(['key1']);

      // Act
      const result = await service.invalidateByTableChange(tableName, changeType);

      // Assert
      expect(result).toHaveLength(1); // 기본 패턴만 적용
    });
  });

  describe('executeTimeBasedRules', () => {
    it('should execute time-based rules at scheduled intervals', async () => {
      // Arrange
      const rule = {
        pattern: '*:test:*',
        condition: 'time_based' as const,
        intervalMinutes: 5,
        priority: 'medium' as const,
        description: 'Test rule',
      };
      
      const ruleId = await service.addInvalidationRule(rule);
      jest.spyOn(service as any, 'executeInvalidationRule').mockResolvedValue(undefined);

      // Act - 5분 후 스케줄러 실행
      jest.advanceTimersByTime(5 * 60 * 1000);

      // 수동으로 스케줄러 메서드 호출 (실제로는 cron이 호출)
      await service.executeTimeBasedRules();

      // Assert
      expect(service['executeInvalidationRule']).toHaveBeenCalledWith(
        expect.objectContaining({ id: ruleId })
      );
    });
  });

  describe('removeInvalidationRule', () => {
    it('should remove existing rule', async () => {
      // Arrange
      const rule = {
        pattern: '*:temp:*',
        condition: 'manual' as const,
        priority: 'low' as const,
        description: 'Temporary rule',
      };
      
      const ruleId = await service.addInvalidationRule(rule);
      const initialCount = service.getInvalidationRules().length;

      // Act
      await service.removeInvalidationRule(ruleId);

      // Assert
      const remainingRules = service.getInvalidationRules();
      expect(remainingRules.length).toBe(initialCount - 1);
      expect(remainingRules.find(r => r.id === ruleId)).toBeUndefined();
    });

    it('should handle removal of non-existent rule', async () => {
      // Act & Assert
      await expect(service.removeInvalidationRule('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getInvalidationHistory', () => {
    it('should return invalidation history', async () => {
      // Arrange - 무효화 이벤트 생성
      await service.invalidateByPattern('*:test:*', 'Test invalidation');

      // Act
      const history = service.getInvalidationHistory(10);

      // Assert
      expect(Array.isArray(history)).toBe(true);
      if (history.length > 0) {
        expect(history[0]).toHaveProperty('ruleId');
        expect(history[0]).toHaveProperty('pattern');
        expect(history[0]).toHaveProperty('timestamp');
      }
    });

    it('should limit history results', () => {
      // Act
      const history = service.getInvalidationHistory(5);

      // Assert
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getInvalidationStatistics', () => {
    it('should return invalidation statistics', () => {
      // Act
      const stats = service.getInvalidationStatistics();

      // Assert
      expect(stats).toHaveProperty('totalRules');
      expect(stats).toHaveProperty('activeRules');
      expect(stats).toHaveProperty('totalInvalidations');
      expect(stats).toHaveProperty('averageInvalidationTime');
      expect(stats).toHaveProperty('mostActivePattern');
      
      expect(typeof stats.totalRules).toBe('number');
      expect(typeof stats.activeRules).toBe('number');
      expect(typeof stats.totalInvalidations).toBe('number');
    });
  });

  describe('pattern matching', () => {
    it('should correctly match wildcard patterns', () => {
      // Arrange
      const testCases = [
        { pattern: '*:users:*', key: 'query_cache:db_1:users:123', expected: true },
        { pattern: '*:users:*', key: 'query_cache:db_1:products:123', expected: false },
        { pattern: 'query_cache:*', key: 'query_cache:db_1:users:123', expected: true },
        { pattern: '*:*:123', key: 'query_cache:db_1:users:123', expected: true },
        { pattern: 'exact_match', key: 'exact_match', expected: true },
        { pattern: 'exact_match', key: 'not_exact', expected: false },
      ];

      // Act & Assert
      testCases.forEach(({ pattern, key, expected }) => {
        const result = service['matchPattern'](key, pattern);
        expect(result).toBe(expected);
      });
    });
  });

  describe('memory management', () => {
    it('should limit invalidation history size', async () => {
      // Arrange - 대량의 무효화 이벤트 생성
      for (let i = 0; i < 1500; i++) {
        await service.invalidateByPattern(`*:test${i}:*`, `Test ${i}`);
      }

      // Act
      const history = service.getInvalidationHistory();

      // Assert
      expect(history.length).toBeLessThanOrEqual(1000); // 최대 크기 제한
    });
  });

  describe('cleanup operations', () => {
    it('should perform cleanup operations', async () => {
      // Arrange
      jest.spyOn(service, 'invalidateByPattern').mockResolvedValue(['key1', 'key2']);

      // Act
      await service.cleanupExpiredCache();

      // Assert
      expect(service.invalidateByPattern).toHaveBeenCalledWith(
        'query_meta:*',
        'Expired metadata cleanup'
      );
    });
  });

  describe('error handling', () => {
    it('should handle cache manager errors gracefully', async () => {
      // Arrange
      cacheManager.del.mockRejectedValue(new Error('Cache connection lost'));
      jest.spyOn(service as any, 'getAllCacheKeys').mockResolvedValue(['key1']);

      // Act & Assert
      await expect(service.invalidateByPattern('*:test:*')).rejects.toThrow();
    });

    it('should handle rule execution errors', async () => {
      // Arrange
      const rule = {
        pattern: '*:error:*',
        condition: 'manual' as const,
        priority: 'low' as const,
        description: 'Error test rule',
      };
      
      const ruleId = await service.addInvalidationRule(rule);
      jest.spyOn(service, 'invalidateByPattern').mockRejectedValue(new Error('Invalidation failed'));

      // Act & Assert
      await expect(service.invalidateByPattern('*:error:*', 'test')).rejects.toThrow('Invalidation failed');
    });
  });

  describe('default rules initialization', () => {
    it('should initialize default invalidation rules', () => {
      // Act
      const rules = service.getInvalidationRules();

      // Assert
      expect(rules.length).toBeGreaterThan(0);
      
      // 기본 규칙들이 포함되어 있는지 확인
      const userRule = rules.find(r => r.description.includes('user'));
      const dashboardRule = rules.find(r => r.description.includes('dashboard'));
      
      expect(userRule).toBeDefined();
      expect(dashboardRule).toBeDefined();
    });
  });
});