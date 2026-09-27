import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, signIn, SEED_USER } from '../setup/test-app';

describe('Admin RBAC (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let normalUserId: number;

  const normalUser = {
    userId: 'e2e_rbac_user',
    password: 'Passw0rd!23',
    email: 'e2e_rbac_user@example.com',
  };

  beforeAll(async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).post('/v1/login/signup').send(normalUser);

    // 시드된 guest 계정은 관리자(role=admin)로 취급한다
    adminToken = await signIn(app, SEED_USER);
    userToken = await signIn(app, { userId: normalUser.userId, password: normalUser.password });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('GET /v1/admin/users', () => {
    it('인증이 없으면 401 을 반환한다', async () => {
      await request(app.getHttpServer()).get('/v1/admin/users').expect(401);
    });

    it('일반 사용자는 403 을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('관리자는 사용자 목록을 조회할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('SUCCESS');
      expect(Array.isArray(res.body.data)).toBe(true);

      const users = res.body.data as Array<any>;
      const guest = users.find(u => u.userId === SEED_USER.userId);
      expect(guest.role).toBe('admin');

      const found = users.find(u => u.userId === normalUser.userId);
      expect(found.role).toBe('user');
      normalUserId = found.id;

      // 비밀번호는 노출되지 않아야 한다
      expect(users.every(u => u.password === undefined)).toBe(true);
    });
  });

  describe('PATCH /v1/admin/users/:id/role', () => {
    it('일반 사용자는 역할을 변경할 수 없다 (403)', async () => {
      await request(app.getHttpServer())
        .patch('/v1/admin/users/999999/role')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'admin' })
        .expect(403);
    });

    it('관리자는 사용자 역할을 admin 으로 변경할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/users/${normalUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200);

      expect(res.body.status).toBe('SUCCESS');
    });

    it('역할이 변경된 사용자는 즉시 관리자 API 에 접근할 수 있다', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('유효하지 않은 역할 값은 400 을 반환한다', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/admin/users/${normalUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superuser' })
        .expect(400);
    });
  });
});
