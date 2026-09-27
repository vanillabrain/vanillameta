import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';

describe('Share URL expiry (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let dashboardId: number;

  beforeAll(async () => {
    app = await createTestApp();
    token = await signIn(app, SEED_USER);

    const created = await request(app.getHttpServer())
      .post('/v1/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'expiring share dashboard', layout: [] })
      .expect(201);
    dashboardId = created.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('공유 기한이 지나면 비로그인 조회가 401 이다', async () => {
    const shareOn = await request(app.getHttpServer())
      .post(`/v1/share-url/share-on/${dashboardId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: SEED_USER.userId, endDate: '01/01/2000' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/v1/share-url/share-dashboard/${shareOn.body.uuid}`)
      .expect(401);
  });
});
