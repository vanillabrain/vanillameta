import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';

describe('Admin backup (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  const normalUser = {
    userId: 'e2e_backup_user',
    password: 'Passw0rd!23',
    email: 'e2e_backup_user@example.com',
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

  it('일반 사용자는 백업을 내보낼 수 없다 (403)', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/backup')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('관리자는 메타데이터 스냅샷을 내보낸다 (비밀번호 제외)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/backup')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.status).toBe('SUCCESS');
    const data = res.body.data;

    expect(typeof data.exportedAt).toBe('string');
    for (const key of ['users', 'dashboards', 'datasets', 'widgets']) {
      expect(Array.isArray(data[key])).toBe(true);
    }

    const guest = (data.users as Array<any>).find(u => u.userId === SEED_USER.userId);
    expect(guest).toBeDefined();
    expect(guest.password).toBeUndefined();
  });
});
