import { Test, TestingModule } from '@nestjs/testing';
import { QueryAnalyzerService, QueryAnalysis } from './query-analyzer.service';
import { getRepositoryToken, getConnectionToken } from '@nestjs/typeorm';
import { Connection, QueryRunner, DataSource, Repository } from 'typeorm';
import { Database } from '../../database/entities/database.entity';

// Knex 모듈 모킹
jest.mock('knex', () => ({
  knex: jest.fn(),
}));

describe('QueryAnalyzerService', () => {
  let service: QueryAnalyzerService;
  let mockConnection: Partial<Connection>;
  let mockDataSource: Partial<DataSource>;
  let mockQueryRunner: Partial<QueryRunner>;
  let mockDatabaseRepository: Partial<Repository<Database>>;

  beforeEach(async () => {
    mockQueryRunner = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockConnection = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    mockDatabaseRepository = {
      findOne: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryAnalyzerService,
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
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
    it('should analyze internal MySQL query', async () => {
      const testQuery = 'SELECT * FROM users WHERE id = 1';
      const explainResult = [
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

      (mockQueryRunner.query as jest.Mock).mockResolvedValueOnce(explainResult);

      const result = await service.analyzeQuery(testQuery);

      expect(result).toBeDefined();
      expect(result.query).toContain('SELECT * FROM users');
      expect(result.scanType).toBe('const');
      expect(result.indexUsed).toBe(true);
      expect(result.rowsExamined).toBe(1);
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should identify full table scan', async () => {
      const testQuery = 'SELECT * FROM users';
      const explainResult = [
        {
          id: 1,
          select_type: 'SIMPLE',
          table: 'users',
          type: 'ALL',
          possible_keys: null,
          key: null,
          key_len: null,
          ref: null,
          rows: 10000,
          Extra: null,
        },
      ];

      (mockQueryRunner.query as jest.Mock).mockResolvedValueOnce(explainResult);

      const result = await service.analyzeQuery(testQuery);

      expect(result.scanType).toBe('ALL');
      expect(result.indexUsed).toBe(false);
      expect(result.warnings).toContain('Full table scan detected');
      expect(result.optimizationSuggestions).toContainEqual(
        expect.stringContaining('Consider adding an index'),
      );
    });

    it('should detect temporary table and filesort', async () => {
      const testQuery = 'SELECT * FROM users GROUP BY department ORDER BY name';
      const explainResult = [
        {
          id: 1,
          select_type: 'SIMPLE',
          table: 'users',
          type: 'ALL',
          possible_keys: null,
          key: null,
          key_len: null,
          ref: null,
          rows: 10000,
          Extra: 'Using temporary; Using filesort',
        },
      ];

      (mockQueryRunner.query as jest.Mock).mockResolvedValueOnce(explainResult);

      const result = await service.analyzeQuery(testQuery);

      expect(result.temporaryTable).toBe(true);
      expect(result.filesort).toBe(true);
      expect(result.optimizationSuggestions).toContainEqual(
        expect.stringContaining('temporary table'),
      );
      expect(result.optimizationSuggestions).toContainEqual(
        expect.stringContaining('filesort'),
      );
    });

    it('should handle query analysis errors gracefully', async () => {
      const testQuery = 'SELECT * FROM non_existent_table';
      (mockQueryRunner.query as jest.Mock).mockRejectedValueOnce(
        new Error('Table does not exist'),
      );

      const result = await service.analyzeQuery(testQuery);

      expect(result.warnings).toContainEqual(
        expect.stringContaining('Analysis failed'),
      );
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('analyzeExternalQuery', () => {
    let mockKnex: any;

    beforeEach(() => {
      mockKnex = {
        raw: jest.fn(),
        destroy: jest.fn(),
      };
      const { knex } = require('knex');
      knex.mockReturnValue(mockKnex);
    });

    it('should analyze PostgreSQL query', async () => {
      const testQuery = 'SELECT * FROM products WHERE price > 100';
      const database = {
        id: 1,
        engine: 'pg',
        connectionConfig: JSON.stringify({ host: 'localhost' }),
      };

      (mockDatabaseRepository.findOne as jest.Mock).mockResolvedValueOnce(database);

      const explainResult = {
        rows: [
          {
            'QUERY PLAN': [
              {
                'Plan': {
                  'Node Type': 'Seq Scan',
                  'Total Cost': 100,
                  'Actual Rows': 50,
                },
                'Execution Time': 10.5,
              },
            ],
          },
        ],
      };

      mockKnex.raw.mockResolvedValueOnce(explainResult);

      const result = await service['analyzeExternalQuery'](testQuery, 1);

      expect(result.scanType).toBe('Seq Scan');
      expect(result.executionTime).toBe(10.5);
      expect(result.cost).toBe(100);
      expect(result.rowsReturned).toBe(50);
      expect(result.warnings).toContain('Sequential scan detected');
      expect(mockKnex.destroy).toHaveBeenCalled();
    });

    it('should analyze MySQL external query', async () => {
      const testQuery = 'SELECT * FROM orders WHERE status = "pending"';
      const database = {
        id: 2,
        engine: 'mysql2',
        connectionConfig: JSON.stringify({ host: 'localhost' }),
      };

      (mockDatabaseRepository.findOne as jest.Mock).mockResolvedValueOnce(database);

      const explainResult = [
        [
          {
            id: 1,
            select_type: 'SIMPLE',
            table: 'orders',
            type: 'ref',
            possible_keys: 'idx_status',
            key: 'idx_status',
            key_len: '255',
            ref: 'const',
            rows: 100,
            Extra: null,
          },
        ],
      ];

      mockKnex.raw.mockResolvedValueOnce(explainResult);

      const result = await service['analyzeExternalQuery'](testQuery, 2);

      expect(result.scanType).toBe('ref');
      expect(result.indexUsed).toBe(true);
      expect(result.rowsExamined).toBe(100);
      expect(mockKnex.destroy).toHaveBeenCalled();
    });
  });

  describe('generateOptimizationReport', () => {
    it('should generate optimization report for multiple queries', async () => {
      const queries = [
        'SELECT * FROM users WHERE id = 1',
        'SELECT * FROM orders',
        'SELECT * FROM products GROUP BY category',
      ];

      // Mock analyze results
      jest.spyOn(service, 'analyzeQuery')
        .mockResolvedValueOnce({
          query: queries[0],
          scanType: 'const',
          indexUsed: true,
          executionTime: 5,
          optimizationSuggestions: [],
        })
        .mockResolvedValueOnce({
          query: queries[1],
          scanType: 'ALL',
          indexUsed: false,
          executionTime: 1500,
          optimizationSuggestions: ['Consider adding an index'],
        })
        .mockResolvedValueOnce({
          query: queries[2],
          scanType: 'ALL',
          temporaryTable: true,
          executionTime: 2000,
          optimizationSuggestions: ['Query uses temporary table'],
        });

      const report = await service.generateOptimizationReport(queries);

      expect(report.totalQueries).toBe(3);
      expect(report.slowQueries).toBe(2);
      expect(report.fullTableScans).toBe(2);
      expect(report.temporaryTableUsage).toBe(1);
      expect(report.averageExecutionTime).toBeCloseTo(1168.33, 0);
      expect(report.optimizationOpportunities).toHaveLength(2);
    });
  });

  describe('measureQueryPerformance', () => {
    it('should measure query execution time', async () => {
      const testQuery = 'SELECT COUNT(*) FROM users';
      
      // Mock Date.now() to simulate time passing
      let currentTime = 1000;
      jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
      
      (mockQueryRunner.query as jest.Mock).mockImplementation(() => {
        // Simulate query delay by advancing time
        currentTime += 100;
        return Promise.resolve([]);
      });

      const result = await service.measureQueryPerformance(testQuery);

      expect(result.executionTime).toBe(100);
      expect(result.query).toContain('SELECT COUNT(*)');
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should log slow queries', async () => {
      const testQuery = 'SELECT * FROM large_table';
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');
      
      // Mock Date.now() to simulate time passing
      let currentTime = 1000;
      jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
      
      (mockQueryRunner.query as jest.Mock).mockImplementation(() => {
        // Simulate slow query by advancing time significantly
        currentTime += 1100;
        return Promise.resolve([]);
      });

      await service.measureQueryPerformance(testQuery);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Slow query detected',
        }),
      );
    });
  });
});
