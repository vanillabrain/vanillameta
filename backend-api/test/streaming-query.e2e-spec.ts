import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Dataset } from '../src/dataset/entities/dataset.entity';
import { Database } from '../src/database/entities/database.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Readable } from 'stream';

describe('Streaming Query E2E Tests', () => {
  let app: INestApplication;
  let datasetRepository: Repository<Dataset>;
  let databaseRepository: Repository<Database>;
  let authToken: string;
  let testDatabase: Database;
  let testDataset: Dataset;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    datasetRepository = moduleFixture.get<Repository<Dataset>>(getRepositoryToken(Dataset));
    databaseRepository = moduleFixture.get<Repository<Database>>(getRepositoryToken(Database));

    // 로그인하여 토큰 획득
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword',
      });

    authToken = loginResponse.body.accessToken;

    // 테스트용 데이터베이스 생성 (SQLite)
    testDatabase = await databaseRepository.save({
      name: 'Test Streaming DB',
      engine: 'sqlite3',
      type: 'sqlite',
      connectionConfig: JSON.stringify({
        client: 'sqlite3',
        connection: {
          filename: ':memory:',
        },
        useNullAsDefault: true,
      }),
    });

    // 테스트용 데이터셋 생성
    testDataset = await datasetRepository.save({
      title: 'Test Streaming Dataset',
      databaseId: testDatabase.id,
      query: 'SELECT 1 as id, "test" as name',
    });
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    if (testDataset) {
      await datasetRepository.delete(testDataset.id);
    }
    if (testDatabase) {
      await databaseRepository.delete(testDatabase.id);
    }
    await app.close();
  });

  describe('/dataset/:id/stream (GET)', () => {
    it('should stream dataset query results in NDJSON format', (done) => {
      const chunks: string[] = [];
      
      request(app.getHttpServer())
        .get(`/dataset/${testDataset.id}/stream`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect('Content-Type', /application\/x-ndjson/)
        .expect('Transfer-Encoding', 'chunked')
        .buffer(false)
        .parse((res, callback) => {
          res.on('data', (chunk) => {
            chunks.push(chunk.toString());
          });
          res.on('end', () => {
            callback(null, chunks.join(''));
          });
        })
        .end((err, res) => {
          if (err) return done(err);

          const lines = res.body.split('\n').filter(line => line.trim());
          expect(lines.length).toBeGreaterThanOrEqual(3); // fields, data, complete

          // 첫 번째 라인은 필드 정보
          const fields = JSON.parse(lines[0]);
          expect(fields.type).toBe('fields');
          expect(fields.data).toBeInstanceOf(Array);
          expect(fields.data.length).toBe(2); // id, name

          // 두 번째 라인은 데이터
          const data = JSON.parse(lines[1]);
          expect(data.type).toBe('data');
          expect(data.data).toHaveProperty('id', 1);
          expect(data.data).toHaveProperty('name', 'test');

          // 마지막 라인은 완료 정보
          const complete = JSON.parse(lines[lines.length - 1]);
          expect(complete.type).toBe('complete');
          expect(complete.rowCount).toBe(1);
          expect(complete.executionTime).toBeGreaterThan(0);

          done();
        });
    });

    it('should handle non-existent dataset', (done) => {
      request(app.getHttpServer())
        .get('/dataset/99999/stream')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.status).toBe('error');
          expect(res.body.message).toContain('Dataset with id 99999 not found');
          done();
        });
    });
  });

  describe('/database/execute/stream (POST)', () => {
    it('should stream direct query results', (done) => {
      const chunks: string[] = [];
      
      request(app.getHttpServer())
        .post('/database/execute/stream')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          id: testDatabase.id,
          query: 'SELECT 1 as num, "hello" as text UNION SELECT 2, "world"',
        })
        .expect(200)
        .expect('Content-Type', /application\/x-ndjson/)
        .buffer(false)
        .parse((res, callback) => {
          res.on('data', (chunk) => {
            chunks.push(chunk.toString());
          });
          res.on('end', () => {
            callback(null, chunks.join(''));
          });
        })
        .end((err, res) => {
          if (err) return done(err);

          const lines = res.body.split('\n').filter(line => line.trim());
          expect(lines.length).toBeGreaterThanOrEqual(4); // fields, 2 data, complete

          // 필드 정보 확인
          const fields = JSON.parse(lines[0]);
          expect(fields.type).toBe('fields');
          expect(fields.data).toBeInstanceOf(Array);

          // 데이터 확인
          const data1 = JSON.parse(lines[1]);
          expect(data1.type).toBe('data');
          expect(data1.data).toHaveProperty('num');
          expect(data1.data).toHaveProperty('text');

          const data2 = JSON.parse(lines[2]);
          expect(data2.type).toBe('data');

          // 완료 정보 확인
          const complete = JSON.parse(lines[lines.length - 1]);
          expect(complete.type).toBe('complete');
          expect(complete.rowCount).toBe(2);

          done();
        });
    });

    it('should handle SQL errors gracefully', (done) => {
      const chunks: string[] = [];
      
      request(app.getHttpServer())
        .post('/database/execute/stream')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          id: testDatabase.id,
          query: 'SELECT * FROM non_existent_table',
        })
        .buffer(false)
        .parse((res, callback) => {
          res.on('data', (chunk) => {
            chunks.push(chunk.toString());
          });
          res.on('end', () => {
            callback(null, chunks.join(''));
          });
        })
        .end((err, res) => {
          const lines = res.body.split('\n').filter(line => line.trim());
          
          // 에러 메시지 확인
          const errorLine = lines.find(line => {
            try {
              const parsed = JSON.parse(line);
              return parsed.type === 'error';
            } catch {
              return false;
            }
          });

          expect(errorLine).toBeDefined();
          const error = JSON.parse(errorLine);
          expect(error.type).toBe('error');
          expect(error.error).toBeTruthy();

          done();
        });
    });
  });

  describe('Large Data Streaming', () => {
    it('should handle large dataset streaming efficiently', (done) => {
      // 대용량 데이터 생성 쿼리 (재귀 CTE 사용)
      const largeDataQuery = `
        WITH RECURSIVE series(n) AS (
          SELECT 1
          UNION ALL
          SELECT n + 1 FROM series WHERE n < 10000
        )
        SELECT n as id, 'row_' || n as name, n * 2 as value
        FROM series
      `;

      let rowCount = 0;
      let memoryUsageBefore = process.memoryUsage().heapUsed;
      
      request(app.getHttpServer())
        .post('/database/execute/stream')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          id: testDatabase.id,
          query: largeDataQuery,
        })
        .expect(200)
        .buffer(false)
        .parse((res, callback) => {
          res.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'data') {
                  rowCount++;
                }
              } catch {
                // JSON 파싱 실패는 무시 (부분 라인일 수 있음)
              }
            });
          });
          res.on('end', () => {
            callback(null, { rowCount });
          });
        })
        .end((err, res) => {
          if (err) return done(err);

          // 메모리 사용량 확인
          const memoryUsageAfter = process.memoryUsage().heapUsed;
          const memoryIncrease = (memoryUsageAfter - memoryUsageBefore) / 1024 / 1024; // MB

          expect(rowCount).toBe(10000);
          // 스트리밍이므로 메모리 증가량이 전체 데이터 크기보다 훨씬 작아야 함
          expect(memoryIncrease).toBeLessThan(50); // 50MB 미만 증가

          done();
        });
    }, 30000); // 30초 타임아웃
  });

  describe('Stream Interruption Handling', () => {
    it('should handle client disconnection gracefully', (done) => {
      const req = request(app.getHttpServer())
        .get(`/dataset/${testDataset.id}/stream`)
        .set('Authorization', `Bearer ${authToken}`);

      // 요청 시작 후 즉시 중단
      setTimeout(() => {
        req.abort();
        // 서버가 크래시되지 않고 정상 동작하는지 확인
        setTimeout(() => {
          request(app.getHttpServer())
            .get('/health')
            .expect(200)
            .end(done);
        }, 100);
      }, 50);

      req.end();
    });
  });
});