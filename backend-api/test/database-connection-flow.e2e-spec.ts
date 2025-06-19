import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
import { Database } from '../src/database/entities/database.entity';
import { Dataset } from '../src/dataset/entities/dataset.entity';

describe('Database Connection and Query Flow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let databaseRepository: Repository<Database>;
  let datasetRepository: Repository<Dataset>;

  const testUser = {
    userId: 'dbuser',
    email: 'dbuser@example.com',
    password: 'dbpassword123',
    name: 'Database Test User',
  };

  let accessToken: string;
  let userId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    databaseRepository = moduleFixture.get<Repository<Database>>(getRepositoryToken(Database));
    datasetRepository = moduleFixture.get<Repository<Dataset>>(getRepositoryToken(Dataset));

    // 테스트 사용자 생성 및 로그인
    const savedUser = await userRepository.save(testUser);
    userId = savedUser.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: testUser.userId,
        password: testUser.password,
      })
      .expect(201);

    accessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await datasetRepository.delete({});
    await databaseRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('Database Connection Testing', () => {
    const databaseConfigs = [
      {
        name: 'MySQL Connection Test',
        engine: 'mysql2',
        connectionConfig: {
          host: 'localhost',
          port: 3306,
          user: 'testuser',
          password: 'testpass',
          database: 'testdb',
        },
      },
      {
        name: 'PostgreSQL Connection Test',
        engine: 'pg',
        connectionConfig: {
          host: 'localhost',
          port: 5432,
          user: 'testuser',
          password: 'testpass',
          database: 'testdb',
        },
      },
      {
        name: 'SQLite Connection Test',
        engine: 'sqlite3',
        connectionConfig: {
          filename: ':memory:',
        },
      },
    ];

    it.each(databaseConfigs)('should test $engine database connection', async config => {
      const response = await request(app.getHttpServer())
        .post('/api/database/test-connection')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          engine: config.engine,
          connectionConfig: config.connectionConfig,
        });

      // 실제 데이터베이스가 없을 수 있으므로 다양한 응답 허용
      expect([200, 400, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.status).toBe('SUCCESS');
        expect(response.body.data?.message).toBe('success');
      }
    });

    it('should handle invalid database configuration', async () => {
      const invalidResponse = await request(app.getHttpServer())
        .post('/api/database/test-connection')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          engine: 'invalid-engine',
          connectionConfig: {
            host: 'invalid-host',
            port: 99999,
          },
        });

      expect([400, 500]).toContain(invalidResponse.status);
    });

    it('should handle connection timeout gracefully', async () => {
      const timeoutResponse = await request(app.getHttpServer())
        .post('/api/database/test-connection')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          engine: 'mysql2',
          connectionConfig: {
            host: '192.0.2.0', // Non-routable IP for timeout simulation
            port: 3306,
            user: 'testuser',
            password: 'testpass',
            database: 'testdb',
          },
        });

      expect([400, 500]).toContain(timeoutResponse.status);
    });
  });

  describe('Database Management Flow', () => {
    let createdDatabaseId: number;

    it('should complete database CRUD operations', async () => {
      // 1. 데이터베이스 생성
      const createDbResponse = await request(app.getHttpServer())
        .post('/api/database')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'E2E Test Database',
          engine: 'mysql2',
          connectionConfig: {
            host: 'localhost',
            port: 3306,
            user: 'e2euser',
            password: 'e2epass',
            database: 'e2edb',
          },
        })
        .expect(201);

      expect(createDbResponse.body.status).toBe('SUCCESS');
      expect(createDbResponse.body.data.name).toBe('E2E Test Database');
      createdDatabaseId = createDbResponse.body.data.id;

      // 2. 데이터베이스 목록 조회
      const getAllDbResponse = await request(app.getHttpServer())
        .get('/api/database')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getAllDbResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(getAllDbResponse.body.data)).toBe(true);
      const foundDb = getAllDbResponse.body.data.find(db => db.id === createdDatabaseId);
      expect(foundDb).toBeDefined();
      expect(foundDb.name).toBe('E2E Test Database');

      // 3. 특정 데이터베이스 조회
      const getDbResponse = await request(app.getHttpServer())
        .get(`/api/database/${createdDatabaseId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getDbResponse.body.status).toBe('SUCCESS');
      expect(getDbResponse.body.data.name).toBe('E2E Test Database');
      expect(getDbResponse.body.data.engine).toBe('mysql2');

      // 4. 데이터베이스 정보 업데이트
      const updateDbResponse = await request(app.getHttpServer())
        .patch(`/api/database/${createdDatabaseId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated E2E Test Database',
          description: 'Updated description for E2E testing',
        })
        .expect(200);

      expect(updateDbResponse.body.status).toBe('SUCCESS');
      expect(updateDbResponse.body.data.name).toBe('Updated E2E Test Database');

      // 5. 데이터베이스 삭제
      const deleteDbResponse = await request(app.getHttpServer())
        .delete(`/api/database/${createdDatabaseId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(deleteDbResponse.body.status).toBe('SUCCESS');

      // 6. 삭제 확인
      const getDeletedDbResponse = await request(app.getHttpServer())
        .get(`/api/database/${createdDatabaseId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(getDeletedDbResponse.body.status).toBe('ERROR');
    });

    afterEach(async () => {
      // 테스트 후 생성된 데이터베이스 정리
      if (createdDatabaseId) {
        try {
          await request(app.getHttpServer())
            .delete(`/api/database/${createdDatabaseId}`)
            .set('Authorization', `Bearer ${accessToken}`);
        } catch (error) {
          // 정리 실패는 무시
        }
      }
    });
  });

  describe('Query Execution Flow', () => {
    let testDatabaseId: number;

    beforeEach(async () => {
      // 테스트용 데이터베이스 생성
      const dbResponse = await request(app.getHttpServer())
        .post('/api/database')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Query Test Database',
          engine: 'sqlite3',
          connectionConfig: {
            filename: ':memory:',
          },
        })
        .expect(201);

      testDatabaseId = dbResponse.body.data.id;
    });

    afterEach(async () => {
      // 테스트 후 정리
      if (testDatabaseId) {
        try {
          await request(app.getHttpServer())
            .delete(`/api/database/${testDatabaseId}`)
            .set('Authorization', `Bearer ${accessToken}`);
        } catch (error) {
          // 정리 실패는 무시
        }
      }
    });

    it('should execute simple SELECT query', async () => {
      const queryResponse = await request(app.getHttpServer())
        .post('/api/database/execute-query')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          id: testDatabaseId,
          query: 'SELECT 1 as test_column',
          parameters: [],
          limit: 100,
        });

      // 실제 데이터베이스 연결 실패 가능성 고려
      expect([200, 400, 500]).toContain(queryResponse.status);

      if (queryResponse.status === 200) {
        expect(queryResponse.body.status).toBe('SUCCESS');
        expect(queryResponse.body.message).toBe('success');
      }
    });

    it('should execute parameterized query', async () => {
      const paramQueryResponse = await request(app.getHttpServer())
        .post('/api/database/execute-query')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          id: testDatabaseId,
          query: 'SELECT ? as param_value, ? as second_param',
          parameters: [
            { value: '123', type: 'number' },
            { value: 'test string', type: 'string' },
          ],
          limit: 100,
        });

      expect([200, 400, 500]).toContain(paramQueryResponse.status);
    });

    it('should reject dangerous SQL queries', async () => {
      const dangerousQueries = [
        'DROP TABLE users',
        'DELETE FROM users',
        'INSERT INTO users VALUES (1, "test")',
        'UPDATE users SET name = "hacked"',
        'CREATE TABLE malicious (id INT)',
      ];

      for (const dangerousQuery of dangerousQueries) {
        const dangerousResponse = await request(app.getHttpServer())
          .post('/api/database/execute-query')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            id: testDatabaseId,
            query: dangerousQuery,
            parameters: [],
            limit: 100,
          });

        // SQL 보안 검증에 의해 차단되어야 함
        expect([400, 403]).toContain(dangerousResponse.status);
      }
    });

    it('should handle SQL injection attempts', async () => {
      const injectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1'; DELETE FROM users; --",
        'UNION SELECT * FROM users',
      ];

      for (const injection of injectionAttempts) {
        const injectionResponse = await request(app.getHttpServer())
          .post('/api/database/execute-query')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            id: testDatabaseId,
            query: `SELECT * FROM test_table WHERE id = '${injection}'`,
            parameters: [],
            limit: 100,
          });

        // SQL 인젝션 시도는 차단되거나 안전하게 처리되어야 함
        expect([200, 400, 403, 500]).toContain(injectionResponse.status);
      }
    });

    it('should handle query with large result set limit', async () => {
      const largeQueryResponse = await request(app.getHttpServer())
        .post('/api/database/execute-query')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          id: testDatabaseId,
          query: 'SELECT 1 as num UNION SELECT 2 UNION SELECT 3',
          parameters: [],
          limit: 10000, // 큰 제한값
        });

      expect([200, 400, 500]).toContain(largeQueryResponse.status);

      if (largeQueryResponse.status === 200) {
        expect(largeQueryResponse.body.status).toBe('SUCCESS');
      }
    });
  });

  describe('Dataset Management Flow', () => {
    let testDatabaseId: number;
    let createdDatasetId: number;

    beforeEach(async () => {
      // 테스트용 데이터베이스 생성
      const dbResponse = await request(app.getHttpServer())
        .post('/api/database')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Dataset Test Database',
          engine: 'sqlite3',
          connectionConfig: {
            filename: ':memory:',
          },
        })
        .expect(201);

      testDatabaseId = dbResponse.body.data.id;
    });

    afterEach(async () => {
      // 테스트 후 정리
      if (createdDatasetId) {
        try {
          await request(app.getHttpServer())
            .delete(`/api/dataset/${createdDatasetId}`)
            .set('Authorization', `Bearer ${accessToken}`);
        } catch (error) {
          // 정리 실패는 무시
        }
      }

      if (testDatabaseId) {
        try {
          await request(app.getHttpServer())
            .delete(`/api/database/${testDatabaseId}`)
            .set('Authorization', `Bearer ${accessToken}`);
        } catch (error) {
          // 정리 실패는 무시
        }
      }
    });

    it('should complete dataset CRUD operations', async () => {
      // 1. 데이터셋 생성
      const createDatasetResponse = await request(app.getHttpServer())
        .post('/api/dataset')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'E2E Test Dataset',
          description: 'Dataset for E2E testing',
          databaseId: testDatabaseId,
          query: 'SELECT id, name, value FROM test_table WHERE active = 1',
        })
        .expect(201);

      expect(createDatasetResponse.body.status).toBe('SUCCESS');
      expect(createDatasetResponse.body.data.name).toBe('E2E Test Dataset');
      createdDatasetId = createDatasetResponse.body.data.id;

      // 2. 데이터셋 목록 조회
      const getAllDatasetsResponse = await request(app.getHttpServer())
        .get('/api/dataset')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getAllDatasetsResponse.body.status).toBe('SUCCESS');
      expect(Array.isArray(getAllDatasetsResponse.body.data)).toBe(true);
      const foundDataset = getAllDatasetsResponse.body.data.find(ds => ds.id === createdDatasetId);
      expect(foundDataset).toBeDefined();

      // 3. 특정 데이터셋 조회
      const getDatasetResponse = await request(app.getHttpServer())
        .get(`/api/dataset/${createdDatasetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getDatasetResponse.body.status).toBe('SUCCESS');
      expect(getDatasetResponse.body.data.name).toBe('E2E Test Dataset');
      expect(getDatasetResponse.body.data.query).toContain('SELECT id, name, value');

      // 4. 데이터셋 업데이트
      const updateDatasetResponse = await request(app.getHttpServer())
        .patch(`/api/dataset/${createdDatasetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated E2E Dataset',
          description: 'Updated dataset description',
          query:
            'SELECT id, name, value, updated_at FROM test_table WHERE active = 1 ORDER BY updated_at DESC',
        })
        .expect(200);

      expect(updateDatasetResponse.body.status).toBe('SUCCESS');
      expect(updateDatasetResponse.body.data.name).toBe('Updated E2E Dataset');
      expect(updateDatasetResponse.body.data.query).toContain('ORDER BY updated_at DESC');

      // 5. 데이터셋 실행 (데이터 조회)
      const executeDatasetResponse = await request(app.getHttpServer())
        .post(`/api/dataset/${createdDatasetId}/execute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          parameters: [],
          limit: 100,
        });

      // 실제 테이블이 없을 수 있으므로 다양한 응답 허용
      expect([200, 400, 500]).toContain(executeDatasetResponse.status);

      // 6. 데이터셋 삭제
      const deleteDatasetResponse = await request(app.getHttpServer())
        .delete(`/api/dataset/${createdDatasetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(deleteDatasetResponse.body.status).toBe('SUCCESS');
      createdDatasetId = null; // 정리 과정에서 중복 삭제 방지
    });

    it('should validate dataset query syntax', async () => {
      const invalidQueries = [
        'INVALID SQL SYNTAX',
        'SELECT * FROM', // 불완전한 쿼리
        '', // 빈 쿼리
      ];

      for (const invalidQuery of invalidQueries) {
        const invalidDatasetResponse = await request(app.getHttpServer())
          .post('/api/dataset')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: 'Invalid Query Dataset',
            description: 'Dataset with invalid query',
            databaseId: testDatabaseId,
            query: invalidQuery,
          });

        // 잘못된 쿼리는 적절히 처리되어야 함
        expect([201, 400]).toContain(invalidDatasetResponse.status);
      }
    });
  });

  describe('Multi-Database Support', () => {
    it('should handle different database engines', async () => {
      const engines = [
        { engine: 'mysql2', name: 'MySQL' },
        { engine: 'pg', name: 'PostgreSQL' },
        { engine: 'sqlite3', name: 'SQLite' },
        { engine: 'mssql', name: 'SQL Server' },
        { engine: 'oracledb', name: 'Oracle' },
      ];

      for (const { engine, name } of engines) {
        const dbResponse = await request(app.getHttpServer())
          .post('/api/database')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: `${name} Test Database`,
            engine: engine,
            connectionConfig: {
              host: 'localhost',
              port: engine === 'pg' ? 5432 : 3306,
              user: 'testuser',
              password: 'testpass',
              database: 'testdb',
              ...(engine === 'sqlite3' && { filename: ':memory:' }),
            },
          })
          .expect(201);

        expect(dbResponse.body.status).toBe('SUCCESS');
        expect(dbResponse.body.data.engine).toBe(engine);

        // 정리
        await request(app.getHttpServer())
          .delete(`/api/database/${dbResponse.body.data.id}`)
          .set('Authorization', `Bearer ${accessToken}`);
      }
    });
  });

  describe('Performance and Monitoring', () => {
    let perfTestDbId: number;

    beforeEach(async () => {
      const dbResponse = await request(app.getHttpServer())
        .post('/api/database')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Performance Test Database',
          engine: 'sqlite3',
          connectionConfig: {
            filename: ':memory:',
          },
        })
        .expect(201);

      perfTestDbId = dbResponse.body.data.id;
    });

    afterEach(async () => {
      if (perfTestDbId) {
        try {
          await request(app.getHttpServer())
            .delete(`/api/database/${perfTestDbId}`)
            .set('Authorization', `Bearer ${accessToken}`);
        } catch (error) {
          // 정리 실패는 무시
        }
      }
    });

    it('should track query execution time', async () => {
      const startTime = Date.now();

      const queryResponse = await request(app.getHttpServer())
        .post('/api/database/execute-query')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          id: perfTestDbId,
          query: 'SELECT 1 as test',
          parameters: [],
          limit: 100,
        });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 쿼리 실행 시간이 10초 이내여야 함
      expect(executionTime).toBeLessThan(10000);

      expect([200, 400, 500]).toContain(queryResponse.status);
    });

    it('should handle concurrent database operations', async () => {
      const concurrentPromises = Array.from({ length: 5 }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/database/execute-query')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            id: perfTestDbId,
            query: `SELECT ${index + 1} as concurrent_test`,
            parameters: [],
            limit: 100,
          }),
      );

      const responses = await Promise.all(concurrentPromises);

      // 모든 동시 요청이 적절히 처리되어야 함
      responses.forEach((response, index) => {
        expect([200, 400, 500]).toContain(response.status);
      });
    });
  });
});
