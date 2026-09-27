import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn } from '../setup/test-app';

describe('Share URL ownership (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let intruderToken: string;
  let dashboardId: number;
  let shareUuid: string;

  const owner = {
    userId: 'e2e_share_owner',
    password: 'Passw0rd!23',
    email: 'e2e_share_owner@example.com',
  };
  const intruder = {
    userId: 'e2e_share_intruder',
    password: 'Passw0rd!23',
    email: 'e2e_share_intruder@example.com',
  };
  const endDate = '12/31/2099';

  beforeAll(async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).post('/v1/login/signup').send(owner);
    await request(app.getHttpServer()).post('/v1/login/signup').send(intruder);

    ownerToken = await signIn(app, { userId: owner.userId, password: owner.password });
    intruderToken = await signIn(app, { userId: intruder.userId, password: intruder.password });

    const created = await request(app.getHttpServer())
      .post('/v1/dashboard')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'share owner dashboard', layout: [] })
      .expect(201);

    dashboardId = created.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('다른 사용자는 대시보드 공유를 켤 수 없다 (403)', async () => {
    await request(app.getHttpServer())
      .post(`/v1/share-url/share-on/${dashboardId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ userId: intruder.userId, endDate })
      .expect(403);
  });

  it('소유자는 대시보드 공유를 켤 수 있다', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/share-url/share-on/${dashboardId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: owner.userId, endDate })
      .expect(201);

    expect(res.body.message).toBe('success');
    expect(typeof res.body.uuid).toBe('string');
    shareUuid = res.body.uuid;
  });

  it('공유된 대시보드는 비로그인 상태에서 조회할 수 있다', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/share-url/share-dashboard/${shareUuid}`)
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
  });

  it('다른 사용자는 대시보드 공유를 끌 수 없다 (403)', async () => {
    await request(app.getHttpServer())
      .post(`/v1/share-url/share-off/${dashboardId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ userId: intruder.userId, endDate })
      .expect(403);
  });
});
