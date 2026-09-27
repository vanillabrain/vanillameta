import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, SEED_USER } from '../setup/test-app';
import { LoginHistory } from '../../src/middleware/entities/login-history.entity';

describe('Login history (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('로그인 시 LoginHistory 가 기록된다', async () => {
    await request(app.getHttpServer())
      .post('/v1/login/signin')
      .send(SEED_USER)
      .expect(201);

    const history = await app
      .get(DataSource)
      .getRepository(LoginHistory)
      .find({ where: { userId: SEED_USER.userId } });

    expect(history.length).toBeGreaterThan(0);
  });
});
