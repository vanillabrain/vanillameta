import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn } from '../setup/test-app';

describe('Dashboard list scoping (e2e)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let dashboardId: number;

  const userA = { userId: 'e2e_list_a', password: 'Passw0rd!23', email: 'e2e_list_a@example.com' };
  const userB = { userId: 'e2e_list_b', password: 'Passw0rd!23', email: 'e2e_list_b@example.com' };

  beforeAll(async () => {
    app = await createTestApp();
    await request(app.getHttpServer()).post('/v1/login/signup').send(userA);
    await request(app.getHttpServer()).post('/v1/login/signup').send(userB);
    tokenA = await signIn(app, { userId: userA.userId, password: userA.password });
    tokenB = await signIn(app, { userId: userB.userId, password: userB.password });

    const created = await request(app.getHttpServer())
      .post('/v1/dashboard')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'list scoping dashboard', layout: [] })
      .expect(201);
    dashboardId = created.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('본인 대시보드 목록에는 포함되고, 타 사용자 목록에는 포함되지 않는다', async () => {
    const mine = await request(app.getHttpServer())
      .get('/v1/dashboard')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect((mine.body.data as Array<any>).map(d => d.id)).toContain(dashboardId);

    const others = await request(app.getHttpServer())
      .get('/v1/dashboard')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect((others.body.data as Array<any>).map(d => d.id)).not.toContain(dashboardId);
  });
});
