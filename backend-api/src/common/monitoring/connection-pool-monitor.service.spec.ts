import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionPoolMonitorService } from './connection-pool-monitor.service';
import { DataSource } from 'typeorm';
import { CustomLoggerService } from '../logger/logger.service';

describe('ConnectionPoolMonitorService', () => {
  let service: ConnectionPoolMonitorService;
  let mockDataSource: Partial<DataSource>;
  let mockLogger: Partial<CustomLoggerService>;

  beforeEach(async () => {
    mockDataSource = {
      driver: {
        pool: {
          _allConnections: [1, 2, 3, 4, 5],
          _activeConnections: [1, 2],
          _freeConnections: [3, 4, 5],
          _connectionQueue: [],
        },
      } as any,
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionPoolMonitorService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<ConnectionPoolMonitorService>(ConnectionPoolMonitorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('collectTypeOrmMetrics', () => {
    it('should collect TypeORM pool metrics', async () => {
      const metrics = await service.collectTypeOrmMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalConnections).toBe(5);
      expect(metrics.activeConnections).toBe(2);
      expect(metrics.idleConnections).toBe(3);
      expect(metrics.waitingRequests).toBe(0);
      expect(metrics.connectionUtilization).toBe(40); // 2/5 * 100
    });

    it('should return null if pool is not available', async () => {
      mockDataSource.driver = {} as any;
      const metrics = await service.collectTypeOrmMetrics();
      expect(metrics).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockDataSource.driver = null;
      const metrics = await service.collectTypeOrmMetrics();
      expect(metrics).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('collectKnexMetrics', () => {
    it('should collect Knex pool metrics', async () => {
      const mockKnexInstance = {
        client: {
          pool: {
            numUsed: () => 2,
            numFree: () => 3,
            numPendingAcquires: () => 1,
          },
        },
      };

      const metrics = await service.collectKnexMetrics(mockKnexInstance);

      expect(metrics).toBeDefined();
      expect(metrics.totalConnections).toBe(5);
      expect(metrics.activeConnections).toBe(2);
      expect(metrics.idleConnections).toBe(3);
      expect(metrics.waitingRequests).toBe(1);
      expect(metrics.connectionUtilization).toBe(40); // 2/5 * 100
    });

    it('should return null if pool is not available', async () => {
      const mockKnexInstance = { client: {} };
      const metrics = await service.collectKnexMetrics(mockKnexInstance);
      expect(metrics).toBeNull();
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics and statistics', async () => {
      const result = await service.getMetrics();

      expect(result).toBeDefined();
      expect(result.current).toBeDefined();
      expect(result.statistics).toBeDefined();
      expect(result.statistics.avgUtilization).toBeDefined();
      expect(result.statistics.maxUtilization).toBeDefined();
      expect(result.statistics.avgActiveConnections).toBeDefined();
      expect(result.statistics.connectionReusability).toBeDefined();
    });
  });

  describe('checkPoolHealth', () => {
    it('should return healthy status when pool is functioning well', async () => {
      const health = await service.checkPoolHealth();

      expect(health.isHealthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should detect high utilization', async () => {
      // Mock 높은 사용률
      mockDataSource.driver = {
        pool: {
          _allConnections: [1, 2, 3, 4, 5],
          _activeConnections: [1, 2, 3, 4, 5], // 100% 사용
          _freeConnections: [],
          _connectionQueue: [],
        },
      } as any;

      const health = await service.checkPoolHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues[0]).toContain('utilization is very high');
    });

    it('should detect waiting requests', async () => {
      // Mock 대기 중인 요청
      mockDataSource.driver = {
        pool: {
          _allConnections: [1, 2, 3, 4, 5],
          _activeConnections: [1, 2, 3, 4, 5],
          _freeConnections: [],
          _connectionQueue: [1, 2], // 2개의 대기 요청
        },
      } as any;

      const health = await service.checkPoolHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.issues.some(issue => issue.includes('requests waiting'))).toBe(true);
    });
  });

  describe('collectAndLogMetrics', () => {
    it('should not run in non-production environment', async () => {
      process.env.NODE_ENV = 'dev';
      await service.collectAndLogMetrics();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should log metrics in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'prod';

      await service.collectAndLogMetrics();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Connection pool metrics',
        'ConnectionPoolMonitor',
        expect.any(Object),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should log warning for high utilization', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'prod';

      // Mock 높은 사용률 (85%)
      mockDataSource.driver = {
        pool: {
          _allConnections: [1, 2, 3, 4, 5],
          _activeConnections: [1, 2, 3, 4, 5],
          _freeConnections: [],
          _connectionQueue: [],
        },
      } as any;

      await service.collectAndLogMetrics();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'High connection pool utilization',
        'ConnectionPoolMonitor',
        expect.any(Object),
      );

      process.env.NODE_ENV = originalEnv;
    });
  });
});
