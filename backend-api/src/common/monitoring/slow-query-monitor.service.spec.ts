import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlowQueryMonitorService } from './slow-query-monitor.service';
import { SlowQueryLog } from './entities/slow-query-log.entity';
import { QueryAnalysis } from './query-analyzer.service';

describe('SlowQueryMonitorService', () => {
  let service: SlowQueryMonitorService;
  let repository: Repository<SlowQueryLog>;

  const mockRepository = {
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlowQueryMonitorService,
        {
          provide: getRepositoryToken(SlowQueryLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SlowQueryMonitorService>(SlowQueryMonitorService);
    repository = module.get<Repository<SlowQueryLog>>(getRepositoryToken(SlowQueryLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logSlowQuery', () => {
    it('should log slow query when execution time exceeds threshold', async () => {
      const analysis: QueryAnalysis = {
        query: 'SELECT * FROM users WHERE email = ?',
        executionTime: 2500,
        rowsExamined: 1000,
        rowsReturned: 1,
        indexUsed: false,
        scanType: 'ALL',
        temporaryTable: false,
        filesort: false,
        cost: 100.5,
        warnings: ['Full table scan detected'],
        optimizationSuggestions: ['Add index on email column'],
      };

      const metadata = {
        databaseId: 1,
        databaseEngine: 'mysql2',
        userId: 'user123',
        requestPath: '/api/data/query',
        httpMethod: 'POST',
        clientIp: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        requestId: 'req_123',
        parameters: ['test@example.com'],
      };

      mockRepository.save.mockResolvedValue({ id: 1 });

      await service.logSlowQuery(analysis, metadata);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          query: analysis.query,
          executionTime: analysis.executionTime,
          databaseId: metadata.databaseId,
          databaseEngine: metadata.databaseEngine,
          userId: metadata.userId,
          severity: 'MEDIUM',
        }),
      );
    });

    it('should not log query when execution time is below threshold', async () => {
      const analysis: QueryAnalysis = {
        query: 'SELECT * FROM users LIMIT 10',
        executionTime: 500, // Below 1000ms threshold
      };

      await service.logSlowQuery(analysis, {});

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should determine correct severity levels', async () => {
      const testCases = [
        { executionTime: 1500, expectedSeverity: 'LOW' },
        { executionTime: 5000, expectedSeverity: 'MEDIUM' },
        { executionTime: 15000, expectedSeverity: 'HIGH' },
        { executionTime: 35000, expectedSeverity: 'CRITICAL' },
      ];

      for (const testCase of testCases) {
        const analysis: QueryAnalysis = {
          query: 'SELECT * FROM test',
          executionTime: testCase.executionTime,
        };

        mockRepository.save.mockResolvedValue({ id: 1 });

        await service.logSlowQuery(analysis, {});

        expect(mockRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: testCase.expectedSeverity,
          }),
        );

        mockRepository.save.mockClear();
      }
    });
  });

  describe('getSlowQueryStats', () => {
    it('should return correct statistics', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        getRawMany: jest.fn(),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockRepository.count.mockResolvedValue(150);

      // Mock average execution time
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ avg: '2500.5' }) // avgExecutionTime
        .mockResolvedValueOnce({ max: '15000' }); // maxExecutionTime

      // Mock most frequent queries
      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([
          {
            sql_queryHash: 'abc123',
            sql_query: 'SELECT * FROM users WHERE email = ?',
            count: '25',
            avgExecutionTime: '3200',
          },
        ])
        .mockResolvedValueOnce([
          {
            sql_databaseId: 1,
            sql_databaseEngine: 'mysql2',
            count: '80',
            avgExecutionTime: '2100',
          },
        ])
        .mockResolvedValueOnce([
          { sql_severity: 'LOW', count: '100' },
          { sql_severity: 'MEDIUM', count: '35' },
          { sql_severity: 'HIGH', count: '12' },
          { sql_severity: 'CRITICAL', count: '3' },
        ])
        .mockResolvedValueOnce([
          {
            hour: '2024-01-01 10:00:00',
            count: '8',
            avgExecutionTime: '2300',
          },
        ]);

      const stats = await service.getSlowQueryStats(24);

      expect(stats).toEqual({
        totalSlowQueries: 150,
        avgExecutionTime: 2500.5,
        maxExecutionTime: 15000,
        mostFrequentQueries: [
          {
            queryHash: 'abc123',
            query: 'SELECT * FROM users WHERE email = ?...',
            count: 25,
            avgExecutionTime: 3200,
          },
        ],
        performanceByDatabase: [
          {
            databaseId: 1,
            databaseEngine: 'mysql2',
            count: 80,
            avgExecutionTime: 2100,
          },
        ],
        severityDistribution: {
          low: 100,
          medium: 35,
          high: 12,
          critical: 3,
        },
        trendsLast24Hours: [
          {
            hour: '2024-01-01 10:00:00',
            count: 8,
            avgExecutionTime: 2300,
          },
        ],
      });
    });
  });

  describe('getSlowQueries', () => {
    it('should return paginated slow queries with filters', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockData = [
        {
          id: 1,
          queryHash: 'abc123',
          query: 'SELECT * FROM users',
          executionTime: 2500,
          severity: 'MEDIUM',
          detectedAt: new Date(),
        },
      ];

      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.getSlowQueries(1, 50, {
        databaseId: 1,
        severity: 'MEDIUM',
        minExecutionTime: 1000,
      });

      expect(result).toEqual({
        data: mockData,
        total: 1,
        page: 1,
        limit: 50,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('sql.databaseId = :databaseId', {
        databaseId: 1,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('sql.severity = :severity', {
        severity: 'MEDIUM',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'sql.executionTime >= :minExecutionTime',
        { minExecutionTime: 1000 },
      );
    });
  });

  describe('resolveSlowQuery', () => {
    it('should mark slow query as resolved', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.resolveSlowQuery(1, 'Added index to optimize query');

      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        resolved: true,
        resolutionNotes: 'Added index to optimize query',
        resolvedAt: expect.any(Date),
      });
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete old log entries', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 100 });

      await service.cleanupOldLogs();

      expect(mockRepository.delete).toHaveBeenCalledWith({
        detectedAt: expect.any(Object), // LessThan object
      });
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = {
        enabled: false,
        threshold: 2000,
      };

      service.updateConfig(newConfig);

      const config = service.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.threshold).toBe(2000);
    });
  });
});
