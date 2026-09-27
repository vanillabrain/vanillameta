import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';

describe('Audit log (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let adminDashboardId: number;

  const normalUser = {
    userId: 'e2e_audit_user',
    password: 'Passw0rd!23',
    email: 'e2e_audit_user@example.com',
  };

  beforeAll(async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).post('/v1/login/signup').send(normalUser);

    adminToken = await signIn(app, SEED_USER);
    userToken = await signIn(app, { userId: normalUser.userId, password: normalUser.password });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('일반 사용자는 감사 로그를 조회할 수 없다 (403)', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('성공한 쓰기 요청이 감사 로그로 기록된다', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'audit target', layout: [] })
      .expect(201);
    adminDashboardId = created.body.data.id;

    const res = await request(app.getHttpServer())
      .get('/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
    const entry = (res.body.data as Array<any>).find(
      log => log.method === 'POST' && log.path.includes('/v1/dashboard'),
    );

    expect(entry).toBeDefined();
    expect(entry.actorUserId).toBe(SEED_USER.userId);
    expect(entry.statusCode).toBe(201);
  });

  it('거부된 쓰기 요청도 상태코드와 함께 기록된다', async () => {
    // 일반 사용자가 관리자 소유 대시보드를 수정 시도 → 403
    await request(app.getHttpServer())
      .put(`/v1/dashboard/${adminDashboardId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'nope' })
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = (res.body.data as Array<any>).find(
      log =>
        log.method === 'PUT' &&
        log.path.includes(`/v1/dashboard/${adminDashboardId}`) &&
        log.statusCode === 403,
    );

    expect(entry).toBeDefined();
    expect(entry.actorUserId).toBe(normalUser.userId);
  });
});
