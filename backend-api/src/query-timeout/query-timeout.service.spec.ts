import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { QueryTimeoutService } from './query-timeout.service';
import { TimeoutConfigurationService } from './services/timeout-configuration.service';
import { AdaptiveTimeoutService } from './services/adaptive-timeout.service';
import { TimeoutMonitoringService } from './services/timeout-monitoring.service';
import { Database } from '../database/entities/database.entity';
import {
  DatabaseEngine,
  QueryComplexity,
  AdaptiveTimeoutConfigDto,
} from './dto/timeout-config.dto';
import { ResponseStatus } from '../common/enum/response-status.enum';

describe('QueryTimeoutService', () => {
  let service: QueryTimeoutService;
  let databaseRepository: jest.Mocked<Repository<Database>>;
  let configService: jest.Mocked<TimeoutConfigurationService>;
  let adaptiveService: jest.Mocked<AdaptiveTimeoutService>;
  let monitoringService: jest.Mocked<TimeoutMonitoringService>;

  const mockDatabase: Database = {
    id: 1,
    name: 'test-db',
    description: 'Test database',
    engine: 'pg',
    type: 'postgresql',
    connectionConfig: '{"host":"localhost","port":5432}',
    timezone: 'UTC',
    createdAt: new Date(),
    updatedAt: new Date(),
    getFullDescription: jest.fn().mockReturnValue('test-db Test database'),
  } as any;

  beforeEach(async () => {
    const mockDatabaseRepository = {
      findOne: jest.fn(),
    };

    const mockConfigService = {
      getEngineTimeoutRules: jest.fn(),
      getDatabaseDefaultConfig: jest.fn(),
      analyzeQueryComplexity: jest.fn(),
      calculateRecommendedTimeout: jest.fn(),
      updateTimeoutRule: jest.fn(),
      getSystemTimeoutStatistics: jest.fn(),
    };

    const mockAdaptiveService = {
      calculateAdaptiveTimeout: jest.fn(),
      recordExecution: jest.fn(),
      analyzeTimeoutRequirements: jest.fn(),
      getExecutionStatistics: jest.fn(),
    };

    const mockMonitoringService = {
      generateStatistics: jest.fn(),
      recordExecution: jest.fn(),
      generateMonitoringReport: jest.fn(),
      getMemoryInfo: jest.fn(),
      getTimeoutTrend: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryTimeoutService,
        {
          provide: getRepositoryToken(Database),
          useValue: mockDatabaseRepository,
        },
        {
          provide: TimeoutConfigurationService,
          useValue: mockConfigService,
        },
        {
          provide: AdaptiveTimeoutService,
          useValue: mockAdaptiveService,
        },
        {
          provide: TimeoutMonitoringService,
          useValue: mockMonitoringService,
        },
      ],
    }).compile();

    service = module.get<QueryTimeoutService>(QueryTimeoutService);
    databaseRepository = module.get(getRepositoryToken(Database));
    configService = module.get(TimeoutConfigurationService);
    adaptiveService = module.get(AdaptiveTimeoutService);
    monitoringService = module.get(TimeoutMonitoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTimeoutConfig', () => {
    it('should return timeout configuration for existing database', async () => {
      // Arrange
      const databaseId = 1;
      const mockRules = [
        {
          engine: DatabaseEngine.POSTGRESQL,
          complexity: QueryComplexity.SIMPLE,
          timeoutMs: 30000,
          description: 'PostgreSQL simple query',
        },
      ];
      const mockDefaultConfig = {
        engine: DatabaseEngine.POSTGRESQL,
        defaultTimeoutMs: 30000,
        maxTimeoutMs: 300000,
      };
      const mockStatistics = {
        engine: DatabaseEngine.POSTGRESQL,
        totalQueries: 100,
        timeoutCount: 5,
        timeoutRate: 5,
        averageExecutionTime: 15000,
        p95ExecutionTime: 45000,
        p99ExecutionTime: 60000,
        optimalTimeoutSuggestion: 50000,
      };

      databaseRepository.findOne.mockResolvedValue(mockDatabase);
      configService.getEngineTimeoutRules.mockReturnValue(mockRules as any);
      configService.getDatabaseDefaultConfig.mockResolvedValue(mockDefaultConfig as any);
      monitoringService.generateStatistics.mockReturnValue(mockStatistics);

      // Act
      const result = await service.getTimeoutConfig(databaseId);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data?.currentConfig?.engine).toBe(DatabaseEngine.POSTGRESQL);
      expect(result.data?.rules).toHaveLength(1);
      expect(result.data?.statistics).toHaveLength(1);
      expect(databaseRepository.findOne).toHaveBeenCalledWith({ where: { id: databaseId } });
    });

    it('should throw BadRequestException for non-existent database', async () => {
      // Arrange
      const databaseId = 999;
      databaseRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getTimeoutConfig(databaseId);

      // Assert
      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toContain('Database not found');
    });
  });

  describe('calculateOptimalTimeout', () => {
    it('should calculate adaptive timeout when enabled', async () => {
      // Arrange
      const configDto: AdaptiveTimeoutConfigDto = {
        databaseId: 1,
        query: 'SELECT * FROM users',
        enableAdaptive: true,
      };

      const mockAdaptiveResult = {
        originalTimeoutMs: 30000,
        adaptedTimeoutMs: 45000,
        adjustmentReason: 'Increased based on historical data',
        confidenceLevel: 85,
        appliedMultiplier: 1.5,
        historicalAverage: 25000,
        recommendation: 'Good optimization',
      };

      databaseRepository.findOne.mockResolvedValue(mockDatabase);
      configService.analyzeQueryComplexity.mockReturnValue(QueryComplexity.SIMPLE);
      configService.calculateRecommendedTimeout.mockReturnValue(30000);
      adaptiveService.calculateAdaptiveTimeout.mockResolvedValue(mockAdaptiveResult);

      // Act
      const result = await service.calculateOptimalTimeout(configDto);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data?.adaptedTimeoutMs).toBe(45000);
      expect(result.data?.confidenceLevel).toBe(85);
      expect(adaptiveService.calculateAdaptiveTimeout).toHaveBeenCalledWith(
        1,
        'SELECT * FROM users',
        DatabaseEngine.POSTGRESQL,
        30000,
      );
    });

    it('should return static timeout when adaptive is disabled', async () => {
      // Arrange
      const configDto: AdaptiveTimeoutConfigDto = {
        databaseId: 1,
        query: 'SELECT * FROM users',
        enableAdaptive: false,
      };

      databaseRepository.findOne.mockResolvedValue(mockDatabase);
      configService.analyzeQueryComplexity.mockReturnValue(QueryComplexity.SIMPLE);
      configService.calculateRecommendedTimeout.mockReturnValue(30000);

      // Act
      const result = await service.calculateOptimalTimeout(configDto);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data?.originalTimeoutMs).toBe(30000);
      expect(result.data?.adaptedTimeoutMs).toBe(30000);
      expect(result.data?.appliedMultiplier).toBe(1.0);
    });
  });

  describe('recordQueryExecution', () => {
    it('should record successful query execution', async () => {
      // Arrange
      const databaseId = 1;
      const query = 'SELECT * FROM users';
      const executionTimeMs = 25000;
      const timeoutMs = 30000;
      const userId = 'user123';

      databaseRepository.findOne.mockResolvedValue(mockDatabase);
      configService.analyzeQueryComplexity.mockReturnValue(QueryComplexity.SIMPLE);

      // Act
      await service.recordQueryExecution(
        databaseId,
        query,
        executionTimeMs,
        timeoutMs,
        false, // not timed out
        undefined, // no error
        userId,
      );

      // Assert
      expect(monitoringService.recordExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          executionTimeMs,
          timeoutMs,
          wasTimedOut: false,
          query,
          databaseEngine: DatabaseEngine.POSTGRESQL,
          complexity: QueryComplexity.SIMPLE,
        }),
        userId,
      );
      expect(adaptiveService.recordExecution).toHaveBeenCalledWith(
        databaseId,
        query,
        executionTimeMs,
        true,
      );
    });

    it('should record timed out query execution', async () => {
      // Arrange
      const databaseId = 1;
      const query = 'SELECT * FROM large_table';
      const executionTimeMs = 35000;
      const timeoutMs = 30000;

      databaseRepository.findOne.mockResolvedValue(mockDatabase);
      configService.analyzeQueryComplexity.mockReturnValue(QueryComplexity.COMPLEX);

      // Act
      await service.recordQueryExecution(
        databaseId,
        query,
        executionTimeMs,
        timeoutMs,
        true, // timed out
        'Query execution timeout',
      );

      // Assert
      expect(monitoringService.recordExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          executionTimeMs,
          timeoutMs,
          wasTimedOut: true,
          errorMessage: 'Query execution timeout',
        }),
        undefined,
      );
      // 타임아웃된 경우 adaptive service에 기록하지 않음
      expect(adaptiveService.recordExecution).not.toHaveBeenCalled();
    });
  });

  describe('generateMonitoringReport', () => {
    it('should generate monitoring report for specified period', async () => {
      // Arrange
      const periodHours = 24;
      const mockReport = {
        reportPeriod: {
          startTime: new Date(),
          endTime: new Date(),
        },
        summary: {
          totalQueries: 1000,
          totalTimeouts: 50,
          overallTimeoutRate: 5,
          averageExecutionTime: 15000,
          savedTimeFromOptimization: 120000,
        },
        byEngine: [],
        byComplexity: [],
        recommendations: ['Optimize slow queries'],
        alertsTriggered: [],
      };

      monitoringService.generateMonitoringReport.mockReturnValue(mockReport);

      // Act
      const result = await service.generateMonitoringReport(periodHours);

      // Assert
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data?.monitoringReport).toBe(mockReport);
      expect(monitoringService.generateMonitoringReport).toHaveBeenCalledWith(periodHours);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all systems are working', async () => {
      // Arrange
      const mockSystemStats = {
        totalRules: 20,
        averageTimeout: 45000,
        byEngine: {},
        byComplexity: {},
        maxTimeout: 300000,
        minTimeout: 15000,
      };

      const mockAdaptiveStats = {
        totalQueries: 500,
        averageExecutionTime: 20000,
        adaptationRate: 75,
        memoryUsageKB: 2048,
      };

      const mockMonitoringMemory = {
        eventCount: 1000,
        memoryUsageEstimateKB: 1024,
        oldestEventAge: 86400000,
        newestEventAge: 0,
      };

      configService.getSystemTimeoutStatistics.mockReturnValue(mockSystemStats);
      adaptiveService.getExecutionStatistics.mockReturnValue(mockAdaptiveStats);
      monitoringService.getMemoryInfo.mockReturnValue(mockMonitoringMemory);

      // Act
      const result = await service.healthCheck();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.details.configuredRules).toBe(20);
      expect(result.details.adaptiveQueries).toBe(500);
      expect(result.details.adaptationRate).toBe(75);
    });

    it('should return degraded status when memory usage is high', async () => {
      // Arrange
      const mockSystemStats = {
        totalRules: 20,
        averageTimeout: 45000,
        byEngine: {},
        byComplexity: {},
        maxTimeout: 300000,
        minTimeout: 15000,
      };

      const mockAdaptiveStats = {
        totalQueries: 100,
        averageExecutionTime: 20000,
        adaptationRate: 5, // Low adaptation rate
        memoryUsageKB: 15000, // High memory usage
      };

      const mockMonitoringMemory = {
        eventCount: 10000,
        memoryUsageEstimateKB: 12000, // High memory usage
        oldestEventAge: 86400000,
        newestEventAge: 0,
      };

      configService.getSystemTimeoutStatistics.mockReturnValue(mockSystemStats);
      adaptiveService.getExecutionStatistics.mockReturnValue(mockAdaptiveStats);
      monitoringService.getMemoryInfo.mockReturnValue(mockMonitoringMemory);

      // Act
      const result = await service.healthCheck();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.details.memoryUsageKB).toBeGreaterThan(10000);
    });
  });
});
