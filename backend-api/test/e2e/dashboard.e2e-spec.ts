import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn } from '../setup/test-app';

describe('Dashboard ownership (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let intruderToken: string;
  let dashboardId: number;

  const owner = {
    userId: 'e2e_owner',
    password: 'Passw0rd!23',
    email: 'e2e_owner@example.com',
  };
  const intruder = {
    userId: 'e2e_intruder',
    password: 'Passw0rd!23',
    email: 'e2e_intruder@example.com',
  };

  beforeAll(async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).post('/v1/login/signup').send(owner);
    await request(app.getHttpServer()).post('/v1/login/signup').send(intruder);

    ownerToken = await signIn(app, { userId: owner.userId, password: owner.password });
    intruderToken = await signIn(app, { userId: intruder.userId, password: intruder.password });

    const created = await request(app.getHttpServer())
      .post('/v1/dashboard')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'owner dashboard', layout: [] })
      .expect(201);

    dashboardId = created.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('소유자는 자신의 대시보드를 조회할 수 있다', async () => {
    await request(app.getHttpServer())
      .get(`/v1/dashboard/${dashboardId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('다른 사용자는 대시보드를 조회할 수 없다 (403)', async () => {
    await request(app.getHttpServer())
      .get(`/v1/dashboard/${dashboardId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);
  });

  it('다른 사용자는 대시보드를 수정할 수 없다 (403)', async () => {
    await request(app.getHttpServer())
      .put(`/v1/dashboard/${dashboardId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ title: 'hacked by intruder' })
      .expect(403);
  });

  it('다른 사용자는 대시보드를 삭제할 수 없다 (403)', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/dashboard/${dashboardId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);
  });

  it('소유자는 자신의 대시보드를 수정할 수 있다', async () => {
    const res = await request(app.getHttpServer())
      .put(`/v1/dashboard/${dashboardId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'renamed by owner' })
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
  });

  it('소유자는 자신의 대시보드를 삭제할 수 있다', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/dashboard/${dashboardId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
  });
});
