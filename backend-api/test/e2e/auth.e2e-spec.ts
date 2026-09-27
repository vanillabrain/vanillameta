import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, SEED_USER } from '../setup/test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('POST /v1/login/signin', () => {
    it('시드된 guest 계정으로 로그인하면 accessToken 과 refresh 쿠키를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/login/signin')
        .send(SEED_USER)
        .expect(201);

      expect(res.body.message).toBe('success');
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.accessToken.length).toBeGreaterThan(0);

      const setCookie = res.headers['set-cookie'] as unknown as string[];
      expect(setCookie.some(cookie => cookie.startsWith('jwt_re='))).toBe(true);
    });

    it('비밀번호가 틀리면 401 을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/v1/login/signin')
        .send({ userId: SEED_USER.userId, password: 'wrong-password' })
        .expect(401);
    });

    it('필수 값(password)이 없으면 400 을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/v1/login/signin')
        .send({ userId: SEED_USER.userId })
        .expect(400);
    });
  });

  describe('POST /v1/login/signup', () => {
    const newUser = {
      userId: 'e2e_signup_user',
      password: 'Passw0rd!23',
      email: 'e2e_signup_user@example.com',
    };

    it('신규 사용자를 생성하면 success 를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/login/signup')
        .send(newUser)
        .expect(201);

      expect(res.text).toBe('success');
    });

    it('동일 userId 로 다시 가입하면 409 를 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/v1/login/signup')
        .send({ ...newUser, email: 'another@example.com' })
        .expect(409);
    });

    it('가입한 사용자로 로그인할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/login/signin')
        .send({ userId: newUser.userId, password: newUser.password })
        .expect(201);

      expect(res.body.message).toBe('success');
      expect(typeof res.body.accessToken).toBe('string');
    });
  });
});
