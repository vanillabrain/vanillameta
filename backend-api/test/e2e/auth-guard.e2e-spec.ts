import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup/test-app';

describe('Auth guard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it.each([
    ['/v1/widget'],
    ['/v1/dataset'],
    ['/v1/dashboard'],
    ['/v1/component'],
    ['/v1/template'],
    ['/v1/admin/users'],
    ['/v1/user/userinfo'],
  ])('인증 없이 %s 접근 시 401 을 반환한다', async path => {
    await request(app.getHttpServer()).get(path).expect(401);
  });
});
