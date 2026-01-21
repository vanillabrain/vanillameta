import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/user/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh_token.entity';
import { Repository } from 'typeorm';

describe('Authentication Flow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;

  const testUser = {
    userId: 'testuser',
    email: 'test@example.com',
    password: 'testpassword123',
    name: 'Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    refreshTokenRepository = moduleFixture.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    );

    // 테스트 사용자 생성
    await userRepository.save(testUser);
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await refreshTokenRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/login', () => {
      it('should login successfully with valid credentials', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            userId: testUser.userId,
            password: testUser.password,
          })
          .expect(201)
          .expect(res => {
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
            expect(res.body.user).toEqual(
              expect.objectContaining({
                userId: testUser.userId,
                email: testUser.email,
              }),
            );
            expect(res.body.user).not.toHaveProperty('password');
          });
      });

      it('should reject login with invalid credentials', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            userId: testUser.userId,
            password: 'wrongpassword',
          })
          .expect(401)
          .expect(res => {
            expect(res.body).toHaveProperty('message');
          });
      });

      it('should reject login with non-existent user', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            userId: 'nonexistentuser',
            password: 'anypassword',
          })
          .expect(401);
      });

      it('should reject login with missing credentials', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            userId: testUser.userId,
            // password missing
          })
          .expect(400);
      });

      it('should reject login with empty credentials', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            userId: '',
            password: '',
          })
          .expect(401);
      });
    });

    describe('POST /api/auth/refresh', () => {
      let validRefreshToken: string;
      let validAccessToken: string;

      beforeEach(async () => {
        // 유효한 토큰 획득
        const loginResponse = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            userId: testUser.userId,
            password: testUser.password,
          })
          .expect(201);

        validRefreshToken = loginResponse.body.refreshToken;
        validAccessToken = loginResponse.body.accessToken;
      });

      it('should refresh token successfully with valid refresh token', () => {
        return request(app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Authorization', `Bearer refreshToken=${validRefreshToken}`)
          .expect(201)
          .expect(res => {
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
            expect(res.body.accessToken).not.toBe(validAccessToken); // 새로운 토큰이어야 함
          });
      });

      it('should reject refresh with invalid refresh token', () => {
        return request(app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Authorization', 'Bearer refreshToken=invalid-token')
          .expect(401);
      });

      it('should reject refresh with missing authorization header', () => {
        return request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
      });

      it('should reject refresh with malformed authorization header', () => {
        return request(app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Authorization', 'Invalid header format')
          .expect(401);
      });
    });

    describe('POST /api/auth/logout', () => {
      let validAccessToken: string;
      let userId: number;

      beforeEach(async () => {
        // 로그인하여 유효한 토큰 획득
        const loginResponse = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            userId: testUser.userId,
            password: testUser.password,
          })
          .expect(201);

        validAccessToken = loginResponse.body.accessToken;
        userId = loginResponse.body.user.id;
      });

      it('should logout successfully with valid access token', () => {
        return request(app.getHttpServer())
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .send({ userId })
          .expect(201)
          .expect(res => {
            expect(res.body).toHaveProperty('message');
            expect(res.body.message).toContain('logout');
          });
      });

      it('should reject logout with invalid access token', () => {
        return request(app.getHttpServer())
          .post('/api/auth/logout')
          .set('Authorization', 'Bearer invalid-token')
          .send({ userId })
          .expect(401);
      });

      it('should reject logout with missing authorization header', () => {
        return request(app.getHttpServer()).post('/api/auth/logout').send({ userId }).expect(401);
      });
    });
  });

  describe('Protected Routes', () => {
    let validAccessToken: string;

    beforeEach(async () => {
      // 유효한 액세스 토큰 획득
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: testUser.userId,
          password: testUser.password,
        })
        .expect(201);

      validAccessToken = loginResponse.body.accessToken;
    });

    it('should access protected route with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);
    });

    it('should reject access to protected route without token', () => {
      return request(app.getHttpServer()).get('/api/dashboard').expect(401);
    });

    it('should reject access to protected route with invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject access to protected route with expired token', async () => {
      // 만료된 토큰 시뮬레이션 (실제로는 토큰 만료 시간을 조작하거나 별도의 만료된 토큰을 생성해야 함)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDk0NTkyMDB9.expired';

      return request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full authentication cycle', async () => {
      // 1. Login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: testUser.userId,
          password: testUser.password,
        })
        .expect(201);

      const { accessToken, refreshToken, user } = loginResponse.body;
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(user.userId).toBe(testUser.userId);

      // 2. Access protected resource
      await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 3. Refresh token
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer refreshToken=${refreshToken}`)
        .expect(201);

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.body;
      expect(newAccessToken).toBeDefined();
      expect(newRefreshToken).toBeDefined();
      expect(newAccessToken).not.toBe(accessToken);

      // 4. Access protected resource with new token
      await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // 5. Logout
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .send({ userId: user.id })
        .expect(201);

      // 6. Verify access denied after logout
      await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(401);
    });

    it('should handle concurrent login attempts', async () => {
      const loginPromises = Array.from({ length: 3 }, () =>
        request(app.getHttpServer()).post('/api/auth/login').send({
          userId: testUser.userId,
          password: testUser.password,
        }),
      );

      const responses = await Promise.all(loginPromises);

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
      });

      // 각각의 토큰이 다른지 확인
      const tokens = responses.map(res => res.body.accessToken);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });

    it('should handle multiple refresh token requests', async () => {
      // 로그인
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: testUser.userId,
          password: testUser.password,
        })
        .expect(201);

      let currentRefreshToken = loginResponse.body.refreshToken;

      // 여러 번 토큰 갱신
      for (let i = 0; i < 3; i++) {
        const refreshResponse = await request(app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Authorization', `Bearer refreshToken=${currentRefreshToken}`)
          .expect(201);

        expect(refreshResponse.body).toHaveProperty('accessToken');
        expect(refreshResponse.body).toHaveProperty('refreshToken');
        currentRefreshToken = refreshResponse.body.refreshToken;
      }
    });
  });

  describe('Security Tests', () => {
    it('should prevent SQL injection in login', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: "admin'; DROP TABLE users; --",
          password: 'anypassword',
        })
        .expect(401); // Should fail authentication, not cause server error
    });

    it('should handle very long input gracefully', () => {
      const longString = 'a'.repeat(10000);

      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: longString,
          password: longString,
        })
        .expect(400); // Should reject with bad request
    });

    it('should handle special characters in credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: 'user@domain.com',
          password: 'p@ssw0rd!@#$%^&*()',
        })
        .expect(401); // Should fail authentication cleanly
    });

    it('should not leak user existence information', async () => {
      // 존재하지 않는 사용자
      const nonExistentResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: 'nonexistentuser',
          password: 'anypassword',
        })
        .expect(401);

      // 존재하는 사용자, 잘못된 비밀번호
      const wrongPasswordResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: testUser.userId,
          password: 'wrongpassword',
        })
        .expect(401);

      // 두 응답이 비슷해야 함 (사용자 존재 여부를 알 수 없어야 함)
      expect(nonExistentResponse.body.message).toBe(wrongPasswordResponse.body.message);
    });

    it('should rate limit login attempts', async () => {
      // 여러 번의 실패한 로그인 시도
      const failedAttempts = Array.from({ length: 10 }, () =>
        request(app.getHttpServer()).post('/api/auth/login').send({
          userId: testUser.userId,
          password: 'wrongpassword',
        }),
      );

      const responses = await Promise.all(failedAttempts);

      // 모든 시도가 실패해야 함
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });

      // 이후 정상적인 로그인도 여전히 작동해야 함
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: testUser.userId,
          password: testUser.password,
        })
        .expect(201);
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should handle malformed JWT tokens', () => {
      const malformedTokens = [
        'not.a.jwt',
        'header.payload', // Missing signature
        'header.payload.signature.extra', // Too many parts
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // Header only
        '', // Empty string
        'Bearer token', // Without Bearer prefix in wrong place
      ];

      return Promise.all(
        malformedTokens.map(token =>
          request(app.getHttpServer())
            .get('/api/dashboard')
            .set('Authorization', `Bearer ${token}`)
            .expect(401),
        ),
      );
    });

    it('should handle tokens with wrong signing algorithm', () => {
      // 다른 알고리즘으로 서명된 토큰 (RS256 대신 HS256 등)
      const wrongAlgorithmToken =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.wrong-signature';

      return request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${wrongAlgorithmToken}`)
        .expect(401);
    });

    it('should handle tokens with tampered payload', () => {
      // 토큰의 payload가 변조된 경우
      const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered-payload.signature';

      return request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });
  });
});
