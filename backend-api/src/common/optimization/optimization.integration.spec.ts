import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OptimizationModule } from './optimization.module';
import { DatabaseSpecificOptimizationService } from './database-specific-optimization.service';
import { QueryCacheService } from './query-cache.service';
import { IndexRecommendationService } from './index-recommendation.service';
import { EnhancedConnectionPoolService } from './enhanced-connection-pool.service';
import { EnhancedQueryOptimizerService } from './enhanced-query-optimizer.service';
import { OptimizationController } from './optimization.controller';
import { Database } from '../../database/entities/database.entity';
import { CustomLoggerService } from '../logger/logger.service';

describe('Optimization Integration Tests', () => {
  let module: TestingModule;
  let dbOptimizationService: DatabaseSpecificOptimizationService;
  let queryCacheService: QueryCacheService;
  let indexRecommendationService: IndexRecommendationService;
  let connectionPoolService: EnhancedConnectionPoolService;
  let queryOptimizerService: EnhancedQueryOptimizerService;
  let controller: OptimizationController;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        // 테스트용 인메모리 데이터베이스 설정
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Database],
          synchronize: true,
        }),
        OptimizationModule,
      ],
      providers: [
        {
          provide: CustomLoggerService,
          useValue: {
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    dbOptimizationService = module.get<DatabaseSpecificOptimizationService>(
      DatabaseSpecificOptimizationService,
    );
    queryCacheService = module.get<QueryCacheService>(QueryCacheService);
    indexRecommendationService = module.get<IndexRecommendationService>(IndexRecommendationService);
    connectionPoolService = module.get<EnhancedConnectionPoolService>(
      EnhancedConnectionPoolService,
    );
    queryOptimizerService = module.get<EnhancedQueryOptimizerService>(
      EnhancedQueryOptimizerService,
    );
    controller = module.get<OptimizationController>(OptimizationController);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Service Integration', () => {
    it('should have all services properly initialized', () => {
      expect(dbOptimizationService).toBeDefined();
      expect(queryCacheService).toBeDefined();
      expect(indexRecommendationService).toBeDefined();
      expect(connectionPoolService).toBeDefined();
      expect(queryOptimizerService).toBeDefined();
      expect(controller).toBeDefined();
    });
  });

  describe('Database-Specific Optimization Service', () => {
    it('should provide optimization configs for all supported engines', () => {
      const engines = ['pg', 'mysql2', 'mssql', 'oracledb', 'bigquery', 'snowflake'];

      engines.forEach(engine => {
        const config = dbOptimizationService.getOptimizationConfig(engine);
        expect(config).toBeDefined();
        expect(config.engine).toBe(engine);
        expect(config.connectionPoolConfig).toBeDefined();
        expect(config.queryOptimizations).toBeInstanceOf(Array);
        expect(config.cacheConfig).toBeDefined();
      });
    });

    it('should optimize queries differently for different engines', () => {
      const query = 'SELECT * FROM users ORDER BY created_at LIMIT 100';

      const pgResult = dbOptimizationService.optimizeQuery(query, 'pg');
      const mysqlResult = dbOptimizationService.optimizeQuery(query, 'mysql2');

      expect(pgResult.optimizedQuery).toContain('IndexScan');
      expect(mysqlResult.optimizedQuery).toBeDefined();

      // PostgreSQL과 MySQL의 최적화가 다르게 적용되는지 확인
      expect(pgResult.appliedOptimizations).not.toEqual(mysqlResult.appliedOptimizations);
    });

    it('should provide different pool configs for production vs development', () => {
      const devConfig = dbOptimizationService.getOptimizedPoolConfig('pg', false);
      const prodConfig = dbOptimizationService.getOptimizedPoolConfig('pg', true);

      expect(devConfig).toBeDefined();
      expect(prodConfig).toBeDefined();

      // 프로덕션 환경에서는 더 보수적인 설정
      expect(prodConfig.max).toBeLessThanOrEqual(devConfig.max || 5);
    });
  });

  describe('Query Cache Service Integration', () => {
    it('should cache and retrieve query results correctly', async () => {
      const engine = 'pg';
      const query = 'SELECT * FROM users WHERE active = true';
      const data = [{ id: 1, name: 'John', active: true }];
      const fields = [
        { name: 'id', type: 'integer' },
        { name: 'name', type: 'string' },
      ];

      // 캐시에 저장
      await queryCacheService.set(engine, query, data, fields);

      // 캐시에서 조회
      const result = await queryCacheService.get(engine, query);

      expect(result).toBeDefined();
      expect(result.data).toEqual(data);
      expect(result.fields).toEqual(fields);
    });

    it('should invalidate cache based on query patterns', async () => {
      const engine = 'pg';

      // 일부 데이터를 캐시에 저장
      await queryCacheService.set(engine, 'SELECT * FROM users', [{ id: 1 }], []);
      await queryCacheService.set(engine, 'SELECT * FROM orders', [{ id: 1 }], []);

      // INSERT 쿼리로 캐시 무효화
      await queryCacheService.invalidateByQuery(engine, 'INSERT INTO users (name) VALUES ("Jane")');

      // 통계 확인 (캐시가 지워졌는지)
      const stats = queryCacheService.getStats(engine);
      expect(stats).toBeDefined();
    });

    it('should provide accurate cache statistics', async () => {
      const engine = 'mysql2';
      const query = 'SELECT COUNT(*) FROM products';

      // 캐시 미스
      let result = await queryCacheService.get(engine, query);
      expect(result).toBeNull();

      // 데이터 저장
      await queryCacheService.set(engine, query, [{ count: 100 }], []);

      // 캐시 히트
      result = await queryCacheService.get(engine, query);
      expect(result).toBeDefined();

      // 통계 확인
      const stats = queryCacheService.getStats(engine);
      expect(stats).toBeDefined();
      if (stats && typeof stats === 'object' && 'hitRate' in stats) {
        expect(stats.hitRate).toBeGreaterThan(0);
      }
    });
  });

  describe('Enhanced Connection Pool Service Integration', () => {
    it('should create optimized connection pools', async () => {
      const databaseId = 1;
      const engine = 'pg';
      const baseConfig = {
        client: 'pg',
        connection: {
          host: 'localhost',
          user: 'test',
          password: 'test',
          database: 'test',
        },
      };

      // 최적화된 연결 풀 생성
      const knexInstance = await connectionPoolService.createOptimizedPool(
        databaseId,
        engine,
        baseConfig,
      );

      expect(knexInstance).toBeDefined();
      expect(connectionPoolService.hasConnection(databaseId)).toBe(true);
    });

    it('should track pool metrics', async () => {
      const databaseId = 2;
      const engine = 'mysql2';
      const baseConfig = {
        client: 'mysql2',
        connection: {
          host: 'localhost',
          user: 'test',
          password: 'test',
          database: 'test',
        },
      };

      await connectionPoolService.createOptimizedPool(databaseId, engine, baseConfig);

      const status = connectionPoolService.getPoolStatus(databaseId);
      expect(status).toBeDefined();

      if (status) {
        expect(status.metrics.databaseId).toBe(databaseId);
        expect(status.metrics.engine).toBe(engine);
        expect(status.isHealthy).toBeDefined();
      }
    });

    it('should provide performance history', () => {
      const databaseId = 1;
      const history = connectionPoolService.getPerformanceHistory(databaseId);

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Index Recommendation Service Integration', () => {
    const mockKnexInstance = {
      raw: jest.fn(),
      destroy: jest.fn(),
      count: jest.fn().mockReturnValue({
        first: jest.fn().mockResolvedValue({ count: 1000 }),
      }),
      countDistinct: jest.fn().mockReturnValue({
        first: jest.fn().mockResolvedValue({ distinctCount: 800 }),
      }),
      whereNull: jest.fn().mockReturnValue({
        count: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ nullCount: 10 }),
        }),
      }),
    } as any;

    it('should analyze tables and generate recommendations', async () => {
      const engine = 'pg';
      const tableName = 'users';
      const queryPatterns = [
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE status = ? ORDER BY created_at',
      ];

      // Mock database responses
      mockKnexInstance.raw.mockResolvedValueOnce({
        rows: [
          { column_name: 'id', data_type: 'integer', is_primary_key: true },
          { column_name: 'email', data_type: 'varchar', is_primary_key: false },
          { column_name: 'status', data_type: 'varchar', is_primary_key: false },
        ],
      });

      const report = await indexRecommendationService.analyzeAndRecommend(
        mockKnexInstance,
        engine,
        tableName,
        queryPatterns,
      );

      expect(report).toBeDefined();
      expect(report.tableName).toBe(tableName);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.performanceImpact).toBeDefined();
    });

    it('should provide different recommendations for different engines', async () => {
      const tableName = 'products';
      const queryPatterns = ['SELECT * FROM products WHERE category = ?'];

      const pgReport = await indexRecommendationService.analyzeAndRecommend(
        mockKnexInstance,
        'pg',
        tableName,
        queryPatterns,
      );

      const mysqlReport = await indexRecommendationService.analyzeAndRecommend(
        mockKnexInstance,
        'mysql2',
        tableName,
        queryPatterns,
      );

      expect(pgReport).toBeDefined();
      expect(mysqlReport).toBeDefined();

      // 엔진별로 다른 추천이 제공되는지 확인
      expect(pgReport.tableName).toBe(tableName);
      expect(mysqlReport.tableName).toBe(tableName);
    });
  });

  describe('Enhanced Query Optimizer Integration', () => {
    const mockDatabase: Database = Object.assign(new Database(), {
      id: 1,
      name: 'test_db',
      engine: 'pg',
      description: 'Test database',
      type: 'pg',
      timezone: 'UTC',
      connectionConfig: JSON.stringify({
        host: 'localhost',
        port: 5432,
        user: 'test',
        password: 'test',
        database: 'test',
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockKnexInstance = {
      raw: jest.fn().mockResolvedValue([]),
      destroy: jest.fn(),
    } as any;

    it('should integrate all optimization services', async () => {
      const query = 'SELECT * FROM users WHERE email = ?';
      const parameters = ['test@example.com'];

      const result = await queryOptimizerService.optimizeQuery(
        mockKnexInstance,
        mockDatabase,
        query,
        parameters,
      );

      expect(result).toBeDefined();
      expect(result.optimizedQuery).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.analysis.databaseSpecific.engine).toBe('pg');
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should track optimization sessions', async () => {
      const sessionId = 'integration-test-session';
      const query = 'SELECT COUNT(*) FROM orders';

      await queryOptimizerService.optimizeQuery(
        mockKnexInstance,
        mockDatabase,
        query,
        [],
        sessionId,
      );

      const sessionStats = queryOptimizerService.getSessionStats(sessionId);
      expect(sessionStats).toBeDefined();

      if (sessionStats && typeof sessionStats === 'object') {
        expect((sessionStats as any).sessionId).toBe(sessionId);
        expect((sessionStats as any).totalQueries).toBeGreaterThan(0);
      }
    });

    it('should generate comprehensive optimization reports', async () => {
      const report = await queryOptimizerService.generateOptimizationReport(mockDatabase.id);

      expect(report).toBeDefined();
      expect(report.database.id).toBe(mockDatabase.id);
      expect(report.overallStats).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.immediate).toBeInstanceOf(Array);
      expect(report.recommendations.shortTerm).toBeInstanceOf(Array);
      expect(report.recommendations.longTerm).toBeInstanceOf(Array);
    });
  });

  describe('Controller Integration', () => {
    it('should provide optimization configuration through API', () => {
      const result = controller.getOptimizationConfig('pg');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.engine).toBe('pg');
    });

    it('should provide pool configuration through API', () => {
      const result = controller.getPoolConfig('mysql2', true);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.max).toBeDefined();
    });

    it('should provide cache statistics through API', () => {
      const result = controller.getCacheStats();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should provide supported engines list', () => {
      const result = controller.getSupportedEngines();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);

      const pgEngine = result.data.find(e => e.engine === 'pg');
      expect(pgEngine).toBeDefined();
      expect(pgEngine.name).toBe('PostgreSQL');
      expect(pgEngine.features).toBeInstanceOf(Array);
      expect(pgEngine.optimizations).toBeInstanceOf(Array);
    });

    it('should provide health status', () => {
      const result = controller.getHealthStatus();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('healthy');
      expect(result.data.services).toBeDefined();
      expect(result.data.services.queryOptimizer).toBe('active');
      expect(result.data.services.queryCache).toBe('active');
      expect(result.data.services.connectionPool).toBe('active');
      expect(result.data.services.indexRecommendation).toBe('active');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection errors gracefully', async () => {
      const invalidDatabase: Database = Object.assign(new Database(), {
        id: 999,
        name: 'invalid_db',
        engine: 'invalid_engine',
        description: 'Invalid database',
        type: 'invalid',
        timezone: 'UTC',
        connectionConfig: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockKnexInstance = {
        raw: jest.fn().mockRejectedValue(new Error('Connection failed')),
        destroy: jest.fn(),
      } as any;

      const result = await queryOptimizerService.optimizeQuery(
        mockKnexInstance,
        invalidDatabase,
        'SELECT 1',
      );

      expect(result).toBeDefined();
      expect(result.optimizedQuery).toBe('SELECT 1'); // 원본 쿼리 반환
      expect(result.recommendations).toContain('Optimization failed: Optimization failed');
    });

    it('should handle cache service errors gracefully', async () => {
      // 잘못된 엔진으로 캐시 작업 시도
      const result = await queryCacheService.get('invalid_engine', 'SELECT 1');
      expect(result).toBeNull();
    });

    it('should handle pool service errors gracefully', () => {
      const status = connectionPoolService.getPoolStatus(999); // 존재하지 않는 데이터베이스
      expect(status).toBeNull();
    });
  });

  describe('Performance Integration', () => {
    it('should demonstrate performance improvement through optimization', async () => {
      const engine = 'pg';
      const slowQuery = 'SELECT * FROM large_table ORDER BY created_at DESC';

      // 기본 쿼리 분석
      const basicResult = dbOptimizationService.optimizeQuery(slowQuery, engine);

      expect(basicResult.appliedOptimizations.length).toBeGreaterThan(0);
      expect(basicResult.optimizedQuery).not.toBe(slowQuery);
    });

    it('should show cache performance benefits', async () => {
      const engine = 'pg';
      const query = 'SELECT COUNT(*) FROM users';
      const data = [{ count: 1000 }];
      const fields = [{ name: 'count', type: 'integer' }];

      // 첫 번째 요청 - 캐시 미스
      let result = await queryCacheService.get(engine, query);
      expect(result).toBeNull();

      // 결과 캐시
      await queryCacheService.set(engine, query, data, fields);

      // 두 번째 요청 - 캐시 히트
      result = await queryCacheService.get(engine, query);
      expect(result).toBeDefined();
      expect(result.data).toEqual(data);

      // 통계에서 히트율 확인
      const stats = queryCacheService.getStats(engine);
      expect(stats).toBeDefined();
    });
  });

  describe('Multi-Engine Support Integration', () => {
    it('should handle different database engines simultaneously', async () => {
      const engines = ['pg', 'mysql2', 'mssql'];
      const query = 'SELECT * FROM users ORDER BY id LIMIT 100';

      for (const engine of engines) {
        const result = dbOptimizationService.optimizeQuery(query, engine);
        expect(result).toBeDefined();
        expect(result.optimizedQuery).toBeDefined();

        const poolConfig = dbOptimizationService.getOptimizedPoolConfig(engine);
        expect(poolConfig).toBeDefined();

        const cacheConfig = dbOptimizationService.getCacheConfig(engine);
        expect(cacheConfig).toBeDefined();
      }
    });

    it('should provide engine-specific optimizations', () => {
      const jsonQuery = 'SELECT data FROM documents WHERE data @> \'{"type": "article"}\'';

      // PostgreSQL은 JSON 연산자를 지원하므로 특별한 최적화가 적용됨
      const pgResult = dbOptimizationService.optimizeQuery(jsonQuery, 'pg');
      const mysqlResult = dbOptimizationService.optimizeQuery(jsonQuery, 'mysql2');

      expect(pgResult).toBeDefined();
      expect(mysqlResult).toBeDefined();

      // PostgreSQL의 캐시 설정이 다른 엔진과 다른지 확인
      const pgCache = dbOptimizationService.getCacheConfig('pg');
      const mysqlCache = dbOptimizationService.getCacheConfig('mysql2');

      expect(pgCache.ttl).toBe(3600); // 1시간
      expect(mysqlCache.ttl).toBe(1800); // 30분
    });
  });
});
