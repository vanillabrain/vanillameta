import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ConnectionService, knexConnections } from './connection.service';
import { Database } from '../database/entities/database.entity';
import { CustomLoggerService } from '../common/logger/logger.service';
import { SqlValidationService } from '../common/security/sql-validation.service';
import { QueryAnalyzerService } from '../common/monitoring/query-analyzer.service';
import { QueryCollector } from '../common/utils/query-collector';
import { SlowQueryMonitorService } from '../common/monitoring/slow-query-monitor.service';
import { DatabaseOptimizerFactory } from './database-optimizers/database-optimizer-factory';
import { KnexQueryMonitor } from '../common/monitoring/knex-query-monitor';
import {
  createMockRepository,
  getRepositoryTokenFor,
  createMockService,
} from '../../test/test-helpers';
import { ResponseStatus } from '../common/enum/response-status.enum';

// Knex Mock
const mockKnex = {
  raw: jest.fn(),
  destroy: jest.fn(),
  client: {
    config: {
      client: 'mysql2',
    },
  },
};

// knex 모듈 모킹
jest.mock('knex', () => {
  return jest.fn(() => mockKnex);
});

const mockKnexConstructor = jest.fn(() => mockKnex);

const mockKnexInstance = {
  raw: jest.fn(),
  destroy: jest.fn().mockResolvedValue(undefined),
  client: {
    config: {
      client: 'mysql2',
    },
  },
};

jest.mock('knex', () => {
  return jest.fn(() => mockKnexInstance);
});

