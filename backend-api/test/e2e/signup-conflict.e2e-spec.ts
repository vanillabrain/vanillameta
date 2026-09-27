import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../setup/test-app';

describe('Signup conflict (e2e)', () => {
  let app: INestApplication;

  const base = {
    userId: 'e2e_conflict_user',
    password: 'Passw0rd!23',
    email: 'e2e_conflict_user@example.com',
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('동일 userId 로 다시 가입하면 409 를 반환한다', async () => {
    await request(app.getHttpServer()).post('/v1/login/signup').send(base).expect(201);

    await request(app.getHttpServer())
      .post('/v1/login/signup')
      .send({ ...base, email: 'another-email@example.com' })
      .expect(409);
  });

  it('동일 email 로 가입하면 409 를 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/v1/login/signup')
      .send({ ...base, userId: 'e2e_conflict_user2' })
      .expect(409);
  });
});
