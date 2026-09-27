import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';
import { Dashboard } from '../../src/dashboard/entities/dashboard.entity';

describe('Backup restore (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let dashboardId: number;

  const normalUser = {
    userId: 'e2e_restore_user',
    password: 'Passw0rd!23',
    email: 'e2e_restore_user@example.com',
  };

  beforeAll(async () => {
    app = await createTestApp();
    await request(app.getHttpServer()).post('/v1/login/signup').send(normalUser);
    adminToken = await signIn(app, SEED_USER);
    userToken = await signIn(app, { userId: normalUser.userId, password: normalUser.password });

    const created = await request(app.getHttpServer())
      .post('/v1/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'restore target', layout: [] })
      .expect(201);
    dashboardId = created.body.data.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('일반 사용자는 복구를 실행할 수 없다 (403)', async () => {
    await request(app.getHttpServer())
      .post('/v1/admin/backup/restore')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ dashboards: [] })
      .expect(403);
  });

  it('관리자는 삭제된 대시보드를 스냅샷으로 복구한다', async () => {
    const repo = app.get(DataSource).getRepository(Dashboard);

    // 1) 스냅샷 추출
    const snapshot = await request(app.getHttpServer())
      .get('/v1/admin/backup')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const exported = (snapshot.body.data.dashboards as Array<any>).find(d => d.id === dashboardId);
    expect(exported).toBeDefined();

    // 2) 삭제
    await request(app.getHttpServer())
      .delete(`/v1/dashboard/${dashboardId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(await repo.findOne({ where: { id: dashboardId } })).toBeNull();

    // 3) 복구
    const restored = await request(app.getHttpServer())
      .post('/v1/admin/backup/restore')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dashboards: [exported] })
      .expect(201);

    expect(restored.body.status).toBe('SUCCESS');
    expect(restored.body.data.dashboards).toBeGreaterThanOrEqual(1);

    // 4) 복구 확인
    expect(await repo.findOne({ where: { id: dashboardId } })).not.toBeNull();
  });
});