describe('ConnectionService', () => {
  let service: ConnectionService;
  let databaseRepository: any;
  let logger: any;
  let sqlValidationService: any;
  let queryAnalyzerService: any;
  let queryCollector: any;
  let slowQueryMonitorService: any;
  let databaseOptimizerFactory: any;
  let mockRequest: any;

  const mockDatabase = {
    id: 1,
    name: 'Test Database',
    engine: 'mysql2',
    connectionConfig: JSON.stringify({
      host: 'localhost',
      port: 3306,
      user: 'testuser',
      password: 'testpass',
      database: 'testdb',
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryExecuteDto = {
    id: 1,
    query: 'SELECT * FROM users WHERE id = ?',
    parameters: [{ name: 'id', value: '1', type: 'number' }],
    limit: 100,
  };

  const mockCreateDatabaseDto = {
    name: 'Test Database',
    description: 'Test database description',
    engine: 'mysql2',
    connectionConfig: JSON.stringify({
      host: 'localhost',
      port: 3306,
      user: 'testuser',
      password: 'testpass',
      database: 'testdb',
    }),
    type: 'mysql',
    timezone: 'Asia/Seoul',
  };

  beforeEach(async () => {
    // Request Mock 설정
    mockRequest = {
      get: jest.fn(),
      path: '/api/test',
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionService,
        {
          provide: getRepositoryTokenFor(Database),
          useValue: createMockRepository(),
        },
        {
          provide: CustomLoggerService,
          useValue: createMockService(['info', 'warn', 'error', 'debug']),
        },
        {
          provide: SqlValidationService,
          useValue: createMockService(['validateQuery', 'formatValidationError']),
        },
        {
          provide: QueryAnalyzerService,
          useValue: createMockService(['analyzeQuery']),
        },
        {
          provide: QueryCollector,
          useValue: createMockService(['collect']),
        },
        {
          provide: SlowQueryMonitorService,
          useValue: createMockService(['logSlowQuery']),
        },
        {
          provide: DatabaseOptimizerFactory,
          useValue: createMockService([
            'getOptimizedConnectionConfig',
            'isSupported',
            'getOptimizationStats',
            'getOptimizer',
          ]),
        },
        {
          provide: KnexQueryMonitor,
          useValue: createMockService(['monitor', 'getMetrics', 'attachToKnex']),
        },
        {
          provide: REQUEST,
          useValue: mockRequest,
        },
      ],
    }).compile();

    service = module.get<ConnectionService>(ConnectionService);
    databaseRepository = module.get(getRepositoryTokenFor(Database));
    logger = module.get<CustomLoggerService>(CustomLoggerService);
    sqlValidationService = module.get<SqlValidationService>(SqlValidationService);
    queryAnalyzerService = module.get<QueryAnalyzerService>(QueryAnalyzerService);
    queryCollector = module.get<QueryCollector>(QueryCollector);
    slowQueryMonitorService = module.get<SlowQueryMonitorService>(SlowQueryMonitorService);
    databaseOptimizerFactory = module.get<DatabaseOptimizerFactory>(DatabaseOptimizerFactory);

    // Mock 초기화
    jest.clearAllMocks();
    knexConnections.clear();
  });

  afterEach(() => {
    // 테스트 후 연결 정리
    knexConnections.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addKnex', () => {
    it('should add Knex connection to pool with optimized settings', () => {
      const knexConfig = {
        client: 'mysql2',
        connection: {
          host: 'localhost',
          port: 3306,
          user: 'testuser',
          password: 'testpass',
          database: 'testdb',
        },
      };

      // Mock DatabaseOptimizerFactory methods
      databaseOptimizerFactory.getOptimizer.mockReturnValue(null);
      databaseOptimizerFactory.getOptimizedConnectionConfig.mockReturnValue({
        pool: { min: 2, max: 10 },
      });
      databaseOptimizerFactory.isSupported.mockReturnValue(true);
      databaseOptimizerFactory.getOptimizationStats.mockReturnValue({
        totalOptimized: 1,
        byType: { mysql2: 1 },
      });

      service.addKnex(1, knexConfig);

      expect(knexConnections.has(1)).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Creating Knex connection with database-specific optimizations',
        'ConnectionService',
        expect.objectContaining({
          databaseId: 1,
          client: 'mysql2',
        }),
      );
    });

    it('should not add duplicate Knex connection', () => {
      const knexConfig = {
        client: 'mysql2',
        connection: { host: 'localhost' },
      };

      // Mock DatabaseOptimizerFactory
      databaseOptimizerFactory.getOptimizer.mockReturnValue(null);
      databaseOptimizerFactory.getOptimizedConnectionConfig.mockReturnValue({
        pool: { min: 2, max: 10 },
      });
      databaseOptimizerFactory.isSupported.mockReturnValue(true);
      databaseOptimizerFactory.getOptimizationStats.mockReturnValue({
        totalOptimized: 1,
        byType: { mysql2: 1 },
      });

      service.addKnex(1, knexConfig);
      const firstConnection = knexConnections.get(1);

      service.addKnex(1, knexConfig);
      const secondConnection = knexConnections.get(1);

      expect(firstConnection).toBe(secondConnection);
    });

    it('should apply SQLite specific settings', () => {
      const sqliteConfig = {
        client: 'sqlite3',
        connection: { filename: ':memory:' },
      };

      // Mock DatabaseOptimizerFactory for SQLite
      databaseOptimizerFactory.getOptimizedConnectionConfig.mockReturnValue({
        pool: { min: 1, max: 1 },
      });
      databaseOptimizerFactory.isSupported.mockReturnValue(true);
      databaseOptimizerFactory.getOptimizationStats.mockReturnValue({
        totalOptimized: 1,
        byType: { sqlite3: 1 },
      });

      service.addKnex(2, sqliteConfig);

      expect(knexConnections.has(2)).toBe(true);
    });

    it('should apply MySQL specific connection settings', () => {
      const mysqlConfig = {
        client: 'mysql2',
        connection: {
          host: 'localhost',
          port: 3306,
        },
      };

      // Mock DatabaseOptimizerFactory for MySQL
      databaseOptimizerFactory.getOptimizedConnectionConfig.mockReturnValue({
        pool: { min: 2, max: 10 },
      });
      databaseOptimizerFactory.isSupported.mockReturnValue(true);
      databaseOptimizerFactory.getOptimizationStats.mockReturnValue({
        totalOptimized: 1,
        byType: { mysql2: 1 },
      });

      service.addKnex(3, mysqlConfig);

      expect(knexConnections.has(3)).toBe(true);
    });
  });

  describe('removeKnex', () => {
    it('should remove and destroy Knex connection', async () => {
      const knexConfig = { client: 'mysql2', connection: {} };

      // Mock DatabaseOptimizerFactory
      databaseOptimizerFactory.getOptimizer.mockReturnValue(null);
      databaseOptimizerFactory.getOptimizedConnectionConfig.mockReturnValue({
        pool: { min: 2, max: 10 },
      });
      databaseOptimizerFactory.isSupported.mockReturnValue(true);
      databaseOptimizerFactory.getOptimizationStats.mockReturnValue({
        totalOptimized: 1,
        byType: { mysql2: 1 },
      });

      service.addKnex(1, knexConfig);

      await service.removeKnex(1);

      expect(knexConnections.has(1)).toBe(false);
      expect(mockKnexInstance.destroy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Knex connection pool destroyed',
        'ConnectionService',
        { databaseId: 1 },
      );
    });

    it('should handle destroy error gracefully', async () => {
      const knexConfig = { client: 'mysql2', connection: {} };
      service.addKnex(1, knexConfig);

      mockKnexInstance.destroy.mockRejectedValue(new Error('Destroy failed'));

      await service.removeKnex(1);

      expect(knexConnections.has(1)).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to destroy Knex connection pool',
        expect.any(String),
        'ConnectionService',
        { databaseId: 1 },
      );
    });

    it('should handle removal of non-existent connection', async () => {
      await service.removeKnex(999);

      expect(mockKnex.destroy).not.toHaveBeenCalled();
    });
  });

  describe('hasKnex', () => {
    it('should return true for existing connection', () => {
      const knexConfig = { client: 'mysql2', connection: {} };
      service.addKnex(1, knexConfig);

      expect(service.hasKnex(1)).toBe(true);
    });

    it('should return false for non-existing connection', () => {
      expect(service.hasKnex(999)).toBe(false);
    });
  });

  describe('getKnex', () => {
    it('should return existing Knex connection', async () => {
      const knexConfig = { client: 'mysql2', connection: {} };
      service.addKnex(1, knexConfig);

      const knexInstance = await service.getKnex(1);

      expect(knexInstance).toBeDefined();
    });

    it('should create and return new Knex connection if not exists', async () => {
      databaseRepository.findOne.mockResolvedValue(mockDatabase);

      const knexInstance = await service.getKnex(1);

      expect(databaseRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(knexInstance).toBeDefined();
      expect(knexConnections.has(1)).toBe(true);
    });

    it('should handle BigQuery client configuration', async () => {
      const bigqueryDatabase = {
        ...mockDatabase,
        connectionConfig: JSON.stringify({
          client: 'bigquery',
          connection: { projectId: 'test-project' },
        }),
      };

      databaseRepository.findOne.mockResolvedValue(bigqueryDatabase);

      const knexInstance = await service.getKnex(1);

      expect(knexInstance).toBeDefined();
    });

    it('should handle Snowflake client configuration', async () => {
      const snowflakeDatabase = {
        ...mockDatabase,
        connectionConfig: JSON.stringify({
          client: 'snowflake',
          connection: { account: 'test-account' },
        }),
      };

      databaseRepository.findOne.mockResolvedValue(snowflakeDatabase);

      const knexInstance = await service.getKnex(1);

      expect(knexInstance).toBeDefined();
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      // Mock DatabaseOptimizerFactory for test connections
      databaseOptimizerFactory.getOptimizedConnectionConfig.mockReturnValue({
        pool: { min: 0, max: 1 },
      });
      databaseOptimizerFactory.isSupported.mockReturnValue(true);
      databaseOptimizerFactory.getOptimizationStats.mockReturnValue({
        totalOptimized: 1,
        byType: { mysql2: 1 },
      });
    });

    it('should successfully test database connection', async () => {
      mockKnex.raw.mockResolvedValue(['test result']);

      const result = await service.testConnection(mockCreateDatabaseDto);

      expect(mockKnex.raw).toHaveBeenCalledWith('SELECT 1');
      expect(mockKnex.destroy).toHaveBeenCalled();
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data?.message).toBe('success');
    });

    it('should handle Oracle database test connection', async () => {
      const oracleDto = {
        ...mockCreateDatabaseDto,
        engine: 'oracledb',
      };
      mockKnex.raw.mockResolvedValue(['test result']);

      const result = await service.testConnection(oracleDto);

      expect(mockKnex.raw).toHaveBeenCalledWith('SELECT 1 FROM DUAL');
      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should handle CockroachDB connection configuration', async () => {
      const cockroachDto = {
        name: 'CockroachDB Test',
        description: 'Test CockroachDB connection',
        engine: 'cockroachdb',
        connectionConfig: JSON.stringify({
          user: 'testuser',
          password: 'testpass',
          host: 'localhost',
          port: 26257,
          database: 'testdb',
        }),
        type: 'cockroachdb',
        timezone: 'Asia/Seoul',
      };
      mockKnex.raw.mockResolvedValue(['test result']);

      const result = await service.testConnection(cockroachDto);

      const parsedConfig = JSON.parse(cockroachDto.connectionConfig);
      expect(parsedConfig.connectionString).toContain('postgresql://');
      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should handle BigQuery test connection', async () => {
      const bigqueryDto = {
        name: 'BigQuery Test',
        description: 'Test BigQuery connection',
        engine: 'bigquery',
        connectionConfig: JSON.stringify({ projectId: 'test-project' }),
        type: 'bigquery',
        timezone: 'Asia/Seoul',
      };
      mockKnex.raw.mockResolvedValue(['test result']);

      const result = await service.testConnection(bigqueryDto);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should handle Snowflake test connection', async () => {
      const snowflakeDto = {
        name: 'Snowflake Test',
        description: 'Test Snowflake connection',
        engine: 'snowflake',
        connectionConfig: JSON.stringify({ account: 'test-account' }),
        type: 'snowflake',
        timezone: 'Asia/Seoul',
      };
      mockKnex.raw.mockResolvedValue(['test result']);

      const result = await service.testConnection(snowflakeDto);

      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should handle Knex creation failure', async () => {
      const invalidDto = {
        name: 'Invalid Test',
        description: 'Test invalid connection',
        engine: 'invalid-engine',
        connectionConfig: JSON.stringify({}),
        type: 'invalid',
        timezone: 'Asia/Seoul',
      };

      // Knex 생성 실패를 시뮬레이션하기 위해 require를 직접 모킹
      const originalKnex = require('knex');
      require('knex').mockImplementation(() => {
        throw new Error('Invalid configuration');
      });

      const result = await service.testConnection(invalidDto);

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toBe('knex not connected');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create Knex connection',
        expect.any(String),
        'ConnectionService',
        expect.any(Object),
      );

      // Mock 복원
      require('knex').mockImplementation(() => mockKnex);
    });

    it('should handle connection test failure', async () => {
      const sqlError = new Error('Connection failed') as any;
      sqlError.sqlMessage = 'Access denied';
      mockKnex.raw.mockRejectedValue(sqlError);

      const result = await service.testConnection(mockCreateDatabaseDto);

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toBe('데이터베이스 연결 테스트에 실패했습니다.');
      expect(mockKnex.destroy).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Database connection test failed',
        expect.any(String),
        'ConnectionService',
        expect.objectContaining({
          engine: 'mysql2',
          sqlMessage: 'Access denied',
        }),
      );
    });
  });

  describe('executeQuery', () => {
    beforeEach(() => {
      // SQL 검증 서비스 기본 성공 설정
      sqlValidationService.validateQuery.mockReturnValue({
        isValid: true,
        sanitizedQuery: 'SELECT * FROM users WHERE id = ? LIMIT 100',
        errors: [],
        warnings: [],
        riskLevel: 'LOW',
      });

      // 쿼리 분석 서비스 설정
      queryAnalyzerService.analyzeQuery.mockResolvedValue({
        query: 'SELECT * FROM users WHERE id = ?',
        scanType: 'INDEX_SCAN',
        indexUsed: true,
        optimizationSuggestions: [],
      });

      // 데이터베이스 레포지토리 설정
      databaseRepository.findOne.mockResolvedValue(mockDatabase);

      // Mock 쿼리 결과 설정
      mockKnex.raw.mockResolvedValue([
        [{ id: 1, name: 'Test User', email: 'test@example.com' }],
        [
          { name: 'id', columnType: 3 },
          { name: 'name', columnType: 253 },
          { name: 'email', columnType: 253 },
        ],
      ]);
    });

    it('should execute query successfully with parameters', async () => {
      const result = await service.executeQuery(mockQueryExecuteDto, 'user123');

      expect(sqlValidationService.validateQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
        expect.objectContaining({
          allowDDL: false,
          allowDML: false,
          allowMultipleStatements: false,
          maxQueryLength: 10000,
          maxResultLimit: 100,
        }),
        'user123',
      );

      expect(mockKnex.raw).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ? LIMIT 100',
        [1], // 파라미터가 숫자로 변환됨
      );

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.message).toBe('success');
      expect(result.datas).toHaveLength(1);
      expect(result.fields).toHaveLength(3);
      expect(queryCollector.collect).toHaveBeenCalled();
    });

    it('should execute query without parameters', async () => {
      const queryWithoutParams = {
        ...mockQueryExecuteDto,
        parameters: [],
        query: 'SELECT COUNT(*) FROM users',
      };

      const result = await service.executeQuery(queryWithoutParams, 'user123');

      expect(mockKnex.raw).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ? LIMIT 100');
      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should handle different parameter types', async () => {
      const queryWithDifferentParams = {
        ...mockQueryExecuteDto,
        parameters: [
          { name: 'param1', value: '123', type: 'number' },
          { name: 'param2', value: '2023-01-01', type: 'date' },
          { name: 'param3', value: 'test string', type: 'string' },
        ],
      };

      await service.executeQuery(queryWithDifferentParams, 'user123');

      expect(mockKnex.raw).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ? LIMIT 100', [
        123,
        new Date('2023-01-01'),
        'test string',
      ]);
    });

    it('should reject invalid SQL queries', async () => {
      sqlValidationService.validateQuery.mockReturnValue({
        isValid: false,
        errors: ['DROP statement not allowed'],
        warnings: [],
        riskLevel: 'HIGH',
      });
      sqlValidationService.formatValidationError.mockReturnValue('DROP statement not allowed');

      await expect(
        service.executeQuery({ ...mockQueryExecuteDto, query: 'DROP TABLE users' }, 'user123'),
      ).rejects.toThrow(ForbiddenException);

      expect(logger.warn).toHaveBeenCalledWith(
        'SQL validation failed',
        'ConnectionService',
        expect.objectContaining({
          userId: 'user123',
          riskLevel: 'HIGH',
        }),
      );
    });

    it('should handle PostgreSQL result format', async () => {
      // PostgreSQL 결과 형식 모킹
      mockKnex.client.config.client = 'pg';
      mockKnex.raw.mockResolvedValue({
        rows: [{ id: 1, name: 'Test User' }],
        fields: [{ name: 'id' }, { name: 'name' }],
      });

      const result = await service.executeQuery(mockQueryExecuteDto, 'user123');

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.datas).toEqual([{ id: 1, name: 'Test User' }]);
      expect(result.fields).toHaveLength(2);
    });

    it('should handle BigQuery result format', async () => {
      // BigQuery 결과 형식 모킹
      const BigQueryClient: any = function () {};
      BigQueryClient.prototype.name = 'BigQueryClient';
      mockKnex.client.config.client = BigQueryClient;
      mockKnex.raw.mockResolvedValue([{ id: 1, name: 'Test User' }]);

      const result = await service.executeQuery(mockQueryExecuteDto, 'user123');

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.datas).toEqual([{ id: 1, name: 'Test User' }]);
    });

    it('should handle Snowflake result format', async () => {
      // Snowflake 결과 형식 모킹
      const SnowflakeDialect: any = function () {};
      SnowflakeDialect.prototype.name = 'SnowflakeDialect';
      mockKnex.client.config.client = SnowflakeDialect;
      mockKnex.raw.mockResolvedValue({
        rows: [{ ID: 1, NAME: 'Test User' }],
      });

      const result = await service.executeQuery(mockQueryExecuteDto, 'user123');

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.datas).toEqual([{ ID: 1, NAME: 'Test User' }]);
    });

    it('should handle query execution error', async () => {
      const sqlError = new Error('Table not found') as any;
      sqlError.sqlMessage = 'Table "users" doesn\'t exist';
      mockKnex.raw.mockRejectedValue(sqlError);

      const result = await service.executeQuery(mockQueryExecuteDto, 'user123');

      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(result.message).toBe('Table "users" doesn\'t exist');
      expect(queryCollector.collect).toHaveBeenCalledWith(
        expect.any(String),
        'database-1-error',
        ['1'],
        expect.any(Number),
      );
    });

    it('should handle slow query monitoring', async () => {
      // 슬로우 쿼리 시뮬레이션 (1초 이상)
      mockKnex.raw.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve([[{ id: 1, name: 'Test User' }], [{ name: 'id', columnType: 3 }]]);
          }, 1100); // 1.1초 지연
        });
      });

      await service.executeQuery(mockQueryExecuteDto, 'user123');

      // 비동기 슬로우 쿼리 처리를 위한 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(logger.warn).toHaveBeenCalledWith(
        'Slow query detected',
        'ConnectionService',
        expect.objectContaining({
          databaseId: 1,
          executionTime: expect.any(Number),
        }),
      );
    });

    it('should extract request metadata correctly', async () => {
      mockRequest.get.mockImplementation(header => {
        if (header === 'User-Agent') return 'Mozilla/5.0 Test Browser';
        if (header === 'X-Forwarded-For') return '192.168.1.100,127.0.0.1';
        if (header === 'X-Request-ID') return 'req-12345';
        return null;
      });

      await service.executeQuery(mockQueryExecuteDto, 'user123');

      expect(mockRequest.get).toHaveBeenCalledWith('User-Agent');
      expect(mockRequest.get).toHaveBeenCalledWith('X-Forwarded-For');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty query results', async () => {
      sqlValidationService.validateQuery.mockReturnValue({
        isValid: true,
        sanitizedQuery: 'SELECT * FROM empty_table',
        errors: [],
        warnings: [],
        riskLevel: 'LOW',
      });
      databaseRepository.findOne.mockResolvedValue(mockDatabase);
      mockKnex.raw.mockResolvedValue([[], []]);

      const result = await service.executeQuery(
        { ...mockQueryExecuteDto, query: 'SELECT * FROM empty_table' },
        'user123',
      );

      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.datas).toEqual([]);
      expect(result.fields).toEqual([]);
    });

    it('should handle null database connection configuration', async () => {
      const nullConfigDatabase = {
        ...mockDatabase,
        connectionConfig: null,
      };
      databaseRepository.findOne.mockResolvedValue(nullConfigDatabase);

      await expect(service.getKnex(1)).rejects.toThrow();
    });

    it('should handle special characters in query parameters', async () => {
      const specialCharQuery = {
        ...mockQueryExecuteDto,
        query: 'SELECT * FROM users WHERE name LIKE ?',
        parameters: [{ name: 'company', value: "O'Reilly & Sons", type: 'string' }],
      };

      sqlValidationService.validateQuery.mockReturnValue({
        isValid: true,
        sanitizedQuery: 'SELECT * FROM users WHERE name LIKE ? LIMIT 100',
        errors: [],
        warnings: [],
        riskLevel: 'LOW',
      });
      databaseRepository.findOne.mockResolvedValue(mockDatabase);
      mockKnex.raw.mockResolvedValue([[], []]);

      const result = await service.executeQuery(specialCharQuery, 'user123');

      expect(mockKnex.raw).toHaveBeenCalledWith('SELECT * FROM users WHERE name LIKE ? LIMIT 100', [
        "O'Reilly & Sons",
      ]);
      expect(result.status).toBe(ResponseStatus.SUCCESS);
    });

    it('should handle concurrent connection operations', async () => {
      const knexConfig = { client: 'mysql2', connection: {} };

      // 동시에 같은 ID로 연결 추가 시도
      const promises = Array.from({ length: 5 }, () => {
        return Promise.resolve(service.addKnex(1, knexConfig));
      });

      await Promise.all(promises);

      // 연결이 한 번만 생성되어야 함
      expect(knexConnections.size).toBe(1);
      expect(knexConnections.has(1)).toBe(true);
    });

    it('should handle request metadata extraction when request is undefined', async () => {
      // REQUEST 주입을 null로 설정하는 새로운 모듈 생성
      const moduleWithNullRequest: TestingModule = await Test.createTestingModule({
        providers: [
          ConnectionService,
          {
            provide: getRepositoryTokenFor(Database),
            useValue: createMockRepository(),
          },
          {
            provide: CustomLoggerService,
            useValue: createMockService(['info', 'warn', 'error', 'debug']),
          },
          {
            provide: SqlValidationService,
            useValue: createMockService(['validateQuery', 'formatValidationError']),
          },
          {
            provide: QueryAnalyzerService,
            useValue: createMockService(['analyzeQuery']),
          },
          {
            provide: QueryCollector,
            useValue: createMockService(['collect']),
          },
          {
            provide: SlowQueryMonitorService,
            useValue: createMockService(['logSlowQuery']),
          },
          {
            provide: REQUEST,
            useValue: null,
          },
        ],
      }).compile();

      const serviceWithNullRequest =
        moduleWithNullRequest.get<ConnectionService>(ConnectionService);

      // private 메서드 테스트를 위해 타입 캐스팅
      const metadata = (serviceWithNullRequest as any).extractRequestMetadata('user123');

      expect(metadata.clientIp).toBe('unknown');
      expect(metadata.requestPath).toBe('/api/unknown');
      expect(metadata.httpMethod).toBe('UNKNOWN');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full database operation lifecycle', async () => {
      // 1. Test connection
      mockKnex.raw.mockResolvedValue(['connection test']);
      const connectionResult = await service.testConnection(mockCreateDatabaseDto);
      expect(connectionResult.status).toBe(ResponseStatus.SUCCESS);

      // 2. Add to pool
      const knexConfig = {
        client: 'mysql2',
        connection: mockCreateDatabaseDto.connectionConfig,
      };

      // Mock DatabaseOptimizerFactory for addKnex
      databaseOptimizerFactory.getOptimizedConnectionConfig.mockReturnValue({
        pool: { min: 2, max: 10 },
      });
      databaseOptimizerFactory.isSupported.mockReturnValue(true);
      databaseOptimizerFactory.getOptimizationStats.mockReturnValue({
        totalOptimized: 1,
        byType: { mysql2: 1 },
      });

      service.addKnex(1, knexConfig);
      expect(service.hasKnex(1)).toBe(true);

      // 3. Execute query
      sqlValidationService.validateQuery.mockReturnValue({
        isValid: true,
        sanitizedQuery: 'SELECT * FROM users LIMIT 100',
        errors: [],
        warnings: [],
        riskLevel: 'LOW',
      });
      databaseRepository.findOne.mockResolvedValue(mockDatabase);
      mockKnex.raw.mockResolvedValue([
        [{ id: 1, name: 'Test User' }],
        [{ name: 'id', columnType: 3 }],
      ]);

      const queryResult = await service.executeQuery(
        { ...mockQueryExecuteDto, query: 'SELECT * FROM users' },
        'user123',
      );
      expect(queryResult.status).toBe(ResponseStatus.SUCCESS);

      // 4. Clean up
      await service.removeKnex(1);
      expect(service.hasKnex(1)).toBe(false);
    });

    it('should handle multiple database connections simultaneously', async () => {
      const databases = [
        { id: 1, engine: 'mysql2' },
        { id: 2, engine: 'pg' },
        { id: 3, engine: 'sqlite3' },
      ];

      // Mock DatabaseOptimizerFactory for multiple connections
      databaseOptimizerFactory.getOptimizedConnectionConfig.mockReturnValue({
        pool: { min: 2, max: 10 },
      });
      databaseOptimizerFactory.isSupported.mockReturnValue(true);
      databaseOptimizerFactory.getOptimizationStats.mockReturnValue({
        totalOptimized: 1,
        byType: { mysql2: 1 },
      });

      // 여러 데이터베이스 연결 추가
      databases.forEach(db => {
        const config = {
          client: db.engine,
          connection: { host: 'localhost' },
        };
        service.addKnex(db.id, config);
      });

      // 모든 연결이 존재하는지 확인
      databases.forEach(db => {
        expect(service.hasKnex(db.id)).toBe(true);
      });

      // 모든 연결 제거
      await Promise.all(databases.map(db => service.removeKnex(db.id)));

      // 모든 연결이 제거되었는지 확인
      databases.forEach(db => {
        expect(service.hasKnex(db.id)).toBe(false);
      });
    });
  });
});
