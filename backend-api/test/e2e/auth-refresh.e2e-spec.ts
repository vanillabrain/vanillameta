import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, SEED_USER } from '../setup/test-app';

describe('Access token refresh (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('refresh 쿠키로 access token 을 재발급한다', async () => {
    const signin = await request(app.getHttpServer())
      .post('/v1/login/signin')
      .send(SEED_USER)
      .expect(201);

    const setCookie = signin.headers['set-cookie'] as unknown as string[];
    const refreshCookie = setCookie.find(cookie => cookie.startsWith('jwt_re='));
    expect(refreshCookie).toBeDefined();

    // 쿠키 속성(Path/HttpOnly...)을 제외한 name=value 만 전달
    const cookieHeader = refreshCookie.split(';')[0];

    const refreshed = await request(app.getHttpServer())
      .post('/v1/user/get-access-token')
      .set('Cookie', cookieHeader)
      .expect(201);

    expect(typeof refreshed.body.accessToken).toBe('string');
    expect(refreshed.body.accessToken.length).toBeGreaterThan(0);
  });

  it('쿠키가 없으면 401 을 반환한다', async () => {
    await request(app.getHttpServer()).post('/v1/user/get-access-token').expect(401);
  });
});
