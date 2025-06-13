import { Test, TestingModule } from '@nestjs/testing';
import { SlowQueryMonitorController } from './slow-query-monitor.controller';
import { SlowQueryMonitorService } from './slow-query-monitor.service';

describe('SlowQueryMonitorController', () => {
  let controller: SlowQueryMonitorController;
  let service: SlowQueryMonitorService;

  const mockSlowQueryMonitorService = {
    getSlowQueryStats: jest.fn(),
    getSlowQueries: jest.fn(),
    resolveSlowQuery: jest.fn(),
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
    cleanupOldLogs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlowQueryMonitorController],
      providers: [
        {
          provide: SlowQueryMonitorService,
          useValue: mockSlowQueryMonitorService,
        },
      ],
    }).compile();

    controller = module.get<SlowQueryMonitorController>(SlowQueryMonitorController);
    service = module.get<SlowQueryMonitorService>(SlowQueryMonitorService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSlowQueryStats', () => {
    it('should return slow query statistics', async () => {
      const mockStats = {
        totalSlowQueries: 150,
        avgExecutionTime: 2500.5,
        maxExecutionTime: 15000,
        mostFrequentQueries: [],
        performanceByDatabase: [],
        severityDistribution: { low: 100, medium: 35, high: 12, critical: 3 },
        trendsLast24Hours: [],
      };

      mockSlowQueryMonitorService.getSlowQueryStats.mockResolvedValue(mockStats);

      const result = await controller.getSlowQueryStats(24);

      expect(result).toEqual(mockStats);
      expect(service.getSlowQueryStats).toHaveBeenCalledWith(24);
    });

    it('should use default period when not provided', async () => {
      const mockStats = { totalSlowQueries: 0 };
      mockSlowQueryMonitorService.getSlowQueryStats.mockResolvedValue(mockStats);

      await controller.getSlowQueryStats();

      expect(service.getSlowQueryStats).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getSlowQueries', () => {
    it('should return paginated slow queries', async () => {
      const mockResult = {
        data: [
          {
            id: 1,
            queryHash: 'abc123',
            query: 'SELECT * FROM users',
            executionTime: 2500,
            severity: 'MEDIUM',
            detectedAt: new Date(),
            resolved: false,
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
      };

      mockSlowQueryMonitorService.getSlowQueries.mockResolvedValue(mockResult);

      const result = await controller.getSlowQueries(1, 50, {
        databaseId: 1,
        severity: 'MEDIUM',
      });

      expect(result).toEqual(mockResult);
      expect(service.getSlowQueries).toHaveBeenCalledWith(1, 50, {
        databaseId: 1,
        severity: 'MEDIUM',
      });
    });

    it('should handle filters from query parameters', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      };

      mockSlowQueryMonitorService.getSlowQueries.mockResolvedValue(mockResult);

      await controller.getSlowQueries(undefined, undefined, {
        page: 2,
        limit: 25,
        startDate: new Date('2024-01-01'),
        databaseId: 1,
      });

      expect(service.getSlowQueries).toHaveBeenCalledWith(2, 25, {
        startDate: new Date('2024-01-01'),
        databaseId: 1,
      });
    });
  });

  describe('resolveSlowQuery', () => {
    it('should resolve slow query', async () => {
      mockSlowQueryMonitorService.resolveSlowQuery.mockResolvedValue(undefined);

      const result = await controller.resolveSlowQuery(1, {
        resolutionNotes: 'Added index to optimize query',
      });

      expect(result).toEqual({
        message: '슬로우 쿼리가 해결 처리되었습니다.',
      });
      expect(service.resolveSlowQuery).toHaveBeenCalledWith(1, 'Added index to optimize query');
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', async () => {
      const mockConfig = {
        enabled: true,
        threshold: 1000,
        maxLogEntries: 10000,
        cleanupIntervalDays: 30,
        alertThresholds: {
          low: 1000,
          medium: 3000,
          high: 10000,
          critical: 30000,
        },
      };

      mockSlowQueryMonitorService.getConfig.mockReturnValue(mockConfig);

      const result = await controller.getConfig();

      expect(result).toEqual(mockConfig);
      expect(service.getConfig).toHaveBeenCalled();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', async () => {
      const configUpdate = {
        enabled: false,
        threshold: 2000,
      };

      mockSlowQueryMonitorService.updateConfig.mockReturnValue(undefined);

      const result = await controller.updateConfig(configUpdate);

      expect(result).toEqual({
        message: '설정이 업데이트되었습니다.',
      });
      expect(service.updateConfig).toHaveBeenCalledWith(configUpdate);
    });
  });

  describe('cleanupOldLogs', () => {
    it('should trigger cleanup of old logs', async () => {
      mockSlowQueryMonitorService.cleanupOldLogs.mockResolvedValue(undefined);

      const result = await controller.cleanupOldLogs();

      expect(result).toEqual({
        message: '오래된 로그 정리가 완료되었습니다.',
      });
      expect(service.cleanupOldLogs).toHaveBeenCalled();
    });
  });

  describe('exportSlowQueries', () => {
    it('should export slow queries in JSON format', async () => {
      const mockData = [
        {
          id: 1,
          queryHash: 'abc123',
          executionTime: 2500,
          databaseEngine: 'mysql2',
          severity: 'MEDIUM',
          detectedAt: new Date('2024-01-01T10:00:00Z'),
          resolved: false,
        },
      ];

      mockSlowQueryMonitorService.getSlowQueries.mockResolvedValue({
        data: mockData,
        total: 1,
        page: 1,
        limit: 10000,
      });

      const result = await controller.exportSlowQueries('json', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
      });

      expect(result.format).toBe('json');
      expect(result.data).toEqual(mockData);
      expect(result.filename).toContain('.json');
    });

    it('should export slow queries in CSV format', async () => {
      const mockData = [
        {
          id: 1,
          queryHash: 'abc123',
          executionTime: 2500,
          databaseEngine: 'mysql2',
          severity: 'MEDIUM',
          detectedAt: new Date('2024-01-01T10:00:00.000Z'),
          resolved: false,
        },
      ];

      mockSlowQueryMonitorService.getSlowQueries.mockResolvedValue({
        data: mockData,
        total: 1,
        page: 1,
        limit: 10000,
      });

      const result = await controller.exportSlowQueries('csv', {});

      expect(result.format).toBe('csv');
      expect(result.data).toContain('"ID","Query Hash","Execution Time (ms)"');
      expect(result.data).toContain('"1","abc123","2500"');
      expect(result.filename).toContain('.csv');
    });
  });
});
