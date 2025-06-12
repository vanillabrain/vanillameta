import { Test, TestingModule } from '@nestjs/testing';
import { QueryAnalyzerService } from './query-analyzer.service';
import { Connection, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Database } from '../../database/entities/database.entity';

describe('QueryAnalyzerService', () => {
  let service: QueryAnalyzerService;
  let mockConnection: Partial<Connection>;
  let mockDatabaseRepository: Partial<Repository<Database>>;

  beforeEach(async () => {
    // Mock QueryRunner
    const mockQueryRunner = {
      query: jest.fn(),
      release: jest.fn(),
    };

    // Mock Connection
    mockConnection = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    // Mock Database Repository
    mockDatabaseRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryAnalyzerService,
        {
          provide: Connection,
          useValue: mockConnection,
        },
        {
          provide: getRepositoryToken(Database),
          useValue: mockDatabaseRepository,
        },
      ],
    }).compile();

    service = module.get<QueryAnalyzerService>(QueryAnalyzerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeQuery', () => {
    it('should analyze a simple SELECT query', async () => {
      const query = 'SELECT * FROM users WHERE id = 1';
      const mockExplainResult = [
        {
          id: 1,
          select_type: 'SIMPLE',
          table: 'users',
          type: 'const',
          possible_keys: 'PRIMARY',
          key: 'PRIMARY',
          key_len: '4',
          ref: 'const',
          rows: 1,
          Extra: null,
        },
      ];

      const runner = mockConnection.createQueryRunner();
      (runner.query as jest.Mock).mockResolvedValue(mockExplainResult);

      const result = await service.analyzeQuery(query);

      expect(result).toBeDefined();
      expect(result.query).toBe(query);
      expect(result.scanType).toBe('const');
      expect(result.indexUsed).toBe(true);
      expect(result.rowsExamined).toBe(1);
      expect(runner.release).toHaveBeenCalled();
    });

    it('should detect full table scan', async () => {
      const query = 'SELECT * FROM large_table';
      const mockExplainResult = [
        {
          id: 1,
          select_type: 'SIMPLE',
          table: 'large_table',
          type: 'ALL',
          possible_keys: null,
          key: null,
          key_len: null,
          ref: null,
          rows: 100000,
          Extra: null,
        },
      ];

      const runner = mockConnection.createQueryRunner();
      (runner.query as jest.Mock).mockResolvedValue(mockExplainResult);

      const result = await service.analyzeQuery(query);

      expect(result.scanType).toBe('ALL');
      expect(result.indexUsed).toBe(false);
      expect(result.warnings).toContain('Full table scan detected');
      expect(result.optimizationSuggestions).toContain(
        'Consider adding an index on the WHERE clause columns to avoid full table scan'
      );
    });

    it('should detect temporary table and filesort usage', async () => {
      const query = 'SELECT * FROM orders GROUP BY customer_id ORDER BY total_amount DESC';
      const mockExplainResult = [
        {
          id: 1,
          select_type: 'SIMPLE',
          table: 'orders',
          type: 'ALL',
          possible_keys: null,
          key: null,
          key_len: null,
          ref: null,
          rows: 10000,
          Extra: 'Using temporary; Using filesort',
        },
      ];

      const runner = mockConnection.createQueryRunner();
      (runner.query as jest.Mock).mockResolvedValue(mockExplainResult);

      const result = await service.analyzeQuery(query);

      expect(result.temporaryTable).toBe(true);
      expect(result.filesort).toBe(true);
      expect(result.optimizationSuggestions).toContain(
        'Query uses temporary table. Consider optimizing GROUP BY/ORDER BY clauses'
      );
      expect(result.optimizationSuggestions).toContain(
        'Query uses filesort. Consider adding index on ORDER BY columns'
      );
    });
  });

  describe('analyzeExternalQuery', () => {
    it('should analyze PostgreSQL query', async () => {
      const query = 'SELECT * FROM products WHERE category_id = 10';
      const databaseId = 1;
      
      const mockDatabase = {
        id: 1,
        engine: 'pg',
        connectionConfig: JSON.stringify({
          client: 'pg',
          connection: {
            host: 'localhost',
            user: 'test',
            password: 'test',
            database: 'testdb',
          },
        }),
      };

      (mockDatabaseRepository.findOne as jest.Mock).mockResolvedValue(mockDatabase);

      // 실제 테스트에서는 Knex 모킹이 필요
      // 여기서는 메서드가 에러 없이 실행되는지만 확인
      const result = await service.analyzeQuery(query, databaseId);
      
      expect(result).toBeDefined();
      expect(result.query).toContain(query.substring(0, 200));
    });
  });

  describe('generateOptimizationReport', () => {
    it('should generate optimization report for multiple queries', async () => {
      const queries = [
        'SELECT * FROM users WHERE status = "active"',
        'SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id',
        'SELECT COUNT(*) FROM products GROUP BY category_id',
      ];

      // Mock analyze results
      jest.spyOn(service, 'analyzeQuery').mockImplementation(async (query) => ({
        query: query.substring(0, 200),
        executionTime: query.includes('orders') ? 1500 : 500,
        scanType: query.includes('users') ? 'ALL' : 'ref',
        indexUsed: !query.includes('users'),
        temporaryTable: query.includes('GROUP BY'),
        filesort: false,
        optimizationSuggestions: query.includes('users') 
          ? ['Consider adding an index on the WHERE clause columns to avoid full table scan']
          : [],
      }));

      const report = await service.generateOptimizationReport(queries);

      expect(report.totalQueries).toBe(3);
      expect(report.slowQueries).toBe(1); // orders 쿼리만 느림
      expect(report.fullTableScans).toBe(1); // users 쿼리만 전체 스캔
      expect(report.temporaryTableUsage).toBe(1); // GROUP BY 쿼리
      expect(report.averageExecutionTime).toBe((1500 + 500 + 500) / 3);
      expect(report.optimizationOpportunities.length).toBeGreaterThan(0);
    });
  });

  describe('measureQueryPerformance', () => {
    it('should measure query execution time', async () => {
      const query = 'SELECT * FROM users LIMIT 10';
      const mockQueryRunner = mockConnection.createQueryRunner();
      
      // 실행 시간을 시뮬레이션하기 위한 지연
      (mockQueryRunner.query as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      const result = await service.measureQueryPerformance(query);

      expect(result.query).toBe(query);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(100);
    });

    it('should log slow queries', async () => {
      const query = 'SELECT * FROM large_table';
      const mockQueryRunner = mockConnection.createQueryRunner();
      
      // 느린 쿼리 시뮬레이션 (2초)
      (mockQueryRunner.query as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 2000))
      );

      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      const result = await service.measureQueryPerformance(query);

      expect(result.executionTime).toBeGreaterThan(1000);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Slow query detected',
          query: expect.any(String),
          executionTime: expect.any(Number),
          threshold: 1000,
        })
      );
    });
  });
});